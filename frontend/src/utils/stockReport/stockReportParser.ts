import * as XLSX from 'xlsx';
import type { ParsedStockRow, StockParseResult, MappedRow } from './types';
import { mapColumns, mapRow, parseNumericValue } from './stockColumnMapper';

/**
 * Extract location and date from a stock report filename.
 * Expected patterns:
 *   "laporan stok {location} {day} {month} {year}.xlsx"
 *   "laporan stok gudang utama 15 mei 2024.xlsx"
 * Returns location in title case and date in YYYY-MM-DD if parseable.
 */
export function extractLocationFromFileName(
  fileName: string
): { location: string | null; date: string | null } {
  // Remove extension
  const base = fileName.replace(/\.[^.]+$/, '');

  // Try pattern: "laporan stok <location> <day> <month> <year>"
  const match = base.match(
    /^laporan\s+stok\s+(.+?)\s+(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/i
  );
  if (match) {
    const location = toTitleCase(match[1].trim());

    const day = parseInt(match[2], 10);
    const monthNames = [
      'januari', 'februari', 'maret', 'april', 'mei', 'juni',
      'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
    ];
    const monthIdx = monthNames.findIndex(
      (m) => m.toLowerCase() === match[3].toLowerCase()
    );
    const year = parseInt(match[4], 10);

    if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
      const date = new Date(Date.UTC(year, monthIdx, day));
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      return { location, date: dateStr };
    }

    return { location, date: null };
  }

  // Fallback: just try to extract anything after "stok"
  const looseMatch = base.match(/stok\s+(.+)/i);
  if (looseMatch) {
    return { location: toTitleCase(looseMatch[1].trim()), date: null };
  }

  return { location: null, date: null };
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function hasMappedContent(row: MappedRow): boolean {
  return Object.values(row).some((value) => {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  });
}

/**
 * Validate and convert a mapped row into a ParsedStockRow.
 * Valid if:
 *   - productName is 1-200 chars (if present)
 *   - at least one numeric stock value is parseable
 */
export function validateRow(
  row: MappedRow,
  rowNumber: number
): { parsed: ParsedStockRow | null; warning?: string; error?: string } {
  const rawName = row['productName'];
  const name =
    rawName !== undefined && rawName !== null ? String(rawName).trim() : '';

  if (name.length > 200) {
    return {
      parsed: null,
      error: `Row ${rowNumber}: Product name exceeds 200 characters`,
    };
  }

  // Parse stock values
  const physicalRaw = row['physicalStock'];
  const systemRaw = row['systemStock'];
  const differenceRaw = row['difference'];

  let physicalStock = 0;
  let systemStock = 0;
  let difference = 0;
  let hasStock = false;
  let hasPhysicalStock = false;
  let hasSystemStock = false;

  if (physicalRaw !== undefined && physicalRaw !== null) {
    const parsed = parseNumericValue(String(physicalRaw));
    if (!parsed.warning) {
      physicalStock = parsed.value;
      hasStock = true;
      hasPhysicalStock = true;
    }
  }
  if (systemRaw !== undefined && systemRaw !== null) {
    const parsed = parseNumericValue(String(systemRaw));
    if (!parsed.warning) {
      systemStock = parsed.value;
      hasStock = true;
      hasSystemStock = true;
    }
  }
  if (differenceRaw !== undefined && differenceRaw !== null) {
    const parsed = parseNumericValue(String(differenceRaw));
    if (!parsed.warning) {
      difference = parsed.value;
      hasStock = true;
    }
  }

  if (!hasStock) {
    return {
      parsed: null,
      error: `Row ${rowNumber}: No parseable stock value found`,
    };
  }

  if (hasPhysicalStock && !hasSystemStock) {
    systemStock = physicalStock;
  } else if (!hasPhysicalStock && hasSystemStock) {
    physicalStock = systemStock;
  }

  // If difference not provided, compute it
  if (
    differenceRaw === undefined ||
    differenceRaw === null ||
    String(differenceRaw).trim() === ''
  ) {
    difference = physicalStock - systemStock;
  }

  // Parse cost / value
  let unitCost: number | undefined;
  let totalValue: number | undefined;

  const costRaw = row['unitCost'];
  if (costRaw !== undefined && costRaw !== null) {
    const parsed = parseNumericValue(String(costRaw));
    if (!parsed.warning) {
      unitCost = parsed.value;
    }
  }

  const valRaw = row['totalValue'];
  if (valRaw !== undefined && valRaw !== null) {
    const parsed = parseNumericValue(String(valRaw));
    if (!parsed.warning) {
      totalValue = parsed.value;
    }
  }

  // Warnings
  let warning: string | undefined;
  if (physicalStock < 0 || systemStock < 0) {
    warning = `Row ${rowNumber}: Negative stock value detected`;
  }

  const parsedRow: ParsedStockRow = {
    productCode: row['productCode'] ? String(row['productCode']).trim() : undefined,
    productName: name || undefined,
    location: row['location'] ? String(row['location']).trim() : undefined,
    physicalStock,
    systemStock,
    difference,
    unitCost,
    totalValue,
    notes: row['notes'] ? String(row['notes']).trim() : undefined,
    raw: Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, v])
    ),
  };

  return { parsed: parsedRow, warning };
}

