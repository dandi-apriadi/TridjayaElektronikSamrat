# TODO List: Implementasi Fitur Kredit Dinamis 2025

Daftar tugas untuk mengintegrasikan data Excel Pricelist ke dalam aplikasi Tridjaya Samrat.

## 🛠️ Persiapan Data
- [x] Konversi `PRICELIST KONS NEW 2025.xlsx` ke JSON - **Selesai**
- [x] Konversi `PRICELIST KONS RO 2025-1.xlsx` ke JSON - **Selesai**
- [x] Buat file master `docs/kredit/credit_calculations.json` - **Selesai**
- [x] Buat file panduan `docs/kredit/credit_guide.md` - **Selesai**

## 💻 Pengembangan Frontend
- [x] **Data Placement**: Pindahkan `credit_calculations.json` ke `frontend/public/data/` agar bisa di-fetch secara dinamis.
- [x] **Utility Function**: Buat `frontend/src/utils/creditUtils.ts` untuk:
    - Logika `price + 700.000`.
    - Logika pembulatan ke 25.000 terdekat.
    - Fungsi pencarian data berdasarkan tipe nasabah (NEW/RO) dan kategori (Furniture/Elektronik/Gadget).
- [x] **Component Development**: Buat komponen `CreditCalculatorCard.tsx` yang interaktif.
- [x] **Page Integration**:
    - Update `ProductDetailPage.tsx` untuk menampilkan simulasi cicilan di bawah harga produk.
    - Tambahkan toggle/switch "Nasabah Baru" vs "Nasabah Lama (RO)".
    - Integrasikan pengiriman pilihan tenor ke WhatsApp Agen saat user klik "Ajukan Kredit".

## 🛡️ Backend & Type Safety
- [x] Tambahkan tipe data `CreditPlan` di `frontend/src/types/index.ts`.
- [ ] (Opsional) Buat endpoint di Rust `/api/kredit/calculate` jika ingin perhitungan dilakukan di sisi server untuk keamanan ekstra.

## 🧪 Pengujian
- [ ] Smoke test: Pastikan harga produk 1.000.000 menghasilkan simulasi yang sesuai dengan baris 1.700.000 di Excel.
- [ ] Edge case test: Produk Gadget tidak boleh menampilkan opsi 15x.
- [ ] Responsive test: Pastikan tabel simulasi kredit terbaca dengan baik di perangkat mobile.
