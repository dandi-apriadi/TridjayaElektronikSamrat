import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Send, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, Copy, XCircle,
  Plus, Trash2, Check, Eye, FileSpreadsheet, Loader2
} from 'lucide-react';
import AddWaRecipientModal from '../../components/dashboard/AddWaRecipientModal';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaCampaign, WaRecipient } from '../../types';
import Pagination from '../../components/ui/Pagination';

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
      if (!res.ok) throw new Error('Failed to fetch campaign');
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
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = data?.errors?.join(', ') || data?.message || 'Failed to start campaign';
        throw new Error(errMsg);
      }
      const enqueued = data?.data?.enqueued || 0;
      toast.success('Campaign dimulai', `${enqueued} penerima sedang diproses`);
      await fetchCampaignData();
    } catch (error) {
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
      if (!res.ok) throw new Error('Gagal menghapus');
      toast.success('Penerima dihapus');
      fetchCampaignData();
    } catch (error) {
      toast.error('Gagal', 'Terjadi kesalahan saat menghapus');
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
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = data?.errors?.join(', ') || data?.message || 'Gagal upload file';
        throw new Error(errMsg);
      }
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
          {campaign.status === 'draft' && (
            <button
              onClick={handleStart}
              disabled={isActionLoading}
              className="flex items-center gap-2 px-6 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Mulai Campaign</span>
            </button>
          )}
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
                        {recipient.status === 'failed' && (
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
