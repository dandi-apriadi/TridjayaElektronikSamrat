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
LAPORAN HARIAN*
*23 APRIL 2026*
Nama : DANDI MAMONTO
Divisi : ADMIN

1. Absen, bersih-besih, breaffing pagi
2. Post promo di Instagram, tiktok, Whatsapp, dan Facebook
3. Share ke 100+ grup
4. save kontak, dan add friend
5. Membuat MOU untuk Korem 131 Santiago Manado
6. Cek dan balas komentar di Instagram, tiktok, Facebook dan whatsapp
7. Follow up konsumen
8. dan komunikasi dengan sales untuk minta feedback 
9. Broadcast 3x, cek data konsumen yang mau kredit. 
10. Input database

TERIMA KASIH
## 🚀 Rencana Pengerjaan & Status Progress

1.  **[x] FASE 1: Integrasi Data Publik**: Katalog, Blog, Promo, dan Jobs sudah terhubung ke database. (Selesai)
2.  **[x] FASE 2: Autentikasi & Keamanan**: JWT dan RBAC (Admin/Agent) sudah berjalan. (Selesai)
3.  **[x] FASE 3: Sistem Keagenan & Leaderboard**: Poin, Rank, dan Klaim Reward aktif dan tersimpan permanen. (Selesai)
4.  **[x] FASE 4: Admin Management Console**: CRUD Management dan Approval Flow fungsional. (Selesai)
5.  **[x] FASE 5: Telemetry & Analytics**: Tracking Leads (WA Click) dan Visitor Analytics sudah operasional. (Selesai)
6.  **[x] FASE 6: Final UX Polish & Visual Excellence**: Mikro-animasi, refining glassmorphism, optimalisasi dark/light mode transition, dan pengurangan data mock utama di dashboard admin. (Selesai)
7.  **[x] FASE 7: Security Hardening & Production Ready**: SSL setup, rate limiting, audit role-permission menyeluruh, dan optimasi build. (Selesai)
8.  **[x] FASE 8: Dokumentasi & Handover**: Penyusunan manual book admin, technical docs, dan deployment script. (Selesai)
9.  **[x] FASE 9: Performance Optimization & Production Stabilization**: Route-level code splitting frontend, smoke test API rilis, perbaikan telemetry conversion backend, integrasi user admin API, integrasi payout claims admin, migrasi AgentDashboard/AgentEarnings ke data store API, serta baseline monitoring release gate (build + smoke + baseline bundle/latency) sudah diterapkan dan tervalidasi. (Selesai)

**Current Status:** Fase 1-9 selesai. Release gate produksi sudah tervalidasi (frontend build, smoke API kritikal, baseline monitor bundle dan health latency) dengan artefak baseline tersimpan untuk audit operasional.

---

## 🎯 Optional Hardening Tasks (Post-Phase 9)

Setelah Phase 9 selesai, berikut tugas-tugas opsional untuk meningkatkan quality & security:

### ✅ Optional Task #1: Frontend Form Validation (Zod Integration)
**Status**: ✅ SELESAI (24 April 2026)
- Implementasi `adminSchemas.ts` dengan `adminProductSchema` dan `adminPromoSchema`
- Integrasi `safeParse` di `AdminProductFormPage.tsx` dan `AdminPromoFormPage.tsx`
- Pre-submit validation yang memblokir payload invalid sebelum API call
- Build verified green ✅

### ✅ Optional Task #2: HttpOnly Cookie Auth Hardening
**Status**: ✅ SELESAI (24 April 2026)
- Backend sudah support HttpOnly refresh cookies (via `build_refresh_cookie()` di routes.rs)
- Frontend auth store (`authStore.ts`) diupdate:
  - Hapus client-side `refreshToken` storage (rely pada HttpOnly cookies)
  - Tambah `refreshSession()` method untuk silent refresh via cookie
  - Tambah `restoreSession()` method untuk session restore saat app init
- Session restoration di `App.tsx` initialization
- Centralized API client (`apiClient.ts`) dengan automatic token refresh on 401
- Build verified green ✅
- Token lifecycle: access token (15 min, memory-only) + refresh token (7 days, HttpOnly cookie)

### ✅ Optional Task #3: Extended Validation Coverage
**Status**: ✅ SELESAI (24 April 2026)
- Expand adminSchemas.ts dengan schema untuk:
  - Articles: `adminArticleSchema` (title, slug, content, excerpt, author, tags, etc)
  - Leads/Prospek: `agentLeadSchema` (customerName, phoneNumber, interestedProduct, source, notes)
  - Users: `adminUserSchema` (email, name, role, password, avatar, is_active)
- Utility functions:
  - `getFirstZodIssue()` - extract first validation error
  - `formatZodErrors()` - format all errors for display
  - `validateSchema()` - centralized validation wrapper
- Updated form pages:
  - `AdminArticleFormPage.tsx` - added schema validation + error display
  - `AgentPushProspekPage.tsx` - added schema validation + error display
- Validation errors now displayed via toast + inline UI alert
- Build verified green ✅
- Release gate: build + smoke + baseline all passing ✅

### ⏳ Optional Task #4: Advanced Rate Limiting & DDoS Protection
**Plan**: 
- Enhance rate limiting di auth endpoints
- Implement sliding window algorithm
- Add IP-based blocking untuk suspicious patterns

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
