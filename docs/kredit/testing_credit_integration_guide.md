# Panduan Pengetesan Fitur Integrasi Kredit Dinamis

Dokumen ini dipakai untuk re-check oleh Agent VS terhadap fitur kredit dinamis yang sudah diimplementasikan.
Fokus utama: memastikan simulasi kredit tampil benar, logika hitung sesuai pricelist, dan output WhatsApp akurat.

## 1. Ringkasan Fitur Yang Harus Diuji

1. Data kredit dimuat via fetch dari file JSON publik.
2. Kalkulasi harga simulasi: `harga produk + 700000`.
3. Pembulatan harga simulasi ke bawah ke kelipatan 25000.
4. Mapping kategori produk ke kategori kredit:
   - `furniture -> furniture`
   - `electronics -> electronics`
   - `bike -> electronics`
   - Produk bertipe gadget (jika ada) -> `gadget`
5. Toggle tipe nasabah (`NEW` dan `RO`) mengubah nominal angsuran.
6. Tenor promo tampil benar:
   - `12x (Jadi 11x)`
   - `15x (Jadi 13x)`
7. Khusus `gadget`, tenor `15x` tidak boleh tampil.
8. Fallback data harga (di bawah minimum / di atas maksimum) tidak error.
9. Loading state simulator muncul saat JSON sedang dimuat.
10. Pesan WhatsApp memuat tenor, angsuran, dan tipe nasabah sesuai pilihan user.

## 2. Prasyarat Pengetesan

1. Jalankan frontend di local.
2. Pastikan file data tersedia di `frontend/public/data/credit_calculations.json`.
3. Gunakan minimal 2 produk berbeda kategori saat test:
   - 1 produk kategori `bike` atau `electronics`
   - 1 produk kategori `furniture` (jika tersedia)

## 3. Daftar Test Case Detail

## TC-01: Data JSON Kredit Bisa Dimuat

Tujuan:
Memastikan simulator mengambil data dari file JSON publik, bukan hardcoded.

Langkah:
1. Buka halaman detail produk.
2. Klik tombol `Ajukan Kredit`.
3. Amati panel simulator.

Expected:
1. Simulator tampil dengan tabel tenor.
2. Tidak ada error loading.
3. Jika koneksi lambat, spinner/loading muncul terlebih dahulu.

## TC-02: Rumus Harga Simulasi (+700000)

Tujuan:
Memastikan rumus dasar sesuai handover.

Langkah:
1. Catat harga produk di detail page.
2. Buka simulator.
3. Cek nilai `Harga simulasi` yang ditampilkan.

Expected:
1. `Harga simulasi = harga produk + 700000`.
2. Nilai konsisten di setiap refresh halaman.

## TC-03: Pembulatan Kelipatan 25000

Tujuan:
Memastikan lookup key JSON sesuai aturan pembulatan.

Langkah:
1. Ambil nilai `Harga simulasi`.
2. Hitung manual pembulatan turun ke kelipatan 25000.
3. Bandingkan dengan `Key lookup` di simulator.

Expected:
1. `Key lookup` sama dengan hasil floor kelipatan 25000.
2. Tidak ada pembulatan ke atas.

## TC-04: Mapping Kategori Produk

Tujuan:
Memastikan data sheet yang dipakai sesuai jenis produk.

Langkah:
1. Uji produk kategori `bike`.
2. Uji produk kategori `furniture`.
3. (Opsional) uji produk bertipe gadget jika ada.

Expected:
1. `bike` memakai tabel kategori `electronics`.
2. `furniture` memakai tabel kategori `furniture`.
3. gadget memakai tabel kategori `gadget`.

## TC-05: Toggle NEW vs RO

Tujuan:
Memastikan perubahan tipe nasabah mempengaruhi hasil angsuran.

Langkah:
1. Pilih `Pelanggan Baru`.
2. Catat nominal tenor 6x/9x/12x.
3. Ganti ke `Lama (RO)`.
4. Bandingkan nominal.

