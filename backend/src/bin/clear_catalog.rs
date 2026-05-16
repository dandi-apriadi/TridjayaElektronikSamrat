use sqlx::mysql::MySqlPoolOptions;
use std::env;

fn ensure_destructive_allowed() -> Result<(), Box<dyn std::error::Error>> {
    let flag = env::var("ALLOW_DESTRUCTIVE").unwrap_or_default();
    if flag != "yes-i-mean-it" {
        return Err("Refusing to run destructive tool without ALLOW_DESTRUCTIVE=yes-i-mean-it. Run with environment variable set.".into());
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    ensure_destructive_allowed()?;
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "mysql://tridjaya:password@localhost:3306/tridjaya".to_string());
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Menghapus seluruh data produk dan kategori...");

    let res1 = sqlx::query("DELETE FROM products").execute(&pool).await?;
    println!(
        "Tabel products dibersihkan: {} baris terhapus.",
        res1.rows_affected()
    );

    let res2 = sqlx::query("DELETE FROM product_categories")
        .execute(&pool)
        .await?;
    println!(
        "Tabel product_categories dibersihkan: {} baris terhapus.",
        res2.rows_affected()
    );

    let res3 = sqlx::query("DELETE FROM promos").execute(&pool).await?;
    println!(
        "Tabel promos dibersihkan: {} baris terhapus.",
        res3.rows_affected()
    );

    let res4 = sqlx::query("DELETE FROM blog_posts").execute(&pool).await?;
    println!(
        "Tabel blog_posts dibersihkan: {} baris terhapus.",
        res4.rows_affected()
    );

    println!("Semua data produk, kategori, promo, dan konten katalog telah berhasil dihapus.");

    Ok(())
}
