import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle2, XCircle, Download, Play, Trash2, Eye, EyeOff } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { toast } from '../store/useNotificationStore';
import {
  parseExcelFile,
  generateImportPreview,
  prepareUpdateData,
  getImportSummary,
  type ImportPreviewItem
} from '../utils/productImportHandler';
import { formatRupiah } from '../utils/creditCalculator';

const AdminProductBulkImport: React.FC = () => {
  const { products, updateProduct, createProduct } = useProductStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'done'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'matched' | 'new' | 'error'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [processSummary, setProcessSummary] = useState<{ successCount: number; errorCount: number; results: string[] } | null>(null);
  const [importProgress, setImportProgress] = useState(0);

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
    if (preview.length === 0) {
      toast.error('Tidak ada data untuk diimport');
      return;
    }

    setProcessing(true);
    setStep('processing');
    
    let successCount = 0;
    let errorCount = 0;
    const results: string[] = [];

    try {
      setImportProgress(0);
      for (let i = 0; i < preview.length; i++) {
        const item = preview[i];
        
        try {
          // Skip error items
          if (item.status === 'error') {
            errorCount++;
            results.push(`❌ Row ${item.rowNumber}: ${item.error}`);
            continue;
          }

          const updateData = prepareUpdateData(item.newData);

          if (item.status === 'matched' && item.matchedProduct) {
            // Update existing product
            const success = await updateProduct(item.matchedProduct.id, updateData);
            if (success) {
              successCount++;
              const priceInfo = item.priceChange 
                ? ` (Harga: ${formatRupiah(item.priceChange.old)} → ${formatRupiah(item.priceChange.new)})`
                : '';
              results.push(`✅ Updated: ${item.name}${priceInfo}`);
            } else {
              errorCount++;
              results.push(`❌ Row ${item.rowNumber}: Gagal update ${item.name}`);
            }
          } else if (item.status === 'new') {
            // Create new product
            const productName = item.newData.name || '';
            const createData = {
              ...updateData,
              name: productName,
              slug: productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              stock: updateData.stock || 'available'
            };
            
            const success = await createProduct(createData);
            if (success) {
              successCount++;
              results.push(`✅ Created: ${item.name}`);
            } else {
              errorCount++;
              results.push(`❌ Row ${item.rowNumber}: Gagal create ${item.name}`);
            }
          }
          
          // Update progress
          setImportProgress(Math.round(((i + 1) / preview.length) * 100));
        } catch (error) {
          errorCount++;
          results.push(`❌ Row ${item.rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Small delay for UI update
        if ((i + 1) % 5 === 0 || i === preview.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Show summary
      setProcessing(false);
      setProcessSummary({ successCount, errorCount, results });
      setStep('done');
      toast.success(`Import selesai: ${successCount} berhasil, ${errorCount} gagal`);
      
      // Log results
      console.log('Import Results:', results);
      
    } catch (error) {
      setProcessing(false);
      setStep('preview');
      toast.error('Terjadi error saat processing');
      console.error('Import error:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-premium rounded-lg p-6">
        <h2 className="text-2xl font-bold text-on-surface mb-2">📊 Bulk Import/Update Produk</h2>
        <p className="text-on-surface-variant">Upload Excel untuk mengupdate harga dan data produk secara massal. Produk akan dicocokkan berdasarkan nama.</p>
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
                {(['all', 'matched', 'new', 'error'] as const).map(status => (
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
                              {item.status === 'new' && (
                                <span className="text-tertiary">Siap ditambahkan sebagai produk baru</span>
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
                {processSummary.results.map((line) => (
                  <div key={line} className="px-4 py-3 text-sm text-on-surface-variant">
                    {line}
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
      </AnimatePresence>
    </div>
  );
};

export default AdminProductBulkImport;
