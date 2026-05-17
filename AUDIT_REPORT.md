# Laporan Audit Keamanan & Bug — Tridjaya Group

**Tanggal Audit:** 2026-05-11
**Auditor:** Cascade (AI Pair Programmer)
**Lingkup:** Backend (Rust/Axum/SQLite), Frontend (React/Vite), Konfigurasi, Git History

---

## 1. Ringkasan Stack

- **Backend:** Rust (Axum 0.8), SQLite (`sqlx`), Redis, `lettre` (SMTP), `argon2` (password hashing), `aes-gcm` (enkripsi token pixel).
- **Frontend:** React 19 + Vite + TypeScript + Zustand + TailwindCSS + Recharts.
- **Auth:** Session in-memory (`RwLock<HashMap>`) + Bearer token + HttpOnly cookie untuk refresh token.
- **Deploy:** Docker Compose (backend, frontend, redis).

---

## 2. CELAH KEAMANAN

### 🚨 KRITIS

#### 2.1. Kredensial SMTP Terekspos di Git History
- **File:** `VPS setup.md`
- **Baris:** 31
- **Temuan:** File ini memuat password SMTP (`SMTP_PASSWORD`) dan alamat email asli. File tersebut **sudah masuk Git history**.
- **Risiko:** Password SMTP bisa di-retrospeksi siapa pun yang punya akses ke repo.
- **Tindakan:**
  1. **Segera hapus** `VPS setup.md` dari repo dan history Git (`git filter-repo` atau BFG Repo-Cleaner).
  2. **Ganti password SMTP** di Gmail/Google Workspace (atau provider SMTP) *segera*.
  3. Pastikan file `.env` dan dokumen konfigurasi server **tidak pernah** di-commit.

#### 2.2. File `.env` Frontend Terekspos di Git
- **File:** `frontend/.env`
- **Temuan:** File `.env` frontend **terlacak Git** (`git ls-files` mengembalikannya). Meskipun isinya tidak bisa dibuka karena `.gitignore`, ada di history Git.
- **Risiko:** URL API produksi (`VITE_API_BASE_URL`) dan domain publik (`VITE_FRONTEND_URL`) bisa bocor. Walaupun ini bukan rahasia sensitif, praktiknya buruk dan bisa membuka pintu untuk serangan yang lebih terarah (targeted scanning).
- **Tindakan:**
  1. Hapus dari history Git.
  2. Pastikan `frontend/.env` sudah ada di `.gitignore` (sudah ada di root, tetapi `frontend/.env` masih terlacak).

#### 2.3. Database SQLite (`tridjaya.db`) di Git History
- **File:** `backend/tridjaya.db`
- **Temuan:** File database SQLite (1.6 MB) **terlacak Git**. File binary database bisa mengandung data testing, token, atau hash password.
- **Risiko:** Data pengguna uji coba atau hash password bisa terekspos jika database pernah mengandung data nyata.
- **Tindakan:**
  1. Hapus dari history Git.
  2. Pastikan `*.db` dan `*.db-journal` di `.gitignore` (saat ini masih di-comment di `.gitignore`).

---

### 🔴 TINGGI

#### 2.4. Upload KTP & Foto Profil Agen Di-serve Publik Tanpa Auth
- **File:** `backend/src/routes.rs` (baris ~6052–6119), `backend/src/main.rs` (baris 214)
- **Temuan:**
  - Endpoint publik `POST /api/agent-registrations` menerima upload foto KTP dan profil.
  - File disimpan ke folder `uploads/` dengan nama file acak UUID.
  - Folder `uploads` di-serve via `ServeDir` tanpa middleware autentikasi.
  - Ada komentar `TODO(security): KTP saat ini di-serve dari ServeDir publik`.
- **Risiko:** File KTP (dokumen identitas sensitif) bisa diakses langsung oleh siapa pun yang menebak atau menemukan URL-nya (walaupun UUID sulit ditebak, brute-force tidak sepenuhnya mustahil dalam skala besar, dan URL bisa bocor lewat referrer log atau shared link).
- **Tindakan:**
  1. Buat endpoint khusus (mis. `GET /api/admin/uploads/{file_id}`) yang memerlukan autentikasi admin.
  2. Atau gunakan **signed URL** dengan expiry singkat untuk menampilkan gambar di dashboard.
  3. Jangan serve folder `uploads` secara publik lewat `ServeDir`.

