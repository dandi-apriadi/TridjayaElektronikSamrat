use chrono::{DateTime, NaiveDate, Utc};
/**
 * WA Gateway - Models
 *
 * Request and response types for the Gateway API
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================
// MESSAGE MODELS
// ============================================

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub session_id: String,
    pub to: String,
    #[serde(rename = "type")]
    pub message_type: Option<String>,
    pub content: Option<String>,
    pub media_url: Option<String>,
    pub template_id: Option<String>,
    pub variables: Option<HashMap<String, String>>,
    pub typing_delay: Option<u64>,
    pub priority: Option<i32>,
    pub scheduled_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct SendMessageResponse {
    pub message_id: String,
    pub status: String,
    pub wa_message_id: Option<String>,
    pub estimated_delivery: Option<DateTime<Utc>>,
    pub queue_position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SendTemplateRequest {
    pub session_id: String,
    pub to: String,
    pub template_id: String,
    pub variables: HashMap<String, String>,
    pub typing_delay: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct MessageHistoryResponse {
    pub id: String,
    pub session_id: String,
    pub contact_id: Option<String>,
    pub direction: String,
    pub message_type: String,
    pub content: Option<String>,
    pub media_url: Option<String>,
    pub status: String,
    pub sent_at: Option<DateTime<Utc>>,
    pub delivered_at: Option<DateTime<Utc>>,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

// ============================================
// CONTACT MODELS
// ============================================

#[derive(Debug, Serialize)]
pub struct ContactResponse {
    pub id: String,
    pub phone: String,
    pub name: Option<String>,
    pub profile_pic_url: Option<String>,
    pub about: Option<String>,
    pub labels: Vec<String>,
    pub is_blocked: bool,
    pub is_group: bool,
    pub last_chat_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub phone: String,
    pub name: Option<String>,
    pub labels: Option<Vec<String>>,
}

// ============================================
// TEMPLATE MODELS
// ============================================

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub category: Option<String>,
    pub content: String,
    pub variables: Option<Vec<String>>,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateResponse {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub content: String,
    pub variables: Vec<String>,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
    pub is_active: bool,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
}

// ============================================
// SESSION MODELS
// ============================================

#[derive(Debug, Serialize)]
pub struct SessionStatusResponse {
    pub id: String,
    pub name: String,
    pub phone_number: Option<String>,
    pub status: String,
    pub qr_code: Option<String>,
    pub last_connected_at: Option<DateTime<Utc>>,
    pub message_count_today: i32,
    pub last_error: Option<String>,
    pub metrics: Option<SessionMetrics>,
}

#[derive(Debug, Serialize)]
pub struct SessionMetrics {
    pub messages_sent: i32,
    pub messages_received: i32,
    pub messages_delivered: i32,
    pub messages_read: i32,
    pub messages_failed: i32,
}

// ============================================
// WEBHOOK MODELS
// ============================================

#[derive(Debug, Deserialize)]
pub struct WebhookConfigRequest {
    pub name: String,
    pub url: String,
    pub secret: Option<String>,
    pub events: Vec<String>,
    pub headers: Option<HashMap<String, String>>,
    pub retry_count: Option<i32>,
    pub timeout_seconds: Option<i32>,
}

// ============================================
// LIST/PAGINATION MODELS
// ============================================

#[derive(Debug, Deserialize)]
pub struct ListQueryParams {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: i64,
    pub per_page: i64,
    pub total: i64,
    pub total_pages: i64,
}

// ============================================
// STATS MODELS
// ============================================

#[derive(Debug, Serialize)]
pub struct GatewayStatsResponse {
    pub date: NaiveDate,
    pub total_messages_sent: i32,
    pub total_messages_received: i32,
    pub total_messages_delivered: i32,
    pub total_messages_read: i32,
    pub total_messages_failed: i32,
    pub active_sessions: i32,
    pub new_contacts: i32,
    pub api_calls: i32,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total_sessions: i64,
    pub active_sessions: i64,
    pub connected_sessions: i64,
    pub messages_today: i64,
    pub messages_this_hour: i64,
    pub failed_messages_today: i64,
    pub queue_depth: i64,
    pub recent_errors: Vec<String>,
}

// ============================================
// DATABASE ROW STRUCTS (Internal)
// ============================================

#[derive(sqlx::FromRow)]
pub struct MessageRow {
    pub id: String,
    pub session_id: String,
    pub contact_id: Option<String>,
    pub direction: String,
    pub message_type: String,
    pub content: Option<String>,
    pub media_url: Option<String>,
    pub status: String,
    pub sent_at: Option<chrono::NaiveDateTime>,
    pub delivered_at: Option<chrono::NaiveDateTime>,
    pub read_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct ContactRow {
    pub id: String,
    pub phone: String,
    pub name: Option<String>,
    pub profile_pic_url: Option<String>,
    pub about: Option<String>,
    pub labels: Option<serde_json::Value>,
    pub is_blocked: Option<i32>,
    pub is_group: Option<i32>,
    pub last_chat_at: Option<chrono::NaiveDateTime>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct TemplateRow {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub content: String,
    pub variables: Option<serde_json::Value>,
    pub media_url: Option<String>,
    pub media_type: Option<String>,
    pub is_active: Option<i32>,
    pub usage_count: Option<i32>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct SessionRow {
    pub id: String,
    pub name: String,
    pub phone_number: Option<String>,
    pub status: Option<String>,
    pub last_connected_at: Option<chrono::NaiveDateTime>,
    pub message_count_today: Option<i32>,
    pub last_error: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(sqlx::FromRow)]
pub struct HealthRow {
    pub status: String,
    pub qr_code: Option<String>,
    pub qr_expires_at: Option<chrono::NaiveDateTime>,
    pub last_ping_at: Option<chrono::NaiveDateTime>,
    pub last_error: Option<String>,
    pub restart_count: Option<i32>,
    pub metrics: Option<serde_json::Value>,
}
