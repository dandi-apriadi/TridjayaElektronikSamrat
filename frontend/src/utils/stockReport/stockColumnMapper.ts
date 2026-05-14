import type { ColumnMapping, MappedRow } from './types';

// Map normalized header -> canonical field name
const HEADER_MAP: Record<string, string> = {
  // Product identification
  'kode barang': 'productCode',
  'kode produk': 'productCode',
  'sku': 'productCode',
  'kode': 'productCode',
  'nama barang': 'productName',
  'nama produk': 'productName',
  'produk': 'productName',

  // Location
  'lokasi': 'location',
  'lokasi/rak': 'location',
  'lokasi rak': 'location',
  'gudang': 'location',
  'ruang': 'location',
  'warehouse': 'location',

  // Stock quantities
  'stok fisik': 'physicalStock',
  'stok aktual': 'physicalStock',
  'stok akhir': 'physicalStock',
  'stock akhir': 'physicalStock',
  'stok final': 'physicalStock',
  'saldo akhir': 'physicalStock',
  'qty akhir': 'physicalStock',
  'qty fisik': 'physicalStock',
  'qty aktual': 'physicalStock',
  'quantity fisik': 'physicalStock',
  'jumlah fisik': 'physicalStock',

  'stok sistem': 'systemStock',
  'stok tercatat': 'systemStock',
  'qty sistem': 'systemStock',
  'quantity sistem': 'systemStock',
  'jumlah sistem': 'systemStock',

  'selisih': 'difference',
  'perbedaan': 'difference',
  'diff': 'difference',
  'variance': 'difference',

  // Qty / Jumlah generic fallbacks
  'qty': 'quantity',
  'jumlah': 'quantity',
  'quantity': 'quantity',

  // Unit
  'unit': 'unit',
  'satuan': 'unit',

  // Cost / Value
  'harga': 'unitCost',
  'harga satuan': 'unitCost',
  'cost': 'unitCost',
  'unit cost': 'unitCost',
  'harga pokok': 'unitCost',

  'nilai': 'totalValue',
  'total nilai': 'totalValue',
  'total value': 'totalValue',
  'value': 'totalValue',

  // Notes
  'keterangan': 'notes',
  'catatan': 'notes',
  'notes': 'notes',
  'note': 'notes',
  'remarks': 'notes',
};

const REQUIRED_FIELDS = ['physicalStock'];

/**
 * Normalize a header string:
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
 * Parse a numeric value from a string that may contain
 * Indonesian formatting ("Rp", thousand separators as dots,
 * decimal comma).
 *
 * Rules:
 * - Remove "Rp" prefix
 * - Remove dots (thousand separators)
 * - Remove non-numeric chars except comma
 * - Treat comma as decimal separator
 */
export function parseNumericValue(value: string): { value: number; warning?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: 0, warning: 'Empty value treated as 0' };
  }

  let cleaned = trimmed;

  // Remove Rp prefix (case-insensitive)
  cleaned = cleaned.replace(/^rp\s*/i, '');

  // If the string contains a comma, assume last comma is decimal separator
  const parts = cleaned.split(',');
  let decimalPart = '';
  if (parts.length > 1) {
    decimalPart = parts.pop() ?? '';
    cleaned = parts.join('');
  }

  // Remove dots (thousand separators) and any remaining non-numeric except minus
  const isNegative = cleaned.trimStart().startsWith('-');
  cleaned = cleaned.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (isNegative && cleaned.length > 0) {
    cleaned = '-' + cleaned;
  }

  // Reassemble with decimal
  const numericString = decimalPart
    ? `${cleaned}.${decimalPart.replace(/[^0-9]/g, '')}`
    : cleaned;

  const num = parseFloat(numericString);

  if (isNaN(num)) {
    return { value: 0, warning: `Could not parse "${trimmed}" as number` };
  }

  return { value: num };
}

/**
 * Map raw headers to known fields.
 */
export function mapColumns(headers: string[]): ColumnMapping {
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const raw of headers) {
    const norm = normalizeHeader(raw);
    const field = HEADER_MAP[norm];
    if (field) {
      mapped[raw] = field;
    } else {
      unmapped.push(raw);
    }
  }

  const missingRequired = REQUIRED_FIELDS.filter(
    (req) => !Object.values(mapped).includes(req)
  );

  return {
    mapped,
    unmapped,
    requiredFields: REQUIRED_FIELDS,
    missingRequired,
  };
}

/**
 * Map a single data row using the column mapping.
 */
export function mapRow(row: Record<string, unknown>, mapping: ColumnMapping): MappedRow {
  const result: MappedRow = {};

  for (const [rawHeader, field] of Object.entries(mapping.mapped)) {
    const rawValue = row[rawHeader];
    result[field] = rawValue;
  }

  return result;
}
