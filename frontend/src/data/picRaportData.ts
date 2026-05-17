import { employeeRaports, jobdeskPositions, type EmployeeRaport, type JobdeskPosition } from './ownerRaportData';

export type PicRaportEvidenceMode = 'image' | 'video' | 'none';
export type PicRaportReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PicRaportEvidence {
  id: string;
  employeeId: string;
  employeeName: string;
  cabang: string;
  divisiId: string;
  divisiName: string;
  tanggal: string;
  submittedAt: string;
  jobdeskIndex: number;
  jobdeskText: string;
  mode: PicRaportEvidenceMode;
  evidenceUrl?: string;
  employeeNote?: string;
  reviewStatus: PicRaportReviewStatus;
  score?: number;
  reviewerComment?: string;
  reviewedAt?: string;
}

export interface PicRaportDaySummary {
  tanggal: string;
  masuk: number;
  pending: number;
  approved: number;
  rejected: number;
  rataNilai: number;
}

export interface PicEmployeeSummary extends EmployeeRaport {
  pendingEvidence: number;
  rejectedEvidence: number;
  approvedEvidence: number;
  averageScore: number;
  lastUploadAt?: string;
}

const branchUploadOffsets: Record<string, number> = {
  'Manado Pusat': 7,
  Tomohon: 12,
  Bitung: 16,
  Minahasa: 21,
  Kotamobagu: 25,
  Tondano: 29,
  Airmadidi: 34,
  Langowan: 38,
  Ratahan: 42,
  Amurang: 46,
  Tahuna: 50,
  Tagulandang: 54,
  Lirung: 58,
  Ondong: 62,
  Beo: 66,
  Melonguane: 70,
};

const sampleImages = [
  '/assets/images/landing/categories/cat-electronics.webp',
  '/assets/images/landing/categories/cat-mobility.webp',
  '/assets/images/landing/categories/cat-furniture.webp',
  '/assets/images/defaults/default-tv.webp',
  '/assets/images/defaults/default-sepeda-listrik.webp',
];

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayKey = toDateKey(new Date());

const dateFromOffset = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  return toDateKey(date);
};

const normalizeDivisiId = (value: string) => {
  const normalized = value.toLowerCase().trim();
  return (
    jobdeskPositions.find((position) => position.id === normalized)?.id ||
    jobdeskPositions.find((position) => position.posisi.toLowerCase() === normalized)?.id ||
    jobdeskPositions.find((position) => normalized.includes(position.id))?.id ||
    jobdeskPositions[0]?.id ||
    'umum'
  );
};

export const getDivisionForEmployee = (employee: Pick<EmployeeRaport, 'posisi'>): JobdeskPosition => {
  const divisiId = normalizeDivisiId(employee.posisi);
  return (
    jobdeskPositions.find((position) => position.id === divisiId) ||
    jobdeskPositions.find((position) => position.posisi === employee.posisi) ||
    jobdeskPositions[0]
  );
};

const statusFor = (employeeIndex: number, jobdeskIndex: number, dayOffset: number): PicRaportReviewStatus => {
  const seed = employeeIndex * 11 + jobdeskIndex * 7 + dayOffset;
  if (dayOffset === 0 && seed % 5 !== 0) return 'pending';
  if (seed % 13 === 0) return 'rejected';
  return 'approved';
};

const modeFor = (employeeIndex: number, jobdeskIndex: number): PicRaportEvidenceMode => {
  const value = (employeeIndex + jobdeskIndex) % 6;
  if (value === 0) return 'none';
  if (value === 1 || value === 4) return 'video';
  return 'image';
};

const scoreFor = (reviewStatus: PicRaportReviewStatus, employee: EmployeeRaport, jobdeskIndex: number) => {
  if (reviewStatus === 'pending') return undefined;
  if (reviewStatus === 'rejected') return 0;
  const base = Math.max(55, Math.min(96, employee.persentase + 14));
  return Math.max(55, Math.min(100, base - (jobdeskIndex % 3) * 3));
};

