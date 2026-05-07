/**
 * Bomber Feature - Repeated Message Sending with Cooldown Protection
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8**
 * 
 * This module implements the bomber feature for testing purposes:
 * - Send message to single recipient multiple times
 * - Configurable repeat count (max 50) and interval (min 10s)
 * - Cooldown protection: 1 hour per target phone
 * - Admin override for cooldown
 * - Permission check: wa_bomber permission required
 * - Execution logging to wa_bomber_logs table
 */

use crate::bridge::BridgeClient;
use crate::response::AppError;
use chrono::{Duration, Utc};
use redis::{aio::ConnectionManager, AsyncCommands};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::time::sleep;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Bomber configuration request
#[derive(Debug, Clone, Deserialize)]
pub struct BomberRequest {
    pub account_id: String,
    pub target_phone: String,
    pub message: String,
    pub repeat_count: u32,
    pub interval_seconds: u64,
    #[serde(default)]
    pub override_cooldown: bool,
}

/// Bomber execution response
#[derive(Debug, Clone, Serialize)]
pub struct BomberResponse {
    pub bomber_id: String,
    pub account_id: String,
    pub target_phone: String,
    pub repeat_count: u32,
    pub interval_seconds: u64,
    pub estimated_completion_time: String, // ISO8601
}

/// Cooldown error response
#[derive(Debug, Clone, Serialize)]
pub struct CooldownErrorResponse {
    pub target_phone: String,
    pub cooldown_expires_at: String, // ISO8601
    pub remaining_seconds: i64,
}

/// Bomber engine for executing repeated message sends
pub struct BomberEngine {
    pool: SqlitePool,
    bridge_client: Arc<BridgeClient>,
    redis_conn: ConnectionManager,
}

impl BomberEngine {
    /// Create a new BomberEngine
    pub fn new(
        pool: SqlitePool,
        bridge_client: Arc<BridgeClient>,
        redis_conn: ConnectionManager,
    ) -> Self {
        Self {
            pool,
            bridge_client,
            redis_conn,
        }
    }

    /// Validate bomber configuration
    /// **Validates: Requirements 8.2, 8.3**
    pub fn validate_config(config: &BomberRequest) -> Result<(), AppError> {
        // Validate repeat count (max 50)
        if config.repeat_count == 0 {
            return Err(AppError::Validation {
                errors: vec!["Repeat count must be at least 1".to_string()],
            });
        }

        if config.repeat_count > 50 {
            return Err(AppError::Validation {
                errors: vec!["Repeat count cannot exceed 50".to_string()],
            });
        }

        // Validate interval (min 10 seconds)
        if config.interval_seconds < 10 {
            return Err(AppError::Validation {
                errors: vec!["Interval must be at least 10 seconds".to_string()],
            });
        }

        // Validate phone number format (E.164)
        let phone = config.target_phone.trim();
        let re = regex::Regex::new(r"^\+[1-9]\d{1,14}$").unwrap();
        if !re.is_match(phone) {
            return Err(AppError::Validation {
                errors: vec![
                    "Invalid phone number format. Must be in E.164 format (e.g., +6281234567890)"
                        .to_string(),
                ],
            });
        }

        // Validate message not empty
        if config.message.trim().is_empty() {
            return Err(AppError::Validation {
                errors: vec!["Message cannot be empty".to_string()],
            });
        }

        Ok(())
    }

    /// Check cooldown for target phone
    /// **Validates: Requirements 8.4, 8.5**
    pub async fn check_cooldown(
        &mut self,
        target_phone: &str,
    ) -> Result<Option<CooldownErrorResponse>, AppError> {
        let cooldown_key = format!("bomber:cooldown:{}", target_phone);

        // Check if cooldown exists in Redis
        let ttl: i64 = self
            .redis_conn
            .ttl(&cooldown_key)
            .await
            .map_err(|e| {
                error!("Redis error checking cooldown: {}", e);
                AppError::Internal
            })?;

        if ttl > 0 {
            // Cooldown is active
            let cooldown_expires_at = Utc::now() + Duration::seconds(ttl);

            debug!(
                "Cooldown active for {}: {} seconds remaining",
                target_phone, ttl
            );

            Ok(Some(CooldownErrorResponse {
                target_phone: target_phone.to_string(),
                cooldown_expires_at: cooldown_expires_at.to_rfc3339(),
                remaining_seconds: ttl,
            }))
        } else {
            // No cooldown or expired
            Ok(None)
        }
    }

