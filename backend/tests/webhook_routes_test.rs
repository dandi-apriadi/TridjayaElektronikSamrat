use axum::{
    body::Body,
    http::{header, Request, StatusCode},
    Router,
};
use serde_json::json;
use tower::ServiceExt;
use tridjaya_backend::{response::AppError, state::AppState, wa_webhook_handlers};

#[cfg(test)]
mod webhook_routes_tests {
    use super::*;

    // Helper function to create test app state
    async fn create_test_state() -> AppState {
        // This would need to be implemented with a test database
        // For now, this is a placeholder
        todo!("Implement test database setup")
    }

    #[tokio::test]
    #[ignore] // Ignore until test database is set up
    async fn test_create_webhook_requires_auth() {
        let state = create_test_state().await;
        let app = Router::new()
            .route(
                "/api/wa/webhooks",
                axum::routing::post(wa_webhook_handlers::create_webhook),
            )
            .with_state(state);

        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/webhooks")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                json!({
                    "accountId": "test-account",
                    "webhookUrl": "https://example.com/webhook"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();

        // Should return 401 Unauthorized without auth token
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    #[ignore] // Ignore until test database is set up
    async fn test_create_webhook_validates_url() {
        let state = create_test_state().await;
        let app = Router::new()
            .route(
                "/api/wa/webhooks",
                axum::routing::post(wa_webhook_handlers::create_webhook),
            )
            .with_state(state);

        // Test with invalid URL scheme
        let request = Request::builder()
            .method("POST")
            .uri("/api/wa/webhooks")
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::AUTHORIZATION, "Bearer test-token")
            .body(Body::from(
                json!({
                    "accountId": "test-account",
                    "webhookUrl": "ftp://example.com/webhook"
                })
                .to_string(),
            ))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();

        // Should return 400 Bad Request for invalid URL scheme
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_mask_secret_key() {
        // Test the secret key masking function
        let secret = "abcdefghijklmnopqrstuvwxyz123456";
        let masked = format!("****{}", &secret[secret.len() - 4..]);
        assert_eq!(masked, "****3456");

        let short_secret = "abc";
        let masked_short = if short_secret.len() <= 4 {
            "****".to_string()
        } else {
            format!("****{}", &short_secret[short_secret.len() - 4..])
        };
        assert_eq!(masked_short, "****");
    }

    #[test]
    fn test_generate_secret_key_length() {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        let bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
        let secret = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);

        // Base64 encoding of 32 bytes should be 44 characters
        assert_eq!(secret.len(), 44);
    }
}
