import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, Search, Filter, Star, Package,
  ChevronDown, ChevronUp, Zap, ShoppingCart, Eye,
} from 'lucide-react';

const knowledgeItems = [
  {
    id: 'PKB-001', title: 'Goda GD120 — Sepeda Listrik Sport',
    category: 'Sepeda Listrik', type: 'Spesifikasi',
    price: 'Rp 7.500.000', stock: 24,
    highlights: ['Baterai 48V 20Ah — radius 80km', 'Motor 750W brushless', 'Frame alloy ringan 18kg', 'Cocok untuk komuter harian'],
    sellingPoints: ['DP mulai Rp 1.25jt', 'Garansi motor 2 tahun', 'Free helm + jas hujan'],
    objections: ['"Mahal" → bandingkan biaya BBM 3 bulan', '"Jarang servis" → bengkel resmi di 12 kota'],
    views: 2482, rating: 4.8, slug: 'goda-gd120',
  },
  {
    id: 'PKB-002', title: 'Winfly W200 — City Cruiser',
    category: 'Sepeda Listrik', type: 'Spesifikasi',
    price: 'Rp 9.200.000', stock: 11,
    highlights: ['Baterai 60V 24Ah — radius 100km', 'Lampu LED full-set', 'Suspensi dual shock', 'Desain retro modern'],
    sellingPoints: ['Gratis aksesoris senilai Rp 500rb', 'Cicilan 0% 12 bulan', 'Test ride tersedia'],
    objections: ['"Berat" → 22kg tapi ada fitur push mode', '"Mahal" → lebih hemat Rp 3jt vs kompetitor setara'],
    views: 1940, rating: 4.6, slug: 'winfly-w200',
  },
  {
    id: 'PKB-003', title: 'Smart TV OLED 55" — Premium Display',
    category: 'Elektronik', type: 'Spesifikasi',
    price: 'Rp 8.400.000', stock: 7,
    highlights: ['Panel OLED 55" 4K HDR', 'Smart OS Android TV 13', 'Dolby Atmos Audio', '4 HDMI + 2 USB'],
    sellingPoints: ['Garansi panel 3 tahun', 'Instalasi gratis area Makassar', 'Free bracket dinding'],
    objections: ['"Terlalu mahal" → cicilan mulai Rp 350rb/bln', '"Belum butuh 4K" → future-proof investment'],
    views: 1621, rating: 4.7, slug: 'smart-tv-65',
  },
  {
    id: 'PKB-004', title: 'Sofa Premium L — Living Room Set',
    category: 'Furnitur', type: 'Produk',
    price: 'Rp 5.200.000', stock: 3,
    highlights: ['Kain beludru anti-noda', 'Rangka kayu jati solid', 'Cushion memory foam', 'Garansi 5 tahun rangka'],
    sellingPoints: ['Pengiriman gratis Jabodetabek', 'Bisa custom warna', 'Paket beli 2 diskon 15%'],
    objections: ['"Stok sedikit" → justru limited, exclusive feel', '"Harga tinggi" → kualitas premium, tahan 10+ tahun'],
    views: 1204, rating: 4.4, slug: 'sofa-premium-l',
  },
];