    /// Set cooldown for target phone (1 hour)
    /// **Validates: Requirements 8.4**
    async fn set_cooldown(&mut self, target_phone: &str) -> Result<(), AppError> {
        let cooldown_key = format!("bomber:cooldown:{}", target_phone);
        const COOLDOWN_SECONDS: u64 = 3600; // 1 hour

        self.redis_conn
            .set_ex::<_, _, ()>(&cooldown_key, "1", COOLDOWN_SECONDS)
            .await
            .map_err(|e| {
                error!("Redis error setting cooldown: {}", e);
                AppError::Internal
            })?;

        debug!("Set cooldown for {} (1 hour)", target_phone);
        Ok(())
    }

    /// Execute bomber (send message N times with interval delay)
    /// **Validates: Requirements 8.1, 8.2, 8.3, 8.6**
    pub async fn execute_bomber(
        &mut self,
        config: BomberRequest,
        user_id: String,
        is_admin: bool,
    ) -> Result<BomberResponse, AppError> {
        // Validate configuration
        Self::validate_config(&config)?;

        // Check if account exists and is connected
        let account: Option<(String, String)> = sqlx::query_as(
            "SELECT id, status FROM wa_accounts WHERE id = ?",
        )
        .bind(&config.account_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("Database error checking account: {}", e);
            AppError::Internal
        })?;

        let (account_id, status) = account.ok_or_else(|| {
            warn!("Invalid account_id: {}", config.account_id);
            AppError::Validation {
                errors: vec!["Account not found".to_string()],
            }
        })?;

        if status != "connected" {
            warn!(
                "Account {} is not connected (status: {})",
                account_id, status
            );
            return Err(AppError::Validation {
                errors: vec![format!(
                    "Account is {} (must be connected)",
                    status
                )],
            });
        }

        // Check cooldown (unless admin override)
        if !config.override_cooldown || !is_admin {
            if let Some(cooldown_error) = self.check_cooldown(&config.target_phone).await? {
                // Return cooldown error
                return Err(AppError::CooldownActive {
                    target_phone: cooldown_error.target_phone,
                    cooldown_expires_at: cooldown_error.cooldown_expires_at,
                    remaining_seconds: cooldown_error.remaining_seconds,
                });
            }
        } else {
            info!(
                "Admin override: skipping cooldown check for {}",
                config.target_phone
            );
        }

        // Generate bomber ID
        let bomber_id = Uuid::new_v4().to_string();

