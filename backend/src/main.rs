use axum::body::Body;
use axum::extract::{ConnectInfo, DefaultBodyLimit, State};
use axum::http::{HeaderName, HeaderValue, Method, Request, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use dotenvy::dotenv;
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlSslMode};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;
use uuid::Uuid;

use tridjaya_backend::{cleanup::CleanupManager, routes, seed::seed_database, state::AppState};

fn is_production_runtime() -> bool {
    matches!(
        std::env::var("APP_ENV").ok().as_deref(),
        Some("production") | Some("prod")
    ) || matches!(
        std::env::var("RUST_ENV").ok().as_deref(),
        Some("production") | Some("prod")
    )
}

fn is_valid_pixel_encryption_key(value: &str) -> bool {
    let trimmed = value.trim();
    trimmed.len() == 64 && trimmed.chars().all(|ch| ch.is_ascii_hexdigit())
}

fn is_local_database_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || matches!(host, "127.0.0.1" | "::1")
        || host
            .parse::<std::net::IpAddr>()
            .map(|ip| ip.is_loopback())
            .unwrap_or(false)
}

fn enforce_database_tls_policy(options: &MySqlConnectOptions) {
    if !is_production_runtime() || is_local_database_host(options.get_host()) {
        return;
    }

    let insecure_override = std::env::var("ALLOW_INSECURE_DATABASE_TLS")
        .map(|value| value.eq_ignore_ascii_case("true") || value == "1")
        .unwrap_or(false);

    if matches!(
        options.get_ssl_mode(),
        MySqlSslMode::VerifyCa | MySqlSslMode::VerifyIdentity
    ) {
        return;
    }

    if insecure_override {
        tracing::warn!(
            "ALLOW_INSECURE_DATABASE_TLS=true; remote production MySQL is not using verified TLS"
        );
        return;
    }

    tracing::error!(
        "FATAL: remote production MySQL requires DATABASE_URL ssl-mode=VERIFY_CA or VERIFY_IDENTITY"
    );
    panic!("remote production MySQL requires verified TLS");
}

/// Middleware to block public access to /uploads/private/ directory
async fn block_private_uploads(request: Request<Body>, next: Next) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    if path.starts_with("/uploads/private/") || path.starts_with("/uploads/private") {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(next.run(request).await)
}

/// Stash the TCP peer address as the `x-tridjaya-peer-ip` request header so
/// downstream handlers can read it via the regular `HeaderMap` even when no
/// reverse proxy is in front of the backend. This is the fallback used by
/// `extract_client_ip` whenever `TRUST_PROXY_HEADERS=false`.
///
/// Without this middleware all IP-based rate limits silently no-op when the
/// backend is deployed without a proxy, which makes brute-force login,
/// catalog scraping, and agent-registration spam trivial.
async fn inject_peer_ip(mut request: Request<Body>, next: Next) -> Response {
    if let Some(ConnectInfo(addr)) = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .cloned()
    {
        if let Ok(value) = HeaderValue::from_str(&addr.ip().to_string()) {
            request
                .headers_mut()
                .insert(HeaderName::from_static("x-tridjaya-peer-ip"), value);
        }
    }
    next.run(request).await
}

async fn overload_guard(
    State(limit): State<Arc<Semaphore>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    if request.uri().path() == "/health" {
        return next.run(request).await;
    }

    let Ok(_permit) = limit.try_acquire_owned() else {
        let mut response = (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({
                "success": false,
                "message": "Server sedang sibuk. Coba lagi sebentar.",
                "detail": "overloaded",
                "errors": []
            })),
        )
            .into_response();
        response.headers_mut().insert(
            HeaderName::from_static("retry-after"),
            HeaderValue::from_static("2"),
        );
        response.headers_mut().insert(
            HeaderName::from_static("x-overload-protection"),
            HeaderValue::from_static("active"),
        );
        return response;
    };

    next.run(request).await
}

async fn add_request_id(request: Request<Body>, next: Next) -> Response {
    let request_id = request
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let mut request = request;
    request.extensions_mut().insert(request_id.clone());

    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response
            .headers_mut()
            .insert(HeaderName::from_static("x-request-id"), value);
    }

    response
}

