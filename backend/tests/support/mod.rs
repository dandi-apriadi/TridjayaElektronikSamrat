use sqlx::{mysql::MySqlPoolOptions, MySqlPool};

pub async fn setup_mysql_test_pool() -> Option<MySqlPool> {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .or_else(|_| std::env::var("MYSQL_TEST_DATABASE_URL"))
        .ok()?;

    let pool = match MySqlPoolOptions::new()
        // Integration tests create MySQL TEMPORARY tables, which are scoped to
        // a single connection. Keep the test pool pinned to one connection so
        // subsequent queries can see the tables they just created.
        .max_connections(1)
        .connect(&database_url)
        .await
    {
        Ok(pool) => pool,
        Err(error) => {
            eprintln!("Skipping MySQL integration test: cannot connect to test DB: {error}");
            return None;
        }
    };

    if let Err(error) = sqlx::migrate!("./migrations_mysql").run(&pool).await {
        eprintln!("Skipping MySQL integration test: migrations failed: {error}");
        return None;
    }

    if let Err(error) = truncate_all_tables(&pool).await {
        eprintln!("Skipping MySQL integration test: cleanup failed: {error}");
        return None;
    }

    Some(pool)
}

async fn truncate_all_tables(pool: &MySqlPool) -> Result<(), sqlx::Error> {
    let table_rows: Vec<(String,)> = sqlx::query_as("SHOW TABLES").fetch_all(pool).await?;

    sqlx::query("SET FOREIGN_KEY_CHECKS = 0")
        .execute(pool)
        .await?;

    for (table_name,) in table_rows {
        if table_name == "_sqlx_migrations" {
            continue;
        }

        let safe_table_name = table_name.replace('`', "``");
        let statement = format!("DELETE FROM `{safe_table_name}`");
        sqlx::query(&statement).execute(pool).await?;
    }

    sqlx::query("SET FOREIGN_KEY_CHECKS = 1")
        .execute(pool)
        .await?;
    Ok(())
}
