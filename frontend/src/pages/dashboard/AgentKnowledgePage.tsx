import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Search, Filter, Star, Package,
  ChevronDown, ChevronUp, Zap, ShoppingCart, Eye,
  Share2, Shield, CreditCard, Copy, Info, Image as ImageIcon
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { formatPrice } from '../../data';
import type { Product } from '../../types';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useProductStore } from '../../store/useProductStore';
import { 
  loadCreditData, 
  calculateInstallments, 
  mapProductToCreditCategory, 
  formatRupiah, 
  tenorLabel, 
  tenorPromoNote,
  type CreditData,
  type CustomerType
} from '../../utils/creditCalculator';

/* ─── Marketing Mappings ─────────────────────────────── */
// Marketing data is now stored in the database and attached to each product.
// No hard‑coded fallback data is kept here.

const getMarketingInfo = (product: Product) => {
  // Prioritize data from the product entity (set by Admin)
  if (product.highlights?.length || product.sellingPoints?.length || product.objections?.length) {
    return {
      highlights: product.highlights || [],
      sellingPoints: product.sellingPoints || [],
      objections: product.objections || [],
    };
  }

  // Fallback to default marketing data
  return {
    highlights: ['Produk Kualitas Premium', 'Garansi Resmi Tridjaya', 'Lolos Quality Control'],
    sellingPoints: ['Harga sangat bersaing', 'Bisa dicicil via Tridjaya', 'Layanan after-sales terbaik'],
    objections: ['"Bisa kurang?" → Sudah harga pas dengan bonus melimpah', '"Garansi?" → Resmi 1-3 tahun tergantung sparepart'],
  };
};

/* ─── Configuration ───────────────────────────────────── */
const categories = ['Semua', 'Sepeda Listrik', 'Elektronik', 'Furnitur'];
const mapCategory = (cat: string) => {
  if (cat === 'bike') return 'Sepeda Listrik';
  if (cat === 'tv' || cat === 'ac' || cat === 'fridge' || cat === 'washing_machine') return 'Elektronik';
  if (cat === 'sofa' || cat === 'springbed' || cat === 'wardrobe') return 'Furnitur';
  return 'Lainnya';
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1 } };

