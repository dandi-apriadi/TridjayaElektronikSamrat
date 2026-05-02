import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Edit2, CheckCircle2, XCircle, 
  Settings, Key, Smartphone, AlertTriangle 
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaAccount } from '../../types';

const AdminWaAccountsPage: React.FC = () => {
  const { accessToken } = useAuthStore();
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<WaAccount | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wa/accounts', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.data?.items || []);
    } catch (error) {
      toast.error('Gagal memuat akun WA', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (account?: WaAccount) => {
    if (account) {
      setEditingAccount(account);
      setName(account.name);
      setToken(account.gatewayConfig.token || '');
      setEnabled(account.enabled);
    } else {
      setEditingAccount(null);
      setName('');
      setToken('');
      setEnabled(true);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token.trim()) {
      toast.error('Validasi gagal', 'Nama dan Token wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingAccount ? `/api/wa/accounts/${editingAccount.id}` : '/api/wa/accounts';
      const method = editingAccount ? 'PATCH' : 'POST';
      
      const payload = {
        name,
        gatewayConfig: { token },
        enabled
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save account');
      
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
    if (!window.confirm('Hapus akun ini?')) return;
    
    try {
      const res = await fetch(`/api/wa/accounts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error('Failed to delete account');
      toast.success('Berhasil', 'Akun dihapus');
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal menghapus akun', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const toggleStatus = async (account: WaAccount) => {
    try {
      const res = await fetch(`/api/wa/accounts/${account.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !account.enabled })
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchAccounts();
    } catch (error) {
      toast.error('Gagal update status', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-on-surface">WA Gateway Accounts</h1>
          <p className="text-sm font-body text-on-surface-variant mt-1">Kelola token Fonnte untuk pengiriman pesan massal.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Akun</span>
        </button>
      </div>

      {isLoading && accounts.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <motion.div
              layout
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card rounded-2xl border border-outline-variant/10 overflow-hidden shadow-lg ${!account.enabled ? 'opacity-60 grayscale' : ''}`}
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
                <div className="flex items-center gap-2 mb-4">
                  <Key className="w-3.5 h-3.5 text-on-surface-variant" />
                  <code className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                    {account.gatewayConfig.token ? `${account.gatewayConfig.token.substring(0, 6)}***` : 'No Token'}
                  </code>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
                  <button
                    onClick={() => toggleStatus(account)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      account.enabled 
                        ? 'bg-secondary/20 text-secondary border border-secondary/30' 
                        : 'bg-surface-high text-on-surface-variant border border-outline-variant/30'
                    }`}
                  >
                    {account.enabled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aktif</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Nonaktif</span>
                      </>
                    )}
                  </button>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold opacity-50">
                    ID: {account.id.substring(0, 8)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {accounts.length === 0 && !isLoading && (
            <div className="col-span-full py-16 text-center glass-card rounded-3xl border border-dashed border-outline-variant/30">
              <Smartphone className="w-12 h-12 text-on-surface-variant/30 mx-auto mb-4" />
              <p className="text-on-surface-variant font-body">Belum ada akun gateway yang terdaftar.</p>
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
 
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                    Fonnte API Token
                  </label>
                  <div className="relative">
                    <Key className="absolute left-4 top-3.5 w-5 h-5 text-on-surface-variant" />
                    <input
                      type="password"
                      required
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Masukkan API Token Anda"
                      className="w-full pl-12 pr-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40"
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-on-surface-variant ml-1">
                    Dapatkan token di dashboard <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">Fonnte</a>.
                  </p>
                </div>
 
                <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0" />
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Pastikan nomor WA yang terhubung dengan token ini dalam keadaan <strong className="text-on-surface">aktif (Connected)</strong> di Fonnte.
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
                    Aktifkan akun ini segera
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
