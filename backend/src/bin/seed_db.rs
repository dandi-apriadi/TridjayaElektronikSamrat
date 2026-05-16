use dotenvy::dotenv;
use sqlx::mysql::MySqlPoolOptions;
use tridjaya_backend::seed::seed_database;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    println!("Running migrations...");
    sqlx::migrate!("./migrations_mysql").run(&pool).await?;

    println!("Starting database re-seed...");
    seed_database(&pool).await?;
    println!("Database re-seed completed successfully!");

    Ok(())
}
