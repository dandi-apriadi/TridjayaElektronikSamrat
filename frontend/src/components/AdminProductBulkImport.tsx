import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle2, XCircle, Download, Play, Trash2, Eye, EyeOff, History, Trash } from 'lucide-react';
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

interface BulkImportHistory {
  id: string;
  timestamp: number;
  fileName: string;
  successCount: number;
  errorCount: number;
  results: string[];
  details?: Array<{ rowNumber?: number; name?: string; status: string; reason?: string }>;
  totalItems: number;
}

const AdminProductBulkImport: React.FC = () => {
  const { products } = useProductStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'done' | 'history'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'similar' | 'new' | 'error'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [processSummary, setProcessSummary] = useState<{ successCount: number; errorCount: number; results: string[] } | null>(null);
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

    for (const categoryName of categoryNames) {
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
          // Check if it's a duplicate (UNIQUE constraint violation)
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

      setProcessSummary(summary);
      
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
      console.error('Bulk import error:', error);
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
                            <td colSpan={5} className="px-4 py-4">
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
                                          <td className="py-1 text-on-surface-variant">Stok</td>
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
              <button
                onClick={handleProcessImport}
                disabled={processing}
                className="px-6 py-3 bg-primary hover:opacity-95 disabled:opacity-60 text-on-primary rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Proses Import ({summary.matched + summary.new} item)
              </button>
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
            <div className="glass-card rounded-lg border border-outline p-6">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-6 h-6 text-neon-lime" />
                <h3 className="text-xl font-bold text-on-surface">Import selesai</h3>
              </div>
              <p className="text-on-surface-variant">
                {processSummary.successCount} berhasil, {processSummary.errorCount} gagal.
              </p>
            </div>

            <div className="glass-card rounded-lg border border-outline overflow-hidden">
              <div className="px-4 py-3 border-b border-outline bg-surface-low font-semibold text-on-surface">
                Ringkasan hasil per baris
              </div>
              <div className="max-h-80 overflow-auto divide-y divide-outline/20">
                {processSummary.results.map((line, index) => (
                  <div key={`${line}-${index}`} className="px-4 py-3 text-sm text-on-surface-variant flex items-center gap-2">
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
    </div>
  );
};

export default AdminProductBulkImport;
