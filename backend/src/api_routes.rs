use crate::{
    bomber::{BomberEngine, BomberRequest},
    campaign_metrics::calculate_campaign_metrics,
    redis_manager::Priority,
    response::{json_ok, AppError},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

/// Request payload for sending a message
/// **Validates: Requirements 9.6**
#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub account_id: String,
    pub target_phone: String,
    pub message: String,
    #[serde(default)]
    pub media_url: Option<String>,
    #[serde(default)]
    pub priority: Option<String>, // "high", "normal", "low"
}

/// Response payload for send message endpoint
/// **Validates: Requirements 9.5**
#[derive(Debug, Serialize)]
pub struct SendMessageResponse {
    pub message_id: String,
    pub estimated_send_time: String, // ISO8601 timestamp
}

/// API token record from database
#[derive(Debug, Clone, sqlx::FromRow)]
struct ApiTokenRecord {
    id: String,
    user_id: String,
    token_hash: String,
    name: String,
    permissions: Option<String>, // JSON array
    expires_at: Option<String>,
    last_used_at: Option<String>,
    token_prefix: Option<String>,
}

/// Verify API token from Authorization header
/// **Validates: Requirements 9.2, 9.3**
///
/// Extracts Bearer token, uses SHA-256 prefix for fast lookup, then verifies
/// Argon2id hash on the single matching row. Falls back to scanning legacy
/// tokens without a prefix.
async fn verify_api_token(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<ApiTokenRecord, AppError> {
    // Extract Bearer token
    let header_value = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = header_value
        .strip_prefix("Bearer ")
        .or_else(|| header_value.strip_prefix("bearer "))
        .ok_or(AppError::Unauthorized)?;

    if token.trim().is_empty() {
        return Err(AppError::Unauthorized);
    }

    let token = token.trim();
    let prefix = crate::api_tokens::compute_token_prefix(token);

    // Fast path: query by SHA-256 prefix (O(1) via index)
    let candidates: Vec<ApiTokenRecord> = sqlx::query_as(
        "SELECT id, user_id, token_hash, name, permissions, expires_at, last_used_at, token_prefix
         FROM wa_api_tokens
         WHERE token_prefix = ?
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
    )
    .bind(&prefix)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error fetching API tokens: {}", e);
        AppError::Internal
    })?;

    // Verify Argon2 hash only against the (typically 1) candidate(s)
    let mut matched_token: Option<ApiTokenRecord> = None;
    for token_record in &candidates {
        if crate::auth::verify_password(token, &token_record.token_hash) {
            matched_token = Some(token_record.clone());
            break;
        }
    }

    // Fallback: legacy tokens without prefix
    if matched_token.is_none() && candidates.is_empty() {
        let legacy_tokens: Vec<ApiTokenRecord> = sqlx::query_as(
            "SELECT id, user_id, token_hash, name, permissions, expires_at, last_used_at, token_prefix
             FROM wa_api_tokens
             WHERE token_prefix IS NULL
               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error fetching legacy API tokens: {}", e);
            AppError::Internal
        })?;

        for token_record in &legacy_tokens {
            if crate::auth::verify_password(token, &token_record.token_hash) {
                // Backfill prefix for this legacy token
                let _ = sqlx::query("UPDATE wa_api_tokens SET token_prefix = ? WHERE id = ?")
                    .bind(&prefix)
                    .bind(&token_record.id)
                    .execute(&state.pool)
                    .await;

                matched_token = Some(token_record.clone());
                break;
            }
        }
    }

    let token_record = matched_token.ok_or_else(|| {
        tracing::warn!("Invalid API token provided");
        AppError::Unauthorized
    })?;

    // Check expiration
    if let Some(expires_at_str) = &token_record.expires_at {
        let expires_at = chrono::DateTime::parse_from_rfc3339(expires_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now() - Duration::seconds(1));

        if expires_at < Utc::now() {
            tracing::warn!("Expired API token used: {}", token_record.id);
            return Err(AppError::Unauthorized);
        }
    }

    // Update last_used_at timestamp
    let _ = sqlx::query("UPDATE wa_api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(&token_record.id)
        .execute(&state.pool)
        .await;

    tracing::info!(
        "API token verified: {} (user: {})",
        token_record.name,
        token_record.user_id
    );

    Ok(token_record)
}

/// Check if API token has specific permission
/// **Validates: Requirements 8.8**
fn check_permission(token: &ApiTokenRecord, permission: &str) -> Result<(), AppError> {
    if let Some(permissions_json) = &token.permissions {
        if let Ok(permissions) = serde_json::from_str::<Vec<String>>(permissions_json) {
            if permissions.contains(&permission.to_string()) {
                return Ok(());
            }
        }
    }

    tracing::warn!(
        "Permission denied: token {} does not have '{}' permission",
        token.id,
        permission
    );
    Err(AppError::Forbidden)
}

/// Validate phone number format (E.164)
/// **Validates: Requirements 15.1**
fn validate_phone_number(phone: &str) -> Result<String, AppError> {
    let phone = phone.trim();

    // E.164 format: +[country code][number]
    // Example: +6281234567890
    let re = regex::Regex::new(r"^\+[1-9]\d{1,14}$").unwrap();

    if !re.is_match(phone) {
        return Err(AppError::Validation {
            errors: vec![
                "Invalid phone number format. Must be in E.164 format (e.g., +6281234567890)"
                    .to_string(),
            ],
        });
    }

    Ok(phone.to_string())
}

/// Sanitize message text
/// **Validates: Requirements 15.2**
fn sanitize_message(message: &str) -> String {
    // Remove control characters except newline, tab, and carriage return
    message
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t' || *c == '\r')
        .collect()
}

/// POST /api/wa/send - Send outbound message via N8N API
/// **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8**
///
/// This endpoint allows N8N workflows to send WhatsApp messages through the gateway.
///
/// Authentication: Bearer token (from wa_api_tokens table)
/// Rate limit: 100 requests per minute per API token
///
/// Request body:
/// - account_id: WhatsApp account to send from
/// - target_phone: Recipient phone number (E.164 format)
/// - message: Message text
/// - media_url: Optional media URL
/// - priority: Optional priority ("high", "normal", "low")
///
/// Response:
/// - message_id: Unique message identifier
/// - estimated_send_time: Estimated send time (within 500ms for high priority)
async fn send_message(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<SendMessageRequest>,
) -> Result<axum::response::Response, AppError> {
    // Verify API token
    let token_record = verify_api_token(&state, &headers).await?;

    // Check rate limit
    state.check_api_rate_limit(&token_record.id).await?;

    // Check if queue_manager is available
    let queue_manager = state.queue_manager.as_ref().ok_or_else(|| {
        tracing::error!("Queue manager not initialized");
        AppError::Internal
    })?;

    // Validate account_id exists and is connected
    let account: Option<(String, String)> =
        sqlx::query_as("SELECT id, status FROM wa_accounts WHERE id = ?")
            .bind(&payload.account_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Database error checking account: {}", e);
                AppError::Internal
            })?;

    let (account_id, status) = account.ok_or_else(|| {
        tracing::warn!("Invalid account_id: {}", payload.account_id);
        AppError::Validation {
            errors: vec!["invalid_account: Account not found".to_string()],
        }
    })?;

    if status != "connected" {
        tracing::warn!(
            "Account {} is not connected (status: {})",
            account_id,
            status
        );
        return Err(AppError::Validation {
            errors: vec![format!(
                "invalid_account: Account is {} (must be connected)",
                status
            )],
        });
    }

    // Validate phone number
    let target_phone = validate_phone_number(&payload.target_phone)?;

    // Sanitize message text
    let message_text = sanitize_message(&payload.message);

    if message_text.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Message text cannot be empty".to_string()],
        });
    }

    // Parse priority (default to high for API requests)
    let priority = match payload.priority.as_deref() {
        Some("low") => Priority::Low,
        Some("normal") => Priority::Normal,
        _ => Priority::High, // Default to high priority for API requests
    };

    // Enqueue message to Redis
    let message_id = queue_manager
        .enqueue_message(
            account_id.clone(),
            target_phone.clone(),
            message_text.clone(),
            payload.media_url.clone(),
            priority,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to enqueue message: {}", e);
            AppError::Internal
        })?;

    // Calculate estimated send time
    // High priority: within 500ms
    // Normal priority: within 5 seconds
    // Low priority: within 30 seconds
    let estimated_delay_ms = match priority {
        Priority::High => 500,
        Priority::Normal => 5000,
        Priority::Low => 30000,
    };

    let estimated_send_time = Utc::now() + Duration::milliseconds(estimated_delay_ms);

    tracing::info!(
        "Message enqueued: {} (account: {}, phone: {}, priority: {:?})",
        message_id,
        account_id,
        target_phone,
        priority
    );

    // Audit log
    state
        .audit(
            format!("wa.api.send message_id={}", message_id),
            Some(&token_record.user_id),
        )
        .await;

    let response = SendMessageResponse {
        message_id,
        estimated_send_time: estimated_send_time.to_rfc3339(),
    };

    Ok(json_ok("Message queued successfully", response))
}

