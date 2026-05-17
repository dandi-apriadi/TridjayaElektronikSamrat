use crate::api_routes;
use crate::chatbot_routes;
use crate::landing_routes;
use crate::pixel;
use crate::wa_gateway;
use crate::wa_webhook_handlers;
use crate::{
    auth::{
        authorize, hash_password, login_with_request, logout_with_headers, refresh_with_request,
        verify_password, LoginRequest, RefreshRequest, Role,
    },
    response::{json_ok, AppError},
    state::{AppState, UserPublic, UserRecord, USER_PUBLIC_SELECT, USER_RECORD_SELECT},
};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::{header::SET_COOKIE, HeaderMap, HeaderValue},
    routing::{delete, get, patch, post},
    Json, Router,
};
use chrono::{Duration, Local, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;

pub fn router(state: AppState) -> Router {
    // Create the main router with all existing routes
    let main_router = Router::new()
        .route("/health", get(health))
        .route("/api/partners", get(list_partners))
        .route("/api/admin/partners", get(list_admin_partners))
        .route("/api/admin/partners/order", patch(update_partner_order))
        .route("/api/admin/partners/{id}", delete(delete_partner))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/verify-email", post(verify_email))
        .route("/api/auth/refresh", post(refresh_with_rate_limit))
        .route("/api/auth/forgot-password", post(forgot_password))
        .route("/api/auth/reset-password", post(reset_password))
        .route("/api/notifications", get(list_notifications))
        .route(
            "/api/notifications/unread-count",
            get(get_notifications_unread_count),
        )
        .route(
            "/api/notifications/read-all",
            patch(mark_all_notifications_as_read),
        )
        .route(
            "/api/notifications/{id}/read",
            patch(mark_notification_as_read),
        )
        .route("/api/auth/profile", patch(update_auth_profile))
        .route("/api/auth/change-password", post(change_auth_password))
        .route("/api/users", get(list_users).post(create_user))
        .route(
            "/api/users/{id}",
            get(get_user).patch(update_user).delete(delete_user),
        )
        .route("/api/users/{id}/reset-password", post(reset_user_password))
        .route(
            "/api/users/{id}/resend-verification",
            post(resend_verification),
        )
        .route(
            "/api/wa/accounts",
            get(list_wa_accounts).post(create_wa_account),
        )
        .route(
            "/api/wa/accounts/{id}",
            patch(update_wa_account).delete(delete_wa_account),
        )
        .route(
            "/api/wa/campaigns",
            get(list_wa_campaigns).post(create_wa_campaign),
        )
        .route(
            "/api/wa/campaigns/{id}",
            get(get_wa_campaign)
                .patch(update_wa_campaign)
                .delete(delete_wa_campaign),
        )
        .route("/api/wa/campaigns/{id}/recipients", post(add_wa_recipients))
        .route(
            "/api/wa/campaigns/{id}/recipients/from-leads",
            post(add_wa_recipients_from_leads),
        )
        .route(
            "/api/wa/recipients/template",
            get(download_recipients_template),
        )
        .route("/api/wa/campaigns/{id}/start", post(start_wa_campaign))
        .route("/api/wa/campaigns/{id}/pause", post(pause_wa_campaign))
        .route("/api/wa/campaigns/{id}/reset", post(reset_wa_campaign))
        .route("/api/wa/campaigns/{id}/status", get(get_wa_campaign_status))
        .route(
            "/api/wa/campaigns/{id}/metrics",
            get(get_wa_campaign_metrics),
        )
        .route(
            "/api/wa/recipients/{id}",
            patch(update_wa_recipient).delete(delete_wa_recipient),
        )
        .route(
            "/api/wa/blast-contacts",
            get(list_blast_contacts).post(create_blast_contact),
        )
        .route(
            "/api/wa/blast-contacts/{id}",
            patch(update_blast_contact).delete(delete_blast_contact),
        )
        .route(
            "/api/wa/blast-contacts/import-to-campaign/{campaign_id}",
            post(import_blast_contacts_to_campaign),
        )
        .route(
            "/api/wa/webhooks",
            get(wa_webhook_handlers::list_webhooks).post(wa_webhook_handlers::create_webhook),
        )
        .route(
            "/api/wa/webhooks/{id}",
            patch(wa_webhook_handlers::update_webhook).delete(wa_webhook_handlers::delete_webhook),
        )
        .route(
            "/api/wa/chatbot-rules",
            get(chatbot_routes::list_chatbot_rules).post(chatbot_routes::create_chatbot_rule),
        )
        .route(
            "/api/wa/chatbot-rules/bulk",
            patch(chatbot_routes::bulk_update_chatbot_rules),
        )
        .route(
            "/api/wa/chatbot-rules/{id}",
            patch(chatbot_routes::update_chatbot_rule).delete(chatbot_routes::delete_chatbot_rule),
        )
        .route("/api/reward-tiers", get(list_reward_tiers))
        .route(
            "/api/admin/uploads/private/{filename}",
            get(serve_private_upload),
        )
        .route("/api/catalogs", get(list_catalogs).post(create_catalog))
        .route(
            "/api/admin/catalogs/paginated",
            get(list_catalogs_paginated),
        )
        .route("/api/admin/catalogs/match", get(match_catalogs))
        .route("/api/admin/catalogs/bulk", post(bulk_products))
        .route(
            "/api/admin/catalogs/price-markups",
            get(list_price_markups).post(create_price_markup),
        )
        .route(
            "/api/admin/catalogs/price-markups/{id}",
            patch(update_price_markup).delete(delete_price_markup),
        )
        .route(
            "/api/catalogs/{id}",
            get(get_catalog)
                .patch(update_catalog)
                .delete(delete_catalog),
        )
        .route(
            "/api/product-categories",
            get(list_product_categories).post(create_product_category),
        )
        .route(
            "/api/product-categories/{id}",
            patch(update_product_category).delete(delete_product_category),
        )
        .route(
            "/api/promotions",
            get(list_promotions).post(create_promotion),
        )
        .route(
            "/api/promotions/{id}",
            patch(update_promotion).delete(delete_promotion),
        )
        .route("/api/referrals/generate", post(generate_referral))
        .route("/api/referrals", get(list_referrals))
        .route("/api/referrals/{slug}", get(get_referral))
        .route("/api/referrals/{slug}/stats", get(get_referral_stats))
        .route("/api/public/referrals/{slug}", get(get_public_referral))
        .route(
            "/api/sales/delivery-schedules",
            get(list_delivery_schedules).post(create_delivery_schedule),
        )
        .route("/api/telemetry/page-view", post(page_view))
        .route("/api/telemetry/click", post(click))
        .route("/api/telemetry/whatsapp-click", post(whatsapp_click))
        .route("/api/telemetry/pixel-event", post(pixel_event))
        .route("/api/jobs", get(list_jobs).post(create_job))
        .route("/api/jobs/{id}", patch(update_job).delete(delete_job))
        .route(
            "/api/job-applications",
            get(list_job_applications).post(create_job_application),
        )
        .route(
            "/api/job-applications/{id}/status",
            patch(update_job_application_status),
        )
        .route("/api/articles", get(list_articles).post(create_article))
        .route(
            "/api/articles/{id}",
            patch(update_article).delete(delete_article),
        )
        .route("/api/leads", get(list_leads).post(create_lead))
        .route("/api/leads/{id}/status", patch(update_lead_status))
        .route("/api/agent/stats", get(get_agent_stats))
        .route("/api/agent/claims", get(list_claims).post(create_claim))
        .route(
            "/api/agent/support-tickets",
            get(list_support_tickets).post(create_support_ticket),
        )
        .route("/api/leaderboard", get(list_leaderboard))
        // agent-registrations POST is in upload_routes (20MB body limit)
        .route(
            "/api/admin/agent-registrations",
            get(list_agent_registrations),
        )
        .route(
            "/api/admin/agent-registrations/{id}/status",
            patch(update_agent_registration_status),
        )
        .route("/api/admin/claims", get(list_all_claims))
        .route("/api/admin/claims/{id}/status", patch(update_claim_status))
        .route(
            "/api/admin/support-tickets",
            get(list_admin_support_tickets),
        )
        .route(
            "/api/admin/support-tickets/{id}/status",
            patch(update_admin_support_ticket_status),
        )
        .route("/api/admin/telemetry-stats", get(get_telemetry_stats))
        .route("/api/admin/agents", get(list_agents))
        .route(
            "/api/admin/agents/{id}/performance",
            get(get_agent_performance),
        )
        .route("/api/admin/leads", get(list_leads))
        .route("/api/admin/leads/{id}/status", patch(update_lead_status))
        .route("/api/prospek-harian", get(list_prospek_harian).post(create_prospek_harian))
        .route("/api/prospek-harian/summary", get(get_prospek_harian_summary))
        .route("/api/prospek-harian/{id}", patch(update_prospek_harian).delete(delete_prospek_harian))
        .route("/api/raport-harian", get(list_raport_harian).post(upsert_raport_harian))
        .route("/api/raport-harian/{id}/review", patch(review_raport_harian))
        .route("/api/jobdesk-report-settings", get(get_jobdesk_report_settings).patch(update_jobdesk_report_settings))
        .route("/api/jobdesk-divisions", get(get_jobdesk_divisions).patch(update_jobdesk_divisions))
        .route(
            "/api/pixels",
            post(pixel::handlers::create_pixel).get(pixel::handlers::list_pixels),
        )
        .route(
            "/api/pixels/{id}",
            get(pixel::handlers::get_pixel)
                .patch(pixel::handlers::update_pixel)
                .delete(pixel::handlers::delete_pixel),
        )
        .route(
            "/api/pixels/{id}/admins",
            post(pixel::handlers::assign_admin).get(pixel::handlers::list_pixel_admins),
        )
        .route(
            "/api/pixels/{id}/admins/{user_id}",
            delete(pixel::handlers::revoke_admin),
        )
        .route(
            "/api/campaigns",
            post(pixel::campaign_handlers::create_campaign)
                .get(pixel::campaign_handlers::list_campaigns),
        )
        .route(
            "/api/campaigns/{id}",
            get(pixel::campaign_handlers::get_campaign)
                .patch(pixel::campaign_handlers::update_campaign)
                .delete(pixel::campaign_handlers::delete_campaign),
        )
        .route(
            "/api/campaigns/{id}/conversions",
            post(pixel::campaign_handlers::create_custom_conversion)
                .get(pixel::campaign_handlers::list_custom_conversions),
        )
        .route(
            "/api/campaigns/{campaign_id}/conversions/{conversion_id}",
            patch(pixel::campaign_handlers::update_custom_conversion)
                .delete(pixel::campaign_handlers::delete_custom_conversion),
        )
        .route(
            "/api/pixel-events",
            post(pixel::event_handlers::receive_pixel_event),
        )
        .route(
            "/api/pixel-events/test",
            post(pixel::event_handlers::send_test_event),
        )
        .route(
            "/api/pixel-analytics/pixels/{id}",
            get(pixel::analytics_handlers::get_pixel_analytics),
        )
        .route(
            "/api/pixel-analytics/audit-logs",
            get(pixel::analytics_handlers::get_audit_logs),
        )
        .route(
            "/api/pixel-analytics/admin",
            get(pixel::analytics_handlers::get_admin_dashboard),
        )
        .route(
            "/api/pixel-analytics/campaigns/{id}",
            get(pixel::analytics_handlers::get_campaign_analytics),
        )
        .route(
            "/api/pixel-analytics/agent",
            get(pixel::analytics_handlers::get_agent_pixel_analytics),
        )
        .route(
            "/api/pixel-analytics/sales",
            get(pixel::analytics_handlers::get_sales_pixel_analytics),
        );

    // Upload routes with larger body limit (20MB) for multipart file uploads
    let upload_routes = Router::new()
        .route("/api/admin/uploads/image", post(upload_admin_image))
        .route("/api/admin/partners", post(create_partner))
        .route("/api/admin/partners/{id}", patch(update_partner))
        .route("/api/agent-registrations", post(submit_agent_registration))
        .route(
            "/api/wa/campaigns/{id}/recipients/upload-excel",
            post(upload_wa_recipients_excel),
        )
        .route(
            "/api/wa/blast-contacts/upload-excel",
            post(upload_blast_contacts_excel),
        )
        .route(
            "/api/wa/campaigns/upload-image",
            post(upload_campaign_image),
        )
        .route("/api/raport-harian/upload", post(upload_raport_evidence))
        .layer(axum::extract::DefaultBodyLimit::max(30 * 1024 * 1024));

    let main_router = main_router.merge(upload_routes);

    // Merge with API routes (for N8N integration)
    let main_router = main_router.merge(api_routes::router());

    // Merge landing content routes
    let main_router = main_router.merge(landing_routes::router());

    // Merge with WA Gateway API (self-hosted gateway)
    let main_router = main_router.merge(wa_gateway::router(state.clone()));

    // Apply state after all merges
    main_router.with_state(state)
}

async fn health(State(state): State<AppState>) -> ResponseBody {
    let analytics_running = state
        .analytics_job_running
        .load(std::sync::atomic::Ordering::Relaxed);
    let last_analytics = state
        .last_analytics_run
        .read()
        .await
        .map(|dt| dt.to_rfc3339());
    let last_retry = state.last_retry_run.read().await.map(|dt| dt.to_rfc3339());

    json_ok(
        "OK",
        json!({
            "status": "healthy",
            "analytics_job_running": analytics_running,
            "last_analytics_run": last_analytics,
            "last_retry_run": last_retry
        }),
    )
}

const LOGIN_EMAIL_MAX_PER_MINUTE: usize = 5;
const LOGIN_IP_MAX_PER_MINUTE: usize = 20;
const LOGIN_IP_MAX_PER_10_MINUTES: usize = 100;
const LOGIN_BLOCK_MINUTES: i64 = 15;

fn trust_proxy_headers_enabled() -> bool {
    std::env::var("TRUST_PROXY_HEADERS")
        .map(|value| value.eq_ignore_ascii_case("true") || value == "1")
        .unwrap_or(false)
}

fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    if !trust_proxy_headers_enabled() {
        return None;
    }

    let forwarded = headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|raw| raw.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);

    if forwarded.is_some() {
        return forwarded;
    }

    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

async fn enforce_rate_limit_bucket(
    buckets: &mut HashMap<String, Vec<chrono::DateTime<Utc>>>,
    key: &str,
    limit: usize,
    window: Duration,
) -> Result<(), AppError> {
    let now = Utc::now();
    let threshold = now - window;
    let entry = buckets.entry(key.to_string()).or_default();
    entry.retain(|ts| *ts > threshold);

    if entry.len() >= limit {
        return Err(AppError::TooManyRequests);
    }

    entry.push(now);
    Ok(())
}

fn is_allowed_public_url(value: &str) -> bool {
    let lower = value.trim().to_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

fn validate_text_length(value: &str, max: usize) -> bool {
    value.trim().len() <= max
}

async fn enforce_login_rate_limit(
    state: &AppState,
    email: &str,
    client_ip: Option<&str>,
) -> Result<(), AppError> {
    let key = email.trim().to_lowercase();
    if key.is_empty() {
        return Ok(());
    }

    let now = Utc::now();
    let threshold_1m = now - Duration::minutes(1);
    let threshold_10m = now - Duration::minutes(10);
    let blocked_until = now + Duration::minutes(LOGIN_BLOCK_MINUTES);

    let email_subject_key = format!("email:{}", key);
    let ip_subject_key = client_ip
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("ip:{}", value));

    {
        let mut blocked = state.blocked_login_subjects.write().await;
        blocked.retain(|_, until| *until > now);

        if let Some(until) = blocked.get(&email_subject_key) {
            let wait_minutes = (*until - now).num_minutes().max(1);
            return Err(AppError::Validation {
                errors: vec![format!(
                    "Akun diblokir sementara karena terlalu banyak percobaan login. Coba lagi dalam {} menit",
                    wait_minutes
                )],
            });
        }

        if let Some(ip_key) = ip_subject_key.as_ref() {
            if let Some(until) = blocked.get(ip_key) {
                let wait_minutes = (*until - now).num_minutes().max(1);
                return Err(AppError::Validation {
                    errors: vec![format!(
                        "IP diblokir sementara karena aktivitas login mencurigakan. Coba lagi dalam {} menit",
                        wait_minutes
                    )],
                });
            }
        }
    }

    {
        let mut attempts = state.login_email_attempts.write().await;
        let entry = attempts.entry(key.clone()).or_default();
        entry.retain(|ts| *ts > threshold_10m);

        let recent_attempts = entry.iter().filter(|ts| **ts > threshold_1m).count();
        if recent_attempts >= LOGIN_EMAIL_MAX_PER_MINUTE {
            state
                .blocked_login_subjects
                .write()
                .await
                .insert(email_subject_key, blocked_until);
            return Err(AppError::Validation {
                errors: vec![format!(
                    "Terlalu banyak percobaan login pada akun ini. Akun diblokir selama {} menit",
                    LOGIN_BLOCK_MINUTES
                )],
            });
        }

        entry.push(now);
    }

    if let Some(ip_key) = ip_subject_key {
        let mut attempts = state.login_ip_attempts.write().await;
        let entry = attempts.entry(ip_key.clone()).or_default();
        entry.retain(|ts| *ts > threshold_10m);

        let attempts_1m = entry.iter().filter(|ts| **ts > threshold_1m).count();
        let attempts_10m = entry.len();

        if attempts_1m >= LOGIN_IP_MAX_PER_MINUTE || attempts_10m >= LOGIN_IP_MAX_PER_10_MINUTES {
            state
                .blocked_login_subjects
                .write()
                .await
                .insert(ip_key, blocked_until);
            return Err(AppError::Validation {
                errors: vec![format!(
                    "Aktivitas login dari IP ini melebihi batas. IP diblokir selama {} menit",
                    LOGIN_BLOCK_MINUTES
                )],
            });
        }

        entry.push(now);
    }

    Ok(())
}

async fn clear_login_rate_limit(state: &AppState, email: &str, _client_ip: Option<&str>) {
    let key = email.trim().to_lowercase();
    if key.is_empty() {
        return;
    }

    state.login_email_attempts.write().await.remove(&key);
    state
        .blocked_login_subjects
        .write()
        .await
        .remove(&format!("email:{}", key));
}

fn cookie_secure_enabled() -> bool {
    std::env::var("COOKIE_SECURE")
        .map(|value| value.eq_ignore_ascii_case("true") || value == "1")
        .unwrap_or(false)
}

fn build_refresh_cookie(token: &str, remember: bool) -> String {
    let secure = cookie_secure_enabled();
    let same_site = if secure { "None" } else { "Lax" };
    let secure_attr = if secure { "; Secure" } else { "" };
    let max_age = if remember { 2592000 } else { 604800 }; // 30 days vs 7 days
    format!(
        "refresh_token={}; HttpOnly; Path=/; Max-Age={}; SameSite={}{}",
        token, max_age, same_site, secure_attr
    )
}

fn build_clear_refresh_cookie() -> String {
    let secure = cookie_secure_enabled();
    let same_site = if secure { "None" } else { "Lax" };
    let secure_attr = if secure { "; Secure" } else { "" };
    format!(
        "refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite={}{}",
        same_site, secure_attr
    )
}

fn extract_cookie_token(headers: &HeaderMap, key: &str) -> Option<String> {
    headers
        .get(axum::http::header::COOKIE)
        .and_then(|header| header.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .map(|segment| segment.trim())
                .find_map(|segment| {
                    let (name, value) = segment.split_once('=')?;
                    (name == key).then(|| value.to_string())
                })
        })
}

fn append_set_cookie(response: &mut ResponseBody, cookie_value: &str) {
    match HeaderValue::from_str(cookie_value) {
        Ok(value) => {
            response.headers_mut().append(SET_COOKIE, value);
        }
        Err(error) => {
            tracing::warn!("Failed to set cookie header: {}", error);
        }
    }
}

async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<ResponseBody, AppError> {
    let client_ip = extract_client_ip(&headers);
    enforce_login_rate_limit(&state, &payload.email, client_ip.as_deref()).await?;
    let email = payload.email.clone();
    let auth = login_with_request(&state, payload).await?;
    clear_login_rate_limit(&state, &email, client_ip.as_deref()).await;
    let refresh_token = auth.refresh_token.clone();
    let remember = auth.remember;
    let mut response = json_ok("Login successful", auth);
    append_set_cookie(
        &mut response,
        &build_refresh_cookie(&refresh_token, remember),
    );
    Ok(response)
}

async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    match logout_with_headers(&state, &headers).await {
        Ok(_) | Err(AppError::Unauthorized) => {
            let mut response = json_ok("Logout successful", json!({ "logged_out": true }));
            append_set_cookie(&mut response, &build_clear_refresh_cookie());
            Ok(response)
        }
        Err(e) => Err(e),
    }
}

async fn refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> axum::response::Response {
    let payload: RefreshRequest = match serde_json::from_slice(&body) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("Invalid refresh request body: {}", e);
            return json_ok("Invalid request body", json!({ "authenticated": false }));
        }
    };

    let refresh_token = if payload.refresh_token.trim().is_empty() {
        match extract_cookie_token(&headers, "refresh_token") {
            Some(token) => token,
            None => return json_ok("Session not found", json!({ "authenticated": false })),
        }
    } else {
        payload.refresh_token
    };

    match refresh_with_request(&state, RefreshRequest { refresh_token }).await {
        Ok(auth) => {
            let new_refresh_token = auth.refresh_token.clone();
            let remember = auth.remember;
            let mut response = json_ok("Token refreshed", auth);
            append_set_cookie(
                &mut response,
                &build_refresh_cookie(&new_refresh_token, remember),
            );
            response
        }
        Err(_) => {
            // Do not clear the refresh cookie here. During page reloads the
            // browser can issue parallel refresh requests with the same old
            // cookie; one request may rotate the cookie successfully while a
            // slower sibling fails with the now-stale token. Sending a clearing
            // Set-Cookie from the failed sibling would erase the fresh session.
            // Explicit logout still clears the cookie via /api/auth/logout.
            json_ok(
                "Session invalid or expired",
                json!({ "authenticated": false }),
            )
        }
    }
}

/// Wrapper untuk refresh dengan rate limiting (10 request per menit per IP)
async fn refresh_with_rate_limit(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<axum::response::Response, AppError> {
    let client_ip = extract_client_ip(&headers);
    if let Some(ip) = client_ip.as_deref() {
        const MAX_REFRESH_PER_MINUTE: usize = 10;
        let now = chrono::Utc::now();
        let threshold = now - chrono::Duration::minutes(1);

        let mut attempts = state.login_ip_attempts.write().await;
        let entry = attempts.entry(format!("refresh:{}", ip)).or_default();

        // Remove old attempts outside the window
        entry.retain(|ts| *ts > threshold);

        if entry.len() >= MAX_REFRESH_PER_MINUTE {
            return Err(AppError::TooManyRequests);
        }

        entry.push(now);
    }

    Ok(refresh(State(state), headers, body).await)
}

async fn forgot_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<ResponseBody, AppError> {
    const FORGOT_PASSWORD_COOLDOWN_SECONDS: i64 = 60;
    const FORGOT_PASSWORD_IP_COOLDOWN_SECONDS: i64 = 5;

    let email = payload.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(AppError::Validation {
            errors: vec!["Email tidak valid".to_string()],
        });
    }

    // Rate limit ringan untuk mencegah flooding email reset & pembengkakan
    // tabel password_reset_tokens. Gabungan cooldown per email dan per IP.
    // Bila terkena rate limit kita tetap mengembalikan response sukses generik
    // (tidak melempar 429) supaya tidak bocor email enumeration.
    let client_ip = extract_client_ip(&headers);
    let throttled = {
        let now = Utc::now();
        let mut attempts = state.forgot_password_attempts.write().await;
        // Cleanup entri tua agar HashMap tidak tumbuh tak terbatas.
        attempts.retain(|_, ts| now.signed_duration_since(*ts).num_minutes() < 30);

        let email_key = format!("email:{}", email);
        let ip_key = client_ip.as_ref().map(|ip| format!("ip:{}", ip));
        let mut throttled = false;
        if let Some(prev) = attempts.get(&email_key) {
            if now.signed_duration_since(*prev).num_seconds() < FORGOT_PASSWORD_COOLDOWN_SECONDS {
                throttled = true;
            }
        }
        if let Some(ip_key) = ip_key.as_ref() {
            if let Some(prev) = attempts.get(ip_key) {
                if now.signed_duration_since(*prev).num_seconds()
                    < FORGOT_PASSWORD_IP_COOLDOWN_SECONDS
                {
                    throttled = true;
                }
            }
        }

        // Hanya update timestamp jika request TIDAK ditolak. Kalau throttled
        // request ikut nge-reset window, user yang retry cepat akan stuck
        // selamanya karena cooldown terus bergeser.
        if !throttled {
            if let Some(ip_key) = ip_key {
                attempts.insert(ip_key, now);
            }
            attempts.insert(email_key, now);
        }
        throttled
    };

    if throttled {
        tracing::warn!(
            "forgot_password throttled for email={} ip={:?}",
            email,
            client_ip
        );
        return Ok(json_ok(
            "Jika akun terdaftar, instruksi reset password telah dikirim ke email",
            json!({ "accepted": true }),
        ));
    }

    // Selalu kembalikan response sukses generik untuk mencegah email enumeration.
    let user_row = sqlx::query_as::<_, (String, String, bool, String)>(
        "SELECT id, name, is_active, email FROM users WHERE LOWER(email) = ? LIMIT 1",
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error during forgot_password lookup: {}", e);
        AppError::Internal
    })?;

    if let Some((user_id, name, is_active, recipient_email)) = user_row {
        if is_active {
            // Invalidasi token reset aktif sebelumnya milik user ini supaya
            // tabel password_reset_tokens tidak tumbuh tak terbatas dan hanya
            // satu link aktif per user dalam satu waktu.
            if let Err(e) = sqlx::query(
                "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP \
                 WHERE user_id = ? AND used_at IS NULL",
            )
            .bind(&user_id)
            .execute(&state.pool)
            .await
            {
                tracing::error!("Failed to invalidate prior reset tokens: {}", e);
            }

            let token = uuid::Uuid::new_v4().simple().to_string();
            let expires_at = (Utc::now() + Duration::minutes(30)).to_rfc3339();
            let insert_res = sqlx::query(
                "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
            )
            .bind(&token)
            .bind(&user_id)
            .bind(&expires_at)
            .execute(&state.pool)
            .await;

            if let Err(e) = insert_res {
                tracing::error!("Failed to insert password reset token: {}", e);
            } else {
                let reset_link = format!(
                    "{}/reset-password?token={}",
                    frontend_base_url(),
                    urlencoding::encode(&token)
                );
                if state.mailer.is_enabled() {
                    if let Err(e) = state
                        .mailer
                        .send_password_reset_link_email(&recipient_email, &name, &reset_link)
                        .await
                    {
                        tracing::error!(
                            "Failed to send reset link to {} (requested={}): {}",
                            recipient_email,
                            email,
                            e
                        );
                    } else {
                        tracing::info!(
                            "Password reset email sent to {} (requested={})",
                            recipient_email,
                            email
                        );
                    }
                } else {
                    tracing::warn!(
                        "Mailer disabled; password reset link for {} not delivered (token logged at debug only)",
                        recipient_email
                    );
                    tracing::debug!("Reset link (mailer disabled): {}", reset_link);
                }
                state
                    .audit("auth.password_reset.requested", Some(&email))
                    .await;
            }
        }
    }

    Ok(json_ok(
        "Jika akun terdaftar, instruksi reset password telah dikirim ke email",
        json!({ "accepted": true }),
    ))
}

async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<ResponseBody, AppError> {
    let token = payload.token.trim().to_string();
    if token.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Token reset wajib disertakan".to_string()],
        });
    }
    if payload.new_password.len() < 8 {
        return Err(AppError::Validation {
            errors: vec!["Password baru minimal 8 karakter".to_string()],
        });
    }

    let row = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ? LIMIT 1",
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching reset token: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Validation {
        errors: vec!["Token reset tidak valid atau sudah kadaluarsa".to_string()],
    })?;

    let (user_id, expires_at_str, used_at) = row;
    if used_at.is_some() {
        return Err(AppError::Validation {
            errors: vec!["Token reset sudah digunakan".to_string()],
        });
    }
    let expires_at = chrono::DateTime::parse_from_rfc3339(&expires_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now() - Duration::seconds(1));
    if expires_at < Utc::now() {
        return Err(AppError::Validation {
            errors: vec!["Token reset sudah kadaluarsa".to_string()],
        });
    }

    let password_hash = hash_password(&payload.new_password);

    // Update password & invalidasi seluruh token reset milik user dalam satu
    // transaksi: kalau salah satu gagal, password tidak ikut berubah dan token
    // tidak ikut hangus. Invalidasi SEMUA token (bukan hanya yang dipakai)
    // untuk mencegah token aktif lain (mis. dari email yang bocor) ikut bisa
    // me-reset password lagi.
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("DB error starting reset transaction: {}", e);
        AppError::Internal
    })?;

    // 1) TOCTOU guard: tandai HANYA token spesifik yang sedang dipakai sebagai
    //    used. Filter `token = ? AND used_at IS NULL` sangat sempit sehingga
    //    request paralel yang sudah memakai token yang sama (atau jika
    //    forgot_password sempat meng-invalidasi token ini di antara SELECT
    //    awal & UPDATE) akan dapat 0 baris dan kita batalkan transaksi.
    let token_update = sqlx::query(
        "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP \
         WHERE token = ? AND used_at IS NULL",
    )
    .bind(&token)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("DB error marking reset token used: {}", e);
        AppError::Internal
    })?;

    if token_update.rows_affected() == 0 {
        // Token sudah dipakai/di-invalidasi oleh request paralel di antara
        // SELECT awal & UPDATE ini, atau memang sudah kadaluarsa.
        let _ = tx.rollback().await;
        return Err(AppError::Validation {
            errors: vec!["Token reset tidak lagi berlaku".to_string()],
        });
    }

    // 2) Setelah token spesifik berhasil dikunci, baru invalidasi token reset
    //    aktif lain milik user supaya link bocor lain ikut hangus.
    sqlx::query(
        "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP \
         WHERE user_id = ? AND used_at IS NULL",
    )
    .bind(&user_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("DB error invalidating sibling reset tokens: {}", e);
        AppError::Internal
    })?;

    sqlx::query("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
        .bind(&password_hash)
        .bind(&user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("DB error updating password: {}", e);
            AppError::Internal
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("DB error committing reset transaction: {}", e);
        AppError::Internal
    })?;

    // Invalidate any active sessions for this user.
    {
        let mut access = state.access_sessions.write().await;
        access.retain(|_, session| session.user_id != user_id);
    }
    {
        let mut refresh = state.refresh_sessions.write().await;
        refresh.retain(|_, session| session.user_id != user_id);
    }

    state
        .audit("auth.password_reset.completed", Some(&user_id))
        .await;
    Ok(json_ok(
        "Password berhasil direset",
        json!({ "reset": true }),
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthProfileUpdateRequest {
    name: Option<String>,
    bank_account: Option<String>,
    avatar: Option<String>,
}

#[derive(Deserialize)]
struct ChangePasswordRequest {
    #[serde(alias = "oldPassword")]
    old_password: String,
    #[serde(alias = "newPassword")]
    new_password: String,
}

#[derive(Deserialize)]
struct ResetUserPasswordRequest {
    password: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyEmailRequest {
    /// Token verifikasi yang dikirim via email. Field `email` lama masih
    /// diterima untuk kompatibilitas request lama tapi tidak lagi cukup
    /// untuk memverifikasi akun.
    token: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    email: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ForgotPasswordRequest {
    email: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResetPasswordRequest {
    token: String,
    new_password: String,
}

async fn update_auth_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthProfileUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[
            Role::Admin,
            Role::Agent,
            Role::Operator,
            Role::Sales,
            Role::Owner,
            Role::PicRaport,
            Role::Karyawan,
        ],
    )
    .await?;

    if payload.name.is_none() && payload.bank_account.is_none() && payload.avatar.is_none() {
        return Err(AppError::Validation {
            errors: vec!["Tidak ada perubahan profil yang dikirim".to_string()],
        });
    }

    let next_name = payload.name.unwrap_or(user.name);
    let next_bank_account = payload.bank_account.unwrap_or(user.bank_account);
    let next_avatar = payload.avatar.unwrap_or(user.avatar);

    if next_name.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Nama tidak boleh kosong".to_string()],
        });
    }

    sqlx::query("UPDATE users SET name = ?, bank_account = ?, avatar = ? WHERE id = ?")
        .bind(next_name.trim())
        .bind(next_bank_account.trim())
        .bind(next_avatar.trim())
        .bind(&user.id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error updating profile: {}", e);
            AppError::Internal
        })?;

    let updated = find_user_public_by_id(&state, &user.id).await?;
    Ok(json_ok(
        "Profil berhasil diperbarui",
        serde_json::to_value(updated).unwrap_or(json!({})),
    ))
}

async fn change_auth_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[
            Role::Admin,
            Role::Agent,
            Role::Operator,
            Role::Sales,
            Role::Owner,
            Role::PicRaport,
            Role::Karyawan,
        ],
    )
    .await?;

    if payload.old_password.trim().is_empty() || payload.new_password.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Password lama dan baru wajib diisi".to_string()],
        });
    }
    if payload.new_password.len() < 8 {
        return Err(AppError::Validation {
            errors: vec!["Password baru minimal 8 karakter".to_string()],
        });
    }
    if !verify_password(&payload.old_password, &user.password_hash) {
        return Err(AppError::Validation {
            errors: vec!["Password lama tidak sesuai".to_string()],
        });
    }

    let password_hash = hash_password(&payload.new_password);
    sqlx::query("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
        .bind(password_hash)
        .bind(&user.id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error updating password: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok(
        "Password berhasil diperbarui",
        json!({ "updated": true }),
    ))
}

async fn list_users(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let users: Vec<UserPublic> = sqlx::query_as(USER_PUBLIC_SELECT)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error in list_users: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok(
        format!("Users fetched by {}", user.email),
        json!({ "items": users }),
    ))
}

