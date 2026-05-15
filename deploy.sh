#!/bin/bash
set -e

echo "=========================================="
echo "  TRIDJAYA DEPLOY SCRIPT"
echo "  VPS: 159.223.36.80"
echo "=========================================="
echo ""

# ---- Langkah 1: Pull update dari GitHub ----
echo "[1/5] Pulling latest code from GitHub..."
cd /var/www/tridjaya
git fetch origin main
git reset --hard origin/main
echo "✓ Code updated"
echo ""

# ---- Langkah 2: Pastikan .env ada ----
echo "[2/5] Checking .env file..."
if [ ! -f .env ]; then
    echo "⚠ .env not found! Creating production .env..."
    REDIS_PASSWORD="$(openssl rand -hex 24)"
    PIXEL_KEY="$(openssl rand -hex 32)"

    cat > .env <<EOF
REDIS_PASSWORD=$REDIS_PASSWORD
APP_ENV=production
ALLOWED_ORIGINS=https://tridjaya.com,https://www.tridjaya.com,http://tridjaya.com,http://www.tridjaya.com,http://159.223.36.80
COOKIE_SECURE=true
PIXEL_ENCRYPTION_KEY=$PIXEL_KEY
TRUST_PROXY_HEADERS=true
VITE_API_BASE_URL=https://tridjaya.com
VITE_FRONTEND_URL=https://tridjaya.com
EOF

    chmod 600 .env
    echo "✓ .env created"
else
    echo "✓ .env exists"
fi
echo ""

# ---- Langkah 3: Build dan jalankan Docker Compose ----
echo "[3/5] Building and starting Docker containers..."
docker compose down || true
docker compose up -d --build
echo ""
echo "Waiting 30s for services to start..."
sleep 30
echo ""

# Cek status
echo "Container status:"
docker compose ps
echo ""

# ---- Langkah 4: Konfigurasi Nginx ----
echo "[4/5] Configuring Nginx..."
cat > /etc/nginx/sites-available/tridjaya.com <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name tridjaya.com www.tridjaya.com;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/tridjaya.com /etc/nginx/sites-enabled/tridjaya.com
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✓ Nginx configured and reloaded"
echo ""

# ---- Langkah 5: SSL dengan Let's Encrypt ----
echo "[5/5] Setting up SSL..."
apt-get install -y certbot python3-certbot-nginx -qq

# Cek apakah www resolve
WWW_IP=$(dig +short www.tridjaya.com 2>/dev/null || echo "")
if [ -n "$WWW_IP" ]; then
    echo "www.tridjaya.com resolves to $WWW_IP - including in cert"
    certbot --nginx -d tridjaya.com -d www.tridjaya.com --non-interactive --agree-tos --email admin@tridjaya.com --redirect
else
    echo "www.tridjaya.com not resolving - issuing cert for root domain only"
    certbot --nginx -d tridjaya.com --non-interactive --agree-tos --email admin@tridjaya.com --redirect
fi

echo "✓ SSL configured"
echo ""

# ---- Verifikasi ----
echo "=========================================="
echo "  VERIFICATION"
echo "=========================================="
echo ""
echo "Backend health:"
curl -s http://127.0.0.1:8081/health || echo "⚠ Backend not responding"
echo ""
echo ""
echo "Frontend:"
curl -sI http://127.0.0.1:5173 | head -3 || echo "⚠ Frontend not responding"
echo ""
echo "HTTPS:"
curl -sI https://tridjaya.com | head -3 || echo "⚠ HTTPS not ready yet"
echo ""
echo "=========================================="
echo "  DEPLOY COMPLETE!"
echo "  Site: https://tridjaya.com"
echo "=========================================="
