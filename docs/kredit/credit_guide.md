# Panduan Integrasi Kalkulasi Kredit Tridjaya Samrat

Dokumen ini menjelaskan cara menggunakan data dari file Excel Pricelist 2025 yang telah dikonversi menjadi format JSON untuk menghitung cicilan secara dinamis di aplikasi.

## 1. Aturan Perhitungan (Business Logic)

Berdasarkan analisis file Excel `PRICELIST KONS 2025`, berikut adalah aturan perhitungannya:

- **Rumus Harga Dasar**: `Harga Simulasi = Harga Produk (OTR/Cash) + 700.000`
- **Pencocokan Harga**: Hasil `Harga Simulasi` dicocokkan dengan kolom "HARGA BARANG" di tabel Excel.
- **Tenor & Tenor Promo**:
    - **6X**: Cicilan standar 6 bulan.
    - **9X**: Cicilan standar 9 bulan.
    - **12X** (Label: "12 Jadi 11X"): Cicilan 12 bulan dengan gratis 1 bulan angsuran.
    - **15X** (Label: "15 Jadi 13X"): Cicilan 15 bulan dengan gratis 2 bulan angsuran (**Hanya tersedia untuk Furniture & Elektronik**).

## 2. Struktur Data JSON (`credit_calculations.json`)

Data dibagi berdasarkan tipe nasabah dan kategori barang:
- `NEW`: Nasabah baru.
- `RO`: Nasabah Repeat Order (sudah pernah kredit sebelumnya).
- **Kategori**:
    - `furniture`: Mengacu pada sheet `ELEK FUR ARREAR`.
    - `electronics`: Mengacu pada sheet `ELEK FUR ADV`.
    - `gadget`: Mengacu pada sheet `GADGET OTH ADV`.

## 3. Contoh Implementasi Logic (TypeScript)

Gunakan logika pembulatan ke bawah ke kelipatan 25.000 terdekat untuk mencocokkan dengan kunci (key) di JSON, karena tabel Excel menggunakan kenaikan per 25.000.

```typescript
function getInstallment(basePrice: number, customerType: 'NEW' | 'RO', category: string) {
  // 1. Terapkan Biaya Admin/Proses
  const simulatedPrice = basePrice + 700000;
  
  // 2. Bulatkan ke bawah ke 25rb terdekat (sesuai list di Excel)
  const matchedPrice = Math.floor(simulatedPrice / 25000) * 25000;
  
  // 3. Ambil data dari JSON
  const data = creditData[customerType][category][matchedPrice.toString()];
  
  return data; // Mengembalikan { "6x": ..., "9x": ..., "12x": ..., "15x": ... }
}
```

## 4. File yang Perlu Diperbarui (To-Do List)

| File | Tindakan | Deskripsi |
|---|---|---|
| `docs/kredit/credit_calculations.json` | **[NEW]** | File data hasil konversi Excel. |
| `frontend/src/utils/creditUtils.ts` | **[NEW]** | Buat fungsi helper untuk perhitungan dan pencocokan harga. |
| `frontend/src/pages/ProductDetailPage.tsx` | **[MODIFY]** | Tambahkan dropdown pilih tipe nasabah (Baru/RO) dan tampilkan tabel simulasi cicilan otomatis. |
| `frontend/src/store/useProductStore.ts` | **[MODIFY]** | Pastikan setiap produk memiliki metadata `category` yang tepat (furniture/electronics/gadget). |
| `frontend/src/components/CreditSimulator.tsx` | **[NEW]** | Komponen UI khusus untuk menampilkan simulasi pilihan tenor. |

---

**Catatan**: Untuk produk Gadget, tenor 15x tidak tersedia di pricelist resmi 2025. Sistem harus otomatis menyembunyikan opsi 15x jika kategori produk adalah gadget.
