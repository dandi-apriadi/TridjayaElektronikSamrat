#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/tridjaya}"
DOMAIN="${DOMAIN:-tridjaya.com}"
FRONTEND_URL="${FRONTEND_URL:-https://${DOMAIN}}"
API_BASE_URL="${API_BASE_URL:-https://${DOMAIN}}"

echo "=========================================="
echo "  TRIDJAYA NATIVE DEPLOY"
echo "  App dir: ${APP_DIR}"
echo "=========================================="

cd "${APP_DIR}"

echo "[1/7] Updating source..."
git fetch origin main
git reset --hard origin/main

echo "[2/7] Checking backend environment..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env from backend/.env.example. Edit DATABASE_URL before continuing."
  exit 1
fi

if ! grep -q '^DATABASE_URL=mysql://' backend/.env; then
  echo "backend/.env must use a MySQL DATABASE_URL, for example:"
  echo "DATABASE_URL=mysql://tridjaya:password@127.0.0.1:3306/tridjaya"
  exit 1
fi

echo "[3/7] Installing backend bridge dependencies..."
cd "${APP_DIR}/backend/baileys-bridge"
npm ci --omit=dev

echo "[4/7] Building backend release binary..."
cd "${APP_DIR}/backend"
cargo build --release --bin tridjaya-backend

echo "[5/7] Building frontend..."
cd "${APP_DIR}/frontend"
if [ ! -f .env ]; then
  cat > .env <<EOF
VITE_API_BASE_URL=${API_BASE_URL}
VITE_FRONTEND_URL=${FRONTEND_URL}
EOF
fi
npm ci
npm run build

echo "[6/7] Installing native systemd services..."
cat > /etc/systemd/system/tridjaya-backend.service <<EOF
[Unit]
Description=Tridjaya Backend
After=network.target mysql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${APP_DIR}/backend/.env
ExecStart=${APP_DIR}/backend/target/release/tridjaya-backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/tridjaya-frontend.service <<EOF
[Unit]
Description=Tridjaya Frontend Preview Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/frontend
ExecStart=/usr/bin/npm run preview -- --host 127.0.0.1 --port 5173
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tridjaya-backend tridjaya-frontend
systemctl restart tridjaya-backend tridjaya-frontend

echo "[7/7] Installing nginx reverse proxy..."
cat > /etc/nginx/sites-available/${DOMAIN} <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "Backend health:"
curl -fsS http://127.0.0.1:8081/health || true
echo
echo "Frontend:"
curl -fsSI http://127.0.0.1:5173 | head -3 || true

echo "Native deploy finished."
