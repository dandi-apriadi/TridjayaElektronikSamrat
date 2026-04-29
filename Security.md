# Audit Keamanan Pra-Publikasi — branch `devin-fixes`

Tanggal audit: 2026-04-27
Repo: dandi-apriadi/TridjayaElektronikSamrat
Branch yang dianalisa: `devin-fixes` (sebelum merge ke `main`)
Cakupan: semua perubahan backend & frontend yang ada di branch ini, fokus ke fitur yang baru/dimodifikasi.

> Catatan: Audit awal (25 temuan; 6 CRITICAL, 7 HIGH, 7 MEDIUM, 5 LOW) sudah ditutup di PR #1.
> Laporan ini hanya membahas **temuan yang masih hidup di branch `devin-fixes`** — termasuk
> kelas masalah baru yang muncul dari fitur tambahan setelah PR #1 (job applications,
> support tickets, leaderboard publik antar-agen, bin/* admin tools, dll).

## Ringkasan Temuan

Klasifikasi: **CRITICAL** = bisa langsung dipakai untuk takeover/data leak besar; **HIGH** = bypass kontrol penting; **MEDIUM** = abuse / hardening; **LOW** = cosmetic / defense-in-depth.

| #  | Severity | Area | Judul singkat |
|----|----------|------|----------------|
| 1  | CRITICAL | bin/* tools | `cargo run --bin reset_passwords` reset SEMUA password ke `"123"` & clear `must_change_password`, tanpa konfirmasi |
| 2  | CRITICAL | bin/* tools | `clear_db` / `clear_non_admin` / `strict_cleanup` hard-code path DB dan menghapus data tanpa konfirmasi atau env guard |
| 3  | HIGH | auth.rs | `authorize()` & `refresh_with_request()` percaya `session.role` dari memori; demote / deactivate user TIDAK invalidasi sesi aktif |
| 4  | HIGH | auth.rs | `authorize()` tidak mem-validasi `is_active` / `is_verified` user terkini (akun dinonaktifkan tetap bisa pakai access token + refresh sampai 7 hari) |
| 5  | HIGH | rate-limit | `extract_client_ip()` percaya bulat `X-Forwarded-For` / `X-Real-IP` tanpa daftar trusted proxy → IP-based rate limit (login & forgot-password) bisa dilewati dengan spoof header |
| 6  | HIGH | docker-compose | Redis container expose port 6379 ke host tanpa password (`requirepass`) → siapa pun yang bisa mencapai host = full akses cache (juga vector untuk poison cache leaderboard yang dibaca server) |
| 7  | HIGH | endpoint publik | `POST /api/agent-registrations` (submit registrasi agen + upload KTP) — tanpa rate limit, tanpa CAPTCHA. Lampiran KTP disimpan di `/uploads/` yang di-serve publik (didokumentasikan via `TODO(security)`) |
| 8  | HIGH | endpoint publik | `POST /api/job-applications` — tanpa auth, tanpa rate limit, tanpa validasi panjang field, tiap submit men-spawn notifikasi admin → spam + table-bloat + noise di dashboard admin |
| 9  | MEDIUM | endpoint publik | Telemetry (`/api/telemetry/page-view`, `/click`, `/whatsapp-click`, `/pixel-event`) menerima JSON arbiter tanpa size cap atau schema → log/DB bloat & vector untuk muddle data referral |
| 10 | MEDIUM | leaderboard | `GET /api/leaderboard` (Admin + Agent) mengekspos `email` & `whatsapp` semua agen ke setiap agen lain (PII cross-agent leak) |
| 11 | MEDIUM | reset_password | Setelah reset, hanya `access_sessions` & `refresh_sessions` user terkait yang dibersihkan; cookie `refresh_token` HttpOnly user lain tidak ter-revoke kalau mereka login dari device berbeda — tapi karena scope per user_id sudah dipakai, ini OK. (informational) |
| 12 | MEDIUM | update_user | Admin update user (role / is_active / password) tidak invalidasi sesi aktif user tersebut → digabung dengan #3/#4 = jendela penyalahgunaan |
| 13 | MEDIUM | seed.rs vs seeds.json | `seeds.json` sekarang adalah ARRAY produk (`[{}…]`); `seed.rs` masih membaca `seeds["users"]`, `seeds["products"]`, dst. Hasil: pada DB kosong, semua tabel di-DELETE tetapi tidak ada yang di-seed kembali → potensi data loss saat operator menjalankan ulang aplikasi dengan DB baru |
| 14 | MEDIUM | session storage | Sesi tetap di-`HashMap` in-memory: restart backend = semua user logout; tidak ada eviction/janitor untuk akses-token kadaluarsa → leakage memori bertahap pada beban tinggi |
| 15 | MEDIUM | CORS | `ALLOWED_ORIGINS` default men-whitelist 12 origin localhost (5173-5178 + 127.0.0.1). Aman di dev, tapi nilai ini juga dipakai sebagai fallback bila env var tidak diset — risk kalau image dideploy tanpa override. `docker-compose.yml` sudah override, tapi runtime non-compose perlu hati-hati |
| 16 | LOW | create_claim | Agent bebas mengetik `rewardName` apa saja (free-text) selama `tierId` valid; admin tidak melihat mismatch → bukan masalah keuangan (nominal pakai `reward_value` tier), tapi UX/audit trail rapuh. Juga: tidak ada batas jumlah klaim pending per agent → spam-able |
| 17 | LOW | update_job_application_status | `payload.status` di-bind langsung ke DB tanpa whitelist (mis. `pending` / `reviewed` / `accepted` / `rejected`) → data integrity drift |
| 18 | LOW | frontend store | `isAuthenticated` di-persist ke `localStorage` (lewat partialize). UX-only flag, tapi user bisa lihat dashboard "shell" sekejap sebelum `restoreSession()` selesai. Backend tetap menolak request → no privilege escalation, tapi flicker bisa membocorkan struktur UI admin ke pengguna non-admin |
| 19 | LOW | `extract_client_ip` | Tanpa parsing CIDR / list trusted proxy: lihat #5 |
| 20 | LOW | logging | `tracing::warn!("Login failed: incorrect password for email '{}'", email)` mencatat email plaintext untuk login gagal. Jika log dikirim ke pihak ketiga (mis. Datadog), log = PII. Tidak ada masking. |

> Tidak ada CRITICAL baru di luar skrip `bin/*`. Auth flow inti (verify-email, forgot-password, reset-password, agent provisioning) yang diaudit di sesi sebelumnya sekarang aman untuk publish.

---

## Detail per Temuan

### #1 CRITICAL — `reset_passwords` binary tetap di-ship & full-DB password override

`backend/src/bin/reset_passwords.rs:13-18`
```rust
let password_hash = hash_password("123");
sqlx::query("UPDATE users SET password_hash = ?, is_active = 1, is_verified = 1, must_change_password = 0")
    .bind(&password_hash)
    .execute(&pool)
    .await?;
```
- Tanpa CLI flag, tanpa konfirmasi, tanpa env guard.
- Password baru `"123"` (di bawah threshold 8 char yang kita validasi di endpoint produksi → bypass policy).
- Mereset SEMUA user, men-clear `must_change_password = 0` → user tidak akan dipaksa ganti.
- Setelah build production (`cargo build --release`), binary ini ada di `target/release/reset_passwords`. Siapa pun yang shell ke server prod bisa mengeksekusinya.

**Rekomendasi:** Hapus binary ini dari workspace, atau gerbang dengan `if env::var("ALLOW_DESTRUCTIVE") != Ok("yes-i-mean-it")`. Pastikan binary tidak masuk ke image Docker prod (`Cargo.toml` `[[bin]]` sebaiknya `required-features = ["dev-tools"]`).

### #2 CRITICAL — `clear_db.rs`, `clear_non_admin.rs`, `strict_cleanup.rs`, `debug_db.rs`

`backend/src/bin/clear_db.rs:7`, `backend/src/bin/strict_cleanup.rs:7-13`
```rust
let pool = SqlitePoolOptions::new()
    .max_connections(1)
    .connect("sqlite:tridjaya.db").await?;
// clear_db: DELETE FROM <20 tables>
// strict_cleanup: DELETE FROM users WHERE email != 'admin@gmail.com'
```
- Path DB hard-coded relatif → kalau server prod jalan dari direktori lain dgn DB simbol bernama sama, masih merusak. Kalau dijalankan dari working dir prod, langsung wipe data prod.
- `strict_cleanup.rs` hard-code email admin `admin@gmail.com`. Kalau email admin di DB sebenarnya berbeda, semua admin terhapus dan hanya akun `admin@gmail.com` (yang mungkin tidak ada) yang seharusnya tersisa → admin lockout.

**Rekomendasi:** Pisahkan tools ini ke crate `dev-tools/` yang tidak dibangun di pipeline release, atau buat satu admin CLI bersuara (`require --confirm-prod-reset` dst). Minimum: tambahkan check `if std::env::var("APP_ENV").as_deref() == Ok("development")`.

### #3/#4 HIGH — `authorize()` & `refresh()` tidak re-check role/is_active/is_verified

`backend/src/auth.rs:266-296`
```rust
pub async fn authorize(...) -> Result<UserRecord, AppError> {
    let token = bearer_token(headers)?;
    let session = state.access_sessions.read().await.get(&token).cloned()
        .ok_or(AppError::Unauthorized)?;
    if session.expires_at < Utc::now() { return Err(AppError::Unauthorized); }
    if !allowed.is_empty() && !allowed.iter().any(|role| role == &session.role) {
        return Err(AppError::Forbidden);
    }
    let user: UserRecord = sqlx::query_as("SELECT * FROM users WHERE id = ?")
        .bind(&session.user_id)
        .fetch_optional(&state.pool).await?
        .ok_or(AppError::Unauthorized)?;
    Ok(user)
}
```
- Pengecekan role pakai `session.role` (snapshot saat login). Admin men-demote user → user tetap punya `Role::Admin` dalam access session sampai 15 menit, dan refresh akan **mempertahankan role lama** karena `refresh_with_request` baris 220, 229 juga pakai `session.role`. Net result: demote tidak efektif sebelum admin atau user melakukan logout manual.
- `is_active = false` dan `is_verified = false` saat ini tidak diperiksa → user yang dinonaktifkan admin tetap bisa pakai token sampai refresh expired (7 hari).
- `reset_password` MEMANG menyapu `access_sessions` & `refresh_sessions` user (`backend/src/routes.rs:584-592`), tapi `update_user` & `delete_user` tidak.

**Rekomendasi:**
1. Di `authorize()`, setelah fetch UserRecord, validasi `user.is_active` dan `Role::from_str(&user.role) ∈ allowed`. Pakai role dari DB, bukan `session.role`.
2. Sediakan helper `state.invalidate_user_sessions(&user_id)` dan panggil dari `update_user` (saat role/is_active/is_verified/password berubah) dan `delete_user`.

### #5 HIGH — Rate-limit IP gampang dilewati via spoof header

`backend/src/routes.rs:87-106`
```rust
fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    let forwarded = headers.get("x-forwarded-for")...
    if forwarded.is_some() { return forwarded; }
    headers.get("x-real-ip")...
}
```
- `axum` server (port 8081) terbuka langsung di docker-compose. Tanpa reverse proxy yang menormalisasi `X-Forwarded-For`, attacker tinggal kirim `X-Forwarded-For: 1.2.3.<random>` setiap request → email rate limit (5/menit/email) tetap aktif, tapi IP rate limit (#login & forgot-password) tidak efektif.
- Dampak: brute-force login per akun masih dibatasi 5/menit (oleh email key) → masih reasonable. Tapi forgot-password IP cooldown 5 detik = praktis hilang.

**Rekomendasi:** baca `X-Forwarded-For` hanya kalau `TRUSTED_PROXY` env diset, atau gunakan `axum::extract::ConnectInfo<SocketAddr>` sebagai default dan fallback ke header bila env mengizinkan.

### #6 HIGH — Redis tanpa password, port 6379 publik di docker-compose

`docker-compose.yml`
```yaml
redis:
  image: redis:alpine
  ports:
    - "6379:6379"
```
- Tidak ada `command: ["redis-server", "--requirepass", "${REDIS_PASSWORD}"]`.
- Backend `cache.rs` tinggal `redis::Client::open(REDIS_URL)`. Anyone-on-host bisa `redis-cli FLUSHALL`, atau menulis konten arbitrer ke key `leaderboard` yang nanti di-deserialize ke `Vec<AgentDirectoryRow>` di `list_leaderboard`. Untungnya `serde_json` deserialize gagal → server log error, tapi cache poisoning tetap berarti DoS (terus-menerus refresh dari DB).

**Rekomendasi:** drop `ports: - "6379:6379"` (cukup lewat network internal `services`), atau set `requirepass` + override `REDIS_URL=redis://:password@redis:6379`.

### #7 HIGH — Submit registrasi agen + KTP publik, tanpa rate limit

`backend/src/routes.rs:4218-4330`, dan komentar di baris 4281-4286:
```rust
// TODO(security): KTP saat ini di-serve dari ServeDir publik untuk
// kompatibilitas dashboard admin yang memuat <img src>. UUID nama file
// sulit ditebak, namun idealnya KTP dilayani via endpoint admin
// ber-auth dengan signed URL singkat.
ktp_photo_url = Some(format!("/uploads/{}", file_name));
```
- URL `/uploads/<uuid>_ktp.webp` aman terhadap enumerasi (UUID v4), tapi cukup satu admin/operator nyebar URL → pihak luar bisa download KTP. Compliance risk (UU PDP).
- Endpoint POST tidak punya rate limit / CAPTCHA → bisa diisi 10k registrasi spam dengan KTP palsu, mengisi storage.

**Rekomendasi:** pindahkan KTP ke endpoint `GET /api/admin/agent-registrations/{id}/ktp` yang `authorize(&[Admin])`, dan generate signed URL pendek untuk dashboard admin. Tambahkan rate-limit (per IP & per email) di submit endpoint.

### #8 HIGH — `POST /api/job-applications` publik tanpa rate-limit / validasi

`backend/src/routes.rs:4879-4918`
- Tidak ada validasi panjang `cover_letter`, `address`, dll → seseorang bisa submit body 20MB (limit body global) sekali per request.
- Setiap submit men-trigger `INSERT INTO notifications` ke admin → spam dashboard admin.
- `payload.email`, `payload.portfolio_url`, `payload.linked_in` tidak divalidasi → `portfolio_url` bisa berisi `javascript:...` atau URL phishing yang dibuka admin.

**Rekomendasi:**
1. Tambahkan rate limit per IP (mis. 5 submit / jam).
2. Validasi panjang field (`cover_letter` <= 5000, `phone` regex).
3. Whitelist scheme URL (`http`/`https` only) untuk `portfolio_url` & `linked_in`.
4. Konsolidasikan notifikasi (mis. 1 notifikasi agregat per X menit).

### #9 MEDIUM — Telemetry endpoint terima JSON arbiter

`backend/src/routes.rs:3100-3118`
- 4 endpoint publik menerima `Json<Value>` → tidak ada size cap selain global 20MB.
- Atribut `source` dari payload disimpan (`insert_telemetry`) dan kemudian di-`IN (...)` di `get_agent_performance`. Karena pakai bind parameter, SQLi tidak ada — tapi attacker bisa men-`source` satu slug agen target untuk mengisi statistik agen lain (data integrity / reward inflation).

**Rekomendasi:**
1. Validasi `source` agar hanya berupa slug yang ada di tabel `referrals`.
2. Tambahkan rate limit per IP (mis. 60 event/menit).
3. Batasi total panjang JSON (`Body(limit)`).

### #10 MEDIUM — Leaderboard membocorkan PII antar-agen

`backend/src/routes.rs:3878-3919`
```sql
SELECT u.id, u.name, u.email, r.whatsapp, r.city, r.province, ...
FROM users u
LEFT JOIN agent_registrations r ON r.email = u.email
WHERE u.role = 'agent'
```
- Endpoint diakses Admin **dan** Agent. Setiap agent bisa lihat email + whatsapp seluruh agen lain.

**Rekomendasi:** pisahkan response untuk role Agent — kembalikan hanya `name`, `tier`, `points`, `total_sales`, `joined_at`. Sembunyikan email & whatsapp. Admin tetap dapat versi lengkap.

### #12 MEDIUM — `update_user` tidak invalidasi sesi aktif

Lihat #3/#4. `backend/src/routes.rs:1289-1356` mengubah role / password / is_active / is_verified tapi tidak menyentuh `state.access_sessions` / `state.refresh_sessions`.

### #13 MEDIUM — `seeds.json` & `seed.rs` desync

`backend/seeds.json`: root sekarang adalah `Array` of 178 produk.
`backend/src/seed.rs:48-216` masih melakukan `seeds["users"].as_array()`, `seeds["products"].as_array()`, dst. Pada `Value::Array`, `Index<&str>` mengembalikan `Value::Null` → semua loop seed dilewati.
- `seed_database()` tetap MELAKUKAN `DELETE FROM products`, `DELETE FROM blog_posts`, `DELETE FROM partners`, `DELETE FROM reward_tiers`, dst. di awal — sebelum tahu bahwa root adalah Array.
- Skenario destruktif: kalau operator membuat DB baru (DATABASE_URL pindah, atau hapus `tridjaya.db`), startup akan menjalankan `seed_database()` (karena `product_count == 0`), wipe semua tabel… lalu seed nothing. Aplikasi up tanpa data.

**Rekomendasi:** sebelum DELETE, verifikasi `seeds.is_object()` dan `seeds["products"].is_array()` non-empty; bila tidak, abort tanpa wipe. Atau lebih baik lagi: pisahkan migrations vs seed, dan jangan lakukan DESTRUCTIVE wipe di startup.

### #14 MEDIUM — In-memory session HashMap tanpa janitor

`backend/src/auth.rs` + `backend/src/state.rs:13-18`
- Tidak ada background task yang menyapu session expired. Pada beban tinggi, `access_sessions` dan `refresh_sessions` tumbuh terus sampai 7 hari (refresh) sebelum natural rotation menghapusnya.
- Restart backend = semua user logout (UX issue, bukan security).

**Rekomendasi:** spawn task setiap 5 menit yang `retain(|_, s| s.expires_at > now())`. Untuk persistensi sesi lewat restart, simpan refresh sessions ke tabel `auth_sessions` di SQLite atau ke Redis (bisa dipakai sekalian).

### #15 MEDIUM — Default `ALLOWED_ORIGINS` di main.rs

`backend/src/main.rs:55-56` mendefault ke 12 origin localhost. Aman di dev, tapi: kalau image dideploy tanpa env var (mis. salah pasang Helm chart), CORS akan permisif terhadap localhost (*) saja, jadi tidak buruk — tapi tetap log peringatan / `panic!` jika dijalankan di production tanpa override eksplisit (`RUST_ENV=production`) lebih disarankan.

### #16 LOW — `create_claim` menerima `rewardName` bebas

`backend/src/routes.rs:4149-4216` — agent bisa menulis `rewardName: "Tesla Model S"` selama `tierId` valid. Reward value akhir diambil dari tier (`reward_value`), jadi tidak ada konsekuensi finansial — tapi dashboard admin akan menampilkan apa yang agent tulis.

**Rekomendasi:** ambil reward name dari `reward_tiers.name` server-side, jangan terima dari client.

### #17 LOW — `update_job_application_status` tanpa whitelist status

`backend/src/routes.rs:4920-4935` menerima `payload.status` (String) langsung. Whitelist `pending`/`reviewed`/`accepted`/`rejected`/`hired` perlu, mirip `is_valid_registration_status`.

### #18 LOW — `isAuthenticated` di-persist ke localStorage

`frontend/src/store/authStore.ts:243-246`
```ts
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
}),
```
- Access token (benar) tidak di-persist. Tapi `isAuthenticated:true` di localStorage berarti dashboard "shell" akan render sebelum backend mengkonfirmasi sesi via `restoreSession()`. Tidak ada privilege escalation karena semua API call butuh bearer/cookie, tapi struktur UI admin/agent flicker terlihat sebelum redirect.

**Rekomendasi:** persist hanya `user` (kosong saat logout), turunkan `isAuthenticated` dari `!!user && !!accessToken` setelah `restoreSession()` selesai. Atau gating render dengan `isInitializing`.

### #20 LOW — Logging email pada login gagal

`backend/src/auth.rs:122-141` mencatat email plaintext untuk `Login failed: user not found / incorrect password / not verified`. Bila log forwarding dipasang ke vendor, ini = PII di log eksternal.

**Rekomendasi:** mask domain (`u**@example.com`) atau ganti ke `tracing::debug!` (hanya muncul di log lokal).

---

## Kelas Masalah yang SUDAH Ditutup di PR #1 (untuk kelengkapan)

- Kredensial Gmail SMTP hard-coded di repo — sekarang dari env, mailer graceful disable bila kosong.
- `verify-email` no-token — sekarang token-based, atomik, idempotent.
- `forgot-password` & `reset-password` stub no-op — sekarang fully implemented + rate-limited + TOCTOU-safe.
- KTP / foto agen di-serve publik — masih ada (#7), didokumentasikan via `TODO(security)`. Solusi penuh menunggu refactor dashboard admin.
- `tridjaya.db` & `uploads/` ter-commit — sudah dihapus dari tracking, `.gitignore` ditambah.
- `seeds.json` plaintext password seragam (`Admin123!`, `Agent123!`) — root sudah bukan object users (sekarang array produk), sehingga password seragam tidak lagi nyata di repo. Tapi lihat #13 untuk konsekuensi.
- `accessToken` ter-persist ke localStorage — sekarang hanya in-memory.
- `update_auth_profile` & `change_auth_password` allow-list role — sudah meliputi Admin/Agent/Editor/Operator.
- `validate_user_create` regression hanya menerima `admin` — sudah pakai `normalize_role` lengkap.
- Login rate-limiting per email/IP, blokir 15 menit setelah threshold — implemented.
- Race condition reset_password (TOCTOU pakai user_id) — sudah pakai token-spesifik, dua-langkah UPDATE.
- Token registrasi agen di-issue dalam transaksi atomik + self-heal — sudah.

---

## Rekomendasi Pra-Publikasi

**Boleh publish sekarang** untuk perbaikan auth/audit yang sudah ada — risiko utama (token bypass, plaintext password di mail.rs, no-op flows) sudah ditutup.

**Sebelum publish, sebaiknya kerjakan minimal:**

1. **#1 + #2 (CRITICAL)** — Hapus / gerbang `bin/reset_passwords.rs`, `clear_db.rs`, `clear_non_admin.rs`, `strict_cleanup.rs`, `debug_db.rs`. Kalau perlu pertahankan, pisahkan ke direktori `dev-tools/` di luar workspace release. **Estimasi: 30 menit.**
2. **#3 + #4 + #12 (HIGH)** — Pakai `user.role`/`user.is_active` dari DB di `authorize()` (1 fungsi) + invalidasi sesi saat `update_user` / `delete_user` / admin reset. **Estimasi: 1 jam.**
3. **#6 (HIGH)** — Tutup port Redis dari host & set `requirepass`. **Estimasi: 5 menit.**
4. **#13 (MEDIUM tapi merusak)** — Guard `seed_database()` agar tidak DELETE bila `seeds.json` bukan object yang valid. **Estimasi: 15 menit.**
5. **#10 (MEDIUM)** — Filter response leaderboard untuk role Agent (hilangkan email + whatsapp). **Estimasi: 15 menit.**

**Bisa ditangani post-publish (dalam sprint yang sama):** #5, #7, #8, #9, #14, #15, #17, #18, #20.

**Acceptable as-is:** #11, #16, #19.

## Final Verdict

> **Conditional approve.** Branch ini secara fungsional jauh lebih aman daripada `main` (auth flows real, no plaintext secrets, file upload terkontrol). Tapi ada **5 item bertanda CRITICAL/HIGH** yang harus diselesaikan sebelum tag release, terutama #1/#2 (admin tools yang bisa nukifikasi data prod) dan #3/#4 (RBAC bypass via stale session). Kalau target publish hari ini hanya untuk environment staging, branch ini sudah OK; untuk **production**, kerjakan dulu 5 item di atas (~2 jam total).
