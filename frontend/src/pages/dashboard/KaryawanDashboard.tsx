import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Ban,
  BookOpen,
  Building2,
  CalendarOff,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  ShieldCheck,
  Star,
  Target,
  UserRound,
  Clock3,
} from 'lucide-react';
import { sortEvidenceByJobdeskNumber, todayKey } from '../../data/picRaportData';
import { useAuthStore } from '../../store/authStore';
import { formatProspekDateKey, useKaryawanProspekStore } from '../../store/karyawanProspekStore';
import { usePicRaportStore } from '../../store/picRaportStore';
import { useOffRequestStore } from '../../store/offRequestStore';
import { calculateJobdeskScoreFine, calculateProspekDailyFine, formatRupiah } from '../../utils/denda';
import { isSalesTargetKategori } from '../../utils/roles';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const getPositionMatch = (divisi: string, positions: ReturnType<typeof usePicRaportStore.getState>['divisions']) => {
  const normalized = divisi.toLowerCase().trim();
  return (
    positions.find((p) => p.id === normalized) ||
    positions.find((p) => p.posisi.toLowerCase() === normalized) ||
    positions.find((p) => normalized.includes(p.id) || normalized.includes(p.posisi.toLowerCase())) ||
    positions[0]
  );
};

const getUserCabang = (user: ReturnType<typeof useAuthStore.getState>['user']) =>
  user?.cabangName || user?.cabang_name || user?.cabangId || user?.cabang_id || '';

const getMonthStartKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

const formatShortDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const KaryawanDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const divisions = usePicRaportStore((state) => state.divisions);
  const evidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const fetchDivisions = usePicRaportStore((state) => state.fetchDivisions);
  const prospek = useKaryawanProspekStore((state) => state.prospek);
  const fetchProspek = useKaryawanProspekStore((state) => state.fetchProspek);
  const offRequests = useOffRequestStore((state) => state.requests);
  const fetchOffRequests = useOffRequestStore((state) => state.fetchRequests);
  const createOffRequest = useOffRequestStore((state) => state.createRequest);
  const offError = useOffRequestStore((state) => state.error);
  const divisi = user?.divisi || 'Belum ditentukan';
  const cabang = getUserCabang(user);
  const position = getPositionMatch(divisi, divisions);
  const userName = user?.name?.trim().toLowerCase();
  const currentDate = useMemo(() => new Date(), []);
  const todayProspekKey = useMemo(() => formatProspekDateKey(currentDate), [currentDate]);
  const monthStartKey = useMemo(() => getMonthStartKey(currentDate), [currentDate]);
  const elapsedMonthDays = currentDate.getDate();
  const [offReason, setOffReason] = useState('');
  const [offSubmitting, setOffSubmitting] = useState(false);
  const [offMessage, setOffMessage] = useState('');

  useEffect(() => {
    fetchProspek({ dateFrom: monthStartKey, dateTo: todayProspekKey, limit: 500 });
    fetchEvidence({ tanggal: todayKey, limit: 2000 });
    fetchDivisions();
    fetchOffRequests({ tanggalFrom: monthStartKey, tanggalTo: todayProspekKey, limit: 200 });
  }, [fetchDivisions, fetchEvidence, fetchOffRequests, fetchProspek, monthStartKey, todayProspekKey]);

  const todayEvidence = useMemo(
    () =>
      evidence.filter(
        (item) =>
          item.tanggal === todayKey &&
          (item.employeeId === user?.id || (userName && item.employeeName.toLowerCase() === userName))
      ),
    [evidence, user?.id, userName]
  );

  const todayStats = useMemo(() => {
    const scored = todayEvidence.filter((item) => typeof item.score === 'number' || item.reviewStatus === 'rejected');
    const approved = todayEvidence.filter((item) => item.reviewStatus === 'approved').length;
    const pending = todayEvidence.filter((item) => item.reviewStatus === 'pending').length;
    const rejected = todayEvidence.filter((item) => item.reviewStatus === 'rejected').length;
    const avg = scored.length
      ? Math.round(scored.reduce((sum, item) => sum + (item.reviewStatus === 'rejected' ? 0 : item.score || 0), 0) / scored.length)
      : 0;
    const submittedCount = new Set(todayEvidence.map((item) => item.jobdeskIndex)).size;
    const ratedCount = new Set(scored.map((item) => item.jobdeskIndex)).size;
    return { scored, approved, pending, rejected, averageScore: avg, submittedJobdeskCount: submittedCount, ratedJobdeskCount: ratedCount };
  }, [todayEvidence]);
  const { scored: scoredToday, approved: approvedToday, pending: pendingToday, rejected: rejectedToday, averageScore, submittedJobdeskCount, ratedJobdeskCount } = todayStats;
  const dendaJobdeskHariIni = useMemo(() => calculateJobdeskScoreFine(averageScore, scoredToday.length > 0), [averageScore, scoredToday.length]);
  const jobdeskCount = submittedJobdeskCount;
  const raportProgress = jobdeskCount > 0 ? Math.round((ratedJobdeskCount / jobdeskCount) * 100) : 0;
  const isSales = isSalesTargetKategori(user?.jabatan, divisi);
  const prospekHariIni = useMemo(
    () =>
      prospek.filter(
        (item) =>
          item.tanggal === todayProspekKey &&
          (item.karyawanId === user?.id || (userName && item.karyawanName.toLowerCase() === userName))
      ).length,
    [prospek, todayProspekKey, user?.id, userName]
  );
  const targetProspek = isSales ? 20 : 5;
  const employeeOffRequests = useMemo(
    () => offRequests.filter((request) => request.karyawanId === user?.id),
    [offRequests, user?.id]
  );
  const todayOffRequest = useMemo(
    () =>
      employeeOffRequests
        .filter((request) => request.tanggal === todayProspekKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
    [employeeOffRequests, todayProspekKey]
  );
  const approvedOffDates = useMemo(
    () => new Set(employeeOffRequests.filter((request) => request.status === 'approved').map((request) => request.tanggal)),
    [employeeOffRequests]
  );
  const isOffApprovedToday = todayOffRequest?.status === 'approved';
  const handleSubmitOffRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    const reason = offReason.trim();
    if (!reason || offSubmitting || todayOffRequest?.status === 'pending' || todayOffRequest?.status === 'approved') return;

    setOffSubmitting(true);
    setOffMessage('');
    try {
      await createOffRequest({ tanggal: todayProspekKey, alasan: reason });
      setOffReason('');
      setOffMessage('Pengajuan OFF hari ini sudah dikirim ke PIC.');
      await fetchOffRequests({ tanggalFrom: monthStartKey, tanggalTo: todayProspekKey, limit: 200 });
    } catch (error) {
      setOffMessage(error instanceof Error ? error.message : 'Pengajuan OFF gagal dikirim.');
    } finally {
      setOffSubmitting(false);
    }
  };

  const prospekBulanIni = useMemo(
    () =>
      prospek.filter(
        (item) =>
          item.tanggal >= monthStartKey &&
          item.tanggal <= todayProspekKey &&
          (item.karyawanId === user?.id || (userName && item.karyawanName.toLowerCase() === userName))
      ),
    [monthStartKey, prospek, todayProspekKey, user?.id, userName]
  );
  const prospekProgress = isOffApprovedToday ? 100 : Math.min(Math.round((prospekHariIni / targetProspek) * 100), 100);
  const targetGap = isOffApprovedToday ? 0 : Math.max(targetProspek - prospekHariIni, 0);
  const effectiveTargetDays = useMemo(() => Array.from({ length: elapsedMonthDays }, (_, index) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
    return formatProspekDateKey(date);
  }).filter((tanggal) => !approvedOffDates.has(tanggal)).length, [approvedOffDates, currentDate, elapsedMonthDays]);
  const targetProspekBulanan = targetProspek * effectiveTargetDays;
  const prospekBulananProgress = targetProspekBulanan > 0 ? Math.min(Math.round((prospekBulanIni.length / targetProspekBulanan) * 100), 100) : 0;
  const targetBulananGap = Math.max(targetProspekBulanan - prospekBulanIni.length, 0);
  const prospekDailyRows = useMemo(() => {
    const rows = Array.from({ length: elapsedMonthDays }, (_, index) => {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), index + 1);
      const tanggal = formatProspekDateKey(date);
      const total = prospekBulanIni.filter((item) => item.tanggal === tanggal).length;
      const isOffDay = approvedOffDates.has(tanggal);
      const gap = isOffDay ? 0 : Math.max(targetProspek - total, 0);
      const percent = isOffDay ? 100 : targetProspek > 0 ? Math.min(Math.round((total / targetProspek) * 100), 100) : 0;
      const fine = isOffDay ? 0 : calculateProspekDailyFine(total, targetProspek);
      return { tanggal, total, gap, percent, fine, isOffDay };
    });
    return rows.reverse();
  }, [approvedOffDates, currentDate, elapsedMonthDays, prospekBulanIni, targetProspek]);
  const dendaProspekBulanIni = useMemo(() => prospekDailyRows.reduce((sum, row) => sum + row.fine, 0), [prospekDailyRows]);
  const hariDendaProspek = useMemo(() => prospekDailyRows.filter((row) => row.fine > 0).length, [prospekDailyRows]);
  const effectiveDendaJobdeskHariIni = isOffApprovedToday ? 0 : dendaJobdeskHariIni;
  const totalEstimasiDenda = dendaProspekBulanIni + effectiveDendaJobdeskHariIni;
  const dateLabel = useMemo(() => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), []);
  const initials = useMemo(() => (user?.name || 'Karyawan')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase(), [user?.name]);
  const latestComment = useMemo(
    () =>
      todayEvidence
        .filter((item) => item.reviewerComment)
        .sort((a, b) => (b.reviewedAt || b.submittedAt).localeCompare(a.reviewedAt || a.submittedAt))[0],
    [todayEvidence]
  );
  const jobdeskOverviewRows = useMemo(() => sortEvidenceByJobdeskNumber(todayEvidence), [todayEvidence]);
  const jobdeskCompletionLabel = useMemo(() => todayEvidence.length > 0
    ? `${ratedJobdeskCount} dari ${jobdeskCount} laporan backend sudah dinilai`
    : 'Belum ada laporan jobdesk dari backend hari ini', [todayEvidence.length, ratedJobdeskCount, jobdeskCount]);

  const userDetails = useMemo(() => [
    { label: 'Email', value: user?.email || '-', icon: Mail },
    { label: 'WhatsApp', value: user?.whatsapp || '-', icon: Phone },
    { label: 'Target Prospek', value: isSales ? 'Sales' : 'Non-Sales', icon: UserRound },
    { label: 'Cabang', value: cabang || 'Belum tercatat', icon: Building2 },
  ], [user?.email, user?.whatsapp, isSales, cabang]);

  const stats = useMemo(() => [
    {
      label: 'Nilai PIC Hari Ini',
      value: averageScore ? `${averageScore}/100` : '-',
      helper: scoredToday.length ? `${scoredToday.length} jobdesk sudah dinilai` : 'Menunggu penilaian PIC',
      icon: Star,
      tone: averageScore >= 80 ? 'text-secondary' : averageScore > 0 ? 'text-yellow-500' : 'text-on-surface-variant',
      bg: averageScore >= 80 ? 'bg-secondary/10' : averageScore > 0 ? 'bg-yellow-500/10' : 'bg-surface-high',
      progress: averageScore,
    },
    {
      label: 'Jobdesk Dinilai',
      value: isOffApprovedToday ? 'OFF' : `${ratedJobdeskCount}/${jobdeskCount}`,
      helper: isOffApprovedToday ? 'OFF disetujui PIC, laporan jobdesk tidak wajib' : jobdeskCompletionLabel,
      icon: ClipboardList,
      tone: 'text-primary',
      bg: 'bg-primary/10',
      progress: raportProgress,
    },
    {
      label: 'Bukti Hari Ini',
      value: `${todayEvidence.length}`,
      helper: `${approvedToday} disetujui, ${pendingToday} menunggu, ${rejectedToday} ditolak`,
      icon: FileCheck2,
      tone: rejectedToday > 0 ? 'text-error' : 'text-secondary',
      bg: rejectedToday > 0 ? 'bg-error/10' : 'bg-secondary/10',
      progress: jobdeskCount ? Math.min(Math.round((todayEvidence.length / jobdeskCount) * 100), 100) : 0,
    },
    {
      label: 'Prospek Hari Ini',
      value: isOffApprovedToday ? 'OFF' : `${prospekHariIni}/${targetProspek}`,
      helper: isOffApprovedToday ? 'OFF disetujui PIC, prospek tidak wajib' : targetGap > 0 ? `${targetGap} prospek lagi` : 'Target prospek tercapai',
      icon: Send,
      tone: 'text-primary',
      bg: 'bg-primary/10',
      progress: prospekProgress,
    },
    {
      label: 'Prospek Bulan Ini',
      value: `${prospekBulanIni.length}/${targetProspekBulanan}`,
      helper: targetBulananGap > 0 ? `${targetBulananGap} prospek tertinggal` : 'Target berjalan tercapai',
      icon: CalendarDays,
      tone: prospekBulananProgress >= 100 ? 'text-secondary' : 'text-primary',
      bg: prospekBulananProgress >= 100 ? 'bg-secondary/10' : 'bg-primary/10',
      progress: prospekBulananProgress,
    },
    {
      label: 'Estimasi Denda',
      value: formatRupiah(totalEstimasiDenda),
      helper: `${formatRupiah(dendaProspekBulanIni)} prospek, ${formatRupiah(effectiveDendaJobdeskHariIni)} jobdesk`,
      icon: BadgeDollarSign,
      tone: totalEstimasiDenda > 0 ? 'text-error' : 'text-secondary',
      bg: totalEstimasiDenda > 0 ? 'bg-error/10' : 'bg-secondary/10',
      progress: totalEstimasiDenda > 0 ? 100 : 0,
    },
  ], [averageScore, scoredToday.length, isOffApprovedToday, ratedJobdeskCount, jobdeskCount, jobdeskCompletionLabel, raportProgress, todayEvidence.length, approvedToday, pendingToday, rejectedToday, prospekHariIni, targetProspek, targetGap, prospekProgress, prospekBulanIni.length, targetProspekBulanan, targetBulananGap, prospekBulananProgress, totalEstimasiDenda, dendaProspekBulanIni, effectiveDendaJobdeskHariIni]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="overflow-hidden rounded-[1.75rem] border border-outline-variant/20 bg-surface shadow-sm">
        <div className="border-b border-outline-variant/10 bg-surface-high/35 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ringkasan pengguna
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-label-sm font-bold text-on-surface-variant">
              <CalendarDays className="h-4 w-4 text-primary" />
              {dateLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_22rem] lg:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-title-lg font-black text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-headline-md font-black text-on-surface">{user?.name || 'Karyawan'}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-label-sm font-semibold text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-high/70 px-3 py-1.5">
                  <UserRound className="h-4 w-4 text-primary" />
                  {user?.role || 'karyawan'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-high/70 px-3 py-1.5">
                  <BookOpen className="h-4 w-4 text-secondary" />
                  {position?.posisi || divisi}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 ${user?.is_verified ? 'bg-secondary/10 text-secondary' : 'bg-yellow-500/10 text-yellow-500'}`}>
                  <BadgeCheck className="h-4 w-4" />
                  {user?.is_verified ? 'Terverifikasi' : 'Belum verifikasi'}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-body-sm text-on-surface-variant">
                Dashboard ini menampilkan data akun, divisi kerja, status raport harian, nilai PIC, dan target aktivitas yang perlu ditutup hari ini.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-outline-variant/20 bg-surface-high/45 p-4">
            <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Status hari ini</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-title-lg font-black text-on-surface">{raportProgress}%</p>
                <p className="text-label-sm text-on-surface-variant">jobdesk sudah dinilai PIC</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Target className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-primary" style={{ width: `${raportProgress}%` }} />
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={itemVariants} className="rounded-2xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
                  <p className={`mt-2 text-headline-sm font-black ${stat.tone}`}>{stat.value}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${stat.bg} ${stat.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-high">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stat.progress}%` }} />
              </div>
              <p className="mt-3 text-body-sm font-medium text-on-surface-variant">{stat.helper}</p>
            </motion.div>
          );
        })}
      </section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-title-md font-black text-on-surface">Overview jobdesk hari ini</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Data diambil dari laporan backend hari ini, termasuk bukti, status review PIC, nilai, dan komentar.
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-label-sm font-black ${dendaJobdeskHariIni > 0 ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
            <BadgeDollarSign className="h-4 w-4" />
            Denda jobdesk: {formatRupiah(dendaJobdeskHariIni)}
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Laporan masuk', value: todayEvidence.length, helper: `${jobdeskCount} nomor jobdesk unik`, icon: ClipboardList, tone: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Disetujui', value: approvedToday, helper: 'Sudah valid menurut PIC', icon: CheckCircle2, tone: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Menunggu', value: pendingToday, helper: 'Belum mendapat nilai', icon: Clock3, tone: 'text-yellow-600', bg: 'bg-yellow-500/10' },
            { label: 'Ditolak', value: rejectedToday, helper: 'Butuh perbaikan bukti', icon: Ban, tone: rejectedToday > 0 ? 'text-error' : 'text-on-surface-variant', bg: rejectedToday > 0 ? 'bg-error/10' : 'bg-surface-high' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-outline-variant/15 bg-surface-high/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</p>
                    <p className={`mt-2 text-title-md font-black ${item.tone}`}>{item.value}</p>
                  </div>
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${item.bg} ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-2 text-label-sm text-on-surface-variant">{item.helper}</p>
              </div>
            );
          })}
        </div>

        {jobdeskOverviewRows.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/15">
            <table className="w-full min-w-[860px] border-separate border-spacing-0">
              <thead className="bg-surface-high">
                <tr>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Jobdesk</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Bukti</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Nilai</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Komentar PIC</th>
                </tr>
              </thead>
              <tbody>
                {jobdeskOverviewRows.map((item, index) => {
                  const rejected = item.reviewStatus === 'rejected';
                  const pending = item.reviewStatus === 'pending';
                  const approved = item.reviewStatus === 'approved';
                  const statusClass = rejected
                    ? 'bg-error/10 text-error'
                    : pending
                      ? 'bg-yellow-500/10 text-yellow-600'
                      : 'bg-secondary/10 text-secondary';
                  const StatusIcon = rejected ? AlertTriangle : pending ? Clock3 : CheckCircle2;
                  const evidenceLabel = item.mode === 'none'
                    ? 'Tidak ada bukti'
                    : item.mode === 'video'
                      ? 'Video'
                      : `${item.evidenceUrls?.length || (item.evidenceUrl ? 1 : 0)} gambar`;

                  return (
                    <tr key={item.id} className={`transition hover:bg-primary/5 ${index % 2 === 0 ? 'bg-surface/80' : 'bg-surface-high/20'}`}>
                      <td className="border-b border-outline-variant/5 px-4 py-3">
                        <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Jobdesk {item.jobdeskIndex + 1}</p>
                        <p className="mt-1 max-w-md text-body-sm font-bold text-on-surface">{item.jobdeskText}</p>
                        {item.employeeNote && <p className="mt-1 line-clamp-1 text-label-sm text-on-surface-variant">{item.employeeNote}</p>}
                      </td>
                      <td className="border-b border-outline-variant/5 px-4 py-3 text-body-sm font-semibold text-on-surface">{evidenceLabel}</td>
                      <td className={`border-b border-outline-variant/5 px-4 py-3 text-right text-body-sm font-black ${rejected ? 'text-error' : approved ? 'text-secondary' : 'text-on-surface-variant'}`}>
                        {rejected ? '0/100' : typeof item.score === 'number' ? `${item.score}/100` : '-'}
                      </td>
                      <td className="border-b border-outline-variant/5 px-4 py-3 text-right">
                        <span className={`inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-label-xs font-black ${statusClass}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {rejected ? 'Ditolak' : pending ? 'Menunggu' : 'Disetujui'}
                        </span>
                      </td>
                      <td className="border-b border-outline-variant/5 px-4 py-3 text-body-sm text-on-surface-variant">
                        {item.reviewerComment || (pending ? 'Menunggu review PIC.' : 'Tidak ada komentar tambahan.')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-high/20 py-10 text-center">
            <p className="text-body-sm font-bold text-on-surface">Belum ada laporan jobdesk dari backend hari ini.</p>
            <p className="mt-1 text-label-sm text-on-surface-variant">Upload raport harian agar overview jobdesk, nilai, dan komentar PIC tampil di sini.</p>
            <Link to="/dashboard/karyawan/raport" className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-label-sm font-bold text-on-primary transition hover:bg-primary/90">
              Buka raport harian
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </motion.section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.div variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-title-md font-black text-on-surface">Data pengguna</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">Informasi akun dan penempatan kerja yang aktif.</p>
            </div>
            <UserRound className="h-5 w-5 text-primary" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {userDetails.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl bg-surface-high/45 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-on-surface-variant">
                    <Icon className="h-4 w-4" />
                    <p className="text-label-xs font-bold uppercase tracking-widest">{item.label}</p>
                  </div>
                  <p className="truncate text-body-sm font-bold text-on-surface">{item.value}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-title-md font-black text-on-surface">Catatan PIC terakhir</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">Komentar terbaru dari penilaian jobdesk hari ini.</p>
            </div>
            <MessageSquareText className="h-5 w-5 text-secondary" />
          </div>
          {latestComment ? (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/35 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-body-sm font-bold text-on-surface">{latestComment.jobdeskText}</span>
                <span className={`rounded-lg px-2.5 py-1 text-label-xs font-black ${latestComment.reviewStatus === 'rejected' ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
                  {latestComment.reviewStatus === 'rejected' ? '0/100' : `${latestComment.score ?? '- '}/100`}
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant">{latestComment.reviewerComment}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-high/20 py-8 text-center">
              <p className="text-body-sm font-bold text-on-surface">Belum ada komentar PIC hari ini.</p>
              <p className="mt-1 text-label-xs text-on-surface-variant">Komentar akan tampil setelah bukti jobdesk direview.</p>
            </div>
          )}
        </motion.div>
      </section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_24rem]">
          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-title-md font-black text-on-surface">Status OFF hari ini</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Pengajuan OFF tersambung ke backend dan ikut memengaruhi status denda prospek saat sudah disetujui.
                </p>
              </div>
              <CalendarOff className="h-5 w-5 text-primary" />
            </div>

            {todayOffRequest ? (
              <div className={`rounded-2xl border px-4 py-3 ${
                todayOffRequest.status === 'approved'
                  ? 'border-secondary/20 bg-secondary/10 text-secondary'
                  : todayOffRequest.status === 'rejected'
                    ? 'border-error/20 bg-error/10 text-error'
                    : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-600'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-sm font-black">
                    {todayOffRequest.status === 'approved'
                      ? 'OFF disetujui'
                      : todayOffRequest.status === 'rejected'
                        ? 'OFF ditolak'
                        : 'OFF menunggu review'}
                  </p>
                  <span className="rounded-lg bg-surface/80 px-2.5 py-1 text-label-xs font-black text-on-surface-variant">
                    {formatShortDate(todayOffRequest.tanggal)}
                  </span>
                </div>
                <p className="mt-2 text-body-sm">{todayOffRequest.alasan}</p>
                {todayOffRequest.reviewerComment && (
                  <p className="mt-2 rounded-lg bg-surface/70 px-3 py-2 text-label-sm text-on-surface-variant">{todayOffRequest.reviewerComment}</p>
                )}
                {isOffApprovedToday && <p className="mt-2 text-label-sm font-bold">Denda prospek hari ini tidak dihitung karena OFF sudah disetujui.</p>}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/20 bg-surface-high/20 px-4 py-5">
                <p className="text-body-sm font-bold text-on-surface">Belum ada pengajuan OFF hari ini.</p>
                <p className="mt-1 text-label-sm text-on-surface-variant">Ajukan hanya saat benar-benar tidak bisa menjalankan target harian.</p>
              </div>
            )}

            {(offMessage || offError) && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-label-sm font-bold ${offError ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                {offMessage || offError}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmitOffRequest} className="rounded-2xl border border-outline-variant/15 bg-surface-high/35 p-4">
            <label className="block">
              <span className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Alasan OFF</span>
              <textarea
                value={offReason}
                onChange={(event) => setOffReason(event.target.value)}
                rows={4}
                disabled={todayOffRequest?.status === 'pending' || todayOffRequest?.status === 'approved'}
                placeholder="Contoh: sakit, izin keluarga, atau jadwal luar toko."
                className="mt-2 w-full resize-none rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-body-sm text-on-surface outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={offSubmitting || !offReason.trim() || todayOffRequest?.status === 'pending' || todayOffRequest?.status === 'approved'}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-label-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarOff className="h-4 w-4" />
              {offSubmitting ? 'Mengirim...' : todayOffRequest?.status === 'pending' ? 'Menunggu PIC' : todayOffRequest?.status === 'approved' ? 'OFF disetujui' : 'Ajukan OFF hari ini'}
            </button>
          </form>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-title-md font-black text-on-surface">Target prospek bulan ini</h2>
            <p className="text-body-sm text-on-surface-variant">
              Periode {formatShortDate(monthStartKey)} sampai {formatShortDate(todayProspekKey)}, target berjalan {targetProspek} prospek per hari.
            </p>
          </div>
          <span className={`rounded-lg px-3 py-2 text-label-sm font-black ${targetBulananGap === 0 ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
            {prospekBulananProgress}% tercapai
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-high/45 p-4">
            <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Bulan berjalan</p>
            <p className="mt-2 text-headline-sm font-black text-on-surface">
              {prospekBulanIni.length}/{targetProspekBulanan}
            </p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-primary" style={{ width: `${prospekBulananProgress}%` }} />
            </div>
            <p className="mt-3 text-body-sm font-medium text-on-surface-variant">
              {targetBulananGap > 0 ? `Masih kurang ${targetBulananGap} prospek untuk mengejar target berjalan.` : 'Target berjalan sudah aman.'}
            </p>
            <div className={`mt-4 rounded-xl px-3 py-2 ${dendaProspekBulanIni > 0 ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
              <p className="text-label-xs font-bold uppercase tracking-widest">Denda prospek</p>
              <p className="mt-1 text-title-sm font-black">{formatRupiah(dendaProspekBulanIni)}</p>
              <p className="mt-1 text-label-xs text-on-surface-variant">{hariDendaProspek} hari gagal target bulan ini</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-outline-variant/15">
            <table className="w-full min-w-[760px] border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-surface-high">
                <tr>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Tanggal</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-left text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Progress</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Realisasi</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Target</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Selisih</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Denda</th>
                  <th className="border-b border-outline-variant/10 px-4 py-3 text-right text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody>
                {prospekDailyRows.map((row, index) => {
                  const achieved = row.gap === 0;
                  const isToday = row.tanggal === todayProspekKey;
                  const statusClass = row.isOffDay
                    ? 'bg-primary/10 text-primary'
                    : achieved
                      ? 'bg-secondary/10 text-secondary'
                      : row.total > 0
                        ? 'bg-yellow-500/10 text-yellow-600'
                        : 'bg-error/10 text-error';
                  const statusLabel = row.isOffDay ? 'OFF disetujui' : achieved ? 'Tercapai' : row.total > 0 ? 'Belum target' : 'Kosong';
                  const deltaLabel = row.isOffDay ? 'OFF' : achieved ? `+${Math.max(row.total - targetProspek, 0)}` : `-${row.gap}`;

                  return (
                    <tr key={row.tanggal} className={`group transition hover:bg-primary/5 ${index % 2 === 0 ? 'bg-surface/80' : 'bg-surface-high/20'}`}>
                      <td className="border-b border-outline-variant/5 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`grid h-9 w-9 place-items-center rounded-lg text-label-xs font-black ${isToday ? 'bg-primary text-on-primary' : 'bg-surface-high text-on-surface'}`}>
                            {new Date(`${row.tanggal}T12:00:00`).getDate()}
                          </span>
                          <div>
                            <p className="text-body-sm font-black text-on-surface">{formatShortDate(row.tanggal)}</p>
                            <p className="text-label-xs text-on-surface-variant">{isToday ? 'Hari ini' : 'Riwayat harian'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-outline-variant/5 px-4 py-3">
                        <div className="flex min-w-[180px] items-center gap-3">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                            <div className={`h-full rounded-full ${achieved ? 'bg-secondary' : row.total > 0 ? 'bg-yellow-500' : 'bg-error'}`} style={{ width: `${row.percent}%` }} />
                          </div>
                          <span className="w-11 text-right text-label-sm font-black text-on-surface">{row.percent}%</span>
                        </div>
                      </td>
                      <td className="border-b border-outline-variant/5 px-4 py-3 text-right text-body-sm font-black text-on-surface">{row.total}</td>
                      <td className="border-b border-outline-variant/5 px-4 py-3 text-right text-body-sm text-on-surface-variant">{targetProspek}</td>
                      <td className={`border-b border-outline-variant/5 px-4 py-3 text-right text-body-sm font-black ${achieved ? 'text-secondary' : 'text-error'}`}>{deltaLabel}</td>
                      <td className={`border-b border-outline-variant/5 px-4 py-3 text-right text-body-sm font-black ${row.fine > 0 ? 'text-error' : 'text-secondary'}`}>{formatRupiah(row.fine)}</td>
                      <td className="border-b border-outline-variant/5 px-4 py-3 text-right">
                        <span className={`inline-flex min-w-[6.75rem] items-center justify-center rounded-lg px-2.5 py-1 text-label-xs font-black ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-title-md font-black text-on-surface">Aksi harian</h2>
            <p className="text-body-sm text-on-surface-variant">Akses cepat untuk aktivitas yang paling sering dipakai.</p>
          </div>
          <CheckCircle2 className="h-5 w-5 text-secondary" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/dashboard/karyawan/prospek" className="group rounded-2xl border border-outline-variant/20 bg-surface-high/45 p-4 transition hover:border-primary/30 hover:bg-primary/5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-primary/10 p-2 text-primary"><Send className="h-4 w-4" /></span>
              <div>
                <p className="font-bold text-on-surface">Submit Prospek</p>
                <p className="text-label-sm text-on-surface-variant">Tambah prospek baru hari ini.</p>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-label-sm font-bold text-primary">
              Buka form <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
          <Link to="/dashboard/karyawan/raport" className="group rounded-2xl border border-outline-variant/20 bg-surface-high/45 p-4 transition hover:border-secondary/30 hover:bg-secondary/5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-secondary/10 p-2 text-secondary"><BookOpen className="h-4 w-4" /></span>
              <div>
                <p className="font-bold text-on-surface">Raport Harian</p>
                <p className="text-label-sm text-on-surface-variant">Upload bukti dan pantau nilai PIC.</p>
              </div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 text-label-sm font-bold text-secondary">
              Buka raport <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default KaryawanDashboard;
