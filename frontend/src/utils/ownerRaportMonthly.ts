import type { EmployeeRaport } from '../data/ownerRaportData';
import type { PicRaportEvidence } from '../data/picRaportData';

export interface EmployeeDailyReport {
  tanggal: string;
  nilai: number;
  selesai: number;
  totalJobdesk: number;
  bukti: number;
  terlambat: boolean;
  catatan: string;
}

export interface EmployeeMonthlyReport {
  rataNilai: number;
  hariLapor: number;
  totalBukti: number;
  hariTerlambat: number;
  terbaik: EmployeeDailyReport;
  terendah: EmployeeDailyReport;
  history: EmployeeDailyReport[];
}

export type RaportTrendMode = 'hari' | 'minggu' | 'bulan';

export interface RaportTrendPoint {
  label: string;
  raport: number;
  selesai: number;
}

export const reportDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
});

export const monthYearFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

function employeeSeed(employee: EmployeeRaport) {
  return employee.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const emptyMonthlyReport = (employee: Pick<EmployeeRaport, 'totalJobdesk'>): EmployeeMonthlyReport => {
  const today = new Date();
  const fallback = {
    tanggal: today.toISOString(),
    nilai: 0,
    selesai: 0,
    totalJobdesk: Math.max(employee.totalJobdesk || 0, 1),
    bukti: 0,
    terlambat: false,
    catatan: 'Belum ada history pelaporan.',
  };

  return {
    rataNilai: 0,
    hariLapor: 0,
    totalBukti: 0,
    hariTerlambat: 0,
    terbaik: fallback,
    terendah: fallback,
    history: [],
  };
};

const summarizeEvidenceBucket = (items: PicRaportEvidence[]): Pick<RaportTrendPoint, 'raport' | 'selesai'> => {
  if (items.length === 0) {
    return { raport: 0, selesai: 0 };
  }

  const reviewedItems = items.filter((item) => item.reviewStatus !== 'pending');
  const scoredItems = items.filter((item) => typeof item.score === 'number');
  const raport = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + (item.score || 0), 0) / scoredItems.length)
    : Math.round((reviewedItems.length / items.length) * 100);

  return {
    raport,
    selesai: reviewedItems.length,
  };
};

export function buildRaportTrendFromEvidence(
  evidence: PicRaportEvidence[],
  mode: RaportTrendMode,
  selectedDateKey = toDateKey(new Date())
): RaportTrendPoint[] {
  const selectedDate = parseDateKey(selectedDateKey);

  if (mode === 'hari') {
    return Array.from({ length: 12 }, (_, index) => {
      const hour = index + 8;
      const label = `${String(hour).padStart(2, '0')}:00`;
      const items = evidence.filter((item) => {
        const submittedAt = new Date(item.submittedAt);
        return item.tanggal === selectedDateKey && submittedAt.getHours() === hour;
      });
      return { label, ...summarizeEvidenceBucket(items) };
    });
  }

  if (mode === 'minggu') {
    const weekdayLabels = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const start = new Date(selectedDate);
    start.setDate(selectedDate.getDate() - selectedDate.getDay());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);
      const items = evidence.filter((item) => item.tanggal === key);
      return { label: weekdayLabels[date.getDay()], ...summarizeEvidenceBucket(items) };
    });
  }

  const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(index + 1);
    const key = toDateKey(date);
    const items = evidence.filter((item) => item.tanggal === key);
    return { label: String(index + 1), ...summarizeEvidenceBucket(items) };
  });
}

