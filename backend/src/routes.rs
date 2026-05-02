use crate::{
    auth::{authorize, hash_password, login_with_request, logout_with_headers, refresh_with_request, verify_password, LoginRequest, RefreshRequest, Role},
    response::{json_ok, AppError},
    state::{AppState, UserPublic, UserRecord},
};
use axum::{extract::{Path, State, Multipart}, http::{header::SET_COOKIE, HeaderMap, HeaderValue}, routing::{get, post, patch}, Json, Router};
use chrono::{Duration, Utc};
use std::collections::HashMap;
use std::fs;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/api/partners", get(list_partners))
        .route("/api/admin/partners", get(list_admin_partners).post(create_partner))
        .route("/api/admin/partners/{id}", patch(update_partner).delete(delete_partner))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/verify-email", post(verify_email))
        .route("/api/auth/refresh", post(refresh))
        .route("/api/auth/forgot-password", post(forgot_password))
        .route("/api/auth/reset-password", post(reset_password))
        .route("/api/notifications", get(list_notifications))
        .route("/api/notifications/unread-count", get(get_notifications_unread_count))
        .route("/api/notifications/read-all", patch(mark_all_notifications_as_read))
        .route("/api/notifications/{id}/read", patch(mark_notification_as_read))
        .route("/api/auth/profile", patch(update_auth_profile))
        .route("/api/auth/change-password", post(change_auth_password))
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/{id}", get(get_user).patch(update_user).delete(delete_user))
        .route("/api/users/{id}/reset-password", post(reset_user_password))
        .route("/api/users/{id}/resend-verification", post(resend_verification))
        .route("/api/wa/accounts", get(list_wa_accounts).post(create_wa_account))
        .route("/api/wa/accounts/{id}", patch(update_wa_account).delete(delete_wa_account))
        .route("/api/wa/campaigns", get(list_wa_campaigns).post(create_wa_campaign))
        .route("/api/wa/campaigns/{id}", get(get_wa_campaign).patch(update_wa_campaign).delete(delete_wa_campaign))
        .route("/api/wa/campaigns/{id}/recipients", post(add_wa_recipients))
        .route("/api/wa/campaigns/{id}/recipients/from-leads", post(add_wa_recipients_from_leads))
        .route("/api/wa/campaigns/{id}/start", post(start_wa_campaign))
        .route("/api/wa/campaigns/{id}/status", get(get_wa_campaign_status))
        .route("/api/wa/recipients/{id}", patch(update_wa_recipient).delete(delete_wa_recipient))
        .route("/api/wa/webhooks/fonnte", post(handle_fonnte_webhook))
        .route("/api/reward-tiers", get(list_reward_tiers))
        .route("/api/admin/uploads/image", post(upload_admin_image))
        .route("/api/catalogs", get(list_catalogs).post(create_catalog))
        .route("/api/admin/catalogs/bulk", post(bulk_products))
        .route("/api/catalogs/{id}", get(get_catalog).patch(update_catalog).delete(delete_catalog))
        .route("/api/product-categories", get(list_product_categories).post(create_product_category))
        .route("/api/product-categories/{id}", patch(update_product_category).delete(delete_product_category))
        .route("/api/promotions", get(list_promotions).post(create_promotion))
        .route("/api/promotions/{id}", patch(update_promotion).delete(delete_promotion))
        .route("/api/referrals/generate", post(generate_referral))
        .route("/api/referrals", get(list_referrals))
        .route("/api/referrals/{slug}", get(get_referral))
        .route("/api/referrals/{slug}/stats", get(get_referral_stats))
        .route("/api/telemetry/page-view", post(page_view))
        .route("/api/telemetry/click", post(click))
        .route("/api/telemetry/whatsapp-click", post(whatsapp_click))
        .route("/api/telemetry/pixel-event", post(pixel_event))
        .route("/api/jobs", get(list_jobs).post(create_job))
        .route("/api/jobs/{id}", patch(update_job).delete(delete_job))
        .route("/api/job-applications", get(list_job_applications).post(create_job_application))
        .route("/api/job-applications/{id}/status", patch(update_job_application_status))
        .route("/api/articles", get(list_articles).post(create_article))
        .route("/api/articles/{id}", patch(update_article).delete(delete_article))
        .route("/api/leads", get(list_leads).post(create_lead))
        .route("/api/leads/{id}/status", patch(update_lead_status))
        .route("/api/agent/stats", get(get_agent_stats))
        .route("/api/agent/claims", get(list_claims).post(create_claim))
        .route("/api/agent/support-tickets", get(list_support_tickets).post(create_support_ticket))
        .route("/api/leaderboard", get(list_leaderboard))
        .route("/api/agent-registrations", post(submit_agent_registration))
        .route("/api/admin/agent-registrations", get(list_agent_registrations))
        .route("/api/admin/agent-registrations/{id}/status", patch(update_agent_registration_status))
        .route("/api/admin/claims", get(list_all_claims))
        .route("/api/admin/claims/{id}/status", patch(update_claim_status))
        .route("/api/admin/support-tickets", get(list_admin_support_tickets))
        .route("/api/admin/support-tickets/{id}/status", patch(update_admin_support_ticket_status))
        .route("/api/admin/telemetry-stats", get(get_telemetry_stats))
        .route("/api/admin/agents", get(list_agents))
        .route("/api/admin/agents/{id}/performance", get(get_agent_performance))
        .route("/api/admin/leads", get(list_leads))
        .route("/api/admin/leads/{id}/status", patch(update_lead_status))
        .with_state(state)
}

async fn health() -> ResponseBody {
    json_ok("OK", json!({ "status": "healthy" }))
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

async fn enforce_login_rate_limit(state: &AppState, email: &str, client_ip: Option<&str>) -> Result<(), AppError> {
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
        "refresh_token={}; HttpOnly; Path=/api/auth; Max-Age={}; SameSite={}{}",
        token, max_age, same_site, secure_attr
    )
}

fn build_clear_refresh_cookie() -> String {
    let secure = cookie_secure_enabled();
    let same_site = if secure { "None" } else { "Lax" };
    let secure_attr = if secure { "; Secure" } else { "" };
    format!(
        "refresh_token=; HttpOnly; Path=/api/auth; Max-Age=0; SameSite={}{}",
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

async fn login(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<LoginRequest>) -> Result<ResponseBody, AppError> {
    let client_ip = extract_client_ip(&headers);
    enforce_login_rate_limit(&state, &payload.email, client_ip.as_deref()).await?;
    let email = payload.email.clone();
    let auth = login_with_request(&state, payload).await?;
    clear_login_rate_limit(&state, &email, client_ip.as_deref()).await;
    let refresh_token = auth.refresh_token.clone();
    let remember = auth.remember;
    let mut response = json_ok("Login successful", auth);
    append_set_cookie(&mut response, &build_refresh_cookie(&refresh_token, remember));
    Ok(response)
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    match logout_with_headers(&state, &headers).await {
        Ok(_) | Err(AppError::Unauthorized) => {
            let mut response = json_ok("Logout successful", json!({ "logged_out": true }));
            append_set_cookie(&mut response, &build_clear_refresh_cookie());
            Ok(response)
        }
        Err(e) => Err(e),
    }
}

async fn refresh(State(state): State<AppState>, headers: HeaderMap, body: axum::body::Bytes) -> axum::response::Response {
    let payload: RefreshRequest = serde_json::from_slice(&body).unwrap_or(RefreshRequest { refresh_token: "".to_string() });
    
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
            append_set_cookie(&mut response, &build_refresh_cookie(&new_refresh_token, remember));
            response
        }
        Err(_) => {
            let mut response = json_ok("Session invalid or expired", json!({ "authenticated": false }));
            append_set_cookie(&mut response, &build_clear_refresh_cookie());
            response
        }
    }
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
                state.audit("auth.password_reset.requested", Some(&email)).await;
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

    state.audit("auth.password_reset.completed", Some(&user_id)).await;
    Ok(json_ok("Password berhasil direset", json!({ "reset": true })))
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
        &[Role::Admin, Role::Agent, Role::Editor, Role::Operator],
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
    Ok(json_ok("Profil berhasil diperbarui", serde_json::to_value(updated).unwrap_or(json!({}))))
}

async fn change_auth_password(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::Agent, Role::Editor, Role::Operator],
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

    Ok(json_ok("Password berhasil diperbarui", json!({ "updated": true })))
}

