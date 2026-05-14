use crate::{
    auth::{authorize, Role},
    response::{json_ok, AppError},
    state::{AppState, UserRecord},
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebhookRequest {
    pub account_id: String,
    pub webhook_url: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    pub retry_config: Option<RetryConfig>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWebhookRequest {
    pub webhook_url: Option<String>,
    pub enabled: Option<bool>,
    pub retry_config: Option<RetryConfig>,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RetryConfig {
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,
    #[serde(default = "default_backoff_multiplier")]
    pub backoff_multiplier: f64,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookResponse {
    pub id: String,
    pub account_id: String,
    pub webhook_url: String,
    pub secret_key_masked: String,
    pub enabled: bool,
    pub retry_config: Option<RetryConfig>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Deserialize)]
pub struct ListWebhooksQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub account_id: Option<String>,
}

// ============================================================================
// Default Values
// ============================================================================

fn default_enabled() -> bool {
    true
}

fn default_max_retries() -> u32 {
    3
}

fn default_backoff_multiplier() -> f64 {
    3.0
}

fn default_timeout_ms() -> u64 {
    10000
}

fn default_page() -> i64 {
    1
}

fn default_limit() -> i64 {
    50
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Mask secret key to show only last 4 characters
fn mask_secret_key(secret: &str) -> String {
    if secret.len() <= 4 {
        "****".to_string()
    } else {
        let visible = &secret[secret.len() - 4..];
        format!("****{}", visible)
    }
}

/// Generate random 32-byte secret key, base64 encoded
fn generate_secret_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes)
}

/// Validate webhook URL format
fn validate_webhook_url(url: &str) -> Result<(), AppError> {
    let url_trimmed = url.trim();

    if url_trimmed.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Webhook URL tidak boleh kosong".to_string()],
        });
    }

    // Parse URL to validate format
    match reqwest::Url::parse(url_trimmed) {
        Ok(parsed) => {
            // Only allow HTTP and HTTPS schemes
            if parsed.scheme() != "http" && parsed.scheme() != "https" {
                return Err(AppError::Validation {
                    errors: vec![
                        "Webhook URL harus menggunakan protokol HTTP atau HTTPS".to_string()
                    ],
                });
            }
            Ok(())
        }
        Err(_) => Err(AppError::Validation {
            errors: vec!["Format webhook URL tidak valid".to_string()],
        }),
    }
}

/// Test webhook URL accessibility with a test HTTP request
async fn test_webhook_url(url: &str) -> Result<(), AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| {
            tracing::error!("Failed to create HTTP client: {}", e);
            AppError::Internal
        })?;

    let test_payload = json!({
        "test": true,
        "message": "Webhook configuration test"
    });

    match client.post(url).json(&test_payload).send().await {
        Ok(response) => {
            if response.status().is_success() || response.status().is_client_error() {
                // Accept both success and client errors (4xx) as valid
                // because the endpoint might reject our test payload but is reachable
                Ok(())
            } else {
                Err(AppError::Validation {
                    errors: vec![format!(
                        "Webhook URL tidak dapat diakses (status: {})",
                        response.status()
                    )],
                })
            }
        }
        Err(e) => {
            tracing::warn!("Webhook URL test failed: {}", e);
            Err(AppError::Validation {
                errors: vec![format!("Webhook URL tidak dapat diakses: {}", e)],
            })
        }
    }
}

/// Validate retry config values
fn validate_retry_config(config: &RetryConfig) -> Result<(), AppError> {
    if config.max_retries > 10 {
        return Err(AppError::Validation {
            errors: vec!["Max retries tidak boleh lebih dari 10".to_string()],
        });
    }

    if config.backoff_multiplier < 1.0 || config.backoff_multiplier > 10.0 {
        return Err(AppError::Validation {
            errors: vec!["Backoff multiplier harus antara 1.0 dan 10.0".to_string()],
        });
    }

    if config.timeout_ms < 1000 || config.timeout_ms > 60000 {
        return Err(AppError::Validation {
            errors: vec!["Timeout harus antara 1000ms dan 60000ms".to_string()],
        });
    }

    Ok(())
}

