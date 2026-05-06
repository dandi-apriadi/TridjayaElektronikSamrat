# VPS Deployment Setup Guide - Tridjaya Samrat

Panduan ini menjelaskan langkah-langkah instalasi aplikasi dari awal menggunakan Git Clone di VPS yang sudah terkonfigurasi domainnya.

## 1. Clone Repository

Masuk ke folder `/var/www` dan ambil kode terbaru dari GitHub:
```bash
cd /var/www
# Hapus folder lama jika ingin instalasi bersih (opsional)
# rm -rf tridjaya-samrat 

git clone https://github.com/dandi-apriadi/TridjayaElektronikSamrat.git tridjaya-samrat
cd tridjaya-samrat
```

---

## 2. Konfigurasi Environment (.env)

Anda perlu membuat file `.env` secara manual di folder backend dan frontend.

### A. Backend (`backend/.env`)
```bash
nano backend/.env
```
Isi dengan:
```env
DATABASE_URL=sqlite://tridjaya.db?mode=rwc
SMTP_EMAIL=dandimamonto.tridjaya03@gmail.com
SMTP_PASSWORD=rkhkwoksvubfbbtw
SMTP_SERVER=smtp.gmail.com
FRONTEND_URL=https://polimdogreenacc.com
```

### B. Frontend (`frontend/.env`)
```bash
nano frontend/.env
```
Isi dengan:
```env
VITE_API_BASE_URL=https://polimdogreenacc.com
VITE_FRONTEND_URL=https://polimdogreenacc.com
```

---

## 3. Setup Backend (Rust)

### A. Build Binary
Pastikan Rust sudah terinstall di VPS.
```bash
cd /var/www/tridjaya-samrat/backend
cargo build --release --bin tridjaya-backend
```

### B. Jalankan dengan PM2
```bash
# Hapus proses lama jika ada
pm2 delete tridjaya-backend 

# Jalankan proses baru
pm2 start ./target/release/tridjaya-backend --name "tridjaya-backend"
pm2 save
```

---

## 4. Setup Frontend (Vite)

### A. Build Aset Statis
```bash
cd /var/www/tridjaya-samrat/frontend
npm install
npm run build
```
*Pastikan konfigurasi Nginx Anda mengarah ke folder `/var/www/tridjaya-samrat/frontend/dist`.*

---

## 5. Sinkronisasi Data (Database & Gambar)

Karena database dan gambar sudah saya sertakan di repository, Anda hanya perlu melakukan pull jika ada perubahan di masa depan:
```bash
cd /var/www/tridjaya-samrat
git pull origin main
pm2 restart tridjaya-backend
```

---

## 6. Verifikasi Akhir

1. **Cek Log Backend**: `pm2 logs tridjaya-backend` (Pastikan muncul "Listening on http://0.0.0.0:8081").
2. **Cek Website**: Buka `https://polimdogreenacc.com`.
3. **Cek Gambar**: Buka halaman Blog untuk memastikan gambar artikel muncul.

> [!TIP]
> Jika gambar tetap tidak muncul, pastikan folder `backend/uploads` dan `frontend/public/assets/images` memiliki izin baca (read permission):
> `chmod -R 755 /var/www/tridjaya-samrat`