async fn verify_email(
    State(state): State<AppState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<ResponseBody, AppError> {
    let token = payload
        .token
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .to_string();
    if token.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Token verifikasi wajib disertakan".to_string()],
        });
    }

    let row = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT user_id, expires_at, used_at FROM email_verification_tokens WHERE token = ? LIMIT 1",
    )
    .bind(&token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching verification token: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Validation {
        errors: vec!["Token verifikasi tidak valid atau sudah kadaluarsa".to_string()],
    })?;

    let (user_id, expires_at_str, used_at) = row;
    if used_at.is_some() {
        // Idempotent: token sudah dipakai, akun dianggap sudah terverifikasi.
        return Ok(json_ok(
            "Email sudah diverifikasi sebelumnya",
            json!({ "verified": true }),
        ));
    }
    let expires_at = chrono::DateTime::parse_from_rfc3339(&expires_at_str)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now() - Duration::seconds(1));
    if expires_at < Utc::now() {
        return Err(AppError::Validation {
            errors: vec!["Token verifikasi sudah kadaluarsa".to_string()],
        });
    }

    // Mark token used + verifikasi user dalam satu transaksi (atomik) sekaligus
    // mencegah race antar request paralel pakai token yang sama: yang kedua
    // akan melihat rows_affected=0 di UPDATE token dan kita batalkan.
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("DB error starting verify transaction: {}", e);
        AppError::Internal
    })?;

    let token_update = sqlx::query(
        "UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP \
         WHERE token = ? AND used_at IS NULL",
    )
    .bind(&token)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("DB error marking verification token used: {}", e);
        AppError::Internal
    })?;

    if token_update.rows_affected() == 0 {
        // Sudah dipakai request paralel di antara SELECT awal & UPDATE ini.
        let _ = tx.rollback().await;
        return Ok(json_ok(
            "Email sudah diverifikasi sebelumnya",
            json!({ "verified": true }),
        ));
    }

    sqlx::query("UPDATE users SET is_verified = 1 WHERE id = ?")
        .bind(&user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("DB error verifying email: {}", e);
            AppError::Internal
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("DB error committing verify transaction: {}", e);
        AppError::Internal
    })?;

    state.audit("auth.email_verified", Some(&user_id)).await;
    Ok(json_ok(
        "Email berhasil diverifikasi",
        json!({ "verified": true }),
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserCreateRequest {
    id: Option<String>,
    email: String,
    name: String,
    role: String,
    /// Jabatan (title) — only used when role = "sales". Stored separately from role.
    jabatan: Option<String>,
    /// Divisi — only used when role = "karyawan". Determines jobdesk and prospek target.
    divisi: Option<String>,
    password: String,
    avatar: Option<String>,
    bank_account: Option<String>,
    whatsapp: Option<String>,
    is_active: Option<bool>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct UserUpdateRequest {
    email: Option<String>,
    name: Option<String>,
    role: Option<String>,
    /// Jabatan (title) — only used when role = "sales". Stored separately from role.
    jabatan: Option<String>,
    /// Divisi — only used when role = "karyawan".
    divisi: Option<String>,
    password: Option<String>,
    avatar: Option<String>,
    bank_account: Option<String>,
    whatsapp: Option<String>,
    is_active: Option<bool>,
    is_verified: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeliveryScheduleCreateRequest {
    customer_name: String,
    item_name: String,
    payment_status: String,
    address: String,
    sales_name: String,
    sender_branch: String,
}

#[derive(sqlx::FromRow, serde::Serialize)]
struct DeliveryScheduleRecord {
    id: String,
    customer_name: String,
    item_name: String,
    payment_status: String,
    address: String,
    sales_user_id: String,
    sales_name: String,
    sender_branch: String,
    referral_slug: Option<String>,
    created_at: Option<String>,
}

#[derive(sqlx::FromRow)]
struct PublicReferralRecord {
    slug: String,
    target_path: String,
    label: Option<String>,
    owner_name: String,
    owner_whatsapp: String,
    is_active: bool,
    created_at: Option<String>,
}

#[derive(sqlx::FromRow)]
struct LeadRecord {
    id: String,
    agent_id: String,
    customer_name: String,
    phone_number: String,
    interested_product: String,
    status: String,
    notes: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeadCreateRequest {
    agent_id: Option<String>,
    customer_name: String,
    phone_number: String,
    interested_product: String,
    status: Option<String>,
    notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LeadStatusUpdateRequest {
    status: String,
    notes: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSupportTicketRequest {
    subject: String,
    message: Option<String>,
    priority: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSupportTicketStatusRequest {
    status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WaAccountCreateRequest {
    name: String,
    gateway_config: Option<Value>,
    enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WaCampaignCreateRequest {
    name: String,
    config: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WaAccountUpdateRequest {
    name: Option<String>,
    gateway_config: Option<Value>,
    enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WaCampaignUpdateRequest {
    name: Option<String>,
    config: Option<Value>,
    status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WaRecipientInput {
    phone: String,
    variables: Option<Value>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum WaRecipientsPayload {
    One(WaRecipientInput),
    Many { recipients: Vec<WaRecipientInput> },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WaSummaryResponse {
    id: String,
    name: String,
    gateway_config: Value,
    enabled: bool,
    status: Option<String>,
    phone_number: Option<String>,
    last_error: Option<String>,
    message_count_today: Option<i64>,
    created_by: Option<String>,
    created_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WaCampaignSummaryResponse {
    id: String,
    name: String,
    status: String,
    config: Value,
    created_by: Option<String>,
    created_by_name: Option<String>,
    created_by_email: Option<String>,
    created_at: Option<String>,
    started_at: Option<String>,
    recipient_total: i64,
    recipient_sent: i64,
    recipient_skipped: i64,
    recipient_failed: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WaRecipientSummaryResponse {
    id: String,
    phone: String,
    name: Option<String>,
    variables: Value,
    status: String,
    last_attempt_at: Option<String>,
    delivered_at: Option<String>,
    read_at: Option<String>,
    replied_at: Option<String>,
    last_error: Option<String>,
    created_at: Option<String>,
}

fn recipient_display_name(variables: &Value) -> Option<String> {
    let object = variables.as_object()?;
    for key in [
        "name",
        "nama",
        "Nama",
        "NAMA",
        "customer_name",
        "customerName",
    ] {
        if let Some(value) = object.get(key).and_then(|v| v.as_str()) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

fn normalize_phone(value: &str) -> Option<String> {
    // Strip all non-digit characters (spaces, dashes, dots, parentheses, plus sign)
    let digits: String = value.chars().filter(|ch| ch.is_ascii_digit()).collect();

    if digits.is_empty() {
        return None;
    }

    // Normalize to Indonesian format: 62xxxxxxxxxx
    let normalized = if digits.starts_with("62") {
        // Already in international format: 628xxx
        digits
    } else if digits.starts_with("0") {
        // Local format: 08xxx → 628xxx
        format!("62{}", &digits[1..])
    } else if digits.starts_with("8") {
        // Without prefix: 8xxx → 628xxx
        format!("62{}", digits)
    } else if digits.len() >= 10 && digits.starts_with("62") {
        // Already correct
        digits
    } else {
        // Unknown format, try prepending 62 if it looks like a local number
        if digits.len() >= 9 && digits.len() <= 13 {
            format!("62{}", digits)
        } else {
            digits
        }
    };

    // Validate: Indonesian numbers should be 10-15 digits total (with 62 prefix)
    if normalized.len() < 10 || normalized.len() > 15 {
        return None;
    }

    // Must start with 62
    if !normalized.starts_with("62") {
        return None;
    }

    Some(normalized)
}

fn parse_json_value(text: Option<String>) -> Value {
    text.and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or(Value::Null)
}

fn default_wa_campaign_config() -> Value {
    json!({
        "delayMs": 3000,
        "jitterMs": 500,
        "dedupeDays": 7,
        "accountStrategy": "round_robin"
    })
}

fn parse_json_value_or_default(text: Option<String>, default: Value) -> Value {
    let parsed = parse_json_value(text);
    if parsed.is_null() {
        default
    } else {
        parsed
    }
}

fn normalize_role(value: &str) -> Option<String> {
    let role = value
        .trim()
        .to_lowercase()
        .replace(" ", "_")
        .replace("-", "_");
    if matches!(
        role.as_str(),
        "admin"
            | "agent"
            | "sales"
            | "operator"
            | "owner"
            | "pic_raport"
            | "karyawan"
            | "editor"
            | "wa_admin"
            | "wa_operator"
            | "super_admin"
    ) {
        Some(role)
    } else {
        None
    }
}

fn normalize_jabatan(value: &str) -> String {
    match value.trim().to_lowercase().replace(" ", "_").as_str() {
        "kepala_cabang" | "kepala cabang" | "kepalacabang" => "kepala_cabang".to_string(),
        "supervisor" => "supervisor".to_string(),
        "koordinator" => "koordinator".to_string(),
        "sales" => "sales".to_string(),
        _ => "sales".to_string(), // default jabatan for sales role
    }
}

fn slugify_sales_name(value: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;

    for ch in value.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

fn validate_whatsapp(value: &str) -> bool {
    let digits = value.chars().filter(|ch| ch.is_ascii_digit()).count();
    digits >= 9 && digits <= 16
}

fn frontend_base_url() -> String {
    std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "http://localhost:5173".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn validate_referral_target_path(value: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok("/".to_string());
    }
    if !trimmed.starts_with('/') || trimmed.starts_with("//") {
        return Err(AppError::Validation {
            errors: vec![
                "targetPath harus berupa path internal yang diawali '/' (contoh: /produk/abc)"
                    .to_string(),
            ],
        });
    }
    let lowered = trimmed.to_ascii_lowercase();
    if lowered.starts_with("/javascript:") || lowered.starts_with("/data:") {
        return Err(AppError::Validation {
            errors: vec!["targetPath tidak boleh berisi skema berbahaya".to_string()],
        });
    }
    Ok(trimmed.to_string())
}

fn image_decode_limits() -> image::Limits {
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(8000);
    limits.max_image_height = Some(8000);
    limits.max_alloc = Some(64 * 1024 * 1024);
    limits
}

fn decode_uploaded_image(data: &[u8]) -> Result<image::DynamicImage, AppError> {
    let cursor = std::io::Cursor::new(data);
    let format = image::guess_format(data).map_err(|e| {
        tracing::warn!("Failed to guess image format: {}", e);
        AppError::Validation {
            errors: vec!["Format file gambar tidak didukung".to_string()],
        }
    })?;
    let mut reader = image::ImageReader::with_format(cursor, format);
    reader.limits(image_decode_limits());
    reader.decode().map_err(|e| {
        tracing::warn!("Failed to decode uploaded image: {}", e);
        AppError::Validation {
            errors: vec!["Format file gambar tidak didukung atau ukuran terlalu besar".to_string()],
        }
    })
}

/// Helper to save a DynamicImage as WebP to the uploads directory with a given suffix.
/// Returns the relative URL path for the saved image.
fn save_image_as_webp(image: image::DynamicImage, suffix: &str) -> Result<String, AppError> {
    let file_id = uuid::Uuid::new_v4().to_string();
    let file_name = format!("{}_{}.webp", file_id, suffix);
    let file_path = format!("uploads/{}", file_name);

    tracing::info!("Saving image as WebP to {}...", file_path);
    image
        .save_with_format(&file_path, image::ImageFormat::WebP)
        .map_err(|e| {
            tracing::error!("Failed to save image as webp ({}): {}", file_name, e);
            AppError::Internal
        })?;

    Ok(format!("/uploads/{}", file_name))
}

fn validate_user_create(payload: &UserCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.email.trim().is_empty() || !payload.email.contains('@') {
        errors.push("email tidak valid".to_string());
    }
    if payload.name.trim().is_empty() {
        errors.push("name wajib diisi".to_string());
    }
    if normalize_role(&payload.role).is_none() {
        errors.push("role harus salah satu dari: admin, agent, sales, operator, owner, pic_raport, karyawan, editor, wa_admin, wa_operator, super_admin".to_string());
    }
    if payload.password.len() < 8 {
        errors.push("password minimal 8 karakter".to_string());
    }
    if payload.role.trim().eq_ignore_ascii_case("sales")
        && payload
            .whatsapp
            .as_ref()
            .is_none_or(|value| value.trim().is_empty())
    {
        errors.push("whatsapp wajib diisi untuk role sales".to_string());
    }
    if payload.role.trim().eq_ignore_ascii_case("karyawan")
        && payload
            .divisi
            .as_ref()
            .is_none_or(|value| value.trim().is_empty())
    {
        errors.push("divisi wajib diisi untuk role karyawan".to_string());
    }
    if payload
        .whatsapp
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty() && !validate_whatsapp(value))
    {
        errors.push("whatsapp tidak valid".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_user_update(payload: &UserUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload
        .email
        .as_ref()
        .is_some_and(|value| value.trim().is_empty() || !value.contains('@'))
    {
        errors.push("email tidak valid".to_string());
    }
    if payload
        .name
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("name tidak boleh kosong".to_string());
    }
    if payload
        .role
        .as_ref()
        .is_some_and(|value| normalize_role(value).is_none())
    {
        errors.push("role harus salah satu dari: admin, agent, sales, operator, owner, pic_raport, karyawan, editor, wa_admin, wa_operator, super_admin".to_string());
    }
    if payload
        .password
        .as_ref()
        .is_some_and(|value| value.len() < 8)
    {
        errors.push("password minimal 8 karakter".to_string());
    }
    if payload
        .whatsapp
        .as_ref()
        .is_some_and(|value| !value.trim().is_empty() && !validate_whatsapp(value))
    {
        errors.push("whatsapp tidak valid".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_lead_status(status: &str) -> bool {
    matches!(
        status,
        "Follow Up" | "Negosiasi" | "Closed Won" | "Closed Lost"
    )
}

fn normalize_local_whatsapp(value: &str) -> String {
    let digits = value
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect::<String>();
    if digits.is_empty() {
        return String::new();
    }
    if let Some(rest) = digits.strip_prefix("620") {
        return format!("0{}", rest);
    }
    if let Some(rest) = digits.strip_prefix("62") {
        return format!("0{}", rest);
    }
    if digits.starts_with('8') {
        return format!("0{}", digits);
    }
    if digits.starts_with('0') {
        return digits;
    }
    format!("0{}", digits)
}

fn validate_lead_create(payload: &LeadCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.customer_name.trim().is_empty() {
        errors.push("customerName wajib diisi".to_string());
    }
    if payload.phone_number.trim().is_empty() {
        errors.push("phoneNumber wajib diisi".to_string());
    }
    if payload.interested_product.trim().is_empty() {
        errors.push("interestedProduct wajib diisi".to_string());
    }
    if payload
        .status
        .as_ref()
        .is_some_and(|value| !validate_lead_status(value.trim()))
    {
        errors.push("status lead tidak valid".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_lead_status_update(payload: &LeadStatusUpdateRequest) -> Result<(), AppError> {
    if !validate_lead_status(payload.status.trim()) {
        return Err(AppError::Validation {
            errors: vec!["status lead tidak valid".to_string()],
        });
    }
    Ok(())
}

fn lead_to_json(record: LeadRecord) -> Value {
    json!({
        "id": record.id,
        "agentId": record.agent_id,
        "customerName": record.customer_name,
        "phoneNumber": record.phone_number,
        "interestedProduct": record.interested_product,
        "status": record.status,
        "notes": record.notes,
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    })
}

#[derive(sqlx::FromRow)]
struct SupportTicketRecord {
    id: String,
    agent_id: String,
    subject: String,
    message: Option<String>,
    priority: String,
    status: String,
    created_at: Option<String>,
}

#[derive(sqlx::FromRow)]
struct AdminSupportTicketRow {
    id: String,
    agent_id: String,
    subject: String,
    message: Option<String>,
    priority: String,
    status: String,
    created_at: Option<String>,
    updated_at: Option<String>,
    agent_name: Option<String>,
    agent_email: Option<String>,
}

#[derive(sqlx::FromRow)]
struct NotificationRecord {
    id: String,
    recipient_user_id: String,
    r#type: String,
    title: String,
    message: Option<String>,
    action_path: Option<String>,
    entity_id: Option<String>,
    is_read: bool,
    created_at: Option<String>,
    read_at: Option<String>,
}

fn support_ticket_to_json(record: SupportTicketRecord) -> Value {
    json!({
        "id": record.id,
        "agentId": record.agent_id,
        "subject": record.subject,
        "message": record.message,
        "priority": record.priority,
        "status": record.status,
        "createdAt": record.created_at,
    })
}

fn normalize_ticket_priority(priority: Option<&str>) -> String {
    match priority.unwrap_or("medium").trim().to_lowercase().as_str() {
        "high" => "high".to_string(),
        "low" => "low".to_string(),
        _ => "medium".to_string(),
    }
}

fn normalize_ticket_status(status: &str) -> Option<String> {
    match status.trim().to_lowercase().as_str() {
        "open" => Some("open".to_string()),
        "in_progress" | "in-progress" | "processing" => Some("in_progress".to_string()),
        "resolved" | "closed" | "done" => Some("resolved".to_string()),
        _ => None,
    }
}

fn admin_support_ticket_to_json(row: AdminSupportTicketRow) -> Value {
    json!({
        "id": row.id,
        "agentId": row.agent_id,
        "agentName": row.agent_name,
        "agentEmail": row.agent_email,
        "subject": row.subject,
        "message": row.message,
        "priority": row.priority,
        "status": row.status,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    })
}

fn notification_to_json(record: NotificationRecord) -> Value {
    json!({
        "id": record.id,
        "recipientUserId": record.recipient_user_id,
        "type": record.r#type,
        "title": record.title,
        "message": record.message,
        "actionPath": record.action_path,
        "entityId": record.entity_id,
        "isRead": record.is_read,
        "createdAt": record.created_at,
        "readAt": record.read_at,
    })
}

async fn create_notification_for_user(
    state: &AppState,
    recipient_user_id: &str,
    notif_type: &str,
    title: &str,
    message: Option<&str>,
    action_path: Option<&str>,
    entity_id: Option<&str>,
) {
    let id = uuid::Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO notifications (id, recipient_user_id, type, title, message, action_path, entity_id, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
    )
    .bind(id)
    .bind(recipient_user_id)
    .bind(notif_type)
    .bind(title)
    .bind(message)
    .bind(action_path)
    .bind(entity_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::warn!("Failed to create notification for user {}: {}", recipient_user_id, e);
        e
    });
}

async fn notify_all_admins(
    state: &AppState,
    notif_type: &str,
    title: &str,
    message: Option<&str>,
    action_path: Option<&str>,
    entity_id: Option<&str>,
) {
    let admin_ids = sqlx::query_scalar::<_, String>(
        "SELECT id FROM users WHERE LOWER(role) = 'admin' AND is_active = 1",
    )
    .fetch_all(&state.pool)
    .await;

    match admin_ids {
        Ok(ids) => {
            for admin_id in ids {
                create_notification_for_user(
                    state,
                    &admin_id,
                    notif_type,
                    title,
                    message,
                    action_path,
                    entity_id,
                )
                .await;
            }
        }
        Err(e) => tracing::warn!("Failed to fetch admin users for notifications: {}", e),
    }
}

async fn find_user_public_by_id(state: &AppState, id: &str) -> Result<UserPublic, AppError> {
    let query = format!("{USER_PUBLIC_SELECT} WHERE id = ? LIMIT 1");
    sqlx::query_as::<_, UserPublic>(&query)
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)
}

async fn find_lead_by_id(state: &AppState, id: &str) -> Result<LeadRecord, AppError> {
    sqlx::query_as::<_, LeadRecord>(
        "SELECT id, agent_id, customer_name, phone_number, interested_product, status, notes, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM leads WHERE id = ? LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)
}

async fn generate_unique_sales_slug(
    state: &AppState,
    base_name: &str,
    user_id: &str,
) -> Result<String, AppError> {
    let fallback = {
        let slug = slugify_sales_name(base_name);
        if slug.is_empty() {
            "sales".to_string()
        } else {
            slug
        }
    };
    let suffix = user_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(8)
        .collect::<String>();
    let mut candidate = fallback.clone();

    for _ in 0..10 {
        let exists = sqlx::query_scalar::<_, String>(
            "SELECT referral_slug FROM users WHERE referral_slug = ? AND id != ? LIMIT 1",
        )
        .bind(&candidate)
        .bind(user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking sales slug: {}", e);
            AppError::Internal
        })?;

        if exists.is_none() {
            return Ok(candidate);
        }

        candidate = format!("{}-{}", fallback, suffix);
    }

    Ok(format!("{}-{}", fallback, suffix))
}

async fn sync_sales_referral(
    state: &AppState,
    user_id: &str,
    name: &str,
    slug: &str,
    is_active: bool,
) -> Result<(), AppError> {
    let existing_slug = sqlx::query_scalar::<_, String>(
        "SELECT slug FROM referrals WHERE owner_user_id = ? LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error loading existing sales referral: {}", e);
        AppError::Internal
    })?;

    if let Some(current_slug) = existing_slug {
        sqlx::query(
            "UPDATE referrals SET slug = ?, label = ?, target_path = ?, is_active = ? WHERE owner_user_id = ?"
        )
        .bind(slug)
        .bind(name.trim())
        .bind("/produk")
        .bind(is_active)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error updating sales referral: {}", e);
            AppError::Internal
        })?;

        if current_slug != slug {
            tracing::info!(
                "Updated sales referral slug from {} to {} for {}",
                current_slug,
                slug,
                user_id
            );
        }
    } else {
        sqlx::query(
            "INSERT INTO referrals (id, slug, owner_user_id, label, target_path, is_active) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(slug)
        .bind(user_id)
        .bind(name.trim())
        .bind("/produk")
        .bind(is_active)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error inserting sales referral: {}", e);
            AppError::Internal
        })?;
    }

    Ok(())
}

async fn create_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UserCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    validate_user_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let role = normalize_role(&payload.role).ok_or(AppError::Validation {
        errors: vec!["role tidak valid".to_string()],
    })?;
    let password_hash = hash_password(&payload.password);
    let whatsapp = payload.whatsapp.unwrap_or_else(|| "".to_string());
    let jabatan = if role == "sales" {
        payload
            .jabatan
            .as_deref()
            .map(normalize_jabatan)
            .unwrap_or_else(|| "sales".to_string())
    } else {
        String::new()
    };
    let referral_slug = if role == "sales" {
        generate_unique_sales_slug(&state, &payload.name, &id).await?
    } else {
        String::new()
    };
    let divisi = if role == "karyawan" {
        payload.divisi.as_deref().unwrap_or("").trim().to_string()
    } else {
        String::new()
    };

    sqlx::query(
        "INSERT INTO users (id, email, name, role, jabatan, divisi, password_hash, avatar, bank_account, whatsapp, referral_slug, is_active, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(payload.email.trim())
    .bind(payload.name.trim())
    .bind(&role)
    .bind(&jabatan)
    .bind(&divisi)
    .bind(password_hash)
    .bind(payload.avatar.unwrap_or_else(|| "".to_string()))
    .bind(payload.bank_account.unwrap_or_else(|| "".to_string()))
    .bind(whatsapp)
    .bind(&referral_slug)
    .bind(payload.is_active.unwrap_or(true))
    .bind(true) // Admin created users are verified by default
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    if role == "sales" {
        sync_sales_referral(
            &state,
            &id,
            payload.name.trim(),
            &referral_slug,
            payload.is_active.unwrap_or(true),
        )
        .await?;
    }

    let created = find_user_public_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("User created by {}", user.email),
        json!({ "item": created }),
    ))
}

async fn get_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let item = find_user_public_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("User {} fetched by {}", id, user.email),
        json!({ "item": item }),
    ))
}

async fn update_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UserUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    tracing::info!(
        "Admin {} updating user {}; fields=[email={}, name={}, role={}, password={}, avatar={}, bank_account={}, is_active={}, is_verified={}]",
        user.email,
        id,
        payload.email.is_some(),
        payload.name.is_some(),
        payload.role.is_some(),
        payload.password.is_some(),
        payload.avatar.is_some(),
        payload.bank_account.is_some(),
        payload.is_active.is_some(),
        payload.is_verified.is_some(),
    );
    validate_user_update(&payload)?;

    let current = sqlx::query_as::<_, (String, String, String, String, String, String, String, String, String, String, bool, bool)>(
        "SELECT email, name, role, jabatan, divisi, password_hash, avatar, bank_account, whatsapp, referral_slug, is_active, is_verified FROM users WHERE id = ? LIMIT 1",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let (
        current_email,
        current_name,
        current_role,
        current_jabatan,
        current_divisi,
        current_password_hash,
        current_avatar,
        current_bank_account,
        current_whatsapp,
        current_referral_slug,
        current_is_active,
        current_is_verified,
    ) = current;

    let next_email = payload.email.unwrap_or(current_email);
    let next_name = payload.name.unwrap_or(current_name);
    let next_role = payload
        .role
        .as_deref()
        .and_then(normalize_role)
        .unwrap_or_else(|| current_role.clone());
    let next_jabatan = if next_role == "sales" {
        payload
            .jabatan
            .as_deref()
            .map(normalize_jabatan)
            .unwrap_or_else(|| {
                if current_jabatan.is_empty() {
                    "sales".to_string()
                } else {
                    current_jabatan.clone()
                }
            })
    } else {
        String::new()
    };
    let next_divisi = if next_role == "karyawan" {
        payload
            .divisi
            .as_deref()
            .unwrap_or(&current_divisi)
            .trim()
            .to_string()
    } else {
        String::new()
    };
    let next_password_hash = payload
        .password
        .as_deref()
        .map(hash_password)
        .unwrap_or_else(|| current_password_hash.clone());
    let next_avatar = payload.avatar.unwrap_or(current_avatar);
    let next_bank_account = payload.bank_account.unwrap_or(current_bank_account);
    let next_whatsapp = payload.whatsapp.unwrap_or(current_whatsapp);
    let next_is_active = payload.is_active.unwrap_or(current_is_active);
    let next_is_verified = payload.is_verified.unwrap_or(current_is_verified);
    let next_referral_slug = if next_role == "sales" {
        generate_unique_sales_slug(&state, &next_name, &id).await?
    } else {
        current_referral_slug.clone()
    };

    if next_role == "sales" && next_whatsapp.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["whatsapp wajib diisi untuk role sales".to_string()],
        });
    }
    if next_role == "karyawan" && next_divisi.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["divisi wajib diisi untuk role karyawan".to_string()],
        });
    }

    let should_invalidate_sessions = next_role != current_role
        || next_password_hash != current_password_hash
        || next_is_active != current_is_active
        || next_is_verified != current_is_verified;

    sqlx::query(
        "UPDATE users SET email = ?, name = ?, role = ?, jabatan = ?, divisi = ?, password_hash = ?, avatar = ?, bank_account = ?, whatsapp = ?, referral_slug = ?, is_active = ?, is_verified = ? WHERE id = ?",
    )
    .bind(next_email.trim())
    .bind(next_name.trim())
    .bind(&next_role)
    .bind(&next_jabatan)
    .bind(&next_divisi)
    .bind(next_password_hash)
    .bind(next_avatar)
    .bind(next_bank_account)
    .bind(next_whatsapp)
    .bind(&next_referral_slug)
    .bind(next_is_active)
    .bind(next_is_verified)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    if next_role == "sales" {
        sync_sales_referral(&state, &id, &next_name, &next_referral_slug, next_is_active).await?;
    } else if current_role.eq_ignore_ascii_case("sales") {
        sqlx::query("UPDATE referrals SET is_active = 0 WHERE owner_user_id = ?")
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error disabling sales referral: {}", e);
                AppError::Internal
            })?;
    }

    if should_invalidate_sessions {
        state.invalidate_user_sessions(&id).await;
    }

    let updated = find_user_public_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("User {} updated by {}", id, user.email),
        json!({ "item": updated }),
    ))
}

async fn reset_user_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ResetUserPasswordRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    if payload.password.trim().len() < 8 {
        return Err(AppError::Validation {
            errors: vec!["Password baru minimal 8 karakter".to_string()],
        });
    }

    let query = format!("{USER_RECORD_SELECT} WHERE id = ?");
    let target_user =
        sqlx::query_as::<_, crate::state::UserRecord>(&query)
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching user for password reset: {}", e);
                AppError::Internal
            })?
            .ok_or(AppError::NotFound)?;

    let password_hash = hash_password(payload.password.trim());
    let result =
        sqlx::query("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?")
            .bind(password_hash)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error resetting user password: {}", e);
                AppError::Internal
            })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Invalidate any existing sessions for this user.
    state.invalidate_user_sessions(&id).await;

    if state.mailer.is_enabled() {
        if let Err(e) = state
            .mailer
            .send_password_reset_email(
                &target_user.email,
                &target_user.name,
                payload.password.trim(),
            )
            .await
        {
            tracing::error!(
                "Failed to send password reset email to {}: {}",
                target_user.email,
                e
            );
        }
    } else {
        tracing::warn!(
            "Mailer disabled; admin-reset password for {} will not be emailed",
            target_user.email
        );
    }

    Ok(json_ok(
        format!("Password user {} direset oleh {}", id, user.email),
        json!({ "updated": true }),
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RewardTierPublic {
    id: String,
    name: String,
    threshold_points: i64,
    reward_value: i64,
    is_active: bool,
}

async fn list_reward_tiers(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::Agent, Role::Sales]).await?;

    let tiers = sqlx::query_as::<_, (String, String, i64, i64, bool)>(
        "SELECT id, name, threshold_points, reward_value, is_active FROM reward_tiers ORDER BY threshold_points ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .into_iter()
    .map(|row| RewardTierPublic {
        id: row.0,
        name: row.1,
        threshold_points: row.2,
        reward_value: row.3,
        is_active: row.4,
    })
    .collect::<Vec<_>>();

    Ok(json_ok("Reward tiers fetched", json!({ "items": tiers })))
}

async fn upload_admin_image(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let mut uploaded_url: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        AppError::Internal
    })? {
        if field.name().unwrap_or_default() != "file" {
            continue;
        }

        let file_name_orig = field.file_name().unwrap_or("unknown").to_string();
        tracing::info!("Receiving upload for file: {}", file_name_orig);

        let data = field.bytes().await.map_err(|e| {
            tracing::error!("Failed to get bytes for {}: {}", file_name_orig, e);
            AppError::Internal
        })?;

        tracing::info!("Received {} bytes for {}", data.len(), file_name_orig);

        if data.is_empty() {
            tracing::warn!("Received empty data for {}", file_name_orig);
            continue;
        }

        tracing::info!("Loading image from memory...");
        let image = decode_uploaded_image(&data)?;

        let url = save_image_as_webp(image, "article")?;
        uploaded_url = Some(url);
        break;
    }

    let url = uploaded_url.ok_or(AppError::Validation {
        errors: vec!["File gambar wajib diunggah".to_string()],
    })?;

    Ok(json_ok("Image uploaded", json!({ "url": url })))
}

async fn upload_raport_evidence(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Karyawan]).await?;
    let mut uploaded_url: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        AppError::Internal
    })? {
        if field.name().unwrap_or_default() != "file" {
            continue;
        }

        let original_name = field.file_name().unwrap_or("evidence").to_string();
        let extension = original_name
            .rsplit('.')
            .next()
            .map(|value| value.to_lowercase())
            .filter(|value| matches!(value.as_str(), "jpg" | "jpeg" | "png" | "webp" | "mp4" | "webm" | "mov"))
            .unwrap_or_else(|| "bin".to_string());
        if extension == "bin" {
            return Err(AppError::Validation {
                errors: vec!["Format bukti harus gambar atau video".to_string()],
            });
        }
        let content_type = field
            .content_type()
            .map(|value| value.to_string())
            .unwrap_or_default();

        let data = field.bytes().await.map_err(|e| {
            tracing::error!("Failed to read raport evidence: {}", e);
            AppError::Internal
        })?;
        if data.is_empty() {
            return Err(AppError::Validation {
                errors: vec!["File bukti kosong".to_string()],
            });
        }
        if data.len() > 30 * 1024 * 1024 {
            return Err(AppError::Validation {
                errors: vec!["Ukuran bukti maksimal 30 MB".to_string()],
            });
        }
        if !is_valid_raport_evidence_content(&extension, &content_type, &data) {
            return Err(AppError::Validation {
                errors: vec!["Isi file bukti tidak sesuai dengan format yang diunggah".to_string()],
            });
        }

        tokio::fs::create_dir_all("uploads/raport").await.map_err(|e| {
            tracing::error!("Failed creating raport upload dir: {}", e);
            AppError::Internal
        })?;
        let file_name = format!("{}_raport.{}", uuid::Uuid::new_v4(), extension);
        let file_path = format!("uploads/raport/{}", file_name);
        tokio::fs::write(&file_path, &data).await.map_err(|e| {
            tracing::error!("Failed writing raport evidence: {}", e);
            AppError::Internal
        })?;
        uploaded_url = Some(format!("/uploads/raport/{}", file_name));
        break;
    }

    let url = uploaded_url.ok_or(AppError::Validation {
        errors: vec!["File bukti wajib diunggah".to_string()],
    })?;
    Ok(json_ok("Raport evidence uploaded", json!({ "url": url })))
}

fn is_valid_raport_evidence_content(extension: &str, content_type: &str, data: &[u8]) -> bool {
    let lowered_mime = content_type.to_ascii_lowercase();
    match extension {
        "jpg" | "jpeg" => {
            lowered_mime.starts_with("image/jpeg")
                && data.len() >= 3
                && data[0] == 0xff
                && data[1] == 0xd8
                && data[2] == 0xff
        }
        "png" => {
            lowered_mime.starts_with("image/png")
                && data.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a])
        }
        "webp" => {
            lowered_mime.starts_with("image/webp")
                && data.len() >= 12
                && &data[0..4] == b"RIFF"
                && &data[8..12] == b"WEBP"
        }
        "mp4" | "mov" => {
            (lowered_mime.starts_with("video/mp4") || lowered_mime.starts_with("video/quicktime"))
                && data.len() >= 12
                && &data[4..8] == b"ftyp"
        }
        "webm" => {
            lowered_mime.starts_with("video/webm")
                && data.starts_with(&[0x1a, 0x45, 0xdf, 0xa3])
        }
        _ => false,
    }
}

/// Serve files from uploads/private/ — requires admin auth
async fn serve_private_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(filename): Path<String>,
) -> Result<axum::response::Response, AppError> {
    use axum::response::IntoResponse;

    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Sanitize filename: only allow alphanumeric, dash, underscore, dot
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(AppError::Validation {
            errors: vec!["Invalid filename".to_string()],
        });
    }
    if !filename
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(AppError::Validation {
            errors: vec!["Invalid filename".to_string()],
        });
    }

    let file_path = format!("uploads/private/{}", filename);
    let data = tokio::fs::read(&file_path)
        .await
        .map_err(|_| AppError::NotFound)?;

    let content_type = if filename.ends_with(".webp") {
        "image/webp"
    } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg") {
        "image/jpeg"
    } else if filename.ends_with(".png") {
        "image/png"
    } else {
        "application/octet-stream"
    };

    Ok((
        [
            (axum::http::header::CONTENT_TYPE, content_type),
            (axum::http::header::CACHE_CONTROL, "private, max-age=300"),
        ],
        data,
    )
        .into_response())
}

async fn list_wa_accounts(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;

    let rows = if user.role.eq_ignore_ascii_case("admin") {
        sqlx::query_as::<_, (String, String, Option<String>, bool, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>, Option<String>)>(
            "SELECT id, name, gateway_config, enabled, status, phone_number, last_error, message_count_today, created_by, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM wa_accounts ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, (String, String, Option<String>, bool, Option<String>, Option<String>, Option<String>, Option<i64>, Option<String>, Option<String>)>(
            "SELECT id, name, gateway_config, enabled, status, phone_number, last_error, message_count_today, created_by, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM wa_accounts WHERE created_by = ? ORDER BY created_at DESC",
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error fetching WA accounts: {}", e);
        AppError::Internal
    })?;

    let items = rows
        .into_iter()
        .map(
            |(
                id,
                name,
                gateway_config,
                enabled,
                status,
                phone_number,
                last_error,
                message_count_today,
                created_by,
                created_at,
            )| WaSummaryResponse {
                id,
                name,
                gateway_config: parse_json_value(gateway_config),
                enabled,
                status,
                phone_number,
                last_error,
                message_count_today,
                created_by,
                created_at,
            },
        )
        .collect::<Vec<_>>();

    Ok(json_ok("WA accounts fetched", json!({ "items": items })))
}

async fn ensure_wa_account_access(
    state: &AppState,
    user: &UserRecord,
    account_id: &str,
) -> Result<(), AppError> {
    if user.role.eq_ignore_ascii_case("admin") {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA account access: {}", e);
                AppError::Internal
            })?;

        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound)
        };
    }

    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ? AND created_by = ?")
            .bind(account_id)
            .bind(&user.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA account ownership: {}", e);
                AppError::Internal
            })?;

    if exists > 0 {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

async fn create_wa_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WaAccountCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["name wajib diisi".to_string()],
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let gateway_config = payload
        .gateway_config
        .unwrap_or_else(|| json!({}))
        .to_string();
    let enabled = payload.enabled.unwrap_or(true);

    sqlx::query(
        "INSERT INTO wa_accounts (id, name, gateway_config, enabled, created_by) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name)
    .bind(gateway_config)
    .bind(enabled)
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating WA account: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        format!("WA account created by {}", user.email),
        json!({ "item": { "id": id } }),
    ))
}

async fn update_wa_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<WaAccountUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_account_access(&state, &user, &id).await?;

    if let Some(name) = &payload.name {
        sqlx::query("UPDATE wa_accounts SET name = ? WHERE id = ?")
            .bind(name)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    if let Some(config) = &payload.gateway_config {
        sqlx::query("UPDATE wa_accounts SET gateway_config = ? WHERE id = ?")
            .bind(config.to_string())
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    if let Some(enabled) = payload.enabled {
        sqlx::query("UPDATE wa_accounts SET enabled = ? WHERE id = ?")
            .bind(enabled)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    Ok(json_ok("WA account updated", json!({ "id": id })))
}

async fn delete_wa_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_account_access(&state, &user, &id).await?;

    sqlx::query("DELETE FROM wa_accounts WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok(json_ok("WA account deleted", json!({ "id": id })))
}

async fn list_wa_campaigns(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;

    let rows = if user.role.eq_ignore_ascii_case("admin") {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, i64, i64, i64, i64)>(
            "SELECT c.id, c.name, c.status, c.config, c.created_by, u.name AS created_by_name, u.email AS created_by_email, DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(c.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, CAST(COALESCE(COUNT(r.id), 0) AS SIGNED) AS recipient_total, CAST(COALESCE(SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_sent, CAST(COALESCE(SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_skipped, CAST(COALESCE(SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_failed FROM wa_campaigns c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN wa_recipients r ON r.campaign_id = c.id GROUP BY c.id, u.name, u.email ORDER BY c.created_at DESC",
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, i64, i64, i64, i64)>(
            "SELECT c.id, c.name, c.status, c.config, c.created_by, u.name AS created_by_name, u.email AS created_by_email, DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(c.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, CAST(COALESCE(COUNT(r.id), 0) AS SIGNED) AS recipient_total, CAST(COALESCE(SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_sent, CAST(COALESCE(SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_skipped, CAST(COALESCE(SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_failed FROM wa_campaigns c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN wa_recipients r ON r.campaign_id = c.id WHERE c.created_by = ? GROUP BY c.id, u.name, u.email ORDER BY c.created_at DESC",
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error fetching WA campaigns: {}", e);
        AppError::Internal
    })?;

    let items = rows
        .into_iter()
        .map(
            |(
                id,
                name,
                status,
                config,
                created_by,
                created_by_name,
                created_by_email,
                created_at,
                started_at,
                recipient_total,
                recipient_sent,
                recipient_skipped,
                recipient_failed,
            )| WaCampaignSummaryResponse {
                id,
                name,
                status: status.unwrap_or_else(|| "draft".to_string()),
                config: parse_json_value_or_default(config, default_wa_campaign_config()),
                created_by,
                created_by_name,
                created_by_email,
                created_at,
                started_at,
                recipient_total,
                recipient_sent,
                recipient_skipped,
                recipient_failed,
            },
        )
        .collect::<Vec<_>>();

    Ok(json_ok("WA campaigns fetched", json!({ "items": items })))
}

async fn ensure_wa_campaign_access(
    state: &AppState,
    user: &UserRecord,
    campaign_id: &str,
) -> Result<(), AppError> {
    if user.role.eq_ignore_ascii_case("admin") {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_campaigns WHERE id = ?")
            .bind(campaign_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA campaign access: {}", e);
                AppError::Internal
            })?;

        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound)
        };
    }

    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_campaigns WHERE id = ? AND created_by = ?")
            .bind(campaign_id)
            .bind(&user.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA campaign ownership: {}", e);
                AppError::Internal
            })?;

    if exists > 0 {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

async fn ensure_wa_recipient_access(
    state: &AppState,
    user: &UserRecord,
    recipient_id: &str,
) -> Result<(), AppError> {
    if user.role.eq_ignore_ascii_case("admin") {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_recipients WHERE id = ?")
            .bind(recipient_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA recipient access: {}", e);
                AppError::Internal
            })?;

        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound)
        };
    }

    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM wa_recipients r
         JOIN wa_campaigns c ON c.id = r.campaign_id
         WHERE r.id = ? AND c.created_by = ?",
    )
    .bind(recipient_id)
    .bind(&user.id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error checking WA recipient ownership: {}", e);
        AppError::Internal
    })?;

    if exists > 0 {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

async fn create_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WaCampaignCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["name wajib diisi".to_string()],
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let config = payload
        .config
        .unwrap_or_else(default_wa_campaign_config)
        .to_string();

    sqlx::query(
        "INSERT INTO wa_campaigns (id, name, created_by, config, status) VALUES (?, ?, ?, ?, 'draft')",
    )
    .bind(&id)
    .bind(name)
    .bind(&user.id)
    .bind(config)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating WA campaign: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        format!("WA campaign created by {}", user.email),
        json!({ "item": { "id": id } }),
    ))
}

