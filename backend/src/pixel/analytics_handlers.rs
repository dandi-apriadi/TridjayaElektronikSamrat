use crate::{
    auth::{authorize, Role},
    response::{json_ok, AppError},
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Response,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use sqlx::Row;

#[derive(Deserialize)]
pub struct AnalyticsQuery {
    #[serde(default = "default_period_type")]
    pub period_type: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

fn default_period_type() -> String {
    "daily".to_string()
}

#[derive(Deserialize)]
pub struct AuditQuery {
    pub action_type: Option<String>,
    pub resource_type: Option<String>,
    pub user_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// Platform monitoring dashboard analytics.
/// Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 18.3
pub async fn get_platform_monitoring_dashboard(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // Query pixel_analytics for all pixels within date range
    let pixel_analytics = sqlx::query(
        "SELECT pixel_id, SUM(total_events) as total_events, SUM(unique_users) as unique_users,
                SUM(page_views) as page_views, SUM(add_to_carts) as add_to_carts,
                SUM(purchases) as purchases, SUM(leads) as leads, SUM(total_revenue) as total_revenue,
                currency
         FROM pixel_analytics
         WHERE period_type = ? AND period_start >= ? AND period_end <= ?
         GROUP BY pixel_id, currency",
    )
    .bind(&period_type)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pixel analytics: {}", e);
        AppError::Internal
    })?;

    let pixel_data: Vec<serde_json::Value> = pixel_analytics
        .iter()
        .map(|row| {
            json!({
                "pixel_id": row.get::<String, _>("pixel_id"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "page_views": row.get::<i64, _>("page_views"),
                "add_to_carts": row.get::<i64, _>("add_to_carts"),
                "purchases": row.get::<i64, _>("purchases"),
                "leads": row.get::<i64, _>("leads"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    // Query campaign_analytics for all campaigns within date range
    let campaign_analytics = sqlx::query(
        "SELECT campaign_id, SUM(total_events) as total_events, SUM(unique_users) as unique_users,
                SUM(conversions) as conversions, AVG(conversion_rate) as avg_conversion_rate,
                SUM(total_revenue) as total_revenue, currency
         FROM campaign_analytics
         WHERE period_type = ? AND period_start >= ? AND period_end <= ?
         GROUP BY campaign_id, currency",
    )
    .bind(&period_type)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch campaign analytics: {}", e);
        AppError::Internal
    })?;

    let campaign_data: Vec<serde_json::Value> = campaign_analytics
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "conversions": row.get::<i64, _>("conversions"),
                "avg_conversion_rate": row.get::<f64, _>("avg_conversion_rate"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    // Real-time event count from last hour
    let realtime_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM pixel_events WHERE event_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    Ok(json_ok(
        "Platform monitoring dashboard analytics",
        json!({
            "pixel_analytics": pixel_data,
            "campaign_analytics": campaign_data,
            "realtime_events_last_hour": realtime_count,
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date
        }),
    ))
}

/// Get analytics for a specific pixel
/// Requirements: 11.2, 11.4
pub async fn get_pixel_analytics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(pixel_id): Path<String>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    let analytics = sqlx::query(
        "SELECT * FROM pixel_analytics
         WHERE pixel_id = ? AND period_type = ? AND period_start >= ? AND period_end <= ?
         ORDER BY period_start ASC",
    )
    .bind(&pixel_id)
    .bind(&period_type)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch pixel analytics: {}", e);
        AppError::Internal
    })?;

    let data: Vec<serde_json::Value> = analytics
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "pixel_id": row.get::<String, _>("pixel_id"),
                "period_type": row.get::<String, _>("period_type"),
                "period_start": row.get::<String, _>("period_start"),
                "period_end": row.get::<String, _>("period_end"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "page_views": row.get::<i64, _>("page_views"),
                "add_to_carts": row.get::<i64, _>("add_to_carts"),
                "purchases": row.get::<i64, _>("purchases"),
                "leads": row.get::<i64, _>("leads"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency"),
                "created_at": row.get::<String, _>("created_at"),
                "updated_at": row.get::<String, _>("updated_at")
            })
        })
        .collect();

    Ok(json_ok("Pixel analytics", json!({ "analytics": data })))
}

/// Get audit logs with filters
/// Requirements: 16.6
pub async fn get_audit_logs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AuditQuery>,
) -> Result<Response, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let mut sql = "SELECT id, user_id, action_type, resource_type, resource_id, old_value, new_value, ip_address, user_agent, metadata, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM pixel_audit_logs WHERE 1=1".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(action_type) = &query.action_type {
        sql.push_str(" AND action_type = ?");
        params.push(action_type.clone());
    }

    if let Some(resource_type) = &query.resource_type {
        sql.push_str(" AND resource_type = ?");
        params.push(resource_type.clone());
    }

    if let Some(user_id) = &query.user_id {
        sql.push_str(" AND user_id = ?");
        params.push(user_id.clone());
    }

    if let Some(start_date) = &query.start_date {
        sql.push_str(" AND created_at >= ?");
        params.push(start_date.clone());
    }

    if let Some(end_date) = &query.end_date {
        sql.push_str(" AND created_at <= ?");
        params.push(end_date.clone());
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT 1000");

    let mut query_builder = sqlx::query(&sql);
    for param in params {
        query_builder = query_builder.bind(param);
    }

    let logs = query_builder.fetch_all(&state.pool).await.map_err(|e| {
        tracing::error!("Failed to fetch audit logs: {}", e);
        AppError::Internal
    })?;

    let data: Vec<serde_json::Value> = logs
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "user_id": row.get::<Option<String>, _>("user_id"),
                "action_type": row.get::<String, _>("action_type"),
                "resource_type": row.get::<String, _>("resource_type"),
                "resource_id": row.get::<String, _>("resource_id"),
                "old_value": row.get::<Option<String>, _>("old_value"),
                "new_value": row.get::<Option<String>, _>("new_value"),
                "ip_address": row.get::<Option<String>, _>("ip_address"),
                "user_agent": row.get::<Option<String>, _>("user_agent"),
                "metadata": row.get::<String, _>("metadata"),
                "created_at": row.get::<String, _>("created_at")
            })
        })
        .collect();

    Ok(json_ok("Audit logs", json!({ "logs": data })))
}

