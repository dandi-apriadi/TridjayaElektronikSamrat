import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Battery,
  Bike,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gauge,
  MapPin,
  Phone,
  Shield,
  Sofa,
  Sparkles,
  Smartphone,
  Truck,
  Utensils,
  Wrench,
  Zap,
} from 'lucide-react';
import { PartnerLogos, ProductCard, SectionHeader, StatsRow } from '../components/ui';
import { recordTelemetry } from '../utils/telemetry';
import { useProductStore } from '../store/useProductStore';
import { useThemeStore } from '../store/themeStore';
import type { Product } from '../types';
import { formatPrice, products as fallbackProducts } from '../data';
import { getImageUrl } from '../utils/apiClient';

import logoHorizontal from '../assets/images/logo-horizontal.webp';

import heroLatteBg from '../assets/images/landing/generated-pro/hero-products/hero-bg-latte.webp';
import heroCappuccinoBg from '../assets/images/landing/generated-pro/hero-products/hero-bg-cappuccino.webp';
import heroPolarisBg from '../assets/images/landing/generated-pro/hero-products/hero-bg-polaris.webp';
import heroKingkongBg from '../assets/images/landing/generated-pro/hero-products/hero-bg-kingkong.webp';
import heroD66BBg from '../assets/images/landing/generated-pro/hero-products/hero-bg-d66b.webp';
import heroLatteProduct from '../assets/images/landing/hero-custom/hero-latte-red.png';
import heroCappuccinoProduct from '../assets/images/landing/hero-custom/hero-cappuccino-green.png';
import heroPolarisProduct from '../assets/images/landing/hero-custom/hero-polaris-family.png';
import heroKingkongProduct from '../assets/images/landing/hero-custom/hero-kingkong-white.png';
import heroD66BProduct from '../assets/images/landing/hero-custom/hero-uwinfly-d66b-pink.png';
import categoryMobilityPro from '../assets/images/landing/generated-pro/category-mobility.webp';
import categoryElectronicsPro from '../assets/images/landing/generated-pro/category-electronics.webp';
import categoryFurniturePro from '../assets/images/landing/generated-pro/category-furniture.webp';
import categoryDiningPro from '../assets/images/landing/generated-pro/category-dining.webp';
import smartRideShowcasePro from '../assets/images/landing/generated-pro/smart-ride-showcase-pro.webp';
import d66bMain from '../assets/images/landing/d66b-main-page-S9HT2gRVddXkHuYK.avif';
import d66bPerformance from '../assets/images/landing/d66b-performance-page-4-ybCecsyBXB9EFblH.avif';
import d66bShoot from '../assets/images/landing/d66b-shoot-transparant-bQlgwb4RFhdgShXT.avif';
import d66bUsed from '../assets/images/landing/d66b-used-png-DjH5NU3CT2HNCKmR.avif';

type LandingSlide = {
  id: string;
  eyebrow: string;
  title: string;
  accent: string;
  copy: string;
  href: string;
  cta: string;
  bg: string;
  product: string;
  productAlt: string;
  icon: React.ElementType;
  price: string;
  oldPrice: string;
  detailLine: string;
  metrics: { icon: React.ElementType; value: string; label: string }[];
  specs: { icon: React.ElementType; value: string; label: string }[];
};

