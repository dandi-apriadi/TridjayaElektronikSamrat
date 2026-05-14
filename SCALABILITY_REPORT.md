# Laporan Analisis Scalability & High-Traffic Resilience

**Project:** Tridjaya Elektronik Samrat  
**Tanggal Audit:** 2026-05-14  
**Fokus:** Kemampuan arsitektur menangani trafik data besar secara bersamaan tanpa down.

---

## Executive Summary

**Status: BELUM SIAP UNTUK HIGH TRAFFIC — Perlu Mitigasi Sebelum Go-Live Massal**

Arsitektur saat ini **cukup untuk trafik ringan-sedang** (ratusan concurrent user, puluhan ribu event/hari), tapi memiliki **7 bottleneck kritis** yang akan menyebabkan:

- **Database contention** (SQLite single-writer + pool 5 connection)
- **Out-of-Memory (OOM)** saat data bertambah besar
- **Connection hang / resource exhaustion** (tidak ada timeout)
- **Memory leak perlahan** dari struktur data in-memory yang tak terbatas
- **Queue serialization** yang memperlambat throughput WhatsApp blast

**Rekomendasi strategis jangka panjang:** Migrasi database dari SQLite ke PostgreSQL begitu trafik melewati ambang tertentu (lihat Section 7).

---

## 1. Blocker Kritis — Akan Menyebabkan Down / OOM / Hang

### 1.1. SQLite Connection Pool Terlalu Kecil (5 Connection)

**File:** `backend/src/main.rs:165-167`

```rust
let pool = SqlitePoolOptions::new()
    .max_connections(5)
    .connect(&database_url)
```

**Temuan:**
- Pool hanya **5 koneksi** untuk **seluruh aplikasi** (HTTP handler + background jobs + BlastEngine + BridgeEventProcessor + MetaCAPI retry + Analytics + Cleanup).
- SQLite memang single-file, tapi sqlx SQLite pool menggunakan multiple connections dengan shared cache.
- Dengan 5 connection, concurrent requests akan **antri panjang** atau mendapat `PoolTimeout`.

**Impact:**
- Saat ada 10+ request concurrent, request ke-6+ akan **menunggu** sampai koneksi bebas.
- Background jobs (analytics, retry, blast) ikut memakan slot pool, memperparah contention.

**Perbaikan:**
```rust
let pool = SqlitePoolOptions::new()
    .max_connections(20)  // atau lebih: 50-100 untuk SQLite dengan WAL
    .connect(&database_url)
```

---

### 1.2. SQLite Single-Writer Bottleneck

**File:** `backend/src/main.rs:175-185`

WAL mode sudah aktif (`PRAGMA journal_mode = WAL`), busy timeout 5 detik. Namun:

**Temuan:**
- SQLite tetap **single-writer**. Hanya 1 transaksi write yang bisa berjalan pada satu waktu.
- Di bawah beban tulis tinggi (contoh: blast campaign update status ribuan recipient, pixel event tracking masif, agent registration masuk bersamaan), write akan **serialized**.
- WAL mode membaca bisa paralel, tapi tulis tetap serial.

**Impact:**
- Saat blast campaign 100.000 recipient aktif, SQLite akan dibanjiri UPDATE per recipient (`status = 'sent'`). Request HTTP lain yang butuh write akan **timeout atau antri lama**.

**Perbaikan Jangka Pendek:**
- Batch UPDATE status recipient (jangan satu per satu).
- Gunakan `INSERT OR REPLACE` bulk untuk pixel events.
- Naikkan `busy_timeout` dari 5 detik ke 30 detik.

**Perbaikan Jangka Panjang:** Migrasi ke PostgreSQL (Section 7).

---

### 1.3. Endpoint `list_catalogs` Memuat SELURUH Database ke Memory

**File:** `backend/src/routes.rs:5168-5227`

```rust
async fn list_catalogs(State(state): State<AppState>) -> Result<ResponseBody, AppError> {
    let products = sqlx::query_as::<_, ProductRecord>(
        "SELECT ... ALL_COLUMNS ... FROM products"
    ).fetch_all(&state.pool).await?;

    let analytics_rows = sqlx::query(
        "SELECT ... FROM telemetry_events ... GROUP BY ..."
    ).fetch_all(&state.pool).await?;
    // ... load semua ke HashMap + Vec
}
```

