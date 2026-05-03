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
    pub login_email_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
    pub login_ip_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
    pub blocked_login_subjects: Arc<RwLock<HashMap<String, DateTime<Utc>>>>,
    /// Timestamp permintaan forgot-password terakhir per kunci (email / ip).
    /// Dipakai untuk membatasi flooding email reset password.
    pub forgot_password_attempts: Arc<RwLock<HashMap<String, DateTime<Utc>>>>,
    pub public_submission_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
    pub telemetry_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
    pub mailer: Arc<crate::mail::Mailer>,
    pub cache: Arc<crate::cache::CacheManager>,
}

impl AppState {
    pub fn new(pool: SqlitePool, cache: Arc<crate::cache::CacheManager>) -> Self {
        Self {
            pool,
            access_sessions: Arc::new(RwLock::new(HashMap::new())),
            refresh_sessions: Arc::new(RwLock::new(HashMap::new())),
            audit_log: Arc::new(RwLock::new(Vec::new())),
            login_email_attempts: Arc::new(RwLock::new(HashMap::new())),
            login_ip_attempts: Arc::new(RwLock::new(HashMap::new())),
            blocked_login_subjects: Arc::new(RwLock::new(HashMap::new())),
            forgot_password_attempts: Arc::new(RwLock::new(HashMap::new())),
            public_submission_attempts: Arc::new(RwLock::new(HashMap::new())),
            telemetry_attempts: Arc::new(RwLock::new(HashMap::new())),
            mailer: Arc::new(crate::mail::Mailer::new()),
            cache,
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

    pub async fn invalidate_user_sessions(&self, user_id: &str) {
        {
            let mut access = self.access_sessions.write().await;
            access.retain(|_, session| session.user_id != user_id);
        }
        {
            let mut refresh = self.refresh_sessions.write().await;
            refresh.retain(|_, session| session.user_id != user_id);
        }
    }

    pub async fn cleanup_expired_sessions(&self) {
        let now = Utc::now();
        {
            let mut access = self.access_sessions.write().await;
            access.retain(|_, session| session.expires_at > now);
        }
        {
            let mut refresh = self.refresh_sessions.write().await;
            refresh.retain(|_, session| session.expires_at > now);
        }
        {
            let mut tel = self.telemetry_attempts.write().await;
            tel.retain(|_, attempts| {
                attempts.retain(|ts| now.signed_duration_since(*ts).num_seconds() < 60);
                !attempts.is_empty()
            });
        }
        {
            let mut pub_sub = self.public_submission_attempts.write().await;
            pub_sub.retain(|_, attempts| {
                attempts.retain(|ts| now.signed_duration_since(*ts).num_hours() < 1);
                !attempts.is_empty()
            });
        }
    }
}

#[derive(Clone, serde::Serialize, sqlx::FromRow)]
pub struct UserPublic {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String, // String for DB compatibility, convert to Role in logic if needed
    /// Jabatan (title/position) — display only, does NOT affect system access.
    /// Examples: "kepala_cabang", "supervisor", "koordinator", "sales"
    /// Only meaningful for users with role = "sales".
    #[sqlx(default)]
    pub jabatan: String,
    pub avatar: String,
    pub bank_account: String,
    pub whatsapp: String,
    pub referral_slug: String,
    pub created_at: Option<String>,
    pub last_login: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    /// True kalau user wajib mengganti password sebelum bisa pakai akun secara
    /// normal (mis. setelah admin reset password atau auto-create dari
    /// approval registrasi agen). Dipakai frontend untuk memaksa flow
    /// change-password.
    #[sqlx(default)]
    pub must_change_password: bool,
}

#[derive(Clone, sqlx::FromRow)]
pub struct UserRecord {
    pub id: String,
    pub email: String,
    pub name: String,
    pub role: String,
    pub password_hash: String,
    #[sqlx(default)]
    pub jabatan: String,
    pub avatar: String,
    pub bank_account: String,
    pub whatsapp: String,
    pub referral_slug: String,
    pub created_at: Option<String>,
    pub last_login: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    #[sqlx(default)]
    pub must_change_password: bool,
}

impl UserRecord {
    pub fn public(&self) -> UserPublic {
        UserPublic {
            id: self.id.clone(),
            email: self.email.clone(),
            name: self.name.clone(),
            role: self.role.to_lowercase(),
            jabatan: self.jabatan.clone(),
            avatar: self.avatar.clone(),
            bank_account: self.bank_account.clone(),
            whatsapp: self.whatsapp.clone(),
            referral_slug: self.referral_slug.clone(),
            created_at: self.created_at.clone(),
            last_login: self.last_login.clone(),
            is_active: self.is_active,
            is_verified: self.is_verified,
            must_change_password: self.must_change_password,
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