const landingSlides: LandingSlide[] = [
  {
    id: 'latte',
    eyebrow: 'Saige Latte',
    title: 'Latte merah premium untuk mobilitas harian.',
    accent: 'Desain modern, cicilan ringan, siap pakai.',
    copy: 'Skuter listrik bergaya urban dengan bodi kompak, warna merah berani, dan pilihan kredit yang mudah untuk dipakai harian.',
    href: '/produk?kategori=Sepeda+Listrik',
    cta: 'Lihat Saige Latte',
    bg: heroLatteBg,
    product: heroLatteProduct,
    productAlt: 'Saige Latte merah',
    icon: Bike,
    price: 'Rp 4.700.000',
    oldPrice: 'Rp 5.200.000',
    detailLine: 'Motor 60V 800W | Baterai lithium 60V 20Ah | Ban tubeless 2.75-10',
    metrics: [
      { icon: Zap, value: '800W', label: 'motor' },
      { icon: Battery, value: '50-70 km', label: 'jarak tempuh' },
      { icon: Gauge, value: '45 km/jam', label: 'kecepatan maks.' },
    ],
    specs: [
      { icon: Zap, value: '800W', label: 'motor' },
      { icon: Battery, value: '60V 20Ah', label: 'lithium' },
      { icon: MapPin, value: '50-70 km', label: 'jarak tempuh' },
      { icon: Gauge, value: '45 km/jam', label: 'kecepatan' },
      { icon: Wrench, value: '6-8 jam', label: 'pengisian' },
      { icon: Shield, value: '170 kg', label: 'beban maks.' },
    ],
  },
  {
    id: 'cappuccino',
    eyebrow: 'Saige Cappuccino',
    title: 'Cappuccino tampil retro, tetap bertenaga.',
    accent: 'Baterai lithium, warna kalem, gaya premium.',
    copy: 'Pilihan retro-premium untuk perjalanan santai, dengan posisi berkendara nyaman dan detail warna yang terlihat rapi di showroom.',
    href: '/produk?kategori=Sepeda+Listrik',
    cta: 'Lihat Cappuccino',
    bg: heroCappuccinoBg,
    product: heroCappuccinoProduct,
    productAlt: 'Saige Cappuccino hijau krem',
    icon: Bike,
    price: 'Rp 8.000.000',
    oldPrice: 'Rp 8.700.000',
    detailLine: 'Motor 48/60V 800W | Baterai 48/60V 20Ah | Rem disc/drum',
    metrics: [
      { icon: Zap, value: '800W', label: 'motor' },
      { icon: Battery, value: '60-80 km', label: 'jarak tempuh' },
      { icon: Shield, value: '48/60V', label: 'sistem' },
    ],
    specs: [
      { icon: Zap, value: '800W', label: 'motor' },
      { icon: Battery, value: '48/60V 20Ah', label: 'baterai' },
      { icon: MapPin, value: '60-80 km', label: 'jarak tempuh' },
      { icon: Gauge, value: '25/33 km/jam', label: 'kecepatan' },
      { icon: Wrench, value: '6-8 jam', label: 'pengisian' },
      { icon: Shield, value: '170 kg', label: 'beban maks.' },
    ],
  },
  {
    id: 'polaris',
    eyebrow: 'Saige Polaris',
    title: 'Polaris nyaman untuk keluarga dan usaha.',
    accent: 'Tiga roda stabil, jok lebar, kapasitas besar.',
    copy: 'Tiga roda yang stabil untuk belanja, antar-jemput, dan kebutuhan usaha ringan dengan ruang duduk yang lega.',
    href: '/produk?kategori=Sepeda+Listrik',
    cta: 'Lihat Saige Polaris',
    bg: heroPolarisBg,
    product: heroPolarisProduct,
    productAlt: 'Saige Polaris tiga roda',
    icon: Bike,
    price: 'Rp 12.700.000',
    oldPrice: 'Rp 13.200.000',
    detailLine: 'Motor 800W 48/60V | Baterai 60V 20Ah | Drum brake | Ban vacuum 300-8',
    metrics: [
      { icon: Zap, value: '800W', label: 'motor' },
      { icon: Battery, value: '60 km', label: 'jarak tempuh' },
      { icon: Shield, value: '3 roda', label: 'stabil' },
    ],
    specs: [
      { icon: Zap, value: '800W', label: 'motor' },
      { icon: Battery, value: '60V 20Ah', label: 'baterai' },
      { icon: MapPin, value: '60 km', label: 'jarak tempuh' },
      { icon: Gauge, value: '3 mode', label: 'controller' },
      { icon: Wrench, value: '6-8 jam', label: 'pengisian' },
      { icon: Shield, value: '300-8', label: 'ban vacuum' },
    ],
  },
  {
    id: 'kingkong',
    eyebrow: 'Goda Mecha Kingkong',
    title: 'Mecha Kingkong 199 Max bertenaga tinggi.',
    accent: '72V 20Ah, motor 1500W, suspensi siap jalan jauh.',
    copy: 'Model Goda dengan motor high-torque, dual disc brake, dan fitur Auto-P untuk pengendara yang butuh tenaga lebih dari sepeda listrik biasa.',
    href: '/produk?kategori=Sepeda+Listrik',
    cta: 'Lihat Mecha Kingkong',
    bg: heroKingkongBg,
    product: heroKingkongProduct,
    productAlt: 'Goda Mecha Kingkong Blue Saber',
    icon: Bike,
    price: 'Cek Promo',
    oldPrice: 'Harga mengikuti varian dan stok toko',
    detailLine: '72V 20Ah battery + 1500W motor | 220mm dual disc brake | 3 power modes',
    metrics: [
      { icon: Zap, value: '1500W', label: 'motor' },
      { icon: Battery, value: '72V 20Ah', label: 'baterai' },
      { icon: Shield, value: 'Dual disc', label: 'rem' },
    ],
    specs: [
      { icon: Zap, value: '1500W', label: 'motor' },
      { icon: Battery, value: '72V 20Ah', label: 'baterai' },
      { icon: Shield, value: '220mm', label: 'dual disc' },
      { icon: Wrench, value: 'USD fork', label: 'suspensi' },
      { icon: Gauge, value: 'LCD', label: 'panel' },
      { icon: Sparkles, value: 'Auto-P', label: 'smart tech' },
    ],
  },
  {
    id: 'd66b',
    eyebrow: 'Uwinfly D66B',
    title: 'Uwinfly D66B modern untuk perjalanan dekat.',
    accent: 'Smart key, jok sofa, bagasi 13 liter.',
    copy: 'Smart e-bike Uwinfly dengan motor BLDC 600W, baterai SLA 48V 12Ah, dan desain kompak yang cocok untuk mobilitas harian jarak dekat.',
    href: '/produk?kategori=Sepeda+Listrik',
    cta: 'Lihat Uwinfly D66B',
    bg: heroD66BBg,
    product: heroD66BProduct,
    productAlt: 'Uwinfly D66B pink',
    icon: Bike,
    price: 'Cek Promo',
    oldPrice: 'Tanyakan harga terbaru ke sales',
    detailLine: '600W BLDC | 48V 12Ah SLA | +/- 42 km | disc brake | bagasi 13L',
    metrics: [
      { icon: Zap, value: '600W', label: 'motor' },
      { icon: Battery, value: '42 km', label: 'jarak tempuh' },
      { icon: Gauge, value: '33 km/jam', label: 'kecepatan' },
    ],
    specs: [
      { icon: Zap, value: '600W', label: 'BLDC' },
      { icon: Battery, value: '48V 12Ah', label: 'SLA' },
      { icon: MapPin, value: '+/- 42 km', label: 'jarak tempuh' },
      { icon: Gauge, value: '+/- 33 km/jam', label: 'kecepatan' },
      { icon: Shield, value: '150 kg', label: 'beban maks.' },
      { icon: Sparkles, value: 'U-Connect', label: 'smart key' },
    ],
  },
];

