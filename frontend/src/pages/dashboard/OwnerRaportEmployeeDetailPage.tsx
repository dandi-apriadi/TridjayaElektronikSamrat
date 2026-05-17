import React, { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  ListChecks,
  MapPin,
  MessageSquareText,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { employeeRaports } from '../../data/ownerRaportData';
import {
  buildEmployeeMonthlyReport,
  buildEmployeeMonthlyReportFromEvidence,
  monthYearFormatter,
  reportDateFormatter,
  shortDateFormatter,
} from '../../utils/ownerRaportMonthly';
import { usePicRaportStore } from '../../store/picRaportStore';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };
const weekdayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getStatus(persentase: number) {
  if (persentase >= 80) {
    return {
      key: 'excellent' as const,
      label: 'Prima',
      textClass: 'text-green-500',
      bgClass: 'bg-green-500/10',
      barClass: 'bg-green-500',
      borderClass: 'border-green-500/20',
      dotClass: 'bg-green-500',
    };
  }

  if (persentase >= 50) {
    return {
      key: 'on-track' as const,
      label: 'Pantau',
      textClass: 'text-yellow-500',
      bgClass: 'bg-yellow-500/10',
      barClass: 'bg-yellow-500',
      borderClass: 'border-yellow-500/20',
      dotClass: 'bg-yellow-500',
    };
  }

  return {
    key: 'at-risk' as const,
    label: 'Prioritas',
    textClass: 'text-red-500',
    bgClass: 'bg-red-500/10',
    barClass: 'bg-red-500',
    borderClass: 'border-red-500/20',
    dotClass: 'bg-red-500',
  };
}

