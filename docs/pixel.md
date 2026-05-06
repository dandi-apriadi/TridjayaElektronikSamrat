# Strategi Implementasi Meta Pixel (Dataset) untuk Multi-Admin

Strategi ini dirancang untuk mengelola satu website yang diakses oleh beberapa admin dengan akun iklan (Ad Account) berbeda secara efektif, menjaga performa situs, dan memaksimalkan pembelajaran algoritma Meta.

---

## 1. Arsitektur Utama: "The Master Pixel Strategy"

Alih-alih memasang banyak Pixel, gunakan **Satu Master Pixel** yang dikelola melalui **Meta Business Manager (BM)**.

### Mengapa Satu Pixel?
* **Data Pooling:** Algoritma Meta (AI) belajar lebih cepat jika semua data konversi masuk ke satu tempat.
* **Performa Website:** Mengurangi jumlah script JavaScript yang harus dimuat oleh browser.
* **Skalabilitas:** Menambah admin baru cukup dilakukan melalui dashboard tanpa menyentuh kode program.

---

## 2. Alur Kerja Manajerial (Setup Business Manager)

1.  **Kepemilikan Pusat:** Buat Dataset (Pixel) di dalam satu Business Manager utama.
2.  **Pembagian Akses (Assign Assets):**
    * Buka *Business Settings* > *Data Sources* > *Datasets*.
    * Pilih Pixel yang dimaksud.
    * Klik **Connected Assets** > **Add Assets**.
    * Pilih Akun Iklan (Ad Account) milik Admin 1, Admin 2, dan Admin 3.
3.  **Izin Admin:** Tambahkan email masing-masing admin ke Business Manager dan berikan akses untuk menggunakan Pixel tersebut di akun iklan mereka.

---

## 3. Strategi Pelacakan & Atribusi

Agar masing-masing admin bisa memantau efektivitas iklannya sendiri di dalam satu Pixel yang sama:

### A. Penggunaan URL Parameters
Wajibkan setiap admin menggunakan parameter unik pada link iklan mereka di Meta Ads Manager.
* **Admin 1:** `website.com/?utm_source=fb&utm_admin=01`
* **Admin 2:** `website.com/?utm_source=fb&utm_admin=02`

### B. Custom Conversions (Untuk Laporan Terpisah)
Di dalam Events Manager, buat **Custom Conversion** untuk memfilter data:
1.  Klik **Create Custom Conversion**.
2.  Pilih Event (misal: *Purchase*).
3.  Set Rules: `URL contains utm_admin=01`.
4.  Beri nama "Purchase Admin 1".
*Ulangi untuk setiap admin.*

---

## 4. Implementasi Teknis (Developer Level)

### Frontend (Google Tag Manager)
Gunakan GTM untuk memasang **Base Code** Pixel agar pengelolaan lebih rapi. Anda bisa menggunakan *Trigger* standar untuk event `PageView`, `AddToCart`, dan `Purchase`.

### Backend (Conversions API - CAPI)
Mengingat Anda memiliki kemampuan di stack **Node.js/Rust**, sangat disarankan membangun *Server-Side Tracking*:
1.  Kirim event dari client ke server Anda (endpoint `/api/v1/pixel-event`).
2.  Server akan meneruskan data ke **Meta Graph API** menggunakan satu *Access Token* utama.
3.  Keuntungan: Data tetap terkirim meskipun user menggunakan AdBlocker di browser.

---

## 5. Checklist Verifikasi
- [ ] Domain sudah di-verifikasi di Business Manager.
- [ ] Konfigurasi *Aggregated Event Measurement* sudah diatur (8 event prioritas).
- [ ] Testing menggunakan **Test Events** di Events Manager untuk memastikan setiap akun iklan admin mengirimkan data ke Pixel yang sama.

---
*Dokumen ini dibuat untuk membantu sinkronisasi tim admin dan efisiensi pelacakan iklan Meta.*