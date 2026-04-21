# Frontend Execution Plan

## 1. Target Implementasi

Frontend akan dieksekusi dengan pendekatan berbasis Next.js untuk seluruh area:

- **Next.js** untuk situs publik.
- **Next.js** untuk portal internal.

Tujuan utamanya adalah membangun frontend yang cepat, SEO-friendly, aman, dan mudah dipelihara.

## 2. Public Site with Next.js

### 2.1 Halaman yang Dibangun

- Beranda
- Promo aktif
- Katalog produk
- Detail produk
- Blog
- Detail artikel
- Lowongan kerja
- Detail lowongan
- Halaman kontak dan konversi WhatsApp

### 2.2 Komponen Inti

- Navbar
- Hero section
- Promo banner
- Product card
- Product detail gallery
- Blog card
- Job card
- CTA section
- Footer
- WhatsApp button
- Pixel wrapper

### 2.3 Aturan Render

- Konten statis dirender melalui Static Generation atau ISR.
- Komponen interaktif hanya diaktifkan bila perlu.
- JavaScript pihak ketiga dibatasi pada kebutuhan yang jelas.
- Data dinamis harus datang dari backend melalui API yang tervalidasi.

### 2.4 SEO Requirements

- title dan meta description per halaman.
- canonical URL.
- Open Graph dan Twitter Card.
- Schema markup untuk Product, Offer, JobPosting, dan Article.
- URL slug yang konsisten dan bersih.

## 3. Internal Portal with Next.js

### 3.1 Area Internal

- Login
- Dashboard agen
- Dashboard admin
- Manajemen katalog
- Manajemen promo
- Manajemen artikel
- Manajemen lowongan
- Telemetri dan laporan
- Manajemen user

### 3.2 Komponen Inti

- Auth form
- Sidebar navigation
- Topbar
- Stats cards
- Table list
- Filter panel
- Modal form
- Toast notification
- Confirm dialog
- Protected route guard

### 3.3 State dan Data Flow

- Semua request sensitif harus melalui backend.
- Token sesi tidak boleh disimpan sembarangan di client.
- Data tabel harus di-fetch dari API dengan pagination.
- Filter dan search harus divalidasi sebelum request dikirim.

## 4. Design System

### 4.1 Prinsip Visual

- Bersih dan profesional.
- Kontras jelas untuk keterbacaan.
- Tipografi tegas dan mudah dibaca.
- Layout responsif untuk desktop dan mobile.

### 4.2 Komponen UI Standar

- Button
- Input
- Select
- Card
- Badge
- Table
- Tabs
- Breadcrumb
- Alert
- Dialog
- Loader

### 4.3 Responsive Rules

- Mobile-first layout.
- Grid yang fleksibel.
- CTA utama harus tetap terlihat di layar kecil.
- Tabel administratif harus memiliki fallback tampilan mobile.

## 5. Conversion Flow

### 5.1 WhatsApp CTA

- Pengunjung memilih produk atau promo.
- Frontend membentuk pesan WhatsApp terisi otomatis.
- Event klik dicatat ke backend.
- Redirect dilakukan setelah event tracking dikirim.

### 5.2 Telemetry Flow

- Page view dicatat pada layout global.
- Klik CTA dicatat sebagai event konversi.
- Event hanya mengandung data yang relevan.
- Duplicate event harus difilter di backend.

## 6. Security Rules

- Hindari `dangerouslySetInnerHTML` bila tidak wajib.
- Sanitasi semua konten yang berasal dari backend.
- Gunakan CSP yang ketat.
- Jangan menanamkan secret di frontend bundle.
- Validasi slug, query parameter, dan route param.
- Batasi script eksternal hanya pada domain yang diizinkan.

## 7. Implementation Order

1. Bangun struktur halaman publik di Next.js.
2. Bangun komponen UI dasar dan design system.
3. Integrasikan API backend untuk katalog, promo, blog, dan lowongan.
4. Tambahkan schema markup dan SEO metadata.
5. Bangun portal internal dengan Next.js.
6. Tambahkan proteksi route dan role-based access.
7. Integrasikan telemetry dan WhatsApp flow.
8. Lakukan hardening security dan uji regresi.

## 8. Acceptance Criteria

Frontend dianggap siap jika:

- halaman publik bisa diakses cepat dan stabil,
- SEO metadata dan schema markup sudah aktif,
- dashboard internal terlindungi autentikasi,
- CTA WhatsApp bekerja dan tercatat di telemetry,
- tidak ada secret sensitif di client,
- komponen utama berjalan responsif di desktop dan mobile.
# Frontend Execution Plan

