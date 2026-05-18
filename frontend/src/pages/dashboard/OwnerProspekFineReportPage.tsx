import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileCheck2,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';
import { createCabangLookup, getCabangDisplay } from '../../utils/cabangDisplay';
import {
  DENDA_PER_HARI,
  JOBDESK_FINE_MIN_SCORE,
  calculateJobdeskScoreFine,
  calculateProspekDailyFine,
  formatRupiah,
} from '../../utils/denda';
import { useCabangStore } from '../../store/useCabangStore';
import { useOffRequestStore } from '../../store/offRequestStore';

type EmployeeSummaryRow = {
  employeeId: string;
  nama: string;
  cabang: string;
  kategori: 'Sales' | 'Non-Sales';
  posisi: string;
  target: number;
};

type ProspekActivityRow = {
  karyawanId: string;
  karyawanName: string;
  tanggal: string;
  statusProspek: string;
};

type RaportActivityRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  cabang: string;
  divisiName: string;
  tanggal: string;
  jobdeskIndex: number;
  jobdeskText: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  score?: number;
  reviewerComment: string;
};

type ProspekViolationDay = {
  tanggal: string;
  actual: number;
  target: number;
  gap: number;
  fine: number;
};

type JobdeskFineDay = {
  tanggal: string;
  score: number;
  scoredCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  totalItems: number;
  fine: number;
  comments: string[];
  rejectedItems: RaportActivityRow[];
};

type FineEmployeeRow = EmployeeSummaryRow & {
  totalProspek: number;
  totalClosing: number;
  targetPeriode: number;
  prospekPercent: number;
  selisihPeriode: number;
  violationDays: ProspekViolationDay[];
  jobdeskFineDays: JobdeskFineDay[];
  raportAverage: number;
  raportReviewedDays: number;
  totalRaportItems: number;
  totalRejectedJobdesk: number;
  totalPendingJobdesk: number;
  prospekFine: number;
  jobdeskFine: number;
  totalFine: number;
};

type FineStatusFilter = 'Semua' | 'Ada Denda' | 'Aman' | 'Prospek' | 'Jobdesk';
type SortKey = 'fine_desc' | 'fine_asc' | 'name' | 'prospek_gap' | 'jobdesk_score';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const chartColors = {
  prospek: '#2563eb',
  jobdesk: '#dc2626',
  target: '#0891b2',
  closing: '#16a34a',
  neutral: '#64748b',
  warning: '#ca8a04',
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const todayDateKey = () => toDateKey(new Date());

const formatShortDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const formatLongDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

const getMonthStartKey = (dateKey: string) => `${dateKey.slice(0, 8)}01`;

const buildDateKeysInRange = (from: string, to: string) => {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
};

const normalizeDateParam = (value: string | null, fallback: string) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;

const clampDateToToday = (value: string, today: string) => (value > today ? today : value);

const formatTargetDelta = (actual: number, target: number) => {
  const delta = actual - target;
  if (delta > 0) return `+${delta.toLocaleString('id-ID')}`;
  if (delta < 0) return `-${Math.abs(delta).toLocaleString('id-ID')}`;
  return '0';
};

const formatPercent = (value: number) => `${Math.max(0, Math.round(value)).toLocaleString('id-ID')}%`;

const mapSummaryRow = (item: any): EmployeeSummaryRow => ({
  employeeId: String(item.employeeId || item.employee_id || ''),
  nama: String(item.nama || ''),
  cabang: String(item.cabang || 'Cabang belum diatur'),
  kategori: item.kategori === 'Sales' ? 'Sales' : 'Non-Sales',
  posisi: String(item.posisi || 'Karyawan'),
  target: Number(item.target || 0),
});

const mapActivityRow = (item: any): ProspekActivityRow => ({
  karyawanId: String(item.karyawanId || item.karyawan_id || ''),
  karyawanName: String(item.karyawanName || item.karyawan_name || ''),
  tanggal: String(item.tanggal || ''),
  statusProspek: String(item.statusProspek || item.status_prospek || ''),
});

const mapRaportRow = (item: any): RaportActivityRow => ({
  id: String(item.id || ''),
  employeeId: String(item.employeeId || item.employee_id || ''),
  employeeName: String(item.employeeName || item.employee_name || ''),
  cabang: String(item.cabang || 'Cabang belum diatur'),
  divisiName: String(item.divisiName || item.divisi_name || item.divisiId || item.divisi_id || 'Karyawan'),
  tanggal: String(item.tanggal || ''),
  jobdeskIndex: Number(item.jobdeskIndex ?? item.jobdesk_index ?? 0),
  jobdeskText: String(item.jobdeskText || item.jobdesk_text || ''),
  reviewStatus: (item.reviewStatus || item.review_status || 'pending') as RaportActivityRow['reviewStatus'],
  score: item.score == null ? undefined : Number(item.score),
  reviewerComment: String(item.reviewerComment || item.reviewer_comment || ''),
});

const readApiError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) return payload.errors.join(', ');
  return payload?.detail || payload?.message || fallback;
};