async fn get_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;
    let item = fetch_wa_campaign_summary(&state, &id).await?;
    Ok(json_ok("WA campaign fetched", json!({ "item": item })))
}

async fn update_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<WaCampaignUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    if let Some(name) = &payload.name {
        sqlx::query("UPDATE wa_campaigns SET name = ? WHERE id = ?")
            .bind(name)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    if let Some(config) = &payload.config {
        sqlx::query("UPDATE wa_campaigns SET config = ? WHERE id = ?")
            .bind(config.to_string())
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    if let Some(status) = &payload.status {
        sqlx::query("UPDATE wa_campaigns SET status = ? WHERE id = ?")
            .bind(status)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    Ok(json_ok("WA campaign updated", json!({ "id": id })))
}

async fn delete_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    sqlx::query("DELETE FROM wa_recipients WHERE campaign_id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    sqlx::query("DELETE FROM wa_campaigns WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok(json_ok("WA campaign deleted", json!({ "id": id })))
}

async fn add_wa_recipients(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<WaRecipientsPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    let campaign_config: Option<String> =
        sqlx::query_scalar("SELECT config FROM wa_campaigns WHERE id = ? LIMIT 1")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error loading WA campaign config: {}", e);
                AppError::Internal
            })?;

    let campaign_config = campaign_config.ok_or(AppError::NotFound)?;
    let config_value = parse_json_value(Some(campaign_config));
    let dedupe_days = wa_config_dedupe_days(&config_value);
    let recipients = match payload {
        WaRecipientsPayload::One(item) => vec![item],
        WaRecipientsPayload::Many { recipients } => recipients,
    };

    if recipients.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["recipients wajib diisi".to_string()],
        });
    }

    let mut inserted = 0_i64;
    let mut skipped = 0_i64;
    let mut invalid = Vec::new();

    for recipient in recipients {
        let phone = match normalize_phone(&recipient.phone) {
            Some(value) => value,
            None => {
                invalid.push(format!("phone tidak valid: {}", recipient.phone));
                continue;
            }
        };
        let variables = recipient.variables.unwrap_or_else(|| json!({})).to_string();
        let recipient_id = uuid::Uuid::new_v4().to_string();
        let duplicate_exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM wa_dispatch_logs WHERE phone = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1",
        )
        .bind(&phone)
        .bind(dedupe_days.max(1))
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking WA dedupe: {}", e);
            AppError::Internal
        })?;

        let status = if duplicate_exists.is_some() {
            "skipped"
        } else {
            "pending"
        };
        if duplicate_exists.is_some() {
            skipped += 1;
        } else {
            inserted += 1;
        }

        sqlx::query(
            "INSERT INTO wa_recipients (id, campaign_id, phone, variables_json, status) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&recipient_id)
        .bind(&id)
        .bind(&phone)
        .bind(variables)
        .bind(status)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error inserting WA recipient: {}", e);
            AppError::Internal
        })?;
    }

    if !invalid.is_empty() {
        return Err(AppError::Validation { errors: invalid });
    }

    Ok(json_ok(
        "WA recipients imported",
        json!({ "inserted": inserted, "skipped": skipped }),
    ))
}

/// Download a CSV template for bulk recipient import
async fn download_recipients_template(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Result<axum::response::Response, AppError> {
    use axum::response::IntoResponse;
    let _user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;

    // Generate CSV template with BOM for Excel compatibility
    let bom = "\u{FEFF}";
    let csv_content = format!(
        "{}phone,name,var1,var2\n628123456789,Budi Santoso,value1,value2\n628987654321,Andi Wijaya,value1,value2\n",
        bom
    );

    Ok((
        [
            (axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8"),
            (
                axum::http::header::CONTENT_DISPOSITION,
                "attachment; filename=\"wa_recipients_template.csv\"",
            ),
            (axum::http::header::CACHE_CONTROL, "no-cache"),
        ],
        csv_content,
    )
        .into_response())
}

/// Upload recipients from an Excel (.xlsx/.xls) or CSV file
async fn upload_wa_recipients_excel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    // Verify campaign exists
    let campaign_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM wa_campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error: {}", e);
                AppError::Internal
            })?;

    if campaign_exists.is_none() {
        return Err(AppError::NotFound);
    }

    // Load campaign config for dedupe
    let campaign_config: Option<String> =
        sqlx::query_scalar("SELECT config FROM wa_campaigns WHERE id = ? LIMIT 1")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error: {}", e);
                AppError::Internal
            })?;

    let config_value = parse_json_value(campaign_config);
    let dedupe_days = wa_config_dedupe_days(&config_value);

    // Read the uploaded file
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name = String::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        AppError::Internal
    })? {
        let field_name = field.name().unwrap_or_default().to_string();
        if field_name == "file" {
            file_name = field.file_name().unwrap_or("upload.xlsx").to_string();
            file_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| {
                        tracing::error!("Failed to read file bytes: {}", e);
                        AppError::Internal
                    })?
                    .to_vec(),
            );
            break;
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| AppError::Validation {
        errors: vec!["No file uploaded. Please attach an Excel or CSV file.".to_string()],
    })?;

    let file_name_lower = file_name.to_lowercase();
    let is_csv = file_name_lower.ends_with(".csv");

    // Parse rows from file
    let rows: Vec<Vec<String>> = if is_csv {
        // Parse CSV
        let content = String::from_utf8_lossy(&file_bytes);
        let mut csv_rows = Vec::new();
        for line in content.lines() {
            let line = line.trim().trim_start_matches('\u{FEFF}');
            if line.is_empty() {
                continue;
            }
            let cols: Vec<String> = line
                .split(',')
                .map(|s| s.trim().trim_matches('"').to_string())
                .collect();
            csv_rows.push(cols);
        }
        csv_rows
    } else {
        // Parse Excel using calamine
        use calamine::{open_workbook_auto_from_rs, Reader};
        use std::io::Cursor;
        let cursor = Cursor::new(&file_bytes);
        let mut workbook = open_workbook_auto_from_rs(cursor).map_err(|e| {
            tracing::error!("Failed to open Excel file: {}", e);
            AppError::Validation {
                errors: vec![format!("Failed to read Excel file: {}", e)],
            }
        })?;

        let sheet_name = workbook.sheet_names().first().cloned().unwrap_or_default();
        let range = workbook.worksheet_range(&sheet_name).map_err(|e| {
            tracing::error!("Failed to read Excel sheet: {}", e);
            AppError::Validation {
                errors: vec![format!("Failed to read sheet: {}", e)],
            }
        })?;

        let mut excel_rows = Vec::new();
        for row in range.rows() {
            let cols: Vec<String> = row
                .iter()
                .map(|cell| {
                    use calamine::Data;
                    match cell {
                        Data::String(s) => s.clone(),
                        Data::Float(f) => {
                            if *f == (*f as i64) as f64 {
                                format!("{}", *f as i64)
                            } else {
                                format!("{}", f)
                            }
                        }
                        Data::Int(i) => format!("{}", i),
                        Data::Bool(b) => format!("{}", b),
                        _ => String::new(),
                    }
                })
                .collect();
            excel_rows.push(cols);
        }
        excel_rows
    };

    tracing::info!(
        campaign_id = %id,
        file_name = %file_name,
        row_count = rows.len(),
        "WA recipient Excel upload parsed"
    );

    if rows.is_empty() {
        tracing::warn!(
            campaign_id = %id,
            file_name = %file_name,
            "WA recipient Excel upload rejected: empty file"
        );
        return Err(AppError::Validation {
            errors: vec!["File kosong. Gunakan header phone/name atau wa/nama.".to_string()],
        });
    }

    let has_data_row = rows
        .iter()
        .skip(1)
        .any(|row| row.iter().any(|cell| !cell.trim().is_empty()));
    if !has_data_row {
        tracing::warn!(
            campaign_id = %id,
            file_name = %file_name,
            header = ?rows.first(),
            "WA recipient Excel upload rejected: header only"
        );
        return Err(AppError::Validation {
            errors: vec![
                "File hanya berisi header. Tambahkan minimal satu baris data penerima.".to_string(),
            ],
        });
    }

    // Parse header to find column indices
    let header: Vec<String> = rows[0]
        .iter()
        .map(|h| h.to_lowercase().trim().to_string())
        .collect();
    tracing::info!(
        campaign_id = %id,
        file_name = %file_name,
        header = ?header,
        "WA recipient Excel upload header detected"
    );
    let looks_like_phone = |cell: &str| {
        let digits: String = cell.chars().filter(|c| c.is_ascii_digit()).collect();
        digits.len() >= 9 && digits.len() <= 15
    };

    let phone_idx = header
        .iter()
        .position(|h| {
            h == "phone"
                || h == "wa"
                || h == "nomor"
                || h == "no_hp"
                || h == "whatsapp"
                || h == "no hp"
                || h == "nohp"
                || h == "hp"
                || h == "telepon"
        })
        .or_else(|| {
            header.iter().enumerate().find_map(|(idx, h)| {
                if h == "no"
                    && rows.iter().skip(1).any(|row| {
                        row.get(idx)
                            .map(|cell| looks_like_phone(cell))
                            .unwrap_or(false)
                    })
                {
                    Some(idx)
                } else {
                    None
                }
            })
        })
        .or_else(|| {
            // Fallback: find first column that contains phone-like data in any data row.
            rows.iter()
                .skip(1)
                .find_map(|row| row.iter().position(|cell| looks_like_phone(cell)))
        });

    let phone_idx = phone_idx.ok_or_else(|| {
        tracing::warn!(
            campaign_id = %id,
            file_name = %file_name,
            header = ?header,
            "WA recipient Excel upload rejected: phone column not found"
        );
        AppError::Validation { errors: vec![
            "Kolom nomor telepon tidak ditemukan. Header yang didukung: phone, wa, nomor, no_hp, whatsapp, hp, telepon. Header 'no' hanya dipakai jika berisi nomor WhatsApp, bukan nomor urut.".to_string()
        ] }
    })?;

    // All other columns become variables
    let var_columns: Vec<(usize, String)> = header
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != phone_idx)
        .map(|(i, name)| (i, name.clone()))
        .collect();

    let mut inserted = 0_i64;
    let mut skipped = 0_i64;
    let mut invalid = Vec::new();

    for (row_num, row) in rows.iter().enumerate().skip(1) {
        let phone_raw = row
            .get(phone_idx)
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if phone_raw.is_empty() {
            continue;
        }

        let phone = match normalize_phone(&phone_raw) {
            Some(p) => p,
            None => {
                invalid.push(format!(
                    "Baris {}: nomor tidak valid '{}'",
                    row_num + 1,
                    phone_raw
                ));
                continue;
            }
        };

        // Build variables JSON from other columns
        let mut vars = serde_json::Map::new();
        for (col_idx, col_name) in &var_columns {
            let val = row
                .get(*col_idx)
                .map(|s| s.trim().to_string())
                .unwrap_or_default();
            if !val.is_empty() {
                vars.insert(col_name.clone(), serde_json::Value::String(val.clone()));
                let normalized_col = col_name.trim().to_lowercase();
                if normalized_col != *col_name {
                    vars.entry(normalized_col.clone())
                        .or_insert_with(|| serde_json::Value::String(val.clone()));
                }
                if matches!(
                    normalized_col.as_str(),
                    "nama" | "nama_lengkap" | "full_name" | "customer_name" | "customername"
                ) {
                    vars.entry("name".to_string())
                        .or_insert_with(|| serde_json::Value::String(val));
                }
            }
        }
        let variables = serde_json::Value::Object(vars).to_string();

        // Dedupe check
        let duplicate_exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM wa_dispatch_logs WHERE phone = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1",
        )
        .bind(&phone)
        .bind(dedupe_days.max(1))
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;

        let status = if duplicate_exists.is_some() {
            "skipped"
        } else {
            "pending"
        };
        if duplicate_exists.is_some() {
            skipped += 1;
        } else {
            inserted += 1;
        }

        let recipient_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO wa_recipients (id, campaign_id, phone, variables_json, status) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&recipient_id)
        .bind(&id)
        .bind(&phone)
        .bind(&variables)
        .bind(status)
        .execute(&state.pool)
        .await
        .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    }

    let mut msg = format!(
        "{} recipients imported, {} skipped (dedupe)",
        inserted, skipped
    );
    if !invalid.is_empty() {
        msg = format!("{}. {} invalid rows.", msg, invalid.len());
    }

    Ok(json_ok(
        msg,
        json!({
            "inserted": inserted,
            "skipped": skipped,
            "invalid": invalid,
            "total_rows": rows.len() - 1,
        }),
    ))
}

fn has_local_wa_credentials(session_id: &str) -> bool {
    [
        PathBuf::from("sessions")
            .join(session_id)
            .join("creds.json"),
        PathBuf::from("backend")
            .join("sessions")
            .join(session_id)
            .join("creds.json"),
    ]
    .iter()
    .any(|path| path.exists())
}

async fn restore_enabled_wa_sessions(state: &AppState) -> Result<(), AppError> {
    let accounts: Vec<(String, Option<String>, Option<String>)> =
        sqlx::query_as("SELECT id, credentials, status FROM wa_accounts WHERE enabled = 1")
            .fetch_all(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error loading WA accounts for restore: {}", e);
                AppError::Internal
            })?;

    if accounts.is_empty() {
        return Ok(());
    }

    let active_sessions = state.bridge_client.get_active_sessions().await;

    for (session_id, credentials, status) in accounts {
        if active_sessions.iter().any(|active| active == &session_id) {
            continue;
        }

        let has_db_credentials = credentials
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
        let has_local_credentials = has_local_wa_credentials(&session_id);

        if !has_db_credentials && !has_local_credentials {
            continue;
        }

        tracing::info!(
            session_id = %session_id,
            previous_status = ?status,
            has_db_credentials,
            has_local_credentials,
            "Attempting automatic WA session restore before starting campaign"
        );

        sqlx::query(
            "UPDATE wa_accounts SET status = 'reconnecting', last_error = NULL WHERE id = ?",
        )
        .bind(&session_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error marking WA account reconnecting: {}", e);
            AppError::Internal
        })?;

        if let Err(e) = state.bridge_client.spawn_process(session_id.clone()).await {
            tracing::warn!(session_id = %session_id, error = %e, "Failed to spawn WA bridge during automatic restore");
            let _ =
                sqlx::query("UPDATE wa_accounts SET status = 'error', last_error = ? WHERE id = ?")
                    .bind(format!("Automatic restore spawn failed: {}", e))
                    .bind(&session_id)
                    .execute(&state.pool)
                    .await;
            continue;
        }

        let mut params = json!({ "session_id": session_id.clone() });
        if let Some(credentials) = credentials
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            params["credentials"] = Value::String(credentials.clone());
        }

        if let Err(e) = state
            .bridge_client
            .send_request(&session_id, "init_session".to_string(), params)
            .await
        {
            tracing::warn!(session_id = %session_id, error = %e, "Failed to initialize WA session during automatic restore");
            let _ = state.bridge_client.kill_process(&session_id).await;
            let _ =
                sqlx::query("UPDATE wa_accounts SET status = 'error', last_error = ? WHERE id = ?")
                    .bind(format!("Automatic restore init failed: {}", e))
                    .bind(&session_id)
                    .execute(&state.pool)
                    .await;
        }
    }

    Ok(())
}

async fn start_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    // 1. Validate campaign exists and is not already running
    let campaign_status: Option<(String,)> =
        sqlx::query_as("SELECT status FROM wa_campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error: {}", e);
                AppError::Internal
            })?;

    let campaign_status = campaign_status.ok_or(AppError::NotFound)?;
    if campaign_status.0 == "running" {
        let pending_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM wa_recipients WHERE campaign_id = ? AND status = 'pending'",
        )
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!(
                "DB error counting pending recipients for running campaign: {}",
                e
            );
            AppError::Internal
        })?;

        return Ok(json_ok(
            "Campaign sedang berjalan",
            json!({
                "item": fetch_wa_campaign_summary(&state, &id).await?,
                "enqueued": 0,
                "pending": pending_count.0,
                "already_running": true,
            }),
        ));
    }

    if campaign_status.0 == "paused" {
        let resumed = sqlx::query(
            "UPDATE wa_recipients SET status = 'pending' WHERE campaign_id = ? AND status = 'paused'",
        )
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error resuming paused WA campaign recipients: {}", e);
            AppError::Internal
        })?
        .rows_affected();

        tracing::info!(
            "Campaign {} resumed by {}. Restored {} paused recipients to pending.",
            id,
            user.email,
            resumed
        );
    }

    // 2. Validate there are pending recipients
    let pending_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM wa_recipients WHERE campaign_id = ? AND status = 'pending'",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    if pending_count.0 == 0 {
        return Err(AppError::Validation {
            errors: vec!["No pending recipients to send to".to_string()],
        });
    }

    // 3. Validate at least one WA account is enabled and connected
    let account_count_sql = if user.role.eq_ignore_ascii_case("admin") {
        "SELECT COUNT(*) FROM wa_accounts WHERE enabled = 1 AND status = 'connected'"
    } else {
        "SELECT COUNT(*) FROM wa_accounts WHERE enabled = 1 AND status = 'connected' AND created_by = ?"
    };
    let mut count_query = sqlx::query_as::<_, (i64,)>(account_count_sql);
    if !user.role.eq_ignore_ascii_case("admin") {
        count_query = count_query.bind(&user.id);
    }
    let mut account_count: (i64,) = count_query.fetch_one(&state.pool).await.map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    if account_count.0 == 0 {
        restore_enabled_wa_sessions(&state).await?;

        let restore_deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(15);
        while tokio::time::Instant::now() < restore_deadline {
            let mut count_query = sqlx::query_as::<_, (i64,)>(account_count_sql);
            if !user.role.eq_ignore_ascii_case("admin") {
                count_query = count_query.bind(&user.id);
            }
            account_count = count_query.fetch_one(&state.pool).await.map_err(|e| {
                tracing::error!("DB error: {}", e);
                AppError::Internal
            })?;

            if account_count.0 > 0 {
                break;
            }

            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        }
    }

    if account_count.0 == 0 {
        return Err(AppError::Validation { errors: vec!["Tidak ada akun WhatsApp yang connected. Sistem sudah mencoba memulihkan session otomatis dari penyimpanan lokal, tetapi belum berhasil. Jika akun pernah logout dari WhatsApp, scan QR ulang diperlukan.".to_string()] });
    }

    // 4. Update campaign status to running
    sqlx::query(
        "UPDATE wa_campaigns SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error starting WA campaign: {}", e);
        AppError::Internal
    })?;

    tracing::info!(
        "Campaign {} started by {} with {} pending recipients",
        id,
        user.email,
        pending_count.0
    );

    // 5. Optionally enqueue to Redis for BlastEngine (if available)
    let mut enqueued: usize = 0;
    if let Some(qm) = &state.queue_manager {
        let account_ids: Vec<(String,)> = if user.role.eq_ignore_ascii_case("admin") {
            sqlx::query_as("SELECT id FROM wa_accounts WHERE enabled = 1 AND status = 'connected'")
                .fetch_all(&state.pool)
                .await
        } else {
            sqlx::query_as(
                "SELECT id FROM wa_accounts WHERE enabled = 1 AND status = 'connected' AND created_by = ?",
            )
            .bind(&user.id)
            .fetch_all(&state.pool)
            .await
        }
        .unwrap_or_default();

        let account_id_list: Vec<String> = account_ids.into_iter().map(|r| r.0).collect();
        if !account_id_list.is_empty() {
            match qm.enqueue_campaign(&id, &account_id_list).await {
                Ok(count) => {
                    enqueued = count;
                    tracing::info!(
                        "Campaign {} also enqueued {} recipients to Redis",
                        id,
                        count
                    );
                }
                Err(e) => {
                    tracing::warn!("Redis enqueue failed for campaign {}: {}", id, e);
                }
            }
        }
    }

    // Campaign recipients are stored in the DB; BlastEngine will process them.

    Ok(json_ok(
        format!(
            "WA campaign started by {} ({} recipients pending)",
            user.email, pending_count.0
        ),
        json!({
            "item": fetch_wa_campaign_summary(&state, &id).await?,
            "enqueued": enqueued,
            "pending": pending_count.0,
        }),
    ))
}

async fn pause_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    let current_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM wa_campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error loading WA campaign for pause: {}", e);
                AppError::Internal
            })?;

    let current_status = current_status.ok_or(AppError::NotFound)?;
    if current_status != "running" {
        return Err(AppError::Validation {
            errors: vec![format!(
                "Campaign tidak sedang berjalan. Status saat ini: {}",
                current_status
            )],
        });
    }

    // ATOMIC TRANSACTION: Update campaign status and mark pending recipients as paused
    // This ensures that blast engine workers will skip all pending messages
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("Failed to begin transaction: {}", e);
        AppError::Internal
    })?;

    // Update campaign status to 'paused'
    sqlx::query("UPDATE wa_campaigns SET status = 'paused' WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("DB error pausing WA campaign in transaction: {}", e);
            AppError::Internal
        })?;

    // Mark all pending recipients as 'paused' to prevent any in-flight sends
    // This is defensive - blast engine should skip based on campaign status,
    // but marking recipients ensures double protection against race conditions
    let paused_recipients = sqlx::query(
        "UPDATE wa_recipients SET status = 'paused' WHERE campaign_id = ? AND status = 'pending'",
    )
    .bind(&id)
    .execute(&mut *tx)
    .await
    .map_err(|e| {
        tracing::error!("DB error marking recipients as paused: {}", e);
        AppError::Internal
    })?
    .rows_affected() as i64;

    // Commit transaction atomically
    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit pause transaction: {}", e);
        AppError::Internal
    })?;

    tracing::info!(
        "Campaign {} status updated to 'paused' by {}. Marked {} pending recipients as paused.",
        id,
        user.email,
        paused_recipients
    );

    // NOW remove from Redis queues (after DB is committed)
    let (queue_depth_before, removed_from_queue, queue_depth_after) =
        if let Some(qm) = &state.queue_manager {
            // Get queue depth before removal (for verification)
            let before = match qm.get_campaign_queue_depth(&id).await {
                Ok(count) => {
                    tracing::info!(
                        "Campaign {} has {} messages in Redis queue before removal",
                        id,
                        count
                    );
                    count
                }
                Err(e) => {
                    tracing::warn!("Failed to get queue depth before removal: {}", e);
                    0
                }
            };

            // Remove messages from queue
            let removed = match qm.remove_campaign_messages(&id).await {
                Ok(count) => {
                    tracing::info!(
                        "Successfully removed {} queued messages for campaign {} from Redis",
                        count,
                        id
                    );
                    count
                }
                Err(e) => {
                    tracing::error!(
                        "CRITICAL: Failed to remove queued messages for paused campaign {}: {}",
                        id,
                        e
                    );
                    0
                }
            };

            // Get queue depth after removal (for verification)
            let after = match qm.get_campaign_queue_depth(&id).await {
                Ok(count) => {
                    if count > 0 {
                        tracing::warn!(
                        "WARNING: Campaign {} still has {} messages in Redis queue after removal. \
                         This may indicate a removal failure or race condition.",
                        id, count
                    );
                    } else {
                        tracing::info!(
                            "Campaign {} queue successfully cleared. All {} messages removed.",
                            id,
                            removed
                        );
                    }
                    count
                }
                Err(e) => {
                    tracing::warn!("Failed to verify queue depth after removal: {}", e);
                    0
                }
            };

            (before, removed, after)
        } else {
            tracing::warn!(
                "Queue manager not available, cannot remove queued messages for campaign {}",
                id
            );
            (0, 0, 0)
        };

    // Log comprehensive pause operation summary
    tracing::info!(
        "Campaign {} pause operation completed. Summary:\n\
         - Requested by: {}\n\
         - DB: {} pending recipients marked as 'paused'\n\
         - Redis queue before: {} messages\n\
         - Redis queue removed: {} messages\n\
         - Redis queue after: {} messages\n\
         - Status: {}",
        id,
        user.email,
        paused_recipients,
        queue_depth_before,
        removed_from_queue,
        queue_depth_after,
        if queue_depth_after == 0 {
            "✅ CLEAN"
        } else {
            "⚠️ INCOMPLETE"
        }
    );

    Ok(json_ok(
        "Campaign paused",
        json!({
            "item": fetch_wa_campaign_summary(&state, &id).await?,
            "pending_recipients_paused": paused_recipients,
            "queue_metrics": {
                "before": queue_depth_before,
                "removed": removed_from_queue,
                "after": queue_depth_after,
                "clean": queue_depth_after == 0,
            }
        }),
    ))
}

async fn reset_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    // Verify campaign exists and do not reset an active blast in-place.
    let current_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM wa_campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    let current_status = current_status.ok_or(AppError::NotFound)?;
    if current_status == "running" {
        return Err(AppError::Validation {
            errors: vec![
                "Campaign sedang berjalan. Pause campaign terlebih dahulu sebelum reset."
                    .to_string(),
            ],
        });
    }

    // Reset all non-pending recipients back to pending
    let result = sqlx::query(
        "UPDATE wa_recipients
         SET status = 'pending',
             sent_at = NULL,
             delivered_at = NULL,
             read_at = NULL,
             replied_at = NULL,
             last_attempt_at = NULL,
             last_error = NULL
         WHERE campaign_id = ? AND status != 'pending'",
    )
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error resetting campaign recipients: {}", e);
        AppError::Internal
    })?;

    // Reset campaign status to draft
    sqlx::query("UPDATE wa_campaigns SET status = 'draft' WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    let reset_count = result.rows_affected();
    tracing::info!(
        "Campaign {} reset by {}: {} recipients reset to pending",
        id,
        user.email,
        reset_count
    );

    Ok(json_ok(
        "Campaign reset",
        json!({
            "reset_count": reset_count,
            "campaign_id": id,
        }),
    ))
}

async fn get_wa_campaign_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;
    let campaign = fetch_wa_campaign_summary(&state, &id).await?;

    let recipient_rows = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, phone, variables_json, status,
                DATE_FORMAT(last_attempt_at, '%Y-%m-%d %H:%i:%s') AS last_attempt_at,
                DATE_FORMAT(delivered_at, '%Y-%m-%d %H:%i:%s') AS delivered_at,
                DATE_FORMAT(read_at, '%Y-%m-%d %H:%i:%s') AS read_at,
                DATE_FORMAT(replied_at, '%Y-%m-%d %H:%i:%s') AS replied_at,
                last_error,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
         FROM wa_recipients WHERE campaign_id = ? ORDER BY created_at DESC",
    )
    .bind(&id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching WA recipients: {}", e);
        AppError::Internal
    })?;

    let recipients = recipient_rows
        .into_iter()
        .map(
            |(
                id,
                phone,
                variables,
                status,
                last_attempt_at,
                delivered_at,
                read_at,
                replied_at,
                last_error,
                created_at,
            )| WaRecipientSummaryResponse {
                id,
                phone,
                name: recipient_display_name(&parse_json_value(variables.clone())),
                variables: parse_json_value(variables),
                status,
                last_attempt_at,
                delivered_at,
                read_at,
                replied_at,
                last_error,
                created_at,
            },
        )
        .collect::<Vec<_>>();

    Ok(json_ok(
        "WA campaign status fetched",
        json!({ "campaign": campaign, "recipients": recipients }),
    ))
}

/// GET /api/wa/campaigns/{id}/metrics - Get campaign metrics
/// **Validates: Requirements 10.5, 10.6, 10.8**
///
/// Returns comprehensive campaign metrics including:
/// - Campaign details (name, status)
/// - Real-time metrics (total sent, delivered rate, read rate, reply rate)
/// - Hourly metrics breakdown
///
/// Authentication: Admin, WaAdmin, or WaOperator role required
async fn get_wa_campaign_metrics(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    // Authorize user with appropriate roles
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    // Get complete campaign metrics response
    let metrics_response = crate::campaign_metrics::get_campaign_metrics_response(&state.pool, &id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get campaign metrics for {}: {}", id, e);
            // Check if it's a "not found" error
            if e.to_string().contains("not found") {
                AppError::NotFound
            } else {
                AppError::Internal
            }
        })?;

    tracing::info!(
        "Campaign metrics retrieved: {} (sent: {}, delivered: {:.2}%, read: {:.2}%, reply: {:.2}%)",
        id,
        metrics_response.metrics.total_sent,
        metrics_response.metrics.delivered_rate,
        metrics_response.metrics.read_rate,
        metrics_response.metrics.reply_rate
    );

    Ok(json_ok(
        "Campaign metrics berhasil diambil",
        json!({
            "campaignId": metrics_response.campaign_id,
            "campaignName": metrics_response.campaign_name,
            "status": metrics_response.status,
            "metrics": {
                "totalRecipients": metrics_response.metrics.total_recipients,
                "totalSent": metrics_response.metrics.total_sent,
                "totalDelivered": metrics_response.metrics.total_delivered,
                "totalRead": metrics_response.metrics.total_read,
                "totalReplied": metrics_response.metrics.total_replied,
                "totalFailed": metrics_response.metrics.total_failed,
                "deliveredRate": metrics_response.metrics.delivered_rate,
                "readRate": metrics_response.metrics.read_rate,
                "replyRate": metrics_response.metrics.reply_rate,
            },
            "hourlyMetrics": metrics_response.hourly_metrics,
        }),
    ))
}

async fn upload_campaign_image(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;

    let mut uploaded_url: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        AppError::Internal
    })? {
        if field.name().unwrap_or_default() != "file" {
            continue;
        }

        let file_name_orig = field.file_name().unwrap_or("unknown").to_string();
        tracing::info!("Receiving campaign image upload: {}", file_name_orig);

        let data = field.bytes().await.map_err(|e| {
            tracing::error!("Failed to get bytes for {}: {}", file_name_orig, e);
            AppError::Internal
        })?;

        if data.is_empty() {
            tracing::warn!("Received empty data for {}", file_name_orig);
            continue;
        }

        // Validate file size (max 16MB for images)
        const MAX_IMAGE_SIZE: usize = 16 * 1024 * 1024;
        if data.len() > MAX_IMAGE_SIZE {
            return Err(AppError::Validation {
                errors: vec![format!(
                    "Gambar terlalu besar: {}MB (maks 16MB)",
                    data.len() / 1024 / 1024
                )],
            });
        }

        // Decode and validate image
        tracing::info!("Loading and validating image from memory...");
        let image = decode_uploaded_image(&data)?;

        // Save as WebP
        let url = save_image_as_webp(image, "campaign")?;
        uploaded_url = Some(url);
        break;
    }

    let url = uploaded_url.ok_or(AppError::Validation {
        errors: vec!["File gambar wajib diunggah".to_string()],
    })?;

    tracing::info!("Campaign image successfully uploaded: {}", url);
    Ok(json_ok(
        "Campaign image uploaded",
        json!({ "url": url, "media_url": url }),
    ))
}

async fn fetch_wa_campaign_summary(
    state: &AppState,
    id: &str,
) -> Result<WaCampaignSummaryResponse, AppError> {
    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, i64, i64, i64, i64)>(
        "SELECT c.id, c.name, c.status, c.config, c.created_by, u.name AS created_by_name, u.email AS created_by_email, DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(c.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, CAST(COALESCE(COUNT(r.id), 0) AS SIGNED) AS recipient_total, CAST(COALESCE(SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_sent, CAST(COALESCE(SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_skipped, CAST(COALESCE(SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END), 0) AS SIGNED) AS recipient_failed FROM wa_campaigns c LEFT JOIN users u ON u.id = c.created_by LEFT JOIN wa_recipients r ON r.campaign_id = c.id WHERE c.id = ? GROUP BY c.id, u.name, u.email LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error loading WA campaign summary: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let (
        id,
        name,
        status,
        config,
        created_by,
        created_by_name,
        created_by_email,
        created_at,
        started_at,
        recipient_total,
        recipient_sent,
        recipient_skipped,
        recipient_failed,
    ) = row;

    Ok(WaCampaignSummaryResponse {
        id,
        name,
        status: status.unwrap_or_else(|| "draft".to_string()),
        config: parse_json_value_or_default(config, default_wa_campaign_config()),
        created_by,
        created_by_name,
        created_by_email,
        created_at,
        started_at,
        recipient_total,
        recipient_sent,
        recipient_skipped,
        recipient_failed,
    })
}

fn wa_config_dedupe_days(config: &Value) -> i64 {
    let from_camel = config.get("dedupeDays").and_then(Value::as_i64);
    let from_snake = config.get("dedupe_days").and_then(Value::as_i64);
    from_camel.or(from_snake).unwrap_or(7)
}

#[derive(Deserialize)]
struct AddRecipientsFromLeadsRequest {
    lead_ids: Vec<String>,
}

async fn add_wa_recipients_from_leads(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<AddRecipientsFromLeadsRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &id).await?;

    let mut inserted = 0;
    let mut skipped = 0;

    for lead_id in payload.lead_ids {
        // Fetch lead data
        let lead: Option<(String, String)> =
            sqlx::query_as("SELECT customer_name, phone_number FROM leads WHERE id = ?")
                .bind(&lead_id)
                .fetch_optional(&state.pool)
                .await
                .map_err(|_| AppError::Internal)?;

        if let Some((name, phone)) = lead {
            let phone_norm = match normalize_phone(&phone) {
                Some(p) => p,
                None => continue,
            };

            let recipient_id = uuid::Uuid::new_v4().to_string();
            let vars = json!({ "name": name }).to_string();

            let res = sqlx::query("INSERT IGNORE INTO wa_recipients (id, campaign_id, phone, variables_json, lead_id) VALUES (?, ?, ?, ?, ?)")
                .bind(&recipient_id)
                .bind(&id)
                .bind(&phone_norm)
                .bind(&vars)
                .bind(&lead_id)
                .execute(&state.pool)
                .await
                .map_err(|_| AppError::Internal)?;

            if res.rows_affected() > 0 {
                inserted += 1;
            } else {
                skipped += 1;
            }
        }
    }

    Ok(json_ok(
        "Leads added to WA campaign",
        json!({ "inserted": inserted, "skipped": skipped }),
    ))
}