#### 2.5. `PIXEL_ENCRYPTION_KEY` Fallback ke Default Key Kosong
- **File:** `backend/src/pixel/crypto.rs`
- **Baris:** 41–75
- **Temuan:** Jika environment variable `PIXEL_ENCRYPTION_KEY` tidak di-set, sistem *fall back* ke `[0u8; 32]` (32 byte nol). Ini berarti semua token Meta Pixel dienkripsi dengan kunci yang sama dan mudah ditebak.
- **Risiko:** Token akses Meta CAPI bisa didekripsi oleh siapa pun yang memiliki copy database.
- **Tindakan:**
  1. **Hentikan fallback default key di production.** Jika `PIXEL_ENCRYPTION_KEY` tidak di-set saat `is_production_runtime()`, aplikasi **wajib panic/exit**.
  2. Dokumentasikan cara generate key (32 byte hex random) di `.env.example`.

#### 2.6. `COOKIE_SECURE` Default `false` di Production
- **File:** `backend/src/routes.rs` (baris 309–312)
- **Temuan:** Jika `COOKIE_SECURE` tidak di-set, default-nya `false`. Saat ini `main.rs` memeriksa `is_production_runtime()` untuk `ALLOWED_ORIGINS`, tetapi **tidak memaksa** `COOKIE_SECURE=true`.
- **Risiko:** Refresh token dikirim tanpa flag `Secure`, memungkinkan interception jika frontend diakses via HTTP.
- **Tindakan:**
  1. Saat `is_production_runtime() == true`, jika `COOKIE_SECURE` tidak di-set ke `true`, aplikasi wajib **panic/exit** dengan pesan error jelas.

#### 2.7. Refresh Token Endpoint Tanpa Rate Limit
- **File:** `backend/src/routes.rs` (baris 386–412)
- **Temuan:** Handler `refresh` tidak menerapkan rate limiting. Penyerang bisa membanjiri endpoint ini dengan refresh token yang tidak valid atau brute-force cookie.
- **Risiko:** DoS / brute-force terhadap cookie refresh token (walaupun UUID, brute-force pada skala besar tanpa rate limit bisa membebani CPU).
- **Tindakan:** Terapkan rate limit IP-based (mis. 10 req/menit) pada `POST /api/auth/refresh`.

#### 2.8. `TRUST_PROXY_HEADERS` Default `false` — Risiko IP Spoofing
- **File:** `backend/src/routes.rs` (baris 141–145, 147–170)
- **Temuan:** `TRUST_PROXY_HEADERS` default-nya `false`. Jika deploy di belakang reverse proxy (Nginx/Cloudflare) tanpa menyetelnya ke `true`, rate limiting login menggunakan IP proxy lokal, sehingga **semua client terhitung sebagai 1 IP**.
- **Risiko:**
  - Jika `false` tapi ada proxy: satu IP jahat bisa memblokir semua pengguna (shared IP rate limit).
  - Jika `true` tanpa proxy yang terpercaya: IP bisa di-spoof lewat header `X-Forwarded-For`.
- **Tindakan:**
  1. Dokumentasikan dengan jelas bahwa `TRUST_PROXY_HEADERS=true` **wajib** saat deploy di belakang reverse proxy.
  2. Pertimbangkan whitelist IP proxy (mis. 127.0.0.1, 10.0.0.0/8) sebelum mempercayai header.

#### 2.9. Session ID Telemetry Frontend Menggunakan `Math.random()`
- **File:** `frontend/src/utils/telemetry.ts`
- **Baris:** 31–37
- **Temuan:** ID session telemetry di-generate dengan `Math.random().toString(36)`.
- **Risiko:** ID tidak cukup entropi, bisa diprediksi atau bentrok.
- **Tindakan:** Gunakan `crypto.randomUUID()` (atau `window.crypto.getRandomValues`) untuk generate ID.

---

### 🟡 SEDANG

#### 2.10. Verifikasi API Token — Full Table Scan Hash
- **File:** `backend/src/api_tokens.rs` (baris 169–223), `backend/src/api_routes.rs` (baris 54–131)
- **Temuan:** `verify_api_token` mengambil **semua baris** dari tabel `wa_api_tokens` yang masih aktif, lalu memverifikasi hash Argon2 satu per satu di memory.
- **Risiko:**
  - Performa buruk (O(N) hash verification). Semakin banyak token, semakin lambat.
  - Potensi DoS: request palsu dengan Bearer token acak akan memaksa server memverifikasi hash Argon2 untuk setiap token yang ada.
