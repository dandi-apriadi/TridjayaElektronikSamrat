use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use axum::http::{HeaderValue, Method};
use axum::extract::DefaultBodyLimit;
use axum::middleware as axum_middleware;
use tower_http::{cors::{AllowOrigin, CorsLayer}, trace::TraceLayer, services::ServeDir};
use sqlx::sqlite::SqlitePoolOptions;
use dotenvy::dotenv;

use tridjaya_backend::{
    bridge::BridgeClient,
    chatbot_engine::{ChatbotEngine, ChatbotEngineConfig},
    cleanup::CleanupManager,
    logging::{correlation_id_middleware, init_tracing},
    routes,
    seed::seed_database,
    session_manager::SessionManager,
    state::AppState,
    webhook_forwarder::{WebhookForwarder, WebhookForwarderConfig},
};

fn is_production_runtime() -> bool {
    matches!(std::env::var("APP_ENV").ok().as_deref(), Some("production") | Some("prod"))
        || matches!(std::env::var("RUST_ENV").ok().as_deref(), Some("production") | Some("prod"))
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    init_tracing();

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

    let mut state = AppState::new(pool.clone(), cache).with_redis(redis_conn.clone());
    if let Some(qm) = queue_manager {
        state = state.with_queue_manager(qm);
    }

    // -- Self-hosted WhatsApp gateway components ----------------------------
    //
    // These components are best-effort: they require the Node.js Baileys
    // bridge to be available and (for the chatbot) Redis. If any of them
    // fail to initialize we keep the rest of the backend running and just
    // log a warning so the gateway endpoints (metrics, health, sessions)
    // still report degraded status instead of taking the whole API down.
    let (bridge_client, bridge_event_rx) = BridgeClient::new();
    let bridge_client = Arc::new(bridge_client);
    state = state.with_bridge_client(bridge_client.clone());

    match SessionManager::new(bridge_client.clone(), pool.clone()) {
        Ok(manager) => {
            let manager = Arc::new(manager);
            state = state.with_session_manager(manager.clone());

            // Best-effort: try to restore previously-paired sessions so they
            // come back online automatically after a restart.
            let restore_manager = manager.clone();
            tokio::spawn(async move {
                if let Err(e) = restore_manager.restore_all_sessions().await {
                    tracing::warn!("Failed to restore WA sessions on startup: {}", e);
                }
            });
        }
        Err(e) => {
            tracing::warn!(
                "Session manager unavailable ({}). /api/wa/sessions/* endpoints will return errors.",
                e
            );
        }
    }

    let webhook_forwarder = Arc::new(WebhookForwarder::new(
        WebhookForwarderConfig::default(),
        pool.clone(),
    ));
    state = state.with_webhook_forwarder(webhook_forwarder.clone());

    match ChatbotEngine::new(
        ChatbotEngineConfig {
            redis_url: redis_url.clone(),
            ..Default::default()
        },
        pool.clone(),
        bridge_client.clone(),
    ) {
        Ok(engine) => {
            let engine = Arc::new(engine);
            state = state.with_chatbot_engine(engine);
        }
        Err(e) => {
            tracing::warn!(
                "Chatbot engine unavailable ({}). Auto-replies will be disabled.",
                e
            );
        }
    }

    // Wire the bridge event receiver to a dispatcher that fans events out to
    // the webhook forwarder, status tracker, and chatbot engine.
    {
        use tokio::sync::mpsc;
        use tridjaya_backend::wa_event_dispatcher::WaEventDispatcher;

        let (webhook_tx, webhook_rx) = mpsc::unbounded_channel();
        let dispatcher = WaEventDispatcher::new().with_webhook_forwarder(webhook_tx);

        // Webhook forwarder consumes its own dedicated channel.
        let forwarder = webhook_forwarder.clone();
        tokio::spawn(async move {
            forwarder.start(webhook_rx).await;
        });

        tokio::spawn(async move {
            dispatcher.start(bridge_event_rx).await;
        });
    }

    // ----------------------------------------------------------------------

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

    let app = routes::router(state)
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum_middleware::from_fn(correlation_id_middleware));

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
