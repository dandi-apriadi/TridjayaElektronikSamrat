import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, MessageCircle, Send, Clock, 
  CheckCircle2, Eye, Pause, Smartphone, Database, Trash2, User,
  Loader2, X, Check, Phone, Package, Users
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaCampaign } from '../../types';
import Pagination from '../../components/ui/Pagination';
import { readApiError } from '../../utils/apiError';

const statusConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  draft: { cls: 'bg-surface-high text-on-surface-variant', icon: <Clock className="w-3.5 h-3.5" /> },
  running: { cls: 'bg-primary/20 text-primary border border-primary/30', icon: <Send className="w-3.5 h-3.5" /> },
  paused: { cls: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30', icon: <Pause className="w-3.5 h-3.5" /> },
  completed: { cls: 'bg-secondary/20 text-secondary border border-secondary/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const getCampaignOwnerLabel = (campaign: WaCampaign) => {
  return (
    campaign.createdByName?.trim() ||
    campaign.createdByEmail?.trim() ||
    campaign.createdBy?.trim() ||
    'Tidak diketahui'
  );
};

interface ProspectLead {
  id: string;
  customerName: string;
  phoneNumber: string;
  interestedProduct?: string;
  status?: string;
  createdAt?: string;
}

const AdminWaCampaignsPage: React.FC = () => {
  const { accessToken } = useAuthStore();
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [currentPage, setCurrentPage] = useState(1);
  const [prospectCampaign, setProspectCampaign] = useState<WaCampaign | null>(null);
  const [prospects, setProspects] = useState<ProspectLead[]>([]);
  const [prospectSearch, setProspectSearch] = useState('');
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());
  const [isLoadingProspects, setIsLoadingProspects] = useState(false);
  const [isImportingProspects, setIsImportingProspects] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCampaigns();
  }, [accessToken]);

  const fetchCampaigns = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/wa/campaigns', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      const data = await res.json();
      const items = data.data?.items || data.items || [];
      setCampaigns(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error('Gagal memuat campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = campaigns.filter(c => {
    if (!c) return false;
    const campaignName = (c.name || '').toLowerCase();
    const ownerName = getCampaignOwnerLabel(c).toLowerCase();
    const query = (search || '').toLowerCase();
    const matchSearch = campaignName.includes(query) || ownerName.includes(query);
    const matchStatus = statusFilter === 'semua' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const getProgressPercent = (c: WaCampaign) => {
    const total = c.recipientTotal || 0;
    if (total === 0) return 0;
    const sent = c.recipientSent || 0;
    const skipped = c.recipientSkipped || 0;
    return Math.round(((sent + skipped) / total) * 100);
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!window.confirm(`Hapus campaign "${campaignName}"? Semua data penerima juga akan dihapus.`)) return;
    try {
      const res = await fetch(`/api/wa/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      toast.success('Campaign dihapus');
      fetchCampaigns();
    } catch (error) {
      toast.error('Gagal menghapus campaign', error instanceof Error ? error.message : '');
    }
  };

  const openProspectImporter = async (campaign: WaCampaign) => {
    setProspectCampaign(campaign);
    setProspectSearch('');
    setSelectedProspectIds(new Set());
    await fetchProspects();
  };

  const closeProspectImporter = () => {
    if (isImportingProspects) return;
    setProspectCampaign(null);
    setProspectSearch('');
    setSelectedProspectIds(new Set());
  };

  const fetchProspects = async () => {
    if (!accessToken) return;
    setIsLoadingProspects(true);
    try {
      const res = await fetch('/api/admin/leads', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat prospek'));
      const data = await res.json();
      const items = data.data?.items || data.items || [];
      setProspects(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error('Gagal memuat prospek', error instanceof Error ? error.message : 'Terjadi kesalahan');
      setProspects([]);
    } finally {
      setIsLoadingProspects(false);
    }
  };

  const toggleProspect = (leadId: string) => {
    setSelectedProspectIds((current) => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId); else next.add(leadId);
      return next;
    });
  };

  const filteredProspects = prospects.filter((lead) => {
    const query = prospectSearch.trim().toLowerCase();
    if (!query) return true;
    return `${lead.customerName} ${lead.phoneNumber} ${lead.interestedProduct || ''} ${lead.status || ''}`
      .toLowerCase()
      .includes(query);
  });

  const toggleVisibleProspects = () => {
    const visibleIds = filteredProspects.map((lead) => lead.id);
    if (visibleIds.length === 0) return;
    setSelectedProspectIds((current) => {
      const allVisibleSelected = visibleIds.every((id) => current.has(id));
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (allVisibleSelected) next.delete(id); else next.add(id);
      });
      return next;
    });
  };

  const handleImportProspects = async () => {
    if (!prospectCampaign || selectedProspectIds.size === 0) return;
    setIsImportingProspects(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${prospectCampaign.id}/recipients/from-leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lead_ids: Array.from(selectedProspectIds) }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menarik prospek ke campaign'));
      const data = await res.json().catch(() => null);
      const inserted = data?.data?.inserted ?? 0;
      const skipped = data?.data?.skipped ?? 0;
      toast.success(
        'Prospek ditarik ke campaign',
        `${inserted} penerima ditambahkan${skipped > 0 ? `, ${skipped} duplikat dilewati` : ''}`
      );
      setProspectCampaign(null);
      setProspectSearch('');
      setSelectedProspectIds(new Set());
      await fetchCampaigns();
    } catch (error) {
      toast.error('Gagal menarik prospek', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsImportingProspects(false);
    }
  };

  if (isLoading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-on-surface-variant text-sm">Memuat campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 p-6">
      {/* Page content */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-on-surface">WA Campaign Manager</h1>
        <div className="flex gap-2">
          <Link
            to="/dashboard/admin/wa/blast-contacts"
            className="flex items-center gap-2 px-4 py-2 border border-primary/30 bg-primary/10 rounded-xl hover:bg-primary/20 transition-all text-primary font-bold"
          >
            <Database className="w-4 h-4" />
            <span>Database</span>
          </Link>
          <Link
            to="/dashboard/admin/wa/accounts"
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant/30 rounded-xl hover:bg-surface-high transition-all text-on-surface-variant hover:text-on-surface"
          >
            <Smartphone className="w-4 h-4" />
            <span>Kelola Akun</span>
          </Link>
          <Link
            to="/dashboard/admin/wa/campaign/new"
            className="flex items-center gap-2 px-4 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Campaign</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, icon: <MessageCircle className="w-5 h-5" /> },
          { label: 'Running', value: campaigns.filter(c => c?.status === 'running').length, icon: <Send className="w-5 h-5" /> },
          { label: 'Total Recipients', value: campaigns.reduce((sum, c) => sum + (c?.recipientTotal || 0), 0), icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Sent', value: campaigns.reduce((sum, c) => sum + (c?.recipientSent || 0), 0), icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
        ].map((stat, i) => (
          <motion.div key={i} variants={iv} className="glass-card rounded-2xl p-4 border border-outline-variant/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-body text-on-surface-variant">{stat.label}</p>
                <p className="text-2xl font-display font-bold text-on-surface mt-1">{(stat.value || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="text-primary/60">{stat.icon}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-surface-container/30">
          <div className="flex-1 flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari campaign..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
            >
              <option value="semua">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <button
            onClick={fetchCampaigns}
            disabled={isLoading}
            className="px-4 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-on-surface disabled:opacity-50 transition-all font-bold"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container/50 border-b border-outline-variant/10">
              <tr>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Nama Campaign</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 text-right font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Recipient</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Progress</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Dibuat</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Belum ada campaign
                  </td>
                </tr>
              ) : (
                paginated.map((campaign) => {
                  const progress = getProgressPercent(campaign);
                  const config = statusConfig[campaign.status] || statusConfig.draft;
                  return (
                    <tr key={campaign.id} className="border-b border-outline-variant/5 hover:bg-surface-high/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-on-surface font-medium">{campaign.name}</span>
                          <span className="inline-flex w-fit max-w-[260px] items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-high/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                            <User className="h-3 w-3 shrink-0 text-primary" />
                            <span className="truncate">Milik: {getCampaignOwnerLabel(campaign)}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${config.cls}`}>
                          {config.icon}
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant font-body">{(campaign.recipientTotal || 0).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3">
                        <div className="w-32 bg-surface-highest rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(var(--color-primary),0.3)]"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant mt-1 block font-bold">{progress}%</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-[11px] font-body">
                        {new Date(campaign.createdAt || '').toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/dashboard/admin/wa/campaign/${campaign.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-primary hover:bg-primary/10 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs">Lihat</span>
                          </Link>
                          <button
                            onClick={() => openProspectImporter(campaign)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-secondary hover:bg-secondary/10 rounded transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            <span className="text-xs">Tarik Prospek</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs">Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant/10 bg-surface-container/30">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {prospectCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeProspectImporter}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 18 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 18 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface shadow-2xl"
            >
              <div className="border-b border-outline-variant/10 bg-surface-container/40 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary">Tarik data dari prospek</p>
                    <h2 className="mt-1 text-xl font-display font-bold text-on-surface">{prospectCampaign.name}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Pilih prospek yang akan dimasukkan sebagai penerima WA Blast. Nomor yang sudah ada akan dilewati otomatis.
                    </p>
                  </div>
                  <button
                    onClick={closeProspectImporter}
                    disabled={isImportingProspects}
                    className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface disabled:opacity-50"
                    aria-label="Tutup"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={prospectSearch}
                      onChange={(event) => setProspectSearch(event.target.value)}
                      placeholder="Cari nama, nomor, produk, atau status..."
                      className="w-full rounded-xl border border-outline-variant/30 bg-surface-high/50 py-2.5 pl-9 pr-3 text-sm text-on-surface outline-none transition focus:ring-2 focus:ring-secondary/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleVisibleProspects}
                    disabled={filteredProspects.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-high/50 px-4 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-surface-high hover:text-on-surface disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Pilih Tampilan
                  </button>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto">
                {isLoadingProspects ? (
                  <div className="flex items-center justify-center py-16 text-on-surface-variant">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Memuat prospek...
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <div className="py-16 text-center text-sm text-on-surface-variant">
                    {prospectSearch ? 'Tidak ada prospek yang cocok.' : 'Belum ada data prospek.'}
                  </div>
                ) : (
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="sticky top-0 border-b border-outline-variant/10 bg-surface-container/95 backdrop-blur">
                      <tr>
                        <th className="w-12 px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={filteredProspects.length > 0 && filteredProspects.every((lead) => selectedProspectIds.has(lead.id))}
                            onChange={toggleVisibleProspects}
                            className="h-4 w-4 rounded border-outline-variant/50 accent-primary"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Prospek</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Produk</th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProspects.map((lead) => (
                        <tr
                          key={lead.id}
                          onClick={() => toggleProspect(lead.id)}
                          className={`cursor-pointer border-b border-outline-variant/5 transition-colors hover:bg-surface-high/30 ${
                            selectedProspectIds.has(lead.id) ? 'bg-secondary/5' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedProspectIds.has(lead.id)}
                              onChange={() => toggleProspect(lead.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="h-4 w-4 rounded border-outline-variant/50 accent-primary"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-on-surface">{lead.customerName || '-'}</div>
                            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono text-on-surface-variant">
                              <Phone className="h-3 w-3" />
                              {lead.phoneNumber || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-on-surface-variant">
                            <span className="inline-flex items-center gap-1.5">
                              <Package className="h-3.5 w-3.5 text-primary/70" />
                              {lead.interestedProduct || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-lg border border-outline-variant/20 bg-surface-high/60 px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">
                              {lead.status || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-outline-variant/10 bg-surface-container/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-on-surface-variant">
                  <strong className="text-on-surface">{selectedProspectIds.size}</strong> prospek dipilih dari {filteredProspects.length} tampil
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeProspectImporter}
                    disabled={isImportingProspects}
                    className="rounded-xl border border-outline-variant/30 bg-surface-high/50 px-4 py-2.5 text-sm font-bold text-on-surface-variant transition hover:bg-surface-high hover:text-on-surface disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleImportProspects}
                    disabled={selectedProspectIds.size === 0 || isImportingProspects}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-surface transition hover:shadow-neon-cyan disabled:opacity-50"
                  >
                    {isImportingProspects ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Tarik ke Campaign
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminWaCampaignsPage;