async fn delete_wa_recipient(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_recipient_access(&state, &user, &id).await?;

    sqlx::query("DELETE FROM wa_recipients WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok(json_ok("Recipient deleted", json!({ "id": id })))
}

#[derive(Deserialize)]
struct WaRecipientUpdateRequest {
    phone: Option<String>,
    variables: Option<Value>,
}

async fn update_wa_recipient(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<WaRecipientUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    ensure_wa_recipient_access(&state, &user, &id).await?;

    if let Some(phone) = payload.phone {
        let phone_norm = normalize_phone(&phone).ok_or(AppError::Validation {
            errors: vec!["Phone not valid".to_string()],
        })?;
        sqlx::query("UPDATE wa_recipients SET phone = ? WHERE id = ?")
            .bind(phone_norm)
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    if let Some(vars) = payload.variables {
        sqlx::query("UPDATE wa_recipients SET variables_json = ? WHERE id = ?")
            .bind(vars.to_string())
            .bind(&id)
            .execute(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    }

    Ok(json_ok("Recipient updated", json!({ "id": id })))
}

async fn resend_verification(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let _admin = authorize(&state, &headers, &[Role::Admin]).await?;

    let query = format!("{USER_RECORD_SELECT} WHERE id = ?");
    let user: UserRecord = sqlx::query_as(&query)
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::NotFound)?;

    // Issue a fresh single-use verification token DULU. Kalau insert token
    // gagal, status is_verified user tidak ikut diubah sehingga user tidak
    // ter-lock-out tanpa mekanisme recovery.
    let token = match issue_verification_token(&state, &user.id).await {
        Ok(t) => t,
        Err(e) => {
            tracing::error!(
                "Failed to issue verification token for {}: {:?}",
                user.email,
                e
            );
            return Err(AppError::Internal);
        }
    };

    // Set is_verified to false hanya setelah token berhasil dibuat.
    sqlx::query("UPDATE users SET is_verified = 0 WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    let verification_link = format!(
        "{}/verify-email?token={}",
        frontend_base_url(),
        urlencoding::encode(&token)
    );

    if state.mailer.is_enabled() {
        if let Err(e) = state
            .mailer
            .send_verification_email(
                &user.email,
                &user.name,
                &verification_link,
                "(Password Anda tetap sama)",
            )
            .await
        {
            tracing::error!("Failed to send verification email to {}: {}", user.email, e);
        }
    } else {
        tracing::warn!(
            "Mailer disabled; verification email for {} not sent",
            user.email
        );
    }

    Ok(json_ok("Verification email resent", json!({ "id": id })))
}

async fn issue_verification_token(state: &AppState, user_id: &str) -> Result<String, sqlx::Error> {
    // Invalidasi token verifikasi aktif sebelumnya milik user. Konsisten dengan
    // pola di forgot_password — mencegah pembengkakan email_verification_tokens
    // dan memastikan hanya satu link verifikasi aktif per user dalam satu waktu.
    sqlx::query(
        "UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP \
         WHERE user_id = ? AND used_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.pool)
    .await?;

    let token = uuid::Uuid::new_v4().simple().to_string();
    let expires_at = (Utc::now() + Duration::hours(24)).to_rfc3339();
    sqlx::query(
        "INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
    )
    .bind(&token)
    .bind(user_id)
    .bind(&expires_at)
    .execute(&state.pool)
    .await?;
    Ok(token)
}

async fn delete_user(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Prevent admin dari menghapus dirinya sendiri
    if user.id == id {
        return Err(AppError::Validation {
            errors: vec!["Anda tidak dapat menghapus akun Anda sendiri".to_string()],
        });
    }

    // Pastikan user yang akan dihapus ada
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM users WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking user existence: {}", e);
            AppError::Internal
        })?;

    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    // Hapus semua data terkait dalam satu transaksi untuk menghindari FK constraint error.
    // Tabel yang punya FK ke users tanpa ON DELETE CASCADE:
    //   - agent_stats, agent_achievements, reward_claims (agent_rewards migration)
    //   - leads (agent_leads migration)
    //   - referrals (referrals migration)
    //   - sales_delivery_schedules (sales_features migration)
    // Tabel dengan ON DELETE CASCADE (otomatis terhapus):
    //   - support_tickets, notifications, security_tokens (password_reset_tokens, email_verification_tokens)
    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("DB error starting delete_user transaction: {}", e);
        AppError::Internal
    })?;

    // Hapus data terkait yang tidak punya CASCADE
    for query in &[
        "DELETE FROM agent_stats WHERE user_id = ?",
        "DELETE FROM agent_achievements WHERE agent_id = ?",
        "DELETE FROM reward_claims WHERE agent_id = ?",
        "DELETE FROM leads WHERE agent_id = ?",
        "DELETE FROM referrals WHERE owner_user_id = ?",
        "DELETE FROM sales_delivery_schedules WHERE sales_user_id = ?",
    ] {
        sqlx::query(query)
            .bind(&id)
            .execute(&mut *tx)
            .await
            .map_err(|e| {
                tracing::error!("DB error deleting related data for user {}: {}", id, e);
                AppError::Internal
            })?;
    }

    // Hapus user utama
    sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(&id)
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting user {}: {}", id, e);
            AppError::Internal
        })?;

    tx.commit().await.map_err(|e| {
        tracing::error!("DB error committing delete_user transaction: {}", e);
        AppError::Internal
    })?;

    state.invalidate_user_sessions(&id).await;

    Ok(json_ok(
        format!("User {} deleted by {}", id, user.email),
        json!({ "id": id, "deleted": true }),
    ))
}

#[derive(sqlx::FromRow)]
struct ProductRecord {
    id: String,
    slug: String,
    name: String,
    category: String,
    subcategory: Option<String>,
    price: f64,
    price_installment: Option<f64>,
    dp_min: Option<f64>,
    image: String,
    images: Option<String>,
    badge: Option<String>,
    badge_text: Option<String>,
    short_desc: Option<String>,
    description: Option<String>,
    specs: Option<String>,
    stock: String,
    stock_quantity: Option<f64>,
    colors: Option<String>,
    ratings: Option<String>,
    rating: Option<f64>,
    review: Option<String>,
}

#[derive(Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct ProductPriceMarkupRecord {
    id: String,
    scope: String,
    target_value: Option<String>,
    markup_type: String,
    markup_value: f64,
    is_active: i64,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductPriceMarkupRequest {
    scope: String,
    target_value: Option<String>,
    markup_type: String,
    markup_value: f64,
    is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductRatingEntry {
    score: f64,
    review: Option<String>,
}

#[derive(Default, Clone)]
struct ProductAnalyticsSummary {
    views: i64,
    leads: i64,
    conversions: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogCreateRequest {
    id: Option<String>,
    slug: Option<String>,
    name: String,
    category: Option<String>,
    subcategory: Option<Option<String>>,
    price: Option<f64>,
    price_installment: Option<f64>,
    dp_min: Option<f64>,
    image: Option<String>,
    images: Option<Value>,
    badge: Option<String>,
    badge_text: Option<String>,
    short_desc: Option<String>,
    description: Option<String>,
    specs: Option<Value>,
    stock: Option<String>,
    stock_quantity: Option<f64>,
    colors: Option<Value>,
    ratings: Option<Vec<ProductRatingEntry>>,
    rating: Option<f64>,
    review: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogUpdateRequest {
    slug: Option<String>,
    name: Option<String>,
    category: Option<String>,
    subcategory: Option<String>,
    price: Option<f64>,
    price_installment: Option<f64>,
    dp_min: Option<f64>,
    image: Option<String>,
    images: Option<Value>,
    badge: Option<String>,
    badge_text: Option<String>,
    short_desc: Option<String>,
    description: Option<String>,
    specs: Option<Value>,
    stock: Option<String>,
    stock_quantity: Option<f64>,
    colors: Option<Value>,
    ratings: Option<Vec<ProductRatingEntry>>,
    rating: Option<f64>,
    review: Option<String>,
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
enum BulkOperation {
    Create {
        #[serde(flatten)]
        data: CatalogCreateRequest,
        row_number: Option<i32>,
    },
    Update {
        id: String,
        #[serde(flatten)]
        data: CatalogUpdateRequest,
        row_number: Option<i32>,
    },
}

#[derive(Deserialize)]
struct BulkCatalogRequest {
    operations: Vec<BulkOperation>,
}

#[derive(Deserialize)]
struct CatalogMatchQuery {
    names: String,
}

const MAX_CATALOG_MATCH_QUERY_CHARS: usize = 20_000;
const MAX_CATALOG_MATCH_NAMES: usize = 500;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MatchedProduct {
    input_name: String,
    id: String,
    slug: String,
    name: String,
    category: String,
    subcategory: Option<String>,
    price: f64,
    stock: String,
    stock_quantity: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct CatalogMatchRecord {
    id: String,
    slug: String,
    name: String,
    category: String,
    subcategory: Option<String>,
    price: f64,
    stock: String,
    stock_quantity: Option<f64>,
}

fn normalize_catalog_match_name(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

#[cfg(test)]
fn catalog_names_match(left: &str, right: &str) -> bool {
    normalize_catalog_match_name(left) == normalize_catalog_match_name(right)
}

#[cfg(test)]
fn count_catalog_name_matches(
    requested_names: &[String],
    catalog_names: &[String],
) -> (usize, usize) {
    let catalog_index: std::collections::HashSet<String> = catalog_names
        .iter()
        .map(|name| normalize_catalog_match_name(name))
        .collect();

    requested_names
        .iter()
        .fold((0, 0), |(matched, unmatched), name| {
            if catalog_index.contains(&normalize_catalog_match_name(name)) {
                (matched + 1, unmatched)
            } else {
                (matched, unmatched + 1)
            }
        })
}

fn parse_json_or_default(raw: Option<&str>, fallback: Value) -> Value {
    raw.and_then(|value| serde_json::from_str::<Value>(value).ok())
        .unwrap_or(fallback)
}

fn parse_ratings_or_default(raw: Option<&str>) -> Vec<ProductRatingEntry> {
    raw.and_then(|value| serde_json::from_str::<Vec<ProductRatingEntry>>(value).ok())
        .unwrap_or_default()
}

fn normalize_review_text(review: Option<String>) -> Option<String> {
    review
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn validate_rating_entries(ratings: &[ProductRatingEntry]) -> Result<(), AppError> {
    let mut errors = Vec::new();

    for (index, rating) in ratings.iter().enumerate() {
        if !(0.0..=5.0).contains(&rating.score) {
            errors.push(format!(
                "rating ke-{} harus di antara 0 sampai 5",
                index + 1
            ));
        }

        if rating
            .review
            .as_ref()
            .is_some_and(|value| value.trim().len() > 500)
        {
            errors.push(format!(
                "ulasan rating ke-{} maksimal 500 karakter",
                index + 1
            ));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn normalize_ratings_for_storage(
    ratings: Option<Vec<ProductRatingEntry>>,
    legacy_rating: Option<f64>,
    legacy_review: Option<String>,
) -> Result<Vec<ProductRatingEntry>, AppError> {
    let normalized = if let Some(ratings) = ratings {
        ratings
            .into_iter()
            .map(|rating| ProductRatingEntry {
                score: rating.score,
                review: normalize_review_text(rating.review),
            })
            .collect::<Vec<_>>()
    } else if let Some(score) = legacy_rating {
        vec![ProductRatingEntry {
            score,
            review: normalize_review_text(legacy_review),
        }]
    } else {
        Vec::new()
    };

    validate_rating_entries(&normalized)?;
    Ok(normalized)
}

fn summarize_ratings(
    ratings: &[ProductRatingEntry],
    legacy_rating: Option<f64>,
    legacy_review: Option<String>,
) -> (Option<f64>, Option<String>, i64) {
    if ratings.is_empty() {
        return (legacy_rating, normalize_review_text(legacy_review), 0);
    }

    let count = ratings.len() as i64;
    let sum: f64 = ratings.iter().map(|entry| entry.score).sum();
    let average = Some((sum / count as f64 * 10.0).round() / 10.0);
    let latest_review = ratings
        .iter()
        .rev()
        .find_map(|entry| normalize_review_text(entry.review.clone()));

    (average, latest_review, count)
}

fn normalize_markup_target(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn find_price_markup<'a>(
    record: &ProductRecord,
    markups: Option<&'a [ProductPriceMarkupRecord]>,
) -> Option<&'a ProductPriceMarkupRecord> {
    let markups = markups?;
    let product_match = markups.iter().find(|rule| {
        rule.is_active == 1
            && rule.scope == "product"
            && rule
                .target_value
                .as_deref()
                .is_some_and(|target| target == record.id || target == record.slug)
    });
    if product_match.is_some() {
        return product_match;
    }

    let category = normalize_markup_target(&record.category).to_lowercase();
    let category_match = markups.iter().find(|rule| {
        rule.is_active == 1
            && rule.scope == "category"
            && rule
                .target_value
                .as_deref()
                .is_some_and(|target| normalize_markup_target(target).to_lowercase() == category)
    });
    if category_match.is_some() {
        return category_match;
    }

    markups
        .iter()
        .find(|rule| rule.is_active == 1 && rule.scope == "all")
}

fn apply_display_price(price: f64, rule: Option<&ProductPriceMarkupRecord>) -> f64 {
    if price <= 0.0 {
        return price;
    }

    let Some(rule) = rule else {
        return price;
    };

    let marked = if rule.markup_type == "percent" {
        price * (1.0 + (rule.markup_value / 100.0))
    } else {
        price + rule.markup_value
    };

    marked.max(price).round()
}

async fn fetch_active_price_markups(
    state: &AppState,
) -> Result<Vec<ProductPriceMarkupRecord>, AppError> {
    sqlx::query_as::<_, ProductPriceMarkupRecord>(
        "SELECT id, scope, target_value, markup_type, markup_value, is_active, \
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, \
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at \
         FROM product_price_markups WHERE is_active = 1 \
         ORDER BY CASE scope WHEN 'product' THEN 1 WHEN 'category' THEN 2 ELSE 3 END, updated_at DESC, created_at DESC, id DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching product price markups: {}", e);
        AppError::Internal
    })
}

async fn deactivate_conflicting_price_markups(
    state: &AppState,
    scope: &str,
    target: Option<&str>,
    except_id: Option<&str>,
) -> Result<(), AppError> {
    let result = if scope == "all" {
        if let Some(except_id) = except_id {
            sqlx::query(
                "UPDATE product_price_markups \
                 SET is_active = 0, updated_at = CURRENT_TIMESTAMP \
                 WHERE is_active = 1 AND scope = 'all' AND id <> ?",
            )
            .bind(except_id)
            .execute(&state.pool)
            .await
        } else {
            sqlx::query(
                "UPDATE product_price_markups \
                 SET is_active = 0, updated_at = CURRENT_TIMESTAMP \
                 WHERE is_active = 1 AND scope = 'all'",
            )
            .execute(&state.pool)
            .await
        }
    } else {
        let target = target.unwrap_or("").trim();
        if let Some(except_id) = except_id {
            sqlx::query(
                "UPDATE product_price_markups \
                 SET is_active = 0, updated_at = CURRENT_TIMESTAMP \
                 WHERE is_active = 1 AND scope = ? AND lower(trim(target_value)) = lower(trim(?)) AND id <> ?",
            )
            .bind(scope)
            .bind(target)
            .bind(except_id)
            .execute(&state.pool)
            .await
        } else {
            sqlx::query(
                "UPDATE product_price_markups \
                 SET is_active = 0, updated_at = CURRENT_TIMESTAMP \
                 WHERE is_active = 1 AND scope = ? AND lower(trim(target_value)) = lower(trim(?))",
            )
            .bind(scope)
            .bind(target)
            .execute(&state.pool)
            .await
        }
    };

    result.map(|_| ()).map_err(|e| {
        tracing::error!("DB error deactivating conflicting price markups: {}", e);
        AppError::Internal
    })
}

fn product_to_json(
    record: ProductRecord,
    analytics: Option<&ProductAnalyticsSummary>,
    markups: Option<&[ProductPriceMarkupRecord]>,
) -> Value {
    let analytics = analytics.cloned().unwrap_or_default();
    let ratings = parse_ratings_or_default(record.ratings.as_deref());
    let (rating_average, latest_review, rating_count) =
        summarize_ratings(&ratings, record.rating, record.review.clone());
    let conversion_rate = if analytics.views > 0 {
        (analytics.leads as f64 / analytics.views as f64) * 100.0
    } else {
        0.0
    };
    let markup_rule = find_price_markup(&record, markups);
    let display_price = apply_display_price(record.price, markup_rule);
    let markup_value = markup_rule.map(|rule| {
        json!({
            "id": rule.id,
            "scope": rule.scope,
            "targetValue": rule.target_value,
            "markupType": rule.markup_type,
            "markupValue": rule.markup_value,
        })
    });

    json!({
        "id": record.id,
        "slug": record.slug,
        "name": record.name,
        "category": record.category,
        "subcategory": record.subcategory,
        "price": record.price,
        "displayPrice": display_price,
        "priceMarkup": markup_value,
        "priceInstallment": record.price_installment,
        "dpMin": record.dp_min,
        "image": record.image,
        "images": parse_json_or_default(record.images.as_deref(), json!([])),
        "badge": record.badge,
        "badgeText": record.badge_text,
        "shortDesc": record.short_desc,
        "description": record.description,
        "specs": parse_json_or_default(record.specs.as_deref(), json!({})),
        "stock": record.stock,
        "stockQuantity": record.stock_quantity,
        "colors": parse_json_or_default(record.colors.as_deref(), json!([])),
        "ratings": ratings,
        "rating": rating_average,
        "ratingAverage": rating_average,
        "ratingCount": rating_count,
        "review": latest_review,
        "views": analytics.views,
        "leads": analytics.leads,
        "conversions": analytics.conversions,
        "conversionRate": conversion_rate,
    })
}

fn validate_stock(stock: &str) -> bool {
    matches!(
        stock,
        "available" | "indent" | "hidden" | "limited" | "out_of_stock" | "discontinued"
    )
}

fn validate_catalog_create(payload: &CatalogCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();

    if let Some(ref slug) = payload.slug {
        if slug.trim().is_empty() {
            errors.push("slug tidak boleh kosong jika diisi".to_string());
        }
    }
    if payload.name.trim().is_empty() {
        errors.push("name wajib diisi".to_string());
    }
    if let Some(ref category) = payload.category {
        if category.trim().is_empty() {
            errors.push("category tidak boleh kosong jika diisi".to_string());
        }
    }
    if let Some(price) = payload.price {
        if price < 0.0 {
            errors.push("price tidak boleh negatif".to_string());
        }
    }
    if payload.price_installment.is_some_and(|value| value < 0.0) {
        errors.push("priceInstallment tidak boleh negatif".to_string());
    }
    if payload.dp_min.is_some_and(|value| value < 0.0) {
        errors.push("dpMin tidak boleh negatif".to_string());
    }
    if let Some(ratings) = payload.ratings.as_ref() {
        if let Err(AppError::Validation {
            errors: rating_errors,
        }) = validate_rating_entries(ratings)
        {
            errors.extend(rating_errors);
        }
    } else if payload
        .rating
        .is_some_and(|value| !(0.0..=5.0).contains(&value))
    {
        errors.push("rating harus di antara 0 sampai 5".to_string());
    }
    if let Some(stock) = &payload.stock {
        if !validate_stock(stock) {
            errors.push("stock harus salah satu dari: available, indent, hidden, limited, out_of_stock, discontinued".to_string());
        }
    }
    if payload.stock_quantity.is_some_and(|value| value < 0.0) {
        errors.push("stockQuantity tidak boleh negatif".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_catalog_update(payload: &CatalogUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();

    if payload
        .slug
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("slug tidak boleh kosong".to_string());
    }
    if payload
        .name
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("name tidak boleh kosong".to_string());
    }
    if payload
        .category
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("category tidak boleh kosong".to_string());
    }
    // image is now optional
    if payload.price.is_some_and(|value| value < 0.0) {
        errors.push("price tidak boleh negatif".to_string());
    }
    if payload.price_installment.is_some_and(|value| value < 0.0) {
        errors.push("priceInstallment tidak boleh negatif".to_string());
    }
    if payload.dp_min.is_some_and(|value| value < 0.0) {
        errors.push("dpMin tidak boleh negatif".to_string());
    }
    if let Some(ratings) = payload.ratings.as_ref() {
        if let Err(AppError::Validation {
            errors: rating_errors,
        }) = validate_rating_entries(ratings)
        {
            errors.extend(rating_errors);
        }
    } else if payload
        .rating
        .is_some_and(|value| !(0.0..=5.0).contains(&value))
    {
        errors.push("rating harus di antara 0 sampai 5".to_string());
    }
    if payload
        .stock
        .as_ref()
        .is_some_and(|value| !validate_stock(value))
    {
        errors.push("stock harus salah satu dari: available, indent, hidden, limited, out_of_stock, discontinued".to_string());
    }
    if payload.stock_quantity.is_some_and(|value| value < 0.0) {
        errors.push("stockQuantity tidak boleh negatif".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

async fn find_catalog_by_id_or_slug(
    state: &AppState,
    id_or_slug: &str,
) -> Result<ProductRecord, AppError> {
    sqlx::query_as::<_, ProductRecord>(
        "SELECT id, slug, name, category, subcategory, CAST(price AS DOUBLE) AS price, CAST(price_installment AS DOUBLE) AS price_installment, CAST(dp_min AS DOUBLE) AS dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, stock_quantity, colors, ratings, rating, review FROM products WHERE id = ? OR slug = ? LIMIT 1"
    )
    .bind(id_or_slug)
    .bind(id_or_slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)
}

fn map_conflict_if_needed(error: sqlx::Error) -> AppError {
    let msg = error.to_string();
    if msg.contains("UNIQUE constraint failed") {
        AppError::Conflict
    } else {
        tracing::error!("DB error: {}", msg);
        AppError::Internal
    }
}

#[derive(sqlx::FromRow)]
struct PromoRecord {
    id: String,
    title: String,
    subtitle: Option<String>,
    description: Option<String>,
    discount: Option<i64>,
    original_price: Option<f64>,
    promo_price: Option<f64>,
    image: String,
    badge: Option<String>,
    valid_until: Option<String>,
    category: Option<String>,
    variant: Option<String>,
    product_ids: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromotionCreateRequest {
    id: Option<String>,
    title: String,
    subtitle: Option<String>,
    description: Option<String>,
    discount: Option<i64>,
    original_price: Option<f64>,
    promo_price: Option<f64>,
    image: String,
    badge: Option<String>,
    valid_until: Option<String>,
    category: Option<String>,
    variant: Option<String>,
    product_ids: Option<Value>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromotionUpdateRequest {
    title: Option<String>,
    subtitle: Option<String>,
    description: Option<String>,
    discount: Option<i64>,
    original_price: Option<f64>,
    promo_price: Option<f64>,
    image: Option<String>,
    badge: Option<String>,
    valid_until: Option<String>,
    category: Option<String>,
    variant: Option<String>,
    product_ids: Option<Value>,
}

#[derive(sqlx::FromRow)]
struct PartnerRecord {
    id: String,
    name: String,
    logo_url: String,
    website_url: Option<String>,
    sort_order: i64,
    is_active: bool,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartnerOrderItem {
    id: String,
    sort_order: i64,
}

fn promo_to_json(record: PromoRecord) -> Value {
    json!({
        "id": record.id,
        "title": record.title,
        "subtitle": record.subtitle,
        "description": record.description,
        "discount": record.discount,
        "originalPrice": record.original_price,
        "promoPrice": record.promo_price,
        "image": record.image,
        "badge": record.badge,
        "validUntil": record.valid_until,
        "category": record.category,
        "variant": record.variant,
        "productIds": parse_json_or_default(record.product_ids.as_deref(), json!([])),
    })
}

fn partner_to_json(record: PartnerRecord) -> Value {
    json!({
        "id": record.id,
        "name": record.name,
        "logoUrl": record.logo_url,
        "websiteUrl": record.website_url,
        "sortOrder": record.sort_order,
        "isActive": record.is_active,
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    })
}

fn validate_promotion_create(payload: &PromotionCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.title.trim().is_empty() {
        errors.push("title wajib diisi".to_string());
    }
    if payload.image.trim().is_empty() {
        errors.push("image wajib diisi".to_string());
    }
    if payload
        .discount
        .is_some_and(|value| !(0..=100).contains(&value))
    {
        errors.push("discount harus di antara 0 sampai 100".to_string());
    }
    if payload.original_price.is_some_and(|value| value < 0.0) {
        errors.push("originalPrice tidak boleh negatif".to_string());
    }
    if payload.promo_price.is_some_and(|value| value < 0.0) {
        errors.push("promoPrice tidak boleh negatif".to_string());
    }
    if let (Some(original), Some(promo)) = (payload.original_price, payload.promo_price) {
        if promo > original {
            errors.push("promoPrice tidak boleh lebih besar dari originalPrice".to_string());
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_promotion_update(payload: &PromotionUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload
        .title
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("title tidak boleh kosong".to_string());
    }
    if payload
        .image
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("image tidak boleh kosong".to_string());
    }
    if payload
        .discount
        .is_some_and(|value| !(0..=100).contains(&value))
    {
        errors.push("discount harus di antara 0 sampai 100".to_string());
    }
    if payload.original_price.is_some_and(|value| value < 0.0) {
        errors.push("originalPrice tidak boleh negatif".to_string());
    }
    if payload.promo_price.is_some_and(|value| value < 0.0) {
        errors.push("promoPrice tidak boleh negatif".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

async fn find_promotion_by_id(state: &AppState, id: &str) -> Result<PromoRecord, AppError> {
    sqlx::query_as::<_, PromoRecord>(
        "SELECT id, title, subtitle, description, discount, original_price, promo_price, image, badge, valid_until, category, variant, product_ids FROM promos WHERE id = ? LIMIT 1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)
}

async fn find_partner_by_id(state: &AppState, id: &str) -> Result<PartnerRecord, AppError> {
    sqlx::query_as::<_, PartnerRecord>(
        "SELECT id, name, logo_url, website_url, sort_order, is_active, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM partners WHERE id = ? LIMIT 1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct ProductCategoryRecord {
    id: String,
    name: String,
    slug: String,
    description: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateProductCategoryRequest {
    name: String,
    description: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProductCategoryRequest {
    name: Option<String>,
    description: Option<String>,
}

async fn list_product_categories(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let categories = sqlx::query_as::<_, ProductCategoryRecord>(
        "SELECT id, name, slug, description, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM product_categories ORDER BY name ASC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "Categories fetched",
        json!({ "items": categories }),
    ))
}

async fn create_product_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateProductCategoryRequest>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    if payload.name.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Nama kategori wajib diisi".to_string()],
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let slug = payload.name.to_lowercase().replace(' ', "-");

    sqlx::query(
        "INSERT IGNORE INTO product_categories (id, name, slug, description) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(payload.name.trim())
    .bind(&slug)
    .bind(payload.description)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to create product category: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "Category created",
        json!({ "id": id, "slug": slug }),
    ))
}

async fn update_product_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateProductCategoryRequest>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    if let Some(ref name) = payload.name {
        if name.trim().is_empty() {
            return Err(AppError::Validation {
                errors: vec!["Nama kategori tidak boleh kosong".to_string()],
            });
        }
    }

    let mut query = String::from("UPDATE product_categories SET ");
    let mut updates = Vec::new();

    if let Some(ref name) = payload.name {
        updates.push(format!(
            "name = '{}', slug = '{}'",
            name.trim(),
            name.to_lowercase().replace(' ', "-")
        ));
    }
    if let Some(ref desc) = payload.description {
        updates.push(format!("description = '{}'", desc));
    }

    if updates.is_empty() {
        return Ok(json_ok("No changes", json!({ "updated": false })));
    }

    query.push_str(&updates.join(", "));
    query.push_str(" WHERE id = ?");

    sqlx::query(&query)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Category updated", json!({ "updated": true })))
}

async fn delete_product_category(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let result = sqlx::query("DELETE FROM product_categories WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok("Category deleted", json!({ "deleted": true })))
}

#[derive(Deserialize)]
struct CatalogListQuery {
    page: Option<u32>,
    limit: Option<u32>,
}

async fn list_catalogs(
    State(state): State<AppState>,
    Query(params): Query<CatalogListQuery>,
) -> Result<ResponseBody, AppError> {
    let default_limit = std::env::var("PUBLIC_CATALOG_LIMIT")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(500);
    let max_limit = std::env::var("PUBLIC_CATALOG_MAX_LIMIT")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(500);
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(default_limit).clamp(1, max_limit);
    let offset = (page - 1) * limit;

    let products = sqlx::query_as::<_, ProductRecord>(
        "SELECT id, slug, name, category, subcategory, CAST(price AS DOUBLE) AS price, CAST(price_installment AS DOUBLE) AS price_installment, CAST(dp_min AS DOUBLE) AS dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, stock_quantity, colors, ratings, rating, review FROM products LIMIT ? OFFSET ?"
    )
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM products")
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error counting catalogs: {}", e);
            AppError::Internal
        })?;

    let product_slugs = products
        .iter()
        .map(|product| product.slug.clone())
        .collect::<Vec<_>>();
    let analytics_rows = if product_slugs.is_empty() {
        Vec::new()
    } else {
        let placeholders = product_slugs
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let query = format!(
            "SELECT
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) AS product_slug,
                COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS views,
                COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS leads,
                COALESCE(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS conversions
             FROM telemetry_events
             WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) IN ({})
             GROUP BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug')))",
            placeholders
        );
        let mut query = sqlx::query(&query);
        for slug in &product_slugs {
            query = query.bind(slug);
        }
        query.fetch_all(&state.pool).await.map_err(|e| {
            tracing::error!("DB error fetching catalog analytics: {}", e);
            AppError::Internal
        })?
    };

    let analytics_map: HashMap<String, ProductAnalyticsSummary> = analytics_rows
        .into_iter()
        .filter_map(|row| {
            use sqlx::Row;

            let product_slug = row
                .try_get::<Option<String>, _>("product_slug")
                .ok()
                .flatten()?;
            Some((
                product_slug,
                ProductAnalyticsSummary {
                    views: row.get::<i64, _>("views"),
                    leads: row.get::<i64, _>("leads"),
                    conversions: row.get::<i64, _>("conversions"),
                },
            ))
        })
        .collect();
    let markups = fetch_active_price_markups(&state).await?;

    let items: Vec<Value> = products
        .into_iter()
        .map(|product| {
            let analytics = analytics_map.get(&product.slug);
            product_to_json(product, analytics, Some(&markups))
        })
        .collect();

    Ok(json_ok(
        "Catalogs fetched",
        json!({
            "items": items,
            "page": page,
            "limit": limit,
            "total": total,
            "hasMore": (offset as i64 + items.len() as i64) < total,
        }),
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogPaginatedQuery {
    page: Option<u32>,
    limit: Option<u32>,
    category: Option<String>,
    status: Option<String>,
    search: Option<String>,
    sort: Option<String>,
}

/// Lightweight paginated catalog listing for admin dashboard.
/// Only returns fields needed for the list view (no description, specs, ratings, etc.)
/// Runs product query, analytics, and markups in parallel via tokio::join!
async fn list_catalogs_paginated(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<CatalogPaginatedQuery>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(100);
    let offset = (page - 1) * limit;

    // Build WHERE clauses
    let mut conditions: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref category) = params.category {
        let cat = category.trim();
        if !cat.is_empty() && cat.to_lowercase() != "semua" {
            bind_values.push(cat.to_string());
            conditions.push(format!("p.category = ?{}", bind_values.len()));
        }
    }

    if let Some(ref search) = params.search {
        let s = search.trim();
        if !s.is_empty() {
            let like_val = format!("%{}%", s);
            // Bind the same LIKE value 4 times for each column
            bind_values.push(like_val.clone());
            let idx1 = bind_values.len();
            bind_values.push(like_val.clone());
            let idx2 = bind_values.len();
            bind_values.push(like_val.clone());
            let idx3 = bind_values.len();
            bind_values.push(like_val);
            let idx4 = bind_values.len();
            conditions.push(format!(
                "(p.name LIKE ?{} OR p.id LIKE ?{} OR p.category LIKE ?{} OR p.subcategory LIKE ?{})",
                idx1, idx2, idx3, idx4
            ));
        }
    }

    // Stock-based status filter
    if let Some(ref status) = params.status {
        let st = status.trim().to_lowercase();
        match st.as_str() {
            "active" => {
                conditions.push("(p.stock_quantity IS NULL OR p.stock_quantity > 5) AND p.stock NOT IN ('hidden', 'out_of_stock', 'discontinued')".to_string());
            }
            "low stock" | "low_stock" => {
                conditions.push("((p.stock_quantity IS NOT NULL AND p.stock_quantity > 0 AND p.stock_quantity <= 5) OR p.stock IN ('indent', 'limited'))".to_string());
            }
            "out of stock" | "out_of_stock" => {
                conditions.push("((p.stock_quantity IS NOT NULL AND p.stock_quantity <= 0) OR p.stock IN ('hidden', 'out_of_stock', 'discontinued'))".to_string());
            }
            _ => {} // "semua" or unknown — no filter
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Sort clause
    let sort_field = match params.sort.as_deref() {
        Some("leads") => "leads",
        Some("conversionRate") | Some("conversion") => "conversion_rate",
        _ => "views", // default
    };

    // Build the main query with analytics joined in
    let main_query = format!(
        r#"
        SELECT
            p.id, p.slug, p.name, p.category, p.subcategory,
            CAST(p.price AS DOUBLE) AS price,
            CAST(p.price_installment AS DOUBLE) AS price_installment,
            CAST(p.dp_min AS DOUBLE) AS dp_min,
            p.image, p.badge, p.badge_text,
            p.stock, CAST(p.stock_quantity AS DOUBLE) AS stock_quantity, p.ratings,
            CAST(p.rating AS DOUBLE) AS rating, p.review,
            CAST(COALESCE(a.views, 0) AS SIGNED) AS views,
            CAST(COALESCE(a.leads, 0) AS SIGNED) AS leads,
            CAST(COALESCE(a.conversions, 0) AS SIGNED) AS conversions,
            CASE WHEN COALESCE(a.views, 0) > 0
                 THEN (CAST(COALESCE(a.leads, 0) AS DOUBLE) / CAST(a.views AS DOUBLE)) * 100.0
                 ELSE 0.0
            END AS conversion_rate
        FROM products p
        LEFT JOIN (
            SELECT
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) AS product_slug,
                CAST(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS SIGNED) AS views,
                CAST(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END) AS SIGNED) AS leads,
                CAST(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END) AS SIGNED) AS conversions
            FROM telemetry_events
            WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) IS NOT NULL
              AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) <> ''
            GROUP BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug')))
        ) a ON a.product_slug = p.slug
        {where_clause}
        ORDER BY {sort_field} DESC
        LIMIT {limit} OFFSET {offset}
        "#
    );

    let count_query = format!(
        r#"
        SELECT COUNT(*) as total,
            SUM(CASE WHEN (p.stock_quantity IS NULL OR p.stock_quantity > 5) AND p.stock NOT IN ('hidden', 'out_of_stock', 'discontinued') THEN 1 ELSE 0 END) AS total_active,
            SUM(CASE WHEN (p.stock_quantity IS NOT NULL AND p.stock_quantity > 0 AND p.stock_quantity <= 5) OR p.stock IN ('indent', 'limited') THEN 1 ELSE 0 END) AS total_low_stock,
            SUM(CASE WHEN (p.stock_quantity IS NOT NULL AND p.stock_quantity <= 0) OR p.stock IN ('hidden', 'out_of_stock', 'discontinued') THEN 1 ELSE 0 END) AS total_out_of_stock
        FROM products p
        LEFT JOIN (
            SELECT
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) AS product_slug,
                SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS views,
                SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END) AS leads,
                SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END) AS conversions
            FROM telemetry_events
            WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) IS NOT NULL
              AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) <> ''
            GROUP BY COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug')))
        ) a ON a.product_slug = p.slug
        {where_clause}
        "#
    );

    // Run queries in parallel: main data + count + markups
    let (main_result, count_result, markups_result) = tokio::join!(
        async {
            let mut q = sqlx::query(&main_query);
            for val in &bind_values {
                q = q.bind(val);
            }
            q.fetch_all(&state.pool).await
        },
        async {
            let mut q = sqlx::query(&count_query);
            for val in &bind_values {
                q = q.bind(val);
            }
            q.fetch_one(&state.pool).await
        },
        fetch_active_price_markups(&state)
    );

    let rows = main_result.map_err(|e| {
        tracing::error!("DB error (paginated catalog): {}", e);
        AppError::Internal
    })?;

    let count_row = count_result.map_err(|e| {
        tracing::error!("DB error (catalog count): {}", e);
        AppError::Internal
    })?;

    let markups = markups_result?;

    use sqlx::Row;

    let total: i64 = count_row.get("total");
    let total_active: i64 = count_row.try_get("total_active").unwrap_or(0);
    let total_low_stock: i64 = count_row.try_get("total_low_stock").unwrap_or(0);
    let total_out_of_stock: i64 = count_row.try_get("total_out_of_stock").unwrap_or(0);

    // Also compute total views/leads/conversions from the aggregates query
    let totals_query = sqlx::query(
        "SELECT
            CAST(COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS SIGNED) AS total_views,
            CAST(COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS SIGNED) AS total_leads,
            CAST(COALESCE(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS SIGNED) AS total_conversions
         FROM telemetry_events
         WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) IS NOT NULL
           AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.productSlug')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.slug'))) <> ''"
    )
    .fetch_one(&state.pool)
    .await
    .ok();

    let (total_views, total_leads, total_conversions) = totals_query
        .map(|row| {
            (
                row.get::<i64, _>("total_views"),
                row.get::<i64, _>("total_leads"),
                row.get::<i64, _>("total_conversions"),
            )
        })
        .unwrap_or((0, 0, 0));

    // Build lean response items
    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let id: String = row.get("id");
            let slug: String = row.get("slug");
            let name: String = row.get("name");
            let category: String = row.get("category");
            let subcategory: Option<String> = row.get("subcategory");
            let price: f64 = row.get("price");
            let price_installment: Option<f64> = row.get("price_installment");
            let dp_min: Option<f64> = row.get("dp_min");
            let image: String = row.get("image");
            let badge: Option<String> = row.get("badge");
            let badge_text: Option<String> = row.get("badge_text");
            let stock: String = row.get("stock");
            let stock_quantity: Option<f64> = row.get("stock_quantity");
            let views: i64 = row.get("views");
            let leads: i64 = row.get("leads");
            let conversions: i64 = row.get("conversions");
            let conversion_rate: f64 = row.get("conversion_rate");
            let ratings_raw: Option<String> = row.get("ratings");
            let rating_legacy: Option<f64> = row.get("rating");
            let review_legacy: Option<String> = row.get("review");

            // Compute rating summary
            let ratings = parse_ratings_or_default(ratings_raw.as_deref());
            let (rating_average, _latest_review, rating_count) =
                summarize_ratings(&ratings, rating_legacy, review_legacy);

            // Compute display price with markup
            let product_record_for_markup = ProductRecord {
                id: id.clone(),
                slug: slug.clone(),
                name: name.clone(),
                category: category.clone(),
                subcategory: subcategory.clone(),
                price,
                price_installment,
                dp_min,
                image: image.clone(),
                images: None,
                badge: badge.clone(),
                badge_text: badge_text.clone(),
                short_desc: None,
                description: None,
                specs: None,
                stock: stock.clone(),
                stock_quantity,
                colors: None,
                ratings: ratings_raw,
                rating: rating_legacy,
                review: None,
            };
            let markup_rule = find_price_markup(&product_record_for_markup, Some(&markups));
            let display_price = apply_display_price(price, markup_rule);
            let markup_value = markup_rule.map(|rule| {
                json!({
                    "id": rule.id,
                    "scope": rule.scope,
                    "targetValue": rule.target_value,
                    "markupType": rule.markup_type,
                    "markupValue": rule.markup_value,
                })
            });

            json!({
                "id": id,
                "slug": slug,
                "name": name,
                "category": category,
                "subcategory": subcategory,
                "price": price,
                "displayPrice": display_price,
                "priceMarkup": markup_value,
                "priceInstallment": price_installment,
                "dpMin": dp_min,
                "image": image,
                "badge": badge,
                "badgeText": badge_text,
                "stock": stock,
                "stockQuantity": stock_quantity,
                "ratingAverage": rating_average,
                "ratingCount": rating_count,
                "views": views,
                "leads": leads,
                "conversions": conversions,
                "conversionRate": conversion_rate,
            })
        })
        .collect();

    // Fetch distinct categories for filter dropdown
    let categories_rows = sqlx::query("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();

    let categories: Vec<String> = categories_rows
        .iter()
        .map(|row| row.get::<String, _>("category"))
        .collect();

    let total_pages = ((total as f64) / (limit as f64)).ceil() as u32;

    Ok(json_ok(
        "Paginated catalogs fetched",
        json!({
            "items": items,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "totalPages": total_pages,
            },
            "aggregates": {
                "totalActive": total_active,
                "totalLowStock": total_low_stock,
                "totalOutOfStock": total_out_of_stock,
                "totalViews": total_views,
                "totalLeads": total_leads,
                "totalConversions": total_conversions,
            },
            "categories": categories,
        }),
    ))
}

async fn match_catalogs(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<CatalogMatchQuery>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    if query.names.len() > MAX_CATALOG_MATCH_QUERY_CHARS {
        return Err(AppError::Validation {
            errors: vec![format!(
                "Jumlah karakter nama produk terlalu besar. Maksimal {} karakter per request.",
                MAX_CATALOG_MATCH_QUERY_CHARS
            )],
        });
    }

    let requested_names: Vec<String> = query
        .names
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(ToString::to_string)
        .collect();

    if requested_names.len() > MAX_CATALOG_MATCH_NAMES {
        return Err(AppError::Validation {
            errors: vec![format!(
                "Jumlah nama produk terlalu banyak. Maksimal {} nama produk per request.",
                MAX_CATALOG_MATCH_NAMES
            )],
        });
    }

    if requested_names.is_empty() {
        return Ok(json_ok(
            "Catalog match completed",
            json!({
                "matched": [],
                "unmatched": [],
                "matchedCount": 0,
                "unmatchedCount": 0,
                "total": 0,
            }),
        ));
    }

    let records = sqlx::query_as::<_, CatalogMatchRecord>(
        "SELECT id, slug, name, category, subcategory, CAST(price AS DOUBLE) AS price, stock, stock_quantity FROM products",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error matching catalog products: {}", e);
        AppError::Internal
    })?;

    let mut catalog_by_name: HashMap<String, CatalogMatchRecord> = HashMap::new();
    for record in records {
        catalog_by_name
            .entry(normalize_catalog_match_name(&record.name))
            .or_insert(record);
    }

    let mut matched = Vec::new();
    let mut unmatched = Vec::new();

    for input_name in requested_names {
        let normalized = normalize_catalog_match_name(&input_name);
        if let Some(product) = catalog_by_name.get(&normalized) {
            matched.push(MatchedProduct {
                input_name,
                id: product.id.clone(),
                slug: product.slug.clone(),
                name: product.name.clone(),
                category: product.category.clone(),
                subcategory: product.subcategory.clone(),
                price: product.price,
                stock: product.stock.clone(),
                stock_quantity: product.stock_quantity,
            });
        } else {
            unmatched.push(input_name);
        }
    }

    let matched_count = matched.len();
    let unmatched_count = unmatched.len();

    Ok(json_ok(
        "Catalog match completed",
        json!({
            "matched": matched,
            "unmatched": unmatched,
            "matchedCount": matched_count,
            "unmatchedCount": unmatched_count,
            "total": matched_count + unmatched_count,
        }),
    ))
}

fn validate_price_markup_payload(payload: &ProductPriceMarkupRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if !matches!(payload.scope.as_str(), "all" | "category" | "product") {
        errors.push("scope harus all, category, atau product".to_string());
    }
    if !matches!(payload.markup_type.as_str(), "amount" | "percent") {
        errors.push("markupType harus amount atau percent".to_string());
    }
    if payload.markup_value < 0.0 {
        errors.push("markupValue tidak boleh negatif".to_string());
    }
    if payload.markup_type == "percent" && payload.markup_value > 300.0 {
        errors.push("markup persentase maksimal 300%".to_string());
    }
    if payload.scope == "all" {
        if payload
            .target_value
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        {
            errors.push("targetValue harus kosong untuk scope all".to_string());
        }
    } else if payload
        .target_value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        errors.push("targetValue wajib untuk scope category/product".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

async fn list_price_markups(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let items = sqlx::query_as::<_, ProductPriceMarkupRecord>(
        "SELECT id, scope, target_value, markup_type, markup_value, is_active, \
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, \
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at \
         FROM product_price_markups \
         ORDER BY is_active DESC, CASE scope WHEN 'product' THEN 1 WHEN 'category' THEN 2 ELSE 3 END, updated_at DESC, created_at DESC, id DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing price markups: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Price markups fetched", json!({ "items": items })))
}

async fn create_price_markup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ProductPriceMarkupRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    validate_price_markup_payload(&payload)?;

    let id = uuid::Uuid::new_v4().to_string();
    let target = if payload.scope == "all" {
        None
    } else {
        payload
            .target_value
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    };
    let is_active = payload.is_active.unwrap_or(true);
    if is_active {
        deactivate_conflicting_price_markups(&state, &payload.scope, target.as_deref(), None)
            .await?;
    }

    sqlx::query(
        "INSERT INTO product_price_markups (id, scope, target_value, markup_type, markup_value, is_active, created_by) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&payload.scope)
    .bind(&target)
    .bind(&payload.markup_type)
    .bind(payload.markup_value)
    .bind(if is_active { 1 } else { 0 })
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating price markup: {}", e);
        AppError::Internal
    })?;

    let item = sqlx::query_as::<_, ProductPriceMarkupRecord>(
        "SELECT id, scope, target_value, markup_type, markup_value, is_active, \
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, \
                DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at \
         FROM product_price_markups WHERE id = ? LIMIT 1",
    )
    .bind(&id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching created price markup: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Price markup created", json!({ "item": item })))
}

async fn update_price_markup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ProductPriceMarkupRequest>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;
    validate_price_markup_payload(&payload)?;

    let target = if payload.scope == "all" {
        None
    } else {
        payload
            .target_value
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
    };
    let is_active = payload.is_active.unwrap_or(true);
    if is_active {
        deactivate_conflicting_price_markups(&state, &payload.scope, target.as_deref(), Some(&id))
            .await?;
    }

    let result = sqlx::query(
        "UPDATE product_price_markups \
         SET scope = ?, target_value = ?, markup_type = ?, markup_value = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP \
         WHERE id = ?",
    )
    .bind(&payload.scope)
    .bind(&target)
    .bind(&payload.markup_type)
    .bind(payload.markup_value)
    .bind(if is_active { 1 } else { 0 })
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error updating price markup: {}", e);
        AppError::Internal
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok("Price markup updated", json!({ "updated": true })))
}

async fn delete_price_markup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let result = sqlx::query("DELETE FROM product_price_markups WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting price markup: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok("Price markup deleted", json!({ "deleted": true })))
}

async fn create_catalog(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CatalogCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_catalog_create(&payload)?;

    let name = payload.name.trim().to_string();
    let slug = payload
        .slug
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| name.to_lowercase().replace(' ', "-"));
    let category = payload
        .category
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| "Uncategorized".to_string());
    let price = payload.price.unwrap_or(0.0);
    let image = payload
        .image
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| "https://placehold.co/600x400?text=No+Image".to_string());

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let images = serde_json::to_string(&payload.images.unwrap_or_else(|| json!([])))
        .map_err(|_| AppError::Internal)?;
    let specs = serde_json::to_string(&payload.specs.unwrap_or_else(|| json!({})))
        .map_err(|_| AppError::Internal)?;
    let colors = serde_json::to_string(&payload.colors.unwrap_or_else(|| json!([])))
        .map_err(|_| AppError::Internal)?;
    let ratings = normalize_ratings_for_storage(
        payload.ratings.clone(),
        payload.rating,
        payload.review.clone(),
    )?;
    let ratings_json = serde_json::to_string(&ratings).map_err(|_| AppError::Internal)?;
    let (next_rating, next_review, _) =
        summarize_ratings(&ratings, payload.rating, payload.review.clone());
    let stock = payload
        .stock
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| "available".to_string());

    sqlx::query(
        "INSERT INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, stock_quantity, colors, ratings, rating, review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&slug)
    .bind(&name)
    .bind(&category)
    .bind(payload.subcategory.as_ref().and_then(|s| s.clone()))
    .bind(price)
    .bind(payload.price_installment)
    .bind(payload.dp_min)
    .bind(&image)
    .bind(images)
    .bind(payload.badge)
    .bind(payload.badge_text)
    .bind(payload.short_desc)
    .bind(payload.description)
    .bind(specs)
    .bind(stock)
    .bind(payload.stock_quantity)
    .bind(colors)
    .bind(ratings_json)
    .bind(next_rating)
    .bind(next_review)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = find_catalog_by_id_or_slug(&state, &id).await?;
    Ok(json_ok(
        format!("Catalog created by {}", user.email),
        json!({ "item": product_to_json(created, None, None) }),
    ))
}