const productStoryTones = [
  'from-red-500/24 via-white/5 to-cyan-300/18',
  'from-lime-300/22 via-white/5 to-amber-300/18',
  'from-sky-300/22 via-white/5 to-tertiary/16',
];

const heroProductHints = ['latte', 'cappuccino', 'polaris', 'kingkong', 'king kong', 'd66b', 'd66 b'];

const getProductStoryItems = (products: Product[]) => {
  const visibleProducts = products.filter((product) => product.stock !== 'hidden' && product.image);
  const otherProducts = visibleProducts.filter((product) => {
    const searchable = `${product.name} ${product.slug} ${product.subcategory}`.toLowerCase();
    return !heroProductHints.some((hint) => searchable.includes(hint));
  });
  const source = otherProducts.length >= 3 ? otherProducts : visibleProducts;

  return [...source]
    .sort((a, b) => {
      const scoreA = (a.views ?? 0) + (a.leads ?? 0) * 3 + (a.conversions ?? 0) * 8;
      const scoreB = (b.views ?? 0) + (b.leads ?? 0) * 3 + (b.conversions ?? 0) * 8;
      return scoreB - scoreA || b.price - a.price;
    })
    .slice(0, 3);
};

const categoryPanels = [
  {
    label: 'Sepeda Listrik',
    copy: 'Skuter, e-bike, dan kendaraan keluarga dengan badge spesifikasi yang mudah dibaca.',
    href: '/produk?kategori=Sepeda+Listrik',
    image: categoryMobilityPro,
    icon: Bike,
    tone: 'cyan',
    tags: ['60 km', '800W', 'Garansi'],
  },
  {
    label: 'Elektronik',
    copy: 'TV, AC, kulkas, handphone, dan perangkat rumah tangga untuk kebutuhan harian.',
    href: '/produk?kategori=AC',
    image: categoryElectronicsPro,
    icon: Smartphone,
    tone: 'lime',
    tags: ['AC', 'TV 4K', 'Kulkas'],
  },
  {
    label: 'Sofa & Kursi',
    copy: 'Tampilan ruang keluarga yang lebih hangat dengan pilihan bahan dan warna rapi.',
    href: '/produk?kategori=SOPA',
    image: categoryFurniturePro,
    icon: Sofa,
    tone: 'pink',
    tags: ['Sofa', 'Kursi', 'Meja'],
  },
  {
    label: 'Meja Makan',
    copy: 'Paket dining set untuk rumah baru, renovasi, dan kebutuhan keluarga.',
    href: '/produk?kategori=Meja',
    image: categoryDiningPro,
    icon: Utensils,
    tone: 'amber',
    tags: ['Dining', 'Set', 'Ready'],
  },
];

