# SQLite to MySQL Migration Bugfix Design

## Overview

The backend application uses SQLite via `sqlx 0.8` with `SqlitePool`, embedding SQLite-specific syntax (ON CONFLICT, INSERT OR IGNORE, datetime('now', ?), strftime, PRAGMA, sqlite_master) across 33 Rust source files, 16 binaries, 7 test files, and 40 migration files. This architectural defect prevents the application from leveraging MySQL's row-level locking, concurrent connections, and production-grade capabilities. The fix replaces all SQLite-specific types, syntax, and configuration with MySQL-compatible equivalents while preserving all existing application behavior for standard SQL constructs that are already cross-compatible.

## Glossary

- **Bug_Condition (C)**: Any code path that uses SQLite-specific syntax, types, or connection patterns — these fail or produce errors when targeting a MySQL database
- **Property (P)**: After the fix, all database operations SHALL execute successfully against MySQL 8.0+ using correct MySQL syntax and connection types
- **Preservation**: All standard SQL constructs (`?` placeholders, `REPLACE INTO`, `LIMIT/OFFSET`, `COALESCE`, aggregates, transactions via `pool.begin()`) that are already MySQL-compatible SHALL continue to work unchanged
- **SqlitePool**: The `sqlx::SqlitePool` type in `state.rs` that provides the application-wide database connection pool
- **MySqlPool**: The replacement `sqlx::MySqlPool` type that connects to MySQL 8.0+
- **ON CONFLICT**: SQLite's upsert syntax (`ON CONFLICT(col) DO UPDATE SET ...`) — invalid in MySQL
- **ON DUPLICATE KEY UPDATE**: MySQL's equivalent upsert syntax
- **PRAGMA**: SQLite-specific meta-commands for configuration and introspection — do not exist in MySQL
- **Unified Schema**: A single consolidated MySQL migration file replacing the 40 incremental SQLite migration files

## Bug Details

### Bug Condition

The bug manifests when any code path attempts to execute SQLite-specific SQL syntax or use SQLite-specific Rust types against a MySQL database. The application contains 6 categories of incompatible code: (1) Rust type imports/declarations, (2) upsert syntax, (3) insert-ignore syntax, (4) date/time functions, (5) introspection queries, and (6) migration DDL.

**Formal Specification:**
```
FUNCTION isBugCondition(codeUnit)
  INPUT: codeUnit of type { file: String, syntax: SqlStatement | RustType | ConfigEntry }
  OUTPUT: boolean

  RETURN codeUnit.syntax MATCHES ANY OF:
    -- Category 1: Rust types
    "SqlitePool" OR "SqliteConnectOptions" OR "SqlitePoolOptions" OR "SqliteJournalMode" OR "SqliteSynchronous"
    -- Category 2: Upsert syntax
    "ON CONFLICT(" ... ") DO UPDATE SET"
    -- Category 3: Insert-ignore syntax
    "INSERT OR IGNORE"
    -- Category 4: Date/time functions
    "datetime('now'" OR "strftime(" OR "date('now')"
    -- Category 5: Introspection
    "PRAGMA table_info" OR "PRAGMA journal_mode" OR "PRAGMA busy_timeout" OR "sqlite_master"
    -- Category 6: Config/build
    features = ["sqlite"] IN Cargo.toml
    OR "sqlite:" IN DATABASE_URL
    OR active non-native runtime config remains in the project
END FUNCTION
```

### Examples

- **Upsert in seed.rs**: `INSERT INTO landing_hero_slides ... ON CONFLICT(id) DO UPDATE SET ...` → MySQL error: "You have an error in your SQL syntax near 'CONFLICT'"
- **Insert-ignore in debug_pixel.rs**: `INSERT OR IGNORE INTO pixel_events ...` → MySQL error: "You have an error in your SQL syntax near 'OR IGNORE'"
- **Date offset in routes.rs**: `WHERE created_at > datetime('now', '-30 days')` → MySQL error: "FUNCTION datetime does not exist"
- **Date format in routes.rs**: `strftime('%Y-%m-%d', created_at)` → MySQL error: "FUNCTION strftime does not exist"
- **Introspection in main.rs**: `PRAGMA table_info(agent_registrations)` → MySQL error: "You have an error in your SQL syntax near 'PRAGMA'"
- **Pool type in state.rs**: `pub pool: SqlitePool` → Compile error when sqlx `sqlite` feature is removed
- **Edge case — date('now') in blast_engine.rs**: `WHERE send_date = date('now')` → MySQL error: "FUNCTION date does not exist" (only 1 instance, easy to miss)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All queries using `?` placeholder syntax continue to work (MySQL uses `?` natively)
- All `REPLACE INTO` statements continue to work (MySQL supports `REPLACE INTO` natively)
- All `LIMIT ? OFFSET ?` pagination queries continue to work unchanged
- All standard SQL functions (`COALESCE`, `COUNT(*)`, `SUM`, `AVG`, `EXISTS`, `CASE WHEN`) continue to work
- All `LOWER(column)` comparisons continue to work
- All 11 transactions using `pool.begin()` / `pool.acquire()` continue to work (sqlx generic API auto-adapts to pool type)
- All `#[sqlx::FromRow]` derive macros continue to work (database-agnostic)
- All application-generated UUID/string primary keys continue to work (no auto-increment dependency)
- All `ON DELETE CASCADE` and `UNIQUE` constraints continue to work
- All modules without DB interaction (`bridge/mod.rs`, `mail.rs`, `response.rs`, `validation.rs`, `spintax.rs`) continue to operate unchanged
- `test_smtp.rs` binary continues to work without changes
- Test files without DB interaction (`campaign_config_property_test.rs`, `validation_test.rs`) continue to pass
- Placeholder test files (`chatbot_routes_test.rs`, `webhook_routes_test.rs`) remain as ignored placeholders

