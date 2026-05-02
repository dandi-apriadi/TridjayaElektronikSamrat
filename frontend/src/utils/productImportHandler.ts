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
export function findSimilarProducts(
  importedName: string,
  existingProducts: Product[],
  threshold: number = 0.9
): { match?: Product; similar: Product[] } {
  if (!importedName || !importedName.trim()) {
    return { similar: [] };
  }

  const searchName = importedName.toLowerCase().trim();
  const importedWords = searchName.split(/\s+/).filter(w => w.length > 1);
  const firstWord = importedWords[0];

  // 1. Exact Match (100% confidence)
  const exactMatch = existingProducts.find(
    p => p.name.toLowerCase().trim() === searchName
  );
  if (exactMatch) return { match: exactMatch, similar: [] };

  // 2. Extremely Strict Analysis
  const results = existingProducts.map(p => {
    const productName = p.name.toLowerCase().trim();
    const productWords = productName.split(/\s+/).filter(w => w.length > 1);
    const productFirstWord = productWords[0];

    // BRAND CHECK: First word must match exactly (e.g., Polytron vs Samsung)
    if (firstWord.toLowerCase() !== productFirstWord.toLowerCase()) {
      return { product: p, score: 0 };
    }
    
    // Calculate word overlap
    const matchedWords = importedWords.filter(w => 
      productWords.some(pw => pw === w)
    );
    
    // Strict word score (Intersection over Union)
    const union = new Set([...importedWords, ...productWords]);
    const wordScore = matchedWords.length / union.size;
    
    // Character similarity (check for very small differences at the end)
    let charScore = 0;
    if (searchName.length > 8 && productName.length > 8) {
      const minLen = Math.min(searchName.length, productName.length);
      const diffLen = Math.abs(searchName.length - productName.length);
      
      // Names must be identical for at least 90% of their length from the start
      const prefixLen = Math.floor(minLen * 0.9);
      if (searchName.substring(0, prefixLen) === productName.substring(0, prefixLen) && diffLen <= 3) {
        charScore = (minLen - diffLen) / minLen;
      }
    }

    const finalScore = Math.max(wordScore, charScore);
    return { product: p, score: finalScore };
  }).filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score);

  // If we have an extremely high score (0.97+), treat it as a match
  if (results.length > 0 && results[0].score >= 0.97) {
    return { match: results[0].product, similar: results.slice(1, 2).map(r => r.product) };
  }

  // Otherwise, return as similar
  return { 
    similar: results.slice(0, 2).map(r => r.product) 
  };
}

/**
 * Generate preview dari import - show what changes akan terjadi
 */
export function generateImportPreview(
  importedRows: ProductImportRow[],
  existingProducts: Product[]
): ImportPreviewItem[] {
  const seenImportedNames = new Set<string>();

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

    const normalizedName = row.name.trim().toLowerCase();
    if (seenImportedNames.has(normalizedName)) {
      return {
        rowNumber,
        name: row.name,
        status: 'error',
        newData: row,
        error: 'Nama produk duplikat di file import'
      };
    }
    seenImportedNames.add(normalizedName);

    // Try to match or find similar
    const { match, similar } = findSimilarProducts(row.name, existingProducts);

    if (match) {
      const priceChange = 
        row.price !== undefined && row.price !== null && row.price !== match.price
          ? {
              old: match.price,
              new: parseFloat(String(row.price)),
              difference: parseFloat(String(row.price)) - match.price
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
    const validStocks = ['available', 'indent', 'hidden', 'limited', 'out_of_stock', 'discontinued'];
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
 * Get placeholder image based on category
 */
export function getCategoryPlaceholder(category?: string): string {
  if (!category) return '/uploads/placeholders/default.png';
  
  const cat = category.toLowerCase().trim();
  
  if (cat.includes('tv')) return '/uploads/placeholders/tv.png';
  if (cat.includes('cuci')) return '/uploads/placeholders/mesin_cuci.png';
  if (cat.includes('ac')) return '/uploads/placeholders/ac.png';
  if (cat.includes('sepeda') || cat.includes('selis')) return '/uploads/placeholders/sepeda_listrik.png';
  if (cat.includes('kursi') || cat.includes('meja') || cat.includes('lemari')) return '/uploads/placeholders/kursi.png';
  if (cat.includes('kulkas') || cat.includes('freezer') || cat.includes('showcase')) return '/uploads/placeholders/kulkas.png';
  if (cat.includes('sofa')) return '/uploads/placeholders/sofa.png';
  if (cat.includes('kompor')) return '/uploads/placeholders/kompor.png';
  if (cat.includes('speaker') || cat.includes('audio')) return '/uploads/placeholders/speaker.png';
  if (cat.includes('hp') || cat.includes('handphone') || cat.includes('ponsel')) return '/uploads/placeholders/handphone.png';
  if (cat.includes('kasur') || cat.includes('springbed')) return '/uploads/placeholders/kasur.png';
  if (cat.includes('magic com') || cat.includes('rice cooker')) return '/uploads/placeholders/magic_com.png';
  if (cat.includes('kipas')) return '/uploads/placeholders/kipas_angin.png';
  if (cat.includes('dispenser')) return '/uploads/placeholders/dispenser.png';
  if (cat.includes('blender')) return '/uploads/placeholders/blender.png';
  if (cat.includes('oven') || cat.includes('fryer') || cat.includes('cooker')) return '/uploads/placeholders/oven.png';
  
  return '/uploads/placeholders/default.png';
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
