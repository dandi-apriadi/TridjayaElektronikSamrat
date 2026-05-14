import type { Product } from '../types';
import * as XLSX from 'xlsx';

export interface ProductImportRow {
  name: string;
  productCode?: string;
  price?: number | string;
  stock?: string;
  stockQuantity?: number | string;
  stockDisplayQuantity?: number | string;
  category?: string;
  subcategory?: string;
  description?: string;
  shortDesc?: string;
  [key: string]: any;
}

export interface ImportPreviewItem {
  rowNumber: number;
  name: string;
  status: 'matched' | 'new' | 'similar' | 'error';
  similarProducts?: Product[];
  matchedProduct?: Product;
  newData: Partial<ProductImportRow>;
  priceChange?: {
    old: number;
    new: number;
    difference: number;
  };
  fieldChanges?: {
    field: string;
    old: any;
    new: any;
  }[];
  error?: string;
}

export interface ImportResult {
  total: number;
  updates: number;
  creates: number;
  errors: number;
  details: ImportPreviewItem[];
}

function normalizeColumnName(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseImportNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }
  if (typeof value === 'number') return value;

  let cleaned = String(value).trim().replace(/^rp\s*/i, '');
  const commaParts = cleaned.split(',');
  let decimalPart = '';
  if (commaParts.length > 1) {
    decimalPart = commaParts.pop() ?? '';
    cleaned = commaParts.join('');
  }

  const isNegative = cleaned.trimStart().startsWith('-');
  cleaned = cleaned.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (isNegative && cleaned) cleaned = `-${cleaned}`;

  const numeric = decimalPart
    ? `${cleaned}.${decimalPart.replace(/[^0-9]/g, '')}`
    : cleaned;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeStockValue(value: unknown): string | undefined {
  if (value === undefined || value === null || String(value).trim() === '') {
    return undefined;
  }

  const text = String(value).trim().toLowerCase();
  const numeric = parseImportNumber(value);
  if (numeric !== undefined && /^-?[\d.,\s]+$/.test(text)) {
    if (numeric <= 0) return 'out_of_stock';
    if (numeric <= 5) return 'indent';
    return 'available';
  }

  const statusMap: Record<string, string> = {
    tersedia: 'available',
    ready: 'available',
    available: 'available',
    ada: 'available',
    limited: 'limited',
    terbatas: 'limited',
    indent: 'indent',
    inden: 'indent',
    kosong: 'out_of_stock',
    habis: 'out_of_stock',
    hidden: 'hidden',
    out_of_stock: 'out_of_stock',
    'out of stock': 'out_of_stock',
    discontinued: 'discontinued',
  };

  return statusMap[text] ?? text;
}

/**
 * Parse Excel file dan return array of product data
 */
