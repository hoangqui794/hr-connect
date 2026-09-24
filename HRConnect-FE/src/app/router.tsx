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
    path: '/services',
    element: <ServicesPage />,
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
        element: protectedPage('/client/jobs', <AppRoutes.ClientJobsPage />),
      },
      {
        path: 'client/jobs/create',
        element: protectedPage('/client/jobs/create', <AppRoutes.CreateJobWizard />),
      },
      {
        path: 'client/post-job',
        element: protectedPage('/client/post-job', <AppRoutes.CreateJobWizard />),
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
        element: protectedPage('/affiliate/jobs', <AppRoutes.JobBoard />),
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
        element: protectedPage('/hr/jobs', <AppRoutes.JobBoard />),
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
        element: protectedPage('/jobs', <AppRoutes.JobBoard />),
      },
      {
        // CreateJobWizard (MF-01 | SCR-CLI-01) — production wizard
        path: 'jobs/create',
        element: protectedPage('/jobs/create', <AppRoutes.CreateJobWizard />),
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
      {
        path: 'admin',
        element: protectedPage('/admin', <AppRoutes.AdminDashboard />),
      },
      {
        path: 'admin/dashboard',
        element: protectedPage('/admin/dashboard', <AppRoutes.AdminDashboard />),
      },
      {
        path: 'admin/users',
        element: protectedPage('/admin/users', <AppRoutes.AdminUsersPage />),
      },
      {
        path: 'admin/companies',
        element: protectedPage('/admin/companies', <AppRoutes.AdminCompaniesPage />),
      },
      {
        path: 'admin/affiliates',
        element: protectedPage('/admin/affiliates', <AppRoutes.AdminAffiliatesPage />),
      },
      {
        path: 'admin/disputes',
        element: protectedPage('/admin/disputes', <AppRoutes.AdminDisputesPage />),
      },
      {
        path: 'admin/payouts',
        element: protectedPage('/admin/payouts', <AppRoutes.AdminPayoutsPage />),
      },
      {
        path: 'admin/finance',
        element: protectedPage('/admin/finance', <AppRoutes.AdminPayoutsPage />),
      },
      {
        path: 'admin/settings',
        element: protectedPage('/admin/settings', <AppRoutes.AdminSettingsPage />),
      },
      {
        path: 'admin/audit-trail',
        element: protectedPage('/admin/audit-trail', <AppRoutes.AdminAuditTrailPage />),
      },
      {
        path: 'admin/jobs',
        element: protectedPage('/admin/jobs', <AppRoutes.JobBoard />),
      },
    ],
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
