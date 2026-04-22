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
  Share2,
  TrendingUp,
  ExternalLink,
  Search,
  Filter,
  ArrowUpRight,
  AlertCircle,
  Star,
} from 'lucide-react';

/* ─── Mock Data ──────────────────────────────────────── */
const pendingAgents = [
  {
    id: 'REG-1021',
    name: 'Rani Syafitri',
    city: 'Makassar',
    province: 'Sulawesi Selatan',
    phone: '+62 812-0011-2233',
    email: 'rani.s@gmail.com',
    instagram: '@rani.samrat',
    socialReach: '12.4k',
    motivation: 'Ingin mengembangkan jaringan penjualan di area Makassar Utara.',
    submittedAt: '2 jam lalu',
    priority: 'high',
  },
  {
    id: 'REG-1019',
    name: 'Fahri Ramadhan',
    city: 'Gowa',
    province: 'Sulawesi Selatan',
    phone: '+62 813-9988-7766',
    email: 'fahri.r@gmail.com',
    instagram: '@fahri.official',
    socialReach: '8.1k',
    motivation: 'Memiliki toko kecil elektronik, ingin menambah lini produk.',
    submittedAt: '5 jam lalu',
    priority: 'medium',
  },
  {
    id: 'REG-1018',
    name: 'Sri Wulandari',
    city: 'Parepare',
    province: 'Sulawesi Selatan',
    phone: '+62 811-5544-3322',
    email: 'sri.wulan@gmail.com',
    instagram: '@sriwulan.kreasi',
    socialReach: '5.6k',
    motivation: 'Reseller aktif brand elektronik lain, ingin diversifikasi.',
    submittedAt: '1 hari lalu',
    priority: 'medium',
  },
  {
    id: 'REG-1014',
    name: 'Denny Kusuma',
    city: 'Bone',
    province: 'Sulawesi Selatan',
    phone: '+62 822-1234-5678',
    email: 'denny.k@gmail.com',
    instagram: '@dennyk_sepeda',
    socialReach: '3.2k',
    motivation: 'Penggemar sepeda listrik, komunitas lokal aktif di Bone.',
    submittedAt: '2 hari lalu',
    priority: 'low',
  },
];

const withdrawalRequests = [
  { id: 'WD-4401', agent: 'Agen Samrat Makassar', agentId: 'AGT-001', amount: 'Rp 2.400.000', raw: 2400000, period: 'Apr 2026', submittedAt: '2 jam lalu', status: 'Pending' },
  { id: 'WD-4398', agent: 'Dian Sales Partner', agentId: 'AGT-002', amount: 'Rp 1.800.000', raw: 1800000, period: 'Apr 2026', submittedAt: '5 jam lalu', status: 'Need Review' },
  { id: 'WD-4391', agent: 'Krisna Network', agentId: 'AGT-003', amount: 'Rp 1.200.000', raw: 1200000, period: 'Mar 2026', submittedAt: '1 hari lalu', status: 'Pending' },
  { id: 'WD-4385', agent: 'Ratna Mobile Palu', agentId: 'AGT-004', amount: 'Rp 900.000', raw: 900000, period: 'Mar 2026', submittedAt: '2 hari lalu', status: 'Pending' },
];

/* ─── Variants ───────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } },
};

const priorityConfig: Record<string, { label: string; cls: string }> = {
  high:   { label: 'Prioritas Tinggi', cls: 'bg-error/15 text-error' },
  medium: { label: 'Normal',           cls: 'bg-tertiary/15 text-tertiary' },
  low:    { label: 'Rendah',           cls: 'bg-surface-highest text-on-surface-variant' },
};

/* ─── Component ──────────────────────────────────────── */
const AdminAgentsPage: React.FC = () => {
  const [approvedIds, setApprovedIds]   = useState<string[]>([]);
  const [rejectedIds, setRejectedIds]   = useState<string[]>([]);
  const [wdStatuses, setWdStatuses]     = useState<Record<string, string>>({});
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [activeTab, setActiveTab]       = useState<'queue' | 'payout'>('queue');

  const handleApprove = (id: string) => {
    setApprovedIds((p) => (p.includes(id) ? p : [...p, id]));
    setRejectedIds((p) => p.filter((x) => x !== id));
  };

  const handleReject = (id: string) => {
    setRejectedIds((p) => (p.includes(id) ? p : [...p, id]));
    setApprovedIds((p) => p.filter((x) => x !== id));
  };

  const handleWd = (id: string, status: string) => {
    setWdStatuses((p) => ({ ...p, [id]: status }));
  };

  const filteredAgents = pendingAgents.filter((a) =>
    `${a.name} ${a.city} ${a.id}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPending = withdrawalRequests
    .filter((r) => (wdStatuses[r.id] || r.status) === 'Pending')
    .reduce((s, r) => s + r.raw, 0);

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
              Tinjau pendaftaran agen baru, kelola payout komisi, dan pantau antrian persetujuan.
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Agen Aktif',   value: '1,284', sub: '+19 bulan ini',  color: 'text-primary',   bg: 'bg-primary/10',   icon: Users },
          { label: 'Queue Registrasi',    value: '23',    sub: '4 prioritas tinggi', color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: Clock },
          { label: 'Payout Pending',      value: `Rp ${(totalPending/1000000).toFixed(1)}jt`, sub: `${withdrawalRequests.filter((r) => (wdStatuses[r.id] || r.status) === 'Pending').length} request`, color: 'text-secondary', bg: 'bg-secondary/10', icon: Wallet },
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

      {/* ── Tab Navigation ──────────────────────────── */}
      <motion.div variants={itemVariants} className="flex items-center gap-1 p-1 bg-surface-high/50 rounded-xl w-fit border border-outline-variant/10">
        {([
          { key: 'queue',  label: 'Queue Registrasi',   count: filteredAgents.filter((a) => !approvedIds.includes(a.id) && !rejectedIds.includes(a.id)).length },
          { key: 'payout', label: 'Payout & Penarikan', count: withdrawalRequests.filter((r) => (wdStatuses[r.id] || r.status) === 'Pending').length },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 rounded-lg font-semibold text-body-sm transition-all flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-surface-low text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-md text-label-xs font-bold ${
              activeTab === tab.key ? 'bg-primary/20 text-primary' : 'bg-surface-highest text-on-surface-variant'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </motion.div>

      {/* ── Queue Tab ────────────────────────────────── */}
      {activeTab === 'queue' && (
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
                {filteredAgents.map((item) => {
                  const isApproved = approvedIds.includes(item.id);
                  const isRejected = rejectedIds.includes(item.id);
                  const isExpanded = expandedId === item.id;
                  const p = priorityConfig[item.priority];

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
                            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                              {item.name[0]}
                            </div>
                            <div>
                              <div className="font-semibold text-on-surface text-body-sm">{item.name}</div>
                              <div className="text-label-xs text-on-surface-variant">{item.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="flex flex-col gap-0.5 text-label-xs text-on-surface-variant">
                            <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {item.phone}</span>
                            <span className="inline-flex items-center gap-1"><Share2 className="w-3 h-3" /> {item.instagram}</span>
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
                            {item.socialReach}
                          </div>
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold ${p.cls}`}>
                            {p.label}
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
                                  onClick={() => alert(`Review alert sent to ${item.email}`)}
                                  className="px-3 py-1.5 rounded-md bg-surface-high text-on-surface-variant text-label-sm font-semibold hover:text-on-surface transition-colors"
                                >
                                  Review Notification
                                </button>
                              </>
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
                                <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">Motivasi Bergabung</div>
                                <p className="text-body-sm text-on-surface italic leading-relaxed">"{item.motivation}"</p>
                              </div>
                              <div className="p-5 rounded-xl glass-card border border-outline-variant/10">
                                <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">Informasi Kontak</div>
                                <div className="space-y-2.5 text-body-sm text-on-surface-variant">
                                  <div className="flex items-center gap-3"><Phone className="w-4 h-4 text-primary" /> <span className="font-medium text-on-surface">{item.phone}</span></div>
                                  <div className="flex items-center gap-3"><Mail className="w-4 h-4 text-tertiary" /> <span className="font-medium text-on-surface">{item.email}</span></div>
                                  <div className="flex items-center gap-3"><Share2 className="w-4 h-4 text-secondary" /> <span className="font-medium text-on-surface">{item.instagram}</span></div>
                                </div>
                              </div>
                              <div className="p-5 rounded-xl glass-card border border-outline-variant/10 relative overflow-hidden">
                                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-secondary/10 rounded-full blur-xl" />
                                <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3">Lokasi & Insight</div>
                                <div className="space-y-2.5 text-body-sm text-on-surface-variant relative z-10">
                                  <div className="flex items-center gap-3"><MapPin className="w-4 h-4" /> {item.city}, {item.province}</div>
                                  <div className="flex items-center gap-3"><Star className="w-4 h-4 text-yellow-400" /> Jangkauan: <strong className="text-on-surface font-display">{item.socialReach} Follower</strong></div>
                                  <div className="flex items-center gap-3"><AlertCircle className="w-4 h-4" /> Antrian: <strong className={priorityConfig[item.priority].cls.split(' ')[1]}>{priorityConfig[item.priority].label}</strong></div>
                                </div>
                              </div>
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
      )}

      {/* ── Payout Tab ───────────────────────────────── */}
      {activeTab === 'payout' && (
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />

          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Manajemen Payout Komisi</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Total pending: <strong className="text-primary">Rp {totalPending.toLocaleString('id-ID')}</strong>
              </p>
            </div>
            <Link
              to="/dashboard/admin/finance"
              className="px-4 py-2 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" /> Halaman Keuangan
            </Link>
          </div>

          <div className="space-y-3">
            {withdrawalRequests.map((req) => {
              const currentStatus = wdStatuses[req.id] || req.status;
              const isPending = currentStatus === 'Pending';
              const isNeedReview = currentStatus === 'Need Review';
              const isApproved = currentStatus === 'Approved';
              const isPaid = currentStatus === 'Paid';

              return (
                <div
                  key={req.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl border border-outline-variant/10 hover:bg-surface-high/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                      {req.agent[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-on-surface text-body-sm">{req.agent}</div>
                      <div className="text-label-xs text-on-surface-variant">
                        {req.id} · {req.agentId} · Periode {req.period}
                      </div>
                      <div className="text-label-xs text-on-surface-variant inline-flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" /> {req.submittedAt}
                      </div>
                    </div>
                  </div>

                  <div className="font-display text-title-md font-bold text-primary flex-shrink-0">
                    {req.amount}
                  </div>

                  <div className="flex-shrink-0">
                    {isPending && (
                      <span className="px-2 py-1 rounded-md bg-tertiary/15 text-tertiary text-label-xs font-bold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Menunggu
                      </span>
                    )}
                    {isNeedReview && (
                      <span className="px-2 py-1 rounded-md bg-error/10 text-error text-label-xs font-bold inline-flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Perlu Review
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2 py-1 rounded-md bg-secondary/15 text-secondary text-label-xs font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Disetujui
                      </span>
                    )}
                    {isPaid && (
                      <span className="px-2 py-1 rounded-md bg-primary/15 text-primary text-label-xs font-bold inline-flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Dibayar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(isPending || isNeedReview) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleWd(req.id, 'Approved')}
                          className="px-3 py-1.5 rounded-md bg-secondary/20 text-secondary text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-secondary/30 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => handleWd(req.id, 'Rejected')}
                          className="px-3 py-1.5 rounded-md bg-error/10 text-error text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-error/20 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Tolak
                        </button>
                      </>
                    )}
                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => handleWd(req.id, 'Paid')}
                        className="px-3 py-1.5 rounded-md bg-primary/20 text-primary text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-primary/30 transition-colors"
                      >
                        <Wallet className="w-3.5 h-3.5" /> Tandai Dibayar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => alert(`Detail request ${req.id} opened for verification.`)}
                      className="px-3 py-1.5 rounded-md bg-surface-high text-on-surface-variant text-label-sm font-semibold hover:text-on-surface transition-colors"
                    >
                      Detail
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-outline-variant/10">
            <Link
              to="/dashboard/admin/finance"
              className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              <Filter className="w-3.5 h-3.5" /> Lihat Semua Payout & Laporan Keuangan
            </Link>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AdminAgentsPage;