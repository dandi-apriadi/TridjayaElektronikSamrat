# 📊 Bulk Import/Update Produk - Dokumentasi Fitur

## 🎯 Overview

Fitur **Bulk Import/Update Produk** memungkinkan admin untuk mengimport dan mengupdate data katalog produk secara massal dari file Excel. Sistem akan otomatis mencocokkan produk berdasarkan nama dan melakukan update jika ada perubahan data, khususnya perubahan harga.

## 🎯 Tujuan Fitur

✅ Import data produk baru dari Excel  
✅ Update harga produk yang sudah ada secara massal  
✅ Update informasi produk lainnya (kategori, stok, deskripsi)  
✅ Smart matching berbasis nama produk (case-insensitive + fuzzy search)  
✅ Preview lengkap sebelum processing  
✅ Validasi satu persatu dengan error handling  

## 📍 Lokasi Fitur

**URL Dashboard Admin**: `/dashboard/admin/catalog/bulk-import`  
**Button di Admin Catalog**: Sidebar Manajemen Produk → Bulk Import

## 📁 Struktur File yang Dibuat

```
src/
├── components/
│   └── AdminProductBulkImport.tsx          # Component utama UI import
├── pages/
│   └── dashboard/
│       └── AdminProductBulkImportPage.tsx  # Page wrapper dengan help section
└── utils/
    └── productImportHandler.ts             # Utility functions untuk parsing & matching
```

## 🔧 Teknologi yang Digunakan

- **xlsx** (^16.0.0): Library untuk parsing file Excel
- **React** + **TypeScript**: Component UI
- **Framer Motion**: Animasi transisi antar step
- **Zustand**: State management untuk products
- **Tailwind CSS**: Styling

## 📊 Alur Penggunaan

### Step 1: Upload File
```
1. User membuka halaman Bulk Import
2. Upload atau drag-drop file Excel (.xls, .xlsx, .csv)
3. Sistem parse file dan tampilkan summary
4. Lanjut ke Step 2 Preview
```

### Step 2: Preview Perubahan
```
1. Tampilkan semua baris dengan status:
   - ✅ MATCHED (produk ditemukan, siap diupdate)
   - ➕ BARU (produk baru, akan dibuat)
   - ❌ ERROR (ada validasi yang gagal)

2. Filter berdasarkan status
3. Expand untuk melihat detail perubahan
4. Highlight perubahan harga dengan persentase
5. Lanjut ke Step 3 Processing atau kembali ke Upload
```

### Step 3: Processing
```
1. Proses update/create satu persatu
2. Tampilkan progress indication
3. Log hasil setiap operasi
4. Tampilkan summary: Success ✅ | Failed ❌
```

## 🔀 Smart Matching Algorithm

Sistem menggunakan multiple-stage matching untuk menemukan produk:

```typescript
1. EXACT MATCH (case-insensitive)
   "Yamaha Nmax" → "yamaha nmax" ✓

2. PARTIAL MATCH
   "Yamaha" ⊆ "Yamaha Nmax" ✓
   "Yamaha Nmax" ⊇ "Yamaha" ✓

3. FUZZY MATCH (word-based)
   "Yamaha Nmax 2024" vs "Yamaha Nmax"
   Cocok jika 60% kata tersedia ✓

4. TIDAK ADA MATCH
   Produk akan dibuat sebagai produk baru
```

## 📋 Format Excel yang Diterima

### Kolom Wajib
- **nama** (atau: name, product_name, product name)  
  - Digunakan sebagai key matching
  - Harus ada dan tidak boleh kosong

### Kolom Opsional
- **harga** (atau: price, unit_price, unit price)  
  - Format: Angka saja, tanpa simbol
  - Contoh: `5000000` bukan `Rp 5.000.000`

- **stok** (atau: stock, stok, stock_status)  
  - Value yang valid: `available`, `limited`, `out_of_stock`, `discontinued`
  - Default: `available`

- **kategori** (atau: category, kategori)  
  - Contoh: `bike`, `electronics`, `furniture`

- **subkategori** (atau: subcategory, sub_category, sub category)  
  - Contoh: `sport`, `mpv`, `kitchen`

- **deskripsi singkat** (atau: short_desc, shortdesc, short description)  
  - Text deskripsi singkat

- **deskripsi** (atau: description, desc)  
  - Text deskripsi panjang

### Kolom Tambahan
Kolom apapun yang tidak termasuk di atas akan diabaikan tetapi tetap diproses.

### Contoh File Excel

```
| nama                | harga     | stok      | kategori    | deskripsi singkat    |
|-------------------|-----------|-----------|-------------|----------------------|
| Yamaha Nmax        | 29000000  | available | bike        | Motor sport kencang  |
| Suzuki Ertiga      | 165000000 | limited   | car         | Mobil keluarga       |
| Honda Rebel 500    | 95000000  | available | bike        | Cruiser klasik       |
```

## 🔍 Detail Implementasi

### File: `src/utils/productImportHandler.ts`

**Function-function utama:**

1. **parseExcelFile(file: File)**
   - Input: File object dari input type="file"
   - Output: Promise<ProductImportRow[]>
   - Membaca dan normalize field names
   - Validasi struktur data

2. **matchProductByName(importedName, existingProducts)**
   - Input: Nama produk, list produk existing
   - Output: Product | undefined
   - Implementasi 3-stage matching algorithm

3. **generateImportPreview(importedRows, existingProducts)**
   - Input: Data import, list produk existing
   - Output: ImportPreviewItem[] dengan detail matching
   - Detect perubahan harga dan highlight perbedaan

