use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = "sqlite:tridjaya.db";
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(database_url)
        .await?;

    let row = sqlx::query(
        "SELECT id, event_id, user_id, event_source_url FROM pixel_events ORDER BY created_at DESC LIMIT 1"
    )
    .fetch_one(&pool)
    .await?;

    let id: String = row.get("id");
    let event_id: String = row.get("event_id");
    let user_id: Option<String> = row.get("user_id");
    let url: Option<String> = row.get("event_source_url");

    println!("Last Recorded Event:");
    println!("DB ID: {}", id);
    println!("Event ID: {}", event_id);
    println!("User ID: {:?}", user_id);
    println!("Source URL: {:?}", url);

    Ok(())
}
