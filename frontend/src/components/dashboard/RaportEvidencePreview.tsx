import React, { useState } from 'react';
import { Ban, Image as ImageIcon, Video } from 'lucide-react';
import { getEvidenceUrls, type PicRaportEvidence } from '../../data/picRaportData';
import { ImagePreviewModal, type PreviewImage } from '../ui';

interface RaportEvidencePreviewProps {
  item: PicRaportEvidence;
  maxItems?: number;
  compact?: boolean;
}

const RaportEvidencePreview: React.FC<RaportEvidencePreviewProps> = ({ item, maxItems = 6, compact = false }) => {
  const urls = getEvidenceUrls(item);
  const visibleUrls = urls.slice(0, maxItems);
  const extraCount = Math.max(0, urls.length - visibleUrls.length);
  const [preview, setPreview] = useState<{ images: PreviewImage[]; initialIndex: number } | null>(null);
  const previewImages = urls.map((src, index) => ({
    src,
    alt: `Bukti ${item.jobdeskText} ${index + 1}`,
    caption: `Gambar ${index + 1} dari jobdesk ${item.jobdeskIndex + 1}`,
  }));

  if (item.mode === 'none' || urls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/20 bg-surface/70 px-3 py-3 text-label-sm font-semibold text-on-surface-variant">
        <div className="flex items-center gap-2">
          <Ban className="h-4 w-4" />
          {item.mode === 'none' ? 'Karyawan menandai tidak ada bukti.' : 'Bukti belum terlampir.'}
        </div>
      </div>
    );
  }

  if (item.mode === 'video') {
    return (
      <div className="rounded-lg border border-outline-variant/15 bg-surface p-2">
        <video src={urls[0]} controls className={compact ? 'h-40 w-full rounded-md bg-surface-high object-contain' : 'max-h-72 w-full rounded-md bg-surface-high object-contain'} />
        <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-surface-high px-2.5 py-1.5 text-label-xs font-bold text-primary">
          <Video className="h-3.5 w-3.5" />
          Preview video
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2'}`}>
        {visibleUrls.map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={() => setPreview({ images: previewImages, initialIndex: index })}
            className="group overflow-hidden rounded-lg border border-outline-variant/15 bg-surface p-2 text-left transition hover:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <img
              src={url}
              alt={`Bukti ${item.jobdeskText} ${index + 1}`}
              loading="lazy"
              decoding="async"
              className={compact ? 'h-24 w-full rounded-md object-contain' : 'h-36 w-full rounded-md object-contain'}
            />
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Gambar {index + 1}
              </span>
              <span className="transition group-hover:text-primary">Perbesar</span>
            </div>
          </button>
        ))}
        {extraCount > 0 && (
          <button
            type="button"
            onClick={() => setPreview({ images: previewImages, initialIndex: visibleUrls.length })}
            className="grid min-h-24 place-items-center rounded-lg border border-outline-variant/15 bg-surface px-3 py-4 text-center text-label-sm font-bold text-on-surface-variant transition hover:border-primary/30 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            +{extraCount} bukti lain
          </button>
        )}
      </div>
      {preview && (
        <ImagePreviewModal
          images={preview.images}
          initialIndex={preview.initialIndex}
          title="Preview bukti jobdesk"
          subtitle={item.jobdeskText}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
};

export default RaportEvidencePreview;
