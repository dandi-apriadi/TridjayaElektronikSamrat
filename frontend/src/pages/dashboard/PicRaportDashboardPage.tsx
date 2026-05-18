import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarOff,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileCheck2,
  Image as ImageIcon,
  MessageSquareText,
  Search,
  Send,
  Star,
  TimerReset,
  Users,
  Video,
} from 'lucide-react';
import { buildPicDaySummaries, buildPicEmployeeSummaries, getEvidenceUrls, todayKey, type PicRaportEvidence, type PicRaportReviewStatus } from '../../data/picRaportData';
import Pagination from '../../components/ui/Pagination';
import { ImagePreviewModal, type PreviewImage } from '../../components/ui';
import { useDebounce } from '../../hooks/useDebounce';
import { usePicRaportStore } from '../../store/picRaportStore';
import { useOffRequestStore } from '../../store/offRequestStore';

type FilterStatus = 'all' | PicRaportReviewStatus;
const REVIEW_PAGE_SIZE = 50;

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const itemVariants = { hidden: { y: 10, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const statusMeta: Record<PicRaportReviewStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Menunggu', className: 'bg-amber-500/10 text-amber-600', icon: AlertTriangle },
  approved: { label: 'Disetujui', className: 'bg-secondary/10 text-secondary', icon: CheckCircle2 },
  rejected: { label: 'Ditolak', className: 'bg-error/10 text-error', icon: Ban },
};

const statusOptions: { value: FilterStatus; label: string }[] = [
  { value: 'pending', label: 'Menunggu' },
  { value: 'all', label: 'Semua' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'approved', label: 'Selesai' },
];

const scorePresets = [70, 85, 100];

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

const evidenceIcon = (item: PicRaportEvidence) => {
  if (item.mode === 'video') return Video;
  if (item.mode === 'image') return ImageIcon;
  return Ban;
};

const PicRaportDashboardPage: React.FC = () => {
  const evidence = usePicRaportStore((state) => state.evidence);
  const divisions = usePicRaportStore((state) => state.divisions);
  const reviewEvidence = usePicRaportStore((state) => state.reviewEvidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const fetchDivisions = usePicRaportStore((state) => state.fetchDivisions);
  const raportError = usePicRaportStore((state) => state.error);
  const offRequests = useOffRequestStore((state) => state.requests);
  const fetchOffRequests = useOffRequestStore((state) => state.fetchRequests);
  const reviewOffRequest = useOffRequestStore((state) => state.reviewRequest);
  const offError = useOffRequestStore((state) => state.error);
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('all');
  const [division, setDivision] = useState('all');
  const [status, setStatus] = useState<FilterStatus>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [offDetailEmployeeId, setOffDetailEmployeeId] = useState<string | null>(null);
  const [offReviewBusyId, setOffReviewBusyId] = useState<string | null>(null);
  const [offReviewMessage, setOffReviewMessage] = useState('');
  const [offReviewComment, setOffReviewComment] = useState('');
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    initialIndex: number;
    title: string;
    subtitle?: string;
  } | null>(null);
  const debouncedSearch = useDebounce(search, 250);

  const todayEvidence = useMemo(
    () => evidence.filter((item) => item.tanggal === todayKey).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [evidence]
  );

  useEffect(() => {
    fetchEvidence({ tanggal: todayKey, limit: 2000 });
    fetchDivisions();
    fetchOffRequests({ limit: 200 });
  }, [fetchDivisions, fetchEvidence, fetchOffRequests]);
  const employees = useMemo(() => buildPicEmployeeSummaries(evidence), [evidence]);
  const daySummary = useMemo(() => buildPicDaySummaries(evidence).find((item) => item.tanggal === todayKey), [evidence]);
  const branches = useMemo(() => [...new Set(todayEvidence.map((item) => item.cabang))].sort((a, b) => a.localeCompare(b, 'id')), [todayEvidence]);

  const filteredEvidence = useMemo(() => {
    const searchValue = debouncedSearch.trim().toLowerCase();
    return todayEvidence
      .filter((item) => {
        const matchesSearch =
          !searchValue ||
          `${item.employeeName} ${item.cabang} ${item.divisiName} ${item.jobdeskText}`.toLowerCase().includes(searchValue);
        const matchesBranch = branch === 'all' || item.cabang === branch;
        const matchesDivision = division === 'all' || item.divisiId === division;
        const matchesStatus = status === 'all' || item.reviewStatus === status;
        return matchesSearch && matchesBranch && matchesDivision && matchesStatus;
      })
      .sort(
        (a, b) =>
          a.employeeName.localeCompare(b.employeeName, 'id') ||
          a.jobdeskIndex - b.jobdeskIndex ||
          b.submittedAt.localeCompare(a.submittedAt)
      );
  }, [branch, debouncedSearch, division, status, todayEvidence]);

  const totalPages = Math.max(1, Math.ceil(filteredEvidence.length / REVIEW_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * REVIEW_PAGE_SIZE;
  const visibleEvidence = useMemo(
    () => filteredEvidence.slice(pageStartIndex, pageStartIndex + REVIEW_PAGE_SIZE),
    [filteredEvidence, pageStartIndex]
  );

  const selectedEvidence =
    todayEvidence.find((item) => item.id === selectedId) ||
    filteredEvidence.find((item) => item.reviewStatus === 'pending') ||
    filteredEvidence[0] ||
    todayEvidence.find((item) => item.reviewStatus === 'pending') ||
    todayEvidence[0];

  useEffect(() => {
    if (!selectedEvidence) return;
    setSelectedId(selectedEvidence.id);
    setScore(typeof selectedEvidence.score === 'number' ? String(selectedEvidence.score) : '');
    setComment(selectedEvidence.reviewerComment || '');
  }, [selectedEvidence?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [branch, debouncedSearch, division, status]);

  useEffect(() => {
    if (currentPage <= totalPages) return;
    setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (visibleEvidence.length === 0) return;
    if (selectedId && visibleEvidence.some((item) => item.id === selectedId)) return;
    setSelectedId(visibleEvidence[0].id);
  }, [selectedId, visibleEvidence]);

  const reviewStats = useMemo(
    () =>
      todayEvidence.reduce(
        (stats, item) => {
          if (item.reviewStatus === 'pending') stats.pendingCount += 1;
          if (item.reviewStatus === 'rejected') stats.rejectedCount += 1;
          if (item.reviewStatus !== 'pending') stats.reviewedCount += 1;
          return stats;
        },
        { pendingCount: 0, rejectedCount: 0, reviewedCount: 0 }
      ),
    [todayEvidence]
  );
  const { reviewedCount, pendingCount, rejectedCount } = reviewStats;
  const progress = todayEvidence.length ? Math.round((reviewedCount / todayEvidence.length) * 100) : 0;
  const pendingOffRequests = useMemo(
    () => offRequests.filter((request) => request.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [offRequests]
  );
  const selectedOffHistory = useMemo(
    () =>
      offDetailEmployeeId
        ? offRequests
            .filter((request) => request.karyawanId === offDetailEmployeeId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [offDetailEmployeeId, offRequests]
  );

  const branchStats = useMemo(() => {
    const statsByBranch = new Map<string, { name: string; total: number; pending: number; rejected: number }>();
    todayEvidence.forEach((item) => {
      const stats = statsByBranch.get(item.cabang) || { name: item.cabang, total: 0, pending: 0, rejected: 0 };
      stats.total += 1;
      if (item.reviewStatus === 'pending') stats.pending += 1;
      if (item.reviewStatus === 'rejected') stats.rejected += 1;
      statsByBranch.set(item.cabang, stats);
    });
    return [...statsByBranch.values()].sort((a, b) => b.pending - a.pending || b.rejected - a.rejected || a.name.localeCompare(b.name, 'id'));
  }, [todayEvidence]);

  const submitReview = async (nextStatus: PicRaportReviewStatus) => {
    if (!selectedEvidence || reviewBusy) return;
    const trimmedScore = score.trim();
    const numericScore = Number(trimmedScore);
    if (nextStatus === 'approved' && (trimmedScore === '' || !Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)) {
      setReviewMessage('Pilih preset nilai atau isi nilai manual 0-100 sebelum menyimpan.');
      return;
    }
    setReviewBusy(true);
    setReviewMessage('');
    try {
      await reviewEvidence(selectedEvidence.id, {
        status: nextStatus,
        score: nextStatus === 'rejected' ? 0 : Math.round(numericScore),
        comment: comment.trim(),
      });
      const nextPending = filteredEvidence.find((item) => item.id !== selectedEvidence.id && item.reviewStatus === 'pending');
      setSelectedId(nextPending?.id || selectedEvidence.id);
      setReviewMessage(nextStatus === 'rejected' ? 'Raport berhasil ditolak.' : 'Raport berhasil disimpan.');
      window.setTimeout(() => setReviewMessage(''), 2400);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Review gagal disimpan.');
    } finally {
      setReviewBusy(false);
    }
  };

  const submitOffReview = async (requestId: string, status: 'approved' | 'rejected') => {
    if (offReviewBusyId) return;
    setOffReviewBusyId(requestId);
    setOffReviewMessage('');
    try {
      await reviewOffRequest(requestId, { status, comment: offReviewComment.trim() });
      await fetchOffRequests({ limit: 200 });
      setOffReviewComment('');
      setOffReviewMessage(status === 'approved' ? 'Pengajuan OFF disetujui.' : 'Pengajuan OFF ditolak.');
      window.setTimeout(() => setOffReviewMessage(''), 2400);
    } catch (error) {
      setOffReviewMessage(error instanceof Error ? error.message : 'Pengajuan OFF gagal diproses.');
    } finally {
      setOffReviewBusyId(null);
    }
  };

  const selectedStatus = selectedEvidence ? statusMeta[selectedEvidence.reviewStatus] : null;
  const SelectedStatusIcon = selectedStatus?.icon;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <motion.div variants={itemVariants} className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">PIC Raport</p>
          <h1 className="mt-1 text-headline-sm font-black text-on-surface">Meja review hari ini</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-on-surface-variant">
            {pendingCount} bukti menunggu keputusan dari {employees.filter((item) => item.lastUploadAt?.startsWith(todayKey)).length} karyawan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/dashboard/pic-raport/history" className="inline-flex h-10 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-primary">
            <CalendarDays className="h-4 w-4" />
            History
          </Link>
          <Link to="/dashboard/pic-raport/master" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-label-sm font-bold text-on-primary transition hover:bg-primary/90">
            <ClipboardCheck className="h-4 w-4" />
            Master Jobdesk
          </Link>
        </div>
      </motion.div>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-label-sm font-bold text-on-surface-variant">Progress review</p>
              <div className="mt-1 flex items-end gap-3">
                <span className="text-headline-md font-black text-on-surface">{progress}%</span>
                <span className="pb-1 text-label-sm font-bold text-on-surface-variant">{reviewedCount}/{todayEvidence.length} bukti selesai</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Menunggu</p>
                <p className="text-title-md font-black text-amber-600">{pendingCount}</p>
              </div>
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Ditolak</p>
                <p className="text-title-md font-black text-error">{rejectedCount}</p>
              </div>
              <div className="rounded-lg bg-surface-high/60 px-3 py-2">
                <p className="text-label-xs font-bold text-on-surface-variant">Rata nilai</p>
                <p className="text-title-md font-black text-secondary">{daySummary?.rataNilai || 0}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-high">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-label-sm font-bold text-on-surface">Cabang prioritas</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {branchStats.slice(0, 6).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setBranch(item.name)}
                className={`min-w-[140px] rounded-lg border px-3 py-2 text-left transition ${
                  branch === item.name ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/15 bg-surface-high/40 text-on-surface'
                }`}
              >
                <p className="truncate text-label-sm font-black">{item.name}</p>
                <p className="mt-1 text-label-xs font-bold text-on-surface-variant">{item.pending} pending dari {item.total}</p>
              </button>
            ))}
          </div>
        </motion.div>
      </section>

      <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
              <CalendarOff className="h-3.5 w-3.5" />
              Approval OFF
            </div>
            <h2 className="text-title-md font-black text-on-surface">{pendingOffRequests.length} pengajuan menunggu</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">Klik Detail untuk melihat history OFF karyawan sebelum approve.</p>
          </div>
          {(offReviewMessage || offError) && (
            <p className={`rounded-lg px-3 py-2 text-label-sm font-bold ${(offReviewMessage || offError || '').toLowerCase().includes('gagal') ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
              {offReviewMessage || offError}
            </p>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-3 md:grid-cols-2">
            {pendingOffRequests.map((request) => {
              const detailOpened = offDetailEmployeeId === request.karyawanId;
              return (
                <article key={request.id} className="rounded-xl border border-outline-variant/15 bg-surface-high/35 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-black text-on-surface">{request.karyawanNama}</p>
                      <p className="mt-1 text-label-xs font-semibold text-on-surface-variant">{request.cabang || '-'} | {request.divisi || '-'}</p>
                    </div>
                    <span className="rounded-lg bg-yellow-500/10 px-2.5 py-1 text-label-xs font-black text-yellow-600">Pending</span>
                  </div>
                  <p className="mt-3 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Tanggal OFF</p>
                  <p className="mt-1 text-body-sm font-bold text-on-surface">{request.tanggal}</p>
                  <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-body-sm text-on-surface-variant">{request.alasan}</p>
                  <p className="mt-2 text-label-xs font-semibold text-on-surface-variant">Kadaluarsa: {request.expiresAt}</p>

                  <textarea
                    value={detailOpened ? offReviewComment : ''}
                    onChange={(event) => setOffReviewComment(event.target.value)}
                    disabled={!detailOpened || offReviewBusyId === request.id}
                    rows={2}
                    placeholder={detailOpened ? 'Catatan PIC opsional' : 'Buka Detail dulu sebelum approve'}
                    className="mt-3 w-full resize-none rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-body-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => {
                        setOffDetailEmployeeId(request.karyawanId);
                        setOffReviewComment('');
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary"
                    >
                      <Eye className="h-4 w-4" />
                      Detail
                    </button>
                    <button
                      type="button"
                      onClick={() => submitOffReview(request.id, 'rejected')}
                      disabled={!detailOpened || Boolean(offReviewBusyId)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-error/25 bg-error/10 px-3 text-label-sm font-bold text-error transition hover:bg-error hover:text-on-error disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Ban className="h-4 w-4" />
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => submitOffReview(request.id, 'approved')}
                      disabled={!detailOpened || Boolean(offReviewBusyId)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-label-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </button>
                  </div>
                </article>
              );
            })}
            {pendingOffRequests.length === 0 && (
              <div className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-high/20 p-8 text-center md:col-span-2">
                <CalendarOff className="mx-auto h-7 w-7 text-on-surface-variant" />
                <p className="mt-3 text-body-sm font-bold text-on-surface">Tidak ada pengajuan OFF pending.</p>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-outline-variant/15 bg-surface-high/35 p-4">
            <h3 className="text-title-sm font-black text-on-surface">History OFF karyawan</h3>
            <p className="mt-1 text-label-sm text-on-surface-variant">Terbuka setelah PIC menekan Detail.</p>
            <div className="mt-4 space-y-2">
              {selectedOffHistory.slice(0, 8).map((request) => (
                <div key={request.id} className="rounded-lg bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label-sm font-black text-on-surface">{request.tanggal}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${
                      request.status === 'approved'
                        ? 'bg-secondary/10 text-secondary'
                        : request.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-600'
                          : 'bg-error/10 text-error'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-label-sm text-on-surface-variant">{request.alasan}</p>
                </div>
              ))}
              {selectedOffHistory.length === 0 && (
                <p className="rounded-lg border border-dashed border-outline-variant/20 px-3 py-6 text-center text-label-sm font-semibold text-on-surface-variant">
                  Pilih Detail pada salah satu pengajuan.
                </p>
              )}
            </div>
          </aside>
        </div>
      </motion.section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        {(raportError || reviewMessage) && (
          <div className={`xl:col-span-2 rounded-2xl border px-4 py-3 text-body-sm font-semibold ${
            raportError ? 'border-error/20 bg-error/10 text-error' : 'border-primary/20 bg-primary/10 text-primary'
          }`}>
            {raportError || reviewMessage}
          </div>
        )}
        <motion.div variants={itemVariants} className="min-w-0 rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          <div className="border-b border-outline-variant/10 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-title-md font-black text-on-surface">Antrean bukti</h2>
                <p className="text-label-sm text-on-surface-variant">
                  {filteredEvidence.length > 0
                    ? `Menampilkan ${pageStartIndex + 1}-${Math.min(pageStartIndex + visibleEvidence.length, filteredEvidence.length)} dari ${filteredEvidence.length} item sesuai filter.`
                    : 'Tidak ada item sesuai filter.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatus(item.value)}
                    className={`h-9 rounded-lg px-3 text-label-sm font-bold transition ${
                      status === item.value ? 'bg-primary text-on-primary' : 'bg-surface-high text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_190px_190px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari karyawan, cabang, jobdesk"
                  className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-9 text-label-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <select value={branch} onChange={(event) => setBranch(event.target.value)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none focus:border-primary/50">
                <option value="all">Semua cabang</option>
                {branches.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={division} onChange={(event) => setDivision(event.target.value)} className="h-10 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none focus:border-primary/50">
                <option value="all">Semua divisi</option>
                {divisions.map((item) => <option key={item.id} value={item.id}>{item.posisi}</option>)}
              </select>
            </div>
          </div>

          <div className="max-h-[680px] overflow-y-auto">
            {visibleEvidence.map((item) => {
              const StatusIcon = statusMeta[item.reviewStatus].icon;
              const EvidenceIcon = evidenceIcon(item);
              const isSelected = selectedEvidence?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`grid w-full gap-3 border-b border-outline-variant/10 p-4 text-left transition hover:bg-surface-high/35 lg:grid-cols-[minmax(0,1fr)_150px_120px] ${
                    isSelected ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-body-sm font-black text-on-surface">{item.employeeName}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black ${statusMeta[item.reviewStatus].className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusMeta[item.reviewStatus].label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-label-xs text-on-surface-variant">
                      <Building2 className="h-3.5 w-3.5" />
                      {item.cabang}
                      <span>|</span>
                      {item.divisiName}
                    </div>
                    <p className="mt-2 text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Jobdesk {item.jobdeskIndex + 1}</p>
                    <p className="mt-1 line-clamp-2 text-body-sm font-semibold text-on-surface">{item.jobdeskText}</p>
                  </div>
                  <div className="flex items-center gap-2 text-label-xs font-bold text-on-surface-variant lg:justify-end">
                    <EvidenceIcon className="h-4 w-4" />
                    {item.mode === 'none' ? 'Tanpa bukti' : item.mode === 'video' ? 'Video' : `${item.evidenceUrls?.length || 1} gambar`}
                  </div>
                  <div className="flex items-center gap-2 text-label-xs font-bold text-on-surface-variant lg:justify-end">
                    <TimerReset className="h-4 w-4" />
                    {formatTime(item.submittedAt)}
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              );
            })}

            {filteredEvidence.length > REVIEW_PAGE_SIZE && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                className="border-b border-outline-variant/10"
              />
            )}

            {filteredEvidence.length === 0 && (
              <div className="py-16 text-center">
                <FileCheck2 className="mx-auto h-8 w-8 text-on-surface-variant" />
                <p className="mt-3 text-body-sm font-bold text-on-surface">Tidak ada bukti sesuai filter.</p>
                <p className="mt-1 text-label-sm text-on-surface-variant">Coba pilih status atau cabang lain.</p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.aside variants={itemVariants} className="xl:sticky xl:top-24">
          <div className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
            {selectedEvidence ? (
              <>
                <div className="border-b border-outline-variant/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Panel penilaian</p>
                      <h2 className="mt-1 truncate text-title-md font-black text-on-surface">{selectedEvidence.employeeName}</h2>
                      <p className="mt-1 text-label-sm text-on-surface-variant">{selectedEvidence.cabang} | {selectedEvidence.divisiName}</p>
                    </div>
                    {SelectedStatusIcon && selectedStatus && (
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-label-xs font-bold ${selectedStatus.className}`}>
                        <SelectedStatusIcon className="h-3.5 w-3.5" />
                        {selectedStatus.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="rounded-lg bg-surface-high/45 p-3">
                    <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Jobdesk #{selectedEvidence.jobdeskIndex + 1}</p>
                    <p className="mt-2 text-body-sm font-bold text-on-surface">{selectedEvidence.jobdeskText}</p>
                    {selectedEvidence.employeeNote && <p className="mt-2 text-label-sm text-on-surface-variant">{selectedEvidence.employeeNote}</p>}
                  </div>

                  <div className="overflow-hidden rounded-lg border border-outline-variant/15 bg-surface-high/35">
                    {selectedEvidence.mode === 'image' && getEvidenceUrls(selectedEvidence).length > 0 ? (
                      <div className="grid gap-2 p-2">
                        {getEvidenceUrls(selectedEvidence).map((url, index, urls) => (
                          <button
                            key={`${url}-${index}`}
                            type="button"
                            onClick={() => setPreview({
                              images: urls.map((src, imageIndex) => ({
                                src,
                                alt: `${selectedEvidence.jobdeskText} ${imageIndex + 1}`,
                                caption: `Gambar ${imageIndex + 1} dari ${selectedEvidence.employeeName}`,
                              })),
                              initialIndex: index,
                              title: `Bukti ${selectedEvidence.employeeName}`,
                              subtitle: selectedEvidence.jobdeskText,
                            })}
                            className="block rounded-md border border-outline-variant/10 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                          >
                            <img src={url} alt={`${selectedEvidence.jobdeskText} ${index + 1}`} loading="lazy" decoding="async" className="max-h-72 w-full object-contain" />
                          </button>
                        ))}
                      </div>
                    ) : selectedEvidence.mode === 'video' && getEvidenceUrls(selectedEvidence)[0] ? (
                      <div className="p-2">
                        <video src={getEvidenceUrls(selectedEvidence)[0]} className="max-h-72 w-full rounded-md bg-surface object-contain" controls />
                      </div>
                    ) : (
                      <div className="grid h-56 place-items-center px-6 text-center">
                        <div>
                          {selectedEvidence.mode === 'video' ? <Video className="mx-auto h-8 w-8 text-primary" /> : <Ban className="mx-auto h-8 w-8 text-on-surface-variant" />}
                          <p className="mt-3 text-body-sm font-bold text-on-surface">
                            {selectedEvidence.mode === 'video' ? 'Bukti video' : 'Tidak ada bukti terlampir'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="pic-score" className="text-label-sm font-bold text-on-surface-variant">Nilai</label>
                      <div className="flex gap-1">
                        {scorePresets.map((value) => (
                          <button key={value} type="button" onClick={() => setScore(String(value))} className="h-7 rounded-md bg-surface-high px-2 text-[11px] font-black text-on-surface-variant hover:text-primary">
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      id="pic-score"
                      type="number"
                      min={0}
                      max={100}
                      value={score}
                      onChange={(event) => setScore(event.target.value)}
                      placeholder="Pilih atau isi nilai"
                      className="h-11 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-4 text-body-md font-bold text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    />
                    <p className="mt-1 text-label-xs font-semibold text-on-surface-variant">
                      Nilai tidak diisi otomatis. PIC wajib memilih preset atau input manual sebelum simpan.
                    </p>
                  </div>

                  <label className="block space-y-1.5">
                    <span className="text-label-sm font-bold text-on-surface-variant">Komentar PIC</span>
                    <textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      rows={4}
                      placeholder="Opsional: catatan nilai atau alasan penolakan"
                      className="w-full resize-none rounded-lg border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    />
                  </label>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => submitReview('rejected')} disabled={reviewBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-error/25 bg-error/10 px-4 text-label-sm font-bold text-error transition hover:bg-error hover:text-on-error disabled:cursor-not-allowed disabled:opacity-50">
                      <Ban className="h-4 w-4" />
                      {reviewBusy ? 'Menyimpan...' : 'Tolak'}
                    </button>
                    <button type="button" onClick={() => submitReview('approved')} disabled={reviewBusy} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                      <Send className="h-4 w-4" />
                      {reviewBusy ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/15 bg-surface-high/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-label-sm font-bold text-on-surface-variant">
                      <Star className="h-4 w-4 text-secondary" />
                      Nilai saat ini
                    </div>
                    <span className="text-label-sm font-black text-on-surface">{typeof selectedEvidence.score === 'number' ? `${selectedEvidence.score}/100` : '-'}</span>
                  </div>

                  {selectedEvidence.reviewerComment && (
                    <div className="rounded-lg border border-outline-variant/15 bg-surface-high/35 p-3 text-body-sm text-on-surface-variant">
                      <div className="mb-1 flex items-center gap-2 font-bold text-on-surface">
                        <MessageSquareText className="h-4 w-4 text-primary" />
                        Komentar terakhir
                      </div>
                      {selectedEvidence.reviewerComment}
                    </div>
                  )}

                  <Link to={`/dashboard/pic-raport/karyawan/${selectedEvidence.employeeId}`} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2.5 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary">
                    <Eye className="h-4 w-4" />
                    Detail karyawan
                  </Link>
                </div>
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center p-6 text-center">
                <div>
                  <FileCheck2 className="mx-auto h-8 w-8 text-on-surface-variant" />
                  <p className="mt-3 text-body-sm font-bold text-on-surface">Belum ada bukti hari ini.</p>
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      </section>
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

export default PicRaportDashboardPage;
