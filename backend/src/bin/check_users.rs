use sqlx::sqlite::SqlitePoolOptions;
use dotenvy::dotenv;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let database_url = std::env::var("DATABASE_URL")?;
    let pool = SqlitePoolOptions::new()
        .connect(&database_url)
        .await?;

    let rows: Vec<(String, String, String, i32, i32)> = sqlx::query_as("SELECT email, role, password_hash, is_active, is_verified FROM users")
        .fetch_all(&pool)
        .await?;

    println!("Users in database:");
    for (email, role, hash, active, verified) in rows {
        println!("Email: {}, Role: {}, Active: {}, Verified: {}, Hash: {}", email, role, active, verified, &hash[..10]);
    }

    Ok(())
}
