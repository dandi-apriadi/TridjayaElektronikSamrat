import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Menu, X, ChevronDown, Zap, ShoppingBag } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import logoPng from '../../assets/images/logo.webp';

const navItems = [
  { label: 'Beranda', href: '/' },
  {
    label: 'Produk',
    href: '#',
    children: [
      { label: 'Sepeda Listrik', href: '/produk/bike', icon: '⚡' },
      { label: 'Elektronik & Furnitur', href: '/produk/home', icon: '🏠' },
    ],
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
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdown(null);
  }, [location]);

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'glass-premium'
            : 'bg-transparent'
        }`}
        style={{ height: '72px' }}
      >
        <div className="container-custom flex items-center justify-between h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img src={logoPng} alt="Tridjaya Samrat Logo" className="h-14 w-auto object-contain" />
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setActiveDropdown(item.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                {item.children ? (
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
                      className={`flex items-center gap-1 px-4 py-2 rounded-lg font-body text-body-md font-medium transition-all duration-200 ${
                        location.pathname.startsWith('/produk')
                          ? 'text-primary'
                          : 'text-on-surface-variant hover:text-on-surface'
                      } hover:bg-surface-high`}
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
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 mt-2 w-56 glass-premium rounded-xl overflow-hidden"
                        >
                          {item.children.map((child) => (
                            <Link
                              key={child.label}
                              to={child.href}
                              className="flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:text-white hover:bg-surface-highest transition-all duration-150"
                            >
                              <span className="text-lg">{child.icon}</span>
                              <span className="font-body text-body-md font-medium">{child.label}</span>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <Link
                    to={item.href}
                    className={`px-4 py-2 rounded-lg font-body text-body-md font-medium transition-all duration-200 ${
                      location.pathname === item.href
                        ? 'text-primary bg-surface-high'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
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
              className="w-10 h-10 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors duration-200"
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
              <div className="flex flex-col gap-1">
                {navItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {item.children ? (
                      <div>
                        <div className="px-4 py-3 text-on-surface-variant font-body text-title-sm font-semibold uppercase tracking-widest text-xs">
                          {item.label}
                        </div>
                        {item.children.map((child) => (
                          <Link
                            key={child.label}
                            to={child.href}
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
              <div className="mt-auto">
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
