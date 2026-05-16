use dotenvy::dotenv;
use rusqlite::types::ValueRef;
use rusqlite::Connection;
use sqlx::mysql::MySqlPoolOptions;
use sqlx::pool::PoolConnection;
use sqlx::MySql;
use std::collections::{BTreeSet, HashSet};
use std::env;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
enum SqlValue {
    Null,
    Integer(i64),
    Real(f64),
    Text(String),
    Blob(Vec<u8>),
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();

    let sqlite_path = resolve_sqlite_path()?;
    let database_url = env::var("DATABASE_URL").map_err(|_| "DATABASE_URL must be set")?;
    let truncate_first = env_flag("MIGRATE_TRUNCATE");
    let run_migrations = !env_flag("MIGRATE_SKIP_MIGRATIONS");
    let selected_tables = env::var("MIGRATE_TABLES")
        .ok()
        .map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .collect::<BTreeSet<_>>()
        })
        .unwrap_or_default();

    println!("SQLite source: {}", sqlite_path.display());
    println!("MySQL target: {}", mask_database_url(&database_url));

    let sqlite = Connection::open(&sqlite_path)?;
    let mysql = MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    if run_migrations {
        println!("Running MySQL migrations...");
        sqlx::migrate!("./migrations_mysql").run(&mysql).await?;
    }

    let sqlite_tables = list_sqlite_tables(&sqlite)?;
    let mysql_tables = list_mysql_tables(&mysql).await?;
    let import_tables = sqlite_tables
        .into_iter()
        .filter(|table| selected_tables.is_empty() || selected_tables.contains(table))
        .filter(|table| mysql_tables.contains(table))
        .collect::<Vec<_>>();

    if import_tables.is_empty() {
        println!("No matching tables to import.");
        return Ok(());
    }

    println!("Importing {} tables...", import_tables.len());

    // Acquire a dedicated connection so SET FOREIGN_KEY_CHECKS persists across all statements.
    let mut conn = mysql.acquire().await?;

    sqlx::query("SET FOREIGN_KEY_CHECKS = 0")
        .execute(&mut *conn)
        .await?;

    if truncate_first {
        for table in &import_tables {
            // MySQL rejects TRUNCATE for tables referenced by foreign keys even
            // when FOREIGN_KEY_CHECKS is disabled, so use DELETE for repeatable
            // dry-runs and sandbox migrations.
            let statement = format!("DELETE FROM {}", mysql_ident(table));
            sqlx::query(&statement).execute(&mut *conn).await?;
        }
        println!("Deleted existing target rows before import.");
    }

    let mut total_rows = 0_u64;
    for table in import_tables {
        let sqlite_columns = list_sqlite_columns(&sqlite, &table)?;
        let mysql_columns = list_mysql_columns(&mysql, &table).await?;
        let columns = sqlite_columns
            .into_iter()
            .filter(|column| mysql_columns.contains(column))
            .collect::<Vec<_>>();

        if columns.is_empty() {
            println!("Skipping {table}: no shared columns.");
            continue;
        }

        let imported = import_table_conn(&sqlite, &mut conn, &table, &columns).await?;
        total_rows += imported;
        println!("Imported {imported} rows into {table}.");
    }

    sqlx::query("SET FOREIGN_KEY_CHECKS = 1")
        .execute(&mut *conn)
        .await?;

    println!("SQLite to MySQL data migration completed. Rows imported: {total_rows}");
    Ok(())
}

fn resolve_sqlite_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Some(arg_path) = env::args().nth(1) {
        return Ok(PathBuf::from(arg_path));
    }

    if let Ok(env_path) = env::var("SQLITE_DATABASE_PATH") {
        return Ok(PathBuf::from(env_path));
    }

    for candidate in ["backend/tridjaya.db", "tridjaya.db"] {
        let path = Path::new(candidate);
        if path.exists() {
            return Ok(path.to_path_buf());
        }
    }

    Err("SQLite DB path not found. Pass it as arg1 or set SQLITE_DATABASE_PATH.".into())
}

fn env_flag(name: &str) -> bool {
    matches!(
        env::var(name).ok().as_deref(),
        Some("1") | Some("true") | Some("TRUE") | Some("yes") | Some("YES")
    )
}

