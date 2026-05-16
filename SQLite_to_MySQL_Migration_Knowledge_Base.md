# SQLite → MySQL Migration Knowledge Base

## Ringkasan Arsitektur Database Saat Ini

| Komponen | Lokasi | Keterangan |
|----------|--------|------------|
| Driver ORM | `sqlx 0.8` | **Runtime query only** (`sqlx::query`/`query_as`), **NO `query!` macro** |
| Pool Type | `SqlitePool` | 33 file Rust + **16 binary** + **7 test files** |
| Migrations | `backend/migrations/` | 40 file `.sql` di 24 file berbeda → ~35 tabel total |
| Connection | `backend/src/main.rs:164-232` | `SqliteConnectOptions`, WAL, busy_timeout, PRAGMA diagnostics |
| App State | `backend/src/state.rs:13` | `pub pool: SqlitePool` + 2 query DELETE langsung |
| Seed Data | `backend/src/seed.rs` | `SqlitePool` parameter + 4× `ON CONFLICT` |
| Transaction | `routes.rs`, `landing_routes.rs`, `blast_engine.rs` | 11 transaksi total via `pool.begin()`/`pool.acquire()` |
| Deployment | `deploy.sh` + systemd docs | Runtime native; perlu service MySQL dan Redis |

---

## 1. File Konfigurasi yang HARUS Diubah

### 1.1 Cargo.toml
```toml
# SEBELUM
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "macros", "chrono", "uuid"] }

# SESUDAH — tambahkan feature mysql, HAPUS sqlite (atau biarkan dual saat transisi)
sqlx = { version = "0.8", features = ["runtime-tokio", "mysql", "macros", "chrono", "uuid"] }
```
**Lokasi:** `backend/Cargo.toml:109`

### 1.2 .env (tidak terbaca karena gitignore, butuh update manual)
```bash
# SEBELUM
DATABASE_URL=sqlite:./tridjaya.db
SQLITE_MAX_CONNECTIONS=20
SQLITE_BUSY_TIMEOUT_SECS=30

# SESUDAH
DATABASE_URL=mysql://user:pass@localhost:3306/tridjaya
MYSQL_MAX_CONNECTIONS=50
# busy_timeout tidak relevan untuk MySQL
```

### 1.3 Native Deployment
**Lokasi:** `deploy.sh`, `TERMINAL_INSTRUCTIONS.md`, `docs/deployment.md`, `setupVPS.md`

| Area | Target Native |
|------|---------------|
| Backend | systemd service `tridjaya-backend` menjalankan binary release |
| Frontend | systemd service `tridjaya-frontend` menjalankan preview/static server lokal |
| Database | MySQL 8.0+ lokal atau managed DB via `DATABASE_URL=mysql://...` |
| Queue/cache | Redis lokal atau managed Redis |
| Proxy | Nginx reverse proxy ke `127.0.0.1:8081` dan `127.0.0.1:5173` |

---

## 1.5 sqlx Offline Metadata (CRITICAL FINDING)
**Temuan:** Project ini **TIDAK menggunakan `sqlx::query!` macro**. Semua query menggunakan runtime `sqlx::query()` / `sqlx::query_as()`.

**Impact:**
- ✅ **Tidak perlu folder `.sqlx/`** (offline query metadata)
- ✅ **Tidak perlu `SQLX_OFFLINE=true`** saat build
- ✅ **Build bisa dilakukan tanpa live database connection**
- Ini sangat memudahkan migrasi karena hanya perlu runtime DB connection saat aplikasi berjalan, bukan saat compile.

**Verifikasi:** `grep -r 'sqlx::query!' backend/src/` → 0 matches

---

## 2. File Rust — Tipe Database & Connection

### 2.1 Main Connection Pool (`main.rs`)
**Lokasi:** `backend/src/main.rs:1-232`

