import React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Images, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LandingHeroSlideData } from '../../types';
import { useLandingStore } from '../../store/useLandingStore';
import { toast } from '../../store/useNotificationStore';
import { getImageUrl } from '../../utils/apiClient';

type SlideForm = {
  id?: string;
  eyebrow: string;
  title: string;
  accent: string;
  copy: string;
  href: string;
  cta: string;
  bgImageUrl: string;
  productImageUrl: string;
  productAlt: string;
  iconKey: string;
  price: string;
  oldPrice: string;
  detailLine: string;
  sortOrder: number;
  isActive: boolean;
  metricsText: string;
  specsText: string;
};

const emptyForm = (sortOrder = 0): SlideForm => ({
  eyebrow: '',
  title: '',
  accent: '',
  copy: '',
  href: '/produk?kategori=Sepeda+Listrik',
  cta: 'Lihat Produk',
  bgImageUrl: '',
  productImageUrl: '',
  productAlt: '',
  iconKey: 'bike',
  price: '',
  oldPrice: '',
  detailLine: '',
  sortOrder,
  isActive: true,
  metricsText: JSON.stringify([{ iconKey: 'zap', value: '800W', label: 'motor' }], null, 2),
  specsText: JSON.stringify([{ iconKey: 'battery', value: '60V 20Ah', label: 'baterai' }], null, 2),
});

const toForm = (slide: LandingHeroSlideData): SlideForm => ({
  id: slide.id,
  eyebrow: slide.eyebrow,
  title: slide.title,
  accent: slide.accent,
  copy: slide.copy,
  href: slide.href,
  cta: slide.cta,
  bgImageUrl: slide.bgImageUrl,
  productImageUrl: slide.productImageUrl,
  productAlt: slide.productAlt,
  iconKey: slide.iconKey,
  price: slide.price,
  oldPrice: slide.oldPrice,
  detailLine: slide.detailLine,
  sortOrder: slide.sortOrder,
  isActive: slide.isActive,
  metricsText: JSON.stringify(slide.metrics ?? [], null, 2),
  specsText: JSON.stringify(slide.specs ?? [], null, 2),
});

const parseJsonArray = (value: string, label: string) => {
  const parsed = JSON.parse(value || '[]');
  if (!Array.isArray(parsed)) throw new Error(`${label} harus berupa array JSON`);
  return parsed;
};