fn mask_database_url(url: &str) -> String {
    if let Some(at_index) = url.rfind('@') {
        if let Some(scheme_index) = url.find("://") {
            return format!("{}://***{}", &url[..scheme_index], &url[at_index..]);
        }
    }
    url.to_string()
}

fn list_sqlite_tables(sqlite: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = sqlite.prepare(
        "SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'
           AND name <> '_sqlx_migrations'
         ORDER BY name",
    )?;

    let tables = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tables)
}

async fn list_mysql_tables(pool: &sqlx::MySqlPool) -> Result<HashSet<String>, sqlx::Error> {
    let rows: Vec<(String,)> = sqlx::query_as("SHOW TABLES").fetch_all(pool).await?;
    Ok(rows.into_iter().map(|row| row.0).collect())
}

fn list_sqlite_columns(sqlite: &Connection, table: &str) -> rusqlite::Result<Vec<String>> {
    let statement = format!("PRAGMA table_info({})", sqlite_ident(table));
    let mut stmt = sqlite.prepare(&statement)?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(columns)
}

async fn list_mysql_columns(
    pool: &sqlx::MySqlPool,
    table: &str,
) -> Result<HashSet<String>, sqlx::Error> {
    let statement = format!("SHOW COLUMNS FROM {}", mysql_ident(table));
    let rows: Vec<(String,)> = sqlx::query_as(&statement).fetch_all(pool).await?;
    Ok(rows.into_iter().map(|row| row.0).collect())
}

async fn import_table_conn(
    sqlite: &Connection,
    conn: &mut PoolConnection<MySql>,
    table: &str,
    columns: &[String],
) -> Result<u64, Box<dyn std::error::Error>> {
    let select_columns = columns
        .iter()
        .map(|column| sqlite_ident(column))
        .collect::<Vec<_>>()
        .join(", ");
    let select_sql = format!("SELECT {select_columns} FROM {}", sqlite_ident(table));
    let mut stmt = sqlite.prepare(&select_sql)?;
    let mut rows = stmt.query([])?;

    let insert_sql = build_mysql_insert(table, columns);
    let mut imported = 0_u64;

    while let Some(row) = rows.next()? {
        let mut values = Vec::with_capacity(columns.len());
        for index in 0..columns.len() {
            values.push(sqlite_value(row.get_ref(index)?));
        }

        let mut query = sqlx::query(&insert_sql);
        for value in values {
            query = match value {
                SqlValue::Null => query.bind(Option::<String>::None),
                SqlValue::Integer(value) => query.bind(value),
                SqlValue::Real(value) => query.bind(value),
                SqlValue::Text(value) => query.bind(value),
                SqlValue::Blob(value) => query.bind(value),
            };
        }

        query.execute(&mut **conn).await?;
        imported += 1;
    }

    Ok(imported)
}

fn build_mysql_insert(table: &str, columns: &[String]) -> String {
    let column_list = columns
        .iter()
        .map(|column| mysql_ident(column))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = std::iter::repeat("?")
        .take(columns.len())
        .collect::<Vec<_>>()
        .join(", ");
    let updates = columns
        .iter()
        .filter(|column| column.as_str() != "id" && column.as_str() != "token")
        .map(|column| {
            let ident = mysql_ident(column);
            format!("{ident} = VALUES({ident})")
        })
        .collect::<Vec<_>>();
    let update_clause = if updates.is_empty() {
        format!(
            "{} = {}",
            mysql_ident(&columns[0]),
            mysql_ident(&columns[0])
        )
    } else {
        updates.join(", ")
    };

    format!(
        "INSERT INTO {} ({column_list}) VALUES ({placeholders}) ON DUPLICATE KEY UPDATE {update_clause}",
        mysql_ident(table)
    )
}

fn sqlite_value(value: ValueRef<'_>) -> SqlValue {
    match value {
        ValueRef::Null => SqlValue::Null,
        ValueRef::Integer(value) => SqlValue::Integer(value),
        ValueRef::Real(value) => SqlValue::Real(value),
        ValueRef::Text(value) => SqlValue::Text(String::from_utf8_lossy(value).into_owned()),
        ValueRef::Blob(value) => SqlValue::Blob(value.to_vec()),
    }
}

fn mysql_ident(value: &str) -> String {
    format!("`{}`", value.replace('`', "``"))
}

fn sqlite_ident(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
}
