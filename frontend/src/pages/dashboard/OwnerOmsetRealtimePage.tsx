import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Clock3, TrendingUp, Zap } from 'lucide-react';
import { ownerDashboardData, formatRupiah } from '../../data/ownerDashboardData';
import ComingSoonBadge from '../../components/dashboard/ComingSoonBadge';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const OwnerOmsetRealtimePage: React.FC = () => {
  const { omsetRealtime, omsetPerCabang } = ownerDashboardData;
  const hourlyRows = useMemo(() => omsetRealtime.hourlyData.map((row, index, items) => {
    const previous = index > 0 ? items[index - 1].cumulative : 0;
    return { ...row, addition: row.cumulative - previous };
  }), [omsetRealtime.hourlyData]);
  const peakHour = hourlyRows.reduce((best, row) => row.addition > best.addition ? row : best, hourlyRows[0]);
  const projected = Math.round(omsetRealtime.total * 1.18);
  const latestHour = hourlyRows[hourlyRows.length - 1]?.hour ?? '-';

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Realtime Monitor</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Omset Realtime All Cabang</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Akumulasi pendapatan seluruh cabang hari ini, diperbarui per jam.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ComingSoonBadge />
          <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-green-400/20 bg-green-400/10 px-4 py-2 text-label-sm font-bold text-green-500">
            <Activity className="h-4 w-4" />
            Live sampai {latestHour}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total Hari Ini</div>
              <div className="mt-1 font-display text-title-lg font-bold text-green-500">{formatRupiah(omsetRealtime.total)}</div>
            </div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Proyeksi Closing Day</div>
          <div className="mt-1 font-display text-title-lg font-bold text-primary">{formatRupiah(projected)}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Peak Hour</div>
              <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{peakHour?.hour ?? '-'}</div>
              <div className="mt-1 text-label-xs text-on-surface-variant">{peakHour ? `+${formatRupiah(peakHour.addition)}` : '-'}</div>
            </div>
            <Zap className="h-5 w-5 text-yellow-500" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Cabang Aktif</div>
              <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{omsetPerCabang.length}</div>
            </div>
            <Clock3 className="h-5 w-5 text-primary" />
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Akumulasi Omset Per Jam</h3>
        <p className="mt-1 text-label-xs text-on-surface-variant">Area hijau menunjukkan kumulatif, garis biru menunjukkan penambahan per jam.</p>
        <div className="mt-5 h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <AreaChart data={hourlyRows} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="omsetCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="omsetAddition" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" vertical={false} />
              <XAxis dataKey="hour" stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} formatter={(value, name) => [formatRupiah(Number(value)), name === 'cumulative' ? 'Kumulatif' : 'Penambahan']} />
              <Area type="monotone" dataKey="cumulative" stroke="#16a34a" strokeWidth={2.6} fill="url(#omsetCumulative)" dot={{ r: 2.5, fill: '#16a34a', strokeWidth: 0 }} />
              <Area type="monotone" dataKey="addition" stroke="#2563eb" strokeWidth={2.2} fill="url(#omsetAddition)" dot={{ r: 2.5, fill: '#2563eb', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="mb-4 font-display text-title-md font-bold text-on-surface">Detail Per Jam</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Jam</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Kumulatif</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Penambahan</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Momentum</th>
              </tr>
            </thead>
            <tbody>
              {hourlyRows.map((row) => (
                <tr key={row.hour} className="border-b border-outline-variant/10 transition hover:bg-surface-high/30">
                  <td className="px-4 py-3 text-body-sm font-bold text-on-surface">{row.hour}</td>
                  <td className="px-4 py-3 text-right text-body-sm font-bold text-on-surface">{formatRupiah(row.cumulative)}</td>
                  <td className="px-4 py-3 text-right text-body-sm font-bold text-green-500">+{formatRupiah(row.addition)}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-high">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (row.addition / peakHour.addition) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OwnerOmsetRealtimePage;
