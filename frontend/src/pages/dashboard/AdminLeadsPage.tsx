import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, Filter, Phone,
  Clock, TrendingUp, CheckCircle2,
  Package, ExternalLink, User,
  Calendar, RefreshCcw
} from 'lucide-react';

import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { toast } from '../../store/useNotificationStore';
import Pagination from '../../components/ui/Pagination';
import { useSearchParams } from 'react-router-dom';

const statusConfig: Record<string, { cls: string; dot: string }> = {
  'Follow Up':      { cls: 'bg-primary/15 text-primary',      dot: 'bg-primary' },
  'Negotiation':    { cls: 'bg-tertiary/15 text-tertiary',    dot: 'bg-tertiary' },
  'Payment Pending':{ cls: 'bg-yellow-500/15 text-yellow-400',dot: 'bg-yellow-400' },
  'Cold':           { cls: 'bg-surface-highest text-on-surface-variant', dot: 'bg-on-surface-variant' },
  'Closed Won':     { cls: 'bg-secondary/15 text-secondary',  dot: 'bg-secondary' },
  'Closed Lost':    { cls: 'bg-error/15 text-error',          dot: 'bg-error' },
};

const statuses = ['Semua', 'Follow Up', 'Negotiation', 'Payment Pending', 'Cold', 'Closed Won', 'Closed Lost'];

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const AdminLeadsPage: React.FC = () => {
  const { leads, fetchLeads, updateLeadStatus, isLoading } = useAdminNetworkStore();
  const [searchParams]            = useSearchParams();
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('Semua');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setSearch(id);
    }
  }, [searchParams]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLeads();
    setIsRefreshing(false);
    toast.success('Data diperbarui');
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const success = await updateLeadStatus(id, newStatus);
    if (success) {
      toast.success('Status Berhasil Diperbarui');
    }
  };

  const filtered = leads.filter((l) => {
    const matchSearch = `${l.customerName} ${l.interestedProduct} ${l.agentName || ''} ${l.id}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const countByStatus = (s: string) => leads.filter((l) => l.status === s).length;

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 pb-10">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Global Pipeline Monitor</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" /> Manajemen Prospek
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Pantau performa pipeline seluruh agen secara real-time. Pastikan tidak ada prospek yang terbengkalai.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Sinkronkan Data
          </button>
        </div>
      </motion.div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Prospek', value: leads.length, sub: 'lintas seluruh agen', color: 'text-primary', bg: 'bg-primary/10', icon: Users },
          { label: 'Pipeline Aktif', value: countByStatus('Follow Up') + countByStatus('Negotiation'), sub: 'sedang diproses', color: 'text-tertiary', bg: 'bg-tertiary/10', icon: Clock },
          { label: 'Deal Berhasil', value: countByStatus('Closed Won'), sub: 'konversi sukses', color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2 },
          { label: 'Avg. Conv. Rate', value: `${leads.length > 0 ? ((countByStatus('Closed Won') / leads.length) * 100).toFixed(1) : 0}%`, sub: 'performa global', color: 'text-primary', bg: 'bg-primary/10', icon: TrendingUp },
        ].map((k) => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 border border-outline-variant/10 shadow-sm">
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
            <div className="text-label-xs text-on-surface-variant mt-0.5">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden border border-outline-variant/10 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input type="text" placeholder="Cari nama pembeli, produk, atau agen..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            {statuses.map((s) => (
              <button key={s} type="button" onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Pipeline Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-widest">
                <th className="py-3 px-4">Calon Pembeli</th>
                <th className="py-3 px-4">Produk Diminati</th>
                <th className="py-3 px-4">Agen Pengelola</th>
                <th className="py-3 px-4">Status Pipeline</th>
                <th className="py-3 px-4">Tanggal Masuk</th>
                <th className="py-3 px-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((lead) => {
                const sc = statusConfig[lead.status] || { cls: 'bg-surface-highest', dot: 'bg-on-surface-variant' };
                return (
                  <tr key={lead.id} className="border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors group">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-bold text-on-primary text-xs">
                          {lead.customerName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-on-surface text-body-sm">{lead.customerName}</div>
                          <div className="text-[10px] text-on-surface-variant flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" /> {lead.phoneNumber}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-body-sm font-medium text-on-surface">
                        <Package className="w-4 h-4 text-primary/60" /> {lead.interestedProduct}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-body-sm text-on-surface">
                        <User className="w-4 h-4 text-secondary/60" /> 
                        <div>
                           <div className="font-semibold">{lead.agentName || 'N/A'}</div>
                           <div className="text-[10px] text-on-surface-variant">{lead.agentId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <select 
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-label-xs font-bold outline-none border border-transparent focus:border-primary/40 appearance-none cursor-pointer ${sc.cls}`}
                      >
                        {statuses.filter(s => s !== 'Semua').map(s => (
                          <option key={s} value={s} className="bg-surface text-on-surface">{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-body-sm text-on-surface-variant flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {lead.createdAt}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                          <a href={`https://wa.me/62${lead.phoneNumber.replace(/^0/, '').replace(/\D/g, '')}`} 
                            target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-primary transition-colors" title="WhatsApp">
                            <Phone className="w-4 h-4" />
                          </a>
                         <button className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-secondary transition-colors" title="Lihat Detail">
                           <ExternalLink className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant text-body-sm italic">
                    {isLoading ? 'Sedang memuat...' : 'Tidak ada prospek yang ditemukan.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-4 border-t border-outline-variant/10"
        />
      </motion.div>
    </motion.div>
  );
};

export default AdminLeadsPage;
