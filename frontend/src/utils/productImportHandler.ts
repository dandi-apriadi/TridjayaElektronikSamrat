import type { Product } from '../types';
import * as XLSX from 'xlsx';

export interface ProductImportRow {
  name: string;
  price?: number | string;
  stock?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  shortDesc?: string;
  [key: string]: any;
}

export interface ImportPreviewItem {
  rowNumber: number;
  name: string;
  status: 'matched' | 'new' | 'error';
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
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        // Validasi struktur data
        if (!jsonData || jsonData.length === 0) {
          reject(new Error('File Excel kosong atau tidak valid'));
          return;
        }

        // Normalize field names (case-insensitive)
        const normalized: ProductImportRow[] = jsonData.map((row: any) => {
          const normalized: ProductImportRow = { name: '' };
          
          for (const [key, value] of Object.entries(row)) {
            const lowerKey = (key as string).toLowerCase().trim();
            
            // Map common variations
            if (['name', 'nama', 'product_name', 'product name'].includes(lowerKey)) {
              normalized.name = String(value || '').trim();
            } else if (['price', 'harga', 'unit_price', 'unit price'].includes(lowerKey)) {
              normalized.price = parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''));
            } else if (['stock', 'stok', 'stock_status', 'stock status'].includes(lowerKey)) {
              normalized.stock = String(value || 'available').trim().toLowerCase();
            } else if (['category', 'kategori'].includes(lowerKey)) {
              normalized.category = String(value || '').trim();
            } else if (['subcategory', 'sub_category', 'sub category', 'subkategori'].includes(lowerKey)) {
              normalized.subcategory = String(value || '').trim();
            } else if (['description', 'deskripsi', 'desc'].includes(lowerKey)) {
              normalized.description = String(value || '').trim();
            } else if (['short_desc', 'shortdesc', 'short description', 'deskripsi singkat'].includes(lowerKey)) {
              normalized.shortDesc = String(value || '').trim();
            } else {
              // Store additional fields as-is
              normalized[key] = value;
            }
          }
          
          return normalized;
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
 * Match products dari Excel dengan existing products berdasarkan nama
 * Melakukan pengecekan case-insensitive dan fuzzy matching
 */
export function matchProductByName(
  importedName: string,
  existingProducts: Product[]
): Product | undefined {
  if (!importedName || !importedName.trim()) {
    return undefined;
  }

  const searchName = importedName.toLowerCase().trim();

  // First, try exact match (case-insensitive)
  let match = existingProducts.find(
    p => p.name.toLowerCase().trim() === searchName
  );

  if (match) return match;

  // Try partial match - check if one contains the other
  match = existingProducts.find(p => {
    const pName = p.name.toLowerCase().trim();
    return pName.includes(searchName) || searchName.includes(pName);
  });

  if (match) return match;

  // Fuzzy match - check similarity (simple word-based approach)
  const importedWords = searchName.split(/\s+/);
  const matches = existingProducts.filter(p => {
    const productWords = p.name.toLowerCase().split(/\s+/);
    const matchedWords = importedWords.filter(w => 
      productWords.some(pw => pw.includes(w) || w.includes(pw))
    );
    // If at least 60% of words match, consider it a match
    return matchedWords.length >= Math.ceil(importedWords.length * 0.6);
  });

  return matches[0]; // Return first fuzzy match if any
}

/**
 * Generate preview dari import - show what changes akan terjadi
 */
export function generateImportPreview(
  importedRows: ProductImportRow[],
  existingProducts: Product[]
): ImportPreviewItem[] {
  return importedRows.map((row, index) => {
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

    // Try to match with existing product
    const matchedProduct = matchProductByName(row.name, existingProducts);

    if (matchedProduct) {
      const priceChange = 
        row.price !== undefined && row.price !== null && row.price !== matchedProduct.price
          ? {
              old: matchedProduct.price,
              new: parseFloat(String(row.price)),
              difference: parseFloat(String(row.price)) - matchedProduct.price
            }
          : undefined;

      // Detect other field changes
      const fieldChanges: { field: string; old: any; new: any }[] = [];
      
      if (row.category && row.category !== matchedProduct.category) {
        fieldChanges.push({ field: 'Kategori', old: matchedProduct.category, new: row.category });
      }
      if (row.subcategory && row.subcategory !== matchedProduct.subcategory) {
        fieldChanges.push({ field: 'Subkategori', old: matchedProduct.subcategory || '(kosong)', new: row.subcategory });
      }
      if (row.stock && row.stock !== matchedProduct.stock) {
        fieldChanges.push({ field: 'Stok', old: matchedProduct.stock, new: row.stock });
      }

      return {
        rowNumber,
        name: row.name,
        status: 'matched',
        matchedProduct,
        newData: row,
        priceChange,
        fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined
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
    if (!isNaN(price) && price > 0) {
      updateData.price = price;
    }
  }

  if (importRow.stock) {
    const validStocks = ['available', 'limited', 'out_of_stock', 'discontinued'];
    const stock = importRow.stock.toLowerCase().trim();
    if (validStocks.includes(stock)) {
      updateData.stock = stock as any;
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

  return updateData;
}

/**
 * Get summary dari import process
 */
export function getImportSummary(preview: ImportPreviewItem[]): {
  total: number;
  matched: number;
  new: number;
  errors: number;
  priceChanges: number;
} {
  return {
    total: preview.length,
    matched: preview.filter(p => p.status === 'matched').length,
    new: preview.filter(p => p.status === 'new').length,
    errors: preview.filter(p => p.status === 'error').length,
    priceChanges: preview.filter(p => p.priceChange).length
  };
}