export async function parseExcelFile(file: File): Promise<ProductImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('File tidak dapat dibaca'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        
        if (!sheetName) {
          reject(new Error('File Excel tidak memiliki sheet'));
          return;
        }

        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        // Validasi struktur data
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('File Excel kosong atau tidak valid'));
          return;
        }

        // Normalize field names (case-insensitive)
        const normalized: ProductImportRow[] = jsonData.map((row: any) => {
          const normalized: ProductImportRow = { name: '' };
          
          for (const [key, value] of Object.entries(row)) {
            const lowerKey = normalizeColumnName(key as string);
            
            // Map common variations
            if (['name', 'nama', 'nama barang', 'nama produk', 'product_name', 'product name'].includes(lowerKey)) {
              normalized.name = String(value || '').trim();
            } else if (['kode barang', 'kode produk', 'kode', 'sku', 'product_code', 'product code', 'item code', 'id'].includes(lowerKey)) {
              normalized.productCode = String(value || '').trim();
            } else if (['price', 'harga', 'harga satuan', 'harga jual', 'unit_price', 'unit price'].includes(lowerKey)) {
              const price = parseImportNumber(value);
              if (price !== undefined) {
                normalized.price = price;
              }
            } else if (['stock', 'stok', 'stok akhir', 'stock_status', 'stock status'].includes(lowerKey)) {
              const stockQuantity = parseImportNumber(value);
              normalized.stockQuantity = stockQuantity !== undefined ? stockQuantity : String(value || '').trim();
              normalized.stock = normalizeStockValue(value);
            } else if (['stok display', 'display stock', 'stock display'].includes(lowerKey)) {
              const stockDisplayQuantity = parseImportNumber(value);
              normalized.stockDisplayQuantity = stockDisplayQuantity !== undefined ? stockDisplayQuantity : String(value || '').trim();
            } else if (['category', 'kategori'].includes(lowerKey)) {
              normalized.category = String(value || '').trim();
            } else if (['subcategory', 'sub_category', 'sub category', 'subkategori', 'merk/tipe', 'merk tipe', 'brand', 'merk'].includes(lowerKey)) {
              normalized.subcategory = String(value || '').trim();
            } else if (['description', 'deskripsi', 'desc'].includes(lowerKey)) {
              normalized.description = String(value || '').trim();
            } else if (['short_desc', 'shortdesc', 'short description', 'deskripsi singkat'].includes(lowerKey)) {
              normalized.shortDesc = String(value || '').trim();
            } else if (['image', 'gambar', 'img', 'thumbnail', 'photo', 'foto'].includes(lowerKey)) {
              normalized.image = String(value || '').trim();
            } else {
              // Store additional fields as-is
              normalized[key] = value;
            }
          }
          
          return normalized;
        }).filter((row) => {
          const productValues = [
            row.name,
            row.productCode,
            row.price,
            row.stock,
            row.stockQuantity,
            row.stockDisplayQuantity,
            row.category,
            row.subcategory,
            row.description,
            row.shortDesc,
            row.image,
          ];
          return productValues.some((value) => (
            value !== undefined && value !== null && String(value).trim() !== ''
          ));
        });

        resolve(normalized);
      } catch (error) {
        reject(new Error(`Gagal parse Excel: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Match products dari Excel dengan existing products berdasarkan kode barang (id) atau nama.
 * Strategy:
 *   1. Match by productCode → id (exact, case-insensitive) → matched
 *   2. Exact name match (case-insensitive, trim whitespace) → matched
 *   3. Tidak ada match → new
 */
export function findSimilarProducts(
  importedName: string,
  existingProducts: Product[],
  _threshold: number = 1.0, // kept for API compatibility, unused
  productCode?: string
): { match?: Product; similar: Product[] } {
  // 1. Match by productCode → product.id
  if (productCode && productCode.trim()) {
    const code = productCode.trim().toLowerCase();
    const codeMatch = existingProducts.find(
      p => p.id.toLowerCase().trim() === code
    );
    if (codeMatch) return { match: codeMatch, similar: [] };
  }

  if (!importedName || !importedName.trim()) {
    return { similar: [] };
  }

  const searchName = importedName.toLowerCase().trim();

  // 2. Exact name match (case-insensitive, trimmed)
  const exactMatch = existingProducts.find(
    p => p.name.toLowerCase().trim() === searchName
  );
  if (exactMatch) return { match: exactMatch, similar: [] };

  // No match → new product
  return { similar: [] };
}

/**
 * Generate preview dari import - show what changes akan terjadi
 */
export function generateImportPreview(
  importedRows: ProductImportRow[],
  existingProducts: Product[]
): ImportPreviewItem[] {
  const seenImportedNames = new Set<string>();
  const seenImportedCodes = new Set<string>();

  const items = importedRows.map((row, index): ImportPreviewItem | null => {
    const rowNumber = index + 2; // +2 because Excel is 1-indexed + header row

    // Validate required fields
    if (!row.name || !row.name.trim()) {
      return {
        rowNumber,
        name: 'N/A',
        status: 'error',
        newData: row,
        error: 'Nama produk tidak boleh kosong'
      };
    }

    // Deduplicate by productCode first, then by name
    if (row.productCode && row.productCode.trim()) {
      const normalizedCode = row.productCode.trim().toLowerCase();
      if (seenImportedCodes.has(normalizedCode)) {
        return null;
      }
      seenImportedCodes.add(normalizedCode);
    } else {
      const normalizedName = row.name.trim().toLowerCase();
      if (seenImportedNames.has(normalizedName)) {
        return null;
      }
      seenImportedNames.add(normalizedName);
    }

    // Try to match by productCode (id) or find by name
    const { match, similar } = findSimilarProducts(row.name, existingProducts, 1.0, row.productCode);

    if (match) {
      // Parse both prices as numbers to avoid string vs number false positives
      const importedPrice = row.price !== undefined && row.price !== null
        ? parseFloat(String(row.price).replace(/[^0-9.-]/g, ''))
        : undefined;
      const existingPrice = typeof match.price === 'number' ? match.price : parseFloat(String(match.price));

      const priceChange =
        importedPrice !== undefined &&
        !isNaN(importedPrice) &&
        Math.abs(importedPrice - existingPrice) > 0.01  // toleransi floating point
          ? {
              old: existingPrice,
              new: importedPrice,
              difference: importedPrice - existingPrice
            }
          : undefined;

      // Detect other field changes
      const fieldChanges: { field: string; old: any; new: any }[] = [];
      
      if (row.category && row.category !== match.category) {
        fieldChanges.push({ field: 'Kategori', old: match.category, new: row.category });
      }
      if (row.subcategory && row.subcategory !== match.subcategory) {
        fieldChanges.push({ field: 'Subkategori', old: match.subcategory || '(kosong)', new: row.subcategory });
      }
      if (row.stock && row.stock !== match.stock) {
        fieldChanges.push({ field: 'Stok', old: match.stock, new: row.stock });
      }
      if (row.stockQuantity !== undefined && row.stockQuantity !== null) {
        const importedStockQuantity = Number(row.stockQuantity);
        const existingStockQuantity = Number(match.stockQuantity);
        if (
          Number.isFinite(importedStockQuantity) &&
          (!Number.isFinite(existingStockQuantity) || importedStockQuantity !== existingStockQuantity)
        ) {
          fieldChanges.push({
            field: 'Stok Fisik',
            old: Number.isFinite(existingStockQuantity) ? existingStockQuantity : '(belum ada)',
            new: importedStockQuantity
          });
        }
      }

      return {
        rowNumber,
        name: row.name,
        status: 'matched',
        matchedProduct: match,
        newData: row,
        priceChange,
        fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
        similarProducts: similar.length > 0 ? similar : undefined
      };
    }

    // Similar but not high enough to auto-match
    if (similar.length > 0) {
      return {
        rowNumber,
        name: row.name,
        status: 'similar',
        similarProducts: similar,
        newData: row
      };
    }

    // New product
    return {
      rowNumber,
      name: row.name,
      status: 'new',
      newData: row
    };
  });

  return items.filter((item): item is ImportPreviewItem => item !== null);
}

/**
 * Prepare data untuk update - clean dan validate
 */
export function prepareUpdateData(
  importRow: Partial<ProductImportRow>
): Partial<Product> {
  const updateData: Partial<Product> = {};

  if (importRow.price !== undefined && importRow.price !== null) {
    const price = parseFloat(String(importRow.price).replace(/[^0-9.-]/g, ''));
    if (!isNaN(price)) {
      updateData.price = price;
      
      // Jika harga 0, otomatis set status ke Inden
      if (price === 0) {
        updateData.stock = 'indent' as any;
      }
    }
  }

  if (importRow.stock) {
    const validStocks = ['available', 'indent', 'hidden', 'limited', 'out_of_stock', 'discontinued'];
    const stock = importRow.stock.toLowerCase().trim();
    if (validStocks.includes(stock)) {
      // Hanya terapkan jika harga tidak 0 (karena harga 0 memaksa status Inden)
      if (updateData.price !== 0) {
        updateData.stock = stock as any;
      }
    }
  }

  if (importRow.stockQuantity !== undefined && importRow.stockQuantity !== null && String(importRow.stockQuantity).trim() !== '') {
    const stockQuantity = parseFloat(String(importRow.stockQuantity).replace(/[^0-9.-]/g, ''));
    if (!isNaN(stockQuantity) && stockQuantity >= 0) {
      updateData.stockQuantity = stockQuantity;
    }
  }

  if (importRow.category) {
    updateData.category = importRow.category.trim() as any;
  }

  if (importRow.subcategory) {
    updateData.subcategory = importRow.subcategory.trim();
  }

  if (importRow.description) {
    updateData.description = importRow.description.trim();
  }

  if (importRow.shortDesc) {
    updateData.shortDesc = importRow.shortDesc.trim();
  }

  if (importRow.image !== undefined) {
    updateData.image = importRow.image.trim();
  }

  return updateData;
}

/**
 * Get placeholder image based on category
 */
export function getCategoryPlaceholder(category?: string): string {
  if (!category) return '/assets/images/logo.webp';
  
  const cat = category.toLowerCase().trim();
  
  if (cat.includes('tv')) return '/assets/images/tv.webp';
  if (cat.includes('cuci')) return '/assets/images/polytron-washer.webp';
  if (cat.includes('ac')) return '/assets/images/sharp-ac.webp';
  if (cat.includes('sepeda') || cat.includes('selis')) return '/assets/images/hero-bike.webp';
  if (cat.includes('kursi') || cat.includes('meja') || cat.includes('lemari')) return '/assets/images/sofa.webp';
  if (cat.includes('kulkas') || cat.includes('freezer') || cat.includes('showcase')) return '/assets/images/fridge.webp';
  if (cat.includes('sofa')) return '/assets/images/sofa.webp';
  if (cat.includes('hp') || cat.includes('handphone') || cat.includes('ponsel')) return '/assets/images/genio-x2.webp';
  if (cat.includes('kasur') || cat.includes('springbed')) return '/assets/images/sofa.webp';
  if (cat.includes('kompor') || cat.includes('magic com') || cat.includes('rice cooker') || cat.includes('oven') || cat.includes('fryer') || cat.includes('cooker') || cat.includes('dispenser') || cat.includes('blender')) return '/assets/images/fridge.webp';
  if (cat.includes('speaker') || cat.includes('audio') || cat.includes('kipas')) return '/assets/images/tv.webp';
  
  return '/assets/images/logo.webp';
}

/**
 * Get summary dari import process
 */
export function getImportSummary(preview: ImportPreviewItem[]): {
  total: number;
  matched: number;
  new: number;
  similar: number;
  errors: number;
  priceChanges: number;
} {
  return {
    total: preview.length,
    matched: preview.filter(p => p.status === 'matched').length,
    new: preview.filter(p => p.status === 'new').length,
    similar: preview.filter(p => p.status === 'similar').length,
    errors: preview.filter(p => p.status === 'error').length,
    priceChanges: preview.filter(p => p.priceChange).length
  };
}
