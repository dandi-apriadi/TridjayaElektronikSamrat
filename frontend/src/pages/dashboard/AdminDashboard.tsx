import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  Package,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Wallet,
  UserCheck,
  Activity,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  ExternalLink,
  Star,
  MapPin,
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
} from 'recharts';

/* ─── Mock Data ─────────────────────────────────────── */
const revenueData = [
  { month: 'Jan', komisiBruto: 18500000, payout: 15200000 },
  { month: 'Feb', komisiBruto: 23100000, payout: 19400000 },
  { month: 'Mar', komisiBruto: 20800000, payout: 17300000 },
  { month: 'Apr', komisiBruto: 27600000, payout: 22100000 },
  { month: 'Mei', komisiBruto: 32400000, payout: 26800000 },
  { month: 'Jun', komisiBruto: 38900000, payout: 31200000 },
];

const agentGrowthData = [
  { month: 'Jan', active: 45, new: 8 },
  { month: 'Feb', active: 52, new: 12 },
  { month: 'Mar', active: 61, new: 15 },
  { month: 'Apr', active: 75, new: 18 },
  { month: 'Mei', active: 89, new: 21 },
  { month: 'Jun', active: 102, new: 19 },
];

const topAgents = [
  { name: 'Agen Samrat Makassar', city: 'Makassar', sales: 48, earnings: 'Rp 14.4jt', rating: 4.9, delta: '+12%' },
  { name: 'Dian Sales Partner', city: 'Gowa', sales: 35, earnings: 'Rp 10.5jt', rating: 4.7, delta: '+8%' },
  { name: 'Krisna Network', city: 'Manado', sales: 29, earnings: 'Rp 8.7jt', rating: 4.5, delta: '+6%' },
  { name: 'Ratna Mobile Palu', city: 'Palu', sales: 22, earnings: 'Rp 6.6jt', rating: 4.3, delta: '+2%' },
];

const recentActivities = [
  { type: 'agent_register', label: 'Budi Santoso mendaftar sebagai agen baru', time: '2 menit lalu', icon: UserCheck, color: 'text-primary bg-primary/10' },
  { type: 'payout_request', label: 'Dian Sales Partner mengajukan payout Rp 1.8jt', time: '18 menit lalu', icon: Wallet, color: 'text-tertiary bg-tertiary/10' },
  { type: 'catalog_update', label: 'Stok Goda GD120 diperbarui: 24 unit tersisa', time: '1 jam lalu', icon: Package, color: 'text-secondary bg-secondary/10' },
  { type: 'agent_sold', label: 'Krisna Network berhasil close deal Winfly W200', time: '2 jam lalu', icon: ShoppingBag, color: 'text-secondary bg-secondary/10' },
  { type: 'payout_done', label: 'Payout AGT-003 Rp 1.2jt telah diproses', time: '3 jam lalu', icon: CheckCircle2, color: 'text-secondary bg-secondary/10' },
  { type: 'sync_warn', label: 'Sinkronisasi data telemetri delayed 15 menit', time: '4 jam lalu', icon: AlertCircle, color: 'text-error bg-error/10' },
];

const topProducts = [
  { label: 'Goda GD120', category: 'Sepeda Listrik', views: '2,482', conversion: '12%', stock: 24, slug: 'goda-gd120' },
  { label: 'Winfly W200', category: 'Sepeda Listrik', views: '1,940', conversion: '10%', stock: 11, slug: 'winfly-w200' },
  { label: 'Smart TV OLED 55"', category: 'Elektronik', views: '1,621', conversion: '9.2%', stock: 7, slug: 'smart-tv-65' },
  { label: 'Sofa Premium L', category: 'Furnitur', views: '1,204', conversion: '8.5%', stock: 3, slug: 'sofa-premium-l' },
];

