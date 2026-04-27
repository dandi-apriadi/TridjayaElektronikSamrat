use sqlx::sqlite::SqlitePoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite:tridjaya.db")
        .await?;

    println!("Performing strict cleanup of users...");
    
    // Delete all users except the specific Admin email
    let res = sqlx::query("DELETE FROM users WHERE email != 'admin@gmail.com'").execute(&pool).await?;
    
    println!("Deleted {} non-admin users.", res.rows_affected());
    
    // Reset all status to verified and active for the admin
    sqlx::query("UPDATE users SET is_active = 1, is_verified = 1 WHERE email = 'admin@gmail.com'")
        .execute(&pool)
        .await?;

    println!("Database cleanup completed.");

    Ok(())
}
