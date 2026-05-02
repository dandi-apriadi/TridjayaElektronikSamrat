# WA Excel Import

Desktop app Rust untuk:
- membuka file Excel (.xlsx/.xlsm/.xls)
- mem-parse daftar recipient
- menambah recipient manual satu per satu
- mengirim recipient ke backend campaign WA

## Cara pakai

1. Isi `Backend URL`, `Token`, dan `Campaign ID`.
2. Klik `Pilih Excel` untuk memuat file.
3. Tambah recipient manual jika perlu.
4. Klik `Upload ke backend`.

## Format Excel

Baris pertama harus berisi header. Kolom phone wajib ada, nama kolom yang didukung:
- `phone`
- `phone_number`
- `phone_no`
- `nomor`
- `nomor_hp`
- `whatsapp`
- `whatsapp_number`
- `wa`

Kolom lain akan dikirim sebagai `variables` JSON.

Contoh header:

```text
phone,name,product,city
6281234567890,Budi,Promo A,Manado
```

## Build dan run

```bash
cargo run --manifest-path desktop/wa_excel_import/Cargo.toml
```

## Catatan

- Upload memakai endpoint backend `POST /api/wa/campaigns/{id}/recipients`.
- Manual add menerima JSON di kolom variables, misalnya: `{"name":"Budi","city":"Manado"}`.
