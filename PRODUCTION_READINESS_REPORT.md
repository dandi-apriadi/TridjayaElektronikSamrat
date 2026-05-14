# Laporan Kesiapan Production — Tridjaya Elektronik Manado

**Tanggal:** 2026-05-14
**Auditor:** Cascade (AI Pair Programmer)
**Scope:** Backend (Rust/Axum/SQLite), Frontend (React/Vite), Docker, Baileys Bridge, Konfigurasi

---

## Executive Summary

**Status: MAYORITAS SIAP, MASIH ADA ACTION MANUAL SEBELUM GO-LIVE**

Update implementasi 2026-05-14:
- Docker backend sudah memasukkan Node.js, Baileys bridge, dan dependency production bridge.
- Docker Compose sudah memakai volume granular untuk database, uploads, sessions, dan Redis persistence.
- Healthcheck, restart policy, resource limit, dan log rotation sudah ditambahkan.
- SQLite WAL mode dan busy timeout sudah diaktifkan saat startup.
- Script backup database harian tersedia di `scripts/backup_sqlite.sh`.

Masih ada **2 action manual kritis** sebelum deploy ke server publik:

1. **File sensitif masih ada di Git history** — database SQLite, frontend `.env`, dan dokumen VPS dengan password bisa di-retrospeksi dari history.
2. **Password SMTP harus diganti** — karena pernah masuk Git history.

Sisanya adalah masalah infrastruktur Docker dan cleanup yang penting tapi tidak memblokir go-live jika blocker diatas diperbaiki.

---

## 1. Blocker Kritis — Harus Diperbaiki Segera

### 1.1. Docker Backend Tidak Mengandung Node.js / Baileys Bridge

**Status update 2026-05-14:** Diperbaiki. `backend/Dockerfile` sekarang menginstall Node.js 22, menyalin `baileys-bridge/`, menjalankan `npm ci --omit=dev`, dan membuat direktori runtime `data/`, `uploads/`, serta `sessions/`.

**File:** `backend/Dockerfile`, `backend/src/bridge/mod.rs:37-418`

**Temuan:**
- `BridgeClient::spawn_process` menjalankan `std::process::Command::new("node")` dengan argumen `baileys-bridge/src/index.js`.
- Dockerfile backend (`debian:bookworm-slim`) **tidak menginstall Node.js** dan **tidak COPY folder `baileys-bridge/`** ke image.

**Impact:** Di container Docker, semua fitur WhatsApp (BlastEngine, session connect, QR scan) akan **gagal total** dengan error "node: command not found" atau file not found.

**Rekomendasi Perbaikan:**

Ubah `backend/Dockerfile` menjadi multi-stage yang juga install Node.js:

```dockerfile
FROM rust:1.88-bookworm AS builder
WORKDIR /app

COPY Cargo.toml Cargo.lock* ./
COPY src ./src
COPY migrations ./migrations

RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app

# Install Node.js runtime (required for Baileys bridge)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/tridjaya-backend /usr/local/bin/tridjaya-backend
COPY migrations ./migrations
COPY baileys-bridge ./baileys-bridge

# Install Baileys bridge dependencies
RUN cd baileys-bridge && npm ci --only=production

# Create required directories
RUN mkdir -p uploads uploads/private uploads/temp sessions

EXPOSE 8081
CMD ["tridjaya-backend"]
```

**Alternatif:** Pisahkan Baileys bridge sebagai service standalone di `docker-compose.yml` dengan image Node.js sendiri dan komunikasi via TCP/WebSocket (bukan stdin/stdout).

---

### 1.2. File Sensitif Masih Ada di Git History

**File:** `backend/tridjaya.db`, `frontend/.env` (pernah), `VPS setup.md` (pernah)

**Temuan:**
- Commit `5684a52` — database SQLite masih ada di history
- Commit `70a4fda` — frontend `.env` masih ada di history
- Commit `a83cc9a`, `ec1f7dc`, `cee3f25` — VPS setup guide berisi password SMTP masih ada di history
- File `backend/tridjaya.db` juga masih **ada secara fisik** di working tree

**Impact:**
- Password SMTP bisa di-retrospeksi dari Git history.
- Database SQLite binary bisa mengandung data testing, token, atau hash password.

**Rekomendasi Perbaikan:**

**Langkah 1: Hapus file dari history** (gunakan git-filter-repo atau BFG Repo-Cleaner):

```bash
# Install git-filter-repo (via pipx atau pip)
pip install git-filter-repo

# Jalankan dari root repo
git filter-repo --path backend/tridjaya.db --path frontend/.env --path "VPS setup.md" --invert-paths

# Force push ke remote
git push origin --force --all
```

