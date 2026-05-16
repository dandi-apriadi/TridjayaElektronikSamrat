/**
 * WA Gateway - Webhook Handlers
 */
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};

use crate::auth::{authorize, Role};
use crate::response::{json_created, json_ok, AppError, ResponseBody};
use crate::state::AppState;

use super::super::models::WebhookConfigRequest;
use super::generate_id;

pub async fn list_webhooks(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let webhooks: Vec<(String, String, String, Option<String>, Option<bool>, Option<String>, Option<i64>, Option<i64>, String)> = sqlx::query_as(
        "SELECT id, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(retry_config, '$.name')), account_id) AS name, webhook_url AS url, retry_config AS events, enabled AS is_active,
                CAST(NULL AS CHAR) AS last_triggered_at,
                CAST(0 AS SIGNED) AS success_count,
                CAST(0 AS SIGNED) AS fail_count,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM wa_webhooks WHERE enabled = 1 ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list webhooks: {}", e);
        AppError::Internal
    })?;

    let result: Vec<serde_json::Value> = webhooks
        .into_iter()
        .map(|w| {
            serde_json::json!({
                "id": w.0, "name": w.1, "url": w.2, "events": w.3, "is_active": w.4,
                "last_triggered_at": w.5, "success_count": w.6, "fail_count": w.7, "created_at": w.8
            })
        })
        .collect();

    Ok(json_ok("Webhooks retrieved", result))
}

pub async fn get_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let webhook: Option<(String, String, String, Option<String>, Option<String>, Option<String>, Option<i32>, Option<i32>, Option<bool>, Option<String>, Option<String>, Option<i64>, Option<i64>)> = sqlx::query_as(
        "SELECT id,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(retry_config, '$.name')), account_id) AS name,
                webhook_url AS url,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(retry_config, '$.events')) AS CHAR) AS events,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(retry_config, '$.headers')) AS CHAR) AS headers,
                secret_key AS secret,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(retry_config, '$.retry_count')) AS SIGNED) AS retry_count,
                CAST(JSON_UNQUOTE(JSON_EXTRACT(retry_config, '$.timeout_seconds')) AS SIGNED) AS timeout_seconds,
                enabled AS is_active,
                CAST(NULL AS CHAR) AS last_triggered_at,
                CAST(NULL AS CHAR) AS last_error,
                CAST(0 AS SIGNED) AS success_count,
                CAST(0 AS SIGNED) AS fail_count
         FROM wa_webhooks WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get webhook: {}", e);
        AppError::Internal
    })?;

    let w = webhook.ok_or(AppError::NotFound)?;

    Ok(json_ok(
        "Webhook retrieved",
        serde_json::json!({
            "id": w.0, "name": w.1, "url": w.2, "events": w.3, "headers": w.4,
            "secret": w.5, "retry_count": w.6, "timeout_seconds": w.7, "is_active": w.8,
            "last_triggered_at": w.9, "last_error": w.10, "success_count": w.11, "fail_count": w.12
        }),
    ))
}

pub async fn create_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<WebhookConfigRequest>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let id = generate_id();
    let now = chrono::Utc::now().naive_utc();
    let account_id: Option<String> =
        sqlx::query_scalar("SELECT id FROM wa_accounts ORDER BY created_at DESC LIMIT 1")
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to find WA account for webhook: {}", e);
                AppError::Internal
            })?;
    let account_id = account_id.ok_or_else(|| AppError::Validation {
        errors: vec!["No WhatsApp account available for webhook".to_string()],
    })?;
    let retry_config = serde_json::json!({
        "name": req.name,
        "events": req.events,
        "headers": req.headers,
        "retry_count": req.retry_count.unwrap_or(3),
        "timeout_seconds": req.timeout_seconds.unwrap_or(30),
    })
    .to_string();

    sqlx::query(
        "INSERT INTO wa_webhooks (id, account_id, webhook_url, secret_key, enabled, retry_config, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&account_id)
    .bind(&req.url)
    .bind(req.secret.unwrap_or_default())
    .bind(retry_config)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create webhook: {}", e);
        AppError::Internal
    })?;

    Ok(json_created(
        "Webhook created",
        serde_json::json!({"id": id}),
    ))
}

pub async fn update_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<WebhookConfigRequest>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let retry_config = serde_json::json!({
        "name": req.name,
        "events": req.events,
        "headers": req.headers,
        "retry_count": req.retry_count.unwrap_or(3),
        "timeout_seconds": req.timeout_seconds.unwrap_or(30),
    })
    .to_string();

    sqlx::query(
        "UPDATE wa_webhooks SET webhook_url = ?, secret_key = ?, retry_config = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&req.url)
    .bind(req.secret.unwrap_or_default())
    .bind(retry_config)
    .bind(chrono::Utc::now().naive_utc())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update webhook: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Webhook updated", serde_json::json!({"id": id})))
}

pub async fn delete_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    sqlx::query("DELETE FROM wa_webhooks WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete webhook: {}", e);
            AppError::Internal
        })?;

    Ok(axum::http::StatusCode::NO_CONTENT.into_response())
}
