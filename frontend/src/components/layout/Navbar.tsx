import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Menu, X, ChevronDown, ShoppingBag, LogIn, LayoutDashboard, ChevronRight } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import logoHorizontal from '../../assets/images/logo-horizontal.webp';

import { useProductStore } from '../../store/useProductStore';

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
  if (c.includes('sepeda') || c.includes('motor') || c.includes('ban') || c.includes('sparepart') || c.includes('baterai')) 
    return "Kendaraan Listrik";
  if (c.includes('kasur') || c.includes('springbed') || c.includes('sofa') || c.includes('meja') || c.includes('lemari') || c.includes('furniture') || c.includes('kursi') || c.includes('sopa'))
    return "Furnitur & Kasur";
  if (c.includes('ac') || c.includes('kulkas') || c.includes('freezer') || c.includes('tv') || c.includes('hp') || c.includes('blender') || c.includes('oven') || c.includes('dispenser') || c.includes('kipas') || c.includes('magicom') || c.includes('speaker') || c.includes('handphone') || c.includes('elektronik'))
    return "Elektronik & Gadget";
  return "Aksesoris & Lainnya";
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
    href: '#',
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
  const location = useLocation();

  const dashboardPath = user?.role === 'admin' 
    ? '/dashboard/admin' 
    : user?.role === 'agent' 
      ? '/dashboard/agent' 
      : '/dashboard';

  const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);
  
  // Group categories for Mega Menu
  const categoriesByGroup = uniqueCategories.reduce((acc, cat) => {
    const group = categorize(cat);
    if (!acc[group]) acc[group] = [];
    acc[group].push({
      label: cat,
      href: `/produk?kategori=${encodeURIComponent(cat)}`,
      icon: getCategoryIcon(cat)
    });
    return acc;
  }, {} as Record<string, NavItemChild[]>);

  const navItems: NavItem[] = baseNavItems.map(item => {
    if (item.label === 'Produk') {
      return {
        ...item,
        isMega: true,
        groups: categoriesByGroup
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'glass-premium py-2'
            : 'bg-gradient-to-b from-black/50 via-black/20 to-transparent py-4'
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
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDropdown((current) =>
                          current === item.label ? null : item.label
                        )
                      }
                      aria-expanded={activeDropdown === item.label}
                      aria-haspopup="menu"
                      className={`flex items-center gap-1 px-4 py-2 rounded-lg font-body text-body-md font-semibold transition-all duration-300 ${
                        location.pathname.startsWith('/produk')
                          ? 'text-primary'
                          : scrolled 
                            ? 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                            : 'text-white keep-white hover:text-primary drop-shadow-sm'
                      }`}
                    >
                      {item.label}
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          activeDropdown === item.label ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
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
                            <div className={`glass-premium rounded-2xl overflow-hidden shadow-2xl border border-white/10 ${
                              item.isMega ? 'p-8' : 'p-2'
                            }`}>
                              {item.isMega ? (
                                <div className="grid grid-cols-4 gap-8">
                                  {item.groups && Object.entries(item.groups).map(([groupName, children]) => (
                                    <div key={groupName} className="flex flex-col gap-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan-sm" />
                                        <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">
                                          {groupName}
                                        </h4>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {(children as NavItemChild[]).map((child) => (
                                          <Link
                                            key={child.label}
                                            to={child.href}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-on-surface-variant hover:text-white hover:bg-white/5 transition-all duration-200 group/item"
                                          >
                                            <span className="text-xl group-hover/item:scale-110 transition-transform">{child.icon}</span>
                                            <span className="font-body text-body-sm font-medium">{child.label}</span>
                                          </Link>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  {item.children?.map((child) => (
                                    <Link
                                      key={child.label}
                                      to={child.href}
                                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:text-white hover:bg-surface-highest transition-all duration-150"
                                    >
                                      <span className="text-lg">{child.icon}</span>
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
                    className={`px-4 py-2 rounded-lg font-body text-body-md font-semibold transition-all duration-300 ${
                      location.pathname === item.href
                        ? scrolled 
                          ? 'text-primary bg-surface-high'
                          : 'text-white keep-white bg-white/20 backdrop-blur-md shadow-sm'
                        : scrolled
                          ? 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
                          : 'text-white/90 keep-white hover:text-white drop-shadow-sm'
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className={`w-10 h-10 rounded-lg glass-card flex items-center justify-center transition-all duration-300 ${
                scrolled ? 'text-on-surface-variant' : 'text-white keep-white'
              } hover:text-primary`}
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
                className="hidden lg:flex items-center gap-2 px-4 py-2.5 glass-card rounded-lg font-body text-body-md font-semibold text-primary hover:bg-primary/10 transition-all duration-300"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className={`hidden lg:flex items-center gap-2 px-4 py-2.5 glass-card rounded-lg font-body text-body-md font-semibold transition-all duration-300 ${
                  scrolled ? 'text-on-surface-variant' : 'text-white keep-white'
                } hover:text-primary`}
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            )}

            <Link
              to="/daftar-agen"
              className="hidden lg:flex items-center gap-2 px-5 py-2.5 gradient-primary rounded-lg font-body text-body-md font-semibold text-surface hover:shadow-neon-cyan transition-all duration-300"
            >
              <ShoppingBag className="w-4 h-4" />
              Jadi Agen
            </Link>

            {/* Mobile menu toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-10 h-10 rounded-lg glass-card flex items-center justify-center text-white"
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
    </>
  );
};

export default Navbar;
