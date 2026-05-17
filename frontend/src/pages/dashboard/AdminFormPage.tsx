import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, X, Package, Megaphone, User,
  Layout, AlertCircle, CheckCircle2, ChevronRight, BarChart3, Activity, Clock,
  Plus, Trash2, Image as ImageIcon, CreditCard, Shield, List, Copy
} from 'lucide-react';
import { toast } from '../../store/useNotificationStore';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useProductStore } from '../../store/useProductStore';
import { usePromoStore } from '../../store/usePromoStore';
import { useBlogStore } from '../../store/useBlogStore';
import { useUserStore } from '../../store/useUserStore';
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { buildReferralLink } from '../../utils/apiClient';
import { jobdeskPositions } from '../../data/ownerRaportData';

type FormType = 'catalog' | 'promo' | 'content' | 'user';

const isValidWhatsapp = (value: string) => {
  const digitCount = value.replace(/\D/g, '').length;
  return digitCount >= 9 && digitCount <= 16;
};

const AdminFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const path = location.pathname;

  // Determine form type from path
  const [type, setType] = useState<FormType>('catalog');
  const isEdit = !!id;
  const { products, fetchProducts, updateProduct, createProduct } = useProductStore();
  const { fetchPromos } = usePromoStore();
  const { fetchPosts } = useBlogStore();
  const { users, fetchUsers, createUser, updateUser, resendVerification, verifyUser } = useUserStore();
  const { agents, fetchAgents, leads: adminLeads, fetchLeads, agentPerformance, fetchAgentPerformance } = useAdminNetworkStore();
  
  const currentUser = useMemo(() => users.find((item) => item.id === id), [id, users]);
  const currentProduct = useMemo(() => products.find((item) => item.id === id), [id, products]);

  useEffect(() => {
    if (path.includes('catalog')) setType('catalog');
    else if (path.includes('promo')) setType('promo');
    else if (path.includes('content')) setType('content');
    else if (path.includes('users')) setType('user');
  }, [path]);

  useEffect(() => {
    if (type === 'catalog') fetchProducts();
    if (type === 'promo') fetchPromos();
    if (type === 'content') fetchPosts();
    if (type === 'user') {
      fetchUsers();
      fetchAgents();
      fetchLeads();
      if (id) fetchAgentPerformance(id);
    }
  }, [fetchPosts, fetchProducts, fetchPromos, fetchUsers, type]);
  const [activeTab, setActiveTab] = useState<string>('details');
  const [isSaving, setIsSaving] = useState(false);
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('');
  const [name, setName] = useState('');
  
  // Catalog specific states
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [dpMin, setDpMin] = useState('');
  const [category, setCategory] = useState<'bike' | 'electronics' | 'furniture'>('bike');
  const [subcategory, setSubcategory] = useState('');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor' | 'operator' | 'sales' | 'agent' | 'owner' | 'pic_raport' | 'karyawan' | 'wa_admin' | 'wa_operator' | 'super_admin'>('sales');
  const [jabatan, setJabatan] = useState<'sales' | 'kepala_cabang' | 'supervisor' | 'koordinator'>('sales');
  const [divisi, setDivisi] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountStatus, setAccountStatus] = useState<'active' | 'suspended' | 'pending'>('active');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const config = useMemo(() => {
    return {
      catalog: { icon: Package, title: 'Produk', color: 'text-primary', bg: 'bg-primary/10' },
      promo: { icon: Megaphone, title: 'Promo', color: 'text-tertiary', bg: 'bg-tertiary/10' },
      content: { icon: Layout, title: 'Konten', color: 'text-secondary', bg: 'bg-secondary/10' },
      user: { icon: User, title: 'User', color: 'text-primary', bg: 'bg-primary/10' },
    }[type];
  }, [type]);

  const agentDetails = useMemo(() => {
    if (type !== 'user' || !id) return null;
    return agents.find(a => a.id === id);
  }, [agents, id, type]);

  const insightData = useMemo(() => {
    if (!(type === 'user' && currentUser?.role && ['agent', 'sales'].includes(currentUser.role))) {
      return [];
    }

    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const today = new Date();

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      const day = days[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      const perf = agentPerformance.find((entry) => entry.date === dateStr);

      return {
        day,
        views: perf ? perf.activity : 0,
        clicks: perf ? perf.leads : 0,
      };
    });
  }, [agentPerformance, currentUser?.role, type]);

  const hasLiveInsights = insightData.length > 0;

  useEffect(() => {
    if (type === 'catalog') {
      if (currentProduct) {
        setName(currentProduct.name || '');
        setImage(currentProduct.image || '');
        setDescription(currentProduct.description || '');
        setCategory(currentProduct.category as any || 'bike');
        setSubcategory(currentProduct.subcategory || '');
        setPrice(currentProduct.price.toString());
        setDpMin(currentProduct.dpMin?.toString() || '');
        setColors(currentProduct.colors || []);
        
        const specsArr = Object.entries(currentProduct.specs || {}).map(([key, value]) => ({ key, value }));
        setSpecs(specsArr);
      } else {
        setName('');
        setImage('');
        setDescription('');
        setCategory('bike');
        setSubcategory('');
        setPrice('');
        setDpMin('');
        setColors([]);
        setSpecs([]);
      }
      return;
    }

    if (type !== 'user') return;

    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setRole((currentUser.role as any) || 'sales');
      setJabatan((currentUser.jabatan as any) || 'sales');
      setDivisi((currentUser as any).divisi || '');
      setAvatar(currentUser.avatar || '');
      setBankAccount(currentUser.bank_account || '');
      setWhatsapp(currentUser.whatsapp || '');
      setAccountStatus(currentUser.is_active ? 'active' : 'suspended');
      setPassword('');
      
      // Load agent specific fields if available
      if (agentDetails) {
        setCity(agentDetails.city || '');
        setProvince(agentDetails.province || '');
      }

      if (currentUser) {
        setIsVerified(currentUser.is_verified);
      }
    } else {
      const params = new URLSearchParams(location.search);
      const roleParam = params.get('role');
      
      setName('');
      setEmail('');
      setRole((roleParam as any) || 'sales');
      setJabatan('sales');
      setAvatar('');
      setBankAccount('');
      setAccountStatus('active');
      setPassword('');
      setWhatsapp('');
      setDivisi(roleParam === 'karyawan' ? (params.get('divisi') || '') : '');
      setCity('');
      setProvince('');
      setIsVerified(false);
    }
  }, [currentUser, currentProduct, type, agentDetails, location.search]);

  const handleVerify = async () => {
    if (!id) return;
    const success = await verifyUser(id);
    if (success) {
      toast.success('User Diverifikasi', 'User sekarang sudah bisa login.');
      setIsVerified(true);
    }
  };

  const handleUnverify = async () => {
    if (!id) return;
    const success = await resendVerification(id);
    if (success) {
      toast.success('Email Dikirim', 'Status user diubah ke belum terverifikasi.');
      setIsVerified(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (type === 'catalog') {
        if (!name.trim()) throw new Error('Nama produk wajib diisi.');
        if (!price) throw new Error('Harga wajib diisi.');
        
        const specObj = specs.reduce((acc, curr) => {
          if (curr.key.trim()) acc[curr.key.trim()] = curr.value;
          return acc;
        }, {} as Record<string, string>);

        const payload = {
          name: name.trim(),
          image: image.trim(),
          description: description.trim(),
          category,
          subcategory: subcategory.trim(),
          price: Number(price),
          dpMin: dpMin ? Number(dpMin) : undefined,
          colors,
          specs: specObj
        };

        if (isEdit && id) {
           const success = await updateProduct(id, payload);
           if (!success) throw new Error('Gagal memperbarui produk.');
        } else {
           const success = await createProduct(payload);
           if (!success) throw new Error('Gagal membuat produk baru.');
        }
        
        toast.success(`${config.title} Berhasil Disimpan`, 'Data produk telah tersinkron ke backend.');
        navigate('/dashboard/admin/catalog');
        return;
      }

      if (type === 'user') {
        if (!name.trim() || !email.trim()) {
          throw new Error('Nama dan email wajib diisi.');
        }
        if (role === 'karyawan' && !divisi.trim()) {
          throw new Error('Divisi wajib dipilih untuk role karyawan.');
        }
        if (role === 'sales' && !whatsapp.trim()) {
          throw new Error('WhatsApp wajib diisi untuk role sales.');
        }
        if (whatsapp.trim() && !isValidWhatsapp(whatsapp)) {
          throw new Error('WhatsApp tidak valid. Gunakan 9 sampai 16 digit angka.');
        }

        const userPayload = {
          email: email.trim(),
          name: name.trim(),
          role,
          jabatan: role === 'sales' ? jabatan : undefined,
          divisi: role === 'karyawan' ? divisi : undefined,
          avatar: avatar.trim(),
          bankAccount: bankAccount.trim(),
          whatsapp: whatsapp.trim(),
          isActive: accountStatus === 'active',
          isVerified,
        };

        if (isEdit && id) {
          const updatePayload: typeof userPayload & { password?: string } = { ...userPayload };
          if (password.trim()) {
            updatePayload.password = password.trim();
          }

          const success = await updateUser(id, updatePayload);
          if (!success) {
            throw new Error(useUserStore.getState().error || 'Gagal memperbarui user.');
          }
        } else {
          if (password.trim().length < 8) {
            throw new Error('Password baru minimal 8 karakter.');
          }

          const success = await createUser({
            ...userPayload,
            password: password.trim(),
          });
          if (!success) {
            throw new Error(useUserStore.getState().error || 'Gagal membuat user baru.');
          }
        }

        toast.success(`${config.title} Berhasil Disimpan`, 'Data user telah tersinkron ke backend.');
        navigate('/dashboard/admin/users');
        return;
      }

      throw new Error('Tipe form tidak didukung untuk penyimpanan backend.');
    } catch (error) {
      toast.error('Gagal Menyimpan', error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan data.');
    } finally {
      setIsSaving(false);
    }
  };


  const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };


  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="w-full space-y-6">
      {/* Header */}
      <motion.div variants={iv} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-0.5">
              <span>Admin</span>
              <ChevronRight className="w-3 h-3" />
              <span>Manajemen {config.title}</span>
            </div>
            <h2 className="font-display text-headline-sm font-bold text-on-surface">
              {isEdit ? 'Edit' : 'Tambah'} {config.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 rounded-xl text-label-md font-bold text-on-surface-variant hover:bg-surface-high transition-colors"
          >
            Batal
          </button>
          <button
            form="admin-form"
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-label-md flex items-center gap-2 shadow-neon-cyan/20 shadow-lg hover:shadow-neon-cyan/40 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </motion.div>

      {/* Profile Header (Edit Mode) */}
      {isEdit && (
        <motion.div variants={iv} className="glass-card rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-outline-variant/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-5">
            {type === 'user' && avatar ? (
              <img src={avatar} alt={name} className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/20 shadow-neon-cyan/10 shadow-lg" />
            ) : (
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl ${config.bg} ${config.color}`}>
                <config.icon className="w-8 h-8" />
              </div>
            )}
            <div>
              <div className="font-display text-title-md font-bold text-on-surface mb-1">
                {isEdit && type === 'user' ? name : `${id} - ${config.title} Record`}
              </div>
              <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${accountStatus === 'active' ? 'text-secondary' : 'text-error'}`} /> 
                  {accountStatus === 'active' ? 'Akun Aktif' : accountStatus === 'suspended' ? 'Akun Ditangguhkan' : 'Menunggu Approval'}
                </span>
                {currentUser?.last_login && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Login: {new Date(currentUser.last_login).toLocaleDateString('id-ID')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-6 pr-4">
            {type === 'user' && currentUser?.role && ['agent', 'sales'].includes(currentUser.role) ? (
              <>
                <div>
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Poin</div>
                  <div className="font-display font-bold text-title-md text-primary">{agentDetails?.points || 0} pts</div>
                </div>
                <div>
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Sales</div>
                  <div className="font-display font-bold text-title-md text-secondary">{agentDetails?.totalSales || 0} unit</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Status Insight</div>
                  <div className="font-display font-bold text-title-md text-primary">Live Only</div>
                </div>
                <div>
                  <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Ketersediaan</div>
                  <div className="font-display font-bold text-title-md text-secondary">Belum Ada Data</div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      {isEdit && (
        <motion.div variants={iv} className="flex items-center gap-2 p-1 bg-surface-high/50 rounded-xl w-fit border border-outline-variant/10 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-body-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'details' ? 'bg-surface-low text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <config.icon className="w-4 h-4" /> Informasi Utama
          </button>
          
          {type === 'catalog' && (
            <>
              <button
                onClick={() => setActiveTab('specs')}
                className={`px-5 py-2.5 rounded-lg font-semibold text-body-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'specs' ? 'bg-surface-low text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <List className="w-4 h-4" /> Spesifikasi
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-5 py-2.5 rounded-lg font-semibold text-body-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'pricing' ? 'bg-surface-low text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Harga & Kredit
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('insights')}
            className={`px-5 py-2.5 rounded-lg font-semibold text-body-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'insights' ? 'bg-surface-low text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Performa
          </button>
        </motion.div>
      )}

      {/* Main Content Area */}
      <motion.div variants={iv} className="glass-card rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {activeTab !== 'insights' ? (
        <form id="admin-form" onSubmit={handleSave} className="space-y-8">
          {activeTab === 'details' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              {/* Section: Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-title-sm font-bold text-on-surface border-b border-outline-variant/10 pb-2">
                  <config.icon className={`w-5 h-5 ${config.color}`} />
                  Informasi Utama
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Nama {config.title} *</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={`Masukkan nama ${config.title.toLowerCase()}...`}
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                    />
                  </div>

                  {type === 'catalog' && (
                    <div className="space-y-1.5">
                      <label className="text-label-sm text-on-surface-variant font-semibold">Kategori Produk</label>
                      <select 
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none"
                      >
                        <option value="bike">Sepeda Listrik</option>
                        <option value="electronics">Elektronik</option>
                        <option value="furniture">Furnitur</option>
                      </select>
                    </div>
                  )}

                  {type === 'catalog' && (
                    <div className="space-y-1.5">
                      <label className="text-label-sm text-on-surface-variant font-semibold">Sub-Kategori / Model</label>
                      <input
                        type="text"
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        placeholder="Contoh: Premium Series, Eco Hub..."
                        className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Media & Variants */}
              {type === 'catalog' && (
                <div className="space-y-4 pt-4 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 text-title-sm font-bold text-on-surface">
                    <ImageIcon className="w-4 h-4 text-secondary" />
                    Varian & Media
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-label-sm text-on-surface-variant font-semibold">Pilih Warna / Varian</label>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        {colors.map((color, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-highest border border-outline-variant/10 rounded-lg text-body-sm">
                            {color}
                            <button type="button" onClick={() => setColors(colors.filter((_, idx) => idx !== i))} className="text-on-surface-variant hover:text-error transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          placeholder="Tambah warna..."
                          className="flex-1 px-4 py-2 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-1 focus:ring-primary/40 font-body text-body-sm"
                        />
                        <button
                          type="button"
                          onClick={() => { if(newColor) { setColors([...colors, newColor]); setNewColor(''); } }}
                          className="px-4 py-2 bg-primary/20 text-primary rounded-lg font-bold text-label-sm"
                        >
                          Tambah
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-label-sm text-on-surface-variant font-semibold">URL Gambar Utama</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={image}
                          onChange={(e) => setImage(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
                        />
                        <div className="w-12 h-12 rounded-xl bg-surface-high border border-outline-variant/20 flex flex-col items-center justify-center text-on-surface-variant">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(type === 'catalog' || type === 'promo' || type === 'content') && (
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface-variant font-semibold">Deskripsi Produk (Landing Page)</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Masukkan deskripsi lengkap yang akan tampil di halaman detail produk..."
                    className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md resize-none transition-all"
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'specs' && type === 'catalog' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
                <div className="flex items-center gap-2 text-title-sm font-bold text-on-surface">
                  <Shield className="w-5 h-5 text-primary" />
                  Spesifikasi Teknis
                </div>
                <button
                  type="button"
                  onClick={() => setSpecs([...specs, { key: '', value: '' }])}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-bold text-label-sm hover:bg-primary/20 transition-all"
                >
                  <Plus className="w-4 h-4" /> Tambah Baris
                </button>
              </div>

              <div className="space-y-4">
                {specs.map((spec, i) => (
                  <div key={i} className="flex gap-4 items-end animate-in fade-in slide-in-from-top-1">
                    <div className="flex-1 space-y-1.5">
                      {i === 0 && <label className="text-label-sm text-on-surface-variant font-semibold">Label (Kunci)</label>}
                      <input
                        type="text"
                        value={spec.key}
                        onChange={(e) => {
                          const newSpecs = [...specs];
                          newSpecs[i].key = e.target.value;
                          setSpecs(newSpecs);
                        }}
                        placeholder="Contoh: Baterai"
                        className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-1 focus:ring-primary/40 font-body text-body-sm"
                      />
                    </div>
                    <div className="flex-[1.5] space-y-1.5">
                      {i === 0 && <label className="text-label-sm text-on-surface-variant font-semibold">Nilai / Value</label>}
                      <input
                        type="text"
                        value={spec.value}
                        onChange={(e) => {
                          const newSpecs = [...specs];
                          newSpecs[i].value = e.target.value;
                          setSpecs(newSpecs);
                        }}
                        placeholder="Contoh: 48V 12Ah"
                        className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-1 focus:ring-primary/40 font-body text-body-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))}
                      className="p-2.5 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'pricing' && type === 'catalog' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-title-sm font-bold text-on-surface border-b border-outline-variant/10 pb-3">
                  <CreditCard className="w-5 h-5 text-tertiary" />
                  Harga & Simulasi Kredit
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Harga OTR (Cash) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">Rp</span>
                      <input
                        required
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0"
                        className="w-full pl-12 pr-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">DP Minimum</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">Rp</span>
                      <input
                        type="number"
                        value={dpMin}
                        onChange={(e) => setDpMin(e.target.value)}
                        placeholder="0"
                        className="w-full pl-12 pr-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Cicilan 12x / bln</label>
                    <input
                      type="text"
                      placeholder="Rp 0"
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Cicilan 24x / bln</label>
                    <input
                      type="text"
                      placeholder="Rp 0"
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Cicilan 36x / bln</label>
                    <input
                      type="text"
                      placeholder="Rp 0"
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="text-body-sm text-on-surface-variant">
                  Data kredit ini akan muncul pada <span className="text-primary font-bold">Simulasi Kredit</span> di halaman detail produk. Pastikan angka yang dimasukkan sudah sesuai dengan kebijakan finance terbaru.
                </div>
              </div>
            </motion.div>
          )}

          {/* User / Promo specific details if needed (shown when tab is details and type matches) */}
          {activeTab === 'details' && type === 'user' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 border-t border-outline-variant/10 pt-6">
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">Email Pengguna *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="user@gmail.com"
                  className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">Role Akses Sistem</label>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as any)}
                  className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="operator">Operator</option>
                  <option value="sales">Sales</option>
                  <option value="agent">Agent</option>
                  <option value="owner">Owner</option>
                  <option value="pic_raport">PIC Raport</option>
                  <option value="karyawan">Karyawan</option>
                  <option value="wa_admin">WA Admin</option>
                  <option value="wa_operator">WA Operator</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <p className="text-label-xs text-on-surface-variant">Menentukan dashboard dan fitur yang bisa diakses.</p>
              </div>

              {role === 'sales' && (
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface-variant font-semibold">Jabatan</label>
                  <select
                    value={jabatan}
                    onChange={(event) => setJabatan(event.target.value as any)}
                    className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none"
                  >
                    <option value="sales">Sales</option>
                    <option value="koordinator">Koordinator</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="kepala_cabang">Kepala Cabang</option>
                  </select>
                  <p className="text-label-xs text-on-surface-variant">Hanya sebagai title tampilan, tidak mempengaruhi akses sistem.</p>
                </div>
              )}

              {role === 'karyawan' && (
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface-variant font-semibold">Divisi *</label>
                  <select
                    value={divisi}
                    onChange={(event) => setDivisi(event.target.value)}
                    className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none"
                  >
                    <option value="">-- Pilih Divisi --</option>
                    {jobdeskPositions.map((position) => (
                      <option key={position.id} value={position.id}>{position.posisi}</option>
                    ))}
                  </select>
                  <p className="text-label-xs text-on-surface-variant">Menentukan jobdesk harian dan target prospek karyawan.</p>
                </div>
              )}

              {(role === 'sales' || role === 'agent') && (
                <div className="space-y-1.5">
                  <label className="text-label-sm text-on-surface-variant font-semibold">WhatsApp {role === 'sales' ? '*' : ''}</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(event) => setWhatsapp(event.target.value)}
                    placeholder="6281234567890"
                    className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">URL Avatar</label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(event) => setAvatar(event.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                />
              </div>

              {role === 'sales' && isEdit && currentUser?.referral_slug && (
                <div className="space-y-1.5 md:col-span-2 xl:col-span-1">
                  <label className="text-label-sm text-on-surface-variant font-semibold">Referral Slug & Link</label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-tertiary/5 border border-tertiary/20 rounded-xl font-mono text-xs text-tertiary flex items-center overflow-hidden whitespace-nowrap">
                      {currentUser.referral_slug}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const url = buildReferralLink(currentUser.referral_slug!);
                        navigator.clipboard.writeText(url);
                        toast.success('Link Disalin', 'Link referral siap dibagikan.');
                      }}
                      className="p-3 bg-tertiary/10 text-tertiary rounded-xl hover:bg-tertiary/20 transition-colors border border-tertiary/20"
                      title="Salin Link Referral"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">Password {isEdit ? '(kosongkan jika tidak diubah)' : '*'}</label>
                <input
                  required={!isEdit}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isEdit ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}
                  className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                <label className="text-label-sm text-on-surface-variant font-semibold">Status Akun</label>
                <div className="flex gap-3">
                  <select
                    value={accountStatus}
                    onChange={(event) => setAccountStatus(event.target.value as 'active' | 'suspended' | 'pending')}
                    className="flex-1 px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                  <div className={`px-4 py-3 rounded-xl font-bold text-label-md flex items-center justify-center min-w-[120px] ${
                    accountStatus === 'active' ? 'bg-secondary/10 text-secondary border border-secondary/20' :
                    accountStatus === 'suspended' ? 'bg-error/10 text-error border border-error/20' :
                    'bg-warning/10 text-warning border border-warning/20'
                  }`}>
                    {accountStatus.toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                <label className="text-label-sm text-on-surface-variant font-semibold">Verifikasi Email</label>
                <div className="flex items-center gap-3 p-4 bg-surface-high border border-outline-variant/20 rounded-xl">
                  {isVerified ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-body-md font-bold text-on-surface">Email Sudah Terverifikasi</p>
                        <p className="text-label-sm text-on-surface-variant">User ini sudah bisa login ke sistem.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleUnverify}
                        className="px-4 py-2 bg-surface-highest text-on-surface-variant rounded-lg text-label-md font-bold hover:text-on-surface transition-all flex items-center gap-2 border border-outline-variant/10"
                      >
                        <Megaphone className="w-4 h-4" />
                        Unverify & Resend Link
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                        <AlertCircle size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-body-md font-bold text-on-surface text-warning">Email Belum Terverifikasi</p>
                        <p className="text-label-sm text-on-surface-variant">User tidak bisa login sebelum diverifikasi.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleVerify}
                        className="px-4 py-2 bg-primary text-on-primary rounded-lg text-label-md font-bold hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                      >
                        <CheckCircle2 size={16} />
                        Verifikasi Manual
                      </button>
                    </>
                  )}
                </div>
              </div>

              {role === 'agent' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Kota</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="Masukkan kota..."
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Provinsi</label>
                    <input
                      type="text"
                      value={province}
                      onChange={(event) => setProvince(event.target.value)}
                      placeholder="Masukkan provinsi..."
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Common Guidelines at bottom of form */}
          <div className="p-4 rounded-xl bg-surface-high/50 border border-outline-variant/10 flex items-start gap-3 mt-4">
            <AlertCircle className="w-5 h-5 text-tertiary flex-shrink-0" />
            <div className="text-body-sm text-on-surface-variant">
              <strong className="text-on-surface">Penting:</strong> Pastikan seluruh data yang diinput telah divalidasi. Perubahan ini akan segera terlihat oleh seluruh jaringan agen Tridjaya Manado.
            </div>
          </div>
        </form>
        ) : (
          <div className="space-y-6">
            {/* Insights Content */}
            <div className="flex items-center justify-between mb-6 border-b border-outline-variant/10 pb-4">
              <div>
                <h3 className="font-display text-title-md font-bold text-on-surface">
                  {type === 'user' && currentUser?.role === 'agent' ? 'Statistik Performa Agent' : 'Data Kinerja & Interaksi'}
                </h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  {type === 'user' && currentUser?.role === 'agent' ? 'Aktivitas pengajuan prospek selama 7 hari terakhir.' : 'Metrik aktivitas selama 7 hari terakhir.'}
                </p>
              </div>
            </div>
            
            {hasLiveInsights ? (
              <>
                <div className="relative h-[300px] w-full min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                    <AreaChart data={insightData}>
                      <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8FF5FF" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8FF5FF" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A2F31F" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#A2F31F" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                      <XAxis dataKey="day" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF' }} />
                      <Area type="monotone" dataKey="views" stroke="#8FF5FF" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" name="Aktivitas" />
                      <Area type="monotone" dataKey="clicks" stroke="#A2F31F" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" name="Leads" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-primary" />
                        <div className="text-label-sm font-semibold text-on-surface">
                          Total Leads (7d)
                        </div>
                      </div>
                      <div className="font-display font-bold text-headline-sm text-on-surface">
                        {insightData.reduce((sum, row) => sum + row.clicks, 0).toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="w-4 h-4 text-secondary" />
                        <div className="text-label-sm font-semibold text-on-surface">
                          Success Rate
                        </div>
                      </div>
                      <div className="font-display font-bold text-headline-sm text-on-surface">
                        {`${Math.round(((agentDetails?.totalSales || 0) / Math.max(1, adminLeads.filter(l => l.agentId === id).length)) * 100)}%`}
                      </div>
                    </div>
                 </div>
              </>
            ) : (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-high/40 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-high text-on-surface-variant">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="font-display text-title-sm font-bold text-on-surface">
                  Belum Ada Insight Live
                </h4>
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  Halaman ini tidak lagi menampilkan metrik sintetis. Insight performa akan muncul setelah sumber analytics atau aktivitas backend tersedia untuk record ini.
                </p>
              </div>
            )}

             {/* Agent specific leads summary */}
             {type === 'user' && currentUser?.role && ['agent', 'sales'].includes(currentUser.role) && (
               <div className="glass-card rounded-xl p-4 border border-outline-variant/10">
                 <div className="flex items-center justify-between mb-3">
                   <h4 className="font-display text-label-md font-bold text-on-surface">Prospek Terbaru</h4>
                   <button onClick={() => navigate('/dashboard/admin/leads')} className="text-label-xs text-primary font-bold hover:underline">Lihat Semua</button>
                 </div>
                 <div className="space-y-2">
                   {adminLeads.filter(l => l.agentId === id).slice(0, 3).map((lead, idx) => (
                     <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-surface-highest/50 border border-outline-variant/5">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                           {lead.customerName?.charAt(0) || 'L'}
                         </div>
                         <div>
                           <div className="text-label-sm font-bold text-on-surface">{lead.customerName}</div>
                           <div className="text-label-xs text-on-surface-variant">{lead.interestedProduct}</div>
                         </div>
                       </div>
                       <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                         lead.status === 'Closed Won' ? 'bg-secondary/10 text-secondary' :
                         lead.status === 'Closed Lost' ? 'bg-error/10 text-error' :
                         'bg-primary/10 text-primary'
                       }`}>
                         {lead.status}
                       </div>
                     </div>
                   ))}
                   {adminLeads.filter(l => l.agentId === id).length === 0 && (
                     <div className="text-center py-4 text-label-sm text-on-surface-variant">Belum ada data prospek.</div>
                   )}
                 </div>
               </div>
             )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminFormPage;
