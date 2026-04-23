import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, X, Package, Megaphone, User,
  Layout, AlertCircle, CheckCircle2, ChevronRight, BarChart3, Activity, Clock,
  Plus, Trash2, Image as ImageIcon, CreditCard, Shield, List
} from 'lucide-react';
import { toast } from '../../store/useNotificationStore';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

const mockInsights = [
  { day: 'Sen', views: 120, clicks: 45 },
  { day: 'Sel', views: 150, clicks: 55 },
  { day: 'Rab', views: 180, clicks: 80 },
  { day: 'Kam', views: 140, clicks: 65 },
  { day: 'Jum', views: 210, clicks: 95 },
  { day: 'Sab', views: 250, clicks: 120 },
  { day: 'Min', views: 220, clicks: 110 },
];

type FormType = 'catalog' | 'promo' | 'content' | 'user';

const AdminFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const path = location.pathname;

  // Determine form type from path
  const [type, setType] = useState<FormType>('catalog');
  const isEdit = !!id;

  useEffect(() => {
    if (path.includes('catalog')) setType('catalog');
    else if (path.includes('promo')) setType('promo');
    else if (path.includes('content')) setType('content');
    else if (path.includes('users')) setType('user');
  }, [path]);

  const [activeTab, setActiveTab] = useState<string>('details');
  const [isSaving, setIsSaving] = useState(false);

  // Advanced States for Catalog
  const [specs, setSpecs] = useState([{ key: 'Motor Power', value: '500W' }, { key: 'Top Speed', value: '45 km/h' }]);
  const [colors, setColors] = useState(['Red', 'Blue', 'Black']);
  const [newColor, setNewColor] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    // Mock API call
    setTimeout(() => {
      setIsSaving(false);
      toast.success(`${config.title} Berhasil Diperbarui`, 'Data telah disinkronkan ke seluruh sistem.');
      setTimeout(() => navigate(-1), 1500);
    }, 1000);
  };

  const config = {
    catalog: { icon: Package, title: 'Produk', color: 'text-primary', bg: 'bg-primary/10' },
    promo: { icon: Megaphone, title: 'Promo', color: 'text-tertiary', bg: 'bg-tertiary/10' },
    content: { icon: Layout, title: 'Konten', color: 'text-secondary', bg: 'bg-secondary/10' },
    user: { icon: User, title: 'User', color: 'text-primary', bg: 'bg-primary/10' },
  }[type];

  const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="max-w-4xl mx-auto space-y-6">
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
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl ${config.bg} ${config.color}`}>
              <config.icon className="w-8 h-8" />
            </div>
            <div>
              <div className="font-display text-title-md font-bold text-on-surface mb-1">
                {id} - {config.title} Record
              </div>
              <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Active Status</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Updated 2h ago</span>
              </div>
            </div>
          </div>
          <div className="flex gap-6 pr-4">
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Views</div>
              <div className="font-display font-bold text-title-md text-primary">1,280</div>
            </div>
            <div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Interactions</div>
              <div className="font-display font-bold text-title-md text-secondary">A+ Score</div>
            </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Nama {config.title} *</label>
                    <input
                      required
                      type="text"
                      placeholder={`Masukkan nama ${config.title.toLowerCase()}...`}
                      className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                    />
                  </div>

                  {type === 'catalog' && (
                    <div className="space-y-1.5">
                      <label className="text-label-sm text-on-surface-variant font-semibold">Kategori Produk</label>
                      <select className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none">
                        <option>Sepeda Listrik</option>
                        <option>Motor Listrik</option>
                        <option>Elektronik</option>
                        <option>Furnitur</option>
                      </select>
                    </div>
                  )}

                  {type === 'catalog' && (
                    <div className="space-y-1.5">
                      <label className="text-label-sm text-on-surface-variant font-semibold">Sub-Kategori / Model</label>
                      <input
                        type="text"
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">Deskripsi Produk (Landing Page)</label>
                <textarea
                  rows={4}
                  placeholder="Masukkan deskripsi lengkap yang akan tampil di halaman detail produk..."
                  className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md resize-none transition-all"
                />
              </div>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-label-sm text-on-surface-variant font-semibold">Harga OTR (Cash) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">Rp</span>
                      <input
                        required
                        type="text"
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
                        type="text"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-outline-variant/10 pt-6">
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">Email Pengguna *</label>
                <input
                  required
                  type="email"
                  placeholder="email@tridjaya.co.id"
                  className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-label-sm text-on-surface-variant font-semibold">Status Akun</label>
                <select className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-md transition-all appearance-none">
                  <option>Active</option>
                  <option>Suspended</option>
                  <option>Pending Approval</option>
                </select>
              </div>
            </div>
          )}

          {/* Common Guidelines at bottom of form */}
          <div className="p-4 rounded-xl bg-surface-high/50 border border-outline-variant/10 flex items-start gap-3 mt-4">
            <AlertCircle className="w-5 h-5 text-tertiary flex-shrink-0" />
            <div className="text-body-sm text-on-surface-variant">
              <strong className="text-on-surface">Penting:</strong> Pastikan seluruh data yang diinput telah divalidasi. Perubahan ini akan segera terlihat oleh seluruh jaringan agen Tridjaya Samrat.
            </div>
          </div>
        </form>
        ) : (
          <div className="space-y-6">
            {/* Insights Content (unchanged or similar to before but within tab logic) */}
            <div className="flex items-center justify-between mb-6 border-b border-outline-variant/10 pb-4">
              <div>
                <h3 className="font-display text-title-md font-bold text-on-surface">Data Kinerja & Interaksi</h3>
                <p className="text-body-sm text-on-surface-variant mt-0.5">Metrik aktivitas selama 7 hari terakhir.</p>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockInsights}>
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
                  <Area type="monotone" dataKey="views" stroke="#8FF5FF" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" name="Views" />
                  <Area type="monotone" dataKey="clicks" stroke="#A2F31F" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" name="Interactions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
               <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                 <div className="flex items-center gap-2 mb-2">
                   <Activity className="w-4 h-4 text-primary" />
                   <div className="text-label-sm font-semibold text-on-surface">Total Views</div>
                 </div>
                 <div className="font-display font-bold text-headline-sm text-on-surface">1,280</div>
               </div>
               <div className="p-4 rounded-xl bg-surface-high border border-outline-variant/10">
                 <div className="flex items-center gap-2 mb-2">
                   <Megaphone className="w-4 h-4 text-secondary" />
                   <div className="text-label-sm font-semibold text-on-surface">Conversion Rate</div>
                 </div>
                 <div className="font-display font-bold text-headline-sm text-on-surface">12.5%</div>
               </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminFormPage;
