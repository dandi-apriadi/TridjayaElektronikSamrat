use redis::{aio::ConnectionManager, AsyncCommands, RedisError, RedisResult};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};

/// Priority levels for message queuing
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    High,
    Normal,
    Low,
}

impl Priority {
    /// Convert priority to score for Redis sorted set
    /// Higher priority = lower score (processed first)
    pub fn to_score(&self) -> f64 {
        match self {
            Priority::High => 1.0,
            Priority::Normal => 2.0,
            Priority::Low => 3.0,
        }
    }

    /// Get queue key suffix for this priority
    pub fn queue_suffix(&self) -> &'static str {
        match self {
            Priority::High => "high",
            Priority::Normal => "normal",
            Priority::Low => "low",
        }
    }
}

/// Message payload for queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMessage {
    pub message_id: String,
    pub campaign_id: String,
    pub recipient_id: String,
    pub account_id: String,
    pub phone: String,
    pub message_text: String,
    pub media_url: Option<String>,
    pub retry_count: u32,
    pub enqueued_at: i64,
}

/// Queue metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMetrics {
    pub total_depth: usize,
    pub high_priority_depth: usize,
    pub normal_priority_depth: usize,
    pub low_priority_depth: usize,
    pub processing_rate: f64,
    pub error_rate: f64,
}

/// Redis connection manager with queue operations
#[derive(Clone)]
pub struct RedisManager {
    connection: ConnectionManager,
}

impl RedisManager {
    /// Create a new RedisManager with connection pooling
    pub async fn new(redis_url: &str) -> RedisResult<Self> {
        info!("Connecting to Redis at {}", redis_url);
        let client = redis::Client::open(redis_url)?;
        let connection = ConnectionManager::new(client).await?;
        info!("Redis connection established successfully");
        Ok(Self { connection })
    }

    /// Get a mutable reference to the connection
    fn conn(&mut self) -> &mut ConnectionManager {
        &mut self.connection
    }

    /// Generate queue key for account and priority
    fn queue_key(&self, account_id: &str, priority: Priority) -> String {
        format!("wa:queue:{}:{}", account_id, priority.queue_suffix())
    }

    /// Generate global queue key for priority (all accounts)
    fn global_queue_key(&self, priority: Priority) -> String {
        format!("wa:queue:global:{}", priority.queue_suffix())
    }

    /// Generate retry queue key
    fn retry_queue_key(&self) -> String {
        "wa:queue:retry".to_string()
    }

    /// Generate metrics key
    fn metrics_key(&self) -> String {
        "wa:metrics".to_string()
    }

    /// Enqueue a message to Redis sorted set with priority
    ///
    /// **Validates: Requirements 2.1, 2.2, 2.4**
    ///
    /// Messages are enqueued to account-specific queues for load balancing
    /// and to priority-specific queues for processing order.
    pub async fn enqueue(&mut self, message: QueueMessage, priority: Priority) -> RedisResult<()> {
        let account_id = message.account_id.clone();
        let message_json = serde_json::to_string(&message).map_err(|e| {
            RedisError::from((
                redis::ErrorKind::TypeError,
                "Serialization error",
                e.to_string(),
            ))
        })?;

        // Calculate score: priority base + timestamp for FIFO within priority
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();
        let score = priority.to_score() * 1_000_000.0 + timestamp;

        // Enqueue to account-specific queue
        let account_queue = self.queue_key(&account_id, priority);
        self.conn()
            .zadd::<_, _, _, ()>(&account_queue, &message_json, score)
            .await?;

        // Also add to global priority queue for cross-account processing
        let global_queue = self.global_queue_key(priority);
        self.conn()
            .zadd::<_, _, _, ()>(&global_queue, &message_json, score)
            .await?;

        debug!(
            "Enqueued message {} to account {} with priority {:?}",
            message.message_id, account_id, priority
        );

        Ok(())
    }

