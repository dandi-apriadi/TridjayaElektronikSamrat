# SQLite to MySQL Data Migration Runbook

Use this after deploying the MySQL migration code and before switching production traffic.

## Preconditions

- MySQL is running and reachable from the backend host.
- `DATABASE_URL` points to the target MySQL database.
- The SQLite source database is available, for example `/var/www/tridjaya/backend/tridjaya.db`.
- A fresh backup of the SQLite database exists before import.

## Recommended Server Commands

Fast path using the repository script:

```bash
cd /var/www/tridjaya
bash scripts/run_mysql_data_migration.sh
```

For a clean first import into an empty/new MySQL database:

```bash
cd /var/www/tridjaya
MIGRATE_TRUNCATE=true bash scripts/run_mysql_data_migration.sh
```

Manual equivalent:

```bash
cd /var/www/tridjaya/backend

cp tridjaya.db "tridjaya-before-mysql-$(date +%Y%m%d-%H%M%S).db"

set -a
source ../.env
set +a

cargo run --release --bin migrate_sqlite_to_mysql -- ./tridjaya.db
```

For a clean first import into an empty/new MySQL database, truncate matching MySQL tables first:

```bash
MIGRATE_TRUNCATE=true cargo run --release --bin migrate_sqlite_to_mysql -- ./tridjaya.db
```

To import only selected tables:

```bash
MIGRATE_TABLES=users,products,wa_accounts,wa_messages cargo run --release --bin migrate_sqlite_to_mysql -- ./tridjaya.db
```

To skip running MySQL migrations because they were already applied:

```bash
MIGRATE_SKIP_MIGRATIONS=true cargo run --release --bin migrate_sqlite_to_mysql -- ./tridjaya.db
```

## Post-Import Checks

```bash
mysql "$DATABASE_URL" -e "SELECT COUNT(*) AS users FROM users;"
mysql "$DATABASE_URL" -e "SELECT COUNT(*) AS products FROM products;"
mysql "$DATABASE_URL" -e "SELECT COUNT(*) AS wa_messages FROM wa_messages;"
mysql "$DATABASE_URL" -e "SELECT COUNT(*) AS telemetry_events FROM telemetry_events;"
```

Expected source row counts from the local SQLite snapshot checked on 2026-05-15:

```text
users: 5
products: 2838
telemetry_events: 279
wa_accounts: 2
wa_dispatch_logs: 323
wa_messages: 4806
wa_recipients: 392
wa_session_health: 5
landing_hero_slides: 5
landing_category_panels: 4
partners: 7
```

## Notes

- The importer dynamically copies only columns that exist in both SQLite and MySQL.
- Existing rows are upserted with `ON DUPLICATE KEY UPDATE`.
- Foreign key checks are disabled during import (on a dedicated connection) and re-enabled after import.
- JSON payload columns are stored as text JSON for compatibility with existing SQLx `String` decoders.
- SQLite does not enforce foreign keys by default (`PRAGMA foreign_keys = OFF`), so the source data may contain orphaned rows (e.g. `refresh_sessions` referencing deleted users). These are imported as-is. Consider running a cleanup pass after import if strict FK integrity is required.

## Local Migration Verification (2026-05-15)

Successfully migrated 9,022 rows across 58 tables from local `tridjaya.db` to MySQL.
All row counts match expected values. All JSON fields (products.images, specs, colors; promos.product_ids) validated as valid JSON.
VARCHAR primary keys confirmed working (TEXT PRIMARY KEY → VARCHAR(64) PRIMARY KEY conversion successful).
