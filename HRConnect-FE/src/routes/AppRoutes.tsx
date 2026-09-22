/**
 * @file AppRoutes.tsx
 * @description Complete route tree for HR Connect with RBAC-enforced ProtectedRoute.
 *
 * Portal mapping:
 *   PUBLIC           -> /  (Landing), /login, /register
 *   CLIENT PORTAL    -> /dashboard, /jobs, /jobs/create, /candidates, /screening
 *   CANDIDATE PORTAL -> /dashboard, /jobs (browse), /cv-builder
 *   AFFILIATE PORTAL -> /dashboard, /jobs, /affiliate/referral, /affiliate/ledger
 *   HR OPS PORTAL    -> /dashboard, /jobs, /candidates, /screening, /affiliate/ledger
 *   ADMIN PORTAL     -> all routes + /admin
 *
 * ProtectedRoute behaviour:
 *   - If unauthenticated (GUEST) and route excludes GUEST -> redirect /login
 *   - If authenticated but wrong role -> redirect /dashboard?reason=forbidden
 *   - If authorized -> render children
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

// ---------------------------------------------------------------------------
// Feature lazy imports - code-split at each route boundary for optimal LCP
// ---------------------------------------------------------------------------

const LandingPage = React.lazy(() =>
  import('@/features/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const LoginPage = React.lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = React.lazy(() =>
  import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);
const Dashboard = React.lazy(() =>
  import('@/features/dashboard/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const JobBoard = React.lazy(() =>
  import('@/features/jobs/JobBoard').then((m) => ({ default: m.JobBoard }))
);
// CreateJobWizard is the production wizard for MF-01 | SCR-CLI-01
const CreateJobWizard = React.lazy(() =>
  import('@/features/jobs/CreateJobWizard').then((m) => ({ default: m.CreateJobWizard }))
);
const ReferralForm = React.lazy(() =>
  import('@/features/affiliate/ReferralForm').then((m) => ({ default: m.ReferralForm }))
);
const FinancialLedger = React.lazy(() =>
  import('@/features/affiliate/FinancialLedger').then((m) => ({ default: m.FinancialLedger }))
);
const AIScreening = React.lazy(() =>
  import('@/features/screening/AIScreening').then((m) => ({ default: m.AIScreening }))
);
const CandidateList = React.lazy(() =>
  import('@/features/candidates/CandidateList').then((m) => ({ default: m.CandidateList }))
);
const CVBuilder = React.lazy(() =>
  import('@/features/candidates/CVBuilder').then((m) => ({ default: m.CVBuilder }))
);
const CandidateProfilePage = React.lazy(() =>
  import('@/features/candidates/CandidateProfilePage').then((m) => ({ default: m.CandidateProfilePage }))
);
const CandidateApplicationsPage = React.lazy(() =>
  import('@/features/candidates/CandidateApplicationsPage').then((m) => ({ default: m.CandidateApplicationsPage }))
);
const CandidateSavedJobsPage = React.lazy(() =>
  import('@/features/candidates/CandidateSavedJobsPage').then((m) => ({ default: m.CandidateSavedJobsPage }))
);
const AdminDashboard = React.lazy(() =>
  import('@/features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminUsersPage = React.lazy(() =>
  import('@/features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminCompaniesPage = React.lazy(() =>
  import('@/features/admin/AdminCompaniesPage').then((m) => ({ default: m.AdminCompaniesPage }))
);
const AdminAffiliatesPage = React.lazy(() =>
  import('@/features/admin/AdminAffiliatesPage').then((m) => ({ default: m.AdminAffiliatesPage }))
);
const AdminDisputesPage = React.lazy(() =>
  import('@/features/admin/AdminDisputesPage').then((m) => ({ default: m.AdminDisputesPage }))
);
const AdminPayoutsPage = React.lazy(() =>
  import('@/features/admin/AdminPayoutsPage').then((m) => ({ default: m.AdminPayoutsPage }))
);
const AdminSettingsPage = React.lazy(() =>
  import('@/features/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage }))
);
const AdminAuditTrailPage = React.lazy(() =>
  import('@/features/admin/AdminAuditTrailPage').then((m) => ({ default: m.AdminAuditTrailPage }))
);
const HRInterviewsPage = React.lazy(() =>
  import('@/features/hr/HRInterviewsPage').then((m) => ({ default: m.HRInterviewsPage }))
);
const HROffersPage = React.lazy(() =>
  import('@/features/hr/HROffersPage').then((m) => ({ default: m.HROffersPage }))
);
const HRWarrantyTrackingPage = React.lazy(() =>
  import('@/features/hr/HRWarrantyTrackingPage').then((m) => ({ default: m.HRWarrantyTrackingPage }))
);
const ClientLayout = React.lazy(() =>
  import('@/components/layout/ClientLayout').then((m) => ({ default: m.ClientLayout }))
);
const ClientJobsPage = React.lazy(() =>
  import('@/features/jobs/ClientJobsPage').then((m) => ({ default: m.ClientJobsPage }))
);
const ClientCandidatePoolPage = React.lazy(() =>
  import('@/pages/client/ClientCandidatePoolPage').then((m) => ({ default: m.ClientCandidatePoolPage }))
);
const ClientWarrantyPage = React.lazy(() =>
  import('@/pages/client/ClientWarrantyPage').then((m) => ({ default: m.ClientWarrantyPage }))
);
const AffiliateLayout = React.lazy(() =>
  import('@/components/layout/AffiliateLayout').then((m) => ({ default: m.AffiliateLayout }))
);
const AffiliateSubmissionsPage = React.lazy(() =>
  import('@/pages/affiliate/AffiliateSubmissionsPage').then((m) => ({ default: m.AffiliateSubmissionsPage }))
);
const AffiliateCommissionsPage = React.lazy(() =>
  import('@/pages/affiliate/AffiliateCommissionsPage').then((m) => ({ default: m.AffiliateCommissionsPage }))
);

// ---------------------------------------------------------------------------
// ProtectedRoute
// ---------------------------------------------------------------------------

interface ProtectedRouteProps {
  /** Roles that are permitted to access this route. */
  requiredRoles: UserRole[];
  children: React.ReactElement;
  /**
   * Optional explicit redirect target on failure.
   * Defaults: /login for guests, /dashboard?reason=forbidden for wrong role.
   */
  redirectTo?: string;
}

