import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Edit2, CheckCircle2, XCircle, 
  Settings, Smartphone, AlertTriangle, Wifi, WifiOff,
  QrCode, Loader2, Phone, MessageCircle, RefreshCw
} from 'lucide-react';
import { toast } from '../../store/useNotificationStore';
import type { WaAccount } from '../../types';
import { apiFetch } from '../../utils/apiClient';
import { readApiError } from '../../utils/apiError';

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  connected:    { label: 'Connected',    cls: 'bg-green-500/20 text-green-400 border border-green-500/30',  icon: <Wifi className="w-3.5 h-3.5" /> },
  disconnected: { label: 'Disconnected', cls: 'bg-surface-high text-on-surface-variant border border-outline-variant/30', icon: <WifiOff className="w-3.5 h-3.5" /> },
  connecting:   { label: 'Connecting...', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  qr_ready:     { label: 'Scan QR',      cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', icon: <QrCode className="w-3.5 h-3.5" /> },
  reconnecting: { label: 'Reconnecting', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" /> },
  error:        { label: 'Error',        cls: 'bg-red-500/20 text-red-400 border border-red-500/30',        icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const AdminWaAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WaAccount | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  
  // QR Code state
  const [qrAccountId, setQrAccountId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch('/api/wa/accounts');
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat akun WA'));
      const data = await res.json();
      setAccounts(data.data?.items || []);
    } catch (error) {
      toast.error('Gagal memuat akun WA', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    // Auto-refresh every 5 seconds to show status updates
    const interval = setInterval(fetchAccounts, 5000);
    return () => clearInterval(interval);
  }, [fetchAccounts]);

  // QR polling
  useEffect(() => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    
    if (qrAccountId) {
      const pollQR = async () => {
        try {
          const res = await apiFetch(`/api/v1/wa/sessions/${qrAccountId}/qr`);
          if (res.ok) {
            const data = await res.json();
            setQrCode(data.data?.qr || null);
          } else {
            setQrCode(null);
          }
        } catch { setQrCode(null); }
      };
      pollQR();
      qrPollRef.current = setInterval(pollQR, 3000);
    } else {
      setQrCode(null);
    }
    return () => { if (qrPollRef.current) clearInterval(qrPollRef.current); };
  }, [qrAccountId]);

  // Stop QR polling when account becomes connected
  useEffect(() => {
    if (qrAccountId) {
      const acc = accounts.find(a => a.id === qrAccountId);
      if (acc?.status === 'connected') {
        setQrAccountId(null);
        toast.success('Terhubung!', `${acc.name} berhasil terhubung ke WhatsApp`);
      }
    }
  }, [accounts, qrAccountId]);

  const handleConnect = async (id: string) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await apiFetch(`/api/v1/wa/sessions/${id}/connect`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Gagal menghubungkan WhatsApp'));
      }
      toast.success('Menghubungkan...', 'Scan QR code untuk menghubungkan WhatsApp');
      setQrAccountId(id);
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal connect', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!window.confirm('Disconnect WhatsApp session ini?')) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await apiFetch(`/api/v1/wa/sessions/${id}/disconnect`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memutuskan sesi WhatsApp'));
      toast.success('Berhasil', 'Session disconnected');
      if (qrAccountId === id) setQrAccountId(null);
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal disconnect', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleOpenModal = (account?: WaAccount) => {
    if (account) {
      setEditingAccount(account);
      setName(account.name);
      setEnabled(account.enabled);
    } else {
      setEditingAccount(null);
      setName('');
      setEnabled(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Validasi gagal', 'Nama wajib diisi');
      return;
    }
    setIsSubmitting(true);
    try {
      const url = editingAccount ? `/api/wa/accounts/${editingAccount.id}` : '/api/wa/accounts';
      const method = editingAccount ? 'PATCH' : 'POST';
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({ name, enabled })
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan akun WA'));
      toast.success('Berhasil', editingAccount ? 'Akun diperbarui' : 'Akun ditambahkan');
      setIsModalOpen(false);
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal menyimpan akun', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus akun ini? Session akan diputus.')) return;
    try {
      const res = await apiFetch(`/api/wa/accounts/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus akun WA'));
      toast.success('Berhasil', 'Akun dihapus');
      if (qrAccountId === id) setQrAccountId(null);
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal menghapus akun', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const toggleEnabled = async (account: WaAccount) => {
    try {
      const res = await apiFetch(`/api/wa/accounts/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !account.enabled })
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memperbarui status akun WA'));
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal update', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const getStatusBadge = (status?: string) => {
    const cfg = statusConfig[status || 'disconnected'] || statusConfig.disconnected;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
        {cfg.icon}
        <span>{cfg.label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-on-surface">WhatsApp Sessions</h1>
          <p className="text-sm font-body text-on-surface-variant mt-1">Kelola koneksi WhatsApp untuk gateway self-hosted.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Akun</span>
        </button>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrAccountId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-2xl border border-primary/20 p-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-primary" />
              <h3 className="font-display font-bold text-on-surface">Scan QR Code</h3>
              <button
                onClick={() => setQrAccountId(null)}
                className="ml-auto p-1.5 hover:bg-surface-high rounded-lg text-on-surface-variant"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            {qrCode ? (
              <div className="inline-block bg-white p-4 rounded-2xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCode)}`}
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-on-surface-variant">Menunggu QR code dari WhatsApp...</p>
              </div>
            )}
            <p className="mt-4 text-xs text-on-surface-variant">
              Buka WhatsApp di ponsel &rarr; Perangkat Tertaut &rarr; Tautkan Perangkat
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && accounts.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => {
            const isConnected = account.status === 'connected';
            const isConnecting = account.status === 'connecting' || account.status === 'qr_ready' || account.status === 'reconnecting';
            const loading = actionLoading[account.id];

            return (
              <motion.div
                layout
                key={account.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card rounded-2xl border border-outline-variant/10 overflow-hidden shadow-lg ${!account.enabled ? 'opacity-60' : ''}`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                      <Smartphone className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenModal(account)}
                        className="p-2 hover:bg-surface-high rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-display font-bold text-on-surface mb-1">{account.name}</h3>
                  
                  {account.phoneNumber && (
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-3.5 h-3.5 text-on-surface-variant" />
                      <span className="text-sm text-on-surface-variant">{account.phoneNumber}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    {getStatusBadge(account.status)}
                    {account.messageCountToday != null && account.messageCountToday > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-on-surface-variant">
                        <MessageCircle className="w-3 h-3" />
                        {account.messageCountToday} hari ini
                      </span>
                    )}
                  </div>

                  {account.lastError && account.status === 'error' && (
                    <div className="mb-3 p-2 bg-red-500/10 rounded-lg">
                      <p className="text-[10px] text-red-400 truncate">{account.lastError}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-4 border-t border-outline-variant/10">
                    {!isConnected && !isConnecting ? (
                      <button
                        onClick={() => handleConnect(account.id)}
                        disabled={loading || !account.enabled}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 gradient-primary text-surface rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:shadow-neon-cyan"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                        Connect
                      </button>
                    ) : isConnected ? (
                      <button
                        onClick={() => handleDisconnect(account.id)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:bg-red-500/20"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WifiOff className="w-3.5 h-3.5" />}
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => setQrAccountId(account.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-xl text-xs font-bold transition-all hover:bg-yellow-500/20"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Show QR
                      </button>
                    )}

                    <button
                      onClick={() => toggleEnabled(account)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                        account.enabled 
                          ? 'bg-secondary/20 text-secondary border border-secondary/30' 
                          : 'bg-surface-high text-on-surface-variant border border-outline-variant/30'
                      }`}
                      title={account.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      {account.enabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {accounts.length === 0 && !isLoading && (
            <div className="col-span-full py-16 text-center glass-card rounded-3xl border border-dashed border-outline-variant/30">
              <Smartphone className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
              <p className="text-on-surface-variant font-body">Belum ada akun WhatsApp yang terdaftar.</p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 text-primary font-bold hover:shadow-neon-cyan transition-all px-6 py-2 rounded-xl bg-primary/10 border border-primary/20"
              >
                Tambah akun pertama
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-premium rounded-[32px] overflow-hidden border border-outline-variant/20"
            >
              <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Settings className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-display font-bold text-on-surface">
                    {editingAccount ? 'Edit Akun' : 'Tambah Akun WA'}
                  </h2>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-on-surface-variant hover:text-on-surface transition-colors p-2 hover:bg-surface-high rounded-full">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Nama Akun (Label)
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Misal: Customer Service 1"
                    className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40"
                  />
                </div>

                <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <Smartphone className="w-5 h-5 text-primary flex-shrink-0" />
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Setelah membuat akun, klik <strong className="text-on-surface">Connect</strong> lalu scan QR code dengan WhatsApp di ponsel Anda.
                  </p>
                </div>
 
                <div className="flex items-center gap-3 py-1 ml-1">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-outline-variant/30 text-primary bg-surface-high focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer"
                  />
                  <label htmlFor="enabled" className="text-sm font-bold text-on-surface cursor-pointer">
                    Aktifkan akun ini
                  </label>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-surface-high/50 border border-outline-variant/30 text-on-surface-variant rounded-2xl hover:bg-surface-high hover:text-on-surface transition-all font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 gradient-primary text-surface rounded-2xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Akun'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminWaAccountsPage;
