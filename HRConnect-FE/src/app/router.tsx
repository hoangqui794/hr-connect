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
import { AdminLayout } from '@/features/admin-console/AdminLayout';
import { HrScope } from '@/features/hr-console/hrTheme';
import { HrLayout } from '@/features/hr-console/HrLayout';
import { ClientScope } from '@/features/client-console/clientTheme';
import { ClientShell } from '@/features/client-console/ClientShell';
import { AffiliateScope, CandidateScope } from '@/features/portal/portalTheme';
import { CandidateShell } from '@/features/portal/CandidateShell';
import { AffiliateShell } from '@/features/portal/AffiliateShell';

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
  {
    path: '/submission-consent',
    element: withSuspense(<AppRoutes.SubmissionConsentPage />),
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
    ],
  },

  // ── Admin console: own shell (AdminLayout) with its own Suspense skeleton ────
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredRoles={ROUTE_ACCESS['/admin']}>
        <AdminScope>
          <AdminLayout />
        </AdminScope>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <AppRoutes.ConsoleOverviewPage /> },
      { path: 'approvals', element: <AppRoutes.ConsoleApprovalsPage /> },
      // Old entry points open the unified queue pre-filtered by type.
      { path: 'companies', element: <AppRoutes.ConsoleApprovalsPage presetType="CLIENT" /> },
      { path: 'affiliates', element: <AppRoutes.ConsoleApprovalsPage presetType="AFFILIATE" /> },
      // Job review is Internal HR's step (main-flows MF-01); old Admin links land on the overview.
      { path: 'jobs', element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'users', element: <AppRoutes.ConsoleUsersPage /> },
      { path: 'service-types', element: <AppRoutes.ConsoleServiceTypesPage /> },
      { path: 'commission-rules', element: <AppRoutes.ConsoleCommissionRulesPage /> },
      { path: 'audit-trail', element: <AppRoutes.ConsoleAuditLogPage /> },
      { path: 'profile', element: <AppRoutes.ConsoleProfilePage /> },
      // No backend API yet: explicit empty state, no mock numbers.
      { path: 'disputes', element: <AppRoutes.ConsoleDisputesPlaceholder /> },
      { path: 'payouts', element: <AppRoutes.ConsolePayoutsPlaceholder /> },
      { path: 'finance', element: <AppRoutes.ConsolePayoutsPlaceholder /> },
      { path: 'settings', element: <AppRoutes.ConsoleSettingsPlaceholder /> },
    ],
  },

  // ── Candidate workspace (MF-02 branch A): top navigation, teal accent ─────────
  {
    path: '/candidate',
    element: (
      <ProtectedRoute requiredRoles={ROUTE_ACCESS['/candidate/dashboard']}>
        <CandidateScope>
          <CandidateShell />
        </CandidateScope>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/candidate/dashboard" replace /> },
      { path: 'dashboard', element: <AppRoutes.CandidateHomePage /> },
      { path: 'applications', element: <AppRoutes.CandidateMyApplicationsPage /> },
      { path: 'consents', element: <Navigate to="/candidate/applications?tab=consents" replace /> },
      { path: 'cvs', element: <AppRoutes.CandidateCvsPage /> },
      { path: 'affiliate-cvs', element: <Navigate to="/candidate/cvs?tab=affiliate" replace /> },
      { path: 'profile', element: <AppRoutes.CandidateProfilePage /> },
      // Saved jobs had no backend; send people to the job search.
      { path: 'saved-jobs', element: <Navigate to="/jobs" replace /> },
    ],
  },
  { path: '/profile', element: <Navigate to="/candidate/profile" replace /> },
  { path: '/cv-builder', element: <Navigate to="/candidate/cvs" replace /> },

  // ── Affiliate workspace (MF-02 branch B): light sidebar, violet accent ──────
  {
    path: '/affiliate',
    element: (
      <ProtectedRoute requiredRoles={ROUTE_ACCESS['/affiliate/dashboard']}>
        <AffiliateScope>
          <AffiliateShell />
        </AffiliateScope>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/affiliate/dashboard" replace /> },
      { path: 'dashboard', element: <AppRoutes.AffiliateHomePage /> },
      { path: 'jobs', element: <AppRoutes.Mf01InAppJobDiscoveryPage /> },
      { path: 'submit-candidate', element: <AppRoutes.AffiliateSubmitPage /> },
      { path: 'submissions', element: <AppRoutes.AffiliateMySubmissionsPage /> },
      { path: 'candidates', element: <AppRoutes.AffiliateCandidatesPage /> },
      { path: 'attributions', element: <AppRoutes.AffiliateAttributionsPage /> },
      { path: 'profile', element: <AppRoutes.AffiliateProfilePage /> },
      // MF-05 commissions have no API yet.
      { path: 'commissions', element: <AppRoutes.AffiliateCommissionsPlaceholder /> },
      // Old entry points.
      { path: 'referral', element: <Navigate to="/affiliate/submit-candidate" replace /> },
      { path: 'refer', element: <Navigate to="/affiliate/submit-candidate" replace /> },
      { path: 'ledger', element: <Navigate to="/affiliate/commissions" replace /> },
    ],
  },

  // ── Client Company workspace: own shell (ClientShell), top navigation + indigo accent ──
  {
    path: '/client',
    element: (
      <ProtectedRoute requiredRoles={ROUTE_ACCESS['/client/dashboard']}>
        <ClientScope>
          <ClientShell />
        </ClientScope>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/client/dashboard" replace /> },
      { path: 'dashboard', element: <AppRoutes.ClientOverviewPage /> },
      { path: 'jobs', element: <AppRoutes.Mf01ClientJobsListPage /> },
      { path: 'jobs/create', element: <AppRoutes.Mf01JobFormPage /> },
      {
        path: 'jobs/:id/edit',
        element: (
          <ProtectedRoute requiredRoles={ROUTE_ACCESS['/client/jobs/:id/edit']}>
            <AppRoutes.Mf01JobFormPage />
          </ProtectedRoute>
        ),
      },
      { path: 'post-job', element: <Navigate to="/client/jobs/create" replace /> },
      { path: 'candidates', element: <AppRoutes.ClientCandidatesPage /> },
      { path: 'interviews-offers', element: <AppRoutes.ClientWorkspaceInterviewsOffersPage /> },
      { path: 'company', element: <AppRoutes.ClientCompanyPage /> },
      // MF-05 warranty has no backend API yet: explicit empty state, no mock numbers.
      { path: 'warranty', element: <AppRoutes.ClientWarrantyPlaceholder /> },
    ],
  },

  // ── Internal HR workspace: own shell (HrLayout), light sidebar + sky accent ──
  {
    path: '/hr',
    element: (
      <ProtectedRoute requiredRoles={ROUTE_ACCESS['/hr/dashboard']}>
        <HrScope>
          <HrLayout />
        </HrScope>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/hr/dashboard" replace /> },
      { path: 'dashboard', element: <AppRoutes.HrOverviewPage /> },
      { path: 'jobs', element: <AppRoutes.Mf01JobReviewPage /> },
      { path: 'screening', element: <AppRoutes.HrScreeningPage /> },
      { path: 'pipeline', element: <AppRoutes.HrPipelinePage /> },
      { path: 'profile', element: <AppRoutes.HrProfilePage /> },
      // Old menu entries: "Kho hồ sơ" and AI screening were the same list; interviews/offers are now one read-only page.
      { path: 'candidates', element: <Navigate to="/hr/screening?status=all" replace /> },
      { path: 'interviews', element: <Navigate to="/hr/pipeline?tab=interviews" replace /> },
      { path: 'offers', element: <Navigate to="/hr/pipeline?tab=offers" replace /> },
      // No backend API yet: explicit empty state, no mock numbers.
      { path: 'placement-review', element: <AppRoutes.HrPlacementReviewPlaceholder /> },
      { path: 'warranty-tracking', element: <AppRoutes.HrWarrantyPlaceholder /> },
    ],
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
