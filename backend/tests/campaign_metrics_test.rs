/**
 * Campaign Metrics Tests
 *
 * **Validates: Requirements 10.5, 10.6, 10.8**
 *
 * This test suite validates:
 * - Real-time metrics calculation from wa_recipients table
 * - Hourly metrics aggregation to wa_campaign_metrics table
 * - API endpoint for retrieving campaign metrics
 * - Edge cases (no recipients, division by zero, campaign not found)
 */
use chrono::{Duration, Timelike, Utc};
use sqlx::MySqlPool;
use tridjaya_backend::campaign_metrics::{
    aggregate_hourly_metrics, calculate_campaign_metrics, get_campaign_metrics_response,
};
use uuid::Uuid;

mod support;

/// Helper function to create a test database pool
async fn create_test_pool() -> Option<MySqlPool> {
    support::setup_mysql_test_pool().await
}

/// Helper function to create a test campaign
async fn create_test_campaign(pool: &MySqlPool, name: &str) -> String {
    let campaign_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO wa_campaigns (id, name, status, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&campaign_id)
    .bind(name)
    .bind("active")
    .execute(pool)
    .await
    .expect("Failed to create test campaign");

    campaign_id
}

/// Helper function to create a test recipient
async fn create_test_recipient(
    pool: &MySqlPool,
    campaign_id: &str,
    phone: &str,
    status: &str,
    sent_at: Option<&str>,
    delivered_at: Option<&str>,
    read_at: Option<&str>,
    replied_at: Option<&str>,
) -> String {
    let recipient_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO wa_recipients 
         (id, campaign_id, phone, status, sent_at, delivered_at, read_at, replied_at, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(&recipient_id)
    .bind(campaign_id)
    .bind(phone)
    .bind(status)
    .bind(sent_at)
    .bind(delivered_at)
    .bind(read_at)
    .bind(replied_at)
    .execute(pool)
    .await
    .expect("Failed to create test recipient");

    recipient_id
}

#[tokio::test]
async fn test_calculate_metrics_with_no_recipients() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "Empty Campaign").await;

    let metrics = calculate_campaign_metrics(&pool, &campaign_id)
        .await
        .expect("Failed to calculate metrics");

    assert_eq!(metrics.total_recipients, 0);
    assert_eq!(metrics.total_sent, 0);
    assert_eq!(metrics.total_delivered, 0);
    assert_eq!(metrics.total_read, 0);
    assert_eq!(metrics.total_replied, 0);
    assert_eq!(metrics.total_failed, 0);
    assert_eq!(metrics.delivered_rate, 0.0);
    assert_eq!(metrics.read_rate, 0.0);
    assert_eq!(metrics.reply_rate, 0.0);
}

#[tokio::test]
async fn test_calculate_metrics_with_recipients() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "Test Campaign").await;

    let now = Utc::now().to_rfc3339();

    // Create 10 recipients with various statuses
    // 8 sent, 6 delivered, 4 read, 2 replied, 2 failed
    for i in 0..10 {
        let phone = format!("+628123456{:04}", i);
        let status = if i < 2 { "failed" } else { "sent" };
        let sent_at = if i >= 2 { Some(now.as_str()) } else { None };
        let delivered_at = if i >= 2 && i < 8 {
            Some(now.as_str())
        } else {
            None
        };
        let read_at = if i >= 2 && i < 6 {
            Some(now.as_str())
        } else {
            None
        };
        let replied_at = if i >= 2 && i < 4 {
            Some(now.as_str())
        } else {
            None
        };

        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            status,
            sent_at,
            delivered_at,
            read_at,
            replied_at,
        )
        .await;
    }

    let metrics = calculate_campaign_metrics(&pool, &campaign_id)
        .await
        .expect("Failed to calculate metrics");

    assert_eq!(metrics.total_recipients, 10);
    assert_eq!(metrics.total_sent, 8);
    assert_eq!(metrics.total_delivered, 6);
    assert_eq!(metrics.total_read, 4);
    assert_eq!(metrics.total_replied, 2);
    assert_eq!(metrics.total_failed, 2);

    // Calculate expected rates
    // delivered_rate = (6 / 8) * 100 = 75.0
    // read_rate = (4 / 8) * 100 = 50.0
    // reply_rate = (2 / 8) * 100 = 25.0
    assert_eq!(metrics.delivered_rate, 75.0);
    assert_eq!(metrics.read_rate, 50.0);
    assert_eq!(metrics.reply_rate, 25.0);
}

#[tokio::test]
async fn test_calculate_metrics_division_by_zero() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "No Sent Campaign").await;

    // Create recipients that are pending (not sent)
    for i in 0..5 {
        let phone = format!("+628123456{:04}", i);
        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            "pending",
            None,
            None,
            None,
            None,
        )
        .await;
    }

    let metrics = calculate_campaign_metrics(&pool, &campaign_id)
        .await
        .expect("Failed to calculate metrics");

    assert_eq!(metrics.total_recipients, 5);
    assert_eq!(metrics.total_sent, 0);
    // Rates should be 0.0 when total_sent is 0 (avoid division by zero)
    assert_eq!(metrics.delivered_rate, 0.0);
    assert_eq!(metrics.read_rate, 0.0);
    assert_eq!(metrics.reply_rate, 0.0);
}

#[tokio::test]
async fn test_aggregate_hourly_metrics() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "Hourly Test Campaign").await;

    let now = Utc::now();
    let hour_start = now
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(now);

    // Create recipients with timestamps in the current hour
    for i in 0..5 {
        let phone = format!("+628123456{:04}", i);
        let timestamp = (hour_start + Duration::minutes(i * 10)).to_rfc3339();
        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            "sent",
            Some(&timestamp),
            Some(&timestamp),
            if i < 3 { Some(&timestamp) } else { None },
            if i < 2 { Some(&timestamp) } else { None },
        )
        .await;
    }

    // Aggregate metrics for the current hour
    aggregate_hourly_metrics(&pool, &campaign_id, hour_start)
        .await
        .expect("Failed to aggregate hourly metrics");

    // Verify the aggregated metrics were stored
    let hourly_metrics: (i64, i64, i64, i64) = sqlx::query_as(
        "SELECT total_sent, total_delivered, total_read, total_replied 
         FROM wa_campaign_metrics 
         WHERE campaign_id = ? AND hour_timestamp = ?",
    )
    .bind(&campaign_id)
    .bind(hour_start.to_rfc3339())
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch hourly metrics");

    let (total_sent, total_delivered, total_read, total_replied) = hourly_metrics;

    assert_eq!(total_sent, 5);
    assert_eq!(total_delivered, 5);
    assert_eq!(total_read, 3);
    assert_eq!(total_replied, 2);
}

#[tokio::test]
async fn test_aggregate_hourly_metrics_update_existing() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "Update Test Campaign").await;

    let now = Utc::now();
    let hour_start = now
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(now);

    let timestamp = hour_start.to_rfc3339();

    // Create initial recipients
    for i in 0..3 {
        let phone = format!("+628123456{:04}", i);
        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            "sent",
            Some(&timestamp),
            Some(&timestamp),
            None,
            None,
        )
        .await;
    }

    // First aggregation
    aggregate_hourly_metrics(&pool, &campaign_id, hour_start)
        .await
        .expect("Failed to aggregate hourly metrics");

    // Verify initial metrics
    let initial_metrics: (i64, i64) = sqlx::query_as(
        "SELECT total_sent, total_delivered 
         FROM wa_campaign_metrics 
         WHERE campaign_id = ? AND hour_timestamp = ?",
    )
    .bind(&campaign_id)
    .bind(hour_start.to_rfc3339())
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch initial metrics");

    assert_eq!(initial_metrics.0, 3);
    assert_eq!(initial_metrics.1, 3);

    // Add more recipients
    for i in 3..5 {
        let phone = format!("+628123456{:04}", i);
        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            "sent",
            Some(&timestamp),
            Some(&timestamp),
            None,
            None,
        )
        .await;
    }

    // Second aggregation (should update existing record)
    aggregate_hourly_metrics(&pool, &campaign_id, hour_start)
        .await
        .expect("Failed to aggregate hourly metrics");

    // Verify updated metrics
    let updated_metrics: (i64, i64) = sqlx::query_as(
        "SELECT total_sent, total_delivered 
         FROM wa_campaign_metrics 
         WHERE campaign_id = ? AND hour_timestamp = ?",
    )
    .bind(&campaign_id)
    .bind(hour_start.to_rfc3339())
    .fetch_one(&pool)
    .await
    .expect("Failed to fetch updated metrics");

    assert_eq!(updated_metrics.0, 5);
    assert_eq!(updated_metrics.1, 5);

    // Verify only one record exists for this hour
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM wa_campaign_metrics 
         WHERE campaign_id = ? AND hour_timestamp = ?",
    )
    .bind(&campaign_id)
    .bind(hour_start.to_rfc3339())
    .fetch_one(&pool)
    .await
    .expect("Failed to count metrics records");

    assert_eq!(count, 1);
}

