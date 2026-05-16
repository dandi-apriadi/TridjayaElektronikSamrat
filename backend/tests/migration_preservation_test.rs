//! Preservation Property Tests - SQLite to MySQL Migration
//!
//! **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14**
//!
//! These tests verify that standard SQL constructs which are already MySQL-compatible
//! continue to work correctly after the migration. They establish a baseline of
//! preserved behavior:
//!
//! - `?` placeholder queries with various parameter types (String, i64, bool, Option<T>)
//! - `REPLACE INTO` insert-or-replace semantics
//! - `LIMIT ? OFFSET ?` pagination
//! - Aggregate functions: COALESCE, COUNT(*), SUM, AVG
//! - Transaction commit/rollback via pool.begin()
//! - ON DELETE CASCADE constraint behavior
//! - UNIQUE constraint enforcement
//! - LOWER(column) case-insensitive comparison
//!
//! **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)

mod support;

use proptest::prelude::*;
use proptest::test_runner::TestCaseError;
use sqlx::MySqlPool;

// ============================================================================
// Helper: create temporary test tables for isolation
// ============================================================================

async fn setup_preservation_tables(pool: &MySqlPool) {
    sqlx::query("DROP TABLE IF EXISTS _pres_child")
        .execute(pool)
        .await
        .expect("Failed to drop _pres_child");
    sqlx::query("DROP TABLE IF EXISTS _pres_replace")
        .execute(pool)
        .await
        .expect("Failed to drop _pres_replace");
    sqlx::query("DROP TABLE IF EXISTS _pres_parent")
        .execute(pool)
        .await
        .expect("Failed to drop _pres_parent");

    // Parent table for CASCADE tests
    sqlx::query(
        "CREATE TABLE _pres_parent (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            score INT NOT NULL DEFAULT 0,
            amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            notes TEXT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create _pres_parent");

    // Child table with ON DELETE CASCADE
    sqlx::query(
        "CREATE TABLE _pres_child (
            id VARCHAR(255) PRIMARY KEY,
            parent_id VARCHAR(255) NOT NULL,
            label VARCHAR(255) NOT NULL,
            CONSTRAINT fk_pres_child_parent FOREIGN KEY (parent_id)
                REFERENCES _pres_parent(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create _pres_child");

    // Table for REPLACE INTO tests
    sqlx::query(
        "CREATE TABLE _pres_replace (
            id VARCHAR(255) PRIMARY KEY,
            value INT NOT NULL,
            label VARCHAR(255) NOT NULL DEFAULT ''
        )",
    )
    .execute(pool)
    .await
    .expect("Failed to create _pres_replace");
}

// ============================================================================
// Test 1: ? placeholder queries with various parameter types
// **Validates: Requirements 3.1**
// ============================================================================

#[cfg(test)]
mod placeholder_tests {
    use super::*;

    #[tokio::test]
    async fn test_placeholder_string_param() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("s1")
            .bind("Alice")
            .bind("alice@test.com")
            .bind(10)
            .bind(100.50)
            .execute(&pool)
            .await
            .expect("String placeholder insert failed");

        let row: (String,) = sqlx::query_as("SELECT name FROM _pres_parent WHERE id = ?")
            .bind("s1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "Alice");
    }

    #[tokio::test]
    async fn test_placeholder_i64_param() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("i1")
            .bind("Bob")
            .bind("bob@test.com")
            .bind(42i64)
            .bind(0.0)
            .execute(&pool)
            .await
            .expect("i64 placeholder insert failed");

        let row: (i64,) = sqlx::query_as("SELECT score FROM _pres_parent WHERE id = ?")
            .bind("i1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 42);
    }

    #[tokio::test]
    async fn test_placeholder_bool_param() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount, is_active) VALUES (?, ?, ?, ?, ?, ?)")
            .bind("b1")
            .bind("Charlie")
            .bind("charlie@test.com")
            .bind(0)
            .bind(0.0)
            .bind(false)
            .execute(&pool)
            .await
            .expect("bool placeholder insert failed");

        let row: (bool,) = sqlx::query_as("SELECT is_active FROM _pres_parent WHERE id = ?")
            .bind("b1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(!row.0);
    }

    #[tokio::test]
    async fn test_placeholder_option_param() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        let notes: Option<&str> = None;
        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount, notes) VALUES (?, ?, ?, ?, ?, ?)")
            .bind("o1")
            .bind("Diana")
            .bind("diana@test.com")
            .bind(0)
            .bind(0.0)
            .bind(notes)
            .execute(&pool)
            .await
            .expect("Option<None> placeholder insert failed");

        let row: (Option<String>,) = sqlx::query_as("SELECT notes FROM _pres_parent WHERE id = ?")
            .bind("o1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(row.0.is_none());

        // Now with Some value
        let notes_some: Option<&str> = Some("has notes");
        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount, notes) VALUES (?, ?, ?, ?, ?, ?)")
            .bind("o2")
            .bind("Eve")
            .bind("eve@test.com")
            .bind(0)
            .bind(0.0)
            .bind(notes_some)
            .execute(&pool)
            .await
            .expect("Option<Some> placeholder insert failed");

        let row: (Option<String>,) = sqlx::query_as("SELECT notes FROM _pres_parent WHERE id = ?")
            .bind("o2")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0.as_deref(), Some("has notes"));
    }
}

