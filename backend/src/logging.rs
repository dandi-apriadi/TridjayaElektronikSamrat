/*!
 * Structured logging configuration for the self-hosted WhatsApp gateway.
 *
 * **Validates: Requirements 20.3, 20.4, 20.5, 20.6**
 *
 * Provides:
 * - JSON-formatted log output when `LOG_FORMAT=json` (default in production).
 * - Compact human-readable output otherwise.
 * - A correlation-id middleware that injects `X-Correlation-Id` into request
 *   spans and response headers, so every log line emitted while handling a
 *   request can be traced back to the originating client call.
 */

use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};
use tracing::Span;
use tracing_subscriber::{fmt, EnvFilter};
use uuid::Uuid;

/// Header name used to read or emit the correlation id.
pub const CORRELATION_HEADER: &str = "x-correlation-id";

/// Initialize the global tracing subscriber.
///
/// `LOG_FORMAT=json` enables JSON output (recommended for production).
/// Any other value (or unset) keeps the existing compact format used in
/// development.
pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    let format = std::env::var("LOG_FORMAT")
        .ok()
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    if format == "json" {
        fmt()
            .json()
            .with_env_filter(filter)
            .with_current_span(true)
            .with_span_list(false)
            .with_target(true)
            .flatten_event(true)
            .init();
    } else {
        fmt()
            .with_env_filter(filter)
            .with_target(false)
            .compact()
            .init();
    }
}

/// Axum middleware that ensures every request has a correlation id and
/// records it on the current tracing span.
///
/// If the incoming request already carries an `X-Correlation-Id` header it is
/// reused; otherwise a fresh UUID v4 is generated. The id is also written
/// back to the response so downstream services and clients can correlate
/// logs.
pub async fn correlation_id_middleware(
    mut request: Request,
    next: Next,
) -> Response {
    let header_name = HeaderName::from_static(CORRELATION_HEADER);
    let correlation_id = request
        .headers()
        .get(&header_name)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    if let Ok(value) = HeaderValue::from_str(&correlation_id) {
        request.headers_mut().insert(header_name.clone(), value);
    }

    Span::current().record("correlation_id", tracing::field::display(&correlation_id));

    let mut response = next.run(request).await;

    if let Ok(value) = HeaderValue::from_str(&correlation_id) {
        response.headers_mut().insert(header_name, value);
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request as HttpRequest, StatusCode},
        middleware,
        routing::get,
        Router,
    };
    use tower::ServiceExt;

    async fn echo_handler() -> &'static str {
        "ok"
    }

    #[tokio::test]
    async fn middleware_inserts_correlation_id_when_missing() {
        let app = Router::new()
            .route("/", get(echo_handler))
            .layer(middleware::from_fn(correlation_id_middleware));

        let response = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let header = response
            .headers()
            .get(CORRELATION_HEADER)
            .expect("correlation header missing");
        let value = header.to_str().unwrap();
        // Should be a non-empty UUID-like string
        assert!(!value.is_empty());
        assert!(value.contains('-'));
    }

    #[tokio::test]
    async fn middleware_preserves_existing_correlation_id() {
        let app = Router::new()
            .route("/", get(echo_handler))
            .layer(middleware::from_fn(correlation_id_middleware));

        let response = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/")
                    .header(CORRELATION_HEADER, "test-correlation-id-123")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response
                .headers()
                .get(CORRELATION_HEADER)
                .unwrap()
                .to_str()
                .unwrap(),
            "test-correlation-id-123"
        );
    }
}