/* ─── Component ─────────────────────────────────────── */
const AgentKnowledgePage: React.FC = () => {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('Semua');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTabs, setActiveTabs] = useState<Record<string, 'sales' | 'specs' | 'gallery' | 'installments'>>({});
  const [customerType, setCustomerType] = useState<CustomerType>('NEW');
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { products, isLoading, fetchProducts } = useProductStore();
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    fetchProducts();
    loadCreditData().then(setCreditData);
  }, [fetchProducts]);
  const filtered = products.filter((k) => {
    const mappedCat = mapCategory(k.category);
    const matchSearch   = k.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'Semua' || mappedCat === category;
    return matchSearch && matchCategory;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCopyMaterial = (p: Product) => {
    const mkt = getMarketingInfo(p);
    const text = `*PROMO TRIDJAYA SAMRAT* 🚀\n\n*${p.name}*\n🏷️ Harga: ${formatPrice(p.price)}\n${p.dpMin ? `💵 DP Mulai: ${formatPrice(p.dpMin)}\n💳 Cicilan: ${formatPrice(p.priceInstallment || 0)}/bln\n` : ''}\n✨ *Keunggulan Utama:*\n- ${mkt.highlights.join('\n- ')}\n\n💡 *Keuntungan Beli Sekarang:*\n- ${mkt.sellingPoints.join('\n- ')}\n\nCek detailnya di sini:\nhttps://tridjayaelektronik.com/produk/${p.slug}\n\n_Segera hubungi saya untuk pemesanan!_`;
    
    navigator.clipboard.writeText(text);
    addNotification({
      message: 'Materi Penjualan Disalin',
      description: 'Teks siap ditempel (paste) ke WhatsApp atau Media Sosial.',
      type: 'success',
      duration: 3000,
    });
  };

  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`https://tridjayaelektronik.com/produk/${slug}`);
    addNotification({
      message: 'Link Disalin',
      description: 'Tautan produk berhasil disalin.',
      type: 'success',
      duration: 3000,
    });
  }

  const setTab = (id: string, tab: 'sales' | 'specs' | 'gallery' | 'installments') => {
    setActiveTabs(prev => ({ ...prev, [id]: tab }));
  };

  const getTab = (id: string) => activeTabs[id] || 'sales';

  // Stats calculation
  const totalProducts = products.length;
  const avgRating = (products.reduce((acc, p) => acc + (p.rating || 4.5), 0) / totalProducts).toFixed(1);
  const totalReviews = products.reduce((acc, p) => acc + (p.reviewCount || 0), 0).toLocaleString('id-ID');
  const criticalStock = products.filter((product) => product.stock !== 'available').length;

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Panduan Penjualan Agen</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-primary" /> Product Knowledge Center
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1 max-w-2xl">
              Senjata rahasia agen. Pelajari spesifikasi mendalam, akses galeri produk, copy materi promosi WhatsApp, dan hitung simulasi cicilan langsung saat berhadapan dengan pelanggan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-display text-headline-sm font-bold text-primary">{totalProducts}</div>
              <div className="text-label-xs text-on-surface-variant">Total Produk</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Produk', value: totalProducts, color: 'text-primary', bg: 'bg-primary/10', icon: Package },
          { label: 'Avg Rating', value: avgRating, color: 'text-secondary', bg: 'bg-secondary/10', icon: Star },
          { label: 'Total Ulasan', value: totalReviews, color: 'text-tertiary', bg: 'bg-tertiary/10', icon: Eye },
          { label: 'Warning Stok', value: criticalStock, color: 'text-error', bg: 'bg-error/10', icon: ShoppingCart },
        ].map((k) => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 relative overflow-hidden">
             <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
             <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
             <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
             <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <motion.div variants={iv} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text" placeholder="Cari nama produk..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-on-surface-variant mr-1" />
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${category === c ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface-high border border-outline-variant/10 text-on-surface-variant hover:text-on-surface'}`}>
              {c}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Knowledge Cards */}
      <div className="space-y-3 pb-20">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-5 animate-pulse flex flex-col md:flex-row gap-5">
                 <div className="w-full md:w-48 h-32 bg-surface-highest rounded-lg shrink-0" />
                 <div className="flex-1 space-y-3 py-2">
                    <div className="h-6 bg-surface-highest rounded w-1/3" />
                    <div className="h-4 bg-surface-highest rounded w-2/3" />
                    <div className="h-4 bg-surface-highest rounded w-1/2" />
                 </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center">
            <Search className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-50" />
            <p className="font-display text-title-md font-semibold text-white">Tidak Ada Hasil</p>
            <p className="text-body-sm text-on-surface-variant mt-1">Coba gunakan kata kunci atau kategori lain.</p>
          </div>
        ) : (
          paginated.map((item) => {
            const isExpanded = expandedId === item.id;
            const currentTab = getTab(item.id);
            const mappedCat = mapCategory(item.category);
            const mkt = getMarketingInfo(item);

          return (
            <motion.div key={item.id} variants={iv} className="glass-card rounded-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              
              {/* Header Row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className={`w-full flex items-center gap-4 p-5 text-left hover:bg-surface-high/40 transition-colors ${isExpanded ? 'bg-surface-high/20' : ''}`}
              >
                <div className="w-12 h-12 rounded-xl bg-surface-high border border-outline-variant/20 overflow-hidden flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {item.subcategory && <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">{item.subcategory}</span>}
                    <span className="px-2 py-0.5 rounded-md bg-surface-highest text-on-surface-variant text-[10px] uppercase">{mappedCat}</span>
                    {item.badge && <span className="px-2 py-0.5 rounded-md bg-secondary/10 text-secondary text-[10px] font-bold uppercase">{item.badgeText || item.badge}</span>}
                  </div>
                  <div className="font-display text-title-sm font-bold text-on-surface truncate">{item.name}</div>
                </div>
                
                <div className="hidden lg:flex items-center gap-8 flex-shrink-0 mr-4">
                  <div className="text-right w-32">
                    <div className="font-bold text-on-surface text-body-sm gradient-text-primary">{formatPrice(item.price)}</div>
                    <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Harga Cash</div>
                  </div>
                  <div className="text-center w-24">
                    <div className="font-bold text-on-surface text-body-sm flex items-center justify-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />{item.rating}
                    </div>
                    <div className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{item.reviewCount} Ulasan</div>
                  </div>
                </div>
                
                <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center flex-shrink-0">
                   {isExpanded ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-on-surface-variant" />}
                </div>
              </button>

              {/* Expanded Detail Workspace */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-outline-variant/10 overflow-hidden"
                  >
                    <div className="bg-surface-low/50">
                      
                      {/* Tabs Navigation */}
                      <div className="flex items-center overflow-x-auto hide-scrollbar border-b border-outline-variant/10 px-4">
                        <button onClick={() => setTab(item.id, 'sales')} className={`whitespace-nowrap px-4 py-3 text-label-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${currentTab === 'sales' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                           <Zap className="w-4 h-4" /> Panduan Sales
                        </button>
                        <button onClick={() => setTab(item.id, 'specs')} className={`whitespace-nowrap px-4 py-3 text-label-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${currentTab === 'specs' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                           <Info className="w-4 h-4" /> Spesifikasi Full
                        </button>
                        <button onClick={() => setTab(item.id, 'installments')} className={`whitespace-nowrap px-4 py-3 text-label-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${currentTab === 'installments' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                           <CreditCard className="w-4 h-4" /> Simulasi Cicilan
                        </button>
                        <button onClick={() => setTab(item.id, 'gallery')} className={`whitespace-nowrap px-4 py-3 text-label-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${currentTab === 'gallery' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                           <ImageIcon className="w-4 h-4" /> Galeri Media
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div className="p-5">
                        
                        {/* TAB: SALES GUIDE */}
                        {currentTab === 'sales' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                            <p className="text-body-sm text-on-surface-variant italic border-l-2 border-primary pl-3 bg-surface-high/30 py-2 rounded-r-lg">
                              "{item.shortDesc}"
                            </p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                                <div className="text-label-xs text-primary font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5" /> Core Highlights
                                </div>
                                <ul className="space-y-2">
                                  {mkt.highlights.map(h => (
                                    <li key={h} className="text-body-sm text-on-surface flex items-start gap-2"><div className="w-1.5 h-1.5 bg-primary/70 rounded-full mt-1.5 flex-shrink-0"/>{h}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/10">
                                <div className="text-label-xs text-secondary font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5" /> Selling Points (Bonus)
                                </div>
                                <ul className="space-y-2">
                                  {mkt.sellingPoints.map(s => (
                                    <li key={s} className="text-body-sm text-on-surface flex items-start gap-2"><div className="w-1.5 h-1.5 bg-secondary/70 rounded-full mt-1.5 flex-shrink-0"/>{s}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="p-4 rounded-xl bg-error/5 border border-error/10">
                                <div className="text-label-xs text-error font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5" /> Handle Bantahan User
                                </div>
                                <ul className="space-y-2">
                                  {mkt.objections.map(o => (
                                    <li key={o} className="text-body-sm text-on-surface flex items-start gap-2"><div className="w-1.5 h-1.5 bg-error/70 rounded-full mt-1.5 flex-shrink-0"/>{o}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* TAB: SPECS */}
                        {currentTab === 'specs' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {item.specs ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5 border border-outline-variant/10 rounded-xl overflow-hidden bg-surface-high/30">
                                {Object.entries(item.specs).map(([key, val], idx) => (
                                  <div key={key} className={`flex items-center justify-between p-3 ${idx % 2 === 0 ? 'bg-surface-highest/20' : ''}`}>
                                    <span className="text-label-sm text-on-surface-variant font-medium">{key}</span>
                                    <span className="text-body-sm font-bold text-on-surface text-right ml-4">{val as React.ReactNode}</span>
                                  </div>
                                ))}
                                {item.colors && (
                                  <div className="flex items-start justify-between p-3 col-span-full border-t border-outline-variant/10">
                                     <span className="text-label-sm text-on-surface-variant font-medium mt-1">Pilihan Warna</span>
                                     <div className="flex flex-wrap items-center justify-end gap-1.5">
                                        {item.colors.map(color => (
                                          <span key={color} className="px-2 py-1 bg-surface-highest border border-outline-variant/20 rounded-md text-label-xs font-bold text-on-surface">{color}</span>
                                        ))}
                                     </div>
                                  </div>
                                )}
                               </div>
                            ) : (
                              <div className="text-center py-8 text-on-surface-variant text-body-sm">Spesifikasi detail tidak tersedia untuk produk ini.</div>
                            )}
                          </motion.div>
                        )}

                        {/* TAB: INSTALLMENTS (SIMULASI CICILAN) */}
                        {currentTab === 'installments' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="flex flex-col gap-6">
                              <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-dark rounded-xl border border-primary/20">
                                <div className="flex flex-col gap-1">
                                   <h4 className="font-display font-bold text-on-surface">Pilih Tipe Nasabah</h4>
                                   <p className="text-[10px] text-on-surface-variant font-medium">Data cicilan mengikuti Pricelist 2025 (Excel)</p>
                                </div>
                                <div className="flex gap-2 p-1 bg-surface-high/50 rounded-xl border border-outline-variant/10">
                                  <button 
                                    onClick={() => setCustomerType('NEW')}
                                    className={`px-4 py-1.5 rounded-lg text-label-sm font-bold transition-all ${customerType === 'NEW' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                                  >
                                    Nasabah Baru
                                  </button>
                                  <button 
                                    onClick={() => setCustomerType('RO')}
                                    className={`px-4 py-1.5 rounded-lg text-label-sm font-bold transition-all ${customerType === 'RO' ? 'bg-secondary text-on-primary shadow-lg shadow-secondary/20' : 'text-on-surface-variant hover:text-on-surface'}`}
                                  >
                                    Repeat Order (RO)
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {creditData ? (() => {
                                  try {
                                    const categoryKey = mapProductToCreditCategory(item.category);
                                    const result = calculateInstallments(
                                      creditData, 
                                      item.price, 
                                      customerType, 
                                      categoryKey
                                    );
                                    
                                    return Object.entries(result.installments).map(([tenor, amount]) => (
                                      <div key={tenor} className="p-4 rounded-xl border border-outline-variant/20 bg-surface-high/20 flex flex-col items-center justify-center text-center hover:border-primary/40 transition-all group">
                                         <div className="text-body-sm font-bold text-on-surface-variant mb-1 group-hover:text-on-surface transition-colors">
                                           {tenorLabel(tenor as any)}
                                         </div>
                                         <div className="text-body-lg font-display font-bold text-primary">
                                           {formatRupiah(amount as number)}
                                         </div>
                                         <div className="text-[10px] text-primary/80 font-bold italic mt-1">
                                           {tenorPromoNote(tenor as any)}
                                         </div>
                                      </div>
                                    ));
                                  } catch (e) {
                                    return <div className="col-span-full p-8 text-center text-label-sm text-error bg-error/5 rounded-xl border border-error/10">Data simulasi tidak tersedia untuk rentang harga ini.</div>;
                                  }
                                })() : (
                                  <div className="col-span-full p-8 text-center text-label-sm text-on-surface-variant animate-pulse">Memuat data pricelist...</div>
                                )}
                              </div>

                              <div className="p-4 rounded-xl bg-surface-low border border-outline-variant/10">
                                <div className="flex items-start gap-3">
                                  <Info className="w-5 h-5 text-on-surface-variant flex-shrink-0 mt-0.5" />
                                  <div className="space-y-1">
                                    <p className="text-label-sm font-bold text-on-surface">Informasi Penting</p>
                                    <p className="text-[10px] text-on-surface-variant leading-relaxed">
                                      Simulasi di atas sudah termasuk biaya admin <strong>Rp 700.000</strong>. 
                                      Pembulatan harga barang dilakukan ke kelipatan <strong>Rp 25.000</strong> terdekat sesuai aturan baku pricelist Tridjaya Samrat 2025. 
                                      Persetujuan final ditentukan oleh leasing partner.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* TAB: GALLERY */}
                        {currentTab === 'gallery' && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {item.images && item.images.length > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {item.images.map((img, i) => (
                                  <a key={i} href={img} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden border border-outline-variant/10 group relative bg-surface-high">
                                    <img src={img} alt={`${item.name} ${i+1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Eye className="w-6 h-6 text-white" />
                                    </div>
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-on-surface-variant text-body-sm">Galeri kosong. Hanya ada gambar utama.</div>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* Sticky Footer / Action Bar */}
                      <div className="p-4 border-t border-outline-variant/10 bg-surface-lowest flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                           <Link to={`/produk/${item.slug}`} target="_blank" className="px-4 py-2 rounded-lg bg-surface-high border border-outline-variant/20 text-on-surface font-semibold text-label-sm hover:bg-surface-highest transition-colors inline-flex items-center gap-2">
                              <Eye className="w-4 h-4 text-on-surface-variant" /> Lihat Landing Page
                           </Link>
                           <button onClick={() => handleCopyLink(item.slug)} className="px-4 py-2 rounded-lg bg-surface-high border border-outline-variant/20 text-on-surface font-semibold text-label-sm hover:text-primary transition-colors inline-flex items-center gap-2">
                              <Share2 className="w-4 h-4" /> Copy Link
                           </button>
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleCopyMaterial(item)}
                             className="px-5 py-2 rounded-lg gradient-primary text-surface font-bold text-label-sm hover:shadow-neon-cyan transition-all inline-flex items-center gap-2"
                           >
                              <Copy className="w-4 h-4" /> Copy Materi WA
                           </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })
      )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
        className="mt-6 border-t border-outline-variant/10"
      />
    </motion.div>
  );
};

export default AgentKnowledgePage;