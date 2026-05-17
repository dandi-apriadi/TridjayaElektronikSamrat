import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MessageSquareText,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { usePicRaportStore } from '../../store/picRaportStore';
import { toDateKey } from '../../data/picRaportData';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };
const weekdayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const dateKey = toDateKey;
const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const statusMeta = {
  approved: {
    label: 'Disetujui',
    className: 'bg-secondary/10 text-secondary',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Ditolak',
    className: 'bg-error/10 text-error',
    icon: Ban,
  },
  pending: {
    label: 'Menunggu PIC',
    className: 'bg-yellow-500/10 text-yellow-500',
    icon: Clock3,
  },
};

const KaryawanRaportHistoryPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const evidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const raportError = usePicRaportStore((state) => state.error);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));

  useEffect(() => {
    const range = getCurrentMonthRange();
    fetchEvidence({ tanggalFrom: range.from, tanggalTo: range.to, limit: 2000 });
  }, [fetchEvidence]);

  const employeeHistory = useMemo(() => {
    const userName = user?.name?.trim().toLowerCase();
    return evidence
      .filter((item) => item.employeeId === user?.id || (userName && item.employeeName.toLowerCase() === userName))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [evidence, user?.id, user?.name]);

  const historyByDay = useMemo(() => {
    const grouped = new Map<string, typeof employeeHistory>();
    employeeHistory.forEach((item) => {
      grouped.set(item.tanggal, [...(grouped.get(item.tanggal) || []), item]);
    });
    return grouped;
  }, [employeeHistory]);

  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const selectedItems = historyByDay.get(selectedDate) || [];
  const calendarCells = [
    ...Array.from({ length: firstDayOfMonth.getDay() }, (_, index) => ({ key: `blank-${index}`, day: null as number | null, keyDate: '' })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
      return { key: `day-${index + 1}`, day: index + 1, keyDate: dateKey(date) };
    }),
  ];

  const totalApproved = employeeHistory.filter((item) => item.reviewStatus === 'approved').length;
  const totalPending = employeeHistory.filter((item) => item.reviewStatus === 'pending').length;
  const totalRejected = employeeHistory.filter((item) => item.reviewStatus === 'rejected').length;
  const scoredItems = employeeHistory.filter((item) => typeof item.score === 'number');
  const averageScore = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + (item.score || 0), 0) / scoredItems.length)
    : 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/dashboard/karyawan/raport"
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface px-3 py-2 text-label-sm font-bold text-on-surface-variant transition hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke raport harian
          </Link>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
            History upload bukti
          </div>
          <h1 className="text-headline-md font-black text-on-surface">History Raport</h1>
          <p className="mt-2 max-w-3xl text-body-md text-on-surface-variant">
            Lihat bukti yang pernah dikirim, status review PIC, nilai, dan komentar per tanggal.
          </p>
        </div>
        <div className="rounded-2xl border border-outline-variant/20 bg-surface-high/70 p-4">
          <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Bulan berjalan</p>
          <p className="mt-1 text-title-sm font-black text-on-surface">
            {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(currentDate)}
          </p>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Bukti', value: employeeHistory.length, helper: 'Semua upload yang tercatat', icon: FileCheck2, tone: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Disetujui', value: totalApproved, helper: 'Sudah divalidasi PIC', icon: CheckCircle2, tone: 'text-secondary', bg: 'bg-secondary/10' },
          { label: 'Menunggu', value: totalPending, helper: 'Belum dinilai PIC', icon: Clock3, tone: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Rata-rata Nilai', value: averageScore || '-', helper: totalRejected > 0 ? `${totalRejected} bukti ditolak` : 'Tidak ada bukti ditolak', icon: MessageSquareText, tone: totalRejected > 0 ? 'text-error' : 'text-on-surface', bg: totalRejected > 0 ? 'bg-error/10' : 'bg-surface-high' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.label} variants={itemVariants} className="rounded-3xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</p>
                  <p className={`mt-2 text-headline-sm font-black ${item.tone}`}>{item.value}</p>
                </div>
                <div className={`rounded-2xl p-3 ${item.bg} ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-body-sm text-on-surface-variant">{item.helper}</p>
            </motion.div>
          );
        })}
      </section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm lg:p-6">
        {raportError && (
          <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-semibold text-error">
            {raportError}
          </div>
        )}
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-title-lg font-black text-on-surface">Kalender bukti raport</h2>
            <p className="text-body-sm text-on-surface-variant">
              Pilih tanggal untuk melihat detail bukti dan komentar PIC.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid grid-cols-7 gap-2">
            {weekdayLabels.map((label) => (
              <div key={label} className="pb-1 text-center text-label-xs font-black uppercase tracking-widest text-on-surface-variant">
                {label}
              </div>
            ))}
            {calendarCells.map((cell) => {
              if (cell.day === null) {
                return <div key={cell.key} className="min-h-[92px] rounded-xl border border-dashed border-outline-variant/10 bg-surface-high/15" />;
              }

              const dayItems = historyByDay.get(cell.keyDate) || [];
              const isSelected = selectedDate === cell.keyDate;
              const isToday = cell.keyDate === dateKey(new Date());

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDate(cell.keyDate)}
                  className={`min-h-[92px] rounded-xl border p-2 text-left transition ${
                    isSelected
                      ? 'border-primary/40 bg-primary/10 ring-2 ring-primary/20'
                      : dayItems.length > 0
                        ? 'border-outline-variant/20 bg-surface-high/35 hover:border-primary/30'
                        : 'border-dashed border-outline-variant/20 bg-surface-high/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-label-xs font-black ${isToday ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>
                      {cell.day}
                    </span>
                    {dayItems.length > 0 && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-black text-primary">{dayItems.length}</span>}
                  </div>
                  {dayItems.length > 0 ? (
                    <div className="mt-3 text-[10px] font-bold text-on-surface-variant">
                      {dayItems.filter((item) => item.reviewStatus === 'approved').length} disetujui
                    </div>
                  ) : (
                    <div className="mt-4 text-center text-[10px] font-semibold text-on-surface-variant">Kosong</div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/35 p-4">
            <h3 className="text-title-sm font-black text-on-surface">
              {new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${selectedDate}T00:00:00`))}
            </h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">{selectedItems.length} bukti tercatat pada tanggal ini.</p>
            <div className="mt-4 space-y-3">
              {selectedItems.map((item) => {
                const meta = statusMeta[item.reviewStatus];
                const StatusIcon = meta.icon;
                return (
                  <div key={item.id} className="rounded-xl border border-outline-variant/10 bg-surface p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-xs font-bold ${meta.className}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <span className="text-label-xs font-bold text-on-surface-variant">{typeof item.score === 'number' ? `${item.score}/100` : 'Belum dinilai'}</span>
                    </div>
                    <p className="text-body-sm font-semibold text-on-surface">{item.jobdeskText}</p>
                    <p className="mt-1 text-label-sm text-on-surface-variant">{item.mode === 'none' ? 'Bukti ditandai Tidak Ada' : item.mode === 'video' ? 'Bukti berupa video' : 'Bukti berupa gambar'}</p>
                    {item.reviewerComment && <p className="mt-2 rounded-lg bg-surface-high px-3 py-2 text-label-sm text-on-surface-variant">{item.reviewerComment}</p>}
                  </div>
                );
              })}
              {selectedItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-outline-variant/20 bg-surface/60 py-8 text-center">
                  <p className="text-body-sm font-bold text-on-surface">Belum ada history upload.</p>
                  <p className="mt-1 text-label-xs text-on-surface-variant">Pilih tanggal lain atau kirim raport harian terlebih dahulu.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default KaryawanRaportHistoryPage;
