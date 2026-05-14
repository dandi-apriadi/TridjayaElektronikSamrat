import { describe, it, expect } from 'vitest';
import {
  normalizeHeader,
  parseNumericValue,
  mapColumns,
  mapRow,
} from '../stockColumnMapper';

describe('normalizeHeader', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeHeader('  Stok  Fisik ')).toBe('stok fisik');
    expect(normalizeHeader('QTY\t\tFisik')).toBe('qty fisik');
    expect(normalizeHeader('Selisih')).toBe('selisih');
  });
});

describe('parseNumericValue', () => {
  it('parses plain integers', () => {
    expect(parseNumericValue('100').value).toBe(100);
    expect(parseNumericValue('0').value).toBe(0);
  });

  it('parses numbers with thousand separators (dots)', () => {
    expect(parseNumericValue('1.000').value).toBe(1000);
    expect(parseNumericValue('1.500.000').value).toBe(1500000);
  });

  it('parses numbers with decimal comma', () => {
    expect(parseNumericValue('100,50').value).toBe(100.5);
    expect(parseNumericValue('1.000,99').value).toBe(1000.99);
  });

  it('removes Rp prefix', () => {
    expect(parseNumericValue('Rp 50.000').value).toBe(50000);
    expect(parseNumericValue('rp1500').value).toBe(1500);
  });

  it('returns warning for empty string', () => {
    const result = parseNumericValue('');
    expect(result.value).toBe(0);
    expect(result.warning).toBeDefined();
  });

  it('returns warning for unparseable input', () => {
    const result = parseNumericValue('abc');
    expect(result.value).toBe(0);
    expect(result.warning).toBeDefined();
  });
});

describe('mapColumns', () => {
  it('maps known stock headers to canonical fields', () => {
    const mapping = mapColumns([
      'Kode Barang',
      'Nama Barang',
      'Stok Fisik',
      'Stok Sistem',
      'Selisih',
      'Lokasi',
    ]);

    expect(mapping.mapped['Kode Barang']).toBe('productCode');
    expect(mapping.mapped['Nama Barang']).toBe('productName');
    expect(mapping.mapped['Stok Fisik']).toBe('physicalStock');
    expect(mapping.mapped['Stok Sistem']).toBe('systemStock');
    expect(mapping.mapped['Selisih']).toBe('difference');
    expect(mapping.mapped['Lokasi']).toBe('location');
  });

  it('maps Tridjaya stock report headers', () => {
    const mapping = mapColumns([
      'Kode Barang',
      'Nama Barang',
      'Stok Akhir',
      'Harga Satuan',
      'Lokasi/Rak',
    ]);

    expect(mapping.mapped['Kode Barang']).toBe('productCode');
    expect(mapping.mapped['Nama Barang']).toBe('productName');
    expect(mapping.mapped['Stok Akhir']).toBe('physicalStock');
    expect(mapping.mapped['Harga Satuan']).toBe('unitCost');
    expect(mapping.mapped['Lokasi/Rak']).toBe('location');
    expect(mapping.missingRequired).toHaveLength(0);
  });

  it('collects unmapped headers', () => {
    const mapping = mapColumns(['Stok Fisik', 'Unknown Column', 'Extra']);
    expect(mapping.unmapped).toContain('Unknown Column');
    expect(mapping.unmapped).toContain('Extra');
    expect(mapping.unmapped).not.toContain('Stok Fisik');
  });

  it('reports missing required fields when physicalStock is absent', () => {
    const mapping = mapColumns(['Kode Barang', 'Nama Barang']);
    expect(mapping.missingRequired).toContain('physicalStock');
  });

  it('reports no missing required when both present', () => {
    const mapping = mapColumns(['Stok Fisik', 'Stok Sistem']);
    expect(mapping.missingRequired).toHaveLength(0);
  });
});

describe('mapRow', () => {
  it('maps row values using the column mapping', () => {
    const mapping = mapColumns(['Kode Barang', 'Stok Fisik', 'Stok Sistem']);
    const row = {
      'Kode Barang': 'BRG001',
      'Stok Fisik': '100',
      'Stok Sistem': '95',
    };
    const result = mapRow(row, mapping);
    expect(result['productCode']).toBe('BRG001');
    expect(result['physicalStock']).toBe('100');
    expect(result['systemStock']).toBe('95');
  });
});
