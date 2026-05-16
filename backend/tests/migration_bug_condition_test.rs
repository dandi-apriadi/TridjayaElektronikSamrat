//! Bug Condition Exploration Test - SQLite to MySQL Migration
//!
//! **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12**
//!
//! This test verifies that the bug condition (SQLite-specific syntax incompatible with MySQL)
//! has been resolved. On UNFIXED code, these tests would FAIL because:
//! - `cargo check` would produce compile errors from SqlitePool, SqliteConnectOptions, etc.
//! - SQLite-specific SQL (ON CONFLICT, INSERT OR IGNORE, datetime('now'), strftime, PRAGMA)
//!   would produce syntax errors against MySQL 8.0
//!
//! ## Documented Counterexamples (what WOULD fail on unfixed code):
//! - `INSERT INTO test ... ON CONFLICT(id) DO UPDATE SET ...` → MySQL syntax error
//! - `SELECT datetime('now', '-30 days')` → MySQL "FUNCTION datetime does not exist"
//! - `PRAGMA table_info(users)` → MySQL syntax error
//! - `INSERT OR IGNORE INTO test ...` → MySQL syntax error
//! - `SELECT strftime('%Y-%m-%d', NOW())` → MySQL "FUNCTION strftime does not exist"
//! - `SELECT date('now')` → MySQL "FUNCTION date does not exist"
//! - `SqlitePool` / `SqliteConnectOptions` → compile error with mysql feature

mod support;

use proptest::prelude::*;
use std::fs;
use std::path::PathBuf;

/// Collect all `.rs` source files under `src/` (excluding target/)
fn collect_source_files() -> Vec<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let src_dir = manifest_dir.join("src");
    let mut files = Vec::new();
    collect_rs_files(&src_dir, &mut files);
    files
}

fn collect_rs_files(dir: &std::path::Path, out: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_rs_files(&path, out);
            } else if path.extension().map_or(false, |e| e == "rs") {
                out.push(path);
            }
        }
    }
}

/// SQLite-specific patterns that constitute the bug condition.
/// If ANY of these are found in source code, the bug is NOT fixed.
const SQLITE_BUG_PATTERNS: &[&str] = &[
    "SqlitePool",
    "SqliteConnectOptions",
    "SqlitePoolOptions",
    "SqliteJournalMode",
    "SqliteSynchronous",
    "ON CONFLICT(",
    "INSERT OR IGNORE",
    "datetime('now'",
    "strftime(",
    "date('now')",
    "PRAGMA table_info",
    "PRAGMA journal_mode",
    "PRAGMA busy_timeout",
    "sqlite_master",
];

/// MySQL-compatible patterns that SHOULD exist in the fixed codebase.
const MYSQL_EXPECTED_PATTERNS: &[&str] = &[
    "MySqlPool",
    "ON DUPLICATE KEY UPDATE",
    "INSERT IGNORE",
    "DATE_SUB",
    "DATE_FORMAT",
    "CURDATE()",
    "SHOW TABLES",
    "SHOW COLUMNS",
];

#[cfg(test)]
mod bug_condition_tests {
    use super::*;

    // =========================================================================
    // Category 1: Compile-time verification (Rust types)
    // =========================================================================

    /// Compile check: project builds with `mysql` sqlx feature.
    ///
    /// On unfixed code this fails with "cannot find type `SqlitePool`" etc.
    /// **Validates: Requirements 1.1, 1.2, 1.12**
    #[test]
    fn test_project_compiles_with_mysql_feature() {
        let output = std::process::Command::new("cargo")
            .args(["check", "--bin", "tridjaya-backend"])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .output()
            .expect("Failed to run cargo check");

        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(
            output.status.success(),
            "cargo check failed with mysql feature. Stderr:\n{}",
            stderr
        );
    }

    /// Compile check: all binaries compile with mysql feature.
    ///
    /// On unfixed code: 15 binaries using SqlitePool would fail to compile.
    /// **Validates: Requirements 1.1, 1.2, 1.12**
    #[test]
    fn test_all_binaries_compile_with_mysql_feature() {
        let output = std::process::Command::new("cargo")
            .args(["check", "--bins", "--features", "dev-tools"])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .output()
            .expect("Failed to run cargo check --bins");

        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(
            output.status.success(),
            "cargo check --bins failed. Stderr:\n{}",
            stderr
        );
    }

