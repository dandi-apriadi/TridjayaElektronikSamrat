import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, Target, BarChart3, Trophy, Search, SlidersHorizontal, X } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useCabangStore } from '../../store/useCabangStore';
import { apiFetch } from '../../utils/apiClient';
import { createCabangLookup, getCabangDisplay } from '../../utils/cabangDisplay';
import { normalizeTargetKategori } from '../../utils/roles';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

type EmployeeProspekRow = {
  rank: number;
  employeeId: string;
  nama: string;
  cabang: string;
  kategori: 'Sales' | 'Non-Sales';
  posisi: string;
  prospekHariIni: number;
  target: number;
  persentase: number;
};

type AchievementFilter = 'Semua' | 'Tercapai' | 'Belum Tercapai';
type EmployeeSortKey = 'rank' | 'nama' | 'cabang' | 'prospek_desc' | 'prospek_asc' | 'persentase_desc' | 'persentase_asc';

type ProspekActivityRow = {
  id: string;
  karyawanId: string;
  karyawanName: string;
  divisi: string;
  targetKategori?: string;
  statusProspek: string;
  tanggal: string;
  createdAt: string;
};

const todayDateKey = () => new Date().toISOString().split('T')[0];

const OwnerProspekPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(todayDateKey());
  const [viewMode, setViewMode] = useState<'minggu' | 'bulan'>('minggu');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeBranchFilter, setEmployeeBranchFilter] = useState('Semua');
  const [employeeCategoryFilter, setEmployeeCategoryFilter] = useState<'Semua' | EmployeeProspekRow['kategori']>('Semua');
  const [employeePositionFilter, setEmployeePositionFilter] = useState('Semua');
  const [employeeAchievementFilter, setEmployeeAchievementFilter] = useState<AchievementFilter>('Semua');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('rank');
  const [backendEmployeeProspek, setBackendEmployeeProspek] = useState<EmployeeProspekRow[]>([]);
  const [prospekActivity, setProspekActivity] = useState<ProspekActivityRow[]>([]);
  const [isLoadingProspek, setIsLoadingProspek] = useState(false);
  const cabangList = useCabangStore((state) => state.cabang);
  const fetchCabang = useCabangStore((state) => state.fetchCabang);
  const employeeItemsPerPage = 12;
  const activeDate = selectedDate || todayDateKey();
  const employeeRows = backendEmployeeProspek;
  const cabangLookup = useMemo(() => createCabangLookup(cabangList), [cabangList]);
  const getBranchDisplay = (value: string) => getCabangDisplay(value, cabangLookup);
  const employeeBranchOptions = useMemo(
    () => ['Semua', ...Array.from(new Set(employeeRows.map((row) => row.cabang))).sort((a, b) => getBranchDisplay(a).label.localeCompare(getBranchDisplay(b).label, 'id'))],
    [cabangLookup, employeeRows]
  );
  const employeePositionOptions = useMemo(
    () => ['Semua', ...Array.from(new Set(employeeRows.map((row) => row.posisi))).sort((a, b) => a.localeCompare(b, 'id'))],
    [employeeRows]
  );
  const topSalesRows = useMemo(() => employeeRows.filter((row) => row.kategori === 'Sales').slice(0, 10), [employeeRows]);
  const topNonSalesRows = useMemo(() => employeeRows.filter((row) => row.kategori === 'Non-Sales').slice(0, 10), [employeeRows]);
  const salesRows = useMemo(() => employeeRows.filter((row) => row.kategori === 'Sales'), [employeeRows]);
  const nonSalesRows = useMemo(() => employeeRows.filter((row) => row.kategori === 'Non-Sales'), [employeeRows]);
  const totalProspek = useMemo(() => employeeRows.reduce((sum, row) => sum + row.prospekHariIni, 0), [employeeRows]);
  const totalTarget = useMemo(() => employeeRows.reduce((sum, row) => sum + row.target, 0), [employeeRows]);
  const totalClosing = useMemo(() => prospekActivity.filter((row) => row.statusProspek === 'deal').length, [prospekActivity]);
  const conversionPercent = totalProspek > 0 ? Math.round((totalClosing / totalProspek) * 100) : 0;
  const achievementPercent = totalTarget > 0 ? Math.round((totalProspek / totalTarget) * 100) : 0;
  const categoryByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeProspekRow['kategori']>();
    employeeRows.forEach((row) => {
      map.set(row.nama.toLowerCase(), row.kategori);
    });
    return map;
  }, [employeeRows]);

  const getActivityCategory = (row: ProspekActivityRow): EmployeeProspekRow['kategori'] => {
    if (row.targetKategori) return normalizeTargetKategori(row.targetKategori) === 'sales' ? 'Sales' : 'Non-Sales';
    const fromEmployee = categoryByEmployee.get(row.karyawanName.toLowerCase());
    if (fromEmployee) return fromEmployee;
    return row.divisi.toLowerCase().includes('sales') ? 'Sales' : 'Non-Sales';
  };
  const filteredEmployeeProspek = useMemo(() => {
    const searchValue = employeeSearch.trim().toLowerCase();

    return employeeRows
      .filter((row) => {
        const branchDisplay = getBranchDisplay(row.cabang);
        const matchesSearch =
          searchValue.length === 0 ||
          `${row.nama} ${row.cabang} ${branchDisplay.searchText} ${row.kategori} ${row.posisi}`.toLowerCase().includes(searchValue);
        const matchesBranch = employeeBranchFilter === 'Semua' || row.cabang === employeeBranchFilter;
        const matchesCategory = employeeCategoryFilter === 'Semua' || row.kategori === employeeCategoryFilter;
        const matchesPosition = employeePositionFilter === 'Semua' || row.posisi === employeePositionFilter;
        const matchesAchievement =
          employeeAchievementFilter === 'Semua' ||
          (employeeAchievementFilter === 'Tercapai' ? row.persentase >= 100 : row.persentase < 100);

        return matchesSearch && matchesBranch && matchesCategory && matchesPosition && matchesAchievement;
      })
      .sort((a, b) => {
        if (employeeSort === 'nama') return a.nama.localeCompare(b.nama, 'id');
        if (employeeSort === 'cabang') return getBranchDisplay(a.cabang).label.localeCompare(getBranchDisplay(b.cabang).label, 'id') || a.rank - b.rank;
        if (employeeSort === 'prospek_desc') return b.prospekHariIni - a.prospekHariIni || a.rank - b.rank;
        if (employeeSort === 'prospek_asc') return a.prospekHariIni - b.prospekHariIni || a.rank - b.rank;
        if (employeeSort === 'persentase_desc') return b.persentase - a.persentase || a.rank - b.rank;
        if (employeeSort === 'persentase_asc') return a.persentase - b.persentase || a.rank - b.rank;
        return a.rank - b.rank;
      });
  }, [
    employeeAchievementFilter,
    employeeBranchFilter,
    employeeCategoryFilter,
    employeePositionFilter,
    employeeRows,
    employeeSearch,
    employeeSort,
    cabangLookup,
  ]);
  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployeeProspek.length / employeeItemsPerPage));
  const employeePageStart = (employeePage - 1) * employeeItemsPerPage;
  const paginatedEmployeeProspek = filteredEmployeeProspek.slice(
    employeePageStart,
    employeePageStart + employeeItemsPerPage
  );
  const hasEmployeeFilters =
    employeeSearch.trim() !== '' ||
    employeeBranchFilter !== 'Semua' ||
    employeeCategoryFilter !== 'Semua' ||
    employeePositionFilter !== 'Semua' ||
    employeeAchievementFilter !== 'Semua' ||
    employeeSort !== 'rank';

  useEffect(() => {
    setEmployeePage(1);
  }, [
    employeeAchievementFilter,
    employeeBranchFilter,
    employeeCategoryFilter,
    employeePositionFilter,
    employeeSearch,
    employeeSort,
  ]);

  useEffect(() => {
    fetchCabang();
  }, [fetchCabang]);

  useEffect(() => {
    let mounted = true;
    const loadProspek = async () => {
      setIsLoadingProspek(true);
      const query = new URLSearchParams();
      query.set('limit', '500');
      if (selectedDate) query.set('tanggal', selectedDate);

      const [summaryResponse, activityResponse] = await Promise.all([
        apiFetch(`/api/prospek-harian/summary?tanggal=${encodeURIComponent(activeDate)}`),
        apiFetch(`/api/prospek-harian?${query.toString()}`),
      ]);
      if (!mounted) return;

      if (summaryResponse.ok) {
        const summaryPayload = await summaryResponse.json();
        setBackendEmployeeProspek((summaryPayload.data?.items || []).map((item: any) => ({
          rank: Number(item.rank || 0),
          employeeId: String(item.employeeId || item.employee_id || ''),
          nama: String(item.nama || ''),
          cabang: String(item.cabang || 'Cabang belum diatur'),
          kategori: item.kategori === 'Sales' ? 'Sales' : 'Non-Sales',
          posisi: String(item.posisi || 'Karyawan'),
          prospekHariIni: Number(item.prospekHariIni || item.prospek_hari_ini || 0),
          target: Number(item.target || 0),
          persentase: Number(item.persentase || 0),
        })));
      } else {
        setBackendEmployeeProspek([]);
      }

      if (activityResponse.ok) {
        const activityPayload = await activityResponse.json();
        setProspekActivity((activityPayload.data?.items || []).map((item: any) => ({
          id: String(item.id),
          karyawanId: String(item.karyawanId || item.karyawan_id || ''),
          karyawanName: String(item.karyawanName || item.karyawan_name || ''),
          divisi: String(item.divisi || ''),
          targetKategori: String(item.targetKategori || item.target_kategori || ''),
          statusProspek: String(item.statusProspek || item.status_prospek || ''),
          tanggal: String(item.tanggal || ''),
          createdAt: String(item.createdAt || item.created_at || ''),
        })));
      } else {
        setProspekActivity([]);
      }

      setIsLoadingProspek(false);
    };
    loadProspek().catch(() => {
      if (!mounted) return;
      setBackendEmployeeProspek([]);
      setProspekActivity([]);
      setIsLoadingProspek(false);
    });
    return () => {
      mounted = false;
    };
  }, [activeDate, selectedDate]);

  const resetEmployeeFilters = () => {
    setEmployeeSearch('');
    setEmployeeBranchFilter('Semua');
    setEmployeeCategoryFilter('Semua');
    setEmployeePositionFilter('Semua');
    setEmployeeAchievementFilter('Semua');
    setEmployeeSort('rank');
  };
  const hourlyData = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({ jam: `${String(hour).padStart(2, '0')}:00`, sales: 0, nonSales: 0 }));
    prospekActivity.forEach((row) => {
      if (row.tanggal !== activeDate) return;
      const hour = Number(row.createdAt.slice(11, 13));
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
      if (getActivityCategory(row) === 'Sales') rows[hour].sales += 1;
      else rows[hour].nonSales += 1;
    });
    return rows;
  }, [activeDate, categoryByEmployee, prospekActivity]);

  const weeklyData = useMemo(() => {
    const labels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const rows = labels.map((hari) => ({ hari, sales: 0, nonSales: 0 }));
    prospekActivity.forEach((row) => {
      const date = new Date(`${row.tanggal}T12:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const target = rows[date.getDay()];
      if (getActivityCategory(row) === 'Sales') target.sales += 1;
      else target.nonSales += 1;
    });
    return [rows[1], rows[2], rows[3], rows[4], rows[5], rows[6], rows[0]];
  }, [categoryByEmployee, prospekActivity]);

  const monthlyData = useMemo(() => {
    const rows = Array.from({ length: 31 }, (_, index) => ({ tanggal: `${index + 1}`, sales: 0, nonSales: 0 }));
    prospekActivity.forEach((row) => {
      const day = Number(row.tanggal.slice(8, 10));
      if (!Number.isFinite(day) || day < 1 || day > 31) return;
      if (getActivityCategory(row) === 'Sales') rows[day - 1].sales += 1;
      else rows[day - 1].nonSales += 1;
    });
    return rows;
  }, [categoryByEmployee, prospekActivity]);

  const cards = [
    {
      label: 'Prospek Masuk Hari Ini',
      formattedValue: totalProspek.toLocaleString('id-ID'),
      helper: isLoadingProspek ? 'Memuat data backend' : `${employeeRows.length} karyawan tercatat`,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      valueColor: 'text-on-surface',
    },
    {
      label: 'Closing',
      formattedValue: totalClosing.toLocaleString('id-ID'),
      helper: 'Status prospek deal',
      icon: Target,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      valueColor: 'text-on-surface',
    },
    {
      label: 'Conversion Rate',
      formattedValue: `${conversionPercent}%`,
      helper: `${totalClosing} dari ${totalProspek} prospek`,
      icon: BarChart3,
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
      valueColor: 'text-on-surface',
    },
    {
      label: 'Pencapaian Target',
      formattedValue: `${achievementPercent}%`,
      helper: `${totalProspek} / ${totalTarget} prospek`,
      icon: Target,
      color: 'text-primary',
      bg: 'bg-primary/10',
      valueColor: achievementPercent >= 100 ? 'text-secondary' : achievementPercent >= 70 ? 'text-yellow-400' : 'text-error',
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="font-display text-headline-sm font-bold text-on-surface">Prospek & Closing</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">Monitoring prospek masuk, closing, conversion rate, dan raport persentase</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <motion.div key={card.label} variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${card.bg} ${card.color}`}><Icon className="w-5 h-5" /></div>
                <div className="rounded-md bg-surface-high px-2 py-1 text-label-xs font-bold text-on-surface-variant">
                  Backend
                </div>
              </div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">{card.label}</div>
              <div className={`font-display text-headline-sm font-bold ${card.valueColor}`}>{card.formattedValue}</div>
              <div className="text-label-xs text-on-surface-variant mt-1">{card.helper}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Grafik Prospek */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Pengumpulan Prospek</h3>
            <p className="text-label-xs text-on-surface-variant mt-1">Distribusi prospek masuk berdasarkan waktu</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedDate !== '' && (
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 bg-surface-high border border-outline-variant/20 rounded-lg text-label-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/40" />
            )}
            <div className="flex gap-1 bg-surface-high rounded-lg p-1">
              <button onClick={() => setSelectedDate(todayDateKey())} className={`px-3 py-1.5 rounded-md text-label-xs font-semibold transition-colors ${selectedDate !== '' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Hari</button>
              <button onClick={() => setSelectedDate('')} className={`px-3 py-1.5 rounded-md text-label-xs font-semibold transition-colors ${selectedDate === '' && viewMode === 'minggu' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`} onClickCapture={() => setViewMode('minggu')}>Minggu</button>
              <button onClick={() => { setSelectedDate(''); setViewMode('bulan'); }} className={`px-3 py-1.5 rounded-md text-label-xs font-semibold transition-colors ${selectedDate === '' && viewMode === 'bulan' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Bulan</button>
            </div>
          </div>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <AreaChart data={selectedDate !== '' ? hourlyData : viewMode === 'minggu' ? (weeklyData as any[]) : (monthlyData as any[])}>
              <defs>
                <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A2F31F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#A2F31F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey={selectedDate !== '' ? 'jam' : viewMode === 'minggu' ? 'hari' : 'tanggal'} stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradS)" />
              <Area type="monotone" dataKey="nonSales" name="Non-Sales" stroke="#A2F31F" strokeWidth={2.5} fill="url(#gradNS)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {selectedDate !== '' && (
          <div className="mt-3 p-3 rounded-lg bg-surface-high/50 border border-white/5">
            <p className="text-label-xs text-on-surface-variant">
              <span className="font-semibold text-primary">Peak hours:</span> Mayoritas prospek dikumpulkan antara <span className="font-bold text-on-surface">09:00 - 16:00</span>. Puncak di jam <span className="font-bold text-on-surface">15:00</span>.
            </p>
          </div>
        )}
      </motion.div>

      {/* Persentase Prospek — Akumulasi Target */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Persentase Pencapaian Prospek Hari Ini</h3>
        <p className="text-body-sm text-on-surface-variant mb-4">Target dihitung dari jumlah karyawan × target per kategori (Sales: 20/hari, Non-Sales: 5/hari)</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Sales */}
          {(() => {
            const jumlahSales = salesRows.length;
            const totalTargetSales = salesRows.reduce((sum, row) => sum + row.target, 0);
            const actualSales = salesRows.reduce((sum, row) => sum + row.prospekHariIni, 0);
            const targetSalesPerOrang = jumlahSales > 0 ? Math.round(totalTargetSales / jumlahSales) : 20;
            const persentaseSales = totalTargetSales > 0 ? Math.round((actualSales / totalTargetSales) * 100) : 0;
            return (
              <div className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Sales ({jumlahSales} orang)</div>
                <div className={`font-display text-title-lg font-bold ${persentaseSales >= 100 ? 'text-secondary' : 'text-error'}`}>{persentaseSales}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${persentaseSales >= 100 ? 'bg-secondary' : 'bg-error'}`} style={{ width: `${Math.min(persentaseSales, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">{actualSales} / {totalTargetSales} prospek (target {targetSalesPerOrang}/orang)</div>
              </div>
            );
          })()}
          {/* Non-Sales */}
          {(() => {
            const jumlahNonSales = nonSalesRows.length;
            const totalTargetNonSales = nonSalesRows.reduce((sum, row) => sum + row.target, 0);
            const actualNonSales = nonSalesRows.reduce((sum, row) => sum + row.prospekHariIni, 0);
            const targetNonSalesPerOrang = jumlahNonSales > 0 ? Math.round(totalTargetNonSales / jumlahNonSales) : 5;
            const persentaseNonSales = totalTargetNonSales > 0 ? Math.round((actualNonSales / totalTargetNonSales) * 100) : 0;
            return (
              <div className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Non-Sales ({jumlahNonSales} orang)</div>
                <div className={`font-display text-title-lg font-bold ${persentaseNonSales >= 100 ? 'text-secondary' : 'text-error'}`}>{persentaseNonSales}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${persentaseNonSales >= 100 ? 'bg-secondary' : 'bg-error'}`} style={{ width: `${Math.min(persentaseNonSales, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">{actualNonSales} / {totalTargetNonSales} prospek (target {targetNonSalesPerOrang}/orang)</div>
              </div>
            );
          })()}
          {/* Total */}
          {(() => {
            const totalActual = totalProspek;
            const persentaseTotal = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
            return (
              <div className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total ({employeeRows.length} karyawan)</div>
                <div className={`font-display text-title-lg font-bold ${persentaseTotal >= 100 ? 'text-secondary' : persentaseTotal >= 70 ? 'text-yellow-400' : 'text-error'}`}>{persentaseTotal}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${persentaseTotal >= 100 ? 'bg-secondary' : persentaseTotal >= 70 ? 'bg-yellow-400' : 'bg-error'}`} style={{ width: `${Math.min(persentaseTotal, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">{totalActual} / {totalTarget} prospek total</div>
              </div>
            );
          })()}
        </div>
      </motion.div>

      {/* Top Sales by Prospek */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Top Sales — Prospek Terbanyak</h3>
              <p className="text-label-xs text-on-surface-variant">Target minimal: 20 prospek/hari</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-12">#</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Cabang</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">%</th>
                </tr>
              </thead>
              <tbody>
              {topSalesRows.map((row) => {
                const branch = getBranchDisplay(row.cabang);
                return (
                  <tr key={`${row.employeeId || row.nama}-sales`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        {row.rank <= 3 && <Trophy className={`w-3.5 h-3.5 ${row.rank === 1 ? 'text-yellow-400' : row.rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />}
                        <span className="text-body-sm font-bold text-on-surface">{row.rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-body-sm font-medium text-on-surface">{row.nama}</td>
                    <td className="py-2.5 px-3">
                      <div className="text-body-sm font-semibold text-on-surface">{branch.label}</div>
                      <div className="text-label-xs text-on-surface-variant">{branch.detail}</div>
                    </td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface text-right font-semibold">{row.prospekHariIni}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                        {row.persentase}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Top Non-Sales by Prospek */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-secondary" />
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Top Non-Sales — Prospek Terbanyak</h3>
              <p className="text-label-xs text-on-surface-variant">Target minimal: 5 prospek/hari</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-12">#</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Cabang</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Posisi</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">%</th>
                </tr>
              </thead>
              <tbody>
                {topNonSalesRows.map((row) => {
                  const branch = getBranchDisplay(row.cabang);
                  return (
                  <tr key={`${row.employeeId || row.nama}-non-sales`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        {row.rank <= 3 && <Trophy className={`w-3.5 h-3.5 ${row.rank === 1 ? 'text-yellow-400' : row.rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />}
                        <span className="text-body-sm font-bold text-on-surface">{row.rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-body-sm font-medium text-on-surface">{row.nama}</td>
                    <td className="py-2.5 px-3">
                      <div className="text-body-sm font-semibold text-on-surface">{branch.label}</div>
                      <div className="text-label-xs text-on-surface-variant">{branch.detail}</div>
                    </td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface-variant">{row.posisi}</td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface text-right font-semibold">{row.prospekHariIni}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                        {row.persentase}%
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Seluruh Karyawan */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Seluruh Karyawan — Pencapaian Prospek</h3>
            <p className="text-label-xs text-on-surface-variant mt-1">Menampilkan {filteredEmployeeProspek.length} dari {employeeRows.length} karyawan</p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-high px-3 py-2 text-label-xs text-on-surface-variant">
            Baris <span className="font-bold text-on-surface">{filteredEmployeeProspek.length === 0 ? 0 : employeePageStart + 1}</span> - <span className="font-bold text-on-surface">{Math.min(employeePageStart + employeeItemsPerPage, filteredEmployeeProspek.length)}</span> dari <span className="font-bold text-on-surface">{filteredEmployeeProspek.length}</span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-outline-variant/10 bg-surface-high/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span className="text-label-sm font-bold text-on-surface">Filter Data</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="search"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Cari nama, cabang, kategori, posisi..."
                className="w-full h-10 rounded-lg border border-outline-variant/20 bg-surface px-9 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={employeeBranchFilter}
              onChange={(event) => setEmployeeBranchFilter(event.target.value)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              {employeeBranchOptions.map((branch) => (
                <option key={branch} value={branch}>Cabang: {branch === 'Semua' ? 'Semua' : getBranchDisplay(branch).filterLabel}</option>
              ))}
            </select>
            <select
              value={employeeCategoryFilter}
              onChange={(event) => setEmployeeCategoryFilter(event.target.value as 'Semua' | EmployeeProspekRow['kategori'])}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="Semua">Kategori: Semua</option>
              <option value="Sales">Kategori: Sales</option>
              <option value="Non-Sales">Kategori: Non-Sales</option>
            </select>
            <select
              value={employeePositionFilter}
              onChange={(event) => setEmployeePositionFilter(event.target.value)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              {employeePositionOptions.map((position) => (
                <option key={position} value={position}>Posisi: {position}</option>
              ))}
            </select>
            <select
              value={employeeAchievementFilter}
              onChange={(event) => setEmployeeAchievementFilter(event.target.value as AchievementFilter)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="Semua">Status: Semua</option>
              <option value="Tercapai">Status: Tercapai</option>
              <option value="Belum Tercapai">Status: Belum Tercapai</option>
            </select>
            <select
              value={employeeSort}
              onChange={(event) => setEmployeeSort(event.target.value as EmployeeSortKey)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="rank">Urutkan: Ranking</option>
              <option value="nama">Urutkan: Nama A-Z</option>
              <option value="cabang">Urutkan: Cabang A-Z</option>
              <option value="prospek_desc">Urutkan: Prospek Tertinggi</option>
              <option value="prospek_asc">Urutkan: Prospek Terendah</option>
              <option value="persentase_desc">Urutkan: Persentase Tertinggi</option>
              <option value="persentase_asc">Urutkan: Persentase Terendah</option>
            </select>
            <button
              type="button"
              onClick={resetEmployeeFilters}
              disabled={!hasEmployeeFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-14">#</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Cabang</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Kategori</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Posisi</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Target</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">%</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployeeProspek.map((row) => {
                const branch = getBranchDisplay(row.cabang);
                return (
                <tr key={`${row.employeeId || row.nama}-${row.kategori}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-body-sm font-bold text-on-surface">{row.rank}</td>
                  <td className="py-2.5 px-3 text-body-sm font-medium text-on-surface">{row.nama}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-body-sm font-semibold text-on-surface">{branch.label}</div>
                    <div className="text-label-xs text-on-surface-variant">{branch.detail}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex rounded-md px-2 py-1 text-label-xs font-bold ${row.kategori === 'Sales' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                      {row.kategori}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface-variant">{row.posisi}</td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface text-right font-semibold">{row.prospekHariIni}</td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface-variant text-right">{row.target}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {row.persentase}%
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredEmployeeProspek.length === 0 && (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-high/40 py-10 text-center">
            <p className="text-body-sm font-semibold text-on-surface">Tidak ada data yang cocok</p>
            <p className="text-label-xs text-on-surface-variant mt-1">Ubah kombinasi filter untuk melihat data karyawan lain.</p>
          </div>
        )}
        <Pagination
          currentPage={employeePage}
          totalPages={employeeTotalPages}
          onPageChange={setEmployeePage}
          className="mt-2 border-t border-white/5"
        />
      </motion.div>
    </motion.div>
  );
};

export default OwnerProspekPage;
