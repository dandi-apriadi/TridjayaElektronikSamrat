use sqlx::sqlite::SqlitePoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite:tridjaya.db")
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