    /// Compile check: test targets compile with mysql feature.
    ///
    /// **Validates: Requirements 1.1, 1.12**
    #[test]
    fn test_tests_compile_with_mysql_feature() {
        let output = std::process::Command::new("cargo")
            .args(["check", "--tests"])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .output()
            .expect("Failed to run cargo check --tests");

        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(
            output.status.success(),
            "cargo check --tests failed. Stderr:\n{}",
            stderr
        );
    }

    // =========================================================================
    // Category 2: Property-based source code verification
    // =========================================================================

    /// **Property 1: Bug Condition** - SQLite Syntax Incompatible with MySQL
    ///
    /// For ALL source files in the codebase, NONE shall contain SQLite-specific
    /// syntax patterns that would fail against MySQL.
    ///
    /// On unfixed code: this property FAILS because SqlitePool, ON CONFLICT,
    /// datetime('now'), strftime, PRAGMA, etc. are present throughout 33+ files.
    ///
    /// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12**
    #[test]
    fn property_no_sqlite_syntax_in_source_files() {
        let source_files = collect_source_files();
        assert!(
            !source_files.is_empty(),
            "Should find source files under src/"
        );

        let mut violations: Vec<String> = Vec::new();

        for file_path in &source_files {
            let content = fs::read_to_string(file_path).unwrap_or_default();

            // Skip the migrate_sqlite_to_mysql.rs binary — it legitimately references
            // SQLite types (rusqlite) for the data migration tool
            let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
            if file_name == "migrate_sqlite_to_mysql.rs" {
                continue;
            }

            for pattern in SQLITE_BUG_PATTERNS {
                if content.contains(pattern) {
                    violations.push(format!(
                        "  {} contains SQLite pattern: '{}'",
                        file_path.display(),
                        pattern
                    ));
                }
            }
        }

        assert!(
            violations.is_empty(),
            "Bug condition detected! SQLite-specific syntax found in source files:\n{}",
            violations.join("\n")
        );
    }

    /// Property: MySQL-compatible syntax EXISTS in the codebase.
    ///
    /// Verifies that the expected MySQL replacements are present, confirming
    /// the migration was performed (not just that SQLite was removed).
    ///
    /// **Validates: Requirements 1.3, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**
    #[test]
    fn property_mysql_syntax_present_in_source_files() {
        let source_files = collect_source_files();
        let all_content: String = source_files
            .iter()
            .filter_map(|p| fs::read_to_string(p).ok())
            .collect::<Vec<_>>()
            .join("\n");

        for pattern in MYSQL_EXPECTED_PATTERNS {
            assert!(
                all_content.contains(pattern),
                "Expected MySQL pattern '{}' not found in any source file. \
                 The migration may be incomplete.",
                pattern
            );
        }
    }

    /// Property: Cargo.toml uses mysql feature, not sqlite.
    ///
    /// On unfixed code: features = ["runtime-tokio", "sqlite", ...] → bug condition.
    /// **Validates: Requirements 1.12**
    #[test]
    fn property_cargo_toml_uses_mysql_feature() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let cargo_toml = fs::read_to_string(manifest_dir.join("Cargo.toml"))
            .expect("Failed to read Cargo.toml");

        // The sqlx dependency line should contain "mysql" feature
        assert!(
            cargo_toml.contains("\"mysql\""),
            "Cargo.toml does not contain mysql feature — bug condition present"
        );

        // Should NOT contain sqlite feature in sqlx dependency
        // (Note: rusqlite is allowed as a separate dependency for migration tool)
        let sqlx_section = cargo_toml
            .lines()
            .find(|l| l.starts_with("sqlx"))
            .expect("sqlx dependency not found in Cargo.toml");

        assert!(
            !sqlx_section.contains("\"sqlite\""),
            "Cargo.toml sqlx dependency still has sqlite feature — bug condition present.\n\
             Line: {}",
            sqlx_section
        );
    }

    // =========================================================================
    // Category 3: Property-based test with proptest
    // =========================================================================
}

/// Property-based test using proptest: for any randomly selected source file,
/// no SQLite-specific bug condition patterns exist.
///
/// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12**
mod proptest_bug_condition {
    use super::*;

