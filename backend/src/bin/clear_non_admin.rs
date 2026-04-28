use sqlx::sqlite::SqlitePoolOptions;
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Using database: {}", database_url);
    println!("Clearing non-admin users from database...");
    
    let res = sqlx::query("DELETE FROM users WHERE role != 'Admin' AND role != 'admin'").execute(&pool).await?;
    
    println!("Deleted {} non-admin users.", res.rows_affected());
    
    // Also clear other tables
    let tables = [
        "agent_stats",
        "agent_achievements",
        "reward_claims",
        "leads",
        "agent_registrations",
        "support_tickets",
        "telemetry_events",
        "notifications"
    ];

    for table in tables {
        match sqlx::query(&format!("DELETE FROM {}", table)).execute(&pool).await {
            Ok(res) => println!("Table {}: Deleted {} rows.", table, res.rows_affected()),
            Err(e) => eprintln!("Failed to clear table {}: {}", table, e),
        }
    }

    println!("Database cleanup completed.");

    Ok(())
}
