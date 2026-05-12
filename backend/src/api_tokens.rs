use chrono::{DateTime, Utc};
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use rand::Rng;
use rand_core::OsRng;
use redis::{aio::ConnectionManager, AsyncCommands, RedisError};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use base64::Engine;

/// API token record from database
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ApiTokenRecord {
    pub id: String,
    pub user_id: String,
    pub token_hash: String,
    pub name: String,
    pub permissions: Option<String>, // JSON array
    pub expires_at: Option<String>,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub token_prefix: Option<String>,
}

impl ApiTokenRecord {
    /// Parse permissions from JSON string
    pub fn get_permissions(&self) -> Vec<String> {
        self.permissions
            .as_ref()
            .and_then(|p| serde_json::from_str(p).ok())
            .unwrap_or_default()
    }

    /// Check if token has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at_str) = &self.expires_at {
            if let Ok(expires_at) = DateTime::parse_from_rfc3339(expires_at_str) {
                return expires_at.with_timezone(&Utc) < Utc::now();
            }
        }
        false
    }
}

/// Error types for token operations
#[derive(Debug, Error)]
pub enum TokenError {
    #[error("Invalid token")]
    InvalidToken,

    #[error("Token expired")]
    TokenExpired,

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Token generation error: {0}")]
    GenerationError(String),
}

impl From<sqlx::Error> for TokenError {
    fn from(err: sqlx::Error) -> Self {
        TokenError::DatabaseError(err.to_string())
    }
}

/// Error types for rate limiting
#[derive(Debug, Error)]
pub enum RateLimitError {
    #[error("Rate limit exceeded, retry after {retry_after} seconds")]
    RateLimitExceeded { retry_after: u64 },

    #[error("Redis error: {0}")]
    RedisError(String),
}

impl From<RedisError> for RateLimitError {
    fn from(err: RedisError) -> Self {
        RateLimitError::RedisError(err.to_string())
    }
}

