import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, SlidersHorizontal, Battery, Zap, Leaf, Search, X, ChevronDown, Image as ImageIcon, ImageOff, Tag } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { ProductCard, Badge } from '../components/ui';
import heroBike from '../assets/images/hero-bike.webp';
import { useThemeStore } from '../store/themeStore';
import { usePersistedState } from '../hooks/usePersistedState';

const sortOptions = ['Terpopuler', 'Harga Terendah', 'Harga Tertinggi', 'Terbaru'];

const specs = [
  { icon: Battery, label: 'Baterai Lithium', value: 'hingga 32Ah', color: 'text-primary' },
  { icon: Zap, label: 'Motor BLDC', value: 'hingga 2000W', color: 'text-secondary' },
  { icon: Leaf, label: 'Emisi CO2', value: '0 g/km', color: 'text-green-400' },
];

const CatalogPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeCategory = searchParams.get('kategori');
  const { showImages: globalShowImages } = useThemeStore();
  const [isLiteMode, setIsLiteMode] = usePersistedState('catalog:isLiteMode', !globalShowImages);

  const [activeFilter, setActiveFilter] = usePersistedState('catalog:activeFilter', 'Semua');
  const [activeSort, setActiveSort] = usePersistedState('catalog:activeSort', 'Terpopuler');
  const [showFilters, setShowFilters] = usePersistedState('catalog:showFilters', false);
  const [stockFilter, setStockFilter] = usePersistedState<'all' | 'available' | 'indent'>('catalog:stockFilter', 'all');
  const [priceFilter, setPriceFilter] = usePersistedState<'all' | 'under20' | 'above20'>('catalog:priceFilter', 'all');
  const [search, setSearch] = usePersistedState('catalog:search', '');
  const [visibleCount, setVisibleCount] = usePersistedState('catalog:visibleCount', 9);

  // Category dropdown state
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const { products, isLoading, fetchProducts } = useProductStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setIsCategoryOpen(false);
        setCategorySearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  
  // Filter by URL category parameter
  const categoryProducts = activeCategory 
    ? products.filter(p => p.category === activeCategory)
    : products;

  const searchedProducts = categoryProducts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    (p.subcategory || '').toLowerCase().includes(search.toLowerCase())
  );

  // Build dynamic filters from actual product data
  // Always show ALL unique subcategories from the full catalog so users can
  // navigate to any category from the dropdown, regardless of active URL filter.
  const allSubcategories = Array.from(
    new Set(products.map(p => p.subcategory || p.category).filter(Boolean))
  ).sort() as string[];

  const dynamicFilters: string[] = ['Semua', ...allSubcategories];

  // Category options filtered by search in dropdown
  const filteredCategoryOptions = dynamicFilters.filter(f =>
    f.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Count products per category — always count from full catalog so numbers
  // are accurate for all categories in the dropdown, not just the active URL filter.
  const countPerCategory = (cat: string) => {
    if (cat === 'Semua') return products.length;
    return products.filter(p =>
      p.subcategory?.toLowerCase() === cat.toLowerCase() ||
      p.category?.toLowerCase() === cat.toLowerCase()
    ).length;
  };

  const filteredByBrand = activeFilter === 'Semua'
    ? searchedProducts
    : searchedProducts.filter((b) => 
        (b.subcategory?.toLowerCase() === activeFilter.toLowerCase()) ||
        (b.category?.toLowerCase() === activeFilter.toLowerCase()) ||
        (b.name?.toLowerCase() || '').includes(activeFilter.toLowerCase())
      );

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
    return (b.views || 0) - (a.views || 0);
  });

  const visibleProducts = filtered.slice(0, visibleCount);

  const resetAdvancedFilter = () => {
    setStockFilter('all');
    setPriceFilter('all');
  };

  // Reset visible count when filters change
  React.useEffect(() => {
    setVisibleCount(9);
  }, [activeCategory, activeFilter, activeSort, search, stockFilter, priceFilter]);

  const loadMore = () => {
    setVisibleCount(prev => prev + 9);
  };

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          {!isLiteMode && <img src={heroBike} alt="Sepeda Listrik" className="w-full h-full object-cover opacity-20" />}
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
              <span className="text-white">{activeCategory || 'Semua Produk'}</span>
            </nav>

            <Badge label="Katalog Tridjaya" variant="primary" />
            <h1 className="font-display text-display-sm font-bold text-white mt-3 mb-4">
              Katalog <span className="gradient-text-primary">{activeCategory || 'Produk'}</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant leading-relaxed">
              Jelajahi berbagai pilihan produk {activeCategory ? activeCategory.toLowerCase() : 'terbaik'} kami. Temukan kualitas dan harga bersaing hanya di Tridjaya Manado.
            </p>
          </motion.div>

          {/* Quick specs (only show for Sepeda/Motor Listrik) */}
          {(activeCategory?.toLowerCase().includes('listrik') || !activeCategory) && (
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
          )}
        </div>
      </section>

      {/* Catalog */}
      <section className="pb-20 bg-surface/90">
        <div className="container-custom">
          
          {/* Search Bar */}
          <div className="relative mb-8 z-20">
            <div className="glass-card rounded-2xl p-2 flex items-center gap-2 shadow-2xl border border-white/10">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
                <input
                  type="text"
                  placeholder="Cari produk impian Anda (misal: Samsung A56, AC LG, Kulkas...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-transparent border-0 outline-none font-body text-body-lg text-white placeholder:text-on-surface-variant/50"
                />
              </div>
              {search && (
                <button onClick={() => setSearch('')} className="p-2 hover:bg-surface-highest rounded-xl transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            {/* Category Dropdown with Search */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => { setIsCategoryOpen(!isCategoryOpen); setCategorySearch(''); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card border font-body text-body-md font-semibold transition-all min-w-[180px] ${
                    activeFilter !== 'Semua'
                      ? 'border-primary/40 text-primary bg-primary/5'
                      : 'border-white/10 text-on-surface-variant hover:text-white'
                  }`}
                >
                  <Tag className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left truncate max-w-[140px]">{activeFilter}</span>
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isCategoryOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-2 w-72 glass-card rounded-2xl border border-white/10 shadow-2xl z-50 overflow-hidden"
                    >
                      {/* Search inside dropdown */}
                      <div className="p-3 border-b border-white/5">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                          <input
                            type="text"
                            placeholder="Cari kategori..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            autoFocus
                            className="w-full pl-9 pr-4 py-2 bg-surface-high rounded-lg text-body-sm text-white placeholder:text-on-surface-variant/50 outline-none focus:ring-1 focus:ring-primary/40 border border-white/5"
                          />
                          {categorySearch && (
                            <button onClick={() => setCategorySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                              <X className="w-3.5 h-3.5 text-on-surface-variant hover:text-white" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Category list */}
                      <div className="max-h-64 overflow-y-auto custom-scrollbar py-1">
                        {filteredCategoryOptions.length === 0 ? (
                          <div className="px-4 py-6 text-center text-body-sm text-on-surface-variant">
                            Kategori tidak ditemukan
                          </div>
                        ) : (
                          filteredCategoryOptions.map((f) => {
                            const count = countPerCategory(f);
                            const isActive = activeFilter === f;
                            return (
                              <button
                                key={f}
                                type="button"
                                onClick={() => {
                                  setActiveFilter(f);
                                  setIsCategoryOpen(false);
                                  setCategorySearch('');
                                  // Clear URL ?kategori= param so full catalog is searched
                                  if (activeCategory) navigate('/produk');
                                }}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                                  isActive
                                    ? 'bg-primary/15 text-primary'
                                    : 'text-on-surface-variant hover:bg-surface-high hover:text-white'
                                }`}
                              >
                                <span className="font-body text-body-sm font-medium truncate">{f}</span>
                                <span className={`text-label-xs font-bold px-1.5 py-0.5 rounded-md ml-2 flex-shrink-0 ${
                                  isActive ? 'bg-primary/20 text-primary' : 'bg-surface-highest text-on-surface-variant'
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Footer: total categories */}
                      <div className="px-4 py-2 border-t border-white/5 text-label-xs text-on-surface-variant">
                        {dynamicFilters.length - 1} kategori tersedia
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Active filter chip — quick clear */}
              {activeFilter !== 'Semua' && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('Semua')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-label-sm font-semibold hover:bg-primary/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsLiteMode(!isLiteMode)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl glass-card border border-white/5 font-body text-body-md font-bold transition-all duration-300 ${
                  isLiteMode ? 'text-primary border-primary/30' : 'text-on-surface-variant hover:text-white'
                }`}
                title={isLiteMode ? "Matikan Lite Mode" : "Aktifkan Lite Mode"}
              >
                {!isLiteMode ? <ImageIcon className="w-4 h-4" /> : <ImageOff className="w-4 h-4" />}
                <span className="hidden md:inline">{!isLiteMode ? 'Tampilkan Gambar' : 'Lite Mode Aktif'}</span>
              </button>
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
              Menampilkan <span className="text-white font-semibold">{Math.min(visibleCount, filtered.length)}</span> dari <span className="text-white font-semibold">{filtered.length}</span> produk
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
            <div className={`grid gap-5 ${
              !isLiteMode 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
            }`}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card rounded-2xl h-64 animate-pulse">
                  <div className="h-32 bg-surface-highest rounded-t-2xl"></div>
                  <div className="p-4 space-y-4">
                    <div className="h-4 bg-surface-highest rounded w-3/4"></div>
                    <div className="h-4 bg-surface-highest rounded w-1/2"></div>
                    <div className="h-10 bg-surface-highest rounded mt-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid gap-3 md:gap-4 ${
              !isLiteMode 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'
            }`}>
              {visibleProducts.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i % 9} isCompact={isLiteMode} />
              ))}
            </div>
          )}

          {/* Load More Button */}
          {!isLoading && visibleCount < filtered.length && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={loadMore}
                className="group relative px-8 py-3 rounded-xl bg-surface-high border border-primary/20 text-on-surface font-display font-bold hover:bg-primary/10 transition-all flex items-center gap-3"
              >
                <div className="absolute inset-0 bg-primary/5 rounded-xl blur-lg group-hover:bg-primary/10 transition-all" />
                <span className="relative">Tampilkan Lebih Banyak</span>
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <motion.div
                    animate={{ y: [0, 4, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <ChevronDown className="w-5 h-5 text-primary" />
                  </motion.div>
                </div>
              </button>
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

export default CatalogPage;
