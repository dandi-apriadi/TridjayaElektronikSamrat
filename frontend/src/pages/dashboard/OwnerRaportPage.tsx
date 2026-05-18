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
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Eye,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  jobdeskPositions,
} from '../../data/ownerRaportData';
import {
  buildEmployeeMonthlyReportFromEvidence,
  buildRaportTrendFromEvidence,
  reportDateFormatter,
  type RaportTrendMode,
} from '../../utils/ownerRaportMonthly';
import {
  getReportingWindowLabel,
  isWithinReportingWindow,
  useJobdeskReportSettingsStore,
} from '../../store/jobdeskReportSettingsStore';
import { useCabangStore } from '../../store/useCabangStore';
import { buildPicEmployeeSummaries, toDateKey } from '../../data/picRaportData';
import { usePicRaportStore } from '../../store/picRaportStore';
import { createCabangLookup, getCabangDisplay } from '../../utils/cabangDisplay';
import { calculateRaportFineTotal, formatRupiah } from '../../utils/denda';

type StatusFilter = 'all' | 'excellent' | 'on-track' | 'at-risk';
type SortKey = 'lowest' | 'highest' | 'name' | 'branch' | 'position';
type TrendMode = RaportTrendMode;

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const itemsPerPage = 10;
const branchChartColors = ['#2563eb', '#0891b2', '#16a34a', '#ca8a04', '#dc2626'];

const getMonthRange = (date: Date) => {
  const now = new Date();
  const isCurrentMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  return {
    from: toDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: toDateKey(isCurrentMonth ? now : monthEnd),
  };
};

const getTrendRange = (mode: TrendMode, dateKey: string) => {
  const selectedDate = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) {
    return getMonthRange(new Date());
  }
  if (mode === 'hari') {
    return { from: dateKey, to: dateKey };
  }
  if (mode === 'minggu') {
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - selectedDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const today = new Date();
    return { from: toDateKey(start), to: toDateKey(start <= today && end > today ? today : end) };
  }
  return getMonthRange(selectedDate);
};


function getStatus(persentase: number) {
  if (persentase >= 80) {
    return {
      key: 'excellent' as const,
      label: 'Prima',
      textClass: 'text-green-400',
      bgClass: 'bg-green-400/10',
      barClass: 'bg-green-400',
    };
  }

  if (persentase >= 50) {
    return {
      key: 'on-track' as const,
      label: 'Pantau',
      textClass: 'text-yellow-400',
      bgClass: 'bg-yellow-400/10',
      barClass: 'bg-yellow-400',
    };
  }

  return {
    key: 'at-risk' as const,
    label: 'Prioritas',
    textClass: 'text-red-400',
    bgClass: 'bg-red-400/10',
    barClass: 'bg-red-400',
  };
}

const OwnerRaportPage: React.FC = () => {
  const evidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const raportError = usePicRaportStore((state) => state.error);
  const cabangList = useCabangStore((state) => state.cabang);
  const fetchCabang = useCabangStore((state) => state.fetchCabang);
  const reportStartTime = useJobdeskReportSettingsStore((state) => state.startTime);
  const reportEndTime = useJobdeskReportSettingsStore((state) => state.endTime);
  const reportUpdatedAt = useJobdeskReportSettingsStore((state) => state.updatedAt);
  const setReportingWindow = useJobdeskReportSettingsStore((state) => state.setReportingWindow);
  const fetchReportingWindow = useJobdeskReportSettingsStore((state) => state.fetchReportingWindow);
  const reportSettingsError = useJobdeskReportSettingsStore((state) => state.error);
  const reportSettings = useMemo(
    () => ({
      startTime: reportStartTime,
      endTime: reportEndTime,
      updatedAt: reportUpdatedAt,
    }),
    [reportEndTime, reportStartTime, reportUpdatedAt]
  );
  const [filterCabang, setFilterCabang] = useState('all');
  const [filterPosisi, setFilterPosisi] = useState('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('lowest');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [trendMode, setTrendMode] = useState<TrendMode>('hari');
  const [selectedTrendDate, setSelectedTrendDate] = useState(toDateKey(new Date()));
  const [draftStartTime, setDraftStartTime] = useState(reportSettings.startTime);
  const [draftEndTime, setDraftEndTime] = useState(reportSettings.endTime);
  const [saveWindowMessage, setSaveWindowMessage] = useState('');
  const cabangLookup = useMemo(() => createCabangLookup(cabangList), [cabangList]);
  const getBranchDisplay = (value: string) => getCabangDisplay(value, cabangLookup);

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

  const liveOverallRaport = useMemo(
    () =>
      evidence.length > 0 && liveEmployeeRaports.length > 0
        ? Math.round(liveEmployeeRaports.reduce((sum, employee) => sum + employee.persentase, 0) / liveEmployeeRaports.length)
        : 0,
    [evidence.length, liveEmployeeRaports]
  );
  const monthlyReportsByEmployee = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildEmployeeMonthlyReportFromEvidence>>();
    liveEmployeeRaports.forEach((employee) => {
      map.set(
        employee.id,
        buildEmployeeMonthlyReportFromEvidence(
          employee,
          evidence.filter((item) => item.employeeId === employee.id)
        )
      );
    });
    return map;
  }, [evidence, liveEmployeeRaports]);
  const raportFineByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    monthlyReportsByEmployee.forEach((report, employeeId) => {
      map.set(
        employeeId,
        calculateRaportFineTotal(report.history.map((item) => ({ score: item.nilai, hasScore: item.selesai > 0 })))
      );
    });
    return map;
  }, [monthlyReportsByEmployee]);
  const totalRaportFine = useMemo(
    () => [...raportFineByEmployee.values()].reduce((sum, fine) => sum + fine, 0),
    [raportFineByEmployee]
  );

  const branchChartData = useMemo(
    () => [...liveCabangSummary]
      .map((item) => {
        const branch = getBranchDisplay(item.cabang);
        return { ...item, cabangLabel: branch.label, cabangDetail: branch.detail };
      })
      .sort((a, b) => b.rataPersentase - a.rataPersentase),
    [cabangLookup, liveCabangSummary]
  );

  const posisiChartData = useMemo(
    () => jobdeskPositions
      .map((position) => {
        const summary = livePosisiSummary.find((item) => item.posisi === position.posisi);
        return {
          posisi: position.posisi,
          totalKaryawan: summary?.totalKaryawan ?? 0,
          rataPersentase: summary?.rataPersentase ?? 0,
          totalJobdesk: position.jobdesks.length,
        };
      })
      .sort((a, b) => {
        if (a.totalKaryawan === 0 && b.totalKaryawan > 0) return 1;
        if (a.totalKaryawan > 0 && b.totalKaryawan === 0) return -1;
        return a.rataPersentase - b.rataPersentase || a.posisi.localeCompare(b.posisi, 'id');
      }),
    [livePosisiSummary]
  );

  const cabangNames = useMemo(
    () => [...new Set(liveEmployeeRaports.map((employee) => employee.cabang))].sort((a, b) => getBranchDisplay(a).label.localeCompare(getBranchDisplay(b).label, 'id')),
    [cabangLookup, liveEmployeeRaports]
  );

  const posisiNames = useMemo(
    () => [...new Set(jobdeskPositions.map((position) => position.posisi))].sort((a, b) => a.localeCompare(b, 'id')),
    []
  );

  const divisiOptions = useMemo(
    () => [
      { value: 'all', label: 'Divisi: Semua' },
      ...posisiNames.map((position) => ({ value: position, label: `Divisi: ${position}` })),
    ],
    [posisiNames]
  );

  const filteredEmployees = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return liveEmployeeRaports
      .filter((employee) => {
        const status = getStatus(employee.persentase);
        const matchesSearch =
          searchValue.length === 0 ||
          `${employee.nama} ${employee.posisi} ${employee.cabang} ${getBranchDisplay(employee.cabang).searchText}`.toLowerCase().includes(searchValue);
        const matchesCabang = filterCabang === 'all' || employee.cabang === filterCabang;
        const matchesPosisi = filterPosisi === 'all' || employee.posisi === filterPosisi;
        const matchesStatus = filterStatus === 'all' || status.key === filterStatus;

        return matchesSearch && matchesCabang && matchesPosisi && matchesStatus;
      })
      .sort((a, b) => {
        if (sortKey === 'highest') return b.persentase - a.persentase || a.nama.localeCompare(b.nama, 'id');
        if (sortKey === 'name') return a.nama.localeCompare(b.nama, 'id');
        if (sortKey === 'branch') return getBranchDisplay(a.cabang).label.localeCompare(getBranchDisplay(b.cabang).label, 'id') || a.nama.localeCompare(b.nama, 'id');
        if (sortKey === 'position') return a.posisi.localeCompare(b.posisi, 'id') || a.nama.localeCompare(b.nama, 'id');
        return a.persentase - b.persentase || a.nama.localeCompare(b.nama, 'id');
      });
  }, [cabangLookup, filterCabang, filterPosisi, filterStatus, liveEmployeeRaports, search, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
  const pageStart = (currentPage - 1) * itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(pageStart, pageStart + itemsPerPage);
  const reportDateLabel = reportDateFormatter.format(new Date());

  const statusCounts = useMemo(() => {
    return liveEmployeeRaports.reduce(
      (counts, employee) => {
        const status = getStatus(employee.persentase).key;
        counts[status] += 1;
        return counts;
      },
      { excellent: 0, 'on-track': 0, 'at-risk': 0 }
    );
  }, [liveEmployeeRaports]);

  const bestBranch = branchChartData[0];
  const lowestBranch = branchChartData[branchChartData.length - 1];
  const branchDomainStart = Math.max(
    0,
    Math.floor((lowestBranch?.rataPersentase ?? 0) / 10) * 10 - 10
  );
  const totalCompleted = liveEmployeeRaports.reduce((sum, employee) => sum + employee.selesai, 0);
  const totalJobdesk = liveEmployeeRaports.reduce((sum, employee) => sum + employee.totalJobdesk, 0);
  const trendRange = useMemo(
    () => getTrendRange(trendMode, selectedTrendDate),
    [selectedTrendDate, trendMode]
  );
  const raportTrendData = useMemo(
    () => buildRaportTrendFromEvidence(evidence, trendMode, selectedTrendDate),
    [evidence, selectedTrendDate, trendMode]
  );
  const hasFilters =
    search.trim() !== '' ||
    filterCabang !== 'all' ||
    filterPosisi !== 'all' ||
    filterStatus !== 'all' ||
    sortKey !== 'lowest';

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCabang, filterPosisi, filterStatus, liveEmployeeRaports, search, sortKey]);

  useEffect(() => {
    fetchCabang();
  }, [fetchCabang]);

  useEffect(() => {
    fetchReportingWindow();
    fetchEvidence({ tanggalFrom: trendRange.from, tanggalTo: trendRange.to, limit: 2000 });
  }, [fetchEvidence, fetchReportingWindow, trendRange.from, trendRange.to]);

  useEffect(() => {
    setDraftStartTime(reportSettings.startTime);
    setDraftEndTime(reportSettings.endTime);
  }, [reportSettings.endTime, reportSettings.startTime]);

  const resetFilters = () => {
    setSearch('');
    setFilterCabang('all');
    setFilterPosisi('all');
    setFilterStatus('all');
    setSortKey('lowest');
  };

  const showAutoSaveNotification = () => {
    setSaveWindowMessage('Jam pelaporan otomatis tersimpan.');
    window.setTimeout(() => setSaveWindowMessage(''), 2400);
  };

  const handleReportingTimeChange = async (field: 'start' | 'end', value: string) => {
    const nextStartTime = field === 'start' ? value : draftStartTime;
    const nextEndTime = field === 'end' ? value : draftEndTime;

    if (field === 'start') {
      setDraftStartTime(value);
    } else {
      setDraftEndTime(value);
    }

    try {
      await setReportingWindow({
        startTime: nextStartTime,
        endTime: nextEndTime,
      });
      showAutoSaveNotification();
    } catch (error) {
      setSaveWindowMessage(error instanceof Error ? error.message : 'Jam pelaporan gagal disimpan.');
      window.setTimeout(() => setSaveWindowMessage(''), 3200);
    }
  };

  const reportWindowOpen = isWithinReportingWindow(reportSettings);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Owner Control</p>
          <h1 className="mt-1 font-display text-headline-sm font-bold text-on-surface">Raport Jobdesk Harian</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Pantau penyelesaian jobdesk harian seluruh karyawan, cabang yang butuh perhatian, dan posisi yang perlu follow up.
          </p>
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-high px-4 py-3">
          <div className="text-label-xs font-semibold uppercase tracking-widest text-on-surface-variant">Hari ini</div>
          <div className="mt-1 text-title-sm font-bold text-on-surface">
            {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
          </div>
        </div>
      </motion.div>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
              <Clock3 className="h-3.5 w-3.5" />
              Pengaturan waktu pelaporan
            </div>
            <h2 className="text-title-lg font-black text-on-surface">Owner mengatur jam mulai dan tutup raport.</h2>
            <p className="mt-2 text-body-sm text-on-surface-variant">
              Karyawan hanya bisa mengisi checklist dan upload bukti di antara jam mulai dan jam tutup yang ditentukan.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${reportWindowOpen ? 'border-secondary/20 bg-secondary/10' : 'border-error/20 bg-error/10'}`}>
            <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Status sekarang</p>
            <p className={`mt-1 text-title-sm font-black ${reportWindowOpen ? 'text-secondary' : 'text-error'}`}>
              {reportWindowOpen ? 'Sedang dibuka' : 'Sedang ditutup'}
            </p>
            <p className="mt-1 text-label-sm text-on-surface-variant">{getReportingWindowLabel(reportSettings)}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:max-w-md">
          <label className="space-y-1.5">
            <span className="text-label-sm font-bold text-on-surface-variant">Jam mulai</span>
            <input
              type="time"
              value={draftStartTime}
              onChange={(event) => handleReportingTimeChange('start', event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md font-bold text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-label-sm font-bold text-on-surface-variant">Jam tutup</span>
            <input
              type="time"
              value={draftEndTime}
              onChange={(event) => handleReportingTimeChange('end', event.target.value)}
              className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md font-bold text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-1 text-label-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <span>Jam aktif saat ini: <strong className="text-on-surface">{getReportingWindowLabel(reportSettings)}</strong></span>
          {reportSettings.updatedAt && (
            <span>Update terakhir: {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(reportSettings.updatedAt))}</span>
          )}
        </div>
        {saveWindowMessage && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-secondary/20 bg-secondary/10 px-4 py-3 text-body-sm font-bold text-secondary">
            <CheckCircle2 className="h-4 w-4" />
            {saveWindowMessage}
          </div>
        )}
        {reportSettingsError && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-bold text-error">
            <AlertTriangle className="h-4 w-4" />
            {reportSettingsError}
          </div>
        )}
        {raportError && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-bold text-error">
            <AlertTriangle className="h-4 w-4" />
            {raportError}
          </div>
        )}
      </motion.section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Rata-rata Raport</div>
              <div className={`font-display text-headline-sm font-bold ${getStatus(liveOverallRaport).textClass}`}>{liveOverallRaport}%</div>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-high">
            <div className={`h-full rounded-full ${getStatus(liveOverallRaport).barClass}`} style={{ width: `${liveOverallRaport}%` }} />
          </div>
          <div className="mt-2 text-label-xs text-on-surface-variant">{totalCompleted} dari {totalJobdesk} jobdesk selesai</div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Karyawan Dipantau</div>
              <div className="font-display text-headline-sm font-bold text-on-surface">{liveEmployeeRaports.length}</div>
            </div>
            <div className="rounded-lg bg-secondary/10 p-2.5 text-secondary">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-label-xs text-on-surface-variant">Aktif di {cabangNames.length} cabang dan {posisiNames.length} posisi</div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Cabang Terbaik</div>
              <div className="font-display text-title-lg font-bold text-on-surface">{bestBranch?.cabangLabel ?? '-'}</div>
            </div>
            <div className="rounded-lg bg-green-400/10 p-2.5 text-green-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-label-xs text-on-surface-variant">Rata-rata {bestBranch?.rataPersentase ?? 0}% dari {bestBranch?.totalKaryawan ?? 0} karyawan</div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Butuh Follow Up</div>
              <div className="font-display text-headline-sm font-bold text-red-400">{statusCounts['at-risk']}</div>
            </div>
            <div className="rounded-lg bg-red-400/10 p-2.5 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-label-xs text-on-surface-variant">Cabang terendah: {lowestBranch?.cabangLabel ?? '-'} ({lowestBranch?.rataPersentase ?? 0}%)</div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Denda Jobdesk</div>
              <div className={`font-display text-title-lg font-bold ${totalRaportFine > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatRupiah(totalRaportFine)}</div>
            </div>
            <div className={`rounded-lg p-2.5 ${totalRaportFine > 0 ? 'bg-red-400/10 text-red-400' : 'bg-green-400/10 text-green-400'}`}>
              <BadgeDollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-label-xs text-on-surface-variant">Rp100.000 per hari saat nilai total di bawah 80</div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Tren Raport</h3>
            <p className="mt-1 text-label-xs text-on-surface-variant">Pergerakan rata-rata raport dan jumlah jobdesk selesai berdasarkan periode</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {trendMode === 'hari' && (
              <input
                type="date"
                value={selectedTrendDate}
                onChange={(event) => setSelectedTrendDate(event.target.value)}
                className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            )}
            <div className="flex rounded-lg bg-surface-high p-1">
              {(['hari', 'minggu', 'bulan'] as TrendMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTrendMode(mode)}
                  className={`h-8 rounded-md px-3 text-label-sm font-bold capitalize transition ${trendMode === mode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <AreaChart data={raportTrendData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="raportTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="completedTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" vertical={false} />
              <XAxis dataKey="label" stroke="rgba(71,85,105,0.72)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" domain={[0, 100]} stroke="rgba(37,99,235,0.72)" fontSize={11} tickFormatter={(value: number) => `${value}%`} tickLine={false} axisLine={false} />
              <YAxis yAxisId="right" orientation="right" stroke="rgba(22,163,74,0.72)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(22, 27, 34, 0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }}
                formatter={(value, name) => [name === 'raport' ? `${value ?? 0}%` : `${value ?? 0} jobdesk`, name === 'raport' ? 'Rata-rata raport' : 'Jobdesk selesai']}
                labelFormatter={(label) => trendMode === 'hari' ? `Jam ${label}` : trendMode === 'minggu' ? `${label}` : `Tanggal ${label}`}
              />
              <Area yAxisId="left" type="monotone" dataKey="raport" stroke="#2563eb" strokeWidth={2.5} fill="url(#raportTrendGradient)" dot={{ r: 2.5, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              <Area yAxisId="right" type="monotone" dataKey="selesai" stroke="#16a34a" strokeWidth={2.5} fill="url(#completedTrendGradient)" dot={{ r: 2.5, fill: '#16a34a', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-outline-variant/10 bg-surface-high/40 p-3">
            <div className="text-label-xs text-on-surface-variant">Rata-rata periode</div>
            <div className="mt-1 text-title-sm font-bold text-primary">
              {Math.round(raportTrendData.reduce((sum, item) => sum + item.raport, 0) / raportTrendData.length)}%
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-high/40 p-3">
            <div className="text-label-xs text-on-surface-variant">Jobdesk selesai</div>
            <div className="mt-1 text-title-sm font-bold text-green-500">
              {raportTrendData.reduce((sum, item) => sum + item.selesai, 0).toLocaleString('id-ID')}
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-high/40 p-3">
            <div className="text-label-xs text-on-surface-variant">Mode laporan</div>
            <div className="mt-1 text-title-sm font-bold capitalize text-on-surface">{trendMode}</div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.8fr] gap-6">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Rata-rata Raport Per Cabang</h3>
              <p className="text-label-xs text-on-surface-variant mt-1">Urutan cabang dari pencapaian tertinggi ke terendah</p>
            </div>
            <span className="rounded-lg bg-surface-high px-3 py-1.5 text-label-xs font-bold text-on-surface-variant">{branchChartData.length} cabang</span>
          </div>
          <div className="h-[460px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
              <BarChart layout="vertical" data={branchChartData} margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(100,116,139,0.18)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[branchDomainStart, 100]}
                  stroke="rgba(71,85,105,0.72)"
                  fontSize={11}
                  tickFormatter={(value: number) => `${value}%`}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(100,116,139,0.24)' }}
                />
                <YAxis
                  type="category"
                  dataKey="cabangLabel"
                  width={112}
                  stroke="rgba(51,65,85,0.84)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(22, 27, 34, 0.96)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '8px', color: '#e5eefc' }}
                  formatter={(value) => [`${value ?? 0}%`, 'Rata-rata']}
                />
                <Bar dataKey="rataPersentase" radius={[0, 7, 7, 0]} barSize={18} background={{ fill: 'rgba(100,116,139,0.08)', radius: 7 }}>
                  {branchChartData.map((entry, index) => (
                    <Cell
                      key={entry.cabang}
                      fill={branchChartColors[Math.min(index, branchChartColors.length - 1)]}
                    />
                  ))}
                  <LabelList
                    dataKey="rataPersentase"
                    position="right"
                    formatter={(value) => `${value ?? 0}%`}
                    fill="rgba(15,23,42,0.78)"
                    fontSize={11}
                    fontWeight={700}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <h3 className="font-display text-title-md font-bold text-on-surface">Prioritas Semua Divisi</h3>
          <p className="mt-1 text-label-xs text-on-surface-variant">Diambil dari seluruh master divisi, termasuk yang belum memiliki data karyawan</p>
          <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {posisiChartData.map((item) => {
              const status = getStatus(item.rataPersentase);
              const hasEmployees = item.totalKaryawan > 0;
              return (
                <div key={item.posisi} className="rounded-lg border border-outline-variant/10 bg-surface-high/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-body-sm font-bold text-on-surface">{item.posisi}</div>
                      <div className="text-label-xs text-on-surface-variant">{item.totalKaryawan} karyawan, {item.totalJobdesk} jobdesk</div>
                    </div>
                    {hasEmployees ? (
                      <span className={`rounded-md px-2 py-1 text-label-xs font-bold ${status.bgClass} ${status.textClass}`}>{item.rataPersentase}%</span>
                    ) : (
                      <span className="rounded-md bg-surface px-2 py-1 text-label-xs font-bold text-on-surface-variant">Belum ada data</span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className={`h-full rounded-full ${hasEmployees ? status.barClass : 'bg-outline-variant/30'}`} style={{ width: `${hasEmployees ? item.rataPersentase : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Detail Raport Karyawan</h3>
            <p className="mt-1 text-label-xs text-on-surface-variant">Menampilkan {filteredEmployees.length} dari {liveEmployeeRaports.length} karyawan.</p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1.5 text-label-xs font-bold text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
              Tanggal report: {reportDateLabel}
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-high px-3 py-2 text-label-xs text-on-surface-variant">
            Baris <span className="font-bold text-on-surface">{filteredEmployees.length === 0 ? 0 : pageStart + 1}</span> - <span className="font-bold text-on-surface">{Math.min(pageStart + itemsPerPage, filteredEmployees.length)}</span> dari <span className="font-bold text-on-surface">{filteredEmployees.length}</span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-outline-variant/10 bg-surface-high/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="text-label-sm font-bold text-on-surface">Filter Raport</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama, cabang, divisi..."
                className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface px-9 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select value={filterCabang} onChange={(event) => setFilterCabang(event.target.value)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
              <option value="all">Cabang: Semua</option>
              {cabangNames.map((branch) => <option key={branch} value={branch}>Cabang: {getBranchDisplay(branch).filterLabel}</option>)}
            </select>
            <SearchableSelect
              value={filterPosisi}
              onChange={setFilterPosisi}
              options={divisiOptions}
              placeholder="Divisi: Semua"
              searchPlaceholder="Cari divisi..."
              className="h-10"
            />
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as StatusFilter)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
              <option value="all">Status: Semua</option>
              <option value="excellent">Status: Prima</option>
              <option value="on-track">Status: Pantau</option>
              <option value="at-risk">Status: Prioritas</option>
            </select>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
              <option value="lowest">Urutkan: Terendah</option>
              <option value="highest">Urutkan: Tertinggi</option>
              <option value="name">Urutkan: Nama</option>
              <option value="branch">Urutkan: Cabang</option>
              <option value="position">Urutkan: Divisi</option>
            </select>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Karyawan</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Divisi</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Cabang</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Nilai</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Progress</th>
                <th className="text-center text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Selesai</th>
                <th className="text-center text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Status</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Denda</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee) => {
                const status = getStatus(employee.persentase);
                const branch = getBranchDisplay(employee.cabang);
                const monthlyReport = monthlyReportsByEmployee.get(employee.id) || buildEmployeeMonthlyReportFromEvidence(employee, []);
                const scoreStatus = getStatus(monthlyReport.rataNilai);
                const employeeFine = raportFineByEmployee.get(employee.id) || 0;
                return (
                  <tr key={employee.id} className="border-b border-outline-variant/10 transition-colors hover:bg-surface-high/30">
                    <td className="py-3 px-4">
                      <div className="text-body-sm font-bold text-on-surface">{employee.nama}</div>
                      <div className="text-label-xs text-on-surface-variant">ID {employee.id.toUpperCase()}</div>
                    </td>
                    <td className="py-3 px-4 text-body-sm text-on-surface-variant">{employee.posisi}</td>
                    <td className="py-3 px-4">
                      <div className="inline-flex max-w-[18rem] items-start gap-2 rounded-md bg-surface-high px-2 py-1.5">
                        <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="truncate text-label-xs font-bold text-on-surface">{branch.label}</div>
                          <div className="truncate text-[11px] font-medium text-on-surface-variant">{branch.detail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-title-sm font-black ${scoreStatus.textClass}`}>{monthlyReport.rataNilai}</span>
                        <span className="text-label-xs font-semibold text-on-surface-variant">/ 100</span>
                      </div>
                      <div className="text-label-xs text-on-surface-variant">Rata-rata periode</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-high">
                          <div className={`h-full rounded-full ${status.barClass}`} style={{ width: `${employee.persentase}%` }} />
                        </div>
                        <span className={`text-label-sm font-bold ${status.textClass}`}>{employee.persentase}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-body-sm font-semibold text-on-surface">{employee.selesai}/{employee.totalJobdesk}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-xs font-bold ${status.bgClass} ${status.textClass}`}>
                        {status.key === 'excellent' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <BriefcaseBusiness className="h-3.5 w-3.5" />}
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className={`text-body-sm font-black ${employeeFine > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatRupiah(employeeFine)}</div>
                      <div className="text-[11px] font-semibold text-on-surface-variant">periode aktif</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/dashboard/owner/raport/${employee.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary"
                      >
                        <Eye className="h-4 w-4" />
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length === 0 && (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-high/40 py-10 text-center">
            <p className="text-body-sm font-semibold text-on-surface">Tidak ada raport yang cocok</p>
            <p className="mt-1 text-label-xs text-on-surface-variant">Ubah kombinasi filter untuk melihat data lain.</p>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="mt-2 border-t border-outline-variant/10"
        />
      </motion.div>

    </motion.div>
  );
};

export default OwnerRaportPage;
