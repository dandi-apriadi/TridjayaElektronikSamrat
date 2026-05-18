use dotenvy::dotenv;
use sqlx::{mysql::MySqlPoolOptions, Row};
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

async fn table_exists(pool: &sqlx::MySqlPool, table_name: &str) -> Result<bool, sqlx::Error> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    )
    .bind(table_name)
    .fetch_one(pool)
    .await?;
    Ok(exists > 0)
}

async fn count_query(pool: &sqlx::MySqlPool, query: &str) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(query).fetch_one(pool).await
}

async fn column_exists(
    pool: &sqlx::MySqlPool,
    table_name: &str,
    column_name: &str,
) -> Result<bool, sqlx::Error> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?",
    )
    .bind(table_name)
    .bind(column_name)
    .fetch_one(pool)
    .await?;
    Ok(exists > 0)
}

async fn ensure_cabang_schema(pool: &sqlx::MySqlPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS cabang (
            id VARCHAR(64) PRIMARY KEY,
            nama VARCHAR(255) NOT NULL,
            alamat TEXT NOT NULL,
            kota VARCHAR(255) NOT NULL DEFAULT '',
            telepon VARCHAR(64) NOT NULL DEFAULT '',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_cabang_active (is_active),
            INDEX idx_cabang_kota (kota)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    )
    .execute(pool)
    .await?;

    if column_exists(pool, "cabang", "koordinator_id").await? {
        sqlx::query("ALTER TABLE cabang DROP COLUMN koordinator_id")
            .execute(pool)
            .await?;
    }

    if column_exists(pool, "cabang", "koordinator_nama").await? {
        sqlx::query("ALTER TABLE cabang DROP COLUMN koordinator_nama")
            .execute(pool)
            .await?;
    }

    let has_cabang_id: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'users'
           AND COLUMN_NAME = 'cabang_id'",
    )
    .fetch_one(pool)
    .await?;

    if has_cabang_id == 0 {
        sqlx::query(
            "ALTER TABLE users ADD COLUMN cabang_id VARCHAR(64) NOT NULL DEFAULT '' AFTER divisi",
        )
        .execute(pool)
        .await?;
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

    ensure_cabang_schema(&pool).await?;

    let cabang_exists = table_exists(&pool, "cabang").await?;
    let before_karyawan = count_query(
        &pool,
        "SELECT COUNT(*) FROM users WHERE LOWER(role) = 'karyawan'",
    )
    .await?;
    let before_prospek = count_query(&pool, "SELECT COUNT(*) FROM prospek_harian")
        .await
        .unwrap_or(0);
    let before_raport = count_query(&pool, "SELECT COUNT(*) FROM raport_harian")
        .await
        .unwrap_or(0);
    let before_synced_leads = count_query(
        &pool,
        "SELECT COUNT(*)
         FROM leads
         WHERE notes LIKE 'Sumber: Prospek Harian Karyawan%'
            OR id IN (SELECT id FROM prospek_harian)",
    )
    .await
    .unwrap_or(0);
    let before_cabang = if cabang_exists {
        count_query(&pool, "SELECT COUNT(*) FROM cabang")
            .await
            .unwrap_or(0)
    } else {
        0
    };

    println!(
        "Before reset: karyawan={}, prospek_harian={}, raport_harian={}, synced_leads={}, cabang={}",
        before_karyawan, before_prospek, before_raport, before_synced_leads, before_cabang
    );

    let mut tx = pool.begin().await?;

    let synced_leads_deleted = sqlx::query(
        "DELETE FROM leads
         WHERE notes LIKE 'Sumber: Prospek Harian Karyawan%'
            OR id IN (SELECT id FROM prospek_harian)",
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();

    let raport_deleted = sqlx::query("DELETE FROM raport_harian")
        .execute(&mut *tx)
        .await?
        .rows_affected();

    let prospek_deleted = sqlx::query("DELETE FROM prospek_harian")
        .execute(&mut *tx)
        .await?
        .rows_affected();

    let karyawan_deleted = sqlx::query("DELETE FROM users WHERE LOWER(role) = 'karyawan'")
        .execute(&mut *tx)
        .await?
        .rows_affected();

    let cabang_deleted = if cabang_exists {
        sqlx::query("DELETE FROM cabang")
            .execute(&mut *tx)
            .await?
            .rows_affected()
    } else {
        0
    };

    sqlx::query(
        "INSERT INTO app_settings (setting_key, setting_value)
         VALUES ('jobdesk_report_settings', JSON_OBJECT('startTime', '08:00', 'endTime', '18:00', 'updatedAt', NULL))
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = NULL",
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO app_settings (setting_key, setting_value)
         VALUES ('jobdesk_divisions', JSON_OBJECT('divisions', JSON_ARRAY(), 'updatedAt', NULL))
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = NULL",
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let rows = sqlx::query(
        "SELECT
            (SELECT COUNT(*) FROM users WHERE LOWER(role) = 'karyawan') AS karyawan_count,
            (SELECT COUNT(*) FROM prospek_harian) AS prospek_count,
            (SELECT COUNT(*) FROM raport_harian) AS raport_count,
            (SELECT COUNT(*) FROM leads WHERE notes LIKE 'Sumber: Prospek Harian Karyawan%') AS synced_leads_count",
    )
    .fetch_one(&pool)
    .await?;

    let after_cabang = if cabang_exists {
        count_query(&pool, "SELECT COUNT(*) FROM cabang")
            .await
            .unwrap_or(0)
    } else {
        0
    };

    println!(
        "Deleted: karyawan={}, prospek_harian={}, raport_harian={}, synced_leads={}, cabang={}",
        karyawan_deleted, prospek_deleted, raport_deleted, synced_leads_deleted, cabang_deleted
    );
    println!(
        "After reset: karyawan={}, prospek_harian={}, raport_harian={}, synced_leads={}, cabang={}",
        rows.get::<i64, _>("karyawan_count"),
        rows.get::<i64, _>("prospek_count"),
        rows.get::<i64, _>("raport_count"),
        rows.get::<i64, _>("synced_leads_count"),
        after_cabang
    );

    Ok(())
}