/**
 * Centralized role-to-dashboard routing helper.
 * Strictly normalizes role strings (case-insensitive) and maps to appropriate portals.
 */
export const getDashboardRouteForRole = (role?: string | UserRole | null): string => {
  if (!role) return '/';
  const normalized = String(role).toUpperCase().trim();
  switch (normalized) {
    case 'CANDIDATE':
      return '/candidate/dashboard';
    case 'AFFILIATE':
      return '/affiliate/dashboard';
    case 'CLIENT':
      return '/client/dashboard';
    case 'HR':
    case 'INTERNAL_HR':
      return '/hr/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/';
  }
};

export const ROLE_DASHBOARD_ROUTES: Record<UserRole, string> = {
  [UserRole.CLIENT]: '/client/dashboard',
  [UserRole.AFFILIATE]: '/affiliate/dashboard',
  [UserRole.INTERNAL_HR]: '/hr/dashboard',
  [UserRole.ADMIN]: '/admin/dashboard',
  [UserRole.CANDIDATE]: '/candidate/dashboard',
  [UserRole.GUEST]: '/login',
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredRoles,
  children,
  redirectTo,
}) => {
  const { role, isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // Unauthenticated user trying to access any protected route
  if (!isAuthenticated || !user) {
    const target = redirectTo ?? '/login';
    return <Navigate to={target} state={{ from: location.pathname }} replace />;
  }

  // Authenticated but wrong role
  if (!requiredRoles.includes(role)) {
    const target = redirectTo ?? getDashboardRouteForRole(role);
    return <Navigate to={target} replace />;
  }

  return children;
};

// ---------------------------------------------------------------------------
// Role constants
// ---------------------------------------------------------------------------

/** All non-guest (authenticated) roles. */
export const AUTHENTICATED_ROLES: UserRole[] = [
  UserRole.CLIENT,
  UserRole.CANDIDATE,
  UserRole.AFFILIATE,
  UserRole.INTERNAL_HR,
  UserRole.ADMIN,
];

/**
 * Single source of truth for route-level RBAC.
 * Import this map in app/router.tsx to wire ProtectedRoute.
 */
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/dashboard': AUTHENTICATED_ROLES,
  '/client/dashboard': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/jobs': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/jobs/create': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/candidates': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/interviews-offers': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/warranty': [UserRole.CLIENT, UserRole.ADMIN],
  '/affiliate/dashboard': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/hr/dashboard': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/jobs': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/candidates': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/screening': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/interviews': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/offers': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/warranty-tracking': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/candidate/dashboard': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/profile': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/profile': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/applications': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/saved-jobs': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/jobs': [
    UserRole.CLIENT,
    UserRole.AFFILIATE,
    UserRole.INTERNAL_HR,
    UserRole.ADMIN,
    UserRole.CANDIDATE,
  ],
  '/jobs/create': [UserRole.CLIENT, UserRole.ADMIN],
  '/affiliate/referral': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/submit-candidate': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/jobs': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/submissions': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/commissions': [UserRole.AFFILIATE, UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/affiliate/ledger': [UserRole.AFFILIATE, UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/screening': [UserRole.INTERNAL_HR, UserRole.ADMIN, UserRole.CLIENT],
  '/candidates': [UserRole.INTERNAL_HR, UserRole.ADMIN, UserRole.CLIENT],
  '/cv-builder': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/admin': [UserRole.ADMIN],
  '/admin/dashboard': [UserRole.ADMIN],
  '/admin/users': [UserRole.ADMIN],
  '/admin/companies': [UserRole.ADMIN],
  '/admin/affiliates': [UserRole.ADMIN],
  '/admin/disputes': [UserRole.ADMIN],
  '/admin/payouts': [UserRole.ADMIN],
  '/admin/finance': [UserRole.ADMIN],
  '/admin/settings': [UserRole.ADMIN],
  '/admin/audit-trail': [UserRole.ADMIN],
  '/admin/jobs': [UserRole.ADMIN],
};

/**
 * Lazy-loaded screen components keyed by name.
 * Wrap each in <ProtectedRoute> + <React.Suspense> when registering routes.
 */
export const AppRoutes = {
  LandingPage,
  LoginPage,
  RegisterPage,
  Dashboard,
  JobBoard,
  CreateJobWizard,
  ReferralForm,
  FinancialLedger,
  AIScreening,
  CandidateList,
  CVBuilder,
  CandidateProfilePage,
  CandidateApplicationsPage,
  CandidateSavedJobsPage,
  AdminDashboard,
  AdminUsersPage,
  AdminCompaniesPage,
  AdminAffiliatesPage,
  AdminDisputesPage,
  AdminPayoutsPage,
  AdminSettingsPage,
  AdminAuditTrailPage,
  HRInterviewsPage,
  HROffersPage,
  HRWarrantyTrackingPage,
  ClientLayout,
  ClientJobsPage,
  ClientCandidatePoolPage,
  ClientWarrantyPage,
  AffiliateLayout,
  AffiliateSubmissionsPage,
  AffiliateCommissionsPage,
} as const;