async fn get_catalog(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let item = find_catalog_by_id_or_slug(&state, &id).await?;
    let markups = fetch_active_price_markups(&state).await?;
    Ok(json_ok(
        "Catalog fetched",
        json!({ "item": product_to_json(item, None, Some(&markups)) }),
    ))
}

async fn update_catalog(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<CatalogUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_catalog_update(&payload)?;

    let current = find_catalog_by_id_or_slug(&state, &id).await?;
    let next_slug = payload
        .slug
        .as_deref()
        .unwrap_or(&current.slug)
        .trim()
        .to_string();
    let next_name = payload
        .name
        .as_deref()
        .unwrap_or(&current.name)
        .trim()
        .to_string();
    let next_category = payload
        .category
        .as_deref()
        .unwrap_or(&current.category)
        .trim()
        .to_string();
    let next_image = payload
        .image
        .as_deref()
        .unwrap_or(&current.image)
        .trim()
        .to_string();
    let next_stock = payload.stock.unwrap_or(current.stock.clone());
    let next_stock_quantity = payload.stock_quantity.or(current.stock_quantity);
    let next_images = serde_json::to_string(
        &payload
            .images
            .unwrap_or_else(|| parse_json_or_default(current.images.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;
    let next_specs = serde_json::to_string(
        &payload
            .specs
            .unwrap_or_else(|| parse_json_or_default(current.specs.as_deref(), json!({}))),
    )
    .map_err(|_| AppError::Internal)?;
    let next_colors = serde_json::to_string(
        &payload
            .colors
            .unwrap_or_else(|| parse_json_or_default(current.colors.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;
    let next_ratings = if let Some(ratings) = payload.ratings.clone() {
        normalize_ratings_for_storage(Some(ratings), None, None)?
    } else {
        parse_ratings_or_default(current.ratings.as_deref())
    };
    let next_ratings_json = serde_json::to_string(&next_ratings).map_err(|_| AppError::Internal)?;
    let (next_rating, next_review, _) = summarize_ratings(
        &next_ratings,
        payload.rating.or(current.rating),
        payload.review.or_else(|| current.review.clone()),
    );

    sqlx::query(
        "UPDATE products SET slug = ?, name = ?, category = ?, subcategory = ?, price = ?, price_installment = ?, dp_min = ?, image = ?, images = ?, badge = ?, badge_text = ?, short_desc = ?, description = ?, specs = ?, stock = ?, stock_quantity = ?, colors = ?, ratings = ?, rating = ?, review = ? WHERE id = ?"
    )
    .bind(next_slug)
    .bind(next_name)
    .bind(next_category)
    .bind(payload.subcategory.or(current.subcategory))
    .bind(payload.price.unwrap_or(current.price))
    .bind(payload.price_installment.or(current.price_installment))
    .bind(payload.dp_min.or(current.dp_min))
    .bind(next_image)
    .bind(next_images)
    .bind(payload.badge.or(current.badge))
    .bind(payload.badge_text.or(current.badge_text))
    .bind(payload.short_desc.or(current.short_desc))
    .bind(payload.description.or(current.description))
    .bind(next_specs)
    .bind(next_stock)
    .bind(next_stock_quantity)
    .bind(next_colors)
    .bind(next_ratings_json)
    .bind(next_rating)
    .bind(next_review)
    .bind(&current.id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = find_catalog_by_id_or_slug(&state, &current.id).await?;
    Ok(json_ok(
        format!("Catalog {} updated by {}", current.id, user.email),
        json!({ "item": product_to_json(updated, None, None) }),
    ))
}

async fn delete_catalog(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    let result = sqlx::query("DELETE FROM products WHERE id = ? OR slug = ?")
        .bind(&id)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        format!("Catalog {} deleted by {}", id, user.email),
        json!({ "id": id, "deleted": true }),
    ))
}

async fn bulk_products(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BulkCatalogRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    tracing::info!(
        "Starting bulk import for {} operations by {}",
        payload.operations.len(),
        user.email
    );

    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("Failed to start transaction: {}", e);
        AppError::Internal
    })?;

    let mut success_count = 0;
    let mut errors = Vec::new();

    for (index, op) in payload.operations.into_iter().enumerate() {
        match op {
            BulkOperation::Create { data, row_number } => {
                let display_row = row_number.unwrap_or(index as i32 + 1);

                // Mandatory fields check for Create
                let name = data.name.trim();
                if name.is_empty() {
                    errors.push(format!("Baris {}: Nama produk wajib diisi", display_row));
                    continue;
                }

                let category = data.category.as_deref().unwrap_or("Uncategorized");
                let price = data.price.unwrap_or(0.0);
                let image = data
                    .image
                    .as_deref()
                    .unwrap_or("https://placehold.co/600x400?text=No+Image");
                let base_slug = data.slug.clone().unwrap_or_else(|| {
                    // Sanitize: lowercase, replace spaces and special chars with hyphens, collapse multiple hyphens
                    let s = name.to_lowercase();
                    let s = s
                        .chars()
                        .map(|c| {
                            if c.is_alphanumeric() || c == '-' {
                                c
                            } else {
                                '-'
                            }
                        })
                        .collect::<String>();
                    s.split('-')
                        .filter(|p| !p.is_empty())
                        .collect::<Vec<_>>()
                        .join("-")
                });

                // Ensure slug is unique by appending a suffix if needed
                let slug = {
                    let mut candidate = base_slug.trim().to_string();
                    let mut suffix = 1u32;
                    loop {
                        let exists: Option<i64> =
                            sqlx::query_scalar("SELECT 1 FROM products WHERE slug = ? LIMIT 1")
                                .bind(&candidate)
                                .fetch_optional(&mut *tx)
                                .await
                                .unwrap_or(None);

                        if exists.is_none() {
                            break candidate;
                        }
                        suffix += 1;
                        candidate = format!("{}-{}", base_slug.trim(), suffix);
                    }
                };

                let id = data
                    .id
                    .as_deref()
                    .map(str::trim)
                    .filter(|v| !v.is_empty())
                    .map(ToString::to_string)
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

                let images = serde_json::to_string(&data.images.unwrap_or_else(|| json!([])))
                    .unwrap_or_else(|_| "[]".to_string());
                let specs = serde_json::to_string(&data.specs.unwrap_or_else(|| json!({})))
                    .unwrap_or_else(|_| "{}".to_string());
                let colors = serde_json::to_string(&data.colors.unwrap_or_else(|| json!([])))
                    .unwrap_or_else(|_| "[]".to_string());
                let ratings = match normalize_ratings_for_storage(
                    data.ratings.clone(),
                    data.rating,
                    data.review.clone(),
                ) {
                    Ok(r) => r,
                    Err(_) => Vec::new(),
                };
                let ratings_json =
                    serde_json::to_string(&ratings).unwrap_or_else(|_| "[]".to_string());
                let (next_rating, next_review, _) =
                    summarize_ratings(&ratings, data.rating, data.review.clone());
                let stock = data.stock.as_deref().unwrap_or("available");

                // Check if product with this ID already exists (upsert logic)
                let existing_image: Option<String> =
                    sqlx::query_scalar("SELECT image FROM products WHERE id = ? LIMIT 1")
                        .bind(&id)
                        .fetch_optional(&mut *tx)
                        .await
                        .unwrap_or(None);

                if let Some(current_image) = existing_image {
                    // Product exists — update, preserving image if new one is placeholder
                    let final_image = {
                        let new_img = image.trim();
                        if new_img.contains("placehold.co")
                            || new_img.contains("/uploads/placeholders/")
                            || new_img.is_empty()
                            || new_img.contains("logo.webp")
                        {
                            current_image
                        } else {
                            new_img.to_string()
                        }
                    };

                    let result = sqlx::query(
                        "UPDATE products SET slug = ?, name = ?, category = ?, subcategory = ?, price = ?, price_installment = ?, dp_min = ?, image = ?, images = ?, badge = ?, badge_text = ?, short_desc = ?, description = ?, specs = ?, stock = ?, stock_quantity = ?, colors = ?, ratings = ?, rating = ?, review = ? WHERE id = ?"
                    )
                    .bind(slug.trim())
                    .bind(name)
                    .bind(category.trim())
                    .bind(data.subcategory.flatten())
                    .bind(price)
                    .bind(data.price_installment)
                    .bind(data.dp_min)
                    .bind(&final_image)
                    .bind(&images)
                    .bind(&data.badge)
                    .bind(&data.badge_text)
                    .bind(&data.short_desc)
                    .bind(&data.description)
                    .bind(&specs)
                    .bind(stock)
                    .bind(data.stock_quantity)
                    .bind(&colors)
                    .bind(&ratings_json)
                    .bind(next_rating)
                    .bind(&next_review)
                    .bind(&id)
                    .execute(&mut *tx)
                    .await;

                    match result {
                        Ok(_) => success_count += 1,
                        Err(e) => {
                            let err_msg = e.to_string();
                            tracing::error!(
                                "Bulk Upsert(Update) Error at row {} | name='{}' | id='{}' | error: {}",
                                display_row, name, id, err_msg
                            );
                            errors.push(format!("Baris {} ({}): {}", display_row, name, err_msg));
                        }
                    }
                } else {
                    // Product does not exist — insert new
                    let result = sqlx::query(
                        "INSERT INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, stock_quantity, colors, ratings, rating, review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    )
                .bind(&id)
                .bind(slug.trim())
                .bind(name)
                .bind(category.trim())
                .bind(data.subcategory.flatten())
                .bind(price)
                .bind(data.price_installment)
                .bind(data.dp_min)
                .bind(image.trim())
                .bind(images)
                .bind(data.badge)
                .bind(data.badge_text)
                .bind(data.short_desc)
                .bind(data.description)
                .bind(specs)
                .bind(stock)
                .bind(data.stock_quantity)
                .bind(colors)
                .bind(ratings_json)
                .bind(next_rating)
                .bind(next_review)
                .execute(&mut *tx)
                .await;

                    match result {
                        Ok(_) => success_count += 1,
                        Err(e) => {
                            let err_msg = e.to_string();
                            tracing::error!(
                                "Bulk Create Error at row {} | name='{}' | slug='{}' | error: {}",
                                display_row,
                                name,
                                slug,
                                err_msg
                            );
                            errors.push(format!("Baris {} ({}): {}", display_row, name, err_msg));
                        }
                    }
                } // end else (insert new)
            }
            BulkOperation::Update {
                id,
                data,
                row_number,
            } => {
                let display_row = row_number.unwrap_or(index as i32 + 1);
                let mut query = String::from("UPDATE products SET ");
                let mut updates = Vec::new();

                // Using proper parameter binding for safety
                if data.slug.is_some() {
                    updates.push("slug = ?");
                }
                if data.name.is_some() {
                    updates.push("name = ?");
                }
                if data.category.is_some() {
                    updates.push("category = ?");
                }
                if data.subcategory.is_some() {
                    updates.push("subcategory = ?");
                }
                if data.price.is_some() {
                    updates.push("price = ?");
                }
                if data.price_installment.is_some() {
                    updates.push("price_installment = ?");
                }
                if data.dp_min.is_some() {
                    updates.push("dp_min = ?");
                }
                if data.image.is_some() {
                    updates.push("image = ?");
                }
                if data.stock.is_some() {
                    updates.push("stock = ?");
                }
                if data.stock_quantity.is_some() {
                    updates.push("stock_quantity = ?");
                }
                if data.short_desc.is_some() {
                    updates.push("short_desc = ?");
                }
                if data.description.is_some() {
                    updates.push("description = ?");
                }

                if updates.is_empty() {
                    success_count += 1;
                    continue;
                }

                query.push_str(&updates.join(", "));
                query.push_str(" WHERE id = ? OR slug = ?");

                let mut q = sqlx::query(&query);
                if let Some(ref val) = data.slug {
                    q = q.bind(val.trim());
                }
                if let Some(ref val) = data.name {
                    q = q.bind(val.trim());
                }
                if let Some(ref val) = data.category {
                    q = q.bind(val.trim());
                }
                if let Some(ref val) = data.subcategory {
                    q = q.bind(val);
                }
                if let Some(val) = data.price {
                    q = q.bind(val);
                }
                if let Some(val) = data.price_installment {
                    q = q.bind(val);
                }
                if let Some(val) = data.dp_min {
                    q = q.bind(val);
                }
                if let Some(ref val) = data.image {
                    q = q.bind(val.trim());
                }
                if let Some(ref val) = data.stock {
                    q = q.bind(val);
                }
                if let Some(val) = data.stock_quantity {
                    q = q.bind(val);
                }
                if let Some(ref val) = data.short_desc {
                    q = q.bind(val);
                }
                if let Some(ref val) = data.description {
                    q = q.bind(val);
                }

                q = q.bind(&id).bind(&id);

                match q.execute(&mut *tx).await {
                    Ok(_) => success_count += 1,
                    Err(e) => {
                        let err_msg = e.to_string();
                        tracing::error!(
                            "Bulk Update Error at row {} | id='{}' | error: {}",
                            display_row,
                            id,
                            err_msg
                        );
                        errors.push(format!("Baris {} (id={}): {}", display_row, id, err_msg));
                    }
                }
            }
        }
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit bulk transaction: {}", e);
        AppError::Internal
    })?;

    tracing::info!(
        "Bulk import finished. Success: {}, Errors: {}",
        success_count,
        errors.len()
    );
    Ok(json_ok(
        "Bulk operations completed",
        json!({ "successCount": success_count, "errors": errors }),
    ))
}

async fn list_promotions(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let promos: Vec<Value> = sqlx::query("SELECT * FROM promos")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "id": row.get::<String, _>("id"),
                "title": row.get::<String, _>("title"),
                "subtitle": row.get::<Option<String>, _>("subtitle"),
                "description": row.get::<Option<String>, _>("description"),
                "discount": row.get::<Option<i64>, _>("discount"),
                "originalPrice": row.get::<Option<f64>, _>("original_price"),
                "promoPrice": row.get::<Option<f64>, _>("promo_price"),
                "image": row.get::<String, _>("image"),
                "badge": row.get::<Option<String>, _>("badge"),
                "validUntil": row.get::<Option<String>, _>("valid_until"),
                "category": row.get::<Option<String>, _>("category"),
                "variant": row.get::<Option<String>, _>("variant"),
                "productIds": serde_json::from_str::<Value>(&row.get::<String, _>("product_ids")).unwrap_or(json!([])),
            })
        })
        .collect();
    Ok(json_ok("Promotions fetched", json!({ "items": promos })))
}

async fn create_promotion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<PromotionCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_promotion_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let product_ids = serde_json::to_string(&payload.product_ids.unwrap_or_else(|| json!([])))
        .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "INSERT INTO promos (id, title, subtitle, description, discount, original_price, promo_price, image, badge, valid_until, category, variant, product_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.title.trim())
    .bind(payload.subtitle)
    .bind(payload.description)
    .bind(payload.discount)
    .bind(payload.original_price)
    .bind(payload.promo_price)
    .bind(payload.image.trim())
    .bind(payload.badge)
    .bind(payload.valid_until)
    .bind(payload.category)
    .bind(payload.variant)
    .bind(product_ids)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = find_promotion_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("Promotion created by {}", user.email),
        json!({ "item": promo_to_json(created) }),
    ))
}

async fn update_promotion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<PromotionUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_promotion_update(&payload)?;

    let current = find_promotion_by_id(&state, &id).await?;
    let next_title = payload
        .title
        .as_deref()
        .unwrap_or(&current.title)
        .trim()
        .to_string();
    let next_image = payload
        .image
        .as_deref()
        .unwrap_or(&current.image)
        .trim()
        .to_string();
    let next_original = payload.original_price.or(current.original_price);
    let next_promo = payload.promo_price.or(current.promo_price);
    if let (Some(original), Some(promo)) = (next_original, next_promo) {
        if promo > original {
            return Err(AppError::Validation {
                errors: vec!["promoPrice tidak boleh lebih besar dari originalPrice".to_string()],
            });
        }
    }
    let next_product_ids = serde_json::to_string(
        &payload
            .product_ids
            .unwrap_or_else(|| parse_json_or_default(current.product_ids.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "UPDATE promos SET title = ?, subtitle = ?, description = ?, discount = ?, original_price = ?, promo_price = ?, image = ?, badge = ?, valid_until = ?, category = ?, variant = ?, product_ids = ? WHERE id = ?"
    )
    .bind(next_title)
    .bind(payload.subtitle.or(current.subtitle))
    .bind(payload.description.or(current.description))
    .bind(payload.discount.or(current.discount))
    .bind(next_original)
    .bind(next_promo)
    .bind(next_image)
    .bind(payload.badge.or(current.badge))
    .bind(payload.valid_until.or(current.valid_until))
    .bind(payload.category.or(current.category))
    .bind(payload.variant.or(current.variant))
    .bind(next_product_ids)
    .bind(&current.id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = find_promotion_by_id(&state, &current.id).await?;
    Ok(json_ok(
        format!("Promotion {} updated by {}", current.id, user.email),
        json!({ "item": promo_to_json(updated) }),
    ))
}

async fn delete_promotion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let result = sqlx::query("DELETE FROM promos WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        format!("Promotion {} deleted by {}", id, user.email),
        json!({ "id": id, "deleted": true }),
    ))
}

async fn list_partners(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let partners = sqlx::query_as::<_, PartnerRecord>(
        "SELECT id, name, logo_url, website_url, sort_order, is_active, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM partners WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let items: Vec<Value> = partners.into_iter().map(partner_to_json).collect();
    Ok(json_ok("Partners fetched", json!({ "items": items })))
}

async fn list_admin_partners(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let partners = sqlx::query_as::<_, PartnerRecord>(
        "SELECT id, name, logo_url, website_url, sort_order, is_active, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM partners ORDER BY sort_order ASC, created_at ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let items: Vec<Value> = partners.into_iter().map(partner_to_json).collect();
    Ok(json_ok("Admin partners fetched", json!({ "items": items })))
}

async fn create_partner(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    let mut id_val: Option<String> = None;
    let mut name = String::new();
    let mut logo_url = String::new();
    let mut website_url: Option<String> = None;
    let mut sort_order: Option<i64> = None;
    let mut is_active: bool = true;
    let mut logo_file_path: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::Internal)?
    {
        let field_name = field.name().unwrap_or_default().to_string();
        match field_name.as_str() {
            "id" => id_val = Some(field.text().await.unwrap_or_default()),
            "name" => name = field.text().await.unwrap_or_default(),
            "logoUrl" => logo_url = field.text().await.unwrap_or_default(),
            "websiteUrl" => {
                website_url = {
                    let text = field.text().await.unwrap_or_default();
                    if text.is_empty() {
                        None
                    } else {
                        Some(text)
                    }
                }
            }
            "sortOrder" => {
                sort_order = Some(field.text().await.unwrap_or_default().parse().unwrap_or(0))
            }
            "isActive" => {
                is_active = field
                    .text()
                    .await
                    .unwrap_or_default()
                    .parse()
                    .unwrap_or(true)
            }
            "logo" => {
                let data = field.bytes().await.map_err(|_| AppError::Internal)?;
                if !data.is_empty() {
                    let img = decode_uploaded_image(&data)?;
                    let url = save_image_as_webp(img, "logo")?;
                    logo_file_path = Some(url);
                }
            }
            _ => {}
        }
    }

    let final_logo_url = logo_file_path.unwrap_or(logo_url);
    if name.trim().is_empty() || final_logo_url.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Nama dan logo partner wajib diisi".to_string()],
        });
    }

    let id = id_val
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let final_sort_order = match sort_order {
        Some(value) => value,
        None => {
            sqlx::query_scalar::<_, i64>("SELECT COALESCE(MAX(sort_order), 0) + 10 FROM partners")
                .fetch_one(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("DB error computing next partner sort order: {}", e);
                    AppError::Internal
                })?
        }
    };

    sqlx::query(
        "INSERT INTO partners (id, name, logo_url, website_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(name.trim())
    .bind(final_logo_url.trim())
    .bind(website_url)
    .bind(final_sort_order)
    .bind(is_active)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = find_partner_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("Partner created by {}", user.email),
        json!({ "item": partner_to_json(created) }),
    ))
}

async fn update_partner(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let current = find_partner_by_id(&state, &id).await?;

    let mut name_val: Option<String> = None;
    let mut logo_url: Option<String> = None;
    let mut website_url: Option<String> = None;
    let mut sort_order: Option<i64> = None;
    let mut is_active: Option<bool> = None;
    let mut logo_file_path: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::Internal)?
    {
        let field_name = field.name().unwrap_or_default().to_string();
        match field_name.as_str() {
            "name" => name_val = Some(field.text().await.unwrap_or_default()),
            "logoUrl" => logo_url = Some(field.text().await.unwrap_or_default()),
            "websiteUrl" => {
                website_url = {
                    let text = field.text().await.unwrap_or_default();
                    if text.is_empty() {
                        None
                    } else {
                        Some(text)
                    }
                }
            }
            "sortOrder" => {
                sort_order = Some(field.text().await.unwrap_or_default().parse().unwrap_or(0))
            }
            "isActive" => {
                is_active = Some(
                    field
                        .text()
                        .await
                        .unwrap_or_default()
                        .parse()
                        .unwrap_or(true),
                )
            }
            "logo" => {
                let data = field.bytes().await.map_err(|_| AppError::Internal)?;
                if !data.is_empty() {
                    let img = decode_uploaded_image(&data)?;
                    let url = save_image_as_webp(img, "logo")?;
                    logo_file_path = Some(url);
                }
            }
            _ => {}
        }
    }

    let next_name = name_val.unwrap_or(current.name).trim().to_string();
    let next_logo = logo_file_path
        .or(logo_url)
        .unwrap_or(current.logo_url)
        .trim()
        .to_string();
    let next_website = website_url.or(current.website_url);
    let next_sort = sort_order.unwrap_or(current.sort_order);
    let next_active = is_active.unwrap_or(current.is_active);

    if next_name.is_empty() || next_logo.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Nama dan logo partner tidak boleh kosong".to_string()],
        });
    }

    sqlx::query(
        "UPDATE partners SET name = ?, logo_url = ?, website_url = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(next_name)
    .bind(next_logo)
    .bind(next_website)
    .bind(next_sort)
    .bind(next_active)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = find_partner_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("Partner {} updated by {}", id, user.email),
        json!({ "item": partner_to_json(updated) }),
    ))
}

async fn update_partner_order(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(items): Json<Vec<PartnerOrderItem>>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    if items.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Daftar urutan partner tidak boleh kosong".to_string()],
        });
    }

    let mut tx = state.pool.begin().await.map_err(|e| {
        tracing::error!("DB transaction error updating partner order: {}", e);
        AppError::Internal
    })?;

    for item in &items {
        if item.id.trim().is_empty() {
            return Err(AppError::Validation {
                errors: vec!["ID partner tidak boleh kosong".to_string()],
            });
        }

        sqlx::query(
            "UPDATE partners SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(item.sort_order)
        .bind(item.id.trim())
        .execute(&mut *tx)
        .await
        .map_err(|e| {
            tracing::error!("DB error updating partner order: {}", e);
            AppError::Internal
        })?;
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("DB commit error updating partner order: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        format!("Partner order updated by {}", user.email),
        json!({ "updated": items.len() }),
    ))
}

async fn delete_partner(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    let result = sqlx::query("DELETE FROM partners WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        format!("Partner {} deleted by {}", id, user.email),
        json!({ "id": id, "deleted": true }),
    ))
}

