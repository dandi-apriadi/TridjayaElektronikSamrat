import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Menu, X, ChevronDown, ShoppingBag, LogIn, LayoutDashboard, ChevronRight, Search } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import logoHorizontal from '../../assets/images/logo-horizontal.webp';

import { useProductStore } from '../../store/useProductStore';
import { getImageUrl } from '../../utils/apiClient';
import { formatPrice } from '../../utils/formatters';

const getCategoryIcon = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes('sepeda') || c.includes('motor')) return '🏍️';
  if (c.includes('kasur') || c.includes('springbed')) return '🛏️';
  if (c.includes('sofa') || c.includes('sopa')) return '🛋️';
  if (c.includes('ac')) return '❄️';
  if (c.includes('kulkas') || c.includes('freezer')) return '🧊';
  if (c.includes('tv') || c.includes('speaker')) return '📺';
  if (c.includes('hp') || c.includes('handphone')) return '📱';
  if (c.includes('blender') || c.includes('magicom') || c.includes('oven') || c.includes('kompor') || c.includes('dispenser')) return '🍳';
  if (c.includes('meja') || c.includes('lemari') || c.includes('kursi')) return '🪑';
  if (c.includes('ban') || c.includes('sparepart') || c.includes('baterai')) return '⚙️';
  return '📦';
};

const categorize = (cat: string) => {
  const c = cat.toLowerCase();
  
  // Specific match for Sepeda Listrik
  if (c === 'sepeda listrik') return "Sepeda Listrik";
  
  // Furniture categories
  if (
    c.includes('furnitur') || 
    c.includes('furniture') || 
    c.includes('kasur') || 
    c.includes('sofa') || 
    c.includes('meja') || 
    c.includes('lemari') || 
    c.includes('kursi') ||
    c.includes('springbed')
  ) return "Furniture";
  
  // Electronics categories - Focused on high-value items
  if (
    c.includes('elektronik') || 
    c.includes('ac') || 
    c.includes('kulkas') || 
    c.includes('tv') || 
    c.includes('hp') || 
    c.includes('handphone') ||
    c.includes('freezer') ||
    c.includes('mesin cuci') ||
    c.includes('showcase')
  ) return "Produk Elektronik";

  return null;
};

interface NavItemChild {
  label: string;
  href: string;
  icon: string;
}

interface NavItem {
  label: string;
  href: string;
  children?: NavItemChild[];
  isMega?: boolean;
  groups?: Record<string, NavItemChild[]>;
}

