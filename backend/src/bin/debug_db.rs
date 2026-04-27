use sqlx::sqlite::SqlitePoolOptions;
use sqlx::Row;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite:tridjaya.db")
        .await?;

    let rows = sqlx::query("SELECT id, email, is_active, is_verified, role FROM users")
        .fetch_all(&pool)
        .await?;

    println!("Users in DB:");
    for row in rows {
        let id: String = row.get("id");
        let email: String = row.get("email");
        let is_active: bool = row.get("is_active");
        let is_verified: bool = row.get("is_verified");
        let role: String = row.get("role");
        println!("ID: {}, Email: {}, Active: {}, Verified: {}, Role: {}", id, email, is_active, is_verified, role);
    }

    let partner_rows = sqlx::query("SELECT id, name FROM partners")
        .fetch_all(&pool)
        .await?;

    println!("\nPartners in DB:");
    for row in partner_rows {
        let id: String = row.get("id");
        let name: String = row.get("name");
        println!("ID: {}, Name: {}", id, name);
    }

    Ok(())
}
