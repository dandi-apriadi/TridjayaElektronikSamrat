#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="${PROJECT_DIR:-/var/www/tridjaya}"
SQLITE_DB="${SQLITE_DB:-$PROJECT_DIR/backend/tridjaya.db}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backend/backups}"

echo "=========================================="
echo "  Tridjaya SQLite -> MySQL Data Migration"
echo "=========================================="
echo ""

cd "$PROJECT_DIR"

if [ ! -f "$SQLITE_DB" ]; then
    echo "ERROR: SQLite DB not found: $SQLITE_DB" >&2
    echo "Set SQLITE_DB=/path/to/tridjaya.db if the file is elsewhere." >&2
    exit 1
fi

if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a
elif [ -f "$PROJECT_DIR/backend/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/backend/.env"
    set +a
else
    echo "ERROR: .env not found in $PROJECT_DIR or $PROJECT_DIR/backend" >&2
    exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is not set." >&2
    exit 1
fi

case "$DATABASE_URL" in
    mysql://*) ;;
    *)
        echo "ERROR: DATABASE_URL must point to MySQL/MariaDB for this migration." >&2
        echo "Current scheme is not supported." >&2
        exit 1
        ;;
esac

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/tridjaya-before-mysql-$(date +%Y%m%d-%H%M%S).db"
cp "$SQLITE_DB" "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
echo "SQLite backup created: $BACKUP_FILE"

if command -v sqlite3 >/dev/null 2>&1; then
    echo ""
    echo "Source SQLite row counts:"
    for table in users products telemetry_events wa_accounts wa_dispatch_logs wa_messages wa_recipients wa_session_health landing_hero_slides partners; do
        count="$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "missing")"
        printf "  %s: %s\n" "$table" "$count"
    done
fi

echo ""
echo "Building migration binary..."
cd "$PROJECT_DIR/backend"
cargo build --release --bin migrate_sqlite_to_mysql

echo ""
echo "Running data migration..."
echo "MIGRATE_TRUNCATE=${MIGRATE_TRUNCATE:-false}"
cargo run --release --bin migrate_sqlite_to_mysql -- "$SQLITE_DB"

echo ""
echo "Migration command completed."
echo "Next checks:"
echo "  curl -s http://127.0.0.1:8081/health"
echo "  journalctl -u tridjaya-backend -n 120 --no-pager"