        // Log bomber execution to database
        sqlx::query(
            "INSERT INTO wa_bomber_logs (id, account_id, target_phone, message, repeat_count, executed_by) 
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&bomber_id)
        .bind(&account_id)
        .bind(&config.target_phone)
        .bind(&config.message)
        .bind(config.repeat_count as i64)
        .bind(&user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            error!("Database error logging bomber execution: {}", e);
            AppError::Internal
        })?;

        info!(
            "Bomber execution logged: {} (account: {}, target: {}, count: {})",
            bomber_id, account_id, config.target_phone, config.repeat_count
        );

        // Calculate estimated completion time
        let total_duration_seconds =
            (config.repeat_count as u64 - 1) * config.interval_seconds;
        let estimated_completion_time =
            Utc::now() + Duration::seconds(total_duration_seconds as i64);

        // Spawn async task to execute bomber
        let pool = self.pool.clone();
        let bridge_client = Arc::clone(&self.bridge_client);
        let mut redis_conn = self.redis_conn.clone();
        let config_clone = config.clone();

        tokio::spawn(async move {
            if let Err(e) = Self::execute_bomber_task(
                pool,
                bridge_client,
                &mut redis_conn,
                config_clone,
            )
            .await
            {
                error!("Bomber execution task failed: {}", e);
            }
        });

        // Set cooldown after spawning task
        self.set_cooldown(&config.target_phone).await?;

        Ok(BomberResponse {
            bomber_id,
            account_id,
            target_phone: config.target_phone,
            repeat_count: config.repeat_count,
            interval_seconds: config.interval_seconds,
            estimated_completion_time: estimated_completion_time.to_rfc3339(),
        })
    }

    /// Execute bomber task (async background task)
    /// **Validates: Requirements 8.1, 8.2, 8.3**
    async fn execute_bomber_task(
        _pool: SqlitePool,
        bridge_client: Arc<BridgeClient>,
        _redis_conn: &mut ConnectionManager,
        config: BomberRequest,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(
            "Starting bomber execution: {} messages to {} with {}s interval",
            config.repeat_count, config.target_phone, config.interval_seconds
        );

        let mut success_count = 0;
        let mut failure_count = 0;

        for i in 0..config.repeat_count {
            debug!(
                "Bomber iteration {}/{} for {}",
                i + 1,
                config.repeat_count,
                config.target_phone
            );

            // Send message via bridge
            let params = serde_json::json!({
                "phone": config.target_phone,
                "message": config.message,
            });

            match bridge_client
                .send_request(&config.account_id, "send_message".to_string(), params)
                .await
            {
                Ok(_) => {
                    success_count += 1;
                    info!(
                        "Bomber message sent {}/{} to {}",
                        i + 1,
                        config.repeat_count,
                        config.target_phone
                    );
                }
                Err(e) => {
                    failure_count += 1;
                    error!(
                        "Bomber message failed {}/{} to {}: {}",
                        i + 1,
                        config.repeat_count,
                        config.target_phone,
                        e
                    );
                    // Continue with remaining messages even if one fails
                }
            }

            // Sleep for interval (except after last message)
            if i < config.repeat_count - 1 {
                sleep(std::time::Duration::from_secs(config.interval_seconds)).await;
            }
        }

        info!(
            "Bomber execution completed for {}: {} success, {} failures",
            config.target_phone, success_count, failure_count
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_config_valid() {
        let config = BomberRequest {
            account_id: "account-123".to_string(),
            target_phone: "+6281234567890".to_string(),
            message: "Test message".to_string(),
            repeat_count: 10,
            interval_seconds: 15,
            override_cooldown: false,
        };

        assert!(BomberEngine::validate_config(&config).is_ok());
    }

    #[test]
    fn test_validate_config_repeat_count_zero() {
        let config = BomberRequest {
            account_id: "account-123".to_string(),
            target_phone: "+6281234567890".to_string(),
            message: "Test message".to_string(),
            repeat_count: 0,
            interval_seconds: 15,
            override_cooldown: false,
        };

        assert!(BomberEngine::validate_config(&config).is_err());
    }

    #[test]
    fn test_validate_config_repeat_count_exceeds_max() {
        let config = BomberRequest {
            account_id: "account-123".to_string(),
            target_phone: "+6281234567890".to_string(),
            message: "Test message".to_string(),
            repeat_count: 51,
            interval_seconds: 15,
            override_cooldown: false,
        };

        assert!(BomberEngine::validate_config(&config).is_err());
    }

    #[test]
    fn test_validate_config_interval_too_short() {
        let config = BomberRequest {
            account_id: "account-123".to_string(),
            target_phone: "+6281234567890".to_string(),
            message: "Test message".to_string(),
            repeat_count: 10,
            interval_seconds: 5,
            override_cooldown: false,
        };

        assert!(BomberEngine::validate_config(&config).is_err());
    }

    #[test]
    fn test_validate_config_invalid_phone() {
        let config = BomberRequest {
            account_id: "account-123".to_string(),
            target_phone: "081234567890".to_string(), // Missing +
            message: "Test message".to_string(),
            repeat_count: 10,
            interval_seconds: 15,
            override_cooldown: false,
        };

        assert!(BomberEngine::validate_config(&config).is_err());
    }

    #[test]
    fn test_validate_config_empty_message() {
        let config = BomberRequest {
            account_id: "account-123".to_string(),
            target_phone: "+6281234567890".to_string(),
            message: "   ".to_string(),
            repeat_count: 10,
            interval_seconds: 15,
            override_cooldown: false,
        };

        assert!(BomberEngine::validate_config(&config).is_err());
    }
}
