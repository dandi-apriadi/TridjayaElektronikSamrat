import React, { useEffect, useState } from 'react';
import { Ban, MessageSquareText, Send, Star } from 'lucide-react';
import { type PicRaportEvidence, type PicRaportReviewStatus } from '../../data/picRaportData';
import { usePicRaportStore } from '../../store/picRaportStore';

interface PicEvidenceReviewControlsProps {
  item: PicRaportEvidence;
}

const scorePresets = [70, 85, 100];

const PicEvidenceReviewControls: React.FC<PicEvidenceReviewControlsProps> = ({ item }) => {
  const reviewEvidence = usePicRaportStore((state) => state.reviewEvidence);
  const [score, setScore] = useState(String(item.score ?? 85));
  const [comment, setComment] = useState(item.reviewerComment || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setScore(String(item.score ?? 85));
    setComment(item.reviewerComment || '');
    setMessage('');
  }, [item.id, item.score, item.reviewerComment]);

  const submitReview = async (status: PicRaportReviewStatus) => {
    if (busy) return;
    const numericScore = Math.max(0, Math.min(100, Number(score) || 0));
    setBusy(true);
    setMessage('');

    try {
      await reviewEvidence(item.id, {
        status,
        score: status === 'rejected' ? 0 : numericScore,
        comment: comment.trim(),
      });
      setMessage(status === 'rejected' ? 'Bukti ditolak dan nilai dibuat 0.' : 'Nilai dan komentar tersimpan.');
      window.setTimeout(() => setMessage(''), 2400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-outline-variant/15 bg-surface p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-label-sm font-black text-on-surface">
          <Star className="h-4 w-4 text-secondary" />
          Nilai cepat PIC
        </div>
        <div className="flex flex-wrap gap-1">
          {scorePresets.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScore(String(value))}
              disabled={busy}
              className="h-7 rounded-md bg-surface-high px-2 text-[11px] font-black text-on-surface-variant transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)]">
        <label className="space-y-1.5">
          <span className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Nilai</span>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(event) => setScore(event.target.value)}
            disabled={busy}
            className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-body-sm font-bold text-on-surface outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">Komentar</span>
          <div className="relative">
            <MessageSquareText className="absolute left-3 top-3 h-4 w-4 text-on-surface-variant" />
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={busy}
              rows={2}
              placeholder="Catatan nilai atau alasan penolakan"
              className="w-full resize-none rounded-lg border border-outline-variant/20 bg-surface-high py-2 pl-9 pr-3 text-body-sm text-on-surface outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
        <button
          type="button"
          onClick={() => submitReview('rejected')}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-error/25 bg-error/10 px-3 text-label-sm font-bold text-error transition hover:bg-error hover:text-on-error disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Ban className="h-4 w-4" />
          {busy ? 'Menyimpan...' : 'Tolak'}
        </button>
        <button
          type="button"
          onClick={() => submitReview('approved')}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-label-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy ? 'Menyimpan...' : 'Simpan'}
        </button>
        {message && (
          <p className={`text-label-xs font-bold ${message.includes('gagal') || message.includes('Gagal') ? 'text-error' : 'text-primary'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default PicEvidenceReviewControls;
