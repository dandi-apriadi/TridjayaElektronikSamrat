/**
 * Webhook Forwarder - Forward incoming WhatsApp messages to N8N
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8**
 *
 * This module implements the webhook forwarding system that:
 * - Handles incoming message events from Baileys bridge
 * - Constructs JSON payloads with message metadata
 * - Generates HMAC-SHA256 signatures for authentication
 * - Sends HTTP POST requests with timeout (10 seconds)
 * - Implements retry logic with exponential backoff (2s, 6s, 18s)
 * - Logs webhook delivery to wa_webhook_logs table
 * - Batches messages in 500ms window for efficiency
 */
use crate::bridge::BridgeEvent;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use tokio::time::{sleep, Instant};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Webhook configuration
#[derive(Debug, Clone, Deserialize)]
pub struct WebhookConfig {
    pub id: String,
    pub account_id: String,
    pub webhook_url: String,
    pub secret_key: String,
    pub enabled: bool,
    pub retry_config: Option<String>, // JSON: {max_retries, backoff_multiplier, timeout_ms}
}

/// Retry configuration
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub backoff_multiplier: f64,
    pub timeout_ms: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            backoff_multiplier: 3.0, // 2s, 6s, 18s
            timeout_ms: 10000,       // 10 seconds
        }
    }
}

/// Incoming message payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomingMessage {
    pub sender: String,
    pub message: String,
    pub timestamp: String, // ISO8601
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,
    pub message_id: String,
    pub account_id: String,
}

/// Batched messages payload
#[derive(Debug, Clone, Serialize)]
pub struct BatchedMessagesPayload {
    pub messages: Vec<IncomingMessage>,
    pub batch_size: usize,
    pub batch_timestamp: String, // ISO8601
}

/// Webhook forwarder configuration
#[derive(Debug, Clone)]
pub struct WebhookForwarderConfig {
    /// Message batching window in milliseconds (default: 500ms)
    pub batch_window_ms: u64,
    /// HTTP client timeout in seconds (default: 10s)
    pub http_timeout_seconds: u64,
    /// Maximum retry attempts (default: 3)
    pub max_retries: u32,
    /// Initial retry delay in seconds (default: 2s)
    pub initial_retry_delay_seconds: u64,
    /// Retry backoff multiplier (default: 3.0 for 2s, 6s, 18s)
    pub retry_backoff_multiplier: f64,
}

impl Default for WebhookForwarderConfig {
    fn default() -> Self {
        Self {
            batch_window_ms: 500,
            http_timeout_seconds: 10,
            max_retries: 3,
            initial_retry_delay_seconds: 2,
            retry_backoff_multiplier: 3.0,
        }
    }
}

/// Webhook forwarder
pub struct WebhookForwarder {
    config: WebhookForwarderConfig,
    pool: SqlitePool,
    http_client: Client,
    /// Message batch buffer per account
    batch_buffer: Arc<Mutex<HashMap<String, Vec<IncomingMessage>>>>,
    /// Last batch send time per account
    last_batch_time: Arc<Mutex<HashMap<String, Instant>>>,
}

