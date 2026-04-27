import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Ticket, ArrowRight, Zap, Clock, Info, Share2 } from 'lucide-react';
import { formatPrice } from '../data';
import { Badge, SectionHeader, PartnerLogos } from '../components/ui';
import { usePromoStore } from '../store/usePromoStore';
import { recordTelemetry } from '../utils/telemetry';

const PromoPage: React.FC = () => {
  const { promos, isLoading } = usePromoStore();

  if (isLoading || promos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface/50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant font-body">Memuat Penawaran Spesial...</p>
        </div>
      </div>
    );
  }

  const heroPromo = promos.find(p => p.variant === 'hero') || promos[0];
  const standardPromos = promos.filter(p => p.id !== heroPromo.id);

  return (
    <div className="bg-surface/50 transition-colors duration-500">
      {/* 1. HERO SECTION - Immersive Glass Header */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0 mesh-bg opacity-30" />
        </div>

        <div className="container-custom relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center text-center max-w-3xl mx-auto mb-16"
          >
            <nav className="flex items-center gap-2 font-body text-label-sm text-on-surface-variant mb-8 px-4 py-1.5 rounded-full glass-card border-outline-variant/30">
              <Link to="/" className="hover:text-primary transition-colors">Beranda</Link>
              <span className="text-outline-variant">/</span>
              <span className="text-on-surface font-semibold">Promo Aktif</span>
            </nav>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Badge label="Exclusive Rewards 2025" variant="secondary" size="md" />
            </motion.div>
            
            <h1 className="font-display text-display-md md:text-display-lg font-bold text-on-surface mt-6 mb-6 tracking-tight leading-none">
              Hemat Lebih Banyak,<br />
              <span className="gradient-text-neon">Gaya Hidup</span> Lebih Baik
            </h1>
            
            <p className="font-body text-body-lg text-on-surface-variant leading-relaxed text-balance">
              Temukan penawaran terbatas untuk ekosistem kendaraan listrik dan hunian modern Anda. Diskon eksklusif hanya untuk pelanggan Tridjaya Samrat.
            </p>
          </motion.div>

          {/* FEATURED PROMO - MEGA CARD */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative group"
          >
            <div className="relative glass-card rounded-[2.5rem] overflow-hidden border-primary/20 hover:border-primary/40 transition-all duration-700 shadow-neon-cyan-sm hover:shadow-neon-cyan-md">
              <div className="flex flex-col lg:flex-row min-h-[500px]">
                {/* Visual Side */}
                <div className="lg:w-1/2 relative overflow-hidden group">
                  <img
                    src={heroPromo.image}
                    alt={heroPromo.title}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  {/* No overlay blur as per user request */}
                  
                  {/* Floating Badge */}
                  <div className="absolute top-8 left-8 flex flex-col gap-3">
                    <div className="glass-premium px-4 py-2 rounded-2xl border-primary/40 shadow-neon-cyan-sm backdrop-blur-xl">
                      <span className="font-display text-headline-sm font-bold gradient-text-primary">
                        -{heroPromo.discount}% OFF
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content Side */}
                <div className="lg:w-1/2 p-10 lg:p-16 flex flex-col justify-center relative bg-surface-low/30">
                  <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 w-fit">
                    <Zap className="w-4 h-4 animate-pulse" />
                    <span className="text-label-sm font-bold uppercase tracking-widest">Penawaran Unggulan</span>
                  </div>

                  <h2 className="font-display text-display-sm font-bold text-on-surface mb-4 leading-tight">
                    {heroPromo.title}
                  </h2>
                  <p className="font-body text-body-lg text-on-surface-variant mb-8 leading-relaxed">
                    {heroPromo.description}
                  </p>

                  <div className="grid grid-cols-2 gap-8 mb-10 pb-10 border-b border-outline-variant/20">
                    <div>
                      <div className="font-body text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Harga Promo Mulai</div>
                      <div className="font-display text-headline-md font-bold text-on-surface">
                        {formatPrice(heroPromo.promoPrice)}
                      </div>
                    </div>
                    <div>
                      <div className="font-body text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">Berlaku Hingga</div>
                      <div className="flex items-center gap-2 font-display text-headline-sm font-bold text-on-surface">
                        <Clock className="w-5 h-5 text-secondary" />
                        {heroPromo.validUntil}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5">
                    <Link
                      to={`/promo/${heroPromo.id}`}
                      onClick={() => {
                        recordTelemetry('click', {
                          path: `/promo/${heroPromo.id}`,
                          source: 'direct',
                          metadata: {
                            contentType: 'promo',
                            contentKey: `promo:${heroPromo.id}`,
                            contentId: heroPromo.id,
                            contentTitle: heroPromo.title,
                            action: 'open_promo_detail',
                            location: 'promo_hero_card',
                          },
                        });
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-10 py-5 gradient-primary rounded-2xl font-display text-title-md font-bold text-surface hover:shadow-neon-cyan transition-all duration-300 group"
                    >
                      Klaim Promo Sekarang
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                    </Link>
                    <button className="w-14 h-14 rounded-2xl glass-premium flex items-center justify-center text-on-surface hover:text-primary transition-colors">
                      <Share2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. PROMO GRID - Modern Bento Style */}
      <section className="pb-32 relative bg-surface-low/95">
        <div className="container-custom">
          <SectionHeader
            title="Penawaran Lainnya"
            subtitle="Pilihan promo menarik untuk berbagai kategori produk unggulan kami."
            align="left"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
              {standardPromos.map((promo, i) => (
                <motion.div
                  key={promo.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="group relative cursor-pointer"
                >
                  <div className="glass-card rounded-[2rem] overflow-hidden flex flex-col h-full hover:shadow-neon-cyan-sm transition-all duration-500 border-outline-variant/20 hover:border-primary/30">
                    <div className="relative h-60 overflow-hidden">
                      <img
                        src={promo.image}
                        alt={promo.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {/* No overlay blur as per user request */}
                      <div className="absolute top-4 right-4 px-3 py-1.5 glass-premium rounded-xl text-label-md font-bold text-primary border-primary/30">
                        {promo.badge}
                      </div>
                    </div>

                    <div className="p-8 flex flex-col flex-1">
                      <div className="font-body text-label-sm text-primary uppercase tracking-[0.2em] font-bold mb-3">
                        {promo.category} Collection
                      </div>
                      <h3 className="font-display text-headline-sm font-bold text-on-surface mb-3 group-hover:text-primary transition-colors">
                        {promo.title}
                      </h3>
                      <p className="font-body text-body-md text-on-surface-variant mb-6 line-clamp-2">
                        {promo.description}
                      </p>

                      <div className="mt-auto pt-6 border-t border-outline-variant/10 flex items-center justify-between">
                        <div>
                          <div className="font-body text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Sisa Waktu</div>
                          <div className="font-display text-title-md font-bold text-on-surface flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-secondary" /> 12 Hari
                          </div>
                        </div>
                        <Link
                          to={`/promo/${promo.id}`}
                          onClick={() => {
                            recordTelemetry('click', {
                              path: `/promo/${promo.id}`,
                              source: 'direct',
                              metadata: {
                                contentType: 'promo',
                                contentKey: `promo:${promo.id}`,
                                contentId: promo.id,
                                contentTitle: promo.title,
                                action: 'open_promo_detail',
                                location: 'promo_grid_card',
                              },
                            });
                          }}
                          className="w-12 h-12 rounded-xl bg-surface-high flex items-center justify-center text-on-surface hover:bg-primary hover:text-surface transition-all"
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

          {/* Info Banner - Help Center */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-24 p-1 rounded-[2rem] bg-gradient-to-r from-primary/20 via-outline-variant/20 to-secondary/20"
          >
            <div className="glass-premium rounded-[1.9rem] p-10 lg:p-16 flex flex-col lg:flex-row items-center gap-10 text-center lg:text-left">
              <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-neon-cyan">
                <Ticket className="w-10 h-10 text-surface" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-headline-md font-bold text-on-surface mb-4">
                  Bantu Temukan Promo Terbaik?
                </h2>
                <p className="font-body text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
                  Tim kami siap memberikan rincian promo terbaru dan membantu Anda mengklaim voucher hadiah. Hubungi agen resmi kami untuk layanan personal.
                </p>
              </div>
              <div className="flex flex-col gap-4 min-w-[240px]">
                <a
                  href="https://wa.me/6285161542103"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    recordTelemetry('whatsapp_click', {
                      path: '/promo',
                      source: 'direct',
                      metadata: {
                        contentType: 'page',
                        contentKey: 'promo:index',
                        pageType: 'promo_index_cta',
                        action: 'promo_whatsapp_cta',
                      },
                    });
                  }}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-on-surface text-surface rounded-2xl font-display text-title-sm font-bold hover:bg-primary transition-all duration-300 shadow-xl"
                >
                  Hubungi Agen Sekarang
                  <Zap className="w-4 h-4" />
                </a>
                <button className="flex items-center justify-center gap-2 px-8 py-4 glass-card rounded-2xl font-display text-title-sm font-semibold text-on-surface hover:border-primary/50 transition-all">
                  <Info className="w-4 h-4" /> Pelajari Syarat
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Badges Bar */}
      <section className="pb-24 border-t border-outline-variant/10 pt-24 bg-surface-low/20">
        <div className="container-custom">
          <PartnerLogos />
        </div>
      </section>
    </div>
  );
};

export default PromoPage;
