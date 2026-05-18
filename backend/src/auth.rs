use crate::{
    response::AppError,
    state::{AppState, AuditContext, UserPublic, UserRecord, USER_RECORD_SELECT},
};
use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use uuid::Uuid;

fn mask_email_for_log(email: &str) -> String {
    match email.split_once('@') {
        Some((local, domain)) => {
            let mut chars = local.chars();
            let first = chars.next().unwrap_or('*');
            format!("{}***@{}", first, domain)
        }
        None => "***".to_string(),
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Admin,
    Agent,
    #[serde(rename = "admin-sales", alias = "admin_sales", alias = "sales")]
    AdminSales,
    Operator,
    Owner,
    #[serde(rename = "pic_raport")]
    PicRaport,
    Karyawan,
}

impl Display for Role {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Admin => write!(f, "admin"),
            Self::Agent => write!(f, "agent"),
            Self::AdminSales => write!(f, "admin-sales"),
            Self::Operator => write!(f, "operator"),
            Self::Owner => write!(f, "owner"),
            Self::PicRaport => write!(f, "pic_raport"),
            Self::Karyawan => write!(f, "karyawan"),
        }
    }
}

impl FromStr for Role {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let role = s.trim().to_lowercase().replace(' ', "_");
        match role.as_str() {
            "admin" => Ok(Self::Admin),
            "agent" => Ok(Self::Agent),
            "admin-sales" | "admin_sales" | "sales" => Ok(Self::AdminSales),
            "operator" => Ok(Self::Operator),
            "owner" => Ok(Self::Owner),
            "pic_raport" | "pic-raport" | "pic raport" => Ok(Self::PicRaport),
            "karyawan" => Ok(Self::Karyawan),
            _ => Err(()),
        }
    }
}

impl Role {
    pub fn can_manage_wa(&self) -> bool {
        matches!(self, Self::Admin | Self::Operator | Self::Owner)
    }

    pub fn can_operate_wa(&self) -> bool {
        matches!(self, Self::Admin | Self::Operator | Self::Owner)
    }

    pub fn can_manage_pixels(&self) -> bool {
        matches!(self, Self::Admin | Self::Operator | Self::Owner)
    }
}

#[derive(Clone)]
pub struct AccessSession {
    pub token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub role: Role,
    pub expires_at: chrono::DateTime<Utc>,
}

#[derive(Clone)]
pub struct RefreshSession {
    pub token: String,
    pub user_id: String,
    pub role: Role,
    pub expires_at: chrono::DateTime<Utc>,
    pub remember: bool,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub remember: Option<bool>,
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Serialize)]
pub struct AuthPayload {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserPublic,
    pub remember: bool,
}

pub fn hash_password(password: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    argon2::Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("password hashing should not fail")
        .to_string()
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed = match PasswordHash::new(hash) {
        Ok(parsed) => parsed,
        Err(_) => return false,
    };

    argon2::Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}

pub async fn hash_password_blocking(password: String) -> Result<String, AppError> {
    tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|e| {
            tracing::error!("Password hash task failed: {}", e);
            AppError::Internal
        })
}

pub async fn verify_password_blocking(password: String, hash: String) -> Result<bool, AppError> {
    tokio::task::spawn_blocking(move || verify_password(&password, &hash))
        .await
        .map_err(|e| {
            tracing::error!("Password verify task failed: {}", e);
            AppError::Internal
        })
}

/// Lazily-computed dummy Argon2 hash used to keep `verify_password` timing
/// constant when the user record is not found. Without this, an attacker can
/// distinguish "email not registered" from "email registered + wrong password"
/// via response-time analysis even if both paths return the same error code.
fn dummy_password_hash() -> &'static str {
    use std::sync::OnceLock;
    static DUMMY: OnceLock<String> = OnceLock::new();
    DUMMY.get_or_init(|| hash_password("not-a-real-password"))
}