async fn add_security_headers(request: Request<Body>, next: Next) -> Response {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    headers.insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("DENY"),
    );
    headers.insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    // Two CSP profiles:
    //
    // * Default (backwards-compatible): permits inline scripts / styles because
    //   the legacy admin dashboard still ships a few inline handlers. Use only
    //   when staging the strict variant first.
    // * Strict (opt-in via `STRICT_CSP=true`): drops `'unsafe-inline'` for both
    //   script-src and style-src and tightens `connect-src` to `'self'`. This
    //   removes the main XSS-escalation foothold but requires the Vite build
    //   to emit no inline scripts/styles. Toggle it after smoke-testing the
    //   production bundle.
    let strict_csp_enabled = std::env::var("STRICT_CSP")
        .map(|value| value.eq_ignore_ascii_case("true") || value == "1")
        .unwrap_or(false);

    let csp_value = if strict_csp_enabled {
        "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    } else {
        "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http: https: ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    };

    headers.insert(
        HeaderName::from_static("content-security-policy"),
        HeaderValue::from_static(csp_value),
    );

    if is_production_runtime() {
        headers.insert(
            HeaderName::from_static("strict-transport-security"),
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        );
    }

    response
}

async fn restore_wa_sessions(state: AppState) {
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;

    let accounts: Vec<(String, Option<String>)> = match sqlx::query_as(
        "SELECT id, credentials
         FROM wa_accounts
         WHERE enabled = 1
           AND (
             status IN ('connected', 'connecting', 'reconnecting', 'qr_ready', 'error')
             OR (status = 'disconnected' AND last_error IS NOT NULL)
             OR EXISTS (
               SELECT 1 FROM wa_session_health
               WHERE wa_session_health.session_id = wa_accounts.id
                 AND wa_session_health.status = 'connected'
             )
           )",
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(rows) => rows,
        Err(e) => {
            tracing::error!("Failed to load WA sessions for restore: {}", e);
            return;
        }
    };

    if accounts.is_empty() {
        tracing::info!("No WA sessions need startup restore");
        return;
    }

    tracing::info!(count = accounts.len(), "Restoring WA sessions on startup");

    for (session_id, credentials) in accounts {
        let has_db_credentials = credentials
            .as_deref()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
        let has_local_credentials = [
            PathBuf::from("sessions")
                .join(&session_id)
                .join("creds.json"),
            PathBuf::from("backend")
                .join("sessions")
                .join(&session_id)
                .join("creds.json"),
        ]
        .iter()
        .any(|path| path.exists());

        if !has_db_credentials && !has_local_credentials {
            tracing::warn!(
                session_id = %session_id,
                "Skipping WA startup restore because no DB or local Baileys credentials exist"
            );
            continue;
        }

        if let Err(e) = sqlx::query(
            "UPDATE wa_accounts SET status = 'reconnecting', last_error = NULL WHERE id = ?",
        )
        .bind(&session_id)
        .execute(&state.pool)
        .await
        {
            tracing::warn!(session_id = %session_id, error = %e, "Failed to mark WA session as reconnecting");
        }

        let restore_result = async {
            state
                .bridge_client
                .spawn_process(session_id.clone())
                .await?;

            let mut params = serde_json::json!({ "session_id": session_id.clone() });
            if let Some(credentials) = credentials
                .as_ref()
                .filter(|value| !value.trim().is_empty())
            {
                params["credentials"] = serde_json::Value::String(credentials.clone());
            }

            state
                .bridge_client
                .send_request(&session_id, "init_session".to_string(), params)
                .await?;

            Ok::<(), tridjaya_backend::bridge::BridgeError>(())
        }
        .await;

        if let Err(e) = restore_result {
            tracing::error!(session_id = %session_id, error = %e, "Failed to restore WA session");

            let _ =
                sqlx::query("UPDATE wa_accounts SET status = 'error', last_error = ? WHERE id = ?")
                    .bind(format!("Startup restore failed: {}", e))
                    .bind(&session_id)
                    .execute(&state.pool)
                    .await;
        }
    }
}

