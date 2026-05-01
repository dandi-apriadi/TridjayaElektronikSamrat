# Panduan Instalasi VPS - Tridjaya Samrat (polimdogreenacc.com)

Panduan ini menjelaskan langkah-langkah untuk melakukan deployment aplikasi Tridjaya Samrat ke server VPS (Ubuntu 22.04) menggunakan data dari repositori GitHub.

## 1. Persiapan Server

Pastikan VPS Anda menggunakan **Ubuntu 22.04 LTS**. Login ke server via SSH:
```bash
ssh root@your_vps_ip
```

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Dependencies
```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Rust (Cargo)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# SQLite, Redis, & Build Tools
sudo apt install -y sqlite3 redis-server build-essential pkg-config libssl-dev nginx certbot python3-certbot-nginx
```

## 2. Clone Repositori

```bash
cd /var/www
# Sesuaikan URL repo dengan URL Anda
git clone https://github.com/dandi-apriadi/TridjayaElektronikSamrat.git
cd TridjayaElektronikSamrat
```

## 3. Konfigurasi Backend (Rust)

```bash
cd backend
cp .env.example .env
```

Edit `.env` menggunakan `nano .env`:
```env
DATABASE_URL="sqlite:tridjaya.db"
APP_ENV="production"
ALLOWED_ORIGINS="https://polimdogreenacc.com,https://www.polimdogreenacc.com"
# Masukkan konfigurasi SMTP Anda jika diperlukan
```

### Build Backend
```bash
cargo build --release
```

## 4. Konfigurasi Frontend (React)

```bash
cd ../frontend
cp .env.example .env
```

Edit `.env` (Frontend):
```env
VITE_API_BASE_URL="https://polimdogreenacc.com"
```

### Build Frontend
```bash
npm install
npm run build
```

## 5. Konfigurasi Nginx (Domain & SSL)

Buat file konfigurasi Nginx:
```bash
sudo nano /etc/nginx/sites-available/polimdogreenacc
```

Isi dengan:
```nginx
server {
    server_name polimdogreenacc.com www.polimdogreenacc.com;
    client_max_body_size 20M;

    # Frontend (Vite Static Files)
    location / {
        root /var/www/TridjayaElektronikSamrat/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/TridjayaElektronikSamrat/backend/uploads/;
    }
}
```

Aktifkan konfigurasi:
```bash
sudo ln -s /etc/nginx/sites-available/polimdogreenacc /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Setup SSL (HTTPS)
```bash
sudo certbot --nginx -d polimdogreenacc.com -d www.polimdogreenacc.com
```

## 6. Menjalankan Aplikasi dengan PM2

Gunakan PM2 agar aplikasi tetap berjalan di background.

### Install PM2
```bash
sudo npm install -g pm2
```

### Jalankan Backend
```bash
cd /var/www/TridjayaElektronikSamrat/backend
pm2 start "./target/release/tridjaya-backend" --name "tridjaya-backend"
```

### Jalankan Sync Cache (Opsional tapi disarankan)
Jika menggunakan fitur Redis cache:
```bash
pm2 save
pm2 startup
```

## 7. Verifikasi
Akses domain Anda di `https://polimdogreenacc.com`.
Coba login ke admin di `https://polimdogreenacc.com/login` menggunakan akun yang sudah kita buat tadi.

---
**Catatan Database**: Repositori ini sudah menyertakan `tridjaya.db` yang berisi data produk dan akun admin terverifikasi. Pastikan permissions file database benar:
```bash
chmod 666 /var/www/TridjayaElektronikSamrat/backend/tridjaya.db
```
