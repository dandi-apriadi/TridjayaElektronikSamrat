use sqlx::sqlite::SqlitePoolOptions;
use std::env;
use tridjaya_backend::auth::hash_password;

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

    let new_password = env::var("RESET_PASSWORD")
        .unwrap_or_else(|_| "ChangeMeNow-123!".to_string());
    if new_password.len() < 12 {
        return Err("RESET_PASSWORD minimal 12 karakter untuk tool ini".into());
    }

    println!("Updating all user passwords using RESET_PASSWORD env...");
    
    let password_hash = hash_password(&new_password);
    
    let res = sqlx::query("UPDATE users SET password_hash = ?, is_active = 1, is_verified = 1, must_change_password = 0")
        .bind(&password_hash)
        .execute(&pool)
        .await?;
    
    println!("Updated {} users.", res.rows_affected());
    
    // Also, if there are any agents in agent_registrations that are approved, ensure they have users
    // (But the logs show the user was already created).
    
    println!("Database update completed.");

    Ok(())
}
