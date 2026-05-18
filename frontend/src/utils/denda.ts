import type { PicRaportEvidence } from '../data/picRaportData';

export const DENDA_PER_HARI = 100_000;
export const JOBDESK_FINE_MIN_SCORE = 80;

export const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(amount, 0));

export const calculateProspekDailyFine = (actual: number, target: number) =>
  target > 0 && actual < target ? DENDA_PER_HARI : 0;

export const calculateJobdeskScoreFine = (score: number, hasScore: boolean) =>
  hasScore && score < JOBDESK_FINE_MIN_SCORE ? DENDA_PER_HARI : 0;

export const summarizeRaportScore = (items: PicRaportEvidence[]) => {
  const scoredItems = items.filter((item) => typeof item.score === 'number' || item.reviewStatus === 'rejected');
  const score = scoredItems.length
    ? Math.round(scoredItems.reduce((sum, item) => sum + (item.reviewStatus === 'rejected' ? 0 : item.score || 0), 0) / scoredItems.length)
    : 0;

  return {
    score,
    scoredCount: scoredItems.length,
    fine: calculateJobdeskScoreFine(score, scoredItems.length > 0),
  };
};

export const calculateRaportFineTotal = (dailyScores: Array<{ score: number; hasScore: boolean }>) =>
  dailyScores.reduce((sum, item) => sum + calculateJobdeskScoreFine(item.score, item.hasScore), 0);
