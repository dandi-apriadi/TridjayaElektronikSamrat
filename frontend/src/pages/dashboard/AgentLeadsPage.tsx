import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, Filter, MessageCircle, Phone,
  Clock, TrendingUp, CheckCircle2, ArrowUpRight,
  Package, Circle, Plus,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { Link } from 'react-router-dom';

import { useAgentStore } from '../../store/useAgentStore';
import type { Lead } from '../../store/useAgentStore';

const statusConfig: Record<string, { cls: string; dot: string }> = {
  'Follow Up':      { cls: 'bg-primary/15 text-primary',      dot: 'bg-primary' },
  'Negotiation':    { cls: 'bg-tertiary/15 text-tertiary',    dot: 'bg-tertiary' },
  'Payment Pending':{ cls: 'bg-yellow-500/15 text-yellow-400',dot: 'bg-yellow-400' },
  'Cold':           { cls: 'bg-surface-highest text-on-surface-variant', dot: 'bg-on-surface-variant' },
  'Closed Won':     { cls: 'bg-secondary/15 text-secondary',  dot: 'bg-secondary' },
  'Closed Lost':    { cls: 'bg-error/15 text-error',          dot: 'bg-error' },
};

const statuses = ['Semua', 'Follow Up', 'Negotiation', 'Payment Pending', 'Cold', 'Closed Won', 'Closed Lost'];

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AgentLeadsPage: React.FC = () => {
  const { leads, fetchLeads, isLoading } = useAgentStore();
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilter] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filtered = leads.filter((l) => {
    const matchSearch = `${l.customerName} ${l.interestedProduct} ${l.id}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const countByStatus = (s: string) => leads.filter((l) => l.status === s).length;

  if (isLoading && leads.length === 0) {
    return <div className="text-center text-on-surface-variant py-20 animate-pulse font-bold">Memuat data pipeline prospek...</div>;
  }

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Pipeline Management</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" /> Pipeline Prospek
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Kelola dan pantau semua prospek aktif. Lakukan follow-up tepat waktu untuk meningkatkan konversi.
            </p>
          </div>
          <Link
            to="/dashboard/agent/push"
            className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors w-fit"
          >
            <Plus className="w-4 h-4" /> Push Prospek Baru
          </Link>
        </div>
      </motion.div>

      {/* KPI Pipeline */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length, sub: 'semua status', color: 'text-primary', bg: 'bg-primary/10', icon: Users },
          { label: 'Aktif (Follow Up)', value: countByStatus('Follow Up') + countByStatus('Negotiation'), sub: 'perlu tindakan', color: 'text-tertiary', bg: 'bg-tertiary/10', icon: Clock },
          { label: 'Closed Won', value: countByStatus('Closed Won'), sub: 'deal berhasil', color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2 },
          { label: 'Conv. Rate', value: `${leads.length > 0 ? ((countByStatus('Closed Won') / leads.length) * 100).toFixed(0) : 0}%`, sub: 'dari total leads', color: 'text-primary', bg: 'bg-primary/10', icon: TrendingUp },
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

      {/* Pipeline Visual */}
      <motion.div variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
        <h4 className="font-display text-title-sm font-bold text-on-surface mb-4">Distribusi Pipeline</h4>
        <div className="flex items-center gap-2">
          {[
            { s: 'Follow Up', color: 'bg-primary' },
            { s: 'Negotiation', color: 'bg-tertiary' },
            { s: 'Payment Pending', color: 'bg-yellow-400' },
            { s: 'Closed Won', color: 'bg-secondary' },
            { s: 'Cold', color: 'bg-surface-highest' },
            { s: 'Closed Lost', color: 'bg-error' },
          ].map(({ s, color }) => {
            const count = countByStatus(s);
            const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
            if (pct === 0) return null;
            return (
              <div key={s} className={`${color} h-8 rounded-md flex items-center justify-center text-label-xs font-bold text-white/80 transition-all hover:opacity-90`}
                style={{ width: `${pct}%` }} title={`${s}: ${count}`}>
                {pct >= 10 ? `${pct}%` : ''}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          {[
            { s: 'Follow Up', color: 'bg-primary' }, { s: 'Negotiation', color: 'bg-tertiary' },
            { s: 'Payment Pending', color: 'bg-yellow-400' }, { s: 'Closed Won', color: 'bg-secondary' },
            { s: 'Cold', color: 'bg-on-surface-variant' }, { s: 'Closed Lost', color: 'bg-error' },
          ].map(({ s, color }) => (
            <div key={s} className="flex items-center gap-1.5 text-label-xs text-on-surface-variant">
              <Circle className={`w-2 h-2 ${color} fill-current`} />{s} ({countByStatus(s)})
            </div>
          ))}
        </div>
      </motion.div>

      {/* Leads List */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input type="text" placeholder="Cari nama, produk, ID..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
            {statuses.map((s) => (
              <button key={s} type="button" onClick={() => setFilter(s)}
                className={`px-2.5 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {paginated.map((lead: Lead) => {
            const sc = statusConfig[lead.status] || { cls: 'bg-surface-highest', dot: 'bg-on-surface-variant' };
            const waText = encodeURIComponent(`Halo ${lead.customerName}, saya dari Tridjaya Samrat. Saya ingin menindaklanjuti ketertarikan Anda pada ${lead.interestedProduct}. Ada yang bisa saya bantu?`);
            return (
              <div key={lead.id} className="flex flex-col md:flex-row md:items-start gap-4 p-4 rounded-xl border border-outline-variant/10 hover:bg-surface-high/30 transition-colors">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                  {lead.customerName[0]}
                </div>
                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-display font-bold text-on-surface">{lead.customerName}</span>
                    <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${sc.cls}`}>
                      <Circle className={`w-1.5 h-1.5 ${sc.dot} fill-current`} />{lead.status}
                    </span>
                    <span className="text-label-xs text-on-surface-variant">{lead.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-label-xs text-on-surface-variant mb-2">
                    <span className="inline-flex items-center gap-1"><Package className="w-3 h-3" /> {lead.interestedProduct}</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {lead.createdAt}</span>
                  </div>
                  {lead.notes && (
                    <p className="text-body-sm text-on-surface-variant italic">"{lead.notes}"</p>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a href={`https://wa.me/62${lead.phoneNumber.replace(/^0/, '').replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-primary transition-colors" title="WhatsApp">
                    <Phone className="w-4 h-4" />
                  </a>
                  <a href={`https://wa.me/62${lead.phoneNumber.replace(/^0/, '').replace(/\D/g, '')}?text=${waText}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-3 py-2 rounded-lg bg-[#25D366]/15 text-[#25D366] font-semibold text-label-sm inline-flex items-center gap-1.5 hover:bg-[#25D366]/25 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Follow Up
                  </a>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-on-surface-variant text-body-sm py-8">Tidak ada leads yang sesuai filter.</p>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-6 border-t border-outline-variant/10"
        />

        <div className="mt-5 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
          <div className="text-label-sm text-on-surface-variant">
            <strong className="text-on-surface">{filtered.length}</strong> dari {leads.length} leads
          </div>
          <Link to="/dashboard/agent/push" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Push Prospek Baru <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AgentLeadsPage;