import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Save, Package, Upload, Plus, Trash2, List, Image as ImageIcon, Palette, Zap, Shield, HelpCircle, Star, Calculator } from 'lucide-react';
import { useProductStore } from '../../store/useProductStore';
import { toast } from '../../store/useNotificationStore';
import type { Product } from '../../types';
import { adminProductSchema, getFirstZodIssue } from '../../validators/adminSchemas';
import { 
  loadCreditData, 
  calculateInstallments, 
  mapProductToCreditCategory, 
  formatRupiah, 
  type CreditData,
  type CustomerType
} from '../../utils/creditCalculator';
import { getImageUrl, apiFetch } from '../../utils/apiClient';

const AdminProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createProduct, updateProduct, products, fetchProducts, isLoading: isProductLoading } = useProductStore();
  const [customerType, setCustomerType] = useState<CustomerType>('NEW');
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [categories, setCategories] = useState<{id: string, name: string, slug: string}[]>([]);

  useEffect(() => {
    loadCreditData().then(setCreditData);

    // Fetch categories
    fetch('/api/product-categories')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCategories(data.data.items);
        }
      })
      .catch(err => console.error('Failed to fetch categories:', err));
  }, []);
  const isEditMode = !!id;

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    slug: '',
    category: '',
    subcategory: '',
    price: 0,
    priceInstallment: 0,
    dpMin: 0,
    stock: 'available',
    image: '',
    images: [],
    description: '',
    shortDesc: '',
    specs: {},
    colors: [],
    highlights: [],
    sellingPoints: [],
    objections: []
  });

  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newHighlight, setNewHighlight] = useState('');
  const [newSellingPoint, setNewSellingPoint] = useState('');
  const [newObjection, setNewObjection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [isDragOverGallery, setIsDragOverGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditMode && products.length === 0) {
      fetchProducts(true);
    }
  }, [fetchProducts, isEditMode, products.length]);

  useEffect(() => {
    if (isEditMode) {
      if (products.length === 0) {
        return;
      }

      const product = products.find(p => p.id === id || p.slug === id);
      if (product) {
        setFormData({
          ...product,
          specs: product.specs || {},
          images: product.images || [],
          colors: product.colors || [],
          highlights: product.highlights || [],
          sellingPoints: product.sellingPoints || [],
          objections: product.objections || []
        });
      } else {
        toast.error('Produk tidak ditemukan');
        navigate('/dashboard/admin/catalog');
      }
    }
  }, [id, isEditMode, isProductLoading, navigate, products]);

  // Automatic Slug Generation
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData(prev => {
      const newData = { ...prev, name: val };
      // Only auto-generate slug if it was empty or matched the old name slug
      if (!isEditMode && (!prev.slug || prev.slug === prev.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'))) {
        newData.slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
      return newData;
    });
  };

  // Automatic Credit Preview Calculation
  const recommendation = useMemo(() => {
    if (!formData.price || !creditData) return { value: 0, tenure: 0 };
    try {
      const category = mapProductToCreditCategory(formData.category || 'bike');
      const result = calculateInstallments(creditData, formData.price, customerType, category);
      
      let minVal = Infinity;
      let minTenure = 0;
      
      Object.entries(result.installments).forEach(([tenure, val]) => {
        if (val && val < minVal) {
          minVal = val;
          minTenure = parseInt(tenure);
        }
      });
      
      return { 
        value: minVal === Infinity ? 0 : minVal, 
        tenure: minTenure 
      };
    } catch (e) {
      return { value: 0, tenure: 0 };
    }
  }, [formData.price, formData.category, creditData, customerType]);

  const recommendedInstallment = recommendation.value;
  const recommendedTenure = recommendation.tenure;

  const applyRecommendedInstallment = () => {
    if (recommendedInstallment > 0) {
      setFormData(prev => ({ ...prev, priceInstallment: recommendedInstallment }));
      toast.success('Harga cicilan diatur otomatis', `Berdasarkan cicilan termurah (Nasabah ${customerType}): ${formatRupiah(recommendedInstallment)}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'price' || name === 'priceInstallment' || name === 'dpMin') ? Number(value) : value
    }));
  };

  // Generic List Handlers
  const addListItem = (field: keyof Product, value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.warning('Isi data terlebih dulu sebelum menambahkan item.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      [field]: [...((prev[field] as string[]) || []), trimmed]
    }));
    setter('');
  };

  const handleGalleryUpload = async (fileArray: File[]) => {
    if (fileArray.length === 0) return;

    setIsUploadingGallery(true);
    const validFiles = fileArray.filter((file) => file.type.startsWith('image/'));
    const ignoredCount = fileArray.length - validFiles.length;

    const uploadedUrls: string[] = [];
    let errorCount = ignoredCount;

    // Upload concurrently for faster batch processing and better UX.
    const uploadResults = await Promise.allSettled(
      validFiles.map(async (file) => {
        const formDataPayload = new FormData();
        formDataPayload.append('file', file);

        const response = await apiFetch('/api/admin/uploads/image', {
          method: 'POST',
          body: formDataPayload,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${file.name}`);
        }

        const payload = await response.json();
        const url = payload.data?.url as string | undefined;
        if (!url) {
          throw new Error(`Invalid upload response: ${file.name}`);
        }

        return { fileName: file.name, url };
      })
    );

    uploadResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        uploadedUrls.push(result.value.url);
      } else {
        errorCount += 1;
        console.error('Gallery upload error:', result.reason);
      }
    });

    if (uploadedUrls.length > 0) {
      setFormData(prev => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls]
      }));
      toast.success(`Berhasil mengunggah ${uploadedUrls.length} gambar`);
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} file gagal diunggah`);
    }

    setIsUploadingGallery(false);
  };

  const openGalleryPicker = () => {
    if (isUploadingGallery) return;
    galleryInputRef.current?.click();
  };

  const openThumbnailPicker = () => {
    if (isUploadingThumbnail) return;
    thumbnailInputRef.current?.click();
  };

  const onGalleryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleGalleryUpload(Array.from(files));
    }
    e.target.value = '';
  };

  const onGalleryDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragOverGallery(false);
    if (isUploadingGallery) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      void handleGalleryUpload(files);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('File Tidak Valid', 'Silakan pilih file gambar saja.');
      return;
    }

    const formDataPayload = new FormData();
    formDataPayload.append('file', file);

    setIsUploadingThumbnail(true);
    try {
      const response = await apiFetch('/api/admin/uploads/image', {
        method: 'POST',
        body: formDataPayload,
      });

      if (!response.ok) throw new Error('Gagal mengunggah gambar');

      const payload = await response.json();
      const uploadedUrl = payload.data?.url;
      if (!uploadedUrl) throw new Error('Respons tidak valid');

      setFormData((prev) => ({ ...prev, image: uploadedUrl }));
      toast.success('Thumbnail berhasil diunggah');
    } catch (error) {
      toast.error('Upload Gagal', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const removeListItem = (field: keyof Product, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: ((prev[field] as string[]) || []).filter((_, i) => i !== index)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  // Specs Handlers
  const addSpec = () => {
    const k = newSpecKey.trim();
    const v = newSpecValue.trim();
    if (!k || !v) {
      toast.error('Key dan Value spesifikasi wajib diisi');
      return;
    }
    setFormData(prev => ({
      ...prev,
      specs: { ...prev.specs, [k]: v }
    }));
    setNewSpecKey('');
    setNewSpecValue('');
  };

  const removeSpec = (key: string) => {
    const nextSpecs = { ...formData.specs };
    delete nextSpecs[key];
    setFormData(prev => ({ ...prev, specs: nextSpecs }));
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
        const success = await updateProduct(id!, {
          ...formData, // Keep existing fields like rating, reviewCount
          ...payload,
          subcategory: payload.subcategory || 'Umum'
        } as Product);
        if (success) {
          toast.success('Produk berhasil diperbarui');
          navigate('/dashboard/admin/catalog');
        }
      } else {
        const newId = `PRD-${Math.floor(Math.random() * 1000)}`;
        const success = await createProduct({ 
          ...payload, 
          id: newId,
          subcategory: payload.subcategory || 'Umum',
          rating: 5,
          reviewCount: 0 
        } as Product);
        if (success) {
          toast.success('Produk berhasil ditambahkan');
          navigate('/dashboard/admin/catalog');
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard/admin/catalog" className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-display text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" /> {isEditMode ? `Edit ${formData.name}` : 'Tambah Produk Baru'}
          </h2>
        </div>
      </div>

      <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Dasar */}
          <div className="glass-card rounded-xl p-6 space-y-4 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2 flex items-center gap-2">
               <Package className="w-5 h-5 text-primary" /> Informasi Dasar
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Nama Produk</label>
                <input required name="name" value={formData.name || ''} onChange={handleNameChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Slug URL</label>
                <input required name="slug" value={formData.slug || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kategori</label>
                <select required name="category" value={formData.category || ''} onChange={handleChange} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none">
                  <option value="">Pilih Kategori</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Sub Kategori</label>
                <input name="subcategory" value={formData.subcategory || ''} onChange={handleChange} type="text" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" placeholder="Contoh: Electric Moped" />
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <label className="text-label-sm font-semibold text-on-surface-variant">Deskripsi Singkat (Short Catchy Phrase)</label>
              <textarea required name="shortDesc" value={formData.shortDesc || ''} onChange={handleChange} rows={2} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none resize-none" placeholder="Gaya futuristik dengan jangkauan terjauh..." />
            </div>

            <div className="space-y-1.5 mt-4">
              <label className="text-label-sm font-semibold text-on-surface-variant">Deskripsi Lengkap (Product Knowledge)</label>
              <textarea required name="description" value={formData.description || ''} onChange={handleChange} rows={6} className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none resize-none" placeholder="Masukkan detail lengkap produk untuk referensi agen..." />
            </div>
          </div>

          {/* Marketing & Sales Guide */}
          <div className="glass-card rounded-xl p-6 space-y-6 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2 flex items-center gap-2">
               <Zap className="w-5 h-5 text-yellow-500" /> Panduan Sales & Marketing
            </h3>

            <div className="space-y-6">
              {/* Highlights */}
              <div className="space-y-3">
                <label className="text-label-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                  <Star className="w-3.5 h-3.5" /> Highlights Utama
                </label>
                <div className="flex gap-2">
                  <input 
                    placeholder="E.g. Jarak tempuh 120km" 
                    value={newHighlight} 
                    onChange={(e) => setNewHighlight(e.target.value)} 
                    onKeyDown={(e) => handleKeyPress(e, () => addListItem('highlights', newHighlight, setNewHighlight))}
                    className="flex-1 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none" 
                  />
                  <button type="button" onClick={() => addListItem('highlights', newHighlight, setNewHighlight)} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {(formData.highlights || []).map((h, i) => (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={i} className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-label-sm font-medium text-on-surface">
                        {h}
                        <button type="button" onClick={() => removeListItem('highlights', i)} className="text-on-surface-variant hover:text-error">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Selling Points */}
              <div className="space-y-3">
                <label className="text-label-sm font-bold text-secondary flex items-center gap-2 uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5" /> Unique Selling Points
                </label>
                <div className="flex gap-2">
                  <input 
                    placeholder="E.g. Garansi motor 3 tahun" 
                    value={newSellingPoint} 
                    onChange={(e) => setNewSellingPoint(e.target.value)} 
                    onKeyDown={(e) => handleKeyPress(e, () => addListItem('sellingPoints', newSellingPoint, setNewSellingPoint))}
                    className="flex-1 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none" 
                  />
                  <button type="button" onClick={() => addListItem('sellingPoints', newSellingPoint, setNewSellingPoint)} className="p-2 bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence>
                    {(formData.sellingPoints || []).map((s, i) => (
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={i} className="flex items-center gap-2 px-3 py-1.5 bg-secondary/5 border border-secondary/20 rounded-lg text-label-sm font-medium text-on-surface">
                        {s}
                        <button type="button" onClick={() => removeListItem('sellingPoints', i)} className="text-on-surface-variant hover:text-error">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Objections */}
              <div className="space-y-3">
                <label className="text-label-sm font-bold text-error flex items-center gap-2 uppercase tracking-wider">
                  <HelpCircle className="w-3.5 h-3.5" /> Penanganan Bantahan (Objection Handling)
                </label>
                <div className="flex gap-2">
                  <input 
                    placeholder="E.g. 'Harga mahal?' -> Kualitas baterai premium" 
                    value={newObjection} 
                    onChange={(e) => setNewObjection(e.target.value)} 
                    onKeyDown={(e) => handleKeyPress(e, () => addListItem('objections', newObjection, setNewObjection))}
                    className="flex-1 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none" 
                  />
                  <button type="button" onClick={() => addListItem('objections', newObjection, setNewObjection)} className="p-2 bg-error/10 text-error rounded-lg hover:bg-error/20">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-2">
                  <AnimatePresence>
                    {(formData.objections || []).map((o, i) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} key={i} className="flex items-center justify-between p-3 bg-error/5 border border-error/10 rounded-lg text-body-sm text-on-surface">
                        {o}
                        <button type="button" onClick={() => removeListItem('objections', i)} className="text-on-surface-variant hover:text-error transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Spesifikasi & Fitur */}
          <div className="glass-card rounded-xl p-6 space-y-4 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2 flex items-center gap-2">
               <List className="w-5 h-5 text-secondary" /> Spesifikasi Teknis
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input 
                  placeholder="Nama Spek (e.g. Motor)" 
                  value={newSpecKey} 
                  onChange={(e) => setNewSpecKey(e.target.value)} 
                  onKeyDown={(e) => handleKeyPress(e, addSpec)}
                  className="md:col-span-2 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none" 
                />
                <input 
                  placeholder="Value (e.g. 750W)" 
                  value={newSpecValue} 
                  onChange={(e) => setNewSpecValue(e.target.value)} 
                  onKeyDown={(e) => handleKeyPress(e, addSpec)}
                  className="md:col-span-2 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none" 
                />
                <button type="button" onClick={addSpec} className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 font-bold text-label-sm">
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <AnimatePresence>
                  {Object.entries(formData.specs || {}).map(([key, value]) => (
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} key={key} className="flex items-center justify-between p-3 rounded-lg bg-surface-high border border-outline-variant/10 group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-on-surface-variant tracking-wider">{key}</span>
                        <span className="text-body-sm font-bold text-on-surface">{value}</span>
                      </div>
                      <button type="button" onClick={() => removeSpec(key)} className="p-1.5 text-on-surface-variant hover:text-error transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Galeri Gambar */}
           <div className="glass-card rounded-xl p-6 space-y-4 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2 flex items-center gap-2">
               <ImageIcon className="w-5 h-5 text-tertiary" /> Galeri Media
            </h3>
            
            <div className="space-y-4">
               <input
                 ref={galleryInputRef}
                 type="file"
                 multiple
                 accept=".jpg,.jpeg,.png,.webp"
                 className="hidden"
                 onChange={onGalleryInputChange}
               />

               <div
                 onClick={openGalleryPicker}
                 onDragOver={(e) => {
                   e.preventDefault();
                   if (!isUploadingGallery) {
                     setIsDragOverGallery(true);
                   }
                 }}
                 onDragLeave={() => setIsDragOverGallery(false)}
                 onDrop={onGalleryDrop}
                 className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer relative group ${
                   isDragOverGallery
                     ? 'border-primary/70 bg-primary/5'
                     : 'border-outline-variant/30 bg-surface-high/30 hover:bg-surface-high/50 hover:border-primary/50'
                 } ${isUploadingGallery ? 'opacity-70 cursor-not-allowed' : ''}`}
               >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      {isUploadingGallery ? (
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <p className="text-body-sm font-bold text-on-surface">Klik area ini untuk pilih file gallery</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">Mendukung banyak file sekaligus (JPG, PNG, WebP)</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openGalleryPicker();
                      }}
                      disabled={isUploadingGallery}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-label-sm font-semibold hover:bg-primary/25 disabled:opacity-60"
                    >
                      Pilih File
                    </button>
                  </div>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                  <AnimatePresence>
                    {(formData.images || []).map((img, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.9 }} 
                        key={img + idx} 
                        className="relative group aspect-square rounded-xl overflow-hidden border border-outline-variant/20 shadow-sm"
                      >
                        <img src={getImageUrl(img)} alt={`Gallery ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button" 
                            onClick={() => removeListItem('images', idx)} 
                            className="p-2 bg-error text-white rounded-full hover:bg-error-container hover:text-on-error-container transition-colors shadow-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
               </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Harga & Kredit */}
          <div className="glass-card rounded-xl p-6 space-y-4 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Harga & Kredit</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Harga Retail (Rp)</label>
                <div className="relative">
                   <input required name="price" value={formData.price || ''} onChange={handleChange} type="number" min="0" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">DP Minimum (Rp)</label>
                <input name="dpMin" value={formData.dpMin || ''} onChange={handleChange} type="number" min="0" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              
              <div className="pt-2 border-t border-outline-variant/10 space-y-4">
                <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                      <label className="text-label-xs font-bold text-on-surface-variant uppercase tracking-wider">Simulasi Pricelist 2025</label>
                      <button 
                        type="button" 
                        onClick={() => setCustomerType(customerType === 'NEW' ? 'RO' : 'NEW')}
                        className="text-[9px] font-black text-primary uppercase text-left hover:underline"
                      >
                        Tipe: {customerType === 'NEW' ? 'Nasabah Baru' : 'Repeat Order (RO)'}
                      </button>
                   </div>
                   <button type="button" onClick={applyRecommendedInstallment} className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors" title="Terapkan Rekomendasi (12x)">
                      <Calculator className="w-4 h-4" />
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   {creditData ? (() => {
                      try {
                        const category = mapProductToCreditCategory(formData.category || 'bike');
                        const result = calculateInstallments(creditData, formData.price || 0, customerType, category);
                        return Object.entries(result.installments).map(([tenor, amount]) => (
                          <div key={tenor} className="p-2 rounded-lg bg-surface-high/50 border border-outline-variant/10 text-center">
                             <div className="text-[9px] font-black uppercase text-on-surface-variant truncate">{tenor}</div>
                             <div className="text-label-sm font-bold text-on-surface">{formatRupiah(amount as number)}</div>
                          </div>
                        ));
                      } catch (e) {
                        return <div className="col-span-2 text-[10px] text-error text-center py-2">Data tidak tersedia</div>;
                      }
                   })() : (
                      <div className="col-span-2 text-[10px] text-on-surface-variant text-center py-2 animate-pulse">Memuat pricelist...</div>
                   )}
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">Rekomendasi ({recommendedTenure || 0}x)</span>
                      <span className="text-title-sm font-bold text-primary">{formatRupiah(recommendedInstallment)}</span>
                   </div>
                   <button type="button" onClick={applyRecommendedInstallment} className="px-3 py-1.5 bg-primary text-on-primary rounded-lg text-[10px] font-black uppercase hover:brightness-110 transition-all">Terapkan</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Cicilan / Bulan (Manual)</label>
                <input name="priceInstallment" value={formData.priceInstallment || ''} onChange={handleChange} type="number" min="0" className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm focus:ring-2 focus:ring-primary/40 outline-none font-bold text-secondary" placeholder="Atau biarkan 0 untuk hitungan otomatis" />
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

          {/* Media Utama */}
          <div className="glass-card rounded-xl p-6 space-y-4 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2">Thumbnail</h3>
            <div className="space-y-3">
              <input
                ref={thumbnailInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleThumbnailUpload(file);
                  }
                  e.target.value = '';
                }}
              />

              <div
                onClick={openThumbnailPicker}
                className="relative aspect-video w-full rounded-xl bg-surface-high border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center text-center p-2 overflow-hidden group hover:border-primary/50 transition-all cursor-pointer"
              >
                
                {formData.image ? (
                  <>
                    <img src={getImageUrl(formData.image)} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 pointer-events-none">
                      <div className="flex flex-col items-center gap-2">
                         <Upload className="w-6 h-6 text-white" />
                         <span className="text-[10px] text-white font-bold uppercase">Ganti Gambar</span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(prev => ({ ...prev, image: '' }));
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-error text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center p-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      {isUploadingThumbnail ? (
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <p className="text-body-sm font-bold text-on-surface">Upload Thumbnail</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">Disarankan 16:9 (E.g. 1280x720)</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openThumbnailPicker();
                      }}
                      disabled={isUploadingThumbnail}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-label-sm font-semibold hover:bg-primary/25 disabled:opacity-60"
                    >
                      Pilih Thumbnail
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warna */}
          <div className="glass-card rounded-xl p-6 space-y-4 shadow-sm border border-outline-variant/10">
            <h3 className="font-display text-title-md font-semibold text-on-surface border-b border-outline-variant/20 pb-2 flex items-center gap-2">
               <Palette className="w-5 h-5 text-primary" /> Pilihan Warna
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  placeholder="Contoh: Red Metallic" 
                  value={newColor} 
                  onChange={(e) => setNewColor(e.target.value)} 
                  onKeyDown={(e) => handleKeyPress(e, () => addListItem('colors', newColor, setNewColor))}
                  className="flex-1 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg text-body-sm outline-none" 
                />
                <button type="button" onClick={() => addListItem('colors', newColor, setNewColor)} className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                   <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <AnimatePresence>
                  {(formData.colors || []).map((color, idx) => (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-surface-high border border-outline-variant/20 rounded-lg text-label-sm font-bold text-on-surface">
                      {color}
                      <button type="button" onClick={() => removeListItem('colors', idx)} className="text-on-surface-variant hover:text-error">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl gradient-primary flex items-center justify-center gap-2 font-display text-title-sm font-bold text-surface hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-neon-cyan">
            {isSubmitting ? (
               <div className="w-6 h-6 border-2 border-surface border-t-transparent rounded-full animate-spin" />
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
