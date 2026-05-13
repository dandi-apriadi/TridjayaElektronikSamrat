use sqlx::sqlite::SqlitePoolOptions;
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
    ensure_destructive_allowed()?;

    let database_url =
        env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Clearing products and promos tables...");

    sqlx::query("DELETE FROM promos").execute(&pool).await?;
    println!("Promos table cleared.");

    sqlx::query("DELETE FROM products").execute(&pool).await?;
    println!("Products table cleared.");

    Ok(())
}
