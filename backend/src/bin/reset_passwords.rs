use sqlx::sqlite::SqlitePoolOptions;
use tridjaya_backend::auth::hash_password;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite:tridjaya.db")
        .await?;

    println!("Updating all user passwords to '123'...");
    
    let password_hash = hash_password("123");
    
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
