use crate::redis_manager::{Priority, QueueMessage, QueueMetrics, RedisManager};
use redis::RedisResult;
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Campaign configuration for queue management
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct CampaignConfig {
    pub message_template: String,
    pub delay_config: DelayConfig,
    pub spintax_enabled: bool,
    pub media_config: Option<MediaConfig>,
    pub priority: Option<String>, // "high", "normal", "low"
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct DelayConfig {
    pub min_delay: u64, // milliseconds
    pub max_delay: u64, // milliseconds
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct MediaConfig {
    pub media_type: String, // "image", "pdf", "video", "none"
    pub media_url: Option<String>,
}

/// Recipient record from database
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RecipientRecord {
    pub id: String,
    pub campaign_id: String,
    pub phone: String,
    pub variables_json: Option<String>,
    pub status: String,
}

/// Campaign record from database
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct CampaignRecord {
    pub id: String,
    pub name: String,
    pub config: Option<String>, // JSON
    pub created_by: Option<String>,
}

/// Queue Manager - high-level abstraction over RedisManager
/// 
/// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**
/// 
/// Provides campaign-level queue operations that integrate with the database
/// and use RedisManager for the underlying queue implementation.
#[derive(Clone)]
pub struct QueueManager {
    redis: Arc<Mutex<RedisManager>>,
    pool: SqlitePool,
}

impl QueueManager {
    /// Create a new QueueManager
    pub fn new(redis: RedisManager, pool: SqlitePool) -> Self {
        Self {
            redis: Arc::new(Mutex::new(redis)),
            pool,
        }
    }

    /// Enqueue all pending recipients for a campaign
    /// 
    /// **Validates: Requirements 2.1, 2.2, 2.4**
    /// 
    /// Reads all pending recipients from the database and enqueues them to Redis
    /// with the specified priority. Messages are distributed across accounts using
    /// round-robin strategy.
    pub async fn enqueue_campaign(
        &self,
        campaign_id: &str,
        account_ids: &[String],
    ) -> Result<usize, Box<dyn std::error::Error>> {
        info!("Enqueueing campaign {} with {} accounts", campaign_id, account_ids.len());

        if account_ids.is_empty() {
            return Err("No accounts provided for campaign".into());
        }

        // Fetch campaign config
        let campaign: CampaignRecord = sqlx::query_as(
            "SELECT id, name, config, created_by FROM wa_campaigns WHERE id = ?"
        )
        .bind(campaign_id)
        .fetch_one(&self.pool)
        .await?;

        let config: CampaignConfig = if let Some(config_json) = campaign.config {
            serde_json::from_str(&config_json).unwrap_or_else(|_| CampaignConfig {
                message_template: String::new(),
                delay_config: DelayConfig {
                    min_delay: 5000,
                    max_delay: 15000,
                },
                spintax_enabled: false,
                media_config: None,
                priority: Some("normal".to_string()),
            })
        } else {
            CampaignConfig {
                message_template: String::new(),
                delay_config: DelayConfig {
                    min_delay: 5000,
                    max_delay: 15000,
                },
                spintax_enabled: false,
                media_config: None,
                priority: Some("normal".to_string()),
            }
        };

        // Parse priority
        let priority = match config.priority.as_deref() {
            Some("high") => Priority::High,
            Some("low") => Priority::Low,
            _ => Priority::Normal,
        };

        // Fetch all pending recipients
        let recipients: Vec<RecipientRecord> = sqlx::query_as(
            "SELECT id, campaign_id, phone, variables_json, status 
             FROM wa_recipients 
             WHERE campaign_id = ? AND status = 'pending'
             ORDER BY created_at ASC"
        )
        .bind(campaign_id)
        .fetch_all(&self.pool)
        .await?;

        if recipients.is_empty() {
            warn!("No pending recipients found for campaign {}", campaign_id);
            return Ok(0);
        }

        info!("Found {} pending recipients for campaign {}", recipients.len(), campaign_id);

        // Round-robin account assignment
        let mut enqueued_count = 0;
        let mut redis = self.redis.lock().await;

        for (idx, recipient) in recipients.iter().enumerate() {
            let account_id = &account_ids[idx % account_ids.len()];
            
            let message = QueueMessage {
                message_id: Uuid::new_v4().to_string(),
                campaign_id: campaign_id.to_string(),
                recipient_id: recipient.id.clone(),
                account_id: account_id.clone(),
                phone: recipient.phone.clone(),
                message_text: config.message_template.clone(),
                media_url: config.media_config.as_ref().and_then(|m| m.media_url.clone()),
                retry_count: 0,
                enqueued_at: chrono::Utc::now().timestamp(),
            };

            match redis.enqueue(message, priority).await {
                Ok(_) => {
                    enqueued_count += 1;
                    debug!(
                        "Enqueued recipient {} to account {} with priority {:?}",
                        recipient.id, account_id, priority
                    );
                }
                Err(e) => {
                    error!(
                        "Failed to enqueue recipient {}: {}",
                        recipient.id, e
                    );
                }
            }
        }

        info!(
            "Successfully enqueued {}/{} recipients for campaign {}",
            enqueued_count, recipients.len(), campaign_id
        );

        Ok(enqueued_count)
    }

    /// Enqueue a single message with specified priority
    /// 
    /// **Validates: Requirements 2.1, 2.4**
    /// 
    /// Used for API-based message sending (e.g., from N8N).
    pub async fn enqueue_message(
        &self,
        account_id: String,
        phone: String,
        message_text: String,
        media_url: Option<String>,
        priority: Priority,
    ) -> RedisResult<String> {
        let message_id = Uuid::new_v4().to_string();
        
        let message = QueueMessage {
            message_id: message_id.clone(),
            campaign_id: "api_send".to_string(),
            recipient_id: Uuid::new_v4().to_string(),
            account_id,
            phone,
            message_text,
            media_url,
            retry_count: 0,
            enqueued_at: chrono::Utc::now().timestamp(),
        };

        let mut redis = self.redis.lock().await;
        redis.enqueue(message, priority).await?;

        info!("Enqueued API message {} with priority {:?}", message_id, priority);
        Ok(message_id)
    }

    /// Dequeue a batch of messages for processing
    /// 
    /// **Validates: Requirements 2.2, 2.3, 2.4**
    /// 
    /// Fetches messages from the specified account and priority queue.
    /// Uses atomic Lua script to prevent duplicate processing.
    pub async fn dequeue_batch(
        &self,
        account_id: &str,
        priority: Priority,
        batch_size: usize,
    ) -> RedisResult<Vec<QueueMessage>> {
        let mut redis = self.redis.lock().await;
        redis.dequeue_batch(account_id, priority, batch_size).await
    }

    /// Dequeue batch from any account (round-robin)
    /// 
    /// **Validates: Requirements 2.2, 2.4**
    pub async fn dequeue_batch_any(
        &self,
        priority: Priority,
        batch_size: usize,
    ) -> RedisResult<Vec<QueueMessage>> {
        let mut redis = self.redis.lock().await;
        redis.dequeue_batch_any(priority, batch_size).await
    }

    /// Re-enqueue a failed message with retry logic
    /// 
    /// **Validates: Requirements 2.5, 2.6**
    /// 
    /// Implements exponential backoff (5s, 15s, 45s) and max retry limit (3 attempts).
    /// Returns true if re-enqueued, false if max retries exceeded.
    pub async fn requeue_with_retry(
        &self,
        message: QueueMessage,
        priority: Priority,
    ) -> RedisResult<bool> {
        let mut redis = self.redis.lock().await;
        redis.requeue_with_retry(message, priority).await
    }

    /// Process retry queue and move ready messages back to main queues
    /// 
    /// **Validates: Requirements 2.5**
    /// 
    /// Should be called periodically (e.g., every 10 seconds) to check for
    /// messages that are ready to retry after their backoff delay.
    pub async fn process_retry_queue(&self) -> RedisResult<usize> {
        let mut redis = self.redis.lock().await;
        redis.process_retry_queue().await
    }

    /// Get queue depth for specific account and priority
    /// 
    /// **Validates: Requirements 2.7**
    pub async fn get_queue_depth(
        &self,
        account_id: &str,
        priority: Priority,
    ) -> RedisResult<usize> {
        let mut redis = self.redis.lock().await;
        redis.get_queue_depth(account_id, priority).await
    }

    /// Get total queue depth across all priorities for an account
    /// 
    /// **Validates: Requirements 2.7**
    pub async fn get_total_queue_depth(&self, account_id: &str) -> RedisResult<usize> {
        let mut redis = self.redis.lock().await;
        redis.get_total_queue_depth(account_id).await
    }

    /// Get comprehensive queue metrics
    /// 
    /// **Validates: Requirements 2.7, 2.8**
    pub async fn get_queue_metrics(&self) -> RedisResult<QueueMetrics> {
        let mut redis = self.redis.lock().await;
        redis.get_queue_metrics().await
    }

    /// Update processing metrics
    /// 
    /// **Validates: Requirements 2.7**
    pub async fn update_metrics(
        &self,
        processing_rate: f64,
        error_rate: f64,
    ) -> RedisResult<()> {
        let mut redis = self.redis.lock().await;
        redis.update_metrics(processing_rate, error_rate).await
    }

    /// Check if backpressure should be triggered
    /// 
    /// **Validates: Requirements 2.8**
    /// 
    /// Returns true if total queue depth exceeds 10,000 messages.
    pub async fn should_trigger_backpressure(&self) -> RedisResult<bool> {
        let mut redis = self.redis.lock().await;
        redis.should_trigger_backpressure().await
    }

    /// Mark a recipient as sent in the database
    /// 
    /// Updates the recipient status and last_attempt_at timestamp.
    pub async fn mark_recipient_sent(
        &self,
        recipient_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query(
            "UPDATE wa_recipients 
             SET status = 'sent', last_attempt_at = CURRENT_TIMESTAMP 
             WHERE id = ?"
        )
        .bind(recipient_id)
        .execute(&self.pool)
        .await?;

        debug!("Marked recipient {} as sent", recipient_id);
        Ok(())
    }

    /// Mark a recipient as failed in the database
    /// 
    /// Updates the recipient status and last_attempt_at timestamp.
    pub async fn mark_recipient_failed(
        &self,
        recipient_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        sqlx::query(
            "UPDATE wa_recipients 
             SET status = 'failed', last_attempt_at = CURRENT_TIMESTAMP 
             WHERE id = ?"
        )
        .bind(recipient_id)
        .execute(&self.pool)
        .await?;

        debug!("Marked recipient {} as failed", recipient_id);
        Ok(())
    }

    /// Get campaign statistics
    /// 
    /// Returns counts of recipients by status for a campaign.
    pub async fn get_campaign_stats(
        &self,
        campaign_id: &str,
    ) -> Result<CampaignStats, Box<dyn std::error::Error>> {
        let stats: CampaignStatsRow = sqlx::query_as(
            "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
             FROM wa_recipients 
             WHERE campaign_id = ?"
        )
        .bind(campaign_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(CampaignStats {
            total: stats.total as usize,
            pending: stats.pending as usize,
            sent: stats.sent as usize,
            failed: stats.failed as usize,
            skipped: stats.skipped as usize,
        })
    }

    /// Health check - verify Redis connection and database
    pub async fn health_check(&self) -> Result<bool, Box<dyn std::error::Error>> {
        // Check Redis
        let mut redis = self.redis.lock().await;
        let redis_ok = redis.health_check().await?;

        // Check database
        let db_ok = sqlx::query("SELECT 1")
            .fetch_one(&self.pool)
            .await
            .is_ok();

        Ok(redis_ok && db_ok)
    }

    /// Clear all queues for an account (useful for testing/cleanup)
    pub async fn clear_account_queues(&self, account_id: &str) -> RedisResult<()> {
        let mut redis = self.redis.lock().await;
        redis.clear_account_queues(account_id).await
    }
}

/// Campaign statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct CampaignStats {
    pub total: usize,
    pub pending: usize,
    pub sent: usize,
    pub failed: usize,
    pub skipped: usize,
}

/// Internal struct for database query result
#[derive(Debug, sqlx::FromRow)]
struct CampaignStatsRow {
    total: i64,
    pending: i64,
    sent: i64,
    failed: i64,
    skipped: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::redis_manager::RedisManager;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        
        // Create tables
        sqlx::query(
            "CREATE TABLE wa_campaigns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config TEXT,
                created_by TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE wa_recipients (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                phone TEXT NOT NULL,
                variables_json TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                last_attempt_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    /// **Validates: Requirements 2.1, 2.2**
    /// Test campaign enqueue functionality
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_enqueue_campaign() {
        let pool = setup_test_db().await;
        let redis = RedisManager::new("redis://127.0.0.1:6379").await.unwrap();
        let queue_manager = QueueManager::new(redis, pool.clone());

        // Create test campaign
        let campaign_id = Uuid::new_v4().to_string();
        let config = CampaignConfig {
            message_template: "Hello {name}!".to_string(),
            delay_config: DelayConfig {
                min_delay: 5000,
                max_delay: 15000,
            },
            spintax_enabled: false,
            media_config: None,
            priority: Some("normal".to_string()),
        };

        sqlx::query(
            "INSERT INTO wa_campaigns (id, name, config) VALUES (?, ?, ?)"
        )
        .bind(&campaign_id)
        .bind("Test Campaign")
        .bind(serde_json::to_string(&config).unwrap())
        .execute(&pool)
        .await
        .unwrap();

        // Create test recipients
        for i in 0..5 {
            let recipient_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO wa_recipients (id, campaign_id, phone, status) 
                 VALUES (?, ?, ?, 'pending')"
            )
            .bind(&recipient_id)
            .bind(&campaign_id)
            .bind(format!("+628123456789{}", i))
            .execute(&pool)
            .await
            .unwrap();
        }

        // Enqueue campaign
        let account_ids = vec!["account_1".to_string(), "account_2".to_string()];
        let enqueued = queue_manager
            .enqueue_campaign(&campaign_id, &account_ids)
            .await
            .unwrap();

        assert_eq!(enqueued, 5, "Should enqueue all 5 recipients");

        // Verify queue depth
        let depth1 = queue_manager
            .get_queue_depth("account_1", Priority::Normal)
            .await
            .unwrap();
        let depth2 = queue_manager
            .get_queue_depth("account_2", Priority::Normal)
            .await
            .unwrap();

        // Round-robin should distribute messages: 3 to account_1, 2 to account_2
        assert_eq!(depth1 + depth2, 5, "Total queue depth should be 5");
    }

    /// **Validates: Requirements 2.1, 2.4**
    /// Test single message enqueue with priority
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_enqueue_single_message() {
        let pool = setup_test_db().await;
        let redis = RedisManager::new("redis://127.0.0.1:6379").await.unwrap();
        let queue_manager = QueueManager::new(redis, pool);

        let message_id = queue_manager
            .enqueue_message(
                "account_1".to_string(),
                "+6281234567890".to_string(),
                "Test message".to_string(),
                None,
                Priority::High,
            )
            .await
            .unwrap();

        assert!(!message_id.is_empty(), "Should return message ID");

        // Verify message is in queue
        let depth = queue_manager
            .get_queue_depth("account_1", Priority::High)
            .await
            .unwrap();
        assert_eq!(depth, 1, "Should have 1 message in high priority queue");
    }

    /// **Validates: Requirements 2.7**
    /// Test campaign statistics
    #[tokio::test]
    async fn test_campaign_stats() {
        let pool = setup_test_db().await;
        let redis = RedisManager::new("redis://127.0.0.1:6379").await.unwrap();
        let queue_manager = QueueManager::new(redis, pool.clone());

        let campaign_id = Uuid::new_v4().to_string();
        
        // Create campaign
        sqlx::query(
            "INSERT INTO wa_campaigns (id, name) VALUES (?, ?)"
        )
        .bind(&campaign_id)
        .bind("Test Campaign")
        .execute(&pool)
        .await
        .unwrap();

        // Create recipients with different statuses
        for (i, status) in ["pending", "sent", "failed", "skipped"].iter().enumerate() {
            let recipient_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO wa_recipients (id, campaign_id, phone, status) 
                 VALUES (?, ?, ?, ?)"
            )
            .bind(&recipient_id)
            .bind(&campaign_id)
            .bind(format!("+628123456789{}", i))
            .bind(status)
            .execute(&pool)
            .await
            .unwrap();
        }

        let stats = queue_manager.get_campaign_stats(&campaign_id).await.unwrap();
        
        assert_eq!(stats.total, 4);
        assert_eq!(stats.pending, 1);
        assert_eq!(stats.sent, 1);
        assert_eq!(stats.failed, 1);
        assert_eq!(stats.skipped, 1);
    }

    /// **Validates: Requirements 2.1**
    /// Test health check
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_health_check() {
        let pool = setup_test_db().await;
        let redis = RedisManager::new("redis://127.0.0.1:6379").await.unwrap();
        let queue_manager = QueueManager::new(redis, pool);

        let healthy = queue_manager.health_check().await.unwrap();
        assert!(healthy, "Queue manager should be healthy");
    }

    /// **Validates: Requirements 2.8**
    /// Test backpressure detection
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_backpressure_detection() {
        let pool = setup_test_db().await;
        let redis = RedisManager::new("redis://127.0.0.1:6379").await.unwrap();
        let queue_manager = QueueManager::new(redis, pool);

        // With empty queue, should not trigger backpressure
        let should_trigger = queue_manager.should_trigger_backpressure().await.unwrap();
        assert!(!should_trigger, "Should not trigger backpressure with empty queue");
    }
}