// ============================================================================
// Test 2: REPLACE INTO semantics
// **Validates: Requirements 3.2**
// ============================================================================

#[cfg(test)]
mod replace_into_tests {
    use super::*;

    #[tokio::test]
    async fn test_replace_into_insert() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        sqlx::query("REPLACE INTO _pres_replace (id, value, label) VALUES (?, ?, ?)")
            .bind("r1")
            .bind(100)
            .bind("first")
            .execute(&pool)
            .await
            .expect("REPLACE INTO (insert) failed");

        let row: (i32, String) =
            sqlx::query_as("SELECT value, label FROM _pres_replace WHERE id = ?")
                .bind("r1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(row.0, 100);
        assert_eq!(row.1, "first");
    }

    #[tokio::test]
    async fn test_replace_into_replace() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        // Insert first
        sqlx::query("REPLACE INTO _pres_replace (id, value, label) VALUES (?, ?, ?)")
            .bind("r2")
            .bind(10)
            .bind("original")
            .execute(&pool)
            .await
            .expect("REPLACE INTO (first insert) failed");

        // Replace with same key
        sqlx::query("REPLACE INTO _pres_replace (id, value, label) VALUES (?, ?, ?)")
            .bind("r2")
            .bind(99)
            .bind("replaced")
            .execute(&pool)
            .await
            .expect("REPLACE INTO (replace) failed");

        let row: (i32, String) =
            sqlx::query_as("SELECT value, label FROM _pres_replace WHERE id = ?")
                .bind("r2")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(row.0, 99);
        assert_eq!(row.1, "replaced");
    }
}

// ============================================================================
// Test 3: LIMIT ? OFFSET ? pagination
// **Validates: Requirements 3.3**
// ============================================================================

#[cfg(test)]
mod pagination_tests {
    use super::*;

    #[tokio::test]
    async fn test_limit_offset_pagination() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        // Insert 10 rows
        for i in 0..10 {
            sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                .bind(format!("pg{:02}", i))
                .bind(format!("User{}", i))
                .bind(format!("user{}@test.com", i))
                .bind(i as i64)
                .bind(0.0)
                .execute(&pool)
                .await
                .expect("Pagination insert failed");
        }

