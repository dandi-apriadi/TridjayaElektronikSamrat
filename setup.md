# Setup VPS Tridjaya (Ubuntu Fresh) — tridjaya.com

Panduan lengkap setup project Tridjaya di VPS Ubuntu fresh dengan domain `tridjaya.com`.

---

## Prasyarat

- VPS Ubuntu 22.04/24.04 LTS (minimal 2 vCPU, 4GB RAM)
- Domain `tridjaya.com` sudah pointing ke IP VPS (A record)
- Akses root SSH ke VPS

---

## 1. Update Sistem & Install Dependencies Dasar

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git pkg-config libssl-dev nginx certbot python3-certbot-nginx ufw unzip
```

---

## 2. Setup Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 3. Install MySQL 8

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql

# Secure installation
sudo mysql_secure_installation
```

Buat database dan user:

```bash
sudo mysql -u root <<EOF
CREATE DATABASE tridjaya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tridjaya'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT_DISINI';
GRANT ALL PRIVILEGES ON tridjaya.* TO 'tridjaya'@'localhost';
FLUSH PRIVILEGES;
EOF
```

---

## 4. Install Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
```

---

## 5. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version
```

---

## 6. Install Node.js (untuk Baileys Bridge & Frontend Build)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

---

## 7. Clone Repository

```bash
sudo mkdir -p /var/www/tridjaya
sudo chown $USER:$USER /var/www/tridjaya
cd /var/www/tridjaya

git clone https://github.com/dandi-apriadi/TridjayaElektronikSamrat.git .
```

---

## 8. Import Database

Database dump sudah tersedia di repo. Import langsung:

```bash
mysql -u tridjaya -p tridjaya < backend/database/tridjaya.sql
```

Verifikasi:

```bash
mysql -u tridjaya -p -e "USE tridjaya; SHOW TABLES;" | wc -l
# Harus sekitar 75+ tabel
```

---

## 9. Setup Backend Environment

```bash
cd /var/www/tridjaya/backend
cp .env.example .env
```

Edit `backend/.env` dengan nilai production:

```bash
nano .env
```

Isi yang WAJIB diubah:

```env
DATABASE_URL=mysql://tridjaya:GANTI_PASSWORD_KUAT_DISINI@127.0.0.1:3306/tridjaya
APP_ENV=production
ALLOWED_ORIGINS=https://tridjaya.com,https://www.tridjaya.com
FRONTEND_URL=https://tridjaya.com
COOKIE_SECURE=true
TRUST_PROXY_HEADERS=true
RUST_LOG=info
SKIP_DB_MIGRATIONS=1

# Generate encryption key:
# openssl rand -hex 32
PIXEL_ENCRYPTION_KEY=<hasil_openssl_rand>

# SMTP (opsional, untuk email verification/reset password)
SMTP_EMAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_SERVER=smtp.gmail.com
```

---

## 10. Build Backend

```bash
cd /var/www/tridjaya/backend

# Install Baileys bridge dependencies
cd baileys-bridge
npm ci --omit=dev
cd ..

# Build release binary (ini butuh waktu 3-5 menit pertama kali)
cargo build --release --bin tridjaya-backend
```

---

## 11. Setup Frontend Environment & Build

```bash
cd /var/www/tridjaya/frontend

cat > .env <<EOF
VITE_API_BASE_URL=https://tridjaya.com
VITE_FRONTEND_URL=https://tridjaya.com
VITE_ALLOWED_API_ORIGINS=https://tridjaya.com
EOF

npm ci
npm run build
```

---

## 12. Setup Systemd Service (Backend)

```bash
sudo tee /etc/systemd/system/tridjaya-backend.service <<EOF
[Unit]
Description=Tridjaya Backend
After=network.target mysql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=/var/www/tridjaya/backend
EnvironmentFile=/var/www/tridjaya/backend/.env
ExecStart=/var/www/tridjaya/backend/target/release/tridjaya-backend
Restart=always
RestartSec=5
LimitNOFILE=65535
TasksMax=4096

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tridjaya-backend
sudo systemctl start tridjaya-backend

# Verifikasi
sudo systemctl status tridjaya-backend
curl -s http://127.0.0.1:8081/health
```

---

## 13. Setup Nginx Reverse Proxy

```bash
# Rate limiting config
sudo tee /etc/nginx/conf.d/tridjaya-limits.conf <<EOF
limit_req_zone \$binary_remote_addr zone=api_per_ip:10m rate=60r/s;
limit_req_zone \$binary_remote_addr zone=public_per_ip:10m rate=30r/s;
limit_conn_zone \$binary_remote_addr zone=conn_per_ip:10m;
EOF

# Site config
sudo tee /etc/nginx/sites-available/tridjaya.com <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name tridjaya.com www.tridjaya.com;

    client_max_body_size 25m;
    keepalive_timeout 20s;
    send_timeout 30s;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location /api/ {
        limit_conn conn_per_ip 100;
        limit_req zone=api_per_ip burst=180 nodelay;
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        limit_conn conn_per_ip 20;
        limit_req zone=public_per_ip burst=40 nodelay;
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /assets/ {
        root /var/www/tridjaya/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        root /var/www/tridjaya/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/tridjaya.com /etc/nginx/sites-enabled/tridjaya.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 14. Setup SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d tridjaya.com -d www.tridjaya.com --non-interactive --agree-tos -m your-email@gmail.com

# Auto-renew sudah otomatis via systemd timer
sudo systemctl status certbot.timer
```

---

## 15. Verifikasi Deployment

```bash
# Backend health
curl -s https://tridjaya.com/api/health

# Frontend
curl -sI https://tridjaya.com | head -5

# Cek logs jika ada masalah
sudo journalctl -u tridjaya-backend -f --no-pager -n 50
```

---

## Update Deployment (Setelah Push Baru)

Untuk deploy update terbaru, jalankan:

```bash
cd /var/www/tridjaya
git fetch origin main
git reset --hard origin/main

# Rebuild backend
cd backend
cargo build --release --bin tridjaya-backend
sudo systemctl restart tridjaya-backend

# Rebuild frontend
cd ../frontend
npm ci
npm run build

sudo systemctl reload nginx
```

Atau gunakan script otomatis:

```bash
cd /var/www/tridjaya
sudo bash deploy.sh
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Backend tidak start | Cek `sudo journalctl -u tridjaya-backend -n 50` |
| 502 Bad Gateway | Backend belum ready, tunggu atau cek port 8081 |
| Database error | Pastikan MySQL running: `sudo systemctl status mysql` |
| SSL error | Run `sudo certbot renew --dry-run` |
| Permission denied | `sudo chown -R $USER:$USER /var/www/tridjaya` |

---

## Struktur Penting

```
/var/www/tridjaya/
├── backend/
│   ├── .env                  # Config production (JANGAN commit)
│   ├── database/tridjaya.sql # Database dump (untuk fresh setup)
│   ├── target/release/       # Binary hasil build
│   └── baileys-bridge/       # WhatsApp bridge (Node.js)
├── frontend/
│   ├── dist/                 # Hasil build (served oleh Nginx)
│   └── .env                  # VITE env vars
└── deploy.sh                 # Script deploy otomatis
```