4. **prepareUpdateData(importRow)**
   - Input: Row data dari Excel
   - Output: Partial<Product> untuk API
   - Clean dan validate setiap field

5. **getImportSummary(preview)**
   - Input: Import preview items
   - Output: Summary statistics
   - Count: total, matched, new, errors, price changes

### File: `src/components/AdminProductBulkImport.tsx`

**State Management:**
```typescript
- step: 'upload' | 'preview' | 'processing'
- selectedFile: File | null
- preview: ImportPreviewItem[]
- processing: boolean
- filterStatus: 'all' | 'matched' | 'new' | 'error'
- expandedRows: Set<number>
```

**Handlers:**
- `handleFileSelect`: Parse file dan generate preview
- `handleDragOver/handleDrop`: Drag-drop file
- `handleProcessImport`: Execute update/create operations
- `toggleRowExpand`: Expand/collapse detail baris
- `downloadTemplate`: Download template CSV

### File: `src/pages/dashboard/AdminProductBulkImportPage.tsx`

Wrapper page dengan:
- Navigation back button
- Component utama AdminProductBulkImport
- Help section dengan panduan
- Tips penggunaan

## 🚀 Cara Menggunakan

### 1. Download Template (Opsional)
```
1. Buka halaman Bulk Import
2. Klik "Download Template"
3. File `product_import_template.csv` akan terdownload
4. Edit file dengan data produk Anda
```

### 2. Upload File
```
1. Click area upload atau drag-drop file
2. Pilih file Excel (.xls, .xlsx) atau CSV
3. Sistem akan memparse dan tampilkan preview
```

### 3. Review Preview
```
1. Lihat summary statistik (Matched, Baru, Error)
2. Filter berdasarkan status (matched/baru/error)
3. Expand row untuk melihat detail perubahan
4. Khusus untuk perubahan harga akan ditampilkan:
   - Harga lama: Rp X
   - Harga baru: Rp Y
   - Perubahan: +Rp Z atau -Rp Z
```

### 4. Proses Import
```
1. Click "Proses Import"
2. Tunggu hingga selesai processing
3. Lihat hasil update di toast notification
4. Refresh halaman untuk melihat perubahan
```

## ✅ Validasi & Error Handling

### Level 1: File Validation
- File harus Excel (.xls, .xlsx) atau CSV
- File tidak boleh kosong
- Minimal ada 1 data row

### Level 2: Data Validation
- Kolom "nama" wajib ada dan tidak kosong
- Format harga harus numeric
- Status stok harus dari list yang valid

### Level 3: Processing Validation
- Skip jika ada error pada data
- Continue dengan baris berikutnya
- Log detail error untuk debugging

## 🔐 Security Considerations

✅ **Input Validation**: Semua data dari Excel divalidasi sebelum disimpan  
✅ **Authorization**: Hanya admin yang bisa akses fitur  
✅ **Rate Limiting**: Backend harus implement rate limiting untuk bulk operations  
✅ **Audit Trail**: Catat semua bulk import operations di log  
✅ **Data Integrity**: Gunakan transaction untuk consistency  

## 📊 Performance Tips

- Untuk file besar (>1000 produk), processing mungkin memakan waktu
- UI akan terus responsif selama processing
- Bisa di-resume jika ada network error
- Recommend batch size: 500-1000 produk per file

## 🐛 Known Limitations

1. File ukuran besar (>50MB) mungkin lambat
2. Matching belum support transliteration (misal: "Yamaha" vs "Yama-ha")
3. Kolom custom (selain standard) tidak akan diupdate
4. Image upload tidak bisa via bulk import

## 🚀 Future Enhancements

- [ ] Support import images dari folder/URL
- [ ] Support import specifications as JSON
- [ ] Batch scheduling untuk file besar
- [ ] Email notification saat import selesai
- [ ] Undo last bulk import operation
- [ ] Export import history/report
- [ ] Template berbeda untuk kategori produk

## 📞 Troubleshooting

### Error: "Cannot find module xlsx"
```bash
cd frontend
npm install xlsx
```

### File tidak terbaca
- Pastikan file Excel valid (bukan corrupt)
- Gunakan format .xlsx (lebih compatible)
- Check Excel file di Microsoft Excel dulu

### Produk tidak match
- Check nama produk persis sama (case-sensitive internal)
- Gunakan exact name dari catalog existing
- Lihat detail preview untuk melihat matching logic

### Proses lambat
- File terlalu besar, split menjadi beberapa file
- Close tab lain untuk give more resources
- Check network connection

## 📚 Related Files

- Schema Database: [backend/migrations/2026042801_product_categories.sql](backend/migrations/2026042801_product_categories.sql)
- Product API: [docs/api.md#5-catalog-endpoints](docs/api.md#5-catalog-endpoints)
- Frontend Store: [src/store/useProductStore.ts](src/store/useProductStore.ts)
- Product Types: [src/types/index.ts](src/types/index.ts)

## 🎓 Example Usage

### Scenario: Update harga 10 produk

1. Buka file Excel produk existing
2. Copy & update harga untuk 10 produk:
   ```
   | nama                | harga_baru  |
   | Yamaha Nmax        | 28500000    |
   | Suzuki Ertiga      | 160000000   |
   | ... (8 produk lainnya) |
   ```

3. Upload file ke Bulk Import
4. Review preview - lihat semua 10 produk matched
5. Lihat perubahan harga untuk setiap produk
6. Click "Proses Import"
7. Tunggu selesai ✅
8. Refresh halaman, lihat harga sudah terupdate

---

**Last Updated**: May 2, 2026  
**Author**: Development Team  
**Version**: 1.0