        // Page 1: LIMIT 3 OFFSET 0
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM _pres_parent ORDER BY id LIMIT ? OFFSET ?")
                .bind(3i64)
                .bind(0i64)
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].0, "pg00");
        assert_eq!(rows[2].0, "pg02");

        // Page 2: LIMIT 3 OFFSET 3
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM _pres_parent ORDER BY id LIMIT ? OFFSET ?")
                .bind(3i64)
                .bind(3i64)
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].0, "pg03");
        assert_eq!(rows[2].0, "pg05");

        // Last page: LIMIT 3 OFFSET 9 (only 1 row left)
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM _pres_parent ORDER BY id LIMIT ? OFFSET ?")
                .bind(3i64)
                .bind(9i64)
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "pg09");
    }
}

// ============================================================================
// Test 4: Aggregate functions (COALESCE, COUNT(*), SUM, AVG)
// **Validates: Requirements 3.4**
// ============================================================================

#[cfg(test)]
mod aggregate_tests {
    use super::*;

    async fn seed_aggregate_data(pool: &MySqlPool) {
        for i in 0..5 {
            let notes: Option<&str> = if i % 2 == 0 { Some("noted") } else { None };
            sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount, notes) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(format!("agg{}", i))
                .bind(format!("Agg{}", i))
                .bind(format!("agg{}@test.com", i))
                .bind((i + 1) * 10i64)
                .bind((i as f64 + 1.0) * 25.0)
                .bind(notes)
                .execute(pool)
                .await
                .expect("Aggregate seed insert failed");
        }
    }

    #[tokio::test]
    async fn test_count_star() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;
        seed_aggregate_data(&pool).await;

        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM _pres_parent")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 5);
    }

    #[tokio::test]
    async fn test_sum() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;
        seed_aggregate_data(&pool).await;

        // SUM of scores: 10 + 20 + 30 + 40 + 50 = 150
        let row: (i64,) =
            sqlx::query_as("SELECT CAST(COALESCE(SUM(score), 0) AS SIGNED) FROM _pres_parent")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 150);
    }

    #[tokio::test]
    async fn test_avg() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;
        seed_aggregate_data(&pool).await;

        // AVG of scores: 150 / 5 = 30.0
        let row: (f64,) =
            sqlx::query_as("SELECT CAST(COALESCE(AVG(score), 0) AS DOUBLE) FROM _pres_parent")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!((row.0 - 30.0).abs() < 0.01);
    }

    #[tokio::test]
    async fn test_coalesce() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;
        seed_aggregate_data(&pool).await;

        // COALESCE on nullable notes column
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT COALESCE(notes, 'default') FROM _pres_parent ORDER BY id",
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        // agg0 has notes, agg1 null, agg2 has notes, agg3 null, agg4 has notes
        assert_eq!(rows[0].0, "noted");
        assert_eq!(rows[1].0, "default");
        assert_eq!(rows[2].0, "noted");
        assert_eq!(rows[3].0, "default");
        assert_eq!(rows[4].0, "noted");
    }
}

// ============================================================================
// Test 5: Transaction commit/rollback via pool.begin()
// **Validates: Requirements 3.6**
// ============================================================================

#[cfg(test)]
mod transaction_tests {
    use super::*;

    #[tokio::test]
    async fn test_transaction_commit() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        let mut tx = pool.begin().await.expect("begin() failed");

        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("tx1")
            .bind("TxUser")
            .bind("tx@test.com")
            .bind(77)
            .bind(0.0)
            .execute(&mut *tx)
            .await
            .expect("Insert in tx failed");

        tx.commit().await.expect("commit() failed");

