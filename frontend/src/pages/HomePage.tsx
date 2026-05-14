import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Battery,
  Bike,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Gauge,
  MapPin,
  Shield,
  Sofa,
  Sparkles,
  Smartphone,
  Truck,
  Utensils,
  Wrench,
  Zap,
} from 'lucide-react';
import { PartnerLogos, ProductCard, SectionHeader } from '../components/ui';
import { recordTelemetry } from '../utils/telemetry';
import { useProductStore } from '../store/useProductStore';
import { useLandingStore } from '../store/useLandingStore';
import { getImageUrl } from '../utils/apiClient';
import { getPublicPrice } from '../utils/publicPricing';
import type {
  LandingCategoryPanelData,
  LandingHeroSlideData,
  LandingSmartRideData,
  LandingSmartRideFeatureData,
  Product,
} from '../types';

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

type LandingCategory = {
  id: string;
  label: string;
  copy: string;
  href: string;
  image: string;
  icon: React.ElementType;
  tone: string;
  tags: string[];
};

const iconMap: Record<string, React.ElementType> = {
  battery: Battery,
  bike: Bike,
  clock: Clock,
  creditCard: CreditCard,
  gauge: Gauge,
  mapPin: MapPin,
  shield: Shield,
  sofa: Sofa,
  sparkles: Sparkles,
  smartphone: Smartphone,
  truck: Truck,
  utensils: Utensils,
  wrench: Wrench,
  zap: Zap,
};

const resolveIcon = (iconKey?: string) => iconMap[iconKey ?? ''] ?? Bike;

const mapLandingSlide = (slide: LandingHeroSlideData): LandingSlide => ({
  id: slide.id,
  eyebrow: slide.eyebrow,
  title: slide.title,
  accent: slide.accent,
  copy: slide.copy,
  href: slide.href,
  cta: slide.cta,
  bg: getImageUrl(slide.bgImageUrl),
  product: getImageUrl(slide.productImageUrl),
  productAlt: slide.productAlt,
  icon: resolveIcon(slide.iconKey),
  price: slide.price,
  oldPrice: slide.oldPrice,
  detailLine: slide.detailLine,
  metrics: slide.metrics.map((item) => ({ ...item, icon: resolveIcon(item.iconKey) })),
  specs: slide.specs.map((item) => ({ ...item, icon: resolveIcon(item.iconKey) })),
});

const mapLandingCategory = (category: LandingCategoryPanelData): LandingCategory => ({
  id: category.id,
  label: category.label,
  copy: category.copy,
  href: category.href,
  image: getImageUrl(category.imageUrl),
  icon: resolveIcon(category.iconKey),
  tone: category.tone,
  tags: Array.isArray(category.tags) ? category.tags : [],
});

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
      return scoreB - scoreA || getPublicPrice(b) - getPublicPrice(a);
    })
    .slice(0, 3);
};

