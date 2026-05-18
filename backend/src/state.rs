use crate::auth::{AccessSession, RefreshSession};
use chrono::{DateTime, Utc};
use redis::aio::ConnectionManager;
use sqlx::MySqlPool;
use std::sync::atomic::AtomicBool;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

const MAX_AUDIT_LOG_ENTRIES: usize = 1_000;
pub const MYSQL_DATETIME_FORMAT: &str = "%Y-%m-%d %H:%i:%s";
pub const USER_RECORD_SELECT: &str = "SELECT u.id, u.email, u.name, u.role, u.password_hash, u.jabatan, u.divisi, u.cabang_id, COALESCE(c.nama, '') AS cabang_name, '' AS avatar, u.bank_account, u.whatsapp, u.referral_slug, DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(u.last_login, '%Y-%m-%d %H:%i:%s') AS last_login, u.is_active, u.is_verified, u.must_change_password FROM users u LEFT JOIN cabang c ON c.id = u.cabang_id";
pub const USER_PUBLIC_SELECT: &str = "SELECT u.id, u.email, u.name, u.role, u.jabatan, u.divisi, u.cabang_id, COALESCE(c.nama, '') AS cabang_name, '' AS avatar, u.bank_account, u.whatsapp, u.referral_slug, DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(u.last_login, '%Y-%m-%d %H:%i:%s') AS last_login, u.is_active, u.is_verified, u.must_change_password FROM users u LEFT JOIN cabang c ON c.id = u.cabang_id";

#[derive(Clone)]
pub struct AppState {
    pub pool: MySqlPool,
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
    /// Per-IP rate limiting for the pixel event endpoint.
    pub pixel_meta_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
    /// Prevents concurrent analytics aggregation runs.
    pub analytics_job_running: Arc<AtomicBool>,
    /// Timestamp of the last successful analytics aggregation.
    pub last_analytics_run: Arc<RwLock<Option<DateTime<Utc>>>>,
    /// Timestamp of the last Meta CAPI retry job run.
    pub last_retry_run: Arc<RwLock<Option<DateTime<Utc>>>>,
    /// Queue manager for WhatsApp message queuing (optional, initialized when Redis is available)
    pub queue_manager: Option<Arc<crate::queue_manager::QueueManager>>,
    /// Rate limiting for API tokens (wa_api_tokens)
    pub api_rate_limiter: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
    /// Redis connection manager for rate limiting (optional, initialized when Redis is available)
    pub redis: Option<Arc<RwLock<ConnectionManager>>>,
    /// Bridge client for managing Baileys WhatsApp sessions
    pub bridge_client: Arc<crate::bridge::BridgeClient>,
}

impl AppState {
    pub fn new(
        pool: MySqlPool,
        cache: Arc<crate::cache::CacheManager>,
    ) -> (
        Self,
        tokio::sync::mpsc::UnboundedReceiver<crate::bridge::BridgeEvent>,
    ) {
        let (bridge_client, event_rx) = crate::bridge::BridgeClient::new();

        let state = Self {
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
            pixel_meta_attempts: Arc::new(RwLock::new(HashMap::new())),
            analytics_job_running: Arc::new(AtomicBool::new(false)),
            last_analytics_run: Arc::new(RwLock::new(None)),
            last_retry_run: Arc::new(RwLock::new(None)),
            queue_manager: None,
            api_rate_limiter: Arc::new(RwLock::new(HashMap::new())),
            redis: None,
            bridge_client: Arc::new(bridge_client),
        };
        (state, event_rx)
    }

    pub fn with_queue_manager(
        mut self,
        queue_manager: Arc<crate::queue_manager::QueueManager>,
    ) -> Self {
        self.queue_manager = Some(queue_manager);
        self
    }

    pub fn with_redis(mut self, redis: ConnectionManager) -> Self {
        self.redis = Some(Arc::new(RwLock::new(redis)));
        self
    }

