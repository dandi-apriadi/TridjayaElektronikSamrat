#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
DURATION="${DURATION:-60s}"
THREADS="${THREADS:-2}"
CONNECTIONS="${CONNECTIONS:-1000}"

if ! command -v wrk >/dev/null 2>&1; then
  echo "wrk is required. Install it first, then rerun this script." >&2
  exit 1
fi

echo "Target: ${BASE_URL}"
echo "Duration: ${DURATION}, threads: ${THREADS}, connections: ${CONNECTIONS}"

echo
echo "== health =="
wrk -t"${THREADS}" -c"${CONNECTIONS}" -d"${DURATION}" "${BASE_URL}/health"

echo
echo "== public catalog =="
wrk -t"${THREADS}" -c"${CONNECTIONS}" -d"${DURATION}" "${BASE_URL}/api/catalogs?page=1&limit=50"