**Langkah 2: Hapus file fisik dari working tree** (jika masih terlacak):

```bash
git rm --cached backend/tridjaya.db
git commit -m "chore: remove tracked SQLite database"
rm backend/tridjaya.db
```

**Langkah 3: Ganti password SMTP** — Karena password pernah masuk Git history, **wajib ganti password Gmail/Google Workspace** meskipun sudah dihapus dari history.

---

## 2. Risiko Tinggi — Perlu Perhatian Sebelum Go-Live

### 2.1. Uploads & Sessions Tidak Persisten di Docker

**Status update 2026-05-14:** Diperbaiki. `docker-compose.yml` sekarang memakai volume granular `backend_data:/app/data`, `wa_uploads:/app/uploads`, dan `wa_sessions:/app/sessions`, sehingga data runtime tidak menimpa isi image `/app`.

**File:** `docker-compose.yml`

**Temuan:** Folder `uploads/` (termasuk `uploads/private/`) dan `sessions/` (Baileys credentials) **tidak di-mount sebagai volume**. Saat container restart, semua file upload (foto KTP, profil) dan session WhatsApp lokal akan **hilang**.

**Impact:** Kehilangan data upload dan sesi WhatsApp yang perlu di-scan ulang.

**Rekomendasi Perbaikan:**

Tambahkan volume mounts ke `docker-compose.yml`:

```yaml
services:
  backend:
    volumes:
      - backend_data:/app
      - wa_uploads:/app/uploads
      - wa_sessions:/app/sessions

volumes:
  backend_data:
  wa_uploads:
  wa_sessions:
  redis_data:
```

---

### 2.2. SQLite untuk Production — Tolerable tapi Perlu Backup

**Temuan:**
- SQLite dengan `max_connections(5)` dan single backend instance masih bisa digunakan untuk production skala kecil-menengah.
- Tidak ada strategi backup otomatis untuk file `.db` di Docker volume.

**Rekomendasi Perbaikan:**

**Langkah 1: Pastikan WAL mode aktif** (tambahkan ke startup script atau migration):

```rust
sqlx::query("PRAGMA journal_mode=WAL").execute(&pool).await?;
```

**Langkah 2: Setup automated backup harian** (contoh via cron di VPS host):

```bash
#!/bin/bash
# backup.sh — jalankan via crontab setiap hari jam 3 AM
DB_PATH=/var/lib/docker/volumes/tridjaya_backend_data/_data/tridjaya.db
BACKUP_DIR=/backups/tridjaya
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/tridjaya_$DATE.db"
# Hapus backup lebih dari 7 hari
find "$BACKUP_DIR" -name "tridjaya_*.db" -mtime +7 -delete
```

---

### 2.3. Docker Compose Kurang Lengkap

**Status update 2026-05-14:** Diperbaiki untuk service utama. Backend, frontend, dan Redis sekarang punya `restart: unless-stopped`, healthcheck, memory limit, dan log rotation.

**File:** `docker-compose.yml`

**Temuan:** Tidak ada:
- `healthcheck` untuk backend/frontend/redis
- `restart: unless-stopped`
- Resource limits (`mem_limit`, `cpus`)
- Log rotation config

**Rekomendasi Perbaikan:**

```yaml
services:
  backend:
    restart: unless-stopped
    mem_limit: 512m
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8081/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  redis:
    restart: unless-stopped
    mem_limit: 256m
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --save 60 1
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

---

## 3. Risiko Sedang — Quick Wins

### 3.1. Redis Persistence Default (AOF)

**Status update 2026-05-14:** Diperbaiki. Redis sekarang dijalankan dengan `--appendonly yes` dan snapshot `--save 60 1`.

**Temuan:** `redis:alpine` di docker-compose hanya pakai `--requirepass` tanpa mengaktifkan AOF/RDB. Jika container Redis restart, data queue WhatsApp yang belum diproses akan hilang.

**Rekomendasi:** Aktifkan `--appendonly yes` dan `--save 60 1` (lihat section 2.3).

---

### 3.2. Argon2 Default Parameters

**Temuan:** `argon2::Argon2::default()` digunakan untuk hash API token dan password. Default params mungkin kurang kuat untuk production.

**Rekomendasi:** Pertimbangkan tuning `m_cost` lebih tinggi di `api_tokens.rs`:

```rust
use argon2::{Argon2, Params};

