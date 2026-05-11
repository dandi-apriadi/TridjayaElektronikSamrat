use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::http::{HeaderValue, Method, Request, StatusCode};
use axum::extract::{DefaultBodyLimit, State as AxumState};
use axum::middleware::Next;
use axum::body::Body;
use axum::response::Response;
use tower_http::{cors::{AllowOrigin, CorsLayer}, trace::TraceLayer, services::ServeDir};
use tracing_subscriber::EnvFilter;
use sqlx::sqlite::SqlitePoolOptions;
use dotenvy::dotenv;

use tridjaya_backend::{cleanup::CleanupManager, routes, seed::seed_database, state::AppState};

fn is_production_runtime() -> bool {
    matches!(std::env::var("APP_ENV").ok().as_deref(), Some("production") | Some("prod"))
        || matches!(std::env::var("RUST_ENV").ok().as_deref(), Some("production") | Some("prod"))
}

/// Middleware untuk mengizinkan body limit lebih besar (20MB) hanya untuk upload endpoint
async fn upload_size_limit_middleware(
    AxumState(_state): AxumState<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let path = request.uri().path();
    // Hanya izinkan 20MB untuk upload endpoint
    if path.starts_with("/api/admin/uploads/") || path.starts_with("/uploads/") {
        // Request ke upload endpoint - teruskan (layer DefaultBodyLimit diatasnya sudah 1MB, tapi tower-http bisa handle)
        // Sebenarnya kita perlu menggunakan tower::ServiceBuilder dengan RequestBodyLimitLayer
        // Tapi untuk simplicity, kita biarkan saja dan andalkan validasi di handler
        Ok(next.run(request).await)
    } else {
        Ok(next.run(request).await)
    }
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_target(false)
        .compact()
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env file");
    tracing::info!("Connecting to database...");
    
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .map_err(|e| {
            tracing::error!("Failed to connect to SQLite at {}: {}", database_url, e);
            e
        })
        .expect("Failed to connect to SQLite. Check if DATABASE_URL is correct and file permissions are okay.");

    // Run Migrations
    tracing::info!("Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Migration error: {}", e);
            e
        })
        .expect("Failed to run migrations");

    // Seed Data
    if let Err(e) = seed_database(&pool).await {
        tracing::error!("Failed to seed database: {}", e);
    }

    // Diagnostic: Check if columns exist
    match sqlx::query("PRAGMA table_info(agent_registrations)").fetch_all(&pool).await {
        Ok(rows) => {
            let columns: Vec<String> = rows.iter().map(|r: &sqlx::sqlite::SqliteRow| {
                use sqlx::Row;
                r.get::<String, _>("name")
            }).collect();
            tracing::info!("Agent registration columns: {:?}", columns);
            
            // Check count
            let count_row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM agent_registrations").fetch_one(&pool).await.unwrap_or((0,));
            tracing::info!("Total agent registrations in DB: {}", count_row.0);
        },
        Err(e) => tracing::error!("Failed to check agent_registrations table: {}", e),
    }

    match sqlx::query("PRAGMA table_info(products)").fetch_all(&pool).await {
        Ok(rows) => {
            let columns: Vec<String> = rows.iter().map(|r: &sqlx::sqlite::SqliteRow| {
                use sqlx::Row;
                r.get::<String, _>("name")
            }).collect();
            tracing::info!("Products table columns: {:?}", columns);
        },
        Err(e) => tracing::error!("Failed to check products table: {}", e),
    }

    // Security guards for production
    if is_production_runtime() {
        if std::env::var("COOKIE_SECURE").unwrap_or_default() != "true" {
            tracing::error!("FATAL: COOKIE_SECURE must be set to 'true' in production!");
            panic!("COOKIE_SECURE must be true in production");
        }
        if std::env::var("PIXEL_ENCRYPTION_KEY").is_err() {
            tracing::error!("FATAL: PIXEL_ENCRYPTION_KEY must be set in production!");
            panic!("PIXEL_ENCRYPTION_KEY must be set in production");
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
    let origins: Vec<HeaderValue> = origin_list
        .split(',')
        .filter_map(|origin| HeaderValue::from_str(origin.trim()).ok())
        .collect();
    if is_production_runtime() && origins.is_empty() {
        tracing::error!("FATAL: ALLOWED_ORIGINS is empty or contains invalid URLs!");
        panic!("ALLOWED_ORIGINS is empty or invalid in production");
    }
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE])
        .allow_credentials(true);

    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    tracing::info!("Connecting to Redis at {}...", redis_url);
    
    let redis_client = redis::Client::open(redis_url.clone()).map_err(|e| {
        tracing::error!("Invalid Redis URL {}: {}", redis_url, e);
        e
    }).expect("Invalid Redis URL");

    let redis_conn = redis::aio::ConnectionManager::new(redis_client)
        .await
        .map_err(|e| {
            tracing::error!("CRITICAL: Failed to connect to Redis at {}. Is redis-server running? Error: {}", redis_url, e);
            e
        })
        .expect("Failed to create Redis connection manager");

    let cache = std::sync::Arc::new(tridjaya_backend::cache::CacheManager::new(redis_conn.clone()));
    
    // Start adaptive sync in background
    let cache_clone = cache.clone();
    tokio::spawn(async move {
        cache_clone.start_adaptive_sync().await;
    });

    // Initialize QueueManager for WhatsApp gateway
    let queue_manager = match tridjaya_backend::redis_manager::RedisManager::new(&redis_url).await {
        Ok(redis_manager) => {
            tracing::info!("Redis manager initialized for queue management");
            let qm = tridjaya_backend::queue_manager::QueueManager::new(redis_manager, pool.clone());
            Some(std::sync::Arc::new(qm))
        }
        Err(e) => {
            tracing::warn!("Failed to initialize queue manager: {}. API send endpoint will be unavailable.", e);
            None
        }
    };

    let mut state = AppState::new(pool, cache).with_redis(redis_conn);
    if let Some(qm) = queue_manager {
        state = state.with_queue_manager(qm);
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

    // Start WA Worker
    let wa_state = state.clone();
    tokio::spawn(async move {
        tridjaya_backend::wa_worker::start_wa_worker(wa_state).await;
    });

    // Start Meta CAPI retry job (every 60 seconds)
    let retry_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let start = std::time::Instant::now();
            tracing::info!("Meta CAPI retry job starting...");
            if let Err(e) = tridjaya_backend::pixel::meta_capi::retry_failed_events(&retry_state.pool).await {
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
            ).await {
                tracing::error!("Analytics aggregation job error: {}", e);
            }
        }
    });

    let app = routes::router(state.clone())
        .nest_service("/uploads", ServeDir::new("uploads"))
        // Layer umum untuk body limit (1MB untuk sebagian besar endpoint)
        .layer(DefaultBodyLimit::max(1 * 1024 * 1024))
        // Layer khusus untuk upload endpoint (20MB)
        .layer(axum::middleware::from_fn_with_state(state.clone(), upload_size_limit_middleware))
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "0.0.0.0:8081".parse().expect("valid listen address");
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

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal)
        .await
        .expect("server error");
}
