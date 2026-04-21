# Rancang Bangun Ekosistem Digital Terintegrasi untuk Tridjaya Motor Samrat

## 1. Latar Belakang

Peralihan paradigma operasional menuju digitalisasi terpusat dalam industri otomotif lokal menuntut infrastruktur teknologi yang lebih dari sekadar tampilan visual. Tridjaya Motor Samrat, diler resmi Honda di Jalan Sam Ratulangi No. 7, Wenang Utara, Kota Manado, memiliki kebutuhan operasional yang kompleks dan sangat dipengaruhi oleh kampanye pemasaran tematik.

Contoh kampanye historis seperti **Promo Oktober Hemat** dan **Program Ho Hoo Yes** menunjukkan bahwa strategi penjualan banyak bertumpu pada kombinasi penurunan uang muka, pemotongan angsuran, dan bonus tambahan seperti voucher belanja untuk produk dengan perputaran cepat, misalnya Honda BeAT Sporty dan Honda Scoopy.

## 2. Kebutuhan Sistem

Untuk mendistribusikan penawaran tersebut ke target demografis secara efektif, struktur sumber daya manusia Tridjaya Motor Samrat bergantung pada:

- Sales Counter
- Telemarketing
- Marketing Executive

Para tenaga pemasaran ini diwajibkan aktif pada platform seperti Instagram, Facebook, dan TikTok. Namun, pemasaran yang terdesentralisasi tanpa pelacakan hierarkis menimbulkan masalah utama: data atribusi tersebar dan manajemen pusat sulit mengukur efektivitas konversi tiap kampanye.

Karena itu, dibutuhkan sebuah platform web yang tidak hanya menampilkan landing page dan katalog produk, tetapi juga berfungsi sebagai mesin telemetri yang mencakup:

- pendaftaran agen,
- portal lowongan kerja,
- artikel blog,
- panel admin,
- dan jalur transaksi utama menuju WhatsApp Business 085161542103.

## 3. Arsitektur Frontend

Keberhasilan platform sangat bergantung pada visibilitas organik di mesin pencari. Pencarian berniat tinggi seperti "Diler Motor Honda Manado" atau "Harga Honda Vario 125 Sulawesi Utara" harus didukung oleh frontend yang cepat, ringan, dan ramah crawler.

### 3.1 Pemilihan Framework

Kandidat utama yang dipilih untuk frontend publik adalah **Next.js** berbasis React.

**Next.js** cocok untuk domain publik karena mendukung Static Generation, Server-Side Rendering, dan Incremental Static Regeneration. Hal ini membuat halaman seperti landing page promosi, blog, katalog produk, dan lowongan kerja dapat dioptimalkan untuk SEO, sementara komponen interaktif tetap dapat diisolasi pada bagian yang memang membutuhkan JavaScript.

**Next.js** cocok untuk area yang memerlukan rendering dinamis, seperti portal agen dan panel admin. Dengan dukungan SSR dan ISR, konten yang sering berubah dapat diperbarui tanpa membangun ulang seluruh situs.

### 3.2 Komparasi Singkat

| Indikator | Next.js | Nuxt JS | SvelteKit | Catatan |
|---|---|---|---|---|
| Speed Index (SI) | Sangat kompetitif untuk halaman publik statis dan hibrida | Berbasis Vue, kompromi antara performa dan interaktivitas | Bundel ringan | Disesuaikan dengan kebutuhan SEO |
| Largest Contentful Paint (LCP) | Kuat pada halaman yang dioptimalkan dengan SSG/ISR | Mengikuti peringkat tengah | Mengikuti peringkat tengah | Fokus pada pengalaman pengguna |
| Skalabilitas & Pemeliharaan | Fleksibel, tetapi manajemen state lebih kompleks | Konfigurasi berbasis Vue | Tanpa DOM virtual, memori sangat rendah | Pilihan utama proyek |
| Fokus SEO | SSR, SSG, ISR, dan metadata granular | SSR dan render hibrida | Bundel minimal ke klien | Cocok untuk publik dan portal |

Berdasarkan komparasi tersebut, strategi yang paling rasional adalah pendekatan berbasis Next.js:

- **Next.js** untuk halaman publik: beranda, landing page promosi, direktori lowongan, katalog produk, dan blog.
- **Next.js** untuk wilayah terotentikasi: portal agen dan panel admin.

## 4. Struktur Markup Semantik

Optimasi SEO tidak hanya bergantung pada kecepatan, tetapi juga pada struktur HTML yang jelas bagi crawler.

### 4.1 Lowongan Kerja

