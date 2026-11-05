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
 *     jobs             → Mf01InAppJobDiscoveryPage
 *     jobs/create      → Mf01JobFormPage    [CLIENT, ADMIN]
 *     screening        → HrScreeningPage    [INTERNAL_HR, ADMIN, CLIENT]
 *     candidates       → redirect /hr/screening?status=all
 *     admin            → ConsoleOverviewPage [ADMIN]
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
const LandingPage = React.lazy(() => import('@/features/landing/LandingPage').then((m: any) => ({ default: m.default || m.LandingPage })));
const LoginPage = React.lazy(() => import('@/features/auth/LoginPage').then((m: any) => ({ default: m.default || m.LoginPage })));
const RegisterPage = React.lazy(() => import('@/features/auth/RegisterPage').then((m: any) => ({ default: m.default || m.RegisterPage })));
const ServicesPage = React.lazy(() => import('@/features/services/ServicesPage').then((m: any) => ({ default: m.default || m.ServicesPage })));
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
    element: withSuspense(<CandidateScope><LandingPage /></CandidateScope>),
  },
  {
    path: '/login',
    element: withSuspense(<LoginPage />),
  },
  {
    path: '/register',
    element: withSuspense(<RegisterPage />),
  },
  {
    path: '/register/affiliate',
    element: withSuspense(<AppRoutes.AffiliateRegisterPage />),
  },
  {
    path: '/forgot-password',
    element: withSuspense(<AppRoutes.ForgotPasswordPage />),
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
    path: '/companies',
    element: withSuspense(<CandidateScope><AppRoutes.CompaniesPage /></CandidateScope>),
  },
  {
    path: '/companies/:companyId',
    element: withSuspense(<CandidateScope><AppRoutes.CompanyDetailPage /></CandidateScope>),
  },
  {
    path: '/services',
    element: withSuspense(<ServicesPage />),
  },
  {
    path: '/contact',
    element: withSuspense(<AppRoutes.ContactPage />),
  },
  {
    path: '/submission-consent',
    element: (
      <CandidateScope>
        {withSuspense(<AppRoutes.PublicSubmissionConsentPage />)}
      </CandidateScope>
    ),
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
        element: protectedPage('/screening', <AppRoutes.HrScreeningPage />),
      },
      {
        path: 'candidates',
        element: <Navigate to="/hr/screening?status=all" replace />,
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
      { path: 'candidate-identity-claims', element: <AppRoutes.ConsoleIdentityClaimsPage /> },
      { path: 'candidate-identity-claims/:claimId', element: <AppRoutes.ConsoleIdentityClaimDetailPage /> },
      // Old entry points open the unified queue pre-filtered by type.
      { path: 'companies', element: <AppRoutes.ConsoleApprovalsPage presetType="CLIENT" /> },
      { path: 'affiliates', element: <AppRoutes.ConsoleApprovalsPage presetType="AFFILIATE" /> },
      // Admin can review jobs just like Internal HR (MF-01).
      { path: 'jobs', element: <AppRoutes.Mf01JobReviewPage /> },
      { path: 'job-templates', element: <AppRoutes.Mf01JobTemplatesAdminPage /> },
      { path: 'users', element: <AppRoutes.ConsoleUsersPage /> },
      { path: 'contact-requests', element: <AppRoutes.AdminContactRequestsPage /> },
      { path: 'service-types', element: <AppRoutes.ConsoleServiceTypesPage /> },
      { path: 'commission-rules', element: <AppRoutes.ConsoleCommissionRulesPage /> },
      { path: 'roles-permissions', element: <AppRoutes.ConsoleRolesPermissionsPage /> },
      { path: 'user-authorization', element: <AppRoutes.ConsoleUserAuthorizationPage /> },
      { path: 'audit-trail', element: <AppRoutes.ConsoleAuditLogPage /> },
      { path: 'reports', element: <AppRoutes.AdminReportsPage /> },
      { path: 'placement-reconciliations', element: <AppRoutes.AdminPlacementReconciliationPage /> },
      { path: 'profile', element: <AppRoutes.ConsoleProfilePage /> },
      // No backend API yet: explicit empty state, no mock numbers.
      { path: 'disputes', element: <AppRoutes.ConsoleDisputesPlaceholder /> },
      { path: 'payouts', element: <AppRoutes.ConsolePayoutsPlaceholder /> },
      { path: 'finance', element: <AppRoutes.ConsolePayoutsPlaceholder /> },
      { path: 'settings', element: <AppRoutes.ConsoleSettingsPlaceholder /> },
    ],
  },

  // ── Candidate workspace (MF-02 branch A): site header, sky accent ─────────
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
      // A Candidate's home is the site homepage (mockup 03/11).
      { index: true, element: <Navigate to="/" replace /> },
      { path: 'dashboard', element: <Navigate to="/" replace /> },
      { path: 'jobs', element: <Navigate to="/jobs" replace /> },
      { path: 'jobs/:jobId', element: <AppRoutes.CandidateJobDetailPage /> },
      { path: 'applications', element: <AppRoutes.CandidateMyApplicationsPage /> },
      { path: 'applications/:applicationId', element: <AppRoutes.CandidateApplicationDetailPage /> },
      { path: 'applications/:applicationId/offers/:offerId', element: <AppRoutes.CandidateOfferPage /> },
      { path: 'submission-consents/:submissionId', element: <AppRoutes.CandidateSubmissionConsentPage /> },
      { path: 'consents', element: <Navigate to="/candidate/applications?tab=consents" replace /> },
      { path: 'cvs', element: <AppRoutes.CandidateCvsPage /> },
      { path: 'cv-builder', element: <AppRoutes.CandidateCvBuilderPage /> },
      { path: 'cv-builder/:cvId', element: <AppRoutes.CandidateCvBuilderPage /> },
      { path: 'affiliate-cvs', element: <AppRoutes.CandidateAffiliateCvsPage /> },
      { path: 'affiliate-cvs/:cvId', element: <AppRoutes.CandidateAffiliateCvDetailPage /> },
      { path: 'settings/email-identities', element: <AppRoutes.CandidateIdentityPage /> },
      { path: 'saved-jobs', element: <AppRoutes.CandidateSavedJobsPage /> },
      { path: 'profile', element: <AppRoutes.CandidateProfilePage /> },
      { path: 'interviews/:interviewId', element: <AppRoutes.CandidateInterviewDetailPage /> },
      { path: 'applications/:applicationId/interviews/:interviewId', element: <AppRoutes.CandidateInterviewDetailPage /> },
    ],
  },
  { path: '/profile', element: <Navigate to="/candidate/profile" replace /> },
  { path: '/cv-builder', element: <Navigate to="/candidate/cv-builder" replace /> },

  // ── Affiliate workspace (MF-02 branch B): white sidebar, sky accent ──────
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
      { path: 'jobs', element: <AppRoutes.AffiliateJobsPage /> },
      { path: 'jobs/:jobId', element: <AppRoutes.AffiliateJobDetailPage /> },
      { path: 'submit-candidate', element: <AppRoutes.AffiliateSubmitPage /> },
      { path: 'submissions', element: <AppRoutes.AffiliateMySubmissionsPage /> },
      { path: 'submissions/:submissionId', element: <AppRoutes.AffiliateSubmissionDetailPage /> },
      { path: 'candidates', element: <AppRoutes.AffiliateCandidatesPage /> },
      { path: 'candidates/:candidateId', element: <AppRoutes.AffiliateCandidateDetailPage /> },
      { path: 'attributions', element: <AppRoutes.AffiliateAttributionsPage /> },
      { path: 'performance', element: <AppRoutes.AffiliatePerformancePage /> },
      { path: 'disputes', element: <AppRoutes.AffiliateDisputesPage /> },
      { path: 'profile', element: <AppRoutes.AffiliateProfilePage /> },
      // MF-05: the affiliate's own commissions, payouts and payout account.
      { path: 'commissions', element: <AppRoutes.AffiliateCommissionsPage /> },
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
      { path: 'agreements', element: <AppRoutes.ClientServiceAgreementsPage /> },
      { path: 'jobs/create', element: <AppRoutes.Mf01JobFormPage /> },
      {
        path: 'jobs/:id/edit',
        element: (
          <ProtectedRoute requiredRoles={ROUTE_ACCESS['/client/jobs/:id/edit']}>
            <AppRoutes.Mf01JobFormPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'jobs/:id/sourcing',
        element: (
          <ProtectedRoute requiredRoles={ROUTE_ACCESS['/client/jobs/:id/sourcing']}>
            <AppRoutes.ClientJobSourcingDeliveriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'jobs/:jobId/sourcing',
        element: (
          <ProtectedRoute requiredRoles={ROUTE_ACCESS['/client/jobs/:jobId/sourcing']}>
            <AppRoutes.ClientJobSourcingDeliveriesPage />
          </ProtectedRoute>
        ),
      },
      { path: 'post-job', element: <Navigate to="/client/jobs/create" replace /> },
      { path: 'candidates', element: <AppRoutes.ClientCandidatesPage /> },
      { path: 'interviews-offers', element: <AppRoutes.ClientWorkspaceInterviewsOffersPage /> },
      { path: 'company', element: <AppRoutes.ClientCompanyPage /> },
      // MF-05 warranty has no backend API yet: explicit empty state, no mock numbers.
      { path: 'warranty', element: <AppRoutes.ClientWarrantyPlaceholder /> },
      { path: 'billing', element: <AppRoutes.ClientBillingPage /> },
      { path: 'billing/vnpay-return', element: <AppRoutes.ClientVnPayReturnPage /> },
      { path: 'placements/:placementId', element: <AppRoutes.PlacementDetailPage /> },
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
      { path: 'job-templates', element: <AppRoutes.Mf01JobTemplatesAdminPage /> },
      { path: 'screening', element: <AppRoutes.HrScreeningPage /> },
      { path: 'pipeline', element: <AppRoutes.HrPipelinePage /> },
      { path: 'contact-requests', element: <AppRoutes.AdminContactRequestsPage /> },
      { path: 'profile', element: <AppRoutes.HrProfilePage /> },
      // Old menu entries: "Kho hồ sơ" and AI screening were the same list; interviews/offers are now one read-only page.
      { path: 'candidates', element: <Navigate to="/hr/screening?status=all" replace /> },
      { path: 'interviews', element: <Navigate to="/hr/pipeline?tab=interviews" replace /> },
      { path: 'offers', element: <Navigate to="/hr/pipeline?tab=offers" replace /> },
      { path: 'placement-review', element: <AppRoutes.HrPlacementStartDateCorrectionPage /> },
      { path: 'placement-reconciliations', element: <AppRoutes.HrPlacementReconciliationPage /> },
      { path: 'warranty-tracking', element: <AppRoutes.HrWarrantyPlaceholder /> },
      { path: 'placements/:placementId', element: <AppRoutes.PlacementDetailPage /> },
    ],
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