/// GET /api/wa/campaigns/{id}/metrics - Get campaign metrics
/// **Validates: Requirements 10.5, 10.6**
///
/// This endpoint returns real-time campaign metrics calculated from the wa_recipients table.
///
/// Authentication: Bearer token (from wa_api_tokens table)
///
/// Response:
/// - campaign_id: Campaign identifier
/// - total_recipients: Total number of recipients in campaign
/// - total_sent: Number of messages sent
/// - total_delivered: Number of messages delivered
/// - total_read: Number of messages read
/// - total_replied: Number of recipients who replied
/// - delivered_rate: Delivery rate percentage (0-100)
/// - read_rate: Read rate percentage (0-100)
/// - reply_rate: Reply rate percentage (0-100)
/// - last_updated: Timestamp of metrics calculation
async fn get_campaign_metrics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    // Verify API token
    let _token_record = verify_api_token(&state, &headers).await?;

    // Check if campaign exists
    let campaign_exists: Option<String> =
        sqlx::query_scalar("SELECT id FROM wa_campaigns WHERE id = ?")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Database error checking campaign: {}", e);
                AppError::Internal
            })?;

    if campaign_exists.is_none() {
        return Err(AppError::NotFound);
    }

    // Calculate metrics
    let metrics = calculate_campaign_metrics(&state.pool, &campaign_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to calculate campaign metrics: {}", e);
            AppError::Internal
        })?;

    tracing::info!(
        "Campaign metrics retrieved: {} (sent: {}, delivered: {:.2}%, read: {:.2}%, reply: {:.2}%)",
        campaign_id,
        metrics.total_sent,
        metrics.delivered_rate,
        metrics.read_rate,
        metrics.reply_rate
    );

    Ok(json_ok("Campaign metrics retrieved successfully", metrics))
}

