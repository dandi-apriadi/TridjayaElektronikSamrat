# Deployment and Operations

## 1. Tujuan

Deployment harus menghasilkan sistem yang cepat, stabil, dan mudah dipelihara tanpa membuka risiko keamanan tambahan.

## 2. Layout Produksi

Rekomendasi layout:

- Frontend publik ditempatkan di CDN atau platform static hosting.
- Backend Rust berjalan di VPS Indonesia.
- PostgreSQL berjalan di server yang sama atau server terpisah dengan akses terbatas.
- Nginx menjadi reverse proxy di depan backend.

## 3. Environment Variables

- Semua secret disimpan sebagai environment variable atau secret manager.
- Tidak ada secret yang ditulis langsung ke source code.
- File `.env` tidak boleh masuk repository.
- Nilai konfigurasi sensitif harus dipisah antara staging dan production.

## 4. Build Strategy

- Gunakan release build untuk backend Rust.
- Gunakan static binary bila memungkinkan.
- Aktifkan optimisasi yang sesuai untuk production.
- Cache asset frontend secara efisien.
- Minify dan compress file statis.

## 5. Reverse Proxy

Nginx harus menangani:

- TLS termination,
- redirect HTTP ke HTTPS,
- rate limiting dasar,
- pengaturan header keamanan,
- routing ke backend internal,
- pemisahan asset statis dan API.

## 6. TLS dan Domain

- Seluruh traffic wajib HTTPS.
- Gunakan sertifikat yang diperbarui otomatis.
- Nonaktifkan protokol lama yang lemah.
- Redirect semua akses non-HTTPS ke HTTPS.

## 7. Monitoring

Minimal monitor:

- uptime service,
- latency API,
- error rate,
- CPU dan memory,
- ukuran log,
- disk usage,
- jumlah login gagal,
- anomali traffic.

## 8. Backup dan Restore

- Backup database harian.
- Backup file media secara terpisah.
- Enkripsi backup sebelum disimpan.
- Uji restore secara berkala.
- Simpan salinan backup di lokasi berbeda.

## 9. Release Process

1. Build di environment terisolasi.
2. Jalankan test dan validasi schema.
3. Deploy ke staging.
4. Verifikasi manual fitur kritis.
5. Promote ke production bila lolos.
6. Simpan rollback plan yang jelas.

## 10. Operasional Aman

- Akses server hanya untuk user yang berwenang.
- Gunakan SSH key, bukan password.
- Nonaktifkan login root langsung jika memungkinkan.
- Audit perubahan konfigurasi.
- Hentikan service yang tidak dipakai.
- Review log akses secara rutin.