const serviceHighlights = [
  { 
    icon: Zap, 
    label: 'Harga Pabrik', 
    desc: 'Kami menjalin kerja sama langsung dengan distributor utama untuk menjamin harga termurah di Manado.' 
  },
  { 
    icon: CreditCard, 
    label: 'Kredit DP 0%', 
    desc: 'Bawa pulang produk impian tanpa uang muka dengan proses cepat melalui partner leasing resmi kami.' 
  },
  { 
    icon: Shield, 
    label: 'Garansi Resmi', 
    desc: 'Seluruh produk elektronik dan mobility kami memiliki garansi resmi pabrik untuk ketenangan pikiran Anda.' 
  },
  { 
    icon: Truck, 
    label: 'Pengiriman Cepat', 
    desc: 'Layanan kirim aman dan instalasi langsung oleh tim profesional kami untuk wilayah Manado dan sekitarnya.' 
  },
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

const LandingHeroSkeleton = () => (
  <section className="brochure-hero landing-theme-surface relative overflow-hidden bg-[#0a1628]">
    <div className="container-custom flex min-h-[calc(100svh-4rem)] items-center py-16 lg:py-20">
      <div className="w-full animate-pulse space-y-6">
        <div className="h-10 w-48 rounded-full bg-white/10" />
        <div className="max-w-3xl space-y-3">
          <div className="h-14 rounded-2xl bg-white/10" />
          <div className="h-14 w-3/4 rounded-2xl bg-white/10" />
        </div>
        <div className="h-5 max-w-xl rounded-full bg-white/10" />
        <div className="h-12 w-44 rounded-xl bg-primary/30" />
      </div>
    </div>
  </section>
);

const HeroSection: React.FC<{ slides: LandingSlide[] }> = ({ slides }) => {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const { scrollYProgress } = useScroll();
  const contentY = useTransform(scrollYProgress, [0, 0.35], [0, 42]);
  const slide = slides[Math.min(current, Math.max(slides.length - 1, 0))];

  const goNext = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrent((value) => (value + 1) % slides.length);
  }, [slides.length]);

  const goPrev = useCallback(() => {
    if (slides.length <= 1) return;
    setCurrent((value) => (value - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!autoplay || slides.length <= 1) return;
    const timer = window.setInterval(goNext, 6200);
    return () => window.clearInterval(timer);
  }, [autoplay, goNext, slides.length]);

  useEffect(() => {
    if (current >= slides.length) setCurrent(0);
  }, [current, slides.length]);

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

  if (!slide) return <LandingHeroSkeleton />;

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
          <img src={slide.bg} alt="" className="brochure-bg-image h-full w-full object-cover object-center" decoding="async" />
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
                  <div className="brochure-brand-chip inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
                    <slide.icon className="h-3.5 w-3.5 flex-none text-primary" />
                    <span className="truncate font-body text-[0.7rem] font-black uppercase text-white/80">{slide.eyebrow}</span>
                    <span className="h-1 w-1 rounded-full bg-secondary" />
                    <span className="font-body text-[0.7rem] font-black text-white/50">
                      {String(current + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
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
                    decoding="async"
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
                  decoding="async"
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

      {/* Slide indicator — minimal floating dots */}
      <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3">
        {/* Prev */}
        <button
          type="button"
          onClick={() => { goPrev(); setAutoplay(false); }}
          aria-label="Slide sebelumnya"
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/60 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setCurrent(index); setAutoplay(false); }}
              aria-label={`Buka slide ${index + 1}`}
              className="relative flex items-center justify-center"
            >
              {index === current ? (
                <span className="block h-1.5 w-6 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-500" />
              ) : (
                <span className="block h-1.5 w-1.5 rounded-full bg-white/35 transition-all duration-300 hover:bg-white/60" />
              )}
            </button>
          ))}
        </div>

        {/* Next */}
        <button
          type="button"
          onClick={() => { goNext(); setAutoplay(false); }}
          aria-label="Slide berikutnya"
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/60 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
};

const ServiceRibbon = () => (
  <section className="landing-section relative z-20 border-t border-blue-900/40 bg-[#060f1e] py-8">
    <div className="container-custom">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {serviceHighlights.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="landing-card group flex items-center gap-4 rounded-2xl border border-blue-800/30 bg-blue-950/50 p-5 transition duration-300 hover:-translate-y-0.5"
          >
            <div className="landing-icon-wrap grid h-10 w-10 flex-none place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 transition">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="landing-text-heading font-display text-[0.82rem] font-black leading-tight text-white">{label}</p>
              <p className="landing-text-muted mt-1 font-body text-[0.72rem] leading-relaxed text-blue-200/55">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const ProductStorySection = () => {
  const { products, isLoading, error, fetchProducts } = useProductStore();
  const storyProducts = useMemo(() => getProductStoryItems(products), [products]);

  useEffect(() => {
    if (products.length === 0 && !isLoading && !error) {
      fetchProducts();
    }
  }, [error, fetchProducts, isLoading, products.length]);

  if (!isLoading && storyProducts.length === 0) return null;

  return (
    <section className="landing-section-alt section-padding bg-[#0a1628]">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Visual Promo"
          title="Foto Produk Dibuat Lebih Bersih"
          subtitle="Produk pilihan dari database ditampilkan seperti katalog premium, sementara harga dan informasi tetap tajam dari elemen UI."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {storyProducts.length > 0
            ? storyProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))
            : [0, 1, 2].map((item) => (
                <div key={item} className="landing-card aspect-[3/4] animate-pulse rounded-2xl border border-blue-800/30 bg-[#0d1f38]" />
              ))}
        </div>
      </div>
    </section>
  );
};

