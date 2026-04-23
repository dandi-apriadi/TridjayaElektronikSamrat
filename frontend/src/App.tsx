import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import BikesCatalogPage from './pages/BikesCatalogPage';
import HomeCatalogPage from './pages/HomeCatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import BlogPage from './pages/BlogPage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import PromoPage from './pages/PromoPage';
import PromoDetailPage from './pages/PromoDetailPage';
import CareerPage from './pages/CareerPage';
import TentangPage from './pages/TentangPage';
import AgencyRegistrationPage from './pages/AgencyRegistrationPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardLayout from './components/layout/DashboardLayout';
import AdminDashboard from './pages/dashboard/AdminDashboard';
import AgentDashboard from './pages/dashboard/AgentDashboard';
import AdminAgentsPage from './pages/dashboard/AdminAgentsPage';
import AdminCatalogPage from './pages/dashboard/AdminCatalogPage';
import AdminPromoPage from './pages/dashboard/AdminPromoPage';
import AdminTelemetryPage from './pages/dashboard/AdminTelemetryPage';
import AdminUsersPage from './pages/dashboard/AdminUsersPage';
import AgentKnowledgePage from './pages/dashboard/AgentKnowledgePage';
import AgentLeadsPage from './pages/dashboard/AgentLeadsPage';
import AgentEarningsPage from './pages/dashboard/AgentEarningsPage';
import AgentSupportPage from './pages/dashboard/AgentSupportPage';
import AdminAgentDirectoryPage from './pages/dashboard/AdminAgentDirectoryPage';
import AdminFinancePage from './pages/dashboard/AdminFinancePage';
import AdminContentPage from './pages/dashboard/AdminContentPage';
import AdminFormPage from './pages/dashboard/AdminFormPage';
import AdminProductFormPage from './pages/dashboard/AdminProductFormPage';
import AdminPromoFormPage from './pages/dashboard/AdminPromoFormPage';
import AdminArticleFormPage from './pages/dashboard/AdminArticleFormPage';
import AgentPushProspekPage from './pages/dashboard/AgentPushProspekPage';
import AdminLeaderboardPage from './pages/dashboard/AdminLeaderboardPage';
import AgentLeaderboardPage from './pages/dashboard/AgentLeaderboardPage';

import { NotificationContainer } from './components/ui/Notification';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { useProductStore } from './store/useProductStore';
import { usePromoStore } from './store/usePromoStore';
import { useBlogStore } from './store/useBlogStore';
import { Navigate } from 'react-router-dom';

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

import { useTelemetryTracker } from './store/useTelemetryTracker';

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
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardRoot />} />
          <Route
            path="admin"
            element={
              <PrivateRoute role="admin">
                <AdminDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/agents"
            element={
              <PrivateRoute role="admin">
                <AdminAgentsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/catalog"
            element={
              <PrivateRoute role="admin">
                <AdminCatalogPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/catalog/new"
            element={
              <PrivateRoute role="admin">
                <AdminProductFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/catalog/edit/:id"
            element={
              <PrivateRoute role="admin">
                <AdminProductFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/promo"
            element={
              <PrivateRoute role="admin">
                <AdminPromoPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/promo/new"
            element={
              <PrivateRoute role="admin">
                <AdminPromoFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/promo/edit/:id"
            element={
              <PrivateRoute role="admin">
                <AdminPromoFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/content/new"
            element={
              <PrivateRoute role="admin">
                <AdminArticleFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/content/edit/:id"
            element={
              <PrivateRoute role="admin">
                <AdminArticleFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/telemetry"
            element={
              <PrivateRoute role="admin">
                <AdminTelemetryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/users"
            element={
              <PrivateRoute role="admin">
                <AdminUsersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/users/new"
            element={
              <PrivateRoute role="admin">
                <AdminFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/users/edit/:id"
            element={
              <PrivateRoute role="admin">
                <AdminFormPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/agents/directory"
            element={
              <PrivateRoute role="admin">
                <AdminAgentDirectoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/finance"
            element={
              <PrivateRoute role="admin">
                <AdminFinancePage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/content"
            element={
              <PrivateRoute role="admin">
                <AdminContentPage />
              </PrivateRoute>
            }
          />
          <Route
            path="admin/leaderboard"
            element={
              <PrivateRoute role="admin">
                <AdminLeaderboardPage />
              </PrivateRoute>
            }
          />


          <Route
            path="agent"
            element={
              <PrivateRoute role="agent">
                <AgentDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="agent/knowledge"
            element={
              <PrivateRoute role="agent">
                <AgentKnowledgePage />
              </PrivateRoute>
            }
          />
          <Route
            path="agent/leads"
            element={
              <PrivateRoute role="agent">
                <AgentLeadsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="agent/earnings"
            element={
              <PrivateRoute role="agent">
                <AgentEarningsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="agent/support"
            element={
              <PrivateRoute role="agent">
                <AgentSupportPage />
              </PrivateRoute>
            }
          />
          <Route
            path="agent/push"
            element={
              <PrivateRoute role="agent">
                <AgentPushProspekPage />
              </PrivateRoute>
            }
          />
          <Route
            path="agent/leaderboard"
            element={
              <PrivateRoute role="agent">
                <AgentLeaderboardPage />
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
