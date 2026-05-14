import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, RefreshCw, Pause,
  CheckCircle2, AlertTriangle, Clock, Copy, XCircle,
  Plus, Trash2, Check, Eye, FileSpreadsheet, Loader2,
  Database, Search, MessageCircle, ExternalLink, Edit3, Save,
  Image as ImageIcon, Upload
} from 'lucide-react';
import AddWaRecipientModal from '../../components/dashboard/AddWaRecipientModal';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaCampaign, WaRecipient } from '../../types';
import Pagination from '../../components/ui/Pagination';
import { readApiError } from '../../utils/apiError';

const statusColorMap: Record<string, string> = {
  pending: 'bg-surface-high text-on-surface-variant border border-outline-variant/30',
  paused: 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30',
  sent: 'bg-secondary/20 text-secondary border border-secondary/30',
  delivered: 'bg-secondary/15 text-secondary border border-secondary/20',
  read: 'bg-primary/15 text-primary border border-primary/20',
  skipped: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30',
  failed: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

type RecipientFilter = 'all' | 'pending' | 'sent' | 'failed' | 'delivered' | 'read' | 'replied' | 'skipped';

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const getCampaignMediaUrl = (config: Record<string, any> | undefined) => {
  if (!config) return '';
  return (
    config.media_config?.media_url ||
    config.mediaConfig?.mediaUrl ||
    config.mediaConfig?.media_url ||
    config.media_url ||
    config.mediaUrl ||
    ''
  );
};

const AdminWaCampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  const [campaign, setCampaign] = useState<WaCampaign | null>(null);
  const [recipients, setRecipients] = useState<WaRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingCampaign, setIsEditingCampaign] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState('');
  const [editMessageTemplate, setEditMessageTemplate] = useState('');
  const [editDedupeDays, setEditDedupeDays] = useState(30);
  const [editMediaUrl, setEditMediaUrl] = useState('');
  const [editMediaPreview, setEditMediaPreview] = useState('');
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const isEditingCampaignRef = useRef(false);
  const isCampaignEditDirtyRef = useRef(false);
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
  const pendingRecipientCount = recipients.filter((recipient) => recipient.status === 'pending').length;
  const pausedRecipientCount = recipients.filter((recipient) => recipient.status === 'paused').length;
  const resumableRecipientCount = pendingRecipientCount + (campaign?.status === 'paused' ? pausedRecipientCount : 0);
  const canStartCampaign = campaign?.status !== 'running' && resumableRecipientCount > 0;
  const canResetCampaign = Boolean(campaign && campaign.status !== 'running' && recipients.some((recipient) => recipient.status !== 'pending'));

  useEffect(() => {
    isEditingCampaignRef.current = isEditingCampaign;
  }, [isEditingCampaign]);

  const syncCampaignEditFields = (nextCampaign: WaCampaign) => {
    if (isEditingCampaignRef.current || isCampaignEditDirtyRef.current) return;
    const cfg = nextCampaign.config || {};
    setEditCampaignName(nextCampaign.name || '');
    setEditMessageTemplate(cfg.message_template || cfg.messageTemplate || '');
    setEditDedupeDays(Number(cfg.dedupe_days ?? cfg.dedupeDays ?? 30));
    const mediaUrl = getCampaignMediaUrl(cfg);
    setEditMediaUrl(mediaUrl);
    setEditMediaPreview(mediaUrl);
    setEditMediaFile(null);
  };

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
      const nextCampaign = data.data?.campaign || null;
      setCampaign(nextCampaign);
      setRecipients(data.data?.recipients || []);
      if (nextCampaign) syncCampaignEditFields(nextCampaign);
    } catch (error) {
      toast.error('Gagal memuat campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    if (!id) return;
    if (campaign?.status === 'running') {
      toast.info('Campaign sedang berjalan', 'Gunakan Pause Blast jika ingin menghentikan proses sementara.');
      await fetchCampaignData();
      return;
    }
    if (resumableRecipientCount === 0) {
      toast.warning('Tidak ada penerima pending', 'Reset campaign terlebih dahulu jika ingin mengirim ulang penerima yang gagal atau sudah diproses.');
      return;
    }
    
    // If campaign was already completed/paused/failed, confirm restart
    if (campaign?.status && campaign.status !== 'draft') {
      if (!window.confirm('Campaign akan memproses penerima yang masih pending saja. Nomor yang sudah terkirim tidak akan dikirim ulang. Lanjutkan?')) return;
    }

    setIsActionLoading(true);
    console.log('[Campaign] Starting campaign:', id, 'current status:', campaign?.status);
    
    try {
      console.log('[Campaign] Calling start endpoint...');
      const res = await fetch(`/api/wa/campaigns/${id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      const data = await res.json().catch(() => null);
      console.log('[Campaign] Start response:', res.status, data);
      
      if (!res.ok) {
        const errMsg = data?.errors?.join(', ') || data?.message || 'Gagal memulai campaign';
        if (errMsg.toLowerCase().includes('already running')) {
          toast.info('Campaign sedang berjalan', 'Status campaign sudah aktif. Data akan disinkronkan ulang.');
          await fetchCampaignData();
          return;
        }
        console.error('[Campaign] Start failed:', errMsg);
        throw new Error(errMsg);
      }

      if (data?.data?.already_running) {
        toast.info('Campaign sedang berjalan', `${data?.data?.pending ?? pendingRecipientCount} penerima masih pending`);
        await fetchCampaignData();
        return;
      }
      
      const pending = data?.data?.pending || data?.data?.enqueued || 0;
      toast.success(campaign?.status === 'paused' ? 'Campaign dilanjutkan' : 'Campaign dimulai', `${pending} penerima sedang diproses`);
      console.log('[Campaign] Started successfully, pending:', pending);
      await fetchCampaignData();
    } catch (error) {
      console.error('[Campaign] Error:', error);
      toast.error('Gagal memulai campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    if (!window.confirm('Pause blast campaign yang sedang berjalan? Penerima yang belum terkirim akan tetap pending.')) return;

    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/pause`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal pause campaign'));
      const data = await res.json().catch(() => null);
      const removed = data?.data?.removed_from_queue || 0;
      toast.success('Campaign dipause', `${removed} pesan pending dihapus dari queue sementara`);
      await fetchCampaignData();
    } catch (error) {
      toast.error('Gagal pause campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetCampaign = async () => {
    if (!id) return;
    if (!window.confirm('Reset penerima yang sudah diproses menjadi pending lagi? Setelah itu campaign bisa dimulai ulang.')) return;

    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.errors?.join(', ') || data?.message || 'Gagal reset campaign');
      const resetCount = data?.data?.reset_count ?? 0;
      toast.success('Campaign direset', `${resetCount} penerima dikembalikan ke pending`);
      await fetchCampaignData();
    } catch (error) {
      toast.error('Gagal reset campaign', error instanceof Error ? error.message : 'Unknown error');
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
    if (recipientFilter === 'replied') return !!r.repliedAt;
    return r.status === recipientFilter;
  });
  const filterCounts = {
    all: recipients.length,
    pending: recipients.filter(r => r.status === 'pending').length,
    sent: recipients.filter(r => r.status === 'sent').length,
    delivered: recipients.filter(r => !!r.deliveredAt).length,
    read: recipients.filter(r => !!r.readAt).length,
    replied: recipients.filter(r => !!r.repliedAt).length,
    failed: recipients.filter(r => r.status === 'failed').length,
    skipped: recipients.filter(r => r.status === 'skipped').length,
  };

  const handleSaveCampaignEdit = async () => {
    if (!id || !campaign) return;
    if (!editCampaignName.trim()) {
      toast.error('Nama campaign wajib diisi');
      return;
    }
    if (!editMessageTemplate.trim()) {
      toast.error('Isi pesan wajib diisi', 'Template pesan campaign tidak boleh kosong');
      return;
    }

    setIsSavingCampaign(true);
    try {
      let nextMediaUrl = editMediaUrl.trim();
      if (editMediaFile) {
        nextMediaUrl = await uploadCampaignEditImage(editMediaFile);
      }

      const nextConfig = {
        ...(campaign.config || {}),
        message_template: editMessageTemplate.trim(),
        dedupe_days: Math.max(0, Number(editDedupeDays) || 0),
      };
      delete (nextConfig as any).mediaConfig;
      delete (nextConfig as any).media_url;
      delete (nextConfig as any).mediaUrl;
      if (nextMediaUrl) {
        (nextConfig as any).media_config = {
          media_type: 'image',
          media_url: nextMediaUrl,
        };
      } else {
        delete (nextConfig as any).media_config;
      }

      const res = await fetch(`/api/wa/campaigns/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editCampaignName.trim(),
          config: nextConfig,
        }),
      });

      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan campaign'));
      toast.success('Campaign diperbarui', 'Data campaign berhasil disimpan');
      setEditMediaFile(null);
      setEditMediaUrl(nextMediaUrl);
      setEditMediaPreview(nextMediaUrl);
      isEditingCampaignRef.current = false;
      isCampaignEditDirtyRef.current = false;
      setIsEditingCampaign(false);
      await fetchCampaignData();
    } catch (error) {
      toast.error('Gagal menyimpan campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  const uploadCampaignEditImage = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/wa/campaigns/upload-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    if (!res.ok) throw new Error(await readApiError(res, 'Gagal upload gambar campaign'));
    const data = await res.json().catch(() => null);
    const uploadedUrl = data?.data?.url || data?.data?.media_url;
    if (!uploadedUrl) throw new Error('Upload berhasil tetapi URL gambar tidak ditemukan');
    return uploadedUrl as string;
  };

  const handleCampaignImageChange = (file: File | null) => {
    if (!file) {
      markCampaignEditDirty();
      setEditMediaFile(null);
      setEditMediaUrl('');
      setEditMediaPreview('');
      return;
    }

    if (!file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
      toast.error('Format tidak didukung', 'Upload gambar .jpg, .png, atau .webp');
      return;
    }

    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File terlalu besar', `Ukuran file ${(file.size / 1024 / 1024).toFixed(2)}MB melebihi batas 16MB`);
      return;
    }

    markCampaignEditDirty();
    setEditMediaFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setEditMediaPreview(String(event.target?.result || ''));
    reader.readAsDataURL(file);
  };
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const displayRecipientName = (recipient: WaRecipient) => {
    const variables = recipient.variables || {};
    return recipient.name
      || variables.name
      || variables.nama
      || variables.Nama
      || variables.NAMA
      || variables.customer_name
      || variables.customerName
      || 'No Name';
  };

  const getWaChatUrl = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('0')
      ? `62${digits.slice(1)}`
      : digits.startsWith('8')
        ? `62${digits}`
        : digits;
    return `https://wa.me/${normalized}`;
  };

  const openCampaignEditor = () => {
    if (!campaign) return;
    const cfg = campaign.config || {};
    isEditingCampaignRef.current = true;
    isCampaignEditDirtyRef.current = false;
    setEditCampaignName(campaign.name || '');
    setEditMessageTemplate(cfg.message_template || cfg.messageTemplate || '');
    setEditDedupeDays(Number(cfg.dedupe_days ?? cfg.dedupeDays ?? 30));
    const mediaUrl = getCampaignMediaUrl(cfg);
    setEditMediaUrl(mediaUrl);
    setEditMediaPreview(mediaUrl);
    setEditMediaFile(null);
    setIsEditingCampaign(true);
  };

  const closeCampaignEditor = () => {
    isEditingCampaignRef.current = false;
    isCampaignEditDirtyRef.current = false;
    setIsEditingCampaign(false);
  };

  const markCampaignEditDirty = () => {
    isCampaignEditDirtyRef.current = true;
  };

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
            onClick={openCampaignEditor}
            className="flex items-center gap-2 px-4 py-2 bg-surface-high/30 text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-high hover:text-on-surface transition-all font-bold"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Campaign</span>
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
            disabled={isActionLoading || !canStartCampaign}
            title={campaign.status === 'running' ? 'Campaign sedang berjalan' : resumableRecipientCount === 0 ? 'Tidak ada penerima pending' : campaign.status === 'paused' ? 'Lanjutkan campaign' : 'Mulai campaign'}
            className="flex items-center gap-2 px-6 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold disabled:opacity-50"
          >
            {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{campaign.status === 'running' ? 'Sedang Berjalan' : campaign.status === 'paused' ? 'Lanjutkan Blast' : campaign.status === 'draft' ? 'Mulai Campaign' : 'Mulai Pending'}</span>
          </button>
          {canResetCampaign && (
            <button
              onClick={handleResetCampaign}
              disabled={isActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-surface-high/30 text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-high hover:text-on-surface transition-all font-bold disabled:opacity-50"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>Reset Penerima</span>
            </button>
          )}
          {campaign.status === 'running' && (
            <button
              onClick={handlePause}
              disabled={isActionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 rounded-xl hover:bg-yellow-500/20 transition-all font-bold disabled:opacity-50"
            >
              {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
              <span>Pause Blast</span>
            </button>
          )}
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

      <AnimatePresence>
        {isEditingCampaign && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card rounded-2xl border border-primary/20 overflow-hidden"
          >
            <div className="p-4 border-b border-outline-variant/10 bg-primary/5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-display font-bold text-on-surface inline-flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-primary" /> Edit Data Campaign
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">Perubahan pesan berlaku untuk penerima yang belum diproses.</p>
              </div>
              <button
                type="button"
                onClick={closeCampaignEditor}
                className="p-2 rounded-lg bg-surface-high/50 text-on-surface-variant hover:text-on-surface transition-colors"
                title="Tutup editor"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Nama Campaign
                  </label>
                  <input
                    type="text"
                    value={editCampaignName}
                    onChange={(event) => {
                      markCampaignEditDirty();
                      setEditCampaignName(event.target.value);
                    }}
                    className="w-full px-3 py-2.5 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Isi Pesan Campaign
                  </label>
                  <textarea
                    rows={7}
                    value={editMessageTemplate}
                    onChange={(event) => {
                      markCampaignEditDirty();
                      setEditMessageTemplate(event.target.value);
                    }}
                    className="w-full px-3 py-2.5 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface font-mono text-xs resize-y"
                    placeholder="Contoh: Halo {{name}}, promo hari ini..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Gambar Campaign
                  </label>
                  {editMediaPreview ? (
                    <div className="space-y-2">
                      <div className="relative overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-high/40">
                        <img
                          src={editMediaPreview}
                          alt="Preview gambar campaign"
                          className="h-32 w-full object-cover"
                          decoding="async"
                        />
                        <button
                          type="button"
                          onClick={() => handleCampaignImageChange(null)}
                          className="absolute right-2 top-2 rounded-lg border border-red-500/30 bg-red-500/20 p-1.5 text-red-300 transition-colors hover:bg-red-500/30"
                          title="Hapus gambar campaign"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                      {editMediaFile && (
                        <p className="text-[10px] text-primary">
                          Gambar baru akan diupload saat tombol Simpan ditekan.
                        </p>
                      )}
                      <label className="block">
                        <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20">
                          <Upload className="h-3.5 w-3.5" />
                          Ganti Gambar
                        </span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          onChange={(event) => {
                            if (event.target.files?.[0]) handleCampaignImageChange(event.target.files[0]);
                            event.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-high/20 px-3 py-5 text-center transition-colors hover:border-primary/40 hover:bg-primary/5">
                      <ImageIcon className="mb-2 h-7 w-7 text-on-surface-variant/40" />
                      <span className="text-xs font-bold text-primary">Pilih Gambar</span>
                      <span className="mt-1 text-[10px] text-on-surface-variant/50">JPG, PNG, WebP maks 16MB</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(event) => {
                          if (event.target.files?.[0]) handleCampaignImageChange(event.target.files[0]);
                          event.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Dedupe Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editDedupeDays}
                    onChange={(event) => {
                      markCampaignEditDirty();
                      setEditDedupeDays(Number(event.target.value));
                    }}
                    className="w-full px-3 py-2.5 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveCampaignEdit}
                  disabled={isSavingCampaign}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold disabled:opacity-50"
                >
                  {isSavingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>

                <button
                  type="button"
                  onClick={closeCampaignEditor}
                  className="w-full px-4 py-3 bg-surface-high/50 text-on-surface-variant border border-outline-variant/30 rounded-xl hover:text-on-surface transition-all font-bold"
                >
                  Batal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              {[
                { value: 'all', label: 'Semua', count: filterCounts.all },
                { value: 'pending', label: 'Pending', count: filterCounts.pending },
                { value: 'sent', label: 'Sent', count: filterCounts.sent },
                { value: 'delivered', label: 'Delivered', count: filterCounts.delivered },
                { value: 'read', label: 'Read', count: filterCounts.read },
                { value: 'replied', label: 'Reply', count: filterCounts.replied },
                { value: 'failed', label: 'Gagal', count: filterCounts.failed },
              ].map(item => (
                <button
                  key={item.value}
                  onClick={() => {
                    setRecipientFilter(item.value as typeof recipientFilter);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    recipientFilter === item.value
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-surface-high/30 text-on-surface-variant border-outline-variant/30 hover:bg-surface-high hover:text-on-surface'
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
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
                <option value="replied">Membalas (Reply)</option>
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
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    No recipients found
                  </td>
                </tr>
              ) : (
                paginated.map((recipient) => (
                  <tr key={recipient.id} className="border-b border-outline-variant/5 hover:bg-surface-high/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-on-surface text-body-sm">{displayRecipientName(recipient)}</div>
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
                        {recipient.repliedAt && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-green-500/15 text-green-400 border border-green-500/20">
                            <MessageCircle className="w-3 h-3" />
                            Reply
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
                         {recipient.repliedAt ? ` • Reply: ${new Date(recipient.repliedAt).toLocaleString('id-ID')}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={getWaChatUrl(recipient.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-green-500/10 rounded-lg text-on-surface-variant hover:text-green-400 transition-colors"
                          title="Buka chat WhatsApp"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
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
