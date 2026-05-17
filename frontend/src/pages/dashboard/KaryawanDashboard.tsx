import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
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
} from 'lucide-react';
import { todayKey } from '../../data/picRaportData';
import { employeeRaports } from '../../data/ownerRaportData';
import { useAuthStore } from '../../store/authStore';
import { formatProspekDateKey, useKaryawanProspekStore } from '../../store/karyawanProspekStore';
import { usePicRaportStore } from '../../store/picRaportStore';

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

const KaryawanDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const divisions = usePicRaportStore((state) => state.divisions);
  const evidence = usePicRaportStore((state) => state.evidence);
  const prospek = useKaryawanProspekStore((state) => state.prospek);
  const fetchProspek = useKaryawanProspekStore((state) => state.fetchProspek);
  const divisi = user?.divisi || 'Belum ditentukan';
  const position = getPositionMatch(divisi, divisions);
  const userName = user?.name?.trim().toLowerCase();
  const todayProspekKey = useMemo(() => formatProspekDateKey(new Date()), []);

  useEffect(() => {
    fetchProspek({ tanggal: todayProspekKey, limit: 500 });
  }, [fetchProspek, todayProspekKey]);
  const employeeRecord = useMemo(
    () =>
      employeeRaports.find((item) => item.id === user?.id) ||
      employeeRaports.find((item) => userName && item.nama.toLowerCase() === userName) ||
      employeeRaports.find((item) => item.posisi.toLowerCase() === divisi.toLowerCase()),
    [divisi, user?.id, userName]
  );

  const todayEvidence = useMemo(
    () =>
      evidence.filter(
        (item) =>
          item.tanggal === todayKey &&
          (item.employeeId === user?.id || (userName && item.employeeName.toLowerCase() === userName))
      ),
    [evidence, user?.id, userName]
  );

  const scoredToday = todayEvidence.filter((item) => typeof item.score === 'number' || item.reviewStatus === 'rejected');
  const approvedToday = todayEvidence.filter((item) => item.reviewStatus === 'approved').length;
  const pendingToday = todayEvidence.filter((item) => item.reviewStatus === 'pending').length;
  const rejectedToday = todayEvidence.filter((item) => item.reviewStatus === 'rejected').length;
  const averageScore = scoredToday.length
    ? Math.round(scoredToday.reduce((sum, item) => sum + (item.reviewStatus === 'rejected' ? 0 : item.score || 0), 0) / scoredToday.length)
    : 0;
  const jobdeskCount = position?.jobdesks.length || employeeRecord?.totalJobdesk || 0;
  const ratedJobdeskCount = new Set(scoredToday.map((item) => item.jobdeskIndex)).size;
  const raportProgress = jobdeskCount > 0 ? Math.round((ratedJobdeskCount / jobdeskCount) * 100) : 0;
  const isSales = divisi.toLowerCase().includes('sales') || divisi.toLowerCase().includes('koordinator');
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
  const prospekProgress = Math.min(Math.round((prospekHariIni / targetProspek) * 100), 100);
  const targetGap = Math.max(targetProspek - prospekHariIni, 0);
  const dateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const initials = (user?.name || 'Karyawan')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
  const latestComment = todayEvidence
    .filter((item) => item.reviewerComment)
    .sort((a, b) => (b.reviewedAt || b.submittedAt).localeCompare(a.reviewedAt || a.submittedAt))[0];

  const userDetails = [
    { label: 'Email', value: user?.email || '-', icon: Mail },
    { label: 'WhatsApp', value: user?.whatsapp || '-', icon: Phone },
    { label: 'Jabatan', value: user?.jabatan || divisi, icon: UserRound },
    { label: 'Cabang', value: employeeRecord?.cabang || 'Belum tercatat', icon: Building2 },
  ];

  const stats = [
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
      value: `${ratedJobdeskCount}/${jobdeskCount}`,
      helper: `${raportProgress}% dari daftar jobdesk`,
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
      value: `${prospekHariIni}/${targetProspek}`,
      helper: targetGap > 0 ? `${targetGap} prospek lagi` : 'Target prospek tercapai',
      icon: Send,
      tone: 'text-primary',
      bg: 'bg-primary/10',
      progress: prospekProgress,
    },
  ];

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
