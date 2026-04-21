# Security Standards

## 1. Tujuan

Dokumen ini menetapkan kontrol keamanan minimum yang wajib dipenuhi agar sistem tahan terhadap eksploitasi umum, kebocoran data, dan manipulasi event.

## 2. Threat Model

Ancaman utama yang harus dipertimbangkan:

- SQL injection,
- XSS,
- CSRF,
- session hijacking,
- credential stuffing,
- broken access control,
- file upload abuse,
- bot traffic,
- event spoofing,
- open redirect,
- SSRF,
- secret leakage.

## 3. Prinsip Dasar

- Least privilege.
- Defense in depth.
- Secure by default.
- Fail closed, bukan fail open.
- Validate on server, sanitize on output.
- Log secukupnya, jangan berlebihan.

## 4. Autentikasi

- Password harus di-hash dengan algoritma kuat seperti Argon2 atau setara.
- Gunakan kebijakan password minimum yang wajar.
- Session token harus memiliki masa hidup pendek.
- Refresh token harus dapat dicabut.
- Rate limit login dan recovery endpoint.
- Terapkan MFA untuk akun admin bila memungkinkan.

## 5. Otorisasi

- Gunakan role-based access control.
- Validasi izin di setiap request, bukan hanya di frontend.
- Jangan percaya pada role dari client.
- Pastikan user hanya bisa mengakses resource yang menjadi miliknya.
- Audit semua perubahan privilege.

## 6. Input Validation

- Semua input harus divalidasi di server.
- Gunakan allowlist, bukan denylist, untuk field yang terstruktur.
- Batasi panjang string.
- Batasi format file upload.
- Tolak payload yang tidak sesuai schema.
- Sanitasi data yang akan ditampilkan kembali.

## 7. Web Security Headers

Wajib dipertimbangkan:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options atau frame-ancestors
- Referrer-Policy
- Permissions-Policy

## 8. CSRF dan Session

- Gunakan cookie dengan `HttpOnly`, `Secure`, dan `SameSite` yang sesuai.
- Lindungi aksi mutasi dengan token CSRF jika memakai cookie session.
- Invalidasi session saat logout dan saat reset password.
- Rotasi token setelah login dan pada event penting.

## 9. Proteksi API

- Rate limiting per IP dan per akun.
- Limit ukuran body request.
- Timeout pada request eksternal.
- CORS hanya untuk origin yang diizinkan.
- Jangan membuka endpoint debug di production.
- Error response tidak boleh membocorkan stack trace.

## 10. Proteksi Upload

- Validasi MIME type dan ekstensi.
- Scan file jika diperlukan.
- Simpan file di lokasi terisolasi.
- Gunakan nama file acak, bukan nama asli.
- Jangan mengeksekusi file upload sebagai kode.

## 11. Logging Aman

- Jangan log password, token, OTP, atau secret.
- Redact data sensitif pada log.
- Gunakan correlation ID untuk tracing.
- Pisahkan log aplikasi, akses, dan audit.

## 12. Telemetri dan Pixel

- Event tracking hanya boleh mengirim data yang memang diperlukan.
- Jangan kirim data pribadi mentah tanpa dasar yang jelas.
- Server-side event harus divalidasi agar tidak bisa dipalsukan bot.
- Tandai event duplikat dan buang yang tidak valid.

## 13. Supply Chain Security

- Kunci versi dependency penting.
- Audit dependency secara berkala.
- Gunakan source yang terpercaya.
- Jalankan build di lingkungan yang dapat direproduksi.
- Hindari secret di file config yang masuk ke repository.

## 14. Hardening Operasional

- Matikan port yang tidak dipakai.
- Gunakan firewall.
- Jalankan service dengan user non-root.
- Terapkan backup terenkripsi.
- Lakukan patching rutin.
- Pantau anomali login dan trafik.
