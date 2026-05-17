import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Handshake, Sparkles, Target, Trophy } from 'lucide-react';
import { ownerDashboardData } from '../../data/ownerDashboardData';
import ComingSoonBadge from '../../components/dashboard/ComingSoonBadge';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };
const rankColors = ['#f59e0b', '#94a3b8', '#b45309', '#0891b2'];

const OwnerTopNonSalesPage: React.FC = () => {
  const topNonSales = useMemo(() => [...ownerDashboardData.topNonSales].sort((a, b) => a.rank - b.rank), []);
  const totalContributions = topNonSales.reduce((sum, entry) => sum + entry.contributionCount, 0);
  const averageContribution = Math.round(totalContributions / Math.max(topNonSales.length, 1));
  const topContributor = topNonSales[0];
  const topThreeContribution = topNonSales.slice(0, 3).reduce((sum, entry) => sum + entry.contributionCount, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Contribution Ranking</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Top 10 Non-Sales</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Ranking kontribusi prospek, referral, dan dukungan operasional bulan berjalan.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ComingSoonBadge />
          <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-green-400/10 px-4 py-2 text-label-sm font-bold text-green-500">
            <Trophy className="h-4 w-4" />
            Leader: {topContributor?.name ?? '-'}
          </span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total Kontribusi</div>
          <div className="mt-1 font-display text-title-lg font-bold text-primary">{totalContributions.toLocaleString('id-ID')}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Rata-rata Per Orang</div>
          <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{averageContribution}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Top Contributor</div>
              <div className="mt-1 font-display text-title-md font-bold text-on-surface">{topContributor?.name ?? '-'}</div>
              <div className="mt-1 text-label-xs text-on-surface-variant">{topContributor ? `${topContributor.contributionCount} kontribusi` : '-'}</div>
            </div>
            <Sparkles className="h-5 w-5 text-green-500" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Kontribusi Top 3</div>
          <div className="mt-1 font-display text-title-lg font-bold text-green-500">{totalContributions > 0 ? `${((topThreeContribution / totalContributions) * 100).toFixed(1)}%` : '0%'}</div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Kontribusi Non-Sales</h3>
        <p className="mt-1 text-label-xs text-on-surface-variant">Total kontribusi gabungan dari aktivitas non-sales bulan ini.</p>
        <div className="mt-5 h-[460px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <BarChart layout="vertical" data={topNonSales} margin={{ top: 4, right: 54, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" horizontal={false} />
              <XAxis type="number" stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" width={132} stroke="rgba(51,65,85,0.84)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} formatter={(value) => [`${value} kontribusi`, 'Total']} />
              <Bar dataKey="contributionCount" radius={[0, 7, 7, 0]} barSize={24} background={{ fill: 'rgba(100,116,139,0.08)', radius: 7 }}>
                {topNonSales.map((entry, index) => <Cell key={entry.name} fill={rankColors[Math.min(index, rankColors.length - 1)]} />)}
                <LabelList dataKey="contributionCount" position="right" fill="rgba(15,23,42,0.78)" fontSize={11} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="mb-4 font-display text-title-md font-bold text-on-surface">Detail Ranking Non-Sales</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Rank</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Nama</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Kontribusi</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">% Total</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Momentum</th>
              </tr>
            </thead>
            <tbody>
              {topNonSales.map((entry) => {
                const contribution = totalContributions > 0 ? (entry.contributionCount / totalContributions) * 100 : 0;
                return (
                  <tr key={entry.rank} className="border-b border-outline-variant/10 transition hover:bg-surface-high/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {entry.rank <= 3 ? <Award className="h-4 w-4 text-yellow-500" /> : <Target className="h-4 w-4 text-on-surface-variant" />}
                        <span className="text-body-sm font-bold text-on-surface">#{entry.rank}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-body-sm font-bold text-on-surface">
                        <Handshake className="h-4 w-4 text-primary" />
                        {entry.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-body-sm font-bold text-on-surface">{entry.contributionCount}</td>
                    <td className="px-4 py-3 text-right text-body-sm text-on-surface-variant">{contribution.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-high">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${contribution}%` }} />
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

export default OwnerTopNonSalesPage;