const OwnerRaportEmployeeDetailPage: React.FC = () => {
  const { employeeId } = useParams();
  const evidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const isLoading = usePicRaportStore((state) => state.isLoading);
  const raportError = usePicRaportStore((state) => state.error);
  const employeeEvidence = useMemo(
    () => evidence.filter((item) => item.employeeId === employeeId),
    [employeeId, evidence]
  );
  const seedEmployee = employeeRaports.find((item) => item.id === employeeId);
  const employee = seedEmployee || (employeeEvidence[0]
    ? {
        id: employeeEvidence[0].employeeId,
        nama: employeeEvidence[0].employeeName,
        posisi: employeeEvidence[0].divisiName,
        cabang: employeeEvidence[0].cabang,
        selesai: employeeEvidence.filter((item) => item.reviewStatus !== 'pending').length,
        totalJobdesk: Math.max(employeeEvidence.length, 1),
        persentase: employeeEvidence.length
          ? Math.round((employeeEvidence.filter((item) => item.reviewStatus !== 'pending').length / employeeEvidence.length) * 100)
          : 0,
      }
    : null);

  useEffect(() => {
    if (!employeeId) return;
    fetchEvidence({ karyawanId: employeeId, limit: 500 });
  }, [employeeId, fetchEvidence]);

  if (!employee) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
        <Link
          to="/dashboard/owner/raport"
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-label-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke raport
        </Link>
        <div className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-8 text-center shadow-sm">
          <FileText className="mx-auto h-8 w-8 text-on-surface-variant" />
          <p className="mt-3 text-body-sm font-bold text-on-surface">
            {isLoading ? 'Memuat detail raport karyawan...' : 'Data raport karyawan belum ditemukan.'}
          </p>
          {(raportError && !isLoading) && <p className="mt-2 text-label-sm font-semibold text-error">{raportError}</p>}
        </div>
      </motion.div>
    );
  }

  const report = employeeEvidence.length
    ? buildEmployeeMonthlyReportFromEvidence(employee, employeeEvidence)
    : buildEmployeeMonthlyReport(employee);
  const scoreStatus = getStatus(report.rataNilai);
  const todayStatus = getStatus(employee.persentase);
  const reportDateLabel = reportDateFormatter.format(new Date());
  const currentDate = new Date();
  const [selectedDay, setSelectedDay] = React.useState(currentDate.getDate());
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const reportByDay = new Map(report.history.map((item) => [new Date(item.tanggal).getDate(), item]));
  const selectedDailyReport = reportByDay.get(selectedDay);
  const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay);
  const selectedStatus = selectedDailyReport ? getStatus(selectedDailyReport.nilai) : null;
  const reversedHistory = [...report.history].reverse();
  const totalCompletedThisMonth = report.history.reduce((sum, item) => sum + item.selesai, 0);
  const totalJobdeskThisMonth = report.history.reduce((sum, item) => sum + item.totalJobdesk, 0);
  const monthlyCompletionRate = totalJobdeskThisMonth > 0
    ? Math.round((totalCompletedThisMonth / totalJobdeskThisMonth) * 100)
    : 0;
  const evidenceRate = totalCompletedThisMonth > 0
    ? Math.round((report.totalBukti / totalCompletedThisMonth) * 100)
    : 0;
  const initials = employee.nama
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const calendarCells = [
    ...Array.from({ length: firstDayOfMonth.getDay() }, (_, index) => ({ key: `blank-${index}`, day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({ key: `day-${index + 1}`, day: index + 1 })),
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <motion.section variants={itemVariants} className="overflow-hidden rounded-[1.75rem] border border-outline-variant/20 bg-surface shadow-sm">
        <div className="border-b border-outline-variant/10 bg-surface-high/35 px-4 py-3 sm:px-5">
          <Link
            to="/dashboard/owner/raport"
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-label-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke raport
          </Link>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_20rem] lg:items-end lg:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-title-lg font-black ${scoreStatus.borderClass} ${scoreStatus.bgClass} ${scoreStatus.textClass}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
                  <FileText className="h-3.5 w-3.5" />
                  Laporan bulanan
                </span>
                <span className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-label-xs font-bold uppercase tracking-widest ${scoreStatus.borderClass} ${scoreStatus.bgClass} ${scoreStatus.textClass}`}>
                  <span className={`h-2 w-2 rounded-full ${scoreStatus.dotClass}`} />
                  {scoreStatus.label}
                </span>
              </div>
              <h1 className="text-headline-md font-black text-on-surface">{employee.nama}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-label-sm font-semibold text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-high/70 px-3 py-1.5">
                  <BriefcaseBusiness className="h-4 w-4 text-primary" />
                  {employee.posisi}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-high/70 px-3 py-1.5">
                  <MapPin className="h-4 w-4 text-secondary" />
                  {employee.cabang}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-high/70 px-3 py-1.5">
                  <CalendarDays className="h-4 w-4 text-on-surface-variant" />
                  {monthYearFormatter.format(new Date())}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface-high/55 p-4">
            <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Tanggal report</p>
            <p className="mt-1 text-title-sm font-black text-on-surface">{reportDateLabel}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${scoreStatus.barClass}`} style={{ width: `${report.rataNilai}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-label-xs text-on-surface-variant">
              <span>Skor bulanan</span>
              <span className={`font-black ${scoreStatus.textClass}`}>{report.rataNilai}/100</span>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_1.42fr]">
        <motion.div variants={itemVariants} className={`rounded-[1.75rem] border bg-surface p-5 shadow-sm ${scoreStatus.borderClass}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Nilai rata-rata</p>
              <p className={`mt-2 text-display-sm font-black ${scoreStatus.textClass}`}>{report.rataNilai}</p>
              <p className="text-body-sm text-on-surface-variant">Dari 100 poin akumulasi bulan ini.</p>
            </div>
            <div className={`rounded-2xl p-3 ${scoreStatus.bgClass} ${scoreStatus.textClass}`}>
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-high/55 p-3">
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Selesai</p>
              <p className="mt-1 text-title-md font-black text-on-surface">{monthlyCompletionRate}%</p>
            </div>
            <div className="rounded-2xl bg-surface-high/55 p-3">
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Bukti valid</p>
              <p className="mt-1 text-title-md font-black text-on-surface">{evidenceRate}%</p>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: 'Hari pelaporan', value: `${report.hariLapor} hari`, helper: 'Riwayat yang masuk bulan ini', icon: CalendarDays, tone: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Total bukti', value: `${report.totalBukti}`, helper: `${totalCompletedThisMonth} jobdesk selesai`, icon: ImageIcon, tone: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Terlambat', value: `${report.hariTerlambat} hari`, helper: report.hariTerlambat > 0 ? 'Perlu cek alasan keterlambatan' : 'Tidak ada keterlambatan tercatat', icon: Timer, tone: report.hariTerlambat > 0 ? 'text-yellow-500' : 'text-secondary', bg: report.hariTerlambat > 0 ? 'bg-yellow-500/10' : 'bg-secondary/10' },
            { label: 'Cabang', value: employee.cabang, helper: employee.posisi, icon: Building2, tone: 'text-on-surface', bg: 'bg-surface-high' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <motion.div key={item.label} variants={itemVariants} className="rounded-2xl border border-outline-variant/20 bg-surface p-4 shadow-sm transition hover:border-primary/25">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</p>
                    <p className={`mt-1 truncate text-title-lg font-black ${item.tone}`}>{item.value}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${item.bg} ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-body-sm text-on-surface-variant">{item.helper}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <motion.div variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-title-md font-black text-on-surface">Arahan owner</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">Prioritas follow up berdasarkan pola bulan berjalan.</p>
            </div>
            {scoreStatus.key === 'excellent' ? (
              <Award className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className={`h-5 w-5 ${scoreStatus.textClass}`} />
            )}
          </div>
          <div className={`mt-5 rounded-2xl border p-4 ${scoreStatus.borderClass} ${scoreStatus.bgClass}`}>
            <p className={`text-label-xs font-bold uppercase tracking-widest ${scoreStatus.textClass}`}>Rekomendasi</p>
            <p className="mt-2 text-body-sm font-semibold text-on-surface">
              {report.rataNilai >= 80
                ? 'Pertahankan ritme kerja. Audit bukti cukup dilakukan sampling mingguan.'
                : report.rataNilai >= 50
                  ? 'Lakukan coaching ringan dan cek jobdesk yang paling sering tidak lengkap.'
                  : 'Butuh follow up intensif dengan kepala cabang dan validasi bukti harian.'}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-high/55 px-4 py-3">
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Hari terbaik</p>
              <p className="mt-1 text-body-sm font-bold text-on-surface">
                {shortDateFormatter.format(new Date(report.terbaik.tanggal))}, nilai {report.terbaik.nilai}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-high/55 px-4 py-3">
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Hari terendah</p>
              <p className="mt-1 text-body-sm font-bold text-on-surface">
                {shortDateFormatter.format(new Date(report.terendah.tanggal))}, nilai {report.terendah.nilai}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-title-md font-black text-on-surface">Komposisi jobdesk hari ini</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">Snapshot progress pada tanggal report aktif.</p>
            </div>
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-high">
              <div className={`h-full rounded-full ${todayStatus.barClass}`} style={{ width: `${employee.persentase}%` }} />
            </div>
            <span className={`text-title-lg font-black ${todayStatus.textClass}`}>{employee.persentase}%</span>
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant">
            {employee.selesai} dari {employee.totalJobdesk} jobdesk selesai pada tanggal report {reportDateLabel}.
          </p>
          <div className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-label-sm font-bold ${todayStatus.borderClass} ${todayStatus.bgClass} ${todayStatus.textClass}`}>
            {todayStatus.key === 'excellent' ? <CheckCircle2 className="h-4 w-4" /> : <BriefcaseBusiness className="h-4 w-4" />}
            Status hari ini: {todayStatus.label}
          </div>
        </motion.div>
      </section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-title-md font-black text-on-surface">Kalender pelaporan jobdesk</h2>
            <p className="text-body-sm text-on-surface-variant">
              Lihat nilai, bukti, dan keterlambatan per tanggal untuk {monthYearFormatter.format(currentDate)}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-label-xs font-bold sm:flex sm:flex-wrap">
            <span className="rounded-lg bg-green-500/10 px-3 py-1.5 text-green-600">80-100 Prima</span>
            <span className="rounded-lg bg-yellow-500/10 px-3 py-1.5 text-yellow-600">50-79 Pantau</span>
            <span className="rounded-lg bg-red-500/10 px-3 py-1.5 text-red-600">0-49 Prioritas</span>
            <span className="rounded-lg bg-surface-high px-3 py-1.5 text-on-surface-variant">Belum berjalan</span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
          <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <div className="grid min-w-[740px] grid-cols-7 gap-2 xl:min-w-0">
              {weekdayLabels.map((label) => (
                <div key={label} className="px-2 pb-1 text-center text-label-xs font-black uppercase tracking-widest text-on-surface-variant">
                  {label}
                </div>
              ))}
              {calendarCells.map((cell) => {
                if (cell.day === null) {
                  return <div key={cell.key} className="min-h-[104px] rounded-xl border border-dashed border-outline-variant/10 bg-surface-high/20" />;
                }

                const day = cell.day;
                const dayReport = reportByDay.get(day);
                const status = dayReport ? getStatus(dayReport.nilai) : null;
                const isToday = day === currentDate.getDate();
                const isFuture = day > currentDate.getDate();
                const isSelected = day === selectedDay;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={isSelected}
                    className={`min-h-[104px] rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      dayReport
                        ? `${status?.borderClass ?? 'border-outline-variant/20'} ${status?.bgClass ?? 'bg-surface-high'}`
                        : isFuture
                          ? 'border-outline-variant/10 bg-surface-high/20 opacity-70'
                          : 'border-dashed border-outline-variant/20 bg-surface-high/25'
                    } ${isToday ? 'ring-2 ring-primary/30' : ''} ${isSelected ? 'border-primary/55 bg-primary/10 ring-2 ring-primary/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-label-sm font-black ${isToday || isSelected ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>
                        {day}
                      </span>
                      {dayReport?.terlambat && (
                        <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-yellow-600">Telat</span>
                      )}
                    </div>

                    {dayReport ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-end justify-between gap-2">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nilai</p>
                            <p className={`text-title-sm font-black ${status?.textClass}`}>{dayReport.nilai}</p>
                          </div>
                          <BadgeCheck className={`h-4 w-4 ${status?.textClass}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-label-xs">
                          <div className="rounded-lg bg-surface/75 px-2 py-1.5">
                            <p className="font-bold text-on-surface-variant">Bukti</p>
                            <p className="font-black text-on-surface">{dayReport.bukti}</p>
                          </div>
                          <div className="rounded-lg bg-surface/75 px-2 py-1.5">
                            <p className="font-bold text-on-surface-variant">Jobdesk</p>
                            <p className="font-black text-on-surface">{dayReport.selesai}/{dayReport.totalJobdesk}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-lg bg-surface/70 px-2 py-2 text-center text-label-xs font-semibold text-on-surface-variant">
                        {isFuture ? 'Belum berjalan' : 'Belum ada laporan'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-outline-variant/20 bg-surface-high/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Detail tanggal</p>
                <h3 className="mt-1 text-title-md font-black text-on-surface">{reportDateFormatter.format(selectedDate)}</h3>
              </div>
              <div className={`rounded-xl p-2.5 ${selectedStatus?.bgClass ?? 'bg-surface'} ${selectedStatus?.textClass ?? 'text-on-surface-variant'}`}>
                <FileText className="h-5 w-5" />
              </div>
            </div>

            {selectedDailyReport ? (
              <div className="mt-5 space-y-4">
                <div className={`rounded-2xl border p-4 ${selectedStatus?.borderClass} ${selectedStatus?.bgClass}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Nilai PIC</p>
                      <p className={`mt-1 text-headline-sm font-black ${selectedStatus?.textClass}`}>{selectedDailyReport.nilai}/100</p>
                    </div>
                    <span className={`rounded-lg px-3 py-1 text-label-xs font-black uppercase tracking-widest ${selectedStatus?.bgClass} ${selectedStatus?.textClass}`}>
                      {selectedStatus?.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-surface px-3 py-3">
                    <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
                      <ListChecks className="h-4 w-4" />
                      <p className="text-label-xs font-bold uppercase tracking-widest">Hasil</p>
                    </div>
                    <p className="text-title-sm font-black text-on-surface">
                      {selectedDailyReport.selesai}/{selectedDailyReport.totalJobdesk}
                    </p>
                    <p className="text-label-xs text-on-surface-variant">jobdesk selesai</p>
                  </div>
                  <div className="rounded-xl bg-surface px-3 py-3">
                    <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
                      <ImageIcon className="h-4 w-4" />
                      <p className="text-label-xs font-bold uppercase tracking-widest">Bukti</p>
                    </div>
                    <p className="text-title-sm font-black text-on-surface">{selectedDailyReport.bukti}</p>
                    <p className="text-label-xs text-on-surface-variant">file/foto masuk</p>
                  </div>
                </div>

                <div className="rounded-xl bg-surface px-3 py-3">
                  <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
                    <Timer className="h-4 w-4" />
                    <p className="text-label-xs font-bold uppercase tracking-widest">Status laporan</p>
                  </div>
                  <p className={`text-body-sm font-bold ${selectedDailyReport.terlambat ? 'text-yellow-500' : 'text-green-500'}`}>
                    {selectedDailyReport.terlambat ? 'Terlambat, perlu validasi PIC.' : 'Tepat waktu dan tercatat.'}
                  </p>
                </div>

                <div className="rounded-xl border border-outline-variant/15 bg-surface px-3 py-3">
                  <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
                    <MessageSquareText className="h-4 w-4" />
                    <p className="text-label-xs font-bold uppercase tracking-widest">Komentar PIC</p>
                  </div>
                  <p className="text-body-sm font-semibold text-on-surface">{selectedDailyReport.catatan}</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-outline-variant/25 bg-surface/60 p-4 text-center">
                <FileText className="mx-auto h-8 w-8 text-on-surface-variant/70" />
                <p className="mt-3 text-body-sm font-bold text-on-surface">
                  {selectedDay > currentDate.getDate() ? 'Tanggal belum berjalan.' : 'Belum ada laporan pada tanggal ini.'}
                </p>
                <p className="mt-1 text-label-sm text-on-surface-variant">
                  Detail nilai, hasil laporan, dan komentar PIC akan tampil setelah laporan masuk.
                </p>
              </div>
            )}
          </aside>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-title-md font-black text-on-surface">History pelaporan harian</h2>
              <p className="text-body-sm text-on-surface-variant">Data terbaru tampil di atas supaya owner cepat melihat kondisi terakhir.</p>
            </div>
            <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-label-xs font-bold text-primary">{report.history.length} hari</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/10 bg-surface-high/35">
            <table className="w-full min-w-[760px]">
              <thead className="sticky top-0 z-10 bg-surface-high">
                <tr className="border-b border-outline-variant/10">
                  <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Tanggal</th>
                  <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Nilai</th>
                  <th className="px-4 py-3 text-center text-label-xs uppercase tracking-widest text-on-surface-variant">Jobdesk</th>
                  <th className="px-4 py-3 text-center text-label-xs uppercase tracking-widest text-on-surface-variant">Bukti</th>
                  <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Komentar PIC</th>
                </tr>
              </thead>
              <tbody>
                {reversedHistory.map((item) => {
                  const status = getStatus(item.nilai);
                  return (
                    <tr key={item.tanggal} className="border-b border-outline-variant/10 transition last:border-0 hover:bg-surface/45">
                      <td className="px-4 py-3 text-body-sm font-semibold text-on-surface">{shortDateFormatter.format(new Date(item.tanggal))}</td>
                      <td className="px-4 py-3">
                        <span className={`text-body-sm font-black ${status.textClass}`}>{item.nilai}</span>
                        {item.terlambat && <span className="ml-2 rounded-md bg-yellow-500/10 px-2 py-0.5 text-label-xs font-bold text-yellow-600">Telat</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-body-sm font-semibold text-on-surface">{item.selesai}/{item.totalJobdesk}</td>
                      <td className="px-4 py-3 text-center text-body-sm font-semibold text-on-surface">{item.bukti}</td>
                      <td className="px-4 py-3 text-body-sm text-on-surface-variant">{item.catatan}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </motion.section>
    </motion.div>
  );
};

export default OwnerRaportEmployeeDetailPage;