## 1. Target Implementasi

Frontend akan dieksekusi dengan pendekatan berbasis Next.js untuk seluruh area:

- **Next.js** untuk situs publik.
- **Next.js** untuk portal internal.

Tujuan utamanya adalah membangun frontend yang cepat, SEO-friendly, aman, dan mudah dipelihara.

## 2. Public Site with Next.js

### 2.1 Halaman yang Dibangun

- Beranda
- Promo aktif
- Katalog produk
- Detail produk
- Blog
- Detail artikel
- Lowongan kerja
- Detail lowongan
- Halaman kontak dan konversi WhatsApp

### 2.2 Komponen Inti

- Navbar
- Hero section
- Promo banner
- Product card
- Product detail gallery
- Blog card
- Job card
- CTA section
- Footer
- WhatsApp button
- Pixel wrapper

### 2.3 Aturan Render

- Konten statis dirender sebagai HTML utama.
- Komponen interaktif hanya di-hydrate bila perlu.
- JavaScript pihak ketiga dibatasi pada kebutuhan yang jelas.
- Data dinamis harus datang dari backend melalui API yang tervalidasi.

### 2.4 SEO Requirements

- title dan meta description per halaman.
- canonical URL.
- Open Graph dan Twitter Card.
- Schema markup untuk Product, Offer, JobPosting, dan Article.
- URL slug yang konsisten dan bersih.

## 3. Internal Portal with React/Next.js

### 3.1 Area Internal

- Login
- Dashboard agen
- Dashboard admin
- Manajemen katalog
- Manajemen promo
- Manajemen artikel
- Manajemen lowongan
- Telemetri dan laporan
- Manajemen user

### 3.2 Komponen Inti

- Auth form
- Sidebar navigation
- Topbar
- Stats cards
- Table list
- Filter panel
- Modal form
- Toast notification
- Confirm dialog
- Protected route guard

### 3.3 State dan Data Flow

- Semua request sensitif harus melalui backend.
- Token sesi tidak boleh disimpan sembarangan di client.
- Data tabel harus di-fetch dari API dengan pagination.
- Filter dan search harus divalidasi sebelum request dikirim.

## 4. Design System

### 4.1 Prinsip Visual

- Bersih dan profesional.
- Kontras jelas untuk keterbacaan.
- Tipografi tegas dan mudah dibaca.
- Layout responsif untuk desktop dan mobile.

### 4.2 Komponen UI Standar

- Button
- Input
- Select
- Card
- Badge
- Table
- Tabs
- Breadcrumb
- Alert
- Dialog
- Loader

### 4.3 Responsive Rules

- Mobile-first layout.
- Grid yang fleksibel.
- CTA utama harus tetap terlihat di layar kecil.
- Tabel administratif harus memiliki fallback tampilan mobile.

## 5. Conversion Flow

### 5.1 WhatsApp CTA

- Pengunjung memilih produk atau promo.
- Frontend membentuk pesan WhatsApp terisi otomatis.
- Event klik dicatat ke backend.
- Redirect dilakukan setelah event tracking dikirim.

### 5.2 Telemetry Flow

- Page view dicatat pada layout global.
- Klik CTA dicatat sebagai event konversi.
- Event hanya mengandung data yang relevan.
- Duplicate event harus difilter di backend.

## 6. Security Rules

- Hindari `dangerouslySetInnerHTML` bila tidak wajib.
- Sanitasi semua konten yang berasal dari backend.
- Gunakan CSP yang ketat.
- Jangan menanamkan secret di frontend bundle.
- Validasi slug, query parameter, dan route param.
- Batasi script eksternal hanya pada domain yang diizinkan.

## 7. Implementation Order

1. Bangun struktur halaman publik di Next.js.
2. Bangun komponen UI dasar dan design system.
3. Integrasikan API backend untuk katalog, promo, blog, dan lowongan.
4. Tambahkan schema markup dan SEO metadata.
5. Bangun portal internal dengan Next.js.
6. Tambahkan proteksi route dan role-based access.
7. Integrasikan telemetry dan WhatsApp flow.
8. Lakukan hardening security dan uji regresi.

## 8. Acceptance Criteria

Frontend dianggap siap jika:

- halaman publik bisa diakses cepat dan stabil,
- SEO metadata dan schema markup sudah aktif,
- dashboard internal terlindungi autentikasi,
- CTA WhatsApp bekerja dan tercatat di telemetry,
- tidak ada secret sensitif di client,
- komponen utama berjalan responsif di desktop dan mobile.
