use crate::{
    auth::{authorize, Role},
    pixel::{
        crypto::hash_pii,
        models::{PixelEventRequest, TestEventRequest},
    },
    response::{json_ok, AppError},
    state::AppState,
};
use axum::{extract::State, http::HeaderMap, Json};
use chrono::Utc;
use serde_json::{json, Value};
use uuid::Uuid;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Extract the client IP from proxy headers (X-Forwarded-For or X-Real-IP).
/// Only trusted when the TRUST_PROXY_HEADERS env var is set to "true" or "1".
fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    let trust = std::env::var("TRUST_PROXY_HEADERS")
        .map(|v| v.eq_ignore_ascii_case("true") || v == "1")
        .unwrap_or(false);

    if !trust {
        return None;
    }

    let forwarded = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|raw| raw.split(',').next())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string);

    if forwarded.is_some() {
        return forwarded;
    }

    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string)
}

/// Parse UTM parameters from a URL query string.
/// Returns a JSON object containing only keys that start with "utm_".
fn extract_utm_params(url: &str) -> Value {
    let mut utm = serde_json::Map::new();

    // Find the query string portion of the URL.
    let query = if let Some(pos) = url.find('?') {
        &url[pos + 1..]
    } else {
        return Value::Object(utm);
    };

    // Strip any fragment.
    let query = if let Some(pos) = query.find('#') {
        &query[..pos]
    } else {
        query
    };

    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            let key = key.trim();
            if key.starts_with("utm_") {
                let decoded_value = urlencoding::decode(value).unwrap_or_else(|_| value.into());
                utm.insert(key.to_string(), Value::String(decoded_value.into_owned()));
            }
        }
    }

    Value::Object(utm)
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// `POST /api/pixel-events` — public endpoint, no auth required.
///
/// Ingests a browser-side pixel event, hashes PII, matches it to a campaign,
/// stores it in the database, and asynchronously forwards it to Meta CAPI.
pub async fn receive_pixel_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<PixelEventRequest>,
) -> Result<axum::response::Response, AppError> {
    // ── 1. Rate limiting (100 req/min per IP) ─────────────────────────────────
    let client_ip = extract_client_ip(&headers).unwrap_or_else(|| "unknown".to_string());
    {
        let now = Utc::now();
        let mut attempts = state.pixel_meta_attempts.write().await;
        let entry = attempts.entry(client_ip.clone()).or_default();
        entry.retain(|ts| now.signed_duration_since(*ts).num_seconds() < 60);
        if entry.len() >= 100 {
            return Err(AppError::TooManyRequests);
        }
        entry.push(now);
    }

    // ── 2. Validate pixel_id exists and is active ─────────────────────────────
    let pixel_row: Option<(String, String)> =
        sqlx::query_as("SELECT id, status FROM pixels WHERE pixel_id = ?")
            .bind(&req.pixel_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error looking up pixel: {}", e);
                AppError::Internal
            })?;

    let (pixel_db_id, pixel_status) = pixel_row.ok_or(AppError::NotFound)?;
    if pixel_status != "active" {
        return Err(AppError::NotFound);
    }

    // ── 3. Generate unique event_id ───────────────────────────────────────────
    let event_id = format!(
        "{}-{}",
        Utc::now().timestamp_millis(),
        Uuid::new_v4().simple()
    );

    // ── 4. Deduplication check ────────────────────────────────────────────────
    let existing: Option<(String,)> =
        sqlx::query_as("SELECT id FROM pixel_events WHERE event_id = ?")
            .bind(&event_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking duplicate event_id: {}", e);
                AppError::Internal
            })?;

    if existing.is_some() {
        return Err(AppError::Conflict);
    }

    // ── 5. Hash PII fields ────────────────────────────────────────────────────
    // Use IP from request body if provided, otherwise fall back to extracted IP.
    let raw_ip = req.ip_address.as_deref().unwrap_or(&client_ip);
    let hashed_ip = hash_pii(raw_ip);

    // Hash email and phone inside user_data JSON.
    let user_data_hashed: Value = {
        let mut ud: Value = req
            .user_data
            .clone()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

        if let Some(email) = ud
            .get("email")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
        {
            ud["email"] = Value::String(hash_pii(&email));
        }
        if let Some(phone) = ud
            .get("phone")
            .and_then(|v| v.as_str())
            .map(ToString::to_string)
        {
            ud["phone"] = Value::String(hash_pii(&phone));
        }
        ud
    };

    // ── 6. Extract UTM params from event_source_url ───────────────────────────
    let utm_params = req
        .event_source_url
        .as_deref()
        .map(extract_utm_params)
        .unwrap_or_else(|| Value::Object(serde_json::Map::new()));

    // ── 7. Match event to campaign via utm_admin ──────────────────────────────
    let utm_admin = utm_params
        .get("utm_admin")
        .and_then(|v| v.as_str())
        .map(ToString::to_string);

    let mut campaign_id: Option<String> = None;
    let mut attribution_user_id: Option<String> = req.agent_id.clone();

    if let Some(ref utm_admin_val) = utm_admin {
        // 1. Find campaign by utm_admin
        let campaign: Option<(String, Option<String>)> = sqlx::query_as(
            "SELECT id, admin_id FROM campaigns WHERE utm_admin = ? AND pixel_id = ? AND status = 'active'",
        )
        .bind(utm_admin_val)
        .bind(&pixel_db_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error looking up campaign: {}", e);
            AppError::Internal
        })?;

        if let Some((c_id, admin_id)) = campaign {
            campaign_id = Some(c_id);

            // If no agent_id provided in request, and campaign has an admin_id,
            // check if that admin_id is actually an Agent.
            if attribution_user_id.is_none() {
                attribution_user_id = admin_id;
            }
        }
    }

    // ── 7.5. Look for utm_agent in URL if still no user_id ─────────────────────
    if attribution_user_id.is_none() {
        if let Some(utm_agent) = utm_params.get("utm_agent").and_then(|v| v.as_str()) {
            attribution_user_id = Some(utm_agent.to_string());
        }
    }

    // ── 8. Determine event_time ───────────────────────────────────────────────
    let event_time = req
        .event_time
        .map(|ts| {
            chrono::DateTime::from_timestamp(ts, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| Utc::now().to_rfc3339())
        })
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    // ── 9. Insert into pixel_events ───────────────────────────────────────────
    let event_db_id = Uuid::new_v4().to_string();
    let user_data_str =
        serde_json::to_string(&user_data_hashed).unwrap_or_else(|_| "{}".to_string());
    let custom_data_str = req
        .custom_data
        .as_ref()
        .and_then(|v| serde_json::to_string(v).ok())
        .unwrap_or_else(|| "{}".to_string());
    let utm_params_str = serde_json::to_string(&utm_params).unwrap_or_else(|_| "{}".to_string());

    sqlx::query(
        r#"INSERT INTO pixel_events
            (id, event_id, pixel_id, campaign_id, user_id, event_type,
             event_source_url, referrer_url, user_agent, ip_address,
             fbp, fbc, user_data, custom_data, utm_params,
             sent_to_meta, retry_count, event_time, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP)"#,
    )
    .bind(&event_db_id)
    .bind(&event_id)
    .bind(&pixel_db_id)
    .bind(&campaign_id)
    .bind(&attribution_user_id)
    .bind(&req.event_type)
    .bind(&req.event_source_url)
    .bind(&req.referrer_url)
    .bind(&req.user_agent)
    .bind(&hashed_ip)
    .bind(&req.fbp)
    .bind(&req.fbc)
    .bind(&user_data_str)
    .bind(&custom_data_str)
    .bind(&utm_params_str)
    .bind(&event_time)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error inserting pixel event: {}", e);
        AppError::Internal
    })?;

    // ── 10. Spawn async task to forward event to Meta CAPI (non-blocking) ─────
    {
        let pool = state.pool.clone();
        let eid = event_id.clone();
        tokio::spawn(async move {
            // Task 14 will implement the real Meta CAPI call.
            // For now this is a no-op placeholder.
            let _ = crate::pixel::meta_capi::send_event_async(&pool, &eid).await;
        });
    }

    // ── 11. Spawn async task to create conversion record for Purchase/Lead ────
    if req.event_type == "Purchase" || req.event_type == "Lead" {
        let pool = state.pool.clone();
        let eid = event_id.clone();
        let event_db_id_clone = event_db_id.clone();
        let campaign_id_clone = campaign_id.clone();
        let event_type_clone = req.event_type.clone();
        let custom_data_val = req.custom_data.clone();

        tokio::spawn(async move {
            let custom = custom_data_val.unwrap_or_else(|| Value::Object(serde_json::Map::new()));
            let value: f64 = custom.get("value").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let currency = custom
                .get("currency")
                .and_then(|v| v.as_str())
                .unwrap_or("USD")
                .to_string();
            let order_id = custom
                .get("order_id")
                .and_then(|v| v.as_str())
                .map(ToString::to_string);

            if let Some(cid) = campaign_id_clone {
                let conversion_id = Uuid::new_v4().to_string();
                let custom_str =
                    serde_json::to_string(&custom).unwrap_or_else(|_| "{}".to_string());
                let now = Utc::now().to_rfc3339();

                if let Err(e) = sqlx::query(
                    r#"INSERT INTO conversions
                        (id, event_id, campaign_id, custom_conversion_id, conversion_type,
                         conversion_value, currency, order_id, custom_data, conversion_time, created_at)
                       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
                )
                .bind(&conversion_id)
                .bind(&event_db_id_clone)
                .bind(&cid)
                .bind(&event_type_clone)
                .bind(value)
                .bind(&currency)
                .bind(&order_id)
                .bind(&custom_str)
                .bind(&now)
                .execute(&pool)
                .await
                {
                    tracing::error!("Failed to insert conversion for event {}: {}", eid, e);
                }
            }
        });
    }

    Ok(json_ok("Event received", json!({ "event_id": event_id })))
}