export const generateSeedPicEvidence = (): PicRaportEvidence[] => {
  const selectedEmployees = employeeRaports.slice(0, 40);
  const dayOffsets = [0, 1, 2, 4, 6, 9, 13, 18, 24];

  return selectedEmployees.flatMap((employee, employeeIndex) => {
    const division = getDivisionForEmployee(employee);
    const jobdeskCount = Math.min(division.jobdesks.length, Math.max(3, employee.selesai || 3));
    const branchOffset = branchUploadOffsets[employee.cabang] ?? 10;

    return dayOffsets.flatMap((dayOffset) => {
      const jobsForDay = dayOffset === 0 ? Math.min(jobdeskCount, 4) : Math.min(3, jobdeskCount);
      return Array.from({ length: jobsForDay }, (_, jobdeskIndex) => {
        const mode = modeFor(employeeIndex, jobdeskIndex + dayOffset);
        const reviewStatus = statusFor(employeeIndex, jobdeskIndex, dayOffset);
        const submittedHour = 9 + ((employeeIndex + jobdeskIndex + dayOffset) % 8);
        const submittedMinute = (branchOffset + jobdeskIndex * 9) % 60;
        const tanggal = dateFromOffset(dayOffset);

        return {
          id: `${employee.id}-${tanggal}-${jobdeskIndex}`,
          employeeId: employee.id,
          employeeName: employee.nama,
          cabang: employee.cabang,
          divisiId: division.id,
          divisiName: division.posisi,
          tanggal,
          submittedAt: `${tanggal}T${String(submittedHour).padStart(2, '0')}:${String(submittedMinute).padStart(2, '0')}:00`,
          jobdeskIndex,
          jobdeskText: division.jobdesks[jobdeskIndex] || `Jobdesk ${jobdeskIndex + 1}`,
          mode,
          evidenceUrl: mode === 'image' ? sampleImages[(employeeIndex + jobdeskIndex) % sampleImages.length] : undefined,
          employeeNote: mode === 'none' ? 'Tidak ada bukti karena aktivitas tidak terjadi di shift ini.' : 'Bukti upload dari pekerjaan hari ini.',
          reviewStatus,
          score: scoreFor(reviewStatus, employee, jobdeskIndex),
          reviewerComment:
            reviewStatus === 'rejected'
              ? 'Bukti belum menunjukkan hasil jobdesk secara jelas. Upload ulang dengan konteks yang lengkap.'
              : reviewStatus === 'approved'
                ? 'Bukti sesuai, lanjutkan konsistensi pelaporan.'
                : '',
          reviewedAt: reviewStatus === 'pending' ? undefined : `${tanggal}T18:1${jobdeskIndex}:00`,
        };
      });
    });
  });
};

