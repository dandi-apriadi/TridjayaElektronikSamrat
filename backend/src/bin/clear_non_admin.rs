use dotenvy::dotenv;
use sqlx::mysql::MySqlPoolOptions;
use std::env;

fn ensure_destructive_allowed() -> Result<(), Box<dyn std::error::Error>> {
    let flag = env::var("ALLOW_DESTRUCTIVE").unwrap_or_default();
    if flag != "yes-i-mean-it" {
        return Err(
            "Refusing to run destructive tool without ALLOW_DESTRUCTIVE=yes-i-mean-it".into(),
        );
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    ensure_destructive_allowed()?;
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "mysql://tridjaya:password@localhost:3306/tridjaya".to_string());

    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Using database: {}", database_url);
    println!("Clearing non-admin users from database...");

    let res = sqlx::query("DELETE FROM users WHERE role != 'Admin' AND role != 'admin'")
        .execute(&pool)
        .await?;

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
        "notifications",
    ];

    for table in tables {
        match sqlx::query(&format!("DELETE FROM {}", table))
            .execute(&pool)
            .await
        {
            Ok(res) => println!("Table {}: Deleted {} rows.", table, res.rows_affected()),
            Err(e) => eprintln!("Failed to clear table {}: {}", table, e),
        }
    }

    println!("Database cleanup completed.");

    Ok(())
}
