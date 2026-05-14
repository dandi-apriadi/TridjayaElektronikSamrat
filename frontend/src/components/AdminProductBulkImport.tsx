import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle2, XCircle, Download, Play, Trash2, Eye, EyeOff, History, Trash, Zap } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { toast } from '../store/useNotificationStore';
import {
  parseExcelFile,
  generateImportPreview,
  prepareUpdateData,
  getCategoryPlaceholder,
  getImportSummary,
  type ImportPreviewItem
} from '../utils/productImportHandler';
import { formatRupiah } from '../utils/creditCalculator';
import { apiFetch } from '../utils/apiClient';
import StockAnalyticsDashboard from './admin/catalog/StockAnalyticsDashboard';
import StockUpdateConfirmDialog from './admin/catalog/StockUpdateConfirmDialog';
import {
  computePriceAnalytics,
  mapStockToStatus,
  type ParsedStockRow,
  type PriceDiscrepancy,
  type RestockItem,
  type StockAnalytics,
  type UpdateBreakdown,
} from '../utils/stockReport';

interface BulkImportHistory {
  id: string;
  type?: 'stock_report' | 'standard_import';
  timestamp: number;
  fileName: string;
  successCount: number;
  errorCount: number;
  results: string[];
  details?: Array<{ rowNumber?: number; name?: string; status: string; reason?: string }>;
  totalItems: number;
  analyticsSnapshot?: unknown;
}

type MatchedCatalogProduct = {
  inputName: string;
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory?: string | null;
  price: number;
  stock: string;
};

const getPreviewStockValue = (item: ImportPreviewItem) => {
  const value = item.newData.stockQuantity ?? item.newData.stock;
  if (value === undefined || value === null || String(value).trim() === '') return '-';
  return String(value);
};

const getPreviewStockToneClass = (item: ImportPreviewItem) => {
  const numeric = Number(item.newData.stockQuantity);
  if (!Number.isFinite(numeric)) return 'text-on-surface';
  if (numeric <= 0) return 'text-error';
  if (numeric <= 5) return 'text-yellow-500';
  return 'text-neon-lime';
};

const getPreviewStockHint = (item: ImportPreviewItem) => {
  const numeric = Number(item.newData.stockQuantity);
  if (!Number.isFinite(numeric)) return 'stok';
  if (numeric <= 0) return 'kosong';
  if (numeric <= 5) return 'rendah';
  return 'tersedia';
};

