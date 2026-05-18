# Deployment and Operations

Deployment project ini memakai runtime native: backend Rust sebagai service systemd, frontend Vite dibuild menjadi file statis, MySQL sebagai database, Redis sebagai queue/cache, dan Nginx sebagai reverse proxy sekaligus static file server.

## Layout Produksi

- Backend Rust berjalan di `127.0.0.1:8081`.
- Frontend dilayani langsung dari `frontend/dist` oleh Nginx.
- MySQL berjalan lokal atau di managed database.
- Redis berjalan lokal atau di managed Redis.
- Nginx menerima traffic publik dan meneruskan `/api/` serta `/uploads/` ke backend.

## Environment

Backend membaca konfigurasi dari `backend/.env`.

Minimal production:

```bash
DATABASE_URL=mysql://tridjaya:password@127.0.0.1:3306/tridjaya
ALLOWED_ORIGINS=https://tridjaya.com,https://www.tridjaya.com
FRONTEND_URL=https://tridjaya.com
COOKIE_SECURE=true
TRUST_PROXY_HEADERS=true
PIXEL_ENCRYPTION_KEY=replace_with_64_hex_chars
REDIS_URL=redis://127.0.0.1:6379
MYSQL_MAX_CONNECTIONS=25
MYSQL_ACQUIRE_TIMEOUT_SECS=5
MYSQL_IDLE_TIMEOUT_SECS=300
MAX_IN_FLIGHT_REQUESTS=300
REQUEST_TIMEOUT_SECS=30
PUBLIC_READ_MAX_PER_MINUTE=120
TELEMETRY_ANALYTICS_WINDOW_DAYS=30
WA_ENQUEUE_BATCH_SIZE=1000
```

Frontend membaca konfigurasi dari `frontend/.env`.

```bash
VITE_API_BASE_URL=https://tridjaya.com
VITE_FRONTEND_URL=https://tridjaya.com
```

## Build

```bash
cd backend
cargo build --release --bin tridjaya-backend

cd ../frontend
npm ci
npm run build
```

## Native Services

Gunakan `deploy.sh` untuk membuat service systemd:

```bash
sudo APP_DIR=/var/www/tridjaya DOMAIN=tridjaya.com ./deploy.sh
```

Service yang dibuat:

- `tridjaya-backend`

Perintah operasional:

```bash
systemctl status tridjaya-backend
journalctl -u tridjaya-backend -n 120 --no-pager
systemctl restart tridjaya-backend
```

## Nginx

`deploy.sh` membuat reverse proxy ke:

- `/api/` -> `http://127.0.0.1:8081`
- `/uploads/` -> `http://127.0.0.1:8081`
- `/` -> `${APP_DIR}/frontend/dist`

`deploy.sh` juga membuat `/etc/nginx/conf.d/tridjaya-limits.conf`:

- `/api/`: 60 request/detik per IP dengan burst 180.
- `/uploads/`: 30 request/detik per IP dengan burst 40 dan batas koneksi lebih kecil.

Limit ini melindungi backend sebelum request mencapai Rust/MySQL. Jika pengguna sah berada di belakang NAT besar atau saat load test dari satu IP, naikkan angka ini sementara.

Setelah DNS aktif, pasang TLS:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d tridjaya.com -d www.tridjaya.com
certbot renew --dry-run
```

## Release Gate

```bash
cd frontend
npm run build
npm run smoke:api
npm run baseline:monitor -- --strict
npm run test:api:backend
```

## Backup

Backup MySQL:

```bash
BACKUP_DIR=/backups/tridjaya ENV_FILE=/var/www/tridjaya/backend/.env /var/www/tridjaya/scripts/backup_mysql.sh
```

Contoh crontab:

```cron
0 3 * * * BACKUP_DIR=/backups/tridjaya ENV_FILE=/var/www/tridjaya/backend/.env /var/www/tridjaya/scripts/backup_mysql.sh
```

Backup folder runtime:

- `backend/uploads`
- `backend/sessions`

## Operasional Aman

- Gunakan SSH key dan user deploy non-root.
- Jangan commit `.env`.
- Batasi akses publik ke port internal `8081`, `3306`, dan `6379`.
- Review log backend dan Nginx secara berkala.
- Uji restore backup secara rutin.
