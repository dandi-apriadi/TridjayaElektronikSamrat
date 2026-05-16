#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
ENV_FILE="${ENV_FILE:-backend/.env}"
DATE="$(date +%Y%m%d_%H%M%S)"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Environment file not found: ${ENV_FILE}" >&2
  exit 1
fi

DATABASE_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | head -n1 | cut -d= -f2-)"

if [ -z "${DATABASE_URL}" ]; then
  echo "DATABASE_URL is not set in ${ENV_FILE}" >&2
  exit 1
fi

case "${DATABASE_URL}" in
  mysql://*) ;;
  *)
    echo "DATABASE_URL must use mysql:// for this backup script." >&2
    exit 1
    ;;
esac

if ! command -v mysqldump >/dev/null 2>&1; then
  echo "mysqldump is required. Install mysql-client first." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

OUT="${BACKUP_DIR}/tridjaya_${DATE}.sql.gz"
mysqldump "${DATABASE_URL}" | gzip > "${OUT}"

find "${BACKUP_DIR}" -name 'tridjaya_*.sql.gz' -type f -mtime +"${RETENTION_DAYS}" -delete

echo "Backup created: ${OUT}"
