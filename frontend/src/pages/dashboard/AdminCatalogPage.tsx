import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Plus, Search, Filter, TrendingUp, AlertTriangle,
  Eye, Edit3, ArrowUpRight, Tag, Star, ChevronDown,
} from 'lucide-react';

const products = [
  { id: 'PRD-001', name: 'Goda GD120', category: 'Sepeda Listrik', price: 'Rp 7.500.000', stock: 24, views: 2482, conversion: '12%', rating: 4.8, status: 'Active', slug: 'goda-gd120' },
  { id: 'PRD-002', name: 'Winfly W200', category: 'Sepeda Listrik', price: 'Rp 9.200.000', stock: 11, views: 1940, conversion: '10%', rating: 4.6, status: 'Active', slug: 'winfly-w200' },
  { id: 'PRD-003', name: 'Nuv City Skuter', category: 'Skuter Listrik', price: 'Rp 12.800.000', stock: 7, views: 1621, conversion: '9.2%', rating: 4.5, status: 'Active', slug: 'nuv-city' },
  { id: 'PRD-004', name: 'Smart TV OLED 55"', category: 'Elektronik', price: 'Rp 8.400.000', stock: 7, views: 1421, conversion: '8.8%', rating: 4.7, status: 'Active', slug: 'smart-tv-65' },
  { id: 'PRD-005', name: 'Sofa Premium L', category: 'Furnitur', price: 'Rp 5.200.000', stock: 3, views: 1204, conversion: '8.5%', rating: 4.4, status: 'Low Stock', slug: 'sofa-premium-l' },
  { id: 'PRD-006', name: 'AC Inverter 1.5PK', category: 'Elektronik', price: 'Rp 4.800.000', stock: 0, views: 980, conversion: '6.1%', rating: 4.2, status: 'Out of Stock', slug: 'ac-inverter' },
  { id: 'PRD-007', name: 'Kulkas 2 Pintu 320L', category: 'Elektronik', price: 'Rp 6.100.000', stock: 14, views: 840, conversion: '5.8%', rating: 4.3, status: 'Active', slug: 'kulkas-2-pintu' },
  { id: 'PRD-008', name: 'Sofa Flexi 2 Seater', category: 'Furnitur', price: 'Rp 3.600.000', stock: 2, views: 650, conversion: '4.9%', rating: 4.1, status: 'Low Stock', slug: 'sofa-flexi' },
];

const categories = ['Semua', 'Sepeda Listrik', 'Skuter Listrik', 'Elektronik', 'Furnitur'];
const statuses   = ['Semua', 'Active', 'Low Stock', 'Out of Stock'];

const statusStyle: Record<string, string> = {
  'Active':       'bg-secondary/15 text-secondary',
  'Low Stock':    'bg-tertiary/15 text-tertiary',
  'Out of Stock': 'bg-error/15 text-error',
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AdminCatalogPage: React.FC = () => {
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState('Semua');
  const [status, setStatus]     = useState('Semua');
  const [sortBy, setSortBy]     = useState('views');

  const filtered = products
    .filter((p) => {
      const matchSearch   = `${p.name} ${p.id}`.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === 'Semua' || p.category === category;
      const matchStatus   = status === 'Semua'   || p.status === status;
      return matchSearch && matchCategory && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'views')      return b.views - a.views;
      if (sortBy === 'stock')      return b.stock - a.stock;
      if (sortBy === 'rating')     return b.rating - a.rating;
      return 0;
    });

  const totalActive   = products.filter((p) => p.status === 'Active').length;
  const totalLow      = products.filter((p) => p.status === 'Low Stock').length;
  const totalOut      = products.filter((p) => p.status === 'Out of Stock').length;
  const totalViews    = products.reduce((s, p) => s + p.views, 0);

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
          { label: 'Total Views Katalog', value: totalViews.toLocaleString('id-ID'), sub: 'semua produk',   color: 'text-primary',   bg: 'bg-primary/10',   icon: TrendingUp },
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
            onClick={() => alert('Restock alert sent to inventory team!')}
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
                <option value="views">Sort: Views</option>
                <option value="stock">Sort: Stok</option>
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
                <th className="py-3 pr-4">Views</th>
                <th className="py-3 pr-4">Konversi</th>
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
                  <td className="py-3.5 pr-4 font-semibold text-on-surface text-body-sm">{p.price}</td>
                  <td className="py-3.5 pr-4">
                    <div className={`font-bold text-body-sm ${p.stock === 0 ? 'text-error' : p.stock < 5 ? 'text-tertiary' : 'text-on-surface'}`}>
                      {p.stock} unit
                    </div>
                    <div className="w-16 h-1 rounded-full bg-surface-highest mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${p.stock === 0 ? 'bg-error' : p.stock < 5 ? 'bg-tertiary' : 'bg-secondary'}`}
                        style={{ width: `${Math.min((p.stock / 30) * 100, 100)}%` }} />
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-body-sm text-on-surface-variant">{p.views.toLocaleString('id-ID')}</td>
                  <td className="py-3.5 pr-4 font-bold text-secondary text-body-sm">{p.conversion}</td>
                  <td className="py-3.5 pr-4">
                    <div className="inline-flex items-center gap-1 font-bold text-on-surface text-body-sm">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />{p.rating}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold ${statusStyle[p.status]}`}>{p.status}</span>
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link to={`/produk/${p.slug}`} className="p-1.5 rounded-md bg-surface-highest text-on-surface-variant hover:text-primary transition-colors" title="Preview">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link to={`/dashboard/admin/catalog/edit/${p.id}`} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Edit">
                        <Edit3 className="w-4 h-4" />
                      </Link>
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