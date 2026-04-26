import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Plus, Search, Filter, TrendingUp, AlertTriangle,
  Eye, Edit3, ArrowUpRight, Tag, Star, ChevronDown, Trash2
} from 'lucide-react';

import { useProductStore } from '../../store/useProductStore';
import { toast } from '../../store/useNotificationStore';

const categories = ['Semua', 'bike', 'electronics', 'furniture'];
const statuses   = ['Semua', 'Active', 'Low Stock', 'Out of Stock'];

const statusStyle: Record<string, string> = {
  'Active':       'bg-secondary/15 text-secondary',
  'Low Stock':    'bg-tertiary/15 text-tertiary',
  'Out of Stock': 'bg-error/15 text-error',
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AdminCatalogPage: React.FC = () => {
  const { products, isLoading, error, deleteProduct, fetchProducts } = useProductStore();
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('Semua');
  const [status, setStatus]     = useState('Semua');
  const [sortBy, setSortBy]     = useState('views');

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
      const success = await deleteProduct(id);
      if (success) {
        toast.success('Produk Berhasil Dihapus', `Produk ${name} telah dihapus dari katalog.`);
      } else {
        toast.error('Gagal Menghapus', 'Terjadi kesalahan saat menghapus produk.');
      }
    }
  };

  if (isLoading) {
    return <div className="text-center py-20 text-on-surface-variant animate-pulse">Memuat data produk...</div>;
  }
  if (error) {
    return <div className="text-center py-20 text-error">Galat memuat data: {error}</div>;
  }

  const filtered = products
    .filter((p) => {
      const matchSearch   = `${p.name} ${p.id}`.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === 'Semua' || p.category === category;
      
      let pStatus = 'Active';
      if (typeof p.stock === 'string') {
        if (p.stock === 'hidden') pStatus = 'Out of Stock';
        else if (p.stock === 'indent') pStatus = 'Low Stock';
      }
      const matchStatus   = status === 'Semua'   || pStatus === status;
      return matchSearch && matchCategory && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
      if (sortBy === 'leads') return (b.leads || 0) - (a.leads || 0);
      if (sortBy === 'conversionRate') return (b.conversionRate || 0) - (a.conversionRate || 0);
      if (sortBy === 'reviews')      return (b.reviewCount || 0) - (a.reviewCount || 0);
      if (sortBy === 'rating')       return (b.rating || 0) - (a.rating || 0);
      return 0;
    });

  const getStatus = (stock: any) => {
    if (typeof stock === 'string') {
      if (stock === 'hidden') return 'Out of Stock';
      if (stock === 'indent') return 'Low Stock';
    }
    return 'Active';
  };

  const totalActive   = products.filter((p) => getStatus(p.stock) === 'Active').length;
  const totalLow      = products.filter((p) => getStatus(p.stock) === 'Low Stock').length;
  const totalOut      = products.filter((p) => getStatus(p.stock) === 'Out of Stock').length;
  const totalViews    = products.reduce((s, p) => s + (p.views || 0), 0);
  const totalLeads    = products.reduce((s, p) => s + (p.leads || 0), 0);
  const totalConversions = products.reduce((s, p) => s + (p.conversions || 0), 0);

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
          { label: 'Total Produk Aktif', value: totalActive,  sub: 'di semua kategori',   color: 'text-secondary', bg: 'bg-secondary/10', icon: Package },
          { label: 'Stok Kritis',         value: totalLow,    sub: '< 5 unit tersisa',     color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: AlertTriangle },
          { label: 'Habis Stok',          value: totalOut,    sub: 'perlu restock segera', color: 'text-error',     bg: 'bg-error/10',     icon: AlertTriangle },
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
          <button
            onClick={() => toast.warning('Restock alert terkirim', 'Peringatan stok kritis sudah dicatat di sistem internal.')}
            className="ml-auto flex-shrink-0 text-label-sm text-primary font-semibold hover:underline"
          >
            Kirim Alert →
          </button>
        </motion.div>
      )}

      {/* Filters & Table */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Cari produk atau ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-on-surface-variant" />
              {categories.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${category === c ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                  {c}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-outline-variant/20" />
            {statuses.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${status === s ? 'bg-surface-highest text-on-surface' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {s}
              </button>
            ))}
            <div className="w-px h-5 bg-outline-variant/20" />
            <div className="relative">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 bg-surface-high border border-outline-variant/20 rounded-lg text-label-sm text-on-surface outline-none">
                <option value="reviews">Sort: Reviews</option>
                <option value="views">Sort: Views</option>
                <option value="leads">Sort: Leads</option>
                <option value="conversionRate">Sort: Conversion</option>
                <option value="rating">Sort: Rating</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead>
              <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-widest">
                <th className="py-3 pr-4">Produk</th>
                <th className="py-3 pr-4">Kategori</th>
                <th className="py-3 pr-4">Harga</th>
                <th className="py-3 pr-4">Stok</th>
                <th className="py-3 pr-4">Reviews</th>
                <th className="py-3 pr-4">Popularitas</th>
                <th className="py-3 pr-4">Rating</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors group">
                  <td className="py-3.5 pr-4">
                    <div>
                      <div className="font-semibold text-on-surface text-body-sm group-hover:text-primary transition-colors">{p.name}</div>
                      <div className="text-label-xs text-on-surface-variant">{p.id}</div>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="px-2 py-0.5 rounded-md bg-surface-highest text-on-surface-variant text-label-xs font-semibold inline-flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />{p.category}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 font-semibold text-on-surface text-body-sm">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.price)}</td>
                  <td className="py-3.5 pr-4">
                    <div className={`font-bold text-body-sm ${p.stock === 'hidden' ? 'text-error' : p.stock === 'indent' ? 'text-tertiary' : 'text-on-surface'}`}>
                      {p.stock === 'hidden' ? 'Habis' : p.stock === 'indent' ? 'Pre-Order' : 'Tersedia'}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-body-sm text-on-surface-variant">{p.reviewCount?.toLocaleString('id-ID') || 0}</td>
                  <td className="py-3.5 pr-4">
                    <div className="font-bold text-secondary text-body-sm">{Math.round(p.conversionRate || 0)}%</div>
                    <div className="text-label-xs text-on-surface-variant mt-0.5">
                      {p.leads || 0} lead / {p.views || 0} views
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="inline-flex items-center gap-1 font-bold text-on-surface text-body-sm">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />{p.rating || 0}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold ${statusStyle[p.stock === 'hidden' ? 'Out of Stock' : p.stock === 'indent' ? 'Low Stock' : 'Active']}`}>{p.stock === 'hidden' ? 'Out of Stock' : p.stock === 'indent' ? 'Low Stock' : 'Active'}</span>
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
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-on-surface-variant text-body-sm">Tidak ada produk yang sesuai filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
          <div className="text-label-sm text-on-surface-variant">
            Menampilkan <strong className="text-on-surface">{filtered.length}</strong> dari {products.length} produk
          </div>
          <Link to="/produk/bike" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Lihat Katalog Publik <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminCatalogPage;