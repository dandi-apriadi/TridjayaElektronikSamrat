# Dashboard Audit Report - Tridjaya Samrat

Laporan ini merinci status implementasi fitur dan konektivitas backend untuk seluruh halaman Dashboard Admin dan Agen.

## 📊 Ringkasan Status
- **Halaman Total**: 22
- **Telah Terhubung ke Backend**: 18
- **Masih Menggunakan Mock Data/Calculations**: 4
- **Prioritas Utama**: Menyelesaikan area tools/operasional (ekspor PDF native, metrik konversi katalog nyata).

## 🔎 Re-audit 25 April 2026
- `ForgotPasswordPage.tsx` sempat terlewat dan masih memakai endpoint hardcoded `localhost:8080`; sekarang sudah diarahkan ke `VITE_API_BASE_URL`.
- `AgencyRegistrationPage.tsx`, `AdminAgentsPage.tsx`, dan `AdminArticleFormPage.tsx` sudah dinormalisasi agar memakai fallback base URL backend yang sama.
- `AdminLeaderboardPage.tsx` dan `AgentLeaderboardPage.tsx` sekarang memakai endpoint leaderboard backend sehingga ranking dan reward tier tidak lagi sepenuhnya statis.
- Tidak ada page lain yang ditemukan masih mengarah ke endpoint localhost lama setelah sweep ulang di `frontend/src/pages`.

## 🔧 Recovery AG 26 April 2026
- Perbaikan regresi TypeScript dari perubahan AG (`useAdminNetworkStore`, `useAgentStore`, dan `AgentSettingsPage`) sehingga `npm run build` kembali hijau.
- Ditambahkan endpoint backend baru untuk fitur pengaturan akun: `PATCH /api/auth/profile`, `POST /api/auth/change-password`, dan `POST /api/users/{id}/reset-password`.
- Ditambahkan domain Support Ticket end-to-end: migration `support_tickets`, endpoint `GET/POST /api/agent/support-tickets`, store `useAgentStore`, dan wiring ke `AgentSupportPage.tsx`.
- Validasi kata sandi frontend disinkronkan ke minimum 8 karakter agar sesuai aturan backend.

## 🔁 Lanjutan 26 April 2026 (Support Admin)
- Ditambahkan endpoint admin support: `GET /api/admin/support-tickets` dan `PATCH /api/admin/support-tickets/{id}/status`.
- Ditambahkan halaman dashboard baru `AdminSupportTicketsPage.tsx` untuk triase ticket (`open`, `in_progress`, `resolved`).
- Navigasi admin kini memiliki menu **Support Ticket** dan sudah terhubung ke store `useAdminNetworkStore`.

## 🔁 Lanjutan 26 April 2026 (Catalog Conversion)
- `ProductDetailPage.tsx` sekarang mengirim telemetry `page_view` dan `whatsapp_click` per produk dengan metadata `productSlug`.
- Backend `GET /api/catalogs` sekarang menambahkan metrik nyata per produk: `views`, `leads`, `conversions`, dan `conversionRate` dari telemetry event.
- `AdminCatalogPage.tsx` sudah memakai `conversionRate` aktual untuk kolom **Popularitas** dan sorting berbasis telemetry.

---

## 🛠️ Audit Halaman Admin

### 1. Admin Dashboard (`AdminDashboard.tsx`)
- **Status**: ✅ Terhubung ke Backend (Claims, Registrations, Products, Telemetry).
- **Update**:
    - Aksi "Setujui" dan "Tolak" payout sudah memanggil `updateClaimStatus`.
    - Panel System Health sudah mengambil data `telemetryStats.systemMetrics` dari backend.
- **Action Item**: Tambahkan retry UX saat update status payout gagal (toast + rollback visual).

### 2. Admin Users (`AdminUsersPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Users, Update Status).
- **Update**: Kolom "Last Login" dan "Dibuat" sudah menampilkan data backend menggunakan `formatDateTime`.
- **Update**:
    - Fitur reset password user oleh admin sudah terhubung ke backend (`POST /api/users/{id}/reset-password`).
    - Export CSV sudah berjalan di sisi klien.
