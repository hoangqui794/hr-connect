/**
 * @file router.tsx
 * @description Application router for HR Connect using React Router v6 Data Router
 * (createBrowserRouter) pattern with RBAC-enforced ProtectedRoute wrappers.
 *
 * All portal screens are lazy-loaded via React.Suspense for optimal LCP.
 * A lightweight PageLoader spinner is shown during chunk hydration.
 *
 * Route tree:
 *   /                  → LandingPage (public)
 *   /login             → LoginPage (public)
 *   /register          → LoginPage (public)
 *   / (AppShell)
 *     dashboard        → Dashboard          [CLIENT, CANDIDATE, AFFILIATE, INTERNAL_HR, ADMIN]
 *     jobs             → JobBoard           [CLIENT, AFFILIATE, INTERNAL_HR, ADMIN, CANDIDATE]
 *     jobs/create      → CreateJobWizard    [CLIENT, ADMIN]
 *     affiliate/referral → ReferralForm     [AFFILIATE]
 *     affiliate/ledger → FinancialLedger    [AFFILIATE, INTERNAL_HR, ADMIN]
 *     screening        → AIScreening        [INTERNAL_HR, ADMIN, CLIENT]
 *     candidates       → CandidateList      [INTERNAL_HR, ADMIN, CLIENT]
 *     cv-builder       → CVBuilder          [CANDIDATE]
 *     admin            → AdminDashboard     [ADMIN]
 *   *                  → redirect /
 */
import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { AppShell } from '@/components/layout/AppShell';
import {
  AppRoutes,
  ProtectedRoute,
  ROUTE_ACCESS,
} from '@/routes/AppRoutes';
import { LandingPage } from '@/features/landing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ServicesPage } from '@/features/services/ServicesPage';
import { AdminScope } from '@/features/admin-console/adminTheme';

// ─── Page-level Suspense boundary ────────────────────────────────────────────

const PageLoader: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}
  >
    <Spin size="large" tip="Loading…" />
  </div>
);

function withSuspense(element: React.ReactElement): React.ReactElement {
  return <React.Suspense fallback={<PageLoader />}>{element}</React.Suspense>;
}

function protectedPage(
  path: string,
  element: React.ReactElement
): React.ReactElement {
  const roles = ROUTE_ACCESS[path];
  if (!roles) throw new Error(`No ROUTE_ACCESS entry for path: ${path}`);
  return withSuspense(
    <ProtectedRoute requiredRoles={roles}>{element}</ProtectedRoute>
  );
}