const categories = ['Semua', 'Sepeda Listrik', 'Elektronik', 'Furnitur'];

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AgentKnowledgePage: React.FC = () => {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('Semua');
  const [expandedId, setExpandedId] = useState<string | null>('PKB-001');

  const filtered = knowledgeItems.filter((k) => {
    const matchSearch   = k.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'Semua' || k.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Panduan Penjualan</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-primary" /> Product Knowledge
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Akses cepat spesifikasi, harga, stok, selling point, dan cara menangani keberatan pelanggan untuk closing lebih cepat.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-display text-headline-sm font-bold text-primary">{knowledgeItems.length}</div>
              <div className="text-label-xs text-on-surface-variant">Produk tersedia</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Produk', value: knowledgeItems.length, color: 'text-primary', bg: 'bg-primary/10', icon: Package },
          { label: 'Avg Rating', value: (knowledgeItems.reduce((s, k) => s + k.rating, 0) / knowledgeItems.length).toFixed(1), color: 'text-secondary', bg: 'bg-secondary/10', icon: Star },
          { label: 'Total Views', value: knowledgeItems.reduce((s, k) => s + k.views, 0).toLocaleString('id-ID'), color: 'text-tertiary', bg: 'bg-tertiary/10', icon: Eye },
          { label: 'Stok Kritis', value: knowledgeItems.filter((k) => k.stock < 5).length, color: 'text-error', bg: 'bg-error/10', icon: ShoppingCart },
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
            type="text" placeholder="Cari produk..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-on-surface-variant" />
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${category === c ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
              {c}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Knowledge Cards (Accordion) */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <motion.div key={item.id} variants={iv} className="glass-card rounded-xl overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
              {/* Header Row */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-surface-high/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 font-bold text-on-primary text-sm">
                  {item.title[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-label-xs font-bold">{item.type}</span>
                    <span className="px-2 py-0.5 rounded-md bg-surface-highest text-on-surface-variant text-label-xs">{item.category}</span>
                    {item.stock < 5 && (
                      <span className="px-2 py-0.5 rounded-md bg-error/10 text-error text-label-xs font-bold">Stok Kritis: {item.stock}</span>
                    )}
                  </div>
                  <div className="font-display font-bold text-on-surface">{item.title}</div>
                </div>
                <div className="hidden md:flex items-center gap-6 flex-shrink-0 mr-4">
                  <div className="text-center">
                    <div className="font-bold text-on-surface text-body-sm">{item.price}</div>
                    <div className="text-label-xs text-on-surface-variant">Harga</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-on-surface text-body-sm">{item.stock} unit</div>
                    <div className="text-label-xs text-on-surface-variant">Stok</div>
                  </div>
                  <div className="text-center inline-flex flex-col items-center">
                    <div className="font-bold text-on-surface text-body-sm inline-flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{item.rating}
                    </div>
                    <div className="text-label-xs text-on-surface-variant">Rating</div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-on-surface-variant flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-on-surface-variant flex-shrink-0" />}
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-5 border-t border-outline-variant/10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {/* Specs */}
                    <div className="p-4 rounded-xl bg-surface-low border border-outline-variant/10">
                      <div className="text-label-xs text-on-surface-variant font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-primary" /> Fitur Utama
                      </div>
                      <ul className="space-y-1.5">
                        {item.highlights.map((h) => (
                          <li key={h} className="text-body-sm text-on-surface flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />{h}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Selling Points */}
                    <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/15">
                      <div className="text-label-xs text-secondary font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" /> Selling Points
                      </div>
                      <ul className="space-y-1.5">
                        {item.sellingPoints.map((s) => (
                          <li key={s} className="text-body-sm text-on-surface flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-secondary rounded-full mt-1.5 flex-shrink-0" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Handle Objections */}
                    <div className="p-4 rounded-xl bg-tertiary/5 border border-tertiary/15">
                      <div className="text-label-xs text-tertiary font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" /> Handle Keberatan
                      </div>
                      <ul className="space-y-1.5">
                        {item.objections.map((o) => (
                          <li key={o} className="text-body-sm text-on-surface flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-tertiary rounded-full mt-1.5 flex-shrink-0" />{o}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <Link to={`/produk/${item.slug}`} className="px-4 py-2 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-1.5 hover:bg-primary/25 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Lihat Halaman Produk
                    </Link>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Halo! Saya agen Tridjaya Samrat. Kami memiliki ${item.title} dengan harga spesial ${item.price}. Tertarik? Chat saya sekarang!`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-[#25D366]/15 text-[#25D366] font-semibold text-label-sm inline-flex items-center gap-1.5 hover:bg-[#25D366]/25 transition-colors"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" /> Share ke WA
                    </a>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AgentKnowledgePage;