# Bugfix Requirements Document

## Introduction

The backend application currently uses SQLite as its database engine via `sqlx 0.8` with `SqlitePool`. SQLite's file-level locking, limited concurrency, and lack of production-grade features make it unsuitable for the application's scaling needs. The entire codebase (33 Rust source files, 16 binaries, 7 test files, and 40 migration files) contains SQLite-specific syntax, types, and connection patterns that are incompatible with MySQL. This migration fixes the architectural defect by replacing all SQLite-specific code with MySQL-compatible equivalents, enabling proper row-level locking, concurrent connections, and production-grade database operations.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the application starts THEN the system uses `SqliteConnectOptions` with WAL journal mode, `busy_timeout`, and `PRAGMA` diagnostics that are incompatible with MySQL

1.2 WHEN `state.rs` defines the application pool THEN the system declares `pub pool: SqlitePool` which cannot connect to a MySQL database

1.3 WHEN `seed.rs` inserts seed data THEN the system uses `ON CONFLICT(id) DO UPDATE SET` syntax (4 instances) which is invalid MySQL syntax

1.4 WHEN `main.rs` performs startup diagnostics THEN the system executes `PRAGMA table_info(agent_registrations)` and `PRAGMA table_info(products)` which do not exist in MySQL

1.5 WHEN handler files insert data with conflict resolution THEN the system uses `ON CONFLICT(...) DO UPDATE SET` syntax (in `routes.rs`, `bridge_event_processor.rs`, `landing_routes.rs`) which is invalid in MySQL

1.6 WHEN handler files insert data with ignore semantics THEN the system uses `INSERT OR IGNORE` syntax (in `bridge_event_processor.rs` 1×, `debug_pixel.rs` 3×) which is invalid in MySQL

1.7 WHEN handler files calculate date offsets THEN the system uses `datetime('now', ?)` syntax (in `routes.rs` 6×, `cleanup.rs` 2×, `blast_engine.rs` 1×, `bridge_event_processor.rs` 1×) which is invalid in MySQL

1.8 WHEN handler files format dates THEN the system uses `strftime('%Y-%m-%d', ...)` syntax (in `routes.rs` 4×) which is invalid in MySQL

1.9 WHEN `blast_engine.rs` gets the current date THEN the system uses `date('now')` syntax (1×) which is invalid in MySQL

1.10 WHEN `list_tables.rs` binary queries available tables THEN the system uses `SELECT name FROM sqlite_master WHERE type='table'` which does not exist in MySQL

1.11 WHEN migration files define table schemas THEN the system uses `TEXT PRIMARY KEY` without length constraints, and `datetime('now')` defaults which are incompatible with MySQL

1.12 WHEN `Cargo.toml` declares the sqlx dependency THEN the system enables the `sqlite` feature flag which does not provide MySQL driver support

1.13 WHEN deployment configuration starts the backend THEN the system uses SQLite-oriented configuration or non-native runtime assumptions instead of native MySQL service configuration

1.14 WHEN native server dependencies are documented THEN the system omits MySQL client/server and Redis requirements needed for local and VPS startup

1.15 WHEN the 15 utility binaries in `src/bin/` connect to the database THEN the system uses `SqlitePool` / `SqlitePoolOptions` types which cannot connect to MySQL

1.16 WHEN test files (`api_routes_test.rs`, `api_tokens_test.rs`, `campaign_metrics_test.rs`) set up test databases THEN the system uses in-memory SQLite pools which are incompatible with MySQL test infrastructure

### Expected Behavior (Correct)

2.1 WHEN the application starts THEN the system SHALL use `MySqlConnectOptions` with appropriate MySQL connection parameters (no WAL, no PRAGMA, no busy_timeout) and connect to a MySQL 8.0+ server

2.2 WHEN `state.rs` defines the application pool THEN the system SHALL declare `pub pool: MySqlPool` to enable MySQL connectivity

2.3 WHEN `seed.rs` inserts seed data THEN the system SHALL use `ON DUPLICATE KEY UPDATE` syntax for all 4 upsert operations

2.4 WHEN `main.rs` performs startup diagnostics THEN the system SHALL use `SHOW COLUMNS FROM agent_registrations` and `SHOW COLUMNS FROM products` (or remove the diagnostic block entirely)

2.5 WHEN handler files insert data with conflict resolution THEN the system SHALL use `ON DUPLICATE KEY UPDATE` syntax in all affected files (`routes.rs`, `bridge_event_processor.rs`, `landing_routes.rs`)

2.6 WHEN handler files insert data with ignore semantics THEN the system SHALL use `INSERT IGNORE` syntax in all affected files (`bridge_event_processor.rs` 1×, `debug_pixel.rs` 3×)

