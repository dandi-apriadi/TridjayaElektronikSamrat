# 🧪 Panduan Testing Meta Pixel Tracking System - Role Agent

## 📋 Daftar Isi
- [Persiapan Testing](#persiapan-testing)
- [Login sebagai Agent](#login-sebagai-agent)
- [Testing Fitur Agent](#testing-fitur-agent)
- [Skenario Testing](#skenario-testing)
- [Checklist Testing](#checklist-testing)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Persiapan Testing

### 1. Pastikan Backend Berjalan
```bash
cd backend
cargo run
```
Backend harus berjalan di `http://localhost:3000`

### 2. Pastikan Frontend Berjalan
```bash
cd frontend
npm run dev
```
Frontend harus berjalan di `http://localhost:5173`

### 3. Pastikan Database Sudah Ter-migrate
```bash
cd backend
sqlx migrate run
```

### 4. Buat User Agent untuk Testing
Gunakan salah satu cara berikut:

**Opsi A: Via API (Postman/cURL)**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent.test@tridjaya.com",
    "password": "Password123!",
    "name": "Agent Test",
    "role": "agent",
    "whatsapp": "081234567890"
  }'
```

**Opsi B: Via Database Langsung**
```sql
INSERT INTO users (id, email, name, role, password_hash, is_active, is_verified, created_at)
VALUES (
  'agent-test-001',
  'agent.test@tridjaya.com',
  'Agent Test',
  'agent',
  '$argon2id$v=19$m=19456,t=2,p=1$test$test',
  1,
  1,
  CURRENT_TIMESTAMP
);
```

---

## 🔐 Login sebagai Agent

### 1. Buka Browser
Akses: `http://localhost:5173`

### 2. Login dengan Kredensial Agent
- **Email**: `agent.test@tridjaya.com`
- **Password**: `Password123!`

### 3. Verifikasi Login Berhasil
Setelah login, Anda harus:
- ✅ Diarahkan ke `/dashboard/agent`
- ✅ Melihat sidebar dengan menu Agent
- ✅ Melihat nama "Agent Test" di header

---

## 🎯 Testing Fitur Agent

### Fitur 1: Pixel Analytics Dashboard

#### Akses Menu
1. Klik menu **"Pixel Analytics"** di sidebar (section "Penjualan")
2. URL harus berubah ke: `/dashboard/agent/pixel-analytics`

#### Verifikasi Tampilan
✅ **Harus Terlihat:**
- Date range picker (default: 7 hari terakhir)
- Period type selector (hourly/daily/weekly/monthly)
- Tabel campaign analytics dengan kolom:
  - Campaign Name
  - Total Events
  - Unique Users
  - Conversions
  - Total Revenue
  - Currency

✅ **Harus TIDAK Terlihat:**
- Data pixel-level (hanya campaign-level)
- Data dari agent lain
- Menu untuk create/edit campaign
- Menu untuk manage pixels

#### Test Data Isolation
**Tujuan**: Memastikan agent hanya melihat data mereka sendiri

**Langkah:**
1. Pastikan ada event dengan `user_id` yang berbeda di database
2. Login sebagai Agent Test
3. Buka Pixel Analytics
4. **Verifikasi**: Hanya melihat campaign dengan events yang memiliki `user_id = agent-test-001`

**Query untuk Cek Data:**
```sql
-- Cek events milik agent ini
SELECT 
  c.name as campaign_name,
  COUNT(pe.id) as total_events
FROM pixel_events pe
JOIN campaigns c ON pe.campaign_id = c.id
WHERE pe.user_id = 'agent-test-001'
GROUP BY c.id, c.name;
```

---

## 📝 Skenario Testing

### Skenario 1: Agent Melihat Analytics Kosong

**Kondisi Awal:**
- Agent baru login
- Belum ada event dengan `user_id` agent ini

**Langkah Testing:**
1. Login sebagai agent
2. Buka Pixel Analytics
3. **Expected Result**: 
   - Tabel kosong atau pesan "No data available"
   - Tidak ada error
   - UI tetap responsif

---

### Skenario 2: Agent Melihat Analytics dengan Data

**Persiapan Data:**
```sql
-- 1. Buat pixel (sebagai super_admin)
INSERT INTO pixels (id, pixel_id, name, status, access_token, created_by, created_at, updated_at)
VALUES ('pixel-001', 'test-pixel-123', 'Test Pixel', 'active', 'encrypted-token', 'super-admin-001', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 2. Buat campaign (sebagai admin)
INSERT INTO campaigns (id, campaign_id, pixel_id, admin_id, name, status, utm_admin, created_at, updated_at)
VALUES ('campaign-001', 'test-campaign-123', 'pixel-001', 'admin-001', 'Test Campaign', 'active', 'admin_abc123', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Buat event dengan user_id agent
INSERT INTO pixel_events (
  id, event_id, pixel_id, campaign_id, user_id, 
  event_type, event_source_url, user_data, custom_data, utm_params,
  event_time, created_at
)
VALUES (
  'event-001',
  '1234567890-abc123',
  'pixel-001',
  'campaign-001',
  'agent-test-001',  -- user_id agent kita
  'PageView',
  'https://example.com',
  '{}',
  '{}',
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 4. Buat conversion
INSERT INTO conversions (
  id, event_id, campaign_id, conversion_type, 
  conversion_value, currency, conversion_time, created_at
)
VALUES (
  'conv-001',
  'event-001',
  'campaign-001',
  'Purchase',
  100000,
  'IDR',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

**Langkah Testing:**
1. Login sebagai agent
2. Buka Pixel Analytics
3. **Expected Result**:
   - Melihat "Test Campaign" di tabel
   - Total Events: 1
   - Unique Users: 1
   - Conversions: 1
   - Total Revenue: 100,000 IDR

---

### Skenario 3: Filter Date Range

**Langkah Testing:**
1. Buka Pixel Analytics
2. Ubah date range ke "Last 30 days"
3. **Expected Result**:
   - Data ter-refresh
   - Menampilkan events dalam 30 hari terakhir
   - Loading indicator muncul saat fetching

4. Ubah date range ke "Custom" dan pilih tanggal spesifik
5. **Expected Result**:
   - Data ter-filter sesuai tanggal yang dipilih

---

### Skenario 4: Filter Period Type

**Langkah Testing:**
1. Buka Pixel Analytics
2. Pilih period type: **"Daily"**
3. **Expected Result**: Data dikelompokkan per hari

4. Pilih period type: **"Weekly"**
5. **Expected Result**: Data dikelompokkan per minggu

6. Pilih period type: **"Monthly"**
7. **Expected Result**: Data dikelompokkan per bulan

---

### Skenario 5: Multi-Currency Display

**Persiapan Data:**
```sql
-- Tambah conversion dengan currency berbeda
INSERT INTO conversions (
  id, event_id, campaign_id, conversion_type, 
  conversion_value, currency, conversion_time, created_at
)
VALUES (
  'conv-002',
  'event-001',
  'campaign-001',
  'Purchase',
  50,
  'USD',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

**Langkah Testing:**
1. Buka Pixel Analytics
2. **Expected Result**:
   - Revenue ditampilkan per currency
   - Format: "IDR 100,000 / USD 50"
   - Atau ditampilkan dalam baris terpisah

---

### Skenario 6: RBAC - Agent Tidak Bisa Akses Menu Lain

**Langkah Testing:**
1. Login sebagai agent
2. Coba akses URL berikut secara manual:

**URL yang HARUS DITOLAK (403 Forbidden):**
```
http://localhost:5173/dashboard/super-admin
http://localhost:5173/dashboard/super-admin/pixels
http://localhost:5173/dashboard/super-admin/analytics
http://localhost:5173/dashboard/admin/pixel-campaigns
http://localhost:5173/dashboard/admin/pixel-analytics
```

3. **Expected Result**:
   - Redirect ke halaman error atau dashboard agent
   - Atau tampil pesan "Access Denied"

**URL yang HARUS BISA DIAKSES:**
```
http://localhost:5173/dashboard/agent
http://localhost:5173/dashboard/agent/pixel-analytics
```

---

## ✅ Checklist Testing

### Checklist Umum
- [ ] Login berhasil dengan kredensial agent
- [ ] Redirect ke `/dashboard/agent` setelah login
- [ ] Sidebar menampilkan menu agent yang benar
- [ ] Header menampilkan nama agent
- [ ] Logout berhasil

### Checklist Pixel Analytics
- [ ] Menu "Pixel Analytics" terlihat di sidebar
- [ ] Klik menu membuka halaman analytics
- [ ] Date range picker berfungsi
- [ ] Period type selector berfungsi
- [ ] Tabel analytics menampilkan data yang benar
- [ ] Hanya menampilkan data dengan `user_id` agent sendiri
- [ ] Tidak menampilkan data agent lain
- [ ] Multi-currency revenue ditampilkan dengan benar
- [ ] Loading state ditampilkan saat fetching data
- [ ] Error handling berfungsi (jika API error)

### Checklist Data Isolation
- [ ] Agent hanya melihat campaign dengan events mereka
- [ ] Agent tidak melihat pixel-level data
- [ ] Agent tidak melihat data agent lain
- [ ] Filter date range hanya menampilkan data agent sendiri

### Checklist RBAC
- [ ] Agent tidak bisa akses halaman super_admin
- [ ] Agent tidak bisa akses halaman admin
- [ ] Agent tidak bisa akses halaman sales (jika berbeda)
- [ ] Agent tidak bisa create/edit campaign
- [ ] Agent tidak bisa manage pixels

### Checklist UI/UX
- [ ] Responsive di mobile
- [ ] Responsive di tablet
- [ ] Responsive di desktop
- [ ] Loading indicators muncul saat fetching
- [ ] Error messages jelas dan informatif
- [ ] Empty state ditampilkan dengan baik
- [ ] Tabel sortable (jika ada)
- [ ] Pagination berfungsi (jika ada)

---

## 🐛 Troubleshooting

### Problem 1: Tidak Bisa Login
**Gejala**: Error "Invalid credentials" atau "User not found"

**Solusi:**
1. Cek apakah user sudah dibuat di database:
```sql
SELECT * FROM users WHERE email = 'agent.test@tridjaya.com';
```

2. Cek apakah role sudah benar:
```sql
SELECT id, email, name, role FROM users WHERE email = 'agent.test@tridjaya.com';
-- role harus 'agent'
```

3. Reset password jika perlu:
```sql
UPDATE users 
SET password_hash = '$argon2id$v=19$m=19456,t=2,p=1$test$test'
WHERE email = 'agent.test@tridjaya.com';
```

---

### Problem 2: Halaman Analytics Kosong
**Gejala**: Tabel kosong meskipun ada data

**Solusi:**
1. Cek apakah ada events dengan `user_id` agent:
```sql
SELECT COUNT(*) FROM pixel_events WHERE user_id = 'agent-test-001';
```

2. Cek apakah date range mencakup data:
```sql
SELECT 
  MIN(event_time) as earliest_event,
  MAX(event_time) as latest_event
FROM pixel_events 
WHERE user_id = 'agent-test-001';
```

3. Cek console browser untuk error API:
   - Buka Developer Tools (F12)
   - Tab "Console"
   - Lihat apakah ada error merah

4. Cek Network tab untuk response API:
   - Tab "Network"
   - Filter "XHR"
   - Klik request ke `/api/pixel-analytics/agent`
   - Cek response body

---

### Problem 3: Melihat Data Agent Lain
**Gejala**: Agent melihat data yang bukan miliknya

**Solusi:**
1. **INI BUG SERIUS!** Segera laporkan ke developer
2. Cek query di backend `get_agent_pixel_analytics`:
```rust
// Harus ada WHERE pe.user_id = ?
WHERE pe.user_id = ? AND DATE(pe.event_time) >= ? AND DATE(pe.event_time) <= ?
```

3. Cek apakah authorization berfungsi:
```rust
let user = authorize(&state, &headers, &[Role::Agent]).await?;
// user.id harus digunakan dalam query
```

---

### Problem 4: Error 403 Forbidden
**Gejala**: Tidak bisa akses halaman analytics

**Solusi:**
1. Cek apakah token masih valid:
   - Logout dan login ulang
   - Cek localStorage di browser (F12 → Application → Local Storage)

2. Cek apakah role benar:
```sql
SELECT role FROM users WHERE email = 'agent.test@tridjaya.com';
-- Harus 'agent', bukan 'Agent' atau 'AGENT'
```

3. Cek backend logs untuk error authorization

---

### Problem 5: Data Tidak Ter-update
**Gejala**: Setelah insert data baru, tidak muncul di UI

**Solusi:**
1. Refresh halaman (F5)
2. Clear cache browser (Ctrl+Shift+Delete)
3. Cek apakah analytics job sudah jalan:
```sql
SELECT * FROM campaign_analytics 
WHERE campaign_id = 'campaign-001'
ORDER BY updated_at DESC;
```

4. Jalankan analytics job manual:
```bash
# Di backend
cargo run --bin run_analytics_job
```

---

## 📊 Expected API Responses

### GET /api/pixel-analytics/agent

**Request:**
```http
GET /api/pixel-analytics/agent?period_type=daily&start_date=2026-05-01&end_date=2026-05-07
Authorization: Bearer <agent-token>
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Agent analytics",
  "data": {
    "analytics": [
      {
        "campaign_id": "campaign-001",
        "campaign_name": "Test Campaign",
        "total_events": 10,
        "unique_users": 5,
        "conversions": 2,
        "total_revenue": 200000.0,
        "currency": "IDR"
      }
    ],
    "period_type": "daily",
    "start_date": "2026-05-01",
    "end_date": "2026-05-07"
  }
}
```

**Response (No Data):**
```json
{
  "success": true,
  "message": "Agent analytics",
  "data": {
    "analytics": [],
    "period_type": "daily",
    "start_date": "2026-05-01",
    "end_date": "2026-05-07"
  }
}
```

**Response (Unauthorized):**
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": "Invalid or expired token"
}
```

---

## 🎯 Test Cases Summary

| Test Case | Expected Result | Status |
|-----------|----------------|--------|
| Login sebagai agent | Berhasil, redirect ke dashboard | ⬜ |
| Akses Pixel Analytics | Halaman terbuka, data ditampilkan | ⬜ |
| Data isolation | Hanya melihat data sendiri | ⬜ |
| Filter date range | Data ter-filter sesuai tanggal | ⬜ |
| Filter period type | Data dikelompokkan sesuai period | ⬜ |
| Multi-currency | Revenue ditampilkan per currency | ⬜ |
| RBAC - Super Admin | Tidak bisa akses (403) | ⬜ |
| RBAC - Admin | Tidak bisa akses (403) | ⬜ |
| Empty state | Tampil pesan yang sesuai | ⬜ |
| Loading state | Loading indicator muncul | ⬜ |
| Error handling | Error message jelas | ⬜ |
| Responsive mobile | UI responsif di mobile | ⬜ |
| Responsive tablet | UI responsif di tablet | ⬜ |
| Responsive desktop | UI responsif di desktop | ⬜ |

---

## 📞 Kontak

Jika menemukan bug atau ada pertanyaan:
- **Developer**: [Nama Developer]
- **Email**: dev@tridjaya.com
- **Slack**: #pixel-tracking-dev

---

## 📝 Catatan Testing

**Tanggal Testing**: _______________

**Tester**: _______________

**Browser**: _______________

**OS**: _______________

**Hasil Testing**:
- [ ] Semua test case passed
- [ ] Ada bug yang ditemukan (list di bawah)
- [ ] Perlu improvement (list di bawah)

**Bug yang Ditemukan**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Improvement yang Disarankan**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

**Happy Testing! 🚀**