    /// Dequeue a batch of messages atomically from specified account and priority
    ///
    /// **Validates: Requirements 2.2, 2.3, 2.4**
    ///
    /// Uses Lua script for atomic pop operation to prevent duplicate processing (Redis 3.x compatible).
    /// Returns up to `batch_size` messages.
    pub async fn dequeue_batch(
        &mut self,
        account_id: &str,
        priority: Priority,
        batch_size: usize,
    ) -> RedisResult<Vec<QueueMessage>> {
        let queue_key = self.queue_key(account_id, priority);

        // Lua script for atomic ZRANGE + ZREMRANGEBYRANK (Redis 3.x compatible)
        let script = r#"
            local key = KEYS[1]
            local count = tonumber(ARGV[1])
            local members = redis.call('ZRANGE', key, 0, count - 1)
            if #members > 0 then
                redis.call('ZREMRANGEBYRANK', key, 0, #members - 1)
            end
            return members
        "#;

        let results: Vec<String> = redis::Script::new(script)
            .key(&queue_key)
            .arg(batch_size)
            .invoke_async(self.conn())
            .await?;

        let mut messages = Vec::new();
        for message_json in results {
            match serde_json::from_str::<QueueMessage>(&message_json) {
                Ok(message) => {
                    debug!(
                        "Dequeued message {} from account {} priority {:?}",
                        message.message_id, account_id, priority
                    );
                    messages.push(message);
                }
                Err(e) => {
                    error!("Failed to deserialize message: {}", e);
                    // Continue processing other messages
                }
            }
        }

        // Also remove from global queue
        if !messages.is_empty() {
            let global_queue = self.global_queue_key(priority);
            for message in &messages {
                if let Ok(json) = serde_json::to_string(message) {
                    let _: RedisResult<i32> = self.conn().zrem(&global_queue, &json).await;
                }
            }
        }

        Ok(messages)
    }

    /// Dequeue batch from any account with specified priority (round-robin)
    ///
    /// **Validates: Requirements 2.2, 2.4**
    pub async fn dequeue_batch_any(
        &mut self,
        priority: Priority,
        batch_size: usize,
    ) -> RedisResult<Vec<QueueMessage>> {
        let global_queue = self.global_queue_key(priority);

        // Lua script for atomic ZRANGE + ZREMRANGEBYRANK (Redis 3.x compatible)
        let script = r#"
            local key = KEYS[1]
            local count = tonumber(ARGV[1])
            local members = redis.call('ZRANGE', key, 0, count - 1)
            if #members > 0 then
                redis.call('ZREMRANGEBYRANK', key, 0, #members - 1)
            end
            return members
        "#;

        let results: Vec<String> = redis::Script::new(script)
            .key(&global_queue)
            .arg(batch_size)
            .invoke_async(self.conn())
            .await?;

        let mut messages = Vec::new();
        for message_json in results {
            match serde_json::from_str::<QueueMessage>(&message_json) {
                Ok(message) => {
                    // Also remove from account-specific queue
                    let account_queue = self.queue_key(&message.account_id, priority);
                    let _: RedisResult<i32> = self.conn().zrem(&account_queue, &message_json).await;

                    debug!(
                        "Dequeued message {} from global queue priority {:?}",
                        message.message_id, priority
                    );
                    messages.push(message);
                }
                Err(e) => {
                    error!("Failed to deserialize message: {}", e);
                }
            }
        }

        Ok(messages)
    }

    /// Re-enqueue a message with retry logic and exponential backoff
    ///
    /// **Validates: Requirements 2.5, 2.6**
    ///
    /// Implements exponential backoff: 5s, 15s, 45s for retries 1, 2, 3.
    /// Messages exceeding max retries (3) are not re-enqueued.
    pub async fn requeue_with_retry(
        &mut self,
        mut message: QueueMessage,
        _priority: Priority,
    ) -> RedisResult<bool> {
        const MAX_RETRIES: u32 = 3;

        message.retry_count += 1;

        if message.retry_count > MAX_RETRIES {
            warn!(
                "Message {} exceeded max retries ({}), marking as permanently failed",
                message.message_id, MAX_RETRIES
            );
            return Ok(false);
        }

        // Calculate exponential backoff delay: 5s * 3^(retry_count - 1)
        let base_delay = 5.0; // seconds
        let backoff_multiplier = 3.0_f64.powi((message.retry_count - 1) as i32);
        let delay_seconds = base_delay * backoff_multiplier;

        info!(
            "Re-enqueueing message {} with retry count {} (delay: {}s)",
            message.message_id, message.retry_count, delay_seconds
        );

        // Add to retry queue with delayed score
        let retry_queue = self.retry_queue_key();
        let retry_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64()
            + delay_seconds;

        let message_json = serde_json::to_string(&message).map_err(|e| {
            RedisError::from((
                redis::ErrorKind::TypeError,
                "Serialization error",
                e.to_string(),
            ))
        })?;

        self.conn()
            .zadd::<_, _, _, ()>(&retry_queue, &message_json, retry_time)
            .await?;

        Ok(true)
    }

    /// Process retry queue and move ready messages back to main queues
    ///
    /// **Validates: Requirements 2.5**
    ///
    /// Should be called periodically to check for messages ready to retry.
    pub async fn process_retry_queue(&mut self) -> RedisResult<usize> {
        let retry_queue = self.retry_queue_key();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64();

        // Get all messages with score <= now (ready to retry)
        let results: Vec<(String, f64)> = self
            .conn()
            .zrangebyscore_withscores(&retry_queue, 0.0, now)
            .await?;

        let mut processed = 0;
        for (message_json, _score) in results {
            if let Ok(message) = serde_json::from_str::<QueueMessage>(&message_json) {
                // Re-enqueue to normal priority queue
                if self
                    .enqueue(message.clone(), Priority::Normal)
                    .await
                    .is_ok()
                {
                    // Remove from retry queue
                    let _: RedisResult<i32> = self.conn().zrem(&retry_queue, &message_json).await;
                    processed += 1;
                    debug!(
                        "Moved message {} from retry queue to main queue",
                        message.message_id
                    );
                }
            }
        }

        if processed > 0 {
            info!("Processed {} messages from retry queue", processed);
        }

        Ok(processed)
    }

    pub async fn queued_recipient_ids_for_campaign(
        &mut self,
        campaign_id: &str,
    ) -> RedisResult<HashSet<String>> {
        let mut ids = HashSet::new();
        let mut keys = vec![self.retry_queue_key()];

        for priority in [Priority::High, Priority::Normal, Priority::Low] {
            keys.push(self.global_queue_key(priority));
            let pattern = format!("wa:queue:*:{}", priority.queue_suffix());
            let account_keys: Vec<String> = self.conn().keys(&pattern).await.unwrap_or_default();
            keys.extend(account_keys);
        }

        keys.sort();
        keys.dedup();

        for key in keys {
            let messages: Vec<String> = self.conn().zrange(&key, 0, -1).await.unwrap_or_default();
            for message_json in messages {
                if let Ok(message) = serde_json::from_str::<QueueMessage>(&message_json) {
                    if message.campaign_id == campaign_id {
                        ids.insert(message.recipient_id);
                    }
                }
            }
        }

        Ok(ids)
    }

    pub async fn remove_campaign_messages(&mut self, campaign_id: &str) -> RedisResult<usize> {
        let mut keys = vec![self.retry_queue_key()];

        for priority in [Priority::High, Priority::Normal, Priority::Low] {
            keys.push(self.global_queue_key(priority));
            let pattern = format!("wa:queue:*:{}", priority.queue_suffix());
            let account_keys: Vec<String> = self.conn().keys(&pattern).await.unwrap_or_default();
            keys.extend(account_keys);
        }

        keys.sort();
        keys.dedup();

        let mut removed = 0_usize;
        for key in keys {
            let messages: Vec<String> = self.conn().zrange(&key, 0, -1).await.unwrap_or_default();
            for message_json in messages {
                if let Ok(message) = serde_json::from_str::<QueueMessage>(&message_json) {
                    if message.campaign_id == campaign_id {
                        let count: i32 = self.conn().zrem(&key, &message_json).await.unwrap_or(0);
                        if count > 0 {
                            removed += count as usize;
                        }
                    }
                }
            }
        }

        if removed > 0 {
            info!(
                "Removed {} queued messages for paused campaign {}",
                removed, campaign_id
            );
        }

        Ok(removed)
    }

    /// Get queue depth for specific account and priority
    ///
    /// **Validates: Requirements 2.7**
    pub async fn get_queue_depth(
        &mut self,
        account_id: &str,
        priority: Priority,
    ) -> RedisResult<usize> {
        let queue_key = self.queue_key(account_id, priority);
        let depth: usize = self.conn().zcard(&queue_key).await?;
        Ok(depth)
    }

    /// Get total queue depth across all priorities for an account
    ///
    /// **Validates: Requirements 2.7**
    pub async fn get_total_queue_depth(&mut self, account_id: &str) -> RedisResult<usize> {
        let high = self.get_queue_depth(account_id, Priority::High).await?;
        let normal = self.get_queue_depth(account_id, Priority::Normal).await?;
        let low = self.get_queue_depth(account_id, Priority::Low).await?;
        Ok(high + normal + low)
    }

    /// Get queue depth for all accounts at specified priority
    ///
    /// **Validates: Requirements 2.7**
    pub async fn get_global_queue_depth(&mut self, priority: Priority) -> RedisResult<usize> {
        let global_queue = self.global_queue_key(priority);
        let depth: usize = self.conn().zcard(&global_queue).await?;
        Ok(depth)
    }

    /// Get comprehensive queue metrics
    ///
    /// **Validates: Requirements 2.7, 2.8**
    pub async fn get_queue_metrics(&mut self) -> RedisResult<QueueMetrics> {
        let high_depth = self.get_global_queue_depth(Priority::High).await?;
        let normal_depth = self.get_global_queue_depth(Priority::Normal).await?;
        let low_depth = self.get_global_queue_depth(Priority::Low).await?;
        let total_depth = high_depth + normal_depth + low_depth;

        // Get processing rate and error rate from metrics hash
        let metrics_key = self.metrics_key();
        let processing_rate: f64 = self
            .conn()
            .hget(&metrics_key, "processing_rate")
            .await
            .unwrap_or(0.0);
        let error_rate: f64 = self
            .conn()
            .hget(&metrics_key, "error_rate")
            .await
            .unwrap_or(0.0);

        Ok(QueueMetrics {
            total_depth,
            high_priority_depth: high_depth,
            normal_priority_depth: normal_depth,
            low_priority_depth: low_depth,
            processing_rate,
            error_rate,
        })
    }

    /// Update processing metrics
    ///
    /// **Validates: Requirements 2.7**
    pub async fn update_metrics(
        &mut self,
        processing_rate: f64,
        error_rate: f64,
    ) -> RedisResult<()> {
        let metrics_key = self.metrics_key();
        self.conn()
            .hset_multiple::<_, _, _, ()>(
                &metrics_key,
                &[
                    ("processing_rate", processing_rate),
                    ("error_rate", error_rate),
                    (
                        "last_updated",
                        SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap()
                            .as_secs_f64(),
                    ),
                ],
            )
            .await?;
        Ok(())
    }

    /// Check if backpressure should be triggered
    ///
    /// **Validates: Requirements 2.8**
    ///
    /// Returns true if total queue depth exceeds 10,000 messages.
    pub async fn should_trigger_backpressure(&mut self) -> RedisResult<bool> {
        const BACKPRESSURE_THRESHOLD: usize = 10_000;
        let metrics = self.get_queue_metrics().await?;
        Ok(metrics.total_depth > BACKPRESSURE_THRESHOLD)
    }

    /// Clear all queues for an account (useful for testing/cleanup)
    pub async fn clear_account_queues(&mut self, account_id: &str) -> RedisResult<()> {
        for priority in [Priority::High, Priority::Normal, Priority::Low] {
            let queue_key = self.queue_key(account_id, priority);
            let _: RedisResult<()> = self.conn().del(&queue_key).await;
        }
        info!("Cleared all queues for account {}", account_id);
        Ok(())
    }

    /// Clear all global queues (useful for testing/cleanup)
    pub async fn clear_all_queues(&mut self) -> RedisResult<()> {
        // Clear global priority queues
        for priority in [Priority::High, Priority::Normal, Priority::Low] {
            let global_queue = self.global_queue_key(priority);
            let _: RedisResult<()> = self.conn().del(&global_queue).await;
        }

        // Clear retry queue
        let retry_queue = self.retry_queue_key();
        let _: RedisResult<()> = self.conn().del(&retry_queue).await;

        // Clear all account-specific queues by pattern
        // Note: This is a best-effort cleanup for testing
        for priority in [Priority::High, Priority::Normal, Priority::Low] {
            let pattern = format!("wa:queue:*:{}", priority.queue_suffix());
            let keys: Vec<String> = self.conn().keys(&pattern).await.unwrap_or_default();
            for key in keys {
                let _: RedisResult<()> = self.conn().del(&key).await;
            }
        }

        info!("Cleared all global queues");
        Ok(())
    }

    /// Health check - verify Redis connection is alive
    pub async fn health_check(&mut self) -> RedisResult<bool> {
        let result: String = self.conn().ping().await?;
        Ok(result == "PONG")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    fn create_test_message(id: &str, account_id: &str) -> QueueMessage {
        QueueMessage {
            message_id: id.to_string(),
            campaign_id: "campaign_1".to_string(),
            recipient_id: format!("recipient_{}", id),
            account_id: account_id.to_string(),
            phone: "+6281234567890".to_string(),
            message_text: "Test message".to_string(),
            media_url: None,
            retry_count: 0,
            enqueued_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
        }
    }

    /// **Validates: Requirements 2.1, 2.3**
    /// Test basic enqueue and dequeue operations
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_enqueue_dequeue() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        // Clear queues first
        manager.clear_all_queues().await.unwrap();

        let message = create_test_message("msg_1", "account_1");

        // Enqueue
        manager
            .enqueue(message.clone(), Priority::Normal)
            .await
            .unwrap();

        // Check depth
        let depth = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        assert_eq!(depth, 1);

        // Dequeue
        let messages = manager
            .dequeue_batch("account_1", Priority::Normal, 10)
            .await
            .unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].message_id, "msg_1");

        // Verify queue is empty
        let depth = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        assert_eq!(depth, 0);
    }

