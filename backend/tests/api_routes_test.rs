use tridjaya_backend::{
    api_routes,
    cache::CacheManager,
    queue_manager::QueueManager,
    redis_manager::RedisManager,
    response::AppError,
    state::AppState,
};
use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use tower::ServiceExt;
use serde_json::json;
use sqlx::SqlitePool;
use std::sync::Arc;

/// **Validates: Requirements 9.2, 9.3, 9.7, 9.8**
/// 
/// Integration tests for N8N API endpoint (POST /api/wa/send)
/// 
/// Test coverage:
/// - Authentication with valid/invalid tokens
/// - Rate limiting enforcement
/// - Message enqueue and response
/// - Error handling for invalid account_id
#[cfg(test)]
mod api_routes_tests {
    use super::*;

    /// Helper function to create test database with schema
    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:")
            .await
            .expect("Failed to create in-memory database");

        // Create users table (required for API tokens)
        sqlx::query(
            r#"
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                password_hash TEXT NOT NULL,
                avatar TEXT DEFAULT '',
                bank_account TEXT DEFAULT '',
                whatsapp TEXT DEFAULT '',
                referral_slug TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                is_verified BOOLEAN DEFAULT 0,
                must_change_password BOOLEAN DEFAULT 0
            )
            "#,
        )
        .execute(&pool)
        .await
        .expect("Failed to create users table");

        // Create wa_api_tokens table
        sqlx::query(
            r#"
            CREATE TABLE wa_api_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                permissions TEXT,
                expires_at TIMESTAMP,
                last_used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            "#,
        )
        .execute(&pool)
        .await
        .expect("Failed to create wa_api_tokens table");

        // Create wa_accounts table
        sqlx::query(
            r#"
            CREATE TABLE wa_accounts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                phone_number TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'disconnected',
                session_data TEXT,
                hourly_send_count INTEGER DEFAULT 0,
                daily_send_count INTEGER DEFAULT 0,
                last_reset_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            "#,
        )
        .execute(&pool)
        .await
        .expect("Failed to create wa_accounts table");

        pool
    }

    /// Helper function to create test user
    async fn create_test_user(pool: &SqlitePool) -> String {
        let user_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO users (id, email, name, role, password_hash, is_active, is_verified) 
             VALUES (?, ?, ?, ?, ?, 1, 1)"
        )
        .bind(&user_id)
        .bind("test@example.com")
        .bind("Test User")
        .bind("admin")
        .bind("dummy_hash")
        .execute(pool)
        .await
        .expect("Failed to create test user");

        user_id
    }

    /// Helper function to create test API token
    /// Returns (token_id, plain_token)
    async fn create_test_api_token(pool: &SqlitePool, user_id: &str) -> (String, String) {
        let token_id = uuid::Uuid::new_v4().to_string();
        let plain_token = uuid::Uuid::new_v4().to_string();
        
        // Hash the token using Argon2id (same as production)
        let token_hash = tridjaya_backend::auth::hash_password(&plain_token);

        sqlx::query(
            "INSERT INTO wa_api_tokens (id, user_id, token_hash, name, permissions) 
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&token_id)
        .bind(user_id)
        .bind(&token_hash)
        .bind("Test Token")
        .bind(r#"["wa_send"]"#)
        .execute(pool)
        .await
        .expect("Failed to create test API token");

        (token_id, plain_token)
    }

    /// Helper function to create test WhatsApp account
    async fn create_test_wa_account(pool: &SqlitePool, user_id: &str, status: &str) -> String {
        let account_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO wa_accounts (id, user_id, phone_number, name, status) 
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&account_id)
        .bind(user_id)
        .bind("+6281234567890")
        .bind("Test Account")
        .bind(status)
        .execute(pool)
        .await
        .expect("Failed to create test WhatsApp account");

        account_id
    }

    /// Helper function to create test app state with mock Redis
    async fn create_test_state() -> Result<AppState, Box<dyn std::error::Error>> {
        let pool = setup_test_db().await;
        
        // Try to connect to Redis (skip test if Redis not available)
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        
        let redis_client = redis::Client::open(redis_url)?;
        let redis_conn = redis_client.get_connection_manager().await?;
        let cache = Arc::new(CacheManager::new(redis_conn));
        
        // Create state without queue_manager (will be added in tests that need it)
        Ok(AppState::new(pool, cache))
    }

    /// Helper function to create test app state with Redis queue manager
    async fn create_test_state_with_queue() -> Result<AppState, Box<dyn std::error::Error>> {
        let pool = setup_test_db().await;
        
        // Try to connect to Redis (skip test if Redis not available)
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        
        let redis_client = redis::Client::open(redis_url.clone())?;
        let redis_conn = redis_client.get_connection_manager().await?;
        let cache = Arc::new(CacheManager::new(redis_conn));
        
        let redis_manager = RedisManager::new(&redis_url).await?;
        let queue_manager = Arc::new(QueueManager::new(redis_manager, pool.clone()));
        
        let state = AppState::new(pool, cache).with_queue_manager(queue_manager);
        
        Ok(state)
    }

    // ========================================================================
    // Test 1: Authentication with valid token
    // **Validates: Requirements 9.2, 9.3**
    // ========================================================================
    
    #[tokio::test]
    async fn test_send_message_with_valid_token() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        let app = api_routes::router(state.clone());

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "+6281234567890",
                    "message": "Test message",
                    "priority": "high"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 200 OK with message_id
        assert_eq!(response.status(), StatusCode::OK);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(json["success"], true);
        assert!(json["data"]["message_id"].is_string());
        assert!(json["data"]["estimated_send_time"].is_string());
    }

    // ========================================================================
    // Test 2: Authentication with invalid token
    // **Validates: Requirements 9.2, 9.3**
    // ========================================================================
    
    #[tokio::test]
    async fn test_send_message_with_invalid_token() {
        let state = match create_test_state().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };
        let app = api_routes::router(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, "Bearer invalid-token-12345")
            .body(Body::from(
                json!({
                    "account_id": "test-account",
                    "target_phone": "+6281234567890",
                    "message": "Test message"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 401 Unauthorized
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    // ========================================================================
    // Test 3: Authentication without token
    // **Validates: Requirements 9.2**
    // ========================================================================
    
    #[tokio::test]
    async fn test_send_message_without_token() {
        let state = match create_test_state().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };
        let app = api_routes::router(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "account_id": "test-account",
                    "target_phone": "+6281234567890",
                    "message": "Test message"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 401 Unauthorized
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    // ========================================================================
    // Test 4: Authentication with expired token
    // **Validates: Requirements 9.3**
    // ========================================================================
    
    #[tokio::test]
    async fn test_send_message_with_expired_token() {
        let state = match create_test_state().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };
        let user_id = create_test_user(&state.pool).await;
        
        // Create expired token
        let token_id = uuid::Uuid::new_v4().to_string();
        let plain_token = uuid::Uuid::new_v4().to_string();
        let token_hash = tridjaya_backend::auth::hash_password(&plain_token);
        
        // Set expiration to 1 hour ago
        let expired_at = chrono::Utc::now() - chrono::Duration::hours(1);
        
        sqlx::query(
            "INSERT INTO wa_api_tokens (id, user_id, token_hash, name, expires_at) 
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&token_id)
        .bind(&user_id)
        .bind(&token_hash)
        .bind("Expired Token")
        .bind(expired_at.to_rfc3339())
        .execute(&state.pool)
        .await
        .expect("Failed to create expired token");

        let app = api_routes::router(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": "test-account",
                    "target_phone": "+6281234567890",
                    "message": "Test message"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 401 Unauthorized
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    // ========================================================================
    // Test 5: Rate limiting enforcement
    // **Validates: Requirements 9.8**
    // ========================================================================
    
    #[tokio::test]
    async fn test_rate_limiting_enforcement() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (token_id, _plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let _account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        // Simulate 100 requests (the rate limit)
        for _ in 0..100 {
            state.check_api_rate_limit(&token_id).await.expect("Should allow requests within limit");
        }

        // The 101st request should fail
        let result = state.check_api_rate_limit(&token_id).await;
        assert!(result.is_err());
        
        // Verify it's a TooManyRequests error
        match result {
            Err(AppError::TooManyRequests) => {
                // Expected
            }
            _ => panic!("Expected TooManyRequests error"),
        }
    }

    // ========================================================================
    // Test 6: Message enqueue and response format
    // **Validates: Requirements 9.4, 9.5, 9.6**
    // ========================================================================
    
    #[tokio::test]
    async fn test_message_enqueue_and_response() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        let app = api_routes::router(state.clone());

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "+6281234567890",
                    "message": "Test message with media",
                    "media_url": "https://example.com/image.jpg",
                    "priority": "normal"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        // Verify response structure
        assert_eq!(json["success"], true);
        assert!(json["data"]["message_id"].is_string());
        assert!(json["data"]["estimated_send_time"].is_string());
        
        // Verify message_id is a valid UUID
        let message_id = json["data"]["message_id"].as_str().unwrap();
        assert!(uuid::Uuid::parse_str(message_id).is_ok());
        
        // Verify estimated_send_time is a valid ISO8601 timestamp
        let estimated_time = json["data"]["estimated_send_time"].as_str().unwrap();
        assert!(chrono::DateTime::parse_from_rfc3339(estimated_time).is_ok());
    }

    // ========================================================================
    // Test 7: Error handling for invalid account_id
    // **Validates: Requirements 9.7**
    // ========================================================================
    
    #[tokio::test]
    async fn test_invalid_account_id() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;

        let app = api_routes::router(state.clone());

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": "non-existent-account-id",
                    "target_phone": "+6281234567890",
                    "message": "Test message"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 400 Bad Request
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(json["success"], false);
        assert!(json["errors"][0].as_str().unwrap().contains("invalid_account"));
    }

    // ========================================================================
    // Test 8: Error handling for disconnected account
    // **Validates: Requirements 9.7**
    // ========================================================================
    
    #[tokio::test]
    async fn test_disconnected_account() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "disconnected").await;

        let app = api_routes::router(state.clone());

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "+6281234567890",
                    "message": "Test message"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 400 Bad Request
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(json["success"], false);
        assert!(json["errors"][0].as_str().unwrap().contains("disconnected"));
    }

    // ========================================================================
    // Test 9: Phone number validation
    // **Validates: Requirements 15.1**
    // ========================================================================
    
    #[tokio::test]
    async fn test_invalid_phone_number() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        let app = api_routes::router(state.clone());

        // Test with invalid phone number (missing +)
        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "081234567890", // Invalid: missing +
                    "message": "Test message"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 400 Bad Request
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(json["success"], false);
        assert!(json["errors"][0].as_str().unwrap().contains("E.164"));
    }

    // ========================================================================
    // Test 10: Empty message validation
    // **Validates: Requirements 9.6**
    // ========================================================================
    
    #[tokio::test]
    async fn test_empty_message() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        let app = api_routes::router(state.clone());

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "+6281234567890",
                    "message": "   " // Empty/whitespace only
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should return 400 Bad Request
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(json["success"], false);
        assert!(json["errors"][0].as_str().unwrap().contains("empty"));
    }

    // ========================================================================
    // Test 11: Priority handling
    // **Validates: Requirements 9.6**
    // ========================================================================
    
    #[tokio::test]
    async fn test_priority_handling() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        let app = api_routes::router(state.clone());

        // Test with low priority
        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "+6281234567890",
                    "message": "Low priority message",
                    "priority": "low"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
        
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        
        // Low priority should have longer estimated send time (30 seconds)
        let estimated_time = json["data"]["estimated_send_time"].as_str().unwrap();
        let estimated_dt = chrono::DateTime::parse_from_rfc3339(estimated_time).unwrap();
        let now = chrono::Utc::now();
        let diff = estimated_dt.signed_duration_since(now).num_seconds();
        
        // Should be around 30 seconds (allow some tolerance)
        assert!(diff >= 25 && diff <= 35, "Expected ~30s delay, got {}s", diff);
    }

    // ========================================================================
    // Test 12: Message sanitization
    // **Validates: Requirements 15.2**
    // ========================================================================
    
    #[tokio::test]
    async fn test_message_sanitization() {
        // Skip if Redis not available
        let state = match create_test_state_with_queue().await {
            Ok(s) => s,
            Err(_) => {
                eprintln!("Skipping test: Redis not available");
                return;
            }
        };

        let user_id = create_test_user(&state.pool).await;
        let (_, plain_token) = create_test_api_token(&state.pool, &user_id).await;
        let account_id = create_test_wa_account(&state.pool, &user_id, "connected").await;

        let app = api_routes::router(state.clone());

        // Test with message containing control characters
        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/send")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, format!("Bearer {}", plain_token))
            .body(Body::from(
                json!({
                    "account_id": account_id,
                    "target_phone": "+6281234567890",
                    "message": "Hello\x00World\x01Test" // Contains control characters
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        
        // Should succeed (control characters are sanitized, not rejected)
        assert_eq!(response.status(), StatusCode::OK);
    }
}