- **Tindakan:**
  - Simpan prefix/token identifier (plain text atau hashed cepat seperti SHA-256) untuk query indexed, baru verifikasi Argon2 pada baris tunggal yang cocok.

#### 2.11. Access Token & Refresh Token Menggunakan UUID Biasa
- **File:** `backend/src/auth.rs` (baris 195–196, 264–265)
- **Temuan:** Token di-generate dengan `Uuid::new_v4().to_string()`.
- **Risiko:** UUID v4 aman secara kriptografi (random 122 bit), tetapi masih lebih baik menggunakan token opaque yang lebih panjang (mis. 256-bit base64) untuk menambah margin keamanan.
- **Tindakan:** Pertimbangkan gunakan `rand::rngs::OsRng` untuk generate 32 byte dan encode base64, atau minimal tetap UUID v4 (masih acceptable).

#### 2.12. Frontend Menyimpan User Object di LocalStorage via Zustand Persist
- **File:** `frontend/src/store/authStore.ts`
- **Baris:** 241–249
- **Temuan:** `zustand` persist menyimpan `user` (termasuk `role`, `email`, dll) ke `localStorage`.
- **Risiko:** Data profil pengguna bisa diakses oleh script XSS (jika ada celah XSS di masa depan).
- **Tindakan:** Hindari persist ke `localStorage` untuk data sensitif. Gunakan `sessionStorage` (hilang saat tab ditutup) atau jangan persist sama sekali; cukup gunakan `restoreSession()` saat mount.

#### 2.13. Missing CSRF Protection pada Public Multipart Forms
- **File:** `backend/src/routes.rs` (baris 6052+)
- **Temuan:** Form registrasi agen (`submit_agent_registration`) adalah endpoint publik yang menerima multipart tanpa CSRF token.
- **Risiko:** Serangan CSRF (submission otomatis dari situs jahat) masih terbatas karena ada rate limit, tetapi tidak sepenuhnya terhindari.
- **Tindakan:** Pertimbangkan menambahkan captcha (reCAPTCHA/hCaptcha) atau minimal token CSRF untuk form publik.

#### 2.14. Body Limit Global 20 MB Bisa Disalahgunakan
- **File:** `backend/src/main.rs` (baris 215)
- **Temuan:** `DefaultBodyLimit::max(20 * 1024 * 1024)` diterapkan secara global.
- **Risiko:** Endpoint publik (seperti pixel event, agent registration, webhook) bisa diserang dengan upload/payload besar.
- **Tindakan:** Gunakan limit yang lebih ketat untuk endpoint publik, dan 20 MB hanya untuk endpoint upload image.

---

## 3. BUG YANG HARUS SEGERA DIPERBAIKI

### 🔴 TINGGI

#### 3.1. `refresh` Handler Menggunakan `unwrap_or` pada Body Raw
- **File:** `backend/src/routes.rs` (baris 386–387)
- **Kode:**
  ```rust
  let payload: RefreshRequest = serde_json::from_slice(&body).unwrap_or(RefreshRequest { refresh_token: "".to_string() });
  ```
- **Bug:** Jika body JSON invalid, sistem tidak menolak request, melainkan memperlakukannya sebagai refresh token kosong. Ini bisa menyebabkan perilaku aneh dan memungkinkan bypass jika logika cookie juga tidak ketat.
- **Perbaikan:** Gunakan `?` untuk propagate error deserialization, kembalikan `400 Bad Request`.

#### 3.2. `list_pixels` Mengembalikan `access_token` dalam Response
- **File:** `backend/src/pixel/handlers.rs` (baris 24–38)
- **Temuan:** Struct `PixelWithStats` memiliki field `access_token: String` (lihat baris 31). Belum dilihat apakah field ini di-exclude saat serialisasi, tetapi definisi struct menunjukkan `access_token` mungkin ikut dikembalikan.
- **Bug:** Jika token Meta Pixel di-return ke client (bahkan ke Super Admin), ada risiko eksposur. Walaupun dienkripsi, tetap tidak ideal untuk mengembalikannya langsung.
- **Perbaikan:** Pastikan `access_token` tidak masuk ke response JSON. Gunakan `#[serde(skip_serializing)]` atau buat DTO khusus.

