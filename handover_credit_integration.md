# TECHNICAL HANDOVER: Integrasi Kalkulasi Kredit Dinamis 2025

**Owner Agent**: VS (Visual/Frontend Specialist)
**Objective**: Mengganti input manual simulasi kredit dengan sistem otomatis berbasis data Excel Pricelist 2025 yang telah dikonversi ke JSON.

---

## 1. Referensi Data & Lokasi File
Data hasil ekstraksi dari file Excel Pricelist 2025 (NEW & RO) tersimpan di:
- **JSON Data**: `docs/kredit/credit_calculations.json` (Ukuran ~700KB)
- **Logic Guide**: `docs/kredit/credit_guide.md`

---

## 2. Arsitektur Logic (Core Engine)

Sistem harus menggunakan logika berikut untuk menentukan jumlah cicilan:

### A. Rumus Penyesuaian Harga
Setiap harga dasar produk (Cash/OTR) wajib ditambah biaya admin sistem sebelum mencari di tabel:
```text
Harga_Simulasi = Harga_Barang + 700.000
```

### B. Pencocokan Key (Standardization)
Karena data Excel menggunakan kenaikan 25.000, hasil `Harga_Simulasi` harus dibulatkan ke bawah ke kelipatan 25.000 terdekat untuk digunakan sebagai `key` di JSON.
> Contoh: Jika harga simulasi 1.715.000 -> Cari key "1700000".

### C. Pemetaan Kategori (Mapping)
Gunakan `product.subcategory` atau `product.category` untuk memilih sheet yang benar di JSON:
- `furniture`: Untuk Sofa, Lemari, Meja, Springbed (Mapping: `ELEK FUR ARREAR`).
- `electronics`: Untuk TV, AC, Kulkas (Mapping: `ELEK FUR ADV`).
- `gadget`: Untuk Smartphone, Tablet (Mapping: `GADGET OTH ADV`).
- **Catatan**: Untuk Sepeda Listrik (Bikes), gunakan kategori `electronics` (ADV) kecuali ada instruksi khusus.

---

## 3. Langkah-Langkah Integrasi (Step-by-Step)

### Step 1: Penyiapan Data Aset
Pindahkan `credit_calculations.json` dari folder `docs/` ke `frontend/public/data/` agar dapat diakses melalui `fetch` (jangan di-import langsung di bundle karena ukurannya yang besar).

### Step 2: Pembuatan Link Utility (`creditCalculator.ts`)
Buat file `frontend/src/utils/creditCalculator.ts` yang berisi:
- Interface untuk `CreditData`.
- Fungsi `calculateInstallments(price, customerType, category)`.
- Fallback logic jika harga di bawah minimal (1.500.000) atau di atas maksimal.

### Step 3: UI Component `CreditSimulator.tsx`
Buat komponen UI yang menampilkan:
- **Toggle/Tabs**: "Pelanggan Baru" vs "Lama (Repeat Order)".
- **Tabel Cicilan**: Menampilkan kolom Tenor (6x, 9x, 11x*, 13x*) dan Anguran per bulan.
- **Promo Note**: Berikan keterangan "Gratis 1x Angsuran" untuk 12x (11x) dan "Gratis 2x Angsuran" untuk 15x (13x).

### Step 4: Page Integration (`ProductDetailPage.tsx`)
- Integrasikan `CreditSimulator` di bawah area harga produk.
- Update state saat user memilih tenor, dan pastikan tenor yang dipilih diteruskan ke pesan WhatsApp (WA URL params).

---

## 4. Aturan Penting (Strict Rules)
1. **Gadget Limitation**: Tenor 15x/13x **TIDAK ADA** untuk Gadget. Sembunyikan opsi ini jika kategori adalah Gadget.
2. **Formatting**: Selalu gunakan `Intl.NumberFormat('id-ID')` untuk menampilkan angka rupiah.
3. **Data Loading**: Gunakan `Suspense` atau loading spinner saat file JSON sedang di-fetch untuk pertama kalinya.
4. **Rounding Accuracy**: Pastikan pembulatan harga simulasi dilakukan sebelum lookup JSON.

---

## 5. Pesan Ke WhatsApp (Example Flow)
Output akhir dari simulasi ini harus memperbarui pesan WhatsApp:
`"Halo Tridjaya, saya ingin kredit [Produk] dengan Tenor [12x Jadi 11x] angsuran [Rp XXX.XXX] (Nasabah [Baru/RO])."`

---

**Target Selesai**: Fase 9 awal.
**Contact Perancang**: Agent yang melakukan abstraksi Excel (Gemini Agent).
