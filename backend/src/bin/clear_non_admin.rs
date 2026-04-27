use sqlx::sqlite::SqlitePoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite:tridjaya.db")
        .await?;

    println!("Clearing non-admin users from database...");
    
    let res = sqlx::query("DELETE FROM users WHERE role != 'Admin' AND role != 'admin'").execute(&pool).await?;
    
    println!("Deleted {} non-admin users.", res.rows_affected());
    
    // Also clear other tables again just in case
    let tables = [
        "agent_stats",
        "agent_achievements",
        "reward_claims",
        "leads",
        "agent_registrations",
        "support_tickets"
    ];

    for table in tables {
        sqlx::query(&format!("DELETE FROM {}", table)).execute(&pool).await.ok();
    }

    println!("Database cleanup completed.");

    Ok(())
}
