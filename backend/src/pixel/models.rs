// ============================================================
// DB Row Structs
// ============================================================

/// Represents a row in the `pixels` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct PixelRecord {
    pub id: String,
    pub pixel_id: String,
    pub name: String,
    pub business_manager_id: Option<String>,
    pub status: String,
    /// Encrypted access token (AES-256-GCM).
    pub access_token: String,
    pub created_by: String,
    /// JSON configuration blob.
    pub config: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a row in the `pixel_admins` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct PixelAdminRecord {
    pub id: String,
    pub pixel_id: String,
    pub user_id: String,
    /// JSON permissions blob.
    pub permissions: String,
    pub assigned_at: String,
    pub assigned_by: String,
}

/// Represents a row in the `campaigns` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct CampaignRecord {
    pub id: String,
    pub campaign_id: String,
    pub pixel_id: String,
    pub admin_id: String,
    pub name: String,
    pub status: String,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_admin: Option<String>,
    pub utm_content: Option<String>,
    pub utm_term: Option<String>,
    /// JSON configuration blob.
    pub config: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a row in the `custom_conversions` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct CustomConversionRecord {
    pub id: String,
    pub campaign_id: String,
    pub name: String,
    pub event_type: String,
    /// JSON rules blob.
    pub rules: String,
    pub conversion_value: f64,
    pub currency: String,
    pub created_at: String,
}

/// Represents a row in the `pixel_events` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct PixelEventRecord {
    pub id: String,
    pub event_id: String,
    pub pixel_id: String,
    pub campaign_id: Option<String>,
    pub user_id: Option<String>,
    pub event_type: String,
    pub event_source_url: Option<String>,
    pub referrer_url: Option<String>,
    pub user_agent: Option<String>,
    /// Hashed IP address (SHA-256).
    pub ip_address: Option<String>,
    pub fbp: Option<String>,
    pub fbc: Option<String>,
    /// JSON user data blob.
    pub user_data: String,
    /// JSON custom data blob.
    pub custom_data: String,
    /// JSON UTM parameters blob.
    pub utm_params: String,
    pub sent_to_meta: i64,
    pub meta_event_id: Option<String>,
    pub retry_count: i64,
    pub error_message: Option<String>,
    pub event_time: String,
    pub created_at: String,
}

/// Represents a row in the `conversions` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct ConversionRecord {
    pub id: String,
    pub event_id: String,
    pub campaign_id: String,
    pub custom_conversion_id: Option<String>,
    pub conversion_type: String,
    pub conversion_value: f64,
    pub currency: String,
    pub order_id: Option<String>,
    /// JSON custom data blob.
    pub custom_data: String,
    pub conversion_time: String,
    pub created_at: String,
}

/// Represents a row in the `pixel_analytics` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct PixelAnalyticsRecord {
    pub id: String,
    pub pixel_id: String,
    pub period_type: String,
    pub period_start: String,
    pub period_end: String,
    pub total_events: i64,
    pub unique_users: i64,
    pub page_views: i64,
    pub add_to_carts: i64,
    pub purchases: i64,
    pub leads: i64,
    pub total_revenue: f64,
    pub currency: String,
    /// JSON metrics blob.
    pub metrics: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a row in the `campaign_analytics` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct CampaignAnalyticsRecord {
    pub id: String,
    pub campaign_id: String,
    pub period_type: String,
    pub period_start: String,
    pub period_end: String,
    pub total_events: i64,
    pub unique_users: i64,
    pub conversions: i64,
    pub conversion_rate: f64,
    pub total_revenue: f64,
    pub currency: String,
    pub cost_per_conversion: Option<f64>,
    pub roas: Option<f64>,
    /// JSON metrics blob.
    pub metrics: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Represents a row in the `pixel_audit_logs` table.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
pub struct AuditLogRecord {
    pub id: String,
    pub user_id: Option<String>,
    pub action_type: String,
    pub resource_type: String,
    pub resource_id: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    /// JSON metadata blob.
    pub metadata: String,
    pub created_at: String,
}

// ============================================================
// Request / Response DTOs
// ============================================================

/// Request body for creating a new pixel.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct CreatePixelRequest {
    pub pixel_id: String,
    pub name: String,
    pub business_manager_id: Option<String>,
    pub access_token: String,
    pub config: Option<serde_json::Value>,
}

/// Request body for updating an existing pixel.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct UpdatePixelRequest {
    pub name: Option<String>,
    pub business_manager_id: Option<String>,
    pub status: Option<String>,
    pub access_token: Option<String>,
    pub config: Option<serde_json::Value>,
}

/// Request body for assigning an admin to a pixel.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct AssignAdminRequest {
    pub user_id: String,
    pub permissions: Option<serde_json::Value>,
}

/// Request body for creating a new campaign.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct CreateCampaignRequest {
    pub pixel_id: String,
    pub name: String,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_content: Option<String>,
    pub utm_term: Option<String>,
    pub config: Option<serde_json::Value>,
}

/// Request body for updating an existing campaign.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct UpdateCampaignRequest {
    pub name: Option<String>,
    pub utm_source: Option<String>,
    pub utm_medium: Option<String>,
    pub utm_campaign: Option<String>,
    pub utm_content: Option<String>,
    pub utm_term: Option<String>,
    pub status: Option<String>,
    pub config: Option<serde_json::Value>,
}

/// Request body for creating a custom conversion rule.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct CreateCustomConversionRequest {
    pub name: String,
    pub event_type: String,
    pub rules: serde_json::Value,
    pub conversion_value: Option<f64>,
    pub currency: Option<String>,
}

/// Request body for ingesting a pixel event (public endpoint).
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct PixelEventRequest {
    pub pixel_id: String,
    pub event_type: String,
    pub event_source_url: Option<String>,
    pub referrer_url: Option<String>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
    pub fbp: Option<String>,
    pub fbc: Option<String>,
    pub user_data: Option<serde_json::Value>,
    pub custom_data: Option<serde_json::Value>,
    /// Unix timestamp (seconds). If omitted, server time is used.
    pub event_time: Option<i64>,
}

/// Request body for sending a test event to Meta CAPI.
#[derive(serde::Deserialize, serde::Serialize, Clone)]
pub struct TestEventRequest {
    pub pixel_id: String,
    pub event_type: String,
    pub event_source_url: Option<String>,
    pub user_agent: Option<String>,
    pub fbp: Option<String>,
    pub fbc: Option<String>,
    pub user_data: Option<serde_json::Value>,
    pub custom_data: Option<serde_json::Value>,
    pub test_event_code: String,
}
