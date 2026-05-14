import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, CreditCard, Phone, Share2, Star, Clock
} from 'lucide-react';
import { toast } from '../store/useNotificationStore';
import { formatPrice } from '../utils/formatters';
import { useProductStore } from '../store/useProductStore';
import CreditSimulator from '../components/CreditSimulator';
import type { CreditPlan } from '../types';
import { Badge, ProductCard, SectionHeader } from '../components/ui';
import { recordTelemetry } from '../utils/telemetry';
import { apiFetch, getImageUrl } from '../utils/apiClient';

import { useMinInstallment, useCreditSummary } from '../hooks/useMinInstallment';
import { ShippingCalculator } from '../components/ShippingCalculator';
import { useAuthStore } from '../store/authStore';
import { getFrontendBaseUrl } from '../utils/apiClient';
import { saveReferralCode, getActiveReferralCode } from '../utils/referralSession';
import { getPublicPrice } from '../utils/publicPricing';

const ProductDetailPage: React.FC = () => {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = rawSlug ? rawSlug.replace(/ /g, '+') : '';
  const [searchParams] = useSearchParams();
  const { getProductBySlug, products, isLoading, fetchProducts } = useProductStore();

  // ── All hooks must be declared before any early return ──────────────────
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [selectedCreditPlan, setSelectedCreditPlan] = useState<CreditPlan | null>(null);
  const [referralWhatsapp, setReferralWhatsapp] = useState('6285161542103');
  const [referralLabel, setReferralLabel] = useState('kami');

  const { user: loggedInUser } = useAuthStore();
  const salesReferralSlug = loggedInUser?.role === 'sales' ? loggedInUser.referral_slug?.trim() : null;

  // Ensure products are loaded — handles direct URL access (page refresh / shared link)
  useEffect(() => {
    if (products.length === 0 && !isLoading) {
      fetchProducts();
    }
  }, [products.length, isLoading, fetchProducts]);

  const product = getProductBySlug(slug || '');
  const publicPrice = product ? getPublicPrice(product) : 0;

  const minInstallment = useMinInstallment(product || null);
  const { minDp } = useCreditSummary(product || null);

  const ratingEntries = useMemo(() => {
    if (!product) return [];
    if (product.ratings && product.ratings.length > 0) return product.ratings;
    if (typeof product.rating === 'number') return [{ score: product.rating, review: product.review || '' }];
    return [];
  }, [product]);

  const ratingAverage = product?.ratingAverage ?? product?.rating ?? null;
  const ratingCount = product?.ratingCount ?? ratingEntries.length;

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const images = [product.image, ...(product.images || [])]
      .map((image) => image?.trim())
      .filter((image): image is string => Boolean(image));
    return Array.from(new Set(images));
  }, [product]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [slug]);

  useEffect(() => {
    const code = searchParams.get('ref')?.trim();
    if (!code) return;
    // Save with 1-hour expiry (replaces any existing referral)
    saveReferralCode(code);
    void (async () => {
      try {
        const response = await apiFetch(`/api/public/referrals/${encodeURIComponent(code)}`);
        if (!response.ok) return;
        const payload = await response.json();
        const item = payload.data?.item;
        if (item?.ownerWhatsapp) setReferralWhatsapp(String(item.ownerWhatsapp).replace(/\D/g, ''));
        if (item?.ownerName) setReferralLabel(String(item.ownerName));
      } catch { /* fallback to default */ }
    })();
  }, [searchParams]);

  // Load WA info from session referral when no ?ref= in URL
  // This runs once per product so navigating between products keeps the referral active
  useEffect(() => {
    const urlRef = searchParams.get('ref')?.trim();
    if (urlRef) return; // already handled above
    const sessionRef = getActiveReferralCode();
    if (!sessionRef) return;
    void (async () => {
      try {
        const response = await apiFetch(`/api/public/referrals/${encodeURIComponent(sessionRef)}`);
        if (!response.ok) return;
        const payload = await response.json();
        const item = payload.data?.item;
        if (item?.ownerWhatsapp) setReferralWhatsapp(String(item.ownerWhatsapp).replace(/\D/g, ''));
        if (item?.ownerName) setReferralLabel(String(item.ownerName));
      } catch { /* fallback to default */ }
    })();
  // Re-run when slug changes (user navigates to different product)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  // ────────────────────────────────────────────────────────────────────────

  // Early returns AFTER all hooks
  if (isLoading || products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-24">
        <div className="text-center">
          <p className="font-display text-headline-md text-on-surface-variant mb-4">Produk tidak ditemukan</p>
          <Link to="/produk" className="flex items-center gap-2 px-6 py-3 gradient-primary rounded-xl font-body text-body-md font-bold text-surface mx-auto w-fit">
            Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 3);

  const productCatalogPath = `/produk?kategori=${encodeURIComponent(product.category)}`;
  // Use active referral from session (with 1-hour expiry) or URL param
  const referralCode = searchParams.get('ref') || getActiveReferralCode() || '';

  // Build the share URL: prefer sales referral link, else current URL
  const getShareUrl = () => {
    const base = getFrontendBaseUrl();
    const encodedSlug = product.slug.split('+').map(part => encodeURIComponent(part)).join('+');
    if (salesReferralSlug) {
      return `${base}/produk/${encodedSlug}?ref=${encodeURIComponent(salesReferralSlug)}`;
    }
    return window.location.href;
  };

  const contactText = encodeURIComponent(
    `Halo ${referralLabel}, saya tertarik dengan produk ${product.name}. Mohon info stok dan simulasi kredit terbaru.`
  );
  const contactLink = `https://wa.me/${referralWhatsapp}?text=${contactText}`;

  const handleShareProduct = async () => {
    const url = getShareUrl();
    recordTelemetry('click', {
      path: `/produk/${product.slug}`,
      source: 'direct',
      metadata: {
        contentType: 'product',
        contentSlug: product.slug,
        contentKey: `product:${product.slug}`,
        contentTitle: product.name,
        action: 'share_product',
      },
    });

    const shareData = {
      title: product.name,
      text: `Lihat detail ${product.name} di Tridjaya Manado`,
      url,
    };

    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success(
      'Link Produk Berhasil Disalin',
      salesReferralSlug
        ? 'Link referral Anda sudah disalin dan siap dibagikan.'
        : 'Anda dapat membagikannya kepada calon pembeli.'
    );
  };

  return (
    <>
      <section className="pt-28 pb-16">
        <div className="container-custom">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 font-body text-body-sm text-on-surface-variant mb-8">
            <Link to="/" className="hover:text-primary transition-colors">Beranda</Link>
            <span>/</span>
            <Link to={productCatalogPath} className="hover:text-primary transition-colors">
              {product.category === 'bike' ? 'Sepeda Listrik' : 'Elektronik & Furnitur'}
            </Link>
            <span>/</span>
            <span className="text-white truncate">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16 items-start">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="space-y-4 mb-4">
                <div className="relative overflow-hidden rounded-3xl bg-surface-container aspect-square md:aspect-[4/3] lg:aspect-[4/5] xl:aspect-[4/3] w-full">
                  <img
                    src={getImageUrl(galleryImages[selectedImageIndex] || product.image)}
                    alt={`${product.name} - gambar ${selectedImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {product.badge && 
                   product.badge.toLowerCase() !== 'popular' && 
                   !(product.badgeText || '').toLowerCase().includes('terlaris') && (
                    <div className="absolute top-4 left-4">
                      <Badge label={product.badgeText || product.badge} variant="primary" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleShareProduct}
                    className="absolute top-4 right-4 w-9 h-9 glass-dark rounded-lg flex items-center justify-center text-on-surface-variant hover:text-white transition-colors"
                    aria-label="Bagikan produk"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {galleryImages.length > 1 && (
                  <div
                    className="flex gap-2 overflow-x-auto overflow-y-hidden pb-2 pr-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {galleryImages.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() => setSelectedImageIndex(index)}
                        className={`relative shrink-0 w-[84px] sm:w-[92px] aspect-square overflow-hidden rounded-xl border bg-surface-container transition-all snap-start ${
                          selectedImageIndex === index
                            ? 'border-primary shadow-neon-cyan-sm scale-[1.02]'
                            : 'border-outline-variant/20 opacity-80 hover:opacity-100 hover:border-primary/50'
                        }`}
                        aria-label={`Lihat gambar produk ${index + 1}`}
                      >
                        <img
                          src={getImageUrl(image)}
                          alt={`${product.name} thumbnail ${index + 1}`}
                          className="w-full h-full object-contain p-1"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color selector */}
              {product.colors && (
                <div>
                  <p className="font-body text-body-sm text-on-surface-variant mb-2">Warna: <span className="text-white font-medium">{product.colors[selectedColor]}</span></p>
                  <div className="flex items-center gap-2">
                    {product.colors.map((color, i) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(i)}
                        className={`px-3 py-1.5 rounded-lg font-body text-body-sm transition-all duration-200 ${
                          selectedColor === i
                            ? 'gradient-primary text-surface font-semibold shadow-neon-cyan-sm'
                            : 'glass-card text-on-surface-variant hover:text-white'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shipping Calculator – placed in the empty space below colors */}
              <div className="mt-8 hidden lg:block">
                <ShippingCalculator />
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="font-body text-label-md text-primary uppercase tracking-widest font-bold mb-2">{product.subcategory}</div>
              <h1 className="font-display text-display-sm font-bold text-white mb-4">{product.name}</h1>

              <p className="font-body text-body-lg text-on-surface-variant leading-relaxed mb-6">{product.description}</p>

              {ratingEntries.length > 0 ? (
                <div className="glass-card rounded-2xl p-5 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center text-yellow-300">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <div className="font-display text-title-sm font-bold text-white">Rating & Ulasan Admin</div>
                      {typeof ratingAverage === 'number' && ratingAverage > 0 && (
                        <div className="font-body text-body-sm text-on-surface-variant">
                          Nilai: <span className="text-white font-semibold">{ratingAverage.toFixed(1)}/5</span>
                          <span className="ml-2 text-on-surface-variant">({ratingCount} rating)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {product.review && (
                    <p className="font-body text-body-md text-on-surface-variant leading-relaxed mb-4">{product.review}</p>
                  )}
                  {ratingEntries.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ratingEntries.map((entry, index) => (
                        <div key={`${entry.score}-${index}`} className="rounded-xl border border-outline-variant/10 bg-surface-high/30 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 rounded-lg bg-yellow-500/15 text-yellow-300 border border-yellow-500/20 text-label-sm font-semibold">
                              {entry.score.toFixed(1)}/5
                            </span>
                            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Rating #{index + 1}</span>
                          </div>
                          <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                            {entry.review || 'Tidak ada ulasan tambahan.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Price card */}
              <div className="glass-card rounded-2xl p-5 mb-6">
                {publicPrice === 0 ? (
                  <div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-title-sm mb-2">
                      <Clock className="w-5 h-5" />
                      Produk Indent — Harga Belum Tersedia
                    </div>
                    <p className="font-body text-body-md text-on-surface-variant mb-1">
                      Produk ini tersedia melalui pemesanan terlebih dahulu (indent).
                      Hubungi kami untuk informasi harga, ketersediaan, dan estimasi waktu pengiriman.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="font-display text-display-sm font-bold gradient-text-primary mb-1">
                      {formatPrice(publicPrice)}
                    </div>
                    {(minInstallment || product.priceInstallment) && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-body text-body-md text-on-surface-variant">
                          Cicil dari <span className="text-white font-semibold">{formatPrice(minInstallment || product.priceInstallment || 0)}</span>/bulan
                        </span>
                        {minDp && (
                          <span className="font-body text-label-sm text-on-surface-variant">
                            DP mulai {formatPrice(minDp)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-secondary" />
                  <span className="font-body text-body-sm text-on-surface-variant">
                    Garansi resmi pabrik • Servis di seluruh Sulawesi
                  </span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreditForm(!showCreditForm);
                    recordTelemetry('click', {
                      path: `/produk/${product.slug}`,
                      source: 'direct',
                      metadata: {
                        contentType: 'product',
                        contentSlug: product.slug,
                        contentKey: `product:${product.slug}`,
                        contentTitle: product.name,
                        action: 'toggle_credit_form',
                        isOpen: !showCreditForm,
                      },
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface hover:shadow-neon-cyan transition-all duration-300"
                >
                  <CreditCard className="w-4 h-4" />
                  Ajukan Kredit
                </button>
                <a
                  href={contactLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    recordTelemetry('whatsapp_click', {
                      path: `/produk/${product.slug}`,
                      source: referralCode || 'direct',
                      metadata: {
                        contentType: 'product',
                        contentSlug: product.slug,
                        contentKey: `product:${product.slug}`,
                        contentTitle: product.name,
                        action: referralCode ? 'referral_general_inquiry' : 'general_inquiry',
                      },
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 glass-card border border-primary/20 rounded-xl font-display text-title-sm font-semibold text-white hover:border-primary/50 transition-all duration-300"
                >
                  <Phone className="w-4 h-4 text-primary" />
                  Hubungi Kami
                </a>
              </div>

              {/* Credit form */}
              {showCreditForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6"
                >
                  <CreditSimulator
                    productPrice={publicPrice}
                    productCategory={product.category}
                    productSubcategory={product.subcategory}
                    onSelectPlan={setSelectedCreditPlan}
                  />
                  <a
                    href={contactLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      recordTelemetry('whatsapp_click', {
                        path: `/produk/${product.slug}`,
                        source: referralCode || 'direct',
                        metadata: {
                          contentType: 'product',
                          contentSlug: product.slug,
                          contentKey: `product:${product.slug}`,
                          contentTitle: product.name,
                          action: referralCode ? 'referral_credit_inquiry' : 'credit_inquiry',
                          selectedTenor: selectedCreditPlan?.tenor ?? null,
                        },
                      });
                    }}
                    className="w-full inline-flex justify-center py-3 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface"
                  >
                    Kirim Pengajuan via WhatsApp
                  </a>
                </motion.div>
              )}

              {/* Spesifikasi */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-8"
              >
                <div className="flex items-center gap-3 mb-5 border-b border-outline-variant/10 pb-3">
                  <span className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-surface shadow-neon-cyan-sm">
                    <Shield className="w-4 h-4" />
                  </span>
                  <h3 className="font-display text-title-md font-bold text-white">Spesifikasi Teknis</h3>
                </div>
                
                <div className="glass-premium rounded-2xl overflow-hidden border border-outline-variant/20 shadow-lg relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
                  
                  {Object.entries(product.specs).map(([key, val], i) => (
                    <div
                      key={key}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 hover:bg-surface-high/50 transition-colors group ${
                        i < Object.entries(product.specs).length - 1 ? 'border-b border-outline-variant/10' : ''
                      }`}
                    >
                      <span className="font-body text-body-md text-on-surface-variant group-hover:text-primary transition-colors">{key}</span>
                      <span className="font-body text-body-md font-bold text-white mt-1 sm:mt-0 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Mobile Shipping Calculator (shown below info on mobile) */}
              <div className="mt-6 lg:hidden">
                <ShippingCalculator />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Related */}
      {relatedProducts.length > 0 && (
        <section className="pb-20 bg-surface-low/90 backdrop-blur-sm">
          <div className="container-custom pt-12">
            <SectionHeader
              eyebrow="Rekomendasi"
              title="Produk Serupa"
              align="left"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default ProductDetailPage;