Halaman lowongan untuk posisi seperti Telemarketing dan Sales Counter perlu memakai Schema.org tipe **JobPosting** dengan elemen berikut:

- gaji pokok,
- lokasi operasional di Manado,
- tenggat pendaftaran,
- kualifikasi pendidikan,
- pengalaman kerja.

Tujuannya adalah agar lowongan dapat tampil pada fitur seperti Google for Jobs.

### 4.2 Katalog Produk

Halaman detail motor Honda perlu memakai Schema.org tipe **Product** dan **Offer** dengan atribut seperti:

- harga OTR Manado,
- status ketersediaan,
- varian warna,
- tanggal kedaluwarsa promo.

Dengan struktur ini, produk berpeluang tampil sebagai rich snippet di hasil pencarian.

## 5. Backend Rust

Backend bertanggung jawab atas:

- otentikasi admin,
- sinkronisasi katalog,
- pendaftaran agen,
- validasi token referal,
- pencatatan klik menuju WhatsApp,
- penyediaan API untuk frontend.

Untuk kebutuhan performa tinggi dan efisiensi memori, bahasa yang dipilih adalah **Rust**.

### 5.1 Framework Rust Web

Dua framework utama yang relevan adalah **Actix-Web** dan **Axum**.

- Actix-Web dikenal sangat cepat dan memiliki latensi rendah.
- Axum lebih ergonomis, modular, dan didukung ekosistem Tokio serta Tower.

Namun, membangun CMS, autentikasi agen, dan orkestrasi database dari nol akan memakan waktu besar. Karena itu diperlukan framework tingkat aplikasi yang lebih tinggi.

### 5.2 Loco.rs

Solusi yang dipilih adalah **Loco.rs**, yang berfungsi sebagai kerangka kerja berbasis MVC untuk ekosistem Rust.

Fitur yang disediakan mencakup:

- otentikasi JWT,
- manajemen sesi,
- pendaftaran dan validasi akun,
- forgot password,
- integrasi ORM melalui SeaORM,
- background task untuk proses asinkron,
- manajemen aset gambar.

## 6. Desain Basis Data

PostgreSQL menjadi pusat memori bagi seluruh sistem. Struktur data dibagi menjadi tiga pilar:

- **Pilar Personalia**: pengguna, agen, lowongan.
- **Pilar Inventaris**: katalog kendaraan, promosi.
- **Pilar Telemetri Referal**: tautan agen, klik, distribusi.

### 6.1 Skema Tabel Inti

| Nama Tabel | Fungsi | Atribut Utama |
|---|---|---|
| `users` | Profil admin dan agen | `id`, `email`, `password_hash`, `role`, `full_name`, `phone_number`, `is_active`, `created_at` |
| `product_catalogs` | Data inventaris kendaraan | `id`, `model_name`, `sku_code`, `base_price_otr`, `minimum_dp`, `engine_capacity`, `color_variants`, `image_storage_path` |
| `promotional_campaigns` | Konfigurasi promo | `id`, `campaign_title`, `discount_nominal`, `start_date`, `end_date`, `linked_product_ids` |
| `agent_referral_links` | Tautan referal unik per agen | `id`, `agent_id`, `product_id`, `unique_slug`, `total_clicks`, `generated_at` |
| `telemetry_lead_logs` | Log klik dan konversi | `id`, `referral_link_id`, `visitor_session_id`, `timestamp`, `utm_source`, `action_status` |
| `job_postings` | Portal karier | `id`, `job_title`, `responsibilities_desc`, `qualifications_desc`, `status`, `published_date` |
| `blog_articles` | CMS artikel editorial | `id`, `author_id`, `title`, `slug`, `markdown_content`, `meta_description`, `published_at` |

## 7. Alur Kerja Agen

Alur referal dirancang agar pelacakan atribusi transparan dari awal hingga akhir.

1. Kandidat melamar melalui tabel `job_postings`.
2. Setelah diterima, admin membuat akun agen di tabel `users`.
3. Agen login ke dashboard dan memilih produk dari `product_catalogs`.
4. Sistem membuat URL referal unik, misalnya `tridjayasamrat.com/ref/AG-STYLO-942`.
5. Tautan tersebut disebarkan melalui Instagram, TikTok, Facebook, atau komunitas lain.
6. Saat calon pembeli membuka tautan, sistem mencatat sesi awal ke `telemetry_lead_logs`.
7. Ketika tombol WhatsApp ditekan, status log diubah menjadi konversi berhasil.

Dengan mekanisme ini, manajemen dapat mengetahui sumber prospek dan efektivitas tiap agen secara jelas.

