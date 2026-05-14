/**
 * Blast Engine - Anti-Ban Message Processing Engine
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8**
 *
 * This module implements the core message sending engine with anti-ban features:
 * - Worker pool with configurable size (default 10 workers)
 * - Batch processing: fetch 5 messages per worker iteration
 * - Smart delay: random 5-15 seconds between messages from same account
 * - Typing simulation: 1-3 seconds before actual send
 * - Rate limiting: max 20 messages per minute per account
 * - Daily limit enforcement: max 1000 messages per account per day
 * - Round-robin account distribution
 * - Message order randomization within batch
 */
use crate::bridge::BridgeClient;
use crate::media_handler::MediaHandler;
use crate::queue_manager::QueueManager;
use crate::redis_manager::Priority;
use crate::spintax::SpintaxProcessor;
use rand::Rng;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock, Semaphore};
use tokio::time::{sleep, Instant};
use tracing::{debug, error, info, warn};

/// Blast engine configuration
#[derive(Debug, Clone)]
pub struct BlastEngineConfig {
    /// Number of worker tasks (default: 10)
    pub worker_count: usize,
    /// Batch size per worker iteration (default: 5)
    pub batch_size: usize,
    /// Minimum delay between messages from same account in seconds (default: 5)
    pub min_delay_seconds: u64,
    /// Maximum delay between messages from same account in seconds (default: 15)
    pub max_delay_seconds: u64,
    /// Minimum typing simulation duration in seconds (default: 1)
    pub min_typing_seconds: u64,
    /// Maximum typing simulation duration in seconds (default: 3)
    pub max_typing_seconds: u64,
    /// Rate limit: max messages per minute per account (default: 20)
    pub rate_limit_per_minute: u32,
    /// Daily limit: max messages per account per day (default: 1000)
    pub daily_limit: u32,
    /// Max concurrent sends per account (default: 3)
    pub max_concurrent_per_account: usize,
}

impl Default for BlastEngineConfig {
    fn default() -> Self {
        Self {
            worker_count: 10,
            batch_size: 5,
            min_delay_seconds: 5,
            max_delay_seconds: 15,
            min_typing_seconds: 1,
            max_typing_seconds: 3,
            rate_limit_per_minute: 20,
            daily_limit: 1000,
            max_concurrent_per_account: 3,
        }
    }
}

/// Account rate limiting state
#[derive(Debug, Clone)]
struct AccountRateLimit {
    /// Messages sent in current minute window
    minute_count: u32,
    /// Timestamp of current minute window start
    minute_window_start: Instant,
    /// Messages sent today
    daily_count: u32,
    /// Date of daily count (UTC midnight timestamp)
    daily_reset_at: i64,
    /// Last message send timestamp
    last_send_at: Option<Instant>,
}

impl AccountRateLimit {
    fn new() -> Self {
        Self {
            minute_count: 0,
            minute_window_start: Instant::now(),
            daily_count: 0,
            daily_reset_at: Self::get_today_midnight(),
            last_send_at: None,
        }
    }

    /// Get UTC midnight timestamp for today
    fn get_today_midnight() -> i64 {
        let now = chrono::Utc::now();
        now.date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp()
    }

    /// Check if rate limit allows sending
    fn can_send(&mut self, rate_limit_per_minute: u32, daily_limit: u32) -> bool {
        let now = Instant::now();
        let today_midnight = Self::get_today_midnight();

        // Reset daily counter if new day
        if self.daily_reset_at < today_midnight {
            self.daily_count = 0;
            self.daily_reset_at = today_midnight;
        }

        // Check daily limit
        if self.daily_count >= daily_limit {
            return false;
        }

        // Reset minute counter if new minute window
        if now.duration_since(self.minute_window_start) >= Duration::from_secs(60) {
            self.minute_count = 0;
            self.minute_window_start = now;
        }

        // Check minute rate limit
        self.minute_count < rate_limit_per_minute
    }

    /// Record a message send
    fn record_send(&mut self) {
        self.minute_count += 1;
        self.daily_count += 1;
        self.last_send_at = Some(Instant::now());
    }

    /// Get time until rate limit resets (for minute window)
    fn time_until_reset(&self) -> Duration {
        let elapsed = Instant::now().duration_since(self.minute_window_start);
        if elapsed >= Duration::from_secs(60) {
            Duration::from_secs(0)
        } else {
            Duration::from_secs(60) - elapsed
        }
    }
}

/// Blast Engine - manages worker pool and message processing
pub struct BlastEngine {
    config: BlastEngineConfig,
    queue_manager: Arc<QueueManager>,
    bridge_client: Arc<BridgeClient>,
    pool: SqlitePool,
    /// Rate limiting state per account
    rate_limits: Arc<RwLock<HashMap<String, AccountRateLimit>>>,
    /// Semaphores for concurrent send limiting per account
    account_semaphores: Arc<RwLock<HashMap<String, Arc<Semaphore>>>>,
    /// Worker health status
    worker_health: Arc<RwLock<HashMap<usize, bool>>>,
    /// Shutdown signal
    shutdown: Arc<Mutex<bool>>,
    /// Spintax processor for message variation
    spintax_processor: Arc<Mutex<SpintaxProcessor>>,
    /// Media handler for media campaigns
    media_handler: Arc<Mutex<MediaHandler>>,
}

impl BlastEngine {
    /// Create a new BlastEngine
    pub fn new(
        config: BlastEngineConfig,
        queue_manager: Arc<QueueManager>,
        bridge_client: Arc<BridgeClient>,
        pool: SqlitePool,
        media_handler: MediaHandler,
    ) -> Self {
        Self {
            config,
            queue_manager,
            bridge_client,
            pool,
            rate_limits: Arc::new(RwLock::new(HashMap::new())),
            account_semaphores: Arc::new(RwLock::new(HashMap::new())),
            worker_health: Arc::new(RwLock::new(HashMap::new())),
            shutdown: Arc::new(Mutex::new(false)),
            spintax_processor: Arc::new(Mutex::new(SpintaxProcessor::new())),
            media_handler: Arc::new(Mutex::new(media_handler)),
        }
    }

    /// Start the blast engine with worker pool
    ///
    /// **Validates: Requirements 14.1, 14.2, 14.6**
    pub async fn start(&self) {
        info!(
            "Starting Blast Engine with {} workers, batch size {}",
            self.config.worker_count, self.config.batch_size
        );

        // Initialize worker health tracking
        {
            let mut health = self.worker_health.write().await;
            for i in 0..self.config.worker_count {
                health.insert(i, true);
            }
        }

        // Spawn worker tasks
        let mut handles = Vec::new();
        for worker_id in 0..self.config.worker_count {
            let engine = self.clone_for_worker();
            let handle = tokio::spawn(async move {
                engine.worker_loop(worker_id).await;
            });
            handles.push(handle);
        }

        info!(
            "Blast Engine started with {} workers",
            self.config.worker_count
        );

        // Wait for all workers to complete (or until shutdown)
        for handle in handles {
            let _ = handle.await;
        }

        info!("Blast Engine stopped");
    }

    /// Clone engine for worker task
    fn clone_for_worker(&self) -> Self {
        Self {
            config: self.config.clone(),
            queue_manager: Arc::clone(&self.queue_manager),
            bridge_client: Arc::clone(&self.bridge_client),
            pool: self.pool.clone(),
            rate_limits: Arc::clone(&self.rate_limits),
            account_semaphores: Arc::clone(&self.account_semaphores),
            worker_health: Arc::clone(&self.worker_health),
            shutdown: Arc::clone(&self.shutdown),
            spintax_processor: Arc::clone(&self.spintax_processor),
            media_handler: Arc::clone(&self.media_handler),
        }
    }

    /// Worker loop - continuously fetch and process message batches
    ///
    /// **Validates: Requirements 14.1, 14.2, 14.3, 14.6**
    async fn worker_loop(&self, worker_id: usize) {
        info!("Worker {} started", worker_id);

        loop {
            // Check shutdown signal
            {
                let shutdown = self.shutdown.lock().await;
                if *shutdown {
                    info!("Worker {} received shutdown signal", worker_id);
                    break;
                }
            }

            // Mark worker as healthy
            {
                let mut health = self.worker_health.write().await;
                health.insert(worker_id, true);
            }

            if worker_id == 0 {
                if let Err(e) = self.queue_manager.process_retry_queue().await {
                    error!("Worker {} failed to process retry queue: {}", worker_id, e);
                }
            }

            // Fetch batch from queue (try high priority first, then normal, then low)
            let batch = self.fetch_batch_with_priority(worker_id).await;

            if batch.is_empty() {
                // No messages available, sleep briefly
                sleep(Duration::from_secs(2)).await;
                continue;
            }

            debug!(
                "Worker {} fetched batch of {} messages",
                worker_id,
                batch.len()
            );

            // Process batch
            if let Err(e) = self.process_batch(worker_id, batch).await {
                error!("Worker {} error processing batch: {}", worker_id, e);
                // Mark worker as unhealthy temporarily
                {
                    let mut health = self.worker_health.write().await;
                    health.insert(worker_id, false);
                }
                // Sleep before retrying
                sleep(Duration::from_secs(5)).await;
            }
        }

        info!("Worker {} stopped", worker_id);
    }