    /// Strategy: generate indices into the source file list
    fn source_file_index_strategy() -> impl Strategy<Value = usize> {
        let file_count = collect_source_files().len();
        0..file_count
    }

    proptest! {
        /// For any randomly selected source file from the codebase,
        /// it SHALL NOT contain any SQLite-specific syntax that constitutes
        /// the bug condition (isBugCondition patterns).
        ///
        /// On unfixed code, this property FAILS with counterexamples like:
        /// - state.rs contains "SqlitePool"
        /// - seed.rs contains "ON CONFLICT("
        /// - routes.rs contains "datetime('now'"
        /// - routes.rs contains "strftime("
        /// - main.rs contains "PRAGMA table_info"
        /// - list_tables.rs contains "sqlite_master"
        ///
        /// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12**
        #[test]
        fn prop_no_sqlite_bug_condition_in_any_source_file(
            idx in source_file_index_strategy()
        ) {
            let source_files = collect_source_files();
            let file_path = &source_files[idx];

            // Skip the migration tool binary (it legitimately uses rusqlite)
            let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
            if file_name == "migrate_sqlite_to_mysql.rs" {
                return Ok(());
            }

            let content = fs::read_to_string(file_path).unwrap_or_default();

            for pattern in SQLITE_BUG_PATTERNS {
                prop_assert!(
                    !content.contains(pattern),
                    "Bug condition found in {}: contains SQLite pattern '{}'\n\
                     Counterexample: This file uses SQLite-specific syntax that is \
                     incompatible with MySQL.",
                    file_path.display(),
                    pattern
                );
            }
        }

        /// For any randomly selected SQLite-specific SQL pattern,
        /// it SHALL NOT appear in any source file (excluding migration tool).
        ///
        /// This tests the inverse: pick a random bug pattern and verify
        /// it doesn't exist anywhere in the codebase.
        ///
        /// **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**
        #[test]
        fn prop_no_sqlite_pattern_exists_in_codebase(
            pattern_idx in 0..SQLITE_BUG_PATTERNS.len()
        ) {
            let pattern = SQLITE_BUG_PATTERNS[pattern_idx];
            let source_files = collect_source_files();

            for file_path in &source_files {
                let file_name = file_path.file_name().unwrap_or_default().to_string_lossy();
                if file_name == "migrate_sqlite_to_mysql.rs" {
                    continue;
                }

                let content = fs::read_to_string(file_path).unwrap_or_default();
                prop_assert!(
                    !content.contains(pattern),
                    "SQLite pattern '{}' found in {}.\n\
                     Counterexample: '{}' is SQLite-specific and would cause:\n\
                     - SqlitePool/Options → compile error with mysql feature\n\
                     - ON CONFLICT → MySQL syntax error\n\
                     - INSERT OR IGNORE → MySQL syntax error\n\
                     - datetime('now',...) → FUNCTION datetime does not exist\n\
                     - strftime(...) → FUNCTION strftime does not exist\n\
                     - date('now') → FUNCTION date does not exist\n\
                     - PRAGMA → MySQL syntax error\n\
                     - sqlite_master → MySQL syntax error",
                    pattern,
                    file_path.display(),
                    pattern
                );
            }
        }
    }
}

/// Integration tests that verify MySQL-specific SQL executes correctly.
/// These would FAIL on unfixed code because the SQL syntax is MySQL-only.
#[cfg(test)]
mod mysql_integration_tests {
    use super::*;