| Baris | Kode Saat Ini | Target MySQL |
|-------|--------------|--------------|
| 7 | `use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};` | `use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions};` |
| 164-165 | `let database_url = std::env::var("DATABASE_URL")...` | Sama, URL format berubah |
| 168-177 | `SQLITE_MAX_CONNECTIONS`, `SQLITE_BUSY_TIMEOUT_SECS` | `MYSQL_MAX_CONNECTIONS`, hapus busy_timeout |
| 179-188 | `SqliteConnectOptions::from_str(...).journal_mode(Wal).synchronous(Normal).busy_timeout(...).create_if_missing(true)` | `MySqlConnectOptions::from_str(&database_url)` — hapus WAL, synchronous, busy_timeout, create_if_missing |
| 190-200 | `SqlitePoolOptions::new().max_connections(...).min_connections(1).acquire_timeout(...).connect_with(sqlite_options)` | `MySqlPoolOptions::new()...connect_with(mysql_options)` |
| 202-216 | `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = ...` | **HAPUS seluruh block** — tidak ada di MySQL |
| 220-227 | `sqlx::migrate!("./migrations").run(&pool)` | Sama, tapi migration SQL harus kompatibel MySQL |
| 235-257 | `PRAGMA table_info(agent_registrations)` | **HAPUS** atau ganti jadi `SHOW COLUMNS FROM agent_registrations` |
| 259-274 | `PRAGMA table_info(products)` | **HAPUS** atau ganti seperti di atas |

**Catatan PRAGMA:** Block diagnostic `PRAGMA table_info(...)` di `main.rs:235-274` bersifat opsional (hanya logging). Bisa dihapus seluruhnya atau diganti dengan query `SHOW COLUMNS`.

### 2.2 AppState (`state.rs`)
**Lokasi:** `backend/src/state.rs:1-78`

| Baris | Kode Saat Ini | Target MySQL |
|-------|--------------|--------------|
| 4 | `use sqlx::SqlitePool;` | `use sqlx::MySqlPool;` |
| 13 | `pub pool: SqlitePool,` | `pub pool: MySqlPool,` |
| 47 | `pub fn new(pool: SqlitePool, ...)` | `pub fn new(pool: MySqlPool, ...)` |

**Impact:** Semua handler yang menerima `&State<AppState>` atau `State<AppState>` otomatis mengakses `MySqlPool`.

### 2.3 Seed Database (`seed.rs`)
**Lokasi:** `backend/src/seed.rs:1-514`

| Baris | Kode Saat Ini | Target MySQL |
|-------|--------------|--------------|
| 3 | `use sqlx::SqlitePool;` | `use sqlx::MySqlPool;` |
| 47 | `async fn seed_landing_content(pool: &SqlitePool)` | `async fn seed_landing_content(pool: &MySqlPool)` |
| 48 | `let mut conn = pool.acquire().await?;` | Sama (`acquire()` otomatis mengikuti tipe pool) |
| 384 | `pub async fn seed_database(pool: &SqlitePool)` | `pub async fn seed_database(pool: &MySqlPool)` |
| 176 | `ON CONFLICT(id) DO UPDATE SET ... updated_at = CURRENT_TIMESTAMP` | `ON DUPLICATE KEY UPDATE ... updated_at = CURRENT_TIMESTAMP` |
| 265 | `ON CONFLICT(id) DO UPDATE SET ...` | `ON DUPLICATE KEY UPDATE ...` |
| 298 | `ON CONFLICT(id) DO UPDATE SET ...` | `ON DUPLICATE KEY UPDATE ...` |
| 362 | `ON CONFLICT(id) DO UPDATE SET ...` | `ON DUPLICATE KEY UPDATE ...` |

---

## 2.4 AppState Direct Queries (`state.rs`)
**Lokasi:** `backend/src/state.rs:201-221`

AppState memiliki 2 query langsung ke DB:

| Baris | Kode Saat Ini | Target MySQL |
|-------|--------------|--------------|
| 201 | `DELETE FROM refresh_sessions WHERE user_id = ?` | Sama (placeholder `?` compatible MySQL) |
| 218 | `DELETE FROM refresh_sessions WHERE expires_at < ?` | Sama; binding `now.to_rfc3339()` → MySQL `DATETIME` auto-parse ISO 8601 |

