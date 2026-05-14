/**
 * WA Gateway - Dashboard Handlers
 */
use axum::{extract::State, http::HeaderMap};

use crate::auth::{authorize, Role};
use crate::response::{json_ok, AppError, ResponseBody};
use crate::state::AppState;

use super::super::models::DashboardSummary;
use super::is_admin;

pub async fn get_dashboard(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let total_sessions: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE created_by = ?")
            .bind(&user.id)
            .fetch_one(&state.pool)
            .await
    }
    .unwrap_or(0);

    let active_sessions: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE status = 'connected'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_accounts WHERE status = 'connected' AND created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let connected: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_session_health WHERE status = 'connected'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*)
             FROM wa_session_health h
             JOIN wa_accounts a ON a.id = h.session_id
             WHERE h.status = 'connected' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let today = chrono::Utc::now().date_naive();
    let messages_today: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE DATE(created_at) = ?")
            .bind(today)
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*)
             FROM wa_messages m
             JOIN wa_accounts a ON a.id = m.session_id
             WHERE DATE(m.created_at) = ? AND a.created_by = ?",
        )
        .bind(today)
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let queue_depth: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_message_queue WHERE status = 'queued'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*)
             FROM wa_message_queue q
             JOIN wa_accounts a ON a.id = q.session_id
             WHERE q.status = 'queued' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let recent_errors = if is_admin(&user) {
        sqlx::query_scalar::<_, String>(
            "SELECT last_error FROM wa_accounts WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 5"
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_scalar::<_, String>(
            "SELECT last_error FROM wa_accounts WHERE last_error IS NOT NULL AND created_by = ? ORDER BY updated_at DESC LIMIT 5",
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .unwrap_or_default();

    Ok(json_ok(
        "Dashboard data retrieved",
        DashboardSummary {
            total_sessions,
            active_sessions,
            connected_sessions: connected,
            messages_today,
            messages_this_hour: 0,
            failed_messages_today: 0,
            queue_depth,
            recent_errors,
        },
    ))
}

pub async fn get_stats_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let total_sent: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE direction = 'outbound'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_messages m JOIN wa_accounts a ON a.id = m.session_id WHERE m.direction = 'outbound' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let total_received: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE direction = 'inbound'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_messages m JOIN wa_accounts a ON a.id = m.session_id WHERE m.direction = 'inbound' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let total_delivered: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE status = 'delivered'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_messages m JOIN wa_accounts a ON a.id = m.session_id WHERE m.status = 'delivered' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let total_read: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE status = 'read'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_messages m JOIN wa_accounts a ON a.id = m.session_id WHERE m.status = 'read' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    let total_failed: i64 = if is_admin(&user) {
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE status = 'failed'")
            .fetch_one(&state.pool)
            .await
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_messages m JOIN wa_accounts a ON a.id = m.session_id WHERE m.status = 'failed' AND a.created_by = ?",
        )
        .bind(&user.id)
        .fetch_one(&state.pool)
        .await
    }
    .unwrap_or(0);

    Ok(json_ok(
        "Stats summary",
        serde_json::json!({
            "total_sent": total_sent,
            "total_received": total_received,
            "total_delivered": total_delivered,
            "total_read": total_read,
            "total_failed": total_failed,
            "delivery_rate": if total_sent > 0 { (total_delivered as f64 / total_sent as f64) * 100.0 } else { 0.0 },
            "read_rate": if total_delivered > 0 { (total_read as f64 / total_delivered as f64) * 100.0 } else { 0.0 },
        }),
    ))
}

pub async fn health_check(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let db_healthy = sqlx::query("SELECT 1").fetch_one(&state.pool).await.is_ok();
    let bridge_healthy = true; // Simplified check

    if db_healthy {
        Ok(json_ok(
            "Gateway healthy",
            serde_json::json!({
                "status": "healthy",
                "database": db_healthy,
                "bridge": bridge_healthy,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }),
        ))
    } else {
        Err(AppError::Internal)
    }
}
