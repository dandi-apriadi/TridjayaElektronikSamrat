use sqlx::mysql::MySqlPoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "mysql://tridjaya:password@localhost:3306/tridjaya".to_string());
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT name, slug FROM product_categories ORDER BY name ASC")
            .fetch_all(&pool)
            .await?;

    println!("Daftar Kategori Produk:");
    for (name, slug) in rows {
        println!("- {} ({})", name, slug);
    }

    Ok(())
}
