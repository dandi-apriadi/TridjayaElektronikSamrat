import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { UpdateBreakdown } from '../../../utils/stockReport';

type StockUpdateConfirmDialogProps = {
  open: boolean;
  breakdown: UpdateBreakdown & {
    toHidden?: number;
    toIndent?: number;
    toAvailable?: number;
  };
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const StockUpdateConfirmDialog: React.FC<StockUpdateConfirmDialogProps> = ({
  open,
  breakdown,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const total =
    (breakdown.toHidden || 0) +
    (breakdown.toIndent || 0) +
    (breakdown.toAvailable || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex rounded-lg bg-tertiary/15 p-2 text-tertiary">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-on-surface">Konfirmasi Update Stok</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {total} produk katalog akan diperbarui berdasarkan laporan stok.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-high hover:text-on-surface disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-error/20 bg-error/10 p-3 text-center">
            <div className="text-2xl font-bold text-error">{breakdown.toHidden || 0}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Hidden
            </div>
          </div>
          <div className="rounded-lg border border-tertiary/20 bg-tertiary/10 p-3 text-center">
            <div className="text-2xl font-bold text-tertiary">{breakdown.toIndent || 0}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Indent
            </div>
          </div>
          <div className="rounded-lg border border-secondary/20 bg-secondary/10 p-3 text-center">
            <div className="text-2xl font-bold text-secondary">{breakdown.toAvailable || 0}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Available
            </div>
          </div>
        </div>

        {breakdown.itemsWithIssues > 0 && (
          <p className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-500">
            {breakdown.itemsWithIssues} item punya issue dan perlu dicek sebelum/ setelah update.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:text-on-surface disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || total === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-surface transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Stok
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockUpdateConfirmDialog;