async fn ensure_account_access(
    state: &AppState,
    user: &UserRecord,
    account_id: &str,
) -> Result<(), AppError> {
    if user.role.eq_ignore_ascii_case("admin") {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA account access: {}", e);
                AppError::Internal
            })?;
        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound)
        };
    }

    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ? AND created_by = ?")
            .bind(account_id)
            .bind(&user.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA account ownership: {}", e);
                AppError::Internal
            })?;

    if exists > 0 {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

async fn ensure_webhook_access(
    state: &AppState,
    user: &UserRecord,
    webhook_id: &str,
) -> Result<String, AppError> {
    let account_id: String = sqlx::query_scalar("SELECT account_id FROM wa_webhooks WHERE id = ?")
        .bind(webhook_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking webhook access: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::NotFound)?;

    ensure_account_access(state, user, &account_id).await?;
    Ok(account_id)
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/wa/webhooks - Create webhook config
pub async fn create_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateWebhookRequest>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_webhook_manage
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_account_access(&state, &user, &payload.account_id).await?;

    // Validate webhook URL
    validate_webhook_url(&payload.webhook_url)?;

    // Validate retry config if provided
    if let Some(ref retry_config) = payload.retry_config {
        validate_retry_config(retry_config)?;
    }

    // Test webhook URL accessibility
    test_webhook_url(&payload.webhook_url).await?;

    // Generate webhook ID and secret key
    let webhook_id = uuid::Uuid::new_v4().to_string();
    let secret_key = generate_secret_key();

    // Serialize retry config to JSON
    let retry_config_json = payload
        .retry_config
        .as_ref()
        .map(|config| serde_json::to_string(config).unwrap_or_default());

    // Insert webhook config
    sqlx::query(
        "INSERT INTO wa_webhooks (id, account_id, webhook_url, secret_key, enabled, retry_config, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&webhook_id)
    .bind(&payload.account_id)
    .bind(&payload.webhook_url)
    .bind(&secret_key)
    .bind(payload.enabled)
    .bind(&retry_config_json)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating webhook: {}", e);
        AppError::Internal
    })?;

    // Fetch created webhook
    let webhook = fetch_webhook_by_id(&state, &webhook_id).await?;

    state.audit("wa.webhook.created", Some(&webhook_id)).await;

    Ok(json_ok(
        "Webhook berhasil dibuat",
        json!({ "webhook": webhook }),
    ))
}

/// GET /api/wa/webhooks - List webhooks with pagination
pub async fn list_webhooks(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListWebhooksQuery>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_webhook_manage
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let limit = query.limit.min(100).max(1);
    let offset = (query.page.max(1) - 1) * limit;

    // Build query based on filters
    let (webhooks, total): (Vec<WebhookResponse>, i64) = if let Some(account_id) = query.account_id
    {
        ensure_account_access(&state, &user, &account_id).await?;
        let rows = sqlx::query_as::<_, (String, String, String, String, bool, Option<String>, String, Option<String>)>(
            "SELECT id, account_id, webhook_url, secret_key, enabled, retry_config, created_at, updated_at
             FROM wa_webhooks
             WHERE account_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        )
        .bind(&account_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing webhooks: {}", e);
            AppError::Internal
        })?;

        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM wa_webhooks WHERE account_id = ?")
                .bind(&account_id)
                .fetch_one(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("DB error counting webhooks: {}", e);
                    AppError::Internal
                })?;

        let webhooks = rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    webhook_url,
                    secret_key,
                    enabled,
                    retry_config,
                    created_at,
                    updated_at,
                )| {
                    WebhookResponse {
                        id,
                        account_id,
                        webhook_url,
                        secret_key_masked: mask_secret_key(&secret_key),
                        enabled,
                        retry_config: retry_config
                            .and_then(|json| serde_json::from_str(&json).ok()),
                        created_at,
                        updated_at,
                    }
                },
            )
            .collect();

        (webhooks, total)
    } else if user.role.eq_ignore_ascii_case("admin") {
        let rows = sqlx::query_as::<_, (String, String, String, String, bool, Option<String>, String, Option<String>)>(
            "SELECT id, account_id, webhook_url, secret_key, enabled, retry_config, created_at, updated_at
             FROM wa_webhooks
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing webhooks: {}", e);
            AppError::Internal
        })?;

        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_webhooks")
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error counting webhooks: {}", e);
                AppError::Internal
            })?;

        let webhooks = rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    webhook_url,
                    secret_key,
                    enabled,
                    retry_config,
                    created_at,
                    updated_at,
                )| {
                    WebhookResponse {
                        id,
                        account_id,
                        webhook_url,
                        secret_key_masked: mask_secret_key(&secret_key),
                        enabled,
                        retry_config: retry_config
                            .and_then(|json| serde_json::from_str(&json).ok()),
                        created_at,
                        updated_at,
                    }
                },
            )
            .collect();

        (webhooks, total)
    } else {
        let rows = sqlx::query_as::<_, (String, String, String, String, bool, Option<String>, String, Option<String>)>(
            "SELECT w.id, w.account_id, w.webhook_url, w.secret_key, w.enabled, w.retry_config, w.created_at, w.updated_at
             FROM wa_webhooks w
             JOIN wa_accounts a ON a.id = w.account_id
             WHERE a.created_by = ?
             ORDER BY w.created_at DESC
             LIMIT ? OFFSET ?"
        )
        .bind(&user.id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing webhooks: {}", e);
            AppError::Internal
        })?;

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*)
             FROM wa_webhooks w
             JOIN wa_accounts a ON a.id = w.account_id
             WHERE a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error counting webhooks: {}", e);
            AppError::Internal
        })?;

        let webhooks = rows
            .into_iter()
            .map(
                |(
                    id,
                    account_id,
                    webhook_url,
                    secret_key,
                    enabled,
                    retry_config,
                    created_at,
                    updated_at,
                )| WebhookResponse {
                    id,
                    account_id,
                    webhook_url,
                    secret_key_masked: mask_secret_key(&secret_key),
                    enabled,
                    retry_config: retry_config.and_then(|json| serde_json::from_str(&json).ok()),
                    created_at,
                    updated_at,
                },
            )
            .collect();

        (webhooks, total)
    };

    let total_pages = (total as f64 / limit as f64).ceil() as i64;

    Ok(json_ok(
        "Webhooks berhasil diambil",
        json!({
            "webhooks": webhooks,
            "pagination": {
                "page": query.page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        }),
    ))
}