/// Admin dashboard analytics
/// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
pub async fn get_admin_dashboard(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // Get campaign analytics only for campaigns the admin created
    let campaign_analytics = sqlx::query(
        "SELECT ca.*, c.name as campaign_name
         FROM campaign_analytics ca
         JOIN campaigns c ON ca.campaign_id = c.id
         WHERE c.admin_id = ? AND ca.period_type = ? AND ca.period_start >= ? AND ca.period_end <= ?
         ORDER BY ca.period_start ASC",
    )
    .bind(&user.id)
    .bind(&period_type)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch admin campaign analytics: {}", e);
        AppError::Internal
    })?;

    let campaign_data: Vec<serde_json::Value> = campaign_analytics
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "campaign_name": row.get::<String, _>("campaign_name"),
                "period_type": row.get::<String, _>("period_type"),
                "period_start": row.get::<String, _>("period_start"),
                "period_end": row.get::<String, _>("period_end"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "conversions": row.get::<i64, _>("conversions"),
                "conversion_rate": row.get::<f64, _>("conversion_rate"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    // Get conversion funnel data: PageView → AddToCart → Purchase
    let funnel_data = sqlx::query(
        "SELECT 
            c.id as campaign_id,
            c.name as campaign_name,
            SUM(CASE WHEN pe.event_type = 'PageView' THEN 1 ELSE 0 END) as page_views,
            SUM(CASE WHEN pe.event_type = 'AddToCart' THEN 1 ELSE 0 END) as add_to_carts,
            SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) as purchases
         FROM campaigns c
         LEFT JOIN pixel_events pe ON c.id = pe.campaign_id
         WHERE c.admin_id = ? AND pe.event_time >= ? AND pe.event_time <= ?
         GROUP BY c.id, c.name",
    )
    .bind(&user.id)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch funnel data: {}", e);
        AppError::Internal
    })?;

    let funnel: Vec<serde_json::Value> = funnel_data
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "campaign_name": row.get::<String, _>("campaign_name"),
                "page_views": row.get::<i64, _>("page_views"),
                "add_to_carts": row.get::<i64, _>("add_to_carts"),
                "purchases": row.get::<i64, _>("purchases")
            })
        })
        .collect();

    // Get top campaigns ranked by conversion rate
    let top_campaigns = sqlx::query(
        "SELECT ca.campaign_id, c.name as campaign_name, AVG(ca.conversion_rate) as avg_conversion_rate,
                SUM(ca.total_revenue) as total_revenue, ca.currency
         FROM campaign_analytics ca
         JOIN campaigns c ON ca.campaign_id = c.id
         WHERE c.admin_id = ? AND ca.period_type = ? AND ca.period_start >= ? AND ca.period_end <= ?
         GROUP BY ca.campaign_id, c.name, ca.currency
         ORDER BY avg_conversion_rate DESC
         LIMIT 10",
    )
    .bind(&user.id)
    .bind(&period_type)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch top campaigns: {}", e);
        AppError::Internal
    })?;

    let top: Vec<serde_json::Value> = top_campaigns
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "campaign_name": row.get::<String, _>("campaign_name"),
                "avg_conversion_rate": row.get::<f64, _>("avg_conversion_rate"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    Ok(json_ok(
        "Admin dashboard analytics",
        json!({
            "campaign_analytics": campaign_data,
            "conversion_funnel": funnel,
            "top_campaigns": top,
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date
        }),
    ))
}

