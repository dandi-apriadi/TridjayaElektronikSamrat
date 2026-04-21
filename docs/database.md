# Database Design

## 1. Tujuan

Database harus menjadi sumber data yang konsisten, aman, dan mudah diaudit untuk seluruh sistem.

## 2. Prinsip Desain

- Normalisasi untuk data inti.
- Denormalisasi hanya bila ada alasan performa yang jelas.
- Semua tabel sensitif harus memiliki primary key yang kuat.
- Gunakan foreign key untuk menjaga integritas relasi.
- Simpan audit trail untuk perubahan penting.

## 3. Entitas Utama

### 3.1 users

Menyimpan admin, agen, editor, dan operator.

Kolom penting:

- `id`
- `email`
- `password_hash`
- `role`
- `full_name`
- `phone_number`
- `is_active`
- `created_at`
- `updated_at`

### 3.2 product_catalogs

Menyimpan data kendaraan dan detail publik.

Kolom penting:

- `id`
- `model_name`
- `sku_code`
- `base_price_otr`
- `minimum_dp`
- `engine_capacity`
- `color_variants`
- `image_storage_path`
- `is_published`

### 3.3 promotional_campaigns

Menyimpan promo aktif dan riwayat kampanye.

Kolom penting:

- `id`
- `campaign_title`
- `discount_nominal`
- `start_date`
- `end_date`
- `status`
- `linked_product_ids`

### 3.4 agent_referral_links

Menyimpan tautan referal unik per agen dan produk.

Kolom penting:

- `id`
- `agent_id`
- `product_id`
- `unique_slug`
- `total_clicks`
- `generated_at`
- `expires_at`

### 3.5 telemetry_lead_logs

Menyimpan jejak konversi dan event penting.

Kolom penting:

- `id`
- `referral_link_id`
- `visitor_session_id`
- `utm_source`
- `utm_medium`
- `action_status`
- `created_at`

### 3.6 job_postings

Menyimpan lowongan kerja publik.

### 3.7 blog_articles

Menyimpan konten editorial dan SEO.

## 4. Relasi Data

- `users` 1..n `agent_referral_links`
- `product_catalogs` 1..n `agent_referral_links`
- `agent_referral_links` 1..n `telemetry_lead_logs`
- `users` 1..n `blog_articles`
- `users` 1..n `job_postings`

## 5. Indeks yang Direkomendasikan

- indeks unik pada `email`.
- indeks unik pada `unique_slug`.
- indeks pada `agent_id` dan `product_id`.
- indeks pada `created_at` untuk tabel log.
- indeks komposit pada kombinasi yang sering dipakai untuk filter laporan.

## 6. Kebijakan Keamanan Data

- Password hanya disimpan dalam bentuk hash.
- Token tidak boleh disimpan sebagai plain text.
- Data pribadi yang tidak dibutuhkan tidak boleh dikoleksi.
- Tabel log tidak boleh menyimpan payload berlebihan.
- Backup harus terenkripsi.
- Restore harus diuji secara berkala.

## 7. Retensi dan Arsip

- Log telemetri lama dapat diarsipkan.
- Data kampanye yang sudah selesai tetap disimpan untuk audit.
- Data akun nonaktif harus tetap ada untuk jejak historis, tetapi tidak bisa login.