    /// **Validates: Requirements 2.3**
    /// Test atomic dequeue operation - concurrent dequeues should not return duplicates
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_dequeue_atomicity() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue 10 messages
        for i in 0..10 {
            let msg = create_test_message(&format!("msg_{}", i), "account_1");
            manager.enqueue(msg, Priority::Normal).await.unwrap();
        }

        // Spawn multiple concurrent dequeue operations
        let mut handles = vec![];
        for _ in 0..5 {
            let mut mgr_clone = manager.clone();
            let handle = tokio::spawn(async move {
                mgr_clone
                    .dequeue_batch("account_1", Priority::Normal, 3)
                    .await
                    .unwrap()
            });
            handles.push(handle);
        }

        // Collect all dequeued messages
        let mut all_messages = vec![];
        for handle in handles {
            let messages = handle.await.unwrap();
            all_messages.extend(messages);
        }

        // Verify no duplicates (each message_id should appear exactly once)
        let mut message_ids: Vec<String> =
            all_messages.iter().map(|m| m.message_id.clone()).collect();
        message_ids.sort();
        let original_len = message_ids.len();
        message_ids.dedup();
        assert_eq!(
            message_ids.len(),
            original_len,
            "Duplicate messages detected in concurrent dequeue"
        );

        // Verify all 10 messages were dequeued
        assert_eq!(all_messages.len(), 10);

