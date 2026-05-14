/**
 * WA Gateway - Session Handlers
 */
use axum::extract::{Path, State};
use axum::http::HeaderMap;

use crate::auth::{authorize, Role};
use crate::response::{json_ok, AppError, ResponseBody};
use crate::state::{AppState, UserRecord};

use super::super::models::{SessionMetrics, SessionStatusResponse};

pub async fn list_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    let rows: Vec<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>, String)> =
        if user.role.eq_ignore_ascii_case("admin") {
            sqlx::query_as(
                "SELECT id, name, phone_number, status, last_connected_at, message_count_today, last_error, created_at FROM wa_accounts ORDER BY created_at DESC"
            )
            .fetch_all(&state.pool)
            .await
        } else {
            sqlx::query_as(
                "SELECT id, name, phone_number, status, last_connected_at, message_count_today, last_error, created_at FROM wa_accounts WHERE created_by = ? ORDER BY created_at DESC"
            )
            .bind(&user.id)
            .fetch_all(&state.pool)
            .await
        }
        .map_err(|_| AppError::Internal)?;

    let sessions: Vec<SessionStatusResponse> = rows
        .into_iter()
        .map(|r| SessionStatusResponse {
            id: r.0,
            name: r.1.unwrap_or_default(),
            phone_number: r.2,
            status: r.3.unwrap_or_else(|| "disconnected".to_string()),
            qr_code: None,
            last_connected_at: None,
            message_count_today: r.5.unwrap_or(0) as i32,
            last_error: r.6,
            metrics: None,
        })
        .collect();

    Ok(json_ok("Sessions retrieved", sessions))
}

async fn ensure_session_access(
    state: &AppState,
    user: &UserRecord,
    session_id: &str,
) -> Result<(), AppError> {
    if user.role.eq_ignore_ascii_case("admin") {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ?")
            .bind(session_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;

        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound)
        };
    }

    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ? AND created_by = ?")
            .bind(session_id)
            .bind(&user.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;

    if exists > 0 {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

pub async fn get_session_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_session_access(&state, &user, &id).await?;

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
        h.3.as_ref()
            .and_then(|m_str| serde_json::from_str::<serde_json::Value>(m_str).ok())
            .map(|m| SessionMetrics {
                messages_sent: m.get("messages_sent").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                messages_received: m
                    .get("messages_received")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32,
                messages_delivered: m
                    .get("messages_delivered")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32,
                messages_read: m.get("messages_read").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                messages_failed: m
                    .get("messages_failed")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as i32,
            })
    });

    Ok(json_ok(
        "Session status retrieved",
        SessionStatusResponse {
            id: account.0,
            name: account.1.unwrap_or_default(),
            phone_number: account.2,
            status: health
                .as_ref()
                .map(|h| h.0.clone())
                .unwrap_or_else(|| account.3.unwrap_or_else(|| "unknown".to_string())),
            qr_code: health.as_ref().and_then(|h| h.1.clone()),
            last_connected_at: None,
            message_count_today: account.5.unwrap_or(0) as i32,
            last_error: health.as_ref().and_then(|h| h.2.clone()).or(account.6),
            metrics,
        },
    ))
}

pub async fn get_session_qr(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_session_access(&state, &user, &id).await?;

    let qr: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT qr_code FROM wa_session_health WHERE session_id = ? AND qr_expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?;
    let qr = qr.and_then(|r| r.0);

    match qr {
        Some(qr_code) => Ok(json_ok(
            "QR code retrieved",
            serde_json::json!({ "qr": qr_code }),
        )),
        None => Err(AppError::Validation {
            errors: vec!["No QR available".to_string()],
        }),
    }
}

pub async fn connect_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_session_access(&state, &user, &id).await?;

    let account_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM wa_accounts WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;

    if account_status.is_none() {
        return Err(AppError::NotFound);
    }

    let health_status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM wa_session_health WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?;

    let active_sessions = state.bridge_client.get_active_sessions().await;
    let has_active_process = active_sessions.iter().any(|session_id| session_id == &id);
    let visible_status = health_status
        .as_deref()
        .or(account_status.as_deref())
        .unwrap_or("disconnected");

    if has_active_process
        && matches!(
            visible_status,
            "connecting" | "qr_ready" | "reconnecting" | "connected"
        )
    {
        return Ok(json_ok(
            "Session already active",
            serde_json::json!({
                "session_id": id,
                "status": visible_status
            }),
        ));
    }

    if has_active_process {
        tracing::warn!(
            session_id = %id,
            status = %visible_status,
            "Removing stale WA bridge process before reconnect"
        );
        state.bridge_client.kill_process(&id).await.map_err(|e| {
            tracing::error!("Failed to kill stale bridge process: {}", e);
            AppError::Internal
        })?;
    }

    // 1. Spawn the Node.js bridge child process
    state
        .bridge_client
        .spawn_process(id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to spawn: {}", e);
            AppError::Internal
        })?;

    // 2. Load saved credentials (if any) for session restoration
    let saved_creds: Option<String> =
        sqlx::query_scalar("SELECT credentials FROM wa_accounts WHERE id = ?")
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

    let init_result = state
        .bridge_client
        .send_request(&id, "init_session".to_string(), params)
        .await;

    if let Err(e) = init_result {
        if e.to_string().contains("already exists") {
            return Ok(json_ok(
                "Session already active",
                serde_json::json!({
                    "session_id": id,
                    "status": "qr_ready"
                }),
            ));
        }

        return Err({
            tracing::error!("Failed to init_session: {}", e);
            AppError::Internal
        });
    }

    // 4. Update DB status
    sqlx::query("UPDATE wa_accounts SET status = 'connecting' WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok(json_ok(
        "Session connecting",
        serde_json::json!({
            "session_id": id,
            "status": "connecting"
        }),
    ))
}

pub async fn disconnect_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_session_access(&state, &user, &id).await?;

    // Try graceful disconnect first (Baileys logout), then kill process
    let _ = state
        .bridge_client
        .send_request(
            &id,
            "disconnect".to_string(),
            serde_json::json!({ "session_id": id }),
        )
        .await;

    state.bridge_client.kill_process(&id).await.map_err(|e| {
        tracing::error!("Failed to disconnect: {}", e);
        AppError::Internal
    })?;

    sqlx::query("UPDATE wa_accounts SET status = 'disconnected', last_error = NULL WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    sqlx::query("DELETE FROM wa_session_health WHERE session_id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "INSERT INTO wa_session_health (id, session_id, status, last_error, updated_at)
         VALUES (?, ?, 'disconnected', NULL, CURRENT_TIMESTAMP)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|_| AppError::Internal)?;

    Ok(json_ok(
        "Session disconnected",
        serde_json::json!({"session_id": id}),
    ))
}
