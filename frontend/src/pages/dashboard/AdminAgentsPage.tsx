import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Users,
  UserCheck,
  MapPin,
  Phone,
  Mail,
  TrendingUp,
  ExternalLink,
  Search,
  AlertCircle,
  Star,
  MessageSquare,
  ShieldCheck,
  Key,
} from 'lucide-react';

import { useUserStore } from '../../store/useUserStore';
import Pagination from '../../components/ui/Pagination';
import { useSearchParams } from 'react-router-dom';

import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import type { AgentRegistration } from '../../store/useAdminNetworkStore';
import { API_BASE_URL } from '../../utils/apiClient';
import { usePersistedState } from '../../hooks/usePersistedState';

/* ─── Variants ───────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } },
};

/* ─── Component ──────────────────────────────────────── */
const AdminAgentsPage: React.FC = () => {
  const {
    registrations,
    fetchRegistrations,
    updateRegistrationStatus,
  } = useAdminNetworkStore();
  const [searchParams] = useSearchParams();
  const [approvedIds, setApprovedIds]   = useState<string[]>([]);
  const [rejectedIds, setRejectedIds]   = useState<string[]>([]);
  const [expandedId, setExpandedId]     = usePersistedState<string | null>('adminAgents:expandedId', null);
  const [searchQuery, setSearchQuery]   = usePersistedState('adminAgents:searchQuery', '');
  const [selectedAgent, setSelectedAgent] = useState<AgentRegistration | null>(null);

  const { users, fetchUsers, resetUserPassword } = useUserStore();
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [currentPage, setCurrentPage] = usePersistedState('adminAgents:currentPage', 1);
  const itemsPerPage = 8;

  React.useEffect(() => {
    fetchRegistrations();
    fetchUsers();
  }, [fetchRegistrations, fetchUsers]);

  React.useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setExpandedId(id);
      setSearchQuery(id);
    }
  }, [searchParams]);

  const handleApprove = (id: string) => {
    setApprovedIds((p) => (p.includes(id) ? p : [...p, id]));
    setRejectedIds((p) => p.filter((x) => x !== id));
    updateRegistrationStatus(id, 'approved');
  };

  const handleReject = (id: string) => {
    setRejectedIds((p) => (p.includes(id) ? p : [...p, id]));
    setApprovedIds((p) => p.filter((x) => x !== id));
    updateRegistrationStatus(id, 'rejected');
  };

  const handleReview = (id: string) => {
    updateRegistrationStatus(id, 'reviewed');
  };

  const findUserByEmail = (email: string) => {
    return users.find(u => u.email === email);
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPassword) return;
    const ok = await resetUserPassword(userId, newPassword);
    if (ok) {
      alert('Password berhasil diupdate');
      setResettingId(null);
      setNewPassword('');
    } else {
      alert('Gagal update password');
    }
  };

  const handleVerifyEmailManual = async (email: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (response.ok) {
        alert('Email berhasil diverifikasi');
        fetchUsers(true);
      } else {
        alert('Gagal verifikasi email');
      }
    } catch (err) {
      alert('Terjadi kesalahan');
    }
  };

  const filteredAgents = Array.isArray(registrations) ? registrations.filter((a) =>
    `${a.fullName} ${a.city} ${a.id}`.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const pendingRegistrations = Array.isArray(registrations) ? registrations.filter((a) => !approvedIds.includes(a.id) && !rejectedIds.includes(a.id)) : [];

  const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

      {/* ── Header Banner ────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-tertiary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
              Agen Network
            </p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <UserCheck className="w-6 h-6 text-primary" />
              Registrasi & Manajemen Agen
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Tinjau pendaftaran agen baru, tervalidasi dokumen, dan pantau antrian persetujuan.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/dashboard/admin/agents/directory"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <Users className="w-4 h-4" /> Direktori Agen
            </Link>
            <Link
              to="/dashboard/admin/finance"
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              <Wallet className="w-4 h-4" /> Keuangan
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Row ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Agen Aktif',   value: `${registrations.filter((a) => a.status === 'approved').length}`, sub: `${registrations.length} total registrasi`,  color: 'text-primary',   bg: 'bg-primary/10',   icon: Users },
          { label: 'Queue Registrasi',    value: `${pendingRegistrations.length}`,    sub: `${registrations.filter((a) => a.status === 'pending').length} pending`, color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: Clock },
          { label: 'Disetujui Hari Ini',  value: `${approvedIds.length}`,   sub: 'dari antrian aktif', color: 'text-primary',   bg: 'bg-primary/10',   icon: CheckCircle2 },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className={`p-2.5 rounded-lg ${kpi.bg} ${kpi.color} w-fit mb-3`}>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{kpi.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{kpi.value}</div>
            <div className="text-label-xs text-on-surface-variant mt-0.5">{kpi.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Queue Table ────────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Queue Registrasi Agen</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5">Klik baris untuk melihat detail & motivasi pendaftar.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari nama, kota, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[760px]">
              <thead>
                <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-widest">
                  <th className="py-3 pr-4">Pendaftar</th>
                  <th className="py-3 pr-4">Kontak</th>
                  <th className="py-3 pr-4">Area</th>
                  <th className="py-3 pr-4">Social Reach</th>
                  <th className="py-3 pr-4">Prioritas</th>
                  <th className="py-3 pr-4">Waktu</th>
                  <th className="py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAgents.map((item) => {
                  const isApproved = approvedIds.includes(item.id);
                  const isRejected = rejectedIds.includes(item.id);
                  const isExpanded = expandedId === item.id;
                  const ptLabel = item.status === 'pending' ? 'Menunggu' : item.status;

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`border-b border-outline-variant/10 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-surface-high/40' : 'hover:bg-surface-high/30'
                        } ${isApproved ? 'opacity-60' : ''} ${isRejected ? 'opacity-40' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            {item.profilePhoto ? (
                              <img 
                                src={`${API_BASE_URL}${item.profilePhoto}`} 
                                alt={item.fullName} 
                                className="w-9 h-9 rounded-xl object-cover flex-shrink-0" 
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                                {item.fullName[0]}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-on-surface text-body-sm">{item.fullName}</div>
                              <div className="text-label-xs text-on-surface-variant">{item.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="flex flex-col gap-0.5 text-label-xs text-on-surface-variant">
                            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {item.whatsapp}</span>
                            <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {item.email}</span>
                            <a 
                              href={`https://wa.me/${item.whatsapp.replace(/\D/g,'')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                            >
                              <MessageSquare className="w-3 h-3" /> WhatsApp
                            </a>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {item.city}
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="inline-flex items-center gap-1.5 font-bold text-on-surface text-body-sm">
                            <TrendingUp className="w-3.5 h-3.5 text-primary" />
                            -
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold uppercase ${
                            item.status === 'reviewed' 
                              ? 'bg-primary/15 text-primary' 
                              : 'bg-tertiary/15 text-tertiary'
                          }`}>
                            {item.status === 'reviewed' ? 'Ditinjau' : ptLabel}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="inline-flex items-center gap-1 text-label-xs text-on-surface-variant">
                            <Clock className="w-3 h-3" /> {item.submittedAt}
                          </div>
                        </td>
                        <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {isApproved ? (
                              <span className="px-3 py-1.5 rounded-md bg-secondary/15 text-secondary text-label-sm font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
                              </span>
                            ) : isRejected ? (
                              <span className="px-3 py-1.5 rounded-md bg-error/10 text-error text-label-sm font-bold inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Ditolak
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(item.id)}
                                  className="px-3 py-1.5 rounded-md bg-secondary/20 text-secondary text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-secondary/30 transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReject(item.id)}
                                  className="px-3 py-1.5 rounded-md bg-error/10 text-error text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-error/20 transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Tolak
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReview(item.id)}
                                  className={`px-3 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${
                                    item.status === 'reviewed' 
                                      ? 'bg-primary/20 text-primary' 
                                      : 'bg-surface-high text-on-surface-variant hover:text-on-surface'
                                  }`}
                                >
                                  {item.status === 'reviewed' ? 'Review Notification Sent' : 'Review Notification'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedAgent(item)}
                                  className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-label-sm font-bold inline-flex items-center gap-1.5 hover:bg-primary/20 transition-all group"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                  Lihat Detail
                                </button>
                              </>
                            )}
                            {item.status === 'approved' && findUserByEmail(item.email) && (
                              <div className="flex items-center gap-2">
                                {!findUserByEmail(item.email)?.is_verified && (
                                  <button
                                    onClick={() => handleVerifyEmailManual(item.email)}
                                    className="px-3 py-1.5 rounded-md bg-warning/10 text-warning text-label-sm font-bold inline-flex items-center gap-1.5 hover:bg-warning/20 transition-all"
                                    title="Verifikasi Email Manual"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" /> Verify
                                  </button>
                                )}
                                <button
                                  onClick={() => setResettingId(findUserByEmail(item.email)!.id)}
                                  className="px-3 py-1.5 rounded-md bg-surface-highest text-on-surface text-label-sm font-bold inline-flex items-center gap-1.5 hover:bg-surface-high transition-all"
                                >
                                  <Key className="w-3.5 h-3.5" /> Password
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-surface-high/20">
                          <td colSpan={7} className="px-6 py-4">
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="grid grid-cols-1 md:grid-cols-3 gap-4"
                            >
                              <div className="p-5 rounded-xl glass-card border border-outline-variant/10 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/70" />
                                <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">Minat Produk</div>
                                <p className="text-body-sm text-on-surface italic leading-relaxed">
                                  "{item.preferredProducts?.join(', ') || 'Semua Produk'}"
                                </p>
                              </div>
                              <div className="p-5 rounded-xl glass-card border border-outline-variant/10">
                                <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">Informasi Kontak</div>
                                <div className="space-y-2.5 text-body-sm text-on-surface-variant">
                                  <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-primary" /> <span className="font-medium text-on-surface">{item.whatsapp}</span></div>
                                  <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-tertiary" /> <span className="font-medium text-on-surface">{item.email}</span></div>
                                </div>
                              </div>
                              <div className="p-5 rounded-xl glass-card border border-outline-variant/10 relative overflow-hidden">
                                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-secondary/10 rounded-full blur-xl" />
                                <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">Lokasi & Status</div>
                                <div className="space-y-2.5 text-body-sm text-on-surface-variant relative z-10">
                                  <div className="flex items-center gap-3"><MapPin className="w-4 h-4" /> {item.city}, {item.province}</div>
                                  <div className="flex items-center gap-3"><Star className="w-4 h-4 text-yellow-400" /> Alamat Lengkap: <strong className="text-on-surface font-display">{item.address || '-'}</strong></div>
                                </div>
                              </div>

                              {(item.profilePhoto || item.ktpPhoto) && (
                                <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                                  {item.profilePhoto && (
                                    <div className="space-y-2">
                                      <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest">Foto Profil</div>
                                      <a href={`${API_BASE_URL}${item.profilePhoto}`} target="_blank" rel="noreferrer" className="block relative aspect-[3/4] rounded-lg overflow-hidden border border-outline-variant/20 hover:border-primary transition-colors">
                                        <img src={`${API_BASE_URL}${item.profilePhoto}`} alt="Profile" className="w-full h-full object-cover" />
                                      </a>
                                    </div>
                                  )}
                                  {item.ktpPhoto && (
                                    <div className="space-y-2 col-span-1 sm:col-span-2">
                                      <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest">Foto KTP</div>
                                      <a href={`${API_BASE_URL}${item.ktpPhoto}`} target="_blank" rel="noreferrer" className="block relative aspect-[3/2] rounded-lg overflow-hidden border border-outline-variant/20 hover:border-primary transition-colors">
                                        <img src={`${API_BASE_URL}${item.ktpPhoto}`} alt="KTP" className="w-full h-full object-cover" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredAgents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-on-surface-variant text-body-sm">
                      Tidak ada pendaftaran yang sesuai pencarian.
                    </td>
                  </tr>
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

          {/* Summary Bar */}
          <div className="mt-6 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
            <div className="flex items-center gap-4 text-label-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-secondary" />
                {approvedIds.length} disetujui
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-error" />
                {rejectedIds.length} ditolak
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-tertiary" />
                {filteredAgents.length - approvedIds.length - rejectedIds.length} menunggu
              </span>
            </div>
            <Link
              to="/dashboard/admin/agents/directory"
              className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              Lihat Semua Agen <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
      </motion.div>
      {/* ── Detail Modal ───────────────────────────── */}
      {selectedAgent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAgent(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-5xl bg-surface border border-outline-variant/10 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="relative p-8 border-b border-outline-variant/10 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-tertiary rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                    {selectedAgent.profilePhoto ? (
                      <img 
                        src={`${API_BASE_URL}${selectedAgent.profilePhoto}`} 
                        className="relative w-20 h-20 rounded-2xl object-cover border border-outline-variant/10 shadow-2xl" 
                        alt="" 
                      />
                    ) : (
                      <div className="relative w-20 h-20 rounded-2xl bg-surface-highest flex items-center justify-center font-bold text-primary text-3xl border border-outline-variant/10">
                        {selectedAgent.fullName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-headline-sm font-bold text-on-surface font-display tracking-tight leading-none mb-2">
                      {selectedAgent.fullName}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-label-xs font-black uppercase tracking-[0.1em] ${
                        selectedAgent.status === 'approved' ? 'bg-secondary/20 text-secondary' :
                        selectedAgent.status === 'rejected' ? 'bg-error/20 text-error' :
                        'bg-primary/20 text-primary'
                      }`}>
                        {selectedAgent.status}
                      </span>
                      <span className="text-on-surface-variant/60 text-label-xs font-mono">
                        {selectedAgent.id}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="w-12 h-12 rounded-full bg-white/5 text-on-surface-variant flex items-center justify-center hover:bg-white/10 hover:text-on-surface transition-all border border-white/10"
                    className="w-12 h-12 rounded-full bg-surface-highest text-on-surface-variant flex items-center justify-center hover:bg-surface-high hover:text-on-surface transition-all border border-outline-variant/10"
                >
                  <XCircle className="w-7 h-7" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* Left Column: Data Details */}
                <div className="lg:col-span-7 space-y-10">
                  
                  {/* Personal & Contact Section */}
                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <h4 className="text-label-sm font-black text-on-surface uppercase tracking-[0.2em]">Data Personal & Kontak</h4>
                    </header>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-full glass-card p-5 rounded-2xl border border-outline-variant/10 bg-surface-low">
                        <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 opacity-50">Nama Lengkap Sesuai Identitas</div>
                        <div className="font-bold text-on-surface text-body-lg">{selectedAgent.fullName}</div>
                      </div>
                      <div className="glass-card p-5 rounded-2xl border border-outline-variant/10 bg-surface-low">
                        <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 opacity-50">Nomor WhatsApp</div>
                        <a href={`https://wa.me/${selectedAgent.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="font-bold text-primary text-body-md inline-flex items-center gap-2 hover:underline">
                          <Phone className="w-4 h-4" /> {selectedAgent.whatsapp}
                        </a>
                      </div>
                      <div className="glass-card p-5 rounded-2xl border border-outline-variant/10 bg-surface-low">
                        <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5 opacity-50">Alamat Email Aktif</div>
                        <div className="font-bold text-on-surface text-body-md truncate inline-flex items-center gap-2">
                          <Mail className="w-4 h-4 text-tertiary" /> {selectedAgent.email}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Location Section */}
                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center">
                        <MapPin className="w-4 h-4 text-tertiary" />
                      </div>
                      <h4 className="text-label-sm font-black text-on-surface uppercase tracking-[0.2em]">Lokasi Operasional</h4>
                    </header>
                    
                    <div className="glass-card p-6 rounded-2xl border border-outline-variant/10 bg-surface-low space-y-6">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-50">Provinsi</div>
                          <div className="font-bold text-on-surface text-body-md">{selectedAgent.province}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1 opacity-50">Kota / Kabupaten</div>
                          <div className="font-bold text-on-surface text-body-md">{selectedAgent.city}</div>
                        </div>
                      </div>
                      <div className="pt-5 border-t border-outline-variant/10">
                        <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 opacity-50">Alamat Pengiriman / Domisili</div>
                        <div className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                          {selectedAgent.address || 'Informasi alamat lengkap tidak dicantumkan oleh pendaftar.'}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Product Interest Section */}
                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <Star className="w-4 h-4 text-secondary" />
                      </div>
                      <h4 className="text-label-sm font-black text-on-surface uppercase tracking-[0.2em]">Minat Kategori Produk</h4>
                    </header>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedAgent.preferredProducts?.length > 0 ? (
                        selectedAgent.preferredProducts.map((p) => (
                          <span key={p} className="px-4 py-2 rounded-xl bg-surface-highest border border-outline-variant/10 text-on-surface text-label-sm font-bold shadow-sm">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="px-4 py-2 rounded-xl bg-surface-highest text-on-surface-variant italic text-label-sm">Semua Produk</span>
                      )}
                    </div>
                  </section>
                </div>

                {/* Right Column: Document Previews */}
                <div className="lg:col-span-5 space-y-10">
                  <header className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="text-label-sm font-black text-on-surface uppercase tracking-[0.2em]">Berkas Verifikasi</h4>
                  </header>
                  
                  <div className="space-y-8">
                    {/* Profile Photo */}
                    {selectedAgent.profilePhoto && (
                      <div className="group space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-label-xs font-black text-on-surface-variant uppercase tracking-widest">Foto Profil</span>
                          <a 
                            href={`${API_BASE_URL}${selectedAgent.profilePhoto}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-primary text-[10px] font-black uppercase tracking-widest hover:text-primary-light flex items-center gap-1.5 transition-colors"
                          >
                            Buka Resolusi Penuh <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden border border-outline-variant/10 bg-black/20 group-hover:border-primary/50 transition-all shadow-xl">
                          <img 
                            src={`${API_BASE_URL}${selectedAgent.profilePhoto}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                            alt="Profile" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}

                    {/* KTP Photo */}
                    {selectedAgent.ktpPhoto && (
                      <div className="group space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-label-xs font-black text-on-surface-variant uppercase tracking-widest">Identitas (KTP)</span>
                          <a 
                            href={`${API_BASE_URL}${selectedAgent.ktpPhoto}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-primary text-[10px] font-black uppercase tracking-widest hover:text-primary-light flex items-center gap-1.5 transition-colors"
                          >
                            Buka Resolusi Penuh <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="relative aspect-[1.58/1] rounded-[2rem] overflow-hidden border border-outline-variant/10 bg-black/20 group-hover:border-primary/50 transition-all shadow-xl">
                          <img 
                            src={`${API_BASE_URL}${selectedAgent.ktpPhoto}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                            alt="KTP" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}

                    {!selectedAgent.profilePhoto && !selectedAgent.ktpPhoto && (
                      <div className="py-24 flex flex-col items-center justify-center rounded-[2.5rem] border border-outline-variant/10 bg-surface-low text-on-surface-variant/40">
                        <AlertCircle className="w-16 h-16 mb-4 opacity-10" />
                        <p className="text-label-sm font-black uppercase tracking-widest">Dokumen Belum Diunggah</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-surface-highest/50 border-t border-outline-variant/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 text-on-surface-variant/60">
                <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(var(--secondary-rgb),0.5)]" />
                <span className="text-label-sm">Registrasi diterima pada {selectedAgent.submittedAt}</span>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button 
                  onClick={() => setSelectedAgent(null)}
                  className="flex-1 sm:flex-none px-8 py-3.5 rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-label-sm hover:bg-surface-high active:scale-95 transition-all"
                >
                  Tutup
                </button>
                <button 
                  onClick={() => {
                    handleApprove(selectedAgent.id);
                    setSelectedAgent(null);
                  }}
                  className="flex-1 sm:flex-none px-10 py-3.5 rounded-2xl bg-secondary text-on-secondary font-black text-label-sm shadow-[0_12px_24px_-8px_rgba(var(--secondary-rgb),0.4)] hover:shadow-[0_16px_32px_-8px_rgba(var(--secondary-rgb),0.5)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all"
                >
                  Setujui Sekarang
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Password Reset Modal ───────────────────────── */}
      {resettingId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResettingId(null)} />
            <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-surface border border-outline-variant/10 rounded-2xl p-6 shadow-2xl"
          >
            <h3 className="text-title-md font-bold text-on-surface mb-4">Setel Ulang Kata Sandi</h3>
            <p className="text-body-sm text-on-surface-variant mb-6">
              Masukkan kata sandi baru untuk agen ini.
            </p>
            <input 
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Kata sandi baru"
              className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setResettingId(null)}
                className="px-4 py-2 text-label-sm font-bold text-on-surface-variant hover:text-on-surface"
              >
                Batal
              </button>
              <button 
                onClick={() => handleResetPassword(resettingId)}
                className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold text-label-sm shadow-lg"
              >
                Simpan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminAgentsPage;