**Temuan:**
- `SELECT * FROM products` tanpa `LIMIT` atau pagination.
- `SELECT ... FROM telemetry_events GROUP BY ...` tanpa time window — mengagregasi **SELURUH sejarah telemetry**.
- Jika produk 10.000 item + telemetry 1 juta row, ini akan:
  - Memakan **seluruh pool connection** selama query berjalan.
  - Mengalokasikan **ratusan MB RAM** untuk Vec + HashMap.
  - Response JSON bisa mencapai **puluhan MB**.

**Impact:** OOM killer, response timeout, server hang.

**Perbaikan:**
1. Hapus `list_catalogs` untuk public, gantikan dengan `list_catalogs_paginated` (sudah ada, frontend harus migrasi).
2. `telemetry_events` query wajib punya `WHERE created_at > ?` time window (default 30 hari).
3. Frontend catalog page harus pindah ke endpoint paginated.

---

### 1.4. Banyak Endpoint Admin Load SEMUA Row Tanpa Pagination

**File:** `backend/src/routes.rs`

| Endpoint | Handler | Masalah |
|----------|---------|---------|
| `GET /api/users` | `list_users` | `fetch_all` dari `users` tanpa LIMIT |
| `GET /api/admin/agent-registrations` | `list_agent_registrations` | `fetch_all` tanpa LIMIT |
| `GET /api/agent/support-tickets` | `list_support_tickets` | `fetch_all` per agent tanpa LIMIT |
| `GET /api/partners` | `list_partners` | `fetch_all` tanpa LIMIT |
| `GET /api/leaderboard` | `list_leaderboard` | `fetch_all` dari view/agents, tapi ada cache |

**Impact:** Seiring data bertambah, response size membesar linearly. Admin dashboard akan semakin lambat dan akhirnya timeout/OOM.

**Perbaikan:** Tambahkan `LIMIT`/`OFFSET` (atau cursor-based pagination) ke semua endpoint di atas. Frontend table komponen sudah support pagination — backend endpoint saja yang belum.

---

### 1.5. Axum Server Tanpa Request / Connection Timeout

**File:** `backend/src/main.rs:467-493`

```rust
let listener = tokio::net::TcpListener::bind(addr).await?;
axum::serve(listener, app)
    .with_graceful_shutdown(shutdown_signal)
    .await
    .expect("server error");
```

**Temuan:**
- Tidak ada `timeout` layer dari Tower.
- Tidak ada `Keep-Alive` timeout config.
- Tidak ada max request body timeout.

**Impact:**
- Client yang disconnect tengah jalan (tapi TCP tidak close proper) akan membuat connection **terbuka selamanya**.
- Request ke endpoint berat (seperti `list_catalogs` tanpa limit) bisa **berjalan selamanya**, memegang koneksi pool SQLite.
- DDoS slowloris attack bisa mengikat resource.

**Perbaikan:**
```rust
use tower_http::timeout::TimeoutLayer;
use std::time::Duration;

let app = routes::router(state.clone())
    .layer(TimeoutLayer::new(Duration::from_secs(30)))
    // ... layer lainnya
```

---

### 1.6. Memory Leak — `audit_log` Vec Tumbuh Tak Terbatas

**File:** `backend/src/state.rs:14,57,175-182`

```rust
pub audit_log: Arc<RwLock<Vec<AuditEntry>>>,
// ...
pub async fn audit(&self, action: impl Into<String>, actor: Option<&str>) {
    self.audit_log.write().await.push(AuditEntry { ... });
}
```

**Temuan:**
- `audit_log` adalah `Vec<AuditEntry>` di memory.
- Setiap action (login, CRUD, pixel event) mem-push entry baru.
- **Tidak ada mekanisme truncate, flush, atau rotate**.

**Impact:** RAM akan terus naik seiring trafik. Setelah berjalan berhari-hari dengan trafik tinggi, proses bisa memakan GB RAM dan di-kill oleh OOM killer.

**Perbaikan:**
1. Tulis audit log ke **file** atau **database table** (`audit_logs`), bukan Vec in-memory.
2. Atau gunakan bounded channel / ring buffer (sama seperti `spsc_queue` dengan max 10.000 entri).

---

### 1.7. Rate Limiter HashMap Tidak Dibersihkan — Memory Leak

**File:** `backend/src/state.rs:15-21,53-76,200-236`

HashMap berikut **tidak pernah dibersihkan** oleh `cleanup_expired_sessions`:

- `login_email_attempts` — key = email, value = Vec<DateTime>
- `blocked_login_subjects` — key = email/ip, value = DateTime
- `forgot_password_attempts` — key = email/ip, value = DateTime
- `api_rate_limiter` — key = token_id, value = Vec<DateTime>

`cleanup_expired_sessions` HANYA membersihkan:
- `access_sessions` ✅
- `refresh_sessions` ✅
- `telemetry_attempts` ✅
- `pixel_meta_attempts` ✅
- `public_submission_attempts` ✅

**Impact:** Untuk setiap IP unik atau email yang mencoba login, HashMap akan menyimpan entry selamanya (meskipun expired, entry tetap ada, hanya Vec di dalamnya yang mungkin kosong — tapi key tetap tersimpan).

**Perbaikan:** Tambahkan `retain` cleanup untuk HashMap yang belum ter-cover:

```rust
// Di cleanup_expired_sessions:
{
    let mut login_email = self.login_email_attempts.write().await;
    login_email.retain(|_, attempts| {
        attempts.retain(|ts| now.signed_duration_since(*ts).num_minutes() < 30);
        !attempts.is_empty()
    });
}
// ... dan seterusnya untuk blocked_login_subjects, forgot_password_attempts, api_rate_limiter
```

---

## 2. Risiko Tinggi — Akan Menyebabkan Degradasi Performa

### 2.1. QueueManager Menggunakan Single Mutex — Serialisasi Operasi Queue

**File:** `backend/src/queue_manager.rs:82-94`

```rust
pub struct QueueManager {
    redis: Arc<Mutex<RedisManager>>,
    pool: SqlitePool,
}
```

**Temuan:**
- Semua operasi enqueue/dequeue/metrics memerlukan `self.redis.lock().await`.
- Saat BlastEngine 10 worker + API endpoint + recovery job + metrics fetch semua akses queue bersamaan, mereka akan **serial**, bukan paralel.
- Satu worker yang lambat (misal karena network ke Redis) akan **memblokir semua worker lain**.

**Impact:** Throughput blast message terbatas oleh lock contention, bukan oleh Redis performance.

**Perbaikan:**
- Ganti `Mutex<RedisManager>` dengan **pool of Redis connections** (multiple `ConnectionManager` atau `bb8-redis` / `deadpool-redis`).
- Atau minimal, gunakan `tokio::sync::RwLock` agar read-only ops (metrics, depth) bisa paralel.

---

### 2.2. Campaign Enqueue Memuat SEMUA Pending Recipient ke Memory

**File:** `backend/src/queue_manager.rs:138-148`

```rust
let recipients: Vec<RecipientRecord> = sqlx::query_as(
    "SELECT ... FROM wa_recipients WHERE campaign_id = ? AND status = 'pending' ORDER BY created_at ASC"
)
.bind(campaign_id)
.fetch_all(&self.pool).await?;
```

**Temuan:**
- Jika campaign punya **100.000 penerima pending**, semua 100.000 row di-load ke Vec.
- Kemudian di-loop satu per satu untuk enqueue ke Redis.

**Impact:**
- Spike memori besar saat start campaign.
- Query memegang koneksi SQLite lama (karena row banyak).

**Perbaikan:** Stream/batch fetch dari SQLite:

```rust
// Gunakan fetch_many atau paginate dengan LIMIT 1000
let mut stream = sqlx::query_as(...).fetch(&self.pool);
while let Some(recipient) = stream.try_next().await? {
    // enqueue satu per satu atau batch
}
```

---

### 2.3. File Upload Multipart Tidak Di-stream — Full Memory Buffer

**File:** `backend/src/routes.rs:2431-2480`, `2990-3060`, `6648-6780`

**Temuan:**
- `multipart.next_field().await` kemudian `field.bytes().await` — memuat seluruh file ke memory (`Vec<u8>` atau `Bytes`).
- Upload limit 20MB. Jika 10 user upload bersamaan = **200MB+ RAM** hanya untuk buffer.
- Lebih parah: `decode_uploaded_image(&data)?` membuat buffer tambahan untuk decoded image.

**Impact:** Memory spike saat banyak upload concurrent. Risiko OOM.

**Perbaikan:**
- Stream field ke disk secara langsung tanpa buffering penuh di memory:
  ```rust
  let mut file = tokio::fs::File::create(&temp_path).await?;
  while let Some(chunk) = field.chunk().await? {
      file.write_all(&chunk).await?;
  }
  ```
- Proses image decoding dari file di disk, bukan dari memory buffer.

---

### 2.4. CacheManager `activity` HashMap Tidak Dibersihkan

**File:** `backend/src/cache.rs:12,78-83`

```rust
activity: Arc<RwLock<HashMap<String, (DateTime<Utc>, u32)>>>,
```