export function buildEmployeeMonthlyReport(employee: EmployeeRaport): EmployeeMonthlyReport {
  const seed = employeeSeed(employee);
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const untilDay = Math.min(today.getDate(), daysInMonth);

  const history = Array.from({ length: untilDay }, (_, index) => {
    const day = index + 1;
    const variation = ((seed + day * 11) % 29) - 14;
    const nilai = Math.max(18, Math.min(100, employee.persentase + variation));
    const selesai = Math.min(employee.totalJobdesk, Math.max(0, Math.round((nilai / 100) * employee.totalJobdesk)));
    const bukti = Math.max(0, selesai - ((seed + day) % 3 === 0 ? 1 : 0));
    const date = new Date(today.getFullYear(), today.getMonth(), day);

    return {
      tanggal: date.toISOString(),
      nilai,
      selesai,
      totalJobdesk: employee.totalJobdesk,
      bukti,
      terlambat: (seed + day) % 7 === 0,
      catatan: nilai >= 80
        ? 'Raport stabil, bukti jobdesk lengkap.'
        : nilai >= 50
          ? 'Perlu follow up pada beberapa jobdesk.'
          : 'Butuh perhatian owner dan kepala cabang.',
    };
  });

  const fallback = history[0] ?? {
    tanggal: today.toISOString(),
    nilai: 0,
    selesai: 0,
    totalJobdesk: employee.totalJobdesk,
    bukti: 0,
    terlambat: false,
    catatan: 'Belum ada history pelaporan.',
  };
  const rataNilai = history.length > 0
    ? Math.round(history.reduce((sum, item) => sum + item.nilai, 0) / history.length)
    : 0;
  const terbaik = history.reduce((best, item) => (item.nilai > best.nilai ? item : best), fallback);
  const terendah = history.reduce((lowest, item) => (item.nilai < lowest.nilai ? item : lowest), fallback);

  return {
    rataNilai,
    hariLapor: history.length,
    totalBukti: history.reduce((sum, item) => sum + item.bukti, 0),
    hariTerlambat: history.filter((item) => item.terlambat).length,
    terbaik,
    terendah,
    history,
  };
}

export function buildEmployeeMonthlyReportFromEvidence(
  employee: EmployeeRaport,
  evidence: PicRaportEvidence[]
): EmployeeMonthlyReport {
  if (evidence.length === 0) return emptyMonthlyReport(employee);

  const today = new Date();
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthlyEvidence = evidence.filter((item) => item.tanggal.startsWith(monthPrefix));
  if (monthlyEvidence.length === 0) return emptyMonthlyReport(employee);

  const byDate = new Map<string, PicRaportEvidence[]>();
  monthlyEvidence.forEach((item) => {
    byDate.set(item.tanggal, [...(byDate.get(item.tanggal) || []), item]);
  });

  const history = [...byDate.entries()]
    .map(([tanggal, items]) => {
      const scoredItems = items.filter((item) => typeof item.score === 'number');
      const reviewedItems = items.filter((item) => item.reviewStatus !== 'pending');
      const nilai = scoredItems.length
        ? Math.round(scoredItems.reduce((sum, item) => sum + (item.score || 0), 0) / scoredItems.length)
        : reviewedItems.length
          ? Math.round((reviewedItems.length / items.length) * 100)
          : 0;
      const comments = items
        .map((item) => item.reviewerComment?.trim())
        .filter(Boolean);

      return {
        tanggal: `${tanggal}T00:00:00`,
        nilai,
        selesai: reviewedItems.length,
        totalJobdesk: Math.max(items.length, employee.totalJobdesk || 1),
        bukti: items.filter((item) => item.mode !== 'none' && item.evidenceUrl).length,
        terlambat: false,
        catatan: comments[0] || (reviewedItems.length ? 'Raport sudah direview PIC.' : 'Raport menunggu review PIC.'),
      };
    })
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  const fallback = history[0] ?? {
    tanggal: new Date().toISOString(),
    nilai: 0,
    selesai: 0,
    totalJobdesk: employee.totalJobdesk,
    bukti: 0,
    terlambat: false,
    catatan: 'Belum ada history pelaporan.',
  };
  const rataNilai = history.length > 0
    ? Math.round(history.reduce((sum, item) => sum + item.nilai, 0) / history.length)
    : 0;
  const terbaik = history.reduce((best, item) => (item.nilai > best.nilai ? item : best), fallback);
  const terendah = history.reduce((lowest, item) => (item.nilai < lowest.nilai ? item : lowest), fallback);

  return {
    rataNilai,
    hariLapor: history.length,
    totalBukti: history.reduce((sum, item) => sum + item.bukti, 0),
    hariTerlambat: history.filter((item) => item.terlambat).length,
    terbaik,
    terendah,
    history,
  };
}
