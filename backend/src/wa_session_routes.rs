/*!
 * Session management routes for the self-hosted WhatsApp gateway.
 *
 * **Validates: Requirements 1.1, 1.2, 11.1, 11.4, 30.1**
 *
 * Exposes endpoints for QR-code pairing, listing session statuses, and
 * cleanly disconnecting accounts. All endpoints require an authenticated
 * admin session via the existing `AccessSession` cookie/header flow.
 */

use crate::{
    auth::{authorize, Role},
    response::{json_ok, AppError},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Router,
};
use serde::Serialize;
use serde_json::json;

#[derive(Debug, Serialize)]
struct SessionDescriptor {
    account_id: String,
    status: String,
    has_qr_code: bool,
    last_health_check: Option<String>,
    reconnect_attempts: u32,
}

async fn require_admin(headers: &HeaderMap, state: &AppState) -> Result<(), AppError> {
    authorize(state, headers, &[Role::Admin, Role::SuperAdmin, Role::WaAdmin])
        .await
        .map(|_| ())
}

async fn list_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<axum::response::Response, AppError> {
    require_admin(&headers, &state).await?;

    let manager = state
        .session_manager
        .as_ref()
        .ok_or(AppError::Internal)?;

    let states = manager.get_all_session_states().await;
    let descriptors: Vec<SessionDescriptor> = states
        .into_iter()
        .map(|(_, s)| SessionDescriptor {
            account_id: s.account_id,
            status: s.status.as_db_str().to_string(),
            has_qr_code: s.qr_code.is_some(),
            last_health_check: s.last_health_check.map(|dt| dt.to_rfc3339()),
            reconnect_attempts: s.reconnect_attempts,
        })
        .collect();

    Ok(json_ok(
        "Sessions retrieved successfully",
        json!({ "sessions": descriptors }),
    ))
}

async fn get_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(account_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    require_admin(&headers, &state).await?;

    let manager = state
        .session_manager
        .as_ref()
        .ok_or(AppError::Internal)?;

    let session = manager
        .get_session_state(&account_id)
        .await
        .ok_or(AppError::NotFound)?;

    Ok(json_ok(
        "Session retrieved successfully",
        json!({
            "session": SessionDescriptor {
                account_id: session.account_id,
                status: session.status.as_db_str().to_string(),
                has_qr_code: session.qr_code.is_some(),
                last_health_check: session.last_health_check.map(|dt| dt.to_rfc3339()),
                reconnect_attempts: session.reconnect_attempts,
            }
        }),
    ))
}

async fn pair_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(account_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    require_admin(&headers, &state).await?;

    let manager = state
        .session_manager
        .as_ref()
        .ok_or(AppError::Internal)?;

    let qr_code = manager.init_session(account_id.clone()).await.map_err(|e| {
        tracing::error!(account_id = %account_id, error = %e, "Failed to start pairing");
        AppError::Internal
    })?;

    Ok(json_ok(
        "QR code generated successfully",
        json!({
            "account_id": account_id,
            "qr_code": qr_code,
            "expires_in_seconds": 60u32,
        }),
    ))
}

async fn get_qr(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(account_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    require_admin(&headers, &state).await?;

    let manager = state
        .session_manager
        .as_ref()
        .ok_or(AppError::Internal)?;

    let session = manager
        .get_session_state(&account_id)
        .await
        .ok_or(AppError::NotFound)?;

    let qr = session.qr_code.ok_or_else(|| AppError::Validation {
        errors: vec!["QR code not available; call /pair first".to_string()],
    })?;

    Ok(json_ok(
        "QR code retrieved successfully",
        json!({ "account_id": account_id, "qr_code": qr }),
    ))
}

async fn disconnect_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(account_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    require_admin(&headers, &state).await?;

    let manager = state
        .session_manager
        .as_ref()
        .ok_or(AppError::Internal)?;

    manager
        .disconnect_session(&account_id)
        .await
        .map_err(|e| {
            tracing::error!(account_id = %account_id, error = %e, "Failed to disconnect session");
            AppError::Internal
        })?;

    Ok(json_ok(
        "Session disconnected successfully",
        json!({ "account_id": account_id }),
    ))
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/wa/sessions", get(list_sessions))
        .route("/api/wa/sessions/{id}", get(get_session))
        .route("/api/wa/sessions/{id}/pair", post(pair_session))
        .route("/api/wa/sessions/{id}/qr", get(get_qr))
        .route(
            "/api/wa/sessions/{id}/disconnect",
            post(disconnect_session),
        )
        .with_state(state)
}
