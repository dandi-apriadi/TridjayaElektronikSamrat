/**
 * WA Gateway - Session Handlers
 */

use axum::extract::{State, Path};

use crate::state::AppState;
use crate::response::{json_ok, AppError, ResponseBody};

use super::super::models::{SessionStatusResponse, SessionMetrics};

pub async fn list_sessions(
    State(state): State<AppState>,
) -> Result<ResponseBody, AppError> {
    let rows: Vec<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, name, phone_number, status, last_connected_at, message_count_today, last_error, created_at FROM wa_accounts ORDER BY created_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?;
    
    let sessions: Vec<SessionStatusResponse> = rows.into_iter().map(|r| SessionStatusResponse {
        id: r.0,
        name: r.1.unwrap_or_default(),
        phone_number: r.2,
        status: r.3.unwrap_or_else(|| "disconnected".to_string()),
        qr_code: None,
        last_connected_at: None,
        message_count_today: r.5.unwrap_or(0) as i32,
        last_error: r.6,
        metrics: None,
    }).collect();
    
    Ok(json_ok("Sessions retrieved", sessions))
}

pub async fn get_session_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let account: Option<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>)> = sqlx::query_as(
        "SELECT id, name, phone_number, status, last_connected_at, message_count_today, last_error FROM wa_accounts WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?;

    let account = account.ok_or(AppError::NotFound)?;
    
    let health: Option<(String, Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT status, qr_code, last_error, metrics FROM wa_session_health WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .ok()
    .flatten();
    
    let metrics = health.as_ref().and_then(|h| {
        h.3.as_ref().and_then(|m_str| serde_json::from_str::<serde_json::Value>(m_str).ok()).map(|m| SessionMetrics {
            messages_sent: m.get("messages_sent").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            messages_received: m.get("messages_received").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            messages_delivered: m.get("messages_delivered").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            messages_read: m.get("messages_read").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
            messages_failed: m.get("messages_failed").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
        })
    });

    Ok(json_ok("Session status retrieved", SessionStatusResponse {
        id: account.0,
        name: account.1.unwrap_or_default(),
        phone_number: account.2,
        status: health.as_ref().map(|h| h.0.clone()).unwrap_or_else(|| account.3.unwrap_or_else(|| "unknown".to_string())),
        qr_code: health.as_ref().and_then(|h| h.1.clone()),
        last_connected_at: None,
        message_count_today: account.5.unwrap_or(0) as i32,
        last_error: health.as_ref().and_then(|h| h.2.clone()).or(account.6),
        metrics,
    }))
}

pub async fn get_session_qr(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let qr: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT qr_code FROM wa_session_health WHERE session_id = ? AND qr_expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?;
    let qr = qr.and_then(|r| r.0);
    
    match qr {
        Some(qr_code) => Ok(json_ok("QR code retrieved", serde_json::json!({ "qr": qr_code }))),
        None => Err(AppError::Validation { errors: vec!["No QR available".to_string()] }),
    }
}

pub async fn connect_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    // 1. Spawn the Node.js bridge child process
    state.bridge_client.spawn_process(id.clone()).await
        .map_err(|e| { tracing::error!("Failed to spawn: {}", e); AppError::Internal })?;
    
    // 2. Load saved credentials (if any) for session restoration
    let saved_creds: Option<String> = sqlx::query_scalar(
        "SELECT credentials FROM wa_accounts WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?
    .flatten();

    // 3. Send init_session JSON-RPC to make Baileys create the WA socket
    let mut params = serde_json::json!({ "session_id": id });
    if let Some(creds) = &saved_creds {
        if !creds.is_empty() {
            params["credentials"] = serde_json::Value::String(creds.clone());
        }
    }

    state.bridge_client.send_request(&id, "init_session".to_string(), params).await
        .map_err(|e| { tracing::error!("Failed to init_session: {}", e); AppError::Internal })?;

    // 4. Update DB status
    sqlx::query("UPDATE wa_accounts SET status = 'connecting' WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;
    
    Ok(json_ok("Session connecting", serde_json::json!({
        "session_id": id,
        "status": "connecting"
    })))
}

pub async fn disconnect_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    // Try graceful disconnect first (Baileys logout), then kill process
    let _ = state.bridge_client.send_request(
        &id,
        "disconnect".to_string(),
        serde_json::json!({ "session_id": id }),
    ).await;

    state.bridge_client.kill_process(&id).await
        .map_err(|e| { tracing::error!("Failed to disconnect: {}", e); AppError::Internal })?;
    
    sqlx::query("UPDATE wa_accounts SET status = 'disconnected', last_error = NULL WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;
    
    Ok(json_ok("Session disconnected", serde_json::json!({"session_id": id})))
}
