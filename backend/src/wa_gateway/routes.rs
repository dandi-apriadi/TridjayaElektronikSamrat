use crate::state::AppState;
/**
 * WA Gateway - Routes
 *
 * Route definitions for the Gateway API
 */
use axum::{
    routing::{get, post},
    Router,
};

use super::handlers::{contacts, dashboard, messages, sessions, templates, webhooks};

pub fn router() -> Router<AppState> {
    Router::new()
        // Message APIs
        .route("/api/v1/wa/send", post(messages::send_message))
        .route("/api/v1/wa/send-template", post(messages::send_template))
        .route("/api/v1/wa/send-media", post(messages::send_media))
        .route("/api/v1/wa/bulk-send", post(messages::bulk_send))
        .route("/api/v1/wa/messages", get(messages::list_messages))
        .route("/api/v1/wa/messages/{id}", get(messages::get_message))
        .route(
            "/api/v1/wa/messages/{id}/retry",
            post(messages::retry_message),
        )
        // Contact APIs
        .route(
            "/api/v1/wa/contacts",
            get(contacts::list_contacts).post(contacts::create_contact),
        )
        .route(
            "/api/v1/wa/contacts/{id}",
            get(contacts::get_contact)
                .patch(contacts::update_contact)
                .delete(contacts::delete_contact),
        )
        .route("/api/v1/wa/contacts/sync", post(contacts::sync_contacts))
        // Template APIs
        .route(
            "/api/v1/wa/templates",
            get(templates::list_templates).post(templates::create_template),
        )
        .route(
            "/api/v1/wa/templates/{id}",
            get(templates::get_template)
                .patch(templates::update_template)
                .delete(templates::delete_template),
        )
        // Session APIs
        .route("/api/v1/wa/sessions", get(sessions::list_sessions))
        .route(
            "/api/v1/wa/sessions/{id}/status",
            get(sessions::get_session_status),
        )
        .route("/api/v1/wa/sessions/{id}/qr", get(sessions::get_session_qr))
        .route(
            "/api/v1/wa/sessions/{id}/connect",
            post(sessions::connect_session),
        )
        .route(
            "/api/v1/wa/sessions/{id}/disconnect",
            post(sessions::disconnect_session),
        )
        // Webhook APIs
        .route(
            "/api/v1/wa/webhooks",
            get(webhooks::list_webhooks).post(webhooks::create_webhook),
        )
        .route(
            "/api/v1/wa/webhooks/{id}",
            get(webhooks::get_webhook)
                .patch(webhooks::update_webhook)
                .delete(webhooks::delete_webhook),
        )
        // Dashboard & Stats
        .route("/api/v1/wa/dashboard", get(dashboard::get_dashboard))
        .route(
            "/api/v1/wa/stats/summary",
            get(dashboard::get_stats_summary),
        )
        // Health
        .route("/api/v1/wa/health", get(dashboard::health_check))
}
