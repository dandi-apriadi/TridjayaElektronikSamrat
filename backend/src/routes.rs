use crate::{
    auth::{authorize, hash_password, login_with_request, logout_with_headers, refresh_with_request, verify_password, LoginRequest, RefreshRequest, Role},
    response::{json_ok, AppError},
    state::{AppState, UserPublic},
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
        .route("/api/auth/profile", patch(update_auth_profile))
        .route("/api/auth/change-password", post(change_auth_password))
        .route("/api/users", get(list_users).post(create_user))
        .route("/api/users/{id}", get(get_user).patch(update_user).delete(delete_user))
        .route("/api/users/{id}/reset-password", post(reset_user_password))
        .route("/api/reward-tiers", get(list_reward_tiers))
        .route("/api/admin/uploads/image", post(upload_admin_image))
        .route("/api/catalogs", get(list_catalogs).post(create_catalog))
        .route("/api/catalogs/{id}", get(get_catalog).patch(update_catalog).delete(delete_catalog))
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
        .with_state(state)
}

async fn health() -> ResponseBody {
    json_ok("OK", json!({ "status": "healthy" }))
}

const LOGIN_EMAIL_MAX_PER_MINUTE: usize = 5;
const LOGIN_IP_MAX_PER_MINUTE: usize = 20;
const LOGIN_IP_MAX_PER_10_MINUTES: usize = 100;
const LOGIN_BLOCK_MINUTES: i64 = 15;

fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
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

fn build_refresh_cookie(token: &str) -> String {
    let secure = cookie_secure_enabled();
    let same_site = if secure { "None" } else { "Lax" };
    let secure_attr = if secure { "; Secure" } else { "" };
    format!(
        "refresh_token={}; HttpOnly; Path=/api/auth; Max-Age=604800; SameSite={}{}",
        token, same_site, secure_attr
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
    let mut response = json_ok("Login successful", auth);
    append_set_cookie(&mut response, &build_refresh_cookie(&refresh_token));
    Ok(response)
}

async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    logout_with_headers(&state, &headers).await?;
    let mut response = json_ok("Logout successful", json!({ "logged_out": true }));
    append_set_cookie(&mut response, &build_clear_refresh_cookie());
    Ok(response)
}

async fn refresh(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<RefreshRequest>) -> Result<ResponseBody, AppError> {
    let refresh_token = if payload.refresh_token.trim().is_empty() {
        extract_cookie_token(&headers, "refresh_token").ok_or(AppError::Unauthorized)?
    } else {
        payload.refresh_token
    };

    let auth = refresh_with_request(&state, RefreshRequest { refresh_token }).await?;
    let new_refresh_token = auth.refresh_token.clone();
    let mut response = json_ok("Token refreshed", auth);
    append_set_cookie(&mut response, &build_refresh_cookie(&new_refresh_token));
    Ok(response)
}

async fn forgot_password() -> ResponseBody {
    json_ok("If the account exists, reset instructions will be sent", json!({ "accepted": true }))
}

async fn reset_password() -> ResponseBody {
    json_ok("Password reset completed", json!({ "reset": true }))
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
struct VerifyEmailRequest {
    email: String,
}

async fn update_auth_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<AuthProfileUpdateRequest>,
) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent, Role::Editor, Role::Operator]).await?;

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
    let user = authorize(&state, &headers, &[Role::Admin, Role::Agent, Role::Editor, Role::Operator]).await?;

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
    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
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
    let users: Vec<UserPublic> = sqlx::query_as("SELECT id, email, name, role, avatar, bank_account, created_at, last_login, is_active, is_verified FROM users")
        .fetch_all(&state.pool)
        .await
        .map_err(|_| AppError::Internal)?;
        
    Ok(json_ok(format!("Users fetched by {}", user.email), json!({ "items": users })))
}