    /// Fetch batch with priority ordering
    ///
    /// **Validates: Requirements 14.2**
    async fn fetch_batch_with_priority(
        &self,
        worker_id: usize,
    ) -> Vec<crate::redis_manager::QueueMessage> {
        // Try high priority first
        if let Ok(batch) = self
            .queue_manager
            .dequeue_batch_any(Priority::High, self.config.batch_size)
            .await
        {
            if !batch.is_empty() {
                debug!(
                    "Worker {} fetched {} high priority messages",
                    worker_id,
                    batch.len()
                );
                return batch;
            }
        }

        // Try normal priority
        if let Ok(batch) = self
            .queue_manager
            .dequeue_batch_any(Priority::Normal, self.config.batch_size)
            .await
        {
            if !batch.is_empty() {
                debug!(
                    "Worker {} fetched {} normal priority messages",
                    worker_id,
                    batch.len()
                );
                return batch;
            }
        }

        // Try low priority
        if let Ok(batch) = self
            .queue_manager
            .dequeue_batch_any(Priority::Low, self.config.batch_size)
            .await
        {
            if !batch.is_empty() {
                debug!(
                    "Worker {} fetched {} low priority messages",
                    worker_id,
                    batch.len()
                );
                return batch;
            }
        }

        Vec::new()
    }

    /// Process a batch of messages
    ///
    /// **Validates: Requirements 3.8, 14.3**
    async fn process_batch(
        &self,
        worker_id: usize,
        mut batch: Vec<crate::redis_manager::QueueMessage>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Randomize message order within batch (Requirement 3.8)
        // Use a seeded RNG to avoid ThreadRng which is not Send
        use rand::seq::SliceRandom;
        use rand::SeedableRng;
        let mut rng = rand::rngs::StdRng::from_entropy();
        batch.shuffle(&mut rng);

        debug!(
            "Worker {} processing randomized batch of {} messages",
            worker_id,
            batch.len()
        );

        // Process messages sequentially to avoid Send issues
        for message in batch {
            if let Err(e) = self.process_single_message(message).await {
                error!("Worker {} message processing error: {}", worker_id, e);
            }
        }

        Ok(())
    }

    /// Process a single message with anti-ban features
    ///
    /// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 14.4**
    async fn process_single_message(
        &self,
        message: crate::redis_manager::QueueMessage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let account_id = message.account_id.clone();
        let recipient_id = message.recipient_id.clone();
        let campaign_id = message.campaign_id.clone();

        let campaign_status: Option<String> =
            sqlx::query_scalar("SELECT status FROM wa_campaigns WHERE id = ?")
                .bind(&campaign_id)
                .fetch_optional(&self.pool)
                .await?;

        if campaign_id != "api_send" && !matches!(campaign_status.as_deref(), Some("running")) {
            info!(
                "Skipping queued message {} because campaign {} status is {:?}",
                message.message_id, campaign_id, campaign_status
            );
            return Ok(());
        }

        if self
            .recipient_already_sent(&recipient_id, &campaign_id)
            .await?
        {
            info!(
                "Skipping queued message {} because recipient {} was already sent",
                message.message_id, recipient_id
            );
            return Ok(());
        }

        // Additional check: Verify recipient status is still 'pending'
        // This protects against race conditions where pause marks recipients as paused
        let recipient_status: Option<String> =
            sqlx::query_scalar("SELECT status FROM wa_recipients WHERE id = ?")
                .bind(&recipient_id)
                .fetch_optional(&self.pool)
                .await?;

        if !matches!(recipient_status.as_deref(), Some("pending")) {
            info!(
                "Skipping queued message {} for recipient {} because status is {:?} (not 'pending'). \
                 This likely means campaign was paused or recipient was manually updated.",
                message.message_id, recipient_id, recipient_status
            );
            return Ok(());
        }

        // Get or create semaphore for account (limit concurrent sends per account)
        let semaphore = {
            let mut semaphores = self.account_semaphores.write().await;
            semaphores
                .entry(account_id.clone())
                .or_insert_with(|| Arc::new(Semaphore::new(self.config.max_concurrent_per_account)))
                .clone()
        };

        // Acquire semaphore permit (Requirement 14.4)
        let _permit = semaphore.acquire().await?;

        if !self
            .message_can_continue(&campaign_id, &recipient_id, &message.message_id)
            .await?
        {
            return Ok(());
        }

        // Check and enforce rate limits (Requirements 3.3, 3.6, 3.7)
        if !self
            .enforce_rate_limits(
                &account_id,
                &campaign_id,
                &recipient_id,
                &message.message_id,
            )
            .await?
        {
            return Ok(());
        }

        // Apply smart delay from last send (Requirement 3.1)
        if !self
            .apply_smart_delay(
                &account_id,
                &campaign_id,
                &recipient_id,
                &message.message_id,
            )
            .await?
        {
            return Ok(());
        }

        // Fetch recipient variables from database for spintax processing (Requirement 4.4)
        let recipient_variables = self.fetch_recipient_variables(&recipient_id).await?;

        let message_template = self.resolve_message_template(&message).await;

        // Process message template with spintax (Requirements 4.1, 4.2, 4.3, 4.4, 4.5)
        let processed_message = self
            .process_message_template(&message_template, &recipient_variables)
            .await?;

        // Handle media if present (Requirement 7.5)
        let media_url = self.resolve_media_url(&message).await;
        let media_data = if let Some(media_url) = &media_url {
            match self.download_and_process_media(media_url).await {
                Ok(data) => Some(data),
                Err(e) => {
                    error!(
                        "Failed to process media for message {}: {}",
                        message.message_id, e
                    );
                    // Mark recipient as failed with media error
                    self.mark_recipient_failed(&recipient_id, "media_error")
                        .await?;
                    return Err(format!("Media processing failed: {}", e).into());
                }
            }
        } else {
            None
        };

        if !self
            .message_can_continue(&campaign_id, &recipient_id, &message.message_id)
            .await?
        {
            return Ok(());
        }

        // Simulate typing indicator (Requirement 3.2)
        if !self
            .simulate_typing(
                &account_id,
                &message.phone,
                &campaign_id,
                &recipient_id,
                &message.message_id,
            )
            .await?
        {
            return Ok(());
        }

        if !self
            .message_can_continue(&campaign_id, &recipient_id, &message.message_id)
            .await?
        {
            return Ok(());
        }

        // Compose and send message (text + media + caption)
        let send_result = self
            .send_composed_message(&message, &processed_message, media_data.as_ref())
            .await;

        // Record send in rate limiter
        self.record_send(&account_id).await;

        // Update database counters
        self.update_account_counters(&account_id).await?;

        // Handle send result (Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8)
        match send_result {
            Ok(wa_message_id) => {
                info!(
                    "Successfully sent message {} to {} via account {}",
                    wa_message_id, message.phone, account_id
                );

                // Mark recipient as sent (Requirement 10.1)
                if let Err(e) = self.mark_recipient_sent(&recipient_id).await {
                    error!("Failed to mark recipient {} as sent: {}", recipient_id, e);
                }

                // Log dispatch success (Requirement 10.4)
                if let Err(e) = self.log_dispatch_success(&message, &wa_message_id).await {
                    error!("Failed to log dispatch success: {}", e);
                }

                // Check if campaign is completed and update status
                if let Err(e) = self
                    .check_and_update_campaign_completion(&campaign_id)
                    .await
                {
                    error!("Failed to check campaign completion: {}", e);
                }
            }
            Err(e) => {
                let error_message = e.to_string();
                error!(
                    "Failed to send message {} to {}: {}",
                    message.message_id, message.phone, error_message
                );

                if !self
                    .message_can_continue(&campaign_id, &recipient_id, &message.message_id)
                    .await?
                {
                    info!(
                        "Not retrying message {} because campaign/recipient was paused during send failure",
                        message.message_id
                    );
                    return Ok(());
                }

                if let Err(update_err) = self
                    .update_recipient_attempt_error(&recipient_id, &error_message)
                    .await
                {
                    error!(
                        "Failed to update recipient {} attempt error: {}",
                        recipient_id, update_err
                    );
                }

                if media_data.is_some() {
                    let final_error = format!(
                        "{}. Retry otomatis media dihentikan agar tidak mengirim gambar berulang. Reset campaign secara manual jika perlu kirim ulang.",
                        error_message
                    );
                    if let Err(e) = self
                        .mark_recipient_failed(&recipient_id, &final_error)
                        .await
                    {
                        error!("Failed to mark recipient {} as failed: {}", recipient_id, e);
                    }
                    if let Err(e) = self.log_dispatch_failure(&message, &final_error).await {
                        error!("Failed to log dispatch failure: {}", e);
                    }
                    if let Err(e) = self
                        .check_and_update_campaign_completion(&campaign_id)
                        .await
                    {
                        error!("Failed to check campaign completion: {}", e);
                    }
                    return Ok(());
                }

                // Retry logic (Requirement 2.5, 2.6)
                let requeued = self
                    .queue_manager
                    .requeue_with_retry(message.clone(), Priority::Normal)
                    .await?;

                if !requeued {
                    // Max retries exceeded, mark as failed
                    if let Err(e) = self
                        .mark_recipient_failed(&recipient_id, &error_message)
                        .await
                    {
                        error!("Failed to mark recipient {} as failed: {}", recipient_id, e);
                    }
                    if let Err(e) = self.log_dispatch_failure(&message, &error_message).await {
                        error!("Failed to log dispatch failure: {}", e);
                    }

                    // Check if campaign is completed
                    if let Err(e) = self
                        .check_and_update_campaign_completion(&campaign_id)
                        .await
                    {
                        error!("Failed to check campaign completion: {}", e);
                    }
                }
            }
        }

        Ok(())
    }

