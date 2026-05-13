use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = "sqlite:tridjaya.db";
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    println!("Connected to database. Running test setup...");

    // 1. Create a test admin
    let admin_id = "admin-test-001";
    sqlx::query(
        "INSERT OR IGNORE INTO users (id, email, name, role, password_hash, avatar, is_active, is_verified) 
         VALUES (?, 'admin.test@tridjaya.com', 'Admin Test', 'admin', '$argon2id$v=19$m=19456,t=2,p=1$test$test', 'default.png', 1, 1)"
    )
    .bind(admin_id)
    .execute(&pool)
    .await?;

    // 2. Create a test agent
    let agent_id = "agent-test-001";
    sqlx::query(
        "INSERT OR IGNORE INTO users (id, email, name, role, password_hash, avatar, is_active, is_verified) 
         VALUES (?, 'agent.test@tridjaya.com', 'Agent Test', 'agent', '$argon2id$v=19$m=19456,t=2,p=1$test$test', 'default.png', 1, 1)"
    )
    .bind(agent_id)
    .execute(&pool)
    .await?;

    // 3. Create a test pixel
    let pixel_id = "pixel-001";
    sqlx::query(
        "INSERT OR IGNORE INTO pixels (id, pixel_id, name, status, access_token, created_by) 
         VALUES (?, 'test-pixel-123', 'Test Pixel', 'active', 'encrypted-token', ?)",
    )
    .bind(pixel_id)
    .bind(admin_id)
    .execute(&pool)
    .await?;

    // 4. Create a test campaign
    let campaign_id = "campaign-001";
    sqlx::query(
        "INSERT OR IGNORE INTO campaigns (id, campaign_id, pixel_id, admin_id, name, status, utm_admin) 
         VALUES (?, 'test-campaign-123', ?, ?, 'Test Campaign', 'active', 'admin_test')"
    )
    .bind(campaign_id)
    .bind(pixel_id)
    .bind(admin_id)
    .execute(&pool)
    .await?;

    // 4. Create a test event with agent user_id
    let event_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO pixel_events (
            id, event_id, pixel_id, campaign_id, user_id, 
            event_type, event_source_url, event_time
         ) VALUES (?, ?, ?, ?, ?, 'Purchase', 'https://example.com?utm_admin=admin_test', CURRENT_TIMESTAMP)"
    )
    .bind(&event_id)
    .bind(format!("event-{}", Uuid::new_v4().simple()))
    .bind(pixel_id)
    .bind(campaign_id)
    .bind(agent_id)
    .execute(&pool)
    .await?;

    // 5. Create a conversion
    sqlx::query(
        "INSERT INTO conversions (
            id, event_id, campaign_id, conversion_type, 
            conversion_value, currency, conversion_time
         ) VALUES (?, ?, ?, 'Purchase', 150000.0, 'IDR', CURRENT_TIMESTAMP)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&event_id)
    .bind(campaign_id)
    .execute(&pool)
    .await?;

    println!("Test data setup complete!");

    // 6. Test the analytics query logic
    let row = sqlx::query(
        "SELECT 
            c.name as campaign_name,
            COUNT(pe.id) as total_events,
            SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) as conversions,
            SUM(conv.conversion_value) as total_revenue
         FROM pixel_events pe
         JOIN campaigns c ON pe.campaign_id = c.id
         LEFT JOIN conversions conv ON pe.id = conv.event_id
         WHERE pe.user_id = ?
         GROUP BY c.id",
    )
    .bind(agent_id)
    .fetch_one(&pool)
    .await?;

    let name: String = row.get("campaign_name");
    let events: i64 = row.get("total_events");
    let revenue: f64 = row.get("total_revenue");

    println!("Analytics Result for Agent:");
    println!("Campaign: {}", name);
    println!("Total Events: {}", events);
    println!("Total Revenue: {}", revenue);

    Ok(())
}
