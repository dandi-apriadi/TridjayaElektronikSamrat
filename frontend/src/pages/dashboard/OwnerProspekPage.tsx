import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BadgeDollarSign, Users, Target, BarChart3, Trophy, Search, SlidersHorizontal, X, Eye, CalendarDays } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useCabangStore } from '../../store/useCabangStore';
import { useOffRequestStore } from '../../store/offRequestStore';
import { apiFetch } from '../../utils/apiClient';
import { createCabangLookup, getCabangDisplay } from '../../utils/cabangDisplay';
import { DENDA_PER_HARI, calculateProspekDailyFine, formatRupiah } from '../../utils/denda';
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
  prospekBulanIni: number;
  targetBulanan: number;
  persentaseBulanan: number;
  sisaTargetBulanan: number;
  hariDendaProspek: number;
  dendaProspek: number;
};

type AchievementFilter = 'Semua' | 'Tercapai' | 'Belum Tercapai';
type EmployeeSortKey = 'rank' | 'nama' | 'cabang' | 'prospek_desc' | 'prospek_asc' | 'persentase_desc' | 'persentase_asc';
type PeriodMode = 'day' | 'month' | 'custom';

type ProspekActivityRow = {
  id: string;
  karyawanId: string;
  karyawanName: string;
  divisi: string;
  targetKategori?: string;
  namaProspek: string;
  noWhatsapp: string;
  minatBarang: string;
  keteranganProspek: string;
  statusProspek: string;
  keteranganFincoy: string;
  tanggal: string;
  createdAt: string;
};

type ProspekChartRow = {
  label: string;
  sales: number;
  nonSales: number;
  tanggal?: string;
  jam?: string;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayDateKey = () => toDateKey(new Date());

const monthStartKey = (dateKey: string) => `${dateKey.slice(0, 8)}01`;

const formatShortDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const formatPeriodDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const monthLabels = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const getMonthEndKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return todayDateKey();
  return toDateKey(new Date(year, month, 0));
};