**Catatan:** `#[sqlx::FromRow]` structs (`UserPublic`, `UserRecord`) di `state.rs:275-321` **tidak perlu diubah** — kompatibel otomatis dengan MySQL karena sqlx menangani mapping tipe.

---

## 3. File Rust — Handler & Business Logic (35+ file)

Semua file berikut mengandung `sqlx::query`/`sqlx::query_as` dengan placeholder `?` (**sudah compatible MySQL**) dan `ON CONFLICT` (harus diubah):

### High-Touch Files (>40 query calls)
- `backend/src/routes.rs` — 258 matches (products, users, orders, categories)
- `backend/src/blast_engine.rs` — 55 matches (WA blast logic)
- `backend/src/bridge_event_processor.rs` — 43 matches (WA bridge events)
- `backend/src/pixel/campaign_handlers.rs` — 30 matches (pixel tracking)
- `backend/src/pixel/handlers.rs` — 23 matches
- `backend/src/wa_gateway/handlers/dashboard.rs` — 23 matches
- `backend/src/queue_manager.rs` — 22 matches
- `backend/src/api_tokens.rs` — 19 matches
- `backend/src/chatbot_routes.rs` — 18 matches
- `backend/src/session_manager.rs` — 16 matches

### Medium-Touch Files (10-40 query calls)
- `backend/src/wa_gateway/handlers/messages.rs`
- `backend/src/campaign_metrics.rs`
- `backend/src/main.rs`
- `backend/src/pixel/analytics_handlers.rs`
- `backend/src/pixel/meta_capi.rs`
- `backend/src/wa_gateway/handlers/sessions.rs`
- `backend/src/seed.rs`
- `backend/src/wa_webhook_handlers.rs`
- `backend/src/tests/api_routes_test.rs`
- `backend/src/tests/campaign_metrics_test.rs`
- `backend/src/chatbot_engine.rs`
- `backend/src/landing_routes.rs`
- `backend/src/auth.rs`
- `backend/src/wa_gateway/handlers/templates.rs`
- `backend/src/wa_status_tracker.rs`
- `backend/src/pixel/models.rs`
- `backend/src/wa_gateway/handlers/contacts.rs`
- `backend/src/bin/*.rs` (15 util binaries)

### Low-Touch Files (<10 query calls)
- `backend/src/api_routes.rs`, `cleanup.rs`, `mail.rs`, `wa_gateway/handlers/dashboard.rs`, `bomber.rs`, `pixel/event_handlers.rs`, `cache.rs`, `media_handler.rs`, `webhook_forwarder.rs`, `pixel/analytics_job.rs`, `bridge/mod.rs`, `redis_manager.rs`, `pixel/crypto.rs`, `response.rs`, `validation.rs`

### Modules with NO DB Interaction (Safe, No Change Needed)
- `backend/src/bridge/mod.rs` — JSON-RPC client untuk Baileys Node.js, tidak ada query DB
- `backend/src/mail.rs` — SMTP email sender, tidak ada DB
- `backend/src/response.rs` — HTTP response helpers, tidak ada DB
- `backend/src/validation.rs` — Input validation logic, tidak ada DB
- `backend/src/spintax.rs` — String templating, tidak ada DB

---

## 4. Sintaks SQL yang Harus Dimigrasi

### 4.0 CRITICAL: Tidak Ada `last_insert_rowid()`
**Verifikasi:** `grep -r 'last_insert_rowid' backend/src/` → 0 matches

**Impact POSITIF:** Semua primary key di project ini adalah **string/UUID yang di-generate aplikasi** (bukan auto-increment integer). Berarti:
- Tidak perlu konversi `INTEGER PRIMARY KEY AUTOINCREMENT` → `AUTO_INCREMENT`
- Tidak perlu ubah pola `RETURNING id` karena ID sudah diketahui sebelum INSERT
- Data migration lebih mudah karena tidak ada referensi ke sequence/identity

