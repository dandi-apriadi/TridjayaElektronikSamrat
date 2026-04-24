# Deployment and Operations

## 1. Tujuan

Deployment harus menghasilkan sistem yang cepat, stabil, dan mudah dipelihara tanpa membuka risiko keamanan tambahan.

## 2. Layout Produksi

Rekomendasi layout:

- Frontend publik ditempatkan di CDN atau platform static hosting.
- Backend Rust berjalan di VPS Indonesia.
- PostgreSQL berjalan di server yang sama atau server terpisah dengan akses terbatas.
- Nginx menjadi reverse proxy di depan backend.

## 3. Environment Variables

- Semua secret disimpan sebagai environment variable atau secret manager.
- Tidak ada secret yang ditulis langsung ke source code.
- File `.env` tidak boleh masuk repository.
- Nilai konfigurasi sensitif harus dipisah antara staging dan production.

## 4. Build Strategy

- Gunakan release build untuk backend Rust.
- Gunakan static binary bila memungkinkan.
- Aktifkan optimisasi yang sesuai untuk production.
- Cache asset frontend secara efisien.
- Minify dan compress file statis.

## 5. Reverse Proxy

Nginx harus menangani:

- TLS termination,
- redirect HTTP ke HTTPS,
- rate limiting dasar,
- pengaturan header keamanan,
- routing ke backend internal,
- pemisahan asset statis dan API.

Template konfigurasi Nginx tersedia di `deploy/nginx/tridjaya.conf`.

## 6. TLS dan Domain

- Seluruh traffic wajib HTTPS.
- Gunakan sertifikat yang diperbarui otomatis.
- Nonaktifkan protokol lama yang lemah.
- Redirect semua akses non-HTTPS ke HTTPS.

## 7. Monitoring

Minimal monitor:

- uptime service,
- latency API,
- error rate,
- CPU dan memory,
- ukuran log,
- disk usage,
- jumlah login gagal,
- anomali traffic.

## 8. Backup dan Restore

- Backup database harian.
- Backup file media secara terpisah.
- Enkripsi backup sebelum disimpan.
- Uji restore secara berkala.
- Simpan salinan backup di lokasi berbeda.

## 9. Release Process

1. Build di environment terisolasi.
2. Jalankan test dan validasi schema.
	- Frontend build: `cd frontend && npm run build`
	- Smoke API release gate: `cd frontend && npm run smoke:api`
	- Baseline monitor (bundle + health latency): `cd frontend && npm run baseline:monitor`
	- Full release gate: `cd frontend && npm run release:gate`
3. Deploy ke staging.
4. Verifikasi manual fitur kritis.
5. Promote ke production bila lolos.
6. Simpan rollback plan yang jelas.

### 9.1 Baseline Gate dan Threshold

- File report baseline tersimpan otomatis di `frontend/reports/baseline-latest.json`.
- Default threshold:
	- Largest JS chunk <= 900 KB
	- Total JS bundle <= 2400 KB
	- Health latency <= 300 ms
- Untuk menjadikan baseline sebagai hard gate CI, jalankan dengan strict mode:
	- `npm run baseline:monitor -- --strict`

### 9.2 Auth Cookie Hardening

- Endpoint auth (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`) sekarang mengelola `refresh_token` via cookie `HttpOnly`.
- Frontend auth request harus mengaktifkan `credentials: 'include'` agar cookie ikut terkirim.
- Untuk environment HTTPS production, aktifkan `COOKIE_SECURE=true` supaya cookie dikirim dengan atribut `Secure` dan `SameSite=None`.
- Arus lama berbasis bearer token tetap dipertahankan untuk kompatibilitas bertahap.

### 9.3 Operational QA Cadence

- Jalankan validasi cepat operasional sebelum deploy minor:
	- `cd frontend && npm run qa:ops`
- Jalankan gate penuh sebelum release production:
	- `cd frontend && npm run release:gate`

## 10. Operasional Aman

- Akses server hanya untuk user yang berwenang.
- Gunakan SSH key, bukan password.
- Nonaktifkan login root langsung jika memungkinkan.
- Audit perubahan konfigurasi.
- Hentikan service yang tidak dipakai.
- Review log akses secara rutin.

## 11. Quick Start (Container)

Untuk local/staging cepat, gunakan setup container yang sudah disiapkan:

1. Salin file env:
	- `backend/.env.example` menjadi `backend/.env`
	- `frontend/.env.example` menjadi `frontend/.env`
2. Jalankan:
	- `docker compose up --build`
3. Endpoint default:
	- Frontend: `http://localhost:5173`
	- Backend API: `http://localhost:8081`

Catatan:
- Konfigurasi service ada di `docker-compose.yml`.
- Pada mode container default, backend masih memakai SQLite volume (`backend_data`).