/// POST /api/wa/bomber - Execute bomber feature
/// **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8**
///
/// This endpoint allows sending repeated messages to a single target for testing purposes.
///
/// Authentication: Bearer token (from wa_api_tokens table)
/// Permission required: wa_bomber
/// Rate limit: 100 requests per minute per API token
///
/// Request body:
/// - account_id: WhatsApp account to send from
/// - target_phone: Recipient phone number (E.164 format)
/// - message: Message text
/// - repeat_count: Number of times to send (max 50)
/// - interval_seconds: Delay between messages (min 10s)
/// - override_cooldown: Admin override for cooldown (requires admin role)
///
/// Response (Success):
/// - bomber_id: Unique bomber execution identifier
/// - account_id: WhatsApp account used
/// - target_phone: Target phone number
/// - repeat_count: Number of repetitions
/// - interval_seconds: Interval between messages
/// - estimated_completion_time: Estimated completion time (ISO8601)
///
/// Response (Cooldown Active):
/// - error: "cooldown_active"
/// - message: Error message
/// - data:
///   - targetPhone: Target phone number
///   - cooldownExpiresAt: Cooldown expiration time (ISO8601)
///   - remainingSeconds: Remaining cooldown time in seconds
async fn execute_bomber(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BomberRequest>,
) -> Result<axum::response::Response, AppError> {
    // Verify API token
    let token_record = verify_api_token(&state, &headers).await?;

    // Check wa_bomber permission
    check_permission(&token_record, "wa_bomber")?;

    // Check rate limit
    state.check_api_rate_limit(&token_record.id).await?;

    // Get user role to check if admin (for override_cooldown)
    let user: Option<(String,)> = sqlx::query_as("SELECT role FROM users WHERE id = ?")
        .bind(&token_record.user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error fetching user role: {}", e);
            AppError::Internal
        })?;

    let is_admin = user
        .map(|(role,)| role.to_lowercase() == "admin" || role.to_lowercase() == "wa_admin")
        .unwrap_or(false);

    // Get Redis connection for bomber engine
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

    let redis_client = redis::Client::open(redis_url).map_err(|e| {
        tracing::error!("Failed to create Redis client: {}", e);
        AppError::Internal
    })?;

    let redis_conn = redis_client.get_connection_manager().await.map_err(|e| {
        tracing::error!("Failed to connect to Redis: {}", e);
        AppError::Internal
    })?;

    // Get bridge client from state (we need to initialize it properly)
    // For now, create a new one - in production this should be shared
    let (bridge_client, _event_rx) = crate::bridge::BridgeClient::new();
    let bridge_client = std::sync::Arc::new(bridge_client);

    // Create bomber engine
    let mut bomber_engine = BomberEngine::new(state.pool.clone(), bridge_client, redis_conn);

    // Execute bomber
    let response = bomber_engine
        .execute_bomber(payload, token_record.user_id.clone(), is_admin)
        .await?;

    tracing::info!(
        "Bomber execution started: {} (user: {})",
        response.bomber_id,
        token_record.user_id
    );

    // Audit log
    state
        .audit(
            format!("wa.bomber.execute bomber_id={}", response.bomber_id),
            Some(&token_record.user_id),
        )
        .await;

    Ok(json_ok("Bomber execution berhasil dimulai", response))
}

/// Create router for API routes
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/wa/send", post(send_message))
        .route("/api/wa/bomber", post(execute_bomber))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_phone_number() {
        // Valid E.164 numbers
        assert!(validate_phone_number("+6281234567890").is_ok());
        assert!(validate_phone_number("+12025551234").is_ok());
        assert!(validate_phone_number("+442071234567").is_ok());

        // Invalid numbers
        assert!(validate_phone_number("081234567890").is_err()); // Missing +
        assert!(validate_phone_number("+0812345").is_err()); // Starts with 0
        assert!(validate_phone_number("6281234567890").is_err()); // Missing +
        assert!(validate_phone_number("+62 812 3456 7890").is_err()); // Contains spaces
        assert!(validate_phone_number("+62-812-3456-7890").is_err()); // Contains dashes
    }

    #[test]
    fn test_sanitize_message() {
        // Should preserve normal text and newlines
        let msg = "Hello\nWorld\tTest";
        assert_eq!(sanitize_message(msg), msg);

        // Should remove control characters
        let msg_with_control = "Hello\x00World\x01Test";
        assert_eq!(sanitize_message(msg_with_control), "HelloWorldTest");

        // Should preserve Unicode
        let msg_unicode = "Hello 世界 🌍";
        assert_eq!(sanitize_message(msg_unicode), msg_unicode);
    }
}