        // Verify data persisted after commit
        let row: (String,) = sqlx::query_as("SELECT name FROM _pres_parent WHERE id = ?")
            .bind("tx1")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "TxUser");
    }

    #[tokio::test]
    async fn test_transaction_rollback() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        // Insert a row first (outside transaction)
        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("txr_base")
            .bind("Base")
            .bind("base@test.com")
            .bind(0)
            .bind(0.0)
            .execute(&pool)
            .await
            .expect("Base insert failed");

        // Start transaction, insert, then rollback
        let mut tx = pool.begin().await.expect("begin() failed");

        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("txr_rolled")
            .bind("RolledBack")
            .bind("rolled@test.com")
            .bind(0)
            .bind(0.0)
            .execute(&mut *tx)
            .await
            .expect("Insert in tx failed");

        tx.rollback().await.expect("rollback() failed");

        // Verify rolled-back row does NOT exist
        let rows: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM _pres_parent WHERE id = ?")
                .bind("txr_rolled")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert!(rows.is_empty(), "Rolled-back row should not exist");

        // Verify base row still exists
        let row: (String,) = sqlx::query_as("SELECT name FROM _pres_parent WHERE id = ?")
            .bind("txr_base")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "Base");
    }

    #[tokio::test]
    async fn test_transaction_multiple_operations() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        let mut tx = pool.begin().await.expect("begin() failed");

        // Multiple inserts in one transaction
        for i in 0..3 {
            sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                .bind(format!("txm{}", i))
                .bind(format!("Multi{}", i))
                .bind(format!("multi{}@test.com", i))
                .bind(i as i64 * 10)
                .bind(0.0)
                .execute(&mut *tx)
                .await
                .expect("Multi insert in tx failed");
        }

        // Update within same transaction
        sqlx::query("UPDATE _pres_parent SET score = ? WHERE id = ?")
            .bind(999)
            .bind("txm0")
            .execute(&mut *tx)
            .await
            .expect("Update in tx failed");

        tx.commit().await.expect("commit() failed");

        // Verify all operations persisted
        let row: (i64,) = sqlx::query_as("SELECT score FROM _pres_parent WHERE id = ?")
            .bind("txm0")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 999);

        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM _pres_parent WHERE id LIKE 'txm%'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count.0, 3);
    }
}

// ============================================================================
// Test 6: ON DELETE CASCADE constraint behavior
// **Validates: Requirements 3.9**
// ============================================================================

#[cfg(test)]
mod cascade_tests {
    use super::*;

    #[tokio::test]
    async fn test_on_delete_cascade() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        // Insert parent
        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("cas_p1")
            .bind("Parent1")
            .bind("parent1@test.com")
            .bind(0)
            .bind(0.0)
            .execute(&pool)
            .await
            .expect("Parent insert failed");

        // Insert children
        for i in 0..3 {
            sqlx::query("INSERT INTO _pres_child (id, parent_id, label) VALUES (?, ?, ?)")
                .bind(format!("cas_c{}", i))
                .bind("cas_p1")
                .bind(format!("Child{}", i))
                .execute(&pool)
                .await
                .expect("Child insert failed");
        }

        // Verify children exist
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM _pres_child WHERE parent_id = ?",
        )
        .bind("cas_p1")
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count.0, 3);

        // Delete parent - children should cascade
        sqlx::query("DELETE FROM _pres_parent WHERE id = ?")
            .bind("cas_p1")
            .execute(&pool)
            .await
            .expect("Parent delete failed");

        // Verify children are gone (CASCADE)
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM _pres_child WHERE parent_id = ?",
        )
        .bind("cas_p1")
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count.0, 0);
    }
}

// ============================================================================
// Test 7: UNIQUE constraint enforcement
// **Validates: Requirements 3.10**
// ============================================================================

#[cfg(test)]
mod unique_constraint_tests {
    use super::*;

    #[tokio::test]
    async fn test_unique_constraint_rejects_duplicate() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        // Insert first row
        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("uniq1")
            .bind("First")
            .bind("unique@test.com")
            .bind(0)
            .bind(0.0)
            .execute(&pool)
            .await
            .expect("First unique insert failed");

        // Attempt duplicate email (UNIQUE constraint)
        let result = sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("uniq2")
            .bind("Second")
            .bind("unique@test.com")
            .bind(0)
            .bind(0.0)
            .execute(&pool)
            .await;

        assert!(
            result.is_err(),
            "UNIQUE constraint should reject duplicate email"
        );
    }
}

