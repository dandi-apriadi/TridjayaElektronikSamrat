import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Filter, SlidersHorizontal, Battery, Zap, Leaf } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { ProductCard, Badge } from '../components/ui';
import heroBike from '../assets/images/hero-bike.webp';

const filters = ['Semua', 'Goda', 'Winfly', 'Nuv'];
const sortOptions = ['Terpopuler', 'Harga Terendah', 'Harga Tertinggi', 'Terbaru'];

const specs = [
  { icon: Battery, label: 'Baterai Lithium', value: 'hingga 32Ah', color: 'text-primary' },
  { icon: Zap, label: 'Motor BLDC', value: 'hingga 2000W', color: 'text-secondary' },
  { icon: Leaf, label: 'Emisi CO2', value: '0 g/km', color: 'text-green-400' },
];

const BikesCatalogPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [activeSort, setActiveSort] = useState('Terpopuler');
  const [showFilters, setShowFilters] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'indent'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under20' | 'above20'>('all');

  const { getProductsByCategory, isLoading } = useProductStore();
  const bikes = getProductsByCategory('bike');
  const filteredByBrand = activeFilter === 'Semua'
    ? bikes
    : bikes.filter((b) => b.name.toLowerCase().includes(activeFilter.toLowerCase()));

  const filteredByStock = stockFilter === 'all'
    ? filteredByBrand
    : filteredByBrand.filter((b) => b.stock === stockFilter);

  const filteredByPrice = priceFilter === 'all'
    ? filteredByStock
    : filteredByStock.filter((b) => (priceFilter === 'under20' ? b.price < 20000000 : b.price >= 20000000));

  const filtered = [...filteredByPrice].sort((a, b) => {
    if (activeSort === 'Harga Terendah') return a.price - b.price;
    if (activeSort === 'Harga Tertinggi') return b.price - a.price;
    if (activeSort === 'Terbaru') {
      const aNew = a.badge === 'new' ? 1 : 0;
      const bNew = b.badge === 'new' ? 1 : 0;
      return bNew - aNew;
    }
    return b.rating - a.rating;
  });

  const resetAdvancedFilter = () => {
    setStockFilter('all');
    setPriceFilter('all');
  };

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBike} alt="Sepeda Listrik" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-surface/80 via-surface/60 to-surface" />
        </div>
        <div className="relative z-10 container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl"
          >
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 font-body text-body-sm text-on-surface-variant mb-6">
              <Link to="/" className="hover:text-primary transition-colors">Beranda</Link>
              <span>/</span>
              <span className="text-white">Sepeda Listrik</span>
            </nav>

            <Badge label="Electric Mobility" variant="primary" />
            <h1 className="font-display text-display-sm font-bold text-white mt-3 mb-4">
              Katalog <span className="gradient-text-primary">Sepeda Listrik</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant leading-relaxed">
              Temukan sepeda listrik terbaik dari Goda, Winfly, dan Nuv. Performa andal, jangkauan jauh, dan ramah lingkungan.
            </p>
          </motion.div>

          {/* Quick specs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-4 mt-8"
          >
            {specs.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-2 glass-dark px-4 py-2.5 rounded-xl">
                <Icon className={`w-4 h-4 ${color}`} />
                <div>
                  <div className="font-body text-label-sm text-on-surface-variant">{label}</div>
                  <div className={`font-display text-body-md font-bold ${color}`}>{value}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Catalog */}
      <section className="pb-20 bg-surface/90">
        <div className="container-custom">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2 flex-wrap">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-4 py-2 rounded-lg font-body text-body-md font-medium transition-all duration-200 ${
                    activeFilter === f
                      ? 'gradient-primary text-surface shadow-neon-cyan-sm'
                      : 'glass-card text-on-surface-variant hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <select
                value={activeSort}
                onChange={(e) => setActiveSort(e.target.value)}
                className="bg-surface-highest border-0 rounded-lg px-3 py-2 font-body text-body-md text-white focus:ring-1 focus:ring-primary/50 focus:outline-none"
              >
                {sortOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 glass-card rounded-lg font-body text-body-md text-on-surface-variant hover:text-white transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between mb-6">
            <p className="font-body text-body-md text-on-surface-variant">
              Menampilkan <span className="text-white font-semibold">{filtered.length}</span> produk
            </p>
          </div>

          {showFilters && (
            <div className="mb-6 glass-card rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-label-sm text-on-surface-variant mb-2">Status Stok</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Semua', value: 'all' },
                    { label: 'Available', value: 'available' },
                    { label: 'Indent', value: 'indent' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStockFilter(item.value as 'all' | 'available' | 'indent')}
                      className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-colors ${
                        stockFilter === item.value ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-label-sm text-on-surface-variant mb-2">Rentang Harga</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Semua', value: 'all' },
                    { label: '< 20 Juta', value: 'under20' },
                    { label: '>= 20 Juta', value: 'above20' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPriceFilter(item.value as 'all' | 'under20' | 'above20')}
                      className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-colors ${
                        priceFilter === item.value ? 'bg-secondary/20 text-secondary' : 'bg-surface-high text-on-surface-variant'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:text-right md:self-end">
                <button
                  type="button"
                  onClick={resetAdvancedFilter}
                  className="px-3 py-1.5 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-colors text-label-sm font-semibold"
                >
                  Reset Filter Lanjutan
                </button>
              </div>
            </div>
          )}

          {/* Product grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-96 animate-pulse">
                  <div className="h-48 bg-surface-highest rounded-t-2xl"></div>
                  <div className="p-4 space-y-4">
                    <div className="h-6 bg-surface-highest rounded w-3/4"></div>
                    <div className="h-4 bg-surface-highest rounded w-1/2"></div>
                    <div className="h-10 bg-surface-highest rounded mt-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-20">
              <Filter className="w-10 h-10 text-on-surface-variant mx-auto mb-4" />
              <p className="font-body text-body-lg text-on-surface-variant">Tidak ada produk yang sesuai filter.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default BikesCatalogPage;
