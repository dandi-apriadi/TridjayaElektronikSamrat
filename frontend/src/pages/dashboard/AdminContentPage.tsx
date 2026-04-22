import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye, Archive, Plus, Tag, Clock, CheckCircle2 } from 'lucide-react';

const articles = [
  { id: 'ART-101', title: 'Panduan Memilih Sepeda Listrik untuk Komuter Harian', category: 'Edukasi', status: 'Published', views: 1842, publishedAt: '15 Apr 2026', slug: 'panduan-memilih-sepeda-listrik' },
  { id: 'ART-102', title: '5 Keunggulan Goda GD120 Dibanding Kompetitor', category: 'Produk', status: 'Published', views: 2140, publishedAt: '10 Apr 2026', slug: 'panduan-memilih-sepeda-listrik' },
  { id: 'ART-103', title: 'Tips Closing Penjualan untuk Agen Reseller Elektronik', category: 'Tips Agen', status: 'Published', views: 987, publishedAt: '05 Apr 2026', slug: 'panduan-memilih-sepeda-listrik' },
  { id: 'ART-104', title: 'Promo Ramadan 2026: Daftar Produk Diskon Spesial', category: 'Promo', status: 'Draft', views: 0, publishedAt: '—', slug: 'panduan-memilih-sepeda-listrik' },
  { id: 'ART-105', title: 'Cara Memaksimalkan Link Referral sebagai Agen Samrat', category: 'Tips Agen', status: 'Draft', views: 0, publishedAt: '—', slug: 'panduan-memilih-sepeda-listrik' },
  { id: 'ART-106', title: 'Smart TV OLED vs LED: Mana yang Lebih Worth It?', category: 'Edukasi', status: 'Archived', views: 3210, publishedAt: '01 Jan 2026', slug: 'panduan-memilih-sepeda-listrik' },
];

const categoryColors: Record<string, string> = {
  'Edukasi': 'bg-primary/15 text-primary',
  'Produk': 'bg-secondary/15 text-secondary',
  'Tips Agen': 'bg-tertiary/15 text-tertiary',
  'Promo': 'bg-orange-500/15 text-orange-400',
};

const statusConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  Published: { cls: 'bg-secondary/15 text-secondary', icon: <CheckCircle2 className="w-3 h-3" /> },
  Draft: { cls: 'bg-tertiary/15 text-tertiary', icon: <Clock className="w-3 h-3" /> },
  Archived: { cls: 'bg-surface-highest text-on-surface-variant', icon: <Archive className="w-3 h-3" /> },
};

const AdminContentPage: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState('Semua');

  const filtered = articles.filter((a) => filterStatus === 'Semua' || a.status === filterStatus);
  const publishedCount = articles.filter((a) => a.status === 'Published').length;
  const totalViews = articles.reduce((s, a) => s + a.views, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div>
          <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Manajemen Konten & Blog
          </h3>
          <p className="text-body-sm text-on-surface-variant mt-1">Kelola artikel, edukasi produk, dan tips untuk mendukung aktivitas penjualan agen.</p>
        </div>
        <a
          href="mailto:content@tridjaya.co.id?subject=Request%20Artikel%20Baru"
          className="px-4 py-2 rounded-lg bg-primary/20 text-primary font-semibold inline-flex items-center gap-2 w-fit text-label-sm"
        >
          <Plus className="w-4 h-4" /> Buat Artikel
        </a>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Artikel Published</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">{publishedCount}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Total Views (All)</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">{totalViews.toLocaleString('id-ID')}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Draft Menunggu Review</div>
          <div className="font-display text-headline-sm text-tertiary font-bold mt-1">{articles.filter((a) => a.status === 'Draft').length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card rounded-xl p-4 flex items-center gap-3">
        <span className="text-label-sm text-on-surface-variant font-semibold">Filter:</span>
        {['Semua', 'Published', 'Draft', 'Archived'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-md text-label-sm font-semibold transition-all ${filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Article List */}
      <div className="glass-card rounded-xl p-6 space-y-3">
        {filtered.map((article) => {
          const sc = statusConfig[article.status];
          return (
            <div key={article.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-lg border border-outline-variant/10 hover:bg-surface-high/40 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold ${categoryColors[article.category] || 'bg-surface-highest text-on-surface-variant'}`}>
                    <span className="inline-flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> {article.category}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${sc.cls}`}>
                    {sc.icon} {article.status}
                  </span>
                </div>
                <div className="font-semibold text-on-surface text-body-sm group-hover:text-primary transition-colors truncate">{article.title}</div>
                <div className="text-label-xs text-on-surface-variant mt-1">
                  {article.id} · {article.status === 'Draft' ? 'Belum dipublish' : `Publish: ${article.publishedAt}`}
                  {article.views > 0 && ` · ${article.views.toLocaleString('id-ID')} Views`}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to={`/blog/${article.slug}`}
                  className="px-3 py-1.5 rounded-md bg-surface-high text-on-surface-variant text-label-sm font-semibold inline-flex items-center gap-1 hover:text-on-surface transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </Link>
                <a
                  href={`mailto:content@tridjaya.co.id?subject=Edit%20Artikel%20${article.id}`}
                  className="px-3 py-1.5 rounded-md bg-primary/20 text-primary text-label-sm font-semibold hover:bg-primary/30 transition-colors"
                >
                  Edit
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminContentPage;