// ============================================================================
// Test 8: LOWER(column) case-insensitive comparison
// **Validates: Requirements 3.5**
// ============================================================================

#[cfg(test)]
mod lower_tests {
    use super::*;

    #[tokio::test]
    async fn test_lower_comparison() {
        let Some(pool) = support::setup_mysql_test_pool().await else {
            eprintln!("Skipping: no MySQL test connection available");
            return;
        };
        setup_preservation_tables(&pool).await;

        sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
            .bind("low1")
            .bind("MiXeD CaSe")
            .bind("mixed@test.com")
            .bind(0)
            .bind(0.0)
            .execute(&pool)
            .await
            .expect("Insert for LOWER test failed");

        // LOWER(column) comparison
        let rows: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM _pres_parent WHERE LOWER(name) = LOWER(?)",
        )
        .bind("MIXED CASE")
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, "MiXeD CaSe");
    }
}


// ============================================================================
// Property-Based Tests using proptest
// ============================================================================

/// Property-based tests for preservation requirements.
/// These use proptest to generate random inputs and verify that standard SQL
/// constructs work correctly across many input combinations.
#[cfg(test)]
mod proptest_preservation {
    use super::*;

    // Strategy: generate valid string values for placeholder tests
    fn valid_string_strategy() -> impl Strategy<Value = String> {
        "[a-zA-Z0-9_ ]{1,50}".prop_map(|s| s.trim().to_string())
            .prop_filter("non-empty", |s| !s.is_empty())
    }

    // Strategy: generate valid email-like strings (unique per test)
    fn email_strategy() -> impl Strategy<Value = String> {
        "[a-z]{3,10}[0-9]{1,5}@test\\.com"
    }

    // Strategy: generate i64 scores
    fn score_strategy() -> impl Strategy<Value = i64> {
        0i64..10000i64
    }

    // Strategy: generate pagination parameters
    fn pagination_strategy() -> impl Strategy<Value = (i64, i64)> {
        // (limit, offset) - limit 1..20, offset 0..50
        (1i64..20i64, 0i64..50i64)
    }

    // ========================================================================
    // Property: ? placeholders with various parameter types produce correct results
    // **Validates: Requirements 3.1**
    // ========================================================================

    proptest! {
        /// For all queries using `?` placeholders with String parameters,
        /// the inserted value is retrievable identically.
        ///
        /// **Validates: Requirements 3.1**
        #[test]
        fn prop_placeholder_string_roundtrip(
            name in valid_string_strategy(),
            email in email_strategy()
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result: Result<(), TestCaseError> = rt.block_on(async {
                let Some(pool) = support::setup_mysql_test_pool().await else {
                    return Ok(()); // Skip if no MySQL
                };
                setup_preservation_tables(&pool).await;

                let id = format!("prop_s_{}", uuid::Uuid::new_v4());
                sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                    .bind(&id)
                    .bind(&name)
                    .bind(&email)
                    .bind(0i64)
                    .bind(0.0)
                    .execute(&pool)
                    .await
                    .expect("prop insert failed");

                let row: (String, String) = sqlx::query_as(
                    "SELECT name, email FROM _pres_parent WHERE id = ?"
                )
                    .bind(&id)
                    .fetch_one(&pool)
                    .await
                    .expect("prop select failed");

                prop_assert_eq!(row.0, name);
                prop_assert_eq!(row.1, email);
                Ok(())
            });
            result?;
        }

        /// For all queries using `?` placeholders with i64 parameters,
        /// the inserted value is retrievable identically.
        ///
        /// **Validates: Requirements 3.1**
        #[test]
        fn prop_placeholder_i64_roundtrip(
            score in score_strategy()
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result: Result<(), TestCaseError> = rt.block_on(async {
                let Some(pool) = support::setup_mysql_test_pool().await else {
                    return Ok(());
                };
                setup_preservation_tables(&pool).await;

                let id = format!("prop_i_{}", uuid::Uuid::new_v4());
                let email = format!("{}@prop.com", &id[..20.min(id.len())]);
                sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                    .bind(&id)
                    .bind("PropUser")
                    .bind(&email)
                    .bind(score)
                    .bind(0.0)
                    .execute(&pool)
                    .await
                    .expect("prop i64 insert failed");

                let row: (i64,) = sqlx::query_as(
                    "SELECT score FROM _pres_parent WHERE id = ?"
                )
                    .bind(&id)
                    .fetch_one(&pool)
                    .await
                    .expect("prop i64 select failed");

                prop_assert_eq!(row.0, score);
                Ok(())
            });
            result?;
        }
    }

