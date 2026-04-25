use std::net::SocketAddr;
use axum::http::{HeaderValue, Method};
use tower_http::{cors::{AllowOrigin, CorsLayer}, trace::TraceLayer};
use tracing_subscriber::EnvFilter;
use sqlx::sqlite::SqlitePoolOptions;
use dotenvy::dotenv;

use tridjaya_backend::{routes, state::AppState, seed::seed_database};

#[tokio::main]
async fn main() {
    dotenv().ok();
    
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_target(false)
        .compact()
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to SQLite");

    // Run Migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Seed Data
    if let Err(e) = seed_database(&pool).await {
        tracing::error!("Failed to seed database: {}", e);
    }

    let allowed_origins = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5176,http://127.0.0.1:5176,http://localhost:5177,http://127.0.0.1:5177,http://localhost:5178,http://127.0.0.1:5178".to_string());
    let origins: Vec<HeaderValue> = allowed_origins
        .split(',')
        .filter_map(|origin| HeaderValue::from_str(origin.trim()).ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([axum::http::header::AUTHORIZATION, axum::http::header::CONTENT_TYPE])
        .allow_credentials(true);

    let state = AppState::new(pool);
    let app = routes::router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "0.0.0.0:8081".parse().expect("valid listen address");
    tracing::info!("Backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind address");
    axum::serve(listener, app).await.expect("server error");
}