/**
 * Deduplicate rows by product name (case-insensitive).
 * Keep the last occurrence.
 */
export function deduplicateRows(
  rows: ParsedStockRow[]
): { unique: ParsedStockRow[]; duplicateCount: number } {
  const seen = new Map<string, ParsedStockRow>();
  let duplicateCount = 0;

  for (const row of rows) {
    const key = (row.productName || row.productCode || '').toLowerCase().trim();
    if (!key) continue; // skip rows with no identifiable name
    if (seen.has(key)) {
      duplicateCount++;
    }
    seen.set(key, row); // last occurrence wins
  }

  return { unique: Array.from(seen.values()), duplicateCount };
}

/**
 * Parse a stock report Excel workbook.
 */
export function parseStockReport(
  workbook: XLSX.WorkBook,
  fileName: string
): StockParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const parsedRows: ParsedStockRow[] = [];

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Read range; skip empty rows automatically
  const jsonRows = (XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    header: 1,
    blankrows: false,
  }) as unknown) as unknown[][];

  if (jsonRows.length < 2) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      warnings: ['File contains no data rows'],
      errors: [],
    };
  }

  // First row is headers
  const rawHeaders = jsonRows[0].map((h) => String(h ?? ''));
  const mapping = mapColumns(rawHeaders);

  if (mapping.missingRequired.length > 0) {
    warnings.push(
      `Missing required columns: ${mapping.missingRequired.join(', ')}`
    );
  }

  const locationInfo = extractLocationFromFileName(fileName);

  let totalRows = 0;
  let validRows = 0;
  let invalidRows = 0;

  for (let i = 1; i < jsonRows.length; i++) {
    const rawRow = jsonRows[i];

    // Skip completely empty rows
    if (rawRow.every((cell) => cell === '' || cell === null || cell === undefined)) {
      continue;
    }

    totalRows++;

    // Build record from headers + cells
    const record: Record<string, unknown> = {};
    for (let j = 0; j < rawHeaders.length; j++) {
      const header = rawHeaders[j];
      const cell = j < rawRow.length ? rawRow[j] : '';
      record[header] = cell;
    }

    const mappedRow = mapRow(record, mapping);
    if (!hasMappedContent(mappedRow)) {
      continue;
    }

    // Inject location from filename if not present
    if (!mappedRow['location'] && locationInfo.location) {
      mappedRow['location'] = locationInfo.location;
    }

    const result = validateRow(mappedRow, i + 1);

    if (result.warning) {
      warnings.push(result.warning);
    }

    if (result.error) {
      errors.push(result.error);
      invalidRows++;
      continue;
    }

    if (result.parsed) {
      parsedRows.push(result.parsed);
      validRows++;
    }
  }

  // Deduplicate
  const dedup = deduplicateRows(parsedRows);
  if (dedup.duplicateCount > 0) {
    warnings.push(`${dedup.duplicateCount} duplicate rows removed (kept last occurrence)`);
  }

  return {
    rows: dedup.unique,
    totalRows,
    validRows,
    invalidRows,
    warnings,
    errors,
  };
}