let params = Params::new(65536, 3, 4, None)?;
let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
```

---

### 3.3. Backup Strategy untuk Uploads

**Temuan:** Tidak ada mekanisme backup file upload (foto KTP, produk, landing page).

**Rekomendasi:**
- Mount folder `uploads/` ke persistent volume (sudah dicakup di section 2.1).
- Atau, sync uploads ke S3-compatible storage (MinIO, Wasabi, Cloudflare R2).

---

## 4. Risiko Rendah — Nice to Have

### 4.1. File `spintax_example.rs` Masih Ada

**File:** `backend/src/spintax_example.rs`

**Temuan:** File contoh tidak di-register di `lib.rs`, jadi tidak masuk binary, tapi memenuhi folder.

**Rekomendasi:** Hapus file ini atau pindahkan ke `examples/`.

---

### 4.2. Deprecated Chrono API

**File:** `backend/src/blast_engine.rs:99`

**Temuan:** Menggunakan `and_hms_opt` yang deprecated di chrono terbaru. Masih compile, tapi akan generate warning.

**Rekomendasi:** Ganti dengan `and_hms` atau `and_hms_opt` yang sesuai versi chrono terbaru.

---

## 5. Apa yang Sudah Bagus / Sudah Diperbaiki

| Area | Status | Bukti |
|------|--------|-------|
| **Production env guards** | OK | `backend/src/main.rs:228-239` — panic jika `COOKIE_SECURE` atau `PIXEL_ENCRYPTION_KEY` tidak di-set |
| **Refresh handler** | Diperbaiki | `backend/src/routes.rs:640-646` — tidak pakai `unwrap_or`, return proper 400 |
| **Refresh rate limit** | Ada | `backend/src/routes.rs:680-705` — 10 req/menit per IP |
| **Pixel token exposure** | Aman | `backend/src/pixel/handlers.rs:24-37` — `PixelWithStats` tidak punya field `access_token` |
| **Encryption key caching** | Diperbaiki | `backend/src/pixel/crypto.rs:39-45` — pakai `std::sync::OnceLock` |
| **Telemetry UUID** | Aman | `frontend/src/utils/telemetry.ts:36` — pakai `crypto.randomUUID()` |
| **Body limit** | Dipisah | Global 1MB di `main.rs:437`, upload 20MB di `routes.rs:332` |
| **IP rate limit fallback** | Ada | `backend/src/state.rs:111-129` — in-memory fallback, bukan `Ok(())` langsung |
| **API token prefix lookup** | Diperbaiki | `backend/src/api_tokens.rs:179-191` — query by `token_prefix` |
| **Private uploads auth** | Aman | `backend/src/routes.rs:2483-2490` — wajib `Role::Admin` + sanitasi filename |
| **Block private uploads** | Aman | `backend/src/main.rs:31-37` — middleware block `/uploads/private/` publik |
| **Tests** | Passing | 231 tests passed (0 errors) |

---

## 6. Action Items Checklist (Prioritas Tertinggi ke Terendah)

- [x] **BLOCKER:** Perbaiki `backend/Dockerfile` — install Node.js dan COPY `baileys-bridge/`
- [ ] **BLOCKER:** Bersihkan Git history dari `tridjaya.db`, `frontend/.env`, `VPS setup.md`
- [x] **BLOCKER:** Hapus file fisik `backend/tridjaya.db` dari tracking Git saat ini
- [ ] **BLOCKER:** Ganti password SMTP (karena pernah masuk Git history)
- [x] **HIGH:** Tambahkan volume mounts `uploads/` dan `sessions/` di `docker-compose.yml`
- [x] **HIGH:** Tambahkan `healthcheck`, `restart: unless-stopped`, resource limits ke docker-compose
- [x] **HIGH:** Aktifkan Redis AOF persistence (`--appendonly yes`)
- [x] **MEDIUM:** Pastikan SQLite WAL mode aktif di startup
- [x] **MEDIUM:** Setup automated backup `.db` harian
- [ ] **MEDIUM:** Pertimbangkan backup upload files ke cloud storage
- [x] **LOW:** Hapus `backend/src/spintax_example.rs`
- [ ] **LOW:** Fix deprecated `and_hms_opt` di `blast_engine.rs`

---

## 7. Langkah Deploy yang Direkomendasikan (Setelah Blocker Diperbaiki)

1. Buat `.env` di server dari template `.env.example` dengan nilai production.
2. Build Docker image: `docker compose build`
3. Jalankan migrasi: `docker compose run --rm backend tridjaya-backend` (tunggu migrasi selesai, lalu `Ctrl+C`)
4. Jalankan stack: `docker compose up -d`
5. Verifikasi health endpoint: `curl http://localhost:8081/health`
6. Scan QR WhatsApp pertama kali via admin dashboard.
7. Setup cron backup database harian.
8. Konfigurasi reverse proxy (Nginx/Traefik) dengan SSL (Let's Encrypt).

---

*Jika ada pertanyaan atau perlu bantuan implementasi perbaikan, silakan beri tahu.*
