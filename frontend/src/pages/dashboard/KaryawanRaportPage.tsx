import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle,
  Circle,
  Clock3,
  ClipboardList,
  Image as ImageIcon,
  MessageSquareText,
  Paperclip,
  Save,
  ShieldCheck,
  Star,
  UploadCloud,
  Video,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { todayKey, type PicRaportEvidence } from '../../data/picRaportData';
import {
  getReportingWindowLabel,
  isWithinReportingWindow,
  useJobdeskReportSettingsStore,
} from '../../store/jobdeskReportSettingsStore';
import { usePicRaportStore } from '../../store/picRaportStore';
import { apiFetch } from '../../utils/apiClient';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const getUserCabang = (user: ReturnType<typeof useAuthStore.getState>['user']) =>
  user?.cabangName || user?.cabang_name || user?.cabangId || user?.cabang_id || '';

type EvidenceMode = 'unset' | 'none' | 'image' | 'video';

interface JobdeskEvidence {
  mode: EvidenceMode;
  file?: File;
  previewUrl?: string;
  error?: string;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 30 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
};

const getPositionMatch = (divisi: string, positions: ReturnType<typeof usePicRaportStore.getState>['divisions']) => {
  const normalized = divisi.toLowerCase().trim();
  return (
    positions.find((p) => p.id === normalized) ||
    positions.find((p) => p.posisi.toLowerCase() === normalized) ||
    positions.find((p) => normalized.includes(p.id) || normalized.includes(p.posisi.toLowerCase())) ||
    positions[0]
  );
};

const normalizeDivisionKey = (value?: string) => (value || '').toLowerCase().trim();

const evidenceMatchesCurrentDivision = (
  item: PicRaportEvidence,
  divisi: string,
  position: ReturnType<typeof getPositionMatch>
) => {
  const activeKeys = [
    normalizeDivisionKey(divisi),
    normalizeDivisionKey(position?.id),
    normalizeDivisionKey(position?.posisi),
  ].filter(Boolean);
  const evidenceKeys = [
    normalizeDivisionKey(item.divisiId),
    normalizeDivisionKey(item.divisiName),
  ].filter(Boolean);

  if (activeKeys.length === 0 || evidenceKeys.length === 0) return true;
  return evidenceKeys.some((evidenceKey) =>
    activeKeys.some(
      (activeKey) =>
        evidenceKey === activeKey ||
        evidenceKey.includes(activeKey) ||
        activeKey.includes(evidenceKey)
    )
  );
};

const reviewStatusMeta: Record<PicRaportEvidence['reviewStatus'] | 'not_submitted', { label: string; className: string }> = {
  approved: { label: 'Disetujui PIC', className: 'bg-secondary/10 text-secondary' },
  rejected: { label: 'Ditolak PIC', className: 'bg-error/10 text-error' },
  pending: { label: 'Menunggu PIC', className: 'bg-yellow-500/10 text-yellow-500' },
  not_submitted: { label: 'Belum dikirim', className: 'bg-surface text-on-surface-variant' },
};

const KaryawanRaportPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const divisions = usePicRaportStore((state) => state.divisions);
  const picEvidence = usePicRaportStore((state) => state.evidence);
  const fetchEvidence = usePicRaportStore((state) => state.fetchEvidence);
  const fetchDivisions = usePicRaportStore((state) => state.fetchDivisions);
  const submitRaport = usePicRaportStore((state) => state.submitRaport);
  const raportError = usePicRaportStore((state) => state.error);
  const divisi = user?.divisi || '';
  const cabang = getUserCabang(user);
  const position = getPositionMatch(divisi, divisions);
  const jobdesks = useMemo(() => position?.jobdesks || [], [position]);
  const todayReviewedEvidence = useMemo(() => {
    const userName = user?.name?.trim().toLowerCase();
    return picEvidence.filter(
      (item) =>
        item.tanggal === todayKey &&
        (item.employeeId === user?.id || (userName && item.employeeName.toLowerCase() === userName)) &&
        evidenceMatchesCurrentDivision(item, divisi, position)
    );
  }, [divisi, picEvidence, position, user?.id, user?.name]);
  const todayEvidenceByJobdesk = useMemo(() => {
    const map = new Map<number, PicRaportEvidence>();
    todayReviewedEvidence.forEach((item) => {
      const current = map.get(item.jobdeskIndex);
      if (!current || item.submittedAt > current.submittedAt) {
        map.set(item.jobdeskIndex, item);
      }
    });
    return map;
  }, [todayReviewedEvidence]);
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const reportStartTime = useJobdeskReportSettingsStore((state) => state.startTime);
  const reportEndTime = useJobdeskReportSettingsStore((state) => state.endTime);
  const fetchReportingWindow = useJobdeskReportSettingsStore((state) => state.fetchReportingWindow);
  const reportSettingsError = useJobdeskReportSettingsStore((state) => state.error);
  const reportSettings = useMemo(
    () => ({
      startTime: reportStartTime,
      endTime: reportEndTime,
    }),
    [reportEndTime, reportStartTime]
  );

  const [evidenceByJobdesk, setEvidenceByJobdesk] = useState<Record<number, JobdeskEvidence>>(() => {
    const initial: Record<number, JobdeskEvidence> = {};
    jobdesks.forEach((_, idx) => {
      initial[idx] = { mode: 'unset' };
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchEvidence({ tanggal: todayKey, limit: 2000 });
    fetchDivisions();
    fetchReportingWindow();
  }, [fetchDivisions, fetchEvidence, fetchReportingWindow]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const totalCount = jobdesks.length;
  const evidenceCount = Object.values(evidenceByJobdesk).filter((evidence) => evidence.mode !== 'unset' && !evidence.error).length;
  const scoredTodayItems = todayReviewedEvidence.filter((item) => typeof item.score === 'number');
  const scoredJobdeskCount = [...todayEvidenceByJobdesk.values()].filter(
    (item) => typeof item.score === 'number' || item.reviewStatus === 'rejected'
  ).length;
  const averageTodayScore = scoredTodayItems.length
    ? Math.round(scoredTodayItems.reduce((sum, item) => sum + (item.score || 0), 0) / scoredTodayItems.length)
    : 0;
  const persentase = totalCount > 0 ? Math.round((scoredJobdeskCount / totalCount) * 100) : 0;
  const evidencePercentage = totalCount > 0 ? Math.round((evidenceCount / totalCount) * 100) : 0;
  const canSubmitReport = isWithinReportingWindow(reportSettings);

  const revokePreviewUrl = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  };

  const setEvidenceMode = (idx: number, mode: EvidenceMode) => {
    if (!canSubmitReport) return;

    setEvidenceByJobdesk((prev) => {
      const current = prev[idx];
      revokePreviewUrl(current?.previewUrl);
      return { ...prev, [idx]: { mode } };
    });
  };

  const handleFileChange = (idx: number, mode: 'image' | 'video', file?: File) => {
    if (!canSubmitReport) return;
    if (!file) return;

    const isImage = mode === 'image';
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const validType = isImage ? file.type.startsWith('image/') : file.type.startsWith('video/');
    const maxLabel = isImage ? '5 MB' : '30 MB';

    if (!validType) {
      setEvidenceByJobdesk((prev) => {
        revokePreviewUrl(prev[idx]?.previewUrl);
        return { ...prev, [idx]: { mode, error: `File harus berupa ${isImage ? 'gambar' : 'video'}.` } };
      });
      return;
    }

    if (file.size > maxSize) {
      setEvidenceByJobdesk((prev) => {
        revokePreviewUrl(prev[idx]?.previewUrl);
        return { ...prev, [idx]: { mode, error: `Ukuran maksimal ${maxLabel}. File ini ${formatFileSize(file.size)}.` } };
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    setEvidenceByJobdesk((prev) => {
      const current = prev[idx];
      revokePreviewUrl(current?.previewUrl);
      return { ...prev, [idx]: { mode, file, previewUrl } };
    });
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const uploadEvidenceFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiFetch('/api/raport-harian/upload', {
      method: 'POST',
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = Array.isArray(payload?.errors) && payload.errors.length > 0
        ? payload.errors.join(', ')
        : payload?.detail || payload?.message || 'Upload bukti gagal.';
      throw new Error(message);
    }
    return String(payload.data?.url || '');
  };

  const handleSaveRaport = async () => {
    if (!canSubmitReport || saving) return;
    const items = Object.entries(evidenceByJobdesk)
      .filter(([, evidence]) => evidence.mode !== 'unset' && !evidence.error)
      .map(([index, evidence]) => ({
        jobdeskIndex: Number(index),
        jobdeskText: jobdesks[Number(index)] || `Jobdesk ${Number(index) + 1}`,
        mode: evidence.mode === 'unset' ? 'none' : evidence.mode,
        evidenceUrl: evidence.previewUrl,
        employeeNote: evidence.mode === 'none' ? 'Bukti ditandai tidak ada oleh karyawan.' : evidence.file?.name || '',
      }));

    if (items.length === 0) {
      setSaveMessage('Pilih minimal satu bukti jobdesk sebelum menyimpan.');
      return;
    }
    if (!cabang.trim()) {
      setSaveMessage('Cabang karyawan belum diatur. Hubungi admin untuk set cabang akun.');
      return;
    }

    setSaving(true);
    try {
      const activeDivisi = user?.divisi?.trim() || position?.posisi || position?.id || '';
      if (!activeDivisi) {
        setSaveMessage('Divisi karyawan belum diatur. Hubungi admin untuk set divisi akun.');
        setSaving(false);
        return;
      }
      const uploadedItems = [];
      for (const item of items) {
        const evidence = evidenceByJobdesk[item.jobdeskIndex];
        const evidenceUrl = evidence?.file ? await uploadEvidenceFile(evidence.file) : item.evidenceUrl;
        uploadedItems.push({ ...item, evidenceUrl });
      }
      await submitRaport({
        tanggal: todayKey,
        cabang,
        divisi: activeDivisi,
        items: uploadedItems,
      });
      setSaveMessage('Raport berhasil dikirim dan menunggu review PIC.');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Raport gagal disimpan.');
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveMessage(''), 3500);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-outline-variant/20 bg-surface p-6 shadow-sm lg:p-7">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/15 bg-secondary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-secondary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Raport dengan bukti kerja
            </div>
            <h1 className="text-headline-md font-black text-on-surface">Raport Harian</h1>
            <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
              Checklist jobdesk untuk <span className="font-bold text-primary">{position?.posisi || divisi}</span>. Setiap jobdesk bisa dilampirkan gambar, video, atau ditandai Tidak Ada.
            </p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-outline-variant/20 bg-surface-high/70 p-4">
              <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Tanggal raport</p>
              <p className="mt-1 text-title-sm font-black text-on-surface">{today}</p>
              <div className={`mt-3 rounded-xl px-3 py-2 ${canSubmitReport ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>
                <div className="flex items-center gap-2 text-label-sm font-bold">
                  <Clock3 className="h-4 w-4" />
                  {canSubmitReport ? 'Pelaporan dibuka' : 'Pelaporan ditutup'}
                </div>
                <p className="mt-1 text-label-xs text-on-surface-variant">{getReportingWindowLabel(reportSettings)}</p>
              </div>
            </div>
            <Link
              to="/dashboard/karyawan/raport/history"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary"
            >
              <CalendarDays className="h-4 w-4" />
              Lihat History Bukti
            </Link>
          </div>
        </div>
      </motion.section>

      {!canSubmitReport && (
        <motion.div variants={itemVariants} className="rounded-3xl border border-error/20 bg-error/10 p-4 text-body-sm font-semibold text-error">
          Pelaporan jobdesk sedang ditutup oleh owner. Anda tetap bisa melihat daftar jobdesk, tetapi checklist dan upload bukti baru dibuka pada {getReportingWindowLabel(reportSettings)}.
        </motion.div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Jobdesk Dinilai', value: `${scoredJobdeskCount}/${totalCount}`, helper: `${persentase}% sudah diberi nilai PIC`, icon: ClipboardList, tone: 'text-primary', bg: 'bg-primary/10', bar: persentase },
          { label: 'Bukti Terisi', value: `${evidenceCount}/${totalCount}`, helper: `${evidencePercentage}% bukti lengkap`, icon: Paperclip, tone: 'text-secondary', bg: 'bg-secondary/10', bar: evidencePercentage },
          { label: 'Rata-rata Nilai', value: averageTodayScore ? `${averageTodayScore}/100` : '-', helper: scoredTodayItems.length ? `${scoredTodayItems.length} jobdesk sudah dinilai PIC` : 'Belum ada nilai PIC hari ini', icon: Star, tone: averageTodayScore ? 'text-yellow-500' : 'text-on-surface-variant', bg: averageTodayScore ? 'bg-yellow-500/10' : 'bg-surface-high', bar: averageTodayScore },
          { label: 'Batas Upload', value: '5MB / 30MB', helper: 'Gambar / Video per jobdesk', icon: UploadCloud, tone: 'text-tertiary', bg: 'bg-tertiary/10', bar: 100 },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={itemVariants} className="rounded-3xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
                  <p className="mt-2 text-headline-sm font-black text-on-surface">{stat.value}</p>
                </div>
                <div className={`rounded-2xl p-3 ${stat.bg} ${stat.tone}`}><Icon className="h-5 w-5" /></div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-high">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${stat.bar}%` }} />
              </div>
              <p className="mt-3 text-body-sm text-on-surface-variant">{stat.helper}</p>
            </motion.div>
          );
        })}
      </section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm lg:p-6">
        <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-title-lg font-black text-on-surface">Jobdesk {position?.posisi || 'Umum'}</h2>
            <p className="text-body-sm text-on-surface-variant">
              Upload bukti sesuai kondisi lapangan. Centang jobdesk aktif otomatis setelah PIC memberi nilai.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveRaport}
            disabled={!canSubmitReport}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-body-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyimpan...' : 'Simpan Raport'}
          </button>
        </div>

      {saveMessage && (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-body-sm font-semibold text-primary">
            {saveMessage}
          </div>
        )}

        {(raportError || reportSettingsError) && (
          <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-semibold text-error">
            {raportError || reportSettingsError}
          </div>
        )}

        <div className="space-y-4">
          {jobdesks.map((job, idx) => {
            const evidence = evidenceByJobdesk[idx] || { mode: 'unset' };
            const reviewedEvidence = todayEvidenceByJobdesk.get(idx);
            const reviewStatus = reviewedEvidence?.reviewStatus ?? 'not_submitted';
            const reviewMeta = reviewStatusMeta[reviewStatus];
            const isDone = typeof reviewedEvidence?.score === 'number' || reviewedEvidence?.reviewStatus === 'rejected';
            const scoreLabel = reviewedEvidence?.reviewStatus === 'rejected'
              ? '0/100'
              : typeof reviewedEvidence?.score === 'number'
                ? `${reviewedEvidence.score}/100`
                : 'Belum dinilai';
            return (
              <article key={`${position?.id}-${idx}`} className={`rounded-3xl border p-4 transition ${isDone ? 'border-secondary/20 bg-secondary/5' : 'border-outline-variant/20 bg-surface-high/35'}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    {isDone ? (
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-on-surface-variant" />
                    )}
                    <div>
                      <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Jobdesk {idx + 1}</p>
                      <p className={`mt-1 text-body-md font-semibold ${isDone ? 'text-on-surface' : 'text-on-surface'}`}>{job}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:w-[260px]">
                    <div className="rounded-2xl border border-outline-variant/15 bg-surface px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nilai</p>
                      <p className={`mt-1 text-title-sm font-black ${reviewedEvidence?.reviewStatus === 'rejected' ? 'text-error' : typeof reviewedEvidence?.score === 'number' ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {scoreLabel}
                      </p>
                    </div>
                    <div className={`rounded-2xl px-3 py-2 ${reviewMeta.className}`}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Status PIC</p>
                      <p className="mt-1 text-label-sm font-black">{reviewMeta.label}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
                    <button
                      type="button"
                      onClick={() => setEvidenceMode(idx, 'none')}
                      disabled={!canSubmitReport}
                      className={`rounded-2xl border px-3 py-2 text-label-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${evidence.mode === 'none' ? 'border-on-surface/20 bg-on-surface/10 text-on-surface' : 'border-outline-variant/20 bg-surface text-on-surface-variant hover:border-on-surface/20'}`}
                    >
                      <span className="inline-flex items-center gap-2"><Ban className="h-4 w-4" /> Tidak Ada</span>
                    </button>
                    <label className={`rounded-2xl border px-3 py-2 text-label-sm font-bold transition ${canSubmitReport ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${evidence.mode === 'image' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/30'}`}>
                      <span className="inline-flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Gambar</span>
                      <input type="file" accept="image/*" disabled={!canSubmitReport} className="hidden" onChange={(event) => handleFileChange(idx, 'image', event.target.files?.[0])} />
                    </label>
                    <label className={`rounded-2xl border px-3 py-2 text-label-sm font-bold transition ${canSubmitReport ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${evidence.mode === 'video' ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-outline-variant/20 bg-surface text-on-surface-variant hover:border-secondary/30'}`}>
                      <span className="inline-flex items-center gap-2"><Video className="h-4 w-4" /> Video</span>
                      <input type="file" accept="video/*" disabled={!canSubmitReport} className="hidden" onChange={(event) => handleFileChange(idx, 'video', event.target.files?.[0])} />
                    </label>
                  </div>
                </div>

                {reviewedEvidence?.reviewerComment && (
                  <div className="mt-4 flex items-start gap-2 rounded-2xl border border-outline-variant/15 bg-surface px-3 py-3 text-body-sm text-on-surface-variant">
                    <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Komentar PIC</p>
                      <p className="mt-1 font-semibold text-on-surface">{reviewedEvidence.reviewerComment}</p>
                    </div>
                  </div>
                )}

                {(evidence.file || evidence.error || evidence.mode === 'none') && (
                  <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface p-3">
                    {evidence.error && (
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-error">
                        <AlertCircle className="h-4 w-4" />
                        {evidence.error}
                      </div>
                    )}

                    {evidence.mode === 'none' && !evidence.error && (
                      <div className="flex items-center gap-2 text-body-sm font-semibold text-on-surface-variant">
                        <Ban className="h-4 w-4" />
                        Bukti ditandai tidak ada untuk jobdesk ini.
                      </div>
                    )}

                    {evidence.file && evidence.previewUrl && evidence.mode === 'image' && (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <img src={evidence.previewUrl} alt={`Bukti ${job}`} className="h-24 w-32 rounded-xl border border-outline-variant/20 object-cover" />
                        <div>
                          <p className="text-body-sm font-bold text-on-surface">{evidence.file.name}</p>
                          <p className="text-label-sm text-on-surface-variant">Gambar, {formatFileSize(evidence.file.size)} dari maksimal 5 MB</p>
                        </div>
                      </div>
                    )}

                    {evidence.file && evidence.previewUrl && evidence.mode === 'video' && (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <video src={evidence.previewUrl} className="h-28 w-44 rounded-xl border border-outline-variant/20 object-cover" controls muted />
                        <div>
                          <p className="text-body-sm font-bold text-on-surface">{evidence.file.name}</p>
                          <p className="text-label-sm text-on-surface-variant">Video, {formatFileSize(evidence.file.size)} dari maksimal 30 MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </motion.section>

    </motion.div>
  );
};

export default KaryawanRaportPage;
