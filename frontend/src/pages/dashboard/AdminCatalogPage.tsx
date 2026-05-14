import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Plus, Search, Filter, TrendingUp, AlertTriangle,
  Eye, Edit3, ArrowUpRight, Tag, ChevronDown, Trash2, Upload,
  DollarSign, Percent, Save, X
} from 'lucide-react';

import { useCatalogStore, type CatalogItem } from '../../store/useCatalogStore';
import { toast } from '../../store/useNotificationStore';
import Pagination from '../../components/ui/Pagination';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useDebounce } from '../../hooks/useDebounce';
import { apiFetch, getImageUrl } from '../../utils/apiClient';

type ProductPriceMarkup = {
  id: string;
  scope: 'all' | 'category' | 'product';
  targetValue?: string | null;
  markupType: 'amount' | 'percent';
  markupValue: number;
  isActive: number | boolean;
};

const statuses = ['Semua', 'Active', 'Low Stock', 'Out of Stock'];

const statusStyle: Record<string, string> = {
  'Active':       'bg-secondary/15 text-secondary',
  'Low Stock':    'bg-tertiary/15 text-tertiary',
  'Out of Stock': 'bg-error/15 text-error',
};

const formatCurrency = (value: number) => (
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
);

const hasPriceMarkup = (product: CatalogItem) => (
  typeof product.displayPrice === 'number' && Math.round(product.displayPrice) !== Math.round(product.price)
);