### 4.1 Transaction Handling (11 Transaksi)
**Lokasi transaksi:**

| File | Jumlah | Pattern | Perubahan |
|------|--------|---------|-----------|
| `routes.rs` | 7 | `state.pool.begin().await` → `&mut *tx` | Otomatis jadi `Transaction<MySql>` saat pool berubah. Tidak perlu edit manual. |
| `landing_routes.rs` | 1 | `state.pool.begin().await` | Sama seperti di atas |
| `blast_engine.rs` | 2 | `pool.acquire().await` | `MySqlPool::acquire()` returns `MySqlConnection` — compatible |
| `seed.rs` | 1 | `pool.acquire().await` | Sama seperti di atas |

**Total: 11 transaksi**. Semua menggunakan API generic sqlx (`pool.begin()`, `pool.acquire()`), sehingga **tidak ada perubahan kode manual** di call sites — cukup ubah tipe pool di `state.rs`.

### 4.2 No Database Row Locking Found
**Verifikasi:** `grep -r 'FOR UPDATE' backend/src/` → 0 matches

Semua keyword "lock" yang ditemukan adalah **application-level locking** (Redis mutex, `tokio::sync::Mutex`), bukan database `SELECT FOR UPDATE`.

### 4.3 Migration Files (`backend/migrations/*.sql`)
Ada **40 file migration** di **24 file** berbeda. Berikut pola yang harus diubah:

| Fitur SQLite | MySQL Equivalent | Contoh File |
|-------------|------------------|-------------|
| `TEXT PRIMARY KEY` | `VARCHAR(255) PRIMARY KEY` | `2026042301_init.sql` — users, products, promos, blog_posts, job_listings |
| `BOOLEAN` (stored as INTEGER) | `BOOLEAN` atau `TINYINT(1)` | Banyak file — SQLite pakai `DEFAULT 0/1`, MySQL pakai `DEFAULT FALSE` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | Sama (supported) | Banyak file |
| `datetime('now')` | `NOW()` atau `CURRENT_TIMESTAMP` | `2026051202_persist_sessions.sql:8` |
| `ON CONFLICT(...)` | `ON DUPLICATE KEY UPDATE` | `seed.rs` (4×), `routes.rs` (2×), `bridge_event_processor.rs` (1×), `landing_routes.rs` (1×) |
| `INSERT OR IGNORE` | `INSERT IGNORE` | `bridge_event_processor.rs` (1×), `debug_pixel.rs` (3×) |
| `REPLACE INTO` | Sama (MySQL supports) | `pixel/analytics_job.rs` (3×) |
| `datetime('now', ?)` | `DATE_SUB(NOW(), INTERVAL ?)` | `routes.rs` (6×), `cleanup.rs` (2×), `blast_engine.rs` (1×), `bridge_event_processor.rs` (1×) |
| `strftime('%Y-%m-%d', ...)` | `DATE_FORMAT(..., '%Y-%m-%d')` | `routes.rs` (4×) |
| `date('now')` | `CURDATE()` | `blast_engine.rs` (1×) |
| `INTEGER PRIMARY KEY` auto-increment | `INT AUTO_INCREMENT PRIMARY KEY` | — (hampir semua PK di project ini adalah TEXT/UUID) |
| `JSON` fields (stored as TEXT) | `JSON` (native di MySQL 5.7+) | products.images, specs, colors; promos.product_ids; blog_posts.tags |
| `REAL` | `DECIMAL(15,2)` untuk harga | products.price, price_installment, dp_min |
| `TEXT` (bukan JSON) | `TEXT` atau `LONGTEXT` | descriptions, content, credentials, session_data |
| `UNIQUE` | Sama (MySQL supports) | users.email, products.slug, blog_posts.slug |
| `ON DELETE CASCADE` | Sama (MySQL supports) | refresh_sessions.user_id, dll. |
| `ROW_NUMBER() OVER (...)` | Supported di MySQL 8.0+ | `2026051404_deduplicate_product_price_markups.sql:9` |
| `datetime(updated_at)` | `updated_at` (MySQL auto-cast) | `2026051404_deduplicate_product_price_markups.sql:11` |

