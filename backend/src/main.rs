use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
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

    let state = AppState::new(pool);
    let app = routes::router(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = "0.0.0.0:8081".parse().expect("valid listen address");
    tracing::info!("Backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind address");
    axum::serve(listener, app).await.expect("server error");
}
