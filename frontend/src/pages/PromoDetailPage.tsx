import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, Zap, ArrowRight, Shield, Info } from 'lucide-react';
import { formatPrice } from '../utils/formatters';
import { SectionHeader } from '../components/ui';
import { usePromoStore } from '../store/usePromoStore';
import { useProductStore } from '../store/useProductStore';
import { recordTelemetry } from '../utils/telemetry';
import { getPublicPrice } from '../utils/publicPricing';

const PromoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getPromoById, isLoading: isPromoLoading } = usePromoStore();
  const { products, isLoading: isProductLoading } = useProductStore();
  
  const promo = getPromoById(id || '');

  if (isPromoLoading || isProductLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface/50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant font-body">Memuat Detail Promo...</p>
        </div>
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <h1 className="font-display text-headline-lg font-bold text-on-surface mb-4">Promo Tidak Ditemukan</h1>
          <Link to="/promo" className="text-primary hover:underline flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Promo
          </Link>
        </div>
      </div>
    );
  }

  const promoProducts = products.filter((p) => promo.productIds?.includes(p.id));

  return (
    <div className="min-h-screen bg-surface/50 backdrop-blur-sm">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-surface/50 to-surface" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-20" />
        
        <div className="container-custom relative">
          <Link 
            to="/promo" 
            onClick={() => {
              recordTelemetry('click', {
                path: '/promo',
                source: 'direct',
                metadata: {
                  contentType: 'page',
                  contentKey: 'promo:index',
                  pageType: 'promo_detail_back',
                  sourcePromoId: promo.id,
                  action: 'back_to_promo_list',
                },
              });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-card text-on-surface-variant hover:text-primary transition-all mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Daftar Promo
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-label-sm font-bold tracking-wider uppercase">
                  {promo.badge}
                </span>
                <div className="flex items-center gap-1.5 text-secondary text-label-sm font-bold">
                  <Clock className="w-4 h-4" /> Sisa 12 Hari
                </div>
              </div>
              
              <h1 className="font-display text-display-sm md:text-display-md font-bold text-on-surface mb-6 leading-tight">
                {promo.title}
              </h1>
              
              <p className="font-body text-body-lg text-on-surface-variant mb-10 leading-relaxed max-w-xl">
                {promo.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 mb-12">
                <div className="p-6 rounded-3xl glass-premium border-primary/20 shadow-neon-cyan-sm">
                  <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Potongan Harga</div>
                  <div className="text-display-sm font-bold text-primary">{promo.discount}% OFF</div>
                </div>
                <div className="p-6 rounded-3xl glass-card border-outline-variant/20">
                  <div className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Mulai Dari</div>
                  <div className="text-headline-sm font-bold text-on-surface">{formatPrice(promo.promoPrice)}</div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href={`https://wa.me/6285161542103?text=${encodeURIComponent(`Halo Tridjaya Manado, saya tertarik dengan promo ${promo.title}. Bagaimana cara klaimnya?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    recordTelemetry('whatsapp_click', {
                      path: `/promo/${promo.id}`,
                      source: 'direct',
                      metadata: {
                        contentType: 'promo',
                        contentKey: `promo:${promo.id}`,
                        contentId: promo.id,
                        contentTitle: promo.title,
                        action: 'promo_detail_whatsapp_cta',
                      },
                    });
                  }}
                  className="flex items-center justify-center gap-3 px-8 py-5 gradient-primary rounded-2xl font-display text-title-sm font-bold text-surface shadow-neon-cyan hover:scale-[1.02] transition-all"
                >
                  Klaim Promo Sekarang
                  <Zap className="w-5 h-5" />
                </a>
                <button className="flex items-center justify-center gap-3 px-8 py-5 glass-premium rounded-2xl font-display text-title-sm font-bold text-on-surface hover:bg-surface-high transition-all">
                  Syarat & Ketentuan
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="relative aspect-square lg:aspect-video rounded-2xl overflow-hidden group shadow-2xl border border-outline-variant/10 glass-card"
            >
              <img 
                src={promo.image} 
                alt={promo.title}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
              />
              {/* No overlay blur as per user request */}
              
              {/* Floating Badge */}
              <div className="absolute bottom-8 right-8 p-5 glass-premium rounded-2xl border border-primary/30 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-neon-cyan">
                    <Shield className="w-8 h-8 text-surface" />
                  </div>
                  <div>
                    <div className="text-label-md font-bold text-on-surface">Official Partner</div>
                    <div className="text-label-xs text-on-surface-variant uppercase">Trusted & Verified</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Products Part of Promo */}
      <section className="py-24 bg-surface-low/95 backdrop-blur-sm border-t border-outline-variant/10">
        <div className="container-custom">
          <SectionHeader 
            title="Produk Terpilih" 
            subtitle="Pilihan Produk dalam Promo Ini"
            align="center"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
            <AnimatePresence>
              {promoProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative"
                >
                  <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-full hover:shadow-neon-cyan-sm transition-all duration-500 border-outline-variant/20">
                    <div className="relative h-72 overflow-hidden">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {/* No overlay blur as per user request */}
                      
                      {/* Product Badges */}
                      <div className="absolute top-6 left-6 flex flex-col gap-2">
                        <span className="px-3 py-1.5 glass-premium rounded-xl text-[10px] font-bold text-primary uppercase tracking-wider border-primary/20">
                          PROMO {promo.discount}%
                        </span>
                        {product.badgeText && (
                          <span className="px-3 py-1.5 bg-secondary/80 backdrop-blur-md rounded-xl text-[10px] font-bold text-surface uppercase tracking-wider">
                            {product.badgeText}
                          </span>
                        )}
                      </div>

                    </div>

                    <div className="p-8 flex flex-col flex-1">
                      <div className="font-body text-label-sm text-primary mb-3 font-bold uppercase tracking-[0.2em]">
                        {product.subcategory}
                      </div>
                      <h3 className="font-display text-headline-sm font-bold text-on-surface mb-3 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <p className="font-body text-body-md text-on-surface-variant mb-6 line-clamp-2">
                        {product.shortDesc}
                      </p>

                      <div className="mt-auto pt-6 border-t border-outline-variant/10 flex items-center justify-between">
                        <div>
                          <div className="text-label-xs text-on-surface-variant line-through mb-0.5">
                            {formatPrice(getPublicPrice(product))}
                          </div>
                          <div className="text-title-lg font-bold text-on-surface">
                            {formatPrice(getPublicPrice(product) * (1 - promo.discount / 100))}
                          </div>
                        </div>
                        <Link 
                          to={`/produk/${product.slug}`}
                          onClick={() => {
                            recordTelemetry('click', {
                              path: `/produk/${product.slug}`,
                              source: 'direct',
                              metadata: {
                                contentType: 'product',
                                contentSlug: product.slug,
                                contentKey: `product:${product.slug}`,
                                contentTitle: product.name,
                                sourcePromoId: promo.id,
                                action: 'open_product_from_promo',
                              },
                            });
                          }}
                          className="w-12 h-12 rounded-2xl bg-surface-high flex items-center justify-center text-on-surface hover:bg-primary hover:text-surface transition-all group-hover:shadow-neon-cyan-sm"
                        >
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Trust & Help */}
      <section className="py-24">
        <div className="container-custom text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display text-headline-md font-bold text-on-surface mb-6 italic">
              "Kualitas Terbaik dengan Penawaran yang Menguntungkan"
            </h2>
            <p className="font-body text-body-lg text-on-surface-variant mb-12">
              Promo ini berlaku selama persediaan masih ada. Jangan lewatkan kesempatan untuk membawa pulang produk impian Anda dengan harga spesial dari Tridjaya Manado.
            </p>
            <div className="flex justify-center gap-12 text-on-surface-variant opacity-40">
              <span className="font-display font-black text-headline-sm tracking-tighter uppercase">Guaranteed Quality</span>
              <span className="font-display font-black text-headline-sm tracking-tighter uppercase">Transparent Price</span>
              <span className="font-display font-black text-headline-sm tracking-tighter uppercase">Official Service</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PromoDetailPage;
