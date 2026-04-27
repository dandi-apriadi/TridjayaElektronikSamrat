import React, { useEffect, useMemo } from 'react';
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
import { useAgentStore } from '../../store/useAgentStore';

const statusBadge: Record<string, string> = {
  'Follow Up': 'bg-primary/15 text-primary',
  'Negosiasi': 'bg-tertiary/15 text-tertiary',
  'Closed Won': 'bg-secondary/15 text-secondary',
  'Closed Lost': 'bg-error/10 text-error',
};

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

/* ─── Variants ────────────────────────────────────────── */
const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

/* ─── Component ───────────────────────────────────────── */
const AgentDashboard: React.FC = () => {
  const { leads, claims, stats, rewardTiers, fetchLeads, fetchClaims, fetchStats, fetchRewardTiers } = useAgentStore();

  useEffect(() => {
    fetchLeads();
    fetchClaims();
    fetchStats();
    fetchRewardTiers();
  }, [fetchLeads, fetchClaims, fetchStats, fetchRewardTiers]);

  const closedWon = leads.filter((lead) => lead.status === 'Closed Won').length;
  const activeLeads = leads.filter((lead) => lead.status === 'Follow Up' || lead.status === 'Negosiasi').length;
  const conversionRate = leads.length > 0 ? ((closedWon / leads.length) * 100).toFixed(1) : '0.0';

  const weeklyData = useMemo(() => {
    const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const items = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const day = dayLabels[date.getDay()];
      const count = leads.filter((lead) => {
        const created = new Date(lead.createdAt);
        return created.toDateString() === date.toDateString();
      }).length;
      return { day, amount: count };
    });
    return items;
  }, [leads]);

  const monthlyTrend = useMemo(() => {
    const items = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const count = leads.filter((lead) => {
        const created = new Date(lead.createdAt);
        return `${created.getFullYear()}-${created.getMonth()}` === key;
      }).length;
      return {
        month: date.toLocaleDateString('id-ID', { month: 'short' }),
        komisi: count,
      };
    });
    return items;
  }, [leads]);

  const rankingProgress = useMemo(() => {
    const points = stats?.points ?? 0;
    const activeTiers = [...rewardTiers].filter((tier) => tier.isActive).sort((a, b) => a.thresholdPoints - b.thresholdPoints);
    if (activeTiers.length === 0) {
      return { percent: Math.min(100, (points / 1000) * 100), remaining: Math.max(0, 1000 - points), nextTier: 'Target Awal' };
    }

    const currentTierIndex = activeTiers.findIndex((tier) => tier.name === stats?.currentTier);
    if (currentTierIndex >= activeTiers.length - 1 && currentTierIndex !== -1) {
      return { percent: 100, remaining: 0, nextTier: null as string | null };
    }

    const nextTier = currentTierIndex >= 0 ? activeTiers[currentTierIndex + 1] : activeTiers[0];
    const currentThreshold = currentTierIndex >= 0 ? activeTiers[currentTierIndex].thresholdPoints : 0;
    const nextThreshold = nextTier?.thresholdPoints ?? Math.max(points, currentThreshold + 1);
    const progressBase = Math.max(1, nextThreshold - currentThreshold);
    const percent = Math.max(0, Math.min(100, ((points - currentThreshold) / progressBase) * 100));
    const remaining = nextTier ? Math.max(0, nextThreshold - points) : 0;

    return {
      percent,
      remaining,
      nextTier: nextTier?.name ?? null,
    };
  }, [rewardTiers, stats?.currentTier, stats?.points]);

  const hotLeads = leads.slice(0, 4);
  const recentActivity = useMemo(() => {
    const leadActivity = leads.slice(0, 3).map((lead) => ({
      key: `lead-${lead.id}`,
      icon: Send,
      color: 'text-primary bg-primary/10',
      label: `Lead ${lead.customerName} untuk ${lead.interestedProduct}`,
      time: formatRelativeTime(lead.createdAt),
    }));

    const claimActivity = claims.slice(0, 3).map((claim) => ({
      key: `claim-${claim.id}`,
      icon: claim.status === 'completed' ? CheckCircle2 : Wallet,
      color: claim.status === 'completed' ? 'text-secondary bg-secondary/10' : 'text-tertiary bg-tertiary/10',
      label: `Claim ${claim.rewardName} (${claim.status})`,
      time: formatRelativeTime(claim.submittedAt),
    }));

    return [...leadActivity, ...claimActivity].slice(0, 4);
  }, [claims, leads]);

  const kpis = [
    { label: 'Poin Agen',  value: `${stats?.points ?? 0}`, change: `Tier ${stats?.currentTier ?? 'Unranked'}`, up: true, icon: DollarSign, color: 'text-primary',   bg: 'bg-primary/10',   href: '/dashboard/agent/earnings' },
    { label: 'Penjualan Sukses',  value: `${stats?.salesCount ?? 0} Unit`,   change: `${closedWon} closed won`,     up: true, icon: Target,     color: 'text-secondary', bg: 'bg-secondary/10', href: '/dashboard/agent/leads' },
    { label: 'Prospek Aktif',     value: `${activeLeads}`,        change: `${leads.length} total lead`,     up: true, icon: Users,      color: 'text-tertiary',  bg: 'bg-tertiary/10',  href: '/dashboard/agent/leads' },
    { label: 'Konversi Lead',     value: `${conversionRate}%`,     change: `claim ${claims.length}`,  up: true, icon: TrendingUp, color: 'text-primary',   bg: 'bg-primary/10',   href: '/dashboard/agent/knowledge' },
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
              Anda punya <strong className="text-secondary">{activeLeads} prospek</strong> aktif dan{' '}
              <strong className="text-primary">{claims.length} claim</strong> yang terpantau di sistem.
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
              <p className="text-label-sm text-on-surface-variant mt-0.5">Lead masuk 7 hari terakhir</p>
            </div>
            <div className="text-right">
              <div className="font-display font-bold text-secondary text-title-md">{weeklyData.reduce((sum, row) => sum + row.amount, 0)}</div>
              <div className="text-label-xs text-on-surface-variant">Total minggu ini</div>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="day" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${v}`} />
                <Tooltip
                  cursor={{ fill: 'rgba(143,245,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  formatter={(v: unknown) => [`${v as number}`, 'Lead']}
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
            <p className="text-label-sm text-on-surface-variant mt-0.5">Pertumbuhan lead bulanan</p>
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
                  formatter={(v: unknown) => [`${v as number}`, 'Lead']}
                />
                <Area type="monotone" dataKey="komisi" stroke="#A2F31F" strokeWidth={2.5} fill="url(#agGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-surface-high">
            <div className="text-label-xs text-on-surface-variant">Periode aktif terakhir</div>
            <div className="font-display font-bold text-secondary">{monthlyTrend.at(-1)?.komisi ?? 0} lead</div>
            <div className="text-label-xs text-primary">Data berbasis API leads</div>
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
              const waText = encodeURIComponent(`Halo ${lead.customerName}, saya dari Tridjaya Manado. Ingin menindaklanjuti minat Anda pada ${lead.interestedProduct}.`);
              return (
                <div key={lead.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-outline-variant/10 hover:bg-surface-high/30 transition-colors group">
                  <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                    {lead.customerName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-on-surface text-body-sm">{lead.customerName}</div>
                    <div className="text-label-xs text-on-surface-variant">{lead.interestedProduct}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold hidden sm:block ${statusBadge[lead.status] || 'bg-surface-highest text-on-surface-variant'}`}>
                    {lead.status}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <a href={`https://wa.me/62${lead.phoneNumber.replace(/^0/, '').replace(/\D/g, '')}?text=${waText}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition-colors" title="WhatsApp">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                    <Link to="/dashboard/agent/leads"
                      className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Lihat Produk">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
            {hotLeads.length === 0 && (
              <div className="py-8 text-center text-on-surface-variant text-body-sm">Belum ada lead aktif.</div>
            )}
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
              {recentActivity.map((act) => (
                <div key={act.key} className="flex items-start gap-3">
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
              {recentActivity.length === 0 && (
                <div className="text-body-sm text-on-surface-variant">Belum ada aktivitas terbaru.</div>
              )}
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
                <div className="font-display text-headline-sm font-bold text-secondary">{stats?.currentTier ?? 'Unranked'}</div>
                <div className="text-label-xs text-on-surface-variant">tier saat ini</div>
              </div>
              <div className="text-right">
                <div className="text-label-xs text-on-surface-variant">Total Sales</div>
                <div className="font-bold text-on-surface text-body-sm">{stats?.salesCount ?? 0} unit</div>
              </div>
            </div>
            <div className="mt-3 w-full h-2 rounded-full bg-surface-high overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${rankingProgress.percent}%` }} />
            </div>
            <p className="text-label-xs text-on-surface-variant mt-1.5">
              {stats?.points ?? 0} poin terkumpul{rankingProgress.nextTier ? ` · ${rankingProgress.remaining} poin lagi ke ${rankingProgress.nextTier}` : ''}
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default AgentDashboard;