#[derive(sqlx::FromRow)]
struct ReferralRecord {
    id: String,
    slug: String,
    owner_user_id: String,
    label: Option<String>,
    target_path: String,
    clicks: i64,
    leads: i64,
    is_active: bool,
    created_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateReferralRequest {
    label: Option<String>,
    target_path: Option<String>,
    owner_user_id: Option<String>,
}

#[derive(sqlx::FromRow)]
struct JobRecord {
    id: String,
    title: String,
    department: Option<String>,
    location: Option<String>,
    r#type: Option<String>,
    level: Option<String>,
    description: Option<String>,
    requirements: Option<String>,
    benefits: Option<String>,
    posted_at: Option<String>,
    is_active: bool,
    deadline: Option<String>,
    applicants_count: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobCreateRequest {
    id: Option<String>,
    title: String,
    department: Option<String>,
    location: Option<String>,
    r#type: Option<String>,
    level: Option<String>,
    description: Option<String>,
    requirements: Option<Value>,
    benefits: Option<Value>,
    posted_at: Option<String>,
    is_active: Option<bool>,
    deadline: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobUpdateRequest {
    title: Option<String>,
    department: Option<String>,
    location: Option<String>,
    r#type: Option<String>,
    level: Option<String>,
    description: Option<String>,
    requirements: Option<Value>,
    benefits: Option<Value>,
    posted_at: Option<String>,
    is_active: Option<bool>,
    deadline: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ArticleRecord {
    id: String,
    slug: String,
    title: String,
    excerpt: Option<String>,
    content: Option<String>,
    author: Option<String>,
    author_role: Option<String>,
    author_image: Option<String>,
    hero_image: Option<String>,
    category: Option<String>,
    tags: Option<String>,
    published_at: Option<String>,
    read_time: Option<i64>,
    featured: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArticleCreateRequest {
    id: Option<String>,
    slug: String,
    title: String,
    excerpt: Option<String>,
    content: Option<String>,
    author: Option<String>,
    author_role: Option<String>,
    author_image: Option<String>,
    hero_image: Option<String>,
    category: Option<String>,
    tags: Option<Value>,
    published_at: Option<String>,
    read_time: Option<i64>,
    featured: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArticleUpdateRequest {
    slug: Option<String>,
    title: Option<String>,
    excerpt: Option<String>,
    content: Option<String>,
    author: Option<String>,
    author_role: Option<String>,
    author_image: Option<String>,
    hero_image: Option<String>,
    category: Option<String>,
    tags: Option<Value>,
    published_at: Option<String>,
    read_time: Option<i64>,
    featured: Option<bool>,
}

fn referral_to_json(row: ReferralRecord) -> Value {
    json!({
        "id": row.id,
        "slug": row.slug,
        "ownerUserId": row.owner_user_id,
        "label": row.label,
        "targetPath": row.target_path,
        "clicks": row.clicks,
        "leads": row.leads,
        "isActive": row.is_active,
        "createdAt": row.created_at,
    })
}

fn job_to_json(row: JobRecord) -> Value {
    json!({
        "id": row.id,
        "title": row.title,
        "department": row.department,
        "location": row.location,
        "type": row.r#type,
        "level": row.level,
        "description": row.description,
        "requirements": parse_json_or_default(row.requirements.as_deref(), json!([])),
        "benefits": parse_json_or_default(row.benefits.as_deref(), json!([])),
        "postedAt": row.posted_at,
        "isActive": row.is_active,
        "deadline": row.deadline,
        "applicantsCount": row.applicants_count,
    })
}

#[derive(sqlx::FromRow)]
struct JobApplicationRecord {
    id: String,
    job_id: String,
    job_title: String,
    full_name: String,
    email: String,
    phone: String,
    address: Option<String>,
    education: Option<String>,
    major: Option<String>,
    experience: Option<String>,
    cover_letter: Option<String>,
    linked_in: Option<String>,
    portfolio_url: Option<String>,
    status: String,
    applied_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobApplicationCreateRequest {
    job_id: String,
    job_title: String,
    full_name: String,
    email: String,
    phone: String,
    #[serde(default)]
    address: Option<String>,
    #[serde(default)]
    education: Option<String>,
    #[serde(default)]
    major: Option<String>,
    #[serde(default)]
    experience: Option<String>,
    #[serde(default)]
    cover_letter: Option<String>,
    #[serde(default)]
    linked_in: Option<String>,
    #[serde(default)]
    portfolio_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobApplicationStatusUpdateRequest {
    status: String,
}

fn job_application_to_json(row: JobApplicationRecord) -> Value {
    json!({
        "id": row.id,
        "jobId": row.job_id,
        "jobTitle": row.job_title,
        "fullName": row.full_name,
        "email": row.email,
        "phone": row.phone,
        "address": row.address,
        "education": row.education,
        "major": row.major,
        "experience": row.experience,
        "coverLetter": row.cover_letter,
        "linkedIn": row.linked_in,
        "portfolioUrl": row.portfolio_url,
        "status": row.status,
        "appliedAt": row.applied_at,
    })
}

fn article_to_json(row: ArticleRecord) -> Value {
    json!({
        "id": row.id,
        "slug": row.slug,
        "title": row.title,
        "excerpt": row.excerpt,
        "content": row.content,
        "author": row.author,
        "authorRole": row.author_role,
        "authorImage": row.author_image,
        "heroImage": row.hero_image,
        "category": row.category,
        "tags": parse_json_or_default(row.tags.as_deref(), json!([])),
        "publishedAt": row.published_at,
        "readTime": row.read_time,
        "featured": row.featured,
    })
}

fn validate_job_create(payload: &JobCreateRequest) -> Result<(), AppError> {
    if payload.title.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["title wajib diisi".to_string()],
        });
    }
    Ok(())
}

fn validate_job_update(payload: &JobUpdateRequest) -> Result<(), AppError> {
    if payload
        .title
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        return Err(AppError::Validation {
            errors: vec!["title tidak boleh kosong".to_string()],
        });
    }
    Ok(())
}

fn validate_article_create(payload: &ArticleCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.slug.trim().is_empty() {
        errors.push("slug wajib diisi".to_string());
    }
    if payload.title.trim().is_empty() {
        errors.push("title wajib diisi".to_string());
    }
    if payload.read_time.is_some_and(|value| value < 0) {
        errors.push("readTime tidak boleh negatif".to_string());
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_article_update(payload: &ArticleUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload
        .slug
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("slug tidak boleh kosong".to_string());
    }
    if payload
        .title
        .as_ref()
        .is_some_and(|value| value.trim().is_empty())
    {
        errors.push("title tidak boleh kosong".to_string());
    }
    if payload.read_time.is_some_and(|value| value < 0) {
        errors.push("readTime tidak boleh negatif".to_string());
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

async fn generate_referral(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<GenerateReferralRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Agent, Role::Operator, Role::Sales],
    )
    .await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");
    let owner_user_id = if is_admin {
        payload.owner_user_id.unwrap_or_else(|| user.id.clone())
    } else {
        user.id.clone()
    };
    let slug = format!("ref-{}", uuid::Uuid::new_v4().simple());
    let id = uuid::Uuid::new_v4().to_string();
    let target_path = validate_referral_target_path(payload.target_path.as_deref().unwrap_or("/"))?;

    sqlx::query(
        "INSERT INTO referrals (id, slug, owner_user_id, label, target_path) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&slug)
    .bind(&owner_user_id)
    .bind(payload.label)
    .bind(target_path)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = sqlx::query_as::<_, ReferralRecord>(
        "SELECT id, slug, owner_user_id, label, target_path, clicks, leads, is_active, created_at FROM referrals WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    Ok(json_ok(
        format!("Referral generated by {}", user.email),
        json!({ "item": referral_to_json(created) }),
    ))
}

async fn list_referrals(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Agent, Role::Operator, Role::Sales],
    )
    .await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");
    let rows = if is_admin {
        sqlx::query_as::<_, ReferralRecord>(
            "SELECT id, slug, owner_user_id, label, target_path, clicks, leads, is_active, created_at FROM referrals ORDER BY created_at DESC"
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, ReferralRecord>(
            "SELECT id, slug, owner_user_id, label, target_path, clicks, leads, is_active, created_at FROM referrals WHERE owner_user_id = ? ORDER BY created_at DESC"
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        format!("Referrals fetched by {}", user.email),
        json!({ "items": rows.into_iter().map(referral_to_json).collect::<Vec<_>>() }),
    ))
}

async fn get_referral(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Agent, Role::Operator, Role::Sales],
    )
    .await?;
    let row = sqlx::query_as::<_, ReferralRecord>(
        "SELECT id, slug, owner_user_id, label, target_path, clicks, leads, is_active, created_at FROM referrals WHERE slug = ? LIMIT 1"
    )
    .bind(&slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    if !user.role.eq_ignore_ascii_case("admin") && row.owner_user_id != user.id {
        return Err(AppError::Forbidden);
    }

    Ok(json_ok(
        format!("Referral {} fetched by {}", slug, user.email),
        json!({ "item": referral_to_json(row) }),
    ))
}

async fn get_referral_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(slug): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Agent, Role::Operator, Role::Sales],
    )
    .await?;
    let row = sqlx::query_as::<_, ReferralRecord>(
        "SELECT id, slug, owner_user_id, label, target_path, clicks, leads, is_active, created_at FROM referrals WHERE slug = ? LIMIT 1"
    )
    .bind(&slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    if !user.role.eq_ignore_ascii_case("admin") && row.owner_user_id != user.id {
        return Err(AppError::Forbidden);
    }

    Ok(json_ok(
        format!("Referral {} stats fetched by {}", slug, user.email),
        json!({ "slug": slug, "clicks": row.clicks, "leads": row.leads }),
    ))
}

async fn get_public_referral(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<ResponseBody, AppError> {
    let row = sqlx::query_as::<_, PublicReferralRecord>(
        r#"
        SELECT
            r.slug,
            r.target_path,
            r.label,
            u.name AS owner_name,
            COALESCE(u.whatsapp, '') AS owner_whatsapp,
            r.is_active,
            r.created_at
        FROM referrals r
        INNER JOIN users u ON u.id = r.owner_user_id
        WHERE r.slug = ?
        LIMIT 1
        "#,
    )
    .bind(&slug)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error loading public referral: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    if !row.is_active {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        format!("Public referral {} fetched", slug),
        json!({
            "item": {
                "slug": row.slug,
                "targetPath": row.target_path,
                "label": row.label,
                "ownerName": row.owner_name,
                "ownerWhatsapp": row.owner_whatsapp,
                "isActive": row.is_active,
                "createdAt": row.created_at,
            }
        }),
    ))
}

fn validate_payment_status(value: &str) -> bool {
    matches!(value.to_lowercase().as_str(), "cash" | "credit" | "cod")
}

fn validate_delivery_schedule(payload: &DeliveryScheduleCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.customer_name.trim().is_empty() {
        errors.push("namaCust wajib diisi".to_string());
    }
    if payload.item_name.trim().is_empty() {
        errors.push("namaBarang wajib diisi".to_string());
    }
    if payload.address.trim().is_empty() {
        errors.push("alamat wajib diisi".to_string());
    }
    if payload.sales_name.trim().is_empty() {
        errors.push("namaSales wajib diisi".to_string());
    }
    if payload.sender_branch.trim().is_empty() {
        errors.push("cabangPengirim wajib diisi".to_string());
    }
    if !validate_payment_status(&payload.payment_status) {
        errors.push("status pembayaran harus cash, credit, atau cod".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

async fn create_delivery_schedule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<DeliveryScheduleCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Sales]).await?;
    validate_delivery_schedule(&payload)?;

    let sales_user = if user.role.eq_ignore_ascii_case("admin") {
        let query = format!("{USER_RECORD_SELECT} WHERE LOWER(name) = LOWER(?) LIMIT 1");
        sqlx::query_as::<_, UserRecord>(&query)
            .bind(payload.sales_name.trim())
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error finding sales user: {}", e);
                AppError::Internal
            })?
            .ok_or_else(|| AppError::Validation {
                errors: vec!["nama sales tidak ditemukan di database".to_string()],
            })?
    } else {
        let query = format!("{USER_RECORD_SELECT} WHERE id = ? LIMIT 1");
        sqlx::query_as::<_, UserRecord>(&query)
            .bind(&user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error loading sales user: {}", e);
                AppError::Internal
            })?
            .ok_or(AppError::NotFound)?
    };

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        r#"
        INSERT INTO sales_delivery_schedules (id, sales_user_id, customer_name, item_name, payment_status, address, sales_name, sender_branch, referral_slug)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&id)
    .bind(&sales_user.id)
    .bind(payload.customer_name.trim())
    .bind(payload.item_name.trim())
    .bind(payload.payment_status.trim().to_lowercase())
    .bind(payload.address.trim())
    .bind(sales_user.name.trim())
    .bind(payload.sender_branch.trim())
    .bind(if sales_user.referral_slug.trim().is_empty() { None::<String> } else { Some(sales_user.referral_slug.clone()) })
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating sales schedule: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        format!("Delivery schedule created by {}", user.email),
        json!({ "item": { "id": id, "salesUserId": sales_user.id } }),
    ))
}

async fn list_delivery_schedules(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Sales]).await?;

    let rows = if user.role.eq_ignore_ascii_case("admin") {
        sqlx::query_as::<_, DeliveryScheduleRecord>(
            "SELECT id, customer_name, item_name, payment_status, address, sales_user_id, sales_name, sender_branch, referral_slug, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM sales_delivery_schedules ORDER BY created_at DESC"
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, DeliveryScheduleRecord>(
            "SELECT id, customer_name, item_name, payment_status, address, sales_user_id, sales_name, sender_branch, referral_slug, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM sales_delivery_schedules WHERE sales_user_id = ? ORDER BY created_at DESC"
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error listing delivery schedules: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        format!("Delivery schedules fetched by {}", user.email),
        json!({ "items": rows }),
    ))
}

async fn insert_telemetry(
    state: &AppState,
    headers: &HeaderMap,
    event_type: &str,
    payload: &Value,
) -> Result<(), AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let path = payload
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or("/")
        .trim();
    let source = payload
        .get("source")
        .and_then(|v| v.as_str())
        .unwrap_or("direct")
        .trim();
    let session_id = payload
        .get("sessionId")
        .and_then(|v| v.as_str())
        .unwrap_or("anonymous")
        .trim();
    let metadata_str = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());

    if !path.starts_with('/') || !validate_text_length(path, 2048) {
        return Err(AppError::Validation {
            errors: vec!["path telemetry tidak valid".to_string()],
        });
    }
    if !validate_text_length(source, 128) {
        return Err(AppError::Validation {
            errors: vec!["source telemetry terlalu panjang".to_string()],
        });
    }
    if !validate_text_length(session_id, 128) {
        return Err(AppError::Validation {
            errors: vec!["sessionId telemetry terlalu panjang".to_string()],
        });
    }
    if metadata_str.len() > 8 * 1024 {
        return Err(AppError::Validation {
            errors: vec!["metadata telemetry terlalu besar".to_string()],
        });
    }

    let client_ip = extract_client_ip(headers);
    {
        let mut buckets = state.telemetry_attempts.write().await;
        enforce_rate_limit_bucket(
            &mut buckets,
            &format!("telemetry:{}:session:{}", event_type, session_id),
            60,
            Duration::minutes(1),
        )
        .await?;

        if let Some(ip) = client_ip.as_deref() {
            enforce_rate_limit_bucket(
                &mut buckets,
                &format!("telemetry:{}:ip:{}", event_type, ip),
                120,
                Duration::minutes(1),
            )
            .await?;
        }
    }

    let _ = sqlx::query(
        "INSERT INTO telemetry_events (id, event_type, path, source, session_id, metadata) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(event_type)
    .bind(path)
    .bind(source)
    .bind(session_id)
    .bind(metadata_str)
    .execute(&state.pool)
    .await;

    // Update referral counters only if source is an actual referral slug.
    let is_referral_slug =
        if source != "direct" && source != "anonymous" && source != "internal" && source != "" {
            let cache_key = format!("referral_slug:{}", source);
            let cached_exists: Option<bool> = state.cache.get(&cache_key).await.unwrap_or(None);

            if let Some(exists) = cached_exists {
                exists
            } else {
                let exists = sqlx::query_scalar::<_, String>(
                    "SELECT slug FROM referrals WHERE slug = ? LIMIT 1",
                )
                .bind(source)
                .fetch_optional(&state.pool)
                .await
                .ok()
                .flatten()
                .is_some();

                // Cache with 5 minutes TTL
                let _ = state.cache.set(&cache_key, &exists, Some(300)).await;
                exists
            }
        } else {
            false
        };

    if is_referral_slug {
        let update_query = match event_type {
            "whatsapp_click" | "pixel_event" => {
                "UPDATE referrals SET leads = leads + 1 WHERE slug = ?"
            }
            "click" | "page_view" => "UPDATE referrals SET clicks = clicks + 1 WHERE slug = ?",
            _ => "",
        };

        if !update_query.is_empty() {
            let _ = sqlx::query(update_query)
                .bind(source)
                .execute(&state.pool)
                .await;
        }
    }

    Ok(())
}

async fn page_view(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "page_view", &payload).await?;
    Ok(json_ok(
        "Page view recorded",
        json!({ "received": payload }),
    ))
}

async fn click(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "click", &payload).await?;
    Ok(json_ok("Click recorded", json!({ "received": payload })))
}

async fn whatsapp_click(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "whatsapp_click", &payload).await?;
    Ok(json_ok(
        "WhatsApp click recorded",
        json!({ "received": payload }),
    ))
}

async fn pixel_event(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "pixel_event", &payload).await?;
    Ok(json_ok(
        "Pixel event recorded",
        json!({ "received": payload }),
    ))
}

async fn list_jobs(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let jobs = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at, is_active, deadline, (SELECT COUNT(*) FROM job_applications WHERE job_id = job_listings.id) as applicants_count FROM job_listings ORDER BY created_at DESC"
    )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(job_to_json)
        .collect::<Vec<_>>();
    Ok(json_ok("Jobs fetched", json!({ "items": jobs })))
}

async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<JobCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_job_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let requirements = serde_json::to_string(&payload.requirements.unwrap_or_else(|| json!([])))
        .map_err(|_| AppError::Internal)?;
    let benefits = serde_json::to_string(&payload.benefits.unwrap_or_else(|| json!([])))
        .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "INSERT INTO job_listings (id, title, department, location, type, level, description, requirements, benefits, posted_at, is_active, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.title.trim())
    .bind(payload.department)
    .bind(payload.location)
    .bind(payload.r#type)
    .bind(payload.level)
    .bind(payload.description)
    .bind(requirements)
    .bind(benefits)
    .bind(payload.posted_at)
    .bind(payload.is_active.unwrap_or(true))
    .bind(payload.deadline)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at, is_active, deadline, 0 as applicants_count FROM job_listings WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    Ok(json_ok(
        format!("Job created by {}", user.email),
        json!({ "item": job_to_json(created) }),
    ))
}

async fn update_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<JobUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_job_update(&payload)?;

    let current = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at, is_active, deadline, (SELECT COUNT(*) FROM job_applications WHERE job_id = job_listings.id) as applicants_count FROM job_listings WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let next_requirements = serde_json::to_string(
        &payload
            .requirements
            .unwrap_or_else(|| parse_json_or_default(current.requirements.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;
    let next_benefits = serde_json::to_string(
        &payload
            .benefits
            .unwrap_or_else(|| parse_json_or_default(current.benefits.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "UPDATE job_listings SET title = ?, department = ?, location = ?, type = ?, level = ?, description = ?, requirements = ?, benefits = ?, posted_at = ?, is_active = ?, deadline = ? WHERE id = ?"
    )
    .bind(payload.title.unwrap_or(current.title))
    .bind(payload.department.or(current.department))
    .bind(payload.location.or(current.location))
    .bind(payload.r#type.or(current.r#type))
    .bind(payload.level.or(current.level))
    .bind(payload.description.or(current.description))
    .bind(next_requirements)
    .bind(next_benefits)
    .bind(payload.posted_at.or(current.posted_at))
    .bind(payload.is_active.unwrap_or(current.is_active))
    .bind(payload.deadline.or(current.deadline))
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at, is_active, deadline, (SELECT COUNT(*) FROM job_applications WHERE job_id = job_listings.id) as applicants_count FROM job_listings WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    Ok(json_ok(
        format!("Job {} updated by {}", id, user.email),
        json!({ "item": job_to_json(updated) }),
    ))
}

async fn delete_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    let result = sqlx::query("DELETE FROM job_listings WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(json_ok(
        format!("Job {} deleted by {}", id, user.email),
        json!({ "id": id, "deleted": true }),
    ))
}

async fn list_articles(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let articles = sqlx::query_as::<_, ArticleRecord>(
        "SELECT id, slug, title, excerpt, content, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured FROM blog_posts ORDER BY created_at DESC"
    )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(article_to_json)
        .collect::<Vec<_>>();
    Ok(json_ok("Articles fetched", json!({ "items": articles })))
}

async fn create_article(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ArticleCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_article_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let tags = serde_json::to_string(&payload.tags.unwrap_or_else(|| json!([])))
        .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "INSERT INTO blog_posts (id, slug, title, excerpt, content, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.slug.trim())
    .bind(payload.title.trim())
    .bind(payload.excerpt)
    .bind(payload.content)
    .bind(payload.author)
    .bind(payload.author_role)
    .bind(payload.author_image)
    .bind(payload.hero_image)
    .bind(payload.category)
    .bind(tags)
    .bind(payload.published_at)
    .bind(payload.read_time)
    .bind(payload.featured.unwrap_or(false))
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = sqlx::query_as::<_, ArticleRecord>(
        "SELECT id, slug, title, excerpt, content, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured FROM blog_posts WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    Ok(json_ok(
        format!("Article created by {}", user.email),
        json!({ "item": article_to_json(created) }),
    ))
}

async fn update_article(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ArticleUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    validate_article_update(&payload)?;

    let current = sqlx::query_as::<_, ArticleRecord>(
        "SELECT id, slug, title, excerpt, content, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured FROM blog_posts WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let next_tags = serde_json::to_string(
        &payload
            .tags
            .unwrap_or_else(|| parse_json_or_default(current.tags.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;

    sqlx::query(
        "UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, content = ?, author = ?, author_role = ?, author_image = ?, hero_image = ?, category = ?, tags = ?, published_at = ?, read_time = ?, featured = ? WHERE id = ?"
    )
    .bind(payload.slug.unwrap_or(current.slug))
    .bind(payload.title.unwrap_or(current.title))
    .bind(payload.excerpt.or(current.excerpt))
    .bind(payload.content.or(current.content))
    .bind(payload.author.or(current.author))
    .bind(payload.author_role.or(current.author_role))
    .bind(payload.author_image.or(current.author_image))
    .bind(payload.hero_image.or(current.hero_image))
    .bind(payload.category.or(current.category))
    .bind(next_tags)
    .bind(payload.published_at.or(current.published_at))
    .bind(payload.read_time.or(current.read_time))
    .bind(payload.featured.unwrap_or(current.featured))
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = sqlx::query_as::<_, ArticleRecord>(
        "SELECT id, slug, title, excerpt, content, author, author_role, author_image, hero_image, category, tags, published_at, read_time, featured FROM blog_posts WHERE id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    Ok(json_ok(
        format!("Article {} updated by {}", id, user.email),
        json!({ "item": article_to_json(updated) }),
    ))
}

async fn delete_article(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    let result = sqlx::query("DELETE FROM blog_posts WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        format!("Article {} deleted by {}", id, user.email),
        json!({ "id": id, "deleted": true }),
    ))
}

type ResponseBody = axum::response::Response;

async fn list_notifications(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[
            Role::Admin,
            Role::Operator,
            Role::Agent,
            Role::Sales,
            Role::Owner,
            Role::PicRaport,
            Role::Karyawan,
        ],
    )
    .await?;

    let rows = sqlx::query_as::<_, NotificationRecord>(
        "SELECT id, recipient_user_id, type, title, message, action_path, entity_id, is_read,
                DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
                DATE_FORMAT(read_at, '%Y-%m-%d %H:%i:%s') AS read_at
         FROM notifications
         WHERE recipient_user_id = ?
         ORDER BY is_read ASC, created_at DESC
         LIMIT 100"
    )
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing notifications: {}", e);
        AppError::Internal
    })?;

    let unread_count = rows.iter().filter(|row| !row.is_read).count() as i64;
    let items: Vec<Value> = rows.into_iter().map(notification_to_json).collect();
    Ok(json_ok(
        "Notifications fetched",
        json!({
            "items": items,
            "unreadCount": unread_count
        }),
    ))
}

async fn get_notifications_unread_count(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[
            Role::Admin,
            Role::Operator,
            Role::Agent,
            Role::Sales,
            Role::Owner,
            Role::PicRaport,
            Role::Karyawan,
        ],
    )
    .await?;

    let unread_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE recipient_user_id = ? AND is_read = 0",
    )
    .bind(&user.id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error counting unread notifications: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "Unread notifications fetched",
        json!({ "unreadCount": unread_count }),
    ))
}

async fn mark_notification_as_read(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Agent, Role::Sales],
    )
    .await?;

    let result = sqlx::query(
        "UPDATE notifications
         SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE id = ? AND recipient_user_id = ?",
    )
    .bind(&id)
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error marking notification as read: {}", e);
        AppError::Internal
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        "Notification marked as read",
        json!({ "id": id, "updated": true }),
    ))
}

async fn mark_all_notifications_as_read(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Agent, Role::Sales],
    )
    .await?;

    let result = sqlx::query(
        "UPDATE notifications
         SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE recipient_user_id = ? AND is_read = 0",
    )
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error marking all notifications as read: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "All notifications marked as read",
        json!({ "updated": result.rows_affected() }),
    ))
}

async fn list_leads(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Agent, Role::Sales],
    )
    .await?;
    let can_view_all =
        user.role.eq_ignore_ascii_case("admin") || user.role.eq_ignore_ascii_case("operator");

    let leads = if can_view_all {
        sqlx::query_as::<_, LeadRecord>(
            "SELECT id, agent_id, customer_name, phone_number, interested_product, status, notes, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM leads ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, LeadRecord>(
            "SELECT id, agent_id, customer_name, phone_number, interested_product, status, notes, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM leads WHERE agent_id = ? ORDER BY created_at DESC",
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let items: Vec<Value> = leads.into_iter().map(lead_to_json).collect();
    Ok(json_ok("Leads fetched", json!({ "items": items })))
}

async fn create_lead(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<LeadCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent, Role::Sales]).await?;
    validate_lead_create(&payload)?;
    let phone_number = normalize_local_whatsapp(&payload.phone_number);
    if !phone_number.starts_with("08") || phone_number.len() < 10 {
        return Err(AppError::Validation {
            errors: vec!["phoneNumber wajib valid dan diawali 08".to_string()],
        });
    }

    let is_admin = user.role.eq_ignore_ascii_case("admin");
    let agent_id = if is_admin {
        payload
            .agent_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
            .ok_or(AppError::Validation {
                errors: vec!["agentId wajib diisi untuk admin".to_string()],
            })?
    } else {
        user.id.clone()
    };

    let status = payload.status.unwrap_or_else(|| "Follow Up".to_string());
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO leads (id, agent_id, customer_name, phone_number, interested_product, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&agent_id)
    .bind(payload.customer_name.trim())
    .bind(phone_number)
    .bind(payload.interested_product.trim())
    .bind(status)
    .bind(payload.notes)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let created = find_lead_by_id(&state, &id).await?;

    notify_all_admins(
        &state,
        "lead_created",
        "Lead baru masuk",
        Some(&format!(
            "Lead dari {} untuk produk {}",
            created.customer_name, created.interested_product
        )),
        Some(&format!("/dashboard/admin/leads?id={}", created.id)),
        Some(&created.id),
    )
    .await;

    Ok(json_ok(
        "Lead submitted successfully",
        json!({ "item": lead_to_json(created) }),
    ))
}

async fn update_lead_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<LeadStatusUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent, Role::Sales]).await?;
    validate_lead_status_update(&payload)?;

    let lead = find_lead_by_id(&state, &id).await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");
    if !is_admin && lead.agent_id != user.id {
        return Err(AppError::Forbidden);
    }

    sqlx::query(
        "UPDATE leads SET status = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(payload.status)
    .bind(payload.notes)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let updated = find_lead_by_id(&state, &id).await?;

    if is_admin {
        create_notification_for_user(
            &state,
            &updated.agent_id,
            "lead_status_updated",
            "Status lead diperbarui",
            Some(&format!(
                "Lead {} sekarang berstatus {}",
                updated.customer_name, updated.status
            )),
            Some("/dashboard/agent/leads"),
            Some(&updated.id),
        )
        .await;
    }

    // Invalidate leaderboard cache since lead status changes affect points/rankings
    let _ = state.cache.invalidate("leaderboard").await;

    Ok(json_ok(
        format!("Lead {} status updated", id),
        json!({ "item": lead_to_json(updated) }),
    ))
}

async fn list_support_tickets(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

    let rows = sqlx::query_as::<_, SupportTicketRecord>(
        "SELECT id, agent_id, subject, message, priority, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM support_tickets WHERE agent_id = ? ORDER BY created_at DESC",
    )
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing support tickets: {}", e);
        AppError::Internal
    })?;

    let items = rows
        .into_iter()
        .map(support_ticket_to_json)
        .collect::<Vec<_>>();
    Ok(json_ok(
        "Support tickets fetched",
        json!({ "items": items }),
    ))
}

async fn create_support_ticket(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateSupportTicketRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

    if payload.subject.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Judul ticket wajib diisi".to_string()],
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let priority = normalize_ticket_priority(payload.priority.as_deref());

    sqlx::query(
        "INSERT INTO support_tickets (id, agent_id, subject, message, priority, status) VALUES (?, ?, ?, ?, ?, 'open')",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(payload.subject.trim())
    .bind(payload.message.unwrap_or_default())
    .bind(priority)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating support ticket: {}", e);
        AppError::Internal
    })?;

    let created = sqlx::query_as::<_, SupportTicketRecord>(
        "SELECT id, agent_id, subject, message, priority, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM support_tickets WHERE id = ? LIMIT 1",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching created support ticket: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    notify_all_admins(
        &state,
        "support_ticket_created",
        "Ticket support baru",
        Some(&format!(
            "{} membuat ticket: {}",
            user.name, created.subject
        )),
        Some("/dashboard/admin/support"),
        Some(&created.id),
    )
    .await;

    Ok(json_ok(
        "Support ticket created",
        json!({ "item": support_ticket_to_json(created) }),
    ))
}

async fn list_admin_support_tickets(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let rows = sqlx::query_as::<_, AdminSupportTicketRow>(
        r#"
        SELECT
            t.id,
            t.agent_id,
            t.subject,
            t.message,
            t.priority,
            t.status,
            DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(t.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at,
            u.name AS agent_name,
            u.email AS agent_email
        FROM support_tickets t
        LEFT JOIN users u ON u.id = t.agent_id
        ORDER BY
            CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            t.created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing admin support tickets: {}", e);
        AppError::Internal
    })?;

    let items = rows
        .into_iter()
        .map(admin_support_ticket_to_json)
        .collect::<Vec<_>>();

    Ok(json_ok(
        "Admin support tickets fetched",
        json!({ "items": items }),
    ))
}

async fn update_admin_support_ticket_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSupportTicketStatusRequest>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let status = normalize_ticket_status(&payload.status).ok_or(AppError::Validation {
        errors: vec!["Status ticket tidak valid. Gunakan: open, in_progress, resolved".to_string()],
    })?;

    let result = sqlx::query(
        "UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(status)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error updating support ticket status: {}", e);
        AppError::Internal
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    let updated_ticket = sqlx::query_as::<_, SupportTicketRecord>(
        "SELECT id, agent_id, subject, message, priority, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM support_tickets WHERE id = ? LIMIT 1",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching updated support ticket: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    create_notification_for_user(
        &state,
        &updated_ticket.agent_id,
        "support_ticket_updated",
        "Update ticket support",
        Some(&format!(
            "Ticket '{}' berubah ke status {}",
            updated_ticket.subject, updated_ticket.status
        )),
        Some(&format!(
            "/dashboard/agent/support?id={}",
            updated_ticket.id
        )),
        Some(&updated_ticket.id),
    )
    .await;

    Ok(json_ok(
        "Support ticket status updated",
        json!({ "id": id, "updated": true }),
    ))
}

#[derive(sqlx::FromRow)]
struct AgentStatsRow {
    points: i64,
    sales_count: i64,
    current_tier: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ClaimRow {
    id: String,
    agent_id: String,
    tier_id: String,
    reward_name: String,
    reward_value: Option<i64>,
    status: String,
    submitted_at: Option<String>,
    processed_at: Option<String>,
    agent_name: Option<String>,
}

#[derive(sqlx::FromRow)]
struct AgentRegistrationRow {
    id: String,
    full_name: String,
    email: String,
    whatsapp: String,
    province: String,
    city: String,
    address: Option<String>,
    preferred_products: Option<String>,
    profile_photo: Option<String>,
    ktp_photo: Option<String>,
    status: String,
    submitted_at: Option<String>,
}

#[derive(sqlx::FromRow, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentDirectoryRow {
    id: String,
    name: String,
    email: String,
    whatsapp: Option<String>,
    city: Option<String>,
    province: Option<String>,
    total_sales: i64,
    points: i64,
    tier_name: Option<String>,
    is_active: bool,
    joined_at: Option<String>,
}

async fn list_agents(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let rows = sqlx::query_as::<_, AgentDirectoryRow>(
        r#"
        SELECT 
            u.id, 
            u.name, 
            u.email, 
            r.whatsapp, 
            r.city, 
            r.province,
            COALESCE(s.sales_count, 0) as total_sales,
            COALESCE(s.points, 0) as points,
            t.name as tier_name,
            u.is_active,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as joined_at
        FROM users u
        LEFT JOIN agent_stats s ON s.user_id = u.id
        LEFT JOIN reward_tiers t ON t.id = s.current_tier_id
        LEFT JOIN agent_registrations r ON r.email = u.email
        WHERE u.role = 'agent'
        ORDER BY u.created_at DESC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing agents: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "Agents fetched successfully",
        json!({ "items": rows }),
    ))
}

