# Backend Architecture

## 1. Tujuan

Backend menjadi pusat logika sistem untuk:

- autentikasi dan otorisasi,
- manajemen katalog,
- manajemen agen,
- pendaftaran lowongan,
- pengelolaan konten,
- pencatatan telemetri,
- integrasi WhatsApp dan iklan.

## 2. Stack yang Direkomendasikan

- Rust sebagai bahasa utama.
- Loco.rs sebagai application framework.
- SeaORM untuk akses database.
- PostgreSQL sebagai database utama.
- Redis opsional untuk cache, rate limit, dan job queue.
- Nginx sebagai reverse proxy.

## 3. Modul Inti

### 3.1 Auth Service

Fungsi:

- login,
- logout,
- refresh token,
- reset password,
- validasi sesi,
- role enforcement.

Kontrol keamanan:

- password hashing kuat,
- token berumur pendek,
- refresh token disimpan aman,
- session invalidation saat password diganti,
- audit log untuk aktivitas sensitif.

### 3.2 User and Role Management

Role minimal:

- admin,
- agent,
- editor,
- operator.

Aturan:

- setiap endpoint mutasi wajib cek role,
- akses data harus dibatasi berdasarkan scope,
- admin global tidak boleh menjadi default untuk semua akun.

### 3.3 Catalog Service

Tugas:

- CRUD produk,
- harga OTR,
- varian warna,
- stok status,
- promosi terkait,
- asset gambar.

Kontrol keamanan:

- validasi seluruh field numerik dan string,
- pembatasan format file upload,
- path asset tidak boleh dibangun dari input mentah,
- semua perubahan dicatat di audit trail.

### 3.4 Referral Service

Tugas:

- membuat referal unik per agen dan produk,
- menghitung klik valid,
- mencatat sumber kampanye,
- memetakan lead ke agen.

Kontrol keamanan:

- slug harus random dan tidak mudah ditebak,
- cek duplikasi sebelum pembuatan tautan,
- cegah manipulasi referer dan query param,
- gunakan server-side verification untuk event penting.

### 3.5 Telemetry Service

Tugas:

- mencatat page view,
- klik tombol WhatsApp,
- event campaign,
- event form submission,
- sinkronisasi ke pixel pihak ketiga.

Kontrol keamanan:

- batasi data yang dikirim,
- hindari logging data pribadi mentah,
- tandai event yang sudah tervalidasi,
- cegah spam event dari bot.

### 3.6 Content Service

Tugas:

- artikel blog,
- lowongan kerja,
- landing page promosi,
- metadata SEO,
- status publish dan draft.

Kontrol keamanan:

- editor harus sanitasi markdown dan rich text,
- hanya role tertentu yang bisa publish,
- riwayat revisi harus tersimpan.

## 4. API Design

API harus dibangun dengan prinsip:

- REST yang konsisten,
- response schema stabil,
- status code jelas,
- validasi input di layer awal,
- error message tidak membocorkan detail internal.

Contoh kelompok endpoint:

- `/api/auth/*`
- `/api/users/*`
- `/api/catalogs/*`
- `/api/promotions/*`
- `/api/referrals/*`
- `/api/telemetry/*`
- `/api/jobs/*`
- `/api/articles/*`

## 5. Background Jobs

Background jobs dipakai untuk:

- sinkronisasi data marketing,
- pengiriman email notifikasi,
- agregasi statistik,
- pemrosesan laporan periodik,
- ekspor data.

Aturan keamanan:

- task harus idempotent,
- retry harus dibatasi,
- job tidak boleh memegang secret secara hardcoded,
- hasil task wajib diverifikasi.

## 6. Logging dan Audit

Semua aktivitas sensitif wajib dicatat:

- login gagal dan sukses,
- perubahan role,
- publish konten,
- perubahan katalog,
- pembuatan referral,
- konversi penting.

Log harus:

- terstruktur,
- mudah dicari,
- tidak menyimpan password atau token,
- memiliki korelasi request ID.

## 7. Proteksi Backend

- Validasi semua input di server, jangan bergantung pada frontend.
- Gunakan parameterized query atau ORM secara konsisten.
- Terapkan rate limiting pada endpoint sensitif.
- Terapkan CSRF protection untuk aksi berbasis cookie.
- Tambahkan timeout pada request eksternal.
- Batasi ukuran payload dan upload file.
- Pisahkan privilege service account.
- Gunakan prinsip least privilege untuk semua integrasi.
