# Requirements Document

## Introduction

Fitur ini menambahkan **database kontak terpusat** untuk sistem WA Blast. Saat ini, kontak (penerima) hanya tersimpan per-campaign di tabel `wa_recipients`, sehingga tidak bisa digunakan ulang antar campaign. Fitur ini menyediakan:

1. **Contact Database** — Tabel kontak terpusat yang bisa digunakan ulang di berbagai campaign
2. **Excel Template Download** — Download template Excel (.xlsx) dengan format yang jelas untuk input nomor telepon
3. **Excel Import** — Import data kontak dari file Excel (.xlsx/.csv) ke database kontak terpusat dengan validasi yang baik
4. **Contact Selection** — Kemampuan memilih kontak dari database saat membuat campaign

## Glossary

- **Contact_Manager**: Modul backend yang mengelola operasi CRUD pada database kontak terpusat
- **Contact**: Entitas yang merepresentasikan satu nomor telepon beserta metadata (nama, variabel) di database terpusat
- **Contact_Group**: Grup/label untuk mengelompokkan kontak berdasarkan kategori tertentu
- **Excel_Importer**: Komponen yang mem-parsing file Excel/CSV dan memasukkan data ke database kontak
- **Template_Generator**: Komponen yang menghasilkan file template Excel (.xlsx) untuk didownload user
- **Phone_Validator**: Komponen yang memvalidasi dan menormalisasi format nomor telepon Indonesia
- **Admin**: User dengan role Admin, WaAdmin, atau WaOperator yang memiliki akses ke fitur WA Blast

## Requirements

### Requirement 1: Manajemen Database Kontak

**User Story:** Sebagai Admin, saya ingin menyimpan kontak di database terpusat, sehingga saya bisa menggunakan ulang daftar kontak di berbagai campaign tanpa harus upload ulang.

#### Acceptance Criteria

1. THE Contact_Manager SHALL menyimpan setiap kontak dengan field: id, phone, name, group_id, variables_json, created_at, dan updated_at
2. WHEN Admin menambahkan kontak baru, THE Contact_Manager SHALL memvalidasi nomor telepon menggunakan Phone_Validator sebelum menyimpan
3. WHEN Admin menambahkan kontak dengan nomor telepon yang sudah ada di grup yang sama, THE Contact_Manager SHALL menolak duplikat dan mengembalikan pesan error yang deskriptif
4. WHEN Admin menghapus satu kontak, THE Contact_Manager SHALL menghapus kontak tersebut dari database terpusat
5. WHEN Admin menghapus banyak kontak sekaligus (bulk delete), THE Contact_Manager SHALL menghapus semua kontak yang dipilih dalam satu operasi
6. THE Contact_Manager SHALL menyediakan endpoint list kontak dengan dukungan pagination, filter berdasarkan group, dan pencarian berdasarkan nama atau nomor telepon

### Requirement 2: Manajemen Grup Kontak

**User Story:** Sebagai Admin, saya ingin mengelompokkan kontak ke dalam grup, sehingga saya bisa memilih target blast berdasarkan kategori (misalnya: pelanggan, supplier, reseller).

#### Acceptance Criteria

1. THE Contact_Manager SHALL menyediakan operasi CRUD untuk Contact_Group dengan field: id, name, description, created_at
2. WHEN Admin membuat grup baru dengan nama yang sudah ada, THE Contact_Manager SHALL menolak dan mengembalikan pesan error bahwa nama grup sudah digunakan
3. WHEN Admin menghapus grup yang masih memiliki kontak, THE Contact_Manager SHALL menghapus grup dan mengubah group_id kontak terkait menjadi null (unassigned)
4. THE Contact_Manager SHALL menampilkan jumlah kontak di setiap grup pada daftar grup

### Requirement 3: Download Template Excel

**User Story:** Sebagai Admin, saya ingin mendownload template Excel dengan format yang benar, sehingga saya bisa mengisi data kontak dengan mudah tanpa salah format.

#### Acceptance Criteria

1. WHEN Admin meminta download template, THE Template_Generator SHALL menghasilkan file Excel (.xlsx) dengan header kolom: phone, name, var1, var2
2. THE Template_Generator SHALL menyertakan 2 baris contoh data di template dengan nomor telepon format Indonesia (contoh: 628123456789)
3. THE Template_Generator SHALL menyertakan sheet kedua berisi instruksi pengisian yang menjelaskan format nomor telepon yang diterima (08xx, 628xx, +628xx)
4. THE Template_Generator SHALL mengembalikan file dengan Content-Disposition header yang mengandung nama file "template_kontak_wa.xlsx"

### Requirement 4: Import Kontak dari Excel

**User Story:** Sebagai Admin, saya ingin mengimport data kontak dari file Excel, sehingga saya bisa menambahkan banyak kontak sekaligus tanpa input manual satu per satu.

#### Acceptance Criteria

1. WHEN Admin mengupload file Excel (.xlsx atau .csv), THE Excel_Importer SHALL mem-parsing semua baris data setelah header row
2. WHEN file yang diupload tidak memiliki kolom "phone" di header, THE Excel_Importer SHALL mengembalikan error yang menjelaskan kolom yang diharapkan
3. WHEN Excel_Importer menemukan nomor telepon yang tidak valid pada suatu baris, THE Excel_Importer SHALL melewati baris tersebut dan mencatat nomor baris serta alasan error
4. WHEN Excel_Importer menemukan nomor telepon duplikat dalam file yang sama, THE Excel_Importer SHALL hanya memproses kemunculan pertama dan melewati duplikat berikutnya
5. WHEN Excel_Importer menemukan nomor telepon yang sudah ada di database pada grup yang sama, THE Excel_Importer SHALL memperbarui data nama dan variabel kontak yang sudah ada (upsert behavior)
6. WHEN import selesai, THE Excel_Importer SHALL mengembalikan ringkasan hasil: jumlah berhasil ditambahkan, jumlah diperbarui, jumlah dilewati, dan daftar error per baris
7. THE Excel_Importer SHALL mendukung file dengan ukuran maksimal 5MB
8. THE Excel_Importer SHALL memproses file dengan maksimal 10.000 baris data dalam satu kali import

### Requirement 5: Validasi Nomor Telepon

**User Story:** Sebagai Admin, saya ingin nomor telepon divalidasi secara otomatis, sehingga saya yakin semua kontak memiliki format yang benar untuk pengiriman WA.

#### Acceptance Criteria

1. THE Phone_Validator SHALL menerima format nomor: 08xx, 628xx, +628xx, dan 8xx (tanpa prefix)
2. WHEN nomor telepon diterima, THE Phone_Validator SHALL menormalisasi ke format 628xxxxxxxxxx (tanpa tanda +, tanpa spasi, tanpa strip)
3. WHEN nomor telepon memiliki panjang kurang dari 10 digit atau lebih dari 15 digit setelah normalisasi, THE Phone_Validator SHALL menolak nomor tersebut sebagai tidak valid
4. WHEN nomor telepon mengandung karakter non-numerik selain +, spasi, dan strip, THE Phone_Validator SHALL menolak nomor tersebut sebagai tidak valid

### Requirement 6: Integrasi Kontak dengan Campaign

**User Story:** Sebagai Admin, saya ingin memilih kontak dari database terpusat saat membuat campaign, sehingga saya tidak perlu upload ulang file Excel setiap kali membuat campaign baru.

#### Acceptance Criteria

1. WHEN Admin membuat campaign baru, THE Contact_Manager SHALL menyediakan opsi untuk memilih kontak dari database berdasarkan grup
2. WHEN Admin memilih satu atau lebih grup kontak untuk campaign, THE Contact_Manager SHALL menyalin kontak yang dipilih ke tabel wa_recipients untuk campaign tersebut
3. WHEN kontak disalin ke campaign, THE Contact_Manager SHALL mempertahankan semua variabel (name, var1, var2) dari database kontak ke recipient campaign
4. THE Contact_Manager SHALL tetap mendukung metode input recipient yang sudah ada (manual add dan upload langsung ke campaign)

### Requirement 7: Halaman UI Manajemen Kontak

**User Story:** Sebagai Admin, saya ingin halaman khusus untuk mengelola kontak, sehingga saya bisa melihat, menambah, mengedit, dan menghapus kontak dengan mudah.

#### Acceptance Criteria

1. THE Contact_Manager SHALL menampilkan halaman daftar kontak dengan tabel yang menunjukkan: nomor telepon, nama, grup, dan tanggal ditambahkan
2. THE Contact_Manager SHALL menyediakan fitur pencarian kontak berdasarkan nama atau nomor telepon dengan respons pencarian di bawah 500ms untuk database berisi 10.000 kontak
3. THE Contact_Manager SHALL menyediakan filter berdasarkan grup kontak
4. THE Contact_Manager SHALL menyediakan tombol download template Excel yang langsung memulai download file
5. THE Contact_Manager SHALL menyediakan area upload file (drag-and-drop atau klik) untuk import Excel
6. WHEN import sedang berjalan, THE Contact_Manager SHALL menampilkan progress indicator
7. WHEN import selesai, THE Contact_Manager SHALL menampilkan ringkasan hasil import (berhasil, diperbarui, gagal) dalam notifikasi atau modal