### 4.4 Query Runtime di Rust

| Pola SQLite | MySQL Equivalent | Lokasi Umum |
|------------|------------------|-------------|
| `ON CONFLICT(id) DO UPDATE SET ...` | `ON DUPLICATE KEY UPDATE ...` | `seed.rs`, banyak insert/update di routes |
| `PRAGMA table_info(...)` | `SHOW COLUMNS FROM ...` atau `DESCRIBE ...` | `main.rs:235`, `main.rs:259` |
| `PRAGMA foreign_keys = ON` | `SET FOREIGN_KEY_CHECKS = 1` | Tidak ditemukan tapi perlu di-enable |
| `COALESCE(...)` | Sama | `2026051404_deduplicate_product_price_markups.sql:10` |
| `LIMIT ? OFFSET ?` | Sama (MySQL compatible) | banyak — tidak perlu diubah |
| `DATE(column)` | Sama | `test_agent_dashboard.rs`, routes |
| `LOWER(column)` | Sama | banyak — tidak perlu diubah |
| `COUNT(*)` | Sama | banyak — tidak perlu diubah |
| `SUM(...)`, `AVG(...)` | Sama | campaign metrics, analytics |
| `EXISTS (SELECT 1 FROM ...)` | Sama | `main.rs:57`, routes |
| `CASE WHEN ... THEN ... END` | Sama | blast_engine, queue_manager |

---

## 5. Util Binaries (`backend/src/bin/*.rs`) — Detail Tabel

**16 binary** utilitas. **15** menggunakan `SqlitePool` (harus di-update). **1 aman** (tidak ada DB):

| Binary | Lokasi | SQLite-Specific Code | Perubahan MySQL |
|--------|--------|---------------------|-----------------|
| `list_tables` | `src/bin/list_tables.rs` | `SELECT name FROM sqlite_master WHERE type='table'` | `SHOW TABLES` |
| `clear_catalog` | `src/bin/clear_catalog.rs` | `SqlitePool` | `MySqlPool` |
| `cleanup_assets` | `src/bin/cleanup_assets.rs` | `SqlitePool` | `MySqlPool` |
| `clear_db` | `src/bin/clear_db.rs` | `SqlitePool` | `MySqlPool` |
| `clear_non_admin` | `src/bin/clear_non_admin.rs` | `SqlitePool` | `MySqlPool` |
| `clear_products` | `src/bin/clear_products.rs` | `SqlitePool` | `MySqlPool` |
| `debug_db` | `src/bin/debug_db.rs` | `SqlitePool` | `MySqlPool` |
| `debug_pixel` | `src/bin/debug_pixel.rs` | `SqlitePool` | `MySqlPool` |
| `reset_passwords` | `src/bin/reset_passwords.rs` | `SqlitePool` | `MySqlPool` |
| `seed_db` | `src/bin/seed_db.rs` | `SqlitePoolOptions`, `max_connections(1)` | `MySqlPoolOptions`, `max_connections(5)` |
| `strict_cleanup` | `src/bin/strict_cleanup.rs` | `SqlitePool` | `MySqlPool` |
| `verify_admin` | `src/bin/verify_admin.rs` | `SqlitePool` | `MySqlPool` |
| `check_event` | `src/bin/check_event.rs` | `SqlitePool` | `MySqlPool` |
| `list_categories` | `src/bin/list_categories.rs` | `SqlitePool` | `MySqlPool` |
| `test_agent_dashboard` | `src/bin/test_agent_dashboard.rs` | `SqlitePool` | `MySqlPool` |
| `test_smtp` | `src/bin/test_smtp.rs` | **NO DB** — hanya SMTP test | **Tidak perlu diubah** |