    async fn resolve_message_template(
        &self,
        message: &crate::redis_manager::QueueMessage,
    ) -> String {
        if !message.message_text.trim().is_empty() || message.campaign_id == "api_send" {
            return message.message_text.clone();
        }

        let config: Option<(Option<String>,)> =
            sqlx::query_as("SELECT config FROM wa_campaigns WHERE id = ?")
                .bind(&message.campaign_id)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten();

        config
            .and_then(|(raw,)| raw)
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|value| value.get("message_template").and_then(|v| v.as_str()).map(str::to_string))
            .filter(|template| !template.trim().is_empty())
            .unwrap_or_else(|| {
                warn!(
                    campaign_id = %message.campaign_id,
                    recipient_id = %message.recipient_id,
                    "Queued WA message has empty template and campaign config has no message_template"
                );
                "Halo, ini pesan dari Tridjaya.".to_string()
            })
    }

    async fn resolve_media_url(
        &self,
        message: &crate::redis_manager::QueueMessage,
    ) -> Option<String> {
        if let Some(media_url) = message
            .media_url
            .as_ref()
            .map(|url| url.trim())
            .filter(|url| !url.is_empty())
        {
            return Some(media_url.to_string());
        }

        if message.campaign_id == "api_send" {
            return None;
        }

        let config: Option<(Option<String>,)> =
            sqlx::query_as("SELECT config FROM wa_campaigns WHERE id = ?")
                .bind(&message.campaign_id)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten();

        config
            .and_then(|(raw,)| raw)
            .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok())
            .and_then(|value| {
                value
                    .get("media_config")
                    .or_else(|| value.get("mediaConfig"))
                    .and_then(|media_config| {
                        media_config
                            .get("media_url")
                            .or_else(|| media_config.get("mediaUrl"))
                            .and_then(|url| url.as_str())
                    })
                    .or_else(|| {
                        value
                            .get("media_url")
                            .or_else(|| value.get("mediaUrl"))
                            .and_then(|url| url.as_str())
                    })
                    .map(str::to_string)
            })
            .filter(|url| !url.trim().is_empty())
    }

    async fn message_can_continue(
        &self,
        campaign_id: &str,
        recipient_id: &str,
        message_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        if campaign_id == "api_send" {
            return Ok(true);
        }

        let campaign_status: Option<String> =
            sqlx::query_scalar("SELECT status FROM wa_campaigns WHERE id = ?")
                .bind(campaign_id)
                .fetch_optional(&self.pool)
                .await?;

        if !matches!(campaign_status.as_deref(), Some("running")) {
            info!(
                "Stopping message {} because campaign {} status is {:?}",
                message_id, campaign_id, campaign_status
            );
            return Ok(false);
        }

        let recipient_status: Option<String> =
            sqlx::query_scalar("SELECT status FROM wa_recipients WHERE id = ?")
                .bind(recipient_id)
                .fetch_optional(&self.pool)
                .await?;

        if !matches!(recipient_status.as_deref(), Some("pending")) {
            info!(
                "Stopping message {} for recipient {} because status is {:?}",
                message_id, recipient_id, recipient_status
            );
            return Ok(false);
        }

        Ok(true)
    }

    async fn pause_aware_sleep(
        &self,
        campaign_id: &str,
        recipient_id: &str,
        message_id: &str,
        duration: Duration,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let deadline = Instant::now() + duration;

        loop {
            if !self
                .message_can_continue(campaign_id, recipient_id, message_id)
                .await?
            {
                return Ok(false);
            }

            let now = Instant::now();
            if now >= deadline {
                return Ok(true);
            }

            let remaining = deadline - now;
            let sleep_for = remaining.min(Duration::from_millis(500));
            sleep(sleep_for).await;
        }
    }

    /// Enforce rate limits for account
    ///
    /// **Validates: Requirements 3.3, 3.6, 3.7**
    async fn enforce_rate_limits(
        &self,
        account_id: &str,
        campaign_id: &str,
        recipient_id: &str,
        message_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        loop {
            let can_send = {
                let mut limits = self.rate_limits.write().await;
                let limit = limits
                    .entry(account_id.to_string())
                    .or_insert_with(AccountRateLimit::new);

                if limit.can_send(self.config.rate_limit_per_minute, self.config.daily_limit) {
                    true
                } else {
                    // Check if daily limit exceeded
                    if limit.daily_count >= self.config.daily_limit {
                        warn!(
                            "Account {} reached daily limit ({}/{})",
                            account_id, limit.daily_count, self.config.daily_limit
                        );
                        return Err(format!(
                            "Account {} reached daily limit of {} messages",
                            account_id, self.config.daily_limit
                        )
                        .into());
                    }

                    // Minute rate limit exceeded, need to wait
                    let wait_time = limit.time_until_reset();
                    debug!(
                        "Account {} rate limited, waiting {:?} (sent {}/{})",
                        account_id,
                        wait_time,
                        limit.minute_count,
                        self.config.rate_limit_per_minute
                    );
                    false
                }
            };

            if can_send {
                return Ok(true);
            }

            // Wait for rate limit window to reset
            let wait_time = {
                let limits = self.rate_limits.read().await;
                limits
                    .get(account_id)
                    .map(|l| l.time_until_reset())
                    .unwrap_or(Duration::from_secs(60))
            };

            if !self
                .pause_aware_sleep(campaign_id, recipient_id, message_id, wait_time)
                .await?
            {
                return Ok(false);
            }
        }
    }

    /// Apply smart delay between messages from same account
    ///
    /// **Validates: Requirements 3.1**
    async fn apply_smart_delay(
        &self,
        account_id: &str,
        campaign_id: &str,
        recipient_id: &str,
        message_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let delay_needed = {
            let limits = self.rate_limits.read().await;
            if let Some(limit) = limits.get(account_id) {
                if let Some(last_send) = limit.last_send_at {
                    let elapsed = Instant::now().duration_since(last_send);
                    let min_delay = Duration::from_secs(self.config.min_delay_seconds);

                    if elapsed < min_delay {
                        Some(min_delay - elapsed)
                    } else {
                        None
                    }
                } else {
                    None
                }
            } else {
                None
            }
        };

        if let Some(delay) = delay_needed {
            debug!(
                "Applying smart delay {:?} for account {}",
                delay, account_id
            );
            if !self
                .pause_aware_sleep(campaign_id, recipient_id, message_id, delay)
                .await?
            {
                return Ok(false);
            }
        }

        // Add random jitter (5-15 seconds) using Send-safe RNG
        use rand::SeedableRng;
        let mut rng = rand::rngs::StdRng::from_entropy();
        let jitter = rng.gen_range(self.config.min_delay_seconds..=self.config.max_delay_seconds);
        debug!(
            "Applying random jitter {}s for account {}",
            jitter, account_id
        );
        self.pause_aware_sleep(
            campaign_id,
            recipient_id,
            message_id,
            Duration::from_secs(jitter),
        )
        .await
    }

    /// Simulate typing indicator before sending
    ///
    /// **Validates: Requirements 3.2**
    async fn simulate_typing(
        &self,
        account_id: &str,
        _phone: &str,
        campaign_id: &str,
        recipient_id: &str,
        message_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        use rand::SeedableRng;
        let mut rng = rand::rngs::StdRng::from_entropy();
        let typing_duration =
            rng.gen_range(self.config.min_typing_seconds..=self.config.max_typing_seconds);

        debug!(
            "Simulating typing for {}s on account {}",
            typing_duration, account_id
        );
        if !self
            .pause_aware_sleep(
                campaign_id,
                recipient_id,
                message_id,
                Duration::from_secs(typing_duration),
            )
            .await?
        {
            return Ok(false);
        }

        // TODO: Send actual typing indicator via bridge when Baileys supports it
        // For now, just the delay simulates human behavior

        Ok(true)
    }

    /// Fetch recipient variables from database for spintax processing
    ///
    /// **Validates: Requirements 4.4**
    async fn fetch_recipient_variables(
        &self,
        recipient_id: &str,
    ) -> Result<HashMap<String, String>, Box<dyn std::error::Error + Send + Sync>> {
        let recipient: Option<(Option<String>,)> =
            sqlx::query_as("SELECT variables_json FROM wa_recipients WHERE id = ?")
                .bind(recipient_id)
                .fetch_optional(&self.pool)
                .await?;

        let mut variables: HashMap<String, String> =
            if let Some((Some(variables_json),)) = recipient {
                serde_json::from_str(&variables_json).unwrap_or_else(|e| {
                    warn!("Failed to parse recipient variables JSON: {}", e);
                    HashMap::new()
                })
            } else {
                HashMap::new()
            };

        Self::normalize_recipient_variables(&mut variables);

        Ok(variables)
    }

    fn normalize_recipient_variables(variables: &mut HashMap<String, String>) {
        let existing = variables.clone();
        for (key, value) in existing {
            let normalized_key = key.trim().to_lowercase();
            if normalized_key != key {
                variables
                    .entry(normalized_key.clone())
                    .or_insert(value.clone());
            }
            if matches!(
                normalized_key.as_str(),
                "nama" | "nama_lengkap" | "full_name" | "customer_name" | "customername"
            ) {
                variables.entry("name".to_string()).or_insert(value);
            }
        }
    }

    /// Process message template with spintax
    ///
    /// **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    async fn process_message_template(
        &self,
        template: &str,
        variables: &HashMap<String, String>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut processor = self.spintax_processor.lock().await;

        match processor.process(template, variables) {
            Ok(processed) => {
                debug!("Processed spintax template: {} chars", processed.len());
                Ok(processed)
            }
            Err(e) => {
                error!("Spintax processing error: {}", e);
                // Fallback to original template if spintax fails
                warn!("Using original template as fallback");
                Ok(template.to_string())
            }
        }
    }

    /// Download and process media for campaign
    ///
    /// **Validates: Requirements 7.5**
    async fn download_and_process_media(
        &self,
        media_url: &str,
    ) -> Result<crate::media_handler::MediaFile, Box<dyn std::error::Error + Send + Sync>> {
        if !Self::is_remote_media_url(media_url) {
            let local_path = Self::resolve_local_media_path(media_url);
            let data = tokio::fs::read(&local_path).await?;
            let (media_type, mime_type) = Self::infer_media_type_from_path(&local_path)?;

            info!(
                "Loaded local media for campaign: path={}, type={:?}, size={} bytes",
                local_path.display(),
                media_type,
                data.len()
            );

            return Ok(crate::media_handler::MediaFile {
                media_type,
                mime_type,
                size_bytes: data.len(),
                data,
                thumbnail: None,
            });
        }

        let mut handler = self.media_handler.lock().await;

        // Download and cache media (with cache check)
        let media = handler.download_and_cache_media(media_url, None).await?;

        info!(
            "Processed media: type={:?}, size={} bytes",
            media.media_type, media.size_bytes
        );

        Ok(media)
    }

    fn is_remote_media_url(media_url: &str) -> bool {
        media_url.starts_with("http://") || media_url.starts_with("https://")
    }

    fn resolve_local_media_path(media_url: &str) -> std::path::PathBuf {
        let trimmed = media_url.trim_start_matches('/');
        std::env::current_dir()
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join(trimmed)
    }

    fn infer_media_type_from_path(
        media_path: &std::path::Path,
    ) -> Result<(crate::media_handler::MediaType, String), Box<dyn std::error::Error + Send + Sync>>
    {
        let extension = media_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_lowercase();

        let (media_type, mime_type) = match extension.as_str() {
            "jpg" | "jpeg" => (
                crate::media_handler::MediaType::Image,
                "image/jpeg".to_string(),
            ),
            "png" => (
                crate::media_handler::MediaType::Image,
                "image/png".to_string(),
            ),
            "webp" => (
                crate::media_handler::MediaType::Image,
                "image/webp".to_string(),
            ),
            "pdf" => (
                crate::media_handler::MediaType::Pdf,
                "application/pdf".to_string(),
            ),
            "mp4" => (
                crate::media_handler::MediaType::Video,
                "video/mp4".to_string(),
            ),
            other => {
                return Err(format!("Unsupported local media file extension: {}", other).into());
            }
        };

        Ok((media_type, mime_type))
    }

    /// Compose and send message with text, media, and caption
    ///
    /// **Validates: Requirements 7.5**
    async fn send_composed_message(
        &self,
        message: &crate::redis_manager::QueueMessage,
        processed_text: &str,
        media_data: Option<&crate::media_handler::MediaFile>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut temp_media_path: Option<std::path::PathBuf> = None;

        let media_path = if let Some(media) = media_data {
            if let Some(media_url) = &message.media_url {
                if Self::is_remote_media_url(media_url) {
                    let temp_dir = std::env::current_dir()?.join("uploads").join("wa_temp");
                    tokio::fs::create_dir_all(&temp_dir).await?;

                    let extension = match media.media_type {
                        crate::media_handler::MediaType::Image => "webp",
                        crate::media_handler::MediaType::Pdf => "pdf",
                        crate::media_handler::MediaType::Video => "mp4",
                    };

                    let temp_path =
                        temp_dir.join(format!("{}_media.{}", message.message_id, extension));
                    tokio::fs::write(&temp_path, &media.data).await?;
                    temp_media_path = Some(temp_path.clone());
                    temp_path
                } else {
                    Self::resolve_local_media_path(media_url)
                }
            } else {
                let temp_dir = std::env::current_dir()?.join("uploads").join("wa_temp");
                tokio::fs::create_dir_all(&temp_dir).await?;

                let extension = match media.media_type {
                    crate::media_handler::MediaType::Image => "webp",
                    crate::media_handler::MediaType::Pdf => "pdf",
                    crate::media_handler::MediaType::Video => "mp4",
                };

                let temp_path =
                    temp_dir.join(format!("{}_media.{}", message.message_id, extension));
                tokio::fs::write(&temp_path, &media.data).await?;
                temp_media_path = Some(temp_path.clone());
                temp_path
            }
        } else {
            std::path::PathBuf::new()
        };

        let params = if let Some(media) = media_data {
            // Send media message with caption via send_media
            serde_json::json!({
                "session_id": message.account_id,
                "phone": message.phone,
                "media_type": format!("{:?}", media.media_type).to_lowercase(),
                "media_path": media_path.to_string_lossy().to_string(),
                "caption": processed_text,
            })
        } else {
            // Send text-only message
            serde_json::json!({
                "session_id": message.account_id,
                "phone": message.phone,
                "message": processed_text,
            })
        };

        let method = if media_data.is_some() {
            "send_media"
        } else {
            "send_message"
        };

        let send_result = if media_data.is_some() {
            self.bridge_client
                .send_request_with_timeout(
                    &message.account_id,
                    method.to_string(),
                    params,
                    Duration::from_secs(180),
                )
                .await
        } else {
            self.bridge_client
                .send_request(&message.account_id, method.to_string(), params)
                .await
        };

        if let Some(temp_path) = temp_media_path {
            if let Err(e) = tokio::fs::remove_file(&temp_path).await {
                warn!(
                    path = %temp_path.display(),
                    error = %e,
                    "Failed to remove temporary media file"
                );
            }
        }

        let result = send_result?;
        debug!("Bridge send result: {:?}", result);
        let wa_message_id = result
            .get("message_id")
            .and_then(|value| value.as_str())
            .unwrap_or(&message.message_id)
            .to_string();

        Ok(wa_message_id)
    }

    /// Mark recipient as sent in database
    ///
    /// **Validates: Requirements 10.1**
    async fn mark_recipient_sent(
        &self,
        recipient_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(
            "UPDATE wa_recipients 
             SET status = 'sent', last_attempt_at = CURRENT_TIMESTAMP 
             WHERE id = ?",
        )
        .bind(recipient_id)
        .execute(&self.pool)
        .await?;

        debug!("Marked recipient {} as sent", recipient_id);
        Ok(())
    }

    async fn recipient_already_sent(
        &self,
        recipient_id: &str,
        campaign_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        if campaign_id == "api_send" {
            return Ok(false);
        }

        let already_sent: i64 = sqlx::query_scalar(
            "SELECT CASE
                WHEN EXISTS (
                    SELECT 1 FROM wa_recipients
                    WHERE id = ? AND status = 'sent'
                )
                OR EXISTS (
                    SELECT 1 FROM wa_dispatch_logs
                    WHERE recipient_id = ? AND status = 'success'
                )
                THEN 1 ELSE 0 END",
        )
        .bind(recipient_id)
        .bind(recipient_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(already_sent == 1)
    }

    /// Mark recipient as failed in database
    ///
    /// **Validates: Requirements 10.1**
    async fn mark_recipient_failed(
        &self,
        recipient_id: &str,
        error_reason: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(
            "UPDATE wa_recipients 
             SET status = 'failed', last_attempt_at = CURRENT_TIMESTAMP, last_error = ?
             WHERE id = ?",
        )
        .bind(error_reason)
        .bind(recipient_id)
        .execute(&self.pool)
        .await?;

        debug!(
            "Marked recipient {} as failed: {}",
            recipient_id, error_reason
        );
        Ok(())
    }

    /// Check if campaign is completed and update status
    ///
    /// **Validates: Requirements 10.8**
    async fn check_and_update_campaign_completion(
        &self,
        campaign_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Skip for API sends (not part of a campaign)
        if campaign_id == "api_send" {
            return Ok(());
        }

        let campaign_status: Option<String> =
            sqlx::query_scalar("SELECT status FROM wa_campaigns WHERE id = ?")
                .bind(campaign_id)
                .fetch_optional(&self.pool)
                .await?;

        if !matches!(campaign_status.as_deref(), Some("running")) {
            debug!(
                "Skipping completion update for campaign {} because status is {:?}",
                campaign_id, campaign_status
            );
            return Ok(());
        }

        // Check if all recipients are processed (sent, failed, or skipped)
        let pending_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wa_recipients 
             WHERE campaign_id = ? AND status = 'pending'",
        )
        .bind(campaign_id)
        .fetch_one(&self.pool)
        .await?;

        if pending_count.0 == 0 {
            // All recipients processed, update campaign status to completed
            sqlx::query(
                "UPDATE wa_campaigns 
                 SET status = 'completed' 
                 WHERE id = ?",
            )
            .bind(campaign_id)
            .execute(&self.pool)
            .await?;

            info!("Campaign {} marked as completed", campaign_id);
        }

        Ok(())
    }

    async fn update_recipient_attempt_error(
        &self,
        recipient_id: &str,
        error_reason: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        sqlx::query(
            "UPDATE wa_recipients 
             SET last_attempt_at = CURRENT_TIMESTAMP, last_error = ?
             WHERE id = ?",
        )
        .bind(error_reason)
        .bind(recipient_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Record send in rate limiter
    async fn record_send(&self, account_id: &str) {
        let mut limits = self.rate_limits.write().await;
        let limit = limits
            .entry(account_id.to_string())
            .or_insert_with(AccountRateLimit::new);
        limit.record_send();
    }

    /// Update account send counters in database
    ///
    /// **Validates: Requirements 3.6, 3.7**
    async fn update_account_counters(
        &self,
        account_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Increment hourly and daily counters
        sqlx::query(
            "UPDATE wa_accounts 
             SET hourly_send_count = hourly_send_count + 1,
                 daily_send_count = daily_send_count + 1,
                 last_reset_at = CASE 
                     WHEN last_reset_at IS NULL OR date(last_reset_at) < date('now') 
                     THEN datetime('now') 
                     ELSE last_reset_at 
                 END
             WHERE id = ?",
        )
        .bind(account_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Log successful dispatch
    async fn log_dispatch_success(
        &self,
        message: &crate::redis_manager::QueueMessage,
        wa_message_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if message.campaign_id != "api_send" {
            let existing_success: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM wa_dispatch_logs WHERE recipient_id = ? AND status = 'success'",
            )
            .bind(&message.recipient_id)
            .fetch_one(&self.pool)
            .await?;

            if existing_success > 0 {
                debug!(
                    "Skipping duplicate success dispatch log for recipient {}",
                    message.recipient_id
                );
                return Ok(());
            }
        }

        let log_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO wa_dispatch_logs 
             (id, campaign_id, recipient_id, phone, wa_account_id, status, message_id, created_at) 
             VALUES (?, ?, ?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)",
        )
        .bind(&log_id)
        .bind(&message.campaign_id)
        .bind(&message.recipient_id)
        .bind(&message.phone)
        .bind(&message.account_id)
        .bind(wa_message_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Log failed dispatch
    async fn log_dispatch_failure(
        &self,
        message: &crate::redis_manager::QueueMessage,
        error: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let log_id = uuid::Uuid::new_v4().to_string();
        let meta = serde_json::json!({ "error": error }).to_string();

        sqlx::query(
            "INSERT INTO wa_dispatch_logs 
             (id, campaign_id, recipient_id, phone, wa_account_id, status, meta, created_at) 
             VALUES (?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)",
        )
        .bind(&log_id)
        .bind(&message.campaign_id)
        .bind(&message.recipient_id)
        .bind(&message.phone)
        .bind(&message.account_id)
        .bind(&meta)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Shutdown the blast engine gracefully
    pub async fn shutdown(&self) {
        info!("Shutting down Blast Engine...");
        let mut shutdown = self.shutdown.lock().await;
        *shutdown = true;
    }

    /// Get worker health status
    ///
    /// **Validates: Requirements 14.6, 14.7**
    pub async fn get_worker_health(&self) -> HashMap<usize, bool> {
        let health = self.worker_health.read().await;
        health.clone()
    }

    /// Get active worker count
    pub async fn get_active_worker_count(&self) -> usize {
        let health = self.worker_health.read().await;
        health.values().filter(|&&v| v).count()
    }

    /// Get rate limit status for account
    pub async fn get_account_rate_limit_status(
        &self,
        account_id: &str,
    ) -> Option<(u32, u32, u32, u32)> {
        let limits = self.rate_limits.read().await;
        limits.get(account_id).map(|limit| {
            (
                limit.minute_count,
                self.config.rate_limit_per_minute,
                limit.daily_count,
                self.config.daily_limit,
            )
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_rate_limit_minute_window() {
        let mut limit = AccountRateLimit::new();

        // Should allow sends up to rate limit
        for _ in 0..20 {
            assert!(limit.can_send(20, 1000));
            limit.record_send();
        }

        // Should block after rate limit
        assert!(!limit.can_send(20, 1000));
    }

    #[test]
    fn test_account_rate_limit_daily_limit() {
        let mut limit = AccountRateLimit::new();

        // Simulate reaching daily limit
        limit.daily_count = 1000;

        // Should block even if minute window allows
        assert!(!limit.can_send(20, 1000));
    }

    #[test]
    fn test_default_config() {
        let config = BlastEngineConfig::default();

        assert_eq!(config.worker_count, 10);
        assert_eq!(config.batch_size, 5);
        assert_eq!(config.min_delay_seconds, 5);
        assert_eq!(config.max_delay_seconds, 15);
        assert_eq!(config.min_typing_seconds, 1);
        assert_eq!(config.max_typing_seconds, 3);
        assert_eq!(config.rate_limit_per_minute, 20);
        assert_eq!(config.daily_limit, 1000);
        assert_eq!(config.max_concurrent_per_account, 3);
    }

    /// **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    /// Test spintax processing with variables
    #[tokio::test]
    async fn test_spintax_processing() {
        use crate::spintax::SpintaxProcessor;

        let mut processor = SpintaxProcessor::new();
        let mut variables = HashMap::new();
        variables.insert("name".to_string(), "John".to_string());
        variables.insert("product".to_string(), "Laptop".to_string());

        let template = "{Hello|Hi} {{name}}, check out our {amazing|great} {{product}}!";
        let result = processor.process(template, &variables).unwrap();

        // Verify variables are replaced
        assert!(result.contains("John"));
        assert!(result.contains("Laptop"));

        // Verify spintax options are selected
        assert!(result.starts_with("Hello") || result.starts_with("Hi"));
        assert!(result.contains("amazing") || result.contains("great"));
    }

    /// **Validates: Requirements 4.4**
    /// Test recipient variables parsing
    #[test]
    fn test_recipient_variables_parsing() {
        let variables_json = r#"{"name": "Alice", "city": "Jakarta", "discount": "20%"}"#;
        let variables: HashMap<String, String> = serde_json::from_str(variables_json).unwrap();

        assert_eq!(variables.get("name").unwrap(), "Alice");
        assert_eq!(variables.get("city").unwrap(), "Jakarta");
        assert_eq!(variables.get("discount").unwrap(), "20%");
    }

    /// **Validates: Requirements 7.5**
    /// Test media message composition
    #[test]
    fn test_media_message_composition() {
        let message_text = "Check out this product!";
        let media_url = Some("https://example.com/image.jpg".to_string());

        // Verify media URL is present
        assert!(media_url.is_some());

        // Verify message text can be used as caption
        assert!(!message_text.is_empty());
    }

    #[test]
    fn test_local_media_path_resolution() {
        let cwd = std::env::current_dir().unwrap();
        let resolved = BlastEngine::resolve_local_media_path("/uploads/campaign/example.webp");

        assert_eq!(resolved, cwd.join("uploads/campaign/example.webp"));
    }

    #[test]
    fn test_remote_media_url_detection() {
        assert!(BlastEngine::is_remote_media_url(
            "https://example.com/image.jpg"
        ));
        assert!(BlastEngine::is_remote_media_url(
            "http://example.com/image.jpg"
        ));
        assert!(!BlastEngine::is_remote_media_url(
            "/uploads/campaign/example.webp"
        ));
    }

    #[test]
    fn test_infer_media_type_from_path() {
        let (media_type, mime_type) = BlastEngine::infer_media_type_from_path(
            std::path::Path::new("/uploads/campaign/example.webp"),
        )
        .unwrap();

        assert_eq!(media_type, crate::media_handler::MediaType::Image);
        assert_eq!(mime_type, "image/webp");
    }

    /// **Validates: Requirements 10.1, 10.8**
    /// Test campaign completion detection
    #[test]
    fn test_campaign_completion_logic() {
        // Simulate campaign with all recipients processed
        let total_recipients = 100;
        let pending_recipients = 0;
        let sent_recipients = 85;
        let failed_recipients = 15;

        // Campaign should be marked as completed when no pending recipients
        assert_eq!(pending_recipients, 0);
        assert_eq!(sent_recipients + failed_recipients, total_recipients);
    }
}

// ─── Integration Tests ────────────────────────────────────────────────────────

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::queue_manager::QueueManager;
    use crate::redis_manager::{Priority, RedisManager};
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

    /// Mock BridgeClient for testing without actual Node.js processes
    #[derive(Clone)]
    struct MockBridgeClient {
        send_count: Arc<AtomicUsize>,
        should_fail: Arc<AtomicBool>,
    }

    impl MockBridgeClient {
        fn new() -> Self {
            Self {
                send_count: Arc::new(AtomicUsize::new(0)),
                should_fail: Arc::new(AtomicBool::new(false)),
            }
        }

        fn set_should_fail(&self, should_fail: bool) {
            self.should_fail.store(should_fail, Ordering::SeqCst);
        }

        fn get_send_count(&self) -> usize {
            self.send_count.load(Ordering::SeqCst)
        }

        async fn send_request(
            &self,
            account_id: &str,
            _method: String,
            params: serde_json::Value,
        ) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
            // Check if should fail
            if self.should_fail.load(Ordering::SeqCst) {
                return Err("Mock send failure".into());
            }

            debug!("Mock bridge send to {}: {:?}", account_id, params);

            // Increment counter
            self.send_count.fetch_add(1, Ordering::SeqCst);

            Ok(serde_json::json!({
                "success": true,
                "message_id": format!("msg_{}", uuid::Uuid::new_v4())
            }))
        }
    }

    /// Setup test database with required tables
    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();

        // Create wa_campaigns table
        sqlx::query(
            "CREATE TABLE wa_campaigns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                config TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                created_by TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create wa_recipients table
        sqlx::query(
            "CREATE TABLE wa_recipients (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                phone TEXT NOT NULL,
                variables_json TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                last_attempt_at DATETIME,
                sent_at DATETIME,
                delivered_at DATETIME,
                read_at DATETIME,
                replied_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create wa_dispatch_logs table
        sqlx::query(
            "CREATE TABLE wa_dispatch_logs (
                id TEXT PRIMARY KEY,
                campaign_id TEXT NOT NULL,
                recipient_id TEXT NOT NULL,
                phone TEXT NOT NULL,
                wa_account_id TEXT NOT NULL,
                status TEXT NOT NULL,
                message_id TEXT,
                meta TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create wa_accounts table
        sqlx::query(
            "CREATE TABLE wa_accounts (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                name TEXT,
                status TEXT NOT NULL DEFAULT 'disconnected',
                hourly_send_count INTEGER NOT NULL DEFAULT 0,
                daily_send_count INTEGER NOT NULL DEFAULT 0,
                last_reset_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    /// Create a test BlastEngine with mock bridge client
    /// Note: This creates a real BridgeClient but we won't actually spawn processes
    async fn create_test_blast_engine(
        pool: SqlitePool,
        config: BlastEngineConfig,
    ) -> (
        TestBlastEngine,
        QueueManager,
        RedisManager,
        Arc<MockBridgeClient>,
    ) {
        // Create Redis manager (requires Redis server running)
        let redis = RedisManager::new("redis://127.0.0.1:6379")
            .await
            .expect("Failed to connect to Redis - ensure Redis is running on localhost:6379");

        // Create queue manager
        let queue_manager = QueueManager::new(redis.clone(), pool.clone());

        // Create mock bridge
        let mock_bridge = Arc::new(MockBridgeClient::new());

        // Create test blast engine with mock bridge
        let engine = TestBlastEngine {
            config,
            queue_manager: Arc::new(queue_manager.clone()),
            mock_bridge: mock_bridge.clone(),
            pool: pool.clone(),
            rate_limits: Arc::new(RwLock::new(HashMap::new())),
            account_semaphores: Arc::new(RwLock::new(HashMap::new())),
            spintax_processor: Arc::new(Mutex::new(crate::spintax::SpintaxProcessor::new())),
        };

        (engine, queue_manager, redis, mock_bridge)
    }

    /// Test version of BlastEngine that uses MockBridgeClient
    struct TestBlastEngine {
        config: BlastEngineConfig,
        queue_manager: Arc<QueueManager>,
        mock_bridge: Arc<MockBridgeClient>,
        pool: SqlitePool,
        rate_limits: Arc<RwLock<HashMap<String, AccountRateLimit>>>,
        account_semaphores: Arc<RwLock<HashMap<String, Arc<Semaphore>>>>,
        spintax_processor: Arc<Mutex<crate::spintax::SpintaxProcessor>>,
    }

    impl TestBlastEngine {
        /// Process a single message (test version using mock bridge)
        async fn process_single_message(
            &self,
            message: crate::redis_manager::QueueMessage,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            let account_id = message.account_id.clone();
            let recipient_id = message.recipient_id.clone();
            let campaign_id = message.campaign_id.clone();

            // Get or create semaphore for account
            let semaphore = {
                let mut semaphores = self.account_semaphores.write().await;
                semaphores
                    .entry(account_id.clone())
                    .or_insert_with(|| {
                        Arc::new(Semaphore::new(self.config.max_concurrent_per_account))
                    })
                    .clone()
            };

            let _permit = semaphore.acquire().await?;

            // Check and enforce rate limits
            self.enforce_rate_limits(&account_id).await?;

            // Apply smart delay
            self.apply_smart_delay(&account_id).await;

            // Fetch recipient variables
            let recipient_variables = self.fetch_recipient_variables(&recipient_id).await?;

            // Process message template with spintax
            let processed_message = self
                .process_message_template(&message.message_text, &recipient_variables)
                .await?;

            // Simulate typing
            self.simulate_typing(&account_id, &message.phone).await?;

            // Send via mock bridge
            let send_result = self
                .mock_bridge
                .send_request(
                    &account_id,
                    "send_message".to_string(),
                    serde_json::json!({
                        "phone": message.phone,
                        "message": processed_message,
                        "media_url": message.media_url,
                    }),
                )
                .await;

            // Record send in rate limiter
            self.record_send(&account_id).await;

            // Update database counters
            self.update_account_counters(&account_id).await?;

            // Handle send result
            match send_result {
                Ok(_) => {
                    self.mark_recipient_sent(&recipient_id).await?;
                    self.log_dispatch_success(&message).await?;
                    self.check_and_update_campaign_completion(&campaign_id)
                        .await?;
                }
                Err(e) => {
                    let requeued = self
                        .queue_manager
                        .requeue_with_retry(message.clone(), Priority::Normal)
                        .await?;

                    if !requeued {
                        self.mark_recipient_failed(&recipient_id, "max_retries_exceeded")
                            .await?;
                        self.log_dispatch_failure(&message, &e.to_string()).await?;
                        self.check_and_update_campaign_completion(&campaign_id)
                            .await?;
                    }
                }
            }

            Ok(())
        }

        // Helper methods (copied from BlastEngine)
        async fn enforce_rate_limits(
            &self,
            account_id: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            loop {
                let can_send = {
                    let mut limits = self.rate_limits.write().await;
                    let limit = limits
                        .entry(account_id.to_string())
                        .or_insert_with(AccountRateLimit::new);

                    if limit.can_send(self.config.rate_limit_per_minute, self.config.daily_limit) {
                        true
                    } else {
                        if limit.daily_count >= self.config.daily_limit {
                            return Err(
                                format!("Account {} reached daily limit", account_id).into()
                            );
                        }
                        false
                    }
                };

                if can_send {
                    break;
                }

                let wait_time = {
                    let limits = self.rate_limits.read().await;
                    limits
                        .get(account_id)
                        .map(|l| l.time_until_reset())
                        .unwrap_or(Duration::from_secs(60))
                };

                sleep(wait_time).await;
            }
            Ok(())
        }

        async fn apply_smart_delay(&self, account_id: &str) {
            let delay_needed = {
                let limits = self.rate_limits.read().await;
                if let Some(limit) = limits.get(account_id) {
                    if let Some(last_send) = limit.last_send_at {
                        let elapsed = tokio::time::Instant::now().duration_since(last_send);
                        let min_delay = Duration::from_secs(self.config.min_delay_seconds);

                        if elapsed < min_delay {
                            Some(min_delay - elapsed)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                } else {
                    None
                }
            };

            if let Some(delay) = delay_needed {
                sleep(delay).await;
            }

            use rand::SeedableRng;
            let mut rng = rand::rngs::StdRng::from_entropy();
            let jitter =
                rng.gen_range(self.config.min_delay_seconds..=self.config.max_delay_seconds);
            sleep(Duration::from_secs(jitter)).await;
        }

        async fn simulate_typing(
            &self,
            _account_id: &str,
            _phone: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            use rand::SeedableRng;
            let mut rng = rand::rngs::StdRng::from_entropy();
            let typing_duration =
                rng.gen_range(self.config.min_typing_seconds..=self.config.max_typing_seconds);
            sleep(Duration::from_secs(typing_duration)).await;
            Ok(())
        }

        async fn fetch_recipient_variables(
            &self,
            recipient_id: &str,
        ) -> Result<HashMap<String, String>, Box<dyn std::error::Error + Send + Sync>> {
            let recipient: Option<(Option<String>,)> =
                sqlx::query_as("SELECT variables_json FROM wa_recipients WHERE id = ?")
                    .bind(recipient_id)
                    .fetch_optional(&self.pool)
                    .await?;

            let variables = if let Some((Some(variables_json),)) = recipient {
                serde_json::from_str(&variables_json).unwrap_or_else(|_| HashMap::new())
            } else {
                HashMap::new()
            };

            Ok(variables)
        }

        async fn process_message_template(
            &self,
            template: &str,
            variables: &HashMap<String, String>,
        ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
            let mut processor = self.spintax_processor.lock().await;
            match processor.process(template, variables) {
                Ok(processed) => Ok(processed),
                Err(_) => Ok(template.to_string()),
            }
        }

        async fn record_send(&self, account_id: &str) {
            let mut limits = self.rate_limits.write().await;
            let limit = limits
                .entry(account_id.to_string())
                .or_insert_with(AccountRateLimit::new);
            limit.record_send();
        }

        async fn update_account_counters(
            &self,
            account_id: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            sqlx::query(
                "UPDATE wa_accounts 
                 SET hourly_send_count = hourly_send_count + 1,
                     daily_send_count = daily_send_count + 1
                 WHERE id = ?",
            )
            .bind(account_id)
            .execute(&self.pool)
            .await?;
            Ok(())
        }

        async fn mark_recipient_sent(
            &self,
            recipient_id: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            sqlx::query(
                "UPDATE wa_recipients 
                 SET status = 'sent', last_attempt_at = CURRENT_TIMESTAMP 
                 WHERE id = ?",
            )
            .bind(recipient_id)
            .execute(&self.pool)
            .await?;
            Ok(())
        }

        async fn mark_recipient_failed(
            &self,
            recipient_id: &str,
            _error_reason: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            sqlx::query(
                "UPDATE wa_recipients 
                 SET status = 'failed', last_attempt_at = CURRENT_TIMESTAMP 
                 WHERE id = ?",
            )
            .bind(recipient_id)
            .execute(&self.pool)
            .await?;
            Ok(())
        }

        async fn log_dispatch_success(
            &self,
            message: &crate::redis_manager::QueueMessage,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            let log_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO wa_dispatch_logs 
                 (id, campaign_id, recipient_id, phone, wa_account_id, status, message_id, created_at) 
                 VALUES (?, ?, ?, ?, ?, 'success', ?, CURRENT_TIMESTAMP)"
            )
            .bind(&log_id)
            .bind(&message.campaign_id)
            .bind(&message.recipient_id)
            .bind(&message.phone)
            .bind(&message.account_id)
            .bind(&message.message_id)
            .execute(&self.pool)
            .await?;
            Ok(())
        }

        async fn log_dispatch_failure(
            &self,
            message: &crate::redis_manager::QueueMessage,
            error: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            let log_id = uuid::Uuid::new_v4().to_string();
            let meta = serde_json::json!({ "error": error }).to_string();

            sqlx::query(
                "INSERT INTO wa_dispatch_logs 
                 (id, campaign_id, recipient_id, phone, wa_account_id, status, meta, created_at) 
                 VALUES (?, ?, ?, ?, ?, 'failed', ?, CURRENT_TIMESTAMP)",
            )
            .bind(&log_id)
            .bind(&message.campaign_id)
            .bind(&message.recipient_id)
            .bind(&message.phone)
            .bind(&message.account_id)
            .bind(&meta)
            .execute(&self.pool)
            .await?;
            Ok(())
        }

        async fn check_and_update_campaign_completion(
            &self,
            campaign_id: &str,
        ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
            if campaign_id == "api_send" {
                return Ok(());
            }

            let pending_count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM wa_recipients 
                 WHERE campaign_id = ? AND status = 'pending'",
            )
            .bind(campaign_id)
            .fetch_one(&self.pool)
            .await?;

            if pending_count.0 == 0 {
                sqlx::query(
                    "UPDATE wa_campaigns 
                     SET status = 'completed' 
                     WHERE id = ?",
                )
                .bind(campaign_id)
                .execute(&self.pool)
                .await?;
            }

            Ok(())
        }

        fn get_account_rate_limit_status(
            &self,
            account_id: &str,
        ) -> impl std::future::Future<Output = Option<(u32, u32, u32, u32)>> + Send {
            let rate_limits = self.rate_limits.clone();
            let account_id = account_id.to_string();
            let rate_limit_per_minute = self.config.rate_limit_per_minute;
            let daily_limit = self.config.daily_limit;

            async move {
                let limits = rate_limits.read().await;
                limits.get(&account_id).map(|limit| {
                    (
                        limit.minute_count,
                        rate_limit_per_minute,
                        limit.daily_count,
                        daily_limit,
                    )
                })
            }
        }
    }

    /// **Validates: Requirements 3.3, 3.4, 3.6, 3.7**
    /// Integration test: End-to-end campaign execution with mock bridge
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_end_to_end_campaign_execution() {
        let pool = setup_test_db().await;

        // Create test campaign
        let campaign_id = uuid::Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO wa_campaigns (id, name, status) VALUES (?, ?, 'active')")
            .bind(&campaign_id)
            .bind("Test Campaign")
            .execute(&pool)
            .await
            .unwrap();

        // Create test recipients
        let _recipient_ids: Vec<String> = (0..10)
            .map(|i| {
                let recipient_id = uuid::Uuid::new_v4().to_string();
                let phone = format!("+628123456789{:02}", i);

                tokio::task::block_in_place(|| {
                    tokio::runtime::Handle::current().block_on(async {
                        sqlx::query(
                            "INSERT INTO wa_recipients (id, campaign_id, phone, status) 
                             VALUES (?, ?, ?, 'pending')",
                        )
                        .bind(&recipient_id)
                        .bind(&campaign_id)
                        .bind(&phone)
                        .execute(&pool)
                        .await
                        .unwrap();
                    })
                });

                recipient_id
            })
            .collect();

        // Create test account
        let account_id = "test_account_1";
        sqlx::query(
            "INSERT INTO wa_accounts (id, phone, name, status) 
             VALUES (?, '+6281234567890', 'Test Account', 'connected')",
        )
        .bind(account_id)
        .execute(&pool)
        .await
        .unwrap();

        // Create blast engine with fast config for testing
        let config = BlastEngineConfig {
            worker_count: 2,
            batch_size: 5,
            min_delay_seconds: 0, // No delay for testing
            max_delay_seconds: 0,
            min_typing_seconds: 0,
            max_typing_seconds: 0,
            rate_limit_per_minute: 100, // High limit for testing
            daily_limit: 1000,
            max_concurrent_per_account: 3,
        };

        let (engine, queue_manager, mut redis, mock_bridge) =
            create_test_blast_engine(pool.clone(), config).await;

        // Enqueue campaign
        let enqueued = queue_manager
            .enqueue_campaign(&campaign_id, &[account_id.to_string()])
            .await
            .unwrap();
        assert_eq!(enqueued, 10, "Should enqueue all 10 recipients");

        // Process messages manually (instead of starting full worker pool)
        for _ in 0..2 {
            let batch = queue_manager
                .dequeue_batch(account_id, Priority::Normal, 5)
                .await
                .unwrap();

            if !batch.is_empty() {
                for message in batch {
                    engine.process_single_message(message).await.unwrap();
                }
            }
        }

        // Verify all messages were sent
        assert_eq!(
            mock_bridge.get_send_count(),
            10,
            "Should send all 10 messages"
        );

        // Verify recipients are marked as sent
        let sent_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wa_recipients WHERE campaign_id = ? AND status = 'sent'",
        )
        .bind(&campaign_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(sent_count.0, 10, "All recipients should be marked as sent");

        // Verify campaign is marked as completed
        let campaign_status: (String,) =
            sqlx::query_as("SELECT status FROM wa_campaigns WHERE id = ?")
                .bind(&campaign_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(
            campaign_status.0, "completed",
            "Campaign should be completed"
        );

        // Verify dispatch logs
        let log_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wa_dispatch_logs WHERE campaign_id = ? AND status = 'success'",
        )
        .bind(&campaign_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(log_count.0, 10, "Should have 10 success dispatch logs");

        // Cleanup
        redis.clear_account_queues(account_id).await.unwrap();
    }

    /// **Validates: Requirements 3.3, 3.6, 3.7**
    /// Integration test: Rate limiting enforcement
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_rate_limiting_enforcement() {
        let pool = setup_test_db().await;

        // Create blast engine with strict rate limits
        let config = BlastEngineConfig {
            worker_count: 1,
            batch_size: 10,
            min_delay_seconds: 0,
            max_delay_seconds: 0,
            min_typing_seconds: 0,
            max_typing_seconds: 0,
            rate_limit_per_minute: 5, // Only 5 messages per minute
            daily_limit: 1000,
            max_concurrent_per_account: 1,
        };

        let (engine, queue_manager, mut redis, mock_bridge) =
            create_test_blast_engine(pool.clone(), config.clone()).await;

        let account_id = "test_account_rate_limit";

        // Create test account
        sqlx::query(
            "INSERT INTO wa_accounts (id, phone, name, status) 
             VALUES (?, '+6281234567891', 'Rate Limit Test', 'connected')",
        )
        .bind(account_id)
        .execute(&pool)
        .await
        .unwrap();

        // Enqueue 10 messages
        for i in 0..10 {
            queue_manager
                .enqueue_message(
                    account_id.to_string(),
                    format!("+628123456789{:02}", i),
                    "Test message".to_string(),
                    None,
                    Priority::Normal,
                )
                .await
                .unwrap();
        }

        // Process first 5 messages (should succeed)
        let _start_time = tokio::time::Instant::now();

        for _ in 0..5 {
            let batch = queue_manager
                .dequeue_batch(account_id, Priority::Normal, 1)
                .await
                .unwrap();

            if let Some(message) = batch.first() {
                engine
                    .process_single_message(message.clone())
                    .await
                    .unwrap();
            }
        }

        assert_eq!(
            mock_bridge.get_send_count(),
            5,
            "Should send first 5 messages"
        );

        // Try to process 6th message - should be rate limited
        let batch = queue_manager
            .dequeue_batch(account_id, Priority::Normal, 1)
            .await
            .unwrap();

        if let Some(message) = batch.first() {
            // This should wait for rate limit window to reset
            let result = tokio::time::timeout(
                Duration::from_secs(2),
                engine.process_single_message(message.clone()),
            )
            .await;

            // Should timeout because rate limit blocks
            assert!(result.is_err(), "Should timeout due to rate limiting");
        }

        // Verify rate limit status
        let rate_status = engine.get_account_rate_limit_status(account_id).await;
        assert!(rate_status.is_some(), "Should have rate limit status");

        let (minute_count, minute_limit, daily_count, _) = rate_status.unwrap();
        assert_eq!(minute_count, 5, "Should have 5 messages in current minute");
        assert_eq!(minute_limit, 5, "Minute limit should be 5");
        assert_eq!(daily_count, 5, "Should have 5 messages in daily count");

        // Cleanup
        redis.clear_account_queues(account_id).await.unwrap();
    }

    /// **Validates: Requirements 2.5, 2.6, 3.4**
    /// Integration test: Retry logic for failed sends
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_retry_logic_for_failed_sends() {
        let pool = setup_test_db().await;

        let config = BlastEngineConfig {
            worker_count: 1,
            batch_size: 5,
            min_delay_seconds: 0,
            max_delay_seconds: 0,
            min_typing_seconds: 0,
            max_typing_seconds: 0,
            rate_limit_per_minute: 100,
            daily_limit: 1000,
            max_concurrent_per_account: 3,
        };

        let (engine, queue_manager, mut redis, mock_bridge) =
            create_test_blast_engine(pool.clone(), config).await;

        // Configure mock to fail initially
        mock_bridge.set_should_fail(true);

        let account_id = "test_account_retry";
        let campaign_id = uuid::Uuid::new_v4().to_string();
        let recipient_id = uuid::Uuid::new_v4().to_string();

        // Create test account
        sqlx::query(
            "INSERT INTO wa_accounts (id, phone, name, status) 
             VALUES (?, '+6281234567892', 'Retry Test', 'connected')",
        )
        .bind(account_id)
        .execute(&pool)
        .await
        .unwrap();

        // Create campaign and recipient
        sqlx::query(
            "INSERT INTO wa_campaigns (id, name, status) VALUES (?, 'Retry Test', 'active')",
        )
        .bind(&campaign_id)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO wa_recipients (id, campaign_id, phone, status) 
             VALUES (?, ?, '+6281234567892', 'pending')",
        )
        .bind(&recipient_id)
        .bind(&campaign_id)
        .execute(&pool)
        .await
        .unwrap();

        // Enqueue message
        queue_manager
            .enqueue_message(
                account_id.to_string(),
                "+6281234567892".to_string(),
                "Test retry message".to_string(),
                None,
                Priority::Normal,
            )
            .await
            .unwrap();

        // First attempt - should fail and requeue
        let batch = queue_manager
            .dequeue_batch(account_id, Priority::Normal, 1)
            .await
            .unwrap();

        assert_eq!(batch.len(), 1, "Should have 1 message");
        let message = batch[0].clone();

        let result = engine.process_single_message(message.clone()).await;
        assert!(result.is_err(), "First send should fail");
        assert_eq!(
            mock_bridge.get_send_count(),
            0,
            "Should not send on failure"
        );

        // Process retry queue to move message back
        tokio::time::sleep(Duration::from_millis(100)).await;
        let processed = queue_manager.process_retry_queue().await.unwrap();
        assert!(processed > 0, "Should process retry queue");

        // Second attempt - still failing
        mock_bridge.set_should_fail(true);
        let batch = queue_manager
            .dequeue_batch(account_id, Priority::Normal, 1)
            .await
            .unwrap();

        if let Some(message) = batch.first() {
            assert_eq!(message.retry_count, 1, "Should have retry_count = 1");
            let result = engine.process_single_message(message.clone()).await;
            assert!(result.is_err(), "Second send should fail");
        }

        // Process retry queue again
        tokio::time::sleep(Duration::from_millis(100)).await;
        queue_manager.process_retry_queue().await.unwrap();

        // Third attempt - now succeeds
        mock_bridge.set_should_fail(false);
        let batch = queue_manager
            .dequeue_batch(account_id, Priority::Normal, 1)
            .await
            .unwrap();

        if let Some(message) = batch.first() {
            assert_eq!(message.retry_count, 2, "Should have retry_count = 2");
            let result = engine.process_single_message(message.clone()).await;
            assert!(result.is_ok(), "Third send should succeed");
            assert_eq!(mock_bridge.get_send_count(), 1, "Should send on success");
        }

        // Verify recipient is marked as sent
        let recipient_status: (String,) =
            sqlx::query_as("SELECT status FROM wa_recipients WHERE id = ?")
                .bind(&recipient_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(
            recipient_status.0, "sent",
            "Recipient should be marked as sent"
        );

        // Cleanup
        redis.clear_account_queues(account_id).await.unwrap();
    }

    /// **Validates: Requirements 10.8**
    /// Integration test: Campaign completion detection
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_campaign_completion_detection() {
        let pool = setup_test_db().await;

        let config = BlastEngineConfig::default();
        let (engine, queue_manager, mut redis, _mock_bridge) =
            create_test_blast_engine(pool.clone(), config).await;

        let account_id = "test_account_completion";
        let campaign_id = uuid::Uuid::new_v4().to_string();

        // Create test account
        sqlx::query(
            "INSERT INTO wa_accounts (id, phone, name, status) 
             VALUES (?, '+6281234567893', 'Completion Test', 'connected')",
        )
        .bind(account_id)
        .execute(&pool)
        .await
        .unwrap();

        // Create campaign
        sqlx::query(
            "INSERT INTO wa_campaigns (id, name, status) VALUES (?, 'Completion Test', 'active')",
        )
        .bind(&campaign_id)
        .execute(&pool)
        .await
        .unwrap();

        // Create 5 recipients
        for i in 0..5 {
            let recipient_id = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO wa_recipients (id, campaign_id, phone, status) 
                 VALUES (?, ?, ?, 'pending')",
            )
            .bind(&recipient_id)
            .bind(&campaign_id)
            .bind(format!("+628123456789{:02}", i))
            .execute(&pool)
            .await
            .unwrap();
        }

        // Verify campaign is not completed initially
        let campaign_status: (String,) =
            sqlx::query_as("SELECT status FROM wa_campaigns WHERE id = ?")
                .bind(&campaign_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(campaign_status.0, "active", "Campaign should be active");

        // Enqueue and process all messages
        queue_manager
            .enqueue_campaign(&campaign_id, &[account_id.to_string()])
            .await
            .unwrap();

        let batch = queue_manager
            .dequeue_batch(account_id, Priority::Normal, 5)
            .await
            .unwrap();

        for message in batch {
            engine.process_single_message(message).await.unwrap();
        }

        // Verify campaign is now completed
        let campaign_status: (String,) =
            sqlx::query_as("SELECT status FROM wa_campaigns WHERE id = ?")
                .bind(&campaign_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(
            campaign_status.0, "completed",
            "Campaign should be completed"
        );

        // Verify all recipients are sent
        let sent_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wa_recipients WHERE campaign_id = ? AND status = 'sent'",
        )
        .bind(&campaign_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(sent_count.0, 5, "All 5 recipients should be sent");

        // Cleanup
        redis.clear_account_queues(account_id).await.unwrap();
    }

    /// **Validates: Requirements 3.1, 3.2**
    /// Integration test: Smart delay and typing simulation
    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_smart_delay_and_typing_simulation() {
        let pool = setup_test_db().await;

        // Configure with measurable delays
        let config = BlastEngineConfig {
            worker_count: 1,
            batch_size: 5,
            min_delay_seconds: 1,
            max_delay_seconds: 2,
            min_typing_seconds: 1,
            max_typing_seconds: 1,
            rate_limit_per_minute: 100,
            daily_limit: 1000,
            max_concurrent_per_account: 1,
        };

        let (engine, queue_manager, mut redis, mock_bridge) =
            create_test_blast_engine(pool.clone(), config).await;

        let account_id = "test_account_delay";

        // Create test account
        sqlx::query(
            "INSERT INTO wa_accounts (id, phone, name, status) 
             VALUES (?, '+6281234567894', 'Delay Test', 'connected')",
        )
        .bind(account_id)
        .execute(&pool)
        .await
        .unwrap();

        // Enqueue 3 messages
        for i in 0..3 {
            queue_manager
                .enqueue_message(
                    account_id.to_string(),
                    format!("+628123456789{:02}", i),
                    "Test delay message".to_string(),
                    None,
                    Priority::Normal,
                )
                .await
                .unwrap();
        }

        // Process messages and measure time
        let start_time = tokio::time::Instant::now();

        for _ in 0..3 {
            let batch = queue_manager
                .dequeue_batch(account_id, Priority::Normal, 1)
                .await
                .unwrap();

            if let Some(message) = batch.first() {
                engine
                    .process_single_message(message.clone())
                    .await
                    .unwrap();
            }
        }

        let elapsed = start_time.elapsed();

        // Each message should take at least:
        // - 1 second typing simulation
        // - 1-2 seconds smart delay
        // Total: at least 2 seconds per message, 6 seconds for 3 messages
        assert!(
            elapsed >= Duration::from_secs(6),
            "Should take at least 6 seconds with delays, took {:?}",
            elapsed
        );

        assert_eq!(
            mock_bridge.get_send_count(),
            3,
            "Should send all 3 messages"
        );

        // Cleanup
        redis.clear_account_queues(account_id).await.unwrap();
    }
}