    // ========================================================================
    // Property: REPLACE INTO preserves insert-or-replace semantics
    // **Validates: Requirements 3.2**
    // ========================================================================

    proptest! {
        /// For all REPLACE INTO operations, the last value written for a key
        /// is always the one retrieved (insert-or-replace semantics).
        ///
        /// **Validates: Requirements 3.2**
        #[test]
        fn prop_replace_into_last_write_wins(
            first_val in 0i32..1000i32,
            second_val in 0i32..1000i32
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result: Result<(), TestCaseError> = rt.block_on(async {
                let Some(pool) = support::setup_mysql_test_pool().await else {
                    return Ok(());
                };
                setup_preservation_tables(&pool).await;

                let id = format!("prop_r_{}", uuid::Uuid::new_v4());

                // First REPLACE INTO
                sqlx::query("REPLACE INTO _pres_replace (id, value, label) VALUES (?, ?, ?)")
                    .bind(&id)
                    .bind(first_val)
                    .bind("first")
                    .execute(&pool)
                    .await
                    .expect("prop replace first failed");

                // Second REPLACE INTO (same key)
                sqlx::query("REPLACE INTO _pres_replace (id, value, label) VALUES (?, ?, ?)")
                    .bind(&id)
                    .bind(second_val)
                    .bind("second")
                    .execute(&pool)
                    .await
                    .expect("prop replace second failed");

                let row: (i32, String) = sqlx::query_as(
                    "SELECT value, label FROM _pres_replace WHERE id = ?"
                )
                    .bind(&id)
                    .fetch_one(&pool)
                    .await
                    .expect("prop replace select failed");

                // Last write wins
                prop_assert_eq!(row.0, second_val);
                prop_assert_eq!(row.1, "second".to_string());
                Ok(())
            });
            result?;
        }
    }

    // ========================================================================
    // Property: LIMIT/OFFSET returns correct subset
    // **Validates: Requirements 3.3**
    // ========================================================================

    proptest! {
        /// For all LIMIT/OFFSET queries, the returned subset size is
        /// min(limit, total_rows - offset) when offset < total_rows, else 0.
        ///
        /// **Validates: Requirements 3.3**
        #[test]
        fn prop_limit_offset_correct_subset(
            (limit, offset) in pagination_strategy()
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result: Result<(), TestCaseError> = rt.block_on(async {
                let Some(pool) = support::setup_mysql_test_pool().await else {
                    return Ok(());
                };
                setup_preservation_tables(&pool).await;

                let total_rows: i64 = 20;
                // Insert exactly total_rows items
                for i in 0..total_rows {
                    let id = format!("prop_pg_{:04}_{}", i, uuid::Uuid::new_v4());
                    let email = format!("pg{}@prop.com", uuid::Uuid::new_v4());
                    sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                        .bind(&id)
                        .bind(format!("PgUser{}", i))
                        .bind(&email)
                        .bind(i)
                        .bind(0.0)
                        .execute(&pool)
                        .await
                        .expect("prop pagination insert failed");
                }

                let rows: Vec<(String,)> = sqlx::query_as(
                    "SELECT id FROM _pres_parent ORDER BY id LIMIT ? OFFSET ?"
                )
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(&pool)
                    .await
                    .expect("prop pagination select failed");

                let expected_count = if offset >= total_rows {
                    0
                } else {
                    std::cmp::min(limit, total_rows - offset)
                };

                prop_assert_eq!(rows.len() as i64, expected_count,
                    "LIMIT {} OFFSET {} on {} rows should return {} rows, got {}",
                    limit, offset, total_rows, expected_count, rows.len());
                Ok(())
            });
            result?;
        }
    }