**Catatan Kritis:**
- `list_tables.rs`: query SQLite-native `sqlite_master` + `PRAGMA table_info` → `SHOW TABLES` + `SHOW COLUMNS`
- `debug_pixel.rs`: `INSERT OR IGNORE` (3×) → `INSERT IGNORE` (MySQL)
- `test_smtp.rs`: tidak ada DB interaction, aman

| Binary | Lokasi | Perubahan |
|--------|--------|-----------|
| `list_tables` | `src/bin/list_tables.rs` | `SqlitePool` → `MySqlPool`; query `SELECT name FROM sqlite_master` → `SHOW TABLES` |
| `clear_catalog` | `src/bin/clear_catalog.rs` | Pool type + query syntax |
| `cleanup_assets` | `src/bin/cleanup_assets.rs` | Pool type + query syntax |
| `clear_db` | `src/bin/clear_db.rs` | Pool type + query syntax |
| `clear_non_admin` | `src/bin/clear_non_admin.rs` | Pool type + query syntax |
| `clear_products` | `src/bin/clear_products.rs` | Pool type + query syntax |
| `debug_db` | `src/bin/debug_db.rs` | Pool type + query syntax |
| `debug_pixel` | `src/bin/debug_pixel.rs` | Pool type + query syntax |
| `reset_passwords` | `src/bin/reset_passwords.rs` | Pool type + query syntax |
| `seed_db` | `src/bin/seed_db.rs` | `SqlitePoolOptions` → `MySqlPoolOptions`; `max_connections(1)` → `max_connections(5)`; migration path sama |
| `strict_cleanup` | `src/bin/strict_cleanup.rs` | Pool type + query syntax |
| `verify_admin` | `src/bin/verify_admin.rs` | Pool type + query syntax |
| `check_event` | `src/bin/check_event.rs` | Pool type + query syntax |
| `list_categories` | `src/bin/list_categories.rs` | Pool type + query syntax |
| `test_agent_dashboard` | `src/bin/test_agent_dashboard.rs` | Pool type + query syntax |

---

## 6. Test Files (7 file, bukan 3)

| File | Perubahan |
|------|-----------|
| `backend/tests/api_routes_test.rs` | `SqlitePool` → `MySqlPool`; in-memory SQLite → MySQL test DB |
| `backend/tests/api_tokens_test.rs` | Sama; in-memory SQLite → MySQL test DB |
| `backend/tests/campaign_metrics_test.rs` | Sama; `sqlx::migrate!("./migrations").run(&pool)` → unified MySQL schema |
| `backend/tests/campaign_config_property_test.rs` | **NO DB** — hanya proptest logic, aman |
| `backend/tests/chatbot_routes_test.rs` | Placeholder (`#[ignore]`, `todo!()`), tidak aktif |
| `backend/tests/validation_test.rs` | **NO DB** — hanya unit test pure functions, aman |
| `backend/tests/webhook_routes_test.rs` | Placeholder (`#[ignore]`, `todo!()`), tidak aktif |

**Rekomendasi Test Harness MySQL:**
```rust
// Di file test setup
let pool = MySqlPoolOptions::new()
    .max_connections(5)
    .connect("mysql://root@localhost/tridjaya_test")
    .await?;

// Run unified schema (bukan 40 migration)
sqlx::migrate!("./migrations_mysql").run(&pool).await?;

// Truncate semua tabel sebelum setiap test
for table in tables { sqlx::query(&format!("TRUNCATE TABLE {}", table)).execute(&pool).await?; }
```

**Catatan:** MySQL tidak mendukung `TRUNCATE ... CASCADE`. Urutkan truncate dari tabel child ke parent, atau gunakan `SET FOREIGN_KEY_CHECKS = 0` sebelum truncate.

---

## 7. Langkah-Langkah Migrasi Praktis

### Phase 1: Persiapan Environment
1. Install MySQL Server 8.0+ (butuh `ROW_NUMBER()` support untuk deduplication migration)
2. Buat database: `CREATE DATABASE tridjaya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Update `backend/.env`: `DATABASE_URL=mysql://user:pass@localhost:3306/tridjaya`
4. Pastikan Redis sudah running (sudah digunakan oleh BlastEngine & QueueManager)
5. Pastikan deployment native memakai MySQL/Redis service lokal atau managed service

