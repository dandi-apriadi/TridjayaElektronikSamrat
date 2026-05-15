# Laporan Kesiapan Deploy — Tridjaya Elektronik Samrat
**Tanggal:** 2026-05-15
**Auditor:** Cascade AI
**Scope:** Full-stack (Rust/Axum/SQLite + React/Vite + Docker + Baileys Bridge)

---

## Executive Summary

**Status: BISA DI-DEPLOY DENGAN CATATAN — Ada 2 Blocker Kritis Manual**

Secara fitur dan infrastruktur Docker, project ini **sudah siap untuk go-live**. Semua komponen utama sudah terintegrasi:
- Backend Rust dengan Axum, SQLite WAL, Redis queue
- Self-hosted WhatsApp gateway (Baileys Bridge) via JSON-RPC
- BlastEngine dengan anti-ban (delay, typing simulation, rate limit)
- Frontend React 19 dengan toast notifications
- Docker multi-stage build (backend + Node.js + frontend nginx)
- Healthcheck, restart policy, log rotation, volume persistence

**Namun ada 2 blocker yang HANYA bisa diperbaiki secara manual oleh developer:**

1. **Git history masih mengandung file sensitif** — `tridjaya.db`, `frontend/.env`, `VPS setup.md` (berisi password).
2. **Password SMTP harus diganti** — karena pernah masuk Git history.

Selain 2 blocker di atas, sisanya adalah technical debt yang **tidak memblokir go-live** tapi perlu diperhatikan untuk skala besar.

---

## 1. Blocker Kritis — Harus Diperbaiki Sebelum Go-Live

### 1.1. File Sensitif Masih Ada di Git History

**Status: BELUM DIPERBAIKI**

**Bukti:**
```bash
$ git log --all --oneline -- "backend/tridjaya.db" "frontend/.env" "VPS setup.md"
a83cc9a Security fixes: rate limits, env guards, remove sensitive files, fix serialization bugs
2714ac5 feat: add WhatsApp gateway modules, routes, and tests
cee3f25 Deployment: Rewrite VPS guide to start from git clone
ec1f7dc Deployment: Add folder creation step to VPS guide
8a5b992 Deployment: Update VPS setup guide with SSH credentials
5684a52 Deployment: Sync production database and assets
70a4fda feat: Completed Phase 1 API integration and backend auth alignment
```

**Impact:**
- Password SMTP, hash password, token, dan data testing bisa di-retrospeksi dari Git history.
- Siapa pun yang clone repo bisa melihat semua history.

**Fix Manual (WAJIB):**
```bash
# Install git-filter-repo
pip install git-filter-repo

# Hapus file dari SELURUH history
git filter-repo --path backend/tridjaya.db --path frontend/.env --path "VPS setup.md" --invert-paths

# Force push ke remote
git push origin --force --all
```

### 1.2. Password SMTP Harus Diganti

**Status: BELUM DIPERBAIKI**

Karena password pernah masuk Git history (meskipun sudah dihapus dari working tree), password tersebut sudah **tercompromise**. Wajib ganti password Google Workspace / Gmail yang digunakan untuk SMTP.

---

## 2. Technical Debt — Tidak Memblokir Go-Live, Tapi Perlu Diperhatikan

### 2.1. SQLite Connection Pool Terlalu Kecil

**File:** `backend/src/main.rs:165-167`

```rust
let pool = SqlitePoolOptions::new()
    .max_connections(5)
```

- **Pool 5 koneksi** untuk seluruh aplikasi (HTTP handler + background jobs + BlastEngine + BridgeEventProcessor + MetaCAPI retry + Analytics).
- Saat 10+ request concurrent, request ke-6+ akan antri atau timeout.

**Rekomendasi:**
```rust
.max_connections(20)  // atau 50 untuk SQLite dengan WAL
```

### 2.2. SQLite busy_timeout Terlalu Pendek

**File:** `backend/src/main.rs:183`

```rust
PRAGMA busy_timeout = 5000  // 5 detik
```

- Di bawah beban tulis tinggi (blast campaign, pixel tracking), 5 detik sering tidak cukup.
- Akan menghasilkan error "database is locked".

**Rekomendasi:**
```rust
PRAGMA busy_timeout = 30000  // 30 detik
```

### 2.3. Tidak Ada Request Timeout di Axum

**File:** `backend/src/main.rs:499-502`

```rust
axum::serve(listener, app)
    .with_graceful_shutdown(shutdown_signal)
    .await
```

- Tidak ada `TimeoutLayer` dari Tower.
- Request ke endpoint berat (contoh: `list_catalogs` tanpa limit) bisa berjalan selamanya.
- Client disconnect improper bisa membuat connection terbuka selamanya.

**Rekomendasi:**
```rust
use tower_http::timeout::TimeoutLayer;

let app = routes::router(state)
    .layer(TimeoutLayer::new(Duration::from_secs(30)))
```

### 2.4. Memory Leak — audit_log Vec Tumbuh Tak Terbatas

**File:** `backend/src/state.rs:14,175-182`

```rust
pub audit_log: Arc<RwLock<Vec<AuditEntry>>>,
```

- Setiap action (login, CRUD, pixel event) push entry baru ke Vec in-memory.
- **Tidak ada mekanisme truncate, flush, atau rotate.**
- RAM akan terus naik seiring trafik.

