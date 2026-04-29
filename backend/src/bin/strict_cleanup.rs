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

    let protected_admin_email = env::var("PROTECTED_ADMIN_EMAIL")
        .unwrap_or_else(|_| "admin@gmail.com".to_string());
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Performing strict cleanup of users...");
    
    // Delete all users except the specific Admin email
    let res = sqlx::query("DELETE FROM users WHERE email != ?")
        .bind(&protected_admin_email)
        .execute(&pool)
        .await?;
    
    println!("Deleted {} non-admin users.", res.rows_affected());
    
    // Reset all status to verified and active for the admin
    sqlx::query("UPDATE users SET is_active = 1, is_verified = 1 WHERE email = ?")
        .bind(&protected_admin_email)
        .execute(&pool)
        .await?;

    println!("Database cleanup completed.");

    Ok(())
}
