import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, Copy, XCircle,
  Plus, Trash2, Check, Eye, FileSpreadsheet, Loader2,
  Database, Search
} from 'lucide-react';
import AddWaRecipientModal from '../../components/dashboard/AddWaRecipientModal';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaCampaign, WaRecipient } from '../../types';
import Pagination from '../../components/ui/Pagination';
import { readApiError } from '../../utils/apiError';

const statusColorMap: Record<string, string> = {
  pending: 'bg-surface-high text-on-surface-variant border border-outline-variant/30',
  sent: 'bg-secondary/20 text-secondary border border-secondary/30',
  skipped: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const AdminWaCampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  const [campaign, setCampaign] = useState<WaCampaign | null>(null);
  const [recipients, setRecipients] = useState<WaRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'pending' | 'sent' | 'failed' | 'delivered' | 'read'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Database contacts state
  const [showDbContacts, setShowDbContacts] = useState(false);
  const [dbContacts, setDbContacts] = useState<Array<{ id: string; phone: string; name: string; labels: string }>>([]);
  const [dbTotal, setDbTotal] = useState(0);
  const [dbSearch, setDbSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);
  const [dbSelectedIds, setDbSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const dbPerPage = 15;

  useEffect(() => {
    if (id) {
      fetchCampaignData();
      const interval = setInterval(() => fetchCampaignData(), 5000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const fetchCampaignData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/status`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat campaign'));
      const data = await res.json();
      setCampaign(data.data?.campaign || null);
      setRecipients(data.data?.recipients || []);
    } catch (error) {
      toast.error('Gagal memuat campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    if (!id) return;
    
    // If campaign was already completed/paused/failed, confirm restart
    if (campaign?.status && campaign.status !== 'draft') {
      if (!window.confirm('Campaign ini akan dimulai ulang dari awal. Semua penerima yang belum terkirim akan diproses. Lanjutkan?')) return;
    }

    setIsActionLoading(true);
    console.log('[Campaign] Starting campaign:', id, 'current status:', campaign?.status);
    
    try {
      // If campaign is completed/paused/running, reset recipients to pending first
      if (campaign?.status === 'completed' || campaign?.status === 'paused' || campaign?.status === 'running') {
        console.log('[Campaign] Resetting recipients to pending...');
        const resetRes = await fetch(`/api/wa/campaigns/${id}/reset`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!resetRes.ok) {
          const errMsg = await readApiError(resetRes, 'Gagal reset recipients');
          console.error('[Campaign] Reset failed:', errMsg);
          // Try to start anyway — backend might handle it
        } else {
          const resetData = await resetRes.json().catch(() => null);
          console.log('[Campaign] Reset result:', resetData);
        }
      }

      console.log('[Campaign] Calling start endpoint...');
      const res = await fetch(`/api/wa/campaigns/${id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      const data = await res.json().catch(() => null);
      console.log('[Campaign] Start response:', res.status, data);
      
      if (!res.ok) {
        const errMsg = data?.errors?.join(', ') || data?.message || 'Gagal memulai campaign';
        console.error('[Campaign] Start failed:', errMsg);
        throw new Error(errMsg);
      }
      
      const pending = data?.data?.pending || data?.data?.enqueued || 0;
      toast.success('Campaign dimulai', `${pending} penerima sedang diproses`);
      console.log('[Campaign] Started successfully, pending:', pending);
      await fetchCampaignData();
    } catch (error) {
      console.error('[Campaign] Error:', error);
      toast.error('Gagal memulai campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    if (!window.confirm('Hapus penerima ini?')) return;
    try {
      const res = await fetch(`/api/wa/recipients/${recipientId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus penerima'));
      toast.success('Penerima dihapus');
      fetchCampaignData();
    } catch (error) {
      toast.error('Gagal menghapus penerima', error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus');
    }
  };

  const handleUploadExcel = async (file: File) => {
    if (!id) return;
    const validExt = file.name.match(/\.(xlsx|xls|csv)$/i);
    if (!validExt) {
      toast.error('Format tidak didukung', 'Upload file Excel (.xlsx, .xls) atau CSV (.csv)');
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/recipients/upload-excel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Gagal upload file'));
      }
      const data = await res.json().catch(() => null);
      const ins = data?.data?.inserted || 0;
      const skip = data?.data?.skipped || 0;
      const inv = data?.data?.invalid?.length || 0;
      let msg = `${ins} recipients ditambahkan`;
      if (skip > 0) msg += `, ${skip} di-skip (duplikat)`;
      if (inv > 0) msg += `, ${inv} nomor invalid`;
      toast.success('Import berhasil', msg);
      fetchCampaignData();
    } catch (error) {
      toast.error('Gagal upload', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!id) return;
    if (!window.confirm('Hapus campaign ini beserta semua data penerima? Tindakan ini tidak bisa dibatalkan.')) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus campaign'));
      toast.success('Campaign dihapus');
      navigate('/dashboard/admin/wa/campaigns');
    } catch (error) {
      toast.error('Gagal menghapus', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Database contacts functions
  const fetchDbContacts = async () => {
    setIsLoadingDb(true);
    try {
      const params = new URLSearchParams({ page: String(dbPage), per_page: String(dbPerPage) });
      if (dbSearch.trim()) params.set('search', dbSearch.trim());
      const res = await fetch(`/api/wa/blast-contacts?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat database kontak'));
      const data = await res.json();
      setDbContacts(data.data?.items || []);
      setDbTotal(data.data?.total || 0);
    } catch (error) {
      toast.error('Gagal memuat database kontak', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (showDbContacts) fetchDbContacts();
  }, [showDbContacts, dbPage, dbSearch]);

  const toggleDbSelect = (contactId: string) => {
    const next = new Set(dbSelectedIds);
    if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
    setDbSelectedIds(next);
  };

  const toggleDbSelectAll = () => {
    if (dbSelectedIds.size === dbContacts.length) {
      setDbSelectedIds(new Set());
    } else {
      setDbSelectedIds(new Set(dbContacts.map(c => c.id)));
    }
  };

  const selectAllDb = () => {
    // Select all contacts (not just current page)
    setDbSelectedIds(new Set(['__ALL__']));
  };

  const handleImportSelected = async () => {
    if (!id) return;
    if (dbSelectedIds.size === 0) {
      toast.error('Pilih kontak', 'Pilih minimal satu kontak untuk di-import');
      return;
    }
    setIsImporting(true);
    try {
      const isAll = dbSelectedIds.has('__ALL__');
      const body = isAll
        ? { all: true }
        : { contact_ids: Array.from(dbSelectedIds) };

      const res = await fetch(`/api/wa/blast-contacts/import-to-campaign/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal import'));
      const data = await res.json();
      const ins = data.data?.inserted || 0;
      const skip = data.data?.skipped || 0;
      toast.success('Import berhasil', `${ins} penerima ditambahkan${skip > 0 ? `, ${skip} di-skip` : ''}`);
      setDbSelectedIds(new Set());
      fetchCampaignData();
    } catch (error) {
      toast.error('Gagal import', error instanceof Error ? error.message : '');
    } finally {
      setIsImporting(false);
    }
  };

  const dbTotalPages = Math.ceil(dbTotal / dbPerPage);

  const filtered = recipients.filter(r => {
    if (recipientFilter === 'all') return true;
    if (recipientFilter === 'delivered') return !!r.deliveredAt;
    if (recipientFilter === 'read') return !!r.readAt;
    return r.status === recipientFilter;
  });
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  if (!campaign) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/dashboard/admin/wa/campaigns')}
          className="flex items-center gap-2 text-primary hover:text-primary/80 transition-all font-bold mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        <div className="text-center py-12 glass-card rounded-3xl border border-outline-variant/10">
          <p className="text-on-surface-variant font-body">{isLoading ? 'Loading...' : 'Campaign not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/admin/wa/campaigns')}
            className="p-2 hover:bg-surface-high rounded-xl transition-all text-on-surface-variant hover:text-on-surface border border-outline-variant/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-on-surface">{campaign.name}</h1>
            <p className="text-sm font-body text-on-surface-variant mt-1">
              Created {new Date(campaign.createdAt || '').toLocaleDateString('id-ID')} by <span className="text-primary font-bold">{campaign.createdBy || 'System'}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchCampaignData}
            disabled={isLoading}
            className="p-2 bg-surface-high/30 hover:bg-surface-high rounded-xl transition-all text-on-surface-variant hover:text-on-surface border border-outline-variant/10 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary border border-secondary/30 rounded-xl hover:bg-secondary/20 transition-all font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Penerima</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/30 rounded-xl hover:bg-primary/20 transition-all font-bold disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            <span>Import Excel</span>
          </button>
          <button
            onClick={() => setShowDbContacts(!showDbContacts)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all font-bold ${showDbContacts ? 'bg-secondary/20 text-secondary border-secondary/30' : 'bg-surface-high/30 text-on-surface-variant border-outline-variant/30 hover:bg-surface-high hover:text-on-surface'}`}
          >
            <Database className="w-4 h-4" />
            <span>Database</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              if (e.target.files?.[0]) handleUploadExcel(e.target.files[0]);
              e.target.value = '';
            }}
            className="hidden"
          />
          <button
            onClick={handleStart}
            disabled={isActionLoading}
            className="flex items-center gap-2 px-6 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold disabled:opacity-50"
          >
            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{campaign.status === 'draft' ? 'Mulai Campaign' : campaign.status === 'running' ? 'Restart' : 'Start Ulang'}</span>
          </button>
          <button
            onClick={handleDeleteCampaign}
            disabled={isActionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/20 transition-all font-bold disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Recipients',
            value: campaign.recipientTotal,
            icon: <Clock className="w-5 h-5" />,
          },
          {
            label: 'Sent',
            value: campaign.recipientSent,
            icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          },
          {
            label: 'Skipped',
            value: campaign.recipientSkipped,
            icon: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
          },
          {
            label: 'Failed',
            value: campaign.recipientFailed,
            icon: <XCircle className="w-5 h-5 text-red-600" />,
          },
        ].map((stat, i) => (
          <motion.div key={i} variants={iv} className="glass-card rounded-2xl p-4 border border-outline-variant/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-body text-on-surface-variant">{stat.label}</p>
                <p className="text-2xl font-display font-bold text-on-surface mt-1">{(stat.value || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="mt-1">{stat.icon}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Database Contacts Panel */}
      <AnimatePresence>
        {showDbContacts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-2xl border border-secondary/20 overflow-hidden">
              <div className="p-4 border-b border-outline-variant/10 bg-secondary/5">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-secondary" />
                    <h2 className="text-lg font-display font-bold text-on-surface">Database Kontak</h2>
                    <span className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full border border-secondary/20">
                      {dbTotal} kontak
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-on-surface-variant" />
                      <input
                        type="text"
                        placeholder="Cari..."
                        value={dbSearch}
                        onChange={e => { setDbSearch(e.target.value); setDbPage(1); }}
                        className="pl-8 pr-3 py-1.5 bg-surface-high/50 border border-outline-variant/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary/20 text-on-surface text-xs w-40"
                      />
                    </div>
                    {dbSelectedIds.size > 0 && (
                      <button
                        onClick={handleImportSelected}
                        disabled={isImporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 gradient-primary text-surface rounded-lg hover:shadow-neon-cyan transition-all font-bold text-xs disabled:opacity-50"
                      >
                        {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Import {dbSelectedIds.has('__ALL__') ? `Semua (${dbTotal})` : `(${dbSelectedIds.size})`}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Select All / Select Page controls */}
              <div className="px-4 py-2 bg-surface-container/30 border-b border-outline-variant/10 flex items-center gap-3">
                <button
                  onClick={toggleDbSelectAll}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    dbSelectedIds.size === dbContacts.length && dbContacts.length > 0
                      ? 'bg-secondary/20 text-secondary border-secondary/30'
                      : 'bg-surface-high/50 text-on-surface-variant border-outline-variant/30 hover:bg-surface-high'
                  }`}
                >
                  {dbSelectedIds.size === dbContacts.length && dbContacts.length > 0 ? '✓ Halaman ini' : 'Pilih Halaman'}
                </button>
                <button
                  onClick={selectAllDb}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    dbSelectedIds.has('__ALL__')
                      ? 'bg-primary/20 text-primary border-primary/30'
                      : 'bg-surface-high/50 text-on-surface-variant border-outline-variant/30 hover:bg-surface-high'
                  }`}
                >
                  {dbSelectedIds.has('__ALL__') ? `✓ Semua (${dbTotal})` : `Pilih Semua (${dbTotal})`}
                </button>
                {dbSelectedIds.size > 0 && !dbSelectedIds.has('__ALL__') && (
                  <span className="text-[10px] text-on-surface-variant">{dbSelectedIds.size} terpilih</span>
                )}
              </div>

              {/* Contacts list */}
              <div className="max-h-[350px] overflow-y-auto">
                {isLoadingDb ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                  </div>
                ) : dbContacts.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant text-sm">
                    {dbSearch ? 'Tidak ditemukan' : 'Belum ada kontak di database. Tambahkan di menu Database.'}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-surface-container/50 border-b border-outline-variant/10 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left w-10">
                          <input
                            type="checkbox"
                            checked={!dbSelectedIds.has('__ALL__') && dbSelectedIds.size === dbContacts.length && dbContacts.length > 0}
                            onChange={toggleDbSelectAll}
                            className="rounded border-outline-variant/50"
                          />
                        </th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Nomor</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Nama</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Label</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbContacts.map(c => (
                        <tr
                          key={c.id}
                          className={`border-b border-outline-variant/5 hover:bg-surface-high/20 transition-colors cursor-pointer ${
                            dbSelectedIds.has(c.id) || dbSelectedIds.has('__ALL__') ? 'bg-secondary/5' : ''
                          }`}
                          onClick={() => !dbSelectedIds.has('__ALL__') && toggleDbSelect(c.id)}
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={dbSelectedIds.has(c.id) || dbSelectedIds.has('__ALL__')}
                              onChange={() => !dbSelectedIds.has('__ALL__') && toggleDbSelect(c.id)}
                              className="rounded border-outline-variant/50"
                            />
                          </td>
                          <td className="px-4 py-2 font-mono text-on-surface text-xs">{c.phone}</td>
                          <td className="px-4 py-2 text-on-surface font-medium text-xs">{c.name || '-'}</td>
                          <td className="px-4 py-2 text-on-surface-variant text-[10px]">{c.labels || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {dbTotalPages > 1 && (
                <div className="p-3 border-t border-outline-variant/10 bg-surface-container/30">
                  <Pagination currentPage={dbPage} totalPages={dbTotalPages} onPageChange={setDbPage} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/10 bg-surface-container/30">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-lg font-display font-bold text-on-surface">Recipients ({filtered.length})</h2>
            <div className="flex gap-2">
              <select
                value={recipientFilter}
                onChange={e => {
                  setRecipientFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="sent">Terkirim (Sent)</option>
                <option value="delivered">Diterima (Delivered)</option>
                <option value="read">Dibaca (Read)</option>
                <option value="failed">Gagal</option>
                <option value="skipped">Dilewati</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container/50 border-b border-outline-variant/10">
              <tr>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Nama & WhatsApp</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Tracking</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No recipients found
                  </td>
                </tr>
              ) : (
                paginated.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-outline-variant/5 hover:bg-surface-high/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-on-surface text-body-sm">{recipient.variables.name || 'No Name'}</div>
                      <div className="text-[10px] text-on-surface-variant font-mono">{recipient.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${statusColorMap[recipient.status]}`}>
                          {recipient.status === 'sent' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {recipient.status}
                        </div>
                        {recipient.deliveredAt && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-secondary/15 text-secondary border border-secondary/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Delivered
                          </div>
                        )}
                        {recipient.readAt && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-primary/15 text-primary border border-primary/20 shadow-[0_0_8px_rgba(var(--color-primary),0.2)]">
                            <Eye className="w-3 h-3" />
                            Read
                          </div>
                        )}
                        {recipient.lastError && (
                          <div className="text-[9px] text-red-400 font-medium italic mt-1 block max-w-[150px] truncate" title={recipient.lastError}>
                            {recipient.lastError}
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-[9px] text-on-surface-variant">
                         Sent: {recipient.lastAttemptAt ? new Date(recipient.lastAttemptAt).toLocaleString('id-ID') : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const vars = JSON.stringify(recipient.variables, null, 2);
                            navigator.clipboard.writeText(vars);
                            toast.success('Copied', 'Variables copied to clipboard');
                          }}
                          className="p-1.5 hover:bg-surface-high rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
                          title="View Variables"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecipient(recipient.id)}
                          className="p-1.5 hover:bg-error/10 rounded-lg text-on-surface-variant hover:text-error transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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

      <AddWaRecipientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        campaignId={id || ''}
        onSuccess={fetchCampaignData}
      />
    </motion.div>
  );
};

export default AdminWaCampaignDetailPage;
