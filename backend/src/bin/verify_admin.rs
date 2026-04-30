use sqlx::sqlite::SqlitePoolOptions;
use std::env;
use tridjaya_backend::auth::hash_password;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    let admins = [
        ("admin@tridjaya.com", "adm-001"),
        ("admin@gmail.com", "adm-002"),
    ];
    let default_avatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin";

    for (email, id) in admins {
        println!("Verifying and resetting password for account: {}", email);
        let hash = hash_password("123");
        
        let exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE email = ?")
            .bind(email)
            .fetch_one(&pool)
            .await?;

        if exists.0 == 0 {
            println!("Account {} not found. Creating it...", email);
            sqlx::query("INSERT INTO users (id, email, name, role, password_hash, avatar, is_active, is_verified) VALUES (?, ?, 'Admin', 'Admin', ?, ?, 1, 1)")
                .bind(id)
                .bind(email)
                .bind(&hash)
                .bind(default_avatar)
                .execute(&pool)
                .await?;
        } else {
            println!("Account {} found. Updating password, verification, and avatar...", email);
            sqlx::query("UPDATE users SET is_active = 1, is_verified = 1, role = 'Admin', password_hash = ?, avatar = ? WHERE email = ?")
                .bind(&hash)
                .bind(default_avatar)
                .bind(email)
                .execute(&pool)
                .await?;
        }
    }

    println!("Admin accounts verified successfully!");
    Ok(())
}
