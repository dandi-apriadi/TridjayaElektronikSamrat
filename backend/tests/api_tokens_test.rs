use chrono::Utc;
use redis::aio::ConnectionManager;
use tokio::time::{sleep, Duration};
use tridjaya_backend::api_tokens::{
    check_ip_rate_limit, check_token_rate_limit, generate_api_token, validate_api_token,
    RateLimitError, TokenError,
};

mod support;

async fn setup_test_db() -> Option<sqlx::MySqlPool> {
    let pool = support::setup_mysql_test_pool().await?;

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

    Some(pool)
}

async fn setup_test_redis() -> ConnectionManager {
    let client =
        redis::Client::open("redis://127.0.0.1:6379").expect("Failed to create Redis client");
    ConnectionManager::new(client)
        .await
        .expect("Failed to connect to Redis")
}

#[tokio::test]
async fn test_token_generation_and_validation_flow() {
    let Some(pool) = setup_test_db().await else {
        return;
    };

    // Generate token
    let (token_id, plain_token) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "Integration Test Token".to_string(),
        vec!["wa_send".to_string(), "wa_webhook_manage".to_string()],
        None,
    )
    .await
    .expect("Failed to generate token");

    assert!(!token_id.is_empty());
    assert!(!plain_token.is_empty());

    // Validate token
    let record = validate_api_token(&pool, &plain_token)
        .await
        .expect("Token validation failed");

    assert_eq!(record.id, token_id);
    assert_eq!(record.user_id, "user_1");
    assert_eq!(record.name, "Integration Test Token");

    // Verify permissions
    let perms = record.get_permissions();
    assert_eq!(perms.len(), 2);
    assert!(perms.contains(&"wa_send".to_string()));
    assert!(perms.contains(&"wa_webhook_manage".to_string()));

    // Verify last_used_at was updated
    let updated_record: (Option<String>,) =
        sqlx::query_as("SELECT last_used_at FROM wa_api_tokens WHERE id = ?")
            .bind(&token_id)
            .fetch_one(&pool)
            .await
            .unwrap();

    assert!(updated_record.0.is_some(), "last_used_at should be updated");
}

#[tokio::test]
async fn test_token_with_expiration() {
    let Some(pool) = setup_test_db().await else {
        return;
    };

    // Generate token that expires in 1 hour
    let expires_at = Utc::now() + chrono::Duration::hours(1);
    let (_token_id, plain_token) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "Expiring Token".to_string(),
        vec!["wa_send".to_string()],
        Some(expires_at),
    )
    .await
    .expect("Failed to generate token");

    // Should validate successfully
    let result = validate_api_token(&pool, &plain_token).await;
    assert!(result.is_ok(), "Token should be valid");

    // Generate expired token
    let expired_at = Utc::now() - chrono::Duration::hours(1);
    let (_expired_id, expired_token) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "Expired Token".to_string(),
        vec!["wa_send".to_string()],
        Some(expired_at),
    )
    .await
    .expect("Failed to generate token");

    // Should fail validation
    let result = validate_api_token(&pool, &expired_token).await;
    assert!(result.is_err(), "Expired token should fail validation");
    match result {
        Err(TokenError::TokenExpired) => (),
        _ => panic!("Expected TokenExpired error"),
    }
}

#[tokio::test]
async fn test_invalid_token_validation() {
    let Some(pool) = setup_test_db().await else {
        return;
    };

    // Try to validate non-existent token
    let result = validate_api_token(&pool, "invalid_token_xyz").await;
    assert!(result.is_err());
    match result {
        Err(TokenError::InvalidToken) => (),
        _ => panic!("Expected InvalidToken error"),
    }
}

#[tokio::test]
async fn test_multiple_tokens_for_same_user() {
    let Some(pool) = setup_test_db().await else {
        return;
    };

    // Generate multiple tokens for the same user
    let (token1_id, plain_token1) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "Token 1".to_string(),
        vec!["wa_send".to_string()],
        None,
    )
    .await
    .expect("Failed to generate token 1");

    let (token2_id, plain_token2) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "Token 2".to_string(),
        vec!["wa_webhook_manage".to_string()],
        None,
    )
    .await
    .expect("Failed to generate token 2");

    assert_ne!(token1_id, token2_id);
    assert_ne!(plain_token1, plain_token2);

    // Both tokens should validate successfully
    let record1 = validate_api_token(&pool, &plain_token1).await.unwrap();
    let record2 = validate_api_token(&pool, &plain_token2).await.unwrap();

    assert_eq!(record1.name, "Token 1");
    assert_eq!(record2.name, "Token 2");
    assert_eq!(record1.user_id, "user_1");
    assert_eq!(record2.user_id, "user_1");
}

