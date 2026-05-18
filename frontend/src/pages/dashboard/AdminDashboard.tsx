import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  Package,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  UserCheck,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  ExternalLink,
  MapPin,
  Megaphone,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { useProductStore } from '../../store/useProductStore';
import { useUserStore } from '../../store/useUserStore';
import { usePersistedState } from '../../hooks/usePersistedState';
import { isAdminSalesRole } from '../../utils/roles';

const formatRelativeTime = (isoDate: string): string => {
  const value = new Date(isoDate).getTime();
  if (Number.isNaN(value)) return 'baru saja';

  const diffMin = Math.max(1, Math.floor((Date.now() - value) / 60000));
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
};

const monthLabel = (dateIso: string): string => {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('id-ID', { month: 'short' });
};

/* ─── Variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 110, damping: 18 },
  },
};

/* ─── Component ─────────────────────────────────────── */
const AdminDashboard: React.FC = () => {
  const [chartRange, setChartRange] = usePersistedState('adminDashboard:chartRange', '6M');
  const [pendingClaimActionId, setPendingClaimActionId] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);

  // Delay chart rendering until after first paint to avoid width/height = -1 warning
  useEffect(() => {
    const t = setTimeout(() => setChartReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  const {
    registrations,
    claims,
    telemetryStats,
    fetchRegistrations,
    fetchClaims,
    fetchTelemetryStats,
    updateClaimStatus,
  } = useAdminNetworkStore();
  const { products, fetchProducts } = useProductStore();
  const { users, fetchUsers } = useUserStore();

  useEffect(() => {
    fetchRegistrations();
    fetchClaims();
    fetchTelemetryStats();
    fetchProducts();
    fetchUsers();
  }, [fetchRegistrations, fetchClaims, fetchTelemetryStats, fetchProducts, fetchUsers]);

  const trafficData = telemetryStats?.trafficData || [];
  const systemMetrics = telemetryStats?.systemMetrics || [];
  const totalClicks = trafficData.reduce((sum, row) => sum + row.clicks, 0);
  const totalLeads = trafficData.reduce((sum, row) => sum + row.leads, 0);
  const totalConversions = trafficData.reduce((sum, row) => sum + row.conversions, 0);
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : '0.00';

  const pendingApprovals = registrations.filter(
    (reg) => reg.status === 'pending' || reg.status === 'reviewed',
  ).length;
  const activeAgents = registrations.filter((reg) => reg.status === 'approved').length;

  const pendingPayouts = claims.filter((claim) => claim.status === 'pending' || claim.status === 'processing');
  const completedClaims = claims.filter((claim) => claim.status === 'completed').length;
  const activeSales = users.filter((u) => isAdminSalesRole(u.role) && u.is_active).length;

  const topAgents = useMemo(() => {
    const summary = new Map<string, { name: string; city: string; sales: number; pending: number }>();

    claims.forEach((claim) => {
      const name = claim.agentName || claim.agentId;
      const existing = summary.get(name) || { name, city: 'N/A', sales: 0, pending: 0 };
      const isCompleted = claim.status === 'completed';
      summary.set(name, {
        ...existing,
        sales: existing.sales + (isCompleted ? 1 : 0),
        pending: existing.pending + (isCompleted ? 0 : 1),
      });
    });

    return [...summary.values()]
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 4)
      .map((agent) => ({
        ...agent,
        earnings: `${agent.sales} klaim selesai`,
        delta: "0%",
      }));
  }, [claims]);

  const topProducts = useMemo(
    () => products.slice(0, 4).map((product) => ({
      label: product.name,
      category: product.category,
      stock: product.stock,
      slug: product.slug,
    })),
    [products],
  );

  const recentActivities = useMemo(() => {
    const registrationEvents = registrations.slice(0, 4).map((reg) => ({
      key: `reg-${reg.id}`,
      label: `${reg.fullName} mendaftar sebagai agen (${reg.city})`,
      time: formatRelativeTime(reg.submittedAt),
      icon: UserCheck,
      color: 'text-primary bg-primary/10',
      date: reg.submittedAt,
    }));

    const claimEvents = claims.slice(0, 4).map((claim) => ({
      key: `claim-${claim.id}`,
      label: `${claim.agentName || claim.agentId} mengajukan klaim ${claim.rewardName}`,
      time: formatRelativeTime(claim.submittedAt),
      icon: Wallet,
      color: claim.status === 'completed' ? 'text-secondary bg-secondary/10' : 'text-tertiary bg-tertiary/10',
      date: claim.submittedAt,
    }));

    return [...registrationEvents, ...claimEvents]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [registrations, claims]);

  const agentGrowthData = useMemo(() => {
    const monthMap = new Map<string, { month: string; active: number; new: number }>();

    registrations.forEach((reg) => {
      const key = monthLabel(reg.submittedAt);
      const current = monthMap.get(key) || { month: key, active: 0, new: 0 };
      current.new += 1;
      if (reg.status === 'approved') current.active += 1;
      monthMap.set(key, current);
    });

    return [...monthMap.values()].slice(-6);
  }, [registrations]);

  const chartData = useMemo(
    () => trafficData.map((item) => ({ month: item.day, clicks: item.clicks, leads: item.leads })),
    [trafficData],
  );

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category || 'Lainnya';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [products]);

  const COLORS = ['#8FF5FF', '#A2F31F', '#F31F7B', '#FFD700', '#FF8C00', '#9932CC', '#00FA9A', '#FF4500'];

  const kpis = [
    {
      label: 'Total Agen Aktif',
      value: activeAgents.toLocaleString('id-ID'),
      change: pendingApprovals > 0 ? `+${pendingApprovals}` : '+0',
      sub: `${pendingApprovals} pending approval`,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/dashboard/admin/agents',
    },
    {
      label: 'Total Konversi',
      value: totalConversions.toLocaleString('id-ID'),
      change: `${conversionRate}%`,
      sub: `${totalLeads.toLocaleString('id-ID')} total lead 7 hari`,
      icon: Wallet,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      href: '/dashboard/admin/telemetry',
    },
    {
      label: 'Item Katalog',
      value: products.length.toLocaleString('id-ID'),
      change: products.length > 0 ? '+live' : '+0',
      sub: `${products.filter((p) => p.stock !== 'available').length} perlu perhatian`,
      icon: Package,
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
      href: '/dashboard/admin/catalog',
    },
    {
      label: 'Klaim Pending',
      value: pendingPayouts.length.toLocaleString('id-ID'),
      change: `done ${completedClaims}`,
      sub: `${claims.length.toLocaleString('id-ID')} total klaim`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/dashboard/admin/finance',
    },
    {
      label: 'Tim Sales Aktif',
      value: activeSales.toLocaleString('id-ID'),
      change: '+manage',
      sub: `${users.filter(u => isAdminSalesRole(u.role)).length} total admin-sales`,
      icon: Megaphone,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      href: '/dashboard/admin/users',
    },
  ];

  const handlePayoutAction = async (claimId: string, nextStatus: 'processing' | 'cancelled') => {
    setPendingClaimActionId(claimId);
    try {
      await updateClaimStatus(claimId, nextStatus);
    } finally {
      setPendingClaimActionId(null);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Welcome Banner ─────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
              Selamat Datang Kembali 👋
            </p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface">
              Admin Dashboard
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })} · Monitoring data real-time
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/dashboard/admin/agents"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              {pendingApprovals} Approval Pending
            </Link>
            <Link
              to="/dashboard/admin/finance"
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              <Wallet className="w-4 h-4" />
              {pendingPayouts.length} Claim Pending
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <motion.div
            key={kpi.label}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            className="glass-card rounded-xl p-5 relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div
                className={`flex items-center gap-0.5 text-label-xs font-bold px-2 py-1 rounded-md ${
                  kpi.change.startsWith('+')
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-error/10 text-error'
                }`}
              >
                {kpi.change.startsWith('+') ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {kpi.change}
              </div>
            </div>
            <div className="font-body text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">
              {kpi.label}
            </div>
            <div className="font-display text-headline-sm font-bold text-on-surface mb-1">
              {kpi.value}
            </div>
            <div className="text-label-xs text-on-surface-variant mb-3">{kpi.sub}</div>
            <Link
              to={kpi.href}
              className="text-label-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all"
            >
              Lihat detail <ArrowUpRight className="w-3 h-3" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Revenue Area Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">
                Tren Traffic & Lead
              </h3>
              <p className="text-label-sm text-on-surface-variant mt-0.5">Data klik dan lead dari telemetry API</p>
            </div>
            <div className="flex items-center gap-2">
              {['3M', '6M', '1Y'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setChartRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${
                    chartRange === r
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-5 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-label-xs text-on-surface-variant">Klik</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-secondary" />
              <span className="text-label-xs text-on-surface-variant">Lead</span>
            </div>
          </div>
          <div className="relative h-[260px] w-full min-h-[260px] overflow-visible">
            {chartReady && (
            <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={0} debounce={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8FF5FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8FF5FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A2F31F" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#A2F31F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="month" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#ADAAAA"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  formatter={(v: unknown) => [`${v as number}`, '']}
                />
                <Area type="monotone" dataKey="clicks" stroke="#8FF5FF" strokeWidth={2.5} fill="url(#gradBruto)" name="Klik" />
                <Area type="monotone" dataKey="leads" stroke="#A2F31F" strokeWidth={2.5} fill="url(#gradPayout)" name="Lead" />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        {/* Agent Growth Bar Chart */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-title-md font-bold text-on-surface">Pertumbuhan Agen</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Agen aktif vs pendaftar baru</p>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary/70" />
              <span className="text-label-xs text-on-surface-variant">Aktif</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-secondary/70" />
              <span className="text-label-xs text-on-surface-variant">Baru</span>
            </div>
          </div>
          <div className="relative h-[220px] w-full min-h-[220px] flex-1 overflow-visible">
            {chartReady && (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0} debounce={200}>
              <BarChart data={agentGrowthData} barSize={8} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="month" stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="active" fill="#8FF5FF" opacity={0.7} radius={[3, 3, 0, 0]} name="Aktif" />
                <Bar dataKey="new" fill="#A2F31F" opacity={0.85} radius={[3, 3, 0, 0]} name="Baru" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-surface-high border border-outline-variant/10">
            <div className="text-label-xs text-on-surface-variant">Registrasi agen bulan ini</div>
            <div className="font-display font-bold text-primary mt-0.5">{agentGrowthData.at(-1)?.new ?? 0} Agen</div>
            <div className="text-label-xs text-secondary">{agentGrowthData.at(-1)?.active ?? 0} di antaranya approved</div>
          </div>
        </motion.div>

        {/* Category Distribution Chart */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-title-md font-bold text-on-surface">Distribusi Katalog</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Top 8 kategori produk</p>
          </div>
          <div className="relative h-[300px] w-full min-h-[300px] flex-1">
            {chartReady && (
            <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0} debounce={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1A1A1A', 
                    borderColor: '#484847', 
                    borderRadius: '12px', 
                    color: '#FFF',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: '10px' }}
                  formatter={(value, entry: any) => (
                    <span className="text-label-xs text-on-surface-variant font-medium">
                      {value}: <span className="text-on-surface font-bold">{entry.payload.value}</span>
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Middle Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Top Agents */}
        <motion.div variants={itemVariants} className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-title-md font-bold text-on-surface">Top Performing Agents</h3>
            <Link
              to="/dashboard/admin/agents/directory"
              className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              Lihat semua <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[520px]">
              <thead>
                <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Agen</th>
                  <th className="pb-3 pr-4">Penjualan</th>
                  <th className="pb-3 pr-4">Komisi</th>
                  <th className="pb-3">Growth</th>
                </tr>
              </thead>
              <tbody>
                {topAgents.map((agent, i) => (
                  <tr key={agent.name} className="border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors">
                    <td className="py-3 pr-4 font-bold text-on-surface-variant text-body-sm">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-bold text-on-primary text-xs flex-shrink-0">
                          {agent.name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface text-body-sm">{agent.name}</div>
                          <div className="text-label-xs text-on-surface-variant inline-flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" /> {agent.city}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-on-surface text-body-sm">{agent.sales} Unit</td>
                    <td className="py-3 pr-4 font-semibold text-primary text-body-sm">{agent.earnings}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-md text-label-xs font-bold bg-secondary/10 text-secondary">
                        {agent.delta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* System Health + Quick Actions */}
        <motion.div variants={itemVariants} className="flex flex-col gap-4">
          {/* System Health */}
          <div className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
              <h4 className="font-display text-title-sm font-bold text-on-surface">System Health</h4>
            </div>
            {systemMetrics.length > 0 ? (
              <div className="space-y-3">
                {systemMetrics.map((item: any) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <span className="font-body text-body-sm text-on-surface-variant">{item.label}</span>
                      {item.sub && <div className="text-label-xs text-on-surface-variant mt-0.5">{item.sub}</div>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!item.ok && <span className="w-1.5 h-1.5 bg-error rounded-full animate-ping" />}
                      <span className={`font-bold text-body-sm ${item.ok ? 'text-secondary' : 'text-error'}`}>
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-body-sm text-on-surface-variant">Belum ada telemetry sistem yang tersedia.</div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-xl p-5">
            <h4 className="font-display text-title-sm font-bold text-on-surface mb-4">Quick Actions</h4>
            <div className="space-y-2">
              {[
                { label: 'Review Pendaftaran Agen', href: '/dashboard/admin/agents', icon: UserCheck, color: 'text-primary' },
                { label: 'Approve Payout Request', href: '/dashboard/admin/finance', icon: Wallet, color: 'text-tertiary' },
                { label: 'Update Stok Katalog', href: '/dashboard/admin/catalog', icon: Package, color: 'text-secondary' },
                { label: 'Lihat Error Logs', href: '/dashboard/admin/telemetry', icon: Activity, color: 'text-error' },
              ].map((action) => (
                <Link
                  key={action.href}
                  to={action.href}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-high transition-colors group border border-transparent hover:border-outline-variant/10"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className={`w-4 h-4 ${action.color}`} />
                    <span className="font-body text-body-sm font-semibold text-on-surface-variant group-hover:text-on-surface transition-colors">
                      {action.label}
                    </span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Top Catalog Products */}
        <motion.div variants={itemVariants} className="lg:col-span-1 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent" />
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-title-md font-bold text-on-surface">Top Katalog</h3>
            <Link to="/dashboard/admin/catalog" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
              Semua <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {topProducts.map((product, i) => (
              <div key={product.label} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-high transition-colors group">
                <div className="w-7 h-7 rounded-md bg-surface-highest flex items-center justify-center text-label-xs font-bold text-on-surface-variant flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface text-body-sm truncate">{product.label}</div>
                  <div className="text-label-xs text-on-surface-variant">{product.category} · stok {product.stock}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-secondary text-body-sm">live</div>
                  <div className="text-label-xs text-on-surface-variant">api</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pending Payouts */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent" />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Pending Payout</h3>
              <p className="text-label-xs text-on-surface-variant mt-0.5">Menunggu persetujuan Anda</p>
            </div>
            <span className="px-2 py-1 rounded-md bg-tertiary/15 text-tertiary font-bold text-label-xs">
              {pendingPayouts.length} Request
            </span>
          </div>
          <div className="space-y-3 mb-4">
            {pendingPayouts.slice(0, 4).map((p) => (
              <div key={p.id} className="p-3 rounded-lg border border-outline-variant/10 flex items-center justify-between gap-3 bg-surface-low/40">
                <div>
                  <div className="font-semibold text-on-surface text-body-sm">{p.agentName || p.agentId}</div>
                  <div className="text-label-xs text-on-surface-variant">{p.id} · {formatRelativeTime(p.submittedAt)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-primary text-body-sm">{p.rewardName}</div>
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => handlePayoutAction(p.id, 'processing')}
                      disabled={pendingClaimActionId === p.id}
                      className="p-1 rounded bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePayoutAction(p.id, 'cancelled')}
                      disabled={pendingClaimActionId === p.id}
                      className="p-1 rounded bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link
            to="/dashboard/admin/finance"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 text-primary font-semibold text-label-sm hover:bg-primary/20 transition-colors"
          >
            Kelola Semua Payout <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Activity Feed */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <h3 className="font-display text-title-md font-bold text-on-surface">Live Activity</h3>
            </div>
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[280px] custom-scrollbar pr-1">
            {recentActivities.map((act) => (
              <div key={act.key} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${act.color}`}>
                  <act.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface leading-snug">{act.label}</p>
                  <div className="flex items-center gap-1 mt-0.5 text-label-xs text-on-surface-variant">
                    <Clock className="w-2.5 h-2.5" /> {act.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <Link
              to="/dashboard/admin/telemetry"
              className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Lihat Telemetri Lengkap
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