const pendingPayouts = [
  { id: 'PO-4401', agent: 'Agen Samrat Makassar', amount: 'Rp 2.400.000', since: '2 jam lalu' },
  { id: 'PO-4398', agent: 'Dian Sales Partner', amount: 'Rp 1.800.000', since: '5 jam lalu' },
];

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
  const [chartRange, setChartRange] = useState('6M');

  const kpis = [
    {
      label: 'Total Agen Aktif',
      value: '1,284',
      change: '+12%',
      sub: '23 pending approval',
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/dashboard/admin/agents',
    },
    {
      label: 'Komisi Bulan Ini',
      value: 'Rp 38.9jt',
      change: '+20.1%',
      sub: 'vs Rp 32.4jt bulan lalu',
      icon: Wallet,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      href: '/dashboard/admin/finance',
    },
    {
      label: 'Item Katalog',
      value: '452',
      change: '+5%',
      sub: '7 stok kritis',
      icon: Package,
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
      href: '/dashboard/admin/catalog',
    },
    {
      label: 'Konversi Lead',
      value: '4.2%',
      change: '+0.8%',
      sub: '603 total lead masuk',
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/dashboard/admin/telemetry',
    },
  ];

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
              Rabu, 22 April 2026 · Semua sistem beroperasi normal
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/dashboard/admin/agents"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              23 Approval Pending
            </Link>
            <Link
              to="/dashboard/admin/finance"
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              <Wallet className="w-4 h-4" />
              2 Payout Pending
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Area Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">
                Tren Komisi & Payout
              </h3>
              <p className="text-label-sm text-on-surface-variant mt-0.5">Bruto komisi vs realisasi payout (IDR)</p>
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
              <span className="text-label-xs text-on-surface-variant">Komisi Bruto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-secondary" />
              <span className="text-label-xs text-on-surface-variant">Realisasi Payout</span>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
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
                  tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  formatter={(v: unknown) => [`Rp ${((v as number) / 1000000).toFixed(1)}jt`, '']}
                />
                <Area type="monotone" dataKey="komisiBruto" stroke="#8FF5FF" strokeWidth={2.5} fill="url(#gradBruto)" name="Komisi Bruto" />
                <Area type="monotone" dataKey="payout" stroke="#A2F31F" strokeWidth={2.5} fill="url(#gradPayout)" name="Payout" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Agent Growth Bar Chart */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
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
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
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
          </div>
          <div className="mt-4 p-3 rounded-lg bg-surface-high border border-outline-variant/10">
            <div className="text-label-xs text-on-surface-variant">Agen aktif bulan ini</div>
            <div className="font-display font-bold text-primary mt-0.5">102 Agen</div>
            <div className="text-label-xs text-secondary">↑ 19 agen baru bergabung</div>
          </div>
        </motion.div>
      </div>

      {/* ── Middle Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <th className="pb-3 pr-4">Rating</th>
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
                    <td className="py-3 pr-4">
                      <div className="inline-flex items-center gap-1 font-bold text-on-surface text-body-sm">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        {agent.rating}
                      </div>
                    </td>
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
            <div className="space-y-3">
              {[
                { label: 'Server Status', status: 'Online', ok: true },
                { label: 'API Latency', status: '45ms', ok: true },
                { label: 'Database Load', status: '12%', ok: true },
                { label: 'Sync Status', status: 'Delayed', ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="font-body text-body-sm text-on-surface-variant">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    {!item.ok && <span className="w-1.5 h-1.5 bg-error rounded-full animate-ping" />}
                    <span className={`font-bold text-body-sm ${item.ok ? 'text-secondary' : 'text-error'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
                  <ArrowUpRight className="w-3.5 h-3.5 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <div className="text-label-xs text-on-surface-variant">{product.views} views · Stok {product.stock}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-secondary text-body-sm">{product.conversion}</div>
                  <div className="text-label-xs text-on-surface-variant">conv.</div>
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
            {pendingPayouts.map((p) => (
              <div key={p.id} className="p-3 rounded-lg border border-outline-variant/10 flex items-center justify-between gap-3 bg-surface-low/40">
                <div>
                  <div className="font-semibold text-on-surface text-body-sm">{p.agent}</div>
                  <div className="text-label-xs text-on-surface-variant">{p.id} · {p.since}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-primary text-body-sm">{p.amount}</div>
                  <div className="flex gap-1 mt-1">
                    <button type="button" className="p-1 rounded bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="p-1 rounded bg-error/10 text-error hover:bg-error/20 transition-colors">
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
            {recentActivities.map((act, i) => (
              <div key={i} className="flex items-start gap-3">
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
