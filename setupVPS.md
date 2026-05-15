# Setup VPS Tridjaya

Dokumen ini mencatat state terakhir deployment dan langkah lanjutan untuk menjalankan project dari branch `main` di VPS `159.223.36.80` untuk domain `tridjaya.com`.

Jangan simpan password VPS, token, atau credential asli di file ini. Password VPS yang pernah dikirim lewat chat sebaiknya dirotasi setelah deployment selesai.

## State Terakhir

- Branch lokal `main` sudah dipush ke GitHub.
- Commit terakhir yang sudah dipush: `e5a271e`.
- Repository GitHub: `https://github.com/dandi-apriadi/TridjayaElektronikSamrat.git`.
- VPS memakai Ubuntu 24.04.
- Paket dasar sudah dipasang di VPS: `git`, `nginx`, `sqlite3`, `docker`, dan `docker compose`.
- Domain `tridjaya.com` sudah resolve ke `159.223.36.80`.
- Repo sudah di-clone ke VPS di:

```bash
/var/www/tridjaya
```

- File `.env` production sudah dibuat di:

```bash
/var/www/tridjaya/.env
```

- Docker build frontend sudah berhasil pada percobaan awal.
- Docker build backend sempat gagal pada step:

```bash
RUN npm ci --omit=dev --prefix ./baileys-bridge
```

Penyebab: folder `backend/baileys-bridge` memiliki `package-lock.json` lokal, tetapi file tersebut sebelumnya di-ignore dan belum ikut masuk GitHub. Lockfile sekarang sudah disiapkan untuk dipush ke `main`.

## Langkah 1: Pull Update di VPS

Setelah perubahan terbaru dipush ke `main`, pull update di VPS.

Masuk ke VPS:

```bash
ssh root@159.223.36.80
```

Update repo:

```bash
cd /var/www/tridjaya
git fetch origin main
git reset --hard origin/main
```

Pastikan `.env` masih ada:

```bash
ls -la .env
```

Jika `.env` hilang, buat ulang:

```bash
cd /var/www/tridjaya
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
```

## Langkah 2: Build dan Jalankan Docker Compose

Jalankan:

```bash
cd /var/www/tridjaya
docker compose up -d --build
```

Cek status container:

```bash
docker compose ps
```

Cek log jika ada service gagal:

```bash
docker compose logs --tail=120 backend
docker compose logs --tail=120 frontend
docker compose logs --tail=120 redis
```

Tes service lokal di VPS:

```bash
curl -I http://127.0.0.1:5173
curl -s http://127.0.0.1:8081/health
```

Expected:

- Frontend memberi HTTP `200`.
- Backend `/health` mengembalikan JSON healthy.

## Langkah 3: Konfigurasi Nginx Host untuk Domain

Buat config Nginx:

```bash
cat > /etc/nginx/sites-available/tridjaya.com <<'EOF'
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
EOF
```

Aktifkan site:

```bash
ln -sf /etc/nginx/sites-available/tridjaya.com /etc/nginx/sites-enabled/tridjaya.com
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Tes dari VPS:

```bash
curl -I http://tridjaya.com
curl -s http://tridjaya.com/health
```

Catatan: `/health` akan melewati frontend jika tidak dibuat route khusus di Nginx. Untuk health backend gunakan:

```bash
curl -s http://127.0.0.1:8081/health
```

## Langkah 4: SSL HTTPS dengan Let’s Encrypt

Pastikan DNS berikut mengarah ke `159.223.36.80`:

```bash
dig +short tridjaya.com
dig +short www.tridjaya.com
```

Jika `www.tridjaya.com` belum diarahkan, issue SSL hanya untuk root domain dulu:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d tridjaya.com
```

Jika `www` juga sudah diarahkan:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d tridjaya.com -d www.tridjaya.com
```

Pilih opsi redirect HTTP ke HTTPS saat diminta.

Tes auto-renew:

```bash
certbot renew --dry-run
```

## Langkah 5: Verifikasi Akhir

Dari lokal atau VPS:

```bash
curl -I https://tridjaya.com
curl -s https://tridjaya.com/api/public/catalogs | head
```

Buka di browser:

```text
https://tridjaya.com
https://tridjaya.com/dashboard/login
```

Tes login admin, lalu cek halaman:

```text
/dashboard/admin/users
/dashboard/admin/users/new
/dashboard/admin/wa/campaigns
```

Jika create user masih memberi `400 Bad Request`, cek payload frontend dan response backend:

```bash
cd /var/www/tridjaya
docker compose logs --tail=200 backend
```

Kemungkinan penyebab umum:

- Field wajib user belum dikirim frontend.
- Role atau status tidak sesuai validasi backend.
- Email sudah ada.
- Password tidak memenuhi aturan backend.

## Langkah 6: Maintenance Command

Update deployment setelah push baru ke `main`:

```bash
cd /var/www/tridjaya
git fetch origin main
git reset --hard origin/main
docker compose up -d --build
docker compose ps
```

Restart service:

```bash
cd /var/www/tridjaya
docker compose restart backend
docker compose restart frontend
```

Backup SQLite database:

```bash
cd /var/www/tridjaya
mkdir -p backups
docker compose exec backend sh -lc 'sqlite3 /app/data/tridjaya.db ".backup /app/data/tridjaya-backup.db"'
docker cp "$(docker compose ps -q backend)":/app/data/tridjaya-backup.db "backups/tridjaya-$(date +%Y%m%d-%H%M%S).db"
```

Lihat pemakaian resource:

```bash
docker stats
df -h
free -h
```

## Catatan Keamanan

- Rotasi password root VPS setelah setup.
- Lebih baik buat user deploy non-root dan gunakan SSH key.
- Jangan commit file `.env`.
- Jangan buka port backend `8081` ke publik jika tidak perlu. Saat ini Compose expose `8081`, tetapi akses utama tetap lewat Nginx. Untuk hardening, ubah port mapping backend menjadi `127.0.0.1:8081:8081`.
- Setelah SSL aktif, pastikan `.env` production memakai:

```bash
COOKIE_SECURE=true
VITE_API_BASE_URL=https://tridjaya.com
VITE_FRONTEND_URL=https://tridjaya.com
```
