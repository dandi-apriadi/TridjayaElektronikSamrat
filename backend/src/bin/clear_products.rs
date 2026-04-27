use sqlx::sqlite::SqlitePoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite:tridjaya.db")
        .await?;

    println!("Clearing products and promos tables...");
    
    sqlx::query("DELETE FROM promos").execute(&pool).await?;
    println!("Promos table cleared.");
    
    sqlx::query("DELETE FROM products").execute(&pool).await?;
    println!("Products table cleared.");

    Ok(())
}
