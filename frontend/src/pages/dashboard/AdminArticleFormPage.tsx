import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, FileText, Upload, AlertCircle } from 'lucide-react';
import { useBlogStore } from '../../store/useBlogStore';
import { toast } from '../../store/useNotificationStore';
import { adminArticleSchema, getFirstZodIssue } from '../../validators/adminSchemas';
import type { BlogPost } from '../../types';

const AdminArticleFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createPost, updatePost } = useBlogStore();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Partial<BlogPost>>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: 'Admin',
    publishedAt: new Date().toISOString().split('T')[0],
    readTime: 5,
    heroImage: '',
    tags: []
  });

  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode) {
      // Find post by id or slug
      const post = useBlogStore.getState().posts.find(p => p.id === id || p.slug === id);
      if (post) {
        setFormData(post);
        if (post.tags) setTagsInput(post.tags.join(', '));
      } else {
        toast.error('Artikel tidak ditemukan');
        navigate('/dashboard/admin/content');
      }
    }
  }, [id, isEditMode, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSlugify = () => {
    if (formData.title) {
      setFormData(prev => ({ ...prev, slug: formData.title!.toLowerCase().replace(/[^a-z0-9]+/g, '-') }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setIsSubmitting(true);

    const tagsArray = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    
    const dataToSubmit = {
      title: formData.title,
      slug: formData.slug,
      excerpt: formData.excerpt,
      content: formData.content,
      author: formData.author || 'Admin',
      publishedAt: formData.publishedAt,
      readTime: formData.readTime || 5,
      heroImage: formData.heroImage,
      tags: tagsArray,
      featured: formData.featured
    };

    // Validate with Zod schema
    const validation = adminArticleSchema.safeParse({
      ...dataToSubmit,
      readTime: typeof dataToSubmit.readTime === 'string' 
        ? parseInt(dataToSubmit.readTime) 
        : dataToSubmit.readTime
    });

    if (!validation.success) {
      const errorMessage = getFirstZodIssue(validation.error);
      setValidationError(errorMessage);
      toast.error('Validasi Gagal', errorMessage);
      setIsSubmitting(false);
      return;
    }

    try {
      if (isEditMode) {
        const success = await updatePost(id!, dataToSubmit);
        if (success) {
          toast.success('Artikel berhasil diperbarui');
          navigate('/dashboard/admin/content');
        } else {
          toast.error('Gagal memperbarui artikel');
        }
      } else {
        const newId = `ART-${Math.floor(Math.random() * 1000)}`;
        const success = await createPost({ ...dataToSubmit, id: newId });
        if (success) {
          toast.success('Artikel berhasil dipublish');
          navigate('/dashboard/admin/content');
        } else {
          toast.error('Gagal mempublish artikel');
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
        <Link to="/dashboard/admin/content" className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-display text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> {isEditMode ? 'Edit Artikel' : 'Tulis Artikel Baru'}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {validationError && (
          <div className="lg:col-span-3 p-4 rounded-lg bg-error/15 border border-error/30 flex items-start gap-3 text-error text-body-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>{validationError}</div>
          </div>
        )}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Konten Artikel</h3>
            
            <div className="space-y-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">Judul Artikel</label>
              <input required name="title" value={formData.title || ''} onChange={handleChange} onBlur={handleSlugify} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Slug URL</label>
                <input required name="slug" value={formData.slug || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Tanggal Publikasi</label>
                <input required name="publishedAt" value={formData.publishedAt || ''} onChange={handleChange} type="date" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">Cuplikan (Excerpt)</label>
              <textarea required name="excerpt" value={formData.excerpt || ''} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none resize-none" />
            </div>

            <div className="space-y-1.5">
              <label className="text-label-sm font-semibold text-on-surface-variant">Isi Konten (Teks Lengkap atau Markdown)</label>
              <textarea required name="content" value={formData.content || ''} onChange={handleChange} rows={12} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm font-mono focus:ring-2 focus:ring-primary/40 outline-none resize-none" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Kover & Kategori</h3>
            
            <div className="space-y-3">
              <div className="aspect-[4/3] w-full rounded-xl bg-surface-high border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center p-4 overflow-hidden">
                {formData.heroImage ? (
                  <img src={formData.heroImage} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-on-surface-variant/50 mb-2" />
                    <p className="text-label-sm text-on-surface-variant">Gambar Kover</p>
                  </>
                )}
              </div>
              <input required name="heroImage" placeholder="URL Gambar Kover" value={formData.heroImage || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
            </div>

            <div className="space-y-1.5 pt-4">
              <label className="text-label-sm font-semibold text-on-surface-variant">Tags (Koma Separated)</label>
              <input name="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Edukasi, Promo..." type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-3 rounded-xl bg-primary flex items-center justify-center gap-2 font-body text-body-md font-bold text-on-primary hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? (
               <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> {isEditMode ? 'Update Artikel' : 'Publish Artikel'}</>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default AdminArticleFormPage;