const baseNavItems: NavItem[] = [
  { label: 'Beranda', href: '/' },
  {
    label: 'Produk',
    href: '/produk',
    children: [], // Populated dynamically
  },
  { label: 'Promo', href: '/promo' },
  { label: 'Blog', href: '/blog' },
  { label: 'Karier', href: '/karier' },
  { label: 'Tentang', href: '/tentang' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isMobileProductsExpanded, setIsMobileProductsExpanded] = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const { isAuthenticated, user } = useAuthStore();
  const { products } = useProductStore();
  const navigate = useNavigate();

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = searchQuery.trim().length >= 2
    ? products
        .filter(p =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.subcategory || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const openSearch = () => {
    setIsSearchOpen(true);
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    closeSearch();
    navigate(`/produk?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSelectProduct = (slug: string) => {
    closeSearch();
    navigate(`/produk/${slug}`);
  };

  // Close search on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    if (isSearchOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isSearchOpen]);
  const location = useLocation();

  const dashboardPath = user?.role === 'admin' 
    ? '/dashboard/admin' 
    : user?.role === 'agent' 
      ? '/dashboard/agent' 
      : '/dashboard';

  const uniqueCategories = Array.from(new Set(products.map(p => p.category)))
    .filter(cat => cat && categorize(cat) !== null);
  
  // Group categories for Mega Menu
  const categoriesByGroup = uniqueCategories.reduce((acc, cat) => {
    const group = categorize(cat);
    const key = group || 'Lainnya';
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      label: cat,
      href: `/produk?kategori=${encodeURIComponent(cat)}`,
      icon: getCategoryIcon(cat)
    });
    return acc;
  }, {} as Record<string, NavItemChild[]>);

  // Sort groups and items by popularity
  const groupPriority = ["Sepeda Listrik", "Produk Elektronik", "Furniture"];
  const itemPriority: Record<string, number> = {
    "Sepeda Listrik": 1,
    "Motor Listrik": 2,
    "AC": 3,
    "KULKAS": 4,
    "TV": 5,
    "SPRINGBED": 6,
    "SOFA": 7
  };

  // Sort items within groups
  Object.keys(categoriesByGroup).forEach(group => {
    categoriesByGroup[group].sort((a, b) => {
      const pA = itemPriority[a.label] || 99;
      const pB = itemPriority[b.label] || 99;
      return pA - pB || a.label.localeCompare(b.label);
    });
  });

  // Sort the groups themselves in a specific order
  const sortedCategoriesByGroup = Object.keys(categoriesByGroup)
    .sort((a, b) => groupPriority.indexOf(a) - groupPriority.indexOf(b))
    .reduce((acc, key) => {
      acc[key] = categoriesByGroup[key];
      return acc;
    }, {} as Record<string, NavItemChild[]>);

  const navItems: NavItem[] = baseNavItems.map(item => {
    if (item.label === 'Produk') {
      return {
        ...item,
        isMega: true,
        groups: sortedCategoriesByGroup
      };
    }
    return item;
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdown(null);
    setIsMobileProductsExpanded(false);
  }, [location]);

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 navbar-root ${
          scrolled
            ? 'navbar-scrolled py-2 bg-surface/80 backdrop-blur-xl shadow-sm border-b border-white/8'
            : 'py-4 bg-surface/40 backdrop-blur-md'
        }`}
        style={{ height: scrolled ? '72px' : '90px' }}
      >
        <div className="container-custom flex items-center justify-between h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src={logoHorizontal} alt="Tridjaya Manado Logo" className="h-10 lg:h-14 w-auto object-contain" />
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => (item.children || item.isMega) && setActiveDropdown(item.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {(item.children || item.isMega) ? (
                  <>
                    <Link
                      to={item.href}
                      className={`flex items-center gap-1 px-4 py-2 rounded-xl font-body text-body-md font-semibold transition-all duration-300 ${
                        location.pathname.startsWith('/produk')
                          ? scrolled ? 'text-primary' : 'navbar-navlink-hero text-primary'
                          : scrolled
                            ? 'nav-link-default text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                            : 'navbar-navlink-hero'
                      }`}
                    >
                      {item.label}
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          activeDropdown === item.label ? 'rotate-180' : ''
                        }`}
                      />
                    </Link>
                    <AnimatePresence>
                      {activeDropdown === item.label && (
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                            className={`absolute top-full left-1/2 -translate-x-1/2 pt-4 z-[60] ${
                              item.isMega ? 'w-[900px]' : 'w-56'
                            }`}
                          >
                            <div className={`glass-premium rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/10 !bg-surface/98 relative ${
                              item.isMega ? 'p-10' : 'p-2'
                            }`}>
                              {/* Decorative corner glow */}
                              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[80px] pointer-events-none" />
                              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/5 blur-[80px] pointer-events-none" />
                              {item.isMega ? (
                                <div className="grid grid-cols-3 gap-10">
                                  {item.groups && Object.entries(item.groups).map(([groupName, children]) => (
                                    <div key={groupName} className="flex flex-col gap-4">
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgb(var(--color-primary))]" />
                                        <h4 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.25em]">
                                          {groupName}
                                        </h4>
                                      </div>
                                      <div className={`grid ${children.length > 8 ? 'grid-cols-2' : 'grid-cols-1'} gap-x-4 gap-y-0.5`}>
                                        {(children as NavItemChild[]).map((child) => (
                                          <Link
                                            key={child.label}
                                            to={child.href}
                                            className="flex items-center px-3 py-2 rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all duration-200 group/item"
                                          >
                                            <span className="font-body text-[13px] font-medium leading-tight">{child.label}</span>
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  {item.children?.map((child) => (
                                    <Link
                                      key={child.label}
                                      to={child.href}
                                      className="flex items-center px-4 py-2.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-surface-highest transition-all duration-150"
                                    >
                                      <span className="font-body text-body-md font-medium">{child.label}</span>
                                    </Link>
                                  ))}
                                </div>
                              )}
                              
                              {item.isMega && (
                                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                                  <p className="text-body-xs text-on-surface-variant italic">
                                    * Stok dan promo dapat berubah sewaktu-waktu.
                                  </p>
                                  <Link to="/produk" className="text-label-sm font-bold text-primary hover:underline flex items-center gap-2">
                                    Lihat Semua Koleksi <ChevronDown className="-rotate-90 w-3 h-3" />
                                  </Link>
                                </div>
                              )}
                            </div>
                          </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <Link
                    to={item.href}
                    className={`px-4 py-2 rounded-xl font-body text-body-md font-semibold transition-all duration-300 ${
                      location.pathname === item.href
                        ? scrolled
                          ? 'text-primary bg-primary/8'
                          : 'navbar-navlink-hero navbar-navlink-active'
                        : scrolled
                          ? 'nav-link-default text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                          : 'navbar-navlink-hero'
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Search button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={openSearch}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 navbar-icon-btn"
              aria-label="Cari produk"
            >
              <Search className="w-4.5 h-4.5" />
            </motion.button>

            {/* Theme toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 navbar-icon-btn"
              aria-label="Toggle tema"
            >
              <AnimatePresence mode="wait">
                {theme === 'dark' ? (
                  <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Sun className="w-4.5 h-4.5" />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Moon className="w-4.5 h-4.5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* CTA Button */}
            {isAuthenticated ? (
              <Link
                to={dashboardPath}
                className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl font-body text-body-md font-semibold navbar-cta-ghost transition-all duration-300"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl font-body text-body-md font-semibold navbar-cta-ghost transition-all duration-300"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            )}

            <Link
              to="/daftar-agen"
              className="hidden lg:flex items-center gap-2 px-5 py-2.5 rounded-xl font-body text-body-md font-semibold transition-all duration-300 navbar-cta-primary"
            >
              <ShoppingBag className="w-4 h-4" />
              Jadi Agen
            </Link>

            {/* Mobile menu toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 navbar-icon-btn"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                    <X className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                    <Menu className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="absolute inset-0 bg-surface/95 backdrop-blur-xl" />
            <div className="relative z-10 flex flex-col h-full pt-24 px-6 pb-8">
              <div className="flex flex-col gap-8 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {navItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {item.isMega ? (
                      <div className="space-y-4">
                        <button
                          onClick={() => setIsMobileProductsExpanded(!isMobileProductsExpanded)}
                          className="flex items-center justify-between w-full px-4 py-3 text-primary font-bold text-sm uppercase tracking-widest bg-primary/5 rounded-xl transition-all active:scale-[0.98]"
                        >
                          <span>{item.label}</span>
                          <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${isMobileProductsExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        
                        <AnimatePresence>
                          {isMobileProductsExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-6 pl-4 pt-2 pb-4">
                                {item.groups && Object.entries(item.groups).map(([groupName, children]) => (
                                  <div key={groupName} className="space-y-3">
                                    <h4 className="text-[11px] font-bold text-primary/80 uppercase tracking-[0.2em] flex items-center gap-2 px-1">
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan-sm" /> {groupName}
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {(children as NavItemChild[]).map((child) => (
                                        <Link
                                          key={child.label}
                                          to={child.href}
                                          onClick={() => setMobileOpen(false)}
                                          className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/5 text-white font-body text-sm font-semibold active:scale-95 transition-all"
                                        >
                                          <span className="text-2xl">{child.icon}</span>
                                          <span className="truncate">{child.label}</span>
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                <Link
                                  to="/produk"
                                  onClick={() => setMobileOpen(false)}
                                  className="flex items-center justify-center gap-2 py-4 mt-2 rounded-2xl border border-primary/20 bg-primary/5 text-primary font-bold text-sm"
                                >
                                  Lihat Semua Koleksi <ChevronDown className="-rotate-90 w-4 h-4" />
                                </Link>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : item.children ? (
                      <div>
                        <div className="px-4 py-3 text-on-surface-variant font-body text-title-sm font-semibold uppercase tracking-widest text-xs">
                          {item.label}
                        </div>
                        {item.children.map((child) => (
                          <Link
                            key={child.label}
                            to={child.href}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 px-6 py-3 text-white font-body text-title-md font-medium hover:text-primary transition-colors"
                          >
                            <span>{child.icon}</span>
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`block px-4 py-3 rounded-xl font-body text-title-md font-medium transition-all ${
                          location.pathname === item.href
                            ? 'text-primary bg-surface-highest'
                            : 'text-white hover:text-primary hover:bg-surface-highest'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3">
                {isAuthenticated ? (
                  <Link
                    to={dashboardPath}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-3.5 glass-card rounded-xl font-body text-title-sm font-semibold text-primary"
                  >
                    <LayoutDashboard className="w-4.5 h-4.5" />
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-3.5 glass-card rounded-xl font-body text-title-sm font-semibold text-on-surface-variant"
                  >
                    <LogIn className="w-4.5 h-4.5" />
                    Login
                  </Link>
                )}
                <Link
                  to="/daftar-agen"
                  className="flex items-center justify-center gap-2 w-full py-4 gradient-primary rounded-xl font-body text-title-sm font-bold text-surface"
                >
                  <ShoppingBag className="w-5 h-5" />
                  Daftar Jadi Agen
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-start justify-center pt-16 sm:pt-24 px-4"
            onClick={closeSearch}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            
            {/* Search Container */}
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-surface rounded-2xl overflow-hidden shadow-2xl border border-white/8">
                {/* Search Input */}
                <form onSubmit={handleSearchSubmit}>
                  <div className="flex items-center gap-3 px-4 py-4 border-b border-white/8">
                    <Search className="w-5 h-5 text-primary flex-shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari produk..."
                      className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/60 font-body text-base outline-none"
                      autoComplete="off"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeSearch}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>

                {/* Search Results */}
                <div className="max-h-[70vh] overflow-y-auto">
                  {searchQuery.trim().length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <Search className="w-10 h-10 mx-auto mb-3 text-on-surface-variant/30" />
                      <p className="text-on-surface-variant text-sm">
                        Ketik nama produk yang ingin dicari
                      </p>
                    </div>
                  ) : searchQuery.trim().length < 2 ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-on-surface-variant text-sm">Ketik minimal 2 karakter...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <p className="text-on-surface font-semibold mb-1">Produk tidak ditemukan</p>
                      <p className="text-on-surface-variant text-sm mb-4">
                        Coba kata kunci lain
                      </p>
                      <Link
                        to="/produk"
                        onClick={closeSearch}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-all"
                      >
                        Lihat Semua Produk
                      </Link>
                    </div>
                  ) : (
                    <div className="py-2">
                      {/* Header row */}
                      <div className="px-4 py-2 flex items-center justify-between">
                        <p className="text-on-surface-variant text-xs">
                          {searchResults.length} hasil
                        </p>
                        {searchResults.length === 6 && (
                          <button
                            onClick={handleSearchSubmit}
                            className="text-primary text-xs font-semibold hover:underline"
                          >
                            Lihat semua →
                          </button>
                        )}
                      </div>

                      {/* Result items */}
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleSelectProduct(product.slug)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-high transition-colors text-left group"
                        >
                          {/* Product Image */}
                          <div className="w-14 h-14 rounded-xl bg-surface-highest overflow-hidden flex-shrink-0 border border-white/5">
                            {product.image ? (
                              <img
                                src={getImageUrl(product.image)}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  (e.currentTarget.parentElement as HTMLElement).classList.add('flex', 'items-center', 'justify-center');
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant/40">
                                <ShoppingBag className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-on-surface text-sm font-semibold leading-snug mb-0.5 group-hover:text-primary transition-colors line-clamp-2">
                              {product.name}
                            </p>
                            <p className="text-on-surface-variant text-xs truncate">
                              {product.subcategory || product.category}
                            </p>
                          </div>

                          {/* Price + Arrow */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <p className="text-primary text-sm font-bold">
                              {product.price > 0 ? formatPrice(product.price) : '—'}
                            </p>
                            <ChevronRight className="w-4 h-4 text-on-surface-variant/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      ))}

                      {/* Footer */}
                      <div className="px-4 pt-2 pb-3 border-t border-white/5 mt-1">
                        <p className="text-on-surface-variant/50 text-xs text-center">
                          Tekan <kbd className="px-1.5 py-0.5 rounded bg-surface-high text-on-surface font-mono text-[10px]">Enter</kbd> untuk lihat semua hasil
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
