#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-tridjaya-manado}"
DB_VOLUME="${DB_VOLUME:-${PROJECT_NAME}_backend_data}"
BACKUP_DIR="${BACKUP_DIR:-/backups/tridjaya}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE="$(date +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}"

docker run --rm \
  -v "${DB_VOLUME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  sh -c 'cp /data/tridjaya.db "/backup/tridjaya_'"${DATE}"'.db"'

find "${BACKUP_DIR}" -name "tridjaya_*.db" -type f -mtime +"${RETENTION_DAYS}" -delete

echo "Backup created: ${BACKUP_DIR}/tridjaya_${DATE}.db"
