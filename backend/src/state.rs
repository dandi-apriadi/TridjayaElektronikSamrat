use crate::auth::{AccessSession, RefreshSession};
use chrono::{DateTime, Utc};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use sqlx::SqlitePool;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub access_sessions: Arc<RwLock<HashMap<String, AccessSession>>>,
    pub refresh_sessions: Arc<RwLock<HashMap<String, RefreshSession>>>,
    pub audit_log: Arc<RwLock<Vec<AuditEntry>>>,
    pub login_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
}

impl AppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            pool,
            access_sessions: Arc::new(RwLock::new(HashMap::new())),
            refresh_sessions: Arc::new(RwLock::new(HashMap::new())),
            audit_log: Arc::new(RwLock::new(Vec::new())),
            login_attempts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn audit(&self, action: impl Into<String>, actor: Option<&str>) {
        self.audit_log.write().await.push(AuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            action: action.into(),
            actor: actor.map(ToString::to_string),
            created_at: Utc::now(),
        });
    }
}

#[derive(Clone, serde::Serialize, sqlx::FromRow)]
pub struct UserPublic {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String, // String for DB compatibility, convert to Role in logic if needed
    pub avatar: String,
    pub is_active: bool,
}

#[derive(Clone, sqlx::FromRow)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub password_hash: String,
    pub avatar: String,
    pub is_active: bool,
}

impl UserRecord {
    pub fn public(&self) -> UserPublic {
        UserPublic {
            id: self.id.clone(),
            email: self.email.clone(),
            name: self.name.clone(),
            role: self.role.to_lowercase(),
            avatar: self.avatar.clone(),
            is_active: self.is_active,
        }
    }
}

#[derive(Clone)]
pub struct AuditEntry {
    pub id: String,
    pub action: String,
    pub actor: Option<String>,
    pub created_at: DateTime<Utc>,
}
