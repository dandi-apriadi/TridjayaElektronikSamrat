# Frontend Architecture

## 1. Tujuan

Frontend bertugas melayani domain publik dan portal terotentikasi dengan dua prioritas utama:

- performa cepat dan stabil,
- struktur yang kuat untuk SEO, telemetri, dan konversi.

## 2. Pembagian Area

### 2.1 Public Site

Area publik mencakup:

- beranda,
- landing page promosi,
- katalog produk,
- artikel blog,
- halaman lowongan kerja,
- halaman kontak dan konversi WhatsApp.

Karakteristik area ini:

- sebagian besar statis,
- harus mudah diindeks mesin pencari,
- minim JavaScript agar loading ringan,
- aman dari injeksi markup dan script pihak ketiga yang tidak perlu.

### 2.2 Authenticated Portal

Area terotentikasi mencakup:

- dashboard agen,
- panel admin,
- manajemen katalog,
- manajemen promo,
- laporan telemetri,
- manajemen lowongan dan artikel.

Karakteristik area ini:

- lebih interaktif,
- membutuhkan state kompleks,
- tidak fokus pada SEO publik,
- wajib dilindungi autentikasi dan otorisasi yang ketat.

## 3. Rekomendasi Framework

### 3.1 Next.js untuk Public Site

Next.js dipilih untuk halaman publik karena:

- mendukung Static Generation dan ISR untuk halaman cepat,
- JavaScript dapat diaktifkan hanya pada komponen tertentu,
- cocok untuk halaman SEO dan konten editorial,
- memudahkan pemisahan komponen yang interaktif dan non-interaktif.

### 3.2 Next.js untuk Portal Internal

Next.js dipakai untuk portal internal karena:

- mendukung UI yang dinamis,
- nyaman untuk dashboard dan form kompleks,
- mudah dipadukan dengan role-based access control,
- cocok untuk area yang sering berubah.

## 4. Struktur Halaman

### 4.1 Publik

- `/` beranda.
- `/promo` daftar promosi aktif.
- `/produk` katalog kendaraan.
- `/produk/[slug]` detail produk.
- `/blog` daftar artikel.
- `/blog/[slug]` detail artikel.
- `/karier` daftar lowongan.
- `/karier/[slug]` detail lowongan.

### 4.2 Internal

- `/login` autentikasi pengguna.
- `/dashboard` ringkasan peran dan aktivitas.
- `/dashboard/agen` manajemen agen.
- `/dashboard/katalog` manajemen produk.
- `/dashboard/promo` manajemen promo.
- `/dashboard/telemetri` laporan klik dan konversi.
- `/admin/users` manajemen akses pengguna.

## 5. SEO dan Semantik

Setiap halaman publik harus memakai struktur semantik yang jelas:

- `header`, `nav`, `main`, `article`, `section`, `footer`.
- heading bertingkat dengan urutan yang benar.
- metadata yang konsisten untuk title, description, canonical, dan Open Graph.
- schema markup untuk `Product`, `Offer`, `JobPosting`, dan `Article`.

## 6. Telemetri dan Konversi

Tracking harus dilakukan dengan kontrol yang hati-hati:

- pixel hanya dipasang pada layout global,
- event hanya dikirim dari interaksi yang valid,
- klik WhatsApp harus dicatat sebelum redirect,
- payload tracking tidak boleh berisi data sensitif yang berlebihan.

## 7. Proteksi Frontend

- Hindari penggunaan `dangerouslySetInnerHTML` kecuali benar-benar terkontrol.
- Sanitasi semua input yang ditampilkan kembali ke UI.
- Validasi slug, query param, dan data dinamis sebelum rendering.
- Gunakan Content Security Policy yang ketat.
- Batasi script pihak ketiga hanya pada kebutuhan yang benar-benar dibutuhkan.
- Jangan menaruh secret atau token sensitif di client bundle.
# Frontend Architecture

## 1. Tujuan

Frontend bertugas melayani domain publik dan portal terotentikasi dengan dua prioritas utama:

- performa cepat dan stabil,
- struktur yang kuat untuk SEO, telemetri, dan konversi.

## 2. Pembagian Area

### 2.1 Public Site

Area publik mencakup:

- beranda,
- landing page promosi,
- katalog produk,
- artikel blog,
- halaman lowongan kerja,
- halaman kontak dan konversi WhatsApp.

Karakteristik area ini:

- sebagian besar statis,
- harus mudah diindeks mesin pencari,
- minim JavaScript agar loading ringan,
- aman dari injeksi markup dan script pihak ketiga yang tidak perlu.

### 2.2 Authenticated Portal

Area terotentikasi mencakup:

- dashboard agen,
- panel admin,
- manajemen katalog,
- manajemen promo,
- laporan telemetri,
- manajemen lowongan dan artikel.

Karakteristik area ini:

- lebih interaktif,
- membutuhkan state kompleks,
- tidak fokus pada SEO publik,
- wajib dilindungi autentikasi dan otorisasi yang ketat.

## 3. Rekomendasi Framework

### 3.1 Next.js untuk Public Site

Next.js dipilih untuk halaman publik karena:

- mendukung Static Generation dan ISR untuk halaman cepat,
- JavaScript dapat diaktifkan hanya pada komponen tertentu,
- cocok untuk halaman SEO dan konten editorial,
- memudahkan pemisahan komponen yang interaktif dan non-interaktif.

### 3.2 Next.js untuk Portal Internal

Next.js dipakai untuk portal internal karena:

- mendukung UI yang dinamis,
- nyaman untuk dashboard dan form kompleks,
- mudah dipadukan dengan role-based access control,
- cocok untuk area yang sering berubah.

## 4. Struktur Halaman

### 4.1 Publik

- `/` beranda.
- `/promo` daftar promosi aktif.
- `/produk` katalog kendaraan.
- `/produk/[slug]` detail produk.
- `/blog` daftar artikel.
- `/blog/[slug]` detail artikel.
- `/karier` daftar lowongan.
- `/karier/[slug]` detail lowongan.

### 4.2 Internal

- `/login` autentikasi pengguna.
- `/dashboard` ringkasan peran dan aktivitas.
- `/dashboard/agen` manajemen agen.
- `/dashboard/katalog` manajemen produk.
- `/dashboard/promo` manajemen promo.
- `/dashboard/telemetri` laporan klik dan konversi.
- `/admin/users` manajemen akses pengguna.

## 5. SEO dan Semantik

Setiap halaman publik harus memakai struktur semantik yang jelas:

- `header`, `nav`, `main`, `article`, `section`, `footer`.
- heading bertingkat dengan urutan yang benar.
- metadata yang konsisten untuk title, description, canonical, dan Open Graph.
- schema markup untuk `Product`, `Offer`, `JobPosting`, dan `Article`.

## 6. Telemetri dan Konversi

Tracking harus dilakukan dengan kontrol yang hati-hati:

- pixel hanya dipasang pada layout global,
- event hanya dikirim dari interaksi yang valid,
- klik WhatsApp harus dicatat sebelum redirect,
- payload tracking tidak boleh berisi data sensitif yang berlebihan.

## 7. Proteksi Frontend

- Hindari penggunaan `dangerouslySetInnerHTML` kecuali benar-benar terkontrol.
- Sanitasi semua input yang ditampilkan kembali ke UI.
- Validasi slug, query param, dan data dinamis sebelum rendering.
- Gunakan Content Security Policy yang ketat.
- Batasi script pihak ketiga hanya pada kebutuhan yang benar-benar dibutuhkan.
- Jangan menaruh secret atau token sensitif di client bundle.
