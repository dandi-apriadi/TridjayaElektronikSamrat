import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSeedPicEvidence, type PicRaportEvidence, type PicRaportReviewStatus } from '../data/picRaportData';
import { jobdeskPositions, type JobdeskPosition } from '../data/ownerRaportData';

interface ReviewPayload {
  status: PicRaportReviewStatus;
  score?: number;
  comment?: string;
}

interface PicRaportStore {
  evidence: PicRaportEvidence[];
  divisions: JobdeskPosition[];
  reviewEvidence: (id: string, payload: ReviewPayload) => void;
  addDivision: (name: string) => void;
  addJobdesk: (divisionId: string, jobdesk: string) => void;
}

const slugifyDivision = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `divisi-${Date.now()}`;
};

export const usePicRaportStore = create<PicRaportStore>()(
  persist(
    (set) => ({
      evidence: generateSeedPicEvidence(),
      divisions: jobdeskPositions,
      reviewEvidence: (id, payload) =>
        set((state) => ({
          evidence: state.evidence.map((item) =>
            item.id === id
              ? {
                  ...item,
                  reviewStatus: payload.status,
                  score: payload.status === 'rejected' ? 0 : payload.score,
                  reviewerComment: payload.comment?.trim() || '',
                  reviewedAt: new Date().toISOString(),
                }
              : item
          ),
        })),
      addDivision: (name) =>
        set((state) => {
          const trimmedName = name.trim();
          if (!trimmedName) return state;

          const id = slugifyDivision(trimmedName);
          if (state.divisions.some((division) => division.id === id || division.posisi.toLowerCase() === trimmedName.toLowerCase())) {
            return state;
          }

          return {
            divisions: [
              ...state.divisions,
              {
                id,
                posisi: trimmedName,
                jobdesks: [],
              },
            ],
          };
        }),
      addJobdesk: (divisionId, jobdesk) =>
        set((state) => {
          const trimmedJobdesk = jobdesk.trim();
          if (!trimmedJobdesk) return state;

          return {
            divisions: state.divisions.map((division) =>
              division.id === divisionId
                ? {
                    ...division,
                    jobdesks: division.jobdesks.includes(trimmedJobdesk)
                      ? division.jobdesks
                      : [...division.jobdesks, trimmedJobdesk],
                  }
                : division
            ),
          };
        }),
    }),
    {
      name: 'tridjaya-pic-raport',
      partialize: (state) => ({
        evidence: state.evidence,
        divisions: state.divisions,
      }),
    }
  )
);