#### 3.3. `get_encryption_key()` Memuat Key dari Env di Runtime Setiap Kali
- **File:** `backend/src/pixel/crypto.rs` (baris 41)
- **Temuan:** `get_encryption_key()` membaca `std::env::var` setiap dipanggil.
- **Bug:** Jika banyak request pixel, ini akan membebani OS environment lookup. Selain itu, jika env berubah di tengah jalan, key yang digunakan bisa inkonsisten.
- **Perbaikan:** Load key sekali saat startup dan simpan di `AppState` atau `lazy_static`.

#### 3.4. `verify_email` dan `reset_password` Tidak Memeriksa `used_at` atau `expires_at` dengan Ketat
- **File:** `backend/src/routes.rs`
- **Temuan:** Belum ditemukan bug jelas, tetapi perlu diverifikasi bahwa token reset password dan verifikasi email:
  1. Tidak bisa digunakan lebih dari sekali (`used_at IS NULL` diperiksa?).
  2. Masa berlaku benar-benar diperiksa (30 menit).
- **Perbaikan:** Audit query pada `verify_email` dan `reset_password` untuk memastikan `used_at` di-set ke timestamp saat digunakan.

#### 3.5. Rate Limit Fallback IP (`check_ip_rate_limit`) Menghasilkan `Ok(())` Tanpa Limit
- **File:** `backend/src/state.rs` (baris 81–99)
- **Kode:**
  ```rust
  } else {
      tracing::warn!("Redis not available, using in-memory rate limiting for IP");
      Ok(())
  }
  ```
- **Bug:** Jika Redis tidak tersedia, fallback IP rate limit **langsung lolos tanpa pengecekan sama sekali**.
- **Perbaikan:** Implementasikan fallback in-memory rate limit untuk IP (serupa dengan `check_api_rate_limit` fallback).

#### 3.6. `login_with_request` Menggunakan `email.trim().to_lowercase()` untuk Log, Tetapi Tidak Selalu untuk Query
- **File:** `backend/src/auth.rs`
- **Temuan:** Login query sudah menggunakan `LOWER(email) = ?` yang baik, tetapi perlu dipastikan konsistensi di seluruh codebase.

#### 3.7. `check_permission` Tidak Memeriksa `user_id` Kepemilikan Token
- **File:** `backend/src/api_routes.rs` (baris 133–150)
- **Temuan:** `check_permission` hanya memeriksa permission string, tidak memeriksa apakah token masih valid atau kepemilikan user.
- **Catatan:** Tidak bug kritis karena `verify_api_token` sudah dipanggil sebelumnya, tetapi baiknya ditambahkan defense-in-depth.

#### 3.8. `frontend/src/utils/apiClient.ts` — Token Bearer Dikirim ke Semua Request
- **File:** `frontend/src/utils/apiClient.ts`
- **Temuan:** Jika `accessToken` ada di store, token akan dikirim ke *semua* request (termasuk endpoint publik) kecuali `skipAuth: true`.
- **Bug:** Meskipun tidak langsung berbahaya, ini meningkatkan surface attack (token bisa bocor via referrer atau logging pihak ketiga jika endpoint publik redirect).
- **Perbaikan:** Hanya kirim `Authorization` header ke endpoint yang memerlukannya.

---

## 4. FILE YANG SUDAH TIDAK BERGUNA & HARUS DIHAPUS / DI-PURGE DARI GIT

### 4.1. File Sensitif / Rahasia (Hapus dari Git History)

| File | Alasan |
|------|--------|
| `VPS setup.md` | Berisi password SMTP plain text. Hapus dari repo dan history Git. |
| `frontend/.env` | `.env` frontend berisi URL API produksi dan sudah masuk Git. Hapus dari history. |
| `backend/tridjaya.db` | Database SQLite binary. Bisa mengandung data. Hapus dari history. |

**Catatan Teknis:** Hapus dari Git history menggunakan `git filter-repo` atau [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/). Jangan hanya `git rm` karena file masih ada di history.

### 4.2. Log & Artefak Build (Hapus dari Git & `.gitignore`)

