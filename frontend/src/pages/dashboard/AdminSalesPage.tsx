import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserCog, Search, Plus,
  CheckCircle2, Clock, Shield,
  Users, Lock, Unlock,
  AlertTriangle, ArrowUpRight, Filter, Trash2,
  Copy, Share2
} from 'lucide-react';
import { useUserStore } from '../../store/useUserStore';
import { toast } from '../../store/useNotificationStore';
import Pagination from '../../components/ui/Pagination';
import { usePersistedState } from '../../hooks/usePersistedState';
import { buildReferralLink } from '../../utils/apiClient';

const statusConfig: Record<string, { cls: string; dot: string }> = {
  Active:    { cls: 'bg-secondary/15 text-secondary', dot: 'bg-secondary animate-pulse' },
  Suspended: { cls: 'bg-error/15 text-error',         dot: 'bg-error' },
  Pending:   { cls: 'bg-tertiary/15 text-tertiary',   dot: 'bg-tertiary' },
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const AdminSalesPage: React.FC = () => {
  const { users, isLoading, error, fetchUsers, updateUserStatus, resetUserPassword, verifyUser, deleteUser } = useUserStore();
  const [search, setSearch]           = usePersistedState('adminSales:search', '');
  const [statusFilter, setStatusFilter] = usePersistedState('adminSales:statusFilter', 'Semua');
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = usePersistedState('adminSales:currentPage', 1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const userStatus = (isActive: boolean) => (isActive ? 'Active' : 'Suspended');

  const toggleSuspend = async (id: string, isActive: boolean) => {
    await updateUserStatus(id, !isActive);
  };

  const handleVerify = async (id: string) => {
    const success = await verifyUser(id);
    if (success) {
      toast.success('Sales Diverifikasi', 'Sales sekarang sudah bisa login.');
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUserId || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error('Kata sandi terlalu pendek', 'Minimal 8 karakter.');
      return;
    }

    setIsResetting(true);
    const success = await resetUserPassword(resettingUserId, newPassword);
    if (success) {
      toast.success('Berhasil', 'Kata sandi sales telah diatur ulang.');
      setResettingUserId(null);
      setNewPassword('');
    }
    setIsResetting(false);
  };

  const handleDelete = async () => {
    if (!deletingUserId) return;
    setIsDeleting(true);
    const success = await deleteUser(deletingUserId);
    if (success) {
      toast.success('Berhasil', 'Sales telah dihapus dari sistem.');
      setDeletingUserId(null);
    } else {
      const errorMsg = useUserStore.getState().error;
      toast.error('Gagal menghapus sales', errorMsg || 'Terjadi kesalahan saat menghapus sales.');
    }
    setIsDeleting(false);
  };

  const copyReferralLink = (slug?: string) => {
    if (!slug) return;
    const url = buildReferralLink(slug);
    navigator.clipboard.writeText(url);
    toast.success('Link Referral Disalin', 'Siap dibagikan ke customer.');
  };

  const salesUsers = users.filter(u => ['sales', 'kepala_cabang', 'supervisor', 'koordinator'].includes(u.role.toLowerCase()));

  const filtered = salesUsers.filter((u) => {
    const matchSearch = `${u.name} ${u.email} ${u.referral_slug || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'Semua' || userStatus(u.is_active) === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalSales = salesUsers.length;
  const activeSales = salesUsers.filter(u => u.is_active).length;
  const verifiedSales = salesUsers.filter(u => u.is_verified).length;
  const suspendedSales = salesUsers.filter(u => !u.is_active).length;

  if (isLoading) {
    return <div className="text-center py-20 text-on-surface-variant animate-pulse">Memuat data sales...</div>;
  }

  if (error) {
    return <div className="text-center py-20 text-error">Galat memuat data sales: {error}</div>;
  }

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-tertiary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Sales Management</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Share2 className="w-6 h-6 text-tertiary" /> Manajemen Sales
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Kelola tim sales, pantau link referral, dan atur hak akses operasional mereka.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/dashboard/admin/users/new?role=sales"
              className="px-4 py-2.5 rounded-lg bg-tertiary/15 text-tertiary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-tertiary/25 transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah Sales
            </Link>
          </div>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales',     value: totalSales,    color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: Users },
          { label: 'Sales Aktif',     value: activeSales,   color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2 },
          { label: 'Sales Terverifikasi', value: verifiedSales, color: 'text-primary',   bg: 'bg-primary/10',   icon: Shield },
          { label: 'Sales Suspended',  value: suspendedSales, color: 'text-error',     bg: 'bg-error/10',     icon: AlertTriangle },
        ].map((k) => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Sales Table */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input type="text" placeholder="Cari nama, email, link referral..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-tertiary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-on-surface-variant" />
            {['Semua', 'Active', 'Suspended'].map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${statusFilter === s ? 'bg-surface-highest text-on-surface' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead>
              <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-widest">
                <th className="py-3 pr-4">Sales</th>
                <th className="py-3 pr-4">Jabatan</th>
                <th className="py-3 pr-4">WhatsApp</th>
                <th className="py-3 pr-4">Referral Slug</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Last Login</th>
                <th className="py-3 pr-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((user) => {
                const effectiveStatus = userStatus(user.is_active);
                const sc = statusConfig[effectiveStatus] || statusConfig['Pending'];
                return (
                  <tr key={user.id} className={`border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors group ${!user.is_active ? 'opacity-60' : ''}`}>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl gradient-tertiary flex items-center justify-center font-bold text-on-tertiary text-sm flex-shrink-0">
                          {user.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface text-body-sm">{user.name}</div>
                          <div className="text-label-xs text-on-surface-variant">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="text-label-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-highest text-on-surface-variant border border-outline-variant/10">
                        {(user.jabatan || 'sales').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-body-sm text-on-surface-variant">
                      {user.whatsapp || '-'}
                    </td>
                    <td className="py-3.5 pr-4">
                      {user.referral_slug ? (
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 rounded bg-surface-highest text-tertiary text-xs font-mono">{user.referral_slug}</code>
                          <button onClick={() => copyReferralLink(user.referral_slug)} className="p-1 text-on-surface-variant hover:text-tertiary transition-colors" title="Copy Link">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-label-xs text-on-surface-variant italic">Belum ada slug</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1.5 ${sc.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{effectiveStatus}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-body-sm text-on-surface-variant">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(user.last_login)}</div>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <Link to={`/dashboard/admin/users/edit/${user.id}`}
                          className="p-1.5 rounded-md bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors" title="Ubah Sales">
                          <UserCog className="w-4 h-4" />
                        </Link>
                        <button type="button" onClick={() => toggleSuspend(user.id, user.is_active)}
                          className={`p-1.5 rounded-md transition-colors ${!user.is_active ? 'bg-secondary/15 text-secondary hover:bg-secondary/25' : 'bg-error/10 text-error hover:bg-error/20'}`}
                          title={!user.is_active ? 'Aktifkan' : 'Suspend'}>
                          {!user.is_active ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => setResettingUserId(user.id)}
                          className="p-1.5 rounded-md bg-surface-highest text-on-surface-variant hover:text-on-surface transition-colors" title="Reset Password">
                          <Lock className="w-4 h-4" />
                        </button>
                        {!user.is_verified && (
                          <button type="button" onClick={() => handleVerify(user.id)}
                            className="p-1.5 rounded-md bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors animate-pulse" title="Verifikasi Akun">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => setDeletingUserId(user.id)} 
                          className="p-1.5 rounded-md bg-error/10 text-error hover:bg-error/20 transition-colors"
                          title="Hapus Sales">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-on-surface-variant text-body-sm">Tidak ada sales yang sesuai filter.</td></tr>
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

        <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between text-label-sm">
          <span className="text-on-surface-variant">
            Menampilkan <strong className="text-on-surface">{filtered.length}</strong> sales
          </span>
          <Link to="/dashboard/admin/users" className="text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Lihat Semua User <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      {/* Reset Password Modal */}
      {resettingUserId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResettingUserId(null)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl">
            <h3 className="font-display text-title-md font-bold text-on-surface mb-4 inline-flex items-center gap-2">
              <Lock className="w-5 h-5 text-tertiary" /> Reset Password Sales
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-6">
              Masukkan kata sandi baru untuk sales <strong>{users.find(u => u.id === resettingUserId)?.name}</strong>.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kata Sandi Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full pl-4 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none focus:ring-2 focus:ring-tertiary/40"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUserId(null)}
                  className="flex-1 py-2.5 rounded-lg bg-surface-highest text-on-surface font-semibold text-label-sm hover:bg-surface-highest/80 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={isResetting || !newPassword}
                  className="flex-1 py-2.5 rounded-lg bg-tertiary text-on-tertiary font-bold text-label-sm hover:bg-tertiary shadow-lg shadow-tertiary/20 transition-all disabled:opacity-50"
                >
                  {isResetting ? 'Memproses...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete User Modal */}
      {deletingUserId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeletingUserId(null)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl">
            <h3 className="font-display text-title-md font-bold text-on-surface mb-2 inline-flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-error" /> Hapus Sales
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-6">
              Anda akan menghapus sales <strong>{users.find(u => u.id === deletingUserId)?.name}</strong> secara permanen. Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingUserId(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg bg-surface-highest text-on-surface font-semibold text-label-sm hover:bg-surface-highest/80 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-lg bg-error text-on-error font-bold text-label-sm hover:bg-error transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Sales'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminSalesPage;
