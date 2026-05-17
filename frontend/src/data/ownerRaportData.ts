/** Posisi/jabatan karyawan beserta daftar jobdesk harian */
export interface JobdeskPosition {
  id: string;
  posisi: string;
  jobdesks: string[];
}

/** Data raport harian satu karyawan */
export interface EmployeeRaport {
  id: string;
  nama: string;
  posisi: string;
  cabang: string;
  /** Jumlah jobdesk yang selesai hari ini */
  selesai: number;
  /** Total jobdesk yang harus dikerjakan */
  totalJobdesk: number;
  /** Persentase penyelesaian */
  persentase: number;
}

/** Ringkasan raport per cabang */
export interface CabangRaportSummary {
  cabang: string;
  totalKaryawan: number;
  rataPersentase: number;
}

/** Ringkasan raport per posisi */
export interface PosisiRaportSummary {
  posisi: string;
  totalKaryawan: number;
  rataPersentase: number;
}

// ============================================================
// JOBDESK PER POSISI (dari Excel JOBDESK HARIAN TE)
// ============================================================

export const jobdeskPositions: JobdeskPosition[] = [
  {
    id: 'koordinator',
    posisi: 'Koordinator',
    jobdesks: [
      'Update kebersihan toko dan display',
      'Harga terpasang semua dan penuh dengan display',
      'Tambah kontak WA minimal 20-30 kontak per hari',
      'Posting di FB akun pribadi (2x)',
      'BC WA pribadi (100 orang)',
      'Update status WA pribadi (10x)',
      'Add friend FB 30 orang',
      'KBK Online (penawaran)',
      'Membuat video TikTok harian',
      'Update katalog dengan design terbaru di WA Bisnis',
      'Update SPK ke grup',
      'Broadcast RO',
      'Kunjungan ke channel',
      'Briefing pagi dengan team',
      'Laporan buku tamu harian',
      'Laporan penjualan harian',
      'Laporan feedback prospek di group WA',
    ],
  },
  {
    id: 'sales-elektronik',
    posisi: 'Sales Elektronik',
    jobdesks: [
      'Komentar di FB minimal 5',
      'Broadcast WA pribadi ke 100 orang',
      'Screenshot chat penawaran KBK ke relasi',
      'Update katalog dengan design promo terbaru',
      'Minta konsumen tag akun Instagram',
      'Screenshot chat trik psikologis di WA',
      'Laporan buku tamu harian walk in dan prospek',
      'Kenalan dan ngobrol minimal 10 orang per hari',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Shareloc lokasi toko ke semua prospekan',
      'Minta konsumen scan QR medsos cabang',
      'Video woro-woro di kerumunan',
      'Minta konsumen follow medsos & Google review',
      'Kirim prospek min 20 per hari',
    ],
  },
  {
    id: 'driver',
    posisi: 'Driver',
    jobdesks: [
      'Telepon cabang tujuan untuk memastikan tambahan',
      'Laporan perawatan mobil pagi hari (video + foto STNK)',
      'Serah terima uang ke kasir/admin',
      'Tambah kontak minimal 5',
      'Video pengantaran dengan musik dan woro-woro',
      'Minimal 8 pengiriman per hari',
      'Laporan kerja harian dan minimal 2 IDG',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Foto dengan konsumen/tetangga bagi brosur min 10',
      'Minta konsumen follow medsos & Google review',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'pdi',
    posisi: 'PDI',
    jobdesks: [
      'Terima DO dan cek kondisi barang datang',
      'Home service konsumen jika diminta',
      'Tambah kontak minimal 5',
      'Minimal 5 foto kenalan dan ngobrol per hari',
      'IDG dan laporan kerja harian',
      'Pengelolaan unit retur dan update ke admin stock',
      'Repair segera minimal 1 unit per hari',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'admin-pencairan',
    posisi: 'Admin Pencairan',
    jobdesks: [
      'Input pencairan/penagihan leasing',
      'Follow up pencairan semua leasing',
      'Update pendingan berkas',
      'Follow up tagihan pencairan yang belum cair',
      'IDG dan LKH',
      'Update status WA dan tambah 3 kontak',
      'Posting minimal 5 konten promosi',
      'Berikan minimal 3 komentar aktif di FB',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'SS WA chat kejar pendingan uang/pencairan',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'admin-spk',
    posisi: 'Admin SPK',
    jobdesks: [
      'Pastikan SPK semua terinput tidak ada cancel/null',
      'Data konsumen lengkap sebelum input (KTP, No HP)',
      'IDG dan LKH',
      'Komen minimal 3 komen di FB',
      'Tambah kontak minimal 5',
      'BC konsumen lama/RO minimal 20 konsumen',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'kasir',
    posisi: 'Kasir',
    jobdesks: [
      'Penerimaan pembayaran cocokan dengan SPK',
      'Setor uang ke bank di hari yang sama',
      'Pendingan uang muka maksimal 1 hari',
      'BC konsumen lama/RO minimal 20 konsumen',
      'Tambah kontak minimal 5',
      'IDG dan LKH',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'SS WA chat kejar pendingan uang/pencairan',
      'Cek piutang di GS dan tagih yang belum close',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'admin-stok',
    posisi: 'Admin Stok',
    jobdesks: [
      'Laporan mutasi barang dan rekap mutasi',
      'Stock opname harian dan laporan ke grup',
      'Update data indent ke grup',
      'Laporan barang masuk share ke grup',
      'Bersih-bersih dan isi display kosong',
      'Foto setelah terima mutasi',
      'Pembagian dan pemerataan unit stock ke cabang',
      'Pagi hari share stock banyak + harga, promo',
      'Semua barang wajib ada price tag',
      'Kenalan 3 orang setiap hari',
      'Minimal 3 komentar di FB & share 100 grup',
      'Tambah kontak minimal 5',
      'IDG dan LKH',
      'Update stok ke sistem',
      'Share photo dan video stock semua handphone',
      'Upload video konten di TikTok setiap hari',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'support-konten',
    posisi: 'Support Konten',
    jobdesks: [
      'Membuat video/konten harian (minimal 1 video)',
      'Lelang barang baru di TikTok',
      'Edukasi di medsos harga mulai dari 40rb',
      'Membuat video/konten voucher 200/100/50',
      'Mengurus akun FB, IG, TikTok company',
      'Melempar minimal 25 prospek per orang per hari',
      'IDG LKH harian',
      'Kenalan dan ngobrol offline minimal 5 orang',
      'Tambah kontak minimal 5',
      'Broadcast database FGC',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Live TikTok minimal sejam sehari',
      'Ucapkan selamat ulang tahun ke konsumen',
    ],
  },
  {
    id: 'support-online',
    posisi: 'Support Online',
    jobdesks: [
      'Update data pelamar',
      'Broadcast minimal 200 orang',
      'Mendapatkan 5 prospek per cabang per hari',
      'Mengurus alur sosmed yang ada',
      'Kenalan 5 orang per hari',
      'Tambah kontak 5',
      'IDG LKH harian',
      'Share postingan ke lebih dari 100 grup',
      'WA bomber sehari 3x share',
      'Upload video konten di TikTok setiap hari',
      'Live TikTok minimal sejam sehari',
      'Ucapkan selamat ulang tahun ke konsumen',
    ],
  },
  {
    id: 'support-event',
    posisi: 'Support Event',
    jobdesks: [
      'Display motor dan sepeda listrik minimal 5 unit',
      'Display elektronik sesuai tema event',
      'X-banner minimal 3 pcs',
      'Tenda wajib branding Tridjaya',
      'Umbul-umbul minimal 5',
      'Brosur wajib',
      'Price tag wajib',
      'Backdrop wajib ada',
      'Promo spesial',
      'Target KTP minimal 10 KTP di foto',
      'Foto absen di event bersama team',
      'Kontrol channel dan display minimal 3x seminggu',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Ucapkan selamat ulang tahun ke konsumen',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'gc',
    posisi: 'GC (Guest Collector)',
    jobdesks: [
      'Membuat grup WA dengan relasi/instansi',
      'Menyapa semua grup dan forward pamflet online',
      'Tambah kontak 5',
      'Comment FB minimal 3 orang',
      'Broadcast minimal 30 orang per hari',
      'Kenalan dan ngobrol minimal 5 orang per hari',
      'Kunjungan minimal 3 elemen (swasta/pemerintah/dll)',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'support-mp',
    posisi: 'Support Marketplace',
    jobdesks: [
      'Update/tambah product minimal 5 product',
      'Broadcast minimal 30 orang per hari',
      'Ada comment minimal 3 di marketplace',
      'Mengurus alur sosmed marketplace',
      'Kenalan 5 orang per hari',
      'Tambah 5 kontak',
      'IDG LKH harian',
      'Packing untuk paket (kondisional)',
      'Share postingan ke lebih dari 100 grup',
      'Upload video konten di TikTok setiap hari',
      'Live TikTok minimal sejam setiap hari',
      'Ucapkan selamat ulang tahun ke konsumen',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'onwil',
    posisi: 'Online Wilayah',
    jobdesks: [
      'Melakukan live 2-4 jam per hari (per akun)',
      'Membuat konten 5-6 per hari (team)',
      'Bantu upload konten di sosmed cabang',
      'Bantu woro-woro offline',
      'Canvasing/kenalan 5 orang per hari',
      'Report setelah live (per akun)',
      'Share promo ke 5 grup',
      'Broadcast story WA & tambah 5 kontak baru',
      'Membuat konten khusus YouTube TE (team)',
      'Salin tautan 100x',
      '50 prospek/komen per hari (team)',
      'Prepare sebelum live',
      'Dokumentasi seputar live',
      'IDG & LKH',
      'Upload video konten di TikTok setiap hari',
      'Collect 2 password ke instansi/toko/café',
    ],
  },
  {
    id: 'crm',
    posisi: 'CRM',
    jobdesks: [
      'Broadcast minimal 200 orang',
      'Mengurus alur sosmed yang ada',
      'Tambah 5 kontak',
      'IDG LKH harian',
      'Share postingan ke lebih dari 100 grup',
      'WA bomber sehari 3x share',
      'Upload video konten di TikTok setiap hari',
      'Ucapkan selamat ulang tahun ke konsumen',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'poling',
    posisi: 'Poling',
    jobdesks: [
      'Update status order di Grup FIF Spektra',
      'Share hasil poling reject ke grup dan tag sales',
      'Proses banding konsumen reject FIF',
      'Share delivery note pengiriman',
      'Cek kesiapan unit kiriman',
      'Siapkan surat jalan untuk driver',
      'Update data pengiriman di sistem',
      'Monitor status pengiriman barang',
      'Kirim broadcast ke kontak WA konsumen',
      'Buat laporan harian pengiriman dan poling',
      'Kirim prospek per hari minimal 5',
    ],
  },
  {
    id: 'desk-call',
    posisi: 'Desk Call',
    jobdesks: [
      'Penarikan data penjualan seluruh cabang',
      'Mengikuti kegiatan Zoom Meeting',
      'Menghubungi konsumen terkait after sales',
      'Rekapitulasi prospek all sales',
      'Rekapitulasi sarana dan prasarana',
      'Share laporan prospek dan sarana prasarana di grup',
      'Melakukan kegiatan canvassing',
      'Melakukan broadcast pesan di WA',
      'Melakukan follow up konsumen',
      'Melakukan share promo di sosial media',
      'Kirim prospek per hari minimal 5',
    ],
  },
];

// ============================================================
// DUMMY DATA RAPORT KARYAWAN
// ============================================================

const cabangList = [
  'Manado Pusat', 'Tomohon', 'Bitung', 'Minahasa', 'Kotamobagu',
  'Tondano', 'Airmadidi', 'Langowan', 'Ratahan', 'Amurang',
  'Tahuna', 'Tagulandang', 'Lirung', 'Ondong', 'Beo', 'Melonguane',
];

function generateEmployeeRaports(): EmployeeRaport[] {
  const names = [
    'Ricky Mamahit', 'Venny Wongkar', 'Denny Pangalila', 'Steffy Lumowa',
    'Mario Tendean', 'Grace Maramis', 'Feby Kalalo', 'Jefri Sumolang',
    'Novita Runtuwene', 'Hendra Waworuntu', 'Melisa Tumewu', 'Agus Pinontoan',
    'Yuliana Senduk', 'Budi Lasut', 'Christin Mokoginta', 'Rivaldo Lolowang',
    'Siska Mawuntu', 'Ferdi Kalangi', 'Natalia Pondaag', 'Irwan Tambuwun',
    'Randy Kalalo', 'Novi Lumenta', 'Fajar Rumengan', 'Alicia Wuisan',
    'Dion Paat', 'Kevin Mambu', 'Wendy Langi', 'Siska Tuerah',
    'Eka Tumundo', 'Rizky Wienas', 'Meyke Tumel', 'Yopi Wuntu',
    'Stevi Moniaga', 'Jesi Pangomanan', 'Mita Tilaar', 'Hendra Kaligis',
    'Nita Watukow', 'Arland Ruru', 'Vicky Pandolaki', 'Tin Mangindaan',
  ];

  const raports: EmployeeRaport[] = [];
  let id = 1;

  for (const cabang of cabangList) {
    // Each cabang has 3-5 employees with different positions
    const positionsForCabang = jobdeskPositions.slice(0, 5 + Math.floor(Math.random() * 5));
    for (let i = 0; i < Math.min(3, positionsForCabang.length); i++) {
      const pos = positionsForCabang[i];
      const totalJobdesk = pos.jobdesks.length;
      const selesai = Math.floor(Math.random() * (totalJobdesk + 1));
      const persentase = Math.round((selesai / totalJobdesk) * 100);
      raports.push({
        id: `emp-${id}`,
        nama: names[(id - 1) % names.length],
        posisi: pos.posisi,
        cabang,
        selesai,
        totalJobdesk,
        persentase,
      });
      id++;
    }
  }
  return raports;
}

export const employeeRaports: EmployeeRaport[] = generateEmployeeRaports();

export const cabangRaportSummary: CabangRaportSummary[] = cabangList.map((cabang) => {
  const employees = employeeRaports.filter((e) => e.cabang === cabang);
  const rata = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.persentase, 0) / employees.length)
    : 0;
  return { cabang, totalKaryawan: employees.length, rataPersentase: rata };
});

export const posisiRaportSummary: PosisiRaportSummary[] = jobdeskPositions.map((pos) => {
  const employees = employeeRaports.filter((e) => e.posisi === pos.posisi);
  const rata = employees.length > 0
    ? Math.round(employees.reduce((s, e) => s + e.persentase, 0) / employees.length)
    : 0;
  return { posisi: pos.posisi, totalKaryawan: employees.length, rataPersentase: rata };
});

/** Overall raport percentage */
export const overallRaportPersentase = employeeRaports.length > 0
  ? Math.round(employeeRaports.reduce((s, e) => s + e.persentase, 0) / employeeRaports.length)
  : 0;
