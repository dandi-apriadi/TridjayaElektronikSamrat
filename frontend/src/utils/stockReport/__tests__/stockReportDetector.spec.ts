import { describe, it, expect } from 'vitest';
import { detectFileType, normalizeHeader } from '../stockReportDetector';

describe('normalizeHeader', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeHeader('  Stok  Fisik ')).toBe('stok fisik');
    expect(normalizeHeader('QTY\t\tFisik')).toBe('qty fisik');
    expect(normalizeHeader('Selisih')).toBe('selisih');
  });
});

describe('detectFileType', () => {
  it('classifies as stock report when >=2 stock columns present', () => {
    const result = detectFileType(['Kode Barang', 'Nama Barang', 'Stok Fisik', 'Stok Sistem', 'Selisih']);
    expect(result.isStockReport).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(2);
    expect(result.matchedColumns).toContain('stok fisik');
    expect(result.matchedColumns).toContain('stok sistem');
  });

  it('classifies as stock report with exactly 2 stock columns', () => {
    const result = detectFileType(['Stok Fisik', 'Stok Sistem']);
    expect(result.isStockReport).toBe(true);
    expect(result.confidence).toBe(2);
  });

  it('classifies as non-stock when only 1 stock column', () => {
    const result = detectFileType(['Nama Barang', 'Stok Fisik']);
    expect(result.isStockReport).toBe(false);
    expect(result.confidence).toBe(1);
  });

  it('classifies as non-stock with no matching columns', () => {
    const result = detectFileType(['Foo', 'Bar', 'Baz']);
    expect(result.isStockReport).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('is case-insensitive', () => {
    const result = detectFileType(['STOK FISIK', 'STOK SISTEM', 'SELISIH']);
    expect(result.isStockReport).toBe(true);
    expect(result.confidence).toBe(3);
  });

  it('handles common import headers without error', () => {
    const result = detectFileType(['Nama Produk', 'Harga', 'Kategori']);
    expect(result.isStockReport).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('classifies Tridjaya stock report headers as stock report', () => {
    const result = detectFileType([
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
    ]);

    expect(result.isStockReport).toBe(true);
    expect(result.matchedColumns).toContain('stok akhir');
    expect(result.matchedColumns).toContain('harga satuan');
  });
});