const serviceHighlights = [
  { icon: CreditCard, label: 'Kredit Tanpa Uang Muka', desc: 'Proses cepat dengan partner leasing resmi.' },
  { icon: Truck, label: 'Kirim Cepat', desc: 'Pengiriman aman untuk Manado dan sekitarnya.' },
  { icon: Shield, label: 'Produk Original', desc: 'Garansi resmi dan kualitas terjamin.' },
  { icon: Phone, label: 'Sales Responsif', desc: 'Konsultasi produk sebelum datang ke toko.' },
];

const smartRideFeatures = [
  { title: 'Lampu LED Modern', desc: 'Tampilan tajam, terang, dan hemat energi.', img: d66bMain },
  { title: 'Baterai Efisien', desc: 'Dirancang untuk mobilitas harian yang lebih hemat.', img: d66bPerformance },
  { title: 'Jok Nyaman', desc: 'Posisi duduk ergonomis untuk pengendara dan penumpang.', img: d66bUsed },
  { title: 'Body Futuristik', desc: 'Finishing glossy dengan detail produk yang terasa premium.', img: d66bShoot },
];

const toneClass: Record<string, string> = {
  cyan: 'border-primary/25 bg-primary/10 text-primary',
  lime: 'border-secondary/25 bg-secondary/10 text-secondary',
  pink: 'border-tertiary/25 bg-tertiary/10 text-tertiary',
  amber: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
};

const trackClick = (path: string, source: string, metadata: Record<string, unknown> = {}) => {
  recordTelemetry('click', { path, source, metadata });
};

const FloatingCircuits = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div className="electric-grid absolute inset-0 opacity-20" />
    {[...Array(5)].map((_, index) => (
      <motion.span
        key={index}
        className="electric-spark opacity-60"
        style={{
          left: `${14 + index * 17}%`,
          top: `${24 + (index % 3) * 17}%`,
        }}
        animate={{ y: [0, -10, 0], opacity: [0.12, 0.42, 0.12], scale: [1, 1.18, 1] }}
        transition={{ duration: 3.8 + index * 0.3, repeat: Infinity, delay: index * 0.28, ease: 'easeInOut' }}
      />
    ))}
  </div>
);