### Phase 2: Update Dependencies
1. Edit `backend/Cargo.toml`: ganti feature `sqlite` → `mysql`
2. Jalankan `cargo check` untuk melihat semua compile error (akan ada puluhan)
3. Fix import errors secara sistematis

### Phase 3: Rewrite Migrations
**Opsi A — Manual Rewrite (Risiko tinggi, 40 file di 24 file berbeda)**
- Konversi setiap `.sql` migration dari SQLite syntax ke MySQL syntax

**Opsi B — Single Unified Schema (STRONGLY RECOMMENDED)**
- Hapus semua file di `backend/migrations/`
- Buat 1 file: `migrations/001_init_mysql.sql` dengan schema lengkap yang compatible MySQL
- Karena data sudah ada di SQLite, gunakan tool ekspor/impor (Phase 5)

**Daftar tabel yang harus ada (dari 58 CREATE TABLE di 24 migration files):**
`users`, `products`, `promos`, `blog_posts`, `job_listings`, `agent_rewards`, `reward_tiers`, `site_content`, `agent_registrations`, `agent_leads`, `telemetry`, `referrals`, `support_tickets`, `partners`, `users` (alterations: is_verified, last_login, bank_account, jabatan), `notifications`, `security_tokens` (password_reset_tokens, email_verification_tokens), `product_categories`, `product_marketing_fields`, `job_applications`, `product_reviews`, `product_ratings`, `sales_features` (sales_targets, sales_performance, sales_delivery_schedules), `wa_tables` (wa_accounts, wa_templates, wa_contacts, wa_conversations, wa_messages, wa_groups, wa_group_members, wa_api_tokens), `campaign_metrics`, `pixel_events`, `pixel_core` (pixel_campaigns, pixel_trackers, pixel_goals), `pixel_analytics` (pixel_daily_stats, pixel_hourly_stats), `landing_content` (landing_hero_slides, landing_category_panels, landing_smart_ride, landing_smart_ride_features, landing_testimonials, landing_faq, landing_footer_links), `product_price_markups`, `refresh_sessions`, `wa_blast_contacts`, `wa_session_health`

**Estimasi: ~35-40 tabel total** (termasuk tabel junction dan tracking).

### Phase 4: Rewrite Rust Code
Urutan prioritas:
1. `state.rs` — ubah `SqlitePool` → `MySqlPool`
2. `main.rs` — ubah connection setup, hapus PRAGMA, hapus sqlite-specific
3. `seed.rs` — ubah `ON CONFLICT` → `ON DUPLICATE KEY UPDATE`
4. `bin/*.rs` — ubah semua 15 binary
5. `routes.rs` & file besar lainnya — periksa setiap `ON CONFLICT` dan ganti
6. `tests/*.rs` — update setup test DB

### Phase 5: Data Migration (SQLite → MySQL)
Gunakan salah satu cara:
- **SQLx + script Rust**: Baca dari SQLite, tulis ke MySQL
- **sqlite3dump + sed**: `sqlite3 tridjaya.db .dump > dump.sql`, lalu konversi syntax
- **Tools**: `pgloader` (bisa SQLite→MySQL), atau gunakan DBeaver export/import

### Phase 6: Build & Compile Check
**Temuan Penting:** Project ini **TIDAK menggunakan `sqlx::query!` macro**. Semua query runtime (`sqlx::query`/`sqlx::query_as`).

Berarti:
- ✅ **Build TIDAK memerlukan live database connection**
- ✅ **Tidak perlu folder `.sqlx/` atau `SQLX_OFFLINE=true`**
- `cargo check` dan `cargo build` akan berhasil selama tipe pool sudah diganti
- Hanya perlu runtime DB connection saat aplikasi dijalankan

Langkah build:
```bash
cd backend
cargo check
# Fix compile errors (harusnya hanya import/type errors)
cargo build --release
```

---

