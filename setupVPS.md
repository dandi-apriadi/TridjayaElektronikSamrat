# Setup VPS Tridjaya Native

Dokumen ini adalah panduan deployment native. Jangan simpan password, token, atau credential asli di file ini.

## 1. Paket Dasar

```bash
apt-get update
apt-get install -y git nginx redis-server mysql-server mysql-client curl build-essential pkg-config libssl-dev certbot python3-certbot-nginx
```

Instal Node.js 20+ dan Rust stable sesuai standar server.

## 2. Clone Project

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/dandi-apriadi/TridjayaElektronikSamrat.git tridjaya
cd /var/www/tridjaya
```

## 3. Setup MySQL

```bash
mysql -u root -p
```

```sql
CREATE DATABASE tridjaya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tridjaya'@'localhost' IDENTIFIED BY 'password_aman';
GRANT ALL PRIVILEGES ON tridjaya.* TO 'tridjaya'@'localhost';
FLUSH PRIVILEGES;
```

## 4. Setup Environment

```bash
cd /var/www/tridjaya
cp backend/.env.example backend/.env
nano backend/.env
```

Isi minimal:

```bash
DATABASE_URL=mysql://tridjaya:password_aman@127.0.0.1:3306/tridjaya
ALLOWED_ORIGINS=https://tridjaya.com,https://www.tridjaya.com
FRONTEND_URL=https://tridjaya.com
COOKIE_SECURE=true
TRUST_PROXY_HEADERS=true
PIXEL_ENCRYPTION_KEY=isi_64_hex_chars
REDIS_URL=redis://127.0.0.1:6379
```

Frontend:

```bash
cat > frontend/.env <<'EOF'
VITE_API_BASE_URL=https://tridjaya.com
VITE_FRONTEND_URL=https://tridjaya.com
EOF
```

## 5. Build dan Install Service

```bash
cd /var/www/tridjaya
chmod +x deploy.sh
APP_DIR=/var/www/tridjaya DOMAIN=tridjaya.com ./deploy.sh
```

## 6. Cek Service

```bash
systemctl status tridjaya-backend tridjaya-frontend
journalctl -u tridjaya-backend -n 120 --no-pager
journalctl -u tridjaya-frontend -n 120 --no-pager
curl -s http://127.0.0.1:8081/health
curl -I http://127.0.0.1:5173
```

## 7. SSL

```bash
certbot --nginx -d tridjaya.com -d www.tridjaya.com
certbot renew --dry-run
```

## 8. Update Setelah Push Baru

```bash
cd /var/www/tridjaya
git fetch origin main
git reset --hard origin/main
APP_DIR=/var/www/tridjaya DOMAIN=tridjaya.com ./deploy.sh
```

## 9. Test API

```bash
cd /var/www/tridjaya/frontend
npm run test:api:backend
```

## 10. Backup

```bash
cd /var/www/tridjaya
BACKUP_DIR=/backups/tridjaya ENV_FILE=/var/www/tridjaya/backend/.env ./scripts/backup_mysql.sh
```