async fn list_users(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let users: Vec<UserPublic> = sqlx::query_as("SELECT id, email, name, role, avatar, bank_account, created_at, last_login, is_active, is_verified, must_change_password FROM users")
        .fetch_all(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;
        
    Ok(json_ok(format!("Users fetched by {}", user.email), json!({ "items": users })))
}

async fn verify_email(
    State(state): State<AppState>,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<ResponseBody, AppError> {
    let token = payload.token.as_deref().map(str::trim).unwrap_or("").to_string();
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
    Ok(json_ok("Email berhasil diverifikasi", json!({ "verified": true })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserCreateRequest {
    id: Option<String>,
    email: String,
    name: String,
    role: String,
    password: String,
    avatar: Option<String>,
    bank_account: Option<String>,
    is_active: Option<bool>,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct UserUpdateRequest {
    email: Option<String>,
    name: Option<String>,
    role: Option<String>,
    password: Option<String>,
    avatar: Option<String>,
    bank_account: Option<String>,
    is_active: Option<bool>,
    is_verified: Option<bool>,
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
struct WaSummaryResponse {
    id: String,
    name: String,
    gateway_config: Value,
    enabled: bool,
    created_by: Option<String>,
    created_at: Option<String>,
}

#[derive(Serialize)]
struct WaCampaignSummaryResponse {
    id: String,
    name: String,
    status: String,
    config: Value,
    created_by: Option<String>,
    created_at: Option<String>,
    started_at: Option<String>,
    recipient_total: i64,
    recipient_sent: i64,
    recipient_skipped: i64,
    recipient_failed: i64,
}

#[derive(Serialize)]
struct WaRecipientSummaryResponse {
    id: String,
    phone: String,
    variables: Value,
    status: String,
    last_attempt_at: Option<String>,
    delivered_at: Option<String>,
    read_at: Option<String>,
    replied_at: Option<String>,
    last_error: Option<String>,
    created_at: Option<String>,
}

fn normalize_phone(value: &str) -> Option<String> {
    let digits: String = value
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect();
    if digits.len() < 8 {
        None
    } else {
        Some(digits)
    }
}

fn parse_json_value(text: Option<String>) -> Value {
    text.and_then(|raw| serde_json::from_str(&raw).ok()).unwrap_or(Value::Null)
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
    let role = value.trim().to_lowercase();
    if matches!(role.as_str(), "admin" | "agent" | "editor" | "operator" | "wa_admin" | "wa-operator" | "wa_operator" | "waadmin" | "waoperator") {
        Some(role)
    } else {
        None
    }
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
            errors: vec!["targetPath harus berupa path internal yang diawali '/' (contoh: /produk/abc)".to_string()],
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
        AppError::Validation { errors: vec!["Format file gambar tidak didukung".to_string()] }
    })?;
    let mut reader = image::ImageReader::with_format(cursor, format);
    reader.limits(image_decode_limits());
    reader.decode().map_err(|e| {
        tracing::warn!("Failed to decode uploaded image: {}", e);
        AppError::Validation { errors: vec!["Format file gambar tidak didukung atau ukuran terlalu besar".to_string()] }
    })
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
        errors.push("role harus salah satu dari: admin, agent, editor, operator, wa_admin, wa_operator".to_string());
    }
    if payload.password.len() < 8 {
        errors.push("password minimal 8 karakter".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_user_update(payload: &UserUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.email.as_ref().is_some_and(|value| value.trim().is_empty() || !value.contains('@')) {
        errors.push("email tidak valid".to_string());
    }
    if payload.name.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("name tidak boleh kosong".to_string());
    }
    if payload.role.as_ref().is_some_and(|value| normalize_role(value).is_none()) {
        errors.push("role harus salah satu dari: admin, agent, editor, operator, wa_admin, wa_operator".to_string());
    }
    if payload.password.as_ref().is_some_and(|value| value.len() < 8) {
        errors.push("password minimal 8 karakter".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_lead_status(status: &str) -> bool {
    matches!(status, "Follow Up" | "Negosiasi" | "Closed Won" | "Closed Lost")
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
        "SELECT id FROM users WHERE LOWER(role) = 'admin' AND is_active = 1"
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
    sqlx::query_as::<_, UserPublic>(
        "SELECT id, email, name, role, avatar, bank_account, created_at, last_login, is_active, is_verified, must_change_password FROM users WHERE id = ? LIMIT 1",
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

async fn find_lead_by_id(state: &AppState, id: &str) -> Result<LeadRecord, AppError> {
    sqlx::query_as::<_, LeadRecord>(
        "SELECT id, agent_id, customer_name, phone_number, interested_product, status, notes, created_at, updated_at FROM leads WHERE id = ? LIMIT 1",
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

async fn create_user(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<UserCreateRequest>) -> Result<ResponseBody, AppError> {
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

    sqlx::query(
        "INSERT INTO users (id, email, name, role, password_hash, avatar, bank_account, is_active, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(payload.email.trim())
    .bind(payload.name.trim())
    .bind(role)
    .bind(password_hash)
    .bind(payload.avatar.unwrap_or_else(|| "".to_string()))
    .bind(payload.bank_account.unwrap_or_else(|| "".to_string()))
    .bind(payload.is_active.unwrap_or(true))
    .bind(true) // Admin created users are verified by default
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = find_user_public_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("User created by {}", user.email),
        json!({ "item": created }),
    ))
}

async fn get_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    let item = find_user_public_by_id(&state, &id).await?;
    Ok(json_ok(
        format!("User {} fetched by {}", id, user.email),
        json!({ "item": item }),
    ))
}

async fn update_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<UserUpdateRequest>) -> Result<ResponseBody, AppError> {
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

    let current = sqlx::query_as::<_, (String, String, String, String, String, String, bool, bool)>(
        "SELECT email, name, role, password_hash, avatar, bank_account, is_active, is_verified FROM users WHERE id = ? LIMIT 1",
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
        current_password_hash,
        current_avatar,
        current_bank_account,
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
    let next_password_hash = payload
        .password
        .as_deref()
        .map(hash_password)
        .unwrap_or_else(|| current_password_hash.clone());
    let next_avatar = payload.avatar.unwrap_or(current_avatar);
    let next_bank_account = payload.bank_account.unwrap_or(current_bank_account);
    let next_is_active = payload.is_active.unwrap_or(current_is_active);
    let next_is_verified = payload.is_verified.unwrap_or(current_is_verified);

    let should_invalidate_sessions = next_role != current_role
        || next_password_hash != current_password_hash
        || next_is_active != current_is_active
        || next_is_verified != current_is_verified;

    sqlx::query(
        "UPDATE users SET email = ?, name = ?, role = ?, password_hash = ?, avatar = ?, bank_account = ?, is_active = ?, is_verified = ? WHERE id = ?",
    )
    .bind(next_email.trim())
    .bind(next_name.trim())
    .bind(next_role)
    .bind(next_password_hash)
    .bind(next_avatar)
    .bind(next_bank_account)
    .bind(next_is_active)
    .bind(next_is_verified)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

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

    let target_user = sqlx::query_as::<_, crate::state::UserRecord>("SELECT * FROM users WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching user for password reset: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::NotFound)?;

    let password_hash = hash_password(payload.password.trim());
    let result = sqlx::query(
        "UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?",
    )
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
            .send_password_reset_email(&target_user.email, &target_user.name, payload.password.trim())
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

async fn list_reward_tiers(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

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

async fn upload_admin_image(State(state): State<AppState>, headers: HeaderMap, mut multipart: Multipart) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;

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

        if let Err(error) = fs::create_dir_all("uploads") {
            tracing::error!("Failed to create uploads directory: {}", error);
            return Err(AppError::Internal);
        }

        let file_id = uuid::Uuid::new_v4().to_string();
        let file_name = format!("{}_article.webp", file_id);
        let file_path = format!("uploads/{}", file_name);
        
        tracing::info!("Saving image as WebP to {}...", file_path);
        image.save_with_format(&file_path, image::ImageFormat::WebP).map_err(|e| {
            tracing::error!("Failed to save article upload {}: {}", file_name_orig, e);
            AppError::Internal
        })?;

        tracing::info!("Successfully saved image to {}", file_path);
        uploaded_url = Some(format!("/uploads/{}", file_name));
        break;
    }

    let url = uploaded_url.ok_or(AppError::Validation {
        errors: vec!["File gambar wajib diunggah".to_string()],
    })?;

    Ok(json_ok("Image uploaded", json!({ "url": url })))
}

async fn list_wa_accounts(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;

    let rows = sqlx::query_as::<_, (String, String, Option<String>, bool, Option<String>, Option<String>)>(
        "SELECT id, name, gateway_config, enabled, created_by, created_at FROM wa_accounts ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching WA accounts: {}", e);
        AppError::Internal
    })?;

    let items = rows
        .into_iter()
        .map(|(id, name, gateway_config, enabled, created_by, created_at)| WaSummaryResponse {
            id,
            name,
            gateway_config: parse_json_value(gateway_config),
            enabled,
            created_by,
            created_at,
        })
        .collect::<Vec<_>>();

    Ok(json_ok("WA accounts fetched", json!({ "items": items })))
}

async fn create_wa_account(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WaAccountCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation { errors: vec!["name wajib diisi".to_string()] });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let gateway_config = payload.gateway_config.unwrap_or_else(|| json!({})).to_string();
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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    sqlx::query("DELETE FROM wa_accounts WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    Ok(json_ok("WA account deleted", json!({ "id": id })))
}

async fn list_wa_campaigns(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;

    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, i64, i64, i64, i64)>(
        "SELECT c.id, c.name, c.status, c.config, c.created_by, c.created_at, c.started_at, COALESCE(COUNT(r.id), 0) AS recipient_total, COALESCE(SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END), 0) AS recipient_sent, COALESCE(SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END), 0) AS recipient_skipped, COALESCE(SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END), 0) AS recipient_failed FROM wa_campaigns c LEFT JOIN wa_recipients r ON r.campaign_id = c.id GROUP BY c.id ORDER BY c.created_at DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching WA campaigns: {}", e);
        AppError::Internal
    })?;

    let items = rows
        .into_iter()
        .map(|(id, name, status, config, created_by, created_at, started_at, recipient_total, recipient_sent, recipient_skipped, recipient_failed)| WaCampaignSummaryResponse {
            id,
            name,
            status: status.unwrap_or_else(|| "draft".to_string()),
            config: parse_json_value_or_default(config, default_wa_campaign_config()),
            created_by,
            created_at,
            started_at,
            recipient_total,
            recipient_sent,
            recipient_skipped,
            recipient_failed,
        })
        .collect::<Vec<_>>();

    Ok(json_ok("WA campaigns fetched", json!({ "items": items })))
}

async fn create_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WaCampaignCreateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    let name = payload.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation { errors: vec!["name wajib diisi".to_string()] });
    }

    let id = uuid::Uuid::new_v4().to_string();
    let config = payload.config.unwrap_or_else(default_wa_campaign_config).to_string();

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

async fn get_wa_campaign(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;
    let item = fetch_wa_campaign_summary(&state, &id).await?;
    Ok(json_ok("WA campaign fetched", json!({ "item": item })))
}

async fn update_wa_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<WaCampaignUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;

    let campaign_config: Option<String> = sqlx::query_scalar("SELECT config FROM wa_campaigns WHERE id = ? LIMIT 1")
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
        return Err(AppError::Validation { errors: vec!["recipients wajib diisi".to_string()] });
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
        let dedupe_window = format!("-{} day", dedupe_days.max(1));

        let duplicate_exists: Option<i64> = sqlx::query_scalar(
            "SELECT 1 FROM wa_dispatch_logs WHERE phone = ? AND sent_at >= datetime('now', ?) LIMIT 1",
        )
        .bind(&phone)
        .bind(&dedupe_window)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking WA dedupe: {}", e);
            AppError::Internal
        })?;

        let status = if duplicate_exists.is_some() { "skipped" } else { "pending" };
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

async fn start_wa_campaign(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;

    let result = sqlx::query(
        "UPDATE wa_campaigns SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = ?",
    )
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error starting WA campaign: {}", e);
        AppError::Internal
    })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(json_ok(
        format!("WA campaign started by {}", user.email),
        json!({ "item": fetch_wa_campaign_summary(&state, &id).await? }),
    ))
}

async fn get_wa_campaign_status(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;
    let campaign = fetch_wa_campaign_summary(&state, &id).await?;

    let recipient_rows = sqlx::query_as::<_, (String, String, Option<String>, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
        "SELECT id, phone, variables_json, status, last_attempt_at, delivered_at, read_at, replied_at, last_error, created_at FROM wa_recipients WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 250",
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
        .map(|(id, phone, variables, status, last_attempt_at, delivered_at, read_at, replied_at, last_error, created_at)| WaRecipientSummaryResponse {
            id,
            phone,
            variables: parse_json_value(variables),
            status,
            last_attempt_at,
            delivered_at,
            read_at,
            replied_at,
            last_error,
            created_at,
        })
        .collect::<Vec<_>>();

    Ok(json_ok("WA campaign status fetched", json!({ "campaign": campaign, "recipients": recipients })))
}

async fn fetch_wa_campaign_summary(state: &AppState, id: &str) -> Result<WaCampaignSummaryResponse, AppError> {
    let row = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, i64, i64, i64, i64)>(
        "SELECT c.id, c.name, c.status, c.config, c.created_by, c.created_at, c.started_at, COALESCE(COUNT(r.id), 0) AS recipient_total, COALESCE(SUM(CASE WHEN r.status = 'sent' THEN 1 ELSE 0 END), 0) AS recipient_sent, COALESCE(SUM(CASE WHEN r.status = 'skipped' THEN 1 ELSE 0 END), 0) AS recipient_skipped, COALESCE(SUM(CASE WHEN r.status = 'failed' THEN 1 ELSE 0 END), 0) AS recipient_failed FROM wa_campaigns c LEFT JOIN wa_recipients r ON r.campaign_id = c.id WHERE c.id = ? GROUP BY c.id LIMIT 1",
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error loading WA campaign summary: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let (id, name, status, config, created_by, created_at, started_at, recipient_total, recipient_sent, recipient_skipped, recipient_failed) = row;

    Ok(WaCampaignSummaryResponse {
        id,
        name,
        status: status.unwrap_or_else(|| "draft".to_string()),
        config: parse_json_value_or_default(config, default_wa_campaign_config()),
        created_by,
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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin, Role::WaOperator]).await?;

    let mut inserted = 0;
    let mut skipped = 0;

    for lead_id in payload.lead_ids {
        // Fetch lead data
        let lead: Option<(String, String)> = sqlx::query_as("SELECT customer_name, phone_number FROM leads WHERE id = ?")
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

            let res = sqlx::query("INSERT OR IGNORE INTO wa_recipients (id, campaign_id, phone, variables_json, lead_id) VALUES (?, ?, ?, ?, ?)")
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

    Ok(json_ok("Leads added to WA campaign", json!({ "inserted": inserted, "skipped": skipped })))
}

async fn delete_wa_recipient(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    if let Some(phone) = payload.phone {
        let phone_norm = normalize_phone(&phone).ok_or(AppError::Validation { errors: vec!["Phone not valid".to_string()] })?;
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

#[derive(Deserialize, Debug)]
struct FonnteWebhookPayload {
    id: String, // message_id
    status: String,
    target: String,
    message: Option<String>,
}

async fn handle_fonnte_webhook(
    State(state): State<AppState>,
    Json(payload): Json<FonnteWebhookPayload>,
) -> Result<ResponseBody, AppError> {
    tracing::info!("Fonnte Webhook received: {:?}", payload);

    // Fonnte sends status updates. We need to match the message_id with our dispatch logs.
    let log: Option<(String, String)> = sqlx::query_as("SELECT recipient_id, campaign_id FROM wa_dispatch_logs WHERE message_id = ? LIMIT 1")
        .bind(&payload.id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;

    if let Some((recipient_id, _campaign_id)) = log {
        let now = Utc::now().to_rfc3339();
        
        let query = match payload.status.to_lowercase().as_str() {
            "delivered" => "UPDATE wa_recipients SET delivered_at = ? WHERE id = ?",
            "read" => "UPDATE wa_recipients SET read_at = ? WHERE id = ?",
            "failed" => "UPDATE wa_recipients SET status = 'failed', last_error = ? WHERE id = ?",
            _ => "",
        };

        if !query.is_empty() {
            let bind_val = if payload.status == "failed" {
                payload.message.unwrap_or_else(|| "Unknown failure".to_string())
            } else {
                now
            };

            sqlx::query(query)
                .bind(bind_val)
                .bind(&recipient_id)
                .execute(&state.pool)
                .await
                .map_err(|_| AppError::Internal)?;
        }
    }

    Ok(json_ok("Webhook processed", json!({ "status": "ok" })))
}

async fn resend_verification(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let _admin = authorize(&state, &headers, &[Role::Admin]).await?;
    
    let user: UserRecord = sqlx::query_as("SELECT * FROM users WHERE id = ?")
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
            tracing::error!("Failed to issue verification token for {}: {:?}", user.email, e);
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

async fn delete_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    
    // Prevent admin dari menghapus dirinya sendiri
    if user.id == id {
        return Err(AppError::Validation {
            errors: vec!["Anda tidak dapat menghapus akun Anda sendiri".to_string()]
        });
    }
    
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
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

    state.invalidate_user_sessions(&id).await;

    Ok(json_ok(format!("User {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
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
    colors: Option<String>,
    ratings: Option<String>,
    rating: Option<f64>,
    review: Option<String>,
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
        row_number: Option<i32> 
    },
    Update { 
        id: String, 
        #[serde(flatten)]
        data: CatalogUpdateRequest, 
        row_number: Option<i32> 
    },
}

#[derive(Deserialize)]
struct BulkCatalogRequest {
    operations: Vec<BulkOperation>,
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
            errors.push(format!("rating ke-{} harus di antara 0 sampai 5", index + 1));
        }

        if rating.review.as_ref().is_some_and(|value| value.trim().len() > 500) {
            errors.push(format!("ulasan rating ke-{} maksimal 500 karakter", index + 1));
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

fn summarize_ratings(ratings: &[ProductRatingEntry], legacy_rating: Option<f64>, legacy_review: Option<String>) -> (Option<f64>, Option<String>, i64) {
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

fn product_to_json(record: ProductRecord, analytics: Option<&ProductAnalyticsSummary>) -> Value {
    let analytics = analytics.cloned().unwrap_or_default();
    let ratings = parse_ratings_or_default(record.ratings.as_deref());
    let (rating_average, latest_review, rating_count) = summarize_ratings(&ratings, record.rating, record.review);
    let conversion_rate = if analytics.views > 0 {
        (analytics.leads as f64 / analytics.views as f64) * 100.0
    } else {
        0.0
    };

    json!({
        "id": record.id,
        "slug": record.slug,
        "name": record.name,
        "category": record.category,
        "subcategory": record.subcategory,
        "price": record.price,
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
    matches!(stock, "available" | "indent" | "hidden" | "limited" | "out_of_stock" | "discontinued")
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
        if let Err(AppError::Validation { errors: rating_errors }) = validate_rating_entries(ratings) {
            errors.extend(rating_errors);
        }
    } else if payload.rating.is_some_and(|value| !(0.0..=5.0).contains(&value)) {
        errors.push("rating harus di antara 0 sampai 5".to_string());
    }
    if let Some(stock) = &payload.stock {
        if !validate_stock(stock) {
            errors.push("stock harus salah satu dari: available, indent, hidden".to_string());
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_catalog_update(payload: &CatalogUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();

    if payload.slug.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("slug tidak boleh kosong".to_string());
    }
    if payload.name.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("name tidak boleh kosong".to_string());
    }
    if payload.category.as_ref().is_some_and(|value| value.trim().is_empty()) {
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
        if let Err(AppError::Validation { errors: rating_errors }) = validate_rating_entries(ratings) {
            errors.extend(rating_errors);
        }
    } else if payload.rating.is_some_and(|value| !(0.0..=5.0).contains(&value)) {
        errors.push("rating harus di antara 0 sampai 5".to_string());
    }
    if payload.stock.as_ref().is_some_and(|value| !validate_stock(value)) {
        errors.push("stock harus salah satu dari: available, indent, hidden".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

async fn find_catalog_by_id_or_slug(state: &AppState, id_or_slug: &str) -> Result<ProductRecord, AppError> {
    sqlx::query_as::<_, ProductRecord>(
        "SELECT id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, colors, ratings, rating, review FROM products WHERE id = ? OR slug = ? LIMIT 1"
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
struct PartnerCreateRequest {
    id: Option<String>,
    name: String,
    logo_url: String,
    website_url: Option<String>,
    sort_order: Option<i64>,
    is_active: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartnerUpdateRequest {
    name: Option<String>,
    logo_url: Option<String>,
    website_url: Option<String>,
    sort_order: Option<i64>,
    is_active: Option<bool>,
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
    if payload.discount.is_some_and(|value| !(0..=100).contains(&value)) {
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
    if payload.title.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("title tidak boleh kosong".to_string());
    }
    if payload.image.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("image tidak boleh kosong".to_string());
    }
    if payload.discount.is_some_and(|value| !(0..=100).contains(&value)) {
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

fn validate_partner_create(payload: &PartnerCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.name.trim().is_empty() {
        errors.push("name wajib diisi".to_string());
    }
    if payload.logo_url.trim().is_empty() {
        errors.push("logoUrl wajib diisi".to_string());
    }
    if payload.sort_order.is_some_and(|value| value < 0) {
        errors.push("sortOrder tidak boleh negatif".to_string());
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(AppError::Validation { errors })
    }
}

fn validate_partner_update(payload: &PartnerUpdateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();
    if payload.name.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("name tidak boleh kosong".to_string());
    }
    if payload.logo_url.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("logoUrl tidak boleh kosong".to_string());
    }
    if payload.sort_order.is_some_and(|value| value < 0) {
        errors.push("sortOrder tidak boleh negatif".to_string());
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
        "SELECT id, name, logo_url, website_url, sort_order, is_active, created_at, updated_at FROM partners WHERE id = ? LIMIT 1"
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
        "SELECT id, name, slug, description, created_at FROM product_categories ORDER BY name ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Categories fetched", json!({ "items": categories })))
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
        "INSERT INTO product_categories (id, name, slug, description) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.name.trim())
    .bind(&slug)
    .bind(payload.description)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    Ok(json_ok("Category created", json!({ "id": id, "slug": slug })))
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
        updates.push(format!("name = '{}', slug = '{}'", name.trim(), name.to_lowercase().replace(' ', "-")));
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

async fn list_catalogs(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let products = sqlx::query_as::<_, ProductRecord>(
        "SELECT id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, colors, ratings, rating, review FROM products"
    )
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    let analytics_rows = sqlx::query(
        "SELECT
            COALESCE(json_extract(metadata, '$.productSlug'), json_extract(metadata, '$.slug')) AS product_slug,
            COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS views,
            COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS leads,
            COALESCE(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS conversions
         FROM telemetry_events
         WHERE COALESCE(json_extract(metadata, '$.productSlug'), json_extract(metadata, '$.slug')) IS NOT NULL
           AND COALESCE(json_extract(metadata, '$.productSlug'), json_extract(metadata, '$.slug')) <> ''
         GROUP BY COALESCE(json_extract(metadata, '$.productSlug'), json_extract(metadata, '$.slug'))"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let analytics_map: HashMap<String, ProductAnalyticsSummary> = analytics_rows
        .into_iter()
        .filter_map(|row| {
            use sqlx::Row;

            let product_slug = row.try_get::<Option<String>, _>("product_slug").ok().flatten()?;
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

    let items: Vec<Value> = products
        .into_iter()
        .map(|product| {
            let analytics = analytics_map.get(&product.slug);
            product_to_json(product, analytics)
        })
        .collect();

    Ok(json_ok("Catalogs fetched", json!({ "items": items })))
}

async fn create_catalog(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<CatalogCreateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    validate_catalog_create(&payload)?;

    let name = payload.name.trim().to_string();
    let slug = payload.slug.as_deref().map(str::trim).filter(|v| !v.is_empty()).map(ToString::to_string)
        .unwrap_or_else(|| name.to_lowercase().replace(' ', "-"));
    let category = payload.category.as_deref().map(str::trim).filter(|v| !v.is_empty()).map(ToString::to_string)
        .unwrap_or_else(|| "Uncategorized".to_string());
    let price = payload.price.unwrap_or(0.0);
    let image = payload.image.as_deref().map(str::trim).filter(|v| !v.is_empty()).map(ToString::to_string)
        .unwrap_or_else(|| "https://placehold.co/600x400?text=No+Image".to_string());

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let images = serde_json::to_string(&payload.images.unwrap_or_else(|| json!([]))).map_err(|_| AppError::Internal)?;
    let specs = serde_json::to_string(&payload.specs.unwrap_or_else(|| json!({}))).map_err(|_| AppError::Internal)?;
    let colors = serde_json::to_string(&payload.colors.unwrap_or_else(|| json!([]))).map_err(|_| AppError::Internal)?;
    let ratings = normalize_ratings_for_storage(payload.ratings.clone(), payload.rating, payload.review.clone())?;
    let ratings_json = serde_json::to_string(&ratings).map_err(|_| AppError::Internal)?;
    let (next_rating, next_review, _) = summarize_ratings(&ratings, payload.rating, payload.review.clone());
    let stock = payload.stock.as_deref().map(str::trim).filter(|v| !v.is_empty()).map(ToString::to_string)
        .unwrap_or_else(|| "available".to_string());

    sqlx::query(
        "INSERT INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, colors, ratings, rating, review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
        json!({ "item": product_to_json(created, None) }),
    ))
}

async fn get_catalog(State(state): State<AppState>, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let item = find_catalog_by_id_or_slug(&state, &id).await?;
    Ok(json_ok("Catalog fetched", json!({ "item": product_to_json(item, None) })))
}

async fn update_catalog(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<CatalogUpdateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    validate_catalog_update(&payload)?;

    let current = find_catalog_by_id_or_slug(&state, &id).await?;
    let next_slug = payload.slug.as_deref().unwrap_or(&current.slug).trim().to_string();
    let next_name = payload.name.as_deref().unwrap_or(&current.name).trim().to_string();
    let next_category = payload.category.as_deref().unwrap_or(&current.category).trim().to_string();
    let next_image = payload.image.as_deref().unwrap_or(&current.image).trim().to_string();
    let next_stock = payload.stock.unwrap_or(current.stock.clone());
    let next_images = serde_json::to_string(&payload.images.unwrap_or_else(|| parse_json_or_default(current.images.as_deref(), json!([]))))
        .map_err(|_| AppError::Internal)?;
    let next_specs = serde_json::to_string(&payload.specs.unwrap_or_else(|| parse_json_or_default(current.specs.as_deref(), json!({}))))
        .map_err(|_| AppError::Internal)?;
    let next_colors = serde_json::to_string(&payload.colors.unwrap_or_else(|| parse_json_or_default(current.colors.as_deref(), json!([]))))
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
        "UPDATE products SET slug = ?, name = ?, category = ?, subcategory = ?, price = ?, price_installment = ?, dp_min = ?, image = ?, images = ?, badge = ?, badge_text = ?, short_desc = ?, description = ?, specs = ?, stock = ?, colors = ?, ratings = ?, rating = ?, review = ? WHERE id = ?"
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
        json!({ "item": product_to_json(updated, None) }),
    ))
}

async fn delete_catalog(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
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

    Ok(json_ok(format!("Catalog {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
}

async fn bulk_products(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BulkCatalogRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    tracing::info!("Starting bulk import for {} operations by {}", payload.operations.len(), user.email);
    
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
                let image = data.image.as_deref().unwrap_or("https://placehold.co/600x400?text=No+Image");
                let slug = data.slug.clone().unwrap_or_else(|| name.to_lowercase().replace(' ', "-"));

                let id = data.id.as_deref().map(str::trim).filter(|v| !v.is_empty()).map(ToString::to_string)
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                
                let images = serde_json::to_string(&data.images.unwrap_or_else(|| json!([]))).unwrap_or_else(|_| "[]".to_string());
                let specs = serde_json::to_string(&data.specs.unwrap_or_else(|| json!({}))).unwrap_or_else(|_| "{}".to_string());
                let colors = serde_json::to_string(&data.colors.unwrap_or_else(|| json!([]))).unwrap_or_else(|_| "[]".to_string());
                let ratings = match normalize_ratings_for_storage(data.ratings.clone(), data.rating, data.review.clone()) {
                    Ok(r) => r,
                    Err(_) => Vec::new(),
                };
                let ratings_json = serde_json::to_string(&ratings).unwrap_or_else(|_| "[]".to_string());
                let (next_rating, next_review, _) = summarize_ratings(&ratings, data.rating, data.review.clone());
                let stock = data.stock.as_deref().unwrap_or("available");

                let result = sqlx::query(
                    "INSERT INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, short_desc, description, specs, stock, colors, ratings, rating, review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
                .bind(colors)
                .bind(ratings_json)
                .bind(next_rating)
                .bind(next_review)
                .execute(&mut *tx)
                .await;

                match result {
                    Ok(_) => success_count += 1,
                    Err(e) => {
                        tracing::error!("Bulk Create Error at row {}: {}", display_row, e);
                        errors.push(format!("Baris {}: Database Error - {}", display_row, e));
                    }
                }
            }
            BulkOperation::Update { id, data, row_number } => {
                let display_row = row_number.unwrap_or(index as i32 + 1);
                let mut query = String::from("UPDATE products SET ");
                let mut updates = Vec::new();
                
                // Using proper parameter binding for safety
                if data.slug.is_some() { updates.push("slug = ?"); }
                if data.name.is_some() { updates.push("name = ?"); }
                if data.category.is_some() { updates.push("category = ?"); }
                if data.subcategory.is_some() { updates.push("subcategory = ?"); }
                if data.price.is_some() { updates.push("price = ?"); }
                if data.price_installment.is_some() { updates.push("price_installment = ?"); }
                if data.dp_min.is_some() { updates.push("dp_min = ?"); }
                if data.image.is_some() { updates.push("image = ?"); }
                if data.stock.is_some() { updates.push("stock = ?"); }
                if data.short_desc.is_some() { updates.push("short_desc = ?"); }
                if data.description.is_some() { updates.push("description = ?"); }

                if updates.is_empty() {
                    success_count += 1;
                    continue;
                }

                query.push_str(&updates.join(", "));
                query.push_str(" WHERE id = ? OR slug = ?");

                let mut q = sqlx::query(&query);
                if let Some(ref val) = data.slug { q = q.bind(val.trim()); }
                if let Some(ref val) = data.name { q = q.bind(val.trim()); }
                if let Some(ref val) = data.category { q = q.bind(val.trim()); }
                if let Some(ref val) = data.subcategory { q = q.bind(val); }
                if let Some(val) = data.price { q = q.bind(val); }
                if let Some(val) = data.price_installment { q = q.bind(val); }
                if let Some(val) = data.dp_min { q = q.bind(val); }
                if let Some(ref val) = data.image { q = q.bind(val.trim()); }
                if let Some(ref val) = data.stock { q = q.bind(val); }
                if let Some(ref val) = data.short_desc { q = q.bind(val); }
                if let Some(ref val) = data.description { q = q.bind(val); }
                
                q = q.bind(&id).bind(&id);

                match q.execute(&mut *tx).await {
                    Ok(_) => success_count += 1,
                    Err(e) => {
                        tracing::error!("Bulk Update Error for ID {} at row {}: {}", id, display_row, e);
                        errors.push(format!("Baris {}: Database Error - {}", display_row, e));
                    }
                }
            }
        }
    }

    tx.commit().await.map_err(|e| {
        tracing::error!("Failed to commit bulk transaction: {}", e);
        AppError::Internal
    })?;

    tracing::info!("Bulk import finished. Success: {}, Errors: {}", success_count, errors.len());
    Ok(json_ok("Bulk operations completed", json!({ "successCount": success_count, "errors": errors })))
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

async fn create_promotion(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<PromotionCreateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    validate_promotion_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let product_ids = serde_json::to_string(&payload.product_ids.unwrap_or_else(|| json!([]))).map_err(|_| AppError::Internal)?;

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

async fn update_promotion(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<PromotionUpdateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    validate_promotion_update(&payload)?;

    let current = find_promotion_by_id(&state, &id).await?;
    let next_title = payload.title.as_deref().unwrap_or(&current.title).trim().to_string();
    let next_image = payload.image.as_deref().unwrap_or(&current.image).trim().to_string();
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

async fn delete_promotion(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
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

    Ok(json_ok(format!("Promotion {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
}

async fn list_partners(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let partners = sqlx::query_as::<_, PartnerRecord>(
        "SELECT id, name, logo_url, website_url, sort_order, is_active, created_at, updated_at FROM partners WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
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

async fn list_admin_partners(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let partners = sqlx::query_as::<_, PartnerRecord>(
        "SELECT id, name, logo_url, website_url, sort_order, is_active, created_at, updated_at FROM partners ORDER BY sort_order ASC, created_at ASC"
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

async fn create_partner(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<PartnerCreateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    validate_partner_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    sqlx::query(
        "INSERT INTO partners (id, name, logo_url, website_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.name.trim())
    .bind(payload.logo_url.trim())
    .bind(payload.website_url)
    .bind(payload.sort_order.unwrap_or(0))
    .bind(payload.is_active.unwrap_or(true))
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
    Json(payload): Json<PartnerUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
    validate_partner_update(&payload)?;

    let current = find_partner_by_id(&state, &id).await?;
    let next_name = payload.name.as_deref().unwrap_or(&current.name).trim().to_string();
    let next_logo = payload.logo_url.as_deref().unwrap_or(&current.logo_url).trim().to_string();

    sqlx::query(
        "UPDATE partners SET name = ?, logo_url = ?, website_url = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(next_name)
    .bind(next_logo)
    .bind(payload.website_url.or(current.website_url))
    .bind(payload.sort_order.unwrap_or(current.sort_order))
    .bind(payload.is_active.unwrap_or(current.is_active))
    .bind(&current.id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = find_partner_by_id(&state, &current.id).await?;
    Ok(json_ok(
        format!("Partner {} updated by {}", current.id, user.email),
        json!({ "item": partner_to_json(updated) }),
    ))
}

async fn delete_partner(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
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
        return Err(AppError::Validation { errors: vec!["title wajib diisi".to_string()] });
    }
    Ok(())
}

fn validate_job_update(payload: &JobUpdateRequest) -> Result<(), AppError> {
    if payload.title.as_ref().is_some_and(|value| value.trim().is_empty()) {
        return Err(AppError::Validation { errors: vec!["title tidak boleh kosong".to_string()] });
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
    if payload.slug.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("slug tidak boleh kosong".to_string());
    }
    if payload.title.as_ref().is_some_and(|value| value.trim().is_empty()) {
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

async fn generate_referral(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<GenerateReferralRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");
    let owner_user_id = if is_admin {
        payload.owner_user_id.unwrap_or_else(|| user.id.clone())
    } else {
        user.id.clone()
    };
    let slug = format!("ref-{}", uuid::Uuid::new_v4().simple());
    let id = uuid::Uuid::new_v4().to_string();
    let target_path = validate_referral_target_path(
        payload.target_path.as_deref().unwrap_or("/"),
    )?;

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

async fn list_referrals(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
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

async fn get_referral(State(state): State<AppState>, headers: HeaderMap, Path(slug): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
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

    Ok(json_ok(format!("Referral {} fetched by {}", slug, user.email), json!({ "item": referral_to_json(row) })))
}

async fn get_referral_stats(State(state): State<AppState>, headers: HeaderMap, Path(slug): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
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

async fn insert_telemetry(state: &AppState, headers: &HeaderMap, event_type: &str, payload: &Value) -> Result<(), AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let path = payload.get("path").and_then(|v| v.as_str()).unwrap_or("/").trim();
    let source = payload.get("source").and_then(|v| v.as_str()).unwrap_or("direct").trim();
    let session_id = payload.get("sessionId").and_then(|v| v.as_str()).unwrap_or("anonymous").trim();
    let metadata_str = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());

    if !path.starts_with('/') || !validate_text_length(path, 2048) {
        return Err(AppError::Validation { errors: vec!["path telemetry tidak valid".to_string()] });
    }
    if !validate_text_length(source, 128) {
        return Err(AppError::Validation { errors: vec!["source telemetry terlalu panjang".to_string()] });
    }
    if !validate_text_length(session_id, 128) {
        return Err(AppError::Validation { errors: vec!["sessionId telemetry terlalu panjang".to_string()] });
    }
    if metadata_str.len() > 8 * 1024 {
        return Err(AppError::Validation { errors: vec!["metadata telemetry terlalu besar".to_string()] });
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
    let is_referral_slug = if source != "direct" && source != "anonymous" && source != "internal" && source != "" {
        let cache_key = format!("referral_slug:{}", source);
        let cached_exists: Option<bool> = state.cache.get(&cache_key).await.unwrap_or(None);
        
        if let Some(exists) = cached_exists {
            exists
        } else {
            let exists = sqlx::query_scalar::<_, String>("SELECT slug FROM referrals WHERE slug = ? LIMIT 1")
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
            "whatsapp_click" | "pixel_event" => "UPDATE referrals SET leads = leads + 1 WHERE slug = ?",
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

async fn page_view(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "page_view", &payload).await?;
    Ok(json_ok("Page view recorded", json!({ "received": payload })))
}

async fn click(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "click", &payload).await?;
    Ok(json_ok("Click recorded", json!({ "received": payload })))
}

async fn whatsapp_click(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "whatsapp_click", &payload).await?;
    Ok(json_ok("WhatsApp click recorded", json!({ "received": payload })))
}

async fn pixel_event(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<Value>) -> Result<ResponseBody, AppError> {
    insert_telemetry(&state, &headers, "pixel_event", &payload).await?;
    Ok(json_ok("Pixel event recorded", json!({ "received": payload })))
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

async fn create_job(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<JobCreateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
    validate_job_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let requirements = serde_json::to_string(&payload.requirements.unwrap_or_else(|| json!([]))).map_err(|_| AppError::Internal)?;
    let benefits = serde_json::to_string(&payload.benefits.unwrap_or_else(|| json!([]))).map_err(|_| AppError::Internal)?;

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

    Ok(json_ok(format!("Job created by {}", user.email), json!({ "item": job_to_json(created) })))
}

async fn update_job(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<JobUpdateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
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
        &payload.requirements.unwrap_or_else(|| parse_json_or_default(current.requirements.as_deref(), json!([]))),
    )
    .map_err(|_| AppError::Internal)?;
    let next_benefits = serde_json::to_string(
        &payload.benefits.unwrap_or_else(|| parse_json_or_default(current.benefits.as_deref(), json!([]))),
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

    Ok(json_ok(format!("Job {} updated by {}", id, user.email), json!({ "item": job_to_json(updated) })))
}

async fn delete_job(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
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
    Ok(json_ok(format!("Job {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
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

async fn create_article(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<ArticleCreateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
    validate_article_create(&payload)?;

    let id = payload
        .id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let tags = serde_json::to_string(&payload.tags.unwrap_or_else(|| json!([]))).map_err(|_| AppError::Internal)?;

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

    Ok(json_ok(format!("Article created by {}", user.email), json!({ "item": article_to_json(created) })))
}

async fn update_article(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<ArticleUpdateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
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
        &payload.tags.unwrap_or_else(|| parse_json_or_default(current.tags.as_deref(), json!([]))),
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

    Ok(json_ok(format!("Article {} updated by {}", id, user.email), json!({ "item": article_to_json(updated) })))
}

async fn delete_article(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Editor]).await?;
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

    Ok(json_ok(format!("Article {} deleted by {}", id, user.email), json!({ "id": id, "deleted": true })))
}

type ResponseBody = axum::response::Response;

async fn list_notifications(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

    let rows = sqlx::query_as::<_, NotificationRecord>(
        "SELECT id, recipient_user_id, type, title, message, action_path, entity_id, is_read, created_at, read_at
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

async fn get_notifications_unread_count(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

    let unread_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE recipient_user_id = ? AND is_read = 0"
    )
    .bind(&user.id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error counting unread notifications: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Unread notifications fetched", json!({ "unreadCount": unread_count })))
}

async fn mark_notification_as_read(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

    let result = sqlx::query(
        "UPDATE notifications
         SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE id = ? AND recipient_user_id = ?"
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

    Ok(json_ok("Notification marked as read", json!({ "id": id, "updated": true })))
}

async fn mark_all_notifications_as_read(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

    let result = sqlx::query(
        "UPDATE notifications
         SET is_read = 1, read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE recipient_user_id = ? AND is_read = 0"
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

async fn list_leads(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");

    let leads = if is_admin {
        sqlx::query_as::<_, LeadRecord>(
            "SELECT id, agent_id, customer_name, phone_number, interested_product, status, notes, created_at, updated_at FROM leads ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, LeadRecord>(
            "SELECT id, agent_id, customer_name, phone_number, interested_product, status, notes, created_at, updated_at FROM leads WHERE agent_id = ? ORDER BY created_at DESC",
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

async fn create_lead(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<LeadCreateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    validate_lead_create(&payload)?;

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
    .bind(payload.phone_number.trim())
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
        Some(&format!("Lead dari {} untuk produk {}", created.customer_name, created.interested_product)),
        Some(&format!("/dashboard/admin/leads?id={}", created.id)),
        Some(&created.id),
    )
    .await;

    Ok(json_ok("Lead submitted successfully", json!({ "item": lead_to_json(created) })))
}

async fn update_lead_status(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<LeadStatusUpdateRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
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
            Some(&format!("Lead {} sekarang berstatus {}", updated.customer_name, updated.status)),
            Some("/dashboard/agent/leads"),
            Some(&updated.id),
        )
        .await;
    }

    // Invalidate leaderboard cache since lead status changes affect points/rankings
    let _ = state.cache.invalidate("leaderboard").await;

    Ok(json_ok(format!("Lead {} status updated", id), json!({ "item": lead_to_json(updated) })))
}

async fn list_support_tickets(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

    let rows = sqlx::query_as::<_, SupportTicketRecord>(
        "SELECT id, agent_id, subject, message, priority, status, created_at FROM support_tickets WHERE agent_id = ? ORDER BY created_at DESC",
    )
    .bind(&user.id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing support tickets: {}", e);
        AppError::Internal
    })?;

    let items = rows.into_iter().map(support_ticket_to_json).collect::<Vec<_>>();
    Ok(json_ok("Support tickets fetched", json!({ "items": items })))
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
        "SELECT id, agent_id, subject, message, priority, status, created_at FROM support_tickets WHERE id = ? LIMIT 1",
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
        Some(&format!("{} membuat ticket: {}", user.name, created.subject)),
        Some("/dashboard/admin/support"),
        Some(&created.id),
    )
    .await;

    Ok(json_ok("Support ticket created", json!({ "item": support_ticket_to_json(created) })))
}

async fn list_admin_support_tickets(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
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
            t.created_at,
            t.updated_at,
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

    Ok(json_ok("Admin support tickets fetched", json!({ "items": items })))
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
        "SELECT id, agent_id, subject, message, priority, status, created_at FROM support_tickets WHERE id = ? LIMIT 1",
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
        Some(&format!("Ticket '{}' berubah ke status {}", updated_ticket.subject, updated_ticket.status)),
        Some(&format!("/dashboard/agent/support?id={}", updated_ticket.id)),
        Some(&updated_ticket.id),
    )
    .await;

    Ok(json_ok("Support ticket status updated", json!({ "id": id, "updated": true })))
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

async fn list_agents(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
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
            u.created_at as joined_at
        FROM users u
        LEFT JOIN agent_stats s ON s.user_id = u.id
        LEFT JOIN reward_tiers t ON t.id = s.current_tier_id
        LEFT JOIN agent_registrations r ON r.email = u.email
        WHERE u.role = 'agent'
        ORDER BY u.created_at DESC
        "#
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error listing agents: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Agents fetched successfully", json!({ "items": rows })))
}

async fn list_leaderboard(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
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
    if let Ok(Some(cached_items)) = state.cache.get::<Vec<AgentDirectoryRow>>("leaderboard").await {
        if is_admin {
            return Ok(json_ok("Leaderboard fetched from cache", json!({ "items": cached_items })));
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
            u.created_at as joined_at
        FROM users u
        LEFT JOIN agent_stats s ON s.user_id = u.id
        LEFT JOIN reward_tiers t ON t.id = s.current_tier_id
        LEFT JOIN agent_registrations r ON r.email = u.email
        WHERE u.role = 'agent'
        ORDER BY points DESC, total_sales DESC, u.created_at ASC
        "#
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
        return Ok(json_ok("Leaderboard fetched successfully", json!({ "items": rows })));
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
    matches!(status, "pending" | "reviewed" | "accepted" | "rejected" | "hired")
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
    let slugs: Vec<String> = sqlx::query_scalar("SELECT slug FROM referrals WHERE owner_user_id = ?")
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
        let placeholders = slugs.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect::<Vec<_>>().join(",");
        let query = format!(
            "SELECT strftime('%Y-%m-%d', created_at) AS day, COUNT(*) AS count 
             FROM telemetry_events 
             WHERE source IN ({}) 
               AND created_at >= datetime('now', '-6 days') 
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
        "SELECT strftime('%Y-%m-%d', created_at) AS day, COUNT(*) AS count 
         FROM leads 
         WHERE agent_id = ? 
           AND created_at >= datetime('now', '-6 days') 
         GROUP BY day"
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
        stats.insert(date_str.clone(), json!({ "day": day_name, "date": date_str, "activity": 0, "leads": 0 }));
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

    Ok(json_ok("Agent performance fetched", json!({ "items": result })))
}

async fn get_agent_stats(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

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

async fn list_claims(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;
    let is_admin = user.role.eq_ignore_ascii_case("admin");

    let rows = if is_admin {
        sqlx::query_as::<_, ClaimRow>(
            "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, c.submitted_at, c.processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id ORDER BY c.submitted_at DESC"
        )
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query_as::<_, ClaimRow>(
            "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, c.submitted_at, c.processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id WHERE c.agent_id = ? ORDER BY c.submitted_at DESC"
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Claims fetched", json!({ "items": rows.into_iter().map(claim_to_json).collect::<Vec<_>>() })))
}

async fn create_claim(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<CreateClaimRequest>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Agent]).await?;

    let mut errors = Vec::new();
    if payload.tier_id.trim().is_empty() {
        errors.push("tierId wajib diisi".to_string());
    }
    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }

    let tier_name: Option<String> = sqlx::query_scalar("SELECT name FROM reward_tiers WHERE id = ? AND is_active = 1 LIMIT 1")
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
        "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, c.submitted_at, c.processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id WHERE c.id = ? LIMIT 1"
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
        Some(&format!("{} mengajukan klaim {}", user.name, created.reward_name)),
        Some(&format!("/dashboard/admin/finance?id={}", created.id)),
        Some(&created.id),
    )
    .await;

    Ok(json_ok("Reward claimed successfully", json!({ "item": claim_to_json(created) })))
}

async fn submit_agent_registration(State(state): State<AppState>, headers: HeaderMap, mut multipart: Multipart) -> Result<ResponseBody, AppError> {
    let mut full_name = String::new();
    let mut email = String::new();
    let mut whatsapp = String::new();
    let mut province = String::new();
    let mut city = String::new();
    let mut address = String::new();
    let mut preferred_products = String::new();
    let mut profile_photo_url: Option<String> = None;
    let mut ktp_photo_url: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|_| AppError::Internal)? {
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

                    let file_id = uuid::Uuid::new_v4().to_string();
                    let file_name = format!("{}_profile.webp", file_id);
                    let file_path = format!("uploads/{}", file_name);

                    img.save_with_format(&file_path, image::ImageFormat::WebP).map_err(|e| {
                        tracing::error!("Failed to save profile photo as webp: {}", e);
                        AppError::Internal
                    })?;

                    profile_photo_url = Some(format!("/uploads/{}", file_name));
                }
            },
            "ktpPhoto" => {
                let data = field.bytes().await.map_err(|_| AppError::Internal)?;
                if !data.is_empty() {
                    if data.len() > 5 * 1024 * 1024 {
                        return Err(AppError::Validation {
                            errors: vec!["Foto KTP maksimal 5MB".to_string()],
                        });
                    }
                    let img = decode_uploaded_image(&data)?;

                    let file_id = uuid::Uuid::new_v4().to_string();
                    let file_name = format!("{}_ktp.webp", file_id);
                    let file_path = format!("uploads/{}", file_name);

                    img.save_with_format(&file_path, image::ImageFormat::WebP).map_err(|e| {
                        tracing::error!("Failed to save KTP photo as webp: {}", e);
                        AppError::Internal
                    })?;

                    // TODO(security): KTP saat ini di-serve dari ServeDir publik untuk
                    // kompatibilitas dashboard admin yang memuat <img src>. UUID nama file
                    // sulit ditebak, namun idealnya KTP dilayani via endpoint admin
                    // ber-auth dengan signed URL singkat. Tidak diubah agar tidak merusak
                    // halaman AdminAgentsPage saat ini.
                    ktp_photo_url = Some(format!("/uploads/{}", file_name));
                }
            },
            _ => {}
        }
    }

    // Basic validation
    let mut errors = Vec::new();
    if full_name.trim().is_empty() { errors.push("Nama lengkap wajib diisi".to_string()); }
    if email.trim().is_empty() || !email.contains('@') { errors.push("Email tidak valid".to_string()); }
    if whatsapp.trim().is_empty() { errors.push("Nomor WhatsApp wajib diisi".to_string()); }
    if province.trim().is_empty() { errors.push("Provinsi wajib diisi".to_string()); }
    if city.trim().is_empty() { errors.push("Kota wajib diisi".to_string()); }
    if !validate_text_length(&full_name, 120) { errors.push("Nama lengkap terlalu panjang".to_string()); }
    if !validate_text_length(&email, 254) { errors.push("Email terlalu panjang".to_string()); }
    if !validate_text_length(&whatsapp, 32) { errors.push("Nomor WhatsApp terlalu panjang".to_string()); }
    if !validate_text_length(&province, 80) { errors.push("Provinsi terlalu panjang".to_string()); }
    if !validate_text_length(&city, 80) { errors.push("Kota terlalu panjang".to_string()); }
    if !validate_text_length(&address, 1000) { errors.push("Alamat terlalu panjang".to_string()); }
    if !validate_text_length(&preferred_products, 1000) { errors.push("Preferensi produk terlalu panjang".to_string()); }
    
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

    Ok(json_ok("Pendaftaran agen berhasil dikirim", json!({ "id": id, "status": "pending" })))
}

async fn list_agent_registrations(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let rows = sqlx::query_as::<_, AgentRegistrationRow>(
        "SELECT id, full_name, email, whatsapp, province, city, address, preferred_products, profile_photo, ktp_photo, status, submitted_at FROM agent_registrations ORDER BY submitted_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    tracing::info!("Fetched {} agent registrations", rows.len());
    let items: Vec<Value> = rows.into_iter().map(registration_to_json).collect();
    Ok(json_ok("Agent registrations fetched", json!({ "items": items })))
}

async fn update_agent_registration_status(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<AgentRegistrationStatusRequest>) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let status = payload.status.trim().to_lowercase();
    if !is_valid_registration_status(&status) {
        return Err(AppError::Validation {
            errors: vec!["status registration tidak valid".to_string()],
        });
    }

    if status == "approved" {
        let registration = sqlx::query_as::<_, AgentRegistrationRow>(
            "SELECT id, full_name, email, whatsapp, province, city, address, preferred_products, profile_photo, ktp_photo, status, submitted_at FROM agent_registrations WHERE id = ? LIMIT 1"
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

    let registration_email: Option<String> = sqlx::query_scalar("SELECT email FROM agent_registrations WHERE id = ? LIMIT 1")
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
        let agent_user_id = sqlx::query_scalar::<_, String>("SELECT id FROM users WHERE email = ? LIMIT 1")
            .bind(&email)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching user for registration notification: {}", e);
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

    Ok(json_ok(format!("Agent registration {} status updated", id), json!({ "updated": true, "status": status })))
}

async fn list_all_claims(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let rows = sqlx::query_as::<_, ClaimRow>(
        "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, c.submitted_at, c.processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id ORDER BY c.submitted_at DESC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("All Gamification Claims fetched", json!({ "items": rows.into_iter().map(claim_to_json).collect::<Vec<_>>() })))
}

async fn update_claim_status(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<ClaimStatusRequest>) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;
    let status = payload.status.trim().to_lowercase();
    if !is_valid_claim_status(&status) {
        return Err(AppError::Validation {
            errors: vec!["status claim tidak valid".to_string()],
        });
    }

    let result = if matches!(status.as_str(), "completed" | "cancelled") {
        sqlx::query("UPDATE reward_claims SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?")
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
        "SELECT c.id, c.agent_id, c.tier_id, c.reward_name, t.reward_value, c.status, c.submitted_at, c.processed_at, u.name AS agent_name FROM reward_claims c LEFT JOIN users u ON u.id = c.agent_id LEFT JOIN reward_tiers t ON t.id = c.tier_id WHERE c.id = ? LIMIT 1"
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
        Some(&format!("Klaim '{}' berubah ke status {}", updated_claim.reward_name, updated_claim.status)),
        Some(&format!("/dashboard/agent/earnings?id={}", updated_claim.id)),
        Some(&updated_claim.id),
    )
    .await;

    Ok(json_ok(format!("Claim {} status updated", id), json!({ "updated": true, "status": status })))
}

async fn get_telemetry_stats(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let traffic_rows = sqlx::query(
        "WITH RECURSIVE days(day) AS (
            SELECT date('now', '-6 days')
            UNION ALL
            SELECT date(day, '+1 day') FROM days WHERE day < date('now')
         )
         SELECT d.day,
                COALESCE(SUM(CASE WHEN e.event_type = 'click' THEN 1 ELSE 0 END), 0) AS clicks,
                COALESCE(SUM(CASE WHEN e.event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS leads,
                COALESCE(SUM(CASE WHEN e.event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS conversions
         FROM days d
         LEFT JOIN telemetry_events e ON strftime('%Y-%m-%d', e.created_at) = d.day
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
            SELECT strftime('%Y-%m', date('now', '-150 days'))
            UNION ALL
            SELECT strftime('%Y-%m', date(month || '-01', '+1 month')) FROM months WHERE month < strftime('%Y-%m', 'now')
         )
         SELECT m.month,
                COALESCE(COUNT(DISTINCT e.session_id || e.path), 0) AS views
         FROM months m
         LEFT JOIN telemetry_events e ON strftime('%Y-%m', e.created_at) = m.month AND e.event_type = 'page_view'
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
                COUNT(DISTINCT session_id || path) AS clicks,
                COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS leads
         FROM telemetry_events
         GROUP BY COALESCE(source, 'unknown')
         ORDER BY clicks DESC
         LIMIT 5"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let top_content_rows = sqlx::query(
        "SELECT
            COALESCE(json_extract(metadata, '$.contentType'), json_extract(metadata, '$.pageType'), 'page') AS content_type,
            COALESCE(json_extract(metadata, '$.contentKey'), json_extract(metadata, '$.pageKey'), path) AS content_key,
            COALESCE(json_extract(metadata, '$.contentTitle'), json_extract(metadata, '$.pageLabel'), json_extract(metadata, '$.contentSlug'), path) AS content_title,
            COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS views,
            COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clicks,
            COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS leads
         FROM telemetry_events
         WHERE COALESCE(json_extract(metadata, '$.contentKey'), json_extract(metadata, '$.pageKey'), path) IS NOT NULL
           AND COALESCE(json_extract(metadata, '$.contentKey'), json_extract(metadata, '$.pageKey'), path) <> ''
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
            COUNT(*) AS total_events,
            COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END), 0) AS events_24h,
            COUNT(DISTINCT path) AS total_paths,
            COALESCE(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS total_conversions
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

async fn list_job_applications(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;
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
    Ok(json_ok("Job applications fetched", json!({ "items": applications })))
}

async fn create_job_application(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<JobApplicationCreateRequest>) -> Result<ResponseBody, AppError> {
    let id = format!("app-{}", uuid::Uuid::new_v4().simple());
    let applied_at = Utc::now().naive_local().date().format("%Y-%m-%d").to_string();

    let mut errors = Vec::new();
    if payload.job_id.trim().is_empty() { errors.push("jobId wajib diisi".to_string()); }
    if payload.job_title.trim().is_empty() { errors.push("jobTitle wajib diisi".to_string()); }
    if payload.full_name.trim().is_empty() { errors.push("fullName wajib diisi".to_string()); }
    if payload.email.trim().is_empty() || !payload.email.contains('@') { errors.push("Email tidak valid".to_string()); }
    if payload.phone.trim().is_empty() { errors.push("phone wajib diisi".to_string()); }
    if !validate_text_length(&payload.job_id, 80) { errors.push("jobId terlalu panjang".to_string()); }
    if !validate_text_length(&payload.job_title, 150) { errors.push("jobTitle terlalu panjang".to_string()); }
    if !validate_text_length(&payload.full_name, 120) { errors.push("fullName terlalu panjang".to_string()); }
    if !validate_text_length(&payload.email, 254) { errors.push("Email terlalu panjang".to_string()); }
    if !validate_text_length(&payload.phone, 32) { errors.push("phone terlalu panjang".to_string()); }
    if let Some(address) = payload.address.as_deref() {
        if !validate_text_length(address, 1000) { errors.push("address terlalu panjang".to_string()); }
    }
    if let Some(education) = payload.education.as_deref() {
        if !validate_text_length(education, 255) { errors.push("education terlalu panjang".to_string()); }
    }
    if let Some(major) = payload.major.as_deref() {
        if !validate_text_length(major, 255) { errors.push("major terlalu panjang".to_string()); }
    }
    if let Some(experience) = payload.experience.as_deref() {
        if !validate_text_length(experience, 2000) { errors.push("experience terlalu panjang".to_string()); }
    }
    if let Some(cover_letter) = payload.cover_letter.as_deref() {
        if !validate_text_length(cover_letter, 5000) { errors.push("coverLetter terlalu panjang".to_string()); }
    }
    if let Some(linked_in) = payload.linked_in.as_deref() {
        if !linked_in.trim().is_empty() && (!is_allowed_public_url(linked_in) || !validate_text_length(linked_in, 2048)) {
            errors.push("linkedIn harus berupa URL http/https yang valid".to_string());
        }
    }
    if let Some(portfolio_url) = payload.portfolio_url.as_deref() {
        if !portfolio_url.trim().is_empty() && (!is_allowed_public_url(portfolio_url) || !validate_text_length(portfolio_url, 2048)) {
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
            &format!("job_application:email:{}", payload.email.trim().to_lowercase()),
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

    // Send a notification to admins about a new application
    if let Err(e) = sqlx::query("INSERT INTO notifications (id, type, title, message, url, recipient_role) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind("new_lead")
        .bind("Lamaran Baru")
        .bind(format!("Ada lamaran baru dari {} untuk posisi {}.", payload.full_name, payload.job_title))
        .bind("/dashboard/admin/careers")
        .bind("admin")
        .execute(&state.pool).await {
        tracing::error!("Failed to create notification for new job application: {}", e);
    }

    Ok(json_ok("Application submitted successfully", json!({ "id": id })))
}

async fn update_job_application_status(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>, Json(payload): Json<JobApplicationStatusUpdateRequest>) -> Result<ResponseBody, AppError> {
    authorize(&state, &headers, &[Role::Admin, Role::Editor, Role::Operator]).await?;

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
    
    Ok(json_ok("Application status updated", json!({ "id": id, "updated": true })))
}

