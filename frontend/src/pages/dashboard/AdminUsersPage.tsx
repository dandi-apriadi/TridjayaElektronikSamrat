import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, UserCog, Search, Plus,
  CheckCircle2, XCircle, Clock, Shield,
  Users, Lock, Unlock, Eye, EyeOff,
  AlertTriangle, ArrowUpRight, Filter, Megaphone, Trash2
} from 'lucide-react';
import { useUserStore } from '../../store/useUserStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import Pagination from '../../components/ui/Pagination';
import { usePersistedState } from '../../hooks/usePersistedState';

const roleConfig: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
  admin:    { cls: 'bg-primary/15 text-primary',   label: 'Admin',    icon: <ShieldCheck className="w-3 h-3" /> },
  agent:    { cls: 'bg-secondary/15 text-secondary', label: 'Agent',  icon: <Users className="w-3 h-3" /> },
  sales:    { cls: 'bg-tertiary/15 text-tertiary', label: 'Sales',   icon: <UserCog className="w-3 h-3" /> },
  operator: { cls: 'bg-tertiary/15 text-tertiary', label: 'Operator', icon: <UserCog className="w-3 h-3" /> },
};

const statusConfig: Record<string, { cls: string; dot: string }> = {
  Active:    { cls: 'bg-secondary/15 text-secondary', dot: 'bg-secondary animate-pulse' },
  Suspended: { cls: 'bg-error/15 text-error',         dot: 'bg-error' },
  Pending:   { cls: 'bg-tertiary/15 text-tertiary',   dot: 'bg-tertiary' },
};

const permissions = [
  { role: 'Admin',    perms: ['Dashboard Overview', 'Kelola Agen', 'Kelola Katalog', 'Kelola Promo', 'Kelola Konten', 'Keuangan & Payout', 'User & Akses', 'Telemetri'] },
  { role: 'Agent',    perms: ['Command Center', 'Product Knowledge', 'Pipeline Prospek', 'Push Prospek', 'Referral & Link', 'Komisi & Earning'] },
  { role: 'Sales',    perms: ['Product Knowledge', 'Jadwal Pengiriman', 'Referral & Share Link'] },
  { role: 'Operator', perms: ['WA Blast', 'Akun WA pribadi', 'Kelola Katalog', 'Kelola Konten', 'Pixel Campaign'] },
];

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