const HeroPricePanel: React.FC<{ slide: LandingSlide; className?: string }> = ({ slide, className = '' }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={`${slide.id}-price`}
      className={`brochure-price-card landing-offer-card rounded-xl border border-white/14 p-3 ${className}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.45, delay: 0.04 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="brochure-label inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 font-body text-[0.65rem] font-black uppercase text-on-primary">
          <CreditCard className="h-3 w-3" />
          Harga Promo
        </span>
        <span className="brochure-mini-note font-body text-[0.62rem] font-black uppercase text-white/50">Kredit</span>
      </div>
      <p className="landing-offer-price mt-2 font-display text-[1.7rem] font-black leading-none text-red-500 sm:text-[2rem]">
        {slide.price}
      </p>
      <p className="mt-1.5 font-body text-[0.72rem] font-bold text-white/55">
        {slide.oldPrice.startsWith('Rp') ? (
          <>
            Normal <span className="text-white/45 line-through decoration-red-500 decoration-2">{slide.oldPrice}</span>
          </>
        ) : (
          <span className="line-clamp-2">{slide.oldPrice}</span>
        )}
      </p>
    </motion.div>
  </AnimatePresence>
);

const HeroSpecPanel: React.FC<{ slide: LandingSlide; className?: string }> = ({ slide, className = '' }) => (
  <AnimatePresence mode="wait">
    <motion.div
      key={`${slide.id}-specs`}
      className={`hero-spec-elegant ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header with refined typography */}
      <div className="hero-spec-elegant-header">
        <div className="hero-spec-elegant-line" />
        <span className="hero-spec-elegant-title">Spesifikasi</span>
      </div>

      {/* Spec items with elegant spacing */}
      <div className="hero-spec-elegant-list">
        {slide.specs.slice(0, 6).map(({ icon: Icon, value, label }, i) => (
          <motion.div
            key={`${slide.id}-spec-${label}`}
            className="hero-spec-elegant-item group"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.5, 
              delay: 0.15 + i * 0.06,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            <div className="hero-spec-elegant-icon">
              <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <div className="hero-spec-elegant-content">
              <p className="hero-spec-elegant-value">{value}</p>
              <p className="hero-spec-elegant-label">{label}</p>
            </div>
            <div className="hero-spec-elegant-accent" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  </AnimatePresence>
);

// Badge components removed - focusing on specs and promo only

const HeroSection: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const { scrollYProgress } = useScroll();
  const contentY = useTransform(scrollYProgress, [0, 0.35], [0, 42]);
  const slide = landingSlides[current];

  const goNext = useCallback(() => setCurrent((value) => (value + 1) % landingSlides.length), []);
  const goPrev = useCallback(() => setCurrent((value) => (value - 1 + landingSlides.length) % landingSlides.length), []);

  useEffect(() => {
    if (!autoplay) return;
    const timer = window.setInterval(goNext, 6200);
    return () => window.clearInterval(timer);
  }, [autoplay, goNext]);

  // Drag / swipe handling
  const dragStartX = useRef<number | null>(null);
  const isDragging = useRef(false);
  const SWIPE_THRESHOLD = 50;

  const handleDragStart = useCallback((x: number) => {
    dragStartX.current = x;
    isDragging.current = false;
  }, []);

  const handleDragMove = useCallback((x: number) => {
    if (dragStartX.current === null) return;
    if (Math.abs(x - dragStartX.current) > 8) isDragging.current = true;
  }, []);

  const handleDragEnd = useCallback((x: number) => {
    if (dragStartX.current === null) return;
    const delta = x - dragStartX.current;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      if (delta < 0) goNext();
      else goPrev();
      setAutoplay(false);
    }
    dragStartX.current = null;
    isDragging.current = false;
  }, [goNext, goPrev]);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => handleDragStart(e.touches[0].clientX), [handleDragStart]);
  const onTouchMove = useCallback((e: React.TouchEvent) => handleDragMove(e.touches[0].clientX), [handleDragMove]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => handleDragEnd(e.changedTouches[0].clientX), [handleDragEnd]);

  // Mouse events (desktop drag)
  const onMouseDown = useCallback((e: React.MouseEvent) => handleDragStart(e.clientX), [handleDragStart]);
  const onMouseMove = useCallback((e: React.MouseEvent) => handleDragMove(e.clientX), [handleDragMove]);
  const onMouseUp = useCallback((e: React.MouseEvent) => handleDragEnd(e.clientX), [handleDragEnd]);
  const onMouseLeave = useCallback((e: React.MouseEvent) => {
    if (dragStartX.current !== null) handleDragEnd(e.clientX);
  }, [handleDragEnd]);

  return (
    <section
      className="brochure-hero landing-theme-surface relative overflow-hidden bg-[#eef6ff]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onClick={(e) => { if (isDragging.current) e.preventDefault(); }}
      style={{ userSelect: 'none' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slide.id}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={slide.bg} alt="" className="brochure-bg-image h-full w-full object-cover object-center" />
          <div className="landing-hero-overlay-x absolute inset-0" />
          <div className="landing-hero-overlay-y absolute inset-0" />
        </motion.div>
      </AnimatePresence>

      <FloatingCircuits />

      <motion.div style={{ y: contentY }} className="container-custom relative z-10 flex min-h-[calc(100svh-4rem)] items-center py-16 lg:py-20">
        <div className="grid w-full items-center gap-6 lg:grid-cols-[0.8fr_minmax(0,1.2fr)] lg:gap-4">
          {/* Left: copy */}
          <div className="brochure-copy">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${slide.id}-copy`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.55 }}
              >
                <div className="brochure-brand-row mb-4 flex flex-wrap items-center gap-2">
                  <img src={logoHorizontal} alt="Tridjaya Elektronik Manado" className="brochure-inline-logo h-8 w-auto rounded-md bg-white/80 p-1" />
                  <div className="brochure-brand-chip inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    <slide.icon className="h-3.5 w-3.5 flex-none text-primary" />
                    <span className="truncate font-body text-[0.7rem] font-black uppercase text-white/80">{slide.eyebrow}</span>
                    <span className="h-1 w-1 rounded-full bg-secondary" />
                    <span className="font-body text-[0.7rem] font-black text-white/50">
                      {String(current + 1).padStart(2, '0')} / {String(landingSlides.length).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <h1 className="brochure-title font-display font-black leading-[0.93] text-white">
                  {slide.title}
                </h1>
                <p className="brochure-accent mt-3 font-display font-bold text-secondary">
                  {slide.accent}
                </p>
                <p className="brochure-copy-text mt-3 max-w-lg font-body leading-relaxed text-white/72">
                  {slide.copy}
                </p>
              </motion.div>
            </AnimatePresence>

            <HeroPricePanel slide={slide} className="mt-4 hidden lg:block" />

            <div className="mt-4 hidden items-center gap-3 lg:flex">
              <Link
                to={slide.href}
                onClick={() => trackClick(slide.href, 'home_hero', { slideId: slide.id })}
                className="brochure-primary-cta group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-display text-sm font-black text-on-primary shadow-neon-cyan transition hover:-translate-y-0.5"
              >
                {slide.cta}
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* Right: product image + spec panel side by side */}
          <div className="hidden lg:flex lg:items-center lg:gap-4">
            {/* Product image */}
            <div className="brochure-product-wrap relative min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${slide.id}-product`}
                  className="brochure-product-stage relative aspect-[1/1]"
                  initial={{ opacity: 0, x: 42, rotate: 2 }}
                  animate={{ opacity: 1, x: 0, rotate: 0 }}
                  exit={{ opacity: 0, x: -24, rotate: -2 }}
                  transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="landing-product-shadow brochure-product-shadow absolute inset-x-8 bottom-10 h-16 rounded-[50%] bg-black/55 blur-2xl" />
                  <motion.img
                    src={slide.product}
                    alt={slide.productAlt}
                    className="landing-product-image relative z-10 h-full w-full object-contain mix-blend-screen drop-shadow-[0_24px_42px_rgba(0,0,0,0.48)]"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            {/* Spec panel */}
            <HeroSpecPanel slide={slide} className="w-[175px] flex-none" />
          </div>

          {/* Mobile: product image */}
          <div className="brochure-product-wrap relative mx-auto w-full max-w-[300px] sm:max-w-[380px] lg:hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${slide.id}-product-mobile`}
                className="brochure-product-stage relative aspect-square sm:aspect-[4/3]"
                initial={{ opacity: 0, x: 42, rotate: 2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -24, rotate: -2 }}
                transition={{ duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="landing-product-shadow brochure-product-shadow absolute inset-x-8 bottom-10 h-16 rounded-[50%] bg-black/55 blur-2xl" />
                <motion.img
                  src={slide.product}
                  alt={slide.productAlt}
                  className="landing-product-image relative z-10 h-full w-full object-contain mix-blend-screen drop-shadow-[0_24px_42px_rgba(0,0,0,0.48)]"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile: price promo (below image) */}
          <HeroPricePanel slide={slide} className="lg:hidden" />

          {/* Mobile: CTA buttons */}
          <div className="flex flex-col gap-3 sm:flex-row lg:hidden">
            <Link
              to={slide.href}
              onClick={() => trackClick(slide.href, 'home_hero', { slideId: slide.id })}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-display text-sm font-black text-on-primary shadow-neon-cyan transition hover:-translate-y-0.5"
            >
              {slide.cta}
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mobile: spec panel (below promo + CTA) */}
          <HeroSpecPanel slide={slide} className="lg:hidden" />
        </div>
      </motion.div>

      <div className="landing-slide-controls brochure-slide-controls absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/12 bg-black/25 px-3 py-2 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => {
            goPrev();
            setAutoplay(false);
          }}
          aria-label="Slide sebelumnya"
          className="grid h-9 w-9 place-items-center rounded-full text-white/72 transition hover:bg-white/12 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {landingSlides.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setCurrent(index);
              setAutoplay(false);
            }}
            aria-label={`Buka slide ${index + 1}`}
            className={`h-2 rounded-full transition-all ${index === current ? 'w-9 bg-primary' : 'w-2 bg-white/30 hover:bg-white/55'}`}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            goNext();
            setAutoplay(false);
          }}
          aria-label="Slide berikutnya"
          className="grid h-9 w-9 place-items-center rounded-full text-white/72 transition hover:bg-white/12 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
};

