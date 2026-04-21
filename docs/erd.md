# ERD and Data Relationships

## 1. Purpose

Dokumen ini menjelaskan entitas inti dan hubungan antar tabel dalam sistem.

## 2. Core Entities

### 2.1 users

Mewakili admin, agen, editor, dan operator.

### 2.2 product_catalogs

Menyimpan data kendaraan yang ditampilkan ke publik.

### 2.3 promotional_campaigns

Menyimpan kampanye promo yang terkait dengan produk.

### 2.4 agent_referral_links

Menyimpan tautan referal unik untuk agen dan produk tertentu.

### 2.5 telemetry_lead_logs

Menyimpan event klik dan konversi dari referral link.

### 2.6 job_postings

Menyimpan lowongan kerja publik.

### 2.7 blog_articles

Menyimpan artikel editorial dan konten SEO.

## 3. Relationships

- Satu `user` dapat memiliki banyak `agent_referral_links`.
- Satu `product_catalog` dapat dipakai oleh banyak `agent_referral_links`.
- Satu `agent_referral_link` dapat menghasilkan banyak `telemetry_lead_logs`.
- Satu `user` dapat membuat banyak `blog_articles`.
- Satu `user` dapat membuat banyak `job_postings`.
- Satu `promotional_campaign` dapat terkait ke banyak produk melalui relasi penghubung.

## 4. Suggested Constraints

- `users.email` harus unik.
- `agent_referral_links.unique_slug` harus unik.
- `product_catalogs.sku_code` harus unik bila dipakai sebagai kode internal.
- Foreign key harus diberi aturan delete yang sesuai kebutuhan bisnis.
- Field numerik seperti harga dan diskon harus divalidasi agar tidak negatif.

## 5. Audit-Oriented Tables

Tabel yang paling penting untuk audit:

- `telemetry_lead_logs`
- `agent_referral_links`
- `promotional_campaigns`
- `users`

## 6. Data Safety Notes

- Simpan password hanya sebagai hash.
- Jangan menyimpan token atau secret di tabel bisnis.
- Log aktivitas harus cukup untuk audit tetapi tidak berlebihan.
- Gunakan timestamp konsisten dengan timezone yang ditetapkan sistem.
