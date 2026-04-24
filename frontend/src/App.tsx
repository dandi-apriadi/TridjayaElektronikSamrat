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

const lazyPage = (Page: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<RouteLoading />}>
    <Page />
  </Suspense>
);

// Protected Route Component
const PrivateRoute: React.FC<{ children: React.ReactElement; role?: 'admin' | 'agent' }> = ({ children, role }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user?.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Dashboard Root (Redirects based on role)
const DashboardRoot = () => {
  const { user } = useAuthStore();
  if (user?.role === 'admin') return <Navigate to="/dashboard/admin" replace />;
  return <Navigate to="/dashboard/agent" replace />;
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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="produk/bike" element={lazyPage(BikesCatalogPage)} />
          <Route path="produk/home" element={lazyPage(HomeCatalogPage)} />
          <Route path="produk/:slug" element={lazyPage(ProductDetailPage)} />
          <Route path="promo" element={lazyPage(PromoPage)} />
          <Route path="promo/:id" element={lazyPage(PromoDetailPage)} />
          <Route path="blog" element={lazyPage(BlogPage)} />
          <Route path="blog/:slug" element={lazyPage(ArticleDetailPage)} />
          <Route path="karier" element={lazyPage(CareerPage)} />
          <Route path="tentang" element={lazyPage(TentangPage)} />
          <Route path="daftar-agen" element={lazyPage(AgencyRegistrationPage)} />
          <Route path="kebijakan-privasi" element={lazyPage(PrivacyPolicyPage)} />
          <Route path="syarat-layanan" element={lazyPage(TermsOfServicePage)} />
        </Route>

        {/* Auth Routes */}
        <Route path="/login" element={lazyPage(LoginPage)} />
        <Route path="/forgot-password" element={lazyPage(ForgotPasswordPage)} />

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
              <PrivateRoute role="admin">
                {lazyPage(AdminDashboard)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/agents"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminAgentsPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/catalog"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminCatalogPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/catalog/new"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminProductFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/catalog/edit/:id"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminProductFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/promo"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminPromoPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/promo/new"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminPromoFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/promo/edit/:id"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminPromoFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/content/new"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminArticleFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/content/edit/:id"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminArticleFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/telemetry"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminTelemetryPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminUsersPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/users/new"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/users/edit/:id"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminFormPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/agents/directory"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminAgentDirectoryPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/finance"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminFinancePage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/content"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminContentPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="admin/leaderboard"
            element={
              <PrivateRoute role="admin">
                {lazyPage(AdminLeaderboardPage)}
              </PrivateRoute>
            }
          />


          <Route
            path="agent"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentDashboard)}
              </PrivateRoute>
            }
          />
          <Route
            path="agent/knowledge"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentKnowledgePage)}
              </PrivateRoute>
            }
          />
          <Route
            path="agent/leads"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentLeadsPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="agent/earnings"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentEarningsPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="agent/support"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentSupportPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="agent/push"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentPushProspekPage)}
              </PrivateRoute>
            }
          />
          <Route
            path="agent/leaderboard"
            element={
              <PrivateRoute role="agent">
                {lazyPage(AgentLeaderboardPage)}
              </PrivateRoute>
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
            <PrivateRoute role="admin">
              <Navigate to="/dashboard/admin/users" replace />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
