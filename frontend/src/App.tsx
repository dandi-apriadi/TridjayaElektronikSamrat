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
import { getDashboardHomeByRole } from './utils/dashboardAccess';
import { saveReferralCode } from './utils/referralSession';
import { normalizeAccessRole } from './utils/roles';

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
const OwnerDashboard = lazy(() => import('./pages/dashboard/OwnerDashboard'));
const OwnerProspekPage = lazy(() => import('./pages/dashboard/OwnerProspekPage'));
const OwnerOmsetCabangPage = lazy(() => import('./pages/dashboard/OwnerOmsetCabangPage'));
const OwnerOmsetRealtimePage = lazy(() => import('./pages/dashboard/OwnerOmsetRealtimePage'));
const OwnerTargetActualPage = lazy(() => import('./pages/dashboard/OwnerTargetActualPage'));
const OwnerTopSalesPage = lazy(() => import('./pages/dashboard/OwnerTopSalesPage'));
const OwnerTopNonSalesPage = lazy(() => import('./pages/dashboard/OwnerTopNonSalesPage'));
const OwnerRaportPage = lazy(() => import('./pages/dashboard/OwnerRaportPage'));
const OwnerRaportEmployeeDetailPage = lazy(() => import('./pages/dashboard/OwnerRaportEmployeeDetailPage'));
const PicRaportDashboardPage = lazy(() => import('./pages/dashboard/PicRaportDashboardPage'));
const PicRaportMasterPage = lazy(() => import('./pages/dashboard/PicRaportMasterPage'));
const PicRaportHistoryPage = lazy(() => import('./pages/dashboard/PicRaportHistoryPage'));
const PicRaportEmployeeDetailPage = lazy(() => import('./pages/dashboard/PicRaportEmployeeDetailPage'));
const KaryawanDashboard = lazy(() => import('./pages/dashboard/KaryawanDashboard'));
const KaryawanProspekPage = lazy(() => import('./pages/dashboard/KaryawanProspekPage'));
const KaryawanProspekDatabasePage = lazy(() => import('./pages/dashboard/KaryawanProspekDatabasePage'));
const KaryawanRaportPage = lazy(() => import('./pages/dashboard/KaryawanRaportPage'));
const KaryawanRaportHistoryPage = lazy(() => import('./pages/dashboard/KaryawanRaportHistoryPage'));
const AdminCabangPage = lazy(() => import('./pages/dashboard/AdminCabangPage'));
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
const AdminLandingSlidesPage = lazy(() => import('./pages/dashboard/AdminLandingSlidesPage'));
const AdminFormPage = lazy(() => import('./pages/dashboard/AdminFormPage'));
const AdminProductFormPage = lazy(() => import('./pages/dashboard/AdminProductFormPage'));
const AdminProductBulkImportPage = lazy(() => import('./pages/dashboard/AdminProductBulkImportPage'));
const AdminPromoFormPage = lazy(() => import('./pages/dashboard/AdminPromoFormPage'));
const AdminArticleFormPage = lazy(() => import('./pages/dashboard/AdminArticleFormPage'));
const AgentPushProspekPage = lazy(() => import('./pages/dashboard/AgentPushProspekPage'));
const AdminLeaderboardPage = lazy(() => import('./pages/dashboard/AdminLeaderboardPage'));
const AgentLeaderboardPage = lazy(() => import('./pages/dashboard/AgentLeaderboardPage'));
const AccountSettingsPage = lazy(() => import('./pages/dashboard/AccountSettingsPage'));
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
const AdminWaBlastContactsPage = lazy(() => import('./pages/dashboard/AdminWaBlastContactsPage'));
const SalesDeliveryPage = lazy(() => import('./pages/dashboard/SalesDeliveryPage'));
const SalesReferralPage = lazy(() => import('./pages/dashboard/SalesReferralPage'));
const AdminSalesPage = lazy(() => import('./pages/dashboard/AdminSalesPage'));

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
const RoleGuard: React.FC<{ children: React.ReactElement; roles: string[] }> = ({ children, roles }) => {
  const { user, isInitializing } = useAuthStore();
  
  if (isInitializing) return <RouteLoading />;
 
  if (!user?.role || !roles.includes(normalizeAccessRole(user.role))) {
    return <Navigate to={getDashboardHomeByRole(user?.role)} replace />;
  }
 
  return children;
};

