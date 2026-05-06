# VPS Deployment Setup Guide - Tridjaya Samrat

Dokumen ini menjelaskan langkah-langkah untuk melakukan update database dan aset gambar ke VPS, serta konfigurasi layanan agar aplikasi berjalan optimal di lingkungan produksi.

## 1. Persiapan Database dan Aset

Pastikan database lokal Anda (`backend/tridjaya.db`) dalam kondisi terbaru dan sudah di-seed dengan data yang benar.

### Struktur Folder Penting
- `backend/tridjaya.db`: Database utama.
- `backend/uploads/`: Folder gambar produk dan artikel yang diunggah sistem.
- `frontend/public/assets/images/`: Folder aset gambar statis frontend.

---

## 2. Persiapan Folder di VPS
Sebelum mengirim file, pastikan folder tujuan sudah ada di VPS. Jalankan perintah ini di VPS (via SSH):
```bash
mkdir -p /var/www/tridjaya-samrat/backend
mkdir -p /var/www/tridjaya-samrat/frontend/public/assets
```

## 3. Transfer Data ke VPS (Rekomendasi SCP)
Gunakan perintah berikut dari terminal lokal Anda:
```bash
scp backend/tridjaya.db root@165.245.179.167:/var/www/tridjaya-samrat/backend/tridjaya.db
```

### B. Mengirim Folder Uploads (Gambar Produk/Artikel)
```bash
scp -r backend/uploads root@165.245.179.167:/var/www/tridjaya-samrat/backend/
```

### C. Mengirim Aset Frontend
Jika ada perubahan pada gambar statis di folder public:
```bash
scp -r frontend/public/assets/images root@165.245.179.167:/var/www/tridjaya-samrat/frontend/public/assets/
```

---

## 4. Konfigurasi Backend di VPS

### A. Environment Variables (`backend/.env`)
Pastikan file `.env` di server menggunakan URL produksi:
```env
DATABASE_URL=sqlite://tridjaya.db?mode=rwc
SMTP_EMAIL=dandimamonto.tridjaya03@gmail.com
SMTP_PASSWORD=rkhkwoksvubfbbtw
SMTP_SERVER=smtp.gmail.com
FRONTEND_URL=https://polimdogreenacc.com
```

### B. Menjalankan Layanan dengan PM2
Agar backend tetap berjalan di background:
```bash
cd /var/www/tridjaya-samrat/backend
# Build binary jika belum ada
cargo build --release --bin tridjaya-backend

# Jalankan dengan PM2
pm2 start ./target/release/tridjaya-backend --name "tridjaya-backend"
pm2 save
```

---

## 5. Konfigurasi Frontend di VPS

### A. Environment Variables (`frontend/.env`)
```env
VITE_API_BASE_URL=https://polimdogreenacc.com
VITE_FRONTEND_URL=https://polimdogreenacc.com
```

### B. Build Frontend
```bash
cd /var/www/tridjaya-samrat/frontend
npm install
npm run build
```

---

## 6. Sinkronisasi via Git (Opsional)

Jika Anda ingin "push" database via Git (hanya untuk satu kali sinkronisasi):
1. Hapus `*.db` dari `.gitignore`.
2. Lakukan commit: `git add backend/tridjaya.db && git commit -m "Deploy: Update production database"`.
3. Push ke repository: `git push origin main`.
4. Di VPS: `git pull`.

> [!CAUTION]
> Jangan jadikan file `.db` sebagai file yang terus menerus di-tracking di Git untuk data dinamis. Gunakan metode SCP untuk update data harian.

---

## 7. Verifikasi Akhir
Setelah semua file ditransfer dan layanan direstart:
1. Cek log backend: `pm2 logs tridjaya-backend`.
2. Akses `https://polimdogreenacc.com/blog` untuk memastikan gambar artikel muncul.
3. Cek koneksi database dengan mencoba login ke panel admin.