2.7 WHEN handler files calculate date offsets THEN the system SHALL use `DATE_SUB(NOW(), INTERVAL ...)` syntax in all affected files (`routes.rs` 6×, `cleanup.rs` 2×, `blast_engine.rs` 1×, `bridge_event_processor.rs` 1×)

2.8 WHEN handler files format dates THEN the system SHALL use `DATE_FORMAT(..., '%Y-%m-%d')` syntax in all affected files (`routes.rs` 4×)

2.9 WHEN `blast_engine.rs` gets the current date THEN the system SHALL use `CURDATE()` syntax

2.10 WHEN `list_tables.rs` binary queries available tables THEN the system SHALL use `SHOW TABLES` query

2.11 WHEN migration files define table schemas THEN the system SHALL use `VARCHAR(255) PRIMARY KEY` for string primary keys, `NOW()` or `CURRENT_TIMESTAMP` for datetime defaults, and MySQL-compatible column types throughout all ~35-40 tables

2.12 WHEN `Cargo.toml` declares the sqlx dependency THEN the system SHALL enable the `mysql` feature flag (replacing `sqlite`) to provide the MySQL driver

2.13 WHEN deployment configuration starts the backend THEN the system SHALL use native systemd services with `DATABASE_URL=mysql://user:pass@127.0.0.1:3306/tridjaya` or an equivalent managed MySQL endpoint

2.14 WHEN native server dependencies are documented THEN the system SHALL include MySQL client/server and Redis setup instructions

2.15 WHEN the 15 utility binaries in `src/bin/` connect to the database THEN the system SHALL use `MySqlPool` / `MySqlPoolOptions` types with appropriate MySQL connection strings

2.16 WHEN test files set up test databases THEN the system SHALL connect to a MySQL test database, run the unified MySQL migration schema, and use `TRUNCATE TABLE` (with `SET FOREIGN_KEY_CHECKS = 0` as needed) for test isolation

### Unchanged Behavior (Regression Prevention)

3.1 WHEN queries use `?` placeholder syntax THEN the system SHALL CONTINUE TO use `?` placeholders as they are compatible with both SQLite and MySQL

3.2 WHEN queries use `REPLACE INTO` statements THEN the system SHALL CONTINUE TO use `REPLACE INTO` as MySQL supports this syntax natively (in `pixel/analytics_job.rs` 3×)

3.3 WHEN queries use `LIMIT ? OFFSET ?` for pagination THEN the system SHALL CONTINUE TO use the same syntax as it is MySQL-compatible

3.4 WHEN queries use `COALESCE(...)`, `COUNT(*)`, `SUM(...)`, `AVG(...)`, `EXISTS(...)`, `CASE WHEN...THEN...END` THEN the system SHALL CONTINUE TO use these standard SQL functions unchanged

3.5 WHEN queries use `LOWER(column)` for case-insensitive comparison THEN the system SHALL CONTINUE TO use the same syntax

3.6 WHEN transaction code uses `pool.begin()` and `pool.acquire()` THEN the system SHALL CONTINUE TO use the same generic sqlx transaction API (11 transactions across `routes.rs`, `landing_routes.rs`, `blast_engine.rs`, `seed.rs`) as it automatically adapts to the pool type

3.7 WHEN `#[sqlx::FromRow]` structs deserialize query results THEN the system SHALL CONTINUE TO use the same derive macros as they are database-agnostic

3.8 WHEN the application generates UUIDs/string primary keys before INSERT THEN the system SHALL CONTINUE TO use application-generated IDs (no `last_insert_rowid()` or `AUTO_INCREMENT` dependency)

3.9 WHEN queries use `ON DELETE CASCADE` foreign key constraints THEN the system SHALL CONTINUE TO use the same constraint syntax as MySQL supports it

3.10 WHEN queries use `UNIQUE` constraints on columns THEN the system SHALL CONTINUE TO use the same constraint syntax

3.11 WHEN modules without DB interaction (`bridge/mod.rs`, `mail.rs`, `response.rs`, `validation.rs`, `spintax.rs`) perform their functions THEN the system SHALL CONTINUE TO operate without any changes

3.12 WHEN `test_smtp.rs` binary tests SMTP functionality THEN the system SHALL CONTINUE TO operate without any database changes as it has no DB interaction

3.13 WHEN test files without DB interaction (`campaign_config_property_test.rs`, `validation_test.rs`) run THEN the system SHALL CONTINUE TO pass without any changes

3.14 WHEN placeholder test files (`chatbot_routes_test.rs`, `webhook_routes_test.rs`) exist with `#[ignore]` attributes THEN the system SHALL CONTINUE TO remain as ignored placeholders