impl WebhookForwarder {
    /// Create a new webhook forwarder
    pub fn new(config: WebhookForwarderConfig, pool: SqlitePool) -> Self {
        let http_client = Client::builder()
            .timeout(Duration::from_secs(config.http_timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            pool,
            http_client,
            batch_buffer: Arc::new(Mutex::new(HashMap::new())),
            last_batch_time: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Start the webhook forwarder event loop
    ///
    /// **Validates: Requirements 5.1, 5.8**
    pub async fn start(&self, mut event_rx: mpsc::UnboundedReceiver<BridgeEvent>) {
        info!("Starting Webhook Forwarder");

        // Spawn batch flusher task
        let forwarder = self.clone_for_task();
        tokio::spawn(async move {
            forwarder.batch_flusher_loop().await;
        });

        // Process incoming events
        while let Some(event) = event_rx.recv().await {
            if event.event_type == "message_received" {
                if let Err(e) = self.handle_incoming_message(event).await {
                    error!("Error handling incoming message: {}", e);
                }
            }
        }

        info!("Webhook Forwarder stopped");
    }

    /// Clone forwarder for async task
    fn clone_for_task(&self) -> Self {
        Self {
            config: self.config.clone(),
            pool: self.pool.clone(),
            http_client: self.http_client.clone(),
            batch_buffer: Arc::clone(&self.batch_buffer),
            last_batch_time: Arc::clone(&self.last_batch_time),
        }
    }

    /// Handle incoming message event
    ///
    /// **Validates: Requirements 5.1, 5.2, 5.8**
    async fn handle_incoming_message(
        &self,
        event: BridgeEvent,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        debug!(
            session_id = %event.session_id,
            event_type = %event.event_type,
            "Handling incoming message event"
        );

        // Parse event data
        let sender = event.data["sender"]
            .as_str()
            .ok_or("Missing sender field")?
            .to_string();

        let message_text = event.data["message"]
            .as_str()
            .ok_or("Missing message field")?
            .to_string();

        let media_url = event.data["media_url"].as_str().map(|s| s.to_string());

        // Construct incoming message payload (Requirement 5.2)
        let incoming_message = IncomingMessage {
            sender,
            message: message_text,
            timestamp: chrono::Utc::now().to_rfc3339(),
            media_url,
            message_id: Uuid::new_v4().to_string(),
            account_id: event.session_id.clone(),
        };

        // Add to batch buffer (Requirement 5.8)
        {
            let mut buffer = self.batch_buffer.lock().await;
            buffer
                .entry(event.session_id.clone())
                .or_insert_with(Vec::new)
                .push(incoming_message);
        }

        // Update last batch time
        {
            let mut last_time = self.last_batch_time.lock().await;
            last_time.insert(event.session_id.clone(), Instant::now());
        }

        Ok(())
    }

    /// Batch flusher loop - sends batched messages after window expires
    ///
    /// **Validates: Requirements 5.8**
    async fn batch_flusher_loop(&self) {
        let batch_window = Duration::from_millis(self.config.batch_window_ms);

        loop {
            sleep(Duration::from_millis(100)).await; // Check every 100ms

            let accounts_to_flush = {
                let last_time = self.last_batch_time.lock().await;
                let now = Instant::now();

                last_time
                    .iter()
                    .filter(|(_, &last)| now.duration_since(last) >= batch_window)
                    .map(|(account_id, _)| account_id.clone())
                    .collect::<Vec<_>>()
            };

            for account_id in accounts_to_flush {
                if let Err(e) = self.flush_batch(&account_id).await {
                    error!("Error flushing batch for account {}: {}", account_id, e);
                }
            }
        }
    }

    /// Flush batched messages for an account
    ///
    /// **Validates: Requirements 5.1, 5.2, 5.8**
    async fn flush_batch(
        &self,
        account_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Extract messages from buffer
        let messages = {
            let mut buffer = self.batch_buffer.lock().await;
            buffer.remove(account_id).unwrap_or_default()
        };

        if messages.is_empty() {
            return Ok(());
        }

        // Remove from last_batch_time
        {
            let mut last_time = self.last_batch_time.lock().await;
            last_time.remove(account_id);
        }

        debug!(
            account_id = %account_id,
            message_count = messages.len(),
            "Flushing message batch"
        );

        // Fetch webhook config for account
        let webhook_config = self.fetch_webhook_config(account_id).await?;

        if !webhook_config.enabled {
            debug!(
                account_id = %account_id,
                "Webhook disabled for account, skipping"
            );
            return Ok(());
        }

        // Construct batched payload
        let payload = BatchedMessagesPayload {
            messages: messages.clone(),
            batch_size: messages.len(),
            batch_timestamp: chrono::Utc::now().to_rfc3339(),
        };

        // Send webhook with retry logic
        self.send_webhook_with_retry(&webhook_config, payload)
            .await?;

        Ok(())
    }

    /// Fetch webhook configuration for account
    async fn fetch_webhook_config(
        &self,
        account_id: &str,
    ) -> Result<WebhookConfig, Box<dyn std::error::Error + Send + Sync>> {
        let config: Option<(String, String, String, String, bool, Option<String>)> =
            sqlx::query_as(
                "SELECT id, account_id, webhook_url, secret_key, enabled, retry_config 
             FROM wa_webhooks 
             WHERE account_id = ? AND enabled = 1 
             LIMIT 1",
            )
            .bind(account_id)
            .fetch_optional(&self.pool)
            .await?;

        if let Some((id, account_id, webhook_url, secret_key, enabled, retry_config)) = config {
            Ok(WebhookConfig {
                id,
                account_id,
                webhook_url,
                secret_key,
                enabled,
                retry_config,
            })
        } else {
            Err(format!("No enabled webhook found for account {}", account_id).into())
        }
    }

    /// Send webhook with retry logic
    ///
    /// **Validates: Requirements 5.3, 5.4, 5.5, 5.6**
    async fn send_webhook_with_retry(
        &self,
        webhook_config: &WebhookConfig,
        payload: BatchedMessagesPayload,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let retry_config = if let Some(ref config_json) = webhook_config.retry_config {
            serde_json::from_str::<RetryConfig>(config_json).unwrap_or_default()
        } else {
            RetryConfig::default()
        };

        let mut attempt = 1;
        let max_attempts = retry_config.max_retries + 1; // Initial attempt + retries

        loop {
            match self
                .send_webhook_attempt(webhook_config, &payload, attempt)
                .await
            {
                Ok(response_status) => {
                    info!(
                        webhook_id = %webhook_config.id,
                        account_id = %webhook_config.account_id,
                        attempt = attempt,
                        status = response_status,
                        "Webhook delivered successfully"
                    );

                    // Log success
                    self.log_webhook_delivery(
                        &webhook_config.id,
                        &payload,
                        Some(response_status),
                        None,
                        None,
                        attempt,
                    )
                    .await?;

                    return Ok(());
                }
                Err(e) => {
                    error!(
                        webhook_id = %webhook_config.id,
                        account_id = %webhook_config.account_id,
                        attempt = attempt,
                        error = %e,
                        "Webhook delivery failed"
                    );

                    // Log failure
                    self.log_webhook_delivery(
                        &webhook_config.id,
                        &payload,
                        None,
                        None,
                        Some(&e.to_string()),
                        attempt,
                    )
                    .await?;

                    if attempt >= max_attempts {
                        error!(
                            webhook_id = %webhook_config.id,
                            max_attempts = max_attempts,
                            "Max retry attempts exceeded"
                        );
                        return Err(format!(
                            "Webhook delivery failed after {} attempts: {}",
                            max_attempts, e
                        )
                        .into());
                    }

                    // Calculate exponential backoff delay (Requirement 5.5)
                    let delay_seconds = self.config.initial_retry_delay_seconds as f64
                        * self
                            .config
                            .retry_backoff_multiplier
                            .powi((attempt - 1) as i32);

                    warn!(
                        webhook_id = %webhook_config.id,
                        attempt = attempt,
                        next_attempt = attempt + 1,
                        delay_seconds = delay_seconds,
                        "Retrying webhook delivery"
                    );

                    sleep(Duration::from_secs_f64(delay_seconds)).await;
                    attempt += 1;
                }
            }
        }
    }

    /// Send single webhook attempt
    ///
    /// **Validates: Requirements 5.2, 5.3, 5.4**
    async fn send_webhook_attempt(
        &self,
        webhook_config: &WebhookConfig,
        payload: &BatchedMessagesPayload,
        attempt: u32,
    ) -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
        // Serialize payload to JSON
        let payload_json = serde_json::to_string(payload)?;

        // Generate HMAC-SHA256 signature (Requirement 5.3)
        let signature = self.generate_hmac_signature(&payload_json, &webhook_config.secret_key);

        debug!(
            webhook_id = %webhook_config.id,
            url = %webhook_config.webhook_url,
            attempt = attempt,
            payload_size = payload_json.len(),
            "Sending webhook HTTP POST"
        );

        // Send HTTP POST with timeout (Requirement 5.4)
        let response = self
            .http_client
            .post(&webhook_config.webhook_url)
            .header("Content-Type", "application/json")
            .header("X-Webhook-Signature", signature)
            .header("X-Webhook-Attempt", attempt.to_string())
            .body(payload_json)
            .send()
            .await?;

        let status = response.status().as_u16();

        if response.status().is_success() {
            Ok(status)
        } else {
            let error_body = response.text().await.unwrap_or_default();
            Err(format!("HTTP {} - {}", status, error_body).into())
        }
    }

    /// Generate HMAC-SHA256 signature for webhook authentication
    ///
    /// **Validates: Requirements 5.3**
    fn generate_hmac_signature(&self, payload: &str, secret_key: &str) -> String {
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;

        let mut mac = HmacSha256::new_from_slice(secret_key.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(payload.as_bytes());

        let result = mac.finalize();
        let code_bytes = result.into_bytes();

        // Encode as hex string
        hex::encode(code_bytes)
    }

    /// Log webhook delivery to database
    ///
    /// **Validates: Requirements 5.6**
    async fn log_webhook_delivery(
        &self,
        webhook_id: &str,
        payload: &BatchedMessagesPayload,
        response_status: Option<u16>,
        response_body: Option<&str>,
        error_message: Option<&str>,
        attempt_number: u32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let log_id = Uuid::new_v4().to_string();
        let payload_json = serde_json::to_string(payload)?;

        sqlx::query(
            "INSERT INTO wa_webhook_logs 
             (id, webhook_id, payload, response_status, response_body, attempt_number, error_message, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(&log_id)
        .bind(webhook_id)
        .bind(&payload_json)
        .bind(response_status.map(|s| s as i32))
        .bind(response_body)
        .bind(attempt_number as i32)
        .bind(error_message)
        .execute(&self.pool)
        .await?;

        debug!(
            log_id = %log_id,
            webhook_id = %webhook_id,
            attempt = attempt_number,
            "Logged webhook delivery"
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper function to generate HMAC-SHA256 signature
    fn generate_test_signature(payload: &str, secret: &str) -> String {
        use hmac::{Hmac, Mac};
        type HmacSha256 = Hmac<Sha256>;

        let mut mac =
            HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
        mac.update(payload.as_bytes());

        let result = mac.finalize();
        let code_bytes = result.into_bytes();
        hex::encode(code_bytes)
    }

    /// Helper function to verify HMAC-SHA256 signature
    fn verify_test_signature(payload: &str, secret: &str, signature: &str) -> bool {
        let expected_signature = generate_test_signature(payload, secret);
        expected_signature == signature
    }

    // ============================================================================
    // Task 14.1: Comprehensive unit tests for webhook signature functionality
    // ============================================================================

    /// Test HMAC-SHA256 signature generation
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_generation() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);

        // Signature should be a 64-character hex string (SHA256 = 32 bytes = 64 hex chars)
        assert_eq!(
            signature.len(),
            64,
            "HMAC-SHA256 signature should be 64 hex characters"
        );
        assert!(
            signature.chars().all(|c| c.is_ascii_hexdigit()),
            "Signature should only contain hex digits"
        );
    }

    /// Test signature generation is deterministic
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_deterministic() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        // Same input should produce same signature
        let signature1 = generate_test_signature(payload, secret);
        let signature2 = generate_test_signature(payload, secret);

        assert_eq!(
            signature1, signature2,
            "Same payload and secret should produce identical signatures"
        );
    }

    /// Test signature generation with different secrets produces different signatures
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_different_secrets() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret1 = "test_secret_key";
        let secret2 = "different_secret";

        let signature1 = generate_test_signature(payload, secret1);
        let signature2 = generate_test_signature(payload, secret2);

        assert_ne!(
            signature1, signature2,
            "Different secrets should produce different signatures"
        );
    }

    /// Test signature generation with different payloads produces different signatures
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_different_payloads() {
        let payload1 = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let payload2 = r#"{"messages":[{"sender":"0987654321","message":"different"}]}"#;
        let secret = "test_secret_key";

        let signature1 = generate_test_signature(payload1, secret);
        let signature2 = generate_test_signature(payload2, secret);

        assert_ne!(
            signature1, signature2,
            "Different payloads should produce different signatures"
        );
    }

    /// Test signature generation with empty payload
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_empty_payload() {
        let payload = "";
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);

        assert_eq!(
            signature.len(),
            64,
            "Empty payload should still produce valid 64-char signature"
        );
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }

    /// Test signature generation with special characters in payload
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_special_characters() {
        let payload = r#"{"message":"Hello 世界! 🌍 \n\t\r"}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);

        assert_eq!(
            signature.len(),
            64,
            "Payload with special characters should produce valid signature"
        );
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }

    /// Test signature generation with very long payload
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_long_payload() {
        let long_message = "A".repeat(10000);
        let payload = format!(r#"{{"message":"{}"}}"#, long_message);
        let secret = "test_secret_key";

        let signature = generate_test_signature(&payload, secret);

        assert_eq!(
            signature.len(),
            64,
            "Long payload should produce valid 64-char signature"
        );
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }

    /// Test signature generation with very long secret key
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_hmac_signature_long_secret() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let long_secret = "x".repeat(1000);

        let signature = generate_test_signature(payload, &long_secret);

        assert_eq!(
            signature.len(),
            64,
            "Long secret should produce valid 64-char signature"
        );
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }

    // ============================================================================
    // Signature Verification Tests
    // ============================================================================

    /// Test signature verification with valid signature
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_valid() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);
        let is_valid = verify_test_signature(payload, secret, &signature);

        assert!(is_valid, "Valid signature should verify successfully");
    }

