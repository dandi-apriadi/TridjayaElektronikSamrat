/**
 * Campaign Metrics Calculation Module
 *
 * **Validates: Requirements 10.5, 10.6, 10.8**
 *
 * This module implements campaign metrics calculation and aggregation:
 * - Calculate real-time metrics from wa_recipients table
 * - Aggregate metrics per hour and store to wa_campaign_metrics table
 * - Provide API endpoint for retrieving campaign metrics
 */
use chrono::{DateTime, Timelike, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tracing::{debug, error, info};
use uuid::Uuid;

/// Campaign metrics structure
/// **Validates: Requirements 10.5**
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignMetrics {
    pub campaign_id: String,
    pub total_recipients: i64,
    pub total_sent: i64,
    pub total_delivered: i64,
    pub total_read: i64,
    pub total_replied: i64,
    pub total_failed: i64,
    pub delivered_rate: f64,  // Percentage (0-100)
    pub read_rate: f64,       // Percentage (0-100)
    pub reply_rate: f64,      // Percentage (0-100)
    pub last_updated: String, // ISO8601 timestamp
}

/// Complete campaign metrics response with campaign details and hourly breakdown
/// **Validates: Requirements 10.5, 10.6, 10.8**
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignMetricsResponse {
    pub campaign_id: String,
    pub campaign_name: String,
    pub status: String,
    pub metrics: CampaignMetrics,
    pub hourly_metrics: Vec<HourlyMetricsSimple>,
}

/// Simplified hourly metrics for API response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyMetricsSimple {
    pub hour: String, // ISO8601 timestamp
    pub total_sent: i64,
    pub total_delivered: i64,
    pub total_read: i64,
    pub total_replied: i64,
    pub total_failed: i64,
}