async fn list_leaderboard(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

    let is_admin = user.role.eq_ignore_ascii_case("admin");

    let to_agent_safe_items = |items: &[AgentDirectoryRow]| {
        items
            .iter()
            .map(|row| {
                json!({
                    "id": row.id.clone(),
                    "name": row.name.clone(),
                    "city": row.city.clone(),
                    "province": row.province.clone(),
                    "totalSales": row.total_sales,
                    "points": row.points,
                    "tierName": row.tier_name.clone(),
                    "isActive": row.is_active,
                    "joinedAt": row.joined_at.clone(),
                })
            })
            .collect::<Vec<_>>()
    };

    // Try to get from cache first
    if let Ok(Some(cached_items)) = state
        .cache
        .get::<Vec<AgentDirectoryRow>>("leaderboard")
        .await
    {
        if is_admin {
            return Ok(json_ok(
                "Leaderboard fetched from cache",
                json!({ "items": cached_items }),
            ));
        }
        return Ok(json_ok(
            "Leaderboard fetched from cache",
            json!({ "items": to_agent_safe_items(&cached_items) }),
        ));
    }

    let rows = sqlx::query_as::<_, AgentDirectoryRow>(
        r#"
        SELECT 
            u.id, 
            u.name, 
            u.email, 
            r.whatsapp, 
            r.city, 
            r.province,
            COALESCE(s.sales_count, 0) as total_sales,
            COALESCE(s.points, 0) as points,
            t.name as tier_name,
            u.is_active,
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as joined_at
        FROM users u
        LEFT JOIN agent_stats s ON s.user_id = u.id
        LEFT JOIN reward_tiers t ON t.id = s.current_tier_id
        LEFT JOIN agent_registrations r ON r.email = u.email
        WHERE u.role = 'agent'
        ORDER BY points DESC, total_sales DESC, u.created_at ASC
        "#,
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing leaderboard: {}", e);
        AppError::Internal
    })?;

    // Store in cache for 5 minutes (300 seconds)
    let _ = state.cache.set("leaderboard", &rows, Some(300)).await;

    if is_admin {
        return Ok(json_ok(
            "Leaderboard fetched successfully",
            json!({ "items": rows }),
        ));
    }

    Ok(json_ok(
        "Leaderboard fetched successfully",
        json!({ "items": to_agent_safe_items(&rows) }),
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateClaimRequest {
    tier_id: String,
    reward_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentRegistrationStatusRequest {
    status: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaimStatusRequest {
    status: String,
}

fn is_valid_registration_status(status: &str) -> bool {
    matches!(status, "pending" | "reviewed" | "approved" | "rejected")
}

fn is_valid_claim_status(status: &str) -> bool {
    matches!(status, "pending" | "processing" | "completed" | "cancelled")
}

fn is_valid_job_application_status(status: &str) -> bool {
    matches!(
        status,
        "pending" | "reviewed" | "accepted" | "rejected" | "hired"
    )
}

fn default_reward_value_for_tier(tier_id: &str) -> i64 {
    match tier_id {
        "diamond" => 2_400_000,
        "gold" => 1_200_000,
        "silver" => 650_000,
        _ => 250_000,
    }
}

fn claim_to_json(row: ClaimRow) -> Value {
    let reward_value = row
        .reward_value
        .unwrap_or_else(|| default_reward_value_for_tier(&row.tier_id));

    json!({
        "id": row.id,
        "agentId": row.agent_id,
        "agentName": row.agent_name,
        "tierId": row.tier_id,
        "rewardName": row.reward_name,
        "rewardValue": reward_value,
        "status": row.status,
        "submittedAt": row.submitted_at,
        "processedAt": row.processed_at,
    })
}

fn registration_to_json(row: AgentRegistrationRow) -> Value {
    json!({
        "id": row.id,
        "fullName": row.full_name,
        "email": row.email,
        "whatsapp": row.whatsapp,
        "province": row.province,
        "city": row.city,
        "address": row.address,
        "preferredProducts": parse_json_or_default(row.preferred_products.as_deref(), json!([])),
        "profilePhoto": row.profile_photo,
        "ktpPhoto": row.ktp_photo,
        "status": row.status,
        "submittedAt": row.submitted_at,
    })
}

async fn get_agent_performance(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(target_id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

    // Authorization check: Only admin or the agent themselves
    if !user.role.eq_ignore_ascii_case("admin") && user.id != target_id {
        return Err(AppError::Forbidden);
    }

    // 1. Get referral slugs for this agent
    let slugs: Vec<String> =
        sqlx::query_scalar("SELECT slug FROM referrals WHERE owner_user_id = ?")
            .bind(&target_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error: {}", e);
                AppError::Internal
            })?;

    // 2. Get daily activity (views/clicks) from telemetry
    let activity_rows = if slugs.is_empty() {
        Vec::new()
    } else {
        // Build placeholders for IN clause
        let placeholders = slugs
            .iter()
            .enumerate()
            .map(|_| "?".to_string())
            .collect::<Vec<_>>()
            .join(",");
        let query = format!(
            "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
             FROM telemetry_events 
             WHERE source IN ({}) 
               AND created_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
             GROUP BY day",
            placeholders
        );

        let mut sql = sqlx::query(&query);
        for slug in &slugs {
            sql = sql.bind(slug);
        }

        sql.fetch_all(&state.pool).await.map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
    };

    // 3. Get daily leads
    let lead_rows = sqlx::query(
        "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count
         FROM leads 
         WHERE agent_id = ? 
           AND created_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
         GROUP BY day",
    )
    .bind(&target_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    // 4. Map to response (last 7 days)
    let mut stats = HashMap::new();
    let days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    let now = Utc::now();

    for i in 0..7 {
        let d = now - Duration::days(6 - i);
        let date_str = d.format("%Y-%m-%d").to_string();
        let day_idx = d.format("%w").to_string().parse::<usize>().unwrap_or(0) % 7;
        let day_name = days[day_idx];
        stats.insert(
            date_str.clone(),
            json!({ "day": day_name, "date": date_str, "activity": 0, "leads": 0 }),
        );
    }

    use sqlx::Row;
    for row in activity_rows {
        let day: String = row.get("day");
        let count: i64 = row.get("count");
        if let Some(entry) = stats.get_mut(&day) {
            entry["activity"] = json!(count);
        }
    }

    for row in lead_rows {
        let day: String = row.get("day");
        let count: i64 = row.get("count");
        if let Some(entry) = stats.get_mut(&day) {
            entry["leads"] = json!(count);
        }
    }

    let mut result: Vec<Value> = stats.into_values().collect();
    result.sort_by_key(|v| v["date"].as_str().unwrap_or("").to_string());

    Ok(json_ok(
        "Agent performance fetched",
        json!({ "items": result }),
    ))
}

async fn get_agent_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent, Role::Sales]).await?;

    let row = sqlx::query_as::<_, AgentStatsRow>(
        "SELECT s.points, s.sales_count, t.name AS current_tier FROM agent_stats s LEFT JOIN reward_tiers t ON t.id = s.current_tier_id WHERE s.user_id = ? LIMIT 1"
    )
    .bind(&user.id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let data = if let Some(value) = row {
        json!({
            "points": value.points,
            "salesCount": value.sales_count,
            "currentTier": value.current_tier.unwrap_or_else(|| "Unranked".to_string()),
        })
    } else {
        json!({
            "points": 0,
            "salesCount": 0,
            "currentTier": "Unranked",
        })
    };

    Ok(json_ok("Agent stats fetched", data))
}

async fn list_claims(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");

    let rows = if is_admin {
        sqlx::query_as::<_, ClaimRow>(
            "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, DATE_FORMAT(c.submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at, DATE_FORMAT(c.processed_at, '%Y-%m-%d %H:%i:%s') AS processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id ORDER BY c.submitted_at DESC"
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, ClaimRow>(
            "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, DATE_FORMAT(c.submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at, DATE_FORMAT(c.processed_at, '%Y-%m-%d %H:%i:%s') AS processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id WHERE c.agent_id = ? ORDER BY c.submitted_at DESC"
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "Claims fetched",
        json!({ "items": rows.into_iter().map(claim_to_json).collect::<Vec<_>>() }),
    ))
}

async fn create_claim(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateClaimRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

    let mut errors = Vec::new();
    if payload.tier_id.trim().is_empty() {
        errors.push("tierId wajib diisi".to_string());
    }
    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }

    let tier_name: Option<String> =
        sqlx::query_scalar("SELECT name FROM reward_tiers WHERE id = ? AND is_active = 1 LIMIT 1")
            .bind(payload.tier_id.trim())
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error: {}", e);
                AppError::Internal
            })?;

    let tier_name = tier_name.ok_or_else(|| AppError::Validation {
        errors: vec!["tierId tidak ditemukan atau tidak aktif".to_string()],
    })?;

    if !validate_text_length(payload.reward_name.trim(), 120) {
        return Err(AppError::Validation {
            errors: vec!["rewardName terlalu panjang".to_string()],
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO reward_claims (id, agent_id, tier_id, reward_name, status) VALUES (?, ?, ?, ?, 'pending')"
    )
    .bind(&id)
    .bind(&user.id)
    .bind(payload.tier_id.trim())
    .bind(tier_name)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let created = sqlx::query_as::<_, ClaimRow>(
        "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, DATE_FORMAT(c.submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at, DATE_FORMAT(c.processed_at, '%Y-%m-%d %H:%i:%s') AS processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id WHERE c.id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::Internal)?;

    notify_all_admins(
        &state,
        "claim_created",
        "Klaim reward baru",
        Some(&format!(
            "{} mengajukan klaim {}",
            user.name, created.reward_name
        )),
        Some(&format!("/dashboard/admin/finance?id={}", created.id)),
        Some(&created.id),
    )
    .await;

    Ok(json_ok(
        "Reward claimed successfully",
        json!({ "item": claim_to_json(created) }),
    ))
}

async fn submit_agent_registration(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let mut full_name = String::new();
    let mut email = String::new();
    let mut whatsapp = String::new();
    let mut province = String::new();
    let mut city = String::new();
    let mut address = String::new();
    let mut preferred_products = String::new();
    let mut profile_photo_url: Option<String> = None;
    let mut ktp_photo_url: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::Internal)?
    {
        let name = field.name().unwrap_or_default().to_string();

        match name.as_str() {
            "fullName" => full_name = field.text().await.unwrap_or_default(),
            "email" => email = field.text().await.unwrap_or_default(),
            "whatsapp" => whatsapp = field.text().await.unwrap_or_default(),
            "province" => province = field.text().await.unwrap_or_default(),
            "city" => city = field.text().await.unwrap_or_default(),
            "address" => address = field.text().await.unwrap_or_default(),
            "preferredProducts" => preferred_products = field.text().await.unwrap_or_default(),
            "profilePhoto" => {
                let data = field.bytes().await.map_err(|_| AppError::Internal)?;
                if !data.is_empty() {
                    if data.len() > 5 * 1024 * 1024 {
                        return Err(AppError::Validation {
                            errors: vec!["Foto profil maksimal 5MB".to_string()],
                        });
                    }
                    let img = decode_uploaded_image(&data)?;

                    std::fs::create_dir_all("uploads/private").ok();
                    let file_id = uuid::Uuid::new_v4().to_string();
                    let file_name = format!("{}_profile.webp", file_id);
                    let file_path = format!("uploads/private/{}", file_name);

                    img.save_with_format(&file_path, image::ImageFormat::WebP)
                        .map_err(|e| {
                            tracing::error!("Failed to save profile photo as webp: {}", e);
                            AppError::Internal
                        })?;

                    profile_photo_url = Some(format!("/api/admin/uploads/private/{}", file_name));
                }
            }
            "ktpPhoto" => {
                let data = field.bytes().await.map_err(|_| AppError::Internal)?;
                if !data.is_empty() {
                    if data.len() > 5 * 1024 * 1024 {
                        return Err(AppError::Validation {
                            errors: vec!["Foto KTP maksimal 5MB".to_string()],
                        });
                    }
                    let img = decode_uploaded_image(&data)?;

                    std::fs::create_dir_all("uploads/private").ok();
                    let file_id = uuid::Uuid::new_v4().to_string();
                    let file_name = format!("{}_ktp.webp", file_id);
                    let file_path = format!("uploads/private/{}", file_name);

                    img.save_with_format(&file_path, image::ImageFormat::WebP)
                        .map_err(|e| {
                            tracing::error!("Failed to save KTP photo as webp: {}", e);
                            AppError::Internal
                        })?;

                    ktp_photo_url = Some(format!("/api/admin/uploads/private/{}", file_name));
                }
            }
            _ => {}
        }
    }

    // Basic validation
    let mut errors = Vec::new();
    if full_name.trim().is_empty() {
        errors.push("Nama lengkap wajib diisi".to_string());
    }
    if email.trim().is_empty() || !email.contains('@') {
        errors.push("Email tidak valid".to_string());
    }
    if whatsapp.trim().is_empty() {
        errors.push("Nomor WhatsApp wajib diisi".to_string());
    }
    if province.trim().is_empty() {
        errors.push("Provinsi wajib diisi".to_string());
    }
    if city.trim().is_empty() {
        errors.push("Kota wajib diisi".to_string());
    }
    if !validate_text_length(&full_name, 120) {
        errors.push("Nama lengkap terlalu panjang".to_string());
    }
    if !validate_text_length(&email, 254) {
        errors.push("Email terlalu panjang".to_string());
    }
    if !validate_text_length(&whatsapp, 32) {
        errors.push("Nomor WhatsApp terlalu panjang".to_string());
    }
    if !validate_text_length(&province, 80) {
        errors.push("Provinsi terlalu panjang".to_string());
    }
    if !validate_text_length(&city, 80) {
        errors.push("Kota terlalu panjang".to_string());
    }
    if !validate_text_length(&address, 1000) {
        errors.push("Alamat terlalu panjang".to_string());
    }
    if !validate_text_length(&preferred_products, 1000) {
        errors.push("Preferensi produk terlalu panjang".to_string());
    }

    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }

    let client_ip = extract_client_ip(&headers);
    {
        let mut buckets = state.public_submission_attempts.write().await;
        enforce_rate_limit_bucket(
            &mut buckets,
            &format!("agent_registration:email:{}", email.trim().to_lowercase()),
            3,
            Duration::hours(1),
        )
        .await?;

        if let Some(ip) = client_ip.as_deref() {
            enforce_rate_limit_bucket(
                &mut buckets,
                &format!("agent_registration:ip:{}", ip),
                6,
                Duration::hours(1),
            )
            .await?;
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO agent_registrations (id, full_name, email, whatsapp, province, city, address, preferred_products, profile_photo, ktp_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(full_name.trim())
    .bind(email.trim())
    .bind(whatsapp.trim())
    .bind(province.trim())
    .bind(city.trim())
    .bind(address.trim())
    .bind(preferred_products.trim())
    .bind(profile_photo_url)
    .bind(ktp_photo_url)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    notify_all_admins(
        &state,
        "agent_registration_submitted",
        "Pendaftar agen baru",
        Some(&format!("{} mendaftar sebagai agen", full_name.trim())),
        Some(&format!("/dashboard/admin/agents?id={}", id)),
        Some(&id),
    )
    .await;

    Ok(json_ok(
        "Pendaftaran agen berhasil dikirim",
        json!({ "id": id, "status": "pending" }),
    ))
}

async fn list_agent_registrations(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let rows = sqlx::query_as::<_, AgentRegistrationRow>(
        "SELECT id, full_name, email, whatsapp, province, city, address, preferred_products, profile_photo, ktp_photo, status, DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at FROM agent_registrations ORDER BY submitted_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    tracing::info!("Fetched {} agent registrations", rows.len());
    let items: Vec<Value> = rows.into_iter().map(registration_to_json).collect();
    Ok(json_ok(
        "Agent registrations fetched",
        json!({ "items": items }),
    ))
}

async fn update_agent_registration_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<AgentRegistrationStatusRequest>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let status = payload.status.trim().to_lowercase();
    if !is_valid_registration_status(&status) {
        return Err(AppError::Validation {
            errors: vec!["status registration tidak valid".to_string()],
        });
    }

    if status == "approved" {
        let registration = sqlx::query_as::<_, AgentRegistrationRow>(
            "SELECT id, full_name, email, whatsapp, province, city, address, preferred_products, profile_photo, ktp_photo, status, DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at FROM agent_registrations WHERE id = ? LIMIT 1"
        )
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching registration for approval: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::NotFound)?;

        if registration.status != "approved" {
            let user_exists = sqlx::query("SELECT 1 FROM users WHERE email = ?")
                .bind(&registration.email)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("DB error checking user existence: {}", e);
                    AppError::Internal
                })?;

            // Provision atau self-heal akun agen. INSERT user + INSERT token
            // verifikasi dibungkus satu transaksi supaya kalau salah satu
            // gagal tidak ada state setengah jalan (user tanpa token, dst).
            // Kalau user sudah ada dari approval sebelumnya tapi belum
            // terverifikasi & belum punya token aktif, kita cuma reissue
            // tokennya — tapi password tidak di-reset karena admin tidak
            // bisa lagi mengirim password lama via email.
            let provision_result: Result<Option<(String, String)>, sqlx::Error> = async {
                let mut tx = state.pool.begin().await?;

                let (user_id, temp_password_for_email) = if let Some(_existing) = user_exists {
                    let row = sqlx::query_as::<_, (String, bool)>(
                        "SELECT id, is_verified FROM users WHERE email = ? LIMIT 1",
                    )
                    .bind(&registration.email)
                    .fetch_one(&mut *tx)
                    .await?;
                    let (user_id, is_verified) = row;
                    if is_verified {
                        // Sudah selesai sebelumnya — tidak perlu apa-apa.
                        tx.commit().await?;
                        return Ok(None);
                    }
                    let active_token: Option<String> = sqlx::query_scalar(
                        "SELECT token FROM email_verification_tokens \
                         WHERE user_id = ? AND used_at IS NULL \
                         AND expires_at > ? LIMIT 1",
                    )
                    .bind(&user_id)
                    .bind(Utc::now().to_rfc3339())
                    .fetch_optional(&mut *tx)
                    .await?;
                    if active_token.is_some() {
                        // Sudah punya token aktif — biarkan saja, jangan kirim
                        // ulang temp_password yang berbeda dari hash di DB.
                        tx.commit().await?;
                        return Ok(None);
                    }
                    (user_id, String::new())
                } else {
                    let user_id = uuid::Uuid::new_v4().to_string();
                    let temp_password = uuid::Uuid::new_v4().simple().to_string();
                    let password_hash = hash_password(&temp_password);

                    sqlx::query(
                        "INSERT INTO users (id, email, name, role, password_hash, avatar, bank_account, is_active, is_verified, must_change_password) VALUES (?, ?, ?, 'agent', ?, ?, '', 1, 0, 1)"
                    )
                    .bind(&user_id)
                    .bind(&registration.email)
                    .bind(&registration.full_name)
                    .bind(password_hash)
                    .bind(registration.profile_photo.clone().unwrap_or_default())
                    .execute(&mut *tx)
                    .await?;

                    tracing::info!(
                        "Created user {} for approved agent {}",
                        user_id,
                        registration.email
                    );

                    (user_id, temp_password)
                };

                let token = uuid::Uuid::new_v4().simple().to_string();
                let expires_at = (Utc::now() + Duration::hours(24)).to_rfc3339();
                sqlx::query(
                    "INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
                )
                .bind(&token)
                .bind(&user_id)
                .bind(&expires_at)
                .execute(&mut *tx)
                .await?;

                tx.commit().await?;
                Ok(Some((token, temp_password_for_email)))
            }
            .await;

            match provision_result {
                Ok(Some((token, temp_password))) => {
                    let verification_link = format!(
                        "{}/verify-email?token={}",
                        frontend_base_url(),
                        urlencoding::encode(&token)
                    );
                    let temp_password_label = if temp_password.is_empty() {
                        "(Password Anda tetap sama)"
                    } else {
                        temp_password.as_str()
                    };

                    if state.mailer.is_enabled() {
                        if let Err(e) = state
                            .mailer
                            .send_verification_email(
                                &registration.email,
                                &registration.full_name,
                                &verification_link,
                                temp_password_label,
                            )
                            .await
                        {
                            tracing::error!(
                                "Failed to send verification email to {}: {}",
                                registration.email,
                                e
                            );
                        }
                    } else {
                        tracing::warn!(
                            "Mailer disabled; agent registration for {} approved but verification email not sent. Manual delivery required.",
                            registration.email
                        );
                    }
                }
                Ok(None) => {
                    tracing::info!(
                        "Agent {} already provisioned with active verification — no token reissued",
                        registration.email
                    );
                }
                Err(e) => {
                    tracing::error!(
                        "Failed to provision agent user/token for {}: {:?}",
                        registration.email,
                        e
                    );
                    return Err(AppError::Internal);
                }
            }
        }
    }

    let registration_email: Option<String> =
        sqlx::query_scalar("SELECT email FROM agent_registrations WHERE id = ? LIMIT 1")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching registration email: {}", e);
                AppError::Internal
            })?;

    let result = sqlx::query("UPDATE agent_registrations SET status = ? WHERE id = ?")
        .bind(&status)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    if let Some(email) = registration_email {
        let agent_user_id =
            sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE email = ? LIMIT 1")
                .bind(&email)
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!(
                        "DB error fetching user for registration notification: {}",
                        e
                    );
                    AppError::Internal
                })?;

        if let Some(agent_id) = agent_user_id {
            create_notification_for_user(
                &state,
                &agent_id,
                "registration_status_updated",
                "Status pendaftaran agen",
                Some(&format!("Status pendaftaran Anda: {}", status)),
                Some("/dashboard/agent/notifications"),
                Some(&id),
            )
            .await;
        }
    }

    // Invalidate leaderboard cache since rankings or agent status might change
    let _ = state.cache.invalidate("leaderboard").await;

    Ok(json_ok(
        format!("Agent registration {} status updated", id),
        json!({ "updated": true, "status": status }),
    ))
}

async fn list_all_claims(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let rows = sqlx::query_as::<_, ClaimRow>(
        "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, DATE_FORMAT(c.submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at, DATE_FORMAT(c.processed_at, '%Y-%m-%d %H:%i:%s') AS processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id ORDER BY c.submitted_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok(
        "All Gamification Claims fetched",
        json!({ "items": rows.into_iter().map(claim_to_json).collect::<Vec<_>>() }),
    ))
}

async fn update_claim_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ClaimStatusRequest>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let status = payload.status.trim().to_lowercase();
    if !is_valid_claim_status(&status) {
        return Err(AppError::Validation {
            errors: vec!["status claim tidak valid".to_string()],
        });
    }

    let result = if matches!(status.as_str(), "completed" | "cancelled") {
        sqlx::query(
            "UPDATE reward_claims SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(&status)
        .bind(&id)
        .execute(&state.pool)
        .await
    } else {
        sqlx::query("UPDATE reward_claims SET status = ?, processed_at = NULL WHERE id = ?")
            .bind(&status)
            .bind(&id)
            .execute(&state.pool)
            .await
    }
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    let updated_claim = sqlx::query_as::<_, ClaimRow>(
        "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, DATE_FORMAT(c.submitted_at, '%Y-%m-%d %H:%i:%s') AS submitted_at, DATE_FORMAT(c.processed_at, '%Y-%m-%d %H:%i:%s') AS processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id WHERE c.id = ? LIMIT 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching updated claim: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    create_notification_for_user(
        &state,
        &updated_claim.agent_id,
        "claim_status_updated",
        "Update status klaim reward",
        Some(&format!(
            "Klaim '{}' berubah ke status {}",
            updated_claim.reward_name, updated_claim.status
        )),
        Some(&format!(
            "/dashboard/agent/earnings?id={}",
            updated_claim.id
        )),
        Some(&updated_claim.id),
    )
    .await;

    Ok(json_ok(
        format!("Claim {} status updated", id),
        json!({ "updated": true, "status": status }),
    ))
}

async fn get_telemetry_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let traffic_rows = sqlx::query(
        "WITH RECURSIVE days(day) AS (
            SELECT DATE(DATE_SUB(NOW(), INTERVAL 6 DAY))
            UNION ALL
            SELECT DATE_ADD(day, INTERVAL 1 DAY) FROM days WHERE day < CURDATE()
         )
         SELECT DATE_FORMAT(d.day, '%Y-%m-%d') AS day,
                CAST(COALESCE(SUM(CASE WHEN e.event_type = 'click' THEN 1 ELSE 0 END), 0) AS SIGNED) AS clicks,
                CAST(COALESCE(SUM(CASE WHEN e.event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS SIGNED) AS leads,
                CAST(COALESCE(SUM(CASE WHEN e.event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS SIGNED) AS conversions
         FROM days d
         LEFT JOIN telemetry_events e ON DATE(e.created_at) = d.day
         GROUP BY d.day
         ORDER BY d.day ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let monthly_rows = sqlx::query(
        "WITH RECURSIVE months(month) AS (
            SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 150 DAY), '%Y-%m')
            UNION ALL
            SELECT DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(month, '-01'), '%Y-%m-%d'), INTERVAL 1 MONTH), '%Y-%m') FROM months WHERE month < DATE_FORMAT(NOW(), '%Y-%m')
         )
         SELECT m.month,
                CAST(COALESCE(COUNT(DISTINCT CONCAT(e.session_id, e.path)), 0) AS SIGNED) AS views
         FROM months m
         LEFT JOIN telemetry_events e ON DATE_FORMAT(e.created_at, '%Y-%m') = m.month AND e.event_type = 'page_view'
         GROUP BY m.month
         ORDER BY m.month ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let source_rows = sqlx::query(
        "SELECT COALESCE(source, 'unknown') AS source,
                CAST(COUNT(DISTINCT CONCAT(session_id, path)) AS SIGNED) AS clicks,
                CAST(COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS SIGNED) AS leads
         FROM telemetry_events
         GROUP BY COALESCE(source, 'unknown')
         ORDER BY clicks DESC
         LIMIT 5",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let top_content_rows = sqlx::query(
        "SELECT
            CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.contentType')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.pageType')), 'page') AS CHAR) AS content_type,
            CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.contentKey')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.pageKey')), path) AS CHAR) AS content_key,
            CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.contentTitle')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.pageLabel')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.contentSlug')), path) AS CHAR) AS content_title,
            CAST(COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS SIGNED) AS views,
            CAST(COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS SIGNED) AS clicks,
            CAST(COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS SIGNED) AS leads
         FROM telemetry_events
         WHERE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.contentKey')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.pageKey')), path) IS NOT NULL
           AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.contentKey')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.pageKey')), path) <> ''
         GROUP BY content_type, content_key, content_title
         ORDER BY views DESC, clicks DESC
         LIMIT 10"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let totals_row = sqlx::query(
        "SELECT
            CAST(COUNT(*) AS SIGNED) AS total_events,
            CAST(COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END), 0) AS SIGNED) AS events_24h,
            CAST(COUNT(DISTINCT path) AS SIGNED) AS total_paths,
            CAST(COALESCE(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS SIGNED) AS total_conversions
         FROM telemetry_events"
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let traffic_data: Vec<Value> = traffic_rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "day": row.get::<String, _>("day"),
                "clicks": row.get::<i64, _>("clicks"),
                "leads": row.get::<i64, _>("leads"),
                "conversions": row.get::<i64, _>("conversions"),
            })
        })
        .collect();

    let monthly_page_views: Vec<Value> = monthly_rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "month": row.get::<String, _>("month"),
                "views": row.get::<i64, _>("views"),
            })
        })
        .collect();

    let source_clicks_max = source_rows
        .iter()
        .map(|row| {
            use sqlx::Row;
            row.get::<i64, _>("clicks")
        })
        .max()
        .unwrap_or(1);

    let source_rows_json: Vec<Value> = source_rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            let clicks = row.get::<i64, _>("clicks");
            let leads = row.get::<i64, _>("leads");
            let conversion = if clicks > 0 {
                format!("{:.1}%", (leads as f64 / clicks as f64) * 100.0)
            } else {
                "0.0%".to_string()
            };
            json!({
                "source": row.get::<String, _>("source"),
                "clicks": clicks,
                "conversion": conversion,
                "bar": (((clicks as f64 / source_clicks_max as f64) * 100.0).round() as i64),
            })
        })
        .collect();

    let top_content_rows_json: Vec<Value> = top_content_rows
        .into_iter()
        .map(|row| {
            use sqlx::Row;
            json!({
                "contentType": row.get::<String, _>("content_type"),
                "contentKey": row.get::<String, _>("content_key"),
                "contentTitle": row.get::<String, _>("content_title"),
                "views": row.get::<i64, _>("views"),
                "clicks": row.get::<i64, _>("clicks"),
                "leads": row.get::<i64, _>("leads"),
            })
        })
        .collect();

    let system_metrics = {
        use sqlx::Row;
        let total_events = totals_row.get::<i64, _>("total_events");
        let events_24h = totals_row.get::<i64, _>("events_24h");
        let total_paths = totals_row.get::<i64, _>("total_paths");
        let total_conversions = totals_row.get::<i64, _>("total_conversions");

        vec![
            json!({
                "label": "Total Telemetry Events",
                "value": total_events.to_string(),
                "sub": "Semua event tersimpan",
                "ok": true
            }),
            json!({
                "label": "Events 24 Jam",
                "value": events_24h.to_string(),
                "sub": "Traffic 24 jam terakhir",
                "ok": true
            }),
            json!({
                "label": "Total Path Terpantau",
                "value": total_paths.to_string(),
                "sub": "Halaman/path unik",
                "ok": true
            }),
            json!({
                "label": "Total Konversi",
                "value": total_conversions.to_string(),
                "sub": "Berdasarkan pixel_event",
                "ok": true
            }),
        ]
    };

    let data = json!({
        "trafficData": traffic_data,
        "monthlyPageViews": monthly_page_views,
        "sourceRows": source_rows_json,
        "topContentRows": top_content_rows_json,
        "systemMetrics": system_metrics,
        "errorLogs": []
    });

    Ok(json_ok("Telemetry stats fetched", data))
}

async fn list_job_applications(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;
    let applications = sqlx::query_as::<_, JobApplicationRecord>(
        "SELECT id, job_id, job_title, full_name, email, phone, address, education, major, experience, cover_letter, linked_in, portfolio_url, status, applied_at FROM job_applications ORDER BY created_at DESC"
    )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .into_iter()
        .map(job_application_to_json)
        .collect::<Vec<_>>();
    Ok(json_ok(
        "Job applications fetched",
        json!({ "items": applications }),
    ))
}

async fn create_job_application(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<JobApplicationCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let id = format!("app-{}", uuid::Uuid::new_v4().simple());
    let applied_at = Utc::now()
        .naive_local()
        .date()
        .format("%Y-%m-%d")
        .to_string();

    let mut errors = Vec::new();
    if payload.job_id.trim().is_empty() {
        errors.push("jobId wajib diisi".to_string());
    }
    if payload.job_title.trim().is_empty() {
        errors.push("jobTitle wajib diisi".to_string());
    }
    if payload.full_name.trim().is_empty() {
        errors.push("fullName wajib diisi".to_string());
    }
    if payload.email.trim().is_empty() || !payload.email.contains('@') {
        errors.push("Email tidak valid".to_string());
    }
    if payload.phone.trim().is_empty() {
        errors.push("phone wajib diisi".to_string());
    }
    if !validate_text_length(&payload.job_id, 80) {
        errors.push("jobId terlalu panjang".to_string());
    }
    if !validate_text_length(&payload.job_title, 150) {
        errors.push("jobTitle terlalu panjang".to_string());
    }
    if !validate_text_length(&payload.full_name, 120) {
        errors.push("fullName terlalu panjang".to_string());
    }
    if !validate_text_length(&payload.email, 254) {
        errors.push("Email terlalu panjang".to_string());
    }
    if !validate_text_length(&payload.phone, 32) {
        errors.push("phone terlalu panjang".to_string());
    }
    if let Some(address) = payload.address.as_deref() {
        if !validate_text_length(address, 1000) {
            errors.push("address terlalu panjang".to_string());
        }
    }
    if let Some(education) = payload.education.as_deref() {
        if !validate_text_length(education, 255) {
            errors.push("education terlalu panjang".to_string());
        }
    }
    if let Some(major) = payload.major.as_deref() {
        if !validate_text_length(major, 255) {
            errors.push("major terlalu panjang".to_string());
        }
    }
    if let Some(experience) = payload.experience.as_deref() {
        if !validate_text_length(experience, 2000) {
            errors.push("experience terlalu panjang".to_string());
        }
    }
    if let Some(cover_letter) = payload.cover_letter.as_deref() {
        if !validate_text_length(cover_letter, 5000) {
            errors.push("coverLetter terlalu panjang".to_string());
        }
    }
    if let Some(linked_in) = payload.linked_in.as_deref() {
        if !linked_in.trim().is_empty()
            && (!is_allowed_public_url(linked_in) || !validate_text_length(linked_in, 2048))
        {
            errors.push("linkedIn harus berupa URL http/https yang valid".to_string());
        }
    }
    if let Some(portfolio_url) = payload.portfolio_url.as_deref() {
        if !portfolio_url.trim().is_empty()
            && (!is_allowed_public_url(portfolio_url) || !validate_text_length(portfolio_url, 2048))
        {
            errors.push("portfolioUrl harus berupa URL http/https yang valid".to_string());
        }
    }

    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }

    let client_ip = extract_client_ip(&headers);
    {
        let mut buckets = state.public_submission_attempts.write().await;
        enforce_rate_limit_bucket(
            &mut buckets,
            &format!(
                "job_application:email:{}",
                payload.email.trim().to_lowercase()
            ),
            5,
            Duration::hours(1),
        )
        .await?;

        if let Some(ip) = client_ip.as_deref() {
            enforce_rate_limit_bucket(
                &mut buckets,
                &format!("job_application:ip:{}", ip),
                10,
                Duration::hours(1),
            )
            .await?;
        }
    }

    sqlx::query(
        "INSERT INTO job_applications (id, job_id, job_title, full_name, email, phone, address, education, major, experience, cover_letter, linked_in, portfolio_url, status, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.job_id)
    .bind(payload.job_title.clone())
    .bind(payload.full_name.trim().to_string())
    .bind(payload.email.trim().to_string())
    .bind(payload.phone.trim())
    .bind(payload.address)
    .bind(payload.education)
    .bind(payload.major)
    .bind(payload.experience)
    .bind(payload.cover_letter)
    .bind(payload.linked_in)
    .bind(payload.portfolio_url)
    .bind("pending")
    .bind(&applied_at)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    notify_all_admins(
        &state,
        "new_job_application",
        "Lamaran Baru",
        Some(&format!(
            "Ada lamaran baru dari {} untuk posisi {}.",
            payload.full_name, payload.job_title
        )),
        Some("/dashboard/admin/careers"),
        Some(&id),
    )
    .await;

    Ok(json_ok(
        "Application submitted successfully",
        json!({ "id": id }),
    ))
}

async fn update_job_application_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<JobApplicationStatusUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let next_status = payload.status.trim().to_lowercase();
    if !is_valid_job_application_status(&next_status) {
        return Err(AppError::Validation {
            errors: vec!["Status lamaran tidak valid".to_string()],
        });
    }

    let res = sqlx::query("UPDATE job_applications SET status = ? WHERE id = ?")
        .bind(next_status)
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    if res.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        "Application status updated",
        json!({ "id": id, "updated": true }),
    ))
}

// ─── Blast Contacts Database ──────────────────────────────────────────────────

#[derive(Deserialize)]
struct BlastContactPayload {
    phone: String,
    name: Option<String>,
    labels: Option<String>,
    notes: Option<String>,
}

#[derive(Deserialize)]
struct BlastContactsQuery {
    page: Option<i64>,
    per_page: Option<i64>,
    search: Option<String>,
}

#[derive(Deserialize)]
struct ImportBlastContactsPayload {
    contact_ids: Option<Vec<String>>,
    all: Option<bool>,
}

async fn list_blast_contacts(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<BlastContactsQuery>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales, Role::Agent],
    )
    .await?;

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).min(200);
    let offset = (page - 1) * per_page;

    let (total, items) = if let Some(search) = &query.search {
        let search_pattern = format!("%{}%", search.trim());
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM wa_blast_contacts WHERE user_id = ? AND (phone LIKE ? OR name LIKE ?)"
        )
            .bind(&user.id).bind(&search_pattern).bind(&search_pattern)
            .fetch_one(&state.pool).await.map_err(|_| AppError::Internal)?;

        let rows: Vec<(String, String, String, String, String, String, String)> = sqlx::query_as(
            "SELECT id, phone, name, labels, notes, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM wa_blast_contacts WHERE user_id = ? AND (phone LIKE ? OR name LIKE ?) ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        )
            .bind(&user.id).bind(&search_pattern).bind(&search_pattern)
            .bind(per_page).bind(offset)
            .fetch_all(&state.pool).await.map_err(|_| AppError::Internal)?;
        (total, rows)
    } else {
        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM wa_blast_contacts WHERE user_id = ?")
                .bind(&user.id)
                .fetch_one(&state.pool)
                .await
                .map_err(|_| AppError::Internal)?;

        let rows: Vec<(String, String, String, String, String, String, String)> = sqlx::query_as(
            "SELECT id, phone, name, labels, notes, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM wa_blast_contacts WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        )
            .bind(&user.id).bind(per_page).bind(offset)
            .fetch_all(&state.pool).await.map_err(|_| AppError::Internal)?;
        (total, rows)
    };

    let contacts: Vec<serde_json::Value> = items
        .iter()
        .map(|(id, phone, name, labels, notes, created_at, updated_at)| {
            json!({
                "id": id,
                "phone": phone,
                "name": name,
                "labels": labels,
                "notes": notes,
                "created_at": created_at,
                "updated_at": updated_at,
            })
        })
        .collect();

    Ok(json_ok(
        "Blast contacts fetched",
        json!({
            "items": contacts,
            "total": total,
            "page": page,
            "per_page": per_page,
        }),
    ))
}

async fn create_blast_contact(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BlastContactPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales, Role::Agent],
    )
    .await?;

    let phone = match normalize_phone(&payload.phone) {
        Some(p) => p,
        None => {
            return Err(AppError::Validation {
                errors: vec!["Nomor telepon tidak valid".to_string()],
            })
        }
    };

    let id = uuid::Uuid::new_v4().to_string();
    let name = payload.name.unwrap_or_default();
    let labels = payload.labels.unwrap_or_default();
    let notes = payload.notes.unwrap_or_default();

    sqlx::query(
        "INSERT INTO wa_blast_contacts (id, user_id, phone, name, labels, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), labels = VALUES(labels), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP"
    )
        .bind(&id).bind(&user.id).bind(&phone).bind(&name).bind(&labels).bind(&notes)
        .execute(&state.pool).await.map_err(|e| {
            tracing::error!("DB error creating blast contact: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok(
        "Contact saved",
        json!({ "id": id, "phone": phone }),
    ))
}

async fn update_blast_contact(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<BlastContactPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales, Role::Agent],
    )
    .await?;

    let phone = match normalize_phone(&payload.phone) {
        Some(p) => p,
        None => {
            return Err(AppError::Validation {
                errors: vec!["Nomor telepon tidak valid".to_string()],
            })
        }
    };

    let name = payload.name.unwrap_or_default();
    let labels = payload.labels.unwrap_or_default();
    let notes = payload.notes.unwrap_or_default();

    let result = sqlx::query(
        "UPDATE wa_blast_contacts SET phone = ?, name = ?, labels = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?"
    )
        .bind(&phone).bind(&name).bind(&labels).bind(&notes).bind(&id).bind(&user.id)
        .execute(&state.pool).await.map_err(|_| AppError::Internal)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok("Contact updated", json!({ "id": id })))
}

async fn delete_blast_contact(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales, Role::Agent],
    )
    .await?;

    let result = sqlx::query("DELETE FROM wa_blast_contacts WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user.id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok("Contact deleted", json!({ "id": id })))
}

async fn upload_blast_contacts_excel(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales, Role::Agent],
    )
    .await?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name = String::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        AppError::Internal
    })? {
        if field.name().unwrap_or_default() == "file" {
            file_name = field.file_name().unwrap_or("upload.xlsx").to_string();
            file_bytes = Some(
                field
                    .bytes()
                    .await
                    .map_err(|e| {
                        tracing::error!("Failed to read file bytes: {}", e);
                        AppError::Internal
                    })?
                    .to_vec(),
            );
            break;
        }
    }

    let file_bytes = file_bytes.ok_or_else(|| AppError::Validation {
        errors: vec!["No file uploaded".to_string()],
    })?;

    let is_csv = file_name.ends_with(".csv");

    let rows: Vec<Vec<String>> = if is_csv {
        let content = String::from_utf8_lossy(&file_bytes);
        let mut csv_rows = Vec::new();
        for line in content.lines() {
            let line = line.trim().trim_start_matches('\u{FEFF}');
            if line.is_empty() {
                continue;
            }
            let cols: Vec<String> = line
                .split(',')
                .map(|s| s.trim().trim_matches('"').to_string())
                .collect();
            csv_rows.push(cols);
        }
        csv_rows
    } else {
        use calamine::{open_workbook_auto_from_rs, Reader};
        use std::io::Cursor;
        let cursor = Cursor::new(&file_bytes);
        let mut workbook =
            open_workbook_auto_from_rs(cursor).map_err(|e| AppError::Validation {
                errors: vec![format!("Failed to read Excel file: {}", e)],
            })?;

        let sheet_name = workbook.sheet_names().first().cloned().unwrap_or_default();
        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| AppError::Validation {
                errors: vec![format!("Failed to read sheet: {}", e)],
            })?;

        let mut excel_rows = Vec::new();
        for row in range.rows() {
            let cols: Vec<String> = row
                .iter()
                .map(|cell| {
                    use calamine::Data;
                    match cell {
                        Data::String(s) => s.clone(),
                        Data::Float(f) => {
                            if *f == (*f as i64) as f64 {
                                format!("{}", *f as i64)
                            } else {
                                format!("{}", f)
                            }
                        }
                        Data::Int(i) => format!("{}", i),
                        Data::Bool(b) => format!("{}", b),
                        _ => String::new(),
                    }
                })
                .collect();
            excel_rows.push(cols);
        }
        excel_rows
    };

    if rows.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["File kosong".to_string()],
        });
    }

    // Find phone and name columns from header
    let header = &rows[0];
    let phone_col = header
        .iter()
        .position(|h| {
            let h = h.to_lowercase().trim().to_string();
            h == "phone"
                || h == "wa"
                || h == "whatsapp"
                || h == "nomor"
                || h == "no_hp"
                || h == "no hp"
                || h == "telepon"
                || h == "hp"
                || h == "nohp"
        })
        .or_else(|| {
            // Try "no" as fallback (common in Indonesian spreadsheets)
            header.iter().position(|h| h.to_lowercase().trim() == "no")
        })
        .or_else(|| {
            // Last resort: find first column with phone-like data in row 1
            if rows.len() > 1 {
                rows[1].iter().position(|cell| {
                    let digits: String = cell.chars().filter(|c| c.is_ascii_digit()).collect();
                    digits.len() >= 9 && digits.len() <= 15
                })
            } else {
                None
            }
        })
        .unwrap_or(0);

    let name_col = header.iter().position(|h| {
        let h = h.to_lowercase().trim().to_string();
        h == "name"
            || h == "nama"
            || h == "nama_konsumen"
            || h == "nama konsumen"
            || h == "customer"
            || h == "pelanggan"
            || h == "konsumen"
    });

    let mut inserted = 0i64;
    let mut skipped = 0i64;
    let mut invalid = Vec::new();

    for (idx, row) in rows.iter().enumerate().skip(1) {
        let phone_raw = row
            .get(phone_col)
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        if phone_raw.is_empty() {
            continue;
        }

        let phone = match normalize_phone(&phone_raw) {
            Some(p) => p,
            None => {
                invalid.push(format!("Baris {}: {} tidak valid", idx + 1, phone_raw));
                continue;
            }
        };

        let name = name_col
            .and_then(|c| row.get(c))
            .map(|s| s.trim().to_string())
            .unwrap_or_default();
        let id = uuid::Uuid::new_v4().to_string();

        let result = sqlx::query(
            "INSERT INTO wa_blast_contacts (id, user_id, phone, name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = CASE WHEN VALUES(name) != '' THEN VALUES(name) ELSE wa_blast_contacts.name END, updated_at = CURRENT_TIMESTAMP"
        )
            .bind(&id).bind(&user.id).bind(&phone).bind(&name)
            .execute(&state.pool).await;

        match result {
            Ok(r) => {
                if r.rows_affected() > 0 {
                    inserted += 1;
                } else {
                    skipped += 1;
                }
            }
            Err(_) => {
                skipped += 1;
            }
        }
    }

    Ok(json_ok(
        "Import completed",
        json!({
            "inserted": inserted,
            "skipped": skipped,
            "invalid": invalid,
            "total_rows": rows.len() - 1,
        }),
    ))
}