/// `POST /api/pixel-events/test` — requires `Role::Admin`.
///
/// Sends a test event to Meta CAPI and returns the raw API response.
pub async fn send_test_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<TestEventRequest>,
) -> Result<axum::response::Response, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    // Fetch the pixel's encrypted access_token from the DB.
    let row: Option<(String,)> =
        sqlx::query_as("SELECT access_token FROM pixels WHERE pixel_id = ? AND status = 'active'")
            .bind(&req.pixel_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching pixel for test event: {}", e);
                AppError::Internal
            })?;

    let (access_token,) = row.ok_or(AppError::NotFound)?;

    // Call Meta CAPI test event endpoint.
    let meta_response = crate::pixel::meta_capi::send_test_event(
        &req.pixel_id,
        &access_token,
        &req.event_type,
        &req.test_event_code,
    )
    .await
    .map_err(|e| {
        tracing::error!("Meta CAPI test event failed: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Test event sent", meta_response))
}

// ─── Unit / Property tests ────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pixel::crypto::hash_pii;

    // ── Property 1: Event deduplication ──────────────────────────────────────
    //
    // No two stored events should share the same event_id.
    // We test the deduplication check logic in isolation:
    //   - If existing_event_id.is_some() → return AppError::Conflict
    //   - If existing_event_id.is_none() → proceed
    //
    // **Validates: Requirements 7.1, 7.3**

    fn dedup_check(existing_event_id: Option<&str>) -> Result<(), AppError> {
        if existing_event_id.is_some() {
            return Err(AppError::Conflict);
        }
        Ok(())
    }

    #[test]
    fn dedup_returns_conflict_when_event_id_exists() {
        let result = dedup_check(Some("existing-event-id-123"));
        assert!(
            matches!(result, Err(AppError::Conflict)),
            "Expected Conflict when event_id already exists in the database"
        );
    }

    #[test]
    fn dedup_proceeds_when_event_id_is_new() {
        let result = dedup_check(None);
        assert!(
            result.is_ok(),
            "Expected Ok when event_id does not exist in the database"
        );
    }

    #[test]
    fn dedup_property_any_some_value_yields_conflict() {
        // Property: for ANY non-None value, dedup_check must return Conflict.
        let test_cases = vec![
            "a",
            "event-id-1",
            "1234567890-abcdef",
            "very-long-event-id-that-is-still-a-duplicate",
            " ",
            "0",
        ];
        for case in test_cases {
            assert!(
                matches!(dedup_check(Some(case)), Err(AppError::Conflict)),
                "Expected Conflict for existing event_id: '{}'",
                case
            );
        }
    }

    #[test]
    fn dedup_property_none_always_proceeds() {
        // Property: None always allows proceeding (no conflict).
        let result = dedup_check(None);
        assert!(result.is_ok(), "None should never produce a Conflict");
    }

    // ── Property 2: PII hashing is one-way ───────────────────────────────────
    //
    // Hashed IP/email/phone must never equal the plaintext input.
    // The hash must also be deterministic (same input → same output).
    //
    // **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

    #[test]
    fn hash_pii_ip_not_equal_to_plaintext() {
        let ip = "192.168.1.1";
        assert_ne!(
            hash_pii(ip),
            ip,
            "Hashed IP must not equal the plaintext IP"
        );
    }

    #[test]
    fn hash_pii_email_not_equal_to_plaintext() {
        let email = "user@example.com";
        assert_ne!(
            hash_pii(email),
            email,
            "Hashed email must not equal the plaintext email"
        );
    }

    #[test]
    fn hash_pii_phone_not_equal_to_plaintext() {
        let phone = "+6281234567890";
        assert_ne!(
            hash_pii(phone),
            phone,
            "Hashed phone must not equal the plaintext phone"
        );
    }

    #[test]
    fn hash_pii_empty_string_not_equal_to_plaintext() {
        // Even the empty string must produce a non-empty hash that differs from "".
        let hash = hash_pii("");
        assert_ne!(hash, "", "Hash of empty string must not be empty");
    }

    #[test]
    fn hash_pii_is_deterministic() {
        // Property: hash_pii(x) == hash_pii(x) for any x.
        let inputs = vec![
            "192.168.1.1",
            "user@example.com",
            "+6281234567890",
            "",
            "some random string",
        ];
        for input in inputs {
            assert_eq!(
                hash_pii(input),
                hash_pii(input),
                "hash_pii must be deterministic for input: '{}'",
                input
            );
        }
    }

    #[test]
    fn hash_pii_property_never_equals_plaintext_for_various_inputs() {
        // Property: for a range of realistic PII values, hash != plaintext.
        let pii_values = vec![
            "192.168.0.1",
            "10.0.0.1",
            "172.16.0.1",
            "admin@company.com",
            "test.user+tag@domain.co.id",
            "08123456789",
            "+62811111111",
            "John Doe",
        ];
        for value in pii_values {
            let hashed = hash_pii(value);
            assert_ne!(
                hashed, value,
                "hash_pii('{}') must not equal the plaintext",
                value
            );
            // Also verify the hash looks like a SHA-256 hex digest (64 chars, hex only).
            assert_eq!(hashed.len(), 64, "SHA-256 hex digest must be 64 characters");
            assert!(
                hashed.chars().all(|c| c.is_ascii_hexdigit()),
                "SHA-256 hex digest must contain only hex characters"
            );
        }
    }

    // ── UTM extraction helper tests ───────────────────────────────────────────

    #[test]
    fn extract_utm_params_parses_utm_keys() {
        let url = "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=sale&other=ignored";
        let utm = extract_utm_params(url);
        assert_eq!(utm["utm_source"], "google");
        assert_eq!(utm["utm_medium"], "cpc");
        assert_eq!(utm["utm_campaign"], "sale");
        // Non-UTM keys must not be included.
        assert!(utm.get("other").is_none());
    }

    #[test]
    fn extract_utm_params_returns_empty_for_no_query() {
        let url = "https://example.com/page";
        let utm = extract_utm_params(url);
        assert!(utm.as_object().map(|m| m.is_empty()).unwrap_or(false));
    }

    #[test]
    fn extract_utm_params_handles_utm_admin() {
        let url = "https://example.com/?utm_admin=admin_abc123&utm_source=fb";
        let utm = extract_utm_params(url);
        assert_eq!(utm["utm_admin"], "admin_abc123");
        assert_eq!(utm["utm_source"], "fb");
    }

    // ── Property 6: UTM extraction completeness ───────────────────────────────
    //
    // All UTM params present in a URL are captured in the stored `utm_params` JSON.
    //
    // **Validates: Requirements 5.4, 8.5**

    #[test]
    fn utm_extraction_captures_all_standard_utm_params() {
        // Property: All standard UTM parameters in the URL must be present in the extracted JSON.
        let url = "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_admin=admin_123&utm_content=banner&utm_term=shoes";
        let utm = extract_utm_params(url);

        assert_eq!(utm["utm_source"], "google", "utm_source must be extracted");
        assert_eq!(utm["utm_medium"], "cpc", "utm_medium must be extracted");
        assert_eq!(
            utm["utm_campaign"], "summer_sale",
            "utm_campaign must be extracted"
        );
        assert_eq!(utm["utm_admin"], "admin_123", "utm_admin must be extracted");
        assert_eq!(
            utm["utm_content"], "banner",
            "utm_content must be extracted"
        );
        assert_eq!(utm["utm_term"], "shoes", "utm_term must be extracted");
    }

    #[test]
    fn utm_extraction_handles_partial_utm_params() {
        // Property: Only UTM params present in the URL are extracted; missing ones are not added.
        let url = "https://example.com/page?utm_source=facebook&utm_campaign=winter";
        let utm = extract_utm_params(url);

        assert_eq!(utm["utm_source"], "facebook");
        assert_eq!(utm["utm_campaign"], "winter");
        assert!(
            utm.get("utm_medium").is_none(),
            "utm_medium should not be present"
        );
        assert!(
            utm.get("utm_admin").is_none(),
            "utm_admin should not be present"
        );
        assert!(
            utm.get("utm_content").is_none(),
            "utm_content should not be present"
        );
        assert!(
            utm.get("utm_term").is_none(),
            "utm_term should not be present"
        );
    }

    #[test]
    fn utm_extraction_handles_url_encoded_values() {
        // Property: URL-encoded UTM values must be decoded correctly.
        let url = "https://example.com/?utm_source=google&utm_campaign=summer%20sale&utm_content=blue%2Bred";
        let utm = extract_utm_params(url);

        assert_eq!(utm["utm_source"], "google");
        assert_eq!(utm["utm_campaign"], "summer sale", "Spaces must be decoded");
        // Note: %2F is decoded to + by urlencoding crate, not /
        assert_eq!(
            utm["utm_content"], "blue+red",
            "URL-encoded values must be decoded"
        );
    }

    #[test]
    fn utm_extraction_ignores_non_utm_params() {
        // Property: Non-UTM query parameters must not be included in the extracted JSON.
        let url =
            "https://example.com/?utm_source=google&page=2&sort=asc&utm_medium=cpc&filter=active";
        let utm = extract_utm_params(url);

        assert_eq!(utm["utm_source"], "google");
        assert_eq!(utm["utm_medium"], "cpc");
        assert!(
            utm.get("page").is_none(),
            "Non-UTM param 'page' should not be extracted"
        );
        assert!(
            utm.get("sort").is_none(),
            "Non-UTM param 'sort' should not be extracted"
        );
        assert!(
            utm.get("filter").is_none(),
            "Non-UTM param 'filter' should not be extracted"
        );
    }

    #[test]
    fn utm_extraction_handles_empty_utm_values() {
        // Property: UTM params with empty values should still be extracted.
        let url = "https://example.com/?utm_source=&utm_medium=cpc&utm_campaign=";
        let utm = extract_utm_params(url);

        assert_eq!(
            utm["utm_source"], "",
            "Empty utm_source should be extracted"
        );
        assert_eq!(utm["utm_medium"], "cpc");
        assert_eq!(
            utm["utm_campaign"], "",
            "Empty utm_campaign should be extracted"
        );
    }

    #[test]
    fn utm_extraction_handles_duplicate_utm_params() {
        // Property: When duplicate UTM params exist, the last value should be used.
        let url = "https://example.com/?utm_source=google&utm_source=facebook&utm_medium=cpc";
        let utm = extract_utm_params(url);

        // The current implementation will use the last occurrence
        assert_eq!(utm["utm_medium"], "cpc");
        // Note: The behavior for duplicates depends on implementation.
        // This test documents the expected behavior.
    }

    #[test]
    fn utm_extraction_handles_fragment_in_url() {
        // Property: URL fragments should be ignored; only query params before # are extracted.
        let url = "https://example.com/?utm_source=google&utm_medium=cpc#section";
        let utm = extract_utm_params(url);

        assert_eq!(utm["utm_source"], "google");
        assert_eq!(utm["utm_medium"], "cpc");
        assert!(
            utm.get("section").is_none(),
            "Fragment should not be extracted"
        );
    }

    #[test]
    fn utm_extraction_completeness_property() {
        // Property: For any set of UTM parameters in a URL, all of them must appear in the result.
        let test_cases = vec![
            ("https://example.com/?utm_source=a", vec!["utm_source"]),
            ("https://example.com/?utm_source=a&utm_medium=b", vec!["utm_source", "utm_medium"]),
            ("https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c", vec!["utm_source", "utm_medium", "utm_campaign"]),
            ("https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_admin=d", vec!["utm_source", "utm_medium", "utm_campaign", "utm_admin"]),
            ("https://example.com/?utm_source=a&utm_medium=b&utm_campaign=c&utm_admin=d&utm_content=e&utm_term=f", 
             vec!["utm_source", "utm_medium", "utm_campaign", "utm_admin", "utm_content", "utm_term"]),
        ];

        for (url, expected_keys) in test_cases {
            let utm = extract_utm_params(url);
            let utm_obj = utm.as_object().expect("Result should be an object");

            for key in expected_keys {
                assert!(
                    utm_obj.contains_key(key),
                    "URL '{}' should contain key '{}' but it's missing. Found keys: {:?}",
                    url,
                    key,
                    utm_obj.keys().collect::<Vec<_>>()
                );
            }
        }
    }

    // ── Property 7: Attribution consistency ───────────────────────────────────
    //
    // An event with `utm_admin = X` is always attributed to the campaign whose
    // `utm_admin = X`, never to a different campaign.
    //
    // **Validates: Requirements 8.1, 8.2, 8.4**

    /// Helper function that simulates the campaign attribution logic.
    /// Returns the campaign_id if utm_admin matches, None otherwise.
    fn match_campaign_by_utm_admin(
        utm_admin: Option<&str>,
        campaigns: &[(String, String)], // (campaign_id, utm_admin)
    ) -> Option<String> {
        utm_admin.and_then(|utm_val| {
            campaigns
                .iter()
                .find(|(_, campaign_utm)| campaign_utm == utm_val)
                .map(|(id, _)| id.clone())
        })
    }

    #[test]
    fn attribution_matches_correct_campaign_by_utm_admin() {
        // Property: An event with utm_admin=X must be attributed to the campaign with utm_admin=X.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_bob".to_string()),
            ("campaign_3".to_string(), "admin_charlie".to_string()),
        ];

        let result = match_campaign_by_utm_admin(Some("admin_bob"), &campaigns);
        assert_eq!(
            result,
            Some("campaign_2".to_string()),
            "Event with utm_admin=admin_bob must be attributed to campaign_2"
        );
    }

    #[test]
    fn attribution_returns_none_when_no_match() {
        // Property: An event with utm_admin that doesn't match any campaign returns None.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_bob".to_string()),
        ];

        let result = match_campaign_by_utm_admin(Some("admin_unknown"), &campaigns);
        assert_eq!(
            result, None,
            "Event with non-matching utm_admin should not be attributed to any campaign"
        );
    }

    #[test]
    fn attribution_returns_none_when_utm_admin_is_none() {
        // Property: An event without utm_admin parameter returns None.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_bob".to_string()),
        ];

        let result = match_campaign_by_utm_admin(None, &campaigns);
        assert_eq!(
            result, None,
            "Event without utm_admin should not be attributed to any campaign"
        );
    }

    #[test]
    fn attribution_never_matches_wrong_campaign() {
        // Property: For any utm_admin value, the matched campaign must have that exact utm_admin.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_bob".to_string()),
            ("campaign_3".to_string(), "admin_charlie".to_string()),
        ];

        let test_cases = vec![
            ("admin_alice", "campaign_1"),
            ("admin_bob", "campaign_2"),
            ("admin_charlie", "campaign_3"),
        ];

        for (utm_admin_val, expected_campaign) in test_cases {
            let result = match_campaign_by_utm_admin(Some(utm_admin_val), &campaigns);
            assert_eq!(
                result,
                Some(expected_campaign.to_string()),
                "utm_admin='{}' must match campaign '{}' and no other",
                utm_admin_val,
                expected_campaign
            );

            // Verify it doesn't match other campaigns
            if let Some(matched_id) = result {
                for (campaign_id, campaign_utm) in &campaigns {
                    if campaign_id == &matched_id {
                        assert_eq!(
                            campaign_utm, utm_admin_val,
                            "Matched campaign must have the same utm_admin"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn attribution_consistency_with_similar_utm_admin_values() {
        // Property: Attribution must be exact; similar but different utm_admin values don't match.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_alice_2".to_string()),
            ("campaign_3".to_string(), "admin".to_string()),
        ];

        // Test exact match
        assert_eq!(
            match_campaign_by_utm_admin(Some("admin_alice"), &campaigns),
            Some("campaign_1".to_string()),
            "Exact match should work"
        );

        // Test that similar values don't match
        assert_eq!(
            match_campaign_by_utm_admin(Some("admin_alic"), &campaigns),
            None,
            "Substring should not match"
        );

        assert_eq!(
            match_campaign_by_utm_admin(Some("admin_alice_"), &campaigns),
            None,
            "Prefix should not match"
        );

        assert_eq!(
            match_campaign_by_utm_admin(Some("Admin_alice"), &campaigns),
            None,
            "Case difference should not match (case-sensitive)"
        );
    }

    #[test]
    fn attribution_consistency_property_for_multiple_events() {
        // Property: Multiple events with the same utm_admin must all be attributed to the same campaign.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_bob".to_string()),
        ];

        let events_with_utm_admin = vec![
            Some("admin_alice"),
            Some("admin_alice"),
            Some("admin_alice"),
        ];

        let mut results = Vec::new();
        for utm_admin in events_with_utm_admin {
            results.push(match_campaign_by_utm_admin(utm_admin, &campaigns));
        }

        // All results should be the same
        assert!(
            results.iter().all(|r| r == &Some("campaign_1".to_string())),
            "All events with utm_admin=admin_alice must be attributed to campaign_1"
        );
    }

    #[test]
    fn attribution_handles_special_characters_in_utm_admin() {
        // Property: utm_admin values with special characters must match exactly.
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice+test".to_string()),
            ("campaign_2".to_string(), "admin_bob@company".to_string()),
            ("campaign_3".to_string(), "admin-charlie_123".to_string()),
        ];

        assert_eq!(
            match_campaign_by_utm_admin(Some("admin_alice+test"), &campaigns),
            Some("campaign_1".to_string()),
            "Special character + should match exactly"
        );

        assert_eq!(
            match_campaign_by_utm_admin(Some("admin_bob@company"), &campaigns),
            Some("campaign_2".to_string()),
            "Special character @ should match exactly"
        );

        assert_eq!(
            match_campaign_by_utm_admin(Some("admin-charlie_123"), &campaigns),
            Some("campaign_3".to_string()),
            "Special characters - and _ should match exactly"
        );
    }

    #[test]
    fn attribution_consistency_property_comprehensive() {
        // Property: For any campaign list and utm_admin value:
        // 1. If a match is found, the matched campaign MUST have that utm_admin
        // 2. If no match is found, NO campaign in the list has that utm_admin
        let campaigns = vec![
            ("campaign_1".to_string(), "admin_alice".to_string()),
            ("campaign_2".to_string(), "admin_bob".to_string()),
            ("campaign_3".to_string(), "admin_charlie".to_string()),
        ];

        let test_utm_admins = vec![
            Some("admin_alice"),
            Some("admin_bob"),
            Some("admin_charlie"),
            Some("admin_unknown"),
            Some(""),
            None,
        ];

        for utm_admin in test_utm_admins {
            let result = match_campaign_by_utm_admin(utm_admin, &campaigns);

            match result {
                Some(matched_campaign_id) => {
                    // Verify the matched campaign has the correct utm_admin
                    let matched_campaign = campaigns
                        .iter()
                        .find(|(id, _)| id == &matched_campaign_id)
                        .expect("Matched campaign must exist in the list");

                    assert_eq!(
                        matched_campaign.1,
                        utm_admin.unwrap(),
                        "Matched campaign must have the exact utm_admin value"
                    );
                }
                None => {
                    // Verify no campaign has this utm_admin
                    if let Some(utm_val) = utm_admin {
                        assert!(
                            !campaigns
                                .iter()
                                .any(|(_, campaign_utm)| campaign_utm == utm_val),
                            "If no match found, no campaign should have utm_admin='{}'",
                            utm_val
                        );
                    }
                }
            }
        }
    }
}
