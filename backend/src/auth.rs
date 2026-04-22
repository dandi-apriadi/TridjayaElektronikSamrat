use crate::{response::AppError, state::{AppState, UserPublic, UserRecord}};
use axum::http::HeaderMap;
use chrono::{Duration, Utc};
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};
use uuid::Uuid;

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

fn verify_password(password: &str, hash: &str) -> bool {
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
    if request.email.trim().is_empty() || request.password.trim().is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Email dan password wajib diisi".to_string()],
        });
    }

    let user = {
        let users = state.users.read().await;
        users.get(&request.email).cloned()
    }
    .ok_or(AppError::Unauthorized)?;

    if !user.is_active || !verify_password(&request.password, &user.password_hash) {
        return Err(AppError::Unauthorized);
    }

    let access_token = Uuid::new_v4().to_string();
    let refresh_token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::minutes(15);
    let refresh_expires_at = Utc::now() + Duration::days(7);

    let access_session = AccessSession {
        token: access_token.clone(),
        refresh_token: refresh_token.clone(),
        user_id: user.id.clone(),
        role: user.role.clone(),
        expires_at,
    };
    let refresh_session = RefreshSession {
        token: refresh_token.clone(),
        user_id: user.id.clone(),
        role: user.role.clone(),
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

    let user = {
        let users = state.users.read().await;
        users.values().find(|candidate| candidate.id == session.user_id).cloned()
    }
    .ok_or(AppError::Unauthorized)?;

    let access_token = Uuid::new_v4().to_string();
    let refresh_token = Uuid::new_v4().to_string();

    state.access_sessions.write().await.insert(
        access_token.clone(),
        AccessSession {
            token: access_token.clone(),
            refresh_token: refresh_token.clone(),
            user_id: user.id.clone(),
            role: user.role.clone(),
            expires_at: Utc::now() + Duration::minutes(15),
        },
    );
    state.refresh_sessions.write().await.insert(
        refresh_token.clone(),
        RefreshSession {
            token: refresh_token.clone(),
            user_id: user.id.clone(),
            role: user.role.clone(),
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
    let user_email = {
        let users = state.users.read().await;
        users
            .values()
            .find(|candidate| candidate.id == session.user_id)
            .map(|user| user.email.clone())
    };

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

    if !allowed.is_empty() && !allowed.iter().any(|role| role == &session.role) {
        return Err(AppError::Forbidden);
    }

    let user = {
        let users = state.users.read().await;
        users.values().find(|candidate| candidate.id == session.user_id).cloned()
    }
    .ok_or(AppError::Unauthorized)?;

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
