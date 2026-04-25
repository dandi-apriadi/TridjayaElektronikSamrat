import React, { Suspense, lazy, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import { useTelemetryTracker } from './store/useTelemetryTracker';

import { NotificationContainer } from './components/ui/Notification';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { useProductStore } from './store/useProductStore';
import { usePromoStore } from './store/usePromoStore';
import { useBlogStore } from './store/useBlogStore';

const BikesCatalogPage = lazy(() => import('./pages/BikesCatalogPage'));
const HomeCatalogPage = lazy(() => import('./pages/HomeCatalogPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const ArticleDetailPage = lazy(() => import('./pages/ArticleDetailPage'));
const PromoPage = lazy(() => import('./pages/PromoPage'));
const PromoDetailPage = lazy(() => import('./pages/PromoDetailPage'));
const CareerPage = lazy(() => import('./pages/CareerPage'));
const TentangPage = lazy(() => import('./pages/TentangPage'));
const AgencyRegistrationPage = lazy(() => import('./pages/AgencyRegistrationPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));

const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const AgentDashboard = lazy(() => import('./pages/dashboard/AgentDashboard'));
const AdminAgentsPage = lazy(() => import('./pages/dashboard/AdminAgentsPage'));
const AdminCatalogPage = lazy(() => import('./pages/dashboard/AdminCatalogPage'));
const AdminPromoPage = lazy(() => import('./pages/dashboard/AdminPromoPage'));
const AdminTelemetryPage = lazy(() => import('./pages/dashboard/AdminTelemetryPage'));
const AdminUsersPage = lazy(() => import('./pages/dashboard/AdminUsersPage'));
const AgentKnowledgePage = lazy(() => import('./pages/dashboard/AgentKnowledgePage'));
const AgentLeadsPage = lazy(() => import('./pages/dashboard/AgentLeadsPage'));
const AgentEarningsPage = lazy(() => import('./pages/dashboard/AgentEarningsPage'));
const AgentSupportPage = lazy(() => import('./pages/dashboard/AgentSupportPage'));
const AdminAgentDirectoryPage = lazy(() => import('./pages/dashboard/AdminAgentDirectoryPage'));
const AdminFinancePage = lazy(() => import('./pages/dashboard/AdminFinancePage'));
const AdminContentPage = lazy(() => import('./pages/dashboard/AdminContentPage'));
const AdminFormPage = lazy(() => import('./pages/dashboard/AdminFormPage'));
const AdminProductFormPage = lazy(() => import('./pages/dashboard/AdminProductFormPage'));
const AdminPromoFormPage = lazy(() => import('./pages/dashboard/AdminPromoFormPage'));
const AdminArticleFormPage = lazy(() => import('./pages/dashboard/AdminArticleFormPage'));
const AgentPushProspekPage = lazy(() => import('./pages/dashboard/AgentPushProspekPage'));
const AdminLeaderboardPage = lazy(() => import('./pages/dashboard/AdminLeaderboardPage'));
const AgentLeaderboardPage = lazy(() => import('./pages/dashboard/AgentLeaderboardPage'));

const RouteLoading: React.FC = () => (
  <div className="min-h-[40vh] w-full grid place-items-center px-4">
    <div className="glass-card rounded-xl px-5 py-3 text-label-sm text-on-surface-variant">
      Memuat halaman...
    </div>
  </div>
);

// Protected Route Component
const PrivateRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();
 
  if (isInitializing) return <RouteLoading />;
 
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
 
  return children;
};
 
// Role-based Guard for individual subroutes
const RoleGuard: React.FC<{ children: React.ReactElement; role: 'admin' | 'agent' }> = ({ children, role }) => {
  const { user, isInitializing } = useAuthStore();
  
  if (isInitializing) return <RouteLoading />;
 
  if (user?.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
 
  return children;
};

// Dashboard Root (Redirects based on role)
const DashboardRoot = () => {
  const { user } = useAuthStore();
  return <Navigate to={user?.role === 'admin' ? '/dashboard/admin' : '/dashboard/agent'} replace />;
};

// Scroll to top and track telemetry on route change
const RouteListener = () => {
  const { pathname } = useLocation();
  useTelemetryTracker();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
};

const App: React.FC = () => {
  const { setTheme } = useThemeStore();

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('tridjaya-theme');
    if (savedTheme) {
      const parsed = JSON.parse(savedTheme);
      setTheme(parsed.state.theme);
    } else {
      setTheme('dark');
    }
    
    // Restore session from HttpOnly cookies (if available)
    useAuthStore.getState().restoreSession();
    
    // Fetch initial product, promo, and blog data
    useProductStore.getState().fetchProducts();
    usePromoStore.getState().fetchPromos();
    useBlogStore.getState().fetchPosts();
  }, [setTheme]);

  return (
    <Router>
      <RouteListener />
      <NotificationContainer />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="produk/bike" element={<BikesCatalogPage />} />
          <Route path="produk/home" element={<HomeCatalogPage />} />
          <Route path="produk/:slug" element={<ProductDetailPage />} />
          <Route path="promo" element={<PromoPage />} />
          <Route path="promo/:id" element={<PromoDetailPage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="blog/:slug" element={<ArticleDetailPage />} />
          <Route path="karier" element={<CareerPage />} />
          <Route path="tentang" element={<TentangPage />} />
          <Route path="daftar-agen" element={<AgencyRegistrationPage />} />
          <Route path="kebijakan-privasi" element={<PrivacyPolicyPage />} />
          <Route path="syarat-layanan" element={<TermsOfServicePage />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              {lazyPage(DashboardLayout)}
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardRoot />} />
          <Route
            path="admin"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminDashboard)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/agents"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminAgentsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminCatalogPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog/new"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminProductFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog/edit/:id"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminProductFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/promo"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPromoPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/promo/new"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPromoFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/promo/edit/:id"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPromoFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content/new"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminArticleFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content/edit/:id"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminArticleFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/telemetry"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminTelemetryPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/users"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminUsersPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/users/new"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/users/edit/:id"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/agents/directory"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminAgentDirectoryPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/finance"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminFinancePage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminContentPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/leaderboard"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminLeaderboardPage)}
              </RoleGuard>
            }
          />


          <Route
            path="agent"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentDashboard)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/knowledge"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentKnowledgePage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/leads"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentLeadsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/earnings"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentEarningsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/support"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentSupportPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/push"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentPushProspekPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/leaderboard"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentLeaderboardPage)}
              </RoleGuard>
            }
          />

          <Route path="agen" element={<Navigate to="/dashboard/admin/agents" replace />} />
          <Route path="katalog" element={<Navigate to="/dashboard/admin/catalog" replace />} />
          <Route path="promo" element={<Navigate to="/dashboard/admin/promo" replace />} />
          <Route path="telemetri" element={<Navigate to="/dashboard/admin/telemetry" replace />} />
          {/* Fallback internal routes */}
          <Route path="*" element={<DashboardRoot />} />
        </Route>

        <Route
          path="/admin/users"
          element={
            <RoleGuard role="admin">
              <Navigate to="/dashboard/admin/users" replace />
            </RoleGuard>
          }
        />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
