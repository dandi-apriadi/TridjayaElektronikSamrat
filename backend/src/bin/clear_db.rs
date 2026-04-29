use sqlx::sqlite::SqlitePoolOptions;
use std::env;

fn ensure_destructive_allowed() -> Result<(), Box<dyn std::error::Error>> {
    let flag = env::var("ALLOW_DESTRUCTIVE").unwrap_or_default();
    if flag != "yes-i-mean-it" {
        return Err("Refusing to run destructive tool without ALLOW_DESTRUCTIVE=yes-i-mean-it".into());
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    ensure_destructive_allowed()?;

    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Clearing database tables (except users and partners)...");
    
    let tables = [
        "reward_tiers",
        "agent_stats",
        "achievements",
        "agent_achievements",
        "reward_claims",
        "products",
        "promos",
        "blog_posts",
        "job_listings",
        "leads",
        "notifications",
        "telemetry_page_views",
        "telemetry_clicks",
        "telemetry_whatsapp_clicks",
        "telemetry_pixel_events",
        "agent_registrations",
        "support_tickets",
        "password_reset_tokens",
        "catalogs",
        "articles",
        "jobs"
    ];

    for table in tables {
        match sqlx::query(&format!("DELETE FROM {}", table)).execute(&pool).await {
            Ok(_) => println!("Table {} cleared.", table),
            Err(e) => println!("Warning: Could not clear table {} (it might not exist): {}", table, e),
        }
    }

    println!("Database cleanup completed.");

    Ok(())
}