/** Admin pages get the "Slate Command" palette via AdminScope. */
function adminPage(path: string, element: React.ReactElement): React.ReactElement {
  return protectedPage(path, <AdminScope>{element}</AdminScope>);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // ── Public routes (no AppShell) ────────────────────────────────────────────
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/verify-otp',
    element: withSuspense(<AppRoutes.VerifyOtpPage />),
  },
  {
    path: '/auth/verify',
    element: withSuspense(<AppRoutes.VerifyOtpPage />),
  },
  {
    path: '/services',
    element: <ServicesPage />,
  },
  {
    path: '/jobs',
    element: withSuspense(<AppRoutes.Mf01PublicJobSearchPage />),
  },
  {
    path: '/jobs/:id',
    element: withSuspense(<AppRoutes.Mf01PublicJobDetailPage />),
  },

  // ── Protected routes (inside AppShell) ────────────────────────────────────
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        path: 'dashboard',
        element: protectedPage('/dashboard', <AppRoutes.Dashboard />),
      },
      {
        path: 'client/dashboard',
        element: protectedPage('/client/dashboard', <AppRoutes.ClientDashboardPage />),
      },
      {
        path: 'client/jobs',
        element: protectedPage('/client/jobs', <AppRoutes.Mf01ClientJobsListPage />),
      },
      {
        path: 'client/jobs/create',
        element: protectedPage('/client/jobs/create', <AppRoutes.Mf01JobFormPage />),
      },
      {
        path: 'client/jobs/:id/edit',
        element: protectedPage('/client/jobs/:id/edit', <AppRoutes.Mf01JobFormPage />),
      },
      {
        path: 'client/post-job',
        element: protectedPage('/client/post-job', <AppRoutes.Mf01JobFormPage />),
      },
      {
        path: 'client/candidates',
        element: protectedPage('/client/candidates', <AppRoutes.ClientCandidatePoolPage />),
      },
      {
        path: 'client/interviews-offers',
        element: protectedPage('/client/interviews-offers', <AppRoutes.ClientInterviewsOffersPage />),
      },
      {
        path: 'client/warranty',
        element: protectedPage('/client/warranty', <AppRoutes.ClientWarrantyPage />),
      },
      {
        path: 'affiliate/dashboard',
        element: protectedPage('/affiliate/dashboard', <AppRoutes.AffiliateDashboardPage />),
      },
      {
        path: 'affiliate/jobs',
        element: protectedPage('/affiliate/jobs', <AppRoutes.Mf01InAppJobDiscoveryPage />),
      },
      {
        path: 'affiliate/submissions',
        element: protectedPage('/affiliate/submissions', <AppRoutes.AffiliateSubmissionsPage />),
      },
      {
        path: 'affiliate/candidates',
        element: protectedPage('/affiliate/candidates', <AppRoutes.AffiliateSubmissionsPage />),
      },
      {
        path: 'affiliate/submit-candidate',
        element: protectedPage('/affiliate/submit-candidate', <AppRoutes.ReferralForm />),
      },
      {
        path: 'affiliate/referral',
        element: protectedPage('/affiliate/referral', <AppRoutes.ReferralForm />),
      },
      {
        path: 'affiliate/refer',
        element: protectedPage('/affiliate/refer', <AppRoutes.ReferralForm />),
      },
      {
        path: 'affiliate/commissions',
        element: protectedPage('/affiliate/commissions', <AppRoutes.AffiliateCommissionsPage />),
      },
      {
        path: 'affiliate/ledger',
        element: protectedPage('/affiliate/ledger', <AppRoutes.AffiliateCommissionsPage />),
      },
      {
        path: 'hr/dashboard',
        element: protectedPage('/hr/dashboard', <AppRoutes.HRDashboardPage />),
      },
      {
        path: 'hr/jobs',
        element: protectedPage('/hr/jobs', <AppRoutes.Mf01JobReviewPage />),
      },
      {
        path: 'hr/candidates',
        element: protectedPage('/hr/candidates', <AppRoutes.CandidateList />),
      },
      {
        path: 'hr/screening',
        element: protectedPage('/hr/screening', <AppRoutes.AIScreening />),
      },
      {
        path: 'hr/interviews',
        element: protectedPage('/hr/interviews', <AppRoutes.HRInterviewsPage />),
      },
      {
        path: 'hr/offers',
        element: protectedPage('/hr/offers', <AppRoutes.HROffersPage />),
      },
      {
        path: 'hr/warranty-tracking',
        element: protectedPage('/hr/warranty-tracking', <AppRoutes.HRWarrantyTrackingPage />),
      },
      {
        path: 'candidate/dashboard',
        element: protectedPage('/candidate/dashboard', <AppRoutes.CandidateDashboardPage />),
      },
      {
        path: 'profile',
        element: protectedPage('/profile', <AppRoutes.CandidateProfilePage />),
      },
      {
        path: 'candidate/profile',
        element: protectedPage('/candidate/profile', <AppRoutes.CandidateProfilePage />),
      },
      {
        path: 'candidate/applications',
        element: protectedPage('/candidate/applications', <AppRoutes.CandidateApplicationsPage />),
      },
      {
        path: 'candidate/saved-jobs',
        element: protectedPage('/candidate/saved-jobs', <AppRoutes.CandidateSavedJobsPage />),
      },
      {
        path: 'jobs',
        element: protectedPage('/jobs', <AppRoutes.Mf01InAppJobDiscoveryPage />),
      },
      {
        // CreateJobWizard (MF-01 | SCR-CLI-01) — production wizard
        path: 'jobs/create',
        element: protectedPage('/jobs/create', <AppRoutes.Mf01JobFormPage />),
      },
      {
        path: 'screening',
        element: protectedPage('/screening', <AppRoutes.AIScreening />),
      },
      {
        path: 'candidates',
        element: protectedPage('/candidates', <AppRoutes.CandidateList />),
      },
      {
        path: 'cv-builder',
        element: protectedPage('/cv-builder', <AppRoutes.CVBuilder />),
      },
      // ── Admin console ("Slate Command", backend-driven) ─────────────────────
      { path: 'admin', element: adminPage('/admin', <AppRoutes.ConsoleOverviewPage />) },
      { path: 'admin/dashboard', element: adminPage('/admin/dashboard', <AppRoutes.ConsoleOverviewPage />) },
      { path: 'admin/approvals', element: adminPage('/admin/approvals', <AppRoutes.ConsoleApprovalsPage />) },
      // Old entry points now open the unified queue pre-filtered by type.
      { path: 'admin/companies', element: adminPage('/admin/companies', <AppRoutes.ConsoleApprovalsPage presetType="CLIENT" />) },
      { path: 'admin/affiliates', element: adminPage('/admin/affiliates', <AppRoutes.ConsoleApprovalsPage presetType="AFFILIATE" />) },
      { path: 'admin/jobs', element: adminPage('/admin/jobs', <AppRoutes.Mf01JobReviewPage />) },
      { path: 'admin/users', element: adminPage('/admin/users', <AppRoutes.ConsoleUsersPage />) },
      { path: 'admin/service-types', element: adminPage('/admin/service-types', <AppRoutes.ConsoleServiceTypesPage />) },
      { path: 'admin/commission-rules', element: adminPage('/admin/commission-rules', <AppRoutes.ConsoleCommissionRulesPage />) },
      { path: 'admin/audit-trail', element: adminPage('/admin/audit-trail', <AppRoutes.ConsoleAuditLogPage />) },
      { path: 'admin/profile', element: adminPage('/admin/profile', <AppRoutes.ConsoleProfilePage />) },
      // No backend API yet: explicit empty state, no mock numbers.
      { path: 'admin/disputes', element: adminPage('/admin/disputes', <AppRoutes.ConsoleDisputesPlaceholder />) },
      { path: 'admin/payouts', element: adminPage('/admin/payouts', <AppRoutes.ConsolePayoutsPlaceholder />) },
      { path: 'admin/finance', element: adminPage('/admin/finance', <AppRoutes.ConsolePayoutsPlaceholder />) },
      { path: 'admin/settings', element: adminPage('/admin/settings', <AppRoutes.ConsoleSettingsPlaceholder />) },
    ],
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
