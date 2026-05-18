import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';

export interface PreviewImage {
  src: string;
  alt: string;
  caption?: string;
}

interface ImagePreviewModalProps {
  images: PreviewImage[];
  initialIndex?: number;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  images,
  initialIndex = 0,
  title = 'Preview bukti',
  subtitle,
  onClose,
}) => {
  const safeImages = useMemo(() => images.filter((image) => image.src), [images]);
  const [activeIndex, setActiveIndex] = useState(() => Math.min(Math.max(initialIndex, 0), Math.max(safeImages.length - 1, 0)));
  const activeImage = safeImages[activeIndex];
  const canNavigate = safeImages.length > 1;

  useEffect(() => {
    setActiveIndex(Math.min(Math.max(initialIndex, 0), Math.max(safeImages.length - 1, 0)));
  }, [initialIndex, safeImages.length]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && canNavigate) {
        setActiveIndex((current) => (current === 0 ? safeImages.length - 1 : current - 1));
      }
      if (event.key === 'ArrowRight' && canNavigate) {
        setActiveIndex((current) => (current + 1) % safeImages.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canNavigate, onClose, safeImages.length]);

  if (!activeImage) return null;

  const goToPrevious = () => setActiveIndex((current) => (current === 0 ? safeImages.length - 1 : current - 1));
  const goToNext = () => setActiveIndex((current) => (current + 1) % safeImages.length);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-on-surface/75 px-3 py-4 backdrop-blur-sm sm:px-5" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Tutup preview" onClick={onClose} />

      <div className="relative flex h-full max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant/15 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-title-sm font-black text-on-surface">{title}</p>
            {subtitle && <p className="mt-0.5 truncate text-label-sm text-on-surface-variant">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={activeImage.src}
              target="_blank"
              rel="noreferrer"
              className="grid h-9 w-9 place-items-center rounded-lg border border-outline-variant/20 bg-surface-high text-on-surface-variant transition hover:text-primary"
              aria-label="Buka gambar di tab baru"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-lg border border-outline-variant/20 bg-surface-high text-on-surface-variant transition hover:text-error"
              aria-label="Tutup preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 bg-surface-high/50">
          <div className="flex h-full items-center justify-center p-3 sm:p-5">
            <img
              src={activeImage.src}
              alt={activeImage.alt}
              className="max-h-full max-w-full rounded-lg object-contain shadow-lg"
              decoding="async"
            />
          </div>

          {canNavigate && (
            <>
              <button
                type="button"
                onClick={goToPrevious}
                className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-outline-variant/20 bg-surface/95 text-on-surface shadow-lg transition hover:text-primary"
                aria-label="Gambar sebelumnya"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-outline-variant/20 bg-surface/95 text-on-surface shadow-lg transition hover:text-primary"
                aria-label="Gambar berikutnya"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-outline-variant/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="min-w-0 truncate text-label-sm font-semibold text-on-surface">{activeImage.caption || activeImage.alt}</p>
          {canNavigate && (
            <div className="flex items-center gap-2">
              <span className="text-label-xs font-bold text-on-surface-variant">{activeIndex + 1} / {safeImages.length}</span>
              <div className="flex gap-1">
                {safeImages.map((image, index) => (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-outline-variant/40 hover:bg-outline-variant'}`}
                    aria-label={`Lihat gambar ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