const getNumericStock = (product: CatalogItem): number | null => {
  const value = product.stockQuantity;
  if (value === undefined || value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const getProductStatus = (product: CatalogItem) => {
  const numericStock = getNumericStock(product);
  if (numericStock !== null) {
    if (numericStock <= 0) return 'Out of Stock';
    if (numericStock <= 5) return 'Low Stock';
    return 'Active';
  }

  if (product.stock === 'hidden' || product.stock === 'out_of_stock' || product.stock === 'discontinued') return 'Out of Stock';
  if (product.stock === 'indent' || product.stock === 'limited') return 'Low Stock';
  return 'Active';
};

const getStockToneClass = (product: CatalogItem) => {
  const status = getProductStatus(product);
  if (status === 'Out of Stock') return 'text-error';
  if (status === 'Low Stock') return 'text-tertiary';
  return 'text-secondary';
};

const getStockLabel = (product: CatalogItem) => {
  const numericStock = getNumericStock(product);
  if (numericStock !== null) {
    return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(numericStock)} unit`;
  }
  if (product.stock === 'hidden' || product.stock === 'out_of_stock' || product.stock === 'discontinued') return '0 unit';
  if (product.stock === 'indent') return 'Pre-Order';
  if (product.stock === 'limited') return 'Stok terbatas';
  return 'Stok belum diisi';
};

const getStockStatusHint = (product: CatalogItem) => {
  const status = getProductStatus(product);
  if (status === 'Out of Stock') return 'Habis';
  if (status === 'Low Stock') return 'Stok kritis';
  return 'Tersedia';
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AdminCatalogPage: React.FC = () => {
  const { items, pagination, aggregates, categories: serverCategories, isLoading, error, fetchCatalogPage, invalidate } = useCatalogStore();

  const [search, setSearch] = usePersistedState('adminCatalog:search', '');
  const [category, setCategory] = usePersistedState('adminCatalog:category', 'Semua');
  const [status, setStatus] = usePersistedState('adminCatalog:status', 'Semua');
  const [sortBy, setSortBy] = usePersistedState('adminCatalog:sortBy', 'views');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isMarkupOpen, setIsMarkupOpen] = React.useState(false);
  const [markups, setMarkups] = React.useState<ProductPriceMarkup[]>([]);
  const [isMarkupSaving, setIsMarkupSaving] = React.useState(false);
  const [markupForm, setMarkupForm] = React.useState({
    scope: 'category' as 'all' | 'category' | 'product',
    targetValue: '',
    markupType: 'amount' as 'amount' | 'percent',
    markupValue: '',
    isActive: true,
  });

  const itemsPerPage = 20;
  const debouncedSearch = useDebounce(search, 300);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, category, status, sortBy]);

  // Fetch paginated data from server whenever filters/page change
  React.useEffect(() => {
    fetchCatalogPage({
      page: currentPage,
      limit: itemsPerPage,
      category,
      status,
      search: debouncedSearch,
      sort: sortBy,
    });
  }, [fetchCatalogPage, currentPage, debouncedSearch, category, status, sortBy]);

  const fetchMarkups = React.useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin/catalogs/price-markups');
      if (!res.ok) return;
      const payload = await res.json();
      setMarkups(payload.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch price markups:', err);
    }
  }, []);

  React.useEffect(() => {
    fetchMarkups();
  }, [fetchMarkups]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      try {
        const res = await apiFetch(`/api/catalogs/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('Produk Berhasil Dihapus', `Produk ${name} telah dihapus dari katalog.`);
          invalidate();
        } else {
          toast.error('Gagal Menghapus', 'Terjadi kesalahan saat menghapus produk.');
        }
      } catch {
        toast.error('Gagal Menghapus', 'Terjadi kesalahan saat menghapus produk.');
      }
    }
  };

  // Categories from server response
  const categories = React.useMemo(() => {
    return ['Semua', ...serverCategories.sort((a, b) => a.localeCompare(b, 'id'))];
  }, [serverCategories]);

  const activeMarkupCount = markups.filter((item) => item.isActive === true || item.isActive === 1).length;

  const formatMarkup = (item: ProductPriceMarkup) => (
    item.markupType === 'percent'
      ? `${item.markupValue}%`
      : formatCurrency(item.markupValue)
  );

  const handleSaveMarkup = async () => {
    const value = Number(markupForm.markupValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('MarkUp tidak valid', 'Masukkan nilai markup yang benar.');
      return;
    }
    if (markupForm.scope !== 'all' && !markupForm.targetValue.trim()) {
      toast.error('Target belum dipilih', 'Pilih kategori atau produk terlebih dahulu.');
      return;
    }
    if (markupForm.scope === 'all') {
      const confirmed = window.confirm(
        'PERINGATAN: MarkUp ini akan menaikkan harga tampil publik untuk SEMUA produk. Harga sistem tetap aman, tapi semua halaman publik akan berubah. Lanjutkan?'
      );
      if (!confirmed) return;
    }

    setIsMarkupSaving(true);
    try {
      const res = await apiFetch('/api/admin/catalogs/price-markups', {
        method: 'POST',
        body: JSON.stringify({
          scope: markupForm.scope,
          targetValue: markupForm.scope === 'all' ? null : markupForm.targetValue,
          markupType: markupForm.markupType,
          markupValue: value,
          isActive: markupForm.isActive,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = Array.isArray(payload?.errors) ? payload.errors.join(', ') : payload?.message;
        throw new Error(detail || 'Gagal menyimpan MarkUp harga');
      }
      toast.success('MarkUp harga disimpan', 'Harga publik akan memakai aturan MarkUp terbaru.');
      setMarkupForm({ scope: 'category', targetValue: '', markupType: 'amount', markupValue: '', isActive: true });
      await fetchMarkups();
      invalidate();
    } catch (err) {
      toast.error('Gagal menyimpan MarkUp', err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsMarkupSaving(false);
    }
  };

  const handleDeleteMarkup = async (id: string) => {
    if (!window.confirm('Hapus aturan MarkUp harga ini? Harga publik akan kembali mengikuti aturan lain yang masih aktif.')) return;
    try {
      const res = await apiFetch(`/api/admin/catalogs/price-markups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus MarkUp');
      toast.success('MarkUp dihapus', 'Aturan harga publik berhasil dihapus.');
      await fetchMarkups();
      invalidate();
    } catch (err) {
      toast.error('Gagal menghapus MarkUp', err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  // Use server-provided aggregates
  const { totalActive, totalLowStock: totalLow, totalOutOfStock: totalOut, totalViews, totalLeads, totalConversions } = aggregates;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Manajemen Produk</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Package className="w-6 h-6 text-primary" /> Catalog Central
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Source of truth harga, stok, dan spesifikasi untuk seluruh agen. Validasi perubahan harus sinkron dengan tim sales.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsMarkupOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-tertiary/15 text-tertiary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-tertiary/25 transition-colors"
            >
              <DollarSign className="w-4 h-4" /> MarkUp Harga
              {activeMarkupCount > 0 && (
                <span className="rounded-md bg-tertiary/20 px-1.5 py-0.5 text-[10px] leading-none">{activeMarkupCount}</span>
              )}
            </button>
            <Link
              to="/dashboard/admin/catalog/bulk-import"
              className="px-4 py-2.5 rounded-lg bg-secondary/15 text-secondary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-secondary/25 transition-colors"
            >
              <Upload className="w-4 h-4" /> Bulk Import
            </Link>
            <Link
              to="/dashboard/admin/catalog/new"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah Produk
            </Link>
            <Link
              to="/produk/home"
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              <Eye className="w-4 h-4" /> Lihat Publik
            </Link>
          </div>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Produk Aktif', value: totalActive, sub: 'di semua kategori', color: 'text-secondary', bg: 'bg-secondary/10', icon: Package },
          { label: 'Stok Kritis', value: totalLow, sub: '< 5 unit tersisa', color: 'text-tertiary', bg: 'bg-tertiary/10', icon: AlertTriangle },
          { label: 'Habis Stok', value: totalOut, sub: 'perlu restock segera', color: 'text-error', bg: 'bg-error/10', icon: AlertTriangle },
          { label: 'Total Lead Katalog', value: totalLeads.toLocaleString('id-ID'), sub: `${totalViews.toLocaleString('id-ID')} views • ${totalConversions.toLocaleString('id-ID')} conversions`, color: 'text-primary', bg: 'bg-primary/10', icon: TrendingUp },
        ].map((k) => (
          <motion.div key={k.label} variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}>
              <k.icon className="w-4 h-4" />
            </div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
            <div className="text-label-xs text-on-surface-variant mt-0.5">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Alert Bar for critical stock */}
      {(totalLow > 0 || totalOut > 0) && (
        <motion.div variants={itemVariants} className="flex items-center gap-3 p-4 rounded-xl bg-error/8 border border-error/20">
          <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-body-sm text-on-surface">
            <strong className="text-error">{totalOut} produk habis stok</strong> dan{' '}
            <strong className="text-tertiary">{totalLow} produk stok kritis</strong> — segera koordinasi dengan tim inventory.
          </p>
        </motion.div>
      )}

      {isMarkupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-outline bg-surface p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Harga Publik</p>
                <h3 className="mt-1 flex items-center gap-2 text-title-lg font-bold text-on-surface">
                  <DollarSign className="h-5 w-5 text-tertiary" /> MarkUp Harga
                </h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Harga sistem tetap tersimpan apa adanya. MarkUp hanya menaikkan harga yang tampil di halaman publik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMarkupOpen(false)}
                className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-outline-variant/20 bg-surface-low p-4">
                <div>
                  <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Scope</label>
                  <select
                    value={markupForm.scope}
                    onChange={(e) => setMarkupForm((prev) => ({ ...prev, scope: e.target.value as typeof prev.scope, targetValue: '' }))}
                    className="w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 py-2.5 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="category">Per Kategori</option>
                    <option value="product">Per Produk</option>
                    <option value="all">Semua Produk</option>
                  </select>
                </div>

                {markupForm.scope === 'category' && (
                  <div>
                    <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Kategori</label>
                    <select
                      value={markupForm.targetValue}
                      onChange={(e) => setMarkupForm((prev) => ({ ...prev, targetValue: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 py-2.5 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Pilih kategori</option>
                      {serverCategories.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                )}

                {markupForm.scope === 'product' && (
                  <div>
                    <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Produk</label>
                    <select
                      value={markupForm.targetValue}
                      onChange={(e) => setMarkupForm((prev) => ({ ...prev, targetValue: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 py-2.5 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="">Pilih produk</option>
                      {items
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, 'id'))
                        .map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                {markupForm.scope === 'all' && (
                  <div className="rounded-lg border border-error/25 bg-error/10 p-3 text-body-sm text-error">
                    MarkUp akan berlaku ke semua produk publik. Sistem akan meminta konfirmasi sebelum menyimpan.
                  </div>
                )}

                <div className="grid grid-cols-[140px,1fr] gap-3">
                  <div>
                    <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Tipe</label>
                    <select
                      value={markupForm.markupType}
                      onChange={(e) => setMarkupForm((prev) => ({ ...prev, markupType: e.target.value as typeof prev.markupType }))}
                      className="w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 py-2.5 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="amount">Nominal</option>
                      <option value="percent">Persen</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      Nilai {markupForm.markupType === 'percent' ? '(%)' : '(Rp)'}
                    </label>
                    <div className="relative">
                      {markupForm.markupType === 'percent' ? (
                        <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                      ) : (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-sm font-bold text-on-surface-variant">Rp</span>
                      )}
                      <input
                        type="number"
                        min="0"
                        value={markupForm.markupValue}
                        onChange={(e) => setMarkupForm((prev) => ({ ...prev, markupValue: e.target.value }))}
                        className="w-full rounded-lg border border-outline-variant/20 bg-surface-high py-2.5 pl-10 pr-3 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder={markupForm.markupType === 'percent' ? '10' : '500000'}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveMarkup}
                  disabled={isMarkupSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-tertiary px-4 py-2.5 text-label-sm font-bold text-surface transition-opacity disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {isMarkupSaving ? 'Menyimpan...' : 'Simpan MarkUp'}
                </button>
              </div>

              <div className="rounded-lg border border-outline-variant/20 bg-surface-low p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-label-sm font-bold uppercase tracking-widest text-on-surface-variant">Aturan Aktif</h4>
                  <span className="text-label-xs text-on-surface-variant">{activeMarkupCount} aktif</span>
                </div>
                <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                  {markups.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-outline-variant/30 p-5 text-center text-body-sm text-on-surface-variant">
                      Belum ada aturan MarkUp.
                    </div>
                  ) : markups.map((item) => (
                    <div key={item.id} className="rounded-lg border border-outline-variant/15 bg-surface-high p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-label-xs font-bold uppercase text-primary">{item.scope}</span>
                            <span className="text-body-sm font-bold text-on-surface">{formatMarkup(item)}</span>
                          </div>
                          <p className="mt-1 truncate text-label-sm text-on-surface-variant">
                            {item.scope === 'all' ? 'Semua produk' : item.targetValue}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMarkup(item.id)}
                          className="rounded-md p-1.5 text-error hover:bg-error/10"
                          title="Hapus MarkUp"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Table */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Toolbar */}
        <div className="grid gap-4 mb-6 xl:grid-cols-[minmax(260px,1fr)_220px_auto_190px] xl:items-end">
          <div className="relative">
            <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Cari Produk
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari produk atau ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              <Filter className="w-3.5 h-3.5" /> Kategori
            </label>
            <SearchableSelect
              value={category}
              onChange={(val) => setCategory(val)}
              placeholder="Semua Kategori"
              searchPlaceholder="Cari kategori..."
              options={categories.map((c) => ({
                value: c,
                label: c === 'Semua' ? `Semua Kategori (${pagination.total})` : c,
              }))}
            />
          </div>

          <div>
            <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-3 py-2 rounded-lg text-label-sm font-semibold transition-all ${status === s ? 'bg-surface-highest text-on-surface ring-1 ring-outline-variant/30' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              Urutkan
            </label>
            <div className="relative">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-label-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40">
                <option value="views">Sort: Views</option>
                <option value="leads">Sort: Leads</option>
                <option value="conversionRate">Sort: Conversion</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
            </div>
          </div>
        </div>

        {(category !== 'Semua' || status !== 'Semua' || search.trim()) && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/15 bg-surface-low/60 px-3 py-2">
            <span className="text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Filter aktif</span>
            {category !== 'Semua' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/12 px-2.5 py-1 text-label-xs font-semibold text-primary">
                <Tag className="h-3 w-3" /> {category}
              </span>
            )}
            {status !== 'Semua' && (
              <span className="rounded-md bg-surface-highest px-2.5 py-1 text-label-xs font-semibold text-on-surface">
                {status}
              </span>
            )}
            {search.trim() && (
              <span className="rounded-md bg-surface-highest px-2.5 py-1 text-label-xs font-semibold text-on-surface">
                "{search.trim()}"
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('Semua');
                setStatus('Semua');
              }}
              className="ml-auto rounded-md px-2 py-1 text-label-xs font-semibold text-primary hover:bg-primary/10"
            >
              Reset
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-10 text-on-surface-variant animate-pulse">Memuat data produk...</div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-center py-10 text-error">{error}</div>
        )}

        {/* Table */}
        {!isLoading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[860px]">
                <thead>
                  <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-widest">
                    <th className="py-3 pr-4">Produk</th>
                    <th className="py-3 pr-4">Kategori</th>
                    <th className="py-3 pr-4">Harga</th>
                    <th className="py-3 pr-4">Stok</th>
                    <th className="py-3 pr-4">Popularitas</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors group">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-highest flex-shrink-0 border border-outline-variant/20">
                            {p.image ? (
                              <img
                                src={getImageUrl(p.image)}
                                alt={p.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant/30">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-on-surface text-body-sm group-hover:text-primary transition-colors truncate max-w-[200px]">{p.name}</div>
                            <div className="text-label-xs text-on-surface-variant truncate max-w-[200px]">{p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="px-2 py-0.5 rounded-md bg-surface-highest text-on-surface-variant text-label-xs font-semibold inline-flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />{p.category}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className={`font-semibold text-body-sm ${hasPriceMarkup(p) ? 'gradient-text-primary' : 'text-on-surface'}`}>
                          {formatCurrency(p.displayPrice ?? p.price)}
                        </div>
                        {hasPriceMarkup(p) ? (
                          <div className="mt-0.5 flex flex-col gap-0.5 text-label-xs text-on-surface-variant">
                            <span>Sistem: {formatCurrency(p.price)}</span>
                            <span className="text-tertiary">MarkUp publik aktif</span>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-label-xs text-on-surface-variant">Harga sistem</div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className={`font-bold text-body-sm ${getStockToneClass(p)}`}>
                          {getStockLabel(p)}
                        </div>
                        <div className="mt-0.5 text-label-xs text-on-surface-variant">
                          {getStockStatusHint(p)}
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="font-bold text-secondary text-body-sm">{Math.round(p.conversionRate || 0)}%</div>
                        <div className="text-label-xs text-on-surface-variant mt-0.5">
                          {p.leads || 0} lead / {p.views || 0} views
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        {(() => {
                          const productStatus = getProductStatus(p);
                          return (
                            <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold ${statusStyle[productStatus]}`}>
                              {productStatus}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Link to={`/produk/${p.slug}`} className="p-1.5 rounded-md bg-surface-highest text-on-surface-variant hover:text-primary transition-colors" title="Preview">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link to={`/dashboard/admin/catalog/edit/${p.id}`} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-md bg-error/10 text-error hover:bg-error/20 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={7} className="py-10 text-center text-on-surface-variant text-body-sm">Tidak ada produk yang sesuai filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setCurrentPage(page)}
              className="mt-4 border-t border-outline-variant/10"
            />

            <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
              <div className="text-label-sm text-on-surface-variant">
                Menampilkan <strong className="text-on-surface">{items.length}</strong> dari {pagination.total} produk
              </div>
              <Link to="/produk/bike" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
                Lihat Katalog Publik <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminCatalogPage;
