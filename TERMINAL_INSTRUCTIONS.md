# Terminal Installation Instructions

Panduan ini memakai runtime native. Jalankan semua perintah dari root project kecuali disebutkan lain.

## 1. Prasyarat Lokal

Instal:

- Node.js 20+ dan npm
- Rust stable dan Cargo
- MySQL 8.0+ atau MariaDB kompatibel
- Redis

## 2. Setup Database

Buat database dan user MySQL:

```bash
mysql -u root -p
```

```sql
CREATE DATABASE tridjaya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tridjaya'@'localhost' IDENTIFIED BY 'password_aman';
GRANT ALL PRIVILEGES ON tridjaya.* TO 'tridjaya'@'localhost';
FLUSH PRIVILEGES;
```

Salin env backend:

```bash
cp backend/.env.example backend/.env
```

Isi minimal:

```bash
DATABASE_URL=mysql://tridjaya:password_aman@127.0.0.1:3306/tridjaya
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
COOKIE_SECURE=false
TRUST_PROXY_HEADERS=false
```

## 3. Instalasi Dependency

```bash
cd frontend
npm install

cd ../backend/baileys-bridge
npm install

cd ..
cargo build
```

## 4. Jalankan Project Lokal

Terminal 1:

```bash
redis-server
```

Terminal 2:

```bash
cd backend
cargo run --bin tridjaya-backend
```

Terminal 3:

```bash
cd frontend
npm run dev
```

Endpoint default:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8081`
- Health check: `http://localhost:8081/health`

## 5. Test API Backend

Setelah backend hidup:

```bash
cd frontend
npm run test:api:backend
```

Untuk read-only test:

```bash
API_TEST_MUTATE=false npm run test:api:backend
```

## 6. Build Production Native

```bash
cd backend
cargo build --release --bin tridjaya-backend

cd ../frontend
npm run build
```

## 7. Backup MySQL

```bash
BACKUP_DIR=./backups/mysql ./scripts/backup_mysql.sh
```
