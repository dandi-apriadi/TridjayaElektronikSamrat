import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Upload, Plus, Trash2,
  FileUp, Download, FileSpreadsheet,
  MessageSquare, Users, Smartphone, ChevronRight,
  Lock, Phone, Loader2, CheckCircle2, Info, Image as ImageIcon, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import { readApiError } from '../../utils/apiError';

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

interface ManualRecipient {
  id: string;
  phone: string;
  name: string;
}

interface WaAccount {
  id: string;
  name: string;
  enabled: boolean;
  status: string | null;
  phoneNumber: string | null;
}

const AdminWaCampaignFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { accessToken } = useAuthStore();
  const isNew = !id || id === 'new';

  // Campaign fields
  const [campaignName, setCampaignName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dedupeDays, setDedupeDays] = useState(30);
  const [manualRecipients, setManualRecipients] = useState<ManualRecipient[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  
  // Media upload fields
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // WA Accounts
  const [waAccounts, setWaAccounts] = useState<WaAccount[]>([]);

  // Recipient stats
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    fetchWaAccounts();
    if (!isNew) {
      fetchCampaign();
    }
  }, [id]);

  const fetchWaAccounts = async () => {
    try {
      const res = await fetch('/api/wa/accounts', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data.data?.items || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        enabled: a.enabled,
        status: a.status,
        phoneNumber: a.phoneNumber || a.phone_number,
      }));
      setWaAccounts(items);
    } catch { /* ignore */ }
  };

  const fetchCampaign = async () => {
    if (isNew) return;
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/status`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat campaign'));
      const data = await res.json();
      const c = data.data?.campaign;
      if (c) {
        setCampaignName(c.name);
        const cfg = c.config || {};
        setMessageTemplate(cfg.message_template || '');
        setDedupeDays(cfg.dedupe_days ?? 30);
        if (cfg.accounts?.length > 0) setSelectedAccountId(cfg.accounts[0]);
        setRecipientCount(c.recipient_total ?? c.totalRecipients ?? 0);
        
        // Load media if exists
        if (cfg.media_config?.media_url) {
          setMediaUrl(cfg.media_config.media_url);
          setMediaPreview(cfg.media_config.media_url);
        }
      }
    } catch (error) {
      toast.error('Gagal memuat campaign', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const buildConfig = (nextMediaUrl = mediaUrl) => {
    const cfg: any = {};
    if (messageTemplate.trim()) cfg.message_template = messageTemplate;
    if (selectedAccountId) cfg.accounts = [selectedAccountId];
    cfg.dedupe_days = dedupeDays;
    
    // Add media configuration if image is uploaded
    if (nextMediaUrl) {
      cfg.media_config = {
        media_type: 'image',
        media_url: nextMediaUrl,
      };
    }
    
    return cfg;
  };

  const handleSaveCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Nama campaign wajib diisi', 'Masukkan nama campaign untuk melanjutkan');
      return;
    }

    setIsSaving(true);
    try {
      let nextMediaUrl = mediaUrl;
      if (mediaFile) {
        nextMediaUrl = await uploadMediaFile(mediaFile);
        setMediaUrl(nextMediaUrl);
        setMediaPreview(nextMediaUrl);
        setMediaFile(null);
      }

      const url = isNew ? '/api/wa/campaigns' : `/api/wa/campaigns/${id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName,
          config: buildConfig(nextMediaUrl),
        }),
      });

      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan campaign'));
      const data = await res.json();
      const newId = data.data?.item?.id || data.data?.id;

      toast.success('Berhasil', 'Campaign tersimpan');
      if (isNew && newId) {
        navigate(`/dashboard/admin/wa/campaign/${newId}`, { replace: true });
      } else if (isNew) {
        toast.error('Campaign tersimpan tapi ID tidak ditemukan');
      } else {
        fetchCampaign();
      }
    } catch (error) {
      toast.error('Gagal menyimpan campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualRecipient = () => {
    const phone = newPhone.trim();
    if (!phone) {
      toast.error('Nomor wajib diisi', 'Masukkan nomor telepon penerima');
      return;
    }
    if (manualRecipients.some(r => r.phone === phone)) {
      toast.error('Duplikat', 'Nomor ini sudah ada di daftar');
      return;
    }
    setManualRecipients([
      ...manualRecipients,
      { id: `manual-${Date.now()}`, phone, name: newName.trim() },
    ]);
    setNewPhone('');
    setNewName('');
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/wa/recipients/template', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal download template'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wa_recipients_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Gagal download template', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleImportFromDatabase = async () => {
    if (isNew) {
      toast.error('Simpan campaign dulu', 'Simpan campaign terlebih dahulu');
      return;
    }
    setIsUploading(true);
    try {
      const res = await fetch(`/api/wa/blast-contacts/import-to-campaign/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal import dari database'));
      const data = await res.json();
      const ins = data.data?.inserted || 0;
      const skip = data.data?.skipped || 0;
      toast.success('Import berhasil', `${ins} penerima ditambahkan${skip > 0 ? `, ${skip} di-skip (duplikat)` : ''}`);
      fetchCampaign();
    } catch (error) {
      toast.error('Gagal import', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadRecipients = async (file: File) => {
    if (isNew) {
      toast.error('Simpan campaign dulu', 'Simpan campaign terlebih dahulu sebelum upload penerima');
      return;
    }
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
      let msg = `${ins} penerima ditambahkan`;
      if (skip > 0) msg += `, ${skip} di-skip (duplikat)`;
      if (inv > 0) msg += `, ${inv} nomor invalid`;
      toast.success('Import berhasil', msg);
      fetchCampaign();
    } catch (error) {
      toast.error('Gagal upload penerima', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleMediaChange = (file: File | null) => {
    if (!file) {
      setMediaFile(null);
      setMediaPreview('');
      return;
    }

    // Validate file type and size
    const validExt = file.name.match(/\.(jpg|jpeg|png|webp)$/i);
    if (!validExt) {
      toast.error('Format tidak didukung', 'Upload file gambar (.jpg, .png, .webp) dengan ukuran maksimal 16MB');
      return;
    }

    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      toast.error('File terlalu besar', `Ukuran file ${(file.size / 1024 / 1024).toFixed(2)}MB melebihi batas 16MB`);
      return;
    }

    setMediaFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadMediaFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/wa/campaigns/upload-image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, 'Gagal upload gambar'));
    }
    const data = await res.json();
    const uploadedUrl = data.data?.url || data.data?.media_url;
    if (!uploadedUrl) throw new Error('Upload berhasil tetapi URL gambar tidak ditemukan');
    return uploadedUrl as string;
  };

  const handleUploadMedia = async () => {
    if (!mediaFile) return;
    
    setIsUploadingMedia(true);
    try {
      const uploadedUrl = await uploadMediaFile(mediaFile);
      setMediaUrl(uploadedUrl);
      setMediaPreview(uploadedUrl);
      setMediaFile(null);
      toast.success('Gambar berhasil diupload');
    } catch (error) {
      toast.error('Gagal upload gambar', error instanceof Error ? error.message : 'Unknown error');
      setMediaPreview('');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleRemoveMedia = () => {
    setMediaUrl('');
    setMediaFile(null);
    setMediaPreview('');
  };

  const handleUploadManualRecipients = async () => {
    if (isNew) {
      toast.error('Simpan campaign dulu', 'Simpan campaign terlebih dahulu');
      return;
    }
    if (manualRecipients.length === 0) return;

    setIsUploading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/recipients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: manualRecipients.map(r => ({
            phone: r.phone,
            variables: r.name ? { name: r.name } : {},
          })),
        }),
      });

      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan penerima'));
      const data = await res.json();
      toast.success('Berhasil', `${data.data?.addedCount || manualRecipients.length} penerima ditambahkan`);
      setManualRecipients([]);
      fetchCampaign();
    } catch (error) {
      toast.error('Gagal upload penerima', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  const savedCampaign = !isNew;
  const connectedAccounts = waAccounts.filter(a => a.enabled);

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/admin/wa/campaigns')}
          className="p-2 hover:bg-surface-high rounded-xl transition-all text-on-surface-variant hover:text-on-surface border border-outline-variant/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-on-surface">
            {isNew ? 'Buat Campaign Baru' : 'Edit Campaign'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Atur pesan, pilih akun pengirim, dan tambahkan penerima</p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2 text-xs font-bold">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${campaignName.trim() ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
          {campaignName.trim() ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 flex items-center justify-center text-[10px] rounded-full bg-primary/20">1</span>}
          Detail Campaign
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/30" />
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${savedCampaign && recipientCount > 0 ? 'bg-green-500/15 text-green-400 border border-green-500/20' : savedCampaign ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-high/50 text-on-surface-variant/40 border border-outline-variant/10'}`}>
          {savedCampaign && recipientCount > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 flex items-center justify-center text-[10px] rounded-full bg-current/10">2</span>}
          Penerima ({recipientCount})
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* === SECTION 1: Campaign Details === */}
          <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 p-6">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-display font-bold text-on-surface">Detail Campaign</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Nama Campaign *
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="contoh: Promo Flash Sale Juni"
                  className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40"
                />
              </div>

              {/* WA Account Selector */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Akun WhatsApp Pengirim
                </label>
                {connectedAccounts.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                    <Smartphone className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                    <div className="text-xs text-on-surface-variant">
                      <span className="font-bold text-yellow-400">Belum ada akun WA.</span>{' '}
                      Buat dan hubungkan akun terlebih dahulu di{' '}
                      <button onClick={() => navigate('/dashboard/admin/wa/accounts')} className="text-primary font-bold hover:underline">
                        halaman WA Accounts
                      </button>.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {connectedAccounts.map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(acc.id === selectedAccountId ? '' : acc.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                          selectedAccountId === acc.id
                            ? 'border-primary/40 bg-primary/10 ring-2 ring-primary/20'
                            : 'border-outline-variant/20 bg-surface-high/20 hover:bg-surface-high/40'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          acc.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-surface-high text-on-surface-variant'
                        }`}>
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">{acc.name}</p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {acc.phoneNumber || acc.status || 'Belum terhubung'}
                          </p>
                        </div>
                        {selectedAccountId === acc.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Template */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Template Pesan
                </label>
                <textarea
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  rows={5}
                  placeholder={"Halo {{name}}, terima kasih sudah berbelanja di Tridjaya Elektronik!\n\nKami punya promo spesial untuk Anda."}
                  className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40 text-sm leading-relaxed"
                />
                <div className="flex items-start gap-2 mt-2 ml-1">
                  <Info className="w-3.5 h-3.5 text-on-surface-variant/50 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-on-surface-variant/60">
                    Gunakan <code className="text-primary/80 bg-primary/5 px-1 py-0.5 rounded">{'{{name}}'}</code> untuk variabel dari data penerima. Variabel otomatis diganti saat kirim.
                  </p>
                </div>
              </div>

              {/* Media Upload - Image */}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Gambar (Opsional - Maksimal 1)
                </label>
                
                {mediaUrl ? (
                  // Show uploaded image with preview
                  <div className="space-y-3">
                    <div className="relative bg-surface-high/30 border border-outline-variant/20 rounded-xl p-4">
                      {(mediaPreview || mediaUrl) && (
                        <img 
                          src={mediaPreview || mediaUrl} 
                          alt="Media preview" 
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      )}
                      <button
                        onClick={handleRemoveMedia}
                        className="absolute top-2 right-2 p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                        title="Hapus gambar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-on-surface-variant/60 ml-1">
                      ✓ Gambar sudah diupload. Gambar akan dikirim terlebih dahulu sebelum teks pesan.
                    </p>
                  </div>
                ) : mediaFile ? (
                  // Show preview before upload
                  <div className="space-y-3">
                    <div className="relative bg-surface-high/30 border border-outline-variant/20 rounded-xl p-4">
                      {mediaPreview && (
                        <img 
                          src={mediaPreview} 
                          alt="Media preview" 
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      )}
                      <button
                        onClick={() => handleMediaChange(null)}
                        className="absolute top-2 right-2 p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                        title="Batal"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={handleUploadMedia}
                      disabled={isUploadingMedia}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold text-sm"
                    >
                      {isUploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {isUploadingMedia ? 'Mengupload...' : 'Upload Gambar'}
                    </button>
                  </div>
                ) : (
                  // Upload area
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleMediaChange(file);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-outline-variant/30 rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <ImageIcon className="w-8 h-8 text-on-surface-variant/20 mx-auto mb-2 group-hover:text-primary transition-colors" />
                    <p className="text-xs text-on-surface-variant mb-2">Drag & drop gambar di sini atau</p>
                    <label className="inline-block">
                      <span className="text-primary font-bold hover:shadow-neon-cyan transition-all px-5 py-2 rounded-xl bg-primary/10 border border-primary/20 cursor-pointer text-sm">
                        Pilih Gambar
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleMediaChange(e.target.files[0]);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-on-surface-variant/40 mt-2">Format: .jpg, .png, .webp (maks 16MB)</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Cek Duplikat (Hari)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={dedupeDays}
                    onChange={e => setDedupeDays(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="w-24 px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface text-center"
                  />
                  <span className="text-xs text-on-surface-variant">Nomor yang sudah dikirimi dalam {dedupeDays} hari terakhir akan di-skip</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveCampaign}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 gradient-primary text-surface rounded-2xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Campaign'}</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* === SECTION 2: Recipients === */}
          <motion.div variants={iv} className={`glass-card rounded-2xl border p-6 ${!savedCampaign ? 'border-outline-variant/10 opacity-60' : 'border-outline-variant/10'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-display font-bold text-on-surface">Daftar Penerima</h2>
              {savedCampaign && recipientCount > 0 && (
                <span className="ml-auto text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                  {recipientCount} tersimpan
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant mb-5">
              Nomor telepon penerima WhatsApp. Bisa dimasukkan manual satu-satu atau import dari file Excel/CSV.
            </p>

            {!savedCampaign ? (
              /* Locked state - save campaign first */
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surface-high/50 border border-outline-variant/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-on-surface-variant/40" />
                </div>
                <p className="text-sm font-bold text-on-surface-variant/60">Simpan campaign terlebih dahulu</p>
                <p className="text-xs text-on-surface-variant/40 max-w-xs">
                  Setelah campaign tersimpan, Anda bisa menambahkan nomor telepon penerima di bagian ini.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Manual Input */}
                <div className="p-4 bg-surface-high/20 border border-outline-variant/10 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Tambah Manual
                  </h3>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddManualRecipient()}
                        placeholder="628123456789"
                        className="w-full px-3 py-2.5 bg-surface/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-on-surface text-sm placeholder:text-on-surface-variant/40"
                      />
                    </div>
                    <div className="w-36">
                      <input
                        type="text"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddManualRecipient()}
                        placeholder="Nama (opsional)"
                        className="w-full px-3 py-2.5 bg-surface/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-on-surface text-sm placeholder:text-on-surface-variant/40"
                      />
                    </div>
                    <button
                      onClick={handleAddManualRecipient}
                      className="px-4 py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl hover:bg-primary/20 transition-all font-bold text-sm flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah
                    </button>
                  </div>

                  {/* Pending manual recipients list */}
                  <AnimatePresence>
                    {manualRecipients.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 mb-3">
                          {manualRecipients.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-2.5 bg-surface/50 border border-outline-variant/10 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-mono text-on-surface">{r.phone}</span>
                                {r.name && <span className="text-xs text-on-surface-variant">({r.name})</span>}
                              </div>
                              <button
                                onClick={() => setManualRecipients(manualRecipients.filter(x => x.id !== r.id))}
                                className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={handleUploadManualRecipients}
                          disabled={isUploading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold text-sm"
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          Simpan {manualRecipients.length} Penerima
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-outline-variant/20" />
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">atau</span>
                  <div className="flex-1 border-t border-outline-variant/20" />
                </div>

                {/* Import from Database */}
                <div className="p-4 bg-surface-high/20 border border-outline-variant/10 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Import dari Database Kontak
                  </h3>
                  <p className="text-[10px] text-on-surface-variant/60">
                    Gunakan kontak yang sudah tersimpan di database blast Anda.
                  </p>
                  <button
                    onClick={handleImportFromDatabase}
                    disabled={isUploading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/10 border border-primary/20 text-primary rounded-xl hover:bg-primary/20 transition-all font-bold text-sm"
                  >
                    <Users className="w-4 h-4" />
                    Import Semua Kontak dari Database
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-outline-variant/20" />
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">atau</span>
                  <div className="flex-1 border-t border-outline-variant/20" />
                </div>

                {/* Excel/CSV Upload */}
                <div className="p-4 bg-surface-high/20 border border-outline-variant/10 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Import dari Excel / CSV
                    </h3>
                    <button
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-lg hover:bg-primary/20 transition-all"
                    >
                      <Download className="w-3 h-3" />
                      Download Template
                    </button>
                  </div>

                  {/* Format example */}
                  <div className="overflow-x-auto">
                    <table className="text-[10px] font-mono text-on-surface-variant w-full">
                      <thead>
                        <tr className="border-b border-outline-variant/20">
                          <th className="text-left p-1.5 text-primary font-bold">phone</th>
                          <th className="text-left p-1.5">name</th>
                          <th className="text-left p-1.5">var1</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr><td className="p-1.5">628123456789</td><td className="p-1.5">Budi</td><td className="p-1.5">value1</td></tr>
                        <tr><td className="p-1.5">628987654321</td><td className="p-1.5">Andi</td><td className="p-1.5">value2</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50">
                    Kolom wajib: <span className="text-primary font-bold">phone</span>. Kolom lain (name, var1, dst.) otomatis jadi variabel pesan.
                  </p>

                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleUploadRecipients(file);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-outline-variant/30 rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
                  >
                    <FileUp className="w-8 h-8 text-on-surface-variant/20 mx-auto mb-2 group-hover:text-primary transition-colors" />
                    <p className="text-xs text-on-surface-variant mb-2">Drag & drop file di sini atau</p>
                    <label className="inline-block">
                      <span className="text-primary font-bold hover:shadow-neon-cyan transition-all px-5 py-2 rounded-xl bg-primary/10 border border-primary/20 cursor-pointer text-sm">
                        {isUploading ? 'Mengupload...' : 'Pilih File'}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleUploadRecipients(e.target.files[0]);
                          e.target.value = '';
                        }}
                        disabled={isUploading}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-on-surface-variant/40 mt-2">Format: .xlsx, .xls, .csv (maks 20MB)</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick info card */}
          <motion.div variants={iv} className="glass-card rounded-2xl border border-primary/20 bg-primary/5 p-5 shadow-neon-cyan/5">
            <h3 className="text-xs font-display font-bold text-primary mb-3 uppercase tracking-widest">Cara Kerja</h3>
            <div className="text-xs font-body text-on-surface-variant space-y-3 leading-relaxed">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <p>Isi nama campaign, pilih akun WA pengirim, dan tulis template pesan.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <p>Klik <strong className="text-on-surface">Simpan Campaign</strong> untuk menyimpan.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <p>Tambahkan <strong className="text-on-surface">nomor telepon</strong> penerima secara manual atau import dari Excel.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <p>Buka halaman detail campaign untuk <strong className="text-on-surface">Start Blast</strong>.</p>
              </div>
            </div>
          </motion.div>

          {/* Variable reference */}
          <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 p-5">
            <h3 className="text-xs font-display font-bold text-on-surface mb-3 uppercase tracking-widest">Variabel Template</h3>
            <div className="text-xs font-body text-on-surface-variant space-y-2">
              <p>Variabel diambil dari kolom Excel/CSV atau dari data manual. Contoh:</p>
              <div className="p-2.5 bg-surface-high/50 rounded-lg border border-outline-variant/10 font-mono text-[10px] leading-relaxed text-primary-dim">
                <div>Halo {'{{name}}'}, promo khusus untuk Anda!</div>
                <div className="mt-1">Kode diskon: {'{{code}}'}</div>
              </div>
              <p className="text-on-surface-variant/50">Nama variabel sesuai header kolom di Excel (tanpa kolom "phone").</p>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminWaCampaignFormPage;
