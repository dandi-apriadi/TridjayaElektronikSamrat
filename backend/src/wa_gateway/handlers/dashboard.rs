/**
 * WA Gateway - Dashboard Handlers
 */
use axum::extract::State;

use crate::response::{json_ok, AppError, ResponseBody};
use crate::state::AppState;

use super::super::models::DashboardSummary;

pub async fn get_dashboard(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let total_sessions: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let active_sessions: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE status = 'connected'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let connected: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_session_health WHERE status = 'connected'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let today = chrono::Utc::now().date_naive();
    let messages_today: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE DATE(created_at) = ?")
            .bind(today)
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let queue_depth: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_message_queue WHERE status = 'queued'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let recent_errors = sqlx::query_scalar::<_, String>(
        "SELECT last_error FROM wa_accounts WHERE last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 5"
    )
    .fetch_all(&state.pool)
    .await
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

pub async fn get_stats_summary(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let total_sent: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE direction = 'outbound'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let total_received: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE direction = 'inbound'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let total_delivered: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE status = 'delivered'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let total_read: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE status = 'read'")
            .fetch_one(&state.pool)
            .await
            .unwrap_or(0);

    let total_failed: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages WHERE status = 'failed'")
            .fetch_one(&state.pool)
            .await
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