async fn verify_email(State(state): State<AppState>, Json(payload): Json<VerifyEmailRequest>) -> Result<ResponseBody, AppError> {
    let email = payload.email.trim().to_lowercase();
    let result = sqlx::query("UPDATE users SET is_verified = 1 WHERE email = ?")
        .bind(&email)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error verifying email: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserUpdateRequest {
    email: Option<String>,
    name: Option<String>,
    role: Option<String>,
    password: Option<String>,
    avatar: Option<String>,
    bank_account: Option<String>,
    is_active: Option<bool>,
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

fn normalize_role(value: &str) -> Option<String> {
    let role = value.trim().to_lowercase();
    if matches!(role.as_str(), "admin" | "agent" | "editor" | "operator") {
        Some(role)
    } else {
        None
    }
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
        errors.push("role harus salah satu dari: admin, agent, editor, operator".to_string());
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
        errors.push("role harus salah satu dari: admin, agent, editor, operator".to_string());
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

async fn find_user_public_by_id(state: &AppState, id: &str) -> Result<UserPublic, AppError> {
    sqlx::query_as::<_, UserPublic>(
        "SELECT id, email, name, role, avatar, bank_account, created_at, last_login, is_active, is_verified FROM users WHERE id = ? LIMIT 1",
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
        "INSERT INTO users (id, email, name, role, password_hash, avatar, bank_account, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(payload.email.trim())
    .bind(payload.name.trim())
    .bind(role)
    .bind(password_hash)
    .bind(payload.avatar.unwrap_or_else(|| "".to_string()))
    .bind(payload.bank_account.unwrap_or_else(|| "".to_string()))
    .bind(payload.is_active.unwrap_or(true))
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
    validate_user_update(&payload)?;

    let current = sqlx::query_as::<_, (String, String, String, String, String, String, bool)>(
        "SELECT email, name, role, password_hash, avatar, bank_account, is_active FROM users WHERE id = ? LIMIT 1",
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let next_email = payload.email.unwrap_or(current.0);
    let next_name = payload.name.unwrap_or(current.1);
    let next_role = payload
        .role
        .as_deref()
        .and_then(normalize_role)
        .unwrap_or(current.2);
    let next_password_hash = payload
        .password
        .as_deref()
        .map(hash_password)
        .unwrap_or(current.3);
    let next_avatar = payload.avatar.unwrap_or(current.4);
    let next_bank_account = payload.bank_account.unwrap_or(current.5);
    let next_is_active = payload.is_active.unwrap_or(current.6);

    sqlx::query(
        "UPDATE users SET email = ?, name = ?, role = ?, password_hash = ?, avatar = ?, bank_account = ?, is_active = ? WHERE id = ?",
    )
    .bind(next_email.trim())
    .bind(next_name.trim())
    .bind(next_role)
    .bind(next_password_hash)
    .bind(next_avatar)
    .bind(next_bank_account)
    .bind(next_is_active)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

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
    let result = sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
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

    // Send password reset email
    if let Err(e) = state.mailer.send_password_reset_email(&target_user.email, &target_user.name, payload.password.trim()).await {
        tracing::error!("Failed to send password reset email to {}: {}", target_user.email, e);
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
        let image = image::load_from_memory(&data).map_err(|e| {
            tracing::error!("Failed to load upload image {}: {}", file_name_orig, e);
            AppError::Validation { errors: vec!["Format file gambar tidak didukung".to_string()] }
        })?;

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

async fn delete_user(State(state): State<AppState>, headers: HeaderMap, Path(id): Path<String>) -> Result<ResponseBody, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;
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
    rating: f64,
    review_count: i64,
    short_desc: Option<String>,
    description: Option<String>,
    specs: Option<String>,
    stock: String,
    colors: Option<String>,
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
    slug: String,
    name: String,
    category: String,
    subcategory: Option<String>,
    price: f64,
    price_installment: Option<f64>,
    dp_min: Option<f64>,
    image: String,
    images: Option<Value>,
    badge: Option<String>,
    badge_text: Option<String>,
    rating: Option<f64>,
    review_count: Option<i64>,
    short_desc: Option<String>,
    description: Option<String>,
    specs: Option<Value>,
    stock: Option<String>,
    colors: Option<Value>,
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
    rating: Option<f64>,
    review_count: Option<i64>,
    short_desc: Option<String>,
    description: Option<String>,
    specs: Option<Value>,
    stock: Option<String>,
    colors: Option<Value>,
}

fn parse_json_or_default(raw: Option<&str>, fallback: Value) -> Value {
    raw.and_then(|value| serde_json::from_str::<Value>(value).ok())
        .unwrap_or(fallback)
}

fn product_to_json(record: ProductRecord, analytics: Option<&ProductAnalyticsSummary>) -> Value {
    let analytics = analytics.cloned().unwrap_or_default();
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
        "rating": record.rating,
        "reviewCount": record.review_count,
        "shortDesc": record.short_desc,
        "description": record.description,
        "specs": parse_json_or_default(record.specs.as_deref(), json!({})),
        "stock": record.stock,
        "colors": parse_json_or_default(record.colors.as_deref(), json!([])),
        "views": analytics.views,
        "leads": analytics.leads,
        "conversions": analytics.conversions,
        "conversionRate": conversion_rate,
    })
}

fn validate_stock(stock: &str) -> bool {
    matches!(stock, "available" | "indent" | "hidden")
}

fn validate_catalog_create(payload: &CatalogCreateRequest) -> Result<(), AppError> {
    let mut errors = Vec::new();

    if payload.slug.trim().is_empty() {
        errors.push("slug wajib diisi".to_string());
    }
    if payload.name.trim().is_empty() {
        errors.push("name wajib diisi".to_string());
    }
    if payload.category.trim().is_empty() {
        errors.push("category wajib diisi".to_string());
    }
    if payload.image.trim().is_empty() {
        errors.push("image wajib diisi".to_string());
    }
    if payload.price < 0.0 {
        errors.push("price tidak boleh negatif".to_string());
    }
    if payload.price_installment.is_some_and(|value| value < 0.0) {
        errors.push("priceInstallment tidak boleh negatif".to_string());
    }
    if payload.dp_min.is_some_and(|value| value < 0.0) {
        errors.push("dpMin tidak boleh negatif".to_string());
    }
    if payload.rating.is_some_and(|value| !(0.0..=5.0).contains(&value)) {
        errors.push("rating harus di antara 0 sampai 5".to_string());
    }
    if payload.review_count.is_some_and(|value| value < 0) {
        errors.push("reviewCount tidak boleh negatif".to_string());
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
    if payload.image.as_ref().is_some_and(|value| value.trim().is_empty()) {
        errors.push("image tidak boleh kosong".to_string());
    }
    if payload.price.is_some_and(|value| value < 0.0) {
        errors.push("price tidak boleh negatif".to_string());
    }
    if payload.price_installment.is_some_and(|value| value < 0.0) {
        errors.push("priceInstallment tidak boleh negatif".to_string());
    }
    if payload.dp_min.is_some_and(|value| value < 0.0) {
        errors.push("dpMin tidak boleh negatif".to_string());
    }
    if payload.rating.is_some_and(|value| !(0.0..=5.0).contains(&value)) {
        errors.push("rating harus di antara 0 sampai 5".to_string());
    }
    if payload.review_count.is_some_and(|value| value < 0) {
        errors.push("reviewCount tidak boleh negatif".to_string());
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
        "SELECT id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, rating, review_count, short_desc, description, specs, stock, colors FROM products WHERE id = ? OR slug = ? LIMIT 1"
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

async fn list_catalogs(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let products = sqlx::query_as::<_, ProductRecord>(
        "SELECT id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, rating, review_count, short_desc, description, specs, stock, colors FROM products"
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
    let stock = payload.stock.unwrap_or_else(|| "available".to_string());

    sqlx::query(
        "INSERT INTO products (id, slug, name, category, subcategory, price, price_installment, dp_min, image, images, badge, badge_text, rating, review_count, short_desc, description, specs, stock, colors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(payload.slug.trim())
    .bind(payload.name.trim())
    .bind(payload.category.trim())
    .bind(payload.subcategory)
    .bind(payload.price)
    .bind(payload.price_installment)
    .bind(payload.dp_min)
    .bind(payload.image.trim())
    .bind(images)
    .bind(payload.badge)
    .bind(payload.badge_text)
    .bind(payload.rating.unwrap_or(4.5))
    .bind(payload.review_count.unwrap_or(0))
    .bind(payload.short_desc)
    .bind(payload.description)
    .bind(specs)
    .bind(stock)
    .bind(colors)
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

    sqlx::query(
        "UPDATE products SET slug = ?, name = ?, category = ?, subcategory = ?, price = ?, price_installment = ?, dp_min = ?, image = ?, images = ?, badge = ?, badge_text = ?, rating = ?, review_count = ?, short_desc = ?, description = ?, specs = ?, stock = ?, colors = ? WHERE id = ?"
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
    .bind(payload.rating.unwrap_or(current.rating))
    .bind(payload.review_count.unwrap_or(current.review_count))
    .bind(payload.short_desc.or(current.short_desc))
    .bind(payload.description.or(current.description))
    .bind(next_specs)
    .bind(next_stock)
    .bind(next_colors)
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
    let target_path = payload.target_path.unwrap_or_else(|| "/".to_string());

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

async fn insert_telemetry(state: &AppState, event_type: &str, payload: &Value) {
    let id = uuid::Uuid::new_v4().to_string();
    let path = payload.get("path").and_then(|v| v.as_str()).unwrap_or("/");
    let source = payload.get("source").and_then(|v| v.as_str()).unwrap_or("direct");
    let session_id = payload.get("sessionId").and_then(|v| v.as_str()).unwrap_or("anonymous");
    let metadata_str = serde_json::to_string(payload).unwrap_or_else(|_| "{}".to_string());

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

    // Update referral counters if source matches a referral slug
    if source != "direct" && source != "anonymous" && !source.is_empty() {
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
}

async fn page_view(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    insert_telemetry(&state, "page_view", &payload).await;
    json_ok("Page view recorded", json!({ "received": payload }))
}

async fn click(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    insert_telemetry(&state, "click", &payload).await;
    json_ok("Click recorded", json!({ "received": payload }))
}

async fn whatsapp_click(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    insert_telemetry(&state, "whatsapp_click", &payload).await;
    json_ok("WhatsApp click recorded", json!({ "received": payload }))
}

async fn pixel_event(State(state): State<AppState>, Json(payload): Json<Value>) -> ResponseBody {
    insert_telemetry(&state, "pixel_event", &payload).await;
    json_ok("Pixel event recorded", json!({ "received": payload }))
}

async fn list_jobs(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let jobs = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at FROM job_listings ORDER BY created_at DESC"
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
        "INSERT INTO job_listings (id, title, department, location, type, level, description, requirements, benefits, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let created = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at FROM job_listings WHERE id = ? LIMIT 1"
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
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at FROM job_listings WHERE id = ? LIMIT 1"
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
        "UPDATE job_listings SET title = ?, department = ?, location = ?, type = ?, level = ?, description = ?, requirements = ?, benefits = ?, posted_at = ? WHERE id = ?"
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
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(map_conflict_if_needed)?;

    let updated = sqlx::query_as::<_, JobRecord>(
        "SELECT id, title, department, location, type, level, description, requirements, benefits, posted_at FROM job_listings WHERE id = ? LIMIT 1"
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

#[derive(sqlx::FromRow, serde::Serialize)]
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
    let _user = authorize(&state, &headers, &[Role::Admin, Role::Agent]).await?;

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

    Ok(json_ok("Leaderboard fetched successfully", json!({ "items": rows })))
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
    if payload.reward_name.trim().is_empty() {
        errors.push("rewardName wajib diisi".to_string());
    }
    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
    }

    let tier_exists: Option<String> = sqlx::query_scalar("SELECT id FROM reward_tiers WHERE id = ? AND is_active = 1 LIMIT 1")
        .bind(payload.tier_id.trim())
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    if tier_exists.is_none() {
        return Err(AppError::Validation {
            errors: vec!["tierId tidak ditemukan atau tidak aktif".to_string()],
        });
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO reward_claims (id, agent_id, tier_id, reward_name, status) VALUES (?, ?, ?, ?, 'pending')"
    )
    .bind(&id)
    .bind(&user.id)
    .bind(payload.tier_id.trim())
    .bind(payload.reward_name.trim())
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

    Ok(json_ok("Reward claimed successfully", json!({ "item": claim_to_json(created) })))
}

async fn submit_agent_registration(State(state): State<AppState>, mut multipart: Multipart) -> Result<ResponseBody, AppError> {
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
                    let img = image::load_from_memory(&data).map_err(|e| {
                        tracing::error!("Failed to load profile photo: {}", e);
                        AppError::Validation { errors: vec!["Format file gambar tidak didukung".to_string()] }
                    })?;
                    
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
                    let img = image::load_from_memory(&data).map_err(|e| {
                        tracing::error!("Failed to load KTP photo: {}", e);
                        AppError::Validation { errors: vec!["Format file gambar tidak didukung".to_string()] }
                    })?;
                    
                    let file_id = uuid::Uuid::new_v4().to_string();
                    let file_name = format!("{}_ktp.webp", file_id);
                    let file_path = format!("uploads/{}", file_name);
                    
                    img.save_with_format(&file_path, image::ImageFormat::WebP).map_err(|e| {
                        tracing::error!("Failed to save KTP photo as webp: {}", e);
                        AppError::Internal
                    })?;
                    
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
    
    if !errors.is_empty() {
        return Err(AppError::Validation { errors });
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

            if user_exists.is_none() {
                let user_id = uuid::Uuid::new_v4().to_string();
                let temp_password = uuid::Uuid::new_v4().to_string();
                let password_hash = hash_password(&temp_password);

                sqlx::query(
                    "INSERT INTO users (id, email, name, role, password_hash, avatar, bank_account, is_active, is_verified) VALUES (?, ?, ?, 'agent', ?, ?, '', 1, 0)"
                )
                .bind(&user_id)
                .bind(&registration.email)
                .bind(&registration.full_name)
                .bind(password_hash)
                .bind(registration.profile_photo.unwrap_or_default())
                .execute(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("DB error creating user from approved registration: {}", e);
                    AppError::Internal
                })?;
                
                tracing::info!("Created user {} for approved agent {}", user_id, registration.email);

                // Send verification email
                let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| "http://localhost:5174".to_string());
                let verification_link = format!("{}/verify-email?email={}", frontend_url, urlencoding::encode(&registration.email));
                
                if let Err(e) = state.mailer.send_verification_email(&registration.email, &registration.full_name, &verification_link).await {
                    tracing::error!("Failed to send verification email to {}: {}", registration.email, e);
                }
            }
        }
    }

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

    Ok(json_ok(format!("Claim {} status updated", id), json!({ "updated": true, "status": status })))
}

async fn get_telemetry_stats(State(state): State<AppState>, headers: HeaderMap) -> Result<ResponseBody, AppError> {
    let _user = authorize(&state, &headers, &[Role::Admin]).await?;

    let traffic_rows = sqlx::query(
        "SELECT strftime('%Y-%m-%d', created_at) AS day,
                COALESCE(SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END), 0) AS clicks,
                COALESCE(SUM(CASE WHEN event_type = 'whatsapp_click' THEN 1 ELSE 0 END), 0) AS leads,
                COALESCE(SUM(CASE WHEN event_type = 'pixel_event' THEN 1 ELSE 0 END), 0) AS conversions
         FROM telemetry_events
         WHERE created_at >= datetime('now', '-6 days')
         GROUP BY strftime('%Y-%m-%d', created_at)
         ORDER BY day ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let monthly_rows = sqlx::query(
        "SELECT strftime('%Y-%m', created_at) AS month,
                COALESCE(SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END), 0) AS views
         FROM telemetry_events
         WHERE created_at >= datetime('now', '-180 days')
         GROUP BY strftime('%Y-%m', created_at)
         ORDER BY month ASC"
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;

    let source_rows = sqlx::query(
        "SELECT COALESCE(source, 'unknown') AS source,
                COUNT(*) AS clicks,
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
        "systemMetrics": system_metrics,
        "errorLogs": []
    });

    Ok(json_ok("Telemetry stats fetched", data))
}

