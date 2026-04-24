import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Package, Upload } from 'lucide-react';
import { useProductStore } from '../../store/useProductStore';
import { toast } from '../../store/useNotificationStore';
import type { Product } from '../../types';
import { adminProductSchema, getFirstZodIssue } from '../../validators/adminSchemas';

const AdminProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createProduct, updateProduct } = useProductStore();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    slug: '',
    category: 'bike',
    price: 0,
    priceInstallment: 0,
    dpMin: 0,
    stock: 'available',
    image: '',
    description: '',
    shortDesc: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      // In real scenario, the params ID could be ID or slug. The table links to ID.
      // We should ideally have getProductById, but let's assume we can find it
      const products = useProductStore.getState().products;
      const product = products.find(p => p.id === id || p.slug === id);
      if (product) {
        setFormData(product);
      } else {
        toast.error('Produk tidak ditemukan');
        navigate('/dashboard/admin/catalog');
      }
    }
  }, [id, isEditMode, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('price') || name === 'dpMin' ? Number(value) : value
    }));
  };

  const handleSlugify = () => {
    if (formData.name) {
      setFormData(prev => ({ ...prev, slug: formData.name!.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = adminProductSchema.safeParse(formData);
    if (!parsed.success) {
      toast.error('Validasi form gagal', getFirstZodIssue(parsed.error));
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = parsed.data;
      if (isEditMode) {
        const success = await updateProduct(id!, payload);
        if (success) {
          toast.success('Produk berhasil diperbarui');
          navigate('/dashboard/admin/catalog');
        } else {
          toast.error('Gagal memperbarui produk');
        }
      } else {
        const newId = `PRD-${Math.floor(Math.random() * 1000)}`;
        const success = await createProduct({ ...payload, id: newId });
        if (success) {
          toast.success('Produk berhasil ditambahkan');
          navigate('/dashboard/admin/catalog');
        } else {
          toast.error('Gagal menambahkan produk');
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
        <Link to="/dashboard/admin/catalog" className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-display text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> {isEditMode ? 'Edit Produk' : 'Tambah Produk Baru'}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Informasi Dasar</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Nama Produk</label>
                <input required name="name" value={formData.name || ''} onChange={handleChange} onBlur={handleSlugify} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Slug URL</label>
                <input required name="slug" value={formData.slug || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kategori</label>
                <select required name="category" value={formData.category || 'bike'} onChange={handleChange} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none">
                  <option value="bike">Sepeda / Skuter Listrik</option>
                  <option value="electronics">Elektronik</option>
                  <option value="furniture">Furnitur</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Sub Kategori</label>
                <input name="subcategory" value={formData.subcategory || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <label className="text-label-sm font-semibold text-on-surface-variant">Deskripsi Singkat</label>
              <textarea required name="shortDesc" value={formData.shortDesc || ''} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none resize-none" />
            </div>

            <div className="space-y-1.5 mt-4">
              <label className="text-label-sm font-semibold text-on-surface-variant">Deskripsi Lengkap</label>
              <textarea required name="description" value={formData.description || ''} onChange={handleChange} rows={5} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none resize-none" />
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Harga & Inventori</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Harga Retail (Rp)</label>
                <input required name="price" value={formData.price || ''} onChange={handleChange} type="number" min="0" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Harga Cicilan / Bulan (Rp) (Opsional)</label>
                <input name="priceInstallment" value={formData.priceInstallment || ''} onChange={handleChange} type="number" min="0" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">DP Minimum (Rp) (Opsional)</label>
                <input name="dpMin" value={formData.dpMin || ''} onChange={handleChange} type="number" min="0" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Status Stok</label>
                <select name="stock" value={formData.stock || 'available'} onChange={handleChange} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none">
                  <option value="available">Tersedia</option>
                  <option value="indent">Pre-Order (Indent)</option>
                  <option value="hidden">Habis / Sembunyikan</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Media Utama</h3>
            <div className="space-y-3">
              <div className="aspect-square w-full rounded-xl bg-surface-high border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center p-4">
                {formData.image ? (
                  <img src={formData.image} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-on-surface-variant/50 mb-2" />
                    <p className="text-label-sm text-on-surface-variant">Masukkan URL gambar atau upload langsung (simulasi)</p>
                  </>
                )}
              </div>
              <input required name="image" placeholder="URL Gambar Utama" value={formData.image || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
            </div>
          </div>

          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Atribut Tambahan</h3>
            <div className="space-y-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">Status Badge</label>
              <select name="badge" value={formData.badge || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none">
                <option value="">Tidak Ada</option>
                <option value="eco">Promo / Eco</option>
                <option value="new">Baru</option>
                <option value="sale">Diskon</option>
                <option value="popular">Populer</option>
                <option value="limited">Terbatas</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl gradient-primary flex items-center justify-center gap-2 font-body text-body-md font-bold text-surface hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon-cyan">
            {isSubmitting ? (
               <div className="w-5 h-5 border-2 border-surface border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> {isEditMode ? 'Simpan Perubahan' : 'Buat Produk'}</>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AdminProductFormPage;