Expected:
1. Nilai angsuran berubah sesuai dataset NEW vs RO.
2. Tidak terjadi crash saat toggle berkali-kali.

## TC-06: Tenor Promo Label dan Note

Tujuan:
Memastikan label promo sesuai requirement.

Langkah:
1. Lihat baris tenor pada tabel.
2. Fokus pada tenor 12x dan 15x.

Expected:
1. Label tampil:
   - `12x (Jadi 11x)`
   - `15x (Jadi 13x)`
2. Catatan promo tampil:
   - `Gratis 1x Angsuran` untuk 12x
   - `Gratis 2x Angsuran` untuk 15x

## TC-07: Restriksi Gadget (Tanpa 15x)

Tujuan:
Memastikan aturan bisnis gadget dipatuhi.

Langkah:
1. Buka produk yang termapping ke kategori gadget.
2. Buka simulator kredit.

Expected:
1. Baris tenor `15x` tidak muncul.
2. Tenor lain yang valid tetap muncul.

## TC-08: Fallback Harga Minimum

Tujuan:
Memastikan harga di bawah key minimum tetap menghasilkan simulasi.

Langkah:
1. Uji produk dengan harga rendah (atau mock data).
2. Buka simulator.

Expected:
1. Simulasi tetap muncul.
2. Sistem memakai key minimum yang tersedia.
3. Tidak ada undefined/error di UI.

## TC-09: Fallback Harga Maksimum

Tujuan:
Memastikan harga di atas key maksimum tetap menghasilkan simulasi.

Langkah:
1. Uji produk dengan harga tinggi (atau mock data).
2. Buka simulator.

Expected:
1. Simulasi tetap muncul.
2. Sistem memakai key maksimum yang tersedia.
3. UI tetap stabil.

## TC-10: Integrasi Pesan WhatsApp

Tujuan:
Memastikan pesan WA membawa pilihan user dari simulator.

Langkah:
1. Pilih customer type (NEW/RO).
2. Pilih salah satu tenor di tabel.
3. Klik tombol `Kirim Pengajuan via WhatsApp`.
4. Cek text query pada URL WA.

Expected:
1. Pesan berisi:
   - nama produk
   - warna (jika ada)
   - tenor terpilih (termasuk label promo)
   - nominal angsuran per bulan
   - status nasabah (Baru/RO)
2. Tidak menggunakan teks tenor statis lama.

## TC-11: Re-select Tenor dan Konsistensi Data

Tujuan:
Memastikan state pilihan tenor selalu sinkron.

Langkah:
1. Pilih tenor A.
2. Ubah ke tenor B.
3. Klik tombol WA.

Expected:
1. Pesan WA mengikuti tenor terakhir yang dipilih.
2. Highlight baris tenor aktif berubah sesuai pilihan.

## TC-12: Handling Error Data Source

Tujuan:
Memastikan UI tetap aman saat data gagal dimuat.

Langkah:
1. Simulasikan file JSON tidak tersedia (rename sementara file).
2. Reload halaman detail produk dan buka simulator.

Expected:
1. Muncul pesan error yang jelas.
2. Halaman tidak blank atau crash.
3. Area lain di Product Detail tetap berfungsi.

## 4. Checklist Hasil Yang Diharapkan (Sign-off Agent VS)

Checklist ini harus tercentang semua:

1. Semua test case TC-01 s.d. TC-12 PASS.
2. Tidak ada error di console browser saat skenario normal.
3. Tidak ada regresi pada tampilan Product Detail.
4. Build frontend tetap sukses.
5. Pesan WA sudah dinamis sesuai pilihan tenor dan tipe nasabah.

## 5. Kriteria Lulus Final

Fitur dinyatakan siap bila:

1. Akurasi angsuran sesuai dataset JSON dan rule bisnis.
2. UX simulator lancar (loading, tabel, toggle, pilih tenor, kirim WA).
3. Edge-case (min/max/error data) tertangani.
4. Tidak ada blocker untuk handover Agent VS.
