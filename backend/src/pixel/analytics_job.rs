use crate::state::AppState;
use chrono::{Datelike, Duration, NaiveDate, Timelike, Utc};
use sqlx::SqlitePool;
use std::sync::atomic::Ordering;
use thiserror::Error;
use uuid::Uuid;

// ─── Error type ───────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum AnalyticsError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Job already running")]
    AlreadyRunning,
}

// ─── Guard that resets the AtomicBool on drop ─────────────────────────────────

struct JobGuard<'a>(&'a std::sync::atomic::AtomicBool);

impl<'a> Drop for JobGuard<'a> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

// ─── Period helpers ───────────────────────────────────────────────────────────

/// Returns `(period_start, period_end)` as `"YYYY-MM-DD"` strings for the
/// given `period_type` relative to the current UTC time.
fn current_period(period_type: &str) -> (String, String) {
    let now = Utc::now();
    let today = now.date_naive();

    match period_type {
        "hourly" => {
            // Truncate to the current hour; end = start + 1 hour.
            // We represent hourly periods as "YYYY-MM-DD HH:00:00" but the
            // schema stores DATE columns, so we use the date string and rely
            // on the SQL comparison against event_time (DATETIME).
            // For the period_start / period_end stored in the analytics table
            // we use the ISO-8601 datetime string truncated to the hour.
            let hour_start = now
                .date_naive()
                .and_hms_opt(now.hour(), 0, 0)
                .unwrap_or_else(|| today.and_hms_opt(0, 0, 0).unwrap());
            let hour_end = hour_start + Duration::hours(1);
            (
                hour_start.format("%Y-%m-%d %H:%M:%S").to_string(),
                hour_end.format("%Y-%m-%d %H:%M:%S").to_string(),
            )
        }
        "daily" => {
            let tomorrow = today + Duration::days(1);
            (today.to_string(), tomorrow.to_string())
        }
        "weekly" => {
            // ISO week: Monday is day 0 (num_days_from_monday).
            let days_from_monday = today.weekday().num_days_from_monday();
            let monday = today - Duration::days(days_from_monday as i64);
            let next_monday = monday + Duration::days(7);
            (monday.to_string(), next_monday.to_string())
        }
        "monthly" => {
            let first_of_month =
                NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap_or(today);
            // First day of next month.
            let (next_year, next_month) = if today.month() == 12 {
                (today.year() + 1, 1u32)
            } else {
                (today.year(), today.month() + 1)
            };
            let first_of_next_month =
                NaiveDate::from_ymd_opt(next_year, next_month, 1).unwrap_or(today);
            (first_of_month.to_string(), first_of_next_month.to_string())
        }
        _ => {
            // Fallback: treat as daily.
            let tomorrow = today + Duration::days(1);
            (today.to_string(), tomorrow.to_string())
        }
    }
}

// ─── Main aggregation function ────────────────────────────────────────────────

/// Run the analytics aggregation job.
///
/// Uses an `AtomicBool` guard to prevent concurrent runs.  Aggregates
/// `pixel_analytics` and `campaign_analytics` for all four period types
/// (hourly, daily, weekly, monthly) using `INSERT OR REPLACE` upserts.
pub async fn run_analytics_aggregation(
    pool: &SqlitePool,
    state: &AppState,
) -> Result<(), AnalyticsError> {
    // ── 1. Prevent concurrent runs ────────────────────────────────────────────
    state
        .analytics_job_running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .map_err(|_| {
            tracing::warn!("Analytics aggregation job is already running — skipping");
            AnalyticsError::AlreadyRunning
        })?;

    // ── 2. Defer-style reset via Drop ─────────────────────────────────────────
    let _guard = JobGuard(&state.analytics_job_running);

    // ── 3. Log start ──────────────────────────────────────────────────────────
    tracing::info!("Analytics aggregation job starting at {}", Utc::now());
    let start = std::time::Instant::now();

    // ── 4. Aggregate for each period type ─────────────────────────────────────
    for period_type in &["hourly", "daily", "weekly", "monthly"] {
        let (period_start, period_end) = current_period(period_type);

        // ── 4a. pixel_analytics ───────────────────────────────────────────────
        let new_pixel_uuid = Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT OR REPLACE INTO pixel_analytics
                 (id, pixel_id, period_type, period_start, period_end,
                  total_events, unique_users, page_views, add_to_carts,
                  purchases, leads, total_revenue, currency, metrics,
                  created_at, updated_at)
               SELECT
                 COALESCE(
                   (SELECT id FROM pixel_analytics WHERE pixel_id = p.id AND period_type = ? AND period_start = ?),
                   ?
                 ) AS id,
                 p.id AS pixel_id,
                 ? AS period_type,
                 ? AS period_start,
                 ? AS period_end,
                 COUNT(pe.id) AS total_events,
                 COUNT(DISTINCT COALESCE(pe.fbp, pe.user_id)) AS unique_users,
                 SUM(CASE WHEN pe.event_type = 'PageView' THEN 1 ELSE 0 END) AS page_views,
                 SUM(CASE WHEN pe.event_type = 'AddToCart' THEN 1 ELSE 0 END) AS add_to_carts,
                 SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) AS purchases,
                 SUM(CASE WHEN pe.event_type = 'Lead' THEN 1 ELSE 0 END) AS leads,
                 COALESCE(SUM(c.conversion_value), 0) AS total_revenue,
                 'USD' AS currency,
                 '{}' AS metrics,
                 COALESCE(
                   (SELECT created_at FROM pixel_analytics WHERE pixel_id = p.id AND period_type = ? AND period_start = ?),
                   CURRENT_TIMESTAMP
                 ) AS created_at,
                 CURRENT_TIMESTAMP AS updated_at
               FROM pixels p
               LEFT JOIN pixel_events pe ON pe.pixel_id = p.id
                 AND pe.event_time >= ? AND pe.event_time < ?
               LEFT JOIN conversions c ON c.event_id = pe.id
               GROUP BY p.id"#,
        )
        .bind(period_type)       // 1 — COALESCE subquery period_type
        .bind(&period_start)     // 2 — COALESCE subquery period_start
        .bind(&new_pixel_uuid)   // 3 — fallback new UUID
        .bind(period_type)       // 4 — period_type column
        .bind(&period_start)     // 5 — period_start column
        .bind(&period_end)       // 6 — period_end column
        .bind(period_type)       // 7 — created_at COALESCE subquery period_type
        .bind(&period_start)     // 8 — created_at COALESCE subquery period_start
        .bind(&period_start)     // 9 — event_time >= period_start
        .bind(&period_end)       // 10 — event_time < period_end
        .execute(pool)
        .await?;

        // ── 4b. campaign_analytics ────────────────────────────────────────────
        let new_campaign_uuid = Uuid::new_v4().to_string();
        sqlx::query(
            r#"INSERT OR REPLACE INTO campaign_analytics
                 (id, campaign_id, period_type, period_start, period_end,
                  total_events, unique_users, conversions, conversion_rate,
                  total_revenue, currency, cost_per_conversion, roas, metrics,
                  created_at, updated_at)
               SELECT
                 COALESCE(
                   (SELECT id FROM campaign_analytics WHERE campaign_id = c.id AND period_type = ? AND period_start = ?),
                   ?
                 ) AS id,
                 c.id AS campaign_id,
                 ? AS period_type,
                 ? AS period_start,
                 ? AS period_end,
                 COUNT(pe.id) AS total_events,
                 COUNT(DISTINCT COALESCE(pe.fbp, pe.user_id)) AS unique_users,
                 COUNT(conv.id) AS conversions,
                 CASE WHEN COUNT(pe.id) > 0 THEN CAST(COUNT(conv.id) AS REAL) / COUNT(pe.id) ELSE 0 END AS conversion_rate,
                 COALESCE(SUM(conv.conversion_value), 0) AS total_revenue,
                 'USD' AS currency,
                 NULL AS cost_per_conversion,
                 NULL AS roas,
                 '{}' AS metrics,
                 COALESCE(
                   (SELECT created_at FROM campaign_analytics WHERE campaign_id = c.id AND period_type = ? AND period_start = ?),
                   CURRENT_TIMESTAMP
                 ) AS created_at,
                 CURRENT_TIMESTAMP AS updated_at
               FROM campaigns c
               LEFT JOIN pixel_events pe ON pe.campaign_id = c.id
                 AND pe.event_time >= ? AND pe.event_time < ?
               LEFT JOIN conversions conv ON conv.campaign_id = c.id
                 AND conv.conversion_time >= ? AND conv.conversion_time < ?
               GROUP BY c.id"#,
        )
        .bind(period_type)           // 1 — COALESCE subquery period_type
        .bind(&period_start)         // 2 — COALESCE subquery period_start
        .bind(&new_campaign_uuid)    // 3 — fallback new UUID
        .bind(period_type)           // 4 — period_type column
        .bind(&period_start)         // 5 — period_start column
        .bind(&period_end)           // 6 — period_end column
        .bind(period_type)           // 7 — created_at COALESCE subquery period_type
        .bind(&period_start)         // 8 — created_at COALESCE subquery period_start
        .bind(&period_start)         // 9 — pe.event_time >= period_start
        .bind(&period_end)           // 10 — pe.event_time < period_end
        .bind(&period_start)         // 11 — conv.conversion_time >= period_start
        .bind(&period_end)           // 12 — conv.conversion_time < period_end
        .execute(pool)
        .await?;
    }

    // ── 5. Update last_analytics_run ──────────────────────────────────────────
    *state.last_analytics_run.write().await = Some(Utc::now());

    // ── 6. Log completion ─────────────────────────────────────────────────────
    let elapsed = start.elapsed();
    tracing::info!("Analytics aggregation completed in {:?}", elapsed);
    if elapsed > std::time::Duration::from_secs(300) {
        tracing::warn!(
            "Analytics aggregation took longer than 5 minutes: {:?}",
            elapsed
        );
    }

    Ok(())
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Property 3: Analytics total_events equals COUNT of raw pixel_events ───
    //
    // We test the aggregation logic in isolation without a real database.
    // The property: if there are N events for a pixel in a period,
    // `total_events` should equal N.
    //
    // We also test the conversion_rate formula:
    //   conversion_rate = conversions / total_events  (when total_events > 0)
    //   conversion_rate = 0                           (when total_events == 0)
    //
    // **Validates: Requirements 10.2, 10.6**

    /// Simulate the aggregation COUNT logic in pure Rust.
    fn aggregate_total_events(event_times: &[&str], period_start: &str, period_end: &str) -> usize {
        event_times
            .iter()
            .filter(|&&t| t >= period_start && t < period_end)
            .count()
    }

    /// Simulate the conversion_rate formula used in the SQL query.
    fn compute_conversion_rate(total_events: u64, conversions: u64) -> f64 {
        if total_events > 0 {
            conversions as f64 / total_events as f64
        } else {
            0.0
        }
    }

    // ── total_events property tests ───────────────────────────────────────────

    #[test]
    fn total_events_equals_count_of_events_in_period() {
        // Property: total_events == number of events whose event_time falls
        // within [period_start, period_end).
        let events = vec![
            "2024-01-15 10:00:00",
            "2024-01-15 11:30:00",
            "2024-01-15 23:59:59",
        ];
        let count = aggregate_total_events(&events, "2024-01-15", "2024-01-16");
        assert_eq!(count, 3, "All 3 events are within the daily period");
    }

    #[test]
    fn total_events_excludes_events_outside_period() {
        let events = vec![
            "2024-01-14 23:59:59", // before period
            "2024-01-15 00:00:00", // exactly at start — included
            "2024-01-15 12:00:00", // within period
            "2024-01-16 00:00:00", // exactly at end — excluded (< not <=)
            "2024-01-16 01:00:00", // after period
        ];
        let count = aggregate_total_events(&events, "2024-01-15", "2024-01-16");
        assert_eq!(
            count, 2,
            "Only events at or after start and before end are counted"
        );
    }

    #[test]
    fn total_events_is_zero_when_no_events_in_period() {
        let events = vec!["2024-01-10 10:00:00", "2024-01-11 10:00:00"];
        let count = aggregate_total_events(&events, "2024-01-15", "2024-01-16");
        assert_eq!(count, 0, "No events in the period → total_events = 0");
    }

    #[test]
    fn total_events_is_zero_for_empty_event_list() {
        let events: Vec<&str> = vec![];
        let count = aggregate_total_events(&events, "2024-01-15", "2024-01-16");
        assert_eq!(count, 0, "Empty event list → total_events = 0");
    }

    #[test]
    fn total_events_property_n_events_yields_n_count() {
        // Property: inserting exactly N events in a period → total_events == N.
        for n in 0usize..=10 {
            let base = "2024-06-01 ";
            let events: Vec<String> = (0..n)
                .map(|i| format!("{}{:02}:00:00", base, i % 24))
                .collect();
            let event_refs: Vec<&str> = events.iter().map(String::as_str).collect();
            let count = aggregate_total_events(&event_refs, "2024-06-01", "2024-06-02");
            assert_eq!(
                count, n,
                "Expected total_events = {} for {} events in period",
                n, n
            );
        }
    }

    // ── conversion_rate property tests ────────────────────────────────────────

    #[test]
    fn conversion_rate_is_zero_when_no_events() {
        // Property: total_events == 0 → conversion_rate == 0.0 (no division by zero).
        let rate = compute_conversion_rate(0, 0);
        assert_eq!(rate, 0.0, "conversion_rate must be 0 when total_events = 0");
    }

    #[test]
    fn conversion_rate_is_zero_when_no_conversions() {
        let rate = compute_conversion_rate(100, 0);
        assert_eq!(rate, 0.0, "conversion_rate must be 0 when conversions = 0");
    }

    #[test]
    fn conversion_rate_equals_conversions_over_total_events() {
        // Property: conversion_rate = conversions / total_events.
        let rate = compute_conversion_rate(100, 25);
        assert!(
            (rate - 0.25).abs() < f64::EPSILON,
            "Expected conversion_rate = 0.25, got {}",
            rate
        );
    }

    #[test]
    fn conversion_rate_is_one_when_all_events_convert() {
        let rate = compute_conversion_rate(50, 50);
        assert!(
            (rate - 1.0).abs() < f64::EPSILON,
            "Expected conversion_rate = 1.0 when all events convert"
        );
    }

    #[test]
    fn conversion_rate_property_never_exceeds_one_for_valid_inputs() {
        // Property: conversion_rate <= 1.0 when conversions <= total_events.
        let cases: Vec<(u64, u64)> = vec![(1, 0), (1, 1), (10, 3), (100, 100), (1000, 999), (5, 5)];
        for (total, conv) in cases {
            let rate = compute_conversion_rate(total, conv);
            assert!(
                rate <= 1.0,
                "conversion_rate ({}) must not exceed 1.0 for total={}, conv={}",
                rate,
                total,
                conv
            );
        }
    }

    #[test]
    fn conversion_rate_property_always_non_negative() {
        // Property: conversion_rate >= 0.0 for all valid inputs.
        let cases: Vec<(u64, u64)> = vec![(0, 0), (1, 0), (1, 1), (100, 50)];
        for (total, conv) in cases {
            let rate = compute_conversion_rate(total, conv);
            assert!(
                rate >= 0.0,
                "conversion_rate must be non-negative for total={}, conv={}",
                total,
                conv
            );
        }
    }

    // ── Period computation tests ──────────────────────────────────────────────

    #[test]
    fn current_period_daily_end_is_one_day_after_start() {
        let (start, end) = current_period("daily");
        let start_date = NaiveDate::parse_from_str(&start, "%Y-%m-%d")
            .expect("daily period_start must be YYYY-MM-DD");
        let end_date = NaiveDate::parse_from_str(&end, "%Y-%m-%d")
            .expect("daily period_end must be YYYY-MM-DD");
        assert_eq!(
            end_date - start_date,
            Duration::days(1),
            "daily period_end must be exactly 1 day after period_start"
        );
    }

    #[test]
    fn current_period_weekly_span_is_seven_days() {
        let (start, end) = current_period("weekly");
        let start_date = NaiveDate::parse_from_str(&start, "%Y-%m-%d")
            .expect("weekly period_start must be YYYY-MM-DD");
        let end_date = NaiveDate::parse_from_str(&end, "%Y-%m-%d")
            .expect("weekly period_end must be YYYY-MM-DD");
        assert_eq!(
            end_date - start_date,
            Duration::days(7),
            "weekly period must span exactly 7 days"
        );
    }

    #[test]
    fn current_period_monthly_start_is_first_of_month() {
        let (start, _end) = current_period("monthly");
        let start_date = NaiveDate::parse_from_str(&start, "%Y-%m-%d")
            .expect("monthly period_start must be YYYY-MM-DD");
        assert_eq!(
            start_date.day(),
            1,
            "monthly period_start must be the 1st of the month"
        );
    }

    #[test]
    fn current_period_hourly_produces_datetime_strings() {
        let (start, end) = current_period("hourly");
        // Hourly periods use datetime strings, not just dates.
        assert!(
            start.contains(':'),
            "hourly period_start should be a datetime string, got: {}",
            start
        );
        assert!(
            end.contains(':'),
            "hourly period_end should be a datetime string, got: {}",
            end
        );
    }

    // ── Property-based tests ──────────────────────────────────────────────────

    #[cfg(test)]
    mod proptests {
        use super::*;
        use proptest::prelude::*;

        // ── Property 8: Conversion rate bounds ────────────────────────────────
        //
        // **Property 8: Conversion rate bounds — `conversion_rate` is always in
        // `[0.0, 1.0]` and equals `conversions / total_events` when `total_events > 0`**
        //
        // **Validates: Requirements 10.7**

        proptest! {
            #[test]
            fn conversion_rate_is_always_in_bounds(
                total_events in 0u64..10000,
                conversions in 0u64..10000,
            ) {
                // Ensure conversions <= total_events for valid test cases
                let conversions = conversions.min(total_events);

                let rate = compute_conversion_rate(total_events, conversions);

                // Property: conversion_rate must be in [0.0, 1.0]
                prop_assert!(
                    rate >= 0.0 && rate <= 1.0,
                    "conversion_rate ({}) must be in [0.0, 1.0] for total_events={}, conversions={}",
                    rate, total_events, conversions
                );
            }

            #[test]
            fn conversion_rate_equals_formula_when_total_events_positive(
                total_events in 1u64..10000,
                conversions in 0u64..10000,
            ) {
                // Ensure conversions <= total_events for valid test cases
                let conversions = conversions.min(total_events);

                let rate = compute_conversion_rate(total_events, conversions);
                let expected = conversions as f64 / total_events as f64;

                // Property: conversion_rate = conversions / total_events when total_events > 0
                prop_assert!(
                    (rate - expected).abs() < 1e-10,
                    "conversion_rate ({}) must equal conversions/total_events ({}) for total_events={}, conversions={}",
                    rate, expected, total_events, conversions
                );
            }

            #[test]
            fn conversion_rate_is_zero_when_total_events_zero(
                conversions in 0u64..10000,
            ) {
                let rate = compute_conversion_rate(0, conversions);

                // Property: conversion_rate = 0.0 when total_events = 0
                prop_assert_eq!(
                    rate, 0.0,
                    "conversion_rate must be 0.0 when total_events=0, got {}",
                    rate
                );
            }
        }

        // ── Property 9: Unique user count never exceeds total event count ─────
        //
        // **Property 9: Unique user count never exceeds total event count for
        // the same pixel and period**
        //
        // **Validates: Requirements 10.6**

        /// Simulate the unique_users COUNT(DISTINCT ...) logic in pure Rust.
        /// In the real SQL query, unique_users = COUNT(DISTINCT COALESCE(pe.fbp, pe.user_id))
        fn count_unique_users(events: &[(Option<String>, Option<String>)]) -> usize {
            use std::collections::HashSet;
            let mut seen = HashSet::new();
            for (fbp, user_id) in events {
                // COALESCE(fbp, user_id) — use fbp if present, otherwise user_id
                if let Some(id) = fbp.as_ref().or(user_id.as_ref()) {
                    seen.insert(id.clone());
                }
            }
            seen.len()
        }

        proptest! {
            #[test]
            fn unique_users_never_exceeds_total_events(
                // Generate a vector of events with optional fbp and user_id
                events in prop::collection::vec(
                    (
                        prop::option::of("[a-z]{8}"),  // fbp: optional 8-char string
                        prop::option::of("[0-9]{4}"),  // user_id: optional 4-digit string
                    ),
                    0..1000  // 0 to 1000 events
                )
            ) {
                let total_events = events.len();
                let unique_users = count_unique_users(&events);

                // Property: unique_users <= total_events
                prop_assert!(
                    unique_users <= total_events,
                    "unique_users ({}) must not exceed total_events ({}) for the same pixel and period",
                    unique_users, total_events
                );
            }

            #[test]
            fn unique_users_equals_total_when_all_distinct(
                // Generate events where each has a unique fbp
                count in 1usize..100,
            ) {
                // Create events with unique fbp values
                let events: Vec<(Option<String>, Option<String>)> = (0..count)
                    .map(|i| (Some(format!("fbp_{}", i)), None))
                    .collect();

                let total_events = events.len();
                let unique_users = count_unique_users(&events);

                // Property: when all events have distinct identifiers, unique_users = total_events
                prop_assert_eq!(
                    unique_users, total_events,
                    "unique_users must equal total_events when all events have distinct identifiers"
                );
            }

            #[test]
            fn unique_users_equals_one_when_all_same(
                count in 1usize..100,
            ) {
                // Create events with the same fbp value
                let events: Vec<(Option<String>, Option<String>)> = (0..count)
                    .map(|_| (Some("same_fbp".to_string()), None))
                    .collect();

                let unique_users = count_unique_users(&events);

                // Property: when all events have the same identifier, unique_users = 1
                prop_assert_eq!(
                    unique_users, 1,
                    "unique_users must equal 1 when all events have the same identifier"
                );
            }

            #[test]
            fn unique_users_is_zero_when_no_identifiers(
                count in 0usize..100,
            ) {
                // Create events with no fbp or user_id
                let events: Vec<(Option<String>, Option<String>)> = (0..count)
                    .map(|_| (None, None))
                    .collect();

                let unique_users = count_unique_users(&events);

                // Property: when no events have identifiers, unique_users = 0
                prop_assert_eq!(
                    unique_users, 0,
                    "unique_users must equal 0 when no events have identifiers"
                );
            }

            #[test]
            fn unique_users_uses_user_id_fallback(
                // Generate events with only user_id (no fbp)
                user_ids in prop::collection::vec(
                    prop::option::of("[0-9]{4}"),  // user_id: optional
                    1..100
                )
            ) {
                // Create events with no fbp, only user_id
                let events: Vec<(Option<String>, Option<String>)> = user_ids
                    .into_iter()
                    .map(|user_id| (None, user_id))
                    .collect();

                let total_events = events.len();
                let unique_users = count_unique_users(&events);

                // Property: unique_users <= total_events even when using user_id fallback
                prop_assert!(
                    unique_users <= total_events,
                    "unique_users ({}) must not exceed total_events ({}) when using user_id fallback",
                    unique_users, total_events
                );
            }
        }
    }
}