/// SHA-256 hex digest of a refresh token. Stored in `refresh_sessions.token_hash`
/// so a stolen database dump cannot be used directly to forge sessions.
pub fn hash_refresh_token(token: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub async fn login_with_request(
    state: &AppState,
    request: LoginRequest,
) -> Result<AuthPayload, AppError> {
    login_with_request_ctx(state, request, AuditContext::default()).await
}

pub async fn login_with_request_ctx(
    state: &AppState,
    request: LoginRequest,
    audit_ctx: AuditContext,
) -> Result<AuthPayload, AppError> {
    let email = request.email.trim().to_lowercase();
    let password = request.password;

    if email.is_empty() || password.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Email dan password wajib diisi".to_string()],
        });
    }

    let email_log = mask_email_for_log(&email);

    tracing::info!("Login attempt for email: {}", email_log);
    let query = format!("{USER_RECORD_SELECT} WHERE LOWER(u.email) = ?");
    let user: UserRecord = match sqlx::query_as(&query)
        .bind(&email)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error during login: {}", e);
            AppError::Internal
        })? {
        Some(user) => user,
        None => {
            tracing::warn!("Login failed: user not found for email '{}'", email_log);
            // Run a dummy verify to keep the response time roughly constant and
            // close the user-enumeration timing oracle (see Quick Win #2).
            let _ = verify_password_blocking(password.clone(), dummy_password_hash().to_string())
                .await?;
            return Err(AppError::LoginInvalidCredentials);
        }
    };

    tracing::debug!(
        "User record retrieved: email={}, is_active={}, is_verified={}",
        email_log,
        user.is_active,
        user.is_verified
    );

    // IMPORTANT: verify password BEFORE checking is_active / is_verified so that
    // attackers cannot enumerate registered emails via different status codes
    // (Quick Win #2). Status / verification errors are only surfaced after the
    // caller has already proven they know the password.
    if !verify_password_blocking(password.clone(), user.password_hash.clone()).await? {
        tracing::warn!("Login failed: incorrect password for email '{}'", email_log);
        return Err(AppError::LoginInvalidCredentials);
    }

    if !user.is_active {
        tracing::warn!(
            "Login failed: account is suspended for email '{}'",
            email_log
        );
        return Err(AppError::LoginAccountInactive);
    }

    if !user.is_verified {
        tracing::warn!("Login failed: email not verified for email '{}'", email_log);
        return Err(AppError::EmailUnverified);
    }

    sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(&user.id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update last_login: {}", e);
            AppError::Internal
        })?;

    let access_token = Uuid::new_v4().to_string();
    let refresh_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::minutes(15);
    let remember = request.remember.unwrap_or(false);
    let refresh_days = if remember { 30 } else { 7 };
    let refresh_expires_at = Utc::now() + Duration::days(refresh_days);

    let role = Role::from_str(&user.role).unwrap_or(Role::Agent);

    let access_session = AccessSession {
        token: access_token.clone(),
        refresh_token: refresh_token.clone(),
        user_id: user.id.clone(),
        role: role.clone(),
        expires_at,
    };
    let refresh_session = RefreshSession {
        token: refresh_token.clone(),
        user_id: user.id.clone(),
        role: role.clone(),
        expires_at: refresh_expires_at,
        remember,
    };

    state
        .access_sessions
        .write()
        .await
        .insert(access_token.clone(), access_session);
    state
        .refresh_sessions
        .write()
        .await
        .insert(refresh_token.clone(), refresh_session.clone());

    // Persist refresh session to database for survival across restarts. Only
    // the SHA-256 hash of the refresh token is stored at rest (Quick Win #3);
    // a leaked DB dump alone is no longer enough to forge a valid session.
    if let Err(e) = sqlx::query(
        "INSERT INTO refresh_sessions (token_hash, user_id, role, expires_at, remember) VALUES (?, ?, ?, ?, ?)"
    )
        .bind(hash_refresh_token(&refresh_token))
        .bind(&user.id)
        .bind(&role.to_string())
        .bind(refresh_expires_at.to_rfc3339())
        .bind(remember)
        .execute(&state.pool)
        .await
    {
        tracing::error!("Failed to persist refresh session: {}", e);
    }

    state
        .audit_with_context("auth.login.success", Some(&user.email), audit_ctx)
        .await;

    Ok(AuthPayload {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 900,
        user: user.public(),
        remember,
    })
}

pub async fn refresh_with_request(
    state: &AppState,
    request: RefreshRequest,
) -> Result<AuthPayload, AppError> {
    refresh_with_request_ctx(state, request, AuditContext::default()).await
}

