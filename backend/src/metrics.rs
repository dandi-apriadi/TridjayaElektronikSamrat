/*!
 * Metrics + Health module for the self-hosted WhatsApp gateway.
 *
 * **Validates: Requirements 20.1, 20.2, 20.7, 20.8**
 *
 * Exposes Prometheus-formatted metrics on `GET /api/wa/metrics` and a
 * health summary on `GET /api/wa/health`. Health returns HTTP 503 when
 * the database, Redis, or sessions are in an unrecoverable state.
 */

use crate::state::AppState;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Atomic counters for metrics that the rest of the gateway updates.
#[derive(Debug, Default)]
pub struct GatewayMetrics {
    pub messages_sent_total: AtomicU64,
    pub messages_failed_total: AtomicU64,
    pub messages_retried_total: AtomicU64,
    pub api_requests_total: AtomicU64,
    pub api_request_duration_ms_sum: AtomicU64,
    pub webhook_deliveries_total: AtomicU64,
    pub webhook_failures_total: AtomicU64,
    pub chatbot_replies_total: AtomicU64,
    pub bomber_executions_total: AtomicU64,
}

impl GatewayMetrics {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn record_message_sent(&self) {
        self.messages_sent_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_message_failed(&self) {
        self.messages_failed_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_message_retried(&self) {
        self.messages_retried_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_webhook_delivered(&self) {
        self.webhook_deliveries_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_webhook_failed(&self) {
        self.webhook_failures_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_chatbot_reply(&self) {
        self.chatbot_replies_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_bomber_execution(&self) {
        self.bomber_executions_total.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_api_request(&self, duration_ms: u64) {
        self.api_requests_total.fetch_add(1, Ordering::Relaxed);
        self.api_request_duration_ms_sum
            .fetch_add(duration_ms, Ordering::Relaxed);
    }

    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            messages_sent_total: self.messages_sent_total.load(Ordering::Relaxed),
            messages_failed_total: self.messages_failed_total.load(Ordering::Relaxed),
            messages_retried_total: self.messages_retried_total.load(Ordering::Relaxed),
            api_requests_total: self.api_requests_total.load(Ordering::Relaxed),
            api_request_duration_ms_sum: self
                .api_request_duration_ms_sum
                .load(Ordering::Relaxed),
            webhook_deliveries_total: self.webhook_deliveries_total.load(Ordering::Relaxed),
            webhook_failures_total: self.webhook_failures_total.load(Ordering::Relaxed),
            chatbot_replies_total: self.chatbot_replies_total.load(Ordering::Relaxed),
            bomber_executions_total: self.bomber_executions_total.load(Ordering::Relaxed),
        }
    }
}

/// Snapshot of counter values used to render Prometheus output.
#[derive(Debug, Clone, Serialize)]
pub struct MetricsSnapshot {
    pub messages_sent_total: u64,
    pub messages_failed_total: u64,
    pub messages_retried_total: u64,
    pub api_requests_total: u64,
    pub api_request_duration_ms_sum: u64,
    pub webhook_deliveries_total: u64,
    pub webhook_failures_total: u64,
    pub chatbot_replies_total: u64,
    pub bomber_executions_total: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[derive(Debug, Clone, Serialize)]
pub struct ComponentHealth {
    pub name: String,
    pub status: HealthStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthReport {
    pub status: HealthStatus,
    pub components: Vec<ComponentHealth>,
    pub active_sessions: usize,
    pub queue_depth: u64,
    pub timestamp: String,
}

/// Build the Prometheus-formatted text for a metrics snapshot.
pub fn render_prometheus(
    snapshot: &MetricsSnapshot,
    queue_depth: u64,
    active_connections: usize,
) -> String {
    let avg_duration_ms = if snapshot.api_requests_total > 0 {
        snapshot.api_request_duration_ms_sum as f64
            / snapshot.api_requests_total as f64
    } else {
        0.0
    };

    let mut out = String::new();

    out.push_str("# HELP wa_messages_sent_total Total WhatsApp messages successfully sent.\n");
    out.push_str("# TYPE wa_messages_sent_total counter\n");
    out.push_str(&format!(
        "wa_messages_sent_total {}\n",
        snapshot.messages_sent_total
    ));

    out.push_str("# HELP wa_messages_failed_total Total WhatsApp messages that failed permanently.\n");
    out.push_str("# TYPE wa_messages_failed_total counter\n");
    out.push_str(&format!(
        "wa_messages_failed_total {}\n",
        snapshot.messages_failed_total
    ));

    out.push_str("# HELP wa_messages_retried_total Total WhatsApp messages that have been re-enqueued for retry.\n");
    out.push_str("# TYPE wa_messages_retried_total counter\n");
    out.push_str(&format!(
        "wa_messages_retried_total {}\n",
        snapshot.messages_retried_total
    ));

    out.push_str("# HELP wa_queue_depth Current number of messages waiting in the Redis queue.\n");
    out.push_str("# TYPE wa_queue_depth gauge\n");
    out.push_str(&format!("wa_queue_depth {}\n", queue_depth));

    out.push_str("# HELP wa_active_connections Number of active WhatsApp gateway sessions.\n");
    out.push_str("# TYPE wa_active_connections gauge\n");
    out.push_str(&format!(
        "wa_active_connections {}\n",
        active_connections
    ));

    out.push_str("# HELP wa_api_requests_total Total API requests processed by the gateway.\n");
    out.push_str("# TYPE wa_api_requests_total counter\n");
    out.push_str(&format!(
        "wa_api_requests_total {}\n",
        snapshot.api_requests_total
    ));

    out.push_str("# HELP wa_api_request_duration_seconds Average API request duration.\n");
    out.push_str("# TYPE wa_api_request_duration_seconds gauge\n");
    out.push_str(&format!(
        "wa_api_request_duration_seconds {:.6}\n",
        avg_duration_ms / 1000.0
    ));

    out.push_str("# HELP wa_webhook_deliveries_total Total webhook deliveries that succeeded.\n");
    out.push_str("# TYPE wa_webhook_deliveries_total counter\n");
    out.push_str(&format!(
        "wa_webhook_deliveries_total {}\n",
        snapshot.webhook_deliveries_total
    ));

    out.push_str("# HELP wa_webhook_failures_total Total webhook deliveries that failed after all retries.\n");
    out.push_str("# TYPE wa_webhook_failures_total counter\n");
    out.push_str(&format!(
        "wa_webhook_failures_total {}\n",
        snapshot.webhook_failures_total
    ));

    out.push_str("# HELP wa_chatbot_replies_total Total auto-reply messages sent by the chatbot engine.\n");
    out.push_str("# TYPE wa_chatbot_replies_total counter\n");
    out.push_str(&format!(
        "wa_chatbot_replies_total {}\n",
        snapshot.chatbot_replies_total
    ));

    out.push_str("# HELP wa_bomber_executions_total Total bomber executions started.\n");
    out.push_str("# TYPE wa_bomber_executions_total counter\n");
    out.push_str(&format!(
        "wa_bomber_executions_total {}\n",
        snapshot.bomber_executions_total
    ));

    out
}

/// Collect a snapshot of queue depth, active sessions, and component health.
async fn evaluate_health(state: &AppState) -> HealthReport {
    let mut components = Vec::new();
    let mut overall = HealthStatus::Healthy;

    // Database health
    match sqlx::query_scalar::<_, i64>("SELECT 1").fetch_one(&state.pool).await {
        Ok(_) => components.push(ComponentHealth {
            name: "database".to_string(),
            status: HealthStatus::Healthy,
            detail: None,
        }),
        Err(e) => {
            overall = HealthStatus::Unhealthy;
            components.push(ComponentHealth {
                name: "database".to_string(),
                status: HealthStatus::Unhealthy,
                detail: Some(e.to_string()),
            });
        }
    }

    // Redis health
    match &state.redis {
        Some(redis) => {
            let mut conn = redis.write().await;
            let res: Result<String, _> = redis::cmd("PING").query_async(&mut *conn).await;
            match res {
                Ok(_) => components.push(ComponentHealth {
                    name: "redis".to_string(),
                    status: HealthStatus::Healthy,
                    detail: None,
                }),
                Err(e) => {
                    overall = HealthStatus::Unhealthy;
                    components.push(ComponentHealth {
                        name: "redis".to_string(),
                        status: HealthStatus::Unhealthy,
                        detail: Some(e.to_string()),
                    });
                }
            }
        }
        None => {
            overall = match overall {
                HealthStatus::Unhealthy => HealthStatus::Unhealthy,
                _ => HealthStatus::Degraded,
            };
            components.push(ComponentHealth {
                name: "redis".to_string(),
                status: HealthStatus::Degraded,
                detail: Some("Redis connection not configured".to_string()),
            });
        }
    }

    // Active sessions = wa_accounts where status='connected'
    let active_sessions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM wa_accounts WHERE status = 'connected'",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let session_status = if active_sessions > 0 {
        HealthStatus::Healthy
    } else {
        HealthStatus::Degraded
    };
    if matches!(session_status, HealthStatus::Degraded)
        && matches!(overall, HealthStatus::Healthy)
    {
        overall = HealthStatus::Degraded;
    }
    components.push(ComponentHealth {
        name: "sessions".to_string(),
        status: session_status,
        detail: Some(format!("{} active sessions", active_sessions)),
    });

    let queue_depth = match state.queue_manager.as_ref() {
        Some(qm) => qm
            .get_queue_metrics()
            .await
            .map(|m| m.total_depth as u64)
            .unwrap_or(0),
        None => 0,
    };

    HealthReport {
        status: overall,
        components,
        active_sessions: active_sessions as usize,
        queue_depth,
        timestamp: chrono::Utc::now().to_rfc3339(),
    }
}

/// `GET /api/wa/metrics` — Prometheus-formatted metrics.
async fn metrics_handler(State(state): State<AppState>) -> Response {
    let started = Instant::now();
    let snapshot = state.metrics.snapshot();

    let queue_depth = match state.queue_manager.as_ref() {
        Some(qm) => qm
            .get_queue_metrics()
            .await
            .map(|m| m.total_depth as u64)
            .unwrap_or(0),
        None => 0,
    };

    let active_connections: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM wa_accounts WHERE status = 'connected'",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let body = render_prometheus(&snapshot, queue_depth, active_connections.max(0) as usize);

    state
        .metrics
        .record_api_request(started.elapsed().as_millis() as u64);

    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4")],
        body,
    )
        .into_response()
}

/// `GET /api/wa/health` — health summary, returns 503 when unhealthy.
async fn health_handler(State(state): State<AppState>) -> Response {
    let started = Instant::now();
    let report = evaluate_health(&state).await;
    state
        .metrics
        .record_api_request(started.elapsed().as_millis() as u64);

    let status_code = match report.status {
        HealthStatus::Healthy => StatusCode::OK,
        HealthStatus::Degraded => StatusCode::OK,
        HealthStatus::Unhealthy => StatusCode::SERVICE_UNAVAILABLE,
    };

    (status_code, Json(report)).into_response()
}

/// Build the metrics + health router.
pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/api/wa/metrics", get(metrics_handler))
        .route("/api/wa/health", get(health_handler))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_prometheus_emits_all_counter_help_blocks() {
        let metrics = GatewayMetrics::new();
        metrics.record_message_sent();
        metrics.record_message_sent();
        metrics.record_message_failed();
        metrics.record_webhook_delivered();
        metrics.record_chatbot_reply();
        metrics.record_bomber_execution();
        metrics.record_api_request(123);

        let snapshot = metrics.snapshot();
        let output = render_prometheus(&snapshot, 7, 2);

        assert!(output.contains("# TYPE wa_messages_sent_total counter"));
        assert!(output.contains("wa_messages_sent_total 2"));
        assert!(output.contains("wa_messages_failed_total 1"));
        assert!(output.contains("wa_queue_depth 7"));
        assert!(output.contains("wa_active_connections 2"));
        assert!(output.contains("wa_webhook_deliveries_total 1"));
        assert!(output.contains("wa_chatbot_replies_total 1"));
        assert!(output.contains("wa_bomber_executions_total 1"));
    }

    #[test]
    fn render_prometheus_handles_zero_requests() {
        let metrics = GatewayMetrics::new();
        let snapshot = metrics.snapshot();
        let output = render_prometheus(&snapshot, 0, 0);

        assert!(output.contains("wa_api_request_duration_seconds 0.000000"));
    }

    #[test]
    fn health_status_serializes_lowercase() {
        let healthy = serde_json::to_string(&HealthStatus::Healthy).unwrap();
        let degraded = serde_json::to_string(&HealthStatus::Degraded).unwrap();
        let unhealthy = serde_json::to_string(&HealthStatus::Unhealthy).unwrap();

        assert_eq!(healthy, "\"healthy\"");
        assert_eq!(degraded, "\"degraded\"");
        assert_eq!(unhealthy, "\"unhealthy\"");
    }
}
