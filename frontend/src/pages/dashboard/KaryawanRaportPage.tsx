import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  BadgeDollarSign,
  CalendarOff,
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
import { calculateJobdeskScoreFine, formatRupiah } from '../../utils/denda';
import { ImagePreviewModal, type PreviewImage } from '../../components/ui';
import { useOffRequestStore } from '../../store/offRequestStore';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const getUserCabang = (user: ReturnType<typeof useAuthStore.getState>['user']) =>
  user?.cabangName || user?.cabang_name || user?.cabangId || user?.cabang_id || '';

type EvidenceMode = 'unset' | 'none' | 'image' | 'video';
type EvidenceSaveStatus = 'idle' | 'compressing' | 'uploading' | 'saving' | 'saved' | 'error';

interface EvidenceAsset {
  id: string;
  file: File;
  previewUrl: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressionLabel: string;
}

interface JobdeskEvidence {
  mode: EvidenceMode;
  files?: EvidenceAsset[];
  existingUrls?: string[];
  uploadedUrls?: string[];
  error?: string;
  saveStatus?: EvidenceSaveStatus;
  saveMessage?: string;
  savedAt?: string;
}

const MAX_IMAGE_INPUT_SIZE = 25 * 1024 * 1024;
const MAX_IMAGE_FILES = 6;
const IMAGE_MAX_SIDE = 2400;
const IMAGE_TARGET_SIZE = 1.4 * 1024 * 1024;
const IMAGE_HARD_LIMIT = 4.5 * 1024 * 1024;
const IMAGE_MIN_QUALITY = 0.82;
const MAX_VIDEO_SIZE = 30 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(Math.round(bytes / 1024), 1)} KB`;
};

const replaceExtension = (name: string, extension: string) => {
  const cleanName = name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'bukti';
  return `${cleanName}.${extension}`;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Browser gagal memproses gambar.'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

const renderBitmapToCanvas = (bitmap: ImageBitmap, maxSide: number) => {
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, maxSide / longestSide);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Browser tidak mendukung kompresi gambar.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#f7f7f4';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const compressImageOnClient = async (file: File) => {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar.');
  if (file.size > MAX_IMAGE_INPUT_SIZE) {
    throw new Error(`Ukuran gambar maksimal ${formatFileSize(MAX_IMAGE_INPUT_SIZE)} sebelum kompresi.`);
  }

  const bitmap = await createImageBitmap(file);
  try {
    const attempts: Blob[] = [];
    const mimeType = 'image/webp';
    const sideAttempts = [IMAGE_MAX_SIDE, 2100, 1800];

    for (const maxSide of sideAttempts) {
      const canvas = renderBitmapToCanvas(bitmap, maxSide);
      let low = IMAGE_MIN_QUALITY;
      let high = 0.92;
      let best = await canvasToBlob(canvas, mimeType, high);
      attempts.push(best);

      for (let step = 0; step < 5; step += 1) {
        const quality = (low + high) / 2;
        const blob = await canvasToBlob(canvas, mimeType, quality);
        attempts.push(blob);

        if (blob.size > IMAGE_TARGET_SIZE) {
          high = quality;
        } else {
          best = blob;
          low = quality;
        }
      }

      if (best.size <= IMAGE_TARGET_SIZE || best.size <= IMAGE_HARD_LIMIT) break;
    }

    const underTarget = attempts
      .filter((blob) => blob.size <= IMAGE_TARGET_SIZE)
      .sort((a, b) => b.size - a.size)[0];
    const underHardLimit = attempts
      .filter((blob) => blob.size <= IMAGE_HARD_LIMIT)
      .sort((a, b) => b.size - a.size)[0];
    const selected = underTarget || underHardLimit || attempts.sort((a, b) => a.size - b.size)[0];
    const keepOriginal = file.size <= IMAGE_HARD_LIMIT && selected.size >= file.size;
    const finalBlob = keepOriginal ? file : selected;
    const extension = finalBlob.type.includes('webp') ? 'webp' : file.name.split('.').pop() || 'jpg';
    const compressedFile = finalBlob instanceof File
      ? finalBlob
      : new File([finalBlob], replaceExtension(file.name, extension), {
          type: finalBlob.type || 'image/webp',
          lastModified: Date.now(),
        });

    return {
      file: compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      compressionLabel: keepOriginal
        ? 'File sudah ringan, tidak dikompres ulang'
        : `${formatFileSize(file.size)} ke ${formatFileSize(compressedFile.size)}`,
    };
  } finally {
    bitmap.close();
  }
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
  const offRequests = useOffRequestStore((state) => state.requests);
  const fetchOffRequests = useOffRequestStore((state) => state.fetchRequests);
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
  const [preview, setPreview] = useState<{
    images: PreviewImage[];
    initialIndex: number;
    title: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    fetchEvidence({ tanggal: todayKey, limit: 2000 });
    fetchDivisions();
    fetchReportingWindow();
    fetchOffRequests({ tanggal: todayKey, limit: 50 });
  }, [fetchDivisions, fetchEvidence, fetchOffRequests, fetchReportingWindow]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (jobdesks.length === 0) return;

    setEvidenceByJobdesk((prev) => {
      let changed = false;
      const next = { ...prev };
      const busyStatuses: Array<EvidenceSaveStatus | undefined> = ['compressing', 'uploading', 'saving'];

      jobdesks.forEach((_, idx) => {
        const current = next[idx];
        const serverEvidence = todayEvidenceByJobdesk.get(idx);

        if (!serverEvidence) {
          if (!current) {
            next[idx] = { mode: 'unset' };
            changed = true;
          }
          return;
        }

        if (current?.files?.length || busyStatuses.includes(current?.saveStatus) || current?.error) {
          return;
        }

        const existingUrls = serverEvidence.evidenceUrls?.length
          ? serverEvidence.evidenceUrls
          : serverEvidence.evidenceUrl
            ? [serverEvidence.evidenceUrl]
            : [];
        const nextEvidence: JobdeskEvidence = {
          mode: serverEvidence.mode,
          existingUrls,
          uploadedUrls: existingUrls,
          saveStatus: current?.saveStatus === 'saved' ? 'saved' : undefined,
          saveMessage: current?.saveStatus === 'saved' ? current.saveMessage : undefined,
          savedAt: current?.savedAt,
        };

        if (
          current?.mode !== nextEvidence.mode ||
          (current?.existingUrls || []).join('|') !== existingUrls.join('|') ||
          (current?.uploadedUrls || []).join('|') !== existingUrls.join('|')
        ) {
          next[idx] = nextEvidence;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [jobdesks, todayEvidenceByJobdesk]);

  const totalCount = jobdesks.length;
  const evidenceCount = Object.values(evidenceByJobdesk).filter((evidence) => evidence.mode !== 'unset' && !evidence.error).length;
  const scoredTodayItems = todayReviewedEvidence.filter((item) => typeof item.score === 'number');
  const scoredJobdeskCount = [...todayEvidenceByJobdesk.values()].filter(
    (item) => typeof item.score === 'number' || item.reviewStatus === 'rejected'
  ).length;
  const averageTodayScore = scoredTodayItems.length
    ? Math.round(scoredTodayItems.reduce((sum, item) => sum + (item.score || 0), 0) / scoredTodayItems.length)
    : 0;
  const approvedOffToday = offRequests.find((request) => request.karyawanId === user?.id && request.tanggal === todayKey && request.status === 'approved');
  const dendaJobdeskHariIni = approvedOffToday ? 0 : calculateJobdeskScoreFine(averageTodayScore, scoredTodayItems.length > 0);
  const persentase = totalCount > 0 ? Math.round((scoredJobdeskCount / totalCount) * 100) : 0;
  const evidencePercentage = totalCount > 0 ? Math.round((evidenceCount / totalCount) * 100) : 0;
  const canSubmitReport = isWithinReportingWindow(reportSettings) && !approvedOffToday;

  const revokeEvidenceFiles = (files?: EvidenceAsset[]) => {
    files?.forEach((asset) => {
      URL.revokeObjectURL(asset.previewUrl);
      previewUrlsRef.current.delete(asset.previewUrl);
    });
  };

  const setEvidenceStatus = (idx: number, saveStatus: EvidenceSaveStatus, saveMessage?: string) => {
    setEvidenceByJobdesk((prev) => ({
      ...prev,
      [idx]: {
        ...(prev[idx] || { mode: 'unset' }),
        saveStatus,
        saveMessage,
        savedAt: saveStatus === 'saved' ? new Date().toISOString() : prev[idx]?.savedAt,
      },
    }));
  };

  const getActiveDivisi = () => user?.divisi?.trim() || position?.posisi || position?.id || '';

  const buildEmployeeNote = (evidence: JobdeskEvidence) => {
    if (evidence.mode === 'none') return 'Bukti ditandai tidak ada oleh karyawan.';
    const files = evidence.files || [];
    if (evidence.mode === 'image') {
      if (files.length === 0 && evidence.existingUrls?.length) {
        return `Bukti gambar tersimpan dipertahankan (${evidence.existingUrls.length} gambar).`;
      }
      return files
        .map((asset, index) => `Gambar ${index + 1}: ${asset.originalName} (${asset.compressionLabel})`)
        .join('\n');
    }
    return files[0]?.originalName || (evidence.existingUrls?.[0] ? 'Bukti video tersimpan dipertahankan.' : '');
  };

  const saveJobdeskEvidence = async (idx: number, evidence: JobdeskEvidence) => {
    if (!canSubmitReport) return;
    if (!cabang.trim()) {
      setEvidenceStatus(idx, 'error', 'Cabang karyawan belum diatur. Hubungi admin.');
      return;
    }
    const activeDivisi = getActiveDivisi();
    if (!activeDivisi) {
      setEvidenceStatus(idx, 'error', 'Divisi karyawan belum diatur. Hubungi admin.');
      return;
    }

    try {
      const files = evidence.files || [];
      let evidenceUrl = '';

      if (evidence.mode === 'image') {
        let urls = files.length > 0 ? evidence.uploadedUrls : evidence.uploadedUrls || evidence.existingUrls;
        if (files.length > 0 && (!urls || urls.length !== files.length)) {
          setEvidenceStatus(idx, 'uploading', `Mengupload ${files.length} gambar...`);
          urls = [];
          for (const asset of files) {
            urls.push(await uploadEvidenceFile(asset.file));
          }
          const uploadedUrls = urls;
          setEvidenceByJobdesk((prev) => ({
            ...prev,
            [idx]: { ...(prev[idx] || evidence), uploadedUrls },
          }));
        }
        if (!urls || urls.length === 0) throw new Error('Pilih minimal satu gambar.');
        evidenceUrl = JSON.stringify(urls);
      } else if (evidence.mode === 'video') {
        let urls = files[0] ? evidence.uploadedUrls : evidence.uploadedUrls || evidence.existingUrls;
        if (files[0] && (!urls || urls.length === 0)) {
          setEvidenceStatus(idx, 'uploading', 'Mengupload video...');
          urls = [await uploadEvidenceFile(files[0].file)];
          const uploadedUrls = urls;
          setEvidenceByJobdesk((prev) => ({
            ...prev,
            [idx]: { ...(prev[idx] || evidence), uploadedUrls },
          }));
        }
        if (!urls || urls.length === 0) throw new Error('Pilih video bukti.');
        evidenceUrl = urls[0];
      }

      setEvidenceStatus(idx, 'saving', 'Menyimpan raport...');
      await submitRaport({
        tanggal: todayKey,
        cabang,
        divisi: activeDivisi,
        items: [
          {
            jobdeskIndex: idx,
            jobdeskText: jobdesks[idx] || `Jobdesk ${idx + 1}`,
            mode: evidence.mode === 'unset' ? 'none' : evidence.mode,
            evidenceUrl,
            employeeNote: buildEmployeeNote(evidence),
          },
        ],
      });
      setEvidenceStatus(idx, 'saved', 'Tersimpan otomatis.');
    } catch (error) {
      setEvidenceStatus(idx, 'error', error instanceof Error ? error.message : 'Gagal autosave bukti.');
    }
  };

  const setEvidenceMode = (idx: number, mode: EvidenceMode) => {
    if (!canSubmitReport) return;

    setEvidenceByJobdesk((prev) => {
      const current = prev[idx];
      revokeEvidenceFiles(current?.files);
      return { ...prev, [idx]: { mode, saveStatus: mode === 'none' ? 'saving' : 'idle' } };
    });

    if (mode === 'none') {
      void saveJobdeskEvidence(idx, { mode: 'none' });
    }
  };

  const handleFileChange = async (idx: number, mode: 'image' | 'video', fileList?: FileList | null) => {
    if (!canSubmitReport) return;
    const selectedFiles = Array.from(fileList || []);
    if (selectedFiles.length === 0) return;

    const isImage = mode === 'image';
    const maxSize = isImage ? MAX_IMAGE_INPUT_SIZE : MAX_VIDEO_SIZE;
    const maxLabel = isImage ? formatFileSize(MAX_IMAGE_INPUT_SIZE) : '30 MB';

    if (isImage && selectedFiles.length > MAX_IMAGE_FILES) {
      setEvidenceByJobdesk((prev) => {
        revokeEvidenceFiles(prev[idx]?.files);
        return { ...prev, [idx]: { mode, error: `Maksimal ${MAX_IMAGE_FILES} gambar per jobdesk.`, saveStatus: 'error' } };
      });
      return;
    }

    if (!isImage && selectedFiles.length > 1) {
      setEvidenceByJobdesk((prev) => {
        revokeEvidenceFiles(prev[idx]?.files);
        return { ...prev, [idx]: { mode, error: 'Video hanya bisa satu file per jobdesk.', saveStatus: 'error' } };
      });
      return;
    }

    const invalidType = selectedFiles.find((file) => (isImage ? !file.type.startsWith('image/') : !file.type.startsWith('video/')));
    if (invalidType) {
      setEvidenceByJobdesk((prev) => {
        revokeEvidenceFiles(prev[idx]?.files);
        return { ...prev, [idx]: { mode, error: `File harus berupa ${isImage ? 'gambar' : 'video'}.`, saveStatus: 'error' } };
      });
      return;
    }

    const oversizedFile = selectedFiles.find((file) => file.size > maxSize);
    if (oversizedFile) {
      setEvidenceByJobdesk((prev) => {
        revokeEvidenceFiles(prev[idx]?.files);
        return { ...prev, [idx]: { mode, error: `Ukuran maksimal ${maxLabel}. ${oversizedFile.name}: ${formatFileSize(oversizedFile.size)}.`, saveStatus: 'error' } };
      });
      return;
    }

    setEvidenceByJobdesk((prev) => {
      revokeEvidenceFiles(prev[idx]?.files);
      return { ...prev, [idx]: { mode, saveStatus: isImage ? 'compressing' : 'uploading', saveMessage: isImage ? 'Mengompres gambar di perangkat...' : 'Menyiapkan upload video...' } };
    });

    try {
      const assets: EvidenceAsset[] = [];
      for (const file of selectedFiles) {
        const result = isImage
          ? await compressImageOnClient(file)
          : {
              file,
              originalSize: file.size,
              compressedSize: file.size,
              compressionLabel: 'Video tidak dikompres di browser',
            };
        const previewUrl = URL.createObjectURL(result.file);
        previewUrlsRef.current.add(previewUrl);
        assets.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file: result.file,
          previewUrl,
          originalName: file.name,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionLabel: result.compressionLabel,
        });
      }

      const nextEvidence: JobdeskEvidence = {
        mode,
        files: assets,
        saveStatus: 'uploading',
        saveMessage: mode === 'image' ? `Mengupload ${assets.length} gambar terkompresi...` : 'Mengupload video...',
      };
      setEvidenceByJobdesk((prev) => {
        revokeEvidenceFiles(prev[idx]?.files);
        return { ...prev, [idx]: nextEvidence };
      });
      void saveJobdeskEvidence(idx, nextEvidence);
    } catch (error) {
      setEvidenceByJobdesk((prev) => {
        revokeEvidenceFiles(prev[idx]?.files);
        return {
          ...prev,
          [idx]: {
            mode,
            error: error instanceof Error ? error.message : 'Gagal memproses file bukti.',
            saveStatus: 'error',
          },
        };
      });
    }
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
    const entries = Object.entries(evidenceByJobdesk)
      .filter(([, evidence]) => evidence.mode !== 'unset' && !evidence.error)
      .map(([index, evidence]) => [Number(index), evidence] as const);

    if (entries.length === 0) {
      setSaveMessage('Pilih minimal satu bukti jobdesk. Sistem akan menyimpan otomatis.');
      return;
    }
    if (!cabang.trim()) {
      setSaveMessage('Cabang karyawan belum diatur. Hubungi admin untuk set cabang akun.');
      return;
    }

    setSaving(true);
    try {
      const activeDivisi = getActiveDivisi();
      if (!activeDivisi) {
        setSaveMessage('Divisi karyawan belum diatur. Hubungi admin untuk set divisi akun.');
        setSaving(false);
        return;
      }
      for (const [index, evidence] of entries) {
        await saveJobdeskEvidence(index, evidence);
      }
      setSaveMessage('Semua bukti terisi sudah disinkronkan.');
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
                  {approvedOffToday ? <CalendarOff className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  {approvedOffToday ? 'OFF disetujui PIC' : canSubmitReport ? 'Pelaporan dibuka' : 'Pelaporan ditutup'}
                </div>
                <p className="mt-1 text-label-xs text-on-surface-variant">
                  {approvedOffToday ? 'Laporan jobdesk tidak wajib hari ini.' : getReportingWindowLabel(reportSettings)}
                </p>
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
          {approvedOffToday
            ? 'OFF hari ini sudah disetujui PIC. Anda tidak perlu mengirim laporan jobdesk dan denda jobdesk hari ini tidak dihitung.'
            : `Pelaporan jobdesk sedang ditutup oleh owner. Anda tetap bisa melihat daftar jobdesk, tetapi checklist dan upload bukti baru dibuka pada ${getReportingWindowLabel(reportSettings)}.`}
        </motion.div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Jobdesk Dinilai', value: `${scoredJobdeskCount}/${totalCount}`, helper: `${persentase}% sudah diberi nilai PIC`, icon: ClipboardList, tone: 'text-primary', bg: 'bg-primary/10', bar: persentase },
          { label: 'Bukti Terisi', value: `${evidenceCount}/${totalCount}`, helper: `${evidencePercentage}% bukti lengkap`, icon: Paperclip, tone: 'text-secondary', bg: 'bg-secondary/10', bar: evidencePercentage },
          { label: 'Rata-rata Nilai', value: averageTodayScore ? `${averageTodayScore}/100` : '-', helper: scoredTodayItems.length ? `${scoredTodayItems.length} jobdesk sudah dinilai PIC` : 'Belum ada nilai PIC hari ini', icon: Star, tone: averageTodayScore ? 'text-yellow-500' : 'text-on-surface-variant', bg: averageTodayScore ? 'bg-yellow-500/10' : 'bg-surface-high', bar: averageTodayScore },
          { label: 'Denda Jobdesk', value: formatRupiah(dendaJobdeskHariIni), helper: scoredTodayItems.length ? (dendaJobdeskHariIni > 0 ? 'Nilai total di bawah 80' : 'Nilai total aman') : 'Menunggu nilai PIC', icon: BadgeDollarSign, tone: dendaJobdeskHariIni > 0 ? 'text-error' : 'text-secondary', bg: dendaJobdeskHariIni > 0 ? 'bg-error/10' : 'bg-secondary/10', bar: dendaJobdeskHariIni > 0 ? 100 : 0 },
          { label: 'Batas Upload', value: '25MB / 30MB', helper: 'Gambar mentah / Video per jobdesk', icon: UploadCloud, tone: 'text-tertiary', bg: 'bg-tertiary/10', bar: 100 },
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
              Upload bukti sesuai kondisi lapangan. Setiap pilihan akan dikompres di perangkat dan tersimpan otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveRaport}
            disabled={!canSubmitReport}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-body-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Menyinkronkan...' : 'Sinkronkan Ulang'}
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
            const files = evidence.files || [];
            const existingUrls = evidence.existingUrls?.length
              ? evidence.existingUrls
              : reviewedEvidence?.evidenceUrls?.length
                ? reviewedEvidence.evidenceUrls
                : reviewedEvidence?.evidenceUrl
                  ? [reviewedEvidence.evidenceUrl]
                  : [];
            const selectedFileImages: PreviewImage[] = files
              .filter(() => evidence.mode === 'image')
              .map((asset, assetIndex) => ({
                src: asset.previewUrl,
                alt: `Bukti ${job} ${assetIndex + 1}`,
                caption: `${asset.originalName} (${asset.compressionLabel})`,
              }));
            const storedImages: PreviewImage[] = existingUrls.map((url, assetIndex) => ({
              src: url,
              alt: `Bukti tersimpan ${job} ${assetIndex + 1}`,
              caption: `Gambar ${assetIndex + 1} dari jobdesk ${idx + 1}`,
            }));
            const saveStatusLabel: Record<EvidenceSaveStatus, string> = {
              idle: 'Belum tersimpan',
              compressing: 'Mengompres',
              uploading: 'Mengupload',
              saving: 'Menyimpan',
              saved: 'Tersimpan',
              error: 'Gagal',
            };
            const saveStatusClass = evidence.saveStatus === 'saved'
              ? 'bg-secondary/10 text-secondary'
              : evidence.saveStatus === 'error'
                ? 'bg-error/10 text-error'
                : evidence.saveStatus === 'compressing' || evidence.saveStatus === 'uploading' || evidence.saveStatus === 'saving'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface text-on-surface-variant';
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
                      <span className="inline-flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {existingUrls.length && evidence.mode === 'image' ? 'Ganti Gambar' : 'Gambar'}</span>
                      <input type="file" accept="image/*" multiple disabled={!canSubmitReport} className="hidden" onChange={(event) => handleFileChange(idx, 'image', event.target.files)} />
                    </label>
                    <label className={`rounded-2xl border px-3 py-2 text-label-sm font-bold transition ${canSubmitReport ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${evidence.mode === 'video' ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-outline-variant/20 bg-surface text-on-surface-variant hover:border-secondary/30'}`}>
                      <span className="inline-flex items-center gap-2"><Video className="h-4 w-4" /> {existingUrls.length && evidence.mode === 'video' ? 'Ganti Video' : 'Video'}</span>
                      <input type="file" accept="video/*" disabled={!canSubmitReport} className="hidden" onChange={(event) => handleFileChange(idx, 'video', event.target.files)} />
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

                {(files.length > 0 || existingUrls.length > 0 || evidence.error || evidence.mode === 'none' || evidence.saveStatus) && (
                  <div className="mt-4 rounded-2xl border border-outline-variant/15 bg-surface p-3">
                    {evidence.saveStatus && (
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-label-xs font-bold ${saveStatusClass}`}>
                          {saveStatusLabel[evidence.saveStatus]}
                        </span>
                        {evidence.saveMessage && <span className="text-label-xs font-semibold text-on-surface-variant">{evidence.saveMessage}</span>}
                      </div>
                    )}

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

                    {files.length > 0 && evidence.mode === 'image' && (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {files.map((asset, assetIndex) => (
                          <div key={asset.id} className="rounded-xl border border-outline-variant/15 bg-surface-high/35 p-2">
                            <button
                              type="button"
                              onClick={() => setPreview({
                                images: selectedFileImages,
                                initialIndex: assetIndex,
                                title: `Bukti jobdesk ${idx + 1}`,
                                subtitle: job,
                              })}
                              className="block w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              <img src={asset.previewUrl} alt={`Bukti ${job} ${assetIndex + 1}`} className="h-28 w-full rounded-lg border border-outline-variant/20 object-cover transition hover:opacity-90" />
                            </button>
                            <p className="mt-2 truncate text-label-sm font-bold text-on-surface">{asset.originalName}</p>
                            <p className="text-[11px] font-semibold text-on-surface-variant">{asset.compressionLabel}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {files.length === 0 && existingUrls.length > 0 && evidence.mode === 'image' && (
                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-label-sm font-bold text-on-surface">Bukti tersimpan</p>
                          <p className="text-label-xs font-semibold text-on-surface-variant">Pilih Ganti Gambar untuk mengedit.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {existingUrls.map((url, assetIndex) => (
                            <button
                              key={`${url}-${assetIndex}`}
                              type="button"
                              onClick={() => setPreview({
                                images: storedImages,
                                initialIndex: assetIndex,
                                title: `Bukti tersimpan jobdesk ${idx + 1}`,
                                subtitle: job,
                              })}
                              className="rounded-xl border border-outline-variant/15 bg-surface-high/35 p-2 text-left transition hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                              <img src={url} alt={`Bukti tersimpan ${job} ${assetIndex + 1}`} className="h-32 w-full rounded-lg border border-outline-variant/20 object-contain" />
                              <p className="mt-2 text-[11px] font-semibold text-on-surface-variant">Gambar {assetIndex + 1}. Klik untuk perbesar.</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {files[0] && evidence.mode === 'video' && (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <video src={files[0].previewUrl} className="h-28 w-44 rounded-xl border border-outline-variant/20 object-cover" controls muted />
                        <div>
                          <p className="text-body-sm font-bold text-on-surface">{files[0].originalName}</p>
                          <p className="text-label-sm text-on-surface-variant">Video, {formatFileSize(files[0].compressedSize)} dari maksimal 30 MB</p>
                        </div>
                      </div>
                    )}

                    {!files[0] && existingUrls[0] && evidence.mode === 'video' && (
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <video src={existingUrls[0]} className="h-32 w-52 rounded-xl border border-outline-variant/20 object-cover" controls />
                        <div>
                          <p className="text-body-sm font-bold text-on-surface">Bukti video tersimpan</p>
                          <p className="text-label-sm text-on-surface-variant">Pilih Ganti Video untuk mengedit bukti jobdesk ini.</p>
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

export default KaryawanRaportPage;
