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
  import('@/features/landing/LandingPage').then((m: any) => ({ default: m.default || m.LandingPage }))
);
const LoginPage = React.lazy(() =>
  import('@/features/auth/LoginPage').then((m: any) => ({ default: m.default || m.LoginPage }))
);
const RegisterPage = React.lazy(() =>
  import('@/features/auth/RegisterPage').then((m: any) => ({ default: m.default || m.RegisterPage }))
);
const ContactPage = React.lazy(() =>
  import('@/features/contact/ContactPage').then((m: any) => ({ default: m.default || m.ContactPage }))
);
const VerifyOtpPage = React.lazy(() =>
  import('@/features/auth/VerifyOtpPage').then((m: any) => ({ default: m.default || m.VerifyOtpPage }))
);
const Dashboard = React.lazy(() =>
  import('@/features/dashboard/Dashboard').then((m: any) => ({ default: m.default || m.Dashboard }))
);
const CVBuilder = React.lazy(() =>
  import('@/features/candidates/CVBuilder').then((m: any) => ({ default: m.default || m.CVBuilder }))
);
const CandidateProfilePage = React.lazy(() =>
  import('@/features/candidates/CandidateProfilePage').then((m: any) => ({ default: m.default || m.CandidateProfilePage }))
);
const CandidateSavedJobsPage = React.lazy(() =>
  import('@/features/candidates/CandidateSavedJobsPage').then((m: any) => ({ default: m.default || m.CandidateSavedJobsPage }))
);
const CandidateInterviewDetailPage = React.lazy(() =>
  import('@/features/candidates/CandidateInterviewDetailPage').then((m: any) => ({ default: m.default || m.CandidateInterviewDetailPage }))
);
const PlacementDetailPage = React.lazy(() =>
  import('@/features/finance-mf05/PlacementDetailPage').then((m: any) => ({ default: m.default || m.PlacementDetailPage }))
);
// ── Admin console pages backed by the real API (features/admin-console) ──────
const ConsoleOverviewPage = React.lazy(() =>
  import('@/features/admin-console/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage }))
);
const ConsoleApprovalsPage = React.lazy(() =>
  import('@/features/admin-console/AdminApprovalsPage').then((m) => ({ default: m.AdminApprovalsPage }))
);
const ConsoleIdentityClaimsPage = React.lazy(() =>
  import('@/features/admin-console/AdminIdentityClaimsPage').then((m) => ({ default: m.AdminIdentityClaimsPage }))
);
const ConsoleIdentityClaimDetailPage = React.lazy(() =>
  import('@/features/admin-console/AdminIdentityClaimDetailPage').then((m) => ({ default: m.AdminIdentityClaimDetailPage }))
);
const ConsoleUsersPage = React.lazy(() =>
  import('@/features/admin-console/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);
const ConsoleServiceTypesPage = React.lazy(() =>
  import('@/features/admin-console/AdminServiceTypesPage').then((m) => ({ default: m.AdminServiceTypesPage }))
);
const ConsoleCommissionRulesPage = React.lazy(() =>
  import('@/features/admin-console/AdminCommissionRulesPage').then((m) => ({ default: m.AdminCommissionRulesPage }))
);
const ConsoleAuditLogPage = React.lazy(() =>
  import('@/features/admin-console/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage }))
);
const ConsoleProfilePage = React.lazy(() =>
  import('@/features/admin-console/AdminProfileAndPlaceholders').then((m) => ({ default: m.AdminProfilePage }))
);
const ConsoleDisputesPlaceholder = React.lazy(() =>
  import('@/features/admin-console/AdminProfileAndPlaceholders').then((m) => ({ default: m.AdminDisputesPlaceholder }))
);
const ConsolePayoutsPlaceholder = React.lazy(() =>
  import('@/features/finance-mf05/AdminFinancePage').then((m) => ({ default: m.AdminFinancePage }))
);
const ConsoleSettingsPlaceholder = React.lazy(() =>
  import('@/features/admin-console/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage }))
);
const ConsoleRolesPermissionsPage = React.lazy(() =>
  import('@/features/admin-console/AdminRolesPermissionsPage').then((m) => ({ default: m.AdminRolesPermissionsPage }))
);
const ConsoleUserAuthorizationPage = React.lazy(() =>
  import('@/features/admin-console/AdminUserAuthorizationPage').then((m) => ({ default: m.AdminUserAuthorizationPage }))
);
const AdminContactRequestsPage = React.lazy(() =>
  import('@/features/admin-console/AdminContactRequestsPage').then((m) => ({ default: m.AdminContactRequestsPage }))
);
const AdminReportsPage = React.lazy(() =>
  import('@/features/admin-console/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage }))
);

// ── Candidate & Affiliate workspaces (features/portal), MF-02 on the real API ──
const CandidateHomePage = React.lazy(() => import('@/features/portal/CandidatePages').then((m) => ({ default: m.CandidateHomePage })));
const CandidateJobsPage = React.lazy(() =>
  import('@/features/portal/candidate/CandidateJobPages').then((m) => ({ default: m.CandidateJobsPage }))
);
const CandidateJobDetailPage = React.lazy(() =>
  import('@/features/portal/candidate/CandidateJobPages').then((m) => ({ default: m.CandidateJobDetailPage }))
);
const CandidateMyApplicationsPage = React.lazy(() =>
  import('@/features/portal/CandidatePages').then((m) => ({ default: m.CandidateApplicationsPage }))
);
const CandidateApplicationDetailPage = React.lazy(() =>
  import('@/features/portal/CandidatePages').then((m) => ({ default: m.CandidateApplicationDetailPage }))
);
const CandidateSubmissionConsentPage = React.lazy(() =>
  import('@/features/portal/CandidateSubmissionConsentPage').then((m) => ({ default: m.CandidateSubmissionConsentPage }))
);
const PublicSubmissionConsentPage = React.lazy(() =>
  import('@/features/portal/PublicSubmissionConsentPage').then((m) => ({ default: m.PublicSubmissionConsentPage }))
);
const CandidateCvsPage = React.lazy(() => import('@/features/portal/CandidatePages').then((m) => ({ default: m.CandidateCvsPage })));
const CandidateAffiliateCvsPage = React.lazy(() =>
  import('@/features/portal/CandidateAffiliateCvsPage').then((m) => ({ default: m.CandidateAffiliateCvsPage }))
);
const CandidateAffiliateCvDetailPage = React.lazy(() =>
  import('@/features/portal/CandidateAffiliateCvsPage').then((m) => ({ default: m.CandidateAffiliateCvDetailPage }))
);
const CandidateIdentityPage = React.lazy(() =>
  import('@/features/portal/CandidateIdentityPage').then((m) => ({ default: m.CandidateIdentityPage }))
);
const AffiliateHomePage = React.lazy(() => import('@/features/portal/AffiliatePages').then((m) => ({ default: m.AffiliateHomePage })));
const AffiliateSubmitPage = React.lazy(() => import('@/features/portal/AffiliatePages').then((m) => ({ default: m.AffiliateSubmitPage })));
const AffiliateMySubmissionsPage = React.lazy(() =>
  import('@/features/portal/AffiliatePages').then((m) => ({ default: m.AffiliateSubmissionsPage }))
);
const AffiliateSubmissionDetailPage = React.lazy(() =>
  import('@/features/portal/AffiliatePages').then((m) => ({ default: m.AffiliateSubmissionDetailPage }))
);
const AffiliateCandidatesPage = React.lazy(() => import('@/features/portal/AffiliatePages').then((m) => ({ default: m.AffiliateCandidatesPage })));
const AffiliateAttributionsPage = React.lazy(() =>
  import('@/features/portal/AffiliatePages').then((m) => ({ default: m.AffiliateAttributionsPage }))
);
const AffiliateProfilePage = React.lazy(() =>
  import('@/features/portal/AffiliateProfilePage').then((m) => ({ default: m.AffiliateProfilePage }))
);
const AffiliatePerformancePage = React.lazy(() =>
  import('@/features/portal/AffiliatePerformancePage').then((m) => ({ default: m.AffiliatePerformancePage }))
);
const AffiliateDisputesPage = React.lazy(() =>
  import('@/features/portal/AffiliateDisputesPage').then((m) => ({ default: m.AffiliateDisputesPage }))
);
const AffiliateCommissionsPlaceholder = React.lazy(() =>
  import('@/features/finance-mf05/AffiliateCommissionsPage').then((m) => ({ default: m.AffiliateCommissionsPage }))
);

// ── Client Company workspace (features/client-console), backed by the real API ──
const ClientOverviewPage = React.lazy(() =>
  import('@/features/client-console/ClientOverviewPage').then((m) => ({ default: m.ClientOverviewPage }))
);
const ClientCandidatesPage = React.lazy(() =>
  import('@/features/client-console/ClientCandidatesPage').then((m) => ({ default: m.ClientCandidatesPage }))
);
const ClientWorkspaceInterviewsOffersPage = React.lazy(() =>
  import('@/features/client-console/ClientMorePages').then((m) => ({ default: m.ClientInterviewsOffersPage }))
);
const ClientCompanyPage = React.lazy(() =>
  import('@/features/client-console/ClientMorePages').then((m) => ({ default: m.ClientCompanyPage }))
);
const ClientWarrantyPlaceholder = React.lazy(() =>
  import('@/features/finance-mf05/WarrantyPages').then((m) => ({ default: m.ClientWarrantyPage }))
);
const ClientJobSourcingDeliveriesPage = React.lazy(() =>
  import('@/features/sourcing/ClientJobSourcingDeliveriesPage').then((m) => ({ default: m.ClientJobSourcingDeliveriesPage }))
);

// ── Internal HR workspace (features/hr-console), backed by the real API ─────
const HrOverviewPage = React.lazy(() =>
  import('@/features/hr-console/HrOverviewPage').then((m) => ({ default: m.HrOverviewPage }))
);
const HrScreeningPage = React.lazy(() =>
  import('@/features/hr-console/HrScreeningPage').then((m) => ({ default: m.HrScreeningPage }))
);
const HrPipelinePage = React.lazy(() =>
  import('@/features/hr-console/HrPipelinePage').then((m) => ({ default: m.HrPipelinePage }))
);
const HrProfilePage = React.lazy(() =>
  import('@/features/hr-console/HrProfileAndPlaceholders').then((m) => ({ default: m.HrProfilePage }))
);
const HrPlacementStartDateCorrectionPage = React.lazy(() =>
  import('@/features/hr-console/HrPlacementStartDateCorrectionPage').then((m) => ({ default: m.HrPlacementStartDateCorrectionPage }))
);
const HrWarrantyPlaceholder = React.lazy(() =>
  import('@/features/finance-mf05/WarrantyPages').then((m) => ({ default: m.HrWarrantyPage }))
);

// ── MF-01 pages backed by the real API (features/jobs-mf01) ──────────────────
const Mf01ClientJobsListPage = React.lazy(() =>
  import('@/features/jobs-mf01/ClientJobsListPage').then((m) => ({ default: m.ClientJobsListPage }))
);
const Mf01JobFormPage = React.lazy(() =>
  import('@/features/jobs-mf01/JobFormPage').then((m) => ({ default: m.JobFormPage }))
);
const Mf01JobReviewPage = React.lazy(() =>
  import('@/features/jobs-mf01/JobReviewPage').then((m) => ({ default: m.JobReviewPage }))
);
const Mf01JobTemplatesAdminPage = React.lazy(() =>
  import('@/features/jobs-mf01/JobTemplatesAdminPage').then((m) => ({ default: m.JobTemplatesAdminPage }))
);
const Mf01InAppJobDiscoveryPage = React.lazy(() =>
  import('@/features/jobs-mf01/PublicJobPages').then((m) => ({ default: m.InAppJobDiscoveryPage }))
);
const Mf01PublicJobSearchPage = React.lazy(() =>
  import('@/features/jobs-mf01/PublicJobPages').then((m) => ({ default: m.PublicJobSearchPage }))
);
const Mf01AffiliateJobDetailPage = React.lazy(() =>
  import('@/features/jobs-mf01/PublicJobPages').then((m) => ({ default: m.AffiliateJobDetailPage }))
);
const Mf01PublicJobDetailPage = React.lazy(() =>
  import('@/features/jobs-mf01/PublicJobPages').then((m) => ({ default: m.PublicJobDetailPage }))
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
  /** Backend permission claims required by this screen. */
  requiredPermissions?: string[];
  permissionMode?: 'all' | 'any';
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
  requiredPermissions = [],
  permissionMode = 'all',
}) => {
  const { role, isAuthenticated, user, hasAnyRole } = useAuthStore();
  const location = useLocation();

  // Unauthenticated user trying to access any protected route
  if (!isAuthenticated || !user) {
    const target = redirectTo ?? '/login';
    return <Navigate to={target} state={{ from: location.pathname }} replace />;
  }

  // Authenticated but wrong role
  if (!hasAnyRole(requiredRoles)) {
    const target = redirectTo ?? getDashboardRouteForRole(role);
    return <Navigate to={target} replace />;
  }

  const permissions = user.permissions ?? [];
  const hasRequiredPermissions =
    requiredPermissions.length === 0 ||
    (permissionMode === 'any'
      ? requiredPermissions.some((permission) => permissions.includes(permission))
      : requiredPermissions.every((permission) => permissions.includes(permission)));

  if (!hasRequiredPermissions) {
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
  '/client/jobs/:id/edit': [UserRole.CLIENT],
  '/client/jobs/:id/sourcing': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/jobs/:jobId/sourcing': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/post-job': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/candidates': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/interviews-offers': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/warranty': [UserRole.CLIENT, UserRole.ADMIN],
  '/client/company': [UserRole.CLIENT],
  '/affiliate/dashboard': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/hr/dashboard': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/jobs': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/contact-requests': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/job-templates': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/candidates': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/screening': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/interviews': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/offers': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/warranty-tracking': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/pipeline': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/profile': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/hr/placement-review': [UserRole.INTERNAL_HR, UserRole.ADMIN],
  '/candidate/dashboard': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/jobs': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/jobs/:jobId': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/profile': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/profile': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/applications': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/applications/:applicationId': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/submission-consents/:submissionId': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/saved-jobs': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/cvs': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/affiliate-cvs': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/affiliate-cvs/:cvId': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/candidate/settings/email-identities': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/affiliate/attributions': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/profile': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/jobs': [
    UserRole.CLIENT,
    UserRole.AFFILIATE,
    UserRole.INTERNAL_HR,
    UserRole.ADMIN,
    UserRole.CANDIDATE,
  ],
  '/jobs/create': [UserRole.CLIENT, UserRole.ADMIN],
  '/affiliate/referral': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/refer': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/submit-candidate': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/jobs': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/jobs/:jobId': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/submissions': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/submissions/:submissionId': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/candidates': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/performance': [UserRole.AFFILIATE, UserRole.ADMIN],
  '/affiliate/disputes': [UserRole.AFFILIATE, UserRole.ADMIN],
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
  '/admin/approvals': [UserRole.ADMIN],
  '/admin/jobs': [UserRole.ADMIN],
  '/admin/job-templates': [UserRole.ADMIN],
  '/admin/candidate-identity-claims': [UserRole.ADMIN],
  '/admin/candidate-identity-claims/:claimId': [UserRole.ADMIN],
  '/admin/service-types': [UserRole.ADMIN],
  '/admin/commission-rules': [UserRole.ADMIN],
  '/admin/roles-permissions': [UserRole.ADMIN],
  '/admin/user-authorization': [UserRole.ADMIN],
  '/admin/contact-requests': [UserRole.ADMIN],
  '/admin/reports': [UserRole.ADMIN],
  '/admin/profile': [UserRole.ADMIN],
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
  CVBuilder,
  CandidateProfilePage,
  CandidateSavedJobsPage,
  CandidateInterviewDetailPage,
  PlacementDetailPage,
  VerifyOtpPage,
  Mf01ClientJobsListPage,
  Mf01JobFormPage,
  Mf01JobReviewPage,
  Mf01JobTemplatesAdminPage,
  Mf01InAppJobDiscoveryPage,
  Mf01PublicJobSearchPage,
  Mf01PublicJobDetailPage,
  Mf01AffiliateJobDetailPage,
  ConsoleOverviewPage,
  ConsoleApprovalsPage,
  ConsoleIdentityClaimsPage,
  ConsoleIdentityClaimDetailPage,
  ConsoleUsersPage,
  ConsoleRolesPermissionsPage,
  ConsoleUserAuthorizationPage,
  ConsoleServiceTypesPage,
  ConsoleCommissionRulesPage,
  ConsoleAuditLogPage,
  ConsoleProfilePage,
  ConsoleDisputesPlaceholder,
  ConsolePayoutsPlaceholder,
  ConsoleSettingsPlaceholder,
  AdminContactRequestsPage,
  AdminReportsPage,
  ContactPage,
  CandidateHomePage,
  CandidateJobsPage,
  CandidateJobDetailPage,
  CandidateMyApplicationsPage,
  CandidateApplicationDetailPage,
  CandidateSubmissionConsentPage,
  PublicSubmissionConsentPage,
  CandidateCvsPage,
  CandidateAffiliateCvsPage,
  CandidateAffiliateCvDetailPage,
  CandidateIdentityPage,
  AffiliateHomePage,
  AffiliateSubmitPage,
  AffiliateMySubmissionsPage,
  AffiliateSubmissionDetailPage,
  AffiliateCandidatesPage,
  AffiliateAttributionsPage,
  AffiliateProfilePage,
  AffiliatePerformancePage,
  AffiliateDisputesPage,
  AffiliateCommissionsPlaceholder,
  ClientOverviewPage,
  ClientCandidatesPage,
  ClientWorkspaceInterviewsOffersPage,
  ClientCompanyPage,
  ClientWarrantyPlaceholder,
  ClientJobSourcingDeliveriesPage,
  HrOverviewPage,
  HrScreeningPage,
  HrPipelinePage,
  HrProfilePage,
  HrPlacementStartDateCorrectionPage,
  HrWarrantyPlaceholder,
} as const;
