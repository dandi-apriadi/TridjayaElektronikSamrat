# Threat Model

## 1. Scope

Dokumen ini mencakup ancaman utama pada frontend, backend, API, database, telemetri, dan deployment.

## 2. Assets to Protect

- Kredensial admin dan agen.
- Data katalog dan promo.
- Data lead dan referal.
- Audit log.
- Token sesi dan refresh.
- Asset internal dan konfigurasi server.

## 3. Attack Surface

- Form login dan reset password.
- Endpoint API publik.
- Upload gambar atau file konten.
- Parameter URL dan slug.
- Event tracking dan pixel.
- Panel admin.
- Reverse proxy dan origin server.

## 4. Main Threats

### 4.1 SQL Injection

Risiko terjadi saat input dipakai langsung ke query.

Mitigasi:

- ORM atau query terparameter.
- Validasi input.
- Hindari string concatenation.

### 4.2 XSS

Risiko terjadi saat konten atau input user dirender tanpa sanitasi.

Mitigasi:

- sanitasi output,
- whitelist markdown,
- CSP ketat,
- hindari HTML mentah bila tidak perlu.

### 4.3 CSRF

Risiko terjadi pada aksi berbasis cookie session.

Mitigasi:

- CSRF token,
- SameSite cookie,
- validasi origin dan referer untuk aksi tertentu.

### 4.4 Broken Access Control

Risiko terjadi saat user mengakses data di luar scope perannya.

Mitigasi:

- cek role di server,
- cek kepemilikan resource,
- jangan percaya data dari client.

### 4.5 Credential Stuffing

Risiko terjadi pada login yang tidak dilindungi rate limit.

Mitigasi:

- rate limiting,
- lockout bertahap,
- MFA untuk admin,
- monitoring anomali login.

### 4.6 File Upload Abuse

Risiko terjadi pada upload gambar atau dokumen.

Mitigasi:

- validasi MIME dan ekstensi,
- size limit,
- file scan,
- simpan di storage terisolasi.

### 4.7 Event Spoofing

Risiko terjadi jika event telemetri dapat dipalsukan.

Mitigasi:

- validasi server-side,
- deduplication,
- signed payload bila diperlukan,
- anti-bot rules.

### 4.8 Secret Leakage

Risiko terjadi saat secret masuk ke repo, log, atau bundle client.

Mitigasi:

- secret manager,
- redaction di log,
- review konfigurasi,
- pemisahan environment.

## 5. Security Controls

- HTTPS wajib.
- HSTS wajib.
- Rate limit pada endpoint sensitif.
- Audit log untuk semua aksi administrasi.
- Backup terenkripsi.
- Dependency audit rutin.
- Least privilege pada service account.

## 6. Residual Risk

Risiko yang tetap ada setelah kontrol dasar diterapkan:

- serangan bot adaptif,
- kesalahan konfigurasi operasional,
- human error pada deploy,
- penyalahgunaan akses internal.

Risiko residual harus ditangani dengan monitoring, review konfigurasi, dan proses approval yang jelas.
