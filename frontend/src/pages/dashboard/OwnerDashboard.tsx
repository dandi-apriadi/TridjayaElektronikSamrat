import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { calculateGapPercentage, formatRupiah, ownerDashboardData } from '../../data/ownerDashboardData';
import type { KpiCardData, TrendDirection } from '../../data/ownerDashboardData';
import ComingSoonBadge from '../../components/dashboard/ComingSoonBadge';
import { apiFetch } from '../../utils/apiClient';
import { buildPicEmployeeSummaries, toDateKey } from '../../data/picRaportData';
import { usePicRaportStore } from '../../store/picRaportStore';
import { useCabangStore } from '../../store/useCabangStore';
import { createCabangLookup, getCabangDisplay } from '../../utils/cabangDisplay';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { y: 12, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 130, damping: 20 },
  },
};

const rankColors = ['#f59e0b', '#94a3b8', '#b45309', '#2563eb'];

const TrendIcon: React.FC<{ direction: TrendDirection; className?: string }> = ({
  direction,
  className = 'h-4 w-4',
}) => {
  if (direction === 'up') return <TrendingUp className={className} />;
  if (direction === 'down') return <TrendingDown className={className} />;
  return <Minus className={className} />;
};

function compactRupiah(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)}M`;
  if (value >= 1_000_000) return `Rp ${Math.round(value / 1_000_000)}Jt`;
  return formatRupiah(value);
}

function pct(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
}

const currentMonthRange = () => {
  const now = new Date();
  return {
    from: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateKey(now),
  };
};

interface KpiConfig {
  data: KpiCardData;
  icon: React.FC<{ className?: string }>;
  tone: string;
  href: string;
}

interface ProspekOverviewStats {
  totalProspek: number;
  closing: number;
  conversionRate: number;
  employeeCount: number;
}

const OwnerDashboard: React.FC = () => {
  const { raportPersentase } = ownerDashboardData;
  const evidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const cabangList = useCabangStore((state) => state.cabang);
  const fetchCabang = useCabangStore((state) => state.fetchCabang);
  const cabangLookup = useMemo(() => createCabangLookup(cabangList), [cabangList]);
  const getBranchDisplay = (value: string) => getCabangDisplay(value, cabangLookup);
  const [prospekStats, setProspekStats] = useState<ProspekOverviewStats>({
    totalProspek: 0,
    closing: 0,
    conversionRate: 0,
    employeeCount: 0,
  });

  useEffect(() => {
    let mounted = true;
    const loadProspekOverview = async () => {
      const today = toDateKey(new Date());
      const [summaryResponse, activityResponse] = await Promise.all([
        apiFetch(`/api/prospek-harian/summary?tanggal=${encodeURIComponent(today)}`),
        apiFetch(`/api/prospek-harian?tanggal=${encodeURIComponent(today)}&limit=500`),
      ]);
      if (!mounted || !summaryResponse.ok || !activityResponse.ok) return;

      const [summaryPayload, activityPayload] = await Promise.all([
        summaryResponse.json(),
        activityResponse.json(),
      ]);
      if (!mounted) return;

      const employees = summaryPayload.data?.items || [];
      const activities = activityPayload.data?.items || [];
      const totalProspek = employees.reduce(
        (sum: number, item: any) => sum + Number(item.prospekHariIni || item.prospek_hari_ini || 0),
        0
      );
      const closing = activities.filter((item: any) => (item.statusProspek || item.status_prospek) === 'deal').length;
      setProspekStats({
        totalProspek,
        closing,
        conversionRate: totalProspek > 0 ? Math.round((closing / totalProspek) * 100) : 0,
        employeeCount: employees.length,
      });
    };
    loadProspekOverview().catch(() => {});
    fetchCabang();
    const range = currentMonthRange();
    fetchEvidence({ tanggalFrom: range.from, tanggalTo: range.to, limit: 2000 }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [fetchCabang, fetchEvidence]);

  const liveEmployeeRaports = useMemo(() => {
    const summaries = buildPicEmployeeSummaries(evidence);
    if (summaries.length === 0) return [];
    return summaries.map((employee) => {
      const totalEvidence = employee.pendingEvidence + employee.approvedEvidence + employee.rejectedEvidence;
      const decidedEvidence = employee.approvedEvidence + employee.rejectedEvidence;
      const completionPercentage = totalEvidence ? Math.round((decidedEvidence / totalEvidence) * 100) : 0;
      return {
        id: employee.id,
        nama: employee.nama,
        posisi: employee.posisi,
        cabang: employee.cabang,
        selesai: decidedEvidence,
        totalJobdesk: Math.max(totalEvidence, employee.totalJobdesk || 0, 1),
        persentase: employee.averageScore || completionPercentage,
      };
    });
  }, [evidence]);

  const liveOverallRaport = useMemo(
    () =>
      evidence.length > 0 && liveEmployeeRaports.length > 0
        ? Math.round(liveEmployeeRaports.reduce((sum, employee) => sum + employee.persentase, 0) / liveEmployeeRaports.length)
        : 0,
    [evidence.length, liveEmployeeRaports]
  );

  const liveCabangSummary = useMemo(() => {
    if (evidence.length === 0) return [];
    const grouped = new Map<string, { totalKaryawan: number; totalPersentase: number }>();
    liveEmployeeRaports.forEach((employee) => {
      const current = grouped.get(employee.cabang) || { totalKaryawan: 0, totalPersentase: 0 };
      current.totalKaryawan += 1;
      current.totalPersentase += employee.persentase;
      grouped.set(employee.cabang, current);
    });
    return [...grouped.entries()].map(([cabang, summary]) => ({
      cabang,
      totalKaryawan: summary.totalKaryawan,
      rataPersentase: summary.totalKaryawan ? Math.round(summary.totalPersentase / summary.totalKaryawan) : 0,
    }));
  }, [evidence.length, liveEmployeeRaports]);

  const livePosisiSummary = useMemo(() => {
    if (evidence.length === 0) return [];
    const grouped = new Map<string, { totalKaryawan: number; totalPersentase: number }>();
    liveEmployeeRaports.forEach((employee) => {
      const current = grouped.get(employee.posisi) || { totalKaryawan: 0, totalPersentase: 0 };
      current.totalKaryawan += 1;
      current.totalPersentase += employee.persentase;
      grouped.set(employee.posisi, current);
    });
    return [...grouped.entries()].map(([posisi, summary]) => ({
      posisi,
      totalKaryawan: summary.totalKaryawan,
      rataPersentase: summary.totalKaryawan ? Math.round(summary.totalPersentase / summary.totalKaryawan) : 0,
    }));
  }, [evidence.length, liveEmployeeRaports]);

  const summary = useMemo(() => {
    const totalOmsetCabang = ownerDashboardData.omsetPerCabang.reduce((sum, branch) => sum + branch.omset, 0);
    const sortedBranches = [...ownerDashboardData.omsetPerCabang].sort((a, b) => b.omset - a.omset);
    const topBranch = sortedBranches[0];
    const lowestBranch = sortedBranches[sortedBranches.length - 1];
    const latestTarget = ownerDashboardData.targetVsActual[ownerDashboardData.targetVsActual.length - 1];
    const targetAchievement = latestTarget ? pct(latestTarget.actual, latestTarget.target) : 0;
    const targetGap = latestTarget ? calculateGapPercentage(latestTarget.actual, latestTarget.target) : 0;
    const totalSalesRevenue = ownerDashboardData.topSales.reduce((sum, sales) => sum + sales.revenue, 0);
    const totalNonSalesContribution = ownerDashboardData.topNonSales.reduce((sum, entry) => sum + entry.contributionCount, 0);
    const completedJobdesk = liveEmployeeRaports.reduce((sum, employee) => sum + employee.selesai, 0);
    const totalJobdesk = liveEmployeeRaports.reduce((sum, employee) => sum + employee.totalJobdesk, 0);
    const weakBranches = [...liveCabangSummary]
      .sort((a, b) => a.rataPersentase - b.rataPersentase)
      .slice(0, 4)
      .map((branch) => ({ ...branch, cabangLabel: getBranchDisplay(branch.cabang).filterLabel }));
    const weakDivisions = [...livePosisiSummary]
      .filter((item) => item.totalKaryawan > 0)
      .sort((a, b) => a.rataPersentase - b.rataPersentase)
      .slice(0, 4);

    return {
      totalOmsetCabang,
      topBranch,
      lowestBranch,
      latestTarget,
      targetAchievement,
      targetGap,
      totalSalesRevenue,
      totalNonSalesContribution,
      completedJobdesk,
      totalJobdesk,
      weakBranches,
      weakDivisions,
    };
  }, [cabangLookup, liveCabangSummary, liveEmployeeRaports, livePosisiSummary]);

  const prospek: KpiCardData = {
    label: 'Prospek Masuk',
    value: prospekStats.totalProspek,
    formattedValue: prospekStats.totalProspek.toLocaleString('id-ID'),
    previousValue: prospekStats.employeeCount,
    trend: 'neutral',
    trendPercentage: `${prospekStats.employeeCount} karyawan`,
  };
  const closing: KpiCardData = {
    label: 'Closing',
    value: prospekStats.closing,
    formattedValue: prospekStats.closing.toLocaleString('id-ID'),
    previousValue: 0,
    trend: 'neutral',
    trendPercentage: 'Backend',
  };
  const conversionRate: KpiCardData = {
    label: 'Conversion Rate',
    value: prospekStats.conversionRate,
    formattedValue: `${prospekStats.conversionRate}%`,
    previousValue: 0,
    trend: 'neutral',
    trendPercentage: 'Backend',
  };

  const kpiCards: KpiConfig[] = [
    { data: prospek, icon: Users, tone: 'text-primary bg-primary/10', href: '/dashboard/owner/prospek' },
    { data: closing, icon: CheckCircle2, tone: 'text-secondary bg-secondary/10', href: '/dashboard/owner/prospek' },
    { data: conversionRate, icon: BarChart3, tone: 'text-tertiary bg-tertiary/10', href: '/dashboard/owner/prospek' },
    {
      data: { ...raportPersentase, value: liveOverallRaport, formattedValue: `${liveOverallRaport}%` },
      icon: BookOpen,
      tone: 'text-primary bg-primary/10',
      href: '/dashboard/owner/raport',
    },
  ];

  const moduleSummaries = [
    {
      title: 'Prospek & Closing',
      description: `${prospek.formattedValue} prospek, ${closing.formattedValue} closing, conversion ${conversionRate.formattedValue}.`,
      href: '/dashboard/owner/prospek',
      icon: Users,
      metric: conversionRate.formattedValue,
      label: 'Conversion',
    },
    {
      title: 'Raport Jobdesk',
      description: `${summary.completedJobdesk}/${summary.totalJobdesk} jobdesk selesai dari ${liveEmployeeRaports.length} karyawan.`,
      href: '/dashboard/owner/raport',
      icon: BookOpen,
      metric: `${liveOverallRaport}%`,
      label: 'Rata-rata',
    },
    {
      title: 'Omset Per Cabang',
      description: `Tertinggi ${summary.topBranch?.cabang ?? '-'}, terendah ${summary.lowestBranch?.cabang ?? '-'}.`,
      href: '/dashboard/owner/omset-cabang',
      icon: Building2,
      metric: compactRupiah(summary.totalOmsetCabang),
      label: 'Total cabang',
    },
    {
      title: 'Omset Realtime',
      description: `Update terakhir ${ownerDashboardData.omsetRealtime.hourlyData.at(-1)?.hour ?? '-'} dari seluruh cabang aktif.`,
      href: '/dashboard/owner/omset-realtime',
      icon: Clock3,
      metric: compactRupiah(ownerDashboardData.omsetRealtime.total),
      label: 'Hari ini',
    },
    {
      title: 'Target vs Actual',
      description: `${summary.latestTarget?.month ?? '-'} berada di ${summary.targetAchievement}% dari target.`,
      href: '/dashboard/owner/target-actual',
      icon: Target,
      metric: `${summary.targetGap >= 0 ? '+' : ''}${summary.targetGap.toFixed(1)}%`,
      label: 'Gap terbaru',
    },
    {
      title: 'Top 10 Sales',
      description: `Leader ${ownerDashboardData.topSales[0]?.name ?? '-'} dengan ${compactRupiah(ownerDashboardData.topSales[0]?.revenue ?? 0)}.`,
      href: '/dashboard/owner/top-sales',
      icon: Trophy,
      metric: compactRupiah(summary.totalSalesRevenue),
      label: 'Top 10 revenue',
    },
    {
      title: 'Top 10 Non-Sales',
      description: `Leader ${ownerDashboardData.topNonSales[0]?.name ?? '-'} dengan ${ownerDashboardData.topNonSales[0]?.contributionCount ?? 0} kontribusi.`,
      href: '/dashboard/owner/top-nonsales',
      icon: Award,
      metric: summary.totalNonSalesContribution.toLocaleString('id-ID'),
      label: 'Kontribusi',
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Owner Overview</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Ringkasan Semua Area Owner</h1>
          <p className="mt-1 max-w-3xl text-body-sm text-on-surface-variant">
            Satu layar untuk membaca omset, prospek, target, ranking, dan kedisiplinan jobdesk sebelum masuk ke halaman detail.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 xl:items-end">
          <ComingSoonBadge />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Link to="/dashboard/owner/omset-realtime" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-label-sm font-bold text-on-primary transition hover:brightness-105">
              <TrendingUp className="h-4 w-4" />
              Realtime
            </Link>
            <Link to="/dashboard/owner/target-actual" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-surface-high px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface">
              <Target className="h-4 w-4" />
              Target
            </Link>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(({ data, icon: Icon, tone, href }) => {
          const trendTone = data.trend === 'up' ? 'text-secondary bg-secondary/10' : data.trend === 'down' ? 'text-error bg-error/10' : 'text-on-surface-variant bg-surface-high';
          return (
            <motion.div key={data.label} variants={itemVariants}>
              <Link to={href} className="glass-card block rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-primary/20">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className={`rounded-lg p-2.5 ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-label-xs font-bold ${trendTone}`}>
                    <TrendIcon direction={data.trend} className="h-3 w-3" />
                    {data.trendPercentage}
                  </span>
                </div>
                <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">{data.label}</div>
                <div className="mt-1 font-display text-headline-sm font-bold text-on-surface">{data.formattedValue}</div>
                <div className="mt-1 text-label-xs text-on-surface-variant">Buka detail <ArrowUpRight className="ml-1 inline h-3 w-3" /></div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface">Pulse Operasional</h2>
              <p className="mt-1 text-label-xs text-on-surface-variant">Snapshot dari halaman omset realtime dan target actual.</p>
            </div>
            <span className={`w-fit rounded-lg px-3 py-1.5 text-label-sm font-bold ${summary.targetGap >= 0 ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
              Target {summary.targetGap >= 0 ? 'di atas' : 'di bawah'} {Math.abs(summary.targetGap).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="min-h-[280px]">
              <div className="mb-3 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Omset Realtime</div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={ownerDashboardData.omsetRealtime.hourlyData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewRealtime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.16)" vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={11} stroke="rgba(148,163,184,0.8)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="rgba(148,163,184,0.8)" tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
                  <Tooltip formatter={(value) => [formatRupiah(Number(value)), 'Omset']} contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} />
                  <Area type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={2.5} fill="url(#overviewRealtime)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="min-h-[280px]">
              <div className="mb-3 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Target vs Actual</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ownerDashboardData.targetVsActual} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.16)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} stroke="rgba(148,163,184,0.8)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="rgba(148,163,184,0.8)" tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
                  <Tooltip formatter={(value) => [formatRupiah(Number(value))]} contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} />
                  <Bar dataKey="target" fill="rgba(99,102,241,0.46)" radius={[5, 5, 0, 0]} barSize={16} />
                  <Bar dataKey="actual" radius={[5, 5, 0, 0]} barSize={16}>
                    {ownerDashboardData.targetVsActual.map((entry) => (
                      <Cell key={entry.month} fill={entry.actual >= entry.target ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
          <div className="mb-5">
            <h2 className="font-display text-title-md font-bold text-on-surface">Perlu Perhatian</h2>
            <p className="mt-1 text-label-xs text-on-surface-variant">Cabang dan divisi dengan penyelesaian jobdesk terendah.</p>
          </div>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Cabang</div>
              <div className="space-y-2">
                {summary.weakBranches.map((branch) => (
                  <Link key={branch.cabang} to="/dashboard/owner/raport" className="flex items-center justify-between rounded-lg bg-surface-high/60 px-3 py-2.5 transition hover:bg-surface-high">
                    <span className="text-body-sm font-semibold text-on-surface">{branch.cabangLabel}</span>
                    <span className="text-label-sm font-bold text-error">{branch.rataPersentase}%</span>
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Divisi</div>
              <div className="space-y-2">
                {summary.weakDivisions.map((division) => (
                  <Link key={division.posisi} to="/dashboard/owner/raport" className="flex items-center justify-between rounded-lg bg-surface-high/60 px-3 py-2.5 transition hover:bg-surface-high">
                    <span className="text-body-sm font-semibold text-on-surface">{division.posisi}</span>
                    <span className="text-label-sm font-bold text-error">{division.rataPersentase}%</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {moduleSummaries.map(({ title, description, href, icon: Icon, metric, label }) => (
          <Link key={title} to={href} className="glass-card rounded-xl p-5 transition hover:-translate-y-0.5 hover:border-primary/20">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="rounded-lg bg-surface-high p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-on-surface-variant" />
            </div>
            <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">{label}</div>
            <div className="mt-1 font-display text-title-md font-bold text-on-surface">{metric}</div>
            <h3 className="mt-4 font-display text-title-sm font-bold text-on-surface">{title}</h3>
            <p className="mt-1 text-label-sm leading-5 text-on-surface-variant">{description}</p>
          </Link>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 xl:col-span-2">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface">Omset Per Cabang</h2>
              <p className="mt-1 text-label-xs text-on-surface-variant">Top cabang dan posisi kontribusi bulan ini.</p>
            </div>
            <Link to="/dashboard/owner/omset-cabang" className="text-label-sm font-bold text-primary hover:underline">Detail</Link>
          </div>
          <ResponsiveContainer width="100%" height={310}>
            <BarChart layout="vertical" data={[...ownerDashboardData.omsetPerCabang].sort((a, b) => b.omset - a.omset)} margin={{ top: 4, right: 66, left: 12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.16)" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} stroke="rgba(148,163,184,0.8)" tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}Jt`} />
              <YAxis type="category" dataKey="cabang" width={112} tickLine={false} axisLine={false} fontSize={12} stroke="rgba(148,163,184,0.86)" />
              <Tooltip formatter={(value) => [formatRupiah(Number(value)), 'Omset']} contentStyle={{ backgroundColor: 'rgba(22,27,34,0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }} />
              <Bar dataKey="omset" radius={[0, 7, 7, 0]} barSize={24}>
                {ownerDashboardData.omsetPerCabang.map((branch, index) => (
                  <Cell key={branch.cabang} fill={rankColors[Math.min(index, rankColors.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface">Leader Board</h2>
              <p className="mt-1 text-label-xs text-on-surface-variant">Top 5 sales dan non-sales.</p>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Sales</span>
                <Link to="/dashboard/owner/top-sales" className="text-label-xs font-bold text-primary">Lihat</Link>
              </div>
              <div className="space-y-2">
                {ownerDashboardData.topSales.slice(0, 5).map((sales) => (
                  <div key={sales.rank} className="flex items-center justify-between gap-3 rounded-lg bg-surface-high/60 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-label-xs font-bold text-primary">{sales.rank}</span>
                      <span className="truncate text-body-sm font-semibold text-on-surface">{sales.name}</span>
                    </div>
                    <span className="shrink-0 text-label-sm font-bold text-on-surface-variant">{compactRupiah(sales.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Non-Sales</span>
                <Link to="/dashboard/owner/top-nonsales" className="text-label-xs font-bold text-primary">Lihat</Link>
              </div>
              <div className="space-y-2">
                {ownerDashboardData.topNonSales.slice(0, 5).map((entry) => (
                  <div key={entry.rank} className="flex items-center justify-between gap-3 rounded-lg bg-surface-high/60 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-label-xs font-bold text-secondary">{entry.rank}</span>
                      <span className="truncate text-body-sm font-semibold text-on-surface">{entry.name}</span>
                    </div>
                    <span className="shrink-0 text-label-sm font-bold text-on-surface-variant">{entry.contributionCount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OwnerDashboard;
