import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, TrendingUp, MousePointerClick, Target,
  AlertCircle, CheckCircle2, Clock, Filter,
  ArrowUpRight, BarChart3, Globe, Share2, MessageCircle, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area,
} from 'recharts';

/* ─── Mock Data ───────────────────────────────────── */
const trafficData = [
  { day: 'Sen', clicks: 1280, leads: 74, conversions: 48 },
  { day: 'Sel', clicks: 1460, leads: 82, conversions: 55 },
  { day: 'Rab', clicks: 1650, leads: 90, conversions: 61 },
  { day: 'Kam', clicks: 1720, leads: 96, conversions: 66 },
  { day: 'Jum', clicks: 1810, leads: 101, conversions: 71 },
  { day: 'Sab', clicks: 1540, leads: 87, conversions: 58 },
  { day: 'Min', clicks: 1320, leads: 73, conversions: 44 },
];

const monthlyPageViews = [
  { month: 'Nov', views: 24200 },
  { month: 'Des', views: 28900 },
  { month: 'Jan', views: 32100 },
  { month: 'Feb', views: 38400 },
  { month: 'Mar', views: 35600 },
  { month: 'Apr', views: 44800 },
];

const sourceRows = [
  { source: 'Referral Link Agen', icon: Share2,          color: 'text-primary',   clicks: 3240, conversion: '8.1%', bar: 82 },
  { source: 'WhatsApp CTA',       icon: MessageCircle,   color: 'text-[#25D366]', clicks: 2910, conversion: '6.4%', bar: 72 },
  { source: 'Promo Landing Page', icon: Zap,             color: 'text-tertiary',  clicks: 1880, conversion: '5.2%', bar: 55 },
  { source: 'Blog & Artikel',     icon: Globe,           color: 'text-secondary', clicks: 1420, conversion: '4.8%', bar: 42 },
  { source: 'Instagram Profile',  icon: Share2,          color: 'text-pink-400',  clicks: 980,  conversion: '3.9%', bar: 30 },
];

const errorLogs = [
  { id: 'ERR-044', message: 'Sinkronisasi data komisi tertunda 15 menit', level: 'warning', time: '10 menit lalu', resolved: false },
  { id: 'ERR-043', message: 'Rate limit API WhatsApp Gateway melebihi batas', level: 'error', time: '1 jam lalu', resolved: false },
  { id: 'ERR-042', message: 'Backup database berhasil diselesaikan', level: 'success', time: '3 jam lalu', resolved: true },
  { id: 'ERR-041', message: 'Upload foto produk gagal (timeout >5s)', level: 'error', time: '5 jam lalu', resolved: true },
  { id: 'ERR-040', message: 'Cache katalog expired, refresh otomatis berjalan', level: 'info', time: '8 jam lalu', resolved: true },
];

const systemMetrics = [
  { label: 'Server Uptime',   value: '99.97%', sub: 'Last 30 hari',    ok: true },
  { label: 'API Latency',     value: '45ms',   sub: 'P95 response',    ok: true },
  { label: 'DB Load',         value: '12%',    sub: 'CPU utilization', ok: true },
  { label: 'Cache Hit Rate',  value: '87%',    sub: 'Redis cache',     ok: true },
  { label: 'Sync Status',     value: 'Delayed',sub: '15 mnt tertunda', ok: false },
  { label: 'CDN Status',      value: 'Online', sub: 'Edge nodes aktif',ok: true },
];

const levelConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  error:   { cls: 'bg-error/15 text-error',         icon: <AlertCircle className="w-3.5 h-3.5" /> },
  warning: { cls: 'bg-yellow-500/15 text-yellow-400', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  success: { cls: 'bg-secondary/15 text-secondary', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  info:    { cls: 'bg-primary/15 text-primary',     icon: <Activity className="w-3.5 h-3.5" /> },
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AdminTelemetryPage: React.FC = () => {
  const [logFilter, setLogFilter] = useState('Semua');
  const totalClicks = trafficData.reduce((s, d) => s + d.clicks, 0);
  const totalLeads  = trafficData.reduce((s, d) => s + d.leads, 0);
  const totalConvs  = trafficData.reduce((s, d) => s + d.conversions, 0);
  const convRate    = ((totalConvs / totalClicks) * 100).toFixed(2);

  const displayedLogs = errorLogs.filter((l) => {
    if (logFilter === 'Semua') return true;
    if (logFilter === 'Error') return l.level === 'error';
    if (logFilter === 'Warning') return l.level === 'warning';
    if (logFilter === 'Aktif') return !l.resolved;
    return true;
  });

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Monitoring & Analytics</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-primary" /> Telemetri & Analitik
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Real-time traffic, konversi funnel, sumber klik, dan status operasional sistem.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-label-sm font-bold inline-flex items-center gap-1.5 ${
              errorLogs.filter((l) => !l.resolved && l.level === 'error').length > 0
                ? 'bg-error/15 text-error'
                : 'bg-secondary/10 text-secondary'
            }`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              {errorLogs.filter((l) => !l.resolved && l.level === 'error').length > 0
                ? `${errorLogs.filter((l) => !l.resolved && l.level === 'error').length} Error Aktif`
                : 'Sistem Normal'
              }
            </span>
          </div>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Klik (7 Hari)', value: totalClicks.toLocaleString('id-ID'), sub: '+8.2% vs minggu lalu', color: 'text-primary',   bg: 'bg-primary/10',   icon: MousePointerClick },
          { label: 'Total Lead Masuk',    value: totalLeads,  sub: 'dari semua sumber',    color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: Target },
          { label: 'Konversi Aktual',     value: totalConvs,  sub: 'klik → transaksi',     color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2 },
          { label: 'Avg Conv. Rate',      value: `${convRate}%`, sub: 'minggu ini',         color: 'text-primary',   bg: 'bg-primary/10',   icon: TrendingUp },
        ].map((k) => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
            <div className="text-label-xs text-on-surface-variant mt-0.5">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic + Lead Line Chart */}
        <motion.div variants={iv} className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Klik · Lead · Konversi (7 Hari)</h3>
              <p className="text-label-sm text-on-surface-variant mt-0.5">Perbandingan traffic vs funnel konversi</p>
            </div>
          </div>
          <div className="flex items-center gap-5 mb-4 mt-2">
            {[{ label: 'Klik', color: 'bg-primary' }, { label: 'Lead', color: 'bg-tertiary' }, { label: 'Konversi', color: 'bg-secondary' }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-label-xs text-on-surface-variant">
                <span className={`w-3 h-3 rounded-full ${l.color}`} />{l.label}
              </div>
            ))}
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="day" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }} />
                <Line type="monotone" dataKey="clicks"      stroke="#8FF5FF" strokeWidth={2.5} dot={false} name="Klik" />
                <Line type="monotone" dataKey="leads"       stroke="#FF51FA" strokeWidth={2}   dot={false} name="Lead" />
                <Line type="monotone" dataKey="conversions" stroke="#A2F31F" strokeWidth={2}   dot={false} name="Konversi" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Monthly Page Views Area Chart */}
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-title-md font-bold text-on-surface">Page Views Bulanan</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Tren 6 bulan terakhir</p>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyPageViews}>
                <defs>
                  <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#A2F31F" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#A2F31F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis dataKey="month" stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  formatter={(v: unknown) => [`${((v as number) / 1000).toFixed(1)}K views`, '']} />
                <Area type="monotone" dataKey="views" stroke="#A2F31F" strokeWidth={2.5} fill="url(#pvGrad)" name="Views" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-surface-high">
            <div className="text-label-xs text-on-surface-variant">April (tertinggi)</div>
            <div className="font-display font-bold text-secondary">44.8K views</div>
            <div className="text-label-xs text-primary">↑ +25.8% vs Maret</div>
          </div>
        </motion.div>
      </div>

      {/* Source Table + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion Sources */}
        <motion.div variants={iv} className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />
          <h3 className="font-display text-title-md font-bold text-on-surface mb-5">Sumber Klik & Konversi</h3>
          <div className="space-y-4">
            {sourceRows.map((row) => (
              <div key={row.source} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <row.icon className={`w-4 h-4 ${row.color}`} />
                    <span className="font-semibold text-on-surface text-body-sm">{row.source}</span>
                  </div>
                  <div className="flex items-center gap-4 text-label-sm">
                    <span className="text-on-surface-variant">{row.clicks.toLocaleString('id-ID')} klik</span>
                    <span className="font-bold text-primary w-12 text-right">{row.conversion}</span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-high overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-700"
                    style={{ width: `${row.bar}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* System Health */}
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden flex flex-col gap-4">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
            <h3 className="font-display text-title-md font-bold text-on-surface">System Health</h3>
          </div>
          <div className="space-y-3">
            {systemMetrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-high/30 transition-colors">
                <div>
                  <div className="text-body-sm font-semibold text-on-surface">{m.label}</div>
                  <div className="text-label-xs text-on-surface-variant">{m.sub}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!m.ok && <span className="w-1.5 h-1.5 bg-error rounded-full animate-ping" />}
                  <span className={`font-bold text-body-sm ${m.ok ? 'text-secondary' : 'text-error'}`}>{m.value}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Error Logs */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-error" />
            <h3 className="font-display text-title-md font-bold text-on-surface">System Log</h3>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-on-surface-variant" />
            {['Semua', 'Error', 'Warning', 'Aktif'].map((f) => (
              <button key={f} type="button" onClick={() => setLogFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${logFilter === f ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {displayedLogs.map((log) => {
            const lc = levelConfig[log.level];
            return (
              <div key={log.id} className={`flex items-start gap-3 p-3.5 rounded-xl border ${log.resolved ? 'border-outline-variant/5 opacity-60' : 'border-outline-variant/15'} hover:bg-surface-high/30 transition-colors`}>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${lc.cls}`}>{lc.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface text-body-sm">{log.message}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-label-xs text-on-surface-variant">{log.id}</span>
                    <span className="text-label-xs text-on-surface-variant flex items-center gap-1">
                      <Clock className="w-3 h-3" />{log.time}
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold flex-shrink-0 ${log.resolved ? 'bg-surface-highest text-on-surface-variant' : lc.cls}`}>
                  {log.resolved ? 'Resolved' : 'Active'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between text-label-sm">
          <span className="text-on-surface-variant">{displayedLogs.length} log ditampilkan</span>
          <button type="button" className="text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
            Export Log <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminTelemetryPage;