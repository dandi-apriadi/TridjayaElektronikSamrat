import type { EmployeeRaport } from '../data/ownerRaportData';

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
