import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, Play, Zap, Battery, Shield, Wrench, TrendingUp,
} from 'lucide-react';
import { products, promos, formatPrice } from '../data';
import { ProductCard, SectionHeader, StatsRow, PartnerLogos } from '../components/ui';
import heroBike from '../assets/images/hero-bike.webp';
import sofaImg from '../assets/images/sofa.webp';
import tvImg from '../assets/images/tv.webp';

/* ========================
   HERO SECTION
======================== */
const HeroSection: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1.1, 1.2]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-surface">
      {/* Background with stronger overlays for readability */}
      <motion.div className="absolute inset-0 z-0" style={{ y }}>
        <motion.img
          src={heroBike}
          alt="Tridjaya Samrat"
          className="w-full h-full object-cover object-center"
          style={{ scale }}
        />
        {/* Layered Overlays - Darkened for high contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-surface/30 via-surface/75 to-surface" />
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
      </motion.div>

      {/* Modern Glowing Accents - Reduced opacity for clarity */}
      <div className="absolute top-1/4 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-24 w-80 h-80 bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        style={{ opacity }}
        className="relative z-10 container-custom text-center pt-20"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          {/* Refined Eyebrow */}
          <div className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-surface-highest/90 border border-primary/20 mb-10 shadow-xl">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)] animate-pulse" />
            <span className="font-body text-label-sm font-black text-on-surface uppercase tracking-[0.3em]">
              Distributor Resmi Sulawesi
            </span>
          </div>

          {/* Impactful Headline with Shadow for contrast */}
          <h1 className="font-display font-bold text-on-surface leading-[0.9] tracking-tighter mb-8 max-w-5xl drop-shadow-md">
            <span className="text-display-md md:text-display-lg block mb-4">Masa Depan</span>
            <span className="text-display-lg md:text-display-xl gradient-text-neon block mb-4 drop-shadow-sm">Gaya Hidup</span>
            <span className="text-display-md md:text-display-lg block">Dimulai Sekarang.</span>
          </h1>

          {/* Refined Subtitle - High contrast */}
          <p className="font-body text-body-lg text-on-surface max-w-2xl leading-relaxed mb-12 font-bold drop-shadow-sm opacity-95">
            Temukan koleksi eksklusif sepeda listrik, elektronik premium, dan furnitur modern yang dirancang untuk meningkatkan standar hidup Anda.
          </p>

          {/* Premium CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-24">
            <Link
              to="/produk/bike"
              className="relative flex items-center gap-3 px-10 py-5 gradient-primary rounded-2xl font-display text-title-sm font-bold text-surface hover:shadow-neon-cyan transition-all duration-500 group overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <span className="relative z-10">Jelajahi Produk</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform relative z-10" />
            </Link>
            
            <Link
              to="/promo"
              className="flex items-center gap-3 px-10 py-5 bg-surface-highest/80 border border-white/20 rounded-2xl font-display text-title-sm font-bold text-on-surface hover:bg-surface-highest hover:border-primary/40 transition-all duration-300 group backdrop-blur-sm"
            >
              <Play className="w-4 h-4 fill-primary text-primary group-hover:scale-125 transition-transform" />
              Lihat Promo
            </Link>
          </div>

          {/* Refined Quick Stats - Increased readability with solid-ish backgrounds */}
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {[
              { icon: Zap, label: '120 km', sub: 'Max Range', color: 'text-primary' },
              { icon: Battery, label: '750W', sub: 'High Power', color: 'text-secondary' },
              { icon: Shield, label: '3 Tahun', sub: 'Garansi Resmi', color: 'text-tertiary' },
            ].map(({ icon: Icon, label, sub, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 group">
                <div className={`p-4 rounded-2xl bg-surface-highest/95 border border-white/10 mb-3 group-hover:border-primary/40 transition-all duration-300 shadow-xl`}>
                  <Icon className={`w-6 h-6 ${color} group-hover:scale-110 transition-transform`} />
                </div>
                <span className="font-display text-title-md font-black text-on-surface drop-shadow-sm">{label}</span>
                <span className="font-body text-label-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">{sub}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Modern Scroll Indicator - High contrast */}
      <motion.div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="px-4 py-1.5 bg-surface-highest/80 rounded-full border border-white/10 backdrop-blur-sm mb-1 shadow-lg">
          <span className="font-body text-[10px] font-black text-on-surface uppercase tracking-[0.4em]">Scroll</span>
        </div>
        <div className="w-[2.5px] h-16 bg-gradient-to-b from-primary to-transparent rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
      </motion.div>
    </section>
  );
};

/* ========================
   CATEGORY BENTO GRID
======================== */
const categories = [
  {
    id: 'bike',
    label: 'Electric Mobility',
    subtitle: 'Sepeda & Skuter Listrik',
    description: 'Goda, Winfly, Nuv — Merek terpercaya untuk mobilitas hijau',
    href: '/produk/bike',
    image: heroBike,
    accent: 'primary' as const,
    icon: Zap,
    span: 'lg:col-span-8',
    height: 'aspect-[16/9]',
    badge: '3 Brand Unggulan',
  },
  {
    id: 'furniture',
    label: 'Living Space',
    subtitle: 'Furnitur Premium',
    description: 'Sofa & furniture berkualitas untuk rumah impian',
    href: '/produk/home',
    image: sofaImg,
    accent: 'magenta' as const,
    icon: Shield,
    span: 'lg:col-span-4',
    height: 'aspect-square',
    badge: 'New Collection',
  },
  {
    id: 'electronics',
    label: 'Home Entertainment',
    subtitle: 'TV, Kulkas, Elektronik',
    description: 'Perangkat elektronik premium untuk hunian modern',
    href: '/produk/home',
    image: tvImg,
    accent: 'lime' as const,
    icon: TrendingUp,
    span: 'lg:col-span-12',
    height: 'h-48',
    badge: 'Harga Terjangkau',
    horizontal: true,
  },
];

const CategoryBentoGrid: React.FC = () => (
  <section className="section-padding">
    <div className="container-custom">
      <SectionHeader
        eyebrow="Kategori Produk"
        title="Semua Kebutuhan Anda di Satu Tempat"
        subtitle="Dari sepeda listrik hemat hingga furnitur premium — Tridjaya hadir untuk memenuhi setiap aspek kehidupan modern Anda."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        {categories.map((cat, i) => {
          const Icon = cat.icon;
          if (cat.horizontal) {
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`${cat.span}`}
              >
                <Link to={cat.href} className="group block">
                  <div className={`relative overflow-hidden rounded-2xl glass-card ${cat.height} flex items-center`}>
                    <div className="absolute inset-0">
                      <img src={cat.image} alt={cat.label} className="w-full h-full object-cover opacity-90 dark:opacity-40 group-hover:opacity-100 dark:group-hover:opacity-60 transition-opacity duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-r dark:from-surface/90 from-surface/40 via-surface/10 dark:via-surface/60 to-transparent" />
                    </div>
                    <div className="relative z-10 p-5 mx-6 flex items-center justify-between w-full glass-premium dark:bg-transparent dark:backdrop-blur-0 dark:border-0 rounded-2xl">
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-neon-cyan-sm`}>
                          <Icon className="w-6 h-6 text-surface" />
                        </div>
                        <div>
                          <div className="font-body text-label-md text-primary dark:text-primary uppercase tracking-widest font-bold mb-1">{cat.subtitle}</div>
                          <h3 className="font-display text-headline-sm font-bold text-on-surface">{cat.label}</h3>
                          <p className="font-body text-body-md text-on-surface-variant font-medium">{cat.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <span className="glass-premium px-3 py-1 rounded-full text-label-sm text-on-surface-variant border border-outline-variant/40">{cat.badge}</span>
                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center group-hover:shadow-neon-cyan transition-shadow duration-300">
                          <ArrowRight className="w-4 h-4 text-surface group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          }
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`${cat.span}`}
            >
              <Link to={cat.href} className="group block">
                <div className={`relative overflow-hidden rounded-2xl glass-card ${cat.height}`}>
                  <img
                    src={cat.image}
                    alt={cat.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                    <div className="absolute inset-0 bg-gradient-to-t dark:from-surface from-surface/50 via-surface/10 dark:via-surface/40 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <div className="glass-premium p-5 rounded-2xl dark:bg-transparent dark:backdrop-blur-0 dark:border-0">
                      <span className="inline-flex px-2.5 py-1 rounded-lg glass-premium border border-on-surface-variant/20 text-label-sm text-on-surface-variant font-bold uppercase tracking-wider w-fit mb-3">
                        {cat.badge}
                      </span>
                      <div className="font-body text-label-md text-primary dark:text-primary uppercase tracking-widest font-bold mb-1">{cat.subtitle}</div>
                      <h3 className="font-display text-headline-md font-bold text-on-surface mb-2">{cat.label}</h3>
                      <p className="font-body text-body-md text-on-surface-variant mb-4 max-w-sm font-medium">{cat.description}</p>
                      <div className="flex items-center gap-2 font-body text-body-md font-bold text-primary group-hover:gap-3 transition-all duration-200">
                        Lihat Koleksi <ArrowRight className="w-4 h-4" />
                      </div>
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

/* ========================
   FEATURED PRODUCTS
======================== */
const FeaturedProducts: React.FC = () => {
  const bikes = products.filter((p) => p.category === 'bike');

  return (
    <section className="section-padding bg-surface-low/95">
      <div className="container-custom">
        <div className="flex items-end justify-between mb-12">
          <SectionHeader
            eyebrow="Sepeda Listrik"
            title="Pilihan Sepeda Listrik Terbaik"
            subtitle="Teknologi E-Bike terkini dengan garansi resmi dan servis terpercaya."
            align="left"
            className="mb-0"
          />
          <Link
            to="/produk/bike"
            className="hidden md:flex items-center gap-2 font-body text-body-md font-semibold text-primary hover:gap-3 transition-all duration-200"
          >
            Lihat Semua <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bikes.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>

        <div className="mt-6 flex justify-center md:hidden">
          <Link to="/produk/bike" className="flex items-center gap-2 px-6 py-3 glass-card rounded-xl font-body text-body-md font-semibold text-primary">
            Lihat Semua Sepeda <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};

/* ========================
   PROMO HIGHLIGHT
======================== */
const PromoHighlight: React.FC = () => {
  const heroPromo = promos[0];

  return (
    <section className="section-padding">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Promo Spesial"
          title="Penawaran yang Tidak Boleh Dilewatkan"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Hero promo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-7"
          >
            <Link to="/promo" className="group block">
              <div className="relative overflow-hidden rounded-2xl aspect-[16/9]">
                <img
                  src={heroPromo.image}
                  alt={heroPromo.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 dark:via-surface/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <div className="px-2.5 py-1 glass-premium border border-primary/30 rounded-lg w-fit mb-3">
                    <span className="font-body text-label-md font-bold text-primary uppercase tracking-wider">🔥 Hot Deal</span>
                  </div>
                  <h3 className="font-display text-headline-md font-bold text-on-surface mb-1">{heroPromo.title}</h3>
                  <p className="font-body text-body-md text-on-surface-variant mb-3">{heroPromo.subtitle}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-headline-sm font-bold gradient-text-primary">
                      {formatPrice(heroPromo.promoPrice)}
                    </span>
                    <span className="font-body text-body-md text-on-surface-variant line-through">
                      {formatPrice(heroPromo.originalPrice)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-secondary/20 text-secondary text-label-md font-bold">
                      -{heroPromo.discount}%
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Other promos */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {promos.slice(1).map((promo, i) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to="/promo" className="group block">
                  <div className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:shadow-neon-cyan transition-all duration-300">
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={promo.image} alt={promo.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-body text-label-sm text-primary uppercase tracking-wider font-bold">{promo.badge}</span>
                      <h4 className="font-display text-title-md font-bold text-on-surface mt-0.5 mb-1 truncate">{promo.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="font-body text-body-md font-bold text-on-surface">{formatPrice(promo.promoPrice)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-secondary/20 text-secondary text-label-sm font-bold">-{promo.discount}%</span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                  </div>
                </Link>
              </motion.div>
            ))}

            <Link
              to="/promo"
              className="flex items-center justify-center gap-2 py-3 glass-card rounded-xl font-body text-body-md font-semibold text-primary border border-primary/20 hover:border-primary/50 hover:shadow-neon-cyan-sm transition-all duration-300"
            >
              Lihat Semua Promo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ========================
   WHY TRIDJAYA
======================== */
const WhyUs: React.FC = () => {
  const benefits = [
    {
      icon: Shield,
      title: 'Garansi Resmi',
      desc: 'Semua produk kami dilengkapi garansi resmi pabrik hingga 3 tahun. Servis dan spare part tersedia di seluruh Sulawesi.',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: Wrench,
      title: 'Servis Profesional',
      desc: 'Tim teknisi bersertifikat siap membantu 6 hari seminggu. Kami menggunakan spare part original berstandar pabrik.',
      color: 'text-secondary',
      bg: 'bg-secondary/10',
    },
    {
      icon: TrendingUp,
      title: 'Cicilan 0% Bunga',
      desc: 'Dapatkan kemudahan cicilan tanpa bunga hingga 24 bulan bekerjasama dengan 15+ bank dan leasing terpercaya.',
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
    },
    {
      icon: Zap,
      title: 'Pengiriman Cepat',
      desc: 'Pengiriman ke seluruh Sulawesi dalam 1-3 hari kerja. Produk dikemas aman dengan jaminan kondisi sempurna.',
      color: 'text-yellow-400',
      bg: 'bg-yellow-400/10',
    },
  ];

  return (
    <section className="section-padding bg-surface-low/95">
      <div className="container-custom">
        <SectionHeader
          eyebrow="Mengapa Tridjaya?"
          title="Kepercayaan yang Dibangun Selama 15 Tahun"
          subtitle="Kami bukan sekadar toko — kami adalah mitra perjalanan Anda menuju gaya hidup modern yang lebih baik."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {benefits.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-6 group hover:shadow-neon-cyan transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <h3 className="font-display text-title-md font-bold text-on-surface mb-2">{item.title}</h3>
                <p className="font-body text-body-md text-on-surface-variant leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>

        <StatsRow />
      </div>
    </section>
  );
};

/* ========================
   CTA SECTION
======================== */
const CTASection: React.FC = () => (
  <section className="section-padding">
    <div className="container-custom">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl"
      >
        {/* BG gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface-highest to-secondary/10" />
        <div className="absolute inset-0 mesh-bg opacity-50" />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="relative p-10 md:p-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass-dark border border-primary/20 rounded-full mb-6">
            <Zap className="w-4 h-4 text-secondary" />
            <span className="font-body text-label-md font-bold text-secondary uppercase tracking-widest">Program Agen Resmi</span>
          </div>
          <h2 className="font-display text-display-md font-bold text-on-surface mb-4 max-w-2xl mx-auto text-balance">
            Bergabung sebagai Agen &<br />
            <span className="gradient-text-neon">Raih Penghasilan Tak Terbatas</span>
          </h2>
          <p className="font-body text-body-lg text-on-surface-variant max-w-xl mx-auto mb-8 leading-relaxed">
            Jadilah mitra bisnis Tridjaya Samrat dan nikmati komisi menarik, bonus bulanan, serta dukungan penuh dari tim kami.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/daftar-agen"
              id="cta-daftar-agen"
              className="flex items-center gap-2 px-8 py-4 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface hover:shadow-neon-cyan transition-all duration-300 group"
            >
              Daftar Jadi Agen
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/tentang"
              className="flex items-center gap-2 px-8 py-4 glass-premium rounded-xl font-display text-title-sm font-semibold text-on-surface hover:border-primary/50 transition-all duration-300"
            >
              Pelajari Lebih Lanjut
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

/* ========================
   HOME PAGE (MAIN)
======================== */
const HomePage: React.FC = () => {
  return (
    <>
      <HeroSection />
      <CategoryBentoGrid />
      <FeaturedProducts />
      <PromoHighlight />
      <WhyUs />
      
      {/* Brand Partners */}
      <section className="section-padding-sm bg-surface/50">
        <div className="container-custom">
          <SectionHeader
            title="Partner Strategis Kami"
            subtitle="Bekerja sama dengan brand terbaik untuk menghadirkan kualitas tanpa kompromi."
            align="center"
          />
          <PartnerLogos />
        </div>
      </section>

      <CTASection />
    </>
  );
};

export default HomePage;
