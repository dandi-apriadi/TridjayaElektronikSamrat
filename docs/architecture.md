# System Architecture

## 1. Overview

Sistem Tridjaya Motor Samrat dibagi menjadi dua domain utama:

- **Public Experience Layer** untuk pengunjung umum dan SEO.
- **Operational Layer** untuk admin, agen, dan tim internal.

Pemisahan ini menjaga performa, keamanan, dan kemudahan pemeliharaan.

## 2. High-Level Flow

1. Pengguna membuka halaman publik melalui frontend Next.js.
2. Pengguna melihat katalog, promo, artikel, atau lowongan.
3. Jika terjadi klik konversi, frontend mencatat event telemetri.
4. Pengguna diarahkan ke WhatsApp Business.
5. Admin atau agen menggunakan portal terotentikasi untuk mengelola data.
6. Backend Rust memproses data, validasi, otorisasi, dan audit.
7. PostgreSQL menyimpan data operasional dan telemetry.

## 3. Frontend Layer

### 3.1 Public Frontend

- Next.js untuk landing page, katalog, blog, dan job posting.
- Static Generation atau ISR sebagai default.
- JavaScript hanya untuk komponen interaktif yang dibutuhkan.

### 3.2 Internal Frontend

- Next.js untuk dashboard dan panel admin.
- State management dipakai hanya pada area yang benar-benar kompleks.
- Akses dibatasi melalui autentikasi dan otorisasi server-side.

## 4. Backend Layer

- Rust sebagai runtime utama.
- Loco.rs untuk struktur aplikasi tingkat tinggi.
- SeaORM untuk akses database.
- Job queue untuk proses yang tidak perlu sinkron.
- API dipisahkan berdasarkan domain bisnis.

## 5. Data Layer

- PostgreSQL sebagai sumber data utama.
- Relasi antar entitas dijaga dengan foreign key.
- Logging dan audit disimpan terpisah dari data operasional utama bila diperlukan.
- Backup dan restore harus menjadi bagian dari operasi rutin.

## 6. Integration Layer

Integrasi utama yang diperlukan:

- WhatsApp Business link atau API.
- Meta Pixel.
- TikTok Pixel.
- Email service.
- Storage service untuk asset gambar.

## 7. Security Boundaries

- Frontend tidak boleh dipercaya sebagai sumber otorisasi.
- Backend harus menjadi satu-satunya pengambil keputusan akses.
- Event telemetri harus divalidasi di server.
- Secret hanya boleh hidup di server atau secret manager.
- Komponen publik dan internal harus dipisahkan secara jelas.

## 8. Deployment Boundary

- Frontend publik dapat ditempatkan di CDN.
- Backend Rust berjalan di VPS internal dengan reverse proxy.
- Database tidak diekspos langsung ke publik.
- Hanya port yang dibutuhkan yang dibuka ke internet.
# System Architecture

## 1. Overview

Sistem Tridjaya Motor Samrat dibagi menjadi dua domain utama:

- **Public Experience Layer** untuk pengunjung umum dan SEO.
- **Operational Layer** untuk admin, agen, dan tim internal.

Pemisahan ini menjaga performa, keamanan, dan kemudahan pemeliharaan.

## 2. High-Level Flow

1. Pengguna membuka halaman publik melalui frontend statis.
2. Pengguna melihat katalog, promo, artikel, atau lowongan.
3. Jika terjadi klik konversi, frontend mencatat event telemetri.
4. Pengguna diarahkan ke WhatsApp Business.
5. Admin atau agen menggunakan portal terotentikasi untuk mengelola data.
6. Backend Rust memproses data, validasi, otorisasi, dan audit.
7. PostgreSQL menyimpan data operasional dan telemetry.

## 3. Frontend Layer

### 3.1 Public Frontend

- Next.js untuk landing page, katalog, blog, dan job posting.
- Static Generation atau ISR sebagai default.
- JavaScript hanya untuk komponen interaktif yang dibutuhkan.

### 3.2 Internal Frontend

- React atau Next.js untuk dashboard dan panel admin.
- State management dipakai hanya pada area yang benar-benar kompleks.
- Akses dibatasi melalui autentikasi dan otorisasi server-side.

## 4. Backend Layer

- Rust sebagai runtime utama.
- Loco.rs untuk struktur aplikasi tingkat tinggi.
- SeaORM untuk akses database.
- Job queue untuk proses yang tidak perlu sinkron.
- API dipisahkan berdasarkan domain bisnis.

## 5. Data Layer

- PostgreSQL sebagai sumber data utama.
- Relasi antar entitas dijaga dengan foreign key.
- Logging dan audit disimpan terpisah dari data operasional utama bila diperlukan.
- Backup dan restore harus menjadi bagian dari operasi rutin.

## 6. Integration Layer

Integrasi utama yang diperlukan:

- WhatsApp Business link atau API.
- Meta Pixel.
- TikTok Pixel.
- Email service.
- Storage service untuk asset gambar.

## 7. Security Boundaries

- Frontend tidak boleh dipercaya sebagai sumber otorisasi.
- Backend harus menjadi satu-satunya pengambil keputusan akses.
- Event telemetri harus divalidasi di server.
- Secret hanya boleh hidup di server atau secret manager.
- Komponen publik dan internal harus dipisahkan secara jelas.

## 8. Deployment Boundary

- Frontend publik dapat ditempatkan di CDN.
- Backend Rust berjalan di VPS internal dengan reverse proxy.
- Database tidak diekspos langsung ke publik.
- Hanya port yang dibutuhkan yang dibuka ke internet.