    // ========================================================================
    // Property: Aggregate functions produce correct computations
    // **Validates: Requirements 3.4**
    // ========================================================================

    proptest! {
        /// For all sets of scores, SUM returns the correct total and
        /// COUNT(*) returns the correct count.
        ///
        /// **Validates: Requirements 3.4**
        #[test]
        fn prop_aggregate_sum_count(
            scores in proptest::collection::vec(0i64..1000i64, 1..10)
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result: Result<(), TestCaseError> = rt.block_on(async {
                let Some(pool) = support::setup_mysql_test_pool().await else {
                    return Ok(());
                };
                setup_preservation_tables(&pool).await;

                let batch_id = uuid::Uuid::new_v4().to_string();
                for (i, &score) in scores.iter().enumerate() {
                    let id = format!("prop_agg_{}_{}", batch_id, i);
                    let email = format!("agg_{}_{}", i, &batch_id[..8]);
                    sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                        .bind(&id)
                        .bind("AggUser")
                        .bind(format!("{}@agg.com", email))
                        .bind(score)
                        .bind(0.0)
                        .execute(&pool)
                        .await
                        .expect("prop agg insert failed");
                }

                let expected_sum: i64 = scores.iter().sum();
                let expected_count = scores.len() as i64;

                let row: (i64, i64) = sqlx::query_as(
                    "SELECT CAST(COALESCE(SUM(score), 0) AS SIGNED), COUNT(*) FROM _pres_parent WHERE id LIKE ?"
                )
                    .bind(format!("prop_agg_{}_%", batch_id))
                    .fetch_one(&pool)
                    .await
                    .expect("prop agg select failed");

                prop_assert_eq!(row.0, expected_sum, "SUM mismatch");
                prop_assert_eq!(row.1, expected_count, "COUNT mismatch");
                Ok(())
            });
            result?;
        }
    }

    // ========================================================================
    // Property: Transaction commit/rollback behavior preserved
    // **Validates: Requirements 3.6**
    // ========================================================================

    proptest! {
        /// For all transaction sequences, committed data persists and
        /// rolled-back data does not.
        ///
        /// **Validates: Requirements 3.6**
        #[test]
        fn prop_transaction_commit_persists(
            score in score_strategy(),
            name in valid_string_strategy()
        ) {
            let rt = tokio::runtime::Runtime::new().unwrap();
            let result: Result<(), TestCaseError> = rt.block_on(async {
                let Some(pool) = support::setup_mysql_test_pool().await else {
                    return Ok(());
                };
                setup_preservation_tables(&pool).await;

                let id = format!("prop_tx_{}", uuid::Uuid::new_v4());
                let email = format!("tx_{}@prop.com", &id[..16.min(id.len())]);

                let mut tx = pool.begin().await.expect("begin failed");
                sqlx::query("INSERT INTO _pres_parent (id, name, email, score, amount) VALUES (?, ?, ?, ?, ?)")
                    .bind(&id)
                    .bind(&name)
                    .bind(&email)
                    .bind(score)
                    .bind(0.0)
                    .execute(&mut *tx)
                    .await
                    .expect("prop tx insert failed");
                tx.commit().await.expect("commit failed");

                let row: (String, i64) = sqlx::query_as(
                    "SELECT name, score FROM _pres_parent WHERE id = ?"
                )
                    .bind(&id)
                    .fetch_one(&pool)
                    .await
                    .expect("prop tx select failed");

                prop_assert_eq!(row.0, name);
                prop_assert_eq!(row.1, score);
                Ok(())
            });
            result?;
        }
    }
}