#[tokio::test]
#[ignore] // Requires Redis server running
async fn test_ip_rate_limiting_integration() {
    let mut redis = setup_test_redis().await;

    // Clear any existing data
    let _: Result<(), redis::RedisError> = redis::cmd("DEL")
        .arg("ratelimit:ip:10.0.0.1")
        .query_async(&mut redis)
        .await;

    // Make 100 requests (at limit)
    for i in 0..100 {
        let result = check_ip_rate_limit(&mut redis, "10.0.0.1").await;
        assert!(result.is_ok(), "Request {} should be allowed", i + 1);
    }

    // 101st request should be rejected
    let result = check_ip_rate_limit(&mut redis, "10.0.0.1").await;
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
async fn test_token_rate_limiting_integration() {
    let mut redis = setup_test_redis().await;

    // Clear any existing data
    let _: Result<(), redis::RedisError> = redis::cmd("DEL")
        .arg("ratelimit:token:test_token_123")
        .query_async(&mut redis)
        .await;

    // Make 100 requests (at limit)
    for i in 0..100 {
        let result = check_token_rate_limit(&mut redis, "test_token_123").await;
        assert!(result.is_ok(), "Request {} should be allowed", i + 1);
    }

    // 101st request should be rejected
    let result = check_token_rate_limit(&mut redis, "test_token_123").await;
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
async fn test_rate_limit_isolation_between_ips() {
    let mut redis = setup_test_redis().await;

    // Clear any existing data
    let _: Result<(), redis::RedisError> = redis::cmd("DEL")
        .arg("ratelimit:ip:10.0.0.2")
        .arg("ratelimit:ip:10.0.0.3")
        .query_async(&mut redis)
        .await;

    // Exhaust rate limit for IP 10.0.0.2
    for _ in 0..100 {
        check_ip_rate_limit(&mut redis, "10.0.0.2")
            .await
            .expect("Request should be allowed");
    }

    // IP 10.0.0.2 should be rate limited
    let result = check_ip_rate_limit(&mut redis, "10.0.0.2").await;
    assert!(result.is_err(), "IP 10.0.0.2 should be rate limited");

    // IP 10.0.0.3 should still be allowed
    let result = check_ip_rate_limit(&mut redis, "10.0.0.3").await;
    assert!(result.is_ok(), "IP 10.0.0.3 should not be rate limited");
}

#[tokio::test]
#[ignore] // Requires Redis server running and takes 61+ seconds
async fn test_rate_limit_window_expiration() {
    let mut redis = setup_test_redis().await;

    // Clear any existing data
    let _: Result<(), redis::RedisError> = redis::cmd("DEL")
        .arg("ratelimit:ip:10.0.0.4")
        .query_async(&mut redis)
        .await;

    // Exhaust rate limit
    for _ in 0..100 {
        check_ip_rate_limit(&mut redis, "10.0.0.4")
            .await
            .expect("Request should be allowed");
    }

    // Should be rate limited
    let result = check_ip_rate_limit(&mut redis, "10.0.0.4").await;
    assert!(result.is_err(), "Should be rate limited");

    // Wait for window to expire (61 seconds to be safe)
    println!("Waiting 61 seconds for rate limit window to expire...");
    sleep(Duration::from_secs(61)).await;

    // Should be allowed again
    let result = check_ip_rate_limit(&mut redis, "10.0.0.4").await;
    assert!(result.is_ok(), "Should be allowed after window expiration");
}

#[tokio::test]
#[ignore] // Requires Redis server running
async fn test_concurrent_rate_limit_checks() {
    let mut redis = setup_test_redis().await;

    // Clear any existing data
    let _: Result<(), redis::RedisError> = redis::cmd("DEL")
        .arg("ratelimit:ip:10.0.0.5")
        .query_async(&mut redis)
        .await;

    // Spawn 50 concurrent requests
    let mut handles = vec![];
    for _ in 0..50 {
        let mut redis_clone = redis.clone();
        let handle =
            tokio::spawn(async move { check_ip_rate_limit(&mut redis_clone, "10.0.0.5").await });
        handles.push(handle);
    }

    // All should succeed (within limit)
    let mut success_count = 0;
    for handle in handles {
        if handle.await.unwrap().is_ok() {
            success_count += 1;
        }
    }

    assert_eq!(
        success_count, 50,
        "All 50 concurrent requests should succeed"
    );

    // Verify count is exactly 50
    let count: usize = redis::cmd("ZCARD")
        .arg("ratelimit:ip:10.0.0.5")
        .query_async(&mut redis)
        .await
        .expect("Failed to get count");
    assert_eq!(count, 50, "Redis should have exactly 50 entries");
}

#[tokio::test]
async fn test_token_permissions_serialization() {
    let Some(pool) = setup_test_db().await else {
        return;
    };

    // Generate token with multiple permissions
    let permissions = vec![
        "wa_send".to_string(),
        "wa_webhook_manage".to_string(),
        "wa_bomber".to_string(),
    ];

    let (_token_id, plain_token) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "Multi-Permission Token".to_string(),
        permissions.clone(),
        None,
    )
    .await
    .expect("Failed to generate token");

    // Validate and check permissions
    let record = validate_api_token(&pool, &plain_token).await.unwrap();
    let retrieved_perms = record.get_permissions();

    assert_eq!(retrieved_perms.len(), 3);
    for perm in permissions {
        assert!(
            retrieved_perms.contains(&perm),
            "Permission {} should be present",
            perm
        );
    }
}

#[tokio::test]
async fn test_token_with_empty_permissions() {
    let Some(pool) = setup_test_db().await else {
        return;
    };

    // Generate token with no permissions
    let (_token_id, plain_token) = generate_api_token(
        &pool,
        "user_1".to_string(),
        "No Permissions Token".to_string(),
        vec![],
        None,
    )
    .await
    .expect("Failed to generate token");

    // Validate and check permissions
    let record = validate_api_token(&pool, &plain_token).await.unwrap();
    let retrieved_perms = record.get_permissions();

    assert_eq!(retrieved_perms.len(), 0, "Should have no permissions");
}