    /// Check IP-based rate limit using Redis (if available)
    ///
    /// **Validates: Requirements 15.5**
    ///
    /// Limit: 100 requests per minute per IP address
    pub async fn check_ip_rate_limit(&self, ip: &str) -> Result<(), crate::response::AppError> {
        if let Some(redis) = &self.redis {
            let mut conn = redis.write().await;
            crate::api_tokens::check_ip_rate_limit(&mut conn, ip)
                .await
                .map_err(|e| match e {
                    crate::api_tokens::RateLimitError::RateLimitExceeded { .. } => {
                        crate::response::AppError::TooManyRequests
                    }
                    crate::api_tokens::RateLimitError::RedisError(msg) => {
                        tracing::error!("Redis error in IP rate limit: {}", msg);
                        crate::response::AppError::Internal
                    }
                })
        } else {
            // Fallback to in-memory rate limiting if Redis is not available
            tracing::warn!("Redis not available, using in-memory rate limiting for IP");
            const MAX_REQUESTS_PER_MINUTE: usize = 100;
            let now = chrono::Utc::now();
            let threshold = now - chrono::Duration::minutes(1);

            let mut attempts = self.login_ip_attempts.write().await;
            let entry = attempts.entry(ip.to_string()).or_default();

            // Remove old attempts outside the window
            entry.retain(|ts| *ts > threshold);

            if entry.len() >= MAX_REQUESTS_PER_MINUTE {
                return Err(crate::response::AppError::TooManyRequests);
            }

            entry.push(now);
            Ok(())
        }
    }

    /// Check API token-based rate limit using Redis (if available)
    ///
    /// **Validates: Requirements 9.8**
    ///
    /// Limit: 100 requests per minute per API token
    pub async fn check_api_rate_limit(
        &self,
        token_id: &str,
    ) -> Result<(), crate::response::AppError> {
        if let Some(redis) = &self.redis {
            let mut conn = redis.write().await;
            crate::api_tokens::check_token_rate_limit(&mut conn, token_id)
                .await
                .map_err(|e| match e {
                    crate::api_tokens::RateLimitError::RateLimitExceeded { .. } => {
                        crate::response::AppError::TooManyRequests
                    }
                    crate::api_tokens::RateLimitError::RedisError(msg) => {
                        tracing::error!("Redis error in API rate limit: {}", msg);
                        crate::response::AppError::Internal
                    }
                })
        } else {
            // Fallback to in-memory rate limiting if Redis is not available
            const MAX_REQUESTS_PER_MINUTE: usize = 100;
            let now = chrono::Utc::now();
            let threshold = now - chrono::Duration::minutes(1);

            let mut attempts = self.api_rate_limiter.write().await;
            let entry = attempts.entry(token_id.to_string()).or_default();

            // Remove old attempts outside the window
            entry.retain(|ts| *ts > threshold);

            if entry.len() >= MAX_REQUESTS_PER_MINUTE {
                return Err(crate::response::AppError::TooManyRequests);
            }

            entry.push(now);
            Ok(())
        }
    }

    pub async fn audit(&self, action: impl Into<String>, actor: Option<&str>) {
        self.audit_with_context(action, actor, AuditContext::default())
            .await;
    }

    /// Same as [`Self::audit`] but also stores client IP and User-Agent for
    /// forensic / incident response. Pass [`AuditContext::from_headers`] from
    /// the request handler.
    pub async fn audit_with_context(
        &self,
        action: impl Into<String>,
        actor: Option<&str>,
        ctx: AuditContext,
    ) {
        let mut audit_log = self.audit_log.write().await;
        audit_log.push(AuditEntry {
            id: uuid::Uuid::new_v4().to_string(),
            action: action.into(),
            actor: actor.map(ToString::to_string),
            ip: ctx.ip,
            user_agent: ctx.user_agent,
            created_at: Utc::now(),
        });
        let overflow = audit_log.len().saturating_sub(MAX_AUDIT_LOG_ENTRIES);
        if overflow > 0 {
            audit_log.drain(0..overflow);
        }
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
        // Also remove from database
        let _ = sqlx::query("DELETE FROM refresh_sessions WHERE user_id = ?")
            .bind(user_id)
            .execute(&self.pool)
            .await;
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
        // Clean expired sessions from database
        let _ = sqlx::query("DELETE FROM refresh_sessions WHERE expires_at < ?")
            .bind(now.to_rfc3339())
            .execute(&self.pool)
            .await;
        {
            let mut tel = self.telemetry_attempts.write().await;
            tel.retain(|_, attempts| {
                attempts.retain(|ts| now.signed_duration_since(*ts).num_seconds() < 60);
                !attempts.is_empty()
            });
        }
        {
            let mut pixel = self.pixel_meta_attempts.write().await;
            pixel.retain(|_, attempts| {
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
        {
            let mut login_email = self.login_email_attempts.write().await;
            login_email.retain(|_, attempts| {
                attempts.retain(|ts| now.signed_duration_since(*ts).num_minutes() < 10);
                !attempts.is_empty()
            });
        }
        {
            let mut login_ip = self.login_ip_attempts.write().await;
            login_ip.retain(|_, attempts| {
                attempts.retain(|ts| now.signed_duration_since(*ts).num_minutes() < 10);
                !attempts.is_empty()
            });
        }
        {
            let mut blocked = self.blocked_login_subjects.write().await;
            blocked.retain(|_, until| *until > now);
        }
        {
            let mut forgot_password = self.forgot_password_attempts.write().await;
            forgot_password.retain(|_, ts| now.signed_duration_since(*ts).num_minutes() < 30);
        }
        {
            let mut api_rate = self.api_rate_limiter.write().await;
            api_rate.retain(|_, attempts| {
                attempts.retain(|ts| now.signed_duration_since(*ts).num_seconds() < 60);
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
    /// Jabatan/title for admin-sales, or prospek target category for karyawan.
    /// Karyawan values: "sales" or "non_sales"; this does not affect system access.
    #[sqlx(default)]
    pub jabatan: String,
    /// Divisi karyawan — menentukan jobdesk dan target prospek.
    /// Examples: "sales_elektronik", "driver", "admin_spk", "kasir", etc.
    /// Only meaningful for users with role = "karyawan".
    #[sqlx(default)]
    pub divisi: String,
    #[sqlx(default)]
    pub cabang_id: String,
    #[sqlx(default)]
    pub cabang_name: String,
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
    #[sqlx(default)]
    pub divisi: String,
    #[sqlx(default)]
    pub cabang_id: String,
    #[sqlx(default)]
    pub cabang_name: String,
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
            role: normalize_public_role(&self.role),
            jabatan: self.jabatan.clone(),
            divisi: self.divisi.clone(),
            cabang_id: self.cabang_id.clone(),
            cabang_name: self.cabang_name.clone(),
            avatar: String::new(),
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

fn normalize_public_role(value: &str) -> String {
    let role = value.trim().to_lowercase().replace(' ', "_");
    if matches!(role.as_str(), "admin-sales" | "admin_sales" | "sales") {
        return "admin-sales".to_string();
    }
    role.replace('-', "_")
}

#[derive(Clone)]
pub struct AuditEntry {
    pub id: String,
    pub action: String,
    pub actor: Option<String>,
    /// Client IP that initiated the audited action, if known. Resolved from
    /// `X-Forwarded-For` / `X-Real-IP` when `TRUST_PROXY_HEADERS=true`, else
    /// from the TCP peer address.
    pub ip: Option<String>,
    /// `User-Agent` header from the originating request, truncated to a sane
    /// maximum to avoid log bloat.
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Optional request context attached to an audit log entry. Use
/// [`AuditContext::from_headers`] from a request handler to populate it.
#[derive(Default, Clone)]
pub struct AuditContext {
    pub ip: Option<String>,
    pub user_agent: Option<String>,
}

impl AuditContext {
    /// Extracts forensic context (IP, User-Agent) from a request's headers.
    /// Truncates the User-Agent header to 255 chars to bound memory.
    pub fn from_headers(headers: &axum::http::HeaderMap, ip: Option<String>) -> Self {
        let user_agent = headers
            .get(axum::http::header::USER_AGENT)
            .and_then(|value| value.to_str().ok())
            .map(|value| {
                let trimmed = value.trim();
                if trimmed.len() > 255 {
                    trimmed[..255].to_string()
                } else {
                    trimmed.to_string()
                }
            })
            .filter(|value| !value.is_empty());

        Self { ip, user_agent }
    }
}
