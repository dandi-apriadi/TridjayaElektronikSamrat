import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Megaphone, Plus, Eye, Edit3, Calendar, TrendingUp,
  Tag, CheckCircle2, XCircle, Pause, ArrowUpRight, BarChart3, Zap,
} from 'lucide-react';

import { usePromoStore } from '../../store/usePromoStore';
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import Pagination from '../../components/ui/Pagination';

const statusConfig: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
  'Active': { cls: 'bg-secondary/15 text-secondary', label: 'Aktif', icon: <CheckCircle2 className="w-3 h-3" /> },
  'Ended':  { cls: 'bg-surface-highest text-on-surface-variant', label: 'Selesai', icon: <XCircle className="w-3 h-3" /> },
  'Draft':  { cls: 'bg-tertiary/15 text-tertiary', label: 'Draft', icon: <Pause className="w-3 h-3" /> },
};

const categoryColors: Record<string, string> = {
  'Cashback':  'bg-primary/15 text-primary',
  'Diskon':    'bg-secondary/15 text-secondary',
  'Flash Sale':'bg-error/15 text-error',
  'Bundling':  'bg-tertiary/15 text-tertiary',
  'Regional':  'bg-orange-400/15 text-orange-400',
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AdminPromoPage: React.FC = () => {
  const { promos, isLoading, error } = usePromoStore();
  const { telemetryStats, fetchTelemetryStats } = useAdminNetworkStore();
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  React.useEffect(() => {
    fetchTelemetryStats();
  }, [fetchTelemetryStats]);

  if (isLoading) {
    return <div className="text-center py-20 text-on-surface-variant animate-pulse">Memuat data campaign...</div>;
  }
  if (error) {
    return <div className="text-center py-20 text-error">Galat memuat data: {error}</div>;
  }

  const getPromoStatus = (validUntil: string) => {
    return new Date(validUntil) > new Date() ? 'Active' : 'Ended';
  };

  const filtered = promos.filter((p) => filterStatus === 'Semua' || getPromoStatus(p.validUntil) === filterStatus);
  const activeCount   = promos.filter((p) => getPromoStatus(p.validUntil) === 'Active').length;
  const totalClicks = telemetryStats?.sourceRows?.reduce((sum, row: any) => sum + (row.clicks ?? 0), 0) ?? 0;
  const totalConvs = telemetryStats?.trafficData?.reduce((sum, row: any) => sum + (row.conversions ?? 0), 0) ?? 0;
  const avgConvRate   = totalClicks > 0 ? ((totalConvs / totalClicks) * 100).toFixed(1) : '0.0';

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-tertiary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Campaign Management</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Megaphone className="w-6 h-6 text-tertiary" /> Promo & Campaign
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Kelola campaign aktif, jadwal promo, dan produk yang di-link. Koordinasikan dengan tim agen untuk distribusi.
            </p>
          </div>
          <Link
            to="/dashboard/admin/promo/new"
            className="px-4 py-2.5 rounded-lg bg-tertiary/15 text-tertiary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-tertiary/25 transition-colors w-fit"
          >
            <Plus className="w-4 h-4" /> Buat Campaign
          </Link>
        </div>
      </motion.div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Campaign Aktif', value: activeCount, sub: 'berlangsung sekarang', color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2 },
          { label: 'Total Klik (All)', value: totalClicks.toLocaleString('id-ID'), sub: 'semua campaign', color: 'text-primary', bg: 'bg-primary/10', icon: TrendingUp },
          { label: 'Total Konversi', value: totalConvs, sub: 'dari semua campaign', color: 'text-secondary', bg: 'bg-secondary/10', icon: BarChart3 },
          { label: 'Avg Conv. Rate', value: `${avgConvRate}%`, sub: 'klik ke transaksi', color: 'text-tertiary', bg: 'bg-tertiary/10', icon: Zap },
        ].map((k) => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
            <div className="text-label-xs text-on-surface-variant mt-0.5">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Promo List */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-display text-title-md font-bold text-on-surface">Daftar Campaign</h3>
          <div className="flex items-center gap-2">
            {['Semua', 'Active', 'Draft', 'Ended'].map((s) => (
              <button key={s} type="button" onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${filterStatus === s ? 'bg-tertiary/20 text-tertiary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {paginated.map((promo) => {
            const status = getPromoStatus(promo.validUntil);
            const sc = statusConfig[status];
            return (
              <div key={promo.id} className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 rounded-xl border border-outline-variant/10 hover:bg-surface-high/30 transition-colors group">
                {/* Left */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold ${categoryColors[promo.category] || 'bg-surface-highest text-on-surface-variant'}`}>
                      <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{promo.category}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${sc?.cls || ''}`}>
                      {sc?.icon}{sc?.label || status}
                    </span>
                    <span className="text-label-xs text-on-surface-variant">{promo.id}</span>
                  </div>
                  <div className="font-display font-bold text-on-surface text-body-md group-hover:text-primary transition-colors mb-1.5">
                    {promo.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-xs text-on-surface-variant">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />Exp: {promo.validUntil || 'Tanpa Batas'}</span>
                    <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-tertiary" />Diskon {promo.discount}%</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {promo.productIds && promo.productIds.map((l) => (
                      <span key={l} className="px-2 py-0.5 rounded-md bg-surface-highest text-on-surface-variant text-label-xs">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-center">
                    <div className="font-display font-bold text-on-surface">-</div>
                    <div className="text-label-xs text-on-surface-variant">Klik</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-secondary">-</div>
                    <div className="text-label-xs text-on-surface-variant">Konversi</div>
                  </div>
                  <div className="text-center">
                    <div className="font-display font-bold text-primary">-</div>
                    <div className="text-label-xs text-on-surface-variant">Conv. Rate</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/promo/${promo.id}`} className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-primary transition-colors" title="Preview">
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link to={`/dashboard/admin/promo/edit/${promo.id}`}
                    className="p-2 rounded-lg bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors" title="Edit">
                    <Edit3 className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-6 border-t border-outline-variant/10"
        />

        <div className="mt-6 pt-4 border-t border-outline-variant/10">
          <Link to="/promo" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Lihat Halaman Promo Publik <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminPromoPage;