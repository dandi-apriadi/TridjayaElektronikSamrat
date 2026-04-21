import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  LayoutDashboard, 
  Users, 
  Package, 
  Ticket, 
  BarChart3, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Sun,
  Moon,
  Headphones,
  BookOpen,
  Wallet,
  Shield
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import logoPng from '../../assets/images/logo.png';

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
        { label: 'Agent Network', icon: Users, path: '/dashboard/admin/agents' },
        { label: 'Catalog Central', icon: Package, path: '/dashboard/admin/catalog' },
        { label: 'Promos', icon: Ticket, path: '/dashboard/admin/promo' },
        { label: 'Telemetry', icon: BarChart3, path: '/dashboard/admin/telemetry' },
        { label: 'User Access', icon: Shield, path: '/dashboard/admin/users' },
      ]
    : [
        { label: 'Command Center', icon: LayoutDashboard, path: '/dashboard/agent' },
        { label: 'Product Knowledge', icon: BookOpen, path: '/dashboard/agent/knowledge' },
        { label: 'My Leads', icon: Users, path: '/dashboard/agent/leads' },
        { label: 'Earnings', icon: Wallet, path: '/dashboard/agent/earnings' },
        { label: 'Support', icon: Headphones, path: '/dashboard/agent/support' },
      ];

  const activeItem = navItems.find((item) =>
    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );
  const notificationsPath = user?.role === 'admin' ? '/dashboard/admin/telemetry' : '/dashboard/agent/support';

  return (
    <div className="min-h-screen bg-surface flex text-on-surface">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="fixed left-0 top-0 bottom-0 z-40 bg-surface-low border-r border-outline-variant/20 flex flex-col"
      >
        {/* Brand */}
        <div className="h-20 flex items-center px-6 gap-4 overflow-hidden border-b border-outline-variant/10">
          <img src={logoPng} alt="Tridjaya Samrat" className="h-12 w-auto max-w-full object-contain" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all group relative ${
                  isActive 
                    ? 'gradient-primary text-on-primary shadow-neon-cyan-sm' 
                    : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
                {isSidebarOpen && (
                  <span className="font-body text-body-md font-semibold truncate">{item.label}</span>
                )}
                {/* Tooltip for collapsed sidebar */}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-4 px-3 py-1 bg-surface-highest text-white text-label-md rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
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
            className="w-full flex items-center gap-4 p-3 rounded-xl text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-all"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {isSidebarOpen && <span className="font-body text-body-md font-semibold">Collapse Sidebar</span>}
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 rounded-xl text-error hover:bg-error/10 transition-all font-body text-body-md font-bold"
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
        <header className="h-20 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10 px-8 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h2 className="font-display text-title-lg font-bold text-on-surface">
              {activeItem?.label || 'Dashboard'}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <Link
              to={notificationsPath}
              className="w-10 h-10 rounded-xl glass-card flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors relative"
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
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-outline-variant/30">
                <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <div className="p-8 flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