pub async fn refresh_with_request_ctx(
    state: &AppState,
    request: RefreshRequest,
    audit_ctx: AuditContext,
) -> Result<AuthPayload, AppError> {
    // First check in-memory cache
    let session = {
        let sessions = state.refresh_sessions.read().await;
        sessions.get(&request.refresh_token).cloned()
    };

    // If not in memory, try to load from database (survives backend restarts).
    // The DB stores `token_hash`, never the raw token (Quick Win #3).
    let session = match session {
        Some(s) => s,
        None => {
            let row: Option<(String, String, String, bool)> = sqlx::query_as(
                "SELECT user_id, role, expires_at, remember FROM refresh_sessions WHERE token_hash = ?"
            )
                .bind(hash_refresh_token(&request.refresh_token))
                .fetch_optional(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("DB error loading refresh session: {}", e);
                    AppError::Internal
                })?;

            match row {
                Some((user_id, role_str, expires_at_str, remember)) => {
                    let expires_at = chrono::DateTime::parse_from_rfc3339(&expires_at_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now());
                    let role = Role::from_str(&role_str).unwrap_or(Role::Agent);
                    let restored = RefreshSession {
                        token: request.refresh_token.clone(),
                        user_id,
                        role,
                        expires_at,
                        remember,
                    };
                    // Cache it in memory for subsequent requests
                    state
                        .refresh_sessions
                        .write()
                        .await
                        .insert(request.refresh_token.clone(), restored.clone());
                    restored
                }
                None => return Err(AppError::Unauthorized),
            }
        }
    };

    if session.expires_at < Utc::now() {
        return Err(AppError::Unauthorized);
    }

    let query = format!("{USER_RECORD_SELECT} WHERE u.id = ?");
    let user: UserRecord = sqlx::query_as(&query)
        .bind(&session.user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::Unauthorized)?;

    if !user.is_active || !user.is_verified {
        state.invalidate_user_sessions(&user.id).await;
        return Err(AppError::Unauthorized);
    }

    let current_role = Role::from_str(&user.role).unwrap_or(Role::Agent);

    let access_token = Uuid::new_v4().to_string();
    let refresh_token = Uuid::new_v4().to_string();
    let refresh_days = if session.remember { 30 } else { 7 };

    state.access_sessions.write().await.insert(
        access_token.clone(),
        AccessSession {
            token: access_token.clone(),
            refresh_token: refresh_token.clone(),
            user_id: user.id.clone(),
            role: current_role.clone(),
            expires_at: Utc::now() + Duration::minutes(15),
        },
    );
    let new_refresh_expires = Utc::now() + Duration::days(refresh_days);
    let new_refresh_session = RefreshSession {
        token: refresh_token.clone(),
        user_id: user.id.clone(),
        role: current_role,
        expires_at: new_refresh_expires,
        remember: session.remember,
    };
    state
        .refresh_sessions
        .write()
        .await
        .insert(refresh_token.clone(), new_refresh_session);
    state
        .refresh_sessions
        .write()
        .await
        .remove(&request.refresh_token);

    // Persist new refresh session and remove old one from database (by hash).
    let _ = sqlx::query("DELETE FROM refresh_sessions WHERE token_hash = ?")
        .bind(hash_refresh_token(&request.refresh_token))
        .execute(&state.pool)
        .await;
    if let Err(e) = sqlx::query(
        "INSERT INTO refresh_sessions (token_hash, user_id, role, expires_at, remember) VALUES (?, ?, ?, ?, ?)"
    )
        .bind(hash_refresh_token(&refresh_token))
        .bind(&user.id)
        .bind(&user.role)
        .bind(new_refresh_expires.to_rfc3339())
        .bind(session.remember)
        .execute(&state.pool)
        .await
    {
        tracing::error!("Failed to persist new refresh session: {}", e);
    }

    state
        .audit_with_context("auth.refresh", Some(&user.email), audit_ctx)
        .await;

    Ok(AuthPayload {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 900,
        user: user.public(),
        remember: session.remember,
    })
}

pub async fn logout_with_headers(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    logout_with_headers_ctx(state, headers, AuditContext::default()).await
}

pub async fn logout_with_headers_ctx(
    state: &AppState,
    headers: &HeaderMap,
    audit_ctx: AuditContext,
) -> Result<(), AppError> {
    let token = bearer_token(headers)?;
    let session = {
        let mut sessions = state.access_sessions.write().await;
        sessions.remove(&token)
    }
    .ok_or(AppError::Unauthorized)?;

    state
        .refresh_sessions
        .write()
        .await
        .remove(&session.refresh_token);

    // Remove from database as well (by hash).
    let _ = sqlx::query("DELETE FROM refresh_sessions WHERE token_hash = ?")
        .bind(hash_refresh_token(&session.refresh_token))
        .execute(&state.pool)
        .await;

    // Audit logout
    let user_email: Option<String> = sqlx::query_scalar("SELECT email FROM users WHERE id = ?")
        .bind(&session.user_id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    state
        .audit_with_context("auth.logout", user_email.as_deref(), audit_ctx)
        .await;
    Ok(())
}

pub async fn authorize(
    state: &AppState,
    headers: &HeaderMap,
    allowed: &[Role],
) -> Result<UserRecord, AppError> {
    let token = bearer_token(headers)?;
    let session = {
        let sessions = state.access_sessions.read().await;
        sessions.get(&token).cloned()
    }
    .ok_or(AppError::Unauthorized)?;

    if session.expires_at < Utc::now() {
        return Err(AppError::Unauthorized);
    }

    let query = format!("{USER_RECORD_SELECT} WHERE u.id = ?");
    let user: UserRecord = sqlx::query_as(&query)
        .bind(&session.user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?
        .ok_or(AppError::Unauthorized)?;

    if !user.is_active || !user.is_verified {
        state.invalidate_user_sessions(&user.id).await;
        return Err(AppError::Unauthorized);
    }

    let db_role = Role::from_str(&user.role).unwrap_or(Role::Agent);

    if !allowed.is_empty() && !allowed.iter().any(|role| role == &db_role) {
        return Err(AppError::Forbidden);
    }

    Ok(user)
}

pub fn bearer_token(headers: &HeaderMap) -> Result<String, AppError> {
    let header_value = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    let token = header_value
        .strip_prefix("Bearer ")
        .or_else(|| header_value.strip_prefix("bearer "))
        .ok_or(AppError::Unauthorized)?;

    if token.trim().is_empty() {
        return Err(AppError::Unauthorized);
    }

    Ok(token.trim().to_string())
}
