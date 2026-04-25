# Dashboard Audit Report - Tridjaya Samrat

Laporan ini merinci status implementasi fitur dan konektivitas backend untuk seluruh halaman Dashboard Admin dan Agen.

## 📊 Ringkasan Status
- **Halaman Total**: 21
- **Telah Terhubung ke Backend**: 12
- **Masih Menggunakan Mock Data/Calculations**: 9
- **Prioritas Utama**: Sinkronisasi nilai komisi asli dan fitur penarikan dana (Payout).

---

## 🛠️ Audit Halaman Admin

### 1. Admin Dashboard (`AdminDashboard.tsx`)
- **Status**: ✅ Terhubung ke Backend (Claims, Registrations, Products, Telemetry).
- **Masih Mock/Belum Berfungsi**:
    - **Pending Payout List**: Tombol aksi "Setujui" dan "Tolak" (baris 608-613) tidak memiliki handler fungsi. Klik tombol tidak mengubah status di backend.
    - **System Health**: Data status server, latency, dan DB load (baris 509-512) masih bersifat statis.
- **Action Item**: Sambungkan tombol aksi Payout ke `updateClaimStatus`.

### 2. Admin Users (`AdminUsersPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Users, Update Status).
- **Masih Mock/Belum Berfungsi**:
    - **Export CSV**: Tombol (baris 259) tidak memiliki fungsi ekspor.
    - **Data Login**: Kolom "Last Login" dan "Dibuat" (baris 228-230) hanya menampilkan tanda strip `-`.
- **Action Item**: Implementasi library ekspor CSV dan tarik data `last_login` dari backend.

### 3. Admin Catalog (`AdminCatalogPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Products).
- **Masih Mock/Belum Berfungsi**:
    - **Kirim Alert**: Tombol (baris 132) menggunakan `alert()` browser.
    - **Data Konversi**: Kolom "Konversi" (baris 224) masih kosong.
- **Action Item**: Integrasi sistem notifikasi internal untuk alert stok.

### 4. Admin Content/Articles (`AdminArticleFormPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Blog Store).
- **Masih Mock/Belum Berfungsi**:
    - **Upload Gambar**: Masih menggunakan URL teks, bukan sistem upload file asli.
- **Action Item**: Integrasi dengan API Cloudinary atau sistem penyimpanan backend untuk upload file.

---

## 🛠️ Audit Halaman Agen

### 1. Agent Dashboard (`AgentDashboard.tsx`)
- **Status**: ✅ Terhubung ke Backend (Leads, Claims, Stats).
- **Masih Mock/Belum Berfungsi**:
    - **Ranking Progress**: Perhitungan progress ke tier selanjutnya (baris 365) menggunakan pembagi statis `500`.
- **Action Item**: Ambil target poin per tier dari konfigurasi sistem.

### 2. Agent Earnings (`AgentEarningsPage.tsx`)
- **Status**: ⚠️ Terhubung Sebagian (API Claims).
- **Kritikal (Mock Calculations)**:
    - **Nilai Komisi**: Menggunakan konstanta `ESTIMATED_CLAIM_VALUE = 250000` (baris 14). Nilai rupiah di seluruh halaman ini (Saldo, Riwayat, Grafik) hanyalah estimasi, bukan nilai asli dari backend.
- **Masih Mock/Belum Berfungsi**:
    - **Export PDF**: Tombol (baris 271) belum berfungsi.
    - **Info Rekening**: Data bank di modal penarikan (baris 301) masih hardcoded `BRI 1234-5678-xxxx`.
- **Action Item**: Ubah kalkulasi agar mengambil nilai `reward_value` asli dari backend sesuai tier produk yang diklaim.

### 3. Agent Push Prospek (`AgentPushProspekPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Create Lead).
- **Masih Mock/Belum Berfungsi**:
    - **KPI Target**: "Target Bulanan" (30 Prospek) dan "Konversi" (baris 82-86) masih angka statis.
- **Action Item**: Hitung target secara dinamis berdasarkan data performa bulan lalu.

---

## 🚀 Daftar Tugas Untuk Agent VS (Next Steps)

### Prioritas 1: Finansial & Payout (Paling Penting)
- [ ] Ubah `ESTIMATED_CLAIM_VALUE` di `AgentEarningsPage.tsx` menjadi data dinamis dari backend.
- [ ] Implementasi fungsi tombol "Setujui" & "Tolak" pada widget Payout di `AdminDashboard.tsx`.
- [ ] Tambahkan field "Nomor Rekening" pada profil User agar tidak hardcoded di halaman penarikan.

### Prioritas 2: Data Integrity
- [ ] Tambahkan kolom `created_at` dan `last_login` pada tabel User di Admin.
- [ ] Tambahkan kalkulasi konversi lead asli pada tabel Katalog Admin.

### Prioritas 3: Ekspor & Tools
- [ ] Tambahkan fitur "Export CSV" untuk data User dan "Export PDF" untuk riwayat komisi agen.
- [ ] Ganti semua `alert()` dengan komponen `toast` atau modal notifikasi yang lebih premium.

---
*Laporan ini dibuat secara otomatis oleh Antigravity AI pada 25 April 2026.*