**Scope:**
All code that does NOT contain SQLite-specific syntax listed in the bug condition should be completely unaffected by this fix. This includes:
- Standard SQL DML/DQL using `?` placeholders
- Generic sqlx transaction API calls
- Application logic in non-DB modules
- Redis interactions
- HTTP/WebSocket handling
- Email sending (SMTP)

## Hypothesized Root Cause

Based on the bug analysis, the root causes are straightforward — the application was originally built targeting SQLite and never abstracted the database-specific syntax:

1. **Rust Type Coupling**: `state.rs`, `main.rs`, `seed.rs`, and 15 binaries directly import and use `sqlx::sqlite::*` types. When the sqlx `sqlite` feature is replaced with `mysql`, these become compile errors.

2. **SQLite-Specific DML Syntax**: The application uses SQLite's `ON CONFLICT ... DO UPDATE SET` (8 instances) and `INSERT OR IGNORE` (4 instances) which have different syntax in MySQL (`ON DUPLICATE KEY UPDATE` and `INSERT IGNORE` respectively).

3. **SQLite Date/Time Functions**: SQLite uses `datetime('now', modifier)`, `strftime(format, value)`, and `date('now')` which have no equivalent in MySQL. MySQL uses `DATE_SUB(NOW(), INTERVAL ...)`, `DATE_FORMAT(value, format)`, and `CURDATE()`.

4. **SQLite Introspection Commands**: `PRAGMA table_info(...)` and `SELECT name FROM sqlite_master` are SQLite-only. MySQL uses `SHOW COLUMNS FROM` and `SHOW TABLES`.

5. **Migration DDL Incompatibility**: 40 migration files use `TEXT PRIMARY KEY` (MySQL requires length-bounded `VARCHAR(255)`), `datetime('now')` defaults, and other SQLite-specific DDL.

6. **Infrastructure Configuration**: `Cargo.toml` enables `sqlite` feature, deployment config references SQLite file paths, or active non-native runtime config remains.

## Correctness Properties

Property 1: Bug Condition - SQLite Syntax Replaced with Valid MySQL Equivalents

_For any_ code unit where the bug condition holds (isBugCondition returns true), the fixed codebase SHALL compile successfully with the `mysql` sqlx feature and all SQL statements SHALL execute without syntax errors against MySQL 8.0+, producing semantically equivalent results to the original SQLite behavior.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.15, 2.16**

Property 2: Preservation - Standard SQL and Non-DB Code Unchanged