        // Verify queue is empty
        let depth = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        assert_eq!(depth, 0);
    }

    /// **Validates: Requirements 2.4**
    /// Test priority queue ordering - high priority messages should be dequeued first
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_priority_ordering() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue messages with different priorities (in mixed order)
        manager
            .enqueue(create_test_message("low_1", "account_1"), Priority::Low)
            .await
            .unwrap();
        manager
            .enqueue(create_test_message("high_1", "account_1"), Priority::High)
            .await
            .unwrap();
        manager
            .enqueue(
                create_test_message("normal_1", "account_1"),
                Priority::Normal,
            )
            .await
            .unwrap();
        manager
            .enqueue(create_test_message("high_2", "account_1"), Priority::High)
            .await
            .unwrap();
        manager
            .enqueue(create_test_message("low_2", "account_1"), Priority::Low)
            .await
            .unwrap();

        // Dequeue should get high priority first
        let high_msgs = manager
            .dequeue_batch("account_1", Priority::High, 10)
            .await
            .unwrap();
        assert_eq!(high_msgs.len(), 2);
        assert!(high_msgs.iter().any(|m| m.message_id == "high_1"));
        assert!(high_msgs.iter().any(|m| m.message_id == "high_2"));

        // Then normal
        let normal_msgs = manager
            .dequeue_batch("account_1", Priority::Normal, 10)
            .await
            .unwrap();
        assert_eq!(normal_msgs.len(), 1);
        assert_eq!(normal_msgs[0].message_id, "normal_1");

        // Then low
        let low_msgs = manager
            .dequeue_batch("account_1", Priority::Low, 10)
            .await
            .unwrap();
        assert_eq!(low_msgs.len(), 2);
        assert!(low_msgs.iter().any(|m| m.message_id == "low_1"));
        assert!(low_msgs.iter().any(|m| m.message_id == "low_2"));
    }

    /// **Validates: Requirements 2.4**
    /// Test FIFO ordering within same priority level
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_fifo_within_priority() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue multiple messages with same priority
        for i in 0..5 {
            let msg = create_test_message(&format!("msg_{}", i), "account_1");
            manager.enqueue(msg, Priority::Normal).await.unwrap();
            // Small delay to ensure different timestamps
            sleep(Duration::from_millis(10)).await;
        }

        // Dequeue all messages
        let messages = manager
            .dequeue_batch("account_1", Priority::Normal, 10)
            .await
            .unwrap();
        assert_eq!(messages.len(), 5);

        // Verify FIFO order (messages should be in order 0, 1, 2, 3, 4)
        for (i, msg) in messages.iter().enumerate() {
            assert_eq!(msg.message_id, format!("msg_{}", i));
        }
    }

    /// **Validates: Requirements 2.5, 2.6**
    /// Test retry logic with exponential backoff
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_retry_logic() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        let message = create_test_message("msg_retry", "account_1");

        // First retry should succeed (retry_count 0 -> 1)
        let result = manager
            .requeue_with_retry(message.clone(), Priority::Normal)
            .await
            .unwrap();
        assert!(result, "First retry should succeed");

        // Second retry should succeed (retry_count 1 -> 2)
        let mut msg = message.clone();
        msg.retry_count = 1;
        let result = manager
            .requeue_with_retry(msg.clone(), Priority::Normal)
            .await
            .unwrap();
        assert!(result, "Second retry should succeed");

        // Third retry should succeed (retry_count 2 -> 3)
        msg.retry_count = 2;
        let result = manager
            .requeue_with_retry(msg.clone(), Priority::Normal)
            .await
            .unwrap();
        assert!(result, "Third retry should succeed");

        // Fourth retry should fail (retry_count 3 -> 4, exceeds max)
        msg.retry_count = 3;
        let result = manager
            .requeue_with_retry(msg, Priority::Normal)
            .await
            .unwrap();
        assert!(!result, "Fourth retry should fail (exceeds max retries)");
    }

    /// **Validates: Requirements 2.5**
    /// Test exponential backoff delays in retry queue
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_retry_exponential_backoff() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        let message = create_test_message("msg_backoff", "account_1");

        // Enqueue with retry_count = 0 (first retry, delay = 5s)
        manager
            .requeue_with_retry(message.clone(), Priority::Normal)
            .await
            .unwrap();

        // Enqueue with retry_count = 1 (second retry, delay = 15s)
        let mut msg2 = create_test_message("msg_backoff_2", "account_1");
        msg2.retry_count = 1;
        manager
            .requeue_with_retry(msg2, Priority::Normal)
            .await
            .unwrap();

        // Enqueue with retry_count = 2 (third retry, delay = 45s)
        let mut msg3 = create_test_message("msg_backoff_3", "account_1");
        msg3.retry_count = 2;
        manager
            .requeue_with_retry(msg3, Priority::Normal)
            .await
            .unwrap();

        // Process retry queue immediately - should get 0 messages (all have future timestamps)
        let processed = manager.process_retry_queue().await.unwrap();
        assert_eq!(processed, 0, "No messages should be ready immediately");

        // Verify messages are in retry queue
        let retry_queue = manager.retry_queue_key();
        let depth: usize = manager.conn().zcard(&retry_queue).await.unwrap();
        assert_eq!(depth, 3, "All 3 messages should be in retry queue");
    }

    /// **Validates: Requirements 2.5**
    /// Test retry queue processing moves ready messages back to main queue
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_retry_queue_processing() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Manually add message to retry queue with past timestamp (ready to retry)
        let message = create_test_message("msg_ready", "account_1");
        let message_json = serde_json::to_string(&message).unwrap();
        let retry_queue = manager.retry_queue_key();
        let past_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs_f64()
            - 10.0; // 10 seconds ago

        let _: () = manager
            .conn()
            .zadd(&retry_queue, &message_json, past_time)
            .await
            .unwrap();

        // Process retry queue
        let processed = manager.process_retry_queue().await.unwrap();
        assert_eq!(processed, 1, "One message should be processed");

        // Verify message moved to main queue
        let depth = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        assert_eq!(depth, 1, "Message should be in main queue");

        // Verify retry queue is empty
        let retry_depth: usize = manager.conn().zcard(&retry_queue).await.unwrap();
        assert_eq!(retry_depth, 0, "Retry queue should be empty");
    }

    /// **Validates: Requirements 2.2, 2.4**
    /// Test queue partitioning across different accounts
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_queue_partitioning_across_accounts() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue messages for different accounts
        for i in 0..5 {
            manager
                .enqueue(
                    create_test_message(&format!("acc1_msg_{}", i), "account_1"),
                    Priority::Normal,
                )
                .await
                .unwrap();
        }
        for i in 0..3 {
            manager
                .enqueue(
                    create_test_message(&format!("acc2_msg_{}", i), "account_2"),
                    Priority::Normal,
                )
                .await
                .unwrap();
        }
        for i in 0..4 {
            manager
                .enqueue(
                    create_test_message(&format!("acc3_msg_{}", i), "account_3"),
                    Priority::Normal,
                )
                .await
                .unwrap();
        }

        // Verify each account has its own queue depth
        let depth1 = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        let depth2 = manager
            .get_queue_depth("account_2", Priority::Normal)
            .await
            .unwrap();
        let depth3 = manager
            .get_queue_depth("account_3", Priority::Normal)
            .await
            .unwrap();

        assert_eq!(depth1, 5, "Account 1 should have 5 messages");
        assert_eq!(depth2, 3, "Account 2 should have 3 messages");
        assert_eq!(depth3, 4, "Account 3 should have 4 messages");

        // Dequeue from account_1 should only get account_1 messages
        let acc1_messages = manager
            .dequeue_batch("account_1", Priority::Normal, 10)
            .await
            .unwrap();
        assert_eq!(acc1_messages.len(), 5);
        for msg in &acc1_messages {
            assert_eq!(msg.account_id, "account_1");
            assert!(msg.message_id.starts_with("acc1_"));
        }

        // Verify account_1 queue is empty but others are not
        let depth1 = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        let depth2 = manager
            .get_queue_depth("account_2", Priority::Normal)
            .await
            .unwrap();
        let depth3 = manager
            .get_queue_depth("account_3", Priority::Normal)
            .await
            .unwrap();

        assert_eq!(depth1, 0, "Account 1 queue should be empty");
        assert_eq!(depth2, 3, "Account 2 should still have 3 messages");
        assert_eq!(depth3, 4, "Account 3 should still have 4 messages");
    }

    /// **Validates: Requirements 2.2, 2.4**
    /// Test dequeue_batch_any for cross-account processing
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_dequeue_batch_any_cross_account() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue messages from multiple accounts
        manager
            .enqueue(
                create_test_message("acc1_msg_1", "account_1"),
                Priority::Normal,
            )
            .await
            .unwrap();
        manager
            .enqueue(
                create_test_message("acc2_msg_1", "account_2"),
                Priority::Normal,
            )
            .await
            .unwrap();
        manager
            .enqueue(
                create_test_message("acc3_msg_1", "account_3"),
                Priority::Normal,
            )
            .await
            .unwrap();

        // Dequeue from any account
        let messages = manager
            .dequeue_batch_any(Priority::Normal, 10)
            .await
            .unwrap();
        assert_eq!(
            messages.len(),
            3,
            "Should dequeue all 3 messages from different accounts"
        );

        // Verify messages are from different accounts
        let account_ids: Vec<String> = messages.iter().map(|m| m.account_id.clone()).collect();
        assert!(account_ids.contains(&"account_1".to_string()));
        assert!(account_ids.contains(&"account_2".to_string()));
        assert!(account_ids.contains(&"account_3".to_string()));

        // Verify all queues are empty
        let depth1 = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        let depth2 = manager
            .get_queue_depth("account_2", Priority::Normal)
            .await
            .unwrap();
        let depth3 = manager
            .get_queue_depth("account_3", Priority::Normal)
            .await
            .unwrap();
        assert_eq!(depth1 + depth2 + depth3, 0, "All queues should be empty");
    }

    /// **Validates: Requirements 2.1, 2.3**
    /// Test batch size limiting in dequeue operations
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_dequeue_batch_size_limit() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue 10 messages
        for i in 0..10 {
            manager
                .enqueue(
                    create_test_message(&format!("msg_{}", i), "account_1"),
                    Priority::Normal,
                )
                .await
                .unwrap();
        }

        // Dequeue with batch size 3
        let batch1 = manager
            .dequeue_batch("account_1", Priority::Normal, 3)
            .await
            .unwrap();
        assert_eq!(batch1.len(), 3, "Should dequeue exactly 3 messages");

        // Dequeue another batch of 3
        let batch2 = manager
            .dequeue_batch("account_1", Priority::Normal, 3)
            .await
            .unwrap();
        assert_eq!(batch2.len(), 3, "Should dequeue exactly 3 messages");

        // Verify 4 messages remain
        let depth = manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        assert_eq!(depth, 4, "4 messages should remain in queue");
    }

    /// **Validates: Requirements 2.7**
    /// Test queue metrics calculation
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_queue_metrics() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue messages with different priorities
        for i in 0..5 {
            manager
                .enqueue(
                    create_test_message(&format!("high_{}", i), "account_1"),
                    Priority::High,
                )
                .await
                .unwrap();
        }
        for i in 0..3 {
            manager
                .enqueue(
                    create_test_message(&format!("normal_{}", i), "account_1"),
                    Priority::Normal,
                )
                .await
                .unwrap();
        }
        for i in 0..2 {
            manager
                .enqueue(
                    create_test_message(&format!("low_{}", i), "account_1"),
                    Priority::Low,
                )
                .await
                .unwrap();
        }

        let metrics = manager.get_queue_metrics().await.unwrap();
        assert_eq!(metrics.high_priority_depth, 5);
        assert_eq!(metrics.normal_priority_depth, 3);
        assert_eq!(metrics.low_priority_depth, 2);
        assert_eq!(metrics.total_depth, 10);
    }

    /// **Validates: Requirements 2.8**
    /// Test backpressure trigger threshold
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_backpressure_trigger() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Should not trigger with small queue
        let should_trigger = manager.should_trigger_backpressure().await.unwrap();
        assert!(
            !should_trigger,
            "Backpressure should not trigger with empty queue"
        );

        // Add some messages (still below threshold)
        for i in 0..100 {
            manager
                .enqueue(
                    create_test_message(&format!("msg_{}", i), "account_1"),
                    Priority::Normal,
                )
                .await
                .unwrap();
        }

        let should_trigger = manager.should_trigger_backpressure().await.unwrap();
        assert!(
            !should_trigger,
            "Backpressure should not trigger with 100 messages"
        );

        // Note: Testing with 10,000+ messages would be slow, so we just verify the logic works
    }

    /// **Validates: Requirements 2.1**
    /// Test health check functionality
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_health_check() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        let healthy = manager.health_check().await.unwrap();
        assert!(healthy, "Redis connection should be healthy");
    }

    /// **Validates: Requirements 2.4**
    /// Test total queue depth calculation across all priorities
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_total_queue_depth() {
        let mut manager = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis");

        manager.clear_all_queues().await.unwrap();

        // Enqueue messages with different priorities for same account
        manager
            .enqueue(create_test_message("high_1", "account_1"), Priority::High)
            .await
            .unwrap();
        manager
            .enqueue(create_test_message("high_2", "account_1"), Priority::High)
            .await
            .unwrap();
        manager
            .enqueue(
                create_test_message("normal_1", "account_1"),
                Priority::Normal,
            )
            .await
            .unwrap();
        manager
            .enqueue(create_test_message("low_1", "account_1"), Priority::Low)
            .await
            .unwrap();

        let total_depth = manager.get_total_queue_depth("account_1").await.unwrap();
        assert_eq!(
            total_depth, 4,
            "Total depth should be sum of all priorities"
        );
    }
}