export const buildPicEmployeeSummaries = (evidence: PicRaportEvidence[]): PicEmployeeSummary[] => {
  const statsByEmployee = new Map<
    string,
    {
      pendingEvidence: number;
      rejectedEvidence: number;
      approvedEvidence: number;
      scoreSum: number;
      scoreCount: number;
      lastUploadAt?: string;
    }
  >();

  evidence.forEach((item) => {
    const stats =
      statsByEmployee.get(item.employeeId) ||
      {
        pendingEvidence: 0,
        rejectedEvidence: 0,
        approvedEvidence: 0,
        scoreSum: 0,
        scoreCount: 0,
        lastUploadAt: undefined,
      };

    if (item.reviewStatus === 'pending') stats.pendingEvidence += 1;
    if (item.reviewStatus === 'rejected') stats.rejectedEvidence += 1;
    if (item.reviewStatus === 'approved') stats.approvedEvidence += 1;
    if (typeof item.score === 'number') {
      stats.scoreSum += item.score;
      stats.scoreCount += 1;
    }
    if (!stats.lastUploadAt || item.submittedAt > stats.lastUploadAt) {
      stats.lastUploadAt = item.submittedAt;
    }

    statsByEmployee.set(item.employeeId, stats);
  });

  const knownEmployees = employeeRaports.filter((employee) => statsByEmployee.has(employee.id));
  const discoveredEmployees = [...statsByEmployee.keys()]
    .filter((employeeId) => !employeeRaports.some((employee) => employee.id === employeeId))
    .map((employeeId) => {
      const firstEvidence = evidence.find((item) => item.employeeId === employeeId);
      const employeeItems = evidence.filter((item) => item.employeeId === employeeId);
      const reviewed = employeeItems.filter((item) => item.reviewStatus !== 'pending').length;
      const total = Math.max(employeeItems.length, 1);

      return {
        id: employeeId,
        nama: firstEvidence?.employeeName || 'Karyawan',
        posisi: firstEvidence?.divisiName || firstEvidence?.divisiId || 'Umum',
        cabang: firstEvidence?.cabang || 'Cabang belum diatur',
        selesai: reviewed,
        totalJobdesk: total,
        persentase: Math.round((reviewed / total) * 100),
      };
    });

  return [...knownEmployees, ...discoveredEmployees].map((employee) => {
    const stats = statsByEmployee.get(employee.id);
    const totalEvidence = (stats?.pendingEvidence || 0) + (stats?.rejectedEvidence || 0) + (stats?.approvedEvidence || 0);
    const reviewedEvidence = (stats?.rejectedEvidence || 0) + (stats?.approvedEvidence || 0);
    return {
      ...employee,
      pendingEvidence: stats?.pendingEvidence || 0,
      rejectedEvidence: stats?.rejectedEvidence || 0,
      approvedEvidence: stats?.approvedEvidence || 0,
      averageScore: stats?.scoreCount
        ? Math.round(stats.scoreSum / stats.scoreCount)
        : totalEvidence
          ? Math.round((reviewedEvidence / totalEvidence) * 100)
          : 0,
      lastUploadAt: stats?.lastUploadAt,
    };
  });
};

export const buildPicDaySummaries = (evidence: PicRaportEvidence[]): PicRaportDaySummary[] => {
  const summariesByDate = new Map<
    string,
    PicRaportDaySummary & {
      scoreSum: number;
      scoreCount: number;
    }
  >();

  evidence.forEach((item) => {
    const summary =
      summariesByDate.get(item.tanggal) ||
      {
        tanggal: item.tanggal,
        masuk: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        rataNilai: 0,
        scoreSum: 0,
        scoreCount: 0,
      };

    summary.masuk += 1;
    if (item.reviewStatus === 'pending') summary.pending += 1;
    if (item.reviewStatus === 'approved') summary.approved += 1;
    if (item.reviewStatus === 'rejected') summary.rejected += 1;
    if (typeof item.score === 'number') {
      summary.scoreSum += item.score;
      summary.scoreCount += 1;
    }

    summariesByDate.set(item.tanggal, summary);
  });

  return [...summariesByDate.values()]
    .map((summary) => {
      const { scoreSum, scoreCount, ...daySummary } = summary;
      return {
        ...daySummary,
        rataNilai: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
      };
    })
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
};

export const buildPicEvidenceByDate = (evidence: PicRaportEvidence[]): Map<string, PicRaportEvidence[]> => {
  const byDate = new Map<string, PicRaportEvidence[]>();

  evidence.forEach((item) => {
    const currentItems = byDate.get(item.tanggal) || [];
    currentItems.push(item);
    byDate.set(item.tanggal, currentItems);
  });

  byDate.forEach((items) => {
    items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  });

  return byDate;
};

export const buildPicEvidenceByEmployeeDate = (evidence: PicRaportEvidence[]): Map<string, Map<string, PicRaportEvidence[]>> => {
  const byEmployeeDate = new Map<string, Map<string, PicRaportEvidence[]>>();

  evidence.forEach((item) => {
    const employeeDates = byEmployeeDate.get(item.employeeId) || new Map<string, PicRaportEvidence[]>();
    const currentItems = employeeDates.get(item.tanggal) || [];
    currentItems.push(item);
    employeeDates.set(item.tanggal, currentItems);
    byEmployeeDate.set(item.employeeId, employeeDates);
  });

  byEmployeeDate.forEach((employeeDates) => {
    employeeDates.forEach((items) => {
      items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    });
  });

  return byEmployeeDate;
};
