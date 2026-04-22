use crate::auth::{hash_password, AccessSession, RefreshSession, Role};
use chrono::{DateTime, Utc};
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub users: Arc<RwLock<HashMap<String, UserRecord>>>,
    pub access_sessions: Arc<RwLock<HashMap<String, AccessSession>>>,
    pub refresh_sessions: Arc<RwLock<HashMap<String, RefreshSession>>>,
    pub audit_log: Arc<RwLock<Vec<AuditEntry>>>,
}

impl AppState {
    pub fn new() -> Self {
        let mut users = HashMap::new();

        for record in [
            UserRecord::new(
                "adm-001",
                "admin@tridjaya.com",
                "Administrator Tridjaya",
                Role::Admin,
                "Admin123!",
            ),
            UserRecord::new(
                "age-001",
                "agent@tridjaya.com",
                "Agen Samrat Makassar",
                Role::Agent,
                "Agent123!",
            ),
            UserRecord::new(
                "edt-001",
                "editor@tridjaya.com",
                "Editor Konten",
                Role::Editor,
                "Editor123!",
            ),
            UserRecord::new(
                "opr-001",
                "operator@tridjaya.com",
                "Operator Internal",
                Role::Operator,
                "Operator123!",
            ),
        ] {
            users.insert(record.email.clone(), record);
        }

        Self {
            users: Arc::new(RwLock::new(users)),
            access_sessions: Arc::new(RwLock::new(HashMap::new())),
            refresh_sessions: Arc::new(RwLock::new(HashMap::new())),
            audit_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn audit(&self, action: impl Into<String>, actor: Option<&str>) {
        self.audit_log.write().await.push(AuditEntry {
            id: Uuid::new_v4().to_string(),
            action: action.into(),
            actor: actor.map(ToString::to_string),
            created_at: Utc::now(),
        });
    }
}

#[derive(Clone, serde::Serialize)]
pub struct UserPublic {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: Role,
    pub avatar: String,
    pub is_active: bool,
}

#[derive(Clone)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: Role,
    pub password_hash: String,
    pub avatar: String,
    pub is_active: bool,
}

impl UserRecord {
    pub fn new(id: &str, email: &str, name: &str, role: Role, password: &str) -> Self {
        Self {
            id: id.to_string(),
            email: email.to_string(),
            name: name.to_string(),
            role,
            password_hash: hash_password(password),
            avatar: format!("https://api.dicebear.com/7.x/avataaars/svg?seed={}", name.replace(' ', "")),
            is_active: true,
        }
    }

    pub fn public(&self) -> UserPublic {
        UserPublic {
            id: self.id.clone(),
            email: self.email.clone(),
            name: self.name.clone(),
            role: self.role.clone(),
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