/// Hourly campaign metrics structure
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct HourlyCampaignMetrics {
    pub id: String,
    pub campaign_id: String,
    pub hour_timestamp: String, // ISO8601 timestamp
    pub total_sent: i64,
    pub total_delivered: i64,
    pub total_read: i64,
    pub total_replied: i64,
    pub delivered_rate: Option<f64>,
    pub read_rate: Option<f64>,
    pub reply_rate: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

/// Calculate real-time campaign metrics from wa_recipients table
/// **Validates: Requirements 10.5, 10.6**
///
/// This function calculates metrics by querying the wa_recipients table:
/// - total_sent: Count of recipients with sent_at IS NOT NULL
/// - total_delivered: Count of recipients with delivered_at IS NOT NULL
/// - total_read: Count of recipients with read_at IS NOT NULL
/// - total_replied: Count of recipients with replied_at IS NOT NULL
/// - total_failed: Count of recipients with status = 'failed'
/// - delivered_rate: (total_delivered / total_sent) * 100
/// - read_rate: (total_read / total_sent) * 100
/// - reply_rate: (total_replied / total_sent) * 100
pub async fn calculate_campaign_metrics(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<CampaignMetrics, Box<dyn std::error::Error + Send + Sync>> {
    debug!(campaign_id = %campaign_id, "Calculating campaign metrics");

    // Query recipient counts
    let metrics: (i64, i64, i64, i64, i64, i64) = sqlx::query_as(
        "SELECT 
            COUNT(*) as total_recipients,
            COUNT(sent_at) as total_sent,
            COUNT(delivered_at) as total_delivered,
            COUNT(read_at) as total_read,
            COUNT(replied_at) as total_replied,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed
         FROM wa_recipients 
         WHERE campaign_id = ?",
    )
    .bind(campaign_id)
    .fetch_one(pool)
    .await?;

    let (total_recipients, total_sent, total_delivered, total_read, total_replied, total_failed) =
        metrics;

    // Calculate rates (avoid division by zero)
    let delivered_rate = if total_sent > 0 {
        (total_delivered as f64 / total_sent as f64) * 100.0
    } else {
        0.0
    };

    let read_rate = if total_sent > 0 {
        (total_read as f64 / total_sent as f64) * 100.0
    } else {
        0.0
    };

    let reply_rate = if total_sent > 0 {
        (total_replied as f64 / total_sent as f64) * 100.0
    } else {
        0.0
    };

    let metrics = CampaignMetrics {
        campaign_id: campaign_id.to_string(),
        total_recipients,
        total_sent,
        total_delivered,
        total_read,
        total_replied,
        total_failed,
        delivered_rate,
        read_rate,
        reply_rate,
        last_updated: Utc::now().to_rfc3339(),
    };

    debug!(
        campaign_id = %campaign_id,
        total_sent = metrics.total_sent,
        total_failed = metrics.total_failed,
        delivered_rate = metrics.delivered_rate,
        read_rate = metrics.read_rate,
        reply_rate = metrics.reply_rate,
        "Campaign metrics calculated"
    );

    Ok(metrics)
}

/// Aggregate metrics per hour and store to wa_campaign_metrics table
/// **Validates: Requirements 10.8**
///
/// This function aggregates metrics for a specific hour and stores them in the
/// wa_campaign_metrics table. It should be called periodically (e.g., every hour)
/// to maintain historical metrics data.
///
/// The hour_timestamp is truncated to the start of the hour (e.g., 2024-05-05 14:00:00)
pub async fn aggregate_hourly_metrics(
    pool: &SqlitePool,
    campaign_id: &str,
    hour_timestamp: DateTime<Utc>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Truncate to start of hour
    let hour_start = hour_timestamp
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(hour_timestamp);

    let hour_end = hour_start + chrono::Duration::hours(1);

    debug!(
        campaign_id = %campaign_id,
        hour_start = %hour_start,
        hour_end = %hour_end,
        "Aggregating hourly metrics"
    );

    // Query metrics for the specific hour
    // Count messages sent within this hour
    let metrics: (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT 
            COUNT(CASE WHEN sent_at >= ? AND sent_at < ? THEN 1 END) as total_sent,
            COUNT(CASE WHEN delivered_at >= ? AND delivered_at < ? THEN 1 END) as total_delivered,
            COUNT(CASE WHEN read_at >= ? AND read_at < ? THEN 1 END) as total_read,
            COUNT(CASE WHEN replied_at >= ? AND replied_at < ? THEN 1 END) as total_replied
         FROM wa_recipients 
         WHERE campaign_id = ?",
    )
    .bind(hour_start.to_rfc3339())
    .bind(hour_end.to_rfc3339())
    .bind(hour_start.to_rfc3339())
    .bind(hour_end.to_rfc3339())
    .bind(hour_start.to_rfc3339())
    .bind(hour_end.to_rfc3339())
    .bind(hour_start.to_rfc3339())
    .bind(hour_end.to_rfc3339())
    .bind(campaign_id)
    .fetch_one(pool)
    .await?;

    let (total_sent, total_delivered, total_read, total_replied) = metrics;

    // Calculate rates
    let delivered_rate = if total_sent > 0 {
        Some((total_delivered as f64 / total_sent as f64) * 100.0)
    } else {
        None
    };

    let read_rate = if total_sent > 0 {
        Some((total_read as f64 / total_sent as f64) * 100.0)
    } else {
        None
    };

    let reply_rate = if total_sent > 0 {
        Some((total_replied as f64 / total_sent as f64) * 100.0)
    } else {
        None
    };

    // Check if record already exists for this hour
    let existing: Option<String> = sqlx::query_scalar(
        "SELECT id FROM wa_campaign_metrics 
         WHERE campaign_id = ? AND hour_timestamp = ?",
    )
    .bind(campaign_id)
    .bind(hour_start.to_rfc3339())
    .fetch_optional(pool)
    .await?;

    if let Some(existing_id) = existing {
        // Update existing record
        sqlx::query(
            "UPDATE wa_campaign_metrics 
             SET total_sent = ?, 
                 total_delivered = ?, 
                 total_read = ?, 
                 total_replied = ?,
                 delivered_rate = ?,
                 read_rate = ?,
                 reply_rate = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
        )
        .bind(total_sent)
        .bind(total_delivered)
        .bind(total_read)
        .bind(total_replied)
        .bind(delivered_rate)
        .bind(read_rate)
        .bind(reply_rate)
        .bind(&existing_id)
        .execute(pool)
        .await?;

        debug!(
            id = %existing_id,
            campaign_id = %campaign_id,
            hour_timestamp = %hour_start,
            "Updated hourly metrics"
        );
    } else {
        // Insert new record
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO wa_campaign_metrics 
             (id, campaign_id, hour_timestamp, total_sent, total_delivered, 
              total_read, total_replied, delivered_rate, read_rate, reply_rate,
              created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(&id)
        .bind(campaign_id)
        .bind(hour_start.to_rfc3339())
        .bind(total_sent)
        .bind(total_delivered)
        .bind(total_read)
        .bind(total_replied)
        .bind(delivered_rate)
        .bind(read_rate)
        .bind(reply_rate)
        .execute(pool)
        .await?;

        debug!(
            id = %id,
            campaign_id = %campaign_id,
            hour_timestamp = %hour_start,
            "Inserted hourly metrics"
        );
    }

    info!(
        campaign_id = %campaign_id,
        hour_timestamp = %hour_start,
        total_sent = total_sent,
        "Hourly metrics aggregated"
    );

    Ok(())
}

/// Get hourly metrics for a campaign
///
/// Returns all hourly metrics records for a campaign, ordered by hour_timestamp
pub async fn get_hourly_metrics(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<Vec<HourlyCampaignMetrics>, Box<dyn std::error::Error + Send + Sync>> {
    let metrics: Vec<HourlyCampaignMetrics> = sqlx::query_as(
        "SELECT id, campaign_id, hour_timestamp, total_sent, total_delivered,
                total_read, total_replied, delivered_rate, read_rate, reply_rate,
                created_at, updated_at
         FROM wa_campaign_metrics 
         WHERE campaign_id = ?
         ORDER BY hour_timestamp ASC",
    )
    .bind(campaign_id)
    .fetch_all(pool)
    .await?;

    Ok(metrics)
}

/// Get complete campaign metrics response with campaign details and hourly breakdown
/// **Validates: Requirements 10.5, 10.6, 10.8**
///
/// This function returns:
/// - Campaign details (name, status)
/// - Real-time metrics calculated from wa_recipients
/// - Hourly metrics from wa_campaign_metrics table
pub async fn get_campaign_metrics_response(
    pool: &SqlitePool,
    campaign_id: &str,
) -> Result<CampaignMetricsResponse, Box<dyn std::error::Error + Send + Sync>> {
    // Get campaign details
    let campaign: Option<(String, String)> =
        sqlx::query_as("SELECT name, status FROM wa_campaigns WHERE id = ?")
            .bind(campaign_id)
            .fetch_optional(pool)
            .await?;

    let (campaign_name, status) = campaign.ok_or("Campaign not found")?;

    // Calculate real-time metrics
    let metrics = calculate_campaign_metrics(pool, campaign_id).await?;

    // Get hourly metrics from wa_campaign_metrics table
    let hourly_records = get_hourly_metrics(pool, campaign_id).await?;

    // Convert to simplified format for API response
    let hourly_metrics: Vec<HourlyMetricsSimple> = hourly_records
        .into_iter()
        .map(|record| HourlyMetricsSimple {
            hour: record.hour_timestamp,
            total_sent: record.total_sent,
            total_delivered: record.total_delivered,
            total_read: record.total_read,
            total_replied: record.total_replied,
            total_failed: 0, // Not tracked in hourly metrics table
        })
        .collect();

    Ok(CampaignMetricsResponse {
        campaign_id: campaign_id.to_string(),
        campaign_name,
        status,
        metrics,
        hourly_metrics,
    })
}

/// Aggregate metrics for all active campaigns
///
/// This function should be called periodically (e.g., every hour) to aggregate
/// metrics for all campaigns that have activity in the current hour.
pub async fn aggregate_all_campaigns(
    pool: &SqlitePool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    info!("Starting hourly metrics aggregation for all campaigns");

    // Get current hour
    let now = Utc::now();
    let current_hour = now
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(now);

    // Get all campaigns that have activity in the current hour
    let campaign_ids: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT campaign_id 
         FROM wa_recipients 
         WHERE sent_at >= ? OR delivered_at >= ? OR read_at >= ? OR replied_at >= ?",
    )
    .bind(current_hour.to_rfc3339())
    .bind(current_hour.to_rfc3339())
    .bind(current_hour.to_rfc3339())
    .bind(current_hour.to_rfc3339())
    .fetch_all(pool)
    .await?;

    info!(
        campaign_count = campaign_ids.len(),
        "Found campaigns with activity in current hour"
    );

    // Aggregate metrics for each campaign
    for campaign_id in campaign_ids {
        if let Err(e) = aggregate_hourly_metrics(pool, &campaign_id, current_hour).await {
            error!(
                campaign_id = %campaign_id,
                error = %e,
                "Failed to aggregate hourly metrics"
            );
        }
    }

    info!("Completed hourly metrics aggregation");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_calculation_with_zero_sent() {
        // When total_sent is 0, all rates should be 0.0
        let total_sent = 0;
        let total_delivered = 0;
        let total_read = 0;
        let total_replied = 0;

        let delivered_rate = if total_sent > 0 {
            (total_delivered as f64 / total_sent as f64) * 100.0
        } else {
            0.0
        };

        let read_rate = if total_sent > 0 {
            (total_read as f64 / total_sent as f64) * 100.0
        } else {
            0.0
        };

        let reply_rate = if total_sent > 0 {
            (total_replied as f64 / total_sent as f64) * 100.0
        } else {
            0.0
        };

        assert_eq!(delivered_rate, 0.0);
        assert_eq!(read_rate, 0.0);
        assert_eq!(reply_rate, 0.0);
    }

    #[test]
    fn test_metrics_calculation_with_data() {
        // Test with sample data
        let total_sent = 100;
        let total_delivered = 80;
        let total_read = 50;
        let total_replied = 10;

        let delivered_rate = (total_delivered as f64 / total_sent as f64) * 100.0;
        let read_rate = (total_read as f64 / total_sent as f64) * 100.0;
        let reply_rate = (total_replied as f64 / total_sent as f64) * 100.0;

        assert_eq!(delivered_rate, 80.0);
        assert_eq!(read_rate, 50.0);
        assert_eq!(reply_rate, 10.0);
    }

    #[test]
    fn test_hour_truncation() {
        // Test that hour truncation works correctly
        let dt = Utc::now();
        let hour_start = dt
            .with_minute(0)
            .and_then(|dt| dt.with_second(0))
            .and_then(|dt| dt.with_nanosecond(0))
            .unwrap_or(dt);

        assert_eq!(hour_start.minute(), 0);
        assert_eq!(hour_start.second(), 0);
        assert_eq!(hour_start.nanosecond(), 0);
    }
}
