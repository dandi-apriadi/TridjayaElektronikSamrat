import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Building2, Crown, Gauge, TrendingUp } from 'lucide-react';
import { ownerDashboardData, formatRupiah } from '../../data/ownerDashboardData';
import ComingSoonBadge from '../../components/dashboard/ComingSoonBadge';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };
const colors = ['#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#dc2626'];

const OwnerOmsetCabangPage: React.FC = () => {
  const branches = useMemo(
    () => [...ownerDashboardData.omsetPerCabang].sort((a, b) => b.omset - a.omset),
    []
  );
  const totalOmset = branches.reduce((sum, branch) => sum + branch.omset, 0);
  const averageOmset = Math.round(totalOmset / Math.max(branches.length, 1));
  const topBranch = branches[0];
  const lowestBranch = branches[branches.length - 1];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Owner Control</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Omset Per Cabang</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Bandingkan kontribusi pendapatan seluruh cabang aktif bulan ini.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ComingSoonBadge />
          <span className="w-fit rounded-xl border border-outline-variant/10 bg-surface-high px-4 py-2 text-label-sm font-bold text-on-surface">{branches.length} cabang aktif</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total Omset</div>
              <div className="mt-1 font-display text-title-lg font-bold text-primary">{formatRupiah(totalOmset)}</div>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Rata-rata Cabang</div>
          <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{formatRupiah(averageOmset)}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Cabang Tertinggi</div>
              <div className="mt-1 font-display text-title-md font-bold text-on-surface">{topBranch?.cabang ?? '-'}</div>
              <div className="mt-1 text-label-xs text-on-surface-variant">{topBranch ? formatRupiah(topBranch.omset) : '-'}</div>
            </div>
            <Crown className="h-5 w-5 text-yellow-500" />
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Perlu Dorongan</div>
              <div className="mt-1 font-display text-title-md font-bold text-on-surface">{lowestBranch?.cabang ?? '-'}</div>
              <div className="mt-1 text-label-xs text-on-surface-variant">{lowestBranch ? formatRupiah(lowestBranch.omset) : '-'}</div>
            </div>
            <Gauge className="h-5 w-5 text-red-500" />
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Kontribusi Cabang</h3>
            <p className="mt-1 text-label-xs text-on-surface-variant">Urutan omset tertinggi sampai terendah.</p>
          </div>
        </div>
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <BarChart layout="vertical" data={branches} margin={{ top: 4, right: 72, left: 10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" horizontal={false} />
              <XAxis type="number" stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
              <YAxis type="category" dataKey="cabang" width={116} stroke="rgba(51,65,85,0.84)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} formatter={(value) => [formatRupiah(Number(value)), 'Omset']} />
              <Bar dataKey="omset" radius={[0, 7, 7, 0]} barSize={26} background={{ fill: 'rgba(100,116,139,0.08)', radius: 7 }}>
                {branches.map((branch, index) => <Cell key={branch.cabang} fill={colors[Math.min(index, colors.length - 1)]} />)}
                <LabelList dataKey="omset" position="right" formatter={(value) => `${Math.round(Number(value) / 1_000_000)}Jt`} fill="rgba(15,23,42,0.78)" fontSize={11} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="mb-4 font-display text-title-md font-bold text-on-surface">Detail Cabang</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Cabang</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Omset</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Kontribusi</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Progress</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch, index) => {
                const contribution = totalOmset > 0 ? (branch.omset / totalOmset) * 100 : 0;
                return (
                  <tr key={branch.cabang} className="border-b border-outline-variant/10 transition hover:bg-surface-high/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-body-sm font-bold text-on-surface">
                        <Building2 className="h-4 w-4 text-primary" />
                        {branch.cabang}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-body-sm font-bold text-on-surface">{formatRupiah(branch.omset)}</td>
                    <td className="px-4 py-3 text-right text-body-sm text-on-surface-variant">{contribution.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="h-2 overflow-hidden rounded-full bg-surface-high">
                        <div className="h-full rounded-full" style={{ width: `${contribution}%`, backgroundColor: colors[Math.min(index, colors.length - 1)] }} />
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

export default OwnerOmsetCabangPage;
