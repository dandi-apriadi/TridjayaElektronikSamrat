# Terminal Installation Instructions

Dokumen ini berisi kumpulan perintah yang dapat disalin dan ditempel langsung ke terminal untuk melakukan instalasi project Tridjaya Manado, baik untuk pengembangan lokal maupun deployment ke VPS.

## 1. Persiapan Awal (Local Development - Windows/Linux/macOS)

Pastikan Anda sudah menginstal:
- **Node.js** (v18+) & **npm**
- **Rust** & **Cargo**
- **Redis** (opsional, jika tidak menggunakan Docker)
- **SQLite3**

### Jalankan perintah berikut di folder root project:

```bash
# 1. Instalasi dependensi Frontend
cd frontend
npm install
cp .env.example .env

# 2. Instalasi dependensi WhatsApp Bridge (Backend)
cd ../backend/baileys-bridge
npm install

# 3. Persiapan Backend Rust
cd ..
cp .env.example .env
cargo build

# Kembali ke root
cd ..
```

---

## 2. Cara Menjalankan Project (Lokal)

Gunakan dua terminal terpisah:

**Terminal 1 (Backend):**
```bash
cd backend
cargo run --bin tridjaya-backend
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

---

## 3. Instalasi Cepat di VPS (Ubuntu/Debian)

Jika Anda sedang menyiapkan server baru, Anda bisa menyalin blok perintah ini sekaligus setelah melakukan `git clone`.

```bash
# Masuk ke folder project
cd /var/www/tridjaya

# Update sistem dan instalasi Docker (jika belum ada)
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git

# Buat file .env production secara otomatis
cat > .env <<EOF
REDIS_PASSWORD=$(openssl rand -hex 24)
APP_ENV=production
ALLOWED_ORIGINS=https://tridjaya.com,https://www.tridjaya.com
COOKIE_SECURE=true
PIXEL_ENCRYPTION_KEY=$(openssl rand -hex 32)
TRUST_PROXY_HEADERS=true
VITE_API_BASE_URL=https://tridjaya.com
VITE_FRONTEND_URL=https://tridjaya.com
EOF

# Jalankan dengan Docker Compose (Build Semuanya)
docker compose up -d --build

# Cek status kontainer
docker compose ps
```

---

## 4. Perintah Tambahan (Maintenance)

### Update Code & Restart (VPS)
```bash
git pull origin main
docker compose up -d --build
```

### Cek Log Backend
```bash
docker compose logs -f backend
```

### Backup Database (SQLite)
```bash
docker compose exec backend sh -c 'sqlite3 /app/data/tridjaya.db ".backup /app/data/backup.db"'
docker cp $(docker compose ps -q backend):/app/data/backup.db ./backups/$(date +%Y%m%d).db
```