    /// MySQL DML syntax: ON DUPLICATE KEY UPDATE and INSERT IGNORE.
    ///
    /// On unfixed code: ON CONFLICT / INSERT OR IGNORE → MySQL syntax errors.
    /// **Validates: Requirements 1.3, 1.5, 1.6**
    #[tokio::test]
    async fn test_mysql_dml_syntax() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };

        // ON DUPLICATE KEY UPDATE
        sqlx::query(
            "CREATE TEMPORARY TABLE _bug_upsert (
                id VARCHAR(255) PRIMARY KEY,
                val INT NOT NULL DEFAULT 0
            )",
        )
        .execute(&pool)
        .await
        .expect("Failed to create temp table");

        sqlx::query(
            "INSERT INTO _bug_upsert (id, val) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE val = VALUES(val)",
        )
        .bind("k1")
        .bind(1)
        .execute(&pool)
        .await
        .expect("ON DUPLICATE KEY UPDATE failed");

        sqlx::query(
            "INSERT INTO _bug_upsert (id, val) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE val = VALUES(val)",
        )
        .bind("k1")
        .bind(99)
        .execute(&pool)
        .await
        .expect("ON DUPLICATE KEY UPDATE (upsert) failed");

        let row: (i32,) = sqlx::query_as("SELECT val FROM _bug_upsert WHERE id = ?")
            .bind("k1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 99);

        // INSERT IGNORE
        sqlx::query(
            "CREATE TEMPORARY TABLE _bug_ignore (
                id VARCHAR(255) PRIMARY KEY,
                data VARCHAR(255) NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .expect("Failed to create temp table");

        sqlx::query("INSERT IGNORE INTO _bug_ignore (id, data) VALUES (?, ?)")
            .bind("d1")
            .bind("first")
            .execute(&pool)
            .await
            .expect("INSERT IGNORE failed");

        sqlx::query("INSERT IGNORE INTO _bug_ignore (id, data) VALUES (?, ?)")
            .bind("d1")
            .bind("second")
            .execute(&pool)
            .await
            .expect("INSERT IGNORE (dup) failed");

        let row: (String,) = sqlx::query_as("SELECT data FROM _bug_ignore WHERE id = ?")
            .bind("d1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "first");
    }

    /// MySQL date functions: DATE_SUB, DATE_FORMAT, CURDATE.
    ///
    /// On unfixed code: datetime('now',...), strftime(...), date('now') → errors.
    /// **Validates: Requirements 1.7, 1.8, 1.9**
    #[tokio::test]
    async fn test_mysql_date_functions() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };

        // DATE_SUB(NOW(), INTERVAL 30 DAY)
        let row: (chrono::NaiveDateTime,) =
            sqlx::query_as("SELECT DATE_SUB(NOW(), INTERVAL 30 DAY)")
                .fetch_one(&pool)
                .await
                .expect("DATE_SUB failed");
        let diff = chrono::Utc::now().naive_utc() - row.0;
        assert!(diff.num_days() >= 29 && diff.num_days() <= 31);

        // DATE_FORMAT(NOW(), '%Y-%m-%d')
        let row: (String,) = sqlx::query_as("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d')")
            .fetch_one(&pool)
            .await
            .expect("DATE_FORMAT failed");
        assert_eq!(row.0.len(), 10);

        // CURDATE()
        let row: (chrono::NaiveDate,) = sqlx::query_as("SELECT CURDATE()")
            .fetch_one(&pool)
            .await
            .expect("CURDATE failed");
        let today = chrono::Utc::now().date_naive();
        let diff = (today - row.0).num_days().abs();
        assert!(diff <= 1, "CURDATE should be near today");
    }

    /// MySQL introspection: SHOW TABLES and SHOW COLUMNS.
    ///
    /// On unfixed code: PRAGMA table_info / sqlite_master → errors.
    /// **Validates: Requirements 1.4, 1.10**
    #[tokio::test]
    async fn test_mysql_introspection() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };

        // SHOW TABLES
        let rows: Vec<(String,)> = sqlx::query_as("SHOW TABLES")
            .fetch_all(&pool)
            .await
            .expect("SHOW TABLES failed");
        // At minimum the migrations table should exist
        let table_names: Vec<&str> = rows.iter().map(|r| r.0.as_str()).collect();
        assert!(
            table_names.iter().any(|t| t.contains("migration")),
            "Should have at least _sqlx_migrations table"
        );

        // SHOW COLUMNS FROM a known table
        sqlx::query(
            "CREATE TEMPORARY TABLE _bug_cols (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .expect("Failed to create temp table");

        let cols: Vec<(String, String, String, String, Option<String>, String)> =
            sqlx::query_as("SHOW COLUMNS FROM _bug_cols")
                .fetch_all(&pool)
                .await
                .expect("SHOW COLUMNS failed");
        let names: Vec<&str> = cols.iter().map(|r| r.0.as_str()).collect();
        assert!(names.contains(&"id"));
        assert!(names.contains(&"name"));
    }
}