const ServiceRibbon = () => (
  <section className="landing-theme-surface relative z-20 bg-[#06162b] py-6 sm:-mt-8 sm:py-0">
    <div className="container-custom">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {serviceHighlights.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="landing-trust-card group flex min-h-[108px] items-center gap-4 rounded-xl border border-white/12 bg-[#0d2a4a]/88 p-5 shadow-[0_14px_34px_rgba(0,0,0,0.2)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#8ff5ff]/35 hover:bg-[#113457]/90"
          >
            <div className="landing-trust-icon grid h-11 w-11 flex-none place-items-center rounded-lg border border-[#8ff5ff]/20 bg-[#8ff5ff]/10 text-[#8ff5ff] transition group-hover:bg-[#8ff5ff]/15">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-title-sm font-black leading-tight text-white">{label}</p>
              <p className="mt-1.5 font-body text-body-sm leading-relaxed text-white/62">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ProductStorySection = () => {
  const { products, isLoading, error, fetchProducts } = useProductStore();
  const storySource = products.length > 0 ? products : fallbackProducts;
  const storyProducts = useMemo(() => getProductStoryItems(storySource), [storySource]);

  useEffect(() => {
    if (products.length === 0 && !isLoading && !error) {
      fetchProducts();
    }
  }, [error, fetchProducts, isLoading, products.length]);

  if (!isLoading && storyProducts.length === 0) return null;

  return (
    <section className="section-padding bg-surface">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Visual Promo"
          title="Foto Produk Dibuat Lebih Bersih"
          subtitle="Produk pilihan dari database ditampilkan seperti katalog premium, sementara harga dan informasi tetap tajam dari elemen UI."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {storyProducts.length > 0
            ? storyProducts.map((product, index) => (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-surface-container"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${productStoryTones[index % productStoryTones.length]}`} />
                  <Link
                    to={`/produk/${product.slug}`}
                    onClick={() => trackClick(`/produk/${product.slug}`, 'product_story', { productId: product.id, title: product.name })}
                    className="relative block"
                  >
                    <div className="aspect-[4/5] overflow-hidden">
                      <img
                        src={getImageUrl(product.image)}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div className="absolute inset-x-4 bottom-4 rounded-lg border border-white/14 bg-black/52 p-4 backdrop-blur-xl">
                      <div className="flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate font-display text-title-lg font-black text-white">{product.name}</p>
                          <p className="mt-1 line-clamp-1 text-body-sm text-white/64">{product.shortDesc || product.subcategory}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-secondary px-3 py-2 font-display text-title-sm font-black text-on-secondary">
                          {product.price > 0 ? formatPrice(product.price).replace('Rp', 'Rp ') : 'Cek Harga'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))
            : [0, 1, 2].map((item) => (
                <div key={item} className="min-h-[488px] animate-pulse rounded-xl border border-white/10 bg-surface-container/80" />
              ))}
        </div>
      </div>
    </section>
  );
};

const CategoryShowcase = () => {
  const { showImages } = useThemeStore();

  return (
    <section className="section-padding bg-surface-low/70">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Kategori"
          title="Elektronik, Mobility, dan Furniture Dalam Satu Alur"
          subtitle="Setiap kategori memakai visual studio yang lebih konsisten, mudah discan, dan tetap terasa dekat dengan produk asli."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {categoryPanels.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.div
                key={category.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: index * 0.06 }}
              >
                <Link
                  to={category.href}
                  onClick={() => trackClick(category.href, 'category_showcase', { category: category.label })}
                  className="group block h-full overflow-hidden rounded-xl border border-white/10 bg-surface-container transition hover:-translate-y-1 hover:border-primary/25"
                >
                  <div className="grid h-full min-h-[340px] grid-rows-[1fr_auto]">
                    <div className="relative overflow-hidden">
                      {showImages && (
                        <img
                          src={category.image}
                          alt={category.label}
                          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]"
                        />
                      )}
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,43,0.02),rgba(6,22,43,0.74))]" />
                      <div className={`absolute left-5 top-5 inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${toneClass[category.tone]}`}>
                        <Icon className="h-4 w-4" />
                        <span className="font-body text-label-sm font-black uppercase">{category.label}</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="font-body text-body-md leading-relaxed text-on-surface-variant">{category.copy}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {category.tags.map((tag) => (
                          <span key={tag} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-body-sm font-bold text-on-surface">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const SmartRideSection = () => (
  <section className="relative overflow-hidden bg-surface py-20 lg:py-28">
    <div className="container-custom">
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div
          initial={{ opacity: 0, x: -28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-body text-label-sm font-black uppercase text-primary">Smart Ride System</span>
          </div>
          <h2 className="font-display text-display-sm font-black leading-tight text-on-surface sm:text-display-md">
            Detail produk dibuat seperti microsite, bukan katalog biasa.
          </h2>
          <p className="mt-5 max-w-xl text-body-lg leading-relaxed text-on-surface-variant">
            Bagian ini cocok untuk sepeda listrik unggulan: ada highlight performa, kartu fitur, dan animasi scanning yang terasa elektronik tanpa mengganggu keterbacaan.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['800W', 'Motor'],
              ['60 km', 'Jarak'],
              ['4-6 jam', 'Charging'],
              ['150 kg', 'Beban'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-surface-container p-4">
                <p className="font-display text-title-lg font-black text-primary">{value}</p>
                <p className="mt-1 text-body-sm font-bold uppercase text-on-surface-variant">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 28 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="electric-grid absolute inset-0 rounded-2xl opacity-40" />
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-surface-container p-4">
            <div className="relative aspect-[16/11] overflow-hidden rounded-lg bg-surface-low">
              <img src={smartRideShowcasePro} alt="Showcase teknologi sepeda listrik" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,22,43,0.62),transparent_58%)]" />
              <div className="absolute left-5 top-5 max-w-[210px]">
                <p className="font-display text-title-lg font-black text-white">Eco mode active</p>
                <p className="mt-2 text-body-sm text-white/62">Baterai, rem, suspensi, dan jarak tempuh lebih gampang dipahami.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {smartRideFeatures.map((feature, index) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
            className="group overflow-hidden rounded-xl border border-white/10 bg-surface-container"
          >
            <div className="aspect-[4/3] overflow-hidden">
              <img src={feature.img} alt={feature.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" />
            </div>
            <div className="p-5">
              <h3 className="font-display text-title-md font-black text-on-surface">{feature.title}</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant">{feature.desc}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

const TrendingProducts = () => {
  const { products } = useProductStore();
  const trending = useMemo(() => products.slice(0, 8), [products]);

  if (trending.length === 0) return null;

  return (
    <section className="section-padding bg-surface-low/45">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Produk Trending"
          title="Katalog Tetap Dekat Dari Landing"
          subtitle="Pengunjung bisa lanjut dari visual campaign ke produk real tanpa kehilangan momentum."
        />
        <div className="flex snap-x gap-5 overflow-x-auto pb-8">
          {trending.map((product, index) => (
            <div key={product.id} className="min-w-[280px] snap-start md:min-w-[320px]">
              <ProductCard product={product} index={index} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-center">
          <Link
            to="/produk"
            onClick={() => trackClick('/produk', 'trending_products')}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-6 py-3 font-display text-title-sm font-black text-primary transition hover:bg-primary/16"
          >
            Lihat Semua Produk
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

const WhyUs = () => (
  <section className="section-padding bg-surface">
    <div className="container-custom">
      <SectionHeader
        eyebrow="Kenapa Tridjaya"
        title="Lebih Dari Sekadar Tampilan Cantik"
        subtitle="Desain baru tetap mengangkat alasan bisnis yang penting: kredit, pengiriman, garansi, dan layanan setelah pembelian."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {serviceHighlights.map(({ icon: Icon, label, desc }, index) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
            className="rounded-2xl border border-white/10 bg-surface-container p-6"
          >
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="font-display text-title-md font-black text-on-surface">{label}</h3>
            <p className="mt-2 text-body-md leading-relaxed text-on-surface-variant">{desc}</p>
          </motion.div>
        ))}
      </div>
      <div className="mt-14">
        <StatsRow />
      </div>
    </div>
  </section>
);

const CTASection = () => (
  <section className="landing-theme-surface relative overflow-hidden bg-[#071b35] py-20">
    <FloatingCircuits />
    <div className="container-custom relative z-10">
      <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <img src={logoHorizontal} alt="Tridjaya Elektronik" className="h-12 w-auto rounded-lg bg-white p-2" />
            <span className="rounded-full border border-secondary/25 bg-secondary/10 px-3 py-1.5 font-body text-label-sm font-black uppercase text-secondary">
              Rajanya Kredit Elektronik
            </span>
          </div>
          <h2 className="max-w-3xl font-display text-display-sm font-black leading-tight text-white sm:text-display-md">
            Siap belanja elektronik, sepeda listrik, dan furniture dengan proses kredit yang ringan?
          </h2>
          <p className="mt-4 max-w-2xl text-body-lg leading-relaxed text-white/66">
            Arahkan pengunjung ke katalog, promo, atau pendaftaran agen dari satu penutup yang kuat.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to="/produk"
            onClick={() => trackClick('/produk', 'home_cta')}
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-primary px-7 py-4 font-display text-title-sm font-black text-on-primary shadow-neon-cyan transition hover:-translate-y-0.5"
          >
            Buka Katalog
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/daftar-agen"
            onClick={() => trackClick('/daftar-agen', 'home_cta')}
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border border-white/16 bg-white/10 px-7 py-4 font-display text-title-sm font-bold text-white backdrop-blur-md transition hover:bg-white/16"
          >
            Daftar Agen
            <Sparkles className="h-4 w-4 text-secondary" />
          </Link>
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {[
          ['Tridjaya Elektronik Samrat', 'Jl. Samratulangi No. 147, Samrat, Manado'],
          ['Tridjaya Elektronik Bahu', 'Jl. Wolter Monginsidi, depan KFC Bahu, Manado'],
        ].map(([name, address]) => (
          <div key={name} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md">
            <MapPin className="mt-1 h-6 w-6 flex-none text-primary" />
            <div>
              <p className="font-display text-title-sm font-black text-white">{name}</p>
              <p className="mt-1 text-body-sm leading-relaxed text-white/58">{address}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const HomePage: React.FC = () => (
  <>
    <HeroSection />
    <ServiceRibbon />
    <ProductStorySection />
    <CategoryShowcase />
    <SmartRideSection />
    <TrendingProducts />
    <WhyUs />
    <section className="section-padding-sm bg-surface-low/55">
      <div className="container-custom">
        <SectionHeader
          title="Partner Strategis Kami"
          subtitle="Brand dan leasing terpercaya untuk pilihan produk yang lebih luas."
          align="center"
        />
        <PartnerLogos />
      </div>
    </section>
    <CTASection />
  </>
);

export default HomePage;