/// Generate a new API token with Argon2id hashing
///
/// **Validates: Requirements 15.4**
///
/// Generates a random 32-byte token (base64 encoded), hashes it using Argon2id,
/// and stores the hash in the database. Returns the token ID and plain token
/// (which should only be shown to the user once).
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `user_id` - User ID who owns the token
/// * `name` - Human-readable name for the token
/// * `permissions` - List of permissions (e.g., ["wa_send", "wa_webhook_manage"])
/// * `expires_at` - Optional expiration timestamp
///
/// # Returns
/// * `Ok((token_id, plain_token))` - Token ID and plain token string
/// * `Err(TokenError)` - If generation or storage fails
pub async fn generate_api_token(
    pool: &SqlitePool,
    user_id: String,
    name: String,
    permissions: Vec<String>,
    expires_at: Option<DateTime<Utc>>,
) -> Result<(String, String), TokenError> {
    // Generate random 32-byte token
    let mut token_bytes = [0u8; 32];
    rand::thread_rng().fill(&mut token_bytes);
    let plain_token = base64::engine::general_purpose::STANDARD.encode(&token_bytes);

    // Compute SHA-256 prefix for fast indexed lookup (first 16 hex chars = 8 bytes)
    let token_prefix = compute_token_prefix(&plain_token);

    // Hash token using Argon2id
    let salt = SaltString::generate(&mut OsRng);
    let token_hash = argon2::Argon2::default()
        .hash_password(plain_token.as_bytes(), &salt)
        .map_err(|e| TokenError::GenerationError(e.to_string()))?
        .to_string();

    // Generate token ID
    let token_id = uuid::Uuid::new_v4().to_string();

    // Serialize permissions to JSON
    let permissions_json = serde_json::to_string(&permissions)
        .map_err(|e| TokenError::GenerationError(e.to_string()))?;

    // Store in database
    let expires_at_str = expires_at.map(|dt| dt.to_rfc3339());

    sqlx::query(
        r#"
        INSERT INTO wa_api_tokens (id, user_id, token_hash, name, permissions, expires_at, token_prefix, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        "#,
    )
    .bind(&token_id)
    .bind(&user_id)
    .bind(&token_hash)
    .bind(&name)
    .bind(&permissions_json)
    .bind(&expires_at_str)
    .bind(&token_prefix)
    .execute(pool)
    .await?;

    tracing::info!(
        "Generated API token {} for user {} with name '{}'",
        token_id,
        user_id,
        name
    );

    Ok((token_id, plain_token))
}

/// Validate an API token and return the token record
///
/// **Validates: Requirements 15.4**
///
/// Verifies the token hash using Argon2id, checks expiration,
/// and updates the last_used_at timestamp.
///
/// # Arguments
/// * `pool` - Database connection pool
/// * `token` - Plain token string to validate
///
/// # Returns
/// * `Ok(ApiTokenRecord)` - Token record if valid
/// * `Err(TokenError)` - If token is invalid or expired
pub async fn validate_api_token(
    pool: &SqlitePool,
    token: &str,
) -> Result<ApiTokenRecord, TokenError> {
    let prefix = compute_token_prefix(token);

    // Try fast path: query by prefix (O(1) via index)
    let candidates: Vec<ApiTokenRecord> = sqlx::query_as(
        r#"
        SELECT id, user_id, token_hash, name, permissions, expires_at, last_used_at, created_at, token_prefix
        FROM wa_api_tokens
        WHERE token_prefix = ?
        "#,
    )
    .bind(&prefix)
    .fetch_all(pool)
    .await?;

    // Verify Argon2 hash only against the (typically 1) candidate(s)
    let mut matched_token: Option<ApiTokenRecord> = None;
    for token_record in &candidates {
        let parsed_hash = match PasswordHash::new(&token_record.token_hash) {
            Ok(hash) => hash,
            Err(_) => continue,
        };

        if argon2::Argon2::default()
            .verify_password(token.as_bytes(), &parsed_hash)
            .is_ok()
        {
            matched_token = Some(token_record.clone());
            break;
        }
    }

    // Fallback: if no match by prefix (legacy tokens without prefix), scan all
    if matched_token.is_none() && candidates.is_empty() {
        let all_tokens: Vec<ApiTokenRecord> = sqlx::query_as(
            r#"
            SELECT id, user_id, token_hash, name, permissions, expires_at, last_used_at, created_at, token_prefix
            FROM wa_api_tokens
            WHERE token_prefix IS NULL
            "#,
        )
        .fetch_all(pool)
        .await?;

        for token_record in &all_tokens {
            let parsed_hash = match PasswordHash::new(&token_record.token_hash) {
                Ok(hash) => hash,
                Err(_) => continue,
            };

            if argon2::Argon2::default()
                .verify_password(token.as_bytes(), &parsed_hash)
                .is_ok()
            {
                // Backfill prefix for this legacy token
                let _ = sqlx::query(
                    "UPDATE wa_api_tokens SET token_prefix = ? WHERE id = ?",
                )
                .bind(&prefix)
                .bind(&token_record.id)
                .execute(pool)
                .await;

                matched_token = Some(token_record.clone());
                break;
            }
        }
    }

    let token_record = matched_token.ok_or(TokenError::InvalidToken)?;

    // Check expiration
    if token_record.is_expired() {
        tracing::warn!("Token {} has expired", token_record.id);
        return Err(TokenError::TokenExpired);
    }

    // Update last_used_at timestamp
    sqlx::query(
        r#"
        UPDATE wa_api_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(&token_record.id)
    .execute(pool)
    .await?;

    tracing::debug!("Validated API token {} for user {}", token_record.id, token_record.user_id);

    Ok(token_record)
}

/// Compute a short SHA-256 prefix of a plain token for fast indexed lookup.
/// Returns the first 16 hex characters of the SHA-256 hash (64-bit uniqueness).
pub fn compute_token_prefix(plain_token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(plain_token.as_bytes());
    let hash = hasher.finalize();
    format!("{:x}", hash)[..16].to_string()
}

/// Check IP-based rate limit using Redis sliding window
///
/// **Validates: Requirements 15.5**
///
/// Implements sliding window rate limiting with Redis sorted sets.
/// Limit: 100 requests per minute per IP address.
///
/// # Arguments
/// * `redis` - Redis connection manager
/// * `ip_address` - IP address to check
///
/// # Returns
/// * `Ok(())` - If request is allowed
/// * `Err(RateLimitError::RateLimitExceeded)` - If rate limit exceeded
pub async fn check_ip_rate_limit(
    redis: &mut ConnectionManager,
    ip_address: &str,
) -> Result<(), RateLimitError> {
    check_rate_limit(redis, &format!("ratelimit:ip:{}", ip_address), 100, 60).await
}

/// Check API token-based rate limit using Redis sliding window
///
/// **Validates: Requirements 9.8**
///
/// Implements sliding window rate limiting with Redis sorted sets.
/// Limit: 100 requests per minute per API token.
///
/// # Arguments
/// * `redis` - Redis connection manager
/// * `token_id` - Token ID to check
///
/// # Returns
/// * `Ok(())` - If request is allowed
/// * `Err(RateLimitError::RateLimitExceeded)` - If rate limit exceeded
pub async fn check_token_rate_limit(
    redis: &mut ConnectionManager,
    token_id: &str,
) -> Result<(), RateLimitError> {
    check_rate_limit(redis, &format!("ratelimit:token:{}", token_id), 100, 60).await
}

/// Generic sliding window rate limit check using Redis sorted set
///
/// **Validates: Requirements 15.5, 9.8**
///
/// Uses Redis sorted set (ZSET) to implement sliding window algorithm:
/// 1. Add current timestamp to sorted set
/// 2. Remove timestamps older than window
/// 3. Count remaining timestamps
/// 4. If count > limit, reject request
///
/// # Arguments
/// * `redis` - Redis connection manager
/// * `key` - Redis key for this rate limit
/// * `limit` - Maximum requests allowed in window
/// * `window_seconds` - Time window in seconds
///
/// # Returns
/// * `Ok(())` - If request is allowed
/// * `Err(RateLimitError::RateLimitExceeded)` - If rate limit exceeded
async fn check_rate_limit(
    redis: &mut ConnectionManager,
    key: &str,
    limit: u32,
    window_seconds: u64,
) -> Result<(), RateLimitError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs_f64();

    let window_start = now - window_seconds as f64;

    // Lua script for atomic sliding window check
    // This ensures atomicity and prevents race conditions
    let script = r#"
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local window_start = tonumber(ARGV[2])
        local limit = tonumber(ARGV[3])
        local window_seconds = tonumber(ARGV[4])
        
        -- Remove old entries outside the window
        redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)
        
        -- Count current entries in window
        local count = redis.call('ZCARD', key)
        
        if count >= limit then
            -- Rate limit exceeded
            return -1
        else
            -- Add current timestamp
            redis.call('ZADD', key, now, now)
            -- Set expiration on key (window + 1 second buffer)
            redis.call('EXPIRE', key, window_seconds + 1)
            return count + 1
        end
    "#;

    let result: i32 = redis::Script::new(script)
        .key(key)
        .arg(now)
        .arg(window_start)
        .arg(limit)
        .arg(window_seconds)
        .invoke_async(redis)
        .await?;

    if result == -1 {
        // Calculate retry_after based on oldest timestamp in window
        let oldest: Option<f64> = redis
            .zrange_withscores(key, 0, 0)
            .await
            .ok()
            .and_then(|scores: Vec<(String, f64)>| scores.first().map(|(_, score)| *score));

        let retry_after = if let Some(oldest_timestamp) = oldest {
            let age = now - oldest_timestamp;
            let remaining = window_seconds as f64 - age;
            remaining.ceil().max(1.0) as u64
        } else {
            window_seconds
        };

        tracing::warn!("Rate limit exceeded for key: {}", key);
        return Err(RateLimitError::RateLimitExceeded { retry_after });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use tokio::time::{sleep, Duration};

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create test database");

        // Create users table
        sqlx::query(
            r#"
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                avatar TEXT DEFAULT '',
                bank_account TEXT DEFAULT '',
                whatsapp TEXT DEFAULT '',
                referral_slug TEXT DEFAULT '',
                is_active BOOLEAN DEFAULT 1,
                is_verified BOOLEAN DEFAULT 1,
                must_change_password BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create wa_api_tokens table
        sqlx::query(
            r#"
            CREATE TABLE wa_api_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                permissions TEXT,
                expires_at DATETIME,
                last_used_at DATETIME,
                token_prefix TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        // Create test user
        sqlx::query(
            r#"
            INSERT INTO users (id, email, name, role, password_hash)
            VALUES ('user_1', 'test@example.com', 'Test User', 'admin', 'hash')
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    async fn setup_test_redis() -> ConnectionManager {
        let client = redis::Client::open("redis://127.0.0.1:6379")
            .expect("Failed to create Redis client");
        ConnectionManager::new(client)
            .await
            .expect("Failed to connect to Redis")
    }

    #[tokio::test]
    async fn test_generate_api_token() {
        let pool = setup_test_db().await;

        let (token_id, plain_token) = generate_api_token(
            &pool,
            "user_1".to_string(),
            "Test Token".to_string(),
            vec!["wa_send".to_string(), "wa_webhook_manage".to_string()],
            None,
        )
        .await
        .expect("Failed to generate token");

        // Verify token was stored
        let record: ApiTokenRecord = sqlx::query_as(
            "SELECT id, user_id, token_hash, name, permissions, expires_at, last_used_at, created_at, token_prefix FROM wa_api_tokens WHERE id = ?",
        )
        .bind(&token_id)
        .fetch_one(&pool)
        .await
        .expect("Token not found in database");

        assert_eq!(record.id, token_id);
        assert_eq!(record.user_id, "user_1");
        assert_eq!(record.name, "Test Token");
        assert!(!plain_token.is_empty());
        assert_ne!(record.token_hash, plain_token); // Hash should be different from plain token

        // Verify permissions
        let perms = record.get_permissions();
        assert_eq!(perms.len(), 2);
        assert!(perms.contains(&"wa_send".to_string()));
        assert!(perms.contains(&"wa_webhook_manage".to_string()));
    }

    #[tokio::test]
    async fn test_validate_api_token_success() {
        let pool = setup_test_db().await;

        let (_token_id, plain_token) = generate_api_token(
            &pool,
            "user_1".to_string(),
            "Test Token".to_string(),
            vec!["wa_send".to_string()],
            None,
        )
        .await
        .expect("Failed to generate token");

        // Validate the token
        let record = validate_api_token(&pool, &plain_token)
            .await
            .expect("Token validation failed");

        assert_eq!(record.user_id, "user_1");
        assert_eq!(record.name, "Test Token");

        // Verify last_used_at was updated
        let updated_record: ApiTokenRecord = sqlx::query_as(
            "SELECT id, user_id, token_hash, name, permissions, expires_at, last_used_at, created_at, token_prefix FROM wa_api_tokens WHERE id = ?",
        )
        .bind(&record.id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(updated_record.last_used_at.is_some());
    }

    #[tokio::test]
    async fn test_validate_api_token_invalid() {
        let pool = setup_test_db().await;

        // Try to validate non-existent token
        let result = validate_api_token(&pool, "invalid_token_12345").await;

        assert!(result.is_err());
        match result {
            Err(TokenError::InvalidToken) => (),
            _ => panic!("Expected InvalidToken error"),
        }
    }

    #[tokio::test]
    async fn test_validate_api_token_expired() {
        let pool = setup_test_db().await;

        // Generate token with past expiration
        let expires_at = Utc::now() - chrono::Duration::hours(1);
        let (_token_id, plain_token) = generate_api_token(
            &pool,
            "user_1".to_string(),
            "Expired Token".to_string(),
            vec!["wa_send".to_string()],
            Some(expires_at),
        )
        .await
        .expect("Failed to generate token");

        // Try to validate expired token
        let result = validate_api_token(&pool, &plain_token).await;

        assert!(result.is_err());
        match result {
            Err(TokenError::TokenExpired) => (),
            _ => panic!("Expected TokenExpired error"),
        }
    }

    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_ip_rate_limit_within_limit() {
        let mut redis = setup_test_redis().await;

        // Clear any existing data
        let _: Result<(), RedisError> = redis.del("ratelimit:ip:192.168.1.1").await;

        // Make 50 requests (within limit of 100)
        for _ in 0..50 {
            let result = check_ip_rate_limit(&mut redis, "192.168.1.1").await;
            assert!(result.is_ok(), "Request should be allowed");
        }
    }

    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_ip_rate_limit_exceeded() {
        let mut redis = setup_test_redis().await;

        // Clear any existing data
        let _: Result<(), RedisError> = redis.del("ratelimit:ip:192.168.1.2").await;

        // Make 100 requests (at limit)
        for i in 0..100 {
            let result = check_ip_rate_limit(&mut redis, "192.168.1.2").await;
            assert!(result.is_ok(), "Request {} should be allowed", i + 1);
        }

        // 101st request should be rejected
        let result = check_ip_rate_limit(&mut redis, "192.168.1.2").await;
        assert!(result.is_err(), "Request 101 should be rejected");

        match result {
            Err(RateLimitError::RateLimitExceeded { retry_after }) => {
                assert!(retry_after > 0 && retry_after <= 60);
            }
            _ => panic!("Expected RateLimitExceeded error"),
        }
    }

    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_token_rate_limit_within_limit() {
        let mut redis = setup_test_redis().await;

        // Clear any existing data
        let _: Result<(), RedisError> = redis.del("ratelimit:token:token_1").await;

        // Make 50 requests (within limit of 100)
        for _ in 0..50 {
            let result = check_token_rate_limit(&mut redis, "token_1").await;
            assert!(result.is_ok(), "Request should be allowed");
        }
    }

    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_token_rate_limit_exceeded() {
        let mut redis = setup_test_redis().await;

        // Clear any existing data
        let _: Result<(), RedisError> = redis.del("ratelimit:token:token_2").await;

        // Make 100 requests (at limit)
        for i in 0..100 {
            let result = check_token_rate_limit(&mut redis, "token_2").await;
            assert!(result.is_ok(), "Request {} should be allowed", i + 1);
        }

        // 101st request should be rejected
        let result = check_token_rate_limit(&mut redis, "token_2").await;
        assert!(result.is_err(), "Request 101 should be rejected");

        match result {
            Err(RateLimitError::RateLimitExceeded { retry_after }) => {
                assert!(retry_after > 0 && retry_after <= 60);
            }
            _ => panic!("Expected RateLimitExceeded error"),
        }
    }

    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_sliding_window_reset() {
        let mut redis = setup_test_redis().await;

        // Clear any existing data
        let _: Result<(), RedisError> = redis.del("ratelimit:ip:192.168.1.3").await;

        // Make 100 requests (at limit)
        for _ in 0..100 {
            check_ip_rate_limit(&mut redis, "192.168.1.3")
                .await
                .expect("Request should be allowed");
        }

        // Next request should fail
        let result = check_ip_rate_limit(&mut redis, "192.168.1.3").await;
        assert!(result.is_err());

        // Wait for window to expire (61 seconds to be safe)
        sleep(Duration::from_secs(61)).await;

        // Should be able to make requests again
        let result = check_ip_rate_limit(&mut redis, "192.168.1.3").await;
        assert!(result.is_ok(), "Request should be allowed after window reset");
    }

    #[tokio::test]
    #[ignore] // Requires Redis server running
    async fn test_concurrent_rate_limit_checks() {
        let mut redis = setup_test_redis().await;

        // Clear any existing data
        let _: Result<(), RedisError> = redis.del("ratelimit:ip:192.168.1.4").await;

        // Spawn 50 concurrent requests
        let mut handles = vec![];
        for _ in 0..50 {
            let mut redis_clone = redis.clone();
            let handle = tokio::spawn(async move {
                check_ip_rate_limit(&mut redis_clone, "192.168.1.4").await
            });
            handles.push(handle);
        }

        // All should succeed (within limit)
        let mut success_count = 0;
        for handle in handles {
            if handle.await.unwrap().is_ok() {
                success_count += 1;
            }
        }

        assert_eq!(success_count, 50, "All 50 concurrent requests should succeed");

        // Verify count is exactly 50
        let count: usize = redis
            .zcard("ratelimit:ip:192.168.1.4")
            .await
            .expect("Failed to get count");
        assert_eq!(count, 50, "Redis should have exactly 50 entries");
    }
}