_For any_ code unit where the bug condition does NOT hold (isBugCondition returns false), the fixed codebase SHALL produce exactly the same behavior as the original code, preserving all standard SQL query execution, transaction handling, struct deserialization, application logic, and non-DB module functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/Cargo.toml`

**Change**: Replace `sqlite` feature with `mysql` in sqlx dependency
- Line 109: `features = ["runtime-tokio", "sqlite", "macros", "chrono", "uuid"]` → `features = ["runtime-tokio", "mysql", "macros", "chrono", "uuid"]`

---

**File**: `backend/src/state.rs`

**Change**: Replace SqlitePool with MySqlPool
- `use sqlx::SqlitePool;` → `use sqlx::MySqlPool;`
- `pub pool: SqlitePool,` → `pub pool: MySqlPool,`
- `pub fn new(pool: SqlitePool, ...)` → `pub fn new(pool: MySqlPool, ...)`

---

**File**: `backend/src/main.rs`

**Changes**:
1. Replace imports: `use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous}` → `use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions}`
2. Replace env vars: `SQLITE_MAX_CONNECTIONS` → `MYSQL_MAX_CONNECTIONS`, remove `SQLITE_BUSY_TIMEOUT_SECS`
3. Replace connection options: `SqliteConnectOptions::from_str(...)` with WAL/synchronous/busy_timeout/create_if_missing → `MySqlConnectOptions::from_str(&database_url)`
4. Replace pool options: `SqlitePoolOptions::new()` → `MySqlPoolOptions::new()`
5. Remove PRAGMA blocks: Delete `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout` execution blocks
6. Replace diagnostics: `PRAGMA table_info(agent_registrations)` → `SHOW COLUMNS FROM agent_registrations` (or remove entirely)

---

**File**: `backend/src/seed.rs`

**Changes**:
1. `use sqlx::SqlitePool` → `use sqlx::MySqlPool`
2. All function signatures: `pool: &SqlitePool` → `pool: &MySqlPool`
3. 4× `ON CONFLICT(id) DO UPDATE SET` → `ON DUPLICATE KEY UPDATE` (lines ~176, 265, 298, 362)

---

**File**: `backend/src/routes.rs`

**Changes**:
1. 2× `ON CONFLICT(...) DO UPDATE SET` → `ON DUPLICATE KEY UPDATE`
2. 6× `datetime('now', ?)` → `DATE_SUB(NOW(), INTERVAL ? DAY)` (with appropriate interval parsing)
3. 4× `strftime('%Y-%m-%d', ...)` → `DATE_FORMAT(..., '%Y-%m-%d')`

---

**File**: `backend/src/bridge_event_processor.rs`

**Changes**:
1. 1× `ON CONFLICT(...) DO UPDATE SET` → `ON DUPLICATE KEY UPDATE`
2. 1× `INSERT OR IGNORE` → `INSERT IGNORE`
3. 1× `datetime('now', ?)` → `DATE_SUB(NOW(), INTERVAL ? DAY)`

---

**File**: `backend/src/landing_routes.rs`

**Changes**:
1. 1× `ON CONFLICT(...) DO UPDATE SET` → `ON DUPLICATE KEY UPDATE`

---

**File**: `backend/src/bin/debug_pixel.rs`

**Changes**:
1. `SqlitePool` → `MySqlPool`
2. 3× `INSERT OR IGNORE` → `INSERT IGNORE`

---

**File**: `backend/src/cleanup.rs`

**Changes**:
1. 2× `datetime('now', ?)` → `DATE_SUB(NOW(), INTERVAL ? DAY)`

---

**File**: `backend/src/blast_engine.rs`

**Changes**:
1. 1× `datetime('now', ?)` → `DATE_SUB(NOW(), INTERVAL ? DAY)`
2. 1× `date('now')` → `CURDATE()`

---

**File**: `backend/src/bin/list_tables.rs`

**Changes**:
1. `SqlitePool` → `MySqlPool`
2. `SELECT name FROM sqlite_master WHERE type='table'` → `SHOW TABLES`

---

**Files**: All 15 binaries in `backend/src/bin/` (except `test_smtp.rs`)

**Changes**:
1. `use sqlx::SqlitePool` → `use sqlx::MySqlPool` (or `SqlitePoolOptions` → `MySqlPoolOptions` for `seed_db.rs`)
2. Pool connection code updated to MySQL format

---

**Files**: `backend/tests/api_routes_test.rs`, `backend/tests/api_tokens_test.rs`, `backend/tests/campaign_metrics_test.rs`

**Changes**:
1. Replace in-memory SQLite pool setup with MySQL test database connection
2. Use `MySqlPoolOptions` with test database URL
3. Add `SET FOREIGN_KEY_CHECKS = 0` before `TRUNCATE TABLE` for test isolation
4. Run unified MySQL migration schema

---

**File**: `backend/migrations/` (entire directory)

**Changes**:
1. Consolidate 40 SQLite migration files into a single `001_init_mysql.sql`
2. Replace `TEXT PRIMARY KEY` → `VARCHAR(255) PRIMARY KEY`
3. Replace `datetime('now')` defaults → `NOW()` or `CURRENT_TIMESTAMP`
4. Ensure all ~35-40 tables use MySQL-compatible column types
5. Use `JSON` type for JSON fields (instead of `TEXT`)
6. Use `DECIMAL(15,2)` for price fields (instead of `REAL`)

---

**Files**: `deploy.sh`, `TERMINAL_INSTRUCTIONS.md`, `docs/deployment.md`, `setupVPS.md`

**Changes**:
1. Remove active non-native runtime configuration files.
2. Use native systemd services for backend and frontend.
3. Use native MySQL and Redis service dependencies.
4. Ensure `DATABASE_URL` examples use local/managed MySQL endpoints.

---

**File**: `backend/.env.example`

**Changes**:
1. Update `DATABASE_URL` format to MySQL
2. Replace `SQLITE_MAX_CONNECTIONS` → `MYSQL_MAX_CONNECTIONS`
3. Remove `SQLITE_BUSY_TIMEOUT_SECS`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the incompatibility on unfixed code targeting MySQL, then verify the fix compiles cleanly and all SQL executes correctly against MySQL 8.0+.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the SQLite-specific code fails against MySQL BEFORE implementing the fix. Confirm the root cause analysis by attempting to compile with `mysql` feature and run queries against MySQL.

**Test Plan**: Attempt to compile the project with `mysql` feature enabled (replacing `sqlite`) and observe compile errors. Then, for any code that compiles, attempt to execute SQLite-specific SQL against a MySQL 8.0 instance.

**Test Cases**:
1. **Compile Test**: Change Cargo.toml feature to `mysql`, run `cargo check` — expect dozens of compile errors from `SqlitePool`/`SqliteConnectOptions` usage (will fail on unfixed code)
2. **Upsert Syntax Test**: Execute `INSERT INTO test_table ... ON CONFLICT(id) DO UPDATE SET ...` against MySQL — expect syntax error (will fail on unfixed code)
3. **Date Function Test**: Execute `SELECT datetime('now', '-30 days')` against MySQL — expect "FUNCTION datetime does not exist" error (will fail on unfixed code)
4. **PRAGMA Test**: Execute `PRAGMA table_info(users)` against MySQL — expect syntax error (will fail on unfixed code)

**Expected Counterexamples**:
- `cargo check` produces 50+ errors: "cannot find type `SqlitePool`", "cannot find type `SqliteConnectOptions`"
- MySQL rejects all SQLite-specific SQL with syntax errors
- Possible causes: direct coupling to SQLite types and syntax throughout the codebase

### Fix Checking

**Goal**: Verify that for all code units where the bug condition holds, the fixed codebase compiles and executes correctly against MySQL 8.0+.

**Pseudocode:**
```
FOR ALL codeUnit WHERE isBugCondition(codeUnit) DO
  result := compile_and_execute_fixed(codeUnit)
  ASSERT result.compiles == true
  ASSERT result.sqlExecutesWithoutError == true
  ASSERT result.semanticBehavior == expectedMySqlBehavior(codeUnit)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all code units where the bug condition does NOT hold, the fixed codebase produces the same result as the original.