// Dashboard Root (Redirects based on role)
const DashboardRoot = () => {
  const { user } = useAuthStore();
  return <Navigate to={getDashboardHomeByRole(user?.role)} replace />;
};

const DashboardAliasRedirect: React.FC<{ adminPath: string }> = ({ adminPath }) => {
  const { user } = useAuthStore();

  if (user?.role !== 'admin') {
    return <Navigate to={getDashboardHomeByRole(user?.role)} replace />;
  }

  return <Navigate to={adminPath} replace />;
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
          
          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminDashboard)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/agents"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminAgentsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/sales"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminSalesPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/sales/referral"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(SalesReferralPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/cabang"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminCabangPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminCatalogPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/categories"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminProductCategoriesPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog/new"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminProductFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog/edit/:id"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminProductFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/catalog/bulk-import"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminProductBulkImportPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/promo"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPromoPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/promo/new"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPromoFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/promo/edit/:id"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPromoFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content/new"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminArticleFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content/landing-slides"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminLandingSlidesPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content/edit/:id"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminArticleFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/telemetry"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminTelemetryPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/users"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminUsersPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/users/new"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/users/edit/:id"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/agents/directory"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminAgentDirectoryPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/finance"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminFinancePage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/content"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminContentPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/partners"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPartnersPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/leaderboard"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminLeaderboardPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/support"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminSupportTicketsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/leads"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminLeadsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/careers"
            element={
              <RoleGuard roles={["admin"]}>
                {lazyPage(AdminCareersPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/notifications"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(NotificationsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/campaigns"
            element={
              <RoleGuard roles={["admin", "operator", "admin-sales"]}>
                {lazyPage(AdminWaCampaignsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/accounts"
            element={
              <RoleGuard roles={["admin", "operator", "admin-sales"]}>
                {lazyPage(AdminWaAccountsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/blast-contacts"
            element={
              <RoleGuard roles={["admin", "operator", "admin-sales"]}>
                {lazyPage(AdminWaBlastContactsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/campaign/new"
            element={
              <RoleGuard roles={["admin", "operator", "admin-sales"]}>
                {lazyPage(AdminWaCampaignFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/wa/campaign/:id"
            element={
              <RoleGuard roles={["admin", "operator", "admin-sales"]}>
                {lazyPage(AdminWaCampaignDetailPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-campaigns"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPixelCampaignsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-campaigns/new"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPixelCampaignFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-campaigns/:id"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPixelCampaignFormPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-analytics"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPixelAnalyticsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="admin/pixel-tester"
            element={
              <RoleGuard roles={["admin", "operator"]}>
                {lazyPage(AdminPixelEventTesterPage)}
              </RoleGuard>
            }
          />


          {/* Owner Routes */}
          <Route
            path="owner"
            element={
              <RoleGuard roles={["owner"]}>
                {lazyPage(OwnerDashboard)}
              </RoleGuard>
            }
          />
          <Route path="owner/prospek" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerProspekPage)}</RoleGuard>} />
          <Route path="owner/omset-cabang" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerOmsetCabangPage)}</RoleGuard>} />
          <Route path="owner/omset-realtime" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerOmsetRealtimePage)}</RoleGuard>} />
          <Route path="owner/target-actual" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerTargetActualPage)}</RoleGuard>} />
          <Route path="owner/top-sales" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerTopSalesPage)}</RoleGuard>} />
          <Route path="owner/top-nonsales" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerTopNonSalesPage)}</RoleGuard>} />
          <Route path="owner/raport" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerRaportPage)}</RoleGuard>} />
          <Route path="owner/raport/:employeeId" element={<RoleGuard roles={["owner"]}>{lazyPage(OwnerRaportEmployeeDetailPage)}</RoleGuard>} />

          {/* PIC Raport Routes */}
          <Route path="pic-raport" element={<RoleGuard roles={["pic_raport"]}>{lazyPage(PicRaportDashboardPage)}</RoleGuard>} />
          <Route path="pic-raport/master" element={<RoleGuard roles={["pic_raport"]}>{lazyPage(PicRaportMasterPage)}</RoleGuard>} />
          <Route path="pic-raport/history" element={<RoleGuard roles={["pic_raport"]}>{lazyPage(PicRaportHistoryPage)}</RoleGuard>} />
          <Route path="pic-raport/karyawan/:employeeId" element={<RoleGuard roles={["pic_raport"]}>{lazyPage(PicRaportEmployeeDetailPage)}</RoleGuard>} />

          {/* Karyawan Routes */}
          <Route path="karyawan" element={<RoleGuard roles={["karyawan"]}>{lazyPage(KaryawanDashboard)}</RoleGuard>} />
          <Route path="karyawan/prospek" element={<RoleGuard roles={["karyawan"]}>{lazyPage(KaryawanProspekPage)}</RoleGuard>} />
          <Route path="karyawan/prospek/database" element={<RoleGuard roles={["karyawan"]}>{lazyPage(KaryawanProspekDatabasePage)}</RoleGuard>} />
          <Route path="karyawan/raport" element={<RoleGuard roles={["karyawan"]}>{lazyPage(KaryawanRaportPage)}</RoleGuard>} />
          <Route path="karyawan/raport/history" element={<RoleGuard roles={["karyawan"]}>{lazyPage(KaryawanRaportHistoryPage)}</RoleGuard>} />
          <Route path="settings" element={<RoleGuard roles={["admin", "operator", "admin-sales", "agent", "owner", "pic_raport", "karyawan"]}>{lazyPage(AccountSettingsPage)}</RoleGuard>} />

          <Route
            path="agent"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentDashboard)}
              </RoleGuard>
            }
          />
          <Route
            path="sales"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(AgentDashboard)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/knowledge"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentKnowledgePage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/knowledge"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(AgentKnowledgePage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/leads"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentLeadsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/delivery"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(SalesDeliveryPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/earnings"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentEarningsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/referral"
            element={<Navigate to="/dashboard/sales/push-prospek" replace />}
          />
          <Route
            path="agent/support"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentSupportPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/pixel-analytics"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentPixelAnalyticsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/support"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(AgentSupportPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/pixel-analytics"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(SalesPixelAnalyticsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/push"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentPushProspekPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/push-prospek"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentPushProspekPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/push-prospek"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(AgentPushProspekPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/settings"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(AccountSettingsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/leaderboard"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AgentLeaderboardPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/settings"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(AccountSettingsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="agent/notifications"
            element={
              <RoleGuard roles={["agent"]}>
                {lazyPage(NotificationsPage)}
              </RoleGuard>
            }
          />
          <Route
            path="sales/notifications"
            element={
              <RoleGuard roles={["admin-sales"]}>
                {lazyPage(NotificationsPage)}
              </RoleGuard>
            }
          />

          <Route path="agen" element={<DashboardAliasRedirect adminPath="/dashboard/admin/agents" />} />
          <Route path="katalog" element={<DashboardAliasRedirect adminPath="/dashboard/admin/catalog" />} />
          <Route path="promo" element={<DashboardAliasRedirect adminPath="/dashboard/admin/promo" />} />
          <Route path="telemetri" element={<DashboardAliasRedirect adminPath="/dashboard/admin/telemetry" />} />
          {/* Fallback internal routes */}
          <Route path="*" element={<DashboardRoot />} />
        </Route>

        <Route
          path="/admin/users"
          element={
            <RoleGuard roles={["admin"]}>
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
