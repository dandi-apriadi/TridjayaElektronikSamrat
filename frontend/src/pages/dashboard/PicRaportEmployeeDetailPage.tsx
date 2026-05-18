import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Ban,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  Clock3,
  FileCheck2,
  Image as ImageIcon,
  MessageSquareText,
  UserRound,
  Video,
} from 'lucide-react';
import { buildPicEmployeeSummaries, getEvidenceUrls, sortEvidenceByJobdeskNumber, todayKey, toDateKey, type PicRaportEvidence } from '../../data/picRaportData';
import { usePicRaportStore } from '../../store/picRaportStore';
import { ImagePreviewModal, type PreviewImage } from '../../components/ui';
import PicEvidenceReviewControls from '../../components/dashboard/PicEvidenceReviewControls';
import { calculateRaportFineTotal, formatRupiah, summarizeRaportScore } from '../../utils/denda';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const itemVariants = { hidden: { y: 10, opacity: 0 }, visible: { y: 0, opacity: 1 } };
const weekdays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const EMPLOYEE_DETAIL_BATCH_SIZE = 12;
const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    from: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateKey(now),
  };
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`));

const formatShortDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));

const statusStyle = (status: PicRaportEvidence['reviewStatus']) => {
  if (status === 'approved') return 'bg-secondary/10 text-secondary';
  if (status === 'rejected') return 'bg-error/10 text-error';
  return 'bg-amber-500/10 text-amber-600';
};

const statusLabel = (status: PicRaportEvidence['reviewStatus']) => {
  if (status === 'approved') return 'Disetujui';
  if (status === 'rejected') return 'Ditolak';
  return 'Menunggu';
};

const PicRaportEmployeeDetailPage: React.FC = () => {
  const { employeeId } = useParams();
  const evidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const isLoading = usePicRaportStore((state) => state.isLoading);
  const raportError = usePicRaportStore((state) => state.error);
  const employee = useMemo(() => buildPicEmployeeSummaries(evidence).find((item) => item.id === employeeId), [employeeId, evidence]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleLimit, setVisibleLimit] = useState(EMPLOYEE_DETAIL_BATCH_SIZE);
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    initialIndex: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    const range = getCurrentMonthRange();
    fetchEvidence({ karyawanId: employeeId, tanggalFrom: range.from, tanggalTo: range.to, limit: 2000 });
  }, [employeeId, fetchEvidence]);

  const employeeEvidence = useMemo(
    () => evidence.filter((item) => item.employeeId === employeeId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [employeeId, evidence]
  );

  const byDate = useMemo(() => {
    const grouped = new Map<string, PicRaportEvidence[]>();
    employeeEvidence.forEach((item) => {
      const currentItems = grouped.get(item.tanggal) || [];
      currentItems.push(item);
      grouped.set(item.tanggal, currentItems);
    });
    return grouped;
  }, [employeeEvidence]);

  useEffect(() => {
    setVisibleLimit(EMPLOYEE_DETAIL_BATCH_SIZE);
  }, [selectedDate]);

  const displayEmployee = employee || (employeeEvidence[0]
    ? {
        id: employeeEvidence[0].employeeId,
        nama: employeeEvidence[0].employeeName,
        posisi: employeeEvidence[0].divisiName,
        cabang: employeeEvidence[0].cabang,
        selesai: employeeEvidence.filter((item) => item.reviewStatus !== 'pending').length,
        totalJobdesk: employeeEvidence.length,
        persentase: employeeEvidence.length
          ? Math.round((employeeEvidence.filter((item) => item.reviewStatus !== 'pending').length / employeeEvidence.length) * 100)
          : 0,
        pendingEvidence: employeeEvidence.filter((item) => item.reviewStatus === 'pending').length,
        rejectedEvidence: employeeEvidence.filter((item) => item.reviewStatus === 'rejected').length,
        approvedEvidence: employeeEvidence.filter((item) => item.reviewStatus === 'approved').length,
        averageScore: 0,
      }
    : null);

  if (!displayEmployee) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
        <Link to="/dashboard/pic-raport" className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-primary">
          <ArrowLeft className="h-4 w-4" />
          Review
        </Link>
        <div className="rounded-xl border border-outline-variant/20 bg-surface p-8 text-center shadow-sm">
          <FileCheck2 className="mx-auto h-8 w-8 text-on-surface-variant" />
          <p className="mt-3 text-body-sm font-bold text-on-surface">
            {isLoading ? 'Memuat raport karyawan...' : 'Data karyawan belum ditemukan.'}
          </p>
          {(raportError && !isLoading) && <p className="mt-2 text-label-sm font-semibold text-error">{raportError}</p>}
        </div>
      </motion.div>
    );
  }

  const selectedItems = sortEvidenceByJobdeskNumber(byDate.get(selectedDate) || []);
  const selectedRaportSummary = summarizeRaportScore(selectedItems);
  const visibleSelectedItems = selectedItems.slice(0, visibleLimit);
  const currentDate = new Date();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstDay.getDay() }, (_, index) => ({ key: `blank-${index}`, dateKey: '', day: null as number | null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
      return { key: toDateKey(date), dateKey: toDateKey(date), day: index + 1 };
    }),
  ];

  const latestComments = employeeEvidence.filter((item) => item.reviewerComment).slice(0, 5);
  const latestActivity = employeeEvidence.slice(0, 8);
  const completionRate = employeeEvidence.length
    ? Math.round(((displayEmployee.approvedEvidence + displayEmployee.rejectedEvidence) / employeeEvidence.length) * 100)
    : 0;
  const monthlyRaportFine = calculateRaportFineTotal(
    [...byDate.values()].map((items) => {
      const summary = summarizeRaportScore(items);
      return { score: summary.score, hasScore: summary.scoredCount > 0 };
    })
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/dashboard/pic-raport" className="mb-4 inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Review
          </Link>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Detail karyawan</p>
              <h1 className="mt-1 text-headline-sm font-black text-on-surface">{displayEmployee.nama}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant">
                <UserRound className="h-4 w-4" />
            {displayEmployee.posisi}
            <span>|</span>
            <Building2 className="h-4 w-4" />
            {displayEmployee.cabang}
          </p>
        </div>
      </motion.div>

      <section className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-label-sm font-bold text-on-surface-variant">Kualitas review</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-headline-md font-black text-primary">{displayEmployee.averageScore}/100</span>
                <span className="pb-1 text-label-sm font-bold text-on-surface-variant">{completionRate}% sudah diputuskan</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:min-w-[460px]">
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Disetujui</p>
                <p className="text-title-md font-black text-secondary">{displayEmployee.approvedEvidence}</p>
              </div>
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Pending</p>
                <p className="text-title-md font-black text-amber-600">{displayEmployee.pendingEvidence}</p>
              </div>
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Ditolak</p>
                <p className="text-title-md font-black text-error">{displayEmployee.rejectedEvidence}</p>
              </div>
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Denda</p>
                <p className={`text-title-sm font-black ${monthlyRaportFine > 0 ? 'text-error' : 'text-secondary'}`}>{formatRupiah(monthlyRaportFine)}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-label-sm font-bold text-on-surface">Aktivitas terbaru</p>
            <Clock3 className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            {latestActivity.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedDate(item.tanggal)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface-high/40 px-3 py-2 text-left hover:bg-surface-high"
              >
                <div className="min-w-0">
                  <p className="truncate text-label-sm font-bold text-on-surface">{item.jobdeskText}</p>
                  <p className="text-label-xs text-on-surface-variant">{formatShortDate(item.tanggal)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle(item.reviewStatus)}`}>
                  {statusLabel(item.reviewStatus)}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 p-4">
            <div>
              <h2 className="text-title-md font-black text-on-surface">Kalender karyawan</h2>
              <p className="mt-1 text-label-sm text-on-surface-variant">{employeeEvidence.length} bukti dalam history.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {weekdays.map((day) => (
                <div key={day} className="pb-1 text-center text-label-xs font-black uppercase tracking-widest text-on-surface-variant">{day}</div>
              ))}
              {calendarCells.map((cell) => {
                if (!cell.dateKey) return <div key={cell.key} className="min-h-[86px] rounded-lg border border-dashed border-outline-variant/10 bg-surface-high/15" />;
                const items = byDate.get(cell.dateKey) || [];
                const rejected = items.filter((item) => item.reviewStatus === 'rejected').length;
                const pending = items.filter((item) => item.reviewStatus === 'pending').length;
                const isSelected = selectedDate === cell.dateKey;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDate(cell.dateKey)}
                    className={`min-h-[86px] rounded-lg border p-2 text-left transition ${
                      isSelected
                        ? 'border-primary/40 bg-primary/10 ring-2 ring-primary/20'
                        : items.length
                          ? 'border-outline-variant/20 bg-surface-high/35 hover:border-primary/30'
                          : 'border-dashed border-outline-variant/20 bg-surface-high/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-md text-label-xs font-black ${cell.dateKey === todayKey ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>{cell.day}</span>
                      {items.length > 0 && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-black text-primary">{items.length}</span>}
                    </div>
                    {items.length > 0 && (
                      <div className="mt-3 space-y-1 text-[10px] font-bold">
                        <div className="text-secondary">OK {items.length - rejected - pending}</div>
                        {pending > 0 && <div className="text-amber-600">Pending {pending}</div>}
                        {rejected > 0 && <div className="text-error">Tolak {rejected}</div>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-outline-variant/10 p-4">
            <div>
              <h2 className="text-title-md font-black text-on-surface">{formatDate(selectedDate)}</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">{selectedItems.length} bukti pada tanggal ini.</p>
            </div>
            <FileCheck2 className="h-5 w-5 text-primary" />
          </div>
          <div className={`mx-4 mt-4 rounded-xl px-3 py-2 ${selectedRaportSummary.fine > 0 ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
            <div className="flex items-center gap-2 text-label-sm font-bold">
              <BadgeDollarSign className="h-4 w-4" />
              Denda tanggal ini: {formatRupiah(selectedRaportSummary.fine)}
            </div>
            <p className="mt-1 text-label-xs text-on-surface-variant">
              {selectedRaportSummary.scoredCount > 0 ? `Nilai total ${selectedRaportSummary.score}/100` : 'Menunggu nilai PIC'}
            </p>
          </div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto p-4">
            {visibleSelectedItems.map((item) => {
              const EvidenceIcon = item.mode === 'video' ? Video : item.mode === 'image' ? ImageIcon : Ban;
              const imageUrls = getEvidenceUrls(item);
              const previewImages = imageUrls.map((src, index) => ({
                src,
                alt: `${item.jobdeskText} ${index + 1}`,
                caption: `Gambar ${index + 1} dari ${item.employeeName}`,
              }));
              return (
                <article key={item.id} className="rounded-lg border border-outline-variant/15 bg-surface-high/35 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-label-xs font-bold ${statusStyle(item.reviewStatus)}`}>
                        {statusLabel(item.reviewStatus)}
                      </span>
                      <p className="mt-3 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Jobdesk {item.jobdeskIndex + 1}</p>
                      <p className="mt-1 text-body-sm font-bold text-on-surface">{item.jobdeskText}</p>
                      {item.employeeNote && <p className="mt-1 text-label-sm text-on-surface-variant">{item.employeeNote}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-label-xs font-bold text-on-surface-variant">
                        <EvidenceIcon className="h-3.5 w-3.5" />
                        {item.mode === 'none' ? 'Tanpa bukti' : item.mode === 'video' ? 'Video' : `${item.evidenceUrls?.length || 1} gambar`}
                      </span>
                      <span className="rounded-lg bg-surface px-2.5 py-1.5 text-label-xs font-black text-on-surface">{typeof item.score === 'number' ? `${item.score}/100` : '-'}</span>
                    </div>
                  </div>
                  {item.reviewerComment && (
                    <div className="mt-3 rounded-lg border border-outline-variant/10 bg-surface px-3 py-2 text-label-sm text-on-surface-variant">
                      {item.reviewerComment}
                    </div>
                  )}
                  {item.mode === 'image' && imageUrls.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {imageUrls.slice(0, 6).map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          onClick={() => setPreview({
                            images: previewImages,
                            initialIndex: index,
                            title: `Bukti ${item.employeeName}`,
                            subtitle: item.jobdeskText,
                          })}
                          className="rounded-lg border border-outline-variant/15 bg-surface p-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <img src={url} alt={`${item.jobdeskText} ${index + 1}`} className="h-24 w-full rounded-md object-contain" loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  )}
                  {item.mode === 'video' && imageUrls[0] && (
                    <div className="mt-3 rounded-lg border border-outline-variant/15 bg-surface p-2">
                      <video src={imageUrls[0]} className="max-h-72 w-full rounded-md bg-surface-high object-contain" controls />
                    </div>
                  )}
                  <PicEvidenceReviewControls item={item} />
                </article>
              );
            })}
            {visibleSelectedItems.length < selectedItems.length && (
              <div className="py-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((current) => current + EMPLOYEE_DETAIL_BATCH_SIZE)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 px-4 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary"
                >
                  Muat lagi ({selectedItems.length - visibleSelectedItems.length} tersisa)
                </button>
              </div>
            )}
            {selectedItems.length === 0 && (
              <div className="rounded-lg border border-dashed border-outline-variant/20 bg-surface-high/20 py-12 text-center">
                <p className="text-body-sm font-bold text-on-surface">Belum ada bukti pada {formatShortDate(selectedDate)}.</p>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-outline-variant/10 p-4">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <h2 className="text-title-md font-black text-on-surface">Komentar PIC terbaru</h2>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {latestComments.map((item) => (
            <div key={item.id} className="rounded-lg border border-outline-variant/10 bg-surface-high/35 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-label-xs font-bold text-on-surface-variant">{formatShortDate(item.tanggal)}</span>
                <span className={`rounded-full px-2.5 py-1 text-label-xs font-bold ${statusStyle(item.reviewStatus)}`}>
                  {statusLabel(item.reviewStatus)}
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant">{item.reviewerComment}</p>
            </div>
          ))}
          {latestComments.length === 0 && (
            <div className="col-span-full py-10 text-center text-body-sm font-bold text-on-surface-variant">
              Belum ada komentar PIC.
            </div>
          )}
        </div>
      </motion.section>
      {preview && (
        <ImagePreviewModal
          images={preview.images}
          initialIndex={preview.initialIndex}
          title={preview.title}
          subtitle={preview.subtitle}
          onClose={() => setPreview(null)}
        />
      )}
    </motion.div>
  );
};

export default PicRaportEmployeeDetailPage;