**Pseudocode:**
```
FOR ALL codeUnit WHERE NOT isBugCondition(codeUnit) DO
  ASSERT behavior_fixed(codeUnit) == behavior_original(codeUnit)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It can generate many random SQL query patterns to verify standard SQL still works
- It catches edge cases in transaction handling across many concurrent scenarios
- It provides strong guarantees that `?` placeholders, `REPLACE INTO`, aggregates, and other standard SQL remain functional

**Test Plan**: Observe behavior on UNFIXED code first for standard SQL operations (queries with `?` placeholders, transactions, REPLACE INTO, aggregates), then write property-based tests capturing that behavior and verify it holds after the fix.

**Test Cases**:
1. **Placeholder Preservation**: Verify `?` placeholder queries execute correctly with various parameter types (String, i64, bool, Option<T>)
2. **Transaction Preservation**: Verify `pool.begin()` → multiple queries → `tx.commit()` works correctly for all 11 transaction sites
3. **REPLACE INTO Preservation**: Verify `REPLACE INTO` in `pixel/analytics_job.rs` continues to work
4. **Aggregate Preservation**: Verify `COUNT(*)`, `SUM(...)`, `AVG(...)`, `COALESCE(...)` produce correct results
5. **Pagination Preservation**: Verify `LIMIT ? OFFSET ?` returns correct subsets

### Unit Tests

- Test each MySQL syntax replacement individually (ON DUPLICATE KEY UPDATE, INSERT IGNORE, DATE_SUB, DATE_FORMAT, CURDATE)
- Test MySqlPool connection with correct options (no WAL, no PRAGMA)
- Test `SHOW COLUMNS FROM` returns expected column metadata
- Test `SHOW TABLES` returns expected table list
- Test edge cases: empty result sets, NULL handling, large text fields

### Property-Based Tests

- Generate random valid inputs for upsert operations and verify ON DUPLICATE KEY UPDATE produces correct insert-or-update semantics
- Generate random date intervals and verify DATE_SUB(NOW(), INTERVAL ...) produces equivalent results to the original datetime('now', ...) logic
- Generate random query parameters and verify `?` placeholder binding works identically for String, i64, f64, bool, and Option types
- Generate random transaction sequences and verify commit/rollback behavior is preserved

### Integration Tests

- Test full application startup: MySqlPool connects, migrations run, seed data loads
- Test CRUD operations end-to-end: create product, read product, update product, delete product
- Test concurrent connections: multiple simultaneous requests using the connection pool
- Test all 15 utility binaries connect and execute against MySQL
- Test native MySQL service is reachable and backend connects successfully
