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
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import type { TelemetryStats } from '../../store/useAdminNetworkStore';

const sourceConfig: Record<string, { icon: typeof Share2; color: string }> = {
  'Referral Link Agen': { icon: Share2,          color: 'text-primary' },
  'WhatsApp CTA':       { icon: MessageCircle,   color: 'text-[#25D366]' },
  'Promo Landing Page': { icon: Zap,             color: 'text-tertiary' },
  'Blog & Artikel':     { icon: Globe,           color: 'text-secondary' },
  'Instagram Profile':  { icon: Share2,          color: 'text-pink-400' },
  'unknown':            { icon: Activity,        color: 'text-on-surface-variant' },
};

const levelConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  error:   { cls: 'bg-error/15 text-error',         icon: <AlertCircle className="w-3.5 h-3.5" /> },
  warning: { cls: 'bg-yellow-500/15 text-yellow-400', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  success: { cls: 'bg-secondary/15 text-secondary', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  info:    { cls: 'bg-primary/15 text-primary',     icon: <Activity className="w-3.5 h-3.5" /> },
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const contentTypeConfig: Record<string, { label: string; className: string }> = {
  page: { label: 'Page', className: 'bg-primary/15 text-primary' },
  product: { label: 'Product', className: 'bg-secondary/15 text-secondary' },
  article: { label: 'Article', className: 'bg-tertiary/15 text-tertiary' },
  promo: { label: 'Promo', className: 'bg-yellow-500/15 text-yellow-400' },
};

const AdminTelemetryPage: React.FC = () => {
  const { telemetryStats, fetchTelemetryStats } = useAdminNetworkStore();
  
  React.useEffect(() => {
    fetchTelemetryStats();
  }, [fetchTelemetryStats]);

  const [logFilter, setLogFilter] = useState('Semua');

  // Always API-driven; show empty state while data has not arrived.
  const data: TelemetryStats = telemetryStats || {
    trafficData: [],
    monthlyPageViews: [],
    sourceRows: [],
    topContentRows: [],
    systemMetrics: [],
    errorLogs: []
  };

  const trafficData = Array.isArray(data.trafficData) ? data.trafficData : [];
  const monthlyPageViews = Array.isArray(data.monthlyPageViews) ? data.monthlyPageViews : [];
  const sourceRows = Array.isArray(data.sourceRows) ? data.sourceRows : [];
  const topContentRows = Array.isArray((data as any).topContentRows) ? (data as any).topContentRows : [];
  const systemMetrics = Array.isArray(data.systemMetrics) ? data.systemMetrics : [];
  const errorLogs = Array.isArray(data.errorLogs) ? data.errorLogs : [];

  const totalClicks = trafficData.reduce((s, d) => s + d.clicks, 0);
  const totalLeads  = trafficData.reduce((s, d) => s + d.leads, 0);
  const totalConvs  = trafficData.reduce((s, d) => s + d.conversions, 0);
  const convRate    = totalClicks > 0 ? ((totalConvs / totalClicks) * 100).toFixed(2) : "0.00";

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
              data.errorLogs.filter((l) => !l.resolved && l.level === 'error').length > 0
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
          { label: 'Total Klik (7 Hari)', value: totalClicks.toLocaleString('id-ID'), sub: 'akumulasi klik link', color: 'text-primary',   bg: 'bg-primary/10',   icon: MousePointerClick },
          { label: 'Total Lead Masuk',    value: totalLeads,  sub: 'dari semua sumber',    color: 'text-tertiary',  bg: 'bg-tertiary/10',  icon: Target },
          { label: 'Konversi Aktual',     value: totalConvs,  sub: 'klik → transaksi',     color: 'text-secondary', bg: 'bg-secondary/10', icon: CheckCircle2 },
          { label: 'Avg Conv. Rate',      value: `${convRate}%`, sub: 'rata-rata konversi',         color: 'text-primary',   bg: 'bg-primary/10',   icon: TrendingUp },
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
          <div className="h-[240px] w-full min-h-[240px] relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="mb-4">
            <h3 className="font-display text-title-md font-bold text-on-surface">Page Views Bulanan</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Tren 6 bulan terakhir</p>
          </div>
          <div className="h-[200px] w-full min-h-[200px] flex-1 relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
          {monthlyPageViews.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-surface-high">
              <div className="text-label-xs text-on-surface-variant">Bulan Terakhir</div>
              <div className="font-display font-bold text-secondary">
                {(monthlyPageViews[monthlyPageViews.length - 1].views).toLocaleString('id-ID')} views
              </div>
              <div className="text-label-xs text-on-surface-variant">Data real-time dari sistem</div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Source Table + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion Sources */}
        <motion.div variants={iv} className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/30 to-transparent" />
          <h3 className="font-display text-title-md font-bold text-on-surface mb-5">Sumber Klik & Konversi</h3>
          <div className="space-y-4">
            {sourceRows.map((row) => {
              const conf = sourceConfig[row.source] || sourceConfig['unknown'];
              const IconComp = conf.icon;
              const colorCls = conf.color;
              return (
              <div key={row.source} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <IconComp className={`w-4 h-4 ${colorCls}`} />
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
              )
            })}
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

      {/* Top Content */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Top Halaman, Produk, dan Artikel</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">Urutan berdasarkan page view dengan klik dan lead pendukung</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/10 text-label-xs uppercase tracking-widest text-on-surface-variant">
                <th className="py-3 pr-4">Konten</th>
                <th className="py-3 pr-4">Tipe</th>
                <th className="py-3 pr-4 text-right">Views</th>
                <th className="py-3 pr-4 text-right">Clicks</th>
                <th className="py-3 text-right">Leads</th>
              </tr>
            </thead>
            <tbody>
              {topContentRows.map((row: {
                contentType?: string;
                contentKey: string;
                contentTitle: string;
                views: number;
                clicks: number;
                leads: number;
              }) => {
                const contentType = row.contentType ?? 'page';
                const conf = contentTypeConfig[contentType] || contentTypeConfig.page;
                return (
                  <tr key={row.contentKey} className="border-b border-outline-variant/5 last:border-0 hover:bg-surface-high/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-on-surface">{row.contentTitle}</div>
                      <div className="text-label-xs text-on-surface-variant">{row.contentKey}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex px-2 py-1 rounded-md text-label-xs font-bold ${conf.className}`}>
                        {conf.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right text-on-surface">{row.views.toLocaleString('id-ID')}</td>
                    <td className="py-3 pr-4 text-right text-on-surface-variant">{row.clicks.toLocaleString('id-ID')}</td>
                    <td className="py-3 text-right text-secondary">{row.leads.toLocaleString('id-ID')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {topContentRows.length === 0 && (
            <div className="py-8 text-center text-on-surface-variant text-body-sm">
              Belum ada data konten yang cukup untuk ditampilkan.
            </div>
          )}
        </div>
      </motion.div>

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
