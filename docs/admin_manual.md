# Admin Manual (Operational)

## 1. Login dan Akses

1. Gunakan akun ber-role `admin`.
2. Login melalui halaman dashboard.
3. Jika token kedaluwarsa, lakukan login ulang.

## 2. Manajemen User

1. Buka menu Users.
2. Tambah user baru dengan email unik dan role valid (`admin`, `agent`, `editor`, `operator`).
3. Saat reset kredensial, gunakan password minimal 8 karakter.

## 3. Manajemen Katalog

1. Buka menu Catalog.
2. Isi field wajib: slug, nama, kategori, image, dan harga.
3. Gunakan status stok: `available`, `indent`, atau `hidden`.

## 4. Manajemen Promo

1. Buka menu Promo.
2. Isi judul, image, periode berlaku, dan produk terkait.
3. Pastikan `promoPrice` tidak lebih besar dari `originalPrice`.

## 5. Artikel dan Karir

1. Artikel: pastikan slug unik dan judul terisi.
2. Jobs: pastikan title terisi sebelum publish.

## 6. Workflow Agen

1. Tinjau pendaftaran agen dari menu Agent Registrations.
2. Update status registration: `pending`, `reviewed`, `approved`, `rejected`.
3. Pantau klaim reward agen di menu Claims.
4. Update status klaim: `pending`, `processing`, `completed`, `cancelled`.

## 7. Telemetry dan Monitoring

1. Buka menu Telemetry.
2. Pantau traffic harian, source clicks, dan error logs.
3. Jika ada lonjakan error, cek log backend terlebih dahulu.

## 8. Operasional Harian

1. Backup database SQLite secara berkala.
2. Validasi data input sebelum publikasi.
3. Jangan bagikan access token ke pihak lain.
4. Gunakan environment variable untuk konfigurasi API.
