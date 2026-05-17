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

    let tables: Vec<(String,)> = sqlx::query_as("SHOW TABLES").fetch_all(&pool).await?;

    for (table,) in tables {
        if table == "_sqlx_migrations" {
            continue;
        }

        println!("Table: {}", table);
        let columns: Vec<(String, String, String, String, Option<String>, String)> =
            sqlx::query_as(&format!("SHOW COLUMNS FROM `{}`", table.replace('`', "``")))
                .fetch_all(&pool)
                .await?;
        for (field, col_type, nullable, key, default_value, extra) in columns {
            println!(
                "  - {} ({}, null={}, key={}, default={:?}, extra={})",
                field, col_type, nullable, key, default_value, extra
            );
        }
    }

    Ok(())
}