/// Get analytics for a specific campaign
/// Requirements: 12.3, 12.4
pub async fn get_campaign_analytics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign_id): Path<String>,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    // Verify admin owns the campaign
    let campaign =
        sqlx::query_as::<_, (String,)>("SELECT id FROM campaigns WHERE id = ? AND admin_id = ?")
            .bind(&campaign_id)
            .bind(&user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to verify campaign ownership: {}", e);
                AppError::Internal
            })?;

    if campaign.is_none() {
        return Err(AppError::NotFound);
    }

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    let analytics = sqlx::query(
        "SELECT * FROM campaign_analytics
         WHERE campaign_id = ? AND period_type = ? AND period_start >= ? AND period_end <= ?
         ORDER BY period_start ASC",
    )
    .bind(&campaign_id)
    .bind(&period_type)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch campaign analytics: {}", e);
        AppError::Internal
    })?;

    let data: Vec<serde_json::Value> = analytics
        .iter()
        .map(|row| {
            json!({
                "id": row.get::<String, _>("id"),
                "campaign_id": row.get::<String, _>("campaign_id"),
                "period_type": row.get::<String, _>("period_type"),
                "period_start": row.get::<String, _>("period_start"),
                "period_end": row.get::<String, _>("period_end"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "conversions": row.get::<i64, _>("conversions"),
                "conversion_rate": row.get::<f64, _>("conversion_rate"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency"),
                "created_at": row.get::<String, _>("created_at"),
                "updated_at": row.get::<String, _>("updated_at")
            })
        })
        .collect();

    Ok(json_ok("Campaign analytics", json!({ "analytics": data })))
}

/// Agent pixel analytics
/// Requirements: 13.1, 13.4, 13.5
pub async fn get_agent_pixel_analytics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // Get campaign-level metrics for events where user_id matches the agent
    let analytics = sqlx::query(
        "SELECT 
            c.id as campaign_id,
            c.name as campaign_name,
            COUNT(pe.id) as total_events,
            COUNT(DISTINCT pe.fbp) as unique_users,
            SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) as conversions,
            CAST(COALESCE(SUM(conv.conversion_value), 0.0) AS DOUBLE) as total_revenue,
            COALESCE(MAX(conv.currency), 'USD') as currency
         FROM pixel_events pe
         JOIN campaigns c ON pe.campaign_id = c.id
         LEFT JOIN conversions conv ON pe.id = conv.event_id
         WHERE pe.user_id = ? AND DATE(pe.event_time) >= ? AND DATE(pe.event_time) <= ?
         GROUP BY c.id, c.name",
    )
    .bind(&user.id)
    .bind(&start_date)
    .bind(&end_date)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch agent analytics: {}", e);
        AppError::Internal
    })?;

    let data: Vec<serde_json::Value> = analytics
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "campaign_name": row.get::<String, _>("campaign_name"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "conversions": row.get::<i64, _>("conversions"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    Ok(json_ok(
        "Agent analytics",
        json!({
            "analytics": data,
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date
        }),
    ))
}

/// Sales pixel analytics
/// Requirements: 13.2, 13.4, 13.5
pub async fn get_sales_pixel_analytics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Sales]).await?;

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // Get campaign-level metrics for campaigns tagged with the sales user's identifier
    // We'll use utm_admin to match the sales user
    let sales_identifier = format!("sales_{}", &user.id[..8]);

    let analytics = sqlx::query(
        "SELECT 
            c.id as campaign_id,
            c.name as campaign_name,
            COUNT(pe.id) as total_events,
            COUNT(DISTINCT pe.fbp) as unique_users,
            SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) as conversions,
            CAST(COALESCE(SUM(conv.conversion_value), 0.0) AS DOUBLE) as total_revenue,
            COALESCE(MAX(conv.currency), 'USD') as currency
         FROM campaigns c
         LEFT JOIN pixel_events pe ON c.id = pe.campaign_id AND DATE(pe.event_time) >= ? AND DATE(pe.event_time) <= ?
         LEFT JOIN conversions conv ON pe.id = conv.event_id
         WHERE c.utm_admin LIKE ?
         GROUP BY c.id, c.name",
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(format!("%{}%", sales_identifier))
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch sales analytics: {}", e);
        AppError::Internal
    })?;

    let data: Vec<serde_json::Value> = analytics
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "campaign_name": row.get::<String, _>("campaign_name"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "conversions": row.get::<i64, _>("conversions"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    Ok(json_ok(
        "Sales analytics",
        json!({
            "analytics": data,
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date
        }),
    ))
}

/// Operator pixel analytics
/// Requirements: 13.3, 13.4, 13.5
pub async fn get_operator_pixel_analytics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AnalyticsQuery>,
) -> Result<Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Operator]).await?;

    let period_type = query.period_type;
    let start_date = query.start_date.unwrap_or_else(|| {
        (Utc::now() - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string()
    });
    let end_date = query
        .end_date
        .unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    // Get campaign-level metrics for campaigns the operator has permission to view
    // Check pixel_admins.permissions for view access
    let analytics = sqlx::query(
        "SELECT 
            c.id as campaign_id,
            c.name as campaign_name,
            COUNT(pe.id) as total_events,
            COUNT(DISTINCT pe.fbp) as unique_users,
            SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) as conversions,
            CAST(COALESCE(SUM(conv.conversion_value), 0.0) AS DOUBLE) as total_revenue,
            COALESCE(MAX(conv.currency), 'USD') as currency
         FROM campaigns c
         JOIN pixel_admins pa ON c.pixel_id = pa.pixel_id
         LEFT JOIN pixel_events pe ON c.id = pe.campaign_id AND DATE(pe.event_time) >= ? AND DATE(pe.event_time) <= ?
         LEFT JOIN conversions conv ON pe.id = conv.event_id
         WHERE pa.user_id = ?
         GROUP BY c.id, c.name",
    )
    .bind(&start_date)
    .bind(&end_date)
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch operator analytics: {}", e);
        AppError::Internal
    })?;

    let data: Vec<serde_json::Value> = analytics
        .iter()
        .map(|row| {
            json!({
                "campaign_id": row.get::<String, _>("campaign_id"),
                "campaign_name": row.get::<String, _>("campaign_name"),
                "total_events": row.get::<i64, _>("total_events"),
                "unique_users": row.get::<i64, _>("unique_users"),
                "conversions": row.get::<i64, _>("conversions"),
                "total_revenue": row.get::<f64, _>("total_revenue"),
                "currency": row.get::<String, _>("currency")
            })
        })
        .collect();

    Ok(json_ok(
        "Operator analytics",
        json!({
            "analytics": data,
            "period_type": period_type,
            "start_date": start_date,
            "end_date": end_date
        }),
    ))
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_period_type() {
        assert_eq!(default_period_type(), "daily");
    }

    #[test]
    fn test_analytics_query_defaults() {
        let query = AnalyticsQuery {
            period_type: default_period_type(),
            start_date: None,
            end_date: None,
        };
        assert_eq!(query.period_type, "daily");
        assert!(query.start_date.is_none());
        assert!(query.end_date.is_none());
    }

    #[test]
    fn test_audit_query_all_none() {
        let query = AuditQuery {
            action_type: None,
            resource_type: None,
            user_id: None,
            start_date: None,
            end_date: None,
        };
        assert!(query.action_type.is_none());
        assert!(query.resource_type.is_none());
        assert!(query.user_id.is_none());
    }

    // Note: Integration tests for the actual handler functions would require
    // a test database setup and are better suited for integration test files.
    // The handlers are tested through the full integration test suite.
}
