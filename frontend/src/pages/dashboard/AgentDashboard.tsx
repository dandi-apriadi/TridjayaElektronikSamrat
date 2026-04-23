import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  DollarSign, Users, Target, TrendingUp, ArrowUpRight,
  MessageCircle, ExternalLink, Clock, CheckCircle2,
  Send, Star, Zap, BookOpen, Wallet,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area,
} from 'recharts';

/* ─── Mock Data ───────────────────────────────────────── */
const weeklyData = [
  { day: 'Sen', amount: 450000 },
  { day: 'Sel', amount: 1200000 },
  { day: 'Rab', amount: 800000 },
  { day: 'Kam', amount: 1500000 },
  { day: 'Jum', amount: 2100000 },
  { day: 'Sab', amount: 950000 },
  { day: 'Min', amount: 400000 },
];

const monthlyTrend = [
  { month: 'Nov', komisi: 1800000 },
  { month: 'Des', komisi: 2100000 },
  { month: 'Jan', komisi: 2500000 },
  { month: 'Feb', komisi: 3200000 },
  { month: 'Mar', komisi: 2900000 },
  { month: 'Apr', komisi: 3800000 },
];

const hotLeads = [
  { name: 'Andi Wijaya',    product: 'Goda GD120',      status: 'Follow Up',      statusCls: 'bg-primary/15 text-primary',      phone: '0812-3344-5566', slug: 'goda-gd120' },
  { name: 'Dewi Lestari',   product: 'Smart TV OLED 55"', status: 'Negotiation',    statusCls: 'bg-tertiary/15 text-tertiary',    phone: '0822-9988-7766', slug: 'smart-tv-65' },
  { name: 'Hendra Saputra', product: 'Winfly W200',      status: 'Payment Pending', statusCls: 'bg-yellow-500/15 text-yellow-400', phone: '0813-5544-3322', slug: 'winfly-w200' },
  { name: 'Santi Wijaya',   product: 'Sofa Premium L',  status: 'Cold',             statusCls: 'bg-surface-highest text-on-surface-variant', phone: '0811-7766-5544', slug: 'sofa-premium-l' },
];

const recentActivity = [
  { icon: CheckCircle2, color: 'text-secondary bg-secondary/10', label: 'Deal closed! Bagas Surya – Goda GD120', time: '4 jam lalu' },
  { icon: Send,         color: 'text-primary bg-primary/10',     label: 'Push prospek baru: Dewi Lestari', time: '6 jam lalu' },
  { icon: Wallet,       color: 'text-secondary bg-secondary/10', label: 'Komisi Rp 840rb dikreditkan', time: 'Kemarin' },
];

/* ─── Variants ────────────────────────────────────────── */
const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

