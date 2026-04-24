import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Megaphone, Upload } from 'lucide-react';
import { usePromoStore } from '../../store/usePromoStore';
import { toast } from '../../store/useNotificationStore';
import type { PromoItem } from '../../types';
import { adminPromoSchema, getFirstZodIssue } from '../../validators/adminSchemas';

const AdminPromoFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createPromo, updatePromo, getPromoById } = usePromoStore();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Partial<PromoItem>>({
    title: '',
    subtitle: '',
    description: '',
    discount: 0,
    originalPrice: 0,
    promoPrice: 0,
    image: '',
    badge: 'Diskon',
    validUntil: '',
    category: 'Diskon',
    variant: 'hero'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      const promo = getPromoById(id);
      if (promo) {
        setFormData(promo);
      } else {
        toast.error('Promo tidak ditemukan');
        navigate('/dashboard/admin/promo');
      }
    }
  }, [id, isEditMode, navigate, getPromoById]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Price') || name === 'discount' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = adminPromoSchema.safeParse(formData);
    if (!parsed.success) {
      toast.error('Validasi form gagal', getFirstZodIssue(parsed.error));
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = parsed.data;
      if (isEditMode) {
        const success = await updatePromo(id!, payload);
        if (success) {
          toast.success('Promo berhasil diperbarui');
          navigate('/dashboard/admin/promo');
        } else {
          toast.error('Gagal memperbarui promo');
        }
      } else {
        const newId = `PRM-${Math.floor(Math.random() * 1000)}`;
        const success = await createPromo({ ...payload, id: newId });
        if (success) {
          toast.success('Promo berhasil ditambahkan');
          navigate('/dashboard/admin/promo');
        } else {
          toast.error('Gagal menambahkan promo');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard/admin/promo" className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-display text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-tertiary" /> {isEditMode ? 'Edit Promo' : 'Buat Promo Baru'}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Detail Promo</h3>
            
            <div className="space-y-1.5 flex-1">
              <label className="text-label-sm font-semibold text-on-surface-variant">Judul Promo</label>
              <input required name="title" value={formData.title || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none" />
            </div>

            <div className="space-y-1.5 flex-1">
              <label className="text-label-sm font-semibold text-on-surface-variant">Subjudul</label>
              <input required name="subtitle" value={formData.subtitle || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Diskon (%)</label>
                <input name="discount" value={formData.discount || ''} onChange={handleChange} type="number" min="0" max="100" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kategori</label>
                <select name="category" value={formData.category || 'Diskon'} onChange={handleChange} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none">
                  <option value="Diskon">Diskon</option>
                  <option value="Cashback">Cashback</option>
                  <option value="Flash Sale">Flash Sale</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">Berlaku Hingga</label>
              <input required name="validUntil" value={formData.validUntil || ''} onChange={handleChange} type="date" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">Deskripsi Promo</label>
              <textarea required name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none resize-none" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Media Promo</h3>
            <div className="space-y-3">
              <div className="aspect-[2/1] w-full rounded-xl bg-surface-high border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center p-4 overflow-hidden">
                {formData.image ? (
                  <img src={formData.image} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-on-surface-variant/50 mb-2" />
                    <p className="text-label-sm text-on-surface-variant">URL Banner Promo</p>
                  </>
                )}
              </div>
              <input required name="image" placeholder="https://..." value={formData.image || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-tertiary/40 outline-none" />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-tertiary flex items-center justify-center gap-2 font-body text-body-md font-bold text-on-primary hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
               <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> {isEditMode ? 'Simpan Perubahan' : 'Publish Promo'}</>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AdminPromoFormPage;
