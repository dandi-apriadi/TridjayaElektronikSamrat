import React, { Suspense, lazy, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import Layout from './components/layout/Layout';
import { useTelemetryTracker } from './store/useTelemetryTracker';
import ErrorBoundary from './components/ErrorBoundary';

const HomePage = lazy(() => import('./pages/HomePage'));
import { usePageTitle } from './hooks/usePageTitle';

import { NotificationContainer } from './components/ui/Notification';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { useProductStore } from './store/useProductStore';
import { usePromoStore } from './store/usePromoStore';
import { useBlogStore } from './store/useBlogStore';
import { usePartnerStore } from './store/usePartnerStore';
import { saveReferralCode } from './utils/referralSession';

const CatalogPage = lazy(() => import('./pages/CatalogPage'));
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
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));

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
const AdminProductBulkImportPage = lazy(() => import('./pages/dashboard/AdminProductBulkImportPage'));
const AdminPromoFormPage = lazy(() => import('./pages/dashboard/AdminPromoFormPage'));
const AdminArticleFormPage = lazy(() => import('./pages/dashboard/AdminArticleFormPage'));
const AgentPushProspekPage = lazy(() => import('./pages/dashboard/AgentPushProspekPage'));
const AdminLeaderboardPage = lazy(() => import('./pages/dashboard/AdminLeaderboardPage'));
const AgentLeaderboardPage = lazy(() => import('./pages/dashboard/AgentLeaderboardPage'));
const AgentSettingsPage = lazy(() => import('./pages/dashboard/AgentSettingsPage'));
const AdminSupportTicketsPage = lazy(() => import('./pages/dashboard/AdminSupportTicketsPage'));
const AdminLeadsPage = lazy(() => import('./pages/dashboard/AdminLeadsPage'));
const AdminPartnersPage = lazy(() => import('./pages/dashboard/AdminPartnersPage'));
const AdminProductCategoriesPage = lazy(() => import('./pages/dashboard/AdminProductCategoriesPage'));
const NotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const AdminCareersPage = lazy(() => import('./pages/dashboard/AdminCareersPage'));
const AdminWaCampaignsPage = lazy(() => import('./pages/dashboard/AdminWaCampaignsPage'));
const AdminWaCampaignFormPage = lazy(() => import('./pages/dashboard/AdminWaCampaignFormPage'));
const AdminWaCampaignDetailPage = lazy(() => import('./pages/dashboard/AdminWaCampaignDetailPage'));
const AdminWaAccountsPage = lazy(() => import('./pages/dashboard/AdminWaAccountsPage.tsx'));
const SalesDeliveryPage = lazy(() => import('./pages/dashboard/SalesDeliveryPage'));
const SalesReferralPage = lazy(() => import('./pages/dashboard/SalesReferralPage'));
const AdminSalesPage = lazy(() => import('./pages/dashboard/AdminSalesPage'));

// Super Admin pages
const SuperAdminDashboard = lazy(() => import('./pages/dashboard/SuperAdminDashboard'));
const SuperAdminPixelsPage = lazy(() => import('./pages/dashboard/SuperAdminPixelsPage'));
const SuperAdminPixelFormPage = lazy(() => import('./pages/dashboard/SuperAdminPixelFormPage'));
const SuperAdminAnalyticsPage = lazy(() => import('./pages/dashboard/SuperAdminAnalyticsPage'));
const SuperAdminAuditLogsPage = lazy(() => import('./pages/dashboard/SuperAdminAuditLogsPage'));

// Admin Pixel pages
const AdminPixelCampaignsPage = lazy(() => import('./pages/dashboard/AdminPixelCampaignsPage'));
const AdminPixelCampaignFormPage = lazy(() => import('./pages/dashboard/AdminPixelCampaignFormPage'));
const AdminPixelAnalyticsPage = lazy(() => import('./pages/dashboard/AdminPixelAnalyticsPage'));
const AdminPixelEventTesterPage = lazy(() => import('./pages/dashboard/AdminPixelEventTesterPage'));

// Agent and Sales Pixel pages
const AgentPixelAnalyticsPage = lazy(() => import('./pages/dashboard/AgentPixelAnalyticsPage'));
const SalesPixelAnalyticsPage = lazy(() => import('./pages/dashboard/SalesPixelAnalyticsPage'));

const RouteLoading: React.FC = () => (
  <div className="min-h-[40vh] w-full grid place-items-center px-4">
    <div className="glass-card rounded-xl px-5 py-3 text-label-sm text-on-surface-variant">
      Memuat halaman...
    </div>
  </div>
);

const lazyPage = (Component: React.ComponentType) => <Component />;

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
const RoleGuard: React.FC<{ children: React.ReactElement; role: 'admin' | 'agent' | 'sales' | 'super_admin' }> = ({ children, role }) => {
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
  return <Navigate to={user?.role === 'super_admin' ? '/dashboard/super-admin' : user?.role === 'admin' ? '/dashboard/admin' : user?.role === 'sales' ? '/dashboard/sales' : '/dashboard/agent'} replace />;
};

