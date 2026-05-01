import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, CreditCard, Phone, Share2, Star
} from 'lucide-react';
import { toast } from '../store/useNotificationStore';
import { formatPrice } from '../data';
import { useProductStore } from '../store/useProductStore';
import CreditSimulator from '../components/CreditSimulator';
import type { CreditPlan } from '../types';
import { formatRupiah, tenorLabel } from '../utils/creditCalculator';
import { Badge, ProductCard, SectionHeader } from '../components/ui';
import { recordTelemetry } from '../utils/telemetry';
import { getImageUrl } from '../utils/apiClient';

import { useMinInstallment } from '../hooks/useMinInstallment';
import { ShippingCalculator } from '../components/ShippingCalculator';

const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { getProductBySlug, products, isLoading } = useProductStore();
  
  const product = getProductBySlug(slug || '');
  const [selectedColor, setSelectedColor] = useState(0);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const minInstallment = useMinInstallment(product || null);
  const [selectedCreditPlan, setSelectedCreditPlan] = useState<CreditPlan | null>(null);

  if (isLoading) {
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
  const agentMessage = encodeURIComponent(`Halo Tridjaya, saya tertarik dengan produk ${product.name}. Mohon info stok dan simulasi kredit terbaru.`);
  const selectedTenorLabel = selectedCreditPlan ? tenorLabel(selectedCreditPlan.tenor) : 'belum dipilih';
  const selectedInstallmentLabel = selectedCreditPlan ? formatRupiah(selectedCreditPlan.monthlyInstallment) : 'akan saya pilih di simulator';
  const selectedCustomerTypeLabel = selectedCreditPlan?.customerType === 'RO' ? 'RO' : 'Baru';
  const creditMessage = encodeURIComponent(
    `Halo Tridjaya, saya ingin kredit ${product.name} warna ${product.colors?.[selectedColor] || 'default'} dengan Tenor ${selectedTenorLabel} angsuran ${selectedInstallmentLabel} (Nasabah ${selectedCustomerTypeLabel}).`
  );

  const handleShareProduct = async () => {
    const url = window.location.href;
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
    toast.success('Link Produk Berhasil Disalin', 'Anda dapat membagikannya kepada calon pembeli.');
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative overflow-hidden rounded-2xl bg-surface-container aspect-[4/3] mb-4">
                <img
                  src={getImageUrl(product.image)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.badge && (
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

              {(typeof product.rating === 'number' && product.rating > 0) || product.review ? (
                <div className="glass-card rounded-2xl p-5 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-yellow-500/15 border border-yellow-500/20 flex items-center justify-center text-yellow-300">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <div className="font-display text-title-sm font-bold text-white">Rating & Ulasan Admin</div>
                      {typeof product.rating === 'number' && product.rating > 0 && (
                        <div className="font-body text-body-sm text-on-surface-variant">Nilai: <span className="text-white font-semibold">{product.rating.toFixed(1)}/5</span></div>
                      )}
                    </div>
                  </div>
                  {product.review && (
                    <p className="font-body text-body-md text-on-surface-variant leading-relaxed">{product.review}</p>
                  )}
                </div>
              ) : null}

              {/* Price card */}
              <div className="glass-card rounded-2xl p-5 mb-6">
                <div className="font-display text-display-sm font-bold gradient-text-primary mb-1">
                  {formatPrice(product.price)}
                </div>
                {(minInstallment || product.priceInstallment) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-body text-body-md text-on-surface-variant">
                      Cicil dari <span className="text-white font-semibold">{formatPrice(minInstallment || product.priceInstallment || 0)}</span>/bulan
                    </span>
                    {product.dpMin && (
                      <span className="font-body text-label-sm text-on-surface-variant">
                        DP mulai {formatPrice(product.dpMin)}
                      </span>
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
                  href={`https://wa.me/6285161542103?text=${agentMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    recordTelemetry('whatsapp_click', {
                      path: `/produk/${product.slug}`,
                      source: 'direct',
                      metadata: {
                        contentType: 'product',
                        contentSlug: product.slug,
                        contentKey: `product:${product.slug}`,
                        contentTitle: product.name,
                        action: 'general_inquiry',
                      },
                    });
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 glass-card border border-primary/20 rounded-xl font-display text-title-sm font-semibold text-white hover:border-primary/50 transition-all duration-300"
                >
                  <Phone className="w-4 h-4 text-primary" />
                  Hubungi Agen
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
                    productPrice={product.price}
                    productCategory={product.category}
                    productSubcategory={product.subcategory}
                    onSelectPlan={setSelectedCreditPlan}
                  />
                  <a
                    href={`https://wa.me/6285161542103?text=${creditMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      recordTelemetry('whatsapp_click', {
                        path: `/produk/${product.slug}`,
                        source: 'direct',
                        metadata: {
                          contentType: 'product',
                          contentSlug: product.slug,
                          contentKey: `product:${product.slug}`,
                          contentTitle: product.name,
                          action: 'credit_inquiry',
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
