use dotenvy::dotenv;
use sqlx::mysql::MySqlPoolOptions;
use std::env;

fn ensure_destructive_allowed() -> Result<(), Box<dyn std::error::Error>> {
    let flag = env::var("ALLOW_DESTRUCTIVE").unwrap_or_default();
    if flag != "yes-i-mean-it" {
        return Err(
            "Refusing to run destructive tool without ALLOW_DESTRUCTIVE=yes-i-mean-it".into(),
        );
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    ensure_destructive_allowed()?;

    let database_url = env::var("DATABASE_URL")
        .map_err(|_| "DATABASE_URL must be set in backend/.env or environment")?;
    let pool = MySqlPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await?;

    let before_cabang: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cabang")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    let before_users_with_cabang: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE cabang_id IS NOT NULL AND cabang_id <> ''",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);

    let mut tx = pool.begin().await?;

    let users_cleared = sqlx::query(
        "UPDATE users SET cabang_id = '' WHERE cabang_id IS NOT NULL AND cabang_id <> ''",
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let cabang_deleted = sqlx::query("DELETE FROM cabang")
        .execute(&mut *tx)
        .await?
        .rows_affected();

    tx.commit().await?;

    let after_cabang: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM cabang")
        .fetch_one(&pool)
        .await
        .unwrap_or(0);
    let after_users_with_cabang: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE cabang_id IS NOT NULL AND cabang_id <> ''",
    )
    .fetch_one(&pool)
    .await
    .unwrap_or(0);

    println!(
        "Before reset: cabang={}, users_with_cabang={}",
        before_cabang, before_users_with_cabang
    );
    println!(
        "Deleted: cabang={}, users_cleared={}",
        cabang_deleted, users_cleared
    );
    println!(
        "After reset: cabang={}, users_with_cabang={}",
        after_cabang, after_users_with_cabang
    );

    Ok(())
}