## 8. Perbedaan Perilaku Penting SQLite vs MySQL

| Aspek | SQLite | MySQL | Impact |
|-------|--------|-------|--------|
| **Boolean** | INTEGER (0/1) | TINYINT(1) / BOOLEAN | sqlx deserialize tetap jadi `bool` — aman |
| **String PK** | `TEXT PRIMARY KEY` | `VARCHAR(255) PRIMARY KEY` | Perlu tentukan length |
| **JSON** | TEXT + app-level parse | JSON native (5.7+) | Bisa pakai native JSON untuk query indexing |
| **Case sensitivity** | `LIKE` case-insensitive default | `LIKE` case-insensitive (tergantung collation) | Perlu verifikasi collation |
| **Date math** | `datetime()`, `julianday()` | `DATE_ADD()`, `NOW()`, `TIMESTAMPDIFF()` | Cari penggunaan date function |
| **Auto increment** | `INTEGER PRIMARY KEY` | `AUTO_INCREMENT` | Di project ini PK umumnya TEXT/UUID, jadi jarang |
| **Locking** | File-level (WAL mode) | Row-level + MVCC | MySQL jauh lebih baik untuk concurrent writes |
| **Connection limit** | Default 20 (configurable) | Bisa ratusan | Ubah `max_connections` di pool options |

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| 40 migration files berbeda syntax | Buat 1 unified schema baru; test di MySQL dev dulu |
| `ON CONFLICT` tersebar di ~20 file | Search & replace global: `ON CONFLICT` → `ON DUPLICATE KEY UPDATE` (perlu perhatikan column mapping) |
| `PRAGMA table_info` di `main.rs` | Ganti dengan `SHOW COLUMNS` atau hapus block diagnostic |
| Test DB setup berubah | Buat test harness yang create/drop MySQL test DB |
| sqlx compile-time check gagal | Pastikan MySQL dev running saat `cargo build`; atau generate `.sqlx/` metadata |
| Data loss saat migrasi | Backup SQLite `.db` file; gunakan transaction saat import ke MySQL |
| JSON field migration | SQLite TEXT JSON → MySQL JSON; validate semua JSON valid sebelum import |

---

## 10. Checklist Akhir

- [ ] `Cargo.toml`: feature `sqlite` → `mysql`
- [ ] `.env`: `DATABASE_URL` format MySQL
- [ ] `state.rs`: `SqlitePool` → `MySqlPool`
- [ ] `main.rs`: Hapus PRAGMA, WAL, busy_timeout; ganti connect options
- [ ] `seed.rs`: Ganti `ON CONFLICT` → `ON DUPLICATE KEY UPDATE`
- [ ] Semua `backend/src/bin/*.rs`: Ganti pool type (15 file)
- [ ] Semua `backend/tests/*.rs`: Update test DB setup
- [ ] `migrations/`: Rewrite ke MySQL-compatible schema
- [ ] `routes.rs` & handler files: Periksa `ON CONFLICT` di query string
- [ ] Build test: `cargo check` clean
- [ ] Data migration: SQLite → MySQL berhasil
- [ ] Functional test: Login, CRUD produk, WA gateway, pixel tracking
- [ ] Performance test: Load test dengan concurrent connections

---

## Appendix: File-FIle Kunci yang Direkomendasikan untuk Diperiksa Manual

1. `backend/src/main.rs` — Connection & startup diagnostics
2. `backend/src/state.rs` — AppState pool definition
3. `backend/src/seed.rs` — Seed data + ON CONFLICT patterns
4. `backend/src/routes.rs` — 258 sqlx calls (paling banyak)
5. `backend/src/blast_engine.rs` — 55 sqlx calls (WA blast critical)
6. `backend/src/bridge_event_processor.rs` — 43 sqlx calls (event processing)
7. `backend/src/queue_manager.rs` — 22 sqlx calls (Redis + DB coordination)
8. `backend/migrations/2026042301_init.sql` — Schema dasar
9. `backend/migrations/2026051404_deduplicate_product_price_markups.sql` — Window function
