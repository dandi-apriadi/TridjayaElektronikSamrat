# Tridjaya Backend

Backend Rust untuk Tridjaya Samrat, disiapkan mengikuti spesifikasi di `docs/backend.md` dan `docs/api.md`.

## Fokus awal

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- Resource endpoints untuk users, catalogs, promotions, referrals, telemetry, jobs, dan articles
- Role-based access control di server
- Common response schema

## Stack scaffold

- Rust
- Axum
- Tokio
- In-memory auth/session store untuk tahap awal
- Siap diperluas ke PostgreSQL + SeaORM

## Menjalankan

```bash
cargo run
```

Default server berjalan di `0.0.0.0:8081`.

Untuk CORS allowlist gunakan environment variable berikut:

```bash
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Production Security

Di production, jalankan dengan konfigurasi eksplisit:

```bash
APP_ENV=production
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://domain-frontend-anda
TRUST_PROXY_HEADERS=true
PIXEL_ENCRYPTION_KEY=<64_hex_chars>
```

Catatan:

- `ALLOWED_ORIGINS` tidak boleh berisi wildcard karena cookie memakai credentials.
- `.env` hanya dimuat otomatis saat bukan production; production sebaiknya memakai env dari service manager/secret manager.
- Redis harus tersedia untuk rate limit yang konsisten antar instance backend.
- Upload publik dilayani oleh handler `/uploads/{path}` yang memblokir `uploads/private` dan hanya mengizinkan tipe media yang dikenal.