const AdminUsersPage: React.FC = () => {
  const { users, isLoading, error, fetchUsers, updateUserStatus, resetUserPassword, verifyUser, resendVerification, deleteUser } = useUserStore();
  const { user: currentUser } = useAuthStore();
  const [search, setSearch]           = usePersistedState('adminUsers:search', '');
  const [roleFilter, setRoleFilter]   = usePersistedState('adminUsers:roleFilter', 'Semua');
  const [statusFilter, setStatusFilter] = usePersistedState('adminUsers:statusFilter', 'Semua');
  const [showPerms, setShowPerms]       = usePersistedState('adminUsers:showPerms', false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = usePersistedState('adminUsers:currentPage', 1);
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
      toast.success('User Diverifikasi', 'User sekarang sudah bisa login.');
    }
  };

  const handleUnverify = async (id: string) => {
    const success = await resendVerification(id);
    if (success) {
      toast.success('Email Dikirim', 'Status user diubah ke belum terverifikasi.');
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
      toast.success('Berhasil', 'Kata sandi user telah diatur ulang.');
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
      toast.success('Berhasil', 'User telah dihapus dari sistem.');
      setDeletingUserId(null);
    } else {
      const errorMsg = useUserStore.getState().error;
      toast.error('Gagal menghapus user', errorMsg || 'Terjadi kesalahan saat menghapus user.');
    }
    setIsDeleting(false);
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.warning('Tidak ada data untuk diekspor');
      return;
    }

    const escapeCsv = (value: string | number | boolean | null | undefined) => {
      const raw = value === null || value === undefined ? '' : String(value);
      return `"${raw.replace(/"/g, '""')}"`;
    };

    const rows = [
      ['id', 'name', 'email', 'role', 'status', 'last_login', 'created_at'],
      ...filtered.map((user) => [
        user.id,
        user.name,
        user.email,
        user.role,
        userStatus(user.is_active),
        user.last_login ?? '',
        user.created_at ?? '',
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tridjaya-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV berhasil diekspor', `${filtered.length} baris data telah diunduh.`);
  };

  const filtered = users.filter((u) => {
    const matchSearch = `${u.name} ${u.email} ${u.id}`.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'Semua' || u.role.toLowerCase() === roleFilter.toLowerCase();
    const matchStatus = statusFilter === 'Semua' || userStatus(u.is_active) === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalAdmin    = users.filter((u) => u.role.toLowerCase() === 'admin').length;
  const totalAgent    = users.filter((u) => u.role.toLowerCase() === 'agent').length;
  const totalOperator = users.filter((u) => u.role.toLowerCase() === 'operator').length;
  const totalSuspended = users.filter((u) => !u.is_active).length;

  if (isLoading) {
    return <div className="text-center py-20 text-on-surface-variant animate-pulse">Memuat data users...</div>;
  }

  if (error) {
    return <div className="text-center py-20 text-error">Galat memuat data users: {error}</div>;
  }

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">IAM — Identity & Access</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary" /> User & Akses
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Kelola role, hak akses, dan status akun semua pengguna sistem Tridjaya Group.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowPerms(!showPerms)}
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              {showPerms ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPerms ? 'Sembunyikan' : 'Lihat'} Permissions
            </button>
            <Link
              to="/dashboard/admin/users/new"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <Plus className="w-4 h-4" /> Tambah User
            </Link>
          </div>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Admin',     value: totalAdmin,    color: 'text-primary',   bg: 'bg-primary/10',   icon: ShieldCheck },
          { label: 'Total Agent',     value: totalAgent,    color: 'text-secondary', bg: 'bg-secondary/10', icon: Users },
          { label: 'Total Operator',  value: totalOperator, color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: UserCog },
          { label: 'Akun Suspended',  value: totalSuspended, color: 'text-error',   bg: 'bg-error/10',     icon: AlertTriangle },
        ].map((k) => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Permissions Matrix (Collapsible) */}
      {showPerms && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-5 h-5 text-secondary" />
            <h3 className="font-display text-title-md font-bold text-on-surface">Permission Matrix</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {permissions.map((p) => {
              const rc = roleConfig[p.role.toLowerCase()];
              return (
                <div key={p.role} className="p-4 rounded-xl bg-surface-low border border-outline-variant/10">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-label-sm font-bold mb-3 ${rc.cls}`}>
                    {rc.icon}{p.role}
                  </div>
                  <ul className="space-y-1.5">
                    {p.perms.map((perm) => (
                      <li key={perm} className="flex items-center gap-2 text-body-sm text-on-surface">
                        <CheckCircle2 className="w-3.5 h-3.5 text-secondary flex-shrink-0" />{perm}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Users Table */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input type="text" placeholder="Cari nama, email, ID..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-on-surface-variant" />
            {['Semua', 'Admin', 'Operator', 'Sales', 'Agent'].map((r) => (
              <button key={r} type="button" onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${roleFilter === r ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {r}
              </button>
            ))}
            <div className="w-px h-5 bg-outline-variant/20" />
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
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Role</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Last Login</th>
                <th className="py-3 pr-4">Dibuat</th>
                <th className="py-3 pr-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((user) => {
                const rc = roleConfig[user.role.toLowerCase()] || roleConfig.operator;
                const effectiveStatus = userStatus(user.is_active);
                const sc = statusConfig[effectiveStatus] || statusConfig['Pending'];
                return (
                  <tr key={user.id} className={`border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors group ${!user.is_active ? 'opacity-60' : ''}`}>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                          {user.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface text-body-sm">{user.name}</div>
                          <div className="text-label-xs text-on-surface-variant">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${rc.cls}`}>
                        {rc.icon}{rc.label}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1.5 ${sc.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{effectiveStatus}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-body-sm text-on-surface-variant">
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(user.last_login)}</div>
                    </td>
                    <td className="py-3.5 pr-4 text-body-sm text-on-surface-variant">{formatDateTime(user.created_at)}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2 transition-opacity">
                        <Link to={`/dashboard/admin/users/edit/${user.id}`}
                          className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Ubah Role">
                          <UserCog className="w-4 h-4" />
                        </Link>
                        <button type="button" onClick={() => toggleSuspend(user.id, user.is_active)}
                          className={`p-1.5 rounded-md transition-colors ${!user.is_active ? 'bg-secondary/15 text-secondary hover:bg-secondary/25' : 'bg-error/10 text-error hover:bg-error/20'}`}
                          title={!user.is_active ? 'Aktifkan' : 'Suspend'}>
                          {!user.is_active ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => setResettingUserId(user.id)}
                          className="p-1.5 rounded-md bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors" title="Reset Password">
                          <Lock className="w-4 h-4" />
                        </button>
                        {!user.is_verified && (
                          <button type="button" onClick={() => handleVerify(user.id)}
                            className="p-1.5 rounded-md bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors animate-pulse" title="Verifikasi Akun">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {user.is_verified && (
                          <button type="button" onClick={() => handleUnverify(user.id)}
                            className="p-1.5 rounded-md bg-surface-highest text-on-surface-variant hover:text-on-surface transition-colors" title="Unverify & Resend Email">
                            <Megaphone className="w-4 h-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => setDeletingUserId(user.id)} 
                          disabled={currentUser?.id === user.id}
                          className={`p-1.5 rounded-md transition-colors ${currentUser?.id === user.id ? 'opacity-40 cursor-not-allowed bg-surface-highest text-on-surface-variant' : 'bg-error/10 text-error hover:bg-error/20'}`}
                          title={currentUser?.id === user.id ? "Tidak bisa menghapus akun sendiri" : "Hapus User"}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-on-surface-variant text-body-sm">Tidak ada user yang sesuai filter.</td></tr>
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
            <strong className="text-on-surface">{filtered.length}</strong> dari {users.length} user
          </span>
          <button type="button" onClick={handleExportCsv} className="text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Export CSV <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Security Warning if any suspended */}
      {users.some((u) => !u.is_active) && (
        <motion.div variants={iv} className="flex items-center gap-3 p-4 rounded-xl bg-error/8 border border-error/20">
          <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-body-sm text-on-surface">
            <strong className="text-error">{users.filter((u) => !u.is_active).length} akun</strong> sedang dalam status suspended. Pantau aktivitas login mereka secara berkala.
          </p>
          <button type="button" className="ml-auto flex-shrink-0 text-label-sm text-primary font-semibold hover:underline inline-flex items-center gap-1">
            Detail <XCircle className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
      
      {/* Reset Password Modal */}
      {resettingUserId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResettingUserId(null)} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md glass-card rounded-2xl p-6 shadow-2xl">
            <h3 className="font-display text-title-md font-bold text-on-surface mb-4 inline-flex items-center gap-2">
              <Lock className="w-5 h-5 text-tertiary" /> Reset Password User
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-6">
              Masukkan kata sandi baru untuk user <strong>{users.find(u => u.id === resettingUserId)?.name}</strong>.
            </p>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kata Sandi Baru</label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="w-full pl-4 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none focus:ring-2 focus:ring-tertiary/40"
                    autoFocus
                  />
                </div>
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
                  className="flex-1 py-2.5 rounded-lg bg-tertiary text-on-tertiary font-bold text-label-sm hover:bg-tertiary-light shadow-lg shadow-tertiary/20 transition-all disabled:opacity-50"
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
              <AlertTriangle className="w-5 h-5 text-error" /> Hapus User
            </h3>
            <p className="text-body-sm text-on-surface-variant mb-2">
              Anda akan menghapus user <strong>{users.find(u => u.id === deletingUserId)?.name}</strong> secara permanen dari sistem.
            </p>
            <p className="text-body-sm text-error/80 mb-6 p-3 rounded-lg bg-error/8">
              <strong>Perhatian:</strong> Tindakan ini tidak dapat dibatalkan. Semua data terkait user akan dihapus.
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
                className="flex-1 py-2.5 rounded-lg bg-error text-on-error font-bold text-label-sm hover:bg-error-light shadow-lg shadow-error/20 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Menghapus...' : 'Hapus User'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminUsersPage;