/// PATCH /api/wa/webhooks/{id} - Update webhook config
pub async fn update_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWebhookRequest>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_webhook_manage
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_webhook_access(&state, &user, &id).await?;

    // Validate webhook URL if provided
    if let Some(ref webhook_url) = payload.webhook_url {
        validate_webhook_url(webhook_url)?;
        test_webhook_url(webhook_url).await?;
    }

    // Validate retry config if provided
    if let Some(ref retry_config) = payload.retry_config {
        validate_retry_config(retry_config)?;
    }

    // Build update query dynamically
    let mut updates = Vec::new();
    let mut query_str = "UPDATE wa_webhooks SET ".to_string();

    if payload.webhook_url.is_some() {
        updates.push("webhook_url = ?");
    }
    if payload.enabled.is_some() {
        updates.push("enabled = ?");
    }
    if payload.retry_config.is_some() {
        updates.push("retry_config = ?");
    }

    if updates.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Tidak ada field yang diupdate".to_string()],
        });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    query_str.push_str(&updates.join(", "));
    query_str.push_str(" WHERE id = ?");

    // Execute update with dynamic binding
    let mut query = sqlx::query(&query_str);

    if let Some(webhook_url) = &payload.webhook_url {
        query = query.bind(webhook_url);
    }
    if let Some(enabled) = payload.enabled {
        query = query.bind(enabled);
    }
    if let Some(retry_config) = &payload.retry_config {
        let retry_config_json = serde_json::to_string(retry_config).unwrap_or_default();
        query = query.bind(retry_config_json);
    }

    query = query.bind(&id);

    query.execute(&state.pool).await.map_err(|e| {
        tracing::error!("DB error updating webhook: {}", e);
        AppError::Internal
    })?;

    // Fetch updated webhook
    let webhook = fetch_webhook_by_id(&state, &id).await?;

    state.audit("wa.webhook.updated", Some(&id)).await;

    Ok(json_ok(
        "Webhook berhasil diupdate",
        json!({ "webhook": webhook }),
    ))
}

/// DELETE /api/wa/webhooks/{id} - Delete webhook config
pub async fn delete_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_webhook_manage
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_webhook_access(&state, &user, &id).await?;

    // Delete webhook (cascade will delete logs)
    let result = sqlx::query("DELETE FROM wa_webhooks WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting webhook: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    state.audit("wa.webhook.deleted", Some(&id)).await;

    Ok(json_ok(
        "Webhook berhasil dihapus",
        json!({ "deleted": true }),
    ))
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn fetch_webhook_by_id(state: &AppState, id: &str) -> Result<WebhookResponse, AppError> {
    let row = sqlx::query_as::<_, (String, String, String, String, bool, Option<String>, String, Option<String>)>(
        "SELECT id, account_id, webhook_url, secret_key, enabled, retry_config, created_at, updated_at
         FROM wa_webhooks
         WHERE id = ?
         LIMIT 1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching webhook: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let (id, account_id, webhook_url, secret_key, enabled, retry_config, created_at, updated_at) =
        row;

    Ok(WebhookResponse {
        id,
        account_id,
        webhook_url,
        secret_key_masked: mask_secret_key(&secret_key),
        enabled,
        retry_config: retry_config.and_then(|json| serde_json::from_str(&json).ok()),
        created_at,
        updated_at,
    })
}