const AdminLandingSlidesPage: React.FC = () => {
  const {
    slides,
    isLoadingSlides,
    error,
    fetchSlides,
    createSlide,
    updateSlide,
    deleteSlide,
    updateSlideOrder,
    uploadSlideImage,
  } = useLandingStore();
  const [form, setForm] = React.useState<SlideForm>(() => emptyForm());
  const [isSaving, setIsSaving] = React.useState(false);
  const [uploadingField, setUploadingField] = React.useState<'bgImageUrl' | 'productImageUrl' | null>(null);

  React.useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  React.useEffect(() => {
    if (!form.id && slides.length > 0 && form.sortOrder === 0) {
      setForm((current) => ({ ...current, sortOrder: slides.length }));
    }
  }, [form.id, form.sortOrder, slides.length]);

  const updateField = <K extends keyof SlideForm>(key: K, value: SlideForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm(slides.length));
  };

  const saveForm = async () => {
    setIsSaving(true);
    try {
      const payload = {
        eyebrow: form.eyebrow,
        title: form.title,
        accent: form.accent,
        copy: form.copy,
        href: form.href,
        cta: form.cta,
        bgImageUrl: form.bgImageUrl,
        productImageUrl: form.productImageUrl,
        productAlt: form.productAlt,
        iconKey: form.iconKey,
        price: form.price,
        oldPrice: form.oldPrice,
        detailLine: form.detailLine,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        metrics: parseJsonArray(form.metricsText, 'Metrics'),
        specs: parseJsonArray(form.specsText, 'Specs'),
      };
      const saved = form.id ? await updateSlide(form.id, payload) : await createSlide(payload);
      setForm(toForm(saved));
      toast.success(form.id ? 'Slide diperbarui' : 'Slide ditambahkan');
    } catch (error) {
      toast.error('Gagal menyimpan slide', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  const removeSlide = async (slide: LandingHeroSlideData) => {
    if (!window.confirm(`Hapus slide "${slide.eyebrow}"?`)) return;
    try {
      await deleteSlide(slide.id);
      if (form.id === slide.id) resetForm();
      toast.success('Slide dihapus');
    } catch (error) {
      toast.error('Gagal menghapus slide', error instanceof Error ? error.message : 'Terjadi kesalahan');
    }
  };

  const moveSlide = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= slides.length) return;

    const reordered = [...slides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    const payload = reordered.map((slide, order) => ({ id: slide.id, sortOrder: order }));
    try {
      await updateSlideOrder(payload);
      toast.success('Urutan slide diperbarui');
    } catch (error) {
      toast.error('Gagal mengurutkan slide', error instanceof Error ? error.message : 'Terjadi kesalahan');
    }
  };

  const handleUpload = async (field: 'bgImageUrl' | 'productImageUrl', file?: File) => {
    if (!file) return;
    setUploadingField(field);
    try {
      const url = await uploadSlideImage(file);
      updateField(field, url);
      toast.success('Gambar berhasil diunggah', 'File disimpan sebagai WebP');
    } catch (error) {
      toast.error('Upload gagal', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setUploadingField(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="mb-1 text-label-sm font-semibold uppercase tracking-widest text-on-surface-variant">Landing Page</p>
            <h2 className="inline-flex items-center gap-3 font-display text-headline-sm font-bold text-on-surface">
              <Images className="h-6 w-6 text-primary" />
              Landing Slides
            </h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Kelola hero slide publik. Gambar upload selalu diproses menjadi WebP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchSlides(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-surface-high px-4 py-2.5 text-label-sm font-semibold text-on-surface-variant transition hover:text-on-surface"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-lg bg-primary/15 px-4 py-2.5 text-label-sm font-semibold text-primary transition hover:bg-primary/25"
            >
              <Plus className="h-4 w-4" />
              Slide Baru
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-error/20 bg-error/8 p-4 text-body-sm text-error">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <div className="glass-card rounded-xl p-5">
          <h3 className="mb-4 font-display text-title-md font-bold text-on-surface">Daftar Slide</h3>
          <div className="space-y-3">
            {isLoadingSlides ? (
              <div className="py-10 text-center text-body-sm text-on-surface-variant">Memuat slide...</div>
            ) : slides.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/30 p-6 text-center text-body-sm text-on-surface-variant">
                Belum ada slide.
              </div>
            ) : (
              slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`rounded-xl border p-3 transition ${form.id === slide.id ? 'border-primary/50 bg-primary/8' : 'border-outline-variant/20 bg-surface-container/50'}`}
                >
                  <button type="button" onClick={() => setForm(toForm(slide))} className="flex w-full items-center gap-3 text-left">
                    <img
                      src={getImageUrl(slide.productImageUrl)}
                      alt={slide.productAlt || slide.eyebrow}
                      className="h-16 w-16 rounded-lg bg-surface-high object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-title-sm font-bold text-on-surface">{slide.eyebrow}</span>
                      <span className="mt-1 line-clamp-2 text-body-xs text-on-surface-variant">{slide.title}</span>
                    </span>
                    {slide.isActive ? <Eye className="h-4 w-4 text-secondary" /> : <EyeOff className="h-4 w-4 text-on-surface-variant" />}
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/15 pt-3">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveSlide(index, -1)} className="rounded-lg bg-surface-high p-2 text-on-surface-variant hover:text-on-surface" aria-label="Naikkan slide">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => moveSlide(index, 1)} className="rounded-lg bg-surface-high p-2 text-on-surface-variant hover:text-on-surface" aria-label="Turunkan slide">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeSlide(slide)} className="rounded-lg bg-error/10 p-2 text-error hover:bg-error/15" aria-label="Hapus slide">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="font-display text-title-md font-bold text-on-surface">
              {form.id ? 'Edit Slide' : 'Tambah Slide'}
            </h3>
            <label className="inline-flex cursor-pointer items-center gap-2 text-label-sm font-semibold text-on-surface-variant">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateField('isActive', event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Aktif
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Eyebrow" value={form.eyebrow} onChange={(value) => updateField('eyebrow', value)} />
            <Field label="Icon Key" value={form.iconKey} onChange={(value) => updateField('iconKey', value)} />
            <Field label="Judul" value={form.title} onChange={(value) => updateField('title', value)} className="md:col-span-2" />
            <Field label="Accent" value={form.accent} onChange={(value) => updateField('accent', value)} className="md:col-span-2" />
            <TextArea label="Copy" value={form.copy} onChange={(value) => updateField('copy', value)} className="md:col-span-2" />
            <Field label="CTA" value={form.cta} onChange={(value) => updateField('cta', value)} />
            <Field label="Href" value={form.href} onChange={(value) => updateField('href', value)} />
            <Field label="Harga" value={form.price} onChange={(value) => updateField('price', value)} />
            <Field label="Harga Lama / Note" value={form.oldPrice} onChange={(value) => updateField('oldPrice', value)} />
            <Field label="Alt Produk" value={form.productAlt} onChange={(value) => updateField('productAlt', value)} />
            <Field label="Urutan" type="number" value={String(form.sortOrder)} onChange={(value) => updateField('sortOrder', Number(value))} />
            <Field label="Detail Line" value={form.detailLine} onChange={(value) => updateField('detailLine', value)} className="md:col-span-2" />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ImageInput
              label="Background Image"
              value={form.bgImageUrl}
              busy={uploadingField === 'bgImageUrl'}
              onChange={(value) => updateField('bgImageUrl', value)}
              onUpload={(file) => handleUpload('bgImageUrl', file)}
            />
            <ImageInput
              label="Product Image"
              value={form.productImageUrl}
              busy={uploadingField === 'productImageUrl'}
              onChange={(value) => updateField('productImageUrl', value)}
              onUpload={(file) => handleUpload('productImageUrl', file)}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextArea label="Metrics JSON" value={form.metricsText} onChange={(value) => updateField('metricsText', value)} rows={8} />
            <TextArea label="Specs JSON" value={form.specsText} onChange={(value) => updateField('specsText', value)} rows={8} />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={saveForm}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 font-display text-label-sm font-black text-on-primary shadow-neon-cyan transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Slide'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  className = '',
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  type?: React.HTMLInputTypeAttribute;
}) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
    />
  </label>
);

const TextArea = ({
  label,
  value,
  onChange,
  className = '',
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  rows?: number;
}) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
    <textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full resize-y rounded-xl border border-outline-variant/20 bg-surface-high px-4 py-3 font-mono text-body-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
    />
  </label>
);

const ImageInput = ({
  label,
  value,
  busy,
  onChange,
  onUpload,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onUpload: (file?: File) => void;
}) => (
  <div>
    <span className="mb-1.5 block text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{label}</span>
    <div className="rounded-xl border border-outline-variant/20 bg-surface-container/45 p-3">
      {value ? (
        <img src={getImageUrl(value)} alt={label} className="mb-3 aspect-video w-full rounded-lg bg-surface-high object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="mb-3 grid aspect-video w-full place-items-center rounded-lg bg-surface-high text-body-sm text-on-surface-variant">
          Belum ada gambar
        </div>
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="/uploads/landing/slide.webp"
        className="mb-3 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-3 py-2 text-body-xs text-on-surface outline-none"
      />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-secondary/15 px-3 py-2 text-label-sm font-semibold text-secondary transition hover:bg-secondary/25">
        <Upload className="h-4 w-4" />
        {busy ? 'Uploading...' : 'Upload WebP'}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(event) => onUpload(event.target.files?.[0])}
        />
      </label>
    </div>
  </div>
);

export default AdminLandingSlidesPage;