`record_activity` menambah key tanpa batas. `start_adaptive_sync` membaca tapi **tidak pernah menghapus** key lama.

**Impact:** Setiap cache key yang pernah diakses akan tetap ada di memory selamanya.

**Perbaikan:** Tambahkan cleanup di `start_adaptive_sync`:

```rust
activity.retain(|_, (last_access, _)| {
    now.signed_duration_since(*last_access).num_hours() < 24
});
```

---

### 2.5. Docker Memory Limit Mungkin Terlalu Ketat

**File:** `docker-compose.yml` (belum diperiksa ulang setelah update user)

Asumsi dari memory sebelumnya: backend service punya memory limit (misal 512MB atau 1GB).

**Temuan:**
- Rust backend + Baileys bridge (Node.js child process) + SQLite operations + image decoding + Vec besar = memori tinggi.
- Jika limit terlalu rendah, OOM killer Docker akan restart container.

**Perbaikan:**
- Monitor peak memory dengan `docker stats`.
- Set `memory: 2g` atau lebih untuk backend jika trafik tinggi.
- Atau pisahkan Baileys bridge ke container terpisah (microservice) untuk isolasi resource.

---

## 3. Risiko Sedang — Menghambat Scale

### 3.1. No Database Indexing Strategy untuk Query Berat

**Query berikut akan semakin lambat seiring data besar:**

1. `list_catalogs` analytics: `GROUP BY json_extract(metadata, '$.productSlug')` pada `telemetry_events` — **full table scan + JSON parsing**.
2. `wa_recipients WHERE campaign_id = ? AND status = 'pending'` — butuh composite index `(campaign_id, status)`.
3. `wa_message_queue WHERE status = 'queued'` — butuh index pada `status`.
4. `agent_registrations ORDER BY submitted_at DESC` — butuh index `submitted_at`.

**Rekomendasi:** Review semua `WHERE`, `ORDER BY`, `JOIN` clause dan tambahkan index yang sesuai. Contoh migration:

```sql
CREATE INDEX idx_wa_recipients_campaign_status ON wa_recipients(campaign_id, status);
CREATE INDEX idx_wa_message_queue_status ON wa_message_queue(status);
CREATE INDEX idx_agent_registrations_submitted_at ON agent_registrations(submitted_at DESC);
CREATE INDEX idx_telemetry_events_created_at ON telemetry_events(created_at);
```

### 3.2. BlastEngine Config Terlalu Konservatif untuk Volume Besar

**File:** `backend/src/blast_engine.rs:53-66`

```rust
worker_count: 10,
batch_size: 5,
rate_limit_per_minute: 20,
daily_limit: 1000,
```

**Temuan:**
- 10 worker × 20 msg/min = **max 200 msg/min** system-wide per account.
- Dengan 10 account = 2.000 msg/min.
- Untuk campaign 100.000 penerima = **~50 menit** minimum (belum termasuk delay antar pesan).

**Ini bukan bug** — ini anti-ban design yang benar. Tapi perlu disadari throughput ceiling-nya.

**Rekomendasi:**
- Expose config via environment variable agar bisa dituning tanpa rebuild.
- Monitor queue depth dan adjust worker count dinamis (auto-scale) jika queue > threshold.

---

## 4. Risiko Rendah — Nice to Have

### 4.1. No Horizontal Scaling Path

- SQLite single-file = tidak bisa scale horizontally (read replicas tidak tersedia).
- Solusi: migrasi ke PostgreSQL dengan read replicas, atau gunakan LiteFS (Fly.io) untuk SQLite replication.

### 4.2. No Circuit Breaker untuk External Webhooks

- `WebhookForwarder` mengirim HTTP ke URL eksternal. Jika target down, retry akan menumpuk.
- Sudah ada retry config dan timeout, tapi tidak ada circuit breaker (stop mencoba setelah N failure berturut-turut).

---

## 5. Ringkasan Action Items

### Blocker Kritis (Harus Sebelum High-Traffic Go-Live)

