import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Image as ImageIcon,
  Search,
  Video,
} from 'lucide-react';
import { buildPicDaySummaries, buildPicEvidenceByDate, todayKey, toDateKey, type PicRaportEvidence, type PicRaportReviewStatus } from '../../data/picRaportData';
import { useDebounce } from '../../hooks/useDebounce';
import { usePicRaportStore } from '../../store/picRaportStore';

type FilterStatus = 'all' | PicRaportReviewStatus;
const HISTORY_BATCH_SIZE = 16;

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const itemVariants = { hidden: { y: 10, opacity: 0 }, visible: { y: 0, opacity: 1 } };
const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

const statusClass = (status: PicRaportEvidence['reviewStatus']) => {
  if (status === 'approved') return 'bg-secondary/10 text-secondary';
  if (status === 'rejected') return 'bg-error/10 text-error';
  return 'bg-amber-500/10 text-amber-600';
};

const evidenceLabel = (item: PicRaportEvidence) => {
  if (item.mode === 'video') return 'Video';
  if (item.mode === 'image') return 'Gambar';
  return 'Tanpa bukti';
};

const PicRaportHistoryPage: React.FC = () => {
  const evidence = usePicRaportStore((state) => state.evidence);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [visibleLimit, setVisibleLimit] = useState(HISTORY_BATCH_SIZE);
  const debouncedSearch = useDebounce(search, 250);

  const summaries = useMemo(() => buildPicDaySummaries(evidence), [evidence]);
  const summaryByDate = useMemo(() => new Map(summaries.map((item) => [item.tanggal, item])), [summaries]);
  const evidenceByDate = useMemo(() => buildPicEvidenceByDate(evidence), [evidence]);
  const branches = useMemo(() => [...new Set(evidence.map((item) => item.cabang))].sort((a, b) => a.localeCompare(b, 'id')), [evidence]);

  const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstDay.getDay() }, (_, index) => ({ key: `blank-${index}`, dateKey: '', day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), index + 1);
      return { key: toDateKey(date), dateKey: toDateKey(date), day: index + 1 };
    }),
  ];

  const selectedItems = useMemo(() => {
    const searchValue = debouncedSearch.trim().toLowerCase();
    return (evidenceByDate.get(selectedDate) || [])
      .filter((item) => branch === 'all' || item.cabang === branch)
      .filter((item) => status === 'all' || item.reviewStatus === status)
      .filter((item) => !searchValue || `${item.employeeName} ${item.cabang} ${item.divisiName} ${item.jobdeskText}`.toLowerCase().includes(searchValue));
  }, [branch, debouncedSearch, evidenceByDate, selectedDate, status]);

  const visibleItems = useMemo(() => selectedItems.slice(0, visibleLimit), [selectedItems, visibleLimit]);

  const selectedSummary = summaryByDate.get(selectedDate);

  useEffect(() => {
    setVisibleLimit(HISTORY_BATCH_SIZE);
  }, [branch, debouncedSearch, selectedDate, status]);

  const moveMonth = (direction: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/dashboard/pic-raport" className="mb-4 inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Review
          </Link>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">History Upload</p>
          <h1 className="mt-1 text-headline-sm font-black text-on-surface">Kalender bukti raport</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-on-surface-variant">
            {selectedSummary ? `${selectedSummary.masuk} bukti pada ${formatDate(selectedDate)}.` : `Tidak ada upload pada ${formatDate(selectedDate)}.`}
          </p>
        </div>
      </motion.div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 p-4">
            <button type="button" onClick={() => moveMonth(-1)} className="grid h-9 w-9 place-items-center rounded-lg bg-surface-high text-on-surface-variant hover:text-primary" aria-label="Bulan sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <h2 className="text-title-md font-black text-on-surface">
                {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(monthCursor)}
              </h2>
              <p className="text-label-xs font-bold text-on-surface-variant">{summaries.length} hari punya aktivitas</p>
            </div>
            <button type="button" onClick={() => moveMonth(1)} className="grid h-9 w-9 place-items-center rounded-lg bg-surface-high text-on-surface-variant hover:text-primary" aria-label="Bulan berikutnya">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekdays.map((day) => (
                <div key={day} className="pb-1 text-center text-label-xs font-black uppercase tracking-widest text-on-surface-variant">{day}</div>
              ))}
              {calendarCells.map((cell) => {
                if (!cell.dateKey) {
                  return <div key={cell.key} className="min-h-[94px] rounded-lg border border-dashed border-outline-variant/10 bg-surface-high/15" />;
                }
                const summary = summaryByDate.get(cell.dateKey);
                const isSelected = selectedDate === cell.dateKey;
                const isToday = cell.dateKey === todayKey;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateKey)}
                    className={`min-h-[94px] rounded-lg border p-2 text-left transition ${
                      isSelected
                        ? 'border-primary/40 bg-primary/10 ring-2 ring-primary/20'
                        : summary
                          ? 'border-outline-variant/20 bg-surface-high/35 hover:border-primary/30'
                          : 'border-dashed border-outline-variant/20 bg-surface-high/15 hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-md text-label-xs font-black ${isToday ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>
                        {cell.day}
                      </span>
                      {summary && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-black text-primary">{summary.masuk}</span>}
                    </div>
                    {summary ? (
                      <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px] font-black">
                        <span className="rounded bg-secondary/10 py-1 text-secondary">{summary.approved}</span>
                        <span className="rounded bg-amber-500/10 py-1 text-amber-600">{summary.pending}</span>
                        <span className="rounded bg-error/10 py-1 text-error">{summary.rejected}</span>
                      </div>
                    ) : (
                      <div className="mt-4 text-center text-[11px] font-semibold text-on-surface-variant">Kosong</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          <div className="border-b border-outline-variant/10 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-title-md font-black text-on-surface">{formatDate(selectedDate)}</h2>
                <p className="mt-1 text-label-sm text-on-surface-variant">
                  {selectedSummary ? `Rata nilai ${selectedSummary.rataNilai}` : 'Belum ada aktivitas.'}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:min-w-[320px]">
                {[
                  { label: 'Masuk', value: selectedSummary?.masuk || 0, icon: FileCheck2, className: 'text-primary bg-primary/10' },
                  { label: 'OK', value: selectedSummary?.approved || 0, icon: CheckCircle2, className: 'text-secondary bg-secondary/10' },
                  { label: 'Pending', value: selectedSummary?.pending || 0, icon: Clock3, className: 'text-amber-600 bg-amber-500/10' },
                  { label: 'Tolak', value: selectedSummary?.rejected || 0, icon: Ban, className: 'text-error bg-error/10' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg bg-surface-high/35 p-2">
                      <Icon className={`mb-1 h-4 w-4 rounded ${item.className}`} />
                      <p className="text-title-sm font-black text-on-surface">{item.value}</p>
                      <p className="text-[10px] font-bold text-on-surface-variant">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_170px_150px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari karyawan atau jobdesk" className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-9 text-label-sm text-on-surface outline-none focus:border-primary/50" />
              </div>
              <select value={branch} onChange={(event) => setBranch(event.target.value)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none focus:border-primary/50">
                <option value="all">Semua cabang</option>
                {branches.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value as FilterStatus)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none focus:border-primary/50">
                <option value="all">Semua status</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
              </select>
            </div>
          </div>

          <div className="max-h-[680px] space-y-2 overflow-y-auto p-4">
            {visibleItems.map((item) => {
              const EvidenceIcon = item.mode === 'video' ? Video : item.mode === 'image' ? ImageIcon : Ban;
              return (
                <article key={item.id} className="rounded-lg border border-outline-variant/15 bg-surface-high/35 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/dashboard/pic-raport/karyawan/${item.employeeId}`} className="text-body-sm font-black text-primary hover:underline">{item.employeeName}</Link>
                        <span className={`rounded-full px-2.5 py-1 text-label-xs font-bold ${statusClass(item.reviewStatus)}`}>
                          {item.reviewStatus === 'approved' ? 'Disetujui' : item.reviewStatus === 'rejected' ? 'Ditolak' : 'Menunggu'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-label-xs text-on-surface-variant">
                        <Building2 className="h-3.5 w-3.5" />
                        {item.cabang} | {item.divisiName} | {formatTime(item.submittedAt)}
                      </div>
                      <p className="mt-3 text-body-sm font-semibold text-on-surface">{item.jobdeskText}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-label-xs font-bold text-on-surface-variant">
                        <EvidenceIcon className="h-3.5 w-3.5" />
                        {evidenceLabel(item)}
                      </span>
                      <span className="rounded-lg bg-surface px-2.5 py-1.5 text-label-xs font-black text-on-surface">
                        {typeof item.score === 'number' ? `${item.score}/100` : '-'}
                      </span>
                    </div>
                  </div>
                  {item.reviewerComment && (
                    <div className="mt-3 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-label-sm text-on-surface-variant">
                      {item.reviewerComment}
                    </div>
                  )}
                </article>
              );
            })}
            {visibleItems.length < selectedItems.length && (
              <div className="py-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + HISTORY_BATCH_SIZE)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-4 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary"
                >
                  Muat lagi ({selectedItems.length - visibleItems.length} tersisa)
                </button>
              </div>
            )}
            {selectedItems.length === 0 && (
              <div className="rounded-lg border border-dashed border-outline-variant/20 bg-surface-high/20 py-12 text-center">
                <CalendarDays className="mx-auto h-8 w-8 text-on-surface-variant" />
                <p className="mt-3 text-body-sm font-bold text-on-surface">Tidak ada bukti sesuai filter.</p>
                <p className="mt-1 text-label-sm text-on-surface-variant">Pilih tanggal, cabang, atau status lain.</p>
              </div>
            )}
          </div>
        </motion.div>
      </section>
    </motion.div>
  );
};

export default PicRaportHistoryPage;
