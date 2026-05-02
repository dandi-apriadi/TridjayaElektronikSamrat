use sqlx::sqlite::SqlitePoolOptions;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:tridjaya.db".to_string());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Menghapus seluruh data produk dan kategori...");
    
    let res1 = sqlx::query("DELETE FROM products").execute(&pool).await?;
    println!("Tabel products dibersihkan: {} baris terhapus.", res1.rows_affected());
    
    let res2 = sqlx::query("DELETE FROM product_categories").execute(&pool).await?;
    println!("Tabel product_categories dibersihkan: {} baris terhapus.", res2.rows_affected());

    let res3 = sqlx::query("DELETE FROM promos").execute(&pool).await?;
    println!("Tabel promos dibersihkan: {} baris terhapus.", res3.rows_affected());

    println!("Semua data produk, kategori, dan promo telah berhasil dihapus.");

    Ok(())
}