## 8. Orkestrasi WhatsApp

Untuk pasar otomotif Indonesia, alur konversi terbaik adalah komunikasi langsung melalui WhatsApp, bukan checkout konvensional. Karena itu, keranjang belanja dihilangkan dan diganti dengan tombol menuju WhatsApp Business 085161542103.

### 8.1 Pesan Siap Kirim

Saat tombol konversi ditekan, sistem membentuk URL dengan pesan awal yang sudah terisi, misalnya:

```text
https://wa.me/6285161542103?text=Halo representatif Tridjaya Motor Samrat, saya tertarik untuk mengajukan konsultasi/pemesanan kendaraan melalui informasi katalog di situs web.

Rincian ketertarikan:
- Model kendaraan:
- Referensi harga OTR:
- Kampanye promo aktif:
- Kode agen representatif:

Mohon arahannya terkait persetujuan survei dokumen pembiayaan dan simulasi cicilan bulanan. Terima kasih.
```

### 8.2 WhatsApp Business API

Jika volume pesan meningkat, sistem dapat dikembangkan ke **WhatsApp Business API** untuk:

- template pesan utilitas dan marketing,
- integrasi backend-to-backend,
- jawaban otomatis untuk stok dan varian,
- broadcast promosi yang lebih aman dari risiko pemblokiran.

## 9. Telemetri Pixel

Target utama sistem adalah optimasi kampanye Meta Ads dan TikTok Ads melalui data konversi yang akurat.

### 9.1 Inisialisasi Dasar

Pixel Meta dan TikTok harus dipasang sekali di layout utama, bukan melalui injeksi HTML berulang, untuk menghindari hydration mismatch.

### 9.2 Pelacakan Klik

Saat tombol WhatsApp ditekan, sistem harus mencatat peristiwa berikut sebelum pengalihan terjadi:

- Meta Pixel: `Contact` atau `Lead`
- TikTok Pixel: `ClickButton`

Jika navigasi dilakukan terlalu cepat, payload pelacakan bisa batal terkirim. Karena itu, pengalihan harus dikelola secara asinkron.

### 9.3 Server-Side Tracking

Untuk mengantisipasi pemblokiran browser dan ad-blocker, sistem perlu disiapkan menuju:

- Meta Conversions API,
- TikTok Events API.

Pendekatan ini membuat data konversi tetap terkirim meski pelacakan berbasis browser dibatasi.

## 10. Hosting dan Deployment

Karena target pengguna berada di Sulawesi Utara, peladen harus diletakkan di Indonesia agar latensi tetap rendah. VPS luar negeri dapat menambah delay yang tidak efisien bagi pengalaman pengguna.

### 10.1 Penyedia Lokal

Dua opsi yang relevan adalah:

- Biznet Gio Cloud,
- IDCloudHost.

Biznet Gio unggul pada performa NVMe dan jaringan lokal yang kuat. IDCloudHost unggul pada kelengkapan layanan seperti load balancer dan object storage.

### 10.2 Deployment Rust

Backend Rust sebaiknya dibangun sebagai **static binary deployment** dengan target `x86_64-unknown-linux-musl`, sehingga:

- tidak bergantung pada pustaka tambahan di server,
- mudah dipindahkan via SFTP,
- lebih stabil untuk deployment produksi.

Layanan dapat dijaga dengan `systemd` agar restart otomatis saat terjadi gangguan.

### 10.3 Reverse Proxy dan CDN

Peladen Rust dapat ditempatkan di belakang **Nginx** sebagai reverse proxy.

Frontend statis idealnya ditempatkan terpisah di CDN seperti:

- Vercel,
- Cloudflare Pages,
- atau layanan setara.

Pemisahan ini mengurangi surface attack, meningkatkan performa, dan memperkuat skor SEO.

## 11. Kesimpulan

Ekosistem digital Tridjaya Motor Samrat idealnya dibangun dengan pendekatan berikut:

- **Next.js** untuk domain publik yang fokus pada SEO.
- **Next.js** untuk portal terotentikasi dengan pemisahan route dan layout yang aman.
- **Rust + Loco.rs** untuk backend yang cepat, efisien, dan terstruktur.
- **PostgreSQL** sebagai pusat data operasional dan telemetri.
- **WhatsApp Business** sebagai jalur konversi utama.
- **Meta Pixel dan TikTok Pixel** untuk optimasi iklan dan atribusi.

Dengan arsitektur ini, diler dapat mengelola kampanye, agen, inventaris, dan konversi secara lebih terukur dan efisien.