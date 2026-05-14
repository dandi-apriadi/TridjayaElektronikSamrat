import type { DetectionResult } from './types';

// Known stock report column headers (Indonesian + common variants)
const STOCK_COLUMNS = new Set([
  'stok awal',
  'stok masuk',
  'stok keluar',
  'stok akhir',
  'stok display',
  'stok fisik',
  'stok sistem',
  'selisih',
  'lokasi',
  'lokasi/rak',
  'kode barang',
  'qty',
  'qty transaksi',
  'jumlah',
  'stok aktual',
  'stok tercatat',
  'perbedaan',
  'kode produk',
  'sku',
  'qty fisik',
  'qty sistem',
  'quantity',
  'stok',
  'unit',
  'satuan',
  'harga satuan',
]);

// Standard import columns (not stock report)
const IMPORT_COLUMNS = new Set([
  'nama produk',
  'nama barang',
  'harga',
  'harga beli',
  'harga jual',
  'kategori',
  'deskripsi',
  'berat',
  'dimensi',
  'supplier',
  'brand',
  'merk',
]);

/**
 * Normalize a header string for matching:
 * - lowercase
 * - trim
 * - collapse internal whitespace
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Detect whether a file is a stock report based on its column headers.
 *
 * Classification rules:
 * - Stock report: >= 2 columns match the stock column set
 * - If < 2 stock columns AND no standard import columns found,
 *   return an error indicating unknown format
 */
export function detectFileType(headers: string[]): DetectionResult {
  const normalized = headers.map(normalizeHeader);

  const matched: string[] = [];
  let importMatches = 0;

  for (const h of normalized) {
    if (STOCK_COLUMNS.has(h)) {
      matched.push(h);
    } else if (IMPORT_COLUMNS.has(h)) {
      importMatches++;
    }
  }

  if (matched.length >= 2) {
    return {
      isStockReport: true,
      confidence: matched.length,
      matchedColumns: matched,
    };
  }

  if (matched.length === 0 && importMatches === 0) {
    return {
      isStockReport: false,
      confidence: 0,
      matchedColumns: [],
      error:
        'Format file tidak dikenali. Kolom tidak cocok dengan laporan stok maupun format impor standar.',
    };
  }

  return {
    isStockReport: false,
    confidence: matched.length,
    matchedColumns: matched,
  };
}