#[tokio::main]
async fn main() {
    if !is_production_runtime() {
        dotenv().ok();
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");
    tracing::info!("Connecting to database...");

    let mysql_pool_max_connections = std::env::var("MYSQL_MAX_CONNECTIONS")
        .ok()
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(25);
    let mysql_acquire_timeout_secs = std::env::var("MYSQL_ACQUIRE_TIMEOUT_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(5)
        .min(30);
    let mysql_idle_timeout_secs = std::env::var("MYSQL_IDLE_TIMEOUT_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(300)
        .min(3600);

    let mysql_options = MySqlConnectOptions::from_str(&database_url)
        .map_err(|e| {
            tracing::error!("Invalid MySQL DATABASE_URL {}: {}", database_url, e);
            e
        })
        .expect("Invalid MySQL DATABASE_URL");
    enforce_database_tls_policy(&mysql_options);

    let pool = MySqlPoolOptions::new()
        .max_connections(mysql_pool_max_connections)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(mysql_acquire_timeout_secs))
        .idle_timeout(Duration::from_secs(mysql_idle_timeout_secs))
        .max_lifetime(Duration::from_secs(1800))
        .connect_with(mysql_options)
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to MySQL at {}: {}", database_url, e);
            e
        })
        .expect("Failed to connect to MySQL. Check DATABASE_URL and database availability.");

    let skip_db_migrations = std::env::var("SKIP_DB_MIGRATIONS")
        .map(|value| {
            matches!(
                value.trim().to_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false);

    if skip_db_migrations {
        tracing::warn!("Skipping database migrations because SKIP_DB_MIGRATIONS is enabled");
    } else {
        // Run Migrations
        tracing::info!("Running database migrations...");
        sqlx::migrate!("./migrations_mysql")
            .run(&pool)
            .await
            .map_err(|e| {
                tracing::error!("Migration error: {}", e);
                e
            })
            .expect("Failed to run migrations");
    }

    // Seed Data
    if let Err(e) = seed_database(&pool).await {
        tracing::error!("Failed to seed database: {}", e);
    }

    // Diagnostic: Check if columns exist
    match sqlx::query_as::<_, (String,)>("SHOW COLUMNS FROM agent_registrations")
        .fetch_all(&pool)
        .await
    {
        Ok(rows) => {
            let columns: Vec<String> = rows.into_iter().map(|row| row.0).collect();
            tracing::info!("Agent registration columns: {:?}", columns);

            // Check count
            let count_row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agent_registrations")
                .fetch_one(&pool)
                .await
                .unwrap_or((0,));
            tracing::info!("Total agent registrations in DB: {}", count_row.0);
        }
        Err(e) => tracing::error!("Failed to check agent_registrations table: {}", e),
    }

    match sqlx::query_as::<_, (String,)>("SHOW COLUMNS FROM products")
        .fetch_all(&pool)
        .await
    {
        Ok(rows) => {
            let columns: Vec<String> = rows.into_iter().map(|row| row.0).collect();
            tracing::info!("Products table columns: {:?}", columns);
        }
        Err(e) => tracing::error!("Failed to check products table: {}", e),
    }

    // Security guards for production
    if is_production_runtime() {
        if std::env::var("COOKIE_SECURE").unwrap_or_default() != "true" {
            tracing::error!("FATAL: COOKIE_SECURE must be set to 'true' in production!");
            panic!("COOKIE_SECURE must be true in production");
        }
        match std::env::var("PIXEL_ENCRYPTION_KEY") {
            Ok(value) if is_valid_pixel_encryption_key(&value) => {}
            Ok(_) => {
                tracing::error!(
                    "FATAL: PIXEL_ENCRYPTION_KEY must be a 64-character hex string in production!"
                );
                panic!("PIXEL_ENCRYPTION_KEY must be a valid 64-character hex string");
            }
            Err(_) => {
                tracing::error!("FATAL: PIXEL_ENCRYPTION_KEY must be set in production!");
                panic!("PIXEL_ENCRYPTION_KEY must be set in production");
            }
        }
        tracing::info!("Production security guards passed");
    }

    let allowed_origins = std::env::var("ALLOWED_ORIGINS").ok();
    let origin_list = allowed_origins.unwrap_or_else(|| {
        if is_production_runtime() {
            tracing::error!("FATAL: ALLOWED_ORIGINS must be set in production mode!");
            panic!("ALLOWED_ORIGINS must be set in production");
        }

        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:5176,http://127.0.0.1:5176,http://localhost:5177,http://127.0.0.1:5177,http://localhost:5178,http://127.0.0.1:5178".to_string()
    });
    let mut origins: Vec<HeaderValue> = Vec::new();
    for origin in origin_list
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
    {
        if origin == "*" || origin.contains('*') {
            tracing::error!("FATAL: ALLOWED_ORIGINS must not contain wildcard origins when credentials are enabled");
            panic!("ALLOWED_ORIGINS must not contain wildcard origins");
        }
        if !(origin.starts_with("http://") || origin.starts_with("https://")) {
            tracing::error!("FATAL: invalid CORS origin in ALLOWED_ORIGINS: {}", origin);
            panic!("ALLOWED_ORIGINS contains an invalid origin");
        }
        let header = HeaderValue::from_str(origin).unwrap_or_else(|e| {
            tracing::error!("FATAL: invalid CORS origin {}: {}", origin, e);
            panic!("ALLOWED_ORIGINS contains an invalid origin");
        });
        origins.push(header);
    }
    if is_production_runtime() && origins.is_empty() {
        tracing::error!("FATAL: ALLOWED_ORIGINS is empty or contains invalid URLs!");
        panic!("ALLOWED_ORIGINS is empty or invalid in production");
    }
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::AUTHORIZATION,
            axum::http::header::CONTENT_TYPE,
        ])
        .allow_credentials(true);

    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    tracing::info!("Connecting to Redis at {}...", redis_url);

    let redis_client = redis::Client::open(redis_url.clone())
        .map_err(|e| {
            tracing::error!("Invalid Redis URL {}: {}", redis_url, e);
            e
        })
        .expect("Invalid Redis URL");

    let redis_conn = redis::aio::ConnectionManager::new(redis_client)
        .await
        .map_err(|e| {
            tracing::error!(
                "CRITICAL: Failed to connect to Redis at {}. Is redis-server running? Error: {}",
                redis_url,
                e
            );
            e
        })
        .expect("Failed to create Redis connection manager");

    let cache = std::sync::Arc::new(tridjaya_backend::cache::CacheManager::new(
        redis_conn.clone(),
    ));

    // Start adaptive sync in background
    let cache_clone = cache.clone();
    tokio::spawn(async move {
        cache_clone.start_adaptive_sync().await;
    });

    // Initialize QueueManager for WhatsApp gateway
    let queue_manager = match tridjaya_backend::redis_manager::RedisManager::new(&redis_url).await {
        Ok(redis_manager) => {
            tracing::info!("Redis manager initialized for queue management");
            let qm =
                tridjaya_backend::queue_manager::QueueManager::new(redis_manager, pool.clone());
            Some(std::sync::Arc::new(qm))
        }
        Err(e) => {
            tracing::warn!(
                "Failed to initialize queue manager: {}. API send endpoint will be unavailable.",
                e
            );
            None
        }
    };

    let (state, bridge_event_rx) = AppState::new(pool, cache);
    let mut state = state.with_redis(redis_conn);
    if let Some(qm) = queue_manager {
        state = state.with_queue_manager(qm);
    }

    if let Some(qm) = state.queue_manager.clone() {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
            loop {
                interval.tick().await;
                if let Err(e) = qm.recover_running_campaigns().await {
                    tracing::warn!("WA queue recovery failed: {}", e);
                }
            }
        });
    }

    let cleanup_manager = Arc::new(CleanupManager::new(
        state.pool.clone(),
        state.redis.clone(),
        state.queue_manager.clone(),
        None,
        vec![PathBuf::from("uploads"), PathBuf::from("uploads/temp")],
    ));

    {
        let cleanup_runner = cleanup_manager.clone();
        tokio::spawn(async move {
            cleanup_runner.start_scheduler().await;
        });
    }

    let janitor_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            janitor_state.cleanup_expired_sessions().await;
        }
    });

    // Start Bridge Event Processor (handles QR, connected, message_received, etc.)
    let bridge_pool = state.pool.clone();
    tokio::spawn(async move {
        tridjaya_backend::bridge_event_processor::run(bridge_pool, bridge_event_rx).await;
    });

    let restore_state = state.clone();
    tokio::spawn(async move {
        restore_wa_sessions(restore_state).await;
    });

    // Start BlastEngine (advanced, uses Redis + Baileys bridge)
    if let (Some(qm), Some(redis_arc)) = (&state.queue_manager, &state.redis) {
        let redis_conn = redis_arc.read().await.clone();
        let media_handler = tridjaya_backend::media_handler::MediaHandler::new(redis_conn);
        let blast_engine = tridjaya_backend::blast_engine::BlastEngine::new(
            tridjaya_backend::blast_engine::BlastEngineConfig::default(),
            qm.clone(),
            state.bridge_client.clone(),
            state.pool.clone(),
            media_handler,
        );
        tokio::spawn(async move {
            blast_engine.start().await;
        });
        tracing::info!("BlastEngine started with Baileys bridge");
    } else {
        tracing::warn!("BlastEngine not started — Redis or queue manager not available");
    }

    // Start Meta CAPI retry job (every 60 seconds)
    let retry_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let start = std::time::Instant::now();
            tracing::info!("Meta CAPI retry job starting...");
            if let Err(e) =
                tridjaya_backend::pixel::meta_capi::retry_failed_events(&retry_state.pool).await
            {
                tracing::error!("Meta CAPI retry job failed: {}", e);
            } else {
                // Update last_retry_run timestamp
                *retry_state.last_retry_run.write().await = Some(chrono::Utc::now());
            }
            tracing::info!("Meta CAPI retry job completed in {:?}", start.elapsed());
        }
    });

    // Start analytics aggregation job (every 5 minutes)
    let analytics_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            tracing::info!("Analytics aggregation job triggered");
            if let Err(e) = tridjaya_backend::pixel::analytics_job::run_analytics_aggregation(
                &analytics_state.pool,
                &analytics_state,
            )
            .await
            {
                tracing::error!("Analytics aggregation job error: {}", e);
            }
        }
    });

    let max_in_flight_requests = std::env::var("MAX_IN_FLIGHT_REQUESTS")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(300)
        .min(10_000);
    tracing::info!(
        max_in_flight_requests,
        mysql_pool_max_connections,
        mysql_acquire_timeout_secs,
        "Overload protection configured"
    );
    let request_limit = Arc::new(Semaphore::new(max_in_flight_requests));

    let app = routes::router(state.clone())
        .layer(axum::middleware::from_fn(block_private_uploads))
        .layer(axum::middleware::from_fn(add_security_headers))
        .layer(axum::middleware::from_fn(add_request_id))
        // Must come BEFORE handlers so `extract_client_ip` can read the peer IP
        // from headers regardless of TRUST_PROXY_HEADERS. Placed last in the
        // tower chain so it runs first on the request side.
        .layer(axum::middleware::from_fn(inject_peer_ip))
        // Default body limit: 1MB for most endpoints
        .layer(DefaultBodyLimit::max(1 * 1024 * 1024))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(
                std::env::var("REQUEST_TIMEOUT_SECS")
                    .ok()
                    .and_then(|value| value.parse::<u64>().ok())
                    .filter(|value| *value > 0)
                    .unwrap_or(30),
            ),
        ))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn_with_state(
            request_limit,
            overload_guard,
        ));

    let listen_port = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(8081);
    let addr: SocketAddr = format!("0.0.0.0:{}", listen_port)
        .parse()
        .expect("valid listen address");
    tracing::info!("Backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind address");

    let shutdown_cleanup = cleanup_manager.clone();
    let shutdown_signal = async move {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::error!("Failed to listen for shutdown signal: {}", e);
            return;
        }

        tracing::info!("Shutdown signal received, starting graceful shutdown");
        if let Err(e) = shutdown_cleanup
            .graceful_shutdown(std::time::Duration::from_secs(30))
            .await
        {
            tracing::error!("Graceful shutdown encountered an error: {}", e);
        }
    };

    // Use `into_make_service_with_connect_info` so each request carries the
    // peer SocketAddr in its extensions; `inject_peer_ip` reads it.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal)
    .await
    .expect("server error");
}
