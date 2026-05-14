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
        "SELECT id, name, url, events, is_active, last_triggered_at, success_count, fail_count, created_at FROM wa_webhooks WHERE is_active = 1 ORDER BY created_at DESC"
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
        "SELECT id, name, url, events, headers, secret, retry_count, timeout_seconds, is_active, last_triggered_at, last_error, success_count, fail_count FROM wa_webhooks WHERE id = ?"
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

    sqlx::query(
        "INSERT INTO wa_webhooks (id, name, url, secret, events, headers, retry_count, timeout_seconds, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.url)
    .bind(&req.secret)
    .bind(serde_json::to_value(&req.events).ok())
    .bind(req.headers.as_ref().and_then(|h| serde_json::to_value(h).ok()))
    .bind(req.retry_count.unwrap_or(3))
    .bind(req.timeout_seconds.unwrap_or(30))
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

    sqlx::query(
        "UPDATE wa_webhooks SET name = ?, url = ?, secret = ?, events = ?, headers = ?, retry_count = ?, timeout_seconds = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&req.name)
    .bind(&req.url)
    .bind(&req.secret)
    .bind(serde_json::to_value(&req.events).ok())
    .bind(req.headers.as_ref().and_then(|h| serde_json::to_value(h).ok()))
    .bind(req.retry_count.unwrap_or(3))
    .bind(req.timeout_seconds.unwrap_or(30))
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