#[tokio::test]
async fn test_get_campaign_metrics_response() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "Full Response Test").await;

    let now = Utc::now();
    let timestamp = now.to_rfc3339();

    // Create recipients
    for i in 0..10 {
        let phone = format!("+628123456{:04}", i);
        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            "sent",
            Some(&timestamp),
            if i < 8 { Some(&timestamp) } else { None },
            if i < 5 { Some(&timestamp) } else { None },
            if i < 2 { Some(&timestamp) } else { None },
        )
        .await;
    }

    // Aggregate hourly metrics
    let hour_start = now
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0))
        .unwrap_or(now);
    aggregate_hourly_metrics(&pool, &campaign_id, hour_start)
        .await
        .expect("Failed to aggregate hourly metrics");

    // Get complete response
    let response = get_campaign_metrics_response(&pool, &campaign_id)
        .await
        .expect("Failed to get campaign metrics response");

    assert_eq!(response.campaign_id, campaign_id);
    assert_eq!(response.campaign_name, "Full Response Test");
    assert_eq!(response.status, "active");

    assert_eq!(response.metrics.total_recipients, 10);
    assert_eq!(response.metrics.total_sent, 10);
    assert_eq!(response.metrics.total_delivered, 8);
    assert_eq!(response.metrics.total_read, 5);
    assert_eq!(response.metrics.total_replied, 2);

    assert_eq!(response.metrics.delivered_rate, 80.0);
    assert_eq!(response.metrics.read_rate, 50.0);
    assert_eq!(response.metrics.reply_rate, 20.0);

    // Verify hourly metrics are included
    assert_eq!(response.hourly_metrics.len(), 1);
    assert_eq!(response.hourly_metrics[0].total_sent, 10);
    assert_eq!(response.hourly_metrics[0].total_delivered, 8);
}

#[tokio::test]
async fn test_get_campaign_metrics_response_not_found() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let non_existent_id = Uuid::new_v4().to_string();

    let result = get_campaign_metrics_response(&pool, &non_existent_id).await;

    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("not found"));
}

#[tokio::test]
async fn test_metrics_with_100_percent_rates() {
    let Some(pool) = create_test_pool().await else {
        return;
    };
    let campaign_id = create_test_campaign(&pool, "Perfect Campaign").await;

    let now = Utc::now().to_rfc3339();

    // Create 5 recipients where all are sent, delivered, read, and replied
    for i in 0..5 {
        let phone = format!("+628123456{:04}", i);
        create_test_recipient(
            &pool,
            &campaign_id,
            &phone,
            "sent",
            Some(&now),
            Some(&now),
            Some(&now),
            Some(&now),
        )
        .await;
    }

    let metrics = calculate_campaign_metrics(&pool, &campaign_id)
        .await
        .expect("Failed to calculate metrics");

    assert_eq!(metrics.total_sent, 5);
    assert_eq!(metrics.total_delivered, 5);
    assert_eq!(metrics.total_read, 5);
    assert_eq!(metrics.total_replied, 5);
    assert_eq!(metrics.delivered_rate, 100.0);
    assert_eq!(metrics.read_rate, 100.0);
    assert_eq!(metrics.reply_rate, 100.0);
}