| File/Folder | Alasan |
|-------------|--------|
| `frontend/vite-dev.err.log` | Log error Vite lokal, tidak perlu di VCS. |
| `frontend/vite-dev.log` | Log Vite lokal. |
| `frontend/preview.log` | Log preview lokal. |
| `frontend/preview.err.log` | Log error preview lokal. |
| `frontend/preview.err.log` | (Duplikat atau file serupa) — semua log Vite tidak perlu di Git. |
| `frontend/dist/` | Sudah di-ignore, pastikan tidak ada di history. |
| `frontend/node_modules/` | Sudah di-ignore. |
| `backend/target/` | Sudah di-ignore. |
| `*.db` / `*.db-journal` | `.gitignore` masih me-comment baris ini. **Un-comment** agar DB tidak masuk Git lagi. |

### 4.3. Dokumentasi Task Lama (Opsional — Bersihkan)

File-file berikut adalah catatan implementasi task lama yang tidak diperlukan untuk runtime aplikasi. Mereka memenuhi root folder backend dan bisa dipindahkan ke folder `docs/` atau dihapus jika sudah tidak relevan:

- `backend/TASK_17_CHECKLIST.md`
- `backend/TASK_17_IMPLEMENTATION.md`
- `backend/TASK_19_IMPLEMENTATION.md`
- `backend/TASK_19_SUMMARY.md`
- `backend/TASK_20_IMPLEMENTATION.md`
- `backend/TASK_21_IMPLEMENTATION.md`
- `backend/TASK_22_IMPLEMENTATION.md`
- `backend/TASK_22_SUMMARY.md`
- `backend/TASK_23_1_SUMMARY.md`
- `backend/TASK_23_IMPLEMENTATION.md`
- `backend/SPINTAX_IMPLEMENTATION.md`
- `backend/WEBHOOK_API_IMPLEMENTATION.md`
- `TASK_11_VERIFICATION.md` (root)
- `TASK_13_IMPLEMENTATION_SUMMARY.md` (root)

### 4.4. File Contoh / Tidak Digunakan

- `backend/src/spintax_example.rs` — Contoh penggunaan spintax, mungkin tidak perlu masuk production binary. Pertimbangkan hapus atau pindahkan ke `examples/`.
- `backend/src/bin/*` — Utility CLI. Baik untuk development, pastikan tidak ikut di-build di Docker production image (sudah diatur via `required-features = ["dev-tools"]`).

---

## 5. REKOMENDASI PERBAIKAN CEPAT (Quick Wins)

1. **Segera ganti SMTP password** dan hapus `VPS setup.md` dari history Git.
2. **Hapus** `frontend/.env` dan `backend/tridjaya.db` dari Git history.
3. **Un-comment** `*.db` dan `*.db-journal` di `.gitignore`.
4. **Tambahkan guard** di `main.rs`:
   ```rust
   if is_production_runtime() {
       if std::env::var("COOKIE_SECURE").unwrap_or_default() != "true" {
           panic!("COOKIE_SECURE must be true in production");
       }
       if std::env::var("PIXEL_ENCRYPTION_KEY").is_err() {
           panic!("PIXEL_ENCRYPTION_KEY must be set in production");
       }
   }
   ```
5. **Ganti** `Math.random()` di `telemetry.ts` dengan `crypto.randomUUID()`.
6. **Tambahkan rate limit** pada `POST /api/auth/refresh`.
7. **Perbaiki** `refresh` handler: jangan pakai `unwrap_or` untuk deserialization body.
8. **Audit** `list_pixels` response: pastikan `access_token` tidak diserialisasi ke JSON.
9. **Pisahkan** `DefaultBodyLimit` per endpoint: publik ≤ 1 MB, upload ≤ 20 MB.
10. **Dokumentasikan** dengan jelas env vars wajib di production di `README.md`.

---

## 6. PENUTUP

Secara umum, arsitektur backend sudah cukup baik: menggunakan Argon2id, memiliki rate limiting dasar, CORS dikonfigurasi, dan ada audit logging. Namun, ada beberapa **celah kritis** yang berkaitan dengan **eksplorasi rahasia di Git** dan **fallback keamanan yang lemah saat production** yang harus segera diperbaiki sebelum deploy ke lingkungan publik.

Jika ada pertanyaan atau perlu bantuan implementasi perbaikan, silakan beri tahu.
