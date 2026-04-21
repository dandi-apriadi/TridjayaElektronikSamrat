import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Thermometer, Wind, Sofa } from 'lucide-react';
import { products } from '../data';
import { ProductCard, Badge } from '../components/ui';
import sofaImg from '../assets/images/sofa.png';
import tvImg from '../assets/images/tv.png';

const categories = [
  { id: 'all', label: 'Semua', icon: null },
  { id: 'tv', label: 'Televisi', icon: Monitor },
  { id: 'kulkas', label: 'Kulkas', icon: Thermometer },
  { id: 'kipas', label: 'Kipas & AC', icon: Wind },
  { id: 'sofa', label: 'Sofa', icon: Sofa },
];

const HomeCatalogPage: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const homeProducts = products.filter((p) => p.category === 'electronics' || p.category === 'furniture');
  const filtered = activeCategory === 'all'
    ? homeProducts
    : homeProducts.filter((p) => p.subcategory.toLowerCase().includes(activeCategory));

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="grid grid-cols-2 h-full opacity-15">
            <img src={tvImg} alt="" className="w-full h-full object-cover" />
            <img src={sofaImg} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-surface/90 via-surface/70 to-surface" />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/80 to-surface/20" />
        </div>

        <div className="relative z-10 container-custom">
          <nav className="flex items-center gap-2 font-body text-body-sm text-on-surface-variant mb-6">
            <Link to="/" className="hover:text-primary transition-colors">Beranda</Link>
            <span>/</span>
            <span className="text-on-surface font-medium">Elektronik & Furnitur</span>
          </nav>

          <Badge label="Home Living" variant="secondary" />
          <h1 className="font-display text-display-sm font-bold text-on-surface mt-3 mb-4">
            Elektronik & <span className="gradient-text-neon">Furnitur Premium</span>
          </h1>
          <p className="font-body text-body-lg text-on-surface-variant max-w-xl leading-relaxed">
            Lengkapi hunian modern Anda dengan koleksi TV, kulkas, kipas angin, dan sofa premium pilihan terbaik dari Tridjaya Samrat.
          </p>
        </div>
      </section>

      {/* Catalog */}
      <section className="pb-20">
        <div className="container-custom">
          {/* Category tabs */}
          <div className="flex items-center gap-3 flex-wrap mb-8">
            {categories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-body text-body-md font-medium transition-all duration-200 ${
                  activeCategory === id
                    ? 'gradient-primary text-on-primary shadow-neon-cyan-sm'
                    : 'glass-card text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {label}
              </button>
            ))}
          </div>

          {/* Featured bento row */}
          {activeCategory === 'all' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8"
            >
              {[
                { img: tvImg, label: 'Smart TV OLED', cat: 'Televisi', href: '/produk/smart-tv-65', badge: 'Baru Rilis' },
                { img: sofaImg, label: 'Sofa Sectional Premium', cat: 'Furnitur', href: '/produk/sofa-premium-l', badge: 'Terlaris' },
              ].map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link to={item.href} className="group block">
                    <div className="relative overflow-hidden rounded-2xl aspect-[16/9]">
                      <img src={item.img} alt={item.label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
                      <div className="absolute top-4 left-4">
                        <span className="px-2.5 py-1 glass-premium border border-primary/20 rounded-lg font-body text-label-md text-primary font-bold uppercase tracking-wider">
                          {item.badge}
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-4">
                        <div className="font-body text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">{item.cat}</div>
                        <h3 className="font-display text-headline-sm font-bold text-on-surface">{item.label}</h3>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="font-body text-body-lg text-on-surface-variant">Produk tidak ditemukan.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default HomeCatalogPage;
