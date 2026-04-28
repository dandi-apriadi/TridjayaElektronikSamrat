import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  BookOpen,
  Save,
  X
} from 'lucide-react';
import { toast } from '../../store/useNotificationStore';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

const AdminProductCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/product-categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data.items);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Gagal memuat kategori', 'Terjadi kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Validasi Gagal', 'Nama kategori wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingCategory 
        ? `/api/product-categories/${editingCategory.id}` 
        : '/api/product-categories';
      
      const response = await fetch(url, {
        method: editingCategory ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        toast.success(
          editingCategory ? 'Kategori Diperbarui' : 'Kategori Dibuat',
          `Kategori ${formData.name} berhasil disimpan`
        );
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
        fetchCategories();
      } else {
        toast.error('Gagal menyimpan', data.message || 'Terjadi kesalahan');
      }
    } catch (error) {
      toast.error('Kesalahan Sistem', 'Gagal menghubungi server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus kategori "${name}"? Produk dalam kategori ini mungkin tidak akan terpengaruh secara langsung, tetapi label kategorinya tetap ada di data produk.`)) return;

    try {
      const response = await fetch(`/api/product-categories/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        toast.success('Kategori Dihapus', `Kategori ${name} berhasil dihapus`);
        fetchCategories();
      }
    } catch (error) {
      toast.error('Gagal menghapus', 'Terjadi kesalahan sistem');
    }
  };

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (cat.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase text-label-sm mb-2">
            <BookOpen className="w-4 h-4" /> Manajemen Produk
          </div>
          <h2 className="font-display text-display-sm font-bold text-on-surface">Kategori Produk</h2>
          <p className="text-body-md text-on-surface-variant mt-2 max-w-2xl font-medium leading-relaxed">
            Kelola daftar kategori yang akan digunakan untuk mengelompokkan produk di katalog.
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingCategory(null);
            setFormData({ name: '', description: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-surface rounded-2xl font-bold hover:shadow-neon-cyan transition-all group"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          Tambah Kategori
        </button>
      </div>

      {/* Stats & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
          <input 
            type="text"
            placeholder="Cari kategori berdasarkan nama atau deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-surface-low/50 border border-outline-variant/10 rounded-2xl focus:outline-none focus:border-primary/50 focus:bg-surface-low transition-all font-medium text-on-surface"
          />
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center justify-between border-primary/20">
          <div className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">Total Kategori</div>
          <div className="text-headline-sm font-bold text-primary">{categories.length}</div>
        </div>
      </div>

      {/* Table Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl overflow-hidden border border-outline-variant/10 shadow-xl"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-low/80 border-b border-outline-variant/10">
                <th className="px-6 py-5 font-display text-label-md font-bold text-on-surface-variant uppercase tracking-widest">Nama Kategori</th>
                <th className="px-6 py-5 font-display text-label-md font-bold text-on-surface-variant uppercase tracking-widest">Slug</th>
                <th className="px-6 py-5 font-display text-label-md font-bold text-on-surface-variant uppercase tracking-widest">Deskripsi</th>
                <th className="px-6 py-5 text-right font-display text-label-md font-bold text-on-surface-variant uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-4">
                      <div className="h-6 bg-surface-high/50 rounded-lg w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-on-surface-variant font-medium">
                    Tidak ada kategori ditemukan.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-surface-high/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="font-bold text-on-surface group-hover:text-primary transition-colors">{cat.name}</div>
                    </td>
                    <td className="px-6 py-5">
                      <code className="text-label-sm bg-surface-highest/50 px-2 py-1 rounded text-secondary">{cat.slug}</code>
                    </td>
                    <td className="px-6 py-5 text-body-sm text-on-surface-variant line-clamp-1 max-w-xs">
                      {cat.description || '-'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setFormData({ name: cat.name, description: cat.description || '' });
                            setIsModalOpen(true);
                          }}
                          className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-error hover:bg-error/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface rounded-3xl p-8 shadow-2xl border border-outline-variant/10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-title-lg font-bold text-on-surface">
                  {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-surface-high transition-colors">
                  <X className="w-6 h-6 text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-label-md font-bold text-on-surface-variant mb-2">Nama Kategori</label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Sepeda Listrik, Aksesoris"
                    className="w-full px-4 py-3 bg-surface-low border border-outline-variant/20 rounded-xl focus:outline-none focus:border-primary/50 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-label-md font-bold text-on-surface-variant mb-2">Deskripsi (Opsional)</label>
                  <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Penjelasan singkat kategori ini..."
                    rows={4}
                    className="w-full px-4 py-3 bg-surface-low border border-outline-variant/20 rounded-xl focus:outline-none focus:border-primary/50 transition-all font-medium resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-outline-variant/20 text-on-surface font-bold rounded-xl hover:bg-surface-high transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-primary text-surface font-bold rounded-xl hover:shadow-neon-cyan transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-surface/30 border-t-surface rounded-full animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {editingCategory ? 'Simpan Perubahan' : 'Buat Kategori'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminProductCategoriesPage;