const fetchAllProspekActivity = async (from: string, to: string): Promise<ProspekActivityRow[]> => {
  const limit = 500;
  const items: ProspekActivityRow[] = [];
  let page = 1;

  while (page <= 80) {
    const query = new URLSearchParams();
    if (from === to) {
      query.set('tanggal', from);
    } else {
      query.set('date_from', from);
      query.set('date_to', to);
    }
    query.set('limit', String(limit));
    query.set('page', String(page));

    const response = await apiFetch(`/api/prospek-harian?${query.toString()}`);
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat aktivitas prospek.'));
    const payload = await response.json();
    const pageItems = (payload.data?.items || []).map(mapActivityRow);
    items.push(...pageItems);

    if (pageItems.length < limit) break;
    page += 1;
  }

  return items;
};

const fetchAllRaportActivity = async (from: string, to: string): Promise<RaportActivityRow[]> => {
  const limit = 1000;
  const items: RaportActivityRow[] = [];
  let page = 1;

  while (page <= 80) {
    const query = new URLSearchParams();
    if (from === to) {
      query.set('tanggal', from);
    } else {
      query.set('tanggal_from', from);
      query.set('tanggal_to', to);
    }
    query.set('limit', String(limit));
    query.set('page', String(page));

    const response = await apiFetch(`/api/raport-harian?${query.toString()}`);
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat laporan jobdesk.'));
    const payload = await response.json();
    const pageItems = (payload.data?.items || []).map(mapRaportRow);
    items.push(...pageItems);

    if (pageItems.length < limit) break;
    page += 1;
  }

  return items;
};

const summarizeJobdeskDay = (items: RaportActivityRow[]): JobdeskFineDay => {
  const scoredItems = items.filter((item) => item.reviewStatus === 'rejected' || typeof item.score === 'number');
  const score = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + (item.reviewStatus === 'rejected' ? 0 : item.score || 0), 0) / scoredItems.length)
    : 0;
  const rejectedItems = items.filter((item) => item.reviewStatus === 'rejected');
  const fine = calculateJobdeskScoreFine(score, scoredItems.length > 0);

  return {
    tanggal: items[0]?.tanggal || '',
    score,
    scoredCount: scoredItems.length,
    approvedCount: items.filter((item) => item.reviewStatus === 'approved').length,
    rejectedCount: rejectedItems.length,
    pendingCount: items.filter((item) => item.reviewStatus === 'pending').length,
    totalItems: items.length,
    fine,
    comments: items.map((item) => item.reviewerComment.trim()).filter(Boolean),
    rejectedItems,
  };
};

const OwnerProspekFineReportPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayDateKey();
  const initialFrom = normalizeDateParam(searchParams.get('from'), getMonthStartKey(today));
  const initialTo = clampDateToToday(normalizeDateParam(searchParams.get('to'), today), today);
  const [from, setFrom] = useState(initialFrom <= initialTo ? initialFrom : initialTo);
  const [to, setTo] = useState(initialFrom <= initialTo ? initialTo : initialFrom);
  const [employees, setEmployees] = useState<EmployeeSummaryRow[]>([]);
  const [activity, setActivity] = useState<ProspekActivityRow[]>([]);
  const [raportActivity, setRaportActivity] = useState<RaportActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Semua' | 'Sales' | 'Non-Sales'>('Semua');
  const [branchFilter, setBranchFilter] = useState('Semua');
  const [positionFilter, setPositionFilter] = useState('Semua');
  const [fineStatusFilter, setFineStatusFilter] = useState<FineStatusFilter>('Ada Denda');
  const [sortKey, setSortKey] = useState<SortKey>('fine_desc');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const cabangList = useCabangStore((state) => state.cabang);
  const fetchCabang = useCabangStore((state) => state.fetchCabang);
  const offRequests = useOffRequestStore((state) => state.requests);
  const fetchOffRequests = useOffRequestStore((state) => state.fetchRequests);
  const cabangLookup = useMemo(() => createCabangLookup(cabangList), [cabangList]);
  const getBranchDisplay = (value: string) => getCabangDisplay(value, cabangLookup);
  const dateKeys = useMemo(() => buildDateKeysInRange(from, to).filter((date) => date <= today), [from, to, today]);
  const periodLabel = dateKeys.length === 1 ? formatLongDate(from) : `${formatLongDate(from)} - ${formatLongDate(to)}`;

  useEffect(() => {
    fetchCabang();
  }, [fetchCabang]);

  useEffect(() => {
    fetchOffRequests({ tanggalFrom: from, tanggalTo: to, limit: 500 });
  }, [fetchOffRequests, from, to]);

  useEffect(() => {
    const query = new URLSearchParams();
    query.set('from', from);
    query.set('to', to);
    query.set('label', periodLabel);
    setSearchParams(query, { replace: true });
  }, [from, periodLabel, setSearchParams, to]);

  useEffect(() => {
    let mounted = true;
    const loadReport = async () => {
      if (dateKeys.length === 0) {
        setEmployees([]);
        setActivity([]);
        setRaportActivity([]);
        setError('Periode tidak valid.');
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const [summaryResponse, activityRows, raportRows] = await Promise.all([
          apiFetch(`/api/prospek-harian/summary?tanggal=${encodeURIComponent(to)}`),
          fetchAllProspekActivity(from, to),
          fetchAllRaportActivity(from, to),
        ]);
        if (!mounted) return;
        if (!summaryResponse.ok) {
          throw new Error(await readApiError(summaryResponse, 'Gagal memuat daftar karyawan.'));
        }

        const summaryPayload = await summaryResponse.json();
        setEmployees((summaryPayload.data?.items || []).map(mapSummaryRow));
        setActivity(activityRows);
        setRaportActivity(raportRows);
      } catch (loadError) {
        if (!mounted) return;
        setEmployees([]);
        setActivity([]);
        setRaportActivity([]);
        setError(loadError instanceof Error ? loadError.message : 'Laporan denda gagal dimuat.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadReport();
    return () => {
      mounted = false;
    };
  }, [dateKeys.length, from, to]);

  const fineRows = useMemo<FineEmployeeRow[]>(() => {
    const countsByEmployee = new Map<string, number>();
    const closingsByEmployee = new Map<string, number>();
    const countsByEmployeeDate = new Map<string, number>();

    activity.forEach((item) => {
      const key = item.karyawanId || item.karyawanName.toLowerCase();
      if (!key) return;
      countsByEmployee.set(key, (countsByEmployee.get(key) || 0) + 1);
      countsByEmployeeDate.set(`${key}|${item.tanggal}`, (countsByEmployeeDate.get(`${key}|${item.tanggal}`) || 0) + 1);
      if (item.statusProspek === 'deal') {
        closingsByEmployee.set(key, (closingsByEmployee.get(key) || 0) + 1);
      }
    });

    const jobdeskByEmployeeDate = new Map<string, RaportActivityRow[]>();
    const raportEmployeeFallback = new Map<string, EmployeeSummaryRow>();
    raportActivity.forEach((item) => {
      const key = item.employeeId || item.employeeName.toLowerCase();
      if (!key) return;
      const dateKey = `${key}|${item.tanggal}`;
      jobdeskByEmployeeDate.set(dateKey, [...(jobdeskByEmployeeDate.get(dateKey) || []), item]);
      if (!raportEmployeeFallback.has(key)) {
        raportEmployeeFallback.set(key, {
          employeeId: item.employeeId,
          nama: item.employeeName,
          cabang: item.cabang,
          kategori: item.divisiName.toLowerCase().includes('sales') ? 'Sales' : 'Non-Sales',
          posisi: item.divisiName,
          target: item.divisiName.toLowerCase().includes('sales') ? 20 : 5,
        });
      }
    });

    const employeeMap = new Map<string, EmployeeSummaryRow>();
    employees.forEach((employee) => employeeMap.set(employee.employeeId || employee.nama.toLowerCase(), employee));
    raportEmployeeFallback.forEach((employee, key) => {
      if (!employeeMap.has(key)) employeeMap.set(key, employee);
    });

    return [...employeeMap.values()]
      .map((employee) => {
        const employeeKey = employee.employeeId || employee.nama.toLowerCase();
        const nameKey = employee.nama.toLowerCase();
        const dailyTarget = Math.max(employee.target || (employee.kategori === 'Sales' ? 20 : 5), 0);
        const totalProspek = countsByEmployee.get(employeeKey) ?? countsByEmployee.get(nameKey) ?? 0;
        const totalClosing = closingsByEmployee.get(employeeKey) ?? closingsByEmployee.get(nameKey) ?? 0;
        const approvedOffDates = new Set(
          offRequests
            .filter(
              (request) =>
                request.status === 'approved' &&
                (request.karyawanId === employee.employeeId || request.karyawanNama.toLowerCase() === nameKey)
            )
            .map((request) => request.tanggal)
        );
        const activeTargetDays = dateKeys.filter((tanggal) => !approvedOffDates.has(tanggal)).length;
        const targetPeriode = dailyTarget * activeTargetDays;
        const violationDays = dateKeys
          .map((tanggal) => {
            const actual = countsByEmployeeDate.get(`${employeeKey}|${tanggal}`) ?? countsByEmployeeDate.get(`${nameKey}|${tanggal}`) ?? 0;
            const isOffDay = approvedOffDates.has(tanggal);
            const fine = isOffDay ? 0 : calculateProspekDailyFine(actual, dailyTarget);
            return {
              tanggal,
              actual,
              target: dailyTarget,
              gap: isOffDay ? 0 : Math.max(dailyTarget - actual, 0),
              fine,
            };
          })
          .filter((day) => day.fine > 0);

        const jobdeskDays = dateKeys
          .filter((tanggal) => !approvedOffDates.has(tanggal))
          .map((tanggal) => jobdeskByEmployeeDate.get(`${employeeKey}|${tanggal}`) ?? jobdeskByEmployeeDate.get(`${nameKey}|${tanggal}`) ?? [])
          .filter((items) => items.length > 0)
          .map(summarizeJobdeskDay);
        const jobdeskFineDays = jobdeskDays.filter((day) => day.fine > 0);
        const reviewedDays = jobdeskDays.filter((day) => day.scoredCount > 0);
        const raportAverage = reviewedDays.length
          ? Math.round(reviewedDays.reduce((sum, day) => sum + day.score, 0) / reviewedDays.length)
          : 0;
        const prospekFine = violationDays.length * DENDA_PER_HARI;
        const jobdeskFine = jobdeskFineDays.reduce((sum, day) => sum + day.fine, 0);

        return {
          ...employee,
          totalProspek,
          totalClosing,
          targetPeriode,
          prospekPercent: targetPeriode > 0 ? Math.round((totalProspek / targetPeriode) * 100) : 0,
          selisihPeriode: totalProspek - targetPeriode,
          violationDays,
          jobdeskFineDays,
          raportAverage,
          raportReviewedDays: reviewedDays.length,
          totalRaportItems: jobdeskDays.reduce((sum, day) => sum + day.totalItems, 0),
          totalRejectedJobdesk: jobdeskDays.reduce((sum, day) => sum + day.rejectedCount, 0),
          totalPendingJobdesk: jobdeskDays.reduce((sum, day) => sum + day.pendingCount, 0),
          prospekFine,
          jobdeskFine,
          totalFine: prospekFine + jobdeskFine,
        };
      })
      .sort((a, b) => b.totalFine - a.totalFine || a.nama.localeCompare(b.nama, 'id'));
  }, [activity, dateKeys, employees, offRequests, raportActivity]);

  const branchOptions = useMemo(
    () => ['Semua', ...Array.from(new Set(fineRows.map((row) => row.cabang))).sort((a, b) => getBranchDisplay(a).label.localeCompare(getBranchDisplay(b).label, 'id'))],
    [cabangLookup, fineRows]
  );

  const positionOptions = useMemo(
    () => ['Semua', ...Array.from(new Set(fineRows.map((row) => row.posisi))).sort((a, b) => a.localeCompare(b, 'id'))],
    [fineRows]
  );

  const filteredRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return fineRows
      .filter((row) => {
        const branch = getBranchDisplay(row.cabang);
        const matchesSearch =
          searchValue.length === 0 ||
          `${row.nama} ${row.posisi} ${row.kategori} ${row.cabang} ${branch.searchText}`.toLowerCase().includes(searchValue);
        const matchesCategory = categoryFilter === 'Semua' || row.kategori === categoryFilter;
        const matchesBranch = branchFilter === 'Semua' || row.cabang === branchFilter;
        const matchesPosition = positionFilter === 'Semua' || row.posisi === positionFilter;
        const matchesFineStatus =
          fineStatusFilter === 'Semua' ||
          (fineStatusFilter === 'Ada Denda' && row.totalFine > 0) ||
          (fineStatusFilter === 'Aman' && row.totalFine === 0) ||
          (fineStatusFilter === 'Prospek' && row.prospekFine > 0) ||
          (fineStatusFilter === 'Jobdesk' && row.jobdeskFine > 0);

        return matchesSearch && matchesCategory && matchesBranch && matchesPosition && matchesFineStatus;
      })
      .sort((a, b) => {
        if (sortKey === 'fine_asc') return a.totalFine - b.totalFine || a.nama.localeCompare(b.nama, 'id');
        if (sortKey === 'name') return a.nama.localeCompare(b.nama, 'id');
        if (sortKey === 'prospek_gap') return a.selisihPeriode - b.selisihPeriode || b.totalFine - a.totalFine;
        if (sortKey === 'jobdesk_score') return a.raportAverage - b.raportAverage || b.jobdeskFine - a.jobdeskFine;
        return b.totalFine - a.totalFine || b.prospekFine + b.jobdeskFine - (a.prospekFine + a.jobdeskFine);
      });
  }, [branchFilter, cabangLookup, categoryFilter, fineRows, fineStatusFilter, positionFilter, search, sortKey]);

  const selectedEmployee = useMemo(
    () => filteredRows.find((row) => (row.employeeId || row.nama) === selectedEmployeeId) || filteredRows[0],
    [filteredRows, selectedEmployeeId]
  );

  useEffect(() => {
    if (!selectedEmployee) {
      setSelectedEmployeeId('');
      return;
    }
    const selectedKey = selectedEmployee.employeeId || selectedEmployee.nama;
    if (!filteredRows.some((row) => (row.employeeId || row.nama) === selectedEmployeeId)) {
      setSelectedEmployeeId(selectedKey);
    }
  }, [filteredRows, selectedEmployee, selectedEmployeeId]);

  const totals = useMemo(() => {
    const totalFine = fineRows.reduce((sum, row) => sum + row.totalFine, 0);
    const prospekFine = fineRows.reduce((sum, row) => sum + row.prospekFine, 0);
    const jobdeskFine = fineRows.reduce((sum, row) => sum + row.jobdeskFine, 0);
    const violationDays = fineRows.reduce((sum, row) => sum + row.violationDays.length, 0);
    const jobdeskFineDays = fineRows.reduce((sum, row) => sum + row.jobdeskFineDays.length, 0);
    const employeesWithFine = fineRows.filter((row) => row.totalFine > 0).length;
    const averageRaport = fineRows.filter((row) => row.raportReviewedDays > 0);

    return {
      totalFine,
      prospekFine,
      jobdeskFine,
      violationDays,
      jobdeskFineDays,
      employeesWithFine,
      averageRaport: averageRaport.length
        ? Math.round(averageRaport.reduce((sum, row) => sum + row.raportAverage, 0) / averageRaport.length)
        : 0,
      totalProspek: fineRows.reduce((sum, row) => sum + row.totalProspek, 0),
      totalTarget: fineRows.reduce((sum, row) => sum + row.targetPeriode, 0),
      totalClosing: fineRows.reduce((sum, row) => sum + row.totalClosing, 0),
    };
  }, [fineRows]);

  const dailyChartData = useMemo(
    () =>
      dateKeys.map((tanggal) => {
        const prospekFine = fineRows.reduce((sum, row) => {
          const day = row.violationDays.find((item) => item.tanggal === tanggal);
          return sum + (day?.fine || 0);
        }, 0);
        const jobdeskFine = fineRows.reduce((sum, row) => {
          const day = row.jobdeskFineDays.find((item) => item.tanggal === tanggal);
          return sum + (day?.fine || 0);
        }, 0);
        const prospek = activity.filter((item) => item.tanggal === tanggal).length;
        const closing = activity.filter((item) => item.tanggal === tanggal && item.statusProspek === 'deal').length;
        const target = fineRows.reduce((sum, row) => {
          const isOffDay = offRequests.some(
            (request) =>
              request.status === 'approved' &&
              request.tanggal === tanggal &&
              (request.karyawanId === row.employeeId || request.karyawanNama.toLowerCase() === row.nama.toLowerCase())
          );
          return isOffDay ? sum : sum + Math.max(row.target || (row.kategori === 'Sales' ? 20 : 5), 0);
        }, 0);
        const jobdeskItems = raportActivity.filter(
          (item) =>
            item.tanggal === tanggal &&
            !offRequests.some(
              (request) =>
                request.status === 'approved' &&
                request.tanggal === tanggal &&
                (request.karyawanId === item.employeeId || request.karyawanNama.toLowerCase() === item.employeeName.toLowerCase())
            )
        );
        const scoredItems = jobdeskItems.filter((item) => item.reviewStatus === 'rejected' || typeof item.score === 'number');
        const raportScore = scoredItems.length
          ? Math.round(scoredItems.reduce((sum, item) => sum + (item.reviewStatus === 'rejected' ? 0 : item.score || 0), 0) / scoredItems.length)
          : 0;

        return {
          tanggal,
          label: formatShortDate(tanggal),
          prospek,
          target,
          closing,
          raportScore,
          prospekFine,
          jobdeskFine,
          totalFine: prospekFine + jobdeskFine,
        };
      }),
    [activity, dateKeys, fineRows, offRequests, raportActivity]
  );

  const branchChartData = useMemo(() => {
    const map = new Map<string, { cabang: string; prospekFine: number; jobdeskFine: number; totalFine: number; employeeCount: number }>();
    fineRows.forEach((row) => {
      const current = map.get(row.cabang) || { cabang: row.cabang, prospekFine: 0, jobdeskFine: 0, totalFine: 0, employeeCount: 0 };
      current.prospekFine += row.prospekFine;
      current.jobdeskFine += row.jobdeskFine;
      current.totalFine += row.totalFine;
      current.employeeCount += 1;
      map.set(row.cabang, current);
    });

    return [...map.values()]
      .map((item) => {
        const branch = getBranchDisplay(item.cabang);
        return { ...item, cabangLabel: branch.label, cabangDetail: branch.detail };
      })
      .sort((a, b) => b.totalFine - a.totalFine)
      .slice(0, 8);
  }, [cabangLookup, fineRows]);

  const pieChartData = useMemo(
    () => [
      { name: 'Prospek', value: totals.prospekFine, color: chartColors.prospek },
      { name: 'Jobdesk', value: totals.jobdeskFine, color: chartColors.jobdesk },
    ].filter((item) => item.value > 0),
    [totals.jobdeskFine, totals.prospekFine]
  );

  const topFineRows = useMemo(() => fineRows.filter((row) => row.totalFine > 0).slice(0, 8), [fineRows]);
  const hasFilters =
    search.trim() !== '' ||
    categoryFilter !== 'Semua' ||
    branchFilter !== 'Semua' ||
    positionFilter !== 'Semua' ||
    fineStatusFilter !== 'Ada Denda' ||
    sortKey !== 'fine_desc';

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('Semua');
    setBranchFilter('Semua');
    setPositionFilter('Semua');
    setFineStatusFilter('Ada Denda');
    setSortKey('fine_desc');
  };

  const applyPreset = (preset: 'today' | 'month') => {
    if (preset === 'today') {
      setFrom(today);
      setTo(today);
      return;
    }
    setFrom(getMonthStartKey(today));
    setTo(today);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            to="/dashboard/owner/prospek"
            className="mb-4 inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke prospek
          </Link>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Laporan denda karyawan</p>
          <h1 className="mt-1 text-headline-sm font-black text-on-surface">Kontrol Denda Prospek dan Jobdesk</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-on-surface-variant">
            Pantau denda harian per karyawan, sumber pelanggaran, target prospek, skor jobdesk, dan komentar PIC dalam satu halaman.
          </p>
        </div>
        <div className="grid gap-2 rounded-xl border border-outline-variant/15 bg-surface p-3 sm:grid-cols-[9.5rem_9.5rem_auto_auto]">
          <label className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Dari
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Sampai
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(event) => setTo(clampDateToToday(event.target.value, today))}
              className="mt-1 h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <button
            type="button"
            onClick={() => applyPreset('today')}
            className="mt-auto h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-primary"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => applyPreset('month')}
            className="mt-auto h-10 rounded-lg bg-primary px-3 text-label-sm font-bold text-on-primary transition hover:bg-primary/90"
          >
            Bulan ini
          </button>
        </div>
      </motion.section>

      {error && (
        <motion.div variants={itemVariants} className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-bold text-error">
          {error}
        </motion.div>
      )}

      <motion.section variants={itemVariants} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: 'Total Denda',
            value: formatRupiah(totals.totalFine),
            helper: `${formatRupiah(totals.prospekFine)} prospek, ${formatRupiah(totals.jobdeskFine)} jobdesk`,
            icon: BadgeDollarSign,
            tone: totals.totalFine > 0 ? 'text-error' : 'text-secondary',
            bg: totals.totalFine > 0 ? 'bg-error/10' : 'bg-secondary/10',
          },
          {
            label: 'Karyawan Kena Denda',
            value: totals.employeesWithFine.toLocaleString('id-ID'),
            helper: `${fineRows.length} karyawan dipantau`,
            icon: Users,
            tone: totals.employeesWithFine > 0 ? 'text-error' : 'text-secondary',
            bg: totals.employeesWithFine > 0 ? 'bg-error/10' : 'bg-secondary/10',
          },
          {
            label: 'Hari Pelanggaran',
            value: (totals.violationDays + totals.jobdeskFineDays).toLocaleString('id-ID'),
            helper: `${totals.violationDays} prospek, ${totals.jobdeskFineDays} jobdesk`,
            icon: CalendarDays,
            tone: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Capaian Prospek',
            value: formatPercent(totals.totalTarget > 0 ? (totals.totalProspek / totals.totalTarget) * 100 : 0),
            helper: `${totals.totalProspek.toLocaleString('id-ID')} dari ${totals.totalTarget.toLocaleString('id-ID')} target`,
            icon: Target,
            tone: totals.totalProspek >= totals.totalTarget ? 'text-secondary' : 'text-error',
            bg: totals.totalProspek >= totals.totalTarget ? 'bg-secondary/10' : 'bg-error/10',
          },
          {
            label: 'Rata Skor Jobdesk',
            value: totals.averageRaport ? `${totals.averageRaport}/100` : '-',
            helper: `Batas denda di bawah ${JOBDESK_FINE_MIN_SCORE}`,
            icon: FileCheck2,
            tone: totals.averageRaport >= JOBDESK_FINE_MIN_SCORE ? 'text-secondary' : 'text-error',
            bg: totals.averageRaport >= JOBDESK_FINE_MIN_SCORE ? 'bg-secondary/10' : 'bg-error/10',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
              <div className={`mb-4 inline-grid h-10 w-10 place-items-center rounded-lg ${item.bg} ${item.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</p>
              <p className={`mt-2 text-title-lg font-black ${item.tone}`}>{item.value}</p>
              <p className="mt-1 text-label-sm text-on-surface-variant">{item.helper}</p>
            </div>
          );
        })}
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-title-md font-black text-on-surface">Tren Harian</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">{periodLabel}, {dateKeys.length} hari dihitung</p>
            </div>
            {isLoading && <span className="rounded-lg bg-primary/10 px-3 py-2 text-label-xs font-bold text-primary">Memuat data...</span>}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-outline-variant/20" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-on-surface-variant" />
                <YAxis yAxisId="count" tick={{ fontSize: 11 }} stroke="currentColor" className="text-on-surface-variant" />
                <YAxis yAxisId="fine" orientation="right" tick={{ fontSize: 11 }} stroke="currentColor" className="text-on-surface-variant" tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <Tooltip
                  formatter={(value, name) => {
                    if (String(name).toLowerCase().includes('denda')) return [formatRupiah(Number(value)), name];
                    return [Number(value).toLocaleString('id-ID'), name];
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.tanggal ? formatLongDate(payload[0].payload.tanggal) : ''}
                />
                <Legend />
                <Bar yAxisId="count" dataKey="target" name="Target prospek" fill={chartColors.target} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="count" dataKey="prospek" name="Prospek masuk" fill={chartColors.prospek} radius={[4, 4, 0, 0]} />
                <Area yAxisId="fine" type="monotone" dataKey="prospekFine" name="Denda prospek" stroke={chartColors.warning} fill={chartColors.warning} fillOpacity={0.12} strokeWidth={2} />
                <Area yAxisId="fine" type="monotone" dataKey="jobdeskFine" name="Denda jobdesk" stroke={chartColors.jobdesk} fill={chartColors.jobdesk} fillOpacity={0.12} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
            <h2 className="text-title-md font-black text-on-surface">Komposisi Denda</h2>
            <div className="mt-4 h-56">
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieChartData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                      {pieChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center rounded-lg border border-dashed border-outline-variant/20 bg-surface-high/30 text-label-sm font-bold text-on-surface-variant">
                  Tidak ada denda pada periode ini.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
            <h2 className="text-title-md font-black text-on-surface">Cabang Teratas</h2>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchChartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-outline-variant/20" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                  <YAxis type="category" dataKey="cabangLabel" width={86} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                  <Bar dataKey="totalFine" name="Total denda" fill={chartColors.jobdesk} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-title-md font-black text-on-surface">Daftar Karyawan</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Menampilkan {filteredRows.length} dari {fineRows.length} karyawan, termasuk yang tidak memiliki denda.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
            Reset filter
          </button>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, cabang, kategori, posisi"
              className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-9 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>{branch === 'Semua' ? 'Cabang: Semua' : getBranchDisplay(branch).filterLabel}</option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'Semua' | 'Sales' | 'Non-Sales')} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
            <option value="Semua">Kategori: Semua</option>
            <option value="Sales">Kategori: Sales</option>
            <option value="Non-Sales">Kategori: Non-Sales</option>
          </select>
          <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
            {positionOptions.map((position) => (
              <option key={position} value={position}>{position === 'Semua' ? 'Posisi: Semua' : position}</option>
            ))}
          </select>
          <select value={fineStatusFilter} onChange={(event) => setFineStatusFilter(event.target.value as FineStatusFilter)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
            <option value="Semua">Status: Semua</option>
            <option value="Ada Denda">Status: Ada denda</option>
            <option value="Aman">Status: Aman</option>
            <option value="Prospek">Jenis: Prospek</option>
            <option value="Jobdesk">Jenis: Jobdesk</option>
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20">
            <option value="fine_desc">Urut: Denda terbesar</option>
            <option value="fine_asc">Urut: Denda terkecil</option>
            <option value="name">Urut: Nama</option>
            <option value="prospek_gap">Urut: Gap prospek</option>
            <option value="jobdesk_score">Urut: Skor jobdesk</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-3 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Karyawan</th>
                <th className="px-3 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Cabang</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Prospek</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Gap</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Skor Jobdesk</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Denda Prospek</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Denda Jobdesk</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Total</th>
                <th className="px-3 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const branch = getBranchDisplay(row.cabang);
                const selected = selectedEmployee && (selectedEmployee.employeeId || selectedEmployee.nama) === (row.employeeId || row.nama);
                return (
                  <tr key={row.employeeId || row.nama} className={`border-b border-outline-variant/5 transition hover:bg-surface-high/45 ${selected ? 'bg-primary/5' : ''}`}>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`grid h-9 w-9 place-items-center rounded-lg ${row.totalFine > 0 ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
                          {row.totalFine > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </span>
                        <div>
                          <p className="text-body-sm font-black text-on-surface">{row.nama}</p>
                          <p className="text-label-xs text-on-surface-variant">{row.posisi} | {row.kategori}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-body-sm font-semibold text-on-surface">{branch.filterLabel}</td>
                    <td className="px-3 py-3 text-right">
                      <p className="text-body-sm font-black text-on-surface">{row.totalProspek}/{row.targetPeriode}</p>
                      <p className="text-label-xs text-on-surface-variant">{formatPercent(row.prospekPercent)} target</p>
                    </td>
                    <td className={`px-3 py-3 text-right text-body-sm font-black ${row.selisihPeriode >= 0 ? 'text-secondary' : 'text-error'}`}>
                      {formatTargetDelta(row.totalProspek, row.targetPeriode)}
                    </td>
                    <td className={`px-3 py-3 text-right text-body-sm font-black ${row.raportAverage >= JOBDESK_FINE_MIN_SCORE || row.raportAverage === 0 ? 'text-on-surface' : 'text-error'}`}>
                      {row.raportAverage ? `${row.raportAverage}/100` : '-'}
                    </td>
                    <td className="px-3 py-3 text-right text-body-sm font-black text-error">{formatRupiah(row.prospekFine)}</td>
                    <td className="px-3 py-3 text-right text-body-sm font-black text-error">{formatRupiah(row.jobdeskFine)}</td>
                    <td className={`px-3 py-3 text-right text-body-sm font-black ${row.totalFine > 0 ? 'text-error' : 'text-secondary'}`}>{formatRupiah(row.totalFine)}</td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId(row.employeeId || row.nama)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
                      >
                        <Eye className="h-4 w-4" />
                        Lihat
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && filteredRows.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-outline-variant/20 bg-surface-high/25 py-10 text-center">
            <p className="text-body-sm font-bold text-on-surface">Tidak ada data yang cocok.</p>
            <p className="mt-1 text-label-sm text-on-surface-variant">Ubah filter atau periode laporan.</p>
          </div>
        )}
      </motion.section>

      <motion.section variants={itemVariants} className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <h2 className="text-title-md font-black text-on-surface">Ranking Denda</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">Karyawan dengan akumulasi denda terbesar pada periode aktif.</p>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFineRows.map((row) => ({ nama: row.nama, totalFine: row.totalFine, prospekFine: row.prospekFine, jobdeskFine: row.jobdeskFine }))} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-outline-variant/20" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <YAxis type="category" dataKey="nama" width={92} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatRupiah(Number(value))} />
                <Legend />
                <Bar dataKey="prospekFine" name="Prospek" stackId="fine" fill={chartColors.prospek} radius={[0, 0, 0, 0]} />
                <Bar dataKey="jobdeskFine" name="Jobdesk" stackId="fine" fill={chartColors.jobdesk} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Detail karyawan</p>
              <h2 className="mt-1 text-title-md font-black text-on-surface">{selectedEmployee?.nama || 'Belum ada karyawan'}</h2>
              {selectedEmployee && (
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  {getBranchDisplay(selectedEmployee.cabang).filterLabel} | {selectedEmployee.posisi} | {selectedEmployee.kategori}
                </p>
              )}
            </div>
            {selectedEmployee && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Total', value: formatRupiah(selectedEmployee.totalFine), tone: selectedEmployee.totalFine > 0 ? 'text-error' : 'text-secondary' },
                  { label: 'Prospek', value: formatRupiah(selectedEmployee.prospekFine), tone: 'text-error' },
                  { label: 'Jobdesk', value: formatRupiah(selectedEmployee.jobdeskFine), tone: 'text-error' },
                  { label: 'Skor', value: selectedEmployee.raportAverage ? `${selectedEmployee.raportAverage}/100` : '-', tone: selectedEmployee.raportAverage >= JOBDESK_FINE_MIN_SCORE ? 'text-secondary' : 'text-error' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-outline-variant/15 bg-surface-high px-3 py-2">
                    <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</p>
                    <p className={`mt-1 text-label-sm font-black ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedEmployee ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <BadgeDollarSign className="h-4 w-4 text-error" />
                  <h3 className="text-title-sm font-black text-on-surface">Denda Prospek</h3>
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border border-outline-variant/15">
                  <table className="w-full min-w-[480px]">
                    <thead className="bg-surface-high">
                      <tr>
                        <th className="px-3 py-2 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Tanggal</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Prospek</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Target</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Kurang</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Denda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEmployee.violationDays.map((day) => (
                        <tr key={`${selectedEmployee.employeeId || selectedEmployee.nama}-prospek-${day.tanggal}`} className="border-t border-outline-variant/5">
                          <td className="px-3 py-2 text-body-sm font-bold text-on-surface">{formatShortDate(day.tanggal)}</td>
                          <td className="px-3 py-2 text-right text-body-sm font-semibold text-on-surface">{day.actual}</td>
                          <td className="px-3 py-2 text-right text-body-sm text-on-surface-variant">{day.target}</td>
                          <td className="px-3 py-2 text-right text-body-sm font-bold text-error">{day.gap}</td>
                          <td className="px-3 py-2 text-right text-body-sm font-black text-error">{formatRupiah(day.fine)}</td>
                        </tr>
                      ))}
                      {selectedEmployee.violationDays.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-label-sm font-bold text-on-surface-variant">Tidak ada denda prospek.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <BriefcaseBusiness className="h-4 w-4 text-error" />
                  <h3 className="text-title-sm font-black text-on-surface">Denda Jobdesk</h3>
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border border-outline-variant/15">
                  <table className="w-full min-w-[540px]">
                    <thead className="bg-surface-high">
                      <tr>
                        <th className="px-3 py-2 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Tanggal</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Skor</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Ditolak</th>
                        <th className="px-3 py-2 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Catatan</th>
                        <th className="px-3 py-2 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Denda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEmployee.jobdeskFineDays.map((day) => (
                        <tr key={`${selectedEmployee.employeeId || selectedEmployee.nama}-jobdesk-${day.tanggal}`} className="border-t border-outline-variant/5 align-top">
                          <td className="px-3 py-2 text-body-sm font-bold text-on-surface">{formatShortDate(day.tanggal)}</td>
                          <td className="px-3 py-2 text-right text-body-sm font-black text-error">{day.score}/100</td>
                          <td className="px-3 py-2 text-right text-body-sm font-bold text-error">{day.rejectedCount}</td>
                          <td className="px-3 py-2 text-label-sm text-on-surface-variant">
                            {day.comments[0] || day.rejectedItems[0]?.jobdeskText || 'Nilai jobdesk di bawah standar.'}
                          </td>
                          <td className="px-3 py-2 text-right text-body-sm font-black text-error">{formatRupiah(day.fine)}</td>
                        </tr>
                      ))}
                      {selectedEmployee.jobdeskFineDays.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-label-sm font-bold text-on-surface-variant">Tidak ada denda jobdesk.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-outline-variant/20 bg-surface-high/25 py-10 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-on-surface-variant" />
              <p className="mt-3 text-body-sm font-bold text-on-surface">Pilih karyawan untuk melihat detail.</p>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default OwnerProspekFineReportPage;
