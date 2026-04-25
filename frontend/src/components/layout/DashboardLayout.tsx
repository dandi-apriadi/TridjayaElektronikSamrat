import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Ticket, 
  BarChart3, 
  Trophy,
  LogOut, 
  Menu, 
  X,
  Bell,
  Sun,
  Moon,
  Headphones,
  BookOpen,
  Wallet,
  Shield,
  UserCheck,
  Send,
  FileText,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import logoPng from '../../assets/images/logo.webp';

const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = user?.role === 'admin' 
    ? [
        { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/admin' },
        { label: 'Registrasi Agen', icon: UserCheck, path: '/dashboard/admin/agents' },
        { label: 'Direktori Agen', icon: Users, path: '/dashboard/admin/agents/directory' },
        { label: 'Katalog Produk', icon: Package, path: '/dashboard/admin/catalog' },
        { label: 'Promo & Campaign', icon: Ticket, path: '/dashboard/admin/promo' },
        { label: 'Konten & Blog', icon: FileText, path: '/dashboard/admin/content' },
        { label: 'Telemetri', icon: BarChart3, path: '/dashboard/admin/telemetry' },
        { label: 'Leaderboard', icon: Trophy, path: '/dashboard/admin/leaderboard' },
        { label: 'Keuangan', icon: Wallet, path: '/dashboard/admin/finance' },
        { label: 'User & Akses', icon: Shield, path: '/dashboard/admin/users' },
      ]
    : [
        { label: 'Command Center', icon: LayoutDashboard, path: '/dashboard/agent' },
        { label: 'Product Knowledge', icon: BookOpen, path: '/dashboard/agent/knowledge' },
        { label: 'Pipeline Prospek', icon: Users, path: '/dashboard/agent/leads' },
        { label: 'Push Prospek', icon: Send, path: '/dashboard/agent/push' },
        { label: 'Leaderboard', icon: Trophy, path: '/dashboard/agent/leaderboard' },
        { label: 'Komisi & Penarikan', icon: Wallet, path: '/dashboard/agent/earnings' },
        { label: 'Support', icon: Headphones, path: '/dashboard/agent/support' },
      ];

  const quickActions = user?.role === 'admin'
    ? [
        { label: 'Produk', icon: Package, path: '/dashboard/admin/catalog', color: 'text-primary' },
        { label: 'Agen', icon: UserCheck, path: '/dashboard/admin/agents', color: 'text-secondary' },
        { label: 'Finance', icon: Wallet, path: '/dashboard/admin/finance', color: 'text-tertiary' },
      ]
    : [
        { label: 'Knowledge', icon: BookOpen, path: '/dashboard/agent/knowledge', color: 'text-primary' },
        { label: 'Push', icon: Send, path: '/dashboard/agent/push', color: 'text-secondary' },
      ];

  const activeItem = navItems.find((item) => location.pathname === item.path);
  const notificationsPath = user?.role === 'admin' ? '/dashboard/admin/telemetry' : '/dashboard/agent/support';

  return (
    <div className="min-h-screen bg-surface flex text-on-surface relative overflow-hidden page-shell">
      {/* Decorative Background Blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="bg-blob bg-primary/20 -top-24 -left-24 animate-[blob-float_25s_infinite_ease-in-out]" />
         <div className="bg-blob bg-secondary/20 top-1/2 -right-24 animate-[blob-float_30s_infinite_ease-in-out_reverse]" />
         <div className="bg-blob bg-tertiary/20 -bottom-24 left-1/4 animate-[blob-float_20s_infinite_ease-in-out_alternate]" />
      </div>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="fixed left-0 top-0 bottom-0 z-40 bg-surface-low/95 border-r border-outline-variant/20 flex flex-col backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
      >
        {/* Brand */}
        <div className="h-20 flex items-center px-6 gap-4 overflow-hidden border-b border-outline-variant/10">
          <img src={logoPng} alt="Tridjaya Samrat" className="h-12 w-auto max-w-full object-contain" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-primary/10 border border-primary/40 text-primary shadow-sm shadow-primary/5' 
                    : 'text-on-surface-variant hover:bg-surface-high/50 hover:text-on-surface border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform ${isActive ? 'text-primary' : 'group-hover:scale-110'}`} />
                {isSidebarOpen && (
                  <span className="font-body text-body-md font-semibold truncate">{item.label}</span>
                )}
                {/* Tooltip for collapsed sidebar */}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1 bg-surface-highest text-white text-label-md rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-outline-variant/10 space-y-2">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-4 p-3 rounded-lg text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-all"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {isSidebarOpen && <span className="font-body text-body-md font-semibold">Collapse Sidebar</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-lg text-error hover:bg-error/10 transition-all font-body text-body-md font-bold"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className="flex-1 transition-all duration-300 flex flex-col"
        style={{ marginLeft: isSidebarOpen ? 280 : 80 }}
      >
        {/* Top Header */}
        <motion.header
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="h-20 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10 px-8 flex items-center justify-between sticky top-0 z-30"
        >
           <div>
             <h2 className="font-display text-title-lg font-bold text-on-surface">
               {activeItem?.label || 'Dashboard'}
             </h2>
           </div>
          {/* Quick Actions - Desktop View */}
          <div className="hidden lg:flex items-center gap-3 bg-surface-low/40 px-4 py-2 rounded-2xl border border-outline-variant/10">
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

          <div className="flex items-center gap-4">
            <Link 
              to="/"
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-outline-variant/10 hover:border-primary/40 hover:text-primary transition-all duration-300"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="font-body text-body-sm font-bold">Landing Page</span>
            </Link>
            
            <div className="h-6 w-px bg-outline-variant/20 mx-1 hidden md:block" />

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-all hover:bg-surface-high"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <Link
              to={notificationsPath}
              className="w-10 h-10 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative"
              aria-label="Buka notifikasi"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-surface" />
            </Link>
            
            <div className="h-10 w-px bg-outline-variant/20 mx-2" />
            
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <div className="font-body text-body-sm font-bold text-on-surface">{user?.name}</div>
                <div className="font-body text-label-sm text-primary uppercase tracking-widest">{user?.role}</div>
              </div>
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-outline-variant/30">
                <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </motion.header>

        {/* Content Outlet */}
        <div className="p-8 flex-1 relative z-10">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