const AdminProductBulkImport: React.FC = () => {
  const { products } = useProductStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'stock-report' | 'processing' | 'done' | 'history'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewItem[]>([]);
  const [stockRows, setStockRows] = useState<ParsedStockRow[]>([]);
  const [stockAnalytics, setStockAnalytics] = useState<StockAnalytics | null>(null);
  const [restockItems, setRestockItems] = useState<RestockItem[]>([]);
  const [priceDiscrepancies, setPriceDiscrepancies] = useState<PriceDiscrepancy[]>([]);
  const [matchedCatalogProducts, setMatchedCatalogProducts] = useState<MatchedCatalogProduct[]>([]);
  const [unmatchedStockNames, setUnmatchedStockNames] = useState<string[]>([]);
  const [stockLocation] = useState<string | null>(null);
  const [stockReportDate] = useState<string | null>(null);
  const [highlightedStockKey, setHighlightedStockKey] = useState<string | null>(null);
  const [isStockConfirmOpen, setIsStockConfirmOpen] = useState(false);
  const [isStockUpdating, setIsStockUpdating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'similar' | 'new' | 'error'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [processSummary, setProcessSummary] = useState<{ successCount: number; errorCount: number; results: string[]; failedProducts: { row: number; name: string; reason: string }[] } | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [bulkHistory, setBulkHistory] = useState<BulkImportHistory[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Pagination & advanced filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyPriceChanges, setOnlyPriceChanges] = useState(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bulkImportHistory');
    if (saved) {
      try {
        setBulkHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save history to localStorage
  const saveHistory = (entry: BulkImportHistory) => {
    const updated = [entry, ...bulkHistory].slice(0, 50); // Keep last 50 imports
    setBulkHistory(updated);
    localStorage.setItem('bulkImportHistory', JSON.stringify(updated));
  };

  const normalizeMatchKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const stockRowDomId = (value: string) => `stock-row-${encodeURIComponent(normalizeMatchKey(value))}`;

  const buildStockUpdateBreakdown = (): UpdateBreakdown & { toHidden: number; toIndent: number; toAvailable: number } => {
    const matchedKeys = new Set(matchedCatalogProducts.map((product) => normalizeMatchKey(product.inputName)));
    let toHidden = 0;
    let toIndent = 0;
    let toAvailable = 0;

    for (const row of stockRows) {
      const key = normalizeMatchKey(row.productName || row.productCode || '');
      if (!matchedKeys.has(key)) continue;
      const status = mapStockToStatus(row.physicalStock);
      if (status === 'out_of_stock') toHidden++;
      if (status === 'indent') toIndent++;
      if (status === 'available') toAvailable++;
    }

    return {
      itemsToUpdate: toHidden + toIndent + toAvailable,
      itemsUnchanged: 0,
      itemsWithIssues: unmatchedStockNames.length,
      estimatedValueAdjustment: 0,
      toHidden,
      toIndent,
      toAvailable,
    };
  };

  // Extract unique categories from preview items
  const extractCategories = (items: ImportPreviewItem[]) => {
    const categories = new Set<string>();
    items.forEach(item => {
      if (item.newData.category && item.newData.category.trim()) {
        categories.add(item.newData.category.trim());
      }
    });
    return Array.from(categories);
  };

  // Save new categories to database
  const saveCategoriesToDatabase = async (categoryNames: string[]): Promise<{ saved: number; duplicates: number; errors: string[] }> => {
    if (categoryNames.length === 0) {
      return { saved: 0, duplicates: 0, errors: [] };
    }

    let saved = 0;
    let duplicates = 0;
    const errors: string[] = [];

    // Fetch existing categories first to avoid unnecessary 409 requests
    let existingNames = new Set<string>();
    try {
      const res = await apiFetch('/api/product-categories');
      if (res.ok) {
        const data = await res.json();
        const items: { name: string }[] = data?.data?.items || [];
        existingNames = new Set(items.map(i => i.name.toLowerCase().trim()));
      }
    } catch (_) {
      // If fetch fails, proceed anyway — backend handles duplicates with INSERT OR IGNORE
    }

    for (const categoryName of categoryNames) {
      // Skip if already exists locally
      if (existingNames.has(categoryName.toLowerCase().trim())) {
        duplicates++;
        continue;
      }

      try {
        const response = await apiFetch('/api/product-categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: categoryName,
            description: `Kategori: ${categoryName}`
          })
        });

        if (response.ok) {
          saved++;
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 409 || errorData.message?.includes('UNIQUE')) {
            duplicates++;
          } else {
            errors.push(`${categoryName}: ${errorData.message || 'Unknown error'}`);
          }
        }
      } catch (error) {
        errors.push(`${categoryName}: ${error instanceof Error ? error.message : 'Network error'}`);
      }
    }

    return { saved, duplicates, errors };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/vnd.ms-excel', 
                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                       'text/csv'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xls|xlsx|csv)$/i)) {
      toast.error('File harus berformat Excel (.xls, .xlsx) atau CSV');
      return;
    }

    try {
      setSelectedFile(file);
      setPreview([]);
      setStockRows([]);
      setStockAnalytics(null);
      setRestockItems([]);
      setPriceDiscrepancies([]);
      setMatchedCatalogProducts([]);
      setUnmatchedStockNames([]);
      setProcessSummary(null);

      const importedRows = await parseExcelFile(file);
      const generatedPreview = generateImportPreview(importedRows, products);
      setPreview(generatedPreview);
      setProcessSummary(null);
      setStep('preview');
      setFilterStatus('all');
      toast.success(`File berhasil dibaca: ${importedRows.length} baris`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membaca file');
      setSelectedFile(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect({ target: { files: [file] } } as any);
    }
  };

  const filteredPreview = preview.filter(item => {
    // Status filter
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    
    // Search by name
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    
    // Category filter
    const cat = (item.newData.category || '').toString();
    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;

    // Subcategory filter
    const subcat = (item.newData.subcategory || '').toString();
    if (subcategoryFilter !== 'all' && subcat !== subcategoryFilter) return false;

    // Stock filter
    const stock = (item.newData.stock || '').toString().toLowerCase();
    if (stockFilter !== 'all' && stock !== stockFilter) return false;

    // Price range filter
    const price = typeof item.newData.price === 'number' ? item.newData.price : parseFloat(String(item.newData.price || '0'));
    if (minPrice && price < parseFloat(minPrice)) return false;
    if (maxPrice && price > parseFloat(maxPrice)) return false;

    // Show only changes (price or other fields)
    if (showOnlyChanges && !item.priceChange && !item.fieldChanges) return false;
    
    // Keep legacy filter for price changes specifically
    if (onlyPriceChanges && !item.priceChange) return false;

    return true;
  });

  // Dynamic filter lists
  const categories = Array.from(new Set(preview.map(p => (p.newData.category || '').toString()).filter(Boolean)));
  const subcategories = Array.from(new Set(preview.map(p => (p.newData.subcategory || '').toString()).filter(Boolean)));
  const stockStatuses = Array.from(new Set(preview.map(p => (p.newData.stock || '').toString().toLowerCase()).filter(Boolean)));

  // Pagination calculations
  const pageCount = Math.max(1, Math.ceil(filteredPreview.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedPreview = filteredPreview.slice(pageStart, pageStart + pageSize);

  // reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, subcategoryFilter, stockFilter, minPrice, maxPrice, showOnlyChanges, onlyPriceChanges, filterStatus, pageSize]);

  const summary = getImportSummary(preview);

  const handleProcessImport = async () => {
    // Filter out items that shouldn't be processed
    const validItems = preview.filter(item => item.status === 'matched' || item.status === 'new');
    
    if (validItems.length === 0) {
      toast.error('Tidak ada data valid untuk diimport. Pastikan semua produk Serupa sudah ditangani.');
      return;
    }

    setProcessing(true);
    setStep('processing');
    setImportProgress(0);
    
    const results: string[] = [];
    const failedProducts: { row: number; name: string; reason: string }[] = [];
    let totalSuccess = 0;
    let totalError = 0;

    try {
      // Chunking for large datasets (max 50 per request to stay within limits)
      const chunkSize = 50;
      for (let i = 0; i < validItems.length; i += chunkSize) {
        const chunk = validItems.slice(i, i + chunkSize);
        
        const operations = chunk.map(item => {
          const updateData = prepareUpdateData(item.newData);
          
          // Logika Smart Placeholder
          let finalImage = item.newData.image;
          const isImageEmpty = !finalImage || finalImage.trim() === '';
          
          if (item.status === 'matched' && item.matchedProduct) {
            // Update: Gunakan image baru jika ada di Excel, 
            // jika tidak ada, cek apakah produk lama butuh placeholder
            if (isImageEmpty) {
              const currentImage = item.matchedProduct.image || '';
              const needsPlaceholder = !currentImage || 
                                      currentImage.includes('placehold.co') || 
                                      currentImage.includes('/uploads/placeholders/') ||
                                      currentImage === '';
              
              if (needsPlaceholder) {
                finalImage = getCategoryPlaceholder(item.newData.category || item.matchedProduct.category);
              } else {
                finalImage = currentImage; // Pertahankan gambar asli yang sudah ada
              }
            }

            return {
              type: 'update',
              data: {
                id: item.matchedProduct.id,
                ...updateData,
                image: finalImage,
                rowNumber: item.rowNumber
              }
            };
          } else {
            // Create: Jika tidak ada gambar di Excel, langsung pakai placeholder kategori
            if (isImageEmpty) {
              finalImage = getCategoryPlaceholder(item.newData.category);
            }
            
            const productName = item.newData.name || '';
            return {
              type: 'create',
              data: {
                ...updateData,
                id: item.newData.productCode || undefined,
                name: productName,
                slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                stock: updateData.stock || 'available',
                image: finalImage,
                rowNumber: item.rowNumber
              }
            };
          }
        });

        const response = await apiFetch('/api/admin/catalogs/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ operations }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const msg = errorData.message || errorData.error || 'Gagal memproses bulk import';
          throw new Error(msg);
        }
        
        const payload = await response.json();
        const { successCount, errors } = payload.data || { successCount: 0, errors: [] };
        
        totalSuccess += successCount;
        totalError += errors.length;
        
        // Map backend errors to include product names for clarity
        errors.forEach((err: string) => {
          // Find which product this error belongs to by parsing the row number
          const rowMatch = err.match(/Baris (\d+):/);
          const rowNum = rowMatch ? parseInt(rowMatch[1]) : -1;
          const product = chunk.find(item => item.rowNumber === rowNum);
          const productName = product ? ` (${product.name})` : '';
          results.push(`❌ ${err}${productName}`);
          console.error(`[BulkImport] GAGAL${productName} | Row ${rowNum} | ${err}`);
          // Kumpulkan untuk ditampilkan di halaman hasil
          failedProducts.push({
            row: rowNum,
            name: product?.name || `Row ${rowNum}`,
            reason: err.replace(/^Baris \d+[^:]*:\s*/, '').replace('Database Error - ', '')
          });
        });
        
        // Add specific success messages for small imports, or generic for large ones
        if (chunk.length <= 5) {
          chunk.forEach(item => results.push(`✅ Selesai: ${item.name}`));
        } else {
          results.push(`✅ Berhasil memproses ${successCount} produk di batch ini`);
        }

        setImportProgress(Math.min(100, Math.round(((i + chunk.length) / validItems.length) * 100)));
      }

      setProcessing(false);
      const summary = { 
        successCount: totalSuccess, 
        errorCount: totalError + (preview.length - validItems.length), 
        results: [
          ...results,
          `ℹ️ ${preview.length - validItems.length} baris dilewati (Error/Serupa)`
        ] 
      };

      // Extract and save categories to database
      const categoriesToSave = extractCategories(validItems);
      if (categoriesToSave.length > 0) {
        const categoryResults = await saveCategoriesToDatabase(categoriesToSave);
        
        if (categoryResults.saved > 0) {
          summary.results.push(`📁 Berhasil simpan ${categoryResults.saved} kategori baru`);
        }
        if (categoryResults.duplicates > 0) {
          summary.results.push(`ℹ️ ${categoryResults.duplicates} kategori sudah ada di database`);
        }
        if (categoryResults.errors.length > 0) {
          categoryResults.errors.forEach(err => {
            summary.results.push(`⚠️ Gagal simpan kategori: ${err}`);
          });
        }
      }

      setProcessSummary({ ...summary, failedProducts });
      
      // Prepare per-row details for history (reasons why rows were not processed)
      const details = preview
        .map(item => {
          let reason = '';
          if (item.status === 'error') {
            reason = item.error || 'Validasi gagal';
          } else if (item.status === 'similar') {
            const names = item.similarProducts?.map(p => p.name).slice(0, 5).join(', ');
            reason = `Produk serupa ditemukan: ${names || 'tidak tersedia'}`;
          } else {
            reason = '';
          }

          return {
            rowNumber: item.rowNumber,
            name: item.name,
            status: item.status,
            reason: reason || undefined
          };
        })
        .filter(d => d.status !== 'matched' && d.status !== 'new' && d.reason);

      // Save to history (include structured details)
      saveHistory({
        id: `bulk_${Date.now()}`,
        type: 'standard_import',
        timestamp: Date.now(),
        fileName: selectedFile?.name || 'Import',
        successCount: totalSuccess,
        errorCount: totalError + (preview.length - validItems.length),
        results: summary.results,
        details,
        totalItems: preview.length
      });
      
      setStep('done');
      toast.success(`Import selesai: ${totalSuccess} berhasil`);
      
      
    } catch (error) {
      setProcessing(false);
      setStep('preview');
      toast.error('Terjadi error saat bulk processing');
      console.error('[BulkImport] Fatal error:', error);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['nama produk', 'harga', 'kategori', 'subkategori', 'deskripsi singkat', 'deskripsi', 'stok'],
      ['Contoh Produk 1', 5000000, 'bike', 'sport', 'Produk berkualitas', 'Deskripsi lengkap produk', 'available'],
      ['Contoh Produk 2', 3000000, 'car', 'mpv', 'Produk lainnya', 'Deskripsi lengkap produk lainnya', 'limited']
    ];

    const csv = template.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'product_import_template.csv';
    link.click();
  };

  const toggleRowExpand = (rowNumber: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowNumber)) {
      newExpanded.delete(rowNumber);
    } else {
      newExpanded.add(rowNumber);
    }
    setExpandedRows(newExpanded);
  };

  const handleDeleteRow = (rowNumber: number) => {
    setPreview(prev => {
      const next = prev.filter(item => item.rowNumber !== rowNumber);
      const nextPageCount = Math.max(1, Math.ceil(next.length / pageSize));
      setCurrentPage(current => Math.min(current, nextPageCount));
      return next;
    });
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.delete(rowNumber);
      return next;
    });
    toast.success(`Baris ${rowNumber} dihapus dari antrean`);
  };

  const handleDismissSimilarity = (rowNumber: number) => {
    setPreview(prev => prev.map(item => {
      if (item.rowNumber === rowNumber) {
        return { ...item, status: 'new', similarProducts: undefined };
      }
      return item;
    }));
    toast.success(`Peringatan baris ${rowNumber} diabaikan. Akan diproses sebagai produk baru.`);
  };

  const handleDismissAllSimilar = () => {
    const count = preview.filter(item => item.status === 'similar').length;
    if (count === 0) return;
    setPreview(prev => prev.map(item =>
      item.status === 'similar' ? { ...item, status: 'new' as const, similarProducts: undefined } : item
    ));
    toast.success(`${count} produk serupa diabaikan`, 'Semua item serupa sekarang ditandai sebagai produk baru.');
  };

  // Import ALL rows (including similar) — no filter, treat similar as new
  const handleImportAll = async () => {
    const allItems = preview.filter(item => item.status !== 'error');
    if (allItems.length === 0) {
      toast.error('Tidak ada data valid untuk diimport.');
      return;
    }

    const confirmed = window.confirm(
      `Import SEMUA ${allItems.length} produk tanpa filter?\n\n` +
      `• ${preview.filter(i => i.status === 'matched').length} produk akan di-UPDATE\n` +
      `• ${preview.filter(i => i.status === 'new').length} produk baru akan dibuat\n` +
      `• ${preview.filter(i => i.status === 'similar').length} produk serupa akan dibuat sebagai BARU\n` +
      `• ${preview.filter(i => i.status === 'error').length} produk error akan dilewati\n\n` +
      `Lanjutkan?`
    );
    if (!confirmed) return;

    // Treat similar as new
    const itemsToProcess = allItems.map(item =>
      item.status === 'similar'
        ? { ...item, status: 'new' as const, similarProducts: undefined, matchedProduct: undefined }
        : item
    );

    setProcessing(true);
    setStep('processing');
    setImportProgress(0);

    const results: string[] = [];
    const failedProducts: { row: number; name: string; reason: string }[] = [];
    let totalSuccess = 0;
    let totalError = 0;

    try {
      const chunkSize = 50;
      for (let i = 0; i < itemsToProcess.length; i += chunkSize) {
        const chunk = itemsToProcess.slice(i, i + chunkSize);

        const operations = chunk.map(item => {
          const updateData = prepareUpdateData(item.newData);
          let finalImage = item.newData.image;
          const isImageEmpty = !finalImage || finalImage.trim() === '';

          if (item.status === 'matched' && item.matchedProduct) {
            if (isImageEmpty) {
              const currentImage = item.matchedProduct.image || '';
              const needsPlaceholder = !currentImage ||
                currentImage.includes('placehold.co') ||
                currentImage.includes('/uploads/placeholders/') ||
                currentImage === '';
              finalImage = needsPlaceholder
                ? getCategoryPlaceholder(item.newData.category || item.matchedProduct.category)
                : currentImage;
            }
            return {
              type: 'update',
              data: { id: item.matchedProduct.id, ...updateData, image: finalImage, rowNumber: item.rowNumber }
            };
          } else {
            if (isImageEmpty) finalImage = getCategoryPlaceholder(item.newData.category);
            const productName = item.newData.name || '';
            return {
              type: 'create',
              data: {
                ...updateData,
                id: item.newData.productCode || undefined,
                name: productName,
                slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                stock: updateData.stock || 'available',
                image: finalImage,
                rowNumber: item.rowNumber
              }
            };
          }
        });

        const response = await apiFetch('/api/admin/catalogs/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || 'Gagal memproses bulk import');
        }

        const payload = await response.json();
        const { successCount, errors } = payload.data || { successCount: 0, errors: [] };
        totalSuccess += successCount;
        totalError += errors.length;

        errors.forEach((err: string) => {
          const rowMatch = err.match(/Baris (\d+):/);
          const rowNum = rowMatch ? parseInt(rowMatch[1]) : -1;
          const product = chunk.find(item => item.rowNumber === rowNum);
          const productName = product ? ` (${product.name})` : '';
          results.push(`❌ ${err}${productName}`);
          console.error(`[BulkImport:All] GAGAL${productName} | Row ${rowNum} | ${err}`);
          failedProducts.push({
            row: rowNum,
            name: product?.name || `Row ${rowNum}`,
            reason: err.replace(/^Baris \d+[^:]*:\s*/, '').replace('Database Error - ', '')
          });
        });

        if (chunk.length <= 5) {
          chunk.forEach(item => results.push(`✅ Selesai: ${item.name}`));
        } else {
          results.push(`✅ Berhasil memproses ${successCount} produk di batch ini`);
        }

        setImportProgress(Math.min(100, Math.round(((i + chunk.length) / itemsToProcess.length) * 100)));
      }

      setProcessing(false);
      const skipped = preview.filter(i => i.status === 'error').length;
      const summaryResult = {
        successCount: totalSuccess,
        errorCount: totalError + skipped,
        results: [
          ...results,
          ...(skipped > 0 ? [`ℹ️ ${skipped} baris dilewati (Error validasi)`] : [])
        ]
      };

      const categoriesToSave = extractCategories(itemsToProcess);
      if (categoriesToSave.length > 0) {
        const categoryResults = await saveCategoriesToDatabase(categoriesToSave);
        if (categoryResults.saved > 0) summaryResult.results.push(`📁 Berhasil simpan ${categoryResults.saved} kategori baru`);
        if (categoryResults.duplicates > 0) summaryResult.results.push(`ℹ️ ${categoryResults.duplicates} kategori sudah ada`);
      }

      setProcessSummary({ ...summaryResult, failedProducts });
      saveHistory({
        id: `bulk_all_${Date.now()}`,
        type: 'standard_import',
        timestamp: Date.now(),
        fileName: `[IMPORT ALL] ${selectedFile?.name || 'Import'}`,
        successCount: totalSuccess,
        errorCount: totalError + skipped,
        results: summaryResult.results,
        totalItems: preview.length
      });

      setStep('done');
      toast.success(`Import semua selesai: ${totalSuccess} berhasil`);
    } catch (error) {
      setProcessing(false);
      setStep('preview');
      toast.error('Terjadi error saat bulk processing');
      console.error('[BulkImport:All] Fatal error:', error);
    }
  };

  const handleStockProductClick = (productKey: string) => {
    const key = normalizeMatchKey(productKey);
    setHighlightedStockKey(key);
    window.setTimeout(() => {
      setHighlightedStockKey((current) => (current === key ? null : current));
    }, 2000);

    window.requestAnimationFrame(() => {
      document.getElementById(stockRowDomId(productKey))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const handleConfirmStockUpdate = async () => {
    const productByName = new Map(
      matchedCatalogProducts.map((product) => [normalizeMatchKey(product.inputName), product])
    );
    const operations = stockRows
      .map((row, index) => {
        const key = normalizeMatchKey(row.productName || row.productCode || '');
        const product = productByName.get(key);
        if (!product) return null;
        const data: Record<string, unknown> = {
          id: product.id,
          stock: mapStockToStatus(row.physicalStock),
          rowNumber: index + 2,
        };
        if (row.unitCost !== undefined && !Number.isNaN(row.unitCost)) {
          data.price = row.unitCost;
        }
        return { type: 'update', data };
      })
      .filter((item): item is { type: 'update'; data: Record<string, unknown> } => item !== null);

    if (operations.length === 0) {
      toast.error('Tidak ada produk katalog yang cocok untuk diupdate');
      return;
    }

    setIsStockUpdating(true);
    try {
      const response = await apiFetch('/api/admin/catalogs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || payload?.error || 'Gagal update stok');
      }

      const payload = await response.json();
      const successCount = payload.data?.successCount || 0;
      const errors: string[] = payload.data?.errors || [];
      const analyticsSnapshot = stockAnalytics
        ? {
            timestamp: new Date().toISOString(),
            stock: stockAnalytics,
            restockItems,
            priceAnalytics: computePriceAnalytics(
              stockRows,
              matchedCatalogProducts.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price,
              }))
            ).priceAnalytics,
            topDiscrepancies: [],
          }
        : undefined;

      saveHistory({
        id: `stock_report_${Date.now()}`,
        type: 'stock_report',
        timestamp: Date.now(),
        fileName: selectedFile?.name || 'Laporan Stok',
        successCount,
        errorCount: errors.length + unmatchedStockNames.length,
        results: [
          `✅ ${successCount} produk berhasil diupdate`,
          ...(errors.length > 0 ? errors.map((error) => `❌ ${error}`) : []),
          ...(unmatchedStockNames.length > 0
            ? [`ℹ️ ${unmatchedStockNames.length} produk tidak ditemukan di katalog`]
            : []),
        ],
        totalItems: stockRows.length,
        analyticsSnapshot,
      });

      setProcessSummary({
        successCount,
        errorCount: errors.length + unmatchedStockNames.length,
        results: [
          `✅ ${successCount} produk berhasil diupdate`,
          ...(errors.length > 0 ? errors.map((error) => `❌ ${error}`) : []),
        ],
        failedProducts: errors.map((error, index) => ({
          row: index + 1,
          name: `Error ${index + 1}`,
          reason: error,
        })),
      });
      setIsStockConfirmOpen(false);
      setStep('done');
      toast.success('Update stok selesai', `${successCount} produk berhasil diperbarui`);
    } catch (error) {
      toast.error('Gagal update stok', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsStockUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-premium rounded-lg p-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">📊 Bulk Import/Update Produk</h2>
        <p className="text-on-surface-variant">Upload Excel untuk mengupdate harga dan data produk secara massal. Produk akan dicocokkan berdasarkan nama.</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStep('upload')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            step === 'upload'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`}
        >
          📤 Upload
        </button>
        {preview.length > 0 && (
          <button
            onClick={() => setStep('preview')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              step === 'preview'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            👁️ Preview ({preview.length})
          </button>
        )}
        {stockRows.length > 0 && (
          <button
            onClick={() => setStep('stock-report')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              step === 'stock-report'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Analytics Stok ({stockRows.length})
          </button>
        )}
        {processSummary && (
          <button
            onClick={() => setStep('done')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              step === 'done'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            ✓ Hasil ({processSummary.successCount + processSummary.errorCount})
          </button>
        )}
        {bulkHistory.length > 0 && (
          <button
            onClick={() => setStep('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              step === 'history'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <History className="w-4 h-4" /> History ({bulkHistory.length})
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* File Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-outline rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer bg-surface-low"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-on-surface mb-2">Drag & drop file Excel di sini</h3>
              <p className="text-on-surface-variant mb-4">atau klik untuk memilih file (.xls, .xlsx, .csv)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected File Info */}
            {selectedFile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card rounded-lg p-4 border border-outline"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold text-on-surface">{selectedFile.name}</p>
                      <p className="text-sm text-on-surface-variant">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview([]);
                      setStep('upload');
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Template Download */}
            <div className="glass-card rounded-lg p-4 border border-outline">
              <p className="text-sm text-on-surface-variant mb-3">Belum tahu format yang tepat?</p>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container hover:bg-surface-bright text-on-surface rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Template
              </button>
            </div>
          </motion.div>
        )}

        {step === 'stock-report' && stockAnalytics && (
          <motion.div
            key="stock-report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <StockAnalyticsDashboard
              rows={stockRows}
              analytics={stockAnalytics}
              restockItems={restockItems}
              priceDiscrepancies={priceDiscrepancies}
              location={stockLocation}
              reportDate={stockReportDate}
              matchedCount={matchedCatalogProducts.length}
              unmatchedCount={unmatchedStockNames.length}
              onProductClick={handleStockProductClick}
            />

            <div className="glass-card rounded-lg border border-outline overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-outline/30 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-bold text-on-surface">Preview Update Stok</h3>
                  <p className="text-sm text-on-surface-variant">
                    Produk yang cocok akan diupdate ke status hidden, indent, atau available.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsStockConfirmOpen(true)}
                  disabled={matchedCatalogProducts.length === 0 || isStockUpdating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" />
                  Update Stok ({matchedCatalogProducts.length})
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-outline/30 bg-surface-container/40 text-xs uppercase tracking-widest text-on-surface-variant">
                    <tr>
                      <th className="px-4 py-3">Produk Report</th>
                      <th className="px-4 py-3">Stok Fisik</th>
                      <th className="px-4 py-3">Stok Sistem</th>
                      <th className="px-4 py-3">Status Target</th>
                      <th className="px-4 py-3">Katalog</th>
                      <th className="px-4 py-3">Harga Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/15">
                    {stockRows.map((row, index) => {
                      const key = normalizeMatchKey(row.productName || row.productCode || '');
                      const matched = matchedCatalogProducts.find((product) => normalizeMatchKey(product.inputName) === key);
                      const targetStatus = mapStockToStatus(row.physicalStock);
                      const isHighlighted = highlightedStockKey === key;
                      return (
                        <tr
                          key={`${key}-${index}`}
                          id={stockRowDomId(row.productName || row.productCode || '')}
                          className={`transition-colors ${isHighlighted ? 'bg-primary/15' : 'hover:bg-surface-container/30'}`}
                        >
                          <td className="px-4 py-3 font-medium text-on-surface">
                            {row.productName || row.productCode || '-'}
                            {row.productCode && row.productName && (
                              <div className="text-xs text-on-surface-variant">{row.productCode}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-on-surface">{row.physicalStock}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{row.systemStock}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold uppercase text-primary">
                              {targetStatus === 'out_of_stock' ? 'Indent' : targetStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {matched ? (
                              <div>
                                <div className="font-semibold text-secondary">{matched.name}</div>
                                <div className="text-xs text-on-surface-variant">
                                  Saat ini: {matched.stock}
                                </div>
                              </div>
                            ) : (
                              <span className="text-error">Produk tidak ditemukan di katalog</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            {row.unitCost !== undefined ? formatRupiah(row.unitCost) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="glass-card p-4">
                <div className="text-3xl font-bold text-primary">{summary.total}</div>
                <div className="text-sm text-on-surface-variant">Total Baris</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-3xl font-bold text-neon-lime">{summary.matched}</div>
                <div className="text-sm text-on-surface-variant">Matched</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-3xl font-bold text-tertiary">{summary.new}</div>
                <div className="text-sm text-on-surface-variant">Produk Baru</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-3xl font-bold text-yellow-500">{summary.similar}</div>
                <div className="text-sm text-on-surface-variant">Serupa (Cek Manual)</div>
              </div>
              <div className="glass-card p-4">
                <div className="text-3xl font-bold text-orange-500">{summary.priceChanges}</div>
                <div className="text-sm text-on-surface-variant">Perubahan Harga</div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="glass-card p-4 rounded-lg border border-outline space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-grow max-w-md">
                  <input
                    placeholder="Cari nama produk..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline focus:border-primary outline-none"
                  />
                </div>
                
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline"
                >
                  <option value="all">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    showAdvancedFilters 
                      ? 'bg-primary text-on-primary border-primary' 
                      : 'bg-surface-container text-on-surface-variant border-outline hover:bg-surface-bright'
                  }`}
                >
                  {showAdvancedFilters ? 'Sembunyikan Filter' : 'Filter Lanjutan'}
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <label className="text-sm text-on-surface-variant">Baris:</label>
                  <select 
                    value={pageSize} 
                    onChange={e => setPageSize(Number(e.target.value))} 
                    className="px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline"
                  >
                    {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {/* Advanced Filters Panel */}
              <AnimatePresence>
                {showAdvancedFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-outline/30">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-on-surface-variant uppercase">Subkategori</label>
                        <select
                          value={subcategoryFilter}
                          onChange={e => setSubcategoryFilter(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline"
                        >
                          <option value="all">Semua Subkategori</option>
                          {subcategories.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-on-surface-variant uppercase">Status Stok</label>
                        <select
                          value={stockFilter}
                          onChange={e => setStockFilter(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline"
                        >
                          <option value="all">Semua Stok</option>
                          {stockStatuses.map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-on-surface-variant uppercase">Range Harga (Min - Max)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Min"
                            value={minPrice}
                            onChange={e => setMinPrice(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline"
                          />
                          <span className="text-outline">-</span>
                          <input
                            type="number"
                            placeholder="Max"
                            value={maxPrice}
                            onChange={e => setMaxPrice(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface text-sm border border-outline"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col justify-end space-y-2 pb-1">
                        <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showOnlyChanges} 
                            onChange={e => setShowOnlyChanges(e.target.checked)}
                            className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                          />
                          Semua Perubahan Data
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={onlyPriceChanges} 
                            onChange={e => setOnlyPriceChanges(e.target.checked)}
                            className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                          />
                          Hanya Perubahan Harga
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-2 pt-2">
                {(['all', 'matched', 'similar', 'new', 'error'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-full transition-colors text-xs font-medium flex items-center gap-2 ${
                      filterStatus === status
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright border border-outline'
                    }`}
                  >
                    {status === 'all' && `Semua (${summary.total})`}
                    {status === 'matched' && <><CheckCircle2 className="w-3 h-3" /> Cocok ({summary.matched})</>}
                    {status === 'similar' && <><Eye className="w-3 h-3" /> Serupa ({summary.similar})</>}
                    {status === 'new' && <><Upload className="w-3 h-3" /> Baru ({summary.new})</>}
                    {status === 'error' && <><XCircle className="w-3 h-3" /> Error ({summary.errors})</>}
                  </button>
                ))}

                {/* Dismiss All Similar button — only show when there are similar items */}
                {summary.similar > 0 && (
                  <button
                    onClick={handleDismissAllSimilar}
                    className="px-3 py-1.5 rounded-full transition-colors text-xs font-bold flex items-center gap-1.5 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border border-yellow-500/30"
                    title="Abaikan semua produk serupa dan tandai sebagai produk baru"
                  >
                    <EyeOff className="w-3 h-3" />
                    Abaikan Semua Serupa ({summary.similar})
                  </button>
                )}
                
                {(searchQuery || categoryFilter !== 'all' || subcategoryFilter !== 'all' || stockFilter !== 'all' || minPrice || maxPrice || showOnlyChanges || onlyPriceChanges) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('all');
                      setSubcategoryFilter('all');
                      setStockFilter('all');
                      setMinPrice('');
                      setMaxPrice('');
                      setShowOnlyChanges(false);
                      setOnlyPriceChanges(false);
                      setFilterStatus('all');
                    }}
                    className="ml-auto text-xs text-primary hover:underline font-medium"
                  >
                    Reset Semua Filter
                  </button>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div className="glass-card rounded-lg border border-outline overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-low border-b border-outline">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-on-surface">Row</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-on-surface">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-on-surface">Nama Produk</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-on-surface">Stok Akhir</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-on-surface">Info</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-on-surface">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline/20">
                    {paginatedPreview.map(item => (
                      <React.Fragment key={item.rowNumber}>
                        <tr className="hover:bg-surface-low transition-colors">
                          <td className="px-4 py-3 text-sm text-on-surface-variant">{item.rowNumber}</td>
                          <td className="px-4 py-3">
                            {item.status === 'matched' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-neon-lime/10 text-neon-lime rounded-full text-xs font-medium">
                                <CheckCircle2 className="w-3 h-3" /> Cocok
                              </span>
                            )}
                            {item.status === 'similar' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-500/10 text-yellow-600 rounded-full text-xs font-medium border border-yellow-500/20">
                                <Eye className="w-3 h-3" /> Serupa
                              </span>
                            )}
                            {item.status === 'new' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-tertiary/10 text-tertiary rounded-full text-xs font-medium">
                                <Upload className="w-3 h-3" /> Baru
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-error/10 text-error rounded-full text-xs font-medium">
                                <XCircle className="w-3 h-3" /> Error
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-on-surface">{item.name}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="min-w-[5.5rem] leading-none">
                              <div className={`text-base font-bold tabular-nums ${getPreviewStockToneClass(item)}`}>
                                {getPreviewStockValue(item)} <span className="text-[11px] font-semibold text-on-surface-variant">unit</span>
                              </div>
                              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
                                {getPreviewStockHint(item)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-on-surface-variant">
                            <div className="flex flex-col gap-1">
                              {item.priceChange && (
                                <span className="text-orange-400 font-medium">
                                  💰 {formatRupiah(item.priceChange.old)} → {formatRupiah(item.priceChange.new)}
                                </span>
                              )}
                              {item.fieldChanges?.map((change, idx) => (
                                <span key={idx} className="text-xs text-on-surface-variant italic">
                                  ⚡ {change.field}: {change.old} → {change.new}
                                </span>
                              ))}
                              {item.error && (
                                <span className="text-error">{item.error}</span>
                              )}
                              {!item.priceChange && !item.fieldChanges && !item.error && item.status === 'matched' && (
                                <span className="text-on-surface-variant">Tidak ada perubahan data</span>
                              )}
                              {item.status === 'similar' && (
                                <span className="text-yellow-600 font-medium">
                                  ⚠️ Ditemukan {item.similarProducts?.length} produk dengan nama serupa
                                </span>
                              )}
                              {item.status === 'new' && !item.similarProducts && (
                                <span className="text-tertiary">Siap ditambahkan sebagai produk baru</span>
                              )}
                              {item.status === 'new' && item.similarProducts && (
                                <span className="text-orange-400">
                                  💡 Produk baru, tapi ada {item.similarProducts.length} yang mirip
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => toggleRowExpand(item.rowNumber)}
                              className="text-on-surface-variant hover:text-on-surface"
                            >
                              {expandedRows.has(item.rowNumber) ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteRow(item.rowNumber)}
                              className="text-error/60 hover:text-error ml-2"
                              title="Hapus dari antrean import"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                        {expandedRows.has(item.rowNumber) && (
                          <tr className="bg-surface-low">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="space-y-3 text-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {item.matchedProduct && (
                                  <div className="space-y-2">
                                    <p className="font-semibold text-on-surface flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-outline" />
                                      Data Saat Ini di Database
                                    </p>
                                    <div className="glass-card p-3 rounded-lg border border-outline bg-surface-container/30">
                                      <table className="w-full text-xs">
                                        <tbody className="divide-y divide-outline/10">
                                          <tr><td className="py-1 text-on-surface-variant">ID</td><td className="py-1 text-right font-mono">{item.matchedProduct.id}</td></tr>
                                          <tr><td className="py-1 text-on-surface-variant">Harga</td><td className="py-1 text-right">{formatRupiah(item.matchedProduct.price)}</td></tr>
                                          <tr><td className="py-1 text-on-surface-variant">Kategori</td><td className="py-1 text-right">{item.matchedProduct.category}</td></tr>
                                          <tr><td className="py-1 text-on-surface-variant">Subkategori</td><td className="py-1 text-right">{item.matchedProduct.subcategory || '-'}</td></tr>
                                          <tr><td className="py-1 text-on-surface-variant">Stok</td><td className="py-1 text-right capitalize">{item.matchedProduct.stock.replace(/_/g, ' ')}</td></tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                                <div className="space-y-2">
                                  <p className="font-semibold text-on-surface flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    Data Baru dari Excel
                                  </p>
                                  <div className="glass-card p-3 rounded-lg border border-primary/20 bg-primary/5">
                                    <table className="w-full text-xs">
                                      <tbody className="divide-y divide-outline/10">
                                        <tr>
                                          <td className="py-1 text-on-surface-variant">Harga</td>
                                          <td className={`py-1 text-right ${item.priceChange ? 'text-orange-400 font-bold' : ''}`}>
                                            {item.newData.price ? formatRupiah(Number(item.newData.price)) : '-'}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="py-1 text-on-surface-variant">Kategori</td>
                                          <td className={`py-1 text-right ${item.fieldChanges?.some(f => f.field === 'Kategori') ? 'text-primary font-bold' : ''}`}>
                                            {item.newData.category || '-'}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="py-1 text-on-surface-variant">Subkategori</td>
                                          <td className={`py-1 text-right ${item.fieldChanges?.some(f => f.field === 'Subkategori') ? 'text-primary font-bold' : ''}`}>
                                            {item.newData.subcategory || '-'}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="py-1 text-on-surface-variant">Stok Akhir</td>
                                          <td className={`py-1 text-right ${item.fieldChanges?.some(f => f.field === 'Stok') ? 'text-primary font-bold' : ''}`}>
                                            {getPreviewStockValue(item)}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="py-1 text-on-surface-variant">Stok Display</td>
                                          <td className="py-1 text-right">
                                            {item.newData.stockDisplayQuantity ?? '-'}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td className="py-1 text-on-surface-variant">Status Update</td>
                                          <td className={`py-1 text-right capitalize ${item.fieldChanges?.some(f => f.field === 'Stok') ? 'text-primary font-bold' : ''}`}>
                                            {(item.newData.stock || '-').replace(/_/g, ' ')}
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                                {item.similarProducts && (
                                  <div className="mt-4 p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                                    <p className="text-xs font-bold text-yellow-700 uppercase mb-3 flex items-center gap-2">
                                      <Eye className="w-3.5 h-3.5" /> Produk Serupa (Mohon Cek Manual)
                                    </p>
                                    <div className="grid grid-cols-1 gap-2">
                                      {item.similarProducts.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 bg-surface-container/50 rounded border border-outline/10 text-xs">
                                          <div className="flex flex-col">
                                            <span className="font-bold text-on-surface">{p.name}</span>
                                            <span className="text-on-surface-variant text-[10px]">{p.category} • {formatRupiah(p.price)}</span>
                                          </div>
                                          <Link 
                                            to={`/dashboard/admin/catalog?search=${encodeURIComponent(p.name)}`}
                                            target="_blank"
                                            className="px-2 py-1 bg-surface-high hover:bg-surface-highest rounded text-primary transition-colors font-medium"
                                          >
                                            Lihat di Katalog
                                          </Link>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-4 flex items-center justify-between border-t border-yellow-500/10 pt-3">
                                      <p className="text-[10px] text-yellow-700/70 italic">
                                        * Jika ini adalah produk yang sama, harap samakan namanya di file Excel dengan nama di database untuk melakukan Update otomatis.
                                      </p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleDismissSimilarity(item.rowNumber)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-neon-lime/10 hover:bg-neon-lime/20 text-neon-lime rounded-lg text-xs font-bold transition-colors border border-neon-lime/20"
                                          title="Gunakan data ini sebagai produk baru"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Abaikan & Jadikan Baru
                                        </button>
                                        <button
                                          onClick={() => handleDeleteRow(item.rowNumber)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-lg text-xs font-bold transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Hapus Baris Ini
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {item.fieldChanges && (
                                <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                                  <p className="text-xs font-bold text-primary uppercase mb-2">Ringkasan Perubahan</p>
                                  <div className="flex flex-wrap gap-4">
                                    {item.fieldChanges.map((f, i) => (
                                      <div key={i} className="text-xs">
                                        <span className="text-on-surface-variant">{f.field}:</span>{' '}
                                        <span className="line-through text-on-surface-variant/50">{f.old}</span>{' '}
                                        <span className="text-primary font-bold">→ {f.new}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 border-t border-outline/20">
              <div className="text-sm text-on-surface-variant bg-surface-container/50 px-3 py-1 rounded-full border border-outline/30">
                Menampilkan <span className="text-on-surface font-bold">{Math.min(filteredPreview.length, pageStart + 1)}</span> - <span className="text-on-surface font-bold">{Math.min(filteredPreview.length, pageStart + pageSize)}</span> dari <span className="text-on-surface font-bold">{filteredPreview.length}</span> baris
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg hover:bg-surface-container text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="First Page"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  Prev
                </button>
                
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                    let pageNum = currentPage;
                    if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= pageCount - 2) pageNum = pageCount - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    
                    if (pageNum < 1 || pageNum > pageCount) return null;
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                          currentPage === pageNum
                            ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-110'
                            : 'hover:bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                  disabled={currentPage === pageCount}
                  className="px-3 py-2 rounded-lg hover:bg-surface-container text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm font-medium"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(pageCount)}
                  disabled={currentPage === pageCount}
                  className="p-2 rounded-lg hover:bg-surface-container text-on-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Last Page"
                >
                  »
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">Ke Halaman:</span>
                <input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={currentPage}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1 && val <= pageCount) {
                      setCurrentPage(val);
                    }
                  }}
                  className="w-16 px-2 py-1 rounded border border-outline bg-surface-container text-on-surface text-sm text-center"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-between">
              <button
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setPreview([]);
                }}
                className="px-6 py-3 bg-surface-container text-on-surface-variant rounded-lg font-medium transition-colors"
              >
                ← Kembali
              </button>
              <div className="flex gap-3">
                {/* Import All button — bypasses similar filter */}
                {preview.filter(i => i.status === 'similar').length > 0 && (
                  <button
                    onClick={handleImportAll}
                    disabled={processing}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    title="Import semua produk termasuk yang serupa, tanpa perlu review manual"
                  >
                    <Zap className="w-4 h-4" />
                    Import Semua ({preview.filter(i => i.status !== 'error').length} item)
                  </button>
                )}
                <button
                  onClick={handleProcessImport}
                  disabled={processing}
                  className="px-6 py-3 bg-primary hover:opacity-95 disabled:opacity-60 text-on-primary rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Proses Import ({summary.matched + summary.new} item)
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-12"
          >
            <div className="max-w-md mx-auto">
              <div className="relative w-full h-4 bg-surface-container rounded-full overflow-hidden mb-4 border border-outline/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${importProgress}%` }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-tertiary"
                />
              </div>
              <div className="flex justify-between text-xs font-bold text-on-surface-variant uppercase mb-6">
                <span>Progress</span>
                <span>{importProgress}%</span>
              </div>
              
              <h3 className="text-lg font-semibold text-on-surface mb-2">Sedang memproses...</h3>
              <p className="text-on-surface-variant">Harap tunggu sementara data diupdate ke database</p>
              <p className="text-sm text-on-surface-variant mt-4">Jangan tutup halaman ini</p>
            </div>
          </motion.div>
        )}

        {step === 'done' && processSummary && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Summary header */}
            <div className="glass-card rounded-lg border border-outline p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-neon-lime" />
                <h3 className="text-xl font-bold text-on-surface">Import selesai</h3>
              </div>
              <div className="flex gap-6">
                <div>
                  <span className="text-2xl font-black text-green-500">{processSummary.successCount}</span>
                  <span className="text-sm text-on-surface-variant ml-1">berhasil</span>
                </div>
                {processSummary.errorCount > 0 && (
                  <div>
                    <span className="text-2xl font-black text-red-500">{processSummary.errorCount}</span>
                    <span className="text-sm text-on-surface-variant ml-1">gagal</span>
                  </div>
                )}
              </div>
            </div>

            {/* Failed products table — shown prominently if any */}
            {processSummary.failedProducts.length > 0 && (
              <div className="glass-card rounded-lg border border-red-500/30 overflow-hidden">
                <div className="px-4 py-3 border-b border-red-500/20 bg-red-500/10 flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="font-semibold text-red-500">
                    {processSummary.failedProducts.length} Produk Gagal Diimport
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline/30 bg-surface-container/50">
                        <th className="px-4 py-2 text-left text-on-surface-variant font-semibold w-16">Row</th>
                        <th className="px-4 py-2 text-left text-on-surface-variant font-semibold">Nama Produk</th>
                        <th className="px-4 py-2 text-left text-on-surface-variant font-semibold">Penyebab Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline/20">
                      {processSummary.failedProducts.map((fp, i) => (
                        <tr key={i} className="hover:bg-surface-container/30 transition-colors">
                          <td className="px-4 py-2.5 text-on-surface-variant font-mono text-xs">{fp.row}</td>
                          <td className="px-4 py-2.5 text-on-surface font-medium">{fp.name}</td>
                          <td className="px-4 py-2.5 text-red-400 text-xs font-mono">{fp.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Full log */}
            <div className="glass-card rounded-lg border border-outline overflow-hidden">
              <div className="px-4 py-3 border-b border-outline bg-surface-low font-semibold text-on-surface">
                Ringkasan hasil per baris
              </div>
              <div className="max-h-80 overflow-auto divide-y divide-outline/20">
                {processSummary.results.map((line, index) => (
                  <div key={`${line}-${index}`} className={`px-4 py-3 text-sm flex items-center gap-2 ${
                    line.startsWith('❌') ? 'bg-red-500/5 text-red-400' :
                    line.startsWith('✅') ? 'text-green-500' :
                    'text-on-surface-variant'
                  }`}>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setPreview([]);
                  setProcessSummary(null);
                  setFilterStatus('all');
                  setExpandedRows(new Set());
                }}
                className="px-5 py-3 rounded-lg bg-primary text-on-primary font-medium hover:opacity-95 transition-colors"
              >
                Import file lain
              </button>
              <button
                onClick={() => setStep('preview')}
                className="px-5 py-3 rounded-lg bg-surface-container text-on-surface font-medium hover:bg-surface-bright transition-colors"
              >
                Lihat preview lagi
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 5: History */}
        {step === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-title-md font-bold text-on-surface">📋 Riwayat Bulk Import</h3>
                {bulkHistory.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkHistory([]);
                      localStorage.removeItem('bulkImportHistory');
                      toast.success('Riwayat dihapus');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-error/10 text-error text-sm font-medium hover:bg-error/20 transition-colors flex items-center gap-1"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    Hapus Semua
                  </button>
                )}
              </div>

              {bulkHistory.length === 0 ? (
                <div className="text-center py-8 text-on-surface-variant">
                  Belum ada riwayat import
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {bulkHistory.map((entry) => (
                    <motion.div
                      key={entry.id}
                      layout
                      className="border border-outline/20 rounded-lg p-4 hover:bg-surface-container/50 transition-colors"
                    >
                      <button
                        onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}
                        className="w-full text-left flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-semibold text-on-surface">{entry.fileName}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                              entry.type === 'stock_report'
                                ? 'bg-primary/15 text-primary'
                                : 'bg-surface-high text-on-surface-variant'
                            }`}>
                              {entry.type === 'stock_report' ? 'Stock Report' : 'Standard Import'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              entry.errorCount === 0
                                ? 'bg-green-500/20 text-green-600'
                                : 'bg-yellow-500/20 text-yellow-600'
                            }`}>
                              ✓ {entry.successCount} | ✕ {entry.errorCount}
                            </span>
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {new Date(entry.timestamp).toLocaleString('id-ID')} • {entry.totalItems} item
                          </div>
                        </div>
                        <Eye className={`w-4 h-4 transition-transform ${expandedHistoryId === entry.id ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {expandedHistoryId === entry.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-3 pt-3 border-t border-outline/20 space-y-2"
                          >
                            <div className="text-xs space-y-1 max-h-[200px] overflow-y-auto">
                                {entry.details && entry.details.length > 0 && (
                                  <div className="space-y-1 mb-2">
                                    <div className="text-sm font-medium text-on-surface">Rincian baris tidak terproses</div>
                                    {entry.details.map((d, i) => (
                                      <div key={`detail-${i}`} className="px-2 py-1 rounded text-xs bg-yellow-500/10 text-yellow-700">
                                        <div className="font-semibold">Baris {d.rowNumber} — {d.name}</div>
                                        <div className="text-[11px]">{d.reason}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {entry.results.map((result, idx) => (
                                  <div
                                    key={idx}
                                    className={`px-2 py-1 rounded text-xs ${
                                      result.startsWith('✅')
                                        ? 'bg-green-500/10 text-green-600'
                                        : result.startsWith('❌')
                                        ? 'bg-red-500/10 text-red-600'
                                        : 'bg-blue-500/10 text-blue-600'
                                    }`}
                                  >
                                    {result}
                                  </div>
                                ))}
                            </div>
                            <button
                              onClick={() => {
                                const text = entry.results.join('\n');
                                navigator.clipboard.writeText(text);
                                toast.success('Hasil dikopi ke clipboard');
                              }}
                              className="w-full mt-2 px-3 py-1.5 bg-surface-highest text-on-surface text-xs rounded font-medium hover:bg-surface-bright transition-colors"
                            >
                              📋 Salin Hasil
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setStep('upload')}
              className="px-6 py-3 bg-primary hover:opacity-95 text-on-primary rounded-lg font-medium transition-colors"
            >
              ← Kembali ke Upload
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <StockUpdateConfirmDialog
        open={isStockConfirmOpen}
        breakdown={buildStockUpdateBreakdown()}
        isSubmitting={isStockUpdating}
        onConfirm={handleConfirmStockUpdate}
        onCancel={() => setIsStockConfirmOpen(false)}
      />
    </div>
  );
};

export default AdminProductBulkImport;
