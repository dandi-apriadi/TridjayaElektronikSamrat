import { describe, it, expect } from 'vitest';
import {
  extractLocationFromFileName,
  validateRow,
  deduplicateRows,
  parseStockReport,
} from '../stockReportParser';
import * as XLSX from 'xlsx';

describe('extractLocationFromFileName', () => {
  it('extracts location and date from standard filename', () => {
    const result = extractLocationFromFileName('laporan stok gudang utama 15 mei 2024.xlsx');
    expect(result.location).toBe('Gudang Utama');
    expect(result.date).toBe('2024-05-15');
  });

  it('extracts location from filename without exact pattern', () => {
    const result = extractLocationFromFileName('stok toko cabang.xlsx');
    expect(result.location).toBe('Toko Cabang');
    expect(result.date).toBeNull();
  });

  it('returns nulls for unknown filename', () => {
    const result = extractLocationFromFileName('random file.xlsx');
    expect(result.location).toBeNull();
    expect(result.date).toBeNull();
  });
});

describe('validateRow', () => {
  it('returns valid row with parsed stock values', () => {
    const row = {
      productCode: 'BRG001',
      productName: 'Produk A',
      physicalStock: '100',
      systemStock: '95',
      difference: '',
      unitCost: '5000',
      location: 'Gudang',
    };
    const result = validateRow(row, 2);
    expect(result.parsed).not.toBeNull();
    expect(result.parsed!.physicalStock).toBe(100);
    expect(result.parsed!.systemStock).toBe(95);
    expect(result.parsed!.difference).toBe(5); // computed
    expect(result.parsed!.unitCost).toBe(5000);
  });

  it('computes difference when not provided', () => {
    const row = {
      productName: 'Produk B',
      physicalStock: '50',
      systemStock: '48',
    };
    const result = validateRow(row, 3);
    expect(result.parsed!.difference).toBe(2);
  });

  it('defaults system stock to physical stock when the report only has final stock', () => {
    const row = {
      productName: 'Produk B',
      physicalStock: '50',
    };
    const result = validateRow(row, 3);
    expect(result.parsed!.physicalStock).toBe(50);
    expect(result.parsed!.systemStock).toBe(50);
    expect(result.parsed!.difference).toBe(0);
  });

  it('returns error for name too long', () => {
    const row = {
      productName: 'A'.repeat(201),
      physicalStock: '10',
    };
    const result = validateRow(row, 4);
    expect(result.parsed).toBeNull();
    expect(result.error).toContain('exceeds 200 characters');
  });

  it('returns error for no parseable stock values', () => {
    const row = {
      productName: 'Produk C',
    };
    const result = validateRow(row, 5);
    expect(result.parsed).toBeNull();
    expect(result.error).toContain('No parseable stock value');
  });

  it('returns warning for negative stock', () => {
    const row = {
      productName: 'Produk D',
      physicalStock: '-5',
      systemStock: '0',
    };
    const result = validateRow(row, 6);
    expect(result.parsed).not.toBeNull();
    expect(result.warning).toBeDefined();
    expect(result.warning).toMatch(/Negative stock/);
  });
});

describe('parseStockReport', () => {
  it('parses Tridjaya stock report headers', () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [
        'No',
        'Kode Barang',
        'Nama Barang',
        'Merk/Tipe',
        'Kategori',
        'Stok Awal',
        'Stok Masuk',
        'Stok Keluar',
        'Stok Akhir',
        'Stok Display',
        'Harga Satuan',
        'Qty Transaksi',
        'Total Transaksi',
        'Lokasi/Rak',
      ],
      [
        1,
        '2732',
        'AC PANASONIC 2 PK CS-PN18WKJ/CU-PN18WKJ',
        'PANASONIC',
        'AC',
        0,
        1,
        1,
        7,
        0,
        7000000,
        0,
        0,
        'D-06',
      ],
      [892077000, '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1');

    const result = parseStockReport(workbook, 'laporan stok te samrat 11 mei 2026_berheader.xlsx');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].productCode).toBe('2732');
    expect(result.rows[0].productName).toBe('AC PANASONIC 2 PK CS-PN18WKJ/CU-PN18WKJ');
    expect(result.rows[0].physicalStock).toBe(7);
    expect(result.rows[0].systemStock).toBe(7);
    expect(result.rows[0].difference).toBe(0);
    expect(result.rows[0].unitCost).toBe(7000000);
    expect(result.rows[0].location).toBe('D-06');
    expect(result.invalidRows).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe('deduplicateRows', () => {
  it('keeps last occurrence of duplicate names', () => {
    const rows = [
      { productName: 'Produk A', physicalStock: 10, systemStock: 5, difference: 5, raw: {} },
      { productName: 'Produk B', physicalStock: 20, systemStock: 15, difference: 5, raw: {} },
      { productName: 'Produk A', physicalStock: 30, systemStock: 25, difference: 5, raw: {} },
    ] as import('../types').ParsedStockRow[];

    const result = deduplicateRows(rows);
    expect(result.unique.length).toBe(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.unique.find((r) => r.productName === 'Produk A')!.physicalStock).toBe(30);
  });

  it('returns all rows when no duplicates', () => {
    const rows = [
      { productName: 'A', physicalStock: 1, systemStock: 0, difference: 1, raw: {} },
      { productName: 'B', physicalStock: 2, systemStock: 0, difference: 2, raw: {} },
    ] as import('../types').ParsedStockRow[];

    const result = deduplicateRows(rows);
    expect(result.unique.length).toBe(2);
    expect(result.duplicateCount).toBe(0);
  });
});
