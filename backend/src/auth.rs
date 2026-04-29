use crate::{response::AppError, state::{AppState, UserPublic, UserRecord}};
use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use uuid::Uuid;
use std::str::FromStr;

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
    Editor,
    Operator,
}

impl Display for Role {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Admin => write!(f, "admin"),
            Self::Agent => write!(f, "agent"),
            Self::Editor => write!(f, "editor"),
            Self::Operator => write!(f, "operator"),
        }
    }
}

impl FromStr for Role {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "admin" => Ok(Self::Admin),
            "agent" => Ok(Self::Agent),
            "editor" => Ok(Self::Editor),
            "operator" => Ok(Self::Operator),
            _ => Err(()),
        }
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
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
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

pub async fn login_with_request(
    state: &AppState,
    request: LoginRequest,
) -> Result<AuthPayload, AppError> {
    let email = request.email.trim().to_lowercase();
    let password = request.password;

    if email.is_empty() || password.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Email dan password wajib diisi".to_string()],
        });
    }

    let email_log = mask_email_for_log(&email);

    tracing::info!("Login attempt for email: {}", email);
    let user: UserRecord = sqlx::query_as("SELECT * FROM users WHERE LOWER(email) = ?")
        .bind(&email)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error during login: {}", e);
            AppError::Internal
        })?
        .ok_or_else(|| {
            tracing::warn!("Login failed: user not found for email '{}'", email_log);
            AppError::Unauthorized
        })?;

    tracing::debug!("User record retrieved: email={}, is_active={}, is_verified={}", user.email, user.is_active, user.is_verified);

    if !user.is_active {
        tracing::warn!("Login failed: account is suspended for email '{}'", email_log);
        return Err(AppError::Unauthorized);
    }

    if !verify_password(&password, &user.password_hash) {
        tracing::warn!("Login failed: incorrect password for email '{}'", email_log);
        return Err(AppError::Unauthorized);
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
    let refresh_expires_at = Utc::now() + Duration::days(7);

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
    };

    state.access_sessions.write().await.insert(access_token.clone(), access_session);
    state.refresh_sessions.write().await.insert(refresh_token.clone(), refresh_session);
    state.audit("auth.login.success", Some(&user.email)).await;

    Ok(AuthPayload {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 900,
        user: user.public(),
    })
}

pub async fn refresh_with_request(
    state: &AppState,
    request: RefreshRequest,
) -> Result<AuthPayload, AppError> {
    let session = {
        let sessions = state.refresh_sessions.read().await;
        sessions.get(&request.refresh_token).cloned()
    }
    .ok_or(AppError::Unauthorized)?;

    if session.expires_at < Utc::now() {
        return Err(AppError::Unauthorized);
    }

    let user: UserRecord = sqlx::query_as("SELECT * FROM users WHERE id = ?")
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
    state.refresh_sessions.write().await.insert(
        refresh_token.clone(),
        RefreshSession {
            token: refresh_token.clone(),
            user_id: user.id.clone(),
            role: current_role,
            expires_at: Utc::now() + Duration::days(7),
        },
    );
    state.refresh_sessions.write().await.remove(&request.refresh_token);
    state.audit("auth.refresh", Some(&user.email)).await;

    Ok(AuthPayload {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: 900,
        user: user.public(),
    })
}

pub async fn logout_with_headers(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let token = bearer_token(headers)?;
    let session = {
        let mut sessions = state.access_sessions.write().await;
        sessions.remove(&token)
    }
    .ok_or(AppError::Unauthorized)?;

    state.refresh_sessions.write().await.remove(&session.refresh_token);
    
    // Audit logout
    let user_email: Option<String> = sqlx::query_scalar("SELECT email FROM users WHERE id = ?")
        .bind(&session.user_id)
        .fetch_optional(&state.pool)
        .await
        .unwrap_or(None);

    state.audit("auth.logout", user_email.as_deref()).await;
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

    let user: UserRecord = sqlx::query_as("SELECT * FROM users WHERE id = ?")
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
