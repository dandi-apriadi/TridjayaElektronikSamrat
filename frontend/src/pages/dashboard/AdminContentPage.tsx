import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye, Archive, Plus, Tag, Clock, CheckCircle2 } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';

import { useBlogStore } from '../../store/useBlogStore';
import { usePersistedState } from '../../hooks/usePersistedState';



const statusConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  Published: { cls: 'bg-secondary/15 text-secondary', icon: <CheckCircle2 className="w-3 h-3" /> },
  Draft: { cls: 'bg-tertiary/15 text-tertiary', icon: <Clock className="w-3 h-3" /> },
  Archived: { cls: 'bg-surface-highest text-on-surface-variant', icon: <Archive className="w-3 h-3" /> },
};

const AdminContentPage: React.FC = () => {
  const { posts, isLoading, error } = useBlogStore();
  const [filterStatus, setFilterStatus] = usePersistedState('adminContent:filterStatus', 'Semua');
  const [currentPage, setCurrentPage] = usePersistedState('adminContent:currentPage', 1);
  const itemsPerPage = 8;

  if (isLoading) {
    return <div className="text-center py-20 text-on-surface-variant animate-pulse">Memuat data artikel...</div>;
  }
  if (error) {
    return <div className="text-center py-20 text-error">Galat memuat data: {error}</div>;
  }

  const getStatus = (dateStr: string) => {
    return new Date(dateStr) > new Date() ? 'Draft' : 'Published';
  };

  const filtered = posts.filter((a) => filterStatus === 'Semua' || getStatus(a.publishedAt) === filterStatus);
  const publishedCount = posts.filter((a) => getStatus(a.publishedAt) === 'Published').length;
  const categories = Array.from(new Set(posts.map(p => p.category))).length;

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
        <Link
          to="/dashboard/admin/content/new"
          className="px-4 py-2 rounded-lg bg-primary/20 text-primary font-semibold inline-flex items-center gap-2 w-fit text-label-sm"
        >
          <Plus className="w-4 h-4" /> Buat Artikel
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Artikel Published</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">{publishedCount}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Kategori Konten</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">{categories}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Draft Menunggu Review</div>
          <div className="font-display text-headline-sm text-tertiary font-bold mt-1">{posts.filter((a) => getStatus(a.publishedAt) === 'Draft').length}</div>
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
        {paginated.map((article) => {
          const status = getStatus(article.publishedAt);
          const sc = statusConfig[status];
          return (
            <div key={article.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-lg border border-outline-variant/10 hover:bg-surface-high/40 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold bg-surface-highest text-on-surface-variant`}>
                    <span className="inline-flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> {(article.tags && article.tags[0]) || 'Lainnya'}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${sc?.cls || ''}`}>
                    {sc?.icon || null} {status}
                  </span>
                </div>
                <div className="font-semibold text-on-surface text-body-sm group-hover:text-primary transition-colors truncate">{article.title}</div>
                <div className="text-label-xs text-on-surface-variant mt-1">
                  {article.id} · {status === 'Draft' ? 'Belum dipublish' : `Publish: ${article.publishedAt}`}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  to={`/blog/${article.slug}`}
                  className="px-3 py-1.5 rounded-md bg-surface-high text-on-surface-variant text-label-sm font-semibold inline-flex items-center gap-1 hover:text-on-surface transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </Link>
                <Link
                  to={`/dashboard/admin/content/edit/${article.id}`}
                  className="px-3 py-1.5 rounded-md bg-primary/20 text-primary text-label-sm font-semibold hover:bg-primary/30 transition-colors"
                >
                  Edit
                </Link>
              </div>
            </div>
          );
        })}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-6 border-t border-outline-variant/10"
        />
      </div>
    </div>
  );
};

export default AdminContentPage;