const buildDateKeysInRange = (from: string, to: string) => {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const buildElapsedDateKeysInRange = (from: string, to: string, today: string) =>
  buildDateKeysInRange(from, to).filter((tanggal) => tanggal <= today);

const formatTargetDelta = (actual: number, target: number) => {
  const delta = actual - target;
  if (delta > 0) return `+${delta.toLocaleString('id-ID')} prospek`;
  if (delta < 0) return `-${Math.abs(delta).toLocaleString('id-ID')} prospek`;
  return '0 prospek';
};

const mapProspekActivity = (item: any): ProspekActivityRow => ({
  id: String(item.id),
  karyawanId: String(item.karyawanId || item.karyawan_id || ''),
  karyawanName: String(item.karyawanName || item.karyawan_name || ''),
  divisi: String(item.divisi || ''),
  targetKategori: String(item.targetKategori || item.target_kategori || ''),
  namaProspek: String(item.namaProspek || item.nama_prospek || ''),
  noWhatsapp: String(item.noWhatsapp || item.no_whatsapp || ''),
  minatBarang: String(item.minatBarang || item.minat_barang || ''),
  keteranganProspek: String(item.keteranganProspek || item.keterangan_prospek || ''),
  statusProspek: String(item.statusProspek || item.status_prospek || ''),
  keteranganFincoy: String(item.keteranganFincoy || item.keterangan_fincoy || ''),
  tanggal: String(item.tanggal || ''),
  createdAt: String(item.createdAt || item.created_at || ''),
});

const fetchAllProspekActivity = async (baseQuery: URLSearchParams): Promise<ProspekActivityRow[]> => {
  const limit = 500;
  const items: ProspekActivityRow[] = [];
  let page = 1;

  while (page <= 50) {
    const query = new URLSearchParams(baseQuery);
    query.set('limit', String(limit));
    query.set('page', String(page));

    const response = await apiFetch(`/api/prospek-harian?${query.toString()}`);
    if (!response.ok) throw new Error('Aktivitas prospek gagal dimuat.');

    const payload = await response.json();
    const pageItems = (payload.data?.items || []).map(mapProspekActivity);
    items.push(...pageItems);

    if (pageItems.length < limit) break;
    page += 1;
  }

  return items;
};

const OwnerProspekPage: React.FC = () => {
  const today = todayDateKey();
  const [periodMode, setPeriodMode] = useState<PeriodMode>('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [customFrom, setCustomFrom] = useState(monthStartKey(today));
  const [customTo, setCustomTo] = useState(today);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeBranchFilter, setEmployeeBranchFilter] = useState('Semua');
  const [employeeCategoryFilter, setEmployeeCategoryFilter] = useState<'Semua' | EmployeeProspekRow['kategori']>('Semua');
  const [employeePositionFilter, setEmployeePositionFilter] = useState('Semua');
  const [employeeAchievementFilter, setEmployeeAchievementFilter] = useState<AchievementFilter>('Semua');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('rank');
  const [backendEmployeeProspek, setBackendEmployeeProspek] = useState<EmployeeProspekRow[]>([]);
  const [prospekActivity, setProspekActivity] = useState<ProspekActivityRow[]>([]);
  const [loadedProspekPeriodKey, setLoadedProspekPeriodKey] = useState('');
  const [detailEmployee, setDetailEmployee] = useState<EmployeeProspekRow | null>(null);
  const [detailProspek, setDetailProspek] = useState<ProspekActivityRow[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [isLoadingProspek, setIsLoadingProspek] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const cabangList = useCabangStore((state) => state.cabang);
  const fetchCabang = useCabangStore((state) => state.fetchCabang);
  const offRequests = useOffRequestStore((state) => state.requests);
  const fetchOffRequests = useOffRequestStore((state) => state.fetchRequests);
  const employeeItemsPerPage = 12;
  const periodRange = useMemo(() => {
    if (periodMode === 'month') {
      const from = `${selectedMonth}-01`;
      const to = getMonthEndKey(selectedMonth);
      const monthIndex = Math.max(0, Math.min(11, Number(selectedMonth.slice(5, 7)) - 1));
      return {
        from,
        to,
        label: `${monthLabels[monthIndex]} ${selectedMonth.slice(0, 4)}`,
      };
    }

    if (periodMode === 'custom') {
      const from = customFrom <= customTo ? customFrom : customTo;
      const to = customFrom <= customTo ? customTo : customFrom;
      return {
        from,
        to,
        label: `${formatPeriodDate(from)} - ${formatPeriodDate(to)}`,
      };
    }

    return {
      from: selectedDate,
      to: selectedDate,
      label: formatPeriodDate(selectedDate),
    };
  }, [customFrom, customTo, periodMode, selectedDate, selectedMonth]);
  const reportableDateKeys = useMemo(
    () => buildElapsedDateKeysInRange(periodRange.from, periodRange.to, today),
    [periodRange.from, periodRange.to, today]
  );
  const activeDate = reportableDateKeys[reportableDateKeys.length - 1] || periodRange.to;
  const activeMonthStart = reportableDateKeys[0] || periodRange.from;
  const periodDayCount = reportableDateKeys.length;
  const isSingleDayPeriod = periodRange.from === periodRange.to;
  const prospekPeriodKey = `${periodMode}|${periodRange.from}|${activeDate}`;
  const isProspekDataReady = loadedProspekPeriodKey === prospekPeriodKey;
  const currentBackendEmployeeProspek = isProspekDataReady ? backendEmployeeProspek : [];
  const currentProspekActivity = isProspekDataReady ? prospekActivity : [];
  const approvedOffDateByEmployee = useMemo(() => {
    const map = new Map<string, Set<string>>();
    offRequests
      .filter((request) => request.status === 'approved')
      .forEach((request) => {
        const keys = [request.karyawanId, request.karyawanNama.toLowerCase()].filter(Boolean);
        keys.forEach((key) => {
          const dates = map.get(key) || new Set<string>();
          dates.add(request.tanggal);
          map.set(key, dates);
        });
      });
    return map;
  }, [offRequests]);
  const selectedMonthYear = selectedMonth.slice(0, 4);
  const selectedMonthNumber = selectedMonth.slice(5, 7);
  const employeeRows = useMemo(() => {
    const countsByEmployee = new Map<string, number>();
    const countsByEmployeeDate = new Map<string, number>();
    currentProspekActivity.forEach((item) => {
      const key = item.karyawanId || item.karyawanName.toLowerCase();
      if (!key) return;
      countsByEmployee.set(key, (countsByEmployee.get(key) || 0) + 1);
      countsByEmployeeDate.set(`${key}|${item.tanggal}`, (countsByEmployeeDate.get(`${key}|${item.tanggal}`) || 0) + 1);
    });

    return currentBackendEmployeeProspek
      .map((row) => {
        const employeeKey = row.employeeId || row.nama.toLowerCase();
        const nameKey = row.nama.toLowerCase();
        const dailyTarget = Math.max(row.target || (row.kategori === 'Sales' ? 20 : 5), 0);
        const actual = countsByEmployee.get(employeeKey) ?? countsByEmployee.get(nameKey) ?? 0;
        const offDates = approvedOffDateByEmployee.get(employeeKey) || approvedOffDateByEmployee.get(nameKey) || new Set<string>();
        const activeTargetDays = reportableDateKeys.filter((tanggal) => !offDates.has(tanggal)).length;
        const periodTarget = Math.max(dailyTarget * activeTargetDays, 0);
        const percent = periodTarget > 0 ? Math.round((actual / periodTarget) * 100) : 0;
        const dailyMissedDays = reportableDateKeys.filter((tanggal) => {
          if (offDates.has(tanggal)) return false;
          const dailyActual = countsByEmployeeDate.get(`${employeeKey}|${tanggal}`) ?? countsByEmployeeDate.get(`${nameKey}|${tanggal}`) ?? 0;
          return calculateProspekDailyFine(dailyActual, dailyTarget) > 0;
        }).length;
        const periodShortfall = Math.max(periodTarget - actual, 0);
        return {
          ...row,
          prospekHariIni: actual,
          target: periodTarget,
          persentase: percent,
          prospekBulanIni: actual,
          targetBulanan: periodTarget,
          persentaseBulanan: percent,
          sisaTargetBulanan: periodShortfall,
          hariDendaProspek: dailyMissedDays,
          dendaProspek: dailyMissedDays * DENDA_PER_HARI,
        };
      })
      .sort((a, b) => b.prospekHariIni - a.prospekHariIni || a.nama.localeCompare(b.nama, 'id'))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [approvedOffDateByEmployee, currentBackendEmployeeProspek, currentProspekActivity, reportableDateKeys]);
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
  const totalProspekBulanan = useMemo(() => employeeRows.reduce((sum, row) => sum + row.prospekBulanIni, 0), [employeeRows]);
  const totalTargetBulanan = useMemo(() => employeeRows.reduce((sum, row) => sum + row.targetBulanan, 0), [employeeRows]);
  const monthlyAchievementPercent = totalTargetBulanan > 0 ? Math.round((totalProspekBulanan / totalTargetBulanan) * 100) : 0;
  const monthlyTargetDelta = totalProspekBulanan - totalTargetBulanan;
  const monthlyTargetDeltaLabel = formatTargetDelta(totalProspekBulanan, totalTargetBulanan);
  const totalDendaProspek = useMemo(() => employeeRows.reduce((sum, row) => sum + row.dendaProspek, 0), [employeeRows]);
  const totalHariDendaProspek = useMemo(() => employeeRows.reduce((sum, row) => sum + row.hariDendaProspek, 0), [employeeRows]);
  const totalKaryawanDendaProspek = useMemo(() => employeeRows.filter((row) => row.hariDendaProspek > 0).length, [employeeRows]);
  const fineReportQuery = useMemo(() => {
    const query = new URLSearchParams();
    query.set('mode', periodMode);
    query.set('from', periodRange.from);
    query.set('to', activeDate);
    query.set('label', periodRange.label);
    return query.toString();
  }, [activeDate, periodMode, periodRange.from, periodRange.label]);
  const totalClosing = useMemo(() => currentProspekActivity.filter((row) => row.statusProspek === 'deal').length, [currentProspekActivity]);
  const conversionPercent = totalProspek > 0 ? Math.round((totalClosing / totalProspek) * 100) : 0;
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
    fetchOffRequests({ tanggalFrom: periodRange.from, tanggalTo: activeDate, limit: 500 });
  }, [activeDate, fetchOffRequests, periodRange.from]);

  useEffect(() => {
    let mounted = true;
    const loadProspek = async () => {
      setIsLoadingProspek(true);
      setLoadedProspekPeriodKey('');
      const query = new URLSearchParams();
      if (isSingleDayPeriod) {
        query.set('tanggal', periodRange.from);
      } else {
        query.set('date_from', periodRange.from);
        query.set('date_to', activeDate);
      }

      const [summaryResponse, activityResponse] = await Promise.all([
        apiFetch(`/api/prospek-harian/summary?tanggal=${encodeURIComponent(activeDate)}`),
        fetchAllProspekActivity(query),
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
          prospekBulanIni: Number(item.prospekBulanIni || item.prospek_bulan_ini || 0),
          targetBulanan: Number(item.targetBulanan || item.target_bulanan || 0),
          persentaseBulanan: Number(item.persentaseBulanan || item.persentase_bulanan || 0),
          sisaTargetBulanan: Number(item.sisaTargetBulanan || item.sisa_target_bulanan || 0),
          hariDendaProspek: 0,
          dendaProspek: 0,
        })));
      } else {
        setBackendEmployeeProspek([]);
      }

      setProspekActivity(activityResponse);
      setLoadedProspekPeriodKey(prospekPeriodKey);

      setIsLoadingProspek(false);
    };
    loadProspek().catch(() => {
      if (!mounted) return;
      setBackendEmployeeProspek([]);
      setProspekActivity([]);
      setLoadedProspekPeriodKey('');
      setIsLoadingProspek(false);
    });
    return () => {
      mounted = false;
    };
  }, [activeDate, isSingleDayPeriod, periodRange.from, periodRange.to, prospekPeriodKey]);

  useEffect(() => {
    setDetailEmployee(null);
    setDetailProspek([]);
    setDetailError('');
  }, [periodRange.from, periodRange.to]);

  const resetEmployeeFilters = () => {
    setEmployeeSearch('');
    setEmployeeBranchFilter('Semua');
    setEmployeeCategoryFilter('Semua');
    setEmployeePositionFilter('Semua');
    setEmployeeAchievementFilter('Semua');
    setEmployeeSort('rank');
  };

  const openEmployeeDetail = async (row: EmployeeProspekRow) => {
    setDetailEmployee(row);
    setIsLoadingDetail(true);
    setDetailError('');
    setDetailProspek([]);
    const query = new URLSearchParams();
    if (row.employeeId.trim()) {
      query.set('karyawan_id', row.employeeId);
    }
    if (isSingleDayPeriod) {
      query.set('tanggal', periodRange.from);
    } else {
      query.set('date_from', periodRange.from);
      query.set('date_to', activeDate);
    }

    try {
      const items = await fetchAllProspekActivity(query);
      const employeeItems = row.employeeId.trim()
        ? items
        : items.filter((item: ProspekActivityRow) => item.karyawanName.toLowerCase() === row.nama.toLowerCase());
      setDetailProspek(employeeItems);
      if (employeeItems.length === 0 && row.prospekBulanIni > 0) {
        setDetailError('Data ringkasan ada, tetapi daftar detail karyawan ini belum ditemukan dari API.');
      }
    } catch (error) {
      setDetailProspek([]);
      setDetailError(error instanceof Error ? error.message : 'Detail prospek gagal dimuat.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!detailEmployee) return;
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [detailEmployee?.employeeId, detailEmployee?.nama]);

  const closeEmployeeDetail = () => {
    setDetailEmployee(null);
    setDetailProspek([]);
    setDetailError('');
  };

  const getDetailButtonLabel = (row: EmployeeProspekRow) => {
    if (isLoadingDetail && detailEmployee?.employeeId === row.employeeId && detailEmployee?.nama === row.nama) return 'Memuat';
    if (detailEmployee?.employeeId === row.employeeId && detailEmployee?.nama === row.nama) return 'Terbuka';
    return 'Lihat';
  };

  const detailDateRows = useMemo(() => {
    if (!detailEmployee) return [];
    const fallbackDailyTarget = detailEmployee.kategori === 'Sales' ? 20 : 5;
    const offDates =
      approvedOffDateByEmployee.get(detailEmployee.employeeId) ||
      approvedOffDateByEmployee.get(detailEmployee.nama.toLowerCase()) ||
      new Set<string>();
    const activeTargetDays = Math.max(reportableDateKeys.filter((tanggal) => !offDates.has(tanggal)).length, 1);
    const dailyTarget = Math.max(
      1,
      Math.round((detailEmployee.target || fallbackDailyTarget * activeTargetDays) / activeTargetDays)
    );
    const map = new Map<string, number>();
    detailProspek.forEach((item) => {
      map.set(item.tanggal, (map.get(item.tanggal) || 0) + 1);
    });
    return reportableDateKeys
      .slice()
      .sort((a, b) => b.localeCompare(a))
      .map((tanggal) => {
        const total = map.get(tanggal) || 0;
        const isOffDay = offDates.has(tanggal);
        return {
        tanggal,
        total,
        target: dailyTarget,
        gap: isOffDay ? 0 : Math.max(dailyTarget - total, 0),
        fine: isOffDay ? 0 : calculateProspekDailyFine(total, dailyTarget),
        percent: isOffDay ? 100 : dailyTarget > 0 ? Math.round((total / dailyTarget) * 100) : 0,
        isOffDay,
      };
      });
  }, [approvedOffDateByEmployee, detailEmployee, detailProspek, reportableDateKeys]);

  const hourlyData = useMemo<ProspekChartRow[]>(() => {
    const rows = Array.from({ length: 24 }, (_, hour) => {
      const jam = `${String(hour).padStart(2, '0')}:00`;
      return { jam, label: jam, sales: 0, nonSales: 0 };
    });
    currentProspekActivity.forEach((row) => {
      if (row.tanggal !== activeDate) return;
      const hour = Number((row.createdAt.includes('T') ? row.createdAt.slice(11, 13) : row.createdAt.slice(0, 2)) || -1);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
      if (getActivityCategory(row) === 'Sales') rows[hour].sales += 1;
      else rows[hour].nonSales += 1;
    });
    return rows;
  }, [activeDate, categoryByEmployee, currentProspekActivity]);

  const dailyPeriodData = useMemo<ProspekChartRow[]>(() => {
    const rows = reportableDateKeys.map((tanggal) => ({
      tanggal,
      label: formatShortDate(tanggal),
      sales: 0,
      nonSales: 0,
    }));
    const rowsByDate = new Map(rows.map((row) => [row.tanggal, row]));
    currentProspekActivity.forEach((row) => {
      const target = rowsByDate.get(row.tanggal);
      if (!target) return;
      if (getActivityCategory(row) === 'Sales') target.sales += 1;
      else target.nonSales += 1;
    });
    return rows;
  }, [categoryByEmployee, currentProspekActivity, reportableDateKeys]);

  const chartData = isSingleDayPeriod ? hourlyData : dailyPeriodData;
  const chartXAxisKey = 'label';
  const peakHour = useMemo<{ jam: string; total: number } | null>(() => {
    if (!isSingleDayPeriod) return null;
    return hourlyData.reduce(
      (peak, row) => {
        const total = row.sales + row.nonSales;
        return total > peak.total ? { jam: row.jam || row.label, total } : peak;
      },
      { jam: '', total: 0 }
    );
  }, [hourlyData, isSingleDayPeriod]);

  const cards = [
    {
      label: 'Prospek Masuk Periode',
      formattedValue: totalProspek.toLocaleString('id-ID'),
      helper: isLoadingProspek ? 'Memuat data aktual' : `${employeeRows.length} karyawan, ${periodRange.label}`,
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
      label: 'Capaian Target Periode',
      formattedValue: `${monthlyAchievementPercent}%`,
      helper: `${totalProspekBulanan} prospek dari target ${totalTargetBulanan}, selisih ${monthlyTargetDeltaLabel}`,
      icon: CalendarDays,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      valueColor: monthlyAchievementPercent >= 100 ? 'text-secondary' : monthlyAchievementPercent >= 70 ? 'text-yellow-400' : 'text-error',
    },
    {
      label: 'Denda Prospek',
      formattedValue: formatRupiah(totalDendaProspek),
      helper: totalHariDendaProspek > 0 ? `${totalKaryawanDendaProspek} karyawan melanggar, ${totalHariDendaProspek} hari` : 'Semua karyawan capai target harian',
      icon: BadgeDollarSign,
      color: totalDendaProspek > 0 ? 'text-error' : 'text-secondary',
      bg: totalDendaProspek > 0 ? 'bg-error/10' : 'bg-secondary/10',
      valueColor: totalDendaProspek > 0 ? 'text-error' : 'text-secondary',
      actionPath: `/dashboard/owner/prospek/denda?${fineReportQuery}`,
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="font-display text-headline-sm font-bold text-on-surface">Prospek & Closing</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">Monitoring prospek masuk, closing, conversion rate, dan raport persentase</p>
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="font-display text-title-sm font-bold text-on-surface">Filter Periode Data</h2>
            </div>
            <p className="mt-1 text-label-sm text-on-surface-variant">
              Periode aktif: <span className="font-bold text-on-surface">{periodRange.label}</span>
            </p>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex w-full gap-1 rounded-lg bg-surface-high p-1 xl:w-auto">
              {[
                { mode: 'day' as const, label: 'Harian' },
                { mode: 'month' as const, label: 'Bulanan' },
                { mode: 'custom' as const, label: 'Custom' },
              ].map((item) => (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setPeriodMode(item.mode)}
                  className={`h-9 flex-1 rounded-md px-3 text-label-sm font-bold transition-colors xl:flex-none ${
                    periodMode === item.mode ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {periodMode === 'day' && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface"
                >
                  Hari ini
                </button>
              </div>
            )}

            {periodMode === 'month' && (
              <div className="grid grid-cols-[1fr_1.35fr] gap-2">
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={selectedMonthYear}
                  onChange={(event) => {
                    const year = event.target.value.replace(/\D/g, '').slice(0, 4) || today.slice(0, 4);
                    setSelectedMonth(`${year}-${selectedMonthNumber}`);
                  }}
                  className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  aria-label="Tahun"
                />
                <select
                  value={selectedMonthNumber}
                  onChange={(event) => setSelectedMonth(`${selectedMonthYear}-${event.target.value}`)}
                  className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  aria-label="Bulan"
                >
                  {monthLabels.map((label, index) => (
                    <option key={label} value={String(index + 1).padStart(2, '0')}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'custom' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  aria-label="Tanggal awal"
                />
                <span className="hidden text-label-xs font-bold uppercase tracking-widest text-on-surface-variant sm:block">sampai</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                  aria-label="Tanggal akhir"
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <motion.div key={card.label} variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${card.bg} ${card.color}`}><Icon className="w-5 h-5" /></div>
              </div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">{card.label}</div>
              <div className={`font-display text-headline-sm font-bold ${card.valueColor}`}>{card.formattedValue}</div>
              <div className="text-label-xs text-on-surface-variant mt-1">{card.helper}</div>
              {'actionPath' in card && card.actionPath && (
                <Link
                  to={card.actionPath}
                  className="mt-4 inline-flex h-8 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-xs font-bold text-primary transition hover:border-primary/40 hover:bg-primary/10"
                >
                  Detail laporan
                </Link>
              )}
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
            <p className="text-label-xs text-on-surface-variant mt-1">
              {isSingleDayPeriod ? 'Distribusi prospek per jam' : 'Distribusi prospek per tanggal'} untuk {periodRange.label}
            </p>
          </div>
          <span className="inline-flex h-9 items-center rounded-lg border border-outline-variant/10 bg-surface-high px-3 text-label-xs font-bold text-on-surface-variant">
            {periodDayCount} hari
          </span>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <AreaChart data={chartData}>
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
              <XAxis dataKey={chartXAxisKey} stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradS)" />
              <Area type="monotone" dataKey="nonSales" name="Non-Sales" stroke="#A2F31F" strokeWidth={2.5} fill="url(#gradNS)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {isSingleDayPeriod && peakHour && peakHour.total > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-surface-high/50 border border-white/5">
            <p className="text-label-xs text-on-surface-variant">
              <span className="font-semibold text-primary">Jam tertinggi:</span> prospek paling banyak masuk di <span className="font-bold text-on-surface">{peakHour.jam}</span> dengan <span className="font-bold text-on-surface">{peakHour.total}</span> prospek.
            </p>
          </div>
        )}
      </motion.div>

      {/* Persentase Prospek — Akumulasi Target */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Persentase Pencapaian Prospek Periode</h3>
        <p className="text-body-sm text-on-surface-variant mb-4">
          Target dihitung sesuai rentang {periodRange.label} ({periodDayCount} hari): Sales 20/hari, Non-Sales 5/hari.
        </p>

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
                <div className="text-label-xs text-on-surface-variant mt-2">{actualSales} / {totalTargetSales} prospek (target periode {targetSalesPerOrang}/orang)</div>
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
                <div className="text-label-xs text-on-surface-variant mt-2">{actualNonSales} / {totalTargetNonSales} prospek (target periode {targetNonSalesPerOrang}/orang)</div>
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

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Target Prospek Periode</h3>
            <p className="text-body-sm text-on-surface-variant">
              Periode {formatShortDate(activeMonthStart)} sampai {formatShortDate(activeDate)}, target mengikuti rentang tanggal aktif.
            </p>
          </div>
          <span className={`rounded-lg border px-3 py-2 text-label-xs font-bold ${
            monthlyTargetDelta >= 0
              ? 'border-secondary/20 bg-secondary/10 text-secondary'
              : 'border-error/20 bg-error/10 text-error'
          }`}>
            Target {monthlyTargetDeltaLabel}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: `Sales (${salesRows.length} orang)`,
              actual: salesRows.reduce((sum, row) => sum + row.prospekBulanIni, 0),
              target: salesRows.reduce((sum, row) => sum + row.targetBulanan, 0),
            },
            {
              label: `Non-Sales (${nonSalesRows.length} orang)`,
              actual: nonSalesRows.reduce((sum, row) => sum + row.prospekBulanIni, 0),
              target: nonSalesRows.reduce((sum, row) => sum + row.targetBulanan, 0),
            },
            {
              label: `Total (${employeeRows.length} karyawan)`,
              actual: totalProspekBulanan,
              target: totalTargetBulanan,
            },
          ].map((item) => {
            const percent = item.target > 0 ? Math.round((item.actual / item.target) * 100) : 0;
            return (
              <div key={item.label} className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">{item.label}</div>
                <div className={`font-display text-title-lg font-bold ${percent >= 100 ? 'text-secondary' : percent >= 70 ? 'text-yellow-400' : 'text-error'}`}>{percent}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${percent >= 100 ? 'bg-secondary' : percent >= 70 ? 'bg-yellow-400' : 'bg-error'}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">
                  {item.actual.toLocaleString('id-ID')} / {item.target.toLocaleString('id-ID')} prospek
                </div>
              </div>
            );
          })}
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
              <option value="prospek_desc">Urutkan: Prospek Periode Tertinggi</option>
              <option value="prospek_asc">Urutkan: Prospek Periode Terendah</option>
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
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-14">#</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Cabang</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Kategori</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Posisi</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek Periode</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Target Periode</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Selisih Target</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Denda</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Capaian</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployeeProspek.map((row) => {
                const branch = getBranchDisplay(row.cabang);
                const isDetailOpen = detailEmployee?.employeeId === row.employeeId && detailEmployee?.nama === row.nama;
                const isDetailLoading = isLoadingDetail && isDetailOpen;
                return (
                <tr
                  key={`${row.employeeId || row.nama}-${row.kategori}`}
                  onClick={() => openEmployeeDetail(row)}
                  className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-primary/5 ${isDetailOpen ? 'bg-primary/10 ring-1 ring-inset ring-primary/20' : ''}`}
                  aria-selected={isDetailOpen}
                >
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
                  <td className="py-2.5 px-3 text-body-sm text-on-surface-variant text-right">{row.targetBulanan}</td>
                  <td className={`py-2.5 px-3 text-body-sm font-bold text-right ${
                    row.prospekBulanIni >= row.targetBulanan ? 'text-secondary' : 'text-error'
                  }`}>
                    {formatTargetDelta(row.prospekBulanIni, row.targetBulanan)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className={`text-body-sm font-bold ${row.dendaProspek > 0 ? 'text-error' : 'text-secondary'}`}>{formatRupiah(row.dendaProspek)}</div>
                    <div className="text-[11px] font-semibold text-on-surface-variant">{row.hariDendaProspek} hari</div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {row.persentase}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEmployeeDetail(row);
                      }}
                      disabled={isDetailLoading}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-xs font-bold text-primary transition hover:border-primary/40 hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {getDetailButtonLabel(row)}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {detailEmployee && (
          <div ref={detailPanelRef} className="mt-5 scroll-mt-28 rounded-xl border border-primary/20 bg-surface-high/35 p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display text-title-sm font-bold text-on-surface">Detail Prospek {detailEmployee.nama}</h4>
                  <span className={`rounded-md px-2 py-1 text-label-xs font-bold ${detailEmployee.kategori === 'Sales' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                    {detailEmployee.kategori}
                  </span>
                </div>
                <p className="mt-1 text-label-xs text-on-surface-variant">
                  Periode {periodRange.label}: {detailEmployee.prospekBulanIni} / {detailEmployee.targetBulanan} prospek, selisih {formatTargetDelta(detailEmployee.prospekBulanIni, detailEmployee.targetBulanan)}
                </p>
                <p className={`mt-1 text-label-xs font-bold ${detailEmployee.dendaProspek > 0 ? 'text-error' : 'text-secondary'}`}>
                  Denda prospek: {formatRupiah(detailEmployee.dendaProspek)} ({detailEmployee.hariDendaProspek} hari gagal target)
                </p>
              </div>
              <button
                type="button"
                onClick={closeEmployeeDetail}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface"
              >
                <X className="h-4 w-4" />
                Tutup
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="rounded-lg border border-outline-variant/10 bg-surface/50 p-5 text-body-sm font-semibold text-on-surface-variant">
                Memuat detail prospek...
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                {detailError && (
                  <div className="xl:col-span-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-semibold text-error">
                    {detailError}
                  </div>
                )}
                <div className="rounded-lg border border-outline-variant/10 bg-surface/55 p-3">
                  <p className="mb-3 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Rekap per tanggal</p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {detailDateRows.map((item) => (
                      <div key={item.tanggal} className="rounded-lg bg-surface-high/70 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-label-sm font-bold text-on-surface">{formatShortDate(item.tanggal)}</span>
                          <span className={`text-label-xs font-black ${item.gap === 0 ? 'text-secondary' : 'text-error'}`}>
                            {item.total}/{item.target}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                          <div className={`h-full rounded-full ${item.gap === 0 ? 'bg-secondary' : 'bg-error'}`} style={{ width: `${Math.min(item.percent, 100)}%` }} />
                        </div>
                        <p className="mt-1 text-label-xs text-on-surface-variant">
                          {item.isOffDay ? 'OFF disetujui PIC, denda tidak dihitung' : item.gap > 0 ? `Kurang ${item.gap} prospek, denda ${formatRupiah(item.fine)}` : 'Target tanggal ini tercapai'}
                        </p>
                      </div>
                    ))}
                    {detailDateRows.length === 0 && (
                      <p className="rounded-lg border border-dashed border-outline-variant/20 p-4 text-center text-label-sm text-on-surface-variant">
                        Belum ada prospek yang tercatat.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-outline-variant/10 bg-surface/55 p-3">
                  <p className="mb-3 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Daftar prospek keseluruhan</p>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {detailProspek.map((item) => (
                      <article key={item.id} className="rounded-lg border border-outline-variant/10 bg-surface-high/70 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-body-sm font-bold text-on-surface">{item.namaProspek}</p>
                            <p className="mt-1 text-label-sm font-semibold text-on-surface-variant">{item.minatBarang || '-'}</p>
                            <p className="mt-1 text-label-xs text-on-surface-variant">{item.keteranganProspek || 'Tanpa keterangan lapangan.'}</p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right">
                            <p className="text-label-xs font-bold text-on-surface">{formatShortDate(item.tanggal)} {item.createdAt}</p>
                            <p className="mt-1 text-label-xs text-on-surface-variant">{item.statusProspek || '-'}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                    {detailProspek.length === 0 && (
                      <p className="rounded-lg border border-dashed border-outline-variant/20 p-4 text-center text-label-sm text-on-surface-variant">
                        Tidak ada detail prospek untuk karyawan ini.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
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
