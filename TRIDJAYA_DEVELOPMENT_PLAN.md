# TRIDJAYA SAMRAT - DEVELOPMENT MASTERPLAN
**Dokumen Perencanaan Pengembangan Fitur & Protokol Keamanan**

Dokumen ini berfungsi sebagai panduan teknis dan operasional untuk transisi sistem Tridjaya Samrat menjadi platform berbasis database yang aman, skalabel, dan profesional.

---

## 📋 Hasil Analisis Fitur

### 1. Sistem Publik (Customer-Facing)
*   **Target**: Catalog, Blog, Promo, dan Career mengambil data via API Axum.
*   **SEO**: Implementasi SSR (jika memungkinkan) atau Meta Tags dinamis untuk setiap produk.

### 2. Dashboard Admin (Operation Center)
*   **Target**: CRUD Management untuk semua entitas (Produk, User, Blog).
*   **Approval Flow**: Sistem verifikasi pendaftaran agen yang tersentralisasi.

### 3. Dashboard Agent (Partner Ecosystem)
*   **Target**: Gamifikasi, Leaderboard, dan Product Knowledge sebagai sales tools.

---

## 🚀 Rencana Pengerjaan & Status Progress

1.  **[x] FASE 1: Integrasi Data Publik**: Katalog, Blog, Promo, dan Jobs sudah terhubung ke database. (Selesai)
2.  **[x] FASE 2: Autentikasi & Keamanan**: JWT dan RBAC (Admin/Agent) sudah berjalan. (Selesai)
3.  **[x] FASE 3: Sistem Keagenan & Leaderboard**: Poin, Rank, dan Klaim Reward aktif dan tersimpan permanen. (Selesai)
4.  **[x] FASE 4: Admin Management Console**: CRUD Management dan Approval Flow fungsional. (Selesai)
5.  **[x] FASE 5: Telemetry & Analytics**: Tracking Leads (WA Click) dan Visitor Analytics sudah operasional. (Selesai)
6.  **[ ] FASE 6: Final UX Polish & Visual Excellence**: Mikro-animasi, refining glassmorphism, dan optimalisasi dark/light mode transition. (Next)
7.  **[ ] FASE 7: Security Hardening & Production Ready**: SSL setup, rate limiting, audit role-permission menyeluruh, dan optimasi build. (Next)
8.  **[ ] FASE 8: Dokumentasi & Handover**: Penyusunan manual book admin, technical docs, dan deployment script. (Final)

**Current Status:** Sistem Inti 100% Fungsional. Siap untuk tahap pemolesan visual dan audit keamanan sebelum produksi.

---

## 🔒 Protokol Keamanan & Mekanisme Proteksi

Untuk memastikan data perusahaan dan privasi agen terlindungi, standar keamanan berikut **WAJIB** diimplementasikan:

### 1. Keamanan Autentikasi (JWT Flow)
*   **Double Token System**: Menggunakan `access_token` (umur pendek) dan `refresh_token` (umur panjang).
*   **Secure Storage**: Token harus disimpan dengan aman (HttpOnly Cookies disarankan untuk produksi guna mencegah XSS).
*   **Automatic Logout**: Sistem harus otomatis logout jika token tidak valid/expired guna mencegah pembajakan sesi.

### 2. Role-Based Access Control (RBAC)
*   **Backend Guards**: Setiap endpoint di Axum harus divalidasi menggunakan middleware `authorize(Role::Admin)` atau `authorize(Role::Agent)`. Jangan mengandalkan proteksi di frontend saja.
*   **Frontend Routing**: Gunakan `ProtectedRoute` component untuk memblokir akses ke rute dashboard berdasarkan role user di `authStore`.

### 3. Validasi Data & Integritas
*   **Frontend**: Gunakan library **Zod** untuk validasi input form sebelum dikirim ke server (mencegah payload sampah).
*   **Backend**: Gunakan **Strongly Typed Structs** di Rust dan SQLX prepared statements untuk mencegah **SQL Injection**.
*   **Sanitization**: Membersihkan input HTML di deskripsi produk/blog untuk mencegah **XSS (Cross-Site Scripting)**.

### 4. Perlindungan API & Infrastruktur
*   **Rate Limiting**: Endpoint `/api/auth/login` dan `/api/agent/register` harus memiliki limit (misal: max 5 percobaan per menit) untuk mencegah **Brute Force**.
*   **CORS Policy**: Hanya izinkan origin domain resmi yang dapat mengakses API.
*   **Environment Variables**: Jangan menyimpan API Keys atau Database URL di dalam kode (Gunakan `.env`).

---

## 📘 Panduan Teknis (Developer Guidance)

### 1. Integrasi API Baru
Saat membuat fitur baru yang mengambil data dari database:
```typescript
// Contoh di Store (Zustand)
const useProductStore = create((set) => ({
  fetchProducts: async () => {
    const res = await fetch('/api/catalogs');
    const payload = await res.json();
    if (payload.success) set({ items: payload.data.items });
  }
}));
```

### 2. Standar Penulisan Kode
*   **Consistency**: Gunakan PascalCase untuk komponen React dan camelCase untuk fungsi/variabel.
*   **Reusability**: Gunakan shared components di `src/components/ui` (Button, Input, Badge, GlassCard).
*   **Error Logging**: Implementasi `tracing` di backend untuk mempermudah debugging jika terjadi error database.

---

## 🏁 Kriteria Keberhasilan (Definition of Done)
1.  **Dinamis**: Data tidak ada lagi yang hardcoded di frontend (kecuali config dasar).
2.  **Aman**: Lulus uji coba akses ilegal (missal: Agent mencoba buka URL Admin).
3.  **Performant**: Waktu load API di bawah 200ms untuk query standar.
4.  **User Friendly**: Transisi loading halus dengan skeleton/spinner dan toast message yang jelas.
