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

Default server berjalan di `0.0.0.0:8080`.