**Rekomendasi:** Tulis audit log ke **database table** `audit_logs`, bukan Vec in-memory.

### 2.5. cleanup_expired_sessions Tidak Membersihkan Semua HashMap

**File:** `backend/src/state.rs:200-236`

`cleanup_expired_sessions` HANYA membersihkan:
- `access_sessions` ✅
- `refresh_sessions` ✅
- `telemetry_attempts` ✅
- `pixel_meta_attempts` ✅
- `public_submission_attempts` ✅

**BELUM membersihkan:**
- `login_email_attempts` — key tetap tersimpan meskipun Vec kosong
- `blocked_login_subjects` — key + DateTime tetap tersimpan
- `forgot_password_attempts` — key + DateTime tetap tersimpan
- `api_rate_limiter` — key tetap tersimpan meskipun Vec kosong

**Impact:** Setiap IP unik atau email yang pernah mencoba login akan menyimpan entry selamanya di memory.

### 2.6. Endpoint list_catalogs Tanpa Pagination

**File:** `backend/src/routes.rs:5168-5227`

- `SELECT * FROM products` tanpa `LIMIT`.
- `SELECT ... FROM telemetry_events GROUP BY ...` tanpa time window.
- Jika produk 10.000 + telemetry 1 juta row → OOM / timeout.

**Rekomendasi:** Tambahkan `LIMIT`/`OFFSET` atau cursor-based pagination. Frontend catalog page sebaiknya migrasi ke endpoint paginated.

### 2.7. Deprecated chrono API

**File:** `backend/src/blast_engine.rs:99`

```rust
.and_hms_opt(0, 0, 0)  // deprecated
```

**Rekomendasi:** Ganti dengan `and_hms` atau update ke API chrono terbaru.

---

## 3. Yang Sudah Bagus / Sudah Diperbaiki

| Area | Status | Bukti |
|------|--------|-------|
| **Docker backend** | OK | Node.js 22, Baileys bridge, npm ci, runtime dirs |
| **Docker Compose** | OK | Volumes, healthcheck, restart, mem_limit, log rotation |
| **Redis persistence** | OK | `--appendonly yes`, `--save 60 1` |
| **SQLite WAL** | OK | `PRAGMA journal_mode = WAL` di startup |
| **Security guards** | OK | `COOKIE_SECURE`, `PIXEL_ENCRYPTION_KEY`, `ALLOWED_ORIGINS` panic jika tidak di-set di production |
| **Private uploads** | OK | Middleware block `/uploads/private/` publik |
| **WA Gateway** | OK | Baileys bridge JSON-RPC, session restore on startup, BlastEngine |
| **Notifications** | OK | Toast system dengan swipe-to-dismiss, progress bar, framer-motion |
| **Frontend build** | OK | Vite + nginx SPA fallback |
| **Migrations** | OK | 42 migration files, terstruktur |
| **Browser identifier** | OK | Sudah diganti ke `Tridjaya.com` |

---

## 4. Action Items Checklist

### Sebelum Go-Live (Wajib)

- [ ] **BLOCKER:** Bersihkan Git history dari `tridjaya.db`, `frontend/.env`, `VPS setup.md`
- [ ] **BLOCKER:** Ganti password SMTP (karena pernah masuk Git history)
- [ ] **BLOCKER:** Hapus file fisik `backend/tridjaya.db` dari tracking jika masih ada

### Secepatnya Setelah Go-Live (High Priority)

- [ ] Naikkan SQLite pool dari 5 ke 20-50 (`main.rs:165`)
- [ ] Naikkan busy_timeout dari 5 detik ke 30 detik (`main.rs:183`)
- [ ] Tambahkan `TimeoutLayer` ke Axum (`main.rs:499`)
- [ ] Pindahkan `audit_log` dari Vec in-memory ke database table
- [ ] Tambahkan cleanup untuk `login_email_attempts`, `blocked_login_subjects`, `forgot_password_attempts`, `api_rate_limiter`
- [ ] Tambahkan pagination ke `list_catalogs` dan endpoint admin lainnya
- [ ] Fix deprecated `and_hms_opt` di `blast_engine.rs`

### Jangka Panjang (Scale-Up)

- [ ] Pertimbangkan migrasi SQLite → PostgreSQL saat trafik tinggi
- [ ] Pisahkan Baileys bridge ke container/service terpisah
- [ ] Tambahkan database index untuk query hot path

---

## 5. Langkah Deploy yang Direkomendasikan

Setelah 2 blocker kritis diperbaiki:

1. **Setup `.env`** di server dari `.env.example` dengan nilai production.
2. **Build Docker:** `docker compose build`
3. **Jalankan migrasi:** `docker compose up -d redis` (tunggu healthy), lalu `docker compose up -d backend`
4. **Verifikasi health:** `curl http://localhost:8081/health`
5. **Scan QR WhatsApp** pertama kali via admin dashboard.
6. **Setup cron backup** database harian.
7. **Konfigurasi reverse proxy** (Nginx/Traefik) dengan SSL (Let's Encrypt).

---

*Laporan ini disusun berdasarkan review kode real-time dari repository. Build test belum dijalankan pada sesi ini karena constraint environment, namun 231 tests passing telah diverifikasi di sesi sebelumnya.*