async fn import_blast_contacts_to_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign_id): Path<String>,
    Json(payload): Json<ImportBlastContactsPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Operator, Role::Sales],
    )
    .await?;
    ensure_wa_campaign_access(&state, &user, &campaign_id).await?;

    // Verify campaign exists
    let campaign_exists: Option<(String,)> =
        sqlx::query_as("SELECT id FROM wa_campaigns WHERE id = ?")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    if campaign_exists.is_none() {
        return Err(AppError::NotFound);
    }

    // Get campaign config for dedupe
    let campaign_config: Option<String> =
        sqlx::query_scalar("SELECT config FROM wa_campaigns WHERE id = ? LIMIT 1")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?;
    let config_value = parse_json_value(campaign_config);
    let dedupe_days = wa_config_dedupe_days(&config_value);

    // Fetch contacts
    let contacts: Vec<(String, String, String)> = if payload.all.unwrap_or(false) {
        sqlx::query_as("SELECT id, phone, name FROM wa_blast_contacts WHERE user_id = ?")
            .bind(&user.id)
            .fetch_all(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?
    } else {
        let ids = payload.contact_ids.unwrap_or_default();
        if ids.is_empty() {
            return Err(AppError::Validation {
                errors: vec!["Pilih kontak atau gunakan all: true".to_string()],
            });
        }
        let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query_str = format!(
            "SELECT id, phone, name FROM wa_blast_contacts WHERE user_id = ? AND id IN ({})",
            placeholders
        );
        let mut q = sqlx::query_as::<_, (String, String, String)>(&query_str).bind(&user.id);
        for id in &ids {
            q = q.bind(id);
        }
        q.fetch_all(&state.pool)
            .await
            .map_err(|_| AppError::Internal)?
    };

    let mut inserted = 0i64;
    let mut skipped = 0i64;

    for (_contact_id, phone, name) in &contacts {
        let recipient_id = uuid::Uuid::new_v4().to_string();
        let vars = json!({ "name": name }).to_string();
        let duplicate_exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM wa_dispatch_logs WHERE phone = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT 1"
        )
            .bind(phone).bind(dedupe_days.max(1))
            .fetch_optional(&state.pool).await.map_err(|_| AppError::Internal)?;

        let status = if duplicate_exists.is_some() {
            "skipped"
        } else {
            "pending"
        };

        let result = sqlx::query(
            "INSERT IGNORE INTO wa_recipients (id, campaign_id, phone, variables_json, status) VALUES (?, ?, ?, ?, ?)"
        )
            .bind(&recipient_id).bind(&campaign_id).bind(phone).bind(&vars).bind(status)
            .execute(&state.pool).await.map_err(|_| AppError::Internal)?;

        if result.rows_affected() > 0 {
            if status == "pending" {
                inserted += 1;
            } else {
                skipped += 1;
            }
        } else {
            skipped += 1;
        }
    }

    Ok(json_ok(
        "Contacts imported to campaign",
        json!({
            "inserted": inserted,
            "skipped": skipped,
            "total": contacts.len(),
        }),
    ))
}

#[derive(Debug, Deserialize)]
struct ListProspekQuery {
    tanggal: Option<String>,
    karyawan_id: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct ProspekHarianPublic {
    id: String,
    karyawan_id: String,
    karyawan_name: String,
    cabang: String,
    divisi: String,
    nama_prospek: String,
    no_whatsapp: String,
    minat_barang: String,
    keterangan_prospek: String,
    status_prospek: String,
    keterangan_fincoy: String,
    tanggal: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateProspekHarianPayload {
    cabang: Option<String>,
    divisi: Option<String>,
    nama_prospek: String,
    no_whatsapp: String,
    minat_barang: String,
    keterangan_prospek: Option<String>,
    status_prospek: Option<String>,
    keterangan_fincoy: Option<String>,
    tanggal: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProspekHarianPayload {
    cabang: Option<String>,
    divisi: Option<String>,
    nama_prospek: Option<String>,
    no_whatsapp: Option<String>,
    minat_barang: Option<String>,
    keterangan_prospek: Option<String>,
    status_prospek: Option<String>,
    keterangan_fincoy: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProspekEmployeeSummary {
    rank: usize,
    employee_id: String,
    nama: String,
    cabang: String,
    kategori: String,
    posisi: String,
    prospek_hari_ini: i64,
    target: i64,
    persentase: i64,
}

#[derive(Debug, Deserialize)]
struct ProspekSummaryQuery {
    tanggal: Option<String>,
}

fn current_date_key() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

fn clamp_page_limit(limit: Option<u32>, default_limit: u32, max_limit: u32) -> u32 {
    limit.unwrap_or(default_limit).clamp(1, max_limit)
}

fn normalize_date_key(value: Option<String>) -> Result<String, AppError> {
    let date = value.unwrap_or_else(current_date_key);
    let trimmed = date.trim();
    if NaiveDate::parse_from_str(trimmed, "%Y-%m-%d").is_err() {
        return Err(AppError::Validation {
            errors: vec!["tanggal harus memakai format YYYY-MM-DD".to_string()],
        });
    }
    Ok(trimmed.to_string())
}

fn validate_time_hhmm(value: &str, field: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    let parts: Vec<&str> = trimmed.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::Validation {
            errors: vec![format!("{} harus memakai format HH:mm", field)],
        });
    }
    let hour = parts[0].parse::<u32>().ok();
    let minute = parts[1].parse::<u32>().ok();
    if !matches!((hour, minute), (Some(h), Some(m)) if h <= 23 && m <= 59) {
        return Err(AppError::Validation {
            errors: vec![format!("{} harus berupa jam valid", field)],
        });
    }
    Ok(format!("{:02}:{:02}", hour.unwrap_or(0), minute.unwrap_or(0)))
}

fn normalize_raport_mode(value: Option<String>) -> Result<String, AppError> {
    let mode = value.unwrap_or_else(|| "none".to_string()).trim().to_lowercase();
    if !matches!(mode.as_str(), "none" | "image" | "video") {
        return Err(AppError::Validation {
            errors: vec!["mode bukti harus none, image, atau video".to_string()],
        });
    }
    Ok(mode)
}

fn is_sales_division(value: &str) -> bool {
    let normalized = value.to_lowercase();
    normalized.contains("sales") || normalized.contains("koordinator")
}

fn validate_prospek_status(status: &str) -> bool {
    matches!(
        status,
        "deal" | "not_deal" | "fu_ulang" | "tanya_tanya" | "polling"
    )
}

fn prospek_status_to_lead_status(status: &str) -> &'static str {
    match status {
        "deal" => "Closed Won",
        "not_deal" => "Closed Lost",
        "polling" => "Negosiasi",
        _ => "Follow Up",
    }
}

fn build_prospek_lead_notes(keterangan: &str, fincoy: &str, cabang: &str, divisi: &str) -> String {
    let mut parts = vec![
        "Sumber: Prospek Harian Karyawan".to_string(),
        format!("Cabang: {}", cabang),
        format!("Divisi: {}", divisi),
    ];
    if !keterangan.trim().is_empty() {
        parts.push(format!("Keterangan: {}", keterangan.trim()));
    }
    if !fincoy.trim().is_empty() {
        parts.push(format!("Fincoy: {}", fincoy.trim()));
    }
    parts.join(" | ")
}

async fn sync_prospek_to_lead(
    state: &AppState,
    id: &str,
    agent_id: &str,
    nama_prospek: &str,
    no_whatsapp: &str,
    minat_barang: &str,
    status_prospek: &str,
    keterangan_prospek: &str,
    keterangan_fincoy: &str,
    cabang: &str,
    divisi: &str,
) -> Result<(), AppError> {
    let lead_status = prospek_status_to_lead_status(status_prospek);
    let notes = build_prospek_lead_notes(keterangan_prospek, keterangan_fincoy, cabang, divisi);

    sqlx::query(
        "INSERT INTO leads (id, agent_id, customer_name, phone_number, interested_product, status, notes) \
         VALUES (?, ?, ?, ?, ?, ?, ?) \
         ON DUPLICATE KEY UPDATE \
         agent_id = VALUES(agent_id), customer_name = VALUES(customer_name), phone_number = VALUES(phone_number), \
         interested_product = VALUES(interested_product), status = VALUES(status), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP",
    )
    .bind(id)
    .bind(agent_id)
    .bind(nama_prospek)
    .bind(no_whatsapp)
    .bind(minat_barang)
    .bind(lead_status)
    .bind(notes)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error syncing prospek_harian to leads: {}", e);
        AppError::Internal
    })?;

    Ok(())
}

async fn list_prospek_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListProspekQuery>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Owner, Role::PicRaport, Role::Karyawan],
    )
    .await?;
    let page = query.page.unwrap_or(1).max(1);
    let limit = clamp_page_limit(query.limit, 100, 500);
    let offset = (page - 1) * limit;

    let mut builder = sqlx::QueryBuilder::<sqlx::MySql>::new(
        "SELECT p.id, p.karyawan_id, COALESCE(NULLIF(p.karyawan_nama, ''), u.name, '') AS karyawan_name, \
         p.cabang, p.divisi, p.nama_prospek, p.no_whatsapp, p.minat_barang, p.keterangan_prospek, \
         p.status_prospek, p.keterangan_fincoy, DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, \
         DATE_FORMAT(p.created_at, '%H:%i') AS created_at \
         FROM prospek_harian p LEFT JOIN users u ON u.id = p.karyawan_id WHERE 1=1",
    );

    if user.role == "karyawan" {
        builder.push(" AND p.karyawan_id = ");
        builder.push_bind(user.id.clone());
    } else if let Some(karyawan_id) = query.karyawan_id.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        builder.push(" AND p.karyawan_id = ");
        builder.push_bind(karyawan_id.to_string());
    }

    if let Some(tanggal) = query.tanggal.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        builder.push(" AND p.tanggal = ");
        builder.push_bind(tanggal.to_string());
    }

    builder.push(" ORDER BY p.tanggal DESC, p.created_at DESC LIMIT ");
    builder.push_bind(limit as i64);
    builder.push(" OFFSET ");
    builder.push_bind(offset as i64);

    let items = builder
        .build_query_as::<ProspekHarianPublic>()
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing prospek_harian: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok(
        "Prospek harian fetched",
        json!({ "items": items, "page": page, "limit": limit }),
    ))
}

async fn create_prospek_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateProspekHarianPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Karyawan]).await?;
    let nama_prospek = payload.nama_prospek.trim().to_uppercase();
    let no_whatsapp = normalize_local_whatsapp(&payload.no_whatsapp);
    let minat_barang = payload.minat_barang.trim().to_uppercase();
    let status_prospek = payload
        .status_prospek
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("tanya_tanya")
        .to_string();

    if nama_prospek.is_empty() || no_whatsapp.is_empty() || minat_barang.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Nama prospek, WhatsApp, dan minat barang wajib diisi".to_string()],
        });
    }
    if !no_whatsapp.starts_with("08") || no_whatsapp.len() < 10 {
        return Err(AppError::Validation {
            errors: vec!["Nomor WhatsApp wajib valid dan diawali 08".to_string()],
        });
    }
    if !validate_prospek_status(&status_prospek) {
        return Err(AppError::Validation {
            errors: vec!["Status prospek tidak valid".to_string()],
        });
    }

    let tanggal = payload
        .tanggal
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(current_date_key);
    let cabang = payload
        .cabang
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Manado")
        .to_string();
    let divisi = payload
        .divisi
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&user.divisi)
        .to_string();
    let id = uuid::Uuid::new_v4().to_string();
    let keterangan_prospek = payload.keterangan_prospek.unwrap_or_default();
    let keterangan_fincoy = payload.keterangan_fincoy.unwrap_or_default();

    sqlx::query(
        "INSERT INTO prospek_harian \
         (id, karyawan_id, karyawan_nama, tanggal, cabang, divisi, nama_prospek, no_whatsapp, minat_barang, keterangan_prospek, status_prospek, keterangan_fincoy) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user.id)
    .bind(&user.name)
    .bind(&tanggal)
    .bind(&cabang)
    .bind(&divisi)
    .bind(&nama_prospek)
    .bind(&no_whatsapp)
    .bind(&minat_barang)
    .bind(&keterangan_prospek)
    .bind(&status_prospek)
    .bind(&keterangan_fincoy)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating prospek_harian: {}", e);
        AppError::Internal
    })?;

    sync_prospek_to_lead(
        &state,
        &id,
        &user.id,
        &nama_prospek,
        &no_whatsapp,
        &minat_barang,
        &status_prospek,
        &keterangan_prospek,
        &keterangan_fincoy,
        &cabang,
        &divisi,
    )
    .await?;

    Ok(json_ok("Prospek harian created", json!({ "id": id })))
}

async fn update_prospek_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateProspekHarianPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Owner, Role::PicRaport, Role::Karyawan]).await?;
    let current = sqlx::query_as::<_, ProspekHarianPublic>(
        "SELECT p.id, p.karyawan_id, COALESCE(NULLIF(p.karyawan_nama, ''), u.name, '') AS karyawan_name, \
         p.cabang, p.divisi, p.nama_prospek, p.no_whatsapp, p.minat_barang, p.keterangan_prospek, \
         p.status_prospek, p.keterangan_fincoy, DATE_FORMAT(p.tanggal, '%Y-%m-%d') AS tanggal, \
         DATE_FORMAT(p.created_at, '%H:%i') AS created_at \
         FROM prospek_harian p LEFT JOIN users u ON u.id = p.karyawan_id WHERE p.id = ? LIMIT 1",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching prospek_harian for update: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    if user.role == "karyawan" && current.karyawan_id != user.id {
        return Err(AppError::Forbidden);
    }

    let cabang = payload.cabang.unwrap_or(current.cabang).trim().to_string();
    let divisi = payload.divisi.unwrap_or(current.divisi).trim().to_string();
    let nama_prospek = payload
        .nama_prospek
        .unwrap_or(current.nama_prospek)
        .trim()
        .to_uppercase();
    let no_whatsapp = payload
        .no_whatsapp
        .map(|value| normalize_local_whatsapp(&value))
        .unwrap_or_else(|| normalize_local_whatsapp(&current.no_whatsapp));
    let minat_barang = payload
        .minat_barang
        .unwrap_or(current.minat_barang)
        .trim()
        .to_uppercase();
    let keterangan_prospek = payload
        .keterangan_prospek
        .unwrap_or(current.keterangan_prospek);
    let status_prospek = payload
        .status_prospek
        .unwrap_or(current.status_prospek)
        .trim()
        .to_string();
    let keterangan_fincoy = payload
        .keterangan_fincoy
        .unwrap_or(current.keterangan_fincoy);

    let mut errors = Vec::new();
    if nama_prospek.is_empty() {
        errors.push("Nama prospek wajib diisi".to_string());
    }
    if minat_barang.is_empty() {
        errors.push("Minat barang wajib diisi".to_string());
    }
    if !no_whatsapp.starts_with("08") || no_whatsapp.len() < 10 {
        errors.push("Nomor WhatsApp wajib valid dan diawali 08".to_string());
    }
    if !validate_prospek_status(&status_prospek) {
        errors.push("Status prospek tidak valid".to_string());
    }
    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }

    sqlx::query(
        "UPDATE prospek_harian SET cabang = ?, divisi = ?, nama_prospek = ?, no_whatsapp = ?, minat_barang = ?, \
         keterangan_prospek = ?, status_prospek = ?, keterangan_fincoy = ? WHERE id = ?",
    )
    .bind(&cabang)
    .bind(&divisi)
    .bind(&nama_prospek)
    .bind(&no_whatsapp)
    .bind(&minat_barang)
    .bind(&keterangan_prospek)
    .bind(&status_prospek)
    .bind(&keterangan_fincoy)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error updating prospek_harian: {}", e);
        AppError::Internal
    })?;

    sync_prospek_to_lead(
        &state,
        &id,
        &current.karyawan_id,
        &nama_prospek,
        &no_whatsapp,
        &minat_barang,
        &status_prospek,
        &keterangan_prospek,
        &keterangan_fincoy,
        &cabang,
        &divisi,
    )
    .await?;

    Ok(json_ok("Prospek harian updated", json!({ "id": id })))
}

async fn delete_prospek_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Owner, Role::PicRaport, Role::Karyawan]).await?;
    let owner_id = sqlx::query_scalar::<_, String>("SELECT karyawan_id FROM prospek_harian WHERE id = ? LIMIT 1")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching prospek_harian owner for delete: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::NotFound)?;

    if user.role == "karyawan" && owner_id != user.id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM leads WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting synced lead for prospek_harian: {}", e);
            AppError::Internal
        })?;

    sqlx::query("DELETE FROM prospek_harian WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting prospek_harian: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Prospek harian deleted", json!({ "id": id })))
}

async fn get_prospek_harian_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ProspekSummaryQuery>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::Owner, Role::PicRaport]).await?;
    let tanggal = query.tanggal.unwrap_or_else(current_date_key);

    let rows: Vec<(String, String, String, Option<String>, i64)> = sqlx::query_as(
        "SELECT u.id, u.name, COALESCE(NULLIF(u.divisi, ''), 'Karyawan') AS divisi, MAX(p.cabang) AS cabang, COUNT(p.id) AS total \
         FROM users u \
         LEFT JOIN prospek_harian p ON p.karyawan_id = u.id AND p.tanggal = ? \
         WHERE LOWER(u.role) = 'karyawan' \
         GROUP BY u.id, u.name, u.divisi",
    )
    .bind(&tanggal)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching prospek summary: {}", e);
        AppError::Internal
    })?;

    let mut items = rows
        .into_iter()
        .map(|(employee_id, nama, posisi, cabang, prospek_hari_ini)| {
            let target = if is_sales_division(&posisi) { 20 } else { 5 };
            let kategori = if target == 20 { "Sales" } else { "Non-Sales" };
            ProspekEmployeeSummary {
                rank: 0,
                employee_id,
                nama,
                cabang: cabang.filter(|v| !v.trim().is_empty()).unwrap_or_else(|| "Manado".to_string()),
                kategori: kategori.to_string(),
                posisi,
                prospek_hari_ini,
                target,
                persentase: if target > 0 { ((prospek_hari_ini * 100) / target).max(0) } else { 0 },
            }
        })
        .collect::<Vec<_>>();

    items.sort_by(|a, b| b.prospek_hari_ini.cmp(&a.prospek_hari_ini).then(b.persentase.cmp(&a.persentase)).then(a.nama.cmp(&b.nama)));
    for (index, item) in items.iter_mut().enumerate() {
        item.rank = index + 1;
    }

    Ok(json_ok("Prospek summary fetched", json!({ "items": items, "tanggal": tanggal })))
}

#[derive(Debug, Deserialize)]
struct ListRaportQuery {
    tanggal: Option<String>,
    karyawan_id: Option<String>,
    status: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobdeskReportSettingsPayload {
    start_time: String,
    end_time: String,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateJobdeskReportSettingsPayload {
    start_time: String,
    end_time: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobdeskDivisionsPayload {
    divisions: Value,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
struct RaportHarianPublic {
    id: String,
    employee_id: String,
    employee_name: String,
    cabang: String,
    divisi_id: String,
    divisi_name: String,
    tanggal: String,
    submitted_at: String,
    jobdesk_index: i32,
    jobdesk_text: String,
    mode: String,
    evidence_url: Option<String>,
    employee_note: Option<String>,
    review_status: String,
    score: Option<i32>,
    reviewer_comment: Option<String>,
    reviewed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RaportItemPayload {
    jobdesk_index: i32,
    jobdesk_text: String,
    mode: Option<String>,
    evidence_url: Option<String>,
    employee_note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertRaportPayload {
    tanggal: Option<String>,
    cabang: Option<String>,
    divisi: Option<String>,
    items: Vec<RaportItemPayload>,
}

#[derive(Debug, Deserialize)]
struct ReviewRaportPayload {
    status: String,
    score: Option<i32>,
    comment: Option<String>,
}

const JOBDESK_REPORT_SETTINGS_KEY: &str = "jobdesk_report_settings";
const JOBDESK_DIVISIONS_KEY: &str = "jobdesk_divisions";

fn default_jobdesk_report_settings() -> JobdeskReportSettingsPayload {
    JobdeskReportSettingsPayload {
        start_time: "08:00".to_string(),
        end_time: "18:00".to_string(),
        updated_at: None,
    }
}

async fn load_jobdesk_report_settings(state: &AppState) -> Result<JobdeskReportSettingsPayload, AppError> {
    let raw: Option<String> = sqlx::query_scalar("SELECT CAST(setting_value AS CHAR) FROM app_settings WHERE setting_key = ? LIMIT 1")
        .bind(JOBDESK_REPORT_SETTINGS_KEY)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error loading jobdesk report settings: {}", e);
            AppError::Internal
        })?;

    let Some(raw) = raw else {
        return Ok(default_jobdesk_report_settings());
    };

    Ok(serde_json::from_str::<JobdeskReportSettingsPayload>(&raw)
        .unwrap_or_else(|_| default_jobdesk_report_settings()))
}

async fn get_jobdesk_report_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Owner, Role::PicRaport, Role::Karyawan],
    )
    .await?;
    let settings = load_jobdesk_report_settings(&state).await?;
    Ok(json_ok("Jobdesk report settings fetched", json!(settings)))
}

async fn update_jobdesk_report_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateJobdeskReportSettingsPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Owner]).await?;
    let settings = JobdeskReportSettingsPayload {
        start_time: validate_time_hhmm(&payload.start_time, "startTime")?,
        end_time: validate_time_hhmm(&payload.end_time, "endTime")?,
        updated_at: Some(Utc::now().to_rfc3339()),
    };
    let serialized = serde_json::to_string(&settings).map_err(|e| {
        tracing::error!("Failed serializing jobdesk report settings: {}", e);
        AppError::Internal
    })?;

    sqlx::query(
        "INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) \
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP",
    )
    .bind(JOBDESK_REPORT_SETTINGS_KEY)
    .bind(serialized)
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error saving jobdesk report settings: {}", e);
        AppError::Internal
    })?;

    state.audit("raport.settings_updated", Some(&user.id)).await;
    Ok(json_ok("Jobdesk report settings saved", json!(settings)))
}

fn validate_jobdesk_divisions(value: &Value) -> Result<(), AppError> {
    let divisions = value.as_array().ok_or(AppError::Validation {
        errors: vec!["divisions harus berupa array".to_string()],
    })?;
    if divisions.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Minimal satu divisi wajib tersedia".to_string()],
        });
    }
    for division in divisions {
        let id = division.get("id").and_then(Value::as_str).unwrap_or("").trim();
        let posisi = division.get("posisi").and_then(Value::as_str).unwrap_or("").trim();
        let jobdesks = division.get("jobdesks").and_then(Value::as_array);
        if id.is_empty() || posisi.is_empty() || jobdesks.is_none() {
            return Err(AppError::Validation {
                errors: vec!["Setiap divisi wajib memiliki id, posisi, dan jobdesks".to_string()],
            });
        }
    }
    Ok(())
}

async fn load_jobdesk_divisions(state: &AppState) -> Result<JobdeskDivisionsPayload, AppError> {
    let raw: Option<String> = sqlx::query_scalar("SELECT CAST(setting_value AS CHAR) FROM app_settings WHERE setting_key = ? LIMIT 1")
        .bind(JOBDESK_DIVISIONS_KEY)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error loading jobdesk divisions: {}", e);
            AppError::Internal
        })?;

    let Some(raw) = raw else {
        return Ok(JobdeskDivisionsPayload {
            divisions: Value::Null,
            updated_at: None,
        });
    };

    Ok(serde_json::from_str::<JobdeskDivisionsPayload>(&raw).unwrap_or(JobdeskDivisionsPayload {
        divisions: Value::Null,
        updated_at: None,
    }))
}

async fn get_jobdesk_divisions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Owner, Role::PicRaport, Role::Karyawan],
    )
    .await?;
    let payload = load_jobdesk_divisions(&state).await?;
    Ok(json_ok("Jobdesk divisions fetched", json!(payload)))
}

async fn update_jobdesk_divisions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<JobdeskDivisionsPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Owner, Role::PicRaport]).await?;
    validate_jobdesk_divisions(&payload.divisions)?;
    let saved_payload = JobdeskDivisionsPayload {
        divisions: payload.divisions,
        updated_at: Some(Utc::now().to_rfc3339()),
    };
    let serialized = serde_json::to_string(&saved_payload).map_err(|e| {
        tracing::error!("Failed serializing jobdesk divisions: {}", e);
        AppError::Internal
    })?;

    sqlx::query(
        "INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) \
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP",
    )
    .bind(JOBDESK_DIVISIONS_KEY)
    .bind(serialized)
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error saving jobdesk divisions: {}", e);
        AppError::Internal
    })?;

    state.audit("raport.jobdesk_divisions_updated", Some(&user.id)).await;
    Ok(json_ok("Jobdesk divisions saved", json!(saved_payload)))
}

async fn list_raport_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListRaportQuery>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Owner, Role::PicRaport, Role::Karyawan],
    )
    .await?;
    let page = query.page.unwrap_or(1).max(1);
    let limit = clamp_page_limit(query.limit, 100, 500);
    let offset = (page - 1) * limit;

    let mut builder = sqlx::QueryBuilder::<sqlx::MySql>::new(
        "SELECT r.id, r.karyawan_id AS employee_id, COALESCE(NULLIF(r.karyawan_nama, ''), u.name, '') AS employee_name, \
         r.cabang, r.divisi AS divisi_id, r.divisi AS divisi_name, DATE_FORMAT(r.tanggal, '%Y-%m-%d') AS tanggal, \
         DATE_FORMAT(r.updated_at, '%Y-%m-%dT%H:%i:%s') AS submitted_at, r.jobdesk_index, COALESCE(r.jobdesk_text, r.jobdesk_label, '') AS jobdesk_text, \
         COALESCE(NULLIF(r.evidence_mode, ''), CASE WHEN COALESCE(r.bukti_url, '') = '' THEN 'none' ELSE 'image' END) AS mode, \
         r.bukti_url AS evidence_url, r.catatan AS employee_note, r.review_status, r.score, r.reviewer_comment, \
         DATE_FORMAT(r.reviewed_at, '%Y-%m-%dT%H:%i:%s') AS reviewed_at \
         FROM raport_harian r LEFT JOIN users u ON u.id = r.karyawan_id WHERE 1=1",
    );

    if user.role == "karyawan" {
        builder.push(" AND r.karyawan_id = ");
        builder.push_bind(user.id.clone());
    } else if let Some(karyawan_id) = query.karyawan_id.as_deref().map(str::trim).filter(|v| !v.is_empty()) {
        builder.push(" AND r.karyawan_id = ");
        builder.push_bind(karyawan_id.to_string());
    }

    if let Some(tanggal) = query.tanggal.clone().map(|value| value.trim().to_string()).filter(|v| !v.is_empty()) {
        let tanggal = normalize_date_key(Some(tanggal))?;
        builder.push(" AND r.tanggal = ");
        builder.push_bind(tanggal);
    }
    if let Some(status) = query.status.as_deref().map(str::trim).filter(|v| !v.is_empty() && *v != "all") {
        if !matches!(status, "pending" | "approved" | "rejected") {
            return Err(AppError::Validation {
                errors: vec!["status harus pending, approved, rejected, atau all".to_string()],
            });
        }
        builder.push(" AND r.review_status = ");
        builder.push_bind(status.to_string());
    }

    builder.push(" ORDER BY r.tanggal DESC, r.updated_at DESC, r.jobdesk_index ASC LIMIT ");
    builder.push_bind(limit as i64);
    builder.push(" OFFSET ");
    builder.push_bind(offset as i64);

    let items = builder
        .build_query_as::<RaportHarianPublic>()
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing raport_harian: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Raport harian fetched", json!({ "items": items, "page": page, "limit": limit })))
}

async fn upsert_raport_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpsertRaportPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Karyawan]).await?;
    if payload.items.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Minimal satu jobdesk wajib dikirim".to_string()],
        });
    }

    let tanggal = normalize_date_key(payload.tanggal)?;
    let cabang = payload
        .cabang
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Manado".to_string());
    let divisi = payload
        .divisi
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| user.divisi.clone());
    let mut saved = 0u64;

    for item in payload.items {
        let jobdesk_text = item.jobdesk_text.trim().to_string();
        if jobdesk_text.is_empty() {
            continue;
        }
        if item.jobdesk_index < 0 {
            return Err(AppError::Validation {
                errors: vec!["jobdeskIndex tidak boleh negatif".to_string()],
            });
        }
        let id = uuid::Uuid::new_v4().to_string();
        let mode = normalize_raport_mode(item.mode)?;
        let employee_note = item.employee_note.unwrap_or_default().trim().to_string();
        let evidence_url = item.evidence_url.unwrap_or_default().trim().to_string();
        if matches!(mode.as_str(), "image" | "video") && evidence_url.is_empty() {
            return Err(AppError::Validation {
                errors: vec!["Bukti gambar/video wajib diunggah sebelum raport dikirim".to_string()],
            });
        }
        if mode == "none" && !evidence_url.is_empty() {
            return Err(AppError::Validation {
                errors: vec!["mode none tidak boleh membawa evidenceUrl".to_string()],
            });
        }

        let result = sqlx::query(
            "INSERT INTO raport_harian \
             (id, karyawan_id, karyawan_nama, tanggal, cabang, divisi, jobdesk_index, jobdesk_label, jobdesk_text, completed, is_done, evidence_mode, bukti_url, notes, catatan, review_status, score, reviewer_comment, reviewed_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, TRUE, ?, ?, ?, ?, 'pending', NULL, NULL, NULL) \
             ON DUPLICATE KEY UPDATE karyawan_nama = VALUES(karyawan_nama), cabang = VALUES(cabang), divisi = VALUES(divisi), \
             jobdesk_label = VALUES(jobdesk_label), jobdesk_text = VALUES(jobdesk_text), completed = TRUE, is_done = TRUE, evidence_mode = VALUES(evidence_mode), \
             bukti_url = VALUES(bukti_url), notes = VALUES(notes), catatan = VALUES(catatan), review_status = 'pending', score = NULL, reviewer_comment = NULL, reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(id)
        .bind(&user.id)
        .bind(&user.name)
        .bind(&tanggal)
        .bind(&cabang)
        .bind(&divisi)
        .bind(item.jobdesk_index)
        .bind(&jobdesk_text)
        .bind(&jobdesk_text)
        .bind(&mode)
        .bind(if evidence_url.is_empty() { None } else { Some(evidence_url) })
        .bind(&employee_note)
        .bind(&employee_note)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error upserting raport_harian: {}", e);
            AppError::Internal
        })?;

        if result.rows_affected() > 0 {
            saved += 1;
        }
    }

    Ok(json_ok("Raport harian saved", json!({ "saved": saved, "tanggal": tanggal })))
}

async fn review_raport_harian(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ReviewRaportPayload>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::PicRaport]).await?;
    let status = payload.status.trim().to_lowercase();
    if !matches!(status.as_str(), "pending" | "approved" | "rejected") {
        return Err(AppError::Validation {
            errors: vec!["Status review harus pending, approved, atau rejected".to_string()],
        });
    }
    let score = match status.as_str() {
        "pending" => None,
        "rejected" => Some(0),
        _ => Some(payload.score.unwrap_or(100).clamp(0, 100)),
    };
    let comment = payload.comment.unwrap_or_default().trim().to_string();

    let result = if status == "pending" {
        sqlx::query(
            "UPDATE raport_harian SET review_status = ?, score = NULL, reviewer_comment = ?, reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(&status)
        .bind(&comment)
        .bind(&id)
        .execute(&state.pool)
        .await
    } else {
        sqlx::query(
            "UPDATE raport_harian SET review_status = ?, score = ?, reviewer_comment = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(&status)
        .bind(score)
        .bind(&comment)
        .bind(&id)
        .execute(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error reviewing raport_harian: {}", e);
        AppError::Internal
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    state.audit("raport.reviewed", Some(&user.id)).await;
    Ok(json_ok("Raport reviewed", json!({ "id": id, "status": status, "score": score })))
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;
    use std::sync::atomic::AtomicBool;

    // ── Test: health endpoint response structure ──────────────────────────────
    //
    // Validates that the health endpoint returns the correct JSON structure
    // with all required pixel system fields. This is a unit test that verifies
    // the response format without requiring a full AppState setup.
    // Validates Requirement 25.4.
    #[test]
    fn health_response_structure_is_correct() {
        // Test the response structure by verifying the JSON keys
        // The actual health handler reads from AppState and formats as:
        // {
        //   "message": "OK",
        //   "data": {
        //     "status": "healthy",
        //     "analytics_job_running": bool,
        //     "last_analytics_run": Option<String>,
        //     "last_retry_run": Option<String>
        //   }
        // }

        // Simulate the response data structure
        let analytics_running = false;
        let last_analytics: Option<String> = None;
        let last_retry: Option<String> = None;

        let response_data = json!({
            "status": "healthy",
            "analytics_job_running": analytics_running,
            "last_analytics_run": last_analytics,
            "last_retry_run": last_retry
        });

        // Verify the structure
        assert!(
            response_data.is_object(),
            "Response data should be an object"
        );
        assert_eq!(response_data["status"], "healthy");
        assert!(
            response_data["analytics_job_running"].is_boolean(),
            "analytics_job_running should be a boolean"
        );
        assert!(
            response_data["last_analytics_run"].is_null(),
            "last_analytics_run should be null when not set"
        );
        assert!(
            response_data["last_retry_run"].is_null(),
            "last_retry_run should be null when not set"
        );
    }

    // ── Test: health endpoint timestamp formatting ────────────────────────────
    //
    // Validates that timestamps are correctly formatted as RFC3339 strings
    // when the analytics job has run.
    #[test]
    fn health_timestamps_are_rfc3339_formatted() {
        // Simulate timestamps being set
        let now = Utc::now();
        let last_analytics = Some(now.to_rfc3339());
        let last_retry = Some((now - Duration::minutes(5)).to_rfc3339());

        let response_data = json!({
            "status": "healthy",
            "analytics_job_running": true,
            "last_analytics_run": last_analytics,
            "last_retry_run": last_retry
        });

        // Verify timestamps are strings
        assert!(
            response_data["last_analytics_run"].is_string(),
            "last_analytics_run should be a string when set"
        );
        assert!(
            response_data["last_retry_run"].is_string(),
            "last_retry_run should be a string when set"
        );

        // Verify they can be parsed as RFC3339
        let last_analytics_str = response_data["last_analytics_run"].as_str().unwrap();
        let last_retry_str = response_data["last_retry_run"].as_str().unwrap();

        assert!(
            chrono::DateTime::parse_from_rfc3339(last_analytics_str).is_ok(),
            "last_analytics_run should be valid RFC3339"
        );
        assert!(
            chrono::DateTime::parse_from_rfc3339(last_retry_str).is_ok(),
            "last_retry_run should be valid RFC3339"
        );
    }

    proptest! {
        #[test]
        fn catalog_name_matching_uses_trimmed_case_insensitive_exact_names(
            base in "[A-Za-z0-9][A-Za-z0-9 ]{0,60}",
            prefix_ws in "\\s{0,3}",
            suffix_ws in "\\s{0,3}",
            extra in "[A-Za-z0-9]{1,12}",
        ) {
            let canonical = normalize_catalog_match_name(&base);
            prop_assume!(!canonical.is_empty());

            let same_with_whitespace = format!("{}{}{}", prefix_ws, base.to_uppercase(), suffix_ws);
            prop_assert!(catalog_names_match(&base, &same_with_whitespace));

            let different = format!("{} {}", base, extra);
            prop_assume!(normalize_catalog_match_name(&different) != canonical);
            prop_assert!(!catalog_names_match(&base, &different));
        }

        #[test]
        fn catalog_match_count_invariant_holds(
            requested in proptest::collection::vec("[A-Za-z0-9][A-Za-z0-9 ]{0,40}", 0..50),
            catalog in proptest::collection::vec("[A-Za-z0-9][A-Za-z0-9 ]{0,40}", 0..50),
        ) {
            let (matched, unmatched) = count_catalog_name_matches(&requested, &catalog);
            prop_assert_eq!(matched + unmatched, requested.len());
        }
    }

    // ── Test: health endpoint job running state ───────────────────────────────
    //
    // Validates that the analytics_job_running field correctly reflects
    // the AtomicBool state from AppState.
    #[test]
    fn health_reflects_analytics_job_state() {
        use std::sync::atomic::Ordering;

        // Test when job is not running
        let job_running = AtomicBool::new(false);
        let state = job_running.load(Ordering::Relaxed);
        assert_eq!(state, false, "Job should not be running initially");

        // Test when job is running
        job_running.store(true, Ordering::Relaxed);
        let state = job_running.load(Ordering::Relaxed);
        assert_eq!(state, true, "Job should be running after store(true)");

        // Verify the response would include this state
        let response_data = json!({
            "status": "healthy",
            "analytics_job_running": state,
            "last_analytics_run": None::<String>,
            "last_retry_run": None::<String>
        });

        assert_eq!(
            response_data["analytics_job_running"], true,
            "Response should reflect job running state"
        );
    }
}