// Scroll to top and track telemetry on route change
const RouteListener = () => {
  const { pathname, search } = useLocation();
  useTelemetryTracker();
  usePageTitle();

  useEffect(() => {
    // Scroll the dashboard content area to top on route change
    // The dashboard uses an internal scrollable div, not window
    const contentArea = document.getElementById('dashboard-content');
    if (contentArea) {
      contentArea.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  useEffect(() => {
    const ref = new URLSearchParams(search).get('ref')?.trim();
    if (ref) {
      saveReferralCode(ref);
    }
  }, [search]);
  
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
    console.log('[Auth] Attempting to restore session...');
    useAuthStore.getState().restoreSession().then(() => {
      console.log('[Auth] Session restoration attempt completed');
    }).catch(err => {
      console.error('[Auth] Session restoration crashed:', err);
    });

    // Fetch only essential data for initial load
    // Other data will be fetched on-demand by individual pages
    const { fetchProducts } = useProductStore.getState();

    // Use requestIdleCallback untuk non-critical data fetching
    const fetchNonCritical = () => {
      const { fetchPromos } = usePromoStore.getState();
      const { fetchPosts } = useBlogStore.getState();
      const { fetchPartners } = usePartnerStore.getState();

      // Delay non-essential data fetching
      setTimeout(() => {
        fetchPromos().catch(() => {});
        fetchPosts().catch(() => {});
        fetchPartners().catch(() => {});
      }, 2000); // Delay 2 seconds after initial load
    };

    // Fetch products immediately (needed for homepage)
    fetchProducts().catch(() => {});

    // Schedule non-critical data fetching
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(fetchNonCritical, { timeout: 3000 });
    } else {
      setTimeout(fetchNonCritical, 1000);
    }
  }, [setTheme]);

  return (
    <Router>
      <RouteListener />
      <NotificationContainer />
      <ErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="produk" element={<CatalogPage />} />
          <Route path="produk/:slug" element={<ProductDetailPage />} />
          <Route path="promo" element={<PromoPage />} />
          <Route path="promo/:id" element={<PromoDetailPage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="blog/:slug" element={<ArticleDetailPage />} />
          <Route path="tentang" element={lazyPage(TentangPage)} />
          <Route path="karier" element={lazyPage(CareerPage)} />
          <Route path="career" element={<Navigate to="/karier" replace />} />
          <Route path="careers" element={<Navigate to="/karier" replace />} />
          <Route path="daftar-agen" element={lazyPage(AgencyRegistrationPage)} />
          <Route path="kebijakan-privasi" element={lazyPage(PrivacyPolicyPage)} />
          <Route path="syarat-layanan" element={<TermsOfServicePage />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

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
          
          {/* Super Admin Routes */}
          <Route
            path="super-admin"
            element={
              <RoleGuard role="super_admin">
                {lazyPage(SuperAdminDashboard)}
              </RoleGuard>
            }
          />
          <Route
            path="super-admin/pixels"
            element={
              <RoleGuard role="super_admin">
                {lazyPage(SuperAdminPixelsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="super-admin/pixels/new"
            element={
              <RoleGuard role="super_admin">
                {lazyPage(SuperAdminPixelFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="super-admin/pixels/:id"
            element={
              <RoleGuard role="super_admin">
                {lazyPage(SuperAdminPixelFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="super-admin/analytics"
            element={
              <RoleGuard role="super_admin">
                {lazyPage(SuperAdminAnalyticsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="super-admin/audit-logs"
            element={
              <RoleGuard role="super_admin">
                {lazyPage(SuperAdminAuditLogsPage)}
              </RoleGuard>
            }
          />
          
          {/* Admin Routes */}
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
            path="admin/sales"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminSalesPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/sales/referral"
            element={
              <RoleGuard role="admin">
                {lazyPage(SalesReferralPage)}
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
            path="admin/categories"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminProductCategoriesPage)}
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
            path="admin/catalog/bulk-import"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminProductBulkImportPage)}
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
            path="admin/partners"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPartnersPage)}
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
            path="admin/support"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminSupportTicketsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/leads"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminLeadsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/careers"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminCareersPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/notifications"
            element={
              <RoleGuard role="admin">
                {lazyPage(NotificationsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/campaigns"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminWaCampaignsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/accounts"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminWaAccountsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/campaign/new"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminWaCampaignFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/campaign/:id"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminWaCampaignDetailPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-campaigns"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPixelCampaignsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-campaigns/new"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPixelCampaignFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-campaigns/:id"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPixelCampaignFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-analytics"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPixelAnalyticsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-tester"
            element={
              <RoleGuard role="admin">
                {lazyPage(AdminPixelEventTesterPage)}
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
            path="sales"
            element={
              <RoleGuard role="sales">
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
            path="sales/knowledge"
            element={
              <RoleGuard role="sales">
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
            path="sales/delivery"
            element={
              <RoleGuard role="sales">
                {lazyPage(SalesDeliveryPage)}
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
            path="sales/referral"
            element={
              <RoleGuard role="sales">
                {lazyPage(SalesReferralPage)}
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
            path="agent/pixel-analytics"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentPixelAnalyticsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/support"
            element={
              <RoleGuard role="sales">
                {lazyPage(AgentSupportPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/pixel-analytics"
            element={
              <RoleGuard role="sales">
                {lazyPage(SalesPixelAnalyticsPage)}
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
            path="sales/settings"
            element={
              <RoleGuard role="sales">
                {lazyPage(AgentSettingsPage)}
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
          <Route
            path="agent/settings"
            element={
              <RoleGuard role="agent">
                {lazyPage(AgentSettingsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/notifications"
            element={
              <RoleGuard role="agent">
                {lazyPage(NotificationsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/notifications"
            element={
              <RoleGuard role="sales">
                {lazyPage(NotificationsPage)}
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
      </ErrorBoundary>
    </Router>
  );
};

export default App;