| # | Task | File Target | Estimasi Effort |
|---|------|-------------|-----------------|
| 1 | **Naikkan SQLite pool** dari 5 ke 20-50 | `main.rs:165` | 5 menit |
| 2 | **Tambah request timeout** 30 detik ke Axum | `main.rs:459` | 15 menit |
| 3 | **Fix `list_catalogs`** — tambah time window WHERE 30 hari untuk telemetry | `routes.rs:5179` | 30 menit |
| 4 | **Deprecate `list_catalogs`** non-paginated, migrasi frontend ke `list_catalogs_paginated` | `routes.rs` + frontend | 2 jam |
| 5 | **Tambah pagination** ke `list_users`, `list_agent_registrations`, `list_support_tickets`, `list_partners` | `routes.rs` | 2-3 jam |
| 6 | **Pindahkan audit_log** dari Vec in-memory ke database table `audit_logs` | `state.rs` + migrations | 3 jam |
| 7 | **Tambah cleanup** untuk `login_email_attempts`, `blocked_login_subjects`, `forgot_password_attempts`, `api_rate_limiter` | `state.rs:200-236` | 1 jam |
| 8 | **Stream multipart upload** ke disk, hindari full-memory buffer | `routes.rs` upload handlers | 3 jam |

### Risiko Tinggi (Sebaiknya Segera)

| # | Task | File Target | Estimasi Effort |
|---|------|-------------|-----------------|
| 9 | **Ganti QueueManager Mutex** dengan pool koneksi Redis atau RwLock | `queue_manager.rs:82` | 2 jam |
| 10 | **Batch/stream enqueue campaign** — jangan load semua recipient sekaligus | `queue_manager.rs:138` | 1 jam |
| 11 | **Tambah cleanup** `activity` HashMap di `CacheManager` | `cache.rs:92` | 30 menit |
| 12 | **Tambah index database** untuk query hot path | migrations SQL | 1 jam |
| 13 | **Naikkan busy_timeout** SQLite ke 30 detik | `main.rs:183` | 2 menit |
| 14 | **Tambah batch UPDATE** untuk recipient status di BlastEngine | `blast_engine.rs` | 2 jam |

### Jangka Panjang (Roadmap Scale-Up)

| # | Task | Trigger |
|---|------|---------|
| 15 | **Migrasi SQLite → PostgreSQL** | Saat trafik > 1000 concurrent user atau write throughput > 500 TPS |
| 16 | **Pisahkan Baileys bridge** ke container/service terpisah | Isolasi memory/CPU, scale bridge independently |
| 17 | **Tambah read replica / caching layer** untuk analytics | Saat telemetry_events > 10 juta row |
| 18 | **Circuit breaker untuk webhook forwarder** | Saat integrasi N8N/webhook eksternal bertambah |

---

## 6. Skenario Load Test yang Disarankan

Sebelum production high-traffic, jalankan test berikut:

1. **Catalog Load Test:** 100 concurrent user akses `/api/catalogs` — monitor memory dan response time. Jika > 5 detik atau memory naik > 200MB, fix pagination.
2. **Login Flood:** 1000 login attempt dari IP berbeda — monitor `login_ip_attempts` memory growth.
3. **Blast Campaign:** Campaign dengan 50.000 recipient — monitor queue enqueue time, SQLite UPDATE latency, Redis memory.
4. **Upload Stress:** 20 concurrent upload file 20MB — monitor RAM usage.
5. **Long-running Query:** Biarkan server berjalan 7 hari dengan trafik simulasi — monitor RSS memory (cek apakah naik terus karena leak).

---

## 7. Decision Matrix: SQLite vs PostgreSQL

| Kriteria | SQLite (Saat Ini) | PostgreSQL |
|----------|-------------------|------------|
| Concurrent Writes | **Single-writer, akan bottleneck** | Multi-writer, MVCC |
| Connection Pool | Shared file, WAL helps reads | Native connection pool, no limit praktis |
| Horizontal Scale | **Tidak bisa** (single file) | Read replicas, sharding |
| JSON Analytics | **Slow (json_extract full scan)** | JSONB index, GIN index |
| Backup | File copy sederhana | WAL archiving, PITR |
| Operational Cost | Rendah | Sedang (butuh managed DB atau self-host) |

**Rekomendasi:**
- **Sekarang - 6 bulan:** SQLite cukup dengan mitigasi di atas (pool besar, batch write, index, pagination).
- **6-12 bulan / Trafik tinggi:** Plan migrasi ke PostgreSQL. SQLx sudah support PostgreSQL, migrasi relatif mudah.
- **Langsung migrasi sekarang** jika proyek ini diprediksi akan melewati 500+ concurrent user dalam 3 bulan pertama.

---

*Laporan ini disusun berdasarkan review kode backend (`main.rs`, `routes.rs`, `state.rs`, `blast_engine.rs`, `queue_manager.rs`, `cache.rs`, `bridge/mod.rs`, `cleanup.rs`) dan Docker Compose configuration.*
