/**
 * @file routeHelpers.ts
 * @description Centralized role-to-dashboard routing helpers.
 * Extracted from AppRoutes to eliminate circular dependencies.
 */
import { UserRole } from '@/types/roles';

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