- **Action Item**: Tambahkan audit trail admin untuk aksi reset password.

### 3. Admin Catalog (`AdminCatalogPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Products + telemetry conversion stats).
- **Update**: Kolom "Popularitas" sekarang memakai `conversionRate` aktual berbasis telemetry produk, bukan review share.
- **Action Item**: Tambahkan breakdown conversion per kategori atau campaign jika dibutuhkan untuk analisis lanjutan.

### 4. Admin Content/Articles (`AdminArticleFormPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Blog Store).
- **Update**: Upload gambar artikel sudah terhubung ke endpoint backend `/api/admin/uploads/image`.
- **Action Item**: Tambahkan validasi ukuran file dan kompresi berbasis kebijakan produksi.

### 5. Admin Support Ticket (`AdminSupportTicketsPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (List & Update Status Ticket).
- **Update**: Admin dapat memfilter ticket dan mengubah status ke `open`, `in_progress`, atau `resolved`.
- **Action Item**: Tambahkan assignment petugas support + SLA timer per ticket.

---

## 🛠️ Audit Halaman Agen

### 1. Agent Dashboard (`AgentDashboard.tsx`)
- **Status**: ✅ Terhubung ke Backend (Leads, Claims, Stats).
- **Update**: Ranking progress sudah dinamis berdasarkan `rewardTiers` backend.
- **Action Item**: Tambahkan fallback copy ketika data tier kosong akibat token expired.

### 2. Agent Earnings (`AgentEarningsPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (API Claims & Reward Tiers).
- **Update**: Kalkulasi komisi dan saldo sudah dinamis menggunakan `getClaimRewardValue` dari tier masing-masing.
- **Update**:
    - Info rekening pada modal penarikan sudah mengambil `user.bank_account`.
    - Tombol export sudah memakai PDF native berbasis `jsPDF`.
- **Action Item**: Tambahkan header/footer dan penomoran halaman bila ingin format laporan yang lebih formal.

### 3. Agent Push Prospek (`AgentPushProspekPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Create Lead).
- **Update**: KPI target bulanan dan konversi sudah dihitung dari data lead/statistik backend.
- **Action Item**: Kalibrasi formula target dengan kebijakan bisnis cabang.

### 4. Agent Support (`AgentSupportPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Support Tickets API).
- **Update**: Riwayat tiket dan pembuatan tiket baru sudah memakai endpoint backend, tidak lagi simulasi lokal.
- **Action Item**: Tambahkan lampiran file/bukti pada ticket dari sisi agen.

### 5. Agent Settings (`AgentSettingsPage.tsx`)
- **Status**: ✅ Terhubung ke Backend (Profile & Password).
- **Update**: Form profil dan ubah password kini memakai endpoint backend autentikasi.
- **Action Item**: Tambahkan verifikasi password kedua (2FA/OTP) untuk perubahan kredensial sensitif.

---

## 🚀 Daftar Tugas Untuk Agent VS (Next Steps)

### Prioritas 1: Finansial & Payout (Paling Penting)
- [x] Ubah `ESTIMATED_CLAIM_VALUE` di `AgentEarningsPage.tsx` menjadi data dinamis dari backend.
- [x] Implementasi fungsi tombol "Setujui" & "Tolak" pada widget Payout di `AdminDashboard.tsx`.
- [x] Tambahkan field "Nomor Rekening" pada profil User agar tidak hardcoded di halaman penarikan.

### Prioritas 2: Data Integrity
- [x] Tambahkan kolom `created_at` dan `last_login` pada tabel User di Admin.
- [x] Integrasikan reset password admin-user lewat backend endpoint.
- [x] Tambahkan kalkulasi konversi lead asli pada tabel Katalog Admin.

### Prioritas 3: Ekspor & Tools
- [x] Tambahkan fitur "Export CSV" untuk data User.
- [x] Tambahkan fitur export PDF native untuk riwayat komisi agen.
- [x] Ganti alert stok katalog ke notifikasi toast.
- [x] Integrasikan Agent Support ke backend (ticket create/list).
- [x] Integrasikan Admin Support ke backend (ticket triage/status update).

---
*Laporan ini diperbarui otomatis pada 26 April 2026.*
