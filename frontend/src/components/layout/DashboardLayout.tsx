import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Ticket, 
  BarChart3,
  BarChart2,
  FlaskConical,
  Trophy,
  LogOut, 
  Menu, 
  X,
  Bell,
  Sun,
  Moon,
  MessageCircle,
  Share2,
  Headphones,
  BookOpen,
  Wallet,
  Shield,
  UserCheck,
  Send,
  FileText,
  FileCheck2,
  ExternalLink,
  TrendingUp,
  Handshake,
  Briefcase,
  Images,
  Award,
  Building2,
  CalendarDays,
  ClipboardList,
  Database,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useUIPreferenceStore } from '../../store/useUIPreferenceStore';
import { useDashboardNotificationsStore } from '../../store/useDashboardNotificationsStore';
import { toast } from '../../store/useNotificationStore';
import { canAccessDashboardPath, getDashboardHomeByRole } from '../../utils/dashboardAccess';
import { isAdminSalesRole } from '../../utils/roles';
import logoPng from '../../assets/images/logo.webp';

const DashboardLayout: React.FC = () => {
  const { 
    isSidebarOpen, 
    toggleSidebar, 
    collapsedSections, 
    toggleSection 
  } = useUIPreferenceStore();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { unreadCount, fetchUnreadCount, clear: clearDashboardNotifications } = useDashboardNotificationsStore();
  const location = useLocation();
  const navigate = useNavigate();
  const previousUnreadRef = React.useRef<number | null>(null);
  const isAdminSales = isAdminSalesRole(user?.role);

  // Detect mobile view for logic branching
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu when route changes
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!user?.id) {
      previousUnreadRef.current = null;
      clearDashboardNotifications();
      return;
    }

    let isMounted = true;
    const syncUnread = async () => {
      const count = await fetchUnreadCount();
      if (!isMounted) {
        return;
      }

      if (previousUnreadRef.current !== null && count > previousUnreadRef.current) {
        toast.info('Notifikasi baru', 'Ada pesan baru yang belum dibaca.');
      }
      previousUnreadRef.current = count;
    };

    void syncUnread();
    const intervalId = window.setInterval(() => {
      void syncUnread();
    }, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id, fetchUnreadCount, clearDashboardNotifications]);

  React.useEffect(() => {
    if (!user?.role) return;

    const path = location.pathname;
    const redirectTo = canAccessDashboardPath(user.role, path)
      ? null
      : getDashboardHomeByRole(user.role);

    if (redirectTo && redirectTo !== path) {
      navigate(redirectTo, { replace: true });
    }
  }, [location.pathname, navigate, user?.role]);

  const handleLogout = () => {
    clearDashboardNotifications();
    logout();
    navigate('/login');
  };

  const activeItemPath = location.pathname;

  const adminSections = React.useMemo(() => [
    {
      title: 'Utama',
      items: [
        { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/admin' },
        { label: 'Telemetri', icon: BarChart3, path: '/dashboard/admin/telemetry' },
        { label: 'Pixel Analytics', icon: TrendingUp, path: '/dashboard/admin/pixel-analytics' },
      ]
    },
    {
      title: 'Agen & Jaringan',
      items: [
        { label: 'Registrasi Agen', icon: UserCheck, path: '/dashboard/admin/agents' },
        { label: 'Direktori Agen', icon: Users, path: '/dashboard/admin/agents/directory' },
        { label: 'Leaderboard', icon: Trophy, path: '/dashboard/admin/leaderboard' },
      ]
    },
    {
      title: 'Operasional',
      items: [
        { label: 'Manajemen Prospek', icon: TrendingUp, path: '/dashboard/admin/leads' },
        { label: 'Manajemen Karier', icon: Briefcase, path: '/dashboard/admin/careers' },
        { label: 'WhatsApp Blast', icon: MessageCircle, path: '/dashboard/admin/wa/campaigns' },
        { label: 'Pixel Campaigns', icon: BarChart2, path: '/dashboard/admin/pixel-campaigns' },
        { label: 'Pixel Tester', icon: FlaskConical, path: '/dashboard/admin/pixel-tester' },
        { label: 'Support Ticket', icon: Headphones, path: '/dashboard/admin/support' },
      ]
    },
    {
      title: 'Katalog & Konten',
      items: [
        { label: 'Katalog Produk', icon: Package, path: '/dashboard/admin/catalog' },
        { label: 'Kategori Produk', icon: BookOpen, path: '/dashboard/admin/categories' },
        { label: 'Promo & Campaign', icon: Ticket, path: '/dashboard/admin/promo' },
        { label: 'Konten & Blog', icon: FileText, path: '/dashboard/admin/content' },
        { label: 'Landing Slides', icon: Images, path: '/dashboard/admin/content/landing-slides' },
        { label: 'Partner Brand', icon: Handshake, path: '/dashboard/admin/partners' },
      ]
    },
    {
      title: 'Sistem',
      items: [
        { label: 'Keuangan', icon: Wallet, path: '/dashboard/admin/finance' },
        { label: 'User & Akses', icon: Shield, path: '/dashboard/admin/users' },
        { label: 'Sales Management', icon: Share2, path: '/dashboard/admin/sales' },
        { label: 'Cabang Management', icon: Building2, path: '/dashboard/admin/cabang' },
        { label: 'Pengaturan Akun', icon: Shield, path: '/dashboard/settings' },
      ]
    }
  ], []);

  const agentSections = React.useMemo(() => [
    {
      title: 'Dashboard',
      items: [
        { label: 'Command Center', icon: LayoutDashboard, path: '/dashboard/agent' },
        { label: 'Leaderboard', icon: Trophy, path: '/dashboard/agent/leaderboard' },
      ]
    },
    {
      title: 'Penjualan',
      items: [
        { label: 'Product Knowledge', icon: BookOpen, path: '/dashboard/agent/knowledge' },
        { label: 'Pipeline Prospek', icon: Users, path: '/dashboard/agent/leads' },
        { label: 'Push Prospek', icon: Send, path: '/dashboard/agent/push-prospek' },
        { label: 'Pixel Analytics', icon: BarChart3, path: '/dashboard/agent/pixel-analytics' },
      ]
    },
    {
      title: 'Akun & Bantuan',
      items: [
        { label: 'Komisi & Penarikan', icon: Wallet, path: '/dashboard/agent/earnings' },
        { label: 'Support', icon: Headphones, path: '/dashboard/agent/support' },
        { label: 'Pengaturan', icon: Shield, path: '/dashboard/settings' },
      ]
    }
  ], []);

  const salesSections = React.useMemo(() => [
    {
      title: 'Dashboard',
      items: [
        { label: 'Command Center', icon: LayoutDashboard, path: '/dashboard/sales' },
        { label: 'Product Knowledge', icon: BookOpen, path: '/dashboard/sales/knowledge' },
      ]
    },
    {
      title: 'Operasional',
      items: [
        { label: 'Jadwal Pengiriman', icon: Send, path: '/dashboard/sales/delivery' },
        { label: 'Pengiriman Prospek', icon: TrendingUp, path: '/dashboard/sales/push-prospek' },
        { label: 'Pixel Analytics', icon: BarChart3, path: '/dashboard/sales/pixel-analytics' },
      ]
    },
    {
      title: 'WhatsApp Blast',
      items: [
        { label: 'Campaigns', icon: MessageCircle, path: '/dashboard/admin/wa/campaigns' },
        { label: 'Akun WA', icon: Shield, path: '/dashboard/admin/wa/accounts' },
        { label: 'Kontak Blast', icon: Users, path: '/dashboard/admin/wa/blast-contacts' },
      ]
    },
    {
      title: 'Akun & Bantuan',
      items: [
        { label: 'Pengaturan', icon: Shield, path: '/dashboard/settings' },
        { label: 'Support', icon: Headphones, path: '/dashboard/sales/support' },
      ]
    }
  ], []);

  const operatorSections = React.useMemo(() => [
    {
      title: 'Katalog & Konten',
      items: [
        { label: 'Katalog Produk', icon: Package, path: '/dashboard/admin/catalog' },
        { label: 'Kategori Produk', icon: BookOpen, path: '/dashboard/admin/categories' },
        { label: 'Promo & Campaign', icon: Ticket, path: '/dashboard/admin/promo' },
        { label: 'Konten & Blog', icon: FileText, path: '/dashboard/admin/content' },
        { label: 'Landing Slides', icon: Images, path: '/dashboard/admin/content/landing-slides' },
        { label: 'Partner Brand', icon: Handshake, path: '/dashboard/admin/partners' },
      ]
    },
    {
      title: 'WhatsApp Blast',
      items: [
        { label: 'Campaigns', icon: MessageCircle, path: '/dashboard/admin/wa/campaigns' },
        { label: 'Akun WA', icon: Shield, path: '/dashboard/admin/wa/accounts' },
        { label: 'Kontak Blast', icon: Users, path: '/dashboard/admin/wa/blast-contacts' },
      ]
    },
    {
      title: 'Pixel Campaign',
      items: [
        { label: 'Campaigns', icon: BarChart2, path: '/dashboard/admin/pixel-campaigns' },
        { label: 'Pixel Analytics', icon: TrendingUp, path: '/dashboard/admin/pixel-analytics' },
        { label: 'Pixel Tester', icon: FlaskConical, path: '/dashboard/admin/pixel-tester' },
      ]
    },
    {
      title: 'Akun',
      items: [
        { label: 'Pengaturan Akun', icon: Shield, path: '/dashboard/settings' },
      ]
    },
  ], []);

  const ownerSections = React.useMemo(() => [
    {
      title: 'Dashboard',
      items: [
        { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/owner' },
      ]
    },
    {
      title: 'Monitoring',
      items: [
        { label: 'Prospek & Closing', icon: Users, path: '/dashboard/owner/prospek' },
        { label: 'Raport Jobdesk', icon: BookOpen, path: '/dashboard/owner/raport' },
        { label: 'Omset Per Cabang', icon: BarChart3, path: '/dashboard/owner/omset-cabang' },
        { label: 'Omset Realtime', icon: TrendingUp, path: '/dashboard/owner/omset-realtime' },
        { label: 'Target vs Actual', icon: BarChart2, path: '/dashboard/owner/target-actual' },
        { label: 'Top 10 Sales', icon: Trophy, path: '/dashboard/owner/top-sales' },
        { label: 'Top 10 Non-Sales', icon: Award, path: '/dashboard/owner/top-nonsales' },
      ]
    },
    {
      title: 'Akun',
      items: [
        { label: 'Pengaturan Akun', icon: Shield, path: '/dashboard/settings' },
      ]
    },
  ], []);

  const picRaportSections = React.useMemo(() => [
    {
      title: 'PIC Raport',
      items: [
        { label: 'Review Hari Ini', icon: FileCheck2, path: '/dashboard/pic-raport' },
        { label: 'History Upload', icon: CalendarDays, path: '/dashboard/pic-raport/history' },
        { label: 'Master Jobdesk', icon: ClipboardList, path: '/dashboard/pic-raport/master' },
        { label: 'Pengaturan Akun', icon: Shield, path: '/dashboard/settings' },
      ]
    },
  ], []);

  const karyawanSections = React.useMemo(() => [
    {
      title: 'Dashboard',
      items: [
        { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/karyawan' },
      ]
    },
    {
      title: 'Aktivitas',
      items: [
        { label: 'Submit Prospek', icon: Send, path: '/dashboard/karyawan/prospek' },
        { label: 'Database Prospek', icon: Database, path: '/dashboard/karyawan/prospek/database' },
        { label: 'Raport Harian', icon: BookOpen, path: '/dashboard/karyawan/raport' },
        { label: 'History Raport', icon: CalendarDays, path: '/dashboard/karyawan/raport/history' },
        { label: 'Pengaturan Akun', icon: Shield, path: '/dashboard/settings' },
      ]
    },
  ], []);

  const navSections = user?.role === 'admin' ? adminSections
    : user?.role === 'owner' ? ownerSections
    : user?.role === 'pic_raport' ? picRaportSections
    : user?.role === 'karyawan' ? karyawanSections
    : user?.role === 'operator' ? operatorSections
    : isAdminSales ? salesSections
    : agentSections;

  const toggleSectionHandler = (title: string) => {
    toggleSection(title);
  };

  const quickActions = (user?.role === 'admin' || user?.role === 'operator')
    ? [
        { label: 'Produk', icon: Package, path: '/dashboard/admin/catalog', color: 'text-primary' },
        ...(user?.role === 'admin' ? [{ label: 'Agen', icon: UserCheck, path: '/dashboard/admin/agents', color: 'text-secondary' }] : []),
        ...(user?.role === 'admin' ? [{ label: 'Finance', icon: Wallet, path: '/dashboard/admin/finance', color: 'text-tertiary' }] : []),
        ...(user?.role === 'operator' ? [{ label: 'WA Blast', icon: MessageCircle, path: '/dashboard/admin/wa/campaigns', color: 'text-secondary' }] : []),
        ...(user?.role === 'operator' ? [{ label: 'Pixel', icon: BarChart2, path: '/dashboard/admin/pixel-campaigns', color: 'text-tertiary' }] : []),
      ]
    : user?.role === 'owner'
    ? []
    : user?.role === 'pic_raport'
    ? [
        { label: 'Review', icon: FileCheck2, path: '/dashboard/pic-raport', color: 'text-primary' },
        { label: 'History', icon: CalendarDays, path: '/dashboard/pic-raport/history', color: 'text-secondary' },
        { label: 'Master', icon: ClipboardList, path: '/dashboard/pic-raport/master', color: 'text-tertiary' },
      ]
    : user?.role === 'karyawan'
    ? []
    : [
        { label: 'Knowledge', icon: BookOpen, path: isAdminSales ? '/dashboard/sales/knowledge' : '/dashboard/agent/knowledge', color: 'text-primary' },
        { label: 'Prospek', icon: TrendingUp, path: isAdminSales ? '/dashboard/sales/push-prospek' : '/dashboard/agent/push-prospek', color: 'text-secondary' },
        ...(isAdminSales ? [{ label: 'WA Blast', icon: MessageCircle, path: '/dashboard/admin/wa/campaigns', color: 'text-tertiary' }] : []),
      ];

  const allNavItems = navSections.flatMap(s => s.items);
  const activeItem = allNavItems.find((item) => activeItemPath === item.path);
  const notificationsPath = (user?.role === 'admin' || user?.role === 'operator')
    ? '/dashboard/admin/notifications'
    : isAdminSales
      ? '/dashboard/sales/notifications'
      : user?.role === 'pic_raport'
        ? '/dashboard/pic-raport'
        : user?.role === 'karyawan'
          ? '/dashboard/karyawan'
      : '/dashboard/agent/notifications';

  const avatarInitial = (user?.name?.trim() || user?.email?.trim() || '?').charAt(0).toUpperCase();

  // Removed auto-expand effect to respect user's persistent choices

  return (
    <div className="h-screen bg-surface flex text-on-surface relative overflow-hidden page-shell">
      {/* Decorative Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="bg-blob bg-primary/20 -top-24 -left-24 animate-[blob-float_25s_infinite_ease-in-out]" />
         <div className="bg-blob bg-secondary/20 top-1/2 -right-24 animate-[blob-float_30s_infinite_ease-in-out_reverse]" />
         <div className="bg-blob bg-tertiary/20 -bottom-24 left-1/4 animate-[blob-float_20s_infinite_ease-in-out_alternate]" />
      </div>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isMobile ? 280 : (isSidebarOpen ? 280 : 80),
          x: isMobile ? (isMobileMenuOpen ? 0 : -280) : 0,
          opacity: 1 
        }}
        transition={{ type: 'spring', stiffness: 240, damping: 30 }}
        className="fixed lg:relative lg:flex-shrink-0 left-0 top-0 bottom-0 z-[70] bg-surface-low/95 border-r border-outline-variant/20 flex flex-col backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.18)] h-full"
      >
        {/* Brand */}
        <div className="h-20 flex-shrink-0 flex items-center px-6 gap-4 overflow-hidden border-b border-outline-variant/10">
          <img src={logoPng} alt="Tridjaya Group" className="h-12 w-auto max-w-full object-contain" />
          {isMobile && (
            <button onClick={() => setMobileMenuOpen(false)} className="ml-auto p-2 rounded-lg bg-surface-high hover:bg-surface-highest transition-colors">
              <X className="w-6 h-6 text-on-surface-variant" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
          {navSections.map((section) => {
            const isCollapsed = collapsedSections[section.title];

            return (
              <div key={section.title} className="space-y-1">
                {(isSidebarOpen || isMobile) && (
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSectionHandler(section.title); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-label-sm font-bold text-on-surface-variant/60 uppercase tracking-widest hover:text-on-surface transition-colors group"
                  >
                    <span>{section.title}</span>
                    {isCollapsed ? <ChevronRight className="w-3 h-3 transition-transform" /> : <ChevronDown className="w-3 h-3 transition-transform" />}
                  </button>
                )}
                
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={ (isSidebarOpen || isMobile) ? { height: 0, opacity: 0 } : false}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="space-y-1 overflow-hidden"
                    >
                      {section.items.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        
                        return (
                          <Link 
                            key={item.path} 
                            to={item.path}
                            title={!isSidebarOpen && !isMobile ? item.label : undefined}
                            className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative ${
                              isActive 
                                ? 'bg-primary/10 border border-primary/40 text-primary shadow-sm shadow-primary/5' 
                                : 'text-on-surface-variant hover:bg-surface-high/50 hover:text-on-surface border border-transparent'
                            }`}
                          >
                            <Icon className={`w-5 h-5 flex-shrink-0 transition-transform ${isActive ? 'text-primary' : 'group-hover:scale-110'}`} />
                            {(isSidebarOpen || isMobile) && (
                              <span className="font-body text-body-md font-semibold truncate">{item.label}</span>
                            )}
                            {isActive && (isSidebarOpen || isMobile) && (
                              <motion.div 
                                layoutId="active-nav-indicator"
                                className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                              />
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Visual separator if sidebar is collapsed (compact mode) */}
                {!isSidebarOpen && !isMobile && (
                  <div className="h-px bg-outline-variant/10 mx-2 my-4" />
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="flex-shrink-0 p-4 border-t border-outline-variant/10 space-y-2">
          {!isMobile && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSidebar(); }}
              className="w-full items-center gap-4 p-3 rounded-lg text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-all hidden lg:flex"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              {isSidebarOpen && <span className="font-body text-body-md font-semibold">Collapse Sidebar</span>}
            </button>
          )}
          
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
            className="w-full flex items-center gap-4 p-3 rounded-lg text-error hover:bg-error/10 transition-all font-body text-body-md font-bold"
          >
            <LogOut className="w-5 h-5" />
            {(isSidebarOpen || isMobile) && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Top Header */}
        <motion.header
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="h-20 flex-shrink-0 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10 px-4 md:px-8 flex items-center justify-between z-30"
        >
           <div className="flex items-center gap-4">
             {/* Mobile Menu Toggle */}
             <button 
               onClick={() => setMobileMenuOpen(true)}
               className="lg:hidden p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-on-surface transition-all"
             >
               <Menu className="w-6 h-6" />
             </button>
             <h2 className="font-display text-title-md md:text-title-lg font-bold text-on-surface truncate">
               {activeItem?.label || 'Dashboard'}
             </h2>
           </div>

          {/* Quick Actions - Desktop View */}
          <div className="hidden xl:flex items-center gap-3 bg-surface-low/40 px-4 py-2 rounded-2xl border border-outline-variant/10">
            <span className="font-body text-label-sm font-bold text-on-surface-variant uppercase tracking-widest mr-2">Quick Access:</span>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.path}
                  to={action.path}
                  className="flex items-center gap-2 pr-4 pl-2 py-1.5 rounded-xl glass-card border border-outline-variant/10 hover:border-primary/40 hover:shadow-neon-cyan-sm transition-all duration-300 group"
                >
                  <div className={`p-1 rounded-lg bg-surface-high group-hover:bg-primary/20 transition-colors ${action.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-body text-body-sm font-bold text-on-surface-variant group-hover:text-on-surface whitespace-nowrap">
                    {action.label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Link 
              to="/"
              className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-outline-variant/10 hover:border-primary/40 hover:text-primary transition-all duration-300"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="font-body text-body-sm font-bold whitespace-nowrap">Landing Page</span>
            </Link>
            
            <div className="h-6 w-px bg-outline-variant/20 mx-1 hidden lg:block" />

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all hover:bg-surface-high"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <Link
              to={notificationsPath}
              className="hidden sm:flex w-10 h-10 rounded-lg glass-card items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative"
              aria-label="Buka notifikasi"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-primary text-on-primary text-[10px] font-bold border border-surface flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <button 
              onClick={handleLogout}
              className="w-10 h-10 rounded-lg glass-card flex items-center justify-center text-error hover:bg-error/10 transition-all"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            
            <div className="h-10 w-px bg-outline-variant/20 mx-2 hidden sm:block" />
            
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden md:block">
                <div className="font-body text-body-sm font-bold text-on-surface truncate max-w-[120px]">{user?.name}</div>
                <div className="font-body text-label-sm text-primary uppercase tracking-widest">{user?.role}</div>
              </div>
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-outline-variant/30 flex-shrink-0 bg-primary/10 text-primary">
                <div className="grid h-full w-full place-items-center text-label-md font-black">
                  {avatarInitial}
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Scrollable content area */}
        <div id="dashboard-content" className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0">
          {/* Force-change-password banner */}
          {user?.must_change_password && (
            <div className="px-4 md:px-8 pt-4">
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-on-surface">Anda perlu mengganti password.</p>
                  <p className="text-body-sm text-on-surface-variant">
                    Demi keamanan, atur password baru Anda di halaman pengaturan akun.
                  </p>
                </div>
                <Link
                  to="/dashboard/settings?force=password"
                  className="text-label-md font-bold text-amber-400 hover:text-amber-300 whitespace-nowrap"
                >
                  Ganti sekarang
                </Link>
              </div>
            </div>
          )}

          {/* Content Outlet */}
          <div className="p-4 md:p-8 relative z-10">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
