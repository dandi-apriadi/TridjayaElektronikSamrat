import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Crown, Target, Trophy } from 'lucide-react';
import { ownerDashboardData, formatRupiah } from '../../data/ownerDashboardData';
import ComingSoonBadge from '../../components/dashboard/ComingSoonBadge';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };
const rankColors = ['#f59e0b', '#94a3b8', '#b45309', '#2563eb'];

const OwnerTopSalesPage: React.FC = () => {
  const topSales = useMemo(() => [...ownerDashboardData.topSales].sort((a, b) => a.rank - b.rank), []);
  const totalRevenue = topSales.reduce((sum, sales) => sum + sales.revenue, 0);
  const averageRevenue = Math.round(totalRevenue / Math.max(topSales.length, 1));
  const topPerformer = topSales[0];
  const topThreeRevenue = topSales.slice(0, 3).reduce((sum, sales) => sum + sales.revenue, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Performance Ranking</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Top 10 Sales</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Ranking sales berdasarkan revenue bulan berjalan.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ComingSoonBadge />
          <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-yellow-400/10 px-4 py-2 text-label-sm font-bold text-yellow-500">
            <Crown className="h-4 w-4" />
            Leader: {topPerformer?.name ?? '-'}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Revenue Top 10</div>
          <div className="mt-1 font-display text-title-lg font-bold text-primary">{formatRupiah(totalRevenue)}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Rata-rata Sales</div>
          <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{formatRupiah(averageRevenue)}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Top Performer</div>
              <div className="mt-1 font-display text-title-md font-bold text-on-surface">{topPerformer?.name ?? '-'}</div>
              <div className="mt-1 text-label-xs text-on-surface-variant">{topPerformer ? formatRupiah(topPerformer.revenue) : '-'}</div>
            </div>
            <Trophy className="h-5 w-5 text-yellow-500" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Kontribusi Top 3</div>
          <div className="mt-1 font-display text-title-lg font-bold text-green-500">{totalRevenue > 0 ? `${((topThreeRevenue / totalRevenue) * 100).toFixed(1)}%` : '0%'}</div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Revenue Sales</h3>
        <p className="mt-1 text-label-xs text-on-surface-variant">Ranking horizontal, semakin panjang bar semakin besar revenue.</p>
        <div className="mt-5 h-[460px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <BarChart layout="vertical" data={topSales} margin={{ top: 4, right: 74, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" horizontal={false} />
              <XAxis type="number" stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
              <YAxis type="category" dataKey="name" width={132} stroke="rgba(51,65,85,0.84)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} formatter={(value) => [formatRupiah(Number(value)), 'Revenue']} />
              <Bar dataKey="revenue" radius={[0, 7, 7, 0]} barSize={24} background={{ fill: 'rgba(100,116,139,0.08)', radius: 7 }}>
                {topSales.map((sales, index) => <Cell key={sales.name} fill={rankColors[Math.min(index, rankColors.length - 1)]} />)}
                <LabelList dataKey="revenue" position="right" formatter={(value) => `${Math.round(Number(value) / 1_000_000)}Jt`} fill="rgba(15,23,42,0.78)" fontSize={11} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="mb-4 font-display text-title-md font-bold text-on-surface">Detail Ranking Sales</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Rank</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Nama</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Revenue</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Kontribusi</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Momentum</th>
              </tr>
            </thead>
            <tbody>
              {topSales.map((sales) => {
                const contribution = totalRevenue > 0 ? (sales.revenue / totalRevenue) * 100 : 0;
                return (
                  <tr key={sales.rank} className="border-b border-outline-variant/10 transition hover:bg-surface-high/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {sales.rank <= 3 ? <Award className="h-4 w-4 text-yellow-500" /> : <Target className="h-4 w-4 text-on-surface-variant" />}
                        <span className="text-body-sm font-bold text-on-surface">#{sales.rank}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body-sm font-bold text-on-surface">{sales.name}</td>
                    <td className="px-4 py-3 text-right text-body-sm font-bold text-on-surface">{formatRupiah(sales.revenue)}</td>
                    <td className="px-4 py-3 text-right text-body-sm text-on-surface-variant">{contribution.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-high">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${contribution}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OwnerTopSalesPage;
