use serde_json::json;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = "sqlite:tridjaya.db";
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(database_url)
        .await?;

    let agent_id = "agent-test-001";
    let start_date = "2026-05-01";
    let end_date = "2026-05-31";

    println!("Querying analytics for Agent: {}", agent_id);

    let analytics = sqlx::query(
        "SELECT 
            c.id as campaign_id,
            c.name as campaign_name,
            COUNT(pe.id) as total_events,
            COUNT(DISTINCT pe.fbp) as unique_users,
            SUM(CASE WHEN pe.event_type = 'Purchase' THEN 1 ELSE 0 END) as conversions,
            CAST(COALESCE(SUM(conv.conversion_value), 0.0) AS REAL) as total_revenue,
            COALESCE(MAX(conv.currency), 'IDR') as currency
         FROM pixel_events pe
         JOIN campaigns c ON pe.campaign_id = c.id
         LEFT JOIN conversions conv ON pe.id = conv.event_id
         WHERE pe.user_id = ? AND DATE(pe.event_time) >= ? AND DATE(pe.event_time) <= ?
         GROUP BY c.id, c.name",
    )
    .bind(agent_id)
    .bind(start_date)
    .bind(end_date)
    .fetch_all(&pool)
    .await?;

    println!("Results found: {}", analytics.len());

    for row in analytics {
        let name: String = row.get("campaign_name");
        let events: i64 = row.get("total_events");
        let conversions: i64 = row.get("conversions");
        let revenue: f64 = row.get("total_revenue");

        println!("- Campaign: {}", name);
        println!("  Events: {}", events);
        println!("  Conversions: {}", conversions);
        println!(
            "  Revenue: {} {}",
            revenue,
            row.get::<String, _>("currency")
        );
    }

    Ok(())
}
