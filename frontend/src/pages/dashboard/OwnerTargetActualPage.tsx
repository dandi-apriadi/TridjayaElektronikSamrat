import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, Layers3, Search, Target, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { calculateGapPercentage, formatRupiah } from '../../data/ownerDashboardData';
import ComingSoonBadge from '../../components/dashboard/ComingSoonBadge';

type Scope = 'all' | 'branch' | 'division' | 'employee';

type TargetActualRow = {
  id: string;
  name: string;
  scope: Exclude<Scope, 'all'>;
  branch?: string;
  division?: string;
  target: number;
  actual: number;
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const rows: TargetActualRow[] = [
  { id: 'br-manado', name: 'Manado Utama', scope: 'branch', target: 520_000_000, actual: 485_000_000 },
  { id: 'br-bitung', name: 'Bitung', scope: 'branch', target: 340_000_000, actual: 362_000_000 },
  { id: 'br-tomohon', name: 'Tomohon', scope: 'branch', target: 310_000_000, actual: 294_000_000 },
  { id: 'br-kotamobagu', name: 'Kotamobagu', scope: 'branch', target: 220_000_000, actual: 231_000_000 },
  { id: 'br-tondano', name: 'Tondano', scope: 'branch', target: 205_000_000, actual: 187_000_000 },
  { id: 'dv-elektronik', name: 'Elektronik', scope: 'division', target: 640_000_000, actual: 672_000_000 },
  { id: 'dv-mobility', name: 'Sepeda Listrik', scope: 'division', target: 520_000_000, actual: 488_000_000 },
  { id: 'dv-furniture', name: 'Furniture', scope: 'division', target: 285_000_000, actual: 254_000_000 },
  { id: 'dv-dining', name: 'Dining Set', scope: 'division', target: 150_000_000, actual: 145_000_000 },
  { id: 'emp-randy', name: 'Randy Kalalo', scope: 'employee', branch: 'Manado Utama', division: 'Elektronik', target: 175_000_000, actual: 188_000_000 },
  { id: 'emp-novi', name: 'Novi Lumenta', scope: 'employee', branch: 'Tomohon', division: 'Sepeda Listrik', target: 170_000_000, actual: 176_000_000 },
  { id: 'emp-fajar', name: 'Fajar Rumengan', scope: 'employee', branch: 'Bitung', division: 'Elektronik', target: 168_000_000, actual: 165_000_000 },
  { id: 'emp-alicia', name: 'Alicia Wuisan', scope: 'employee', branch: 'Manado Utama', division: 'Furniture', target: 160_000_000, actual: 153_000_000 },
  { id: 'emp-dion', name: 'Dion Paat', scope: 'employee', branch: 'Kotamobagu', division: 'Sepeda Listrik', target: 140_000_000, actual: 149_000_000 },
  { id: 'emp-kevin', name: 'Kevin Mambu', scope: 'employee', branch: 'Tondano', division: 'Elektronik', target: 150_000_000, actual: 141_000_000 },
  { id: 'emp-wendy', name: 'Wendy Langi', scope: 'employee', branch: 'Bitung', division: 'Dining Set', target: 132_000_000, actual: 138_000_000 },
  { id: 'emp-siska', name: 'Siska Tuerah', scope: 'employee', branch: 'Tomohon', division: 'Furniture', target: 135_000_000, actual: 129_000_000 },
  { id: 'emp-eka', name: 'Eka Tumundo', scope: 'employee', branch: 'Manado Utama', division: 'Elektronik', target: 128_000_000, actual: 122_000_000 },
  { id: 'emp-rizky', name: 'Rizky Wenas', scope: 'employee', branch: 'Kotamobagu', division: 'Sepeda Listrik', target: 120_000_000, actual: 118_000_000 },
];

const scopeConfig = {
  all: { label: 'All Cabang', icon: Target },
  branch: { label: 'Masing-masing Cabang', icon: Building2 },
  division: { label: 'Masing-masing Divisi', icon: Layers3 },
  employee: { label: 'Masing-masing Karyawan', icon: Users },
};

function pct(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
}

function gap(actual: number, target: number) {
  return Math.round(calculateGapPercentage(actual, target) * 10) / 10;
}

const OwnerTargetActualPage: React.FC = () => {
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');

  const allRow = useMemo<TargetActualRow>(() => {
    const branchRows = rows.filter((row) => row.scope === 'branch');
    return {
      id: 'all-cabang',
      name: 'Seluruh Cabang',
      scope: 'branch',
      target: branchRows.reduce((sum, row) => sum + row.target, 0),
      actual: branchRows.reduce((sum, row) => sum + row.actual, 0),
    };
  }, []);

  const activeRows = useMemo(() => {
    const source = scope === 'all' ? [allRow] : rows.filter((row) => row.scope === scope);
    const query = search.trim().toLowerCase();
    return source
      .filter((row) => query.length === 0 || `${row.name} ${row.branch ?? ''} ${row.division ?? ''}`.toLowerCase().includes(query))
      .sort((a, b) => pct(b.actual, b.target) - pct(a.actual, a.target));
  }, [allRow, scope, search]);

  const totalTarget = activeRows.reduce((sum, row) => sum + row.target, 0);
  const totalActual = activeRows.reduce((sum, row) => sum + row.actual, 0);
  const totalGap = gap(totalActual, totalTarget);
  const achievedCount = activeRows.filter((row) => row.actual >= row.target).length;
  const topRow = activeRows[0];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Owner Control</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Target vs Actual</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">Pantau pencapaian target dari level seluruh cabang sampai tiap karyawan.</p>
        </div>
        <div className="flex flex-col items-start gap-2 lg:items-end">
          <ComingSoonBadge />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {(Object.keys(scopeConfig) as Scope[]).map((key) => {
              const Icon = scopeConfig[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setScope(key)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-label-sm font-bold transition ${scope === key ? 'bg-primary text-on-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}
                >
                  <Icon className="h-4 w-4" />
                  {scopeConfig[key].label}
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total Target</div>
          <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{formatRupiah(totalTarget)}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total Actual</div>
          <div className="mt-1 font-display text-title-lg font-bold text-primary">{formatRupiah(totalActual)}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Gap</div>
          <div className={`mt-1 flex items-center gap-2 font-display text-title-lg font-bold ${totalGap >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalGap >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            {totalGap > 0 ? '+' : ''}{totalGap}%
          </div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Tercapai</div>
          <div className="mt-1 font-display text-title-lg font-bold text-on-surface">{achievedCount}/{activeRows.length}</div>
          <div className="mt-1 text-label-xs text-on-surface-variant">Top: {topRow?.name ?? '-'}</div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Grafik {scopeConfig[scope].label}</h3>
            <p className="mt-1 text-label-xs text-on-surface-variant">Target dan actual ditampilkan berdampingan untuk setiap scope.</p>
          </div>
          {scope !== 'all' && (
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari data..."
                className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface px-9 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <BarChart data={activeRows} margin={{ top: 18, right: 24, left: 12, bottom: 6 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(22, 27, 34, 0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} formatter={(value) => [formatRupiah(Number(value)), '']} />
              <Bar dataKey="target" name="Target" fill="#64748b" radius={[6, 6, 0, 0]} barSize={26} />
              <Bar dataKey="actual" name="Actual" radius={[6, 6, 0, 0]} barSize={26}>
                {activeRows.map((row) => (
                  <Cell key={row.id} fill={row.actual >= row.target ? '#16a34a' : '#dc2626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Detail {scopeConfig[scope].label}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Nama</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Scope</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Target</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Actual</th>
                <th className="px-4 py-3 text-right text-label-xs uppercase tracking-widest text-on-surface-variant">Achievement</th>
                <th className="px-4 py-3 text-center text-label-xs uppercase tracking-widest text-on-surface-variant">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map((row) => {
                const achievement = pct(row.actual, row.target);
                const rowGap = gap(row.actual, row.target);
                return (
                  <tr key={row.id} className="border-b border-outline-variant/10 transition hover:bg-surface-high/30">
                    <td className="px-4 py-3">
                      <div className="text-body-sm font-bold text-on-surface">{row.name}</div>
                      {(row.branch || row.division) && <div className="text-label-xs text-on-surface-variant">{[row.branch, row.division].filter(Boolean).join(' / ')}</div>}
                    </td>
                    <td className="px-4 py-3 text-body-sm capitalize text-on-surface-variant">{scope === 'all' ? 'all cabang' : row.scope}</td>
                    <td className="px-4 py-3 text-right text-body-sm text-on-surface">{formatRupiah(row.target)}</td>
                    <td className="px-4 py-3 text-right text-body-sm font-bold text-on-surface">{formatRupiah(row.actual)}</td>
                    <td className={`px-4 py-3 text-right text-body-sm font-bold ${rowGap >= 0 ? 'text-green-500' : 'text-red-500'}`}>{achievement}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-1 text-label-xs font-bold ${row.actual >= row.target ? 'bg-green-400/10 text-green-500' : 'bg-red-400/10 text-red-500'}`}>
                        {row.actual >= row.target ? 'Tercapai' : 'Belum'}
                      </span>
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

export default OwnerTargetActualPage;