/* ─── Component ───────────────────────────────────────── */
const AgentDashboard: React.FC = () => {
  const kpis = [
    { label: 'Komisi Bulan Ini',  value: 'Rp 3.82jt', change: '+18.5%', up: true, icon: DollarSign, color: 'text-primary',   bg: 'bg-primary/10',   href: '/dashboard/agent/earnings' },
    { label: 'Penjualan Sukses',  value: '12 Unit',   change: '+2',     up: true, icon: Target,     color: 'text-secondary', bg: 'bg-secondary/10', href: '/dashboard/agent/leads' },
    { label: 'Prospek Aktif',     value: '28',        change: '+4',     up: true, icon: Users,      color: 'text-tertiary',  bg: 'bg-tertiary/10',  href: '/dashboard/agent/leads' },
    { label: 'Konversi Rate',     value: '14.2%',     change: '+2.1%',  up: true, icon: TrendingUp, color: 'text-primary',   bg: 'bg-primary/10',   href: '/dashboard/agent/knowledge' },
  ];

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* ── Welcome Banner ────────────────────────────── */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
              Selamat Datang Kembali 👋
            </p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface">
              Command Center Agen
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Anda punya <strong className="text-secondary">4 prospek</strong> perlu follow-up hari ini dan{' '}
              <strong className="text-primary">Rp 1.62jt</strong> saldo siap ditarik.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              to="/dashboard/agent/push"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <Send className="w-4 h-4" /> Push Prospek
            </Link>
            <Link
              to="/dashboard/agent/earnings"
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              <Wallet className="w-4 h-4" /> Tarik Saldo
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.label} variants={iv} whileHover={{ scale: 1.02, y: -4 }}
            className="glass-card rounded-xl p-5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <span className={`px-2 py-1 rounded-md text-label-xs font-bold inline-flex items-center gap-0.5 ${kpi.up ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                <ArrowUpRight className="w-3 h-3" />{kpi.change}
              </span>
            </div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{kpi.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1 mb-3">{kpi.value}</div>
            <Link to={kpi.href} className="text-label-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Lihat detail <ArrowUpRight className="w-3 h-3" />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Charts Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Bar Chart */}
        <motion.div variants={iv} className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Komisi Mingguan</h3>
              <p className="text-label-sm text-on-surface-variant mt-0.5">Performa 7 hari terakhir (IDR)</p>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-secondary text-title-md">Rp 7.4jt</div>
              <div className="text-label-xs text-on-surface-variant">Total minggu ini</div>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="day" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip
                  cursor={{ fill: 'rgba(143,245,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  formatter={(v: unknown) => [`Rp ${((v as number) / 1000).toLocaleString('id-ID')}k`, 'Komisi']}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                  {weeklyData.map((_e, i) => (
                    <Cell key={i} fill={i === 4 ? '#A2F31F' : '#8FF5FF'} fillOpacity={i === 4 ? 0.9 : 0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Monthly Trend */}
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-title-md font-bold text-on-surface">Tren 6 Bulan</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Pertumbuhan komisi</p>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="agGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#A2F31F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#A2F31F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="month" stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  formatter={(v: unknown) => [`Rp ${((v as number) / 1000000).toFixed(1)}jt`, 'Komisi']}
                />
                <Area type="monotone" dataKey="komisi" stroke="#A2F31F" strokeWidth={2.5} fill="url(#agGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-surface-high">
            <div className="text-label-xs text-on-surface-variant">Komisi April (tertinggi)</div>
            <div className="font-display font-bold text-secondary">Rp 3.8jt</div>
            <div className="text-label-xs text-primary">↑ +31% vs Maret</div>
          </div>
        </motion.div>
      </div>

      {/* ── Bottom Row ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads */}
        <motion.div variants={iv} className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <h3 className="font-display text-title-md font-bold text-on-surface">Hot Leads</h3>
            </div>
            <Link to="/dashboard/agent/leads" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
              Semua <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {hotLeads.map((lead) => {
              const waText = encodeURIComponent(`Halo ${lead.name}, saya dari Tridjaya Samrat. Ingin menindaklanjuti minat Anda pada ${lead.product}.`);
              return (
                <div key={lead.name} className="flex items-center gap-3 p-3.5 rounded-xl border border-outline-variant/10 hover:bg-surface-high/30 transition-colors group">
                  <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                    {lead.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-on-surface text-body-sm">{lead.name}</div>
                    <div className="text-label-xs text-on-surface-variant">{lead.product}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold hidden sm:block ${lead.statusCls}`}>
                    {lead.status}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`https://wa.me/62${lead.phone.replace(/^0/, '').replace(/\D/g, '')}?text=${waText}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors" title="WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                    <Link to={`/produk/${lead.slug}`}
                      className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Lihat Produk">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          <Link to="/dashboard/agent/push"
            className="mt-4 w-full py-3 rounded-xl border border-dashed border-outline-variant/30 flex items-center justify-center gap-2 text-label-sm font-bold text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all">
            <Send className="w-4 h-4" /> Push Prospek Baru
          </Link>
        </motion.div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <motion.div variants={iv} className="glass-card rounded-xl p-5">
            <h4 className="font-display text-title-sm font-bold text-on-surface mb-4">Quick Actions</h4>
            <div className="space-y-2">
              {[
                { label: 'Product Knowledge', href: '/dashboard/agent/knowledge', icon: BookOpen, color: 'text-primary' },
                { label: 'Push Prospek Baru',  href: '/dashboard/agent/push',      icon: Send,     color: 'text-secondary' },
                { label: 'Tarik Komisi',         href: '/dashboard/agent/earnings',  icon: Wallet,   color: 'text-primary' },
              ].map((a) => (
                <Link key={a.href} to={a.href}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-high transition-colors group border border-transparent hover:border-outline-variant/10">
                  <div className="flex items-center gap-3">
                    <a.icon className={`w-4 h-4 ${a.color}`} />
                    <span className="font-body text-body-sm font-semibold text-on-surface-variant group-hover:text-on-surface transition-colors">{a.label}</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-on-surface-variant flex-shrink-0" />
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Recent Activity */}
          <motion.div variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden flex-1">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-secondary" />
              <h4 className="font-display text-title-sm font-bold text-on-surface">Aktivitas Terbaru</h4>
            </div>
            <div className="space-y-3">
              {recentActivity.map((act, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${act.color}`}>
                    <act.icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-body-sm text-on-surface leading-snug">{act.label}</p>
                    <div className="flex items-center gap-1 text-label-xs text-on-surface-variant mt-0.5">
                      <Clock className="w-2.5 h-2.5" />{act.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Leaderboard Teaser */}
          <motion.div variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden border border-secondary/15">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <h4 className="font-display text-title-sm font-bold text-on-surface">Ranking Anda</h4>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-headline-sm font-bold text-secondary">#3</div>
                <div className="text-label-xs text-on-surface-variant">dari 1,284 agen aktif</div>
              </div>
              <div className="text-right">
                <div className="text-label-xs text-on-surface-variant">Selisih ke #1</div>
                <div className="font-bold text-on-surface text-body-sm">2 penjualan</div>
              </div>
            </div>
            <div className="mt-3 w-full h-2 rounded-full bg-surface-high overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: '78%' }} />
            </div>
            <p className="text-label-xs text-on-surface-variant mt-1.5">78% menuju posisi #1</p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default AgentDashboard;