const CategoryCard = ({ category, index }: { category: LandingCategory, index: number }) => {
  const Icon = category.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={category.href}
        onClick={() => trackClick(category.href, 'category_showcase', { category: category.label })}
        className="landing-card group flex flex-col overflow-hidden rounded-2xl border border-blue-800/30 bg-[#0d1f38] transition duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-[0_12px_40px_rgba(37,99,235,0.15)]"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={category.image}
            alt={category.label}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />
          {/* Badge */}
          <div className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 backdrop-blur-md ${toneClass[category.tone]}`}>
            <Icon className="h-3 w-3" />
            <span className="font-body text-[0.62rem] font-black uppercase tracking-wide">{category.label}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="landing-text-heading font-display text-base font-black text-white">{category.label}</h3>
          <p className="landing-text-body mt-2 flex-1 font-body text-[0.78rem] leading-relaxed text-blue-200/70">{category.copy}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {category.tags.map((tag) => (
              <span key={tag} className="landing-tag rounded-full border border-blue-700/30 bg-blue-900/40 px-2.5 py-0.5 text-[0.65rem] font-bold text-blue-300/80">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const CategoryShowcase = ({ categories }: { categories: LandingCategory[] }) => {
  if (categories.length === 0) return null;

  return (
    <section className="landing-section section-padding bg-[#060f1e]">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Kategori"
          title="Elektronik, Mobility, dan Furniture Dalam Satu Alur"
          subtitle="Temukan produk terbaik dari setiap kategori — sepeda listrik, elektronik rumah tangga, hingga furniture."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <CategoryCard key={category.id} category={category} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

const SmartRideSection = ({
  smartRide,
  features,
}: {
  smartRide: LandingSmartRideData | null;
  features: LandingSmartRideFeatureData[];
}) => {
  if (!smartRide) return null;
  const stats = smartRide.stats
    .map((item, index) => {
      if (Array.isArray(item)) {
        return { value: String(item[0] ?? ''), label: String(item[1] ?? `Stat ${index + 1}`) };
      }
      return item;
    })
    .filter((item) => item.value && item.label);

  return (
  <section className="landing-section-alt relative overflow-hidden bg-[#0a1628] py-20 lg:py-28">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(37,99,235,0.08),transparent_60%)] dark-only" />
    <div className="container-custom relative">
      <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.div initial={{ opacity: 0, x: -28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6 }}>
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-blue-500/25 bg-blue-500/10 px-4 py-2">
            <Zap className="h-4 w-4 landing-text-accent text-blue-400" />
            <span className="landing-text-accent font-body text-label-sm font-black uppercase text-blue-400">{smartRide.eyebrow}</span>
          </div>
          <h2 className="landing-text-heading font-display text-display-sm font-black leading-tight text-white sm:text-display-md">
            {smartRide.title}
          </h2>
          <p className="landing-text-body mt-5 max-w-xl text-body-lg leading-relaxed text-blue-200/65">
            {smartRide.copy}
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ value, label }, index) => (
              <div key={`${label}-${index}`} className="landing-card rounded-xl border border-blue-800/35 bg-[#0d1f38] p-4">
                <p className="landing-text-accent font-display text-title-lg font-black text-blue-400">{value}</p>
                <p className="landing-text-muted mt-1 text-body-sm font-bold uppercase text-blue-200/50">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 28 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6 }} className="relative">
          <div className="landing-card relative overflow-hidden rounded-2xl border border-blue-800/35 bg-[#0d1f38] p-4">
            <div className="relative aspect-[16/11] overflow-hidden rounded-xl bg-[#060f1e]">
              <img
                src={getImageUrl(smartRide.mainImageUrl)}
                alt={smartRide.mainImageAlt}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,15,30,0.72),transparent_58%)]" />
              <div className="absolute left-5 top-5 max-w-[210px]">
                <p className="font-display text-title-lg font-black text-white">{smartRide.overlayTitle}</p>
                <p className="mt-2 text-body-sm text-blue-200/70">{smartRide.overlayCopy}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <motion.article key={feature.id || `${feature.title}-${index}`} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.06 }}
            className="landing-card group overflow-hidden rounded-2xl border border-blue-800/30 bg-[#0d1f38] transition duration-300 hover:-translate-y-0.5">
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={getImageUrl(feature.imageUrl)}
                alt={feature.title}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="p-5">
              <h3 className="landing-text-heading font-display text-title-md font-black text-white">{feature.title}</h3>
              <p className="landing-text-body mt-2 text-body-sm text-blue-200/65">{feature.description}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
  );
};

const TrendingProducts = () => {
  const { products } = useProductStore();
  const trending = useMemo(() => products.slice(0, 8), [products]);

  if (trending.length === 0) return null;

  return (
    <section className="landing-section section-padding bg-[#060f1e]">
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
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-6 py-3 font-display text-title-sm font-black text-blue-400 transition hover:bg-blue-500/18"
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
  <section className="landing-section-alt section-padding bg-[#0a1628]">
    <div className="container-custom">
      <SectionHeader
        eyebrow="Kenapa Tridjaya"
        title="Mengutamakan Kepercayaan Sejak 2004"
        subtitle="Berawal dari komitmen pelayanan di sektor otomotif (Tridjaya Motor), kini kami hadir memberikan solusi kebutuhan rumah tangga dan mobility terbaik di Manado dengan harga langsung dari pabrik."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {serviceHighlights.map(({ icon: Icon, label, desc }, index) => (
          <motion.div key={label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: index * 0.06 }}
            className="landing-card rounded-2xl border border-blue-800/30 bg-[#0d1f38] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-blue-500/30">
            <div className="landing-icon-wrap mb-5 grid h-12 w-12 place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
              <Icon className="h-6 w-6" />
            </div>
            <h3 className="landing-text-heading font-display text-title-md font-black text-white">{label}</h3>
            <p className="landing-text-body mt-2 text-body-sm leading-relaxed text-blue-200/65">{desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const CTASection = ({ productImage, productAlt }: { productImage?: string; productAlt?: string }) => (
  <section className="landing-section relative overflow-hidden bg-surface py-24">
    {/* Ambient background glows */}
    <div className="absolute left-1/4 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
    <div className="absolute right-1/4 bottom-0 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-primary/6 blur-[100px]" />

    <div className="container-custom relative z-10">
      {/* Main CTA card */}
      <div className="relative overflow-hidden rounded-3xl border border-outline-variant/30 bg-gradient-to-br from-surface-container via-surface-high to-surface-container">
        {/* Subtle inner glow top-right */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        {/* Thin accent line top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="grid lg:grid-cols-[1fr_auto] lg:items-stretch">
          {/* Left: content */}
          <div className="p-10 lg:p-16">
            {/* Eyebrow */}
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="font-body text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary">
                Wujudkan Sekarang
              </span>
            </div>

            <h2 className="max-w-2xl font-display text-3xl font-black leading-[1.1] text-on-surface sm:text-4xl lg:text-5xl">
              Siap Memiliki Produk Impian Dengan{' '}
              <span className="bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
                Kredit Ringan?
              </span>
            </h2>

            <p className="mt-5 max-w-lg text-[0.95rem] leading-relaxed text-on-surface-variant/80">
              Dapatkan promo DP 0% dan proses persetujuan instan hari ini juga. Cicilan ringan untuk elektronik, furniture, dan sepeda listrik favorit Anda.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/produk"
                onClick={() => trackClick('/produk', 'home_cta')}
                className="inline-flex h-13 items-center gap-2.5 rounded-xl bg-primary px-8 font-display text-sm font-black text-on-primary shadow-[0_8px_24px_rgba(var(--color-primary)/0.4)] transition hover:-translate-y-0.5 hover:bg-primary-dim hover:shadow-[0_12px_32px_rgba(var(--color-primary)/0.5)]"
              >
                Lihat Katalog
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/daftar-agen"
                onClick={() => trackClick('/daftar-agen', 'home_cta')}
                className="inline-flex h-13 items-center gap-2.5 rounded-xl border border-outline-variant/50 bg-surface-high/50 px-8 font-display text-sm font-black text-on-surface backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-surface-highest hover:text-primary"
              >
                Daftar Agen
                <Smartphone className="h-4 w-4" />
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-9 flex flex-wrap items-center gap-6 border-t border-outline-variant/40 pt-7">
              {[
                { label: 'Proses 1 Hari', icon: Clock },
                { label: 'DP Mulai 0%', icon: CreditCard },
                { label: 'Garansi Resmi', icon: Shield },
              ].map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/12 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[0.72rem] font-bold uppercase tracking-wider text-on-surface-variant/70">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: product image */}
          {productImage ? (
            <div className="relative hidden w-[340px] shrink-0 overflow-hidden lg:block xl:w-[400px]">
              <motion.img
                src={productImage}
                alt={productAlt || 'Produk Tridjaya'}
                className="h-full w-full object-contain object-center p-8"
                loading="lazy"
                decoding="async"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Location cards */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {[
          ['Tridjaya Elektronik Samrat', 'Jl. Sam Ratulangi No. 147, Samrat, Manado'],
          ['Tridjaya Elektronik Bahu', 'Jl. Wolter Monginsidi, depan KFC Bahu, Manado'],
        ].map(([name, address]) => (
          <a
            key={name}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-card group flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container/60 px-6 py-5 transition duration-300 hover:border-primary/30 hover:bg-surface-container"
          >
            <div className="landing-icon-wrap grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-on-primary group-hover:border-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="landing-text-heading font-display text-sm font-black text-on-surface">{name}</p>
              <p className="landing-text-body mt-0.5 truncate text-[0.72rem] text-on-surface-variant/70">{address}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary/40 transition group-hover:text-primary group-hover:translate-x-0.5" />
          </a>
        ))}
      </div>
    </div>
  </section>
);

const HomePage: React.FC = () => {
  const { home, fetchHome } = useLandingStore();

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const slides = useMemo(() => home?.heroSlides.map(mapLandingSlide) ?? [], [home?.heroSlides]);
  const categories = useMemo(() => home?.categoryPanels.map(mapLandingCategory) ?? [], [home?.categoryPanels]);
  const ctaSlide = slides[0];

  return (
    <>
      <HeroSection slides={slides} />
      <ServiceRibbon />
      <ProductStorySection />
      <CategoryShowcase categories={categories} />
      <SmartRideSection smartRide={home?.smartRide ?? null} features={home?.smartRideFeatures ?? []} />
      <TrendingProducts />
      <WhyUs />
      <section className="landing-section section-padding-sm bg-surface">
        <div className="container-custom">
          <SectionHeader
            title="Partner Strategis Kami"
            subtitle="Brand dan leasing terpercaya untuk pilihan produk yang lebih luas."
            align="center"
          />
          <PartnerLogos />
        </div>
      </section>
      <CTASection productImage={ctaSlide?.product} productAlt={ctaSlide?.productAlt} />
    </>
  );
};

export default HomePage;