    /// Test signature verification with invalid signature
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_invalid() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";
        let invalid_signature = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

        let is_valid = verify_test_signature(payload, secret, invalid_signature);

        assert!(!is_valid, "Invalid signature should fail verification");
    }

    /// Test signature verification with tampered payload
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_tampered_payload() {
        let original_payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let tampered_payload = r#"{"messages":[{"sender":"1234567890","message":"hacked"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(original_payload, secret);
        let is_valid = verify_test_signature(tampered_payload, secret, &signature);

        assert!(
            !is_valid,
            "Signature should fail verification when payload is tampered"
        );
    }

    /// Test signature verification with wrong secret
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_wrong_secret() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let correct_secret = "test_secret_key";
        let wrong_secret = "wrong_secret_key";

        let signature = generate_test_signature(payload, correct_secret);
        let is_valid = verify_test_signature(payload, wrong_secret, &signature);

        assert!(
            !is_valid,
            "Signature should fail verification with wrong secret"
        );
    }

    /// Test signature verification with malformed signature (wrong length)
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_malformed_length() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";
        let malformed_signature = "abc123"; // Too short

        let is_valid = verify_test_signature(payload, secret, malformed_signature);

        assert!(
            !is_valid,
            "Malformed signature (wrong length) should fail verification"
        );
    }

    /// Test signature verification with non-hex characters
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_non_hex() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";
        let non_hex_signature = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

        let is_valid = verify_test_signature(payload, secret, non_hex_signature);

        assert!(
            !is_valid,
            "Signature with non-hex characters should fail verification"
        );
    }

    /// Test signature verification with empty signature
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_empty() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";
        let empty_signature = "";

        let is_valid = verify_test_signature(payload, secret, empty_signature);

        assert!(!is_valid, "Empty signature should fail verification");
    }

    /// Test signature verification is case-sensitive
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_signature_verification_case_sensitive() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);
        let uppercase_signature = signature.to_uppercase();

        // Our implementation uses lowercase hex, so uppercase should fail
        let is_valid = verify_test_signature(payload, secret, &uppercase_signature);

        assert!(!is_valid, "Signature verification should be case-sensitive");
    }

    // ============================================================================
    // Invalid Signature Handling Tests
    // ============================================================================

    /// Test handling of null/missing signature scenario
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_invalid_signature_handling_missing() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        // Simulate missing signature by using empty string
        let is_valid = verify_test_signature(payload, secret, "");

        assert!(!is_valid, "Missing signature should be treated as invalid");
    }

    /// Test handling of signature with whitespace
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_invalid_signature_handling_whitespace() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);
        let signature_with_whitespace = format!("  {}  ", signature);

        // Signature with whitespace should fail (no trimming)
        let is_valid = verify_test_signature(payload, secret, &signature_with_whitespace);

        assert!(
            !is_valid,
            "Signature with whitespace should fail verification"
        );
    }

    /// Test handling of signature with prefix
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_invalid_signature_handling_prefix() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);
        let signature_with_prefix = format!("sha256={}", signature);

        // Signature with prefix should fail
        let is_valid = verify_test_signature(payload, secret, &signature_with_prefix);

        assert!(!is_valid, "Signature with prefix should fail verification");
    }

    /// Test handling of truncated signature
    /// **Validates: Requirements 5.3**
    #[test]
    fn test_invalid_signature_handling_truncated() {
        let payload = r#"{"messages":[{"sender":"1234567890","message":"test"}]}"#;
        let secret = "test_secret_key";

        let signature = generate_test_signature(payload, secret);
        let truncated_signature = &signature[..32]; // Only first half

        let is_valid = verify_test_signature(payload, secret, truncated_signature);

        assert!(!is_valid, "Truncated signature should fail verification");
    }

    // ============================================================================
    // Existing Tests (Retained)
    // ============================================================================

    #[test]
    fn test_retry_config_default() {
        let config = RetryConfig::default();
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.backoff_multiplier, 3.0);
        assert_eq!(config.timeout_ms, 10000);
    }

    #[test]
    fn test_incoming_message_serialization() {
        let message = IncomingMessage {
            sender: "1234567890".to_string(),
            message: "Hello World".to_string(),
            timestamp: "2026-05-05T12:00:00Z".to_string(),
            media_url: Some("https://example.com/media.jpg".to_string()),
            message_id: "msg-123".to_string(),
            account_id: "acc-456".to_string(),
        };

        let json = serde_json::to_string(&message).unwrap();
        assert!(json.contains("\"sender\":\"1234567890\""));
        assert!(json.contains("\"message\":\"Hello World\""));
        assert!(json.contains("\"media_url\":\"https://example.com/media.jpg\""));
    }

    #[test]
    fn test_batched_payload_serialization() {
        let messages = vec![
            IncomingMessage {
                sender: "1111111111".to_string(),
                message: "Message 1".to_string(),
                timestamp: "2026-05-05T12:00:00Z".to_string(),
                media_url: None,
                message_id: "msg-1".to_string(),
                account_id: "acc-1".to_string(),
            },
            IncomingMessage {
                sender: "2222222222".to_string(),
                message: "Message 2".to_string(),
                timestamp: "2026-05-05T12:00:01Z".to_string(),
                media_url: None,
                message_id: "msg-2".to_string(),
                account_id: "acc-1".to_string(),
            },
        ];

        let payload = BatchedMessagesPayload {
            messages,
            batch_size: 2,
            batch_timestamp: "2026-05-05T12:00:01Z".to_string(),
        };

        let json = serde_json::to_string(&payload).unwrap();
        assert!(json.contains("\"batch_size\":2"));
        assert!(json.contains("\"messages\":["));
    }
}
