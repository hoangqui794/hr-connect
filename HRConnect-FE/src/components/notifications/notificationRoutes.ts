import { UserRole } from '@/types/roles';

const PUBLIC_JOB_ROUTE = /^\/jobs\/([^/?#]+)\/?$/;

/** Job page inside the signed-in user's own portal; guests keep the public job page. */
export function jobRouteForRole(jobId: string, role: UserRole | null | undefined): string {
  switch (role) {
    case UserRole.CLIENT:
      return `/client/jobs?highlight=${encodeURIComponent(jobId)}&openDetail=true`;
    case UserRole.CANDIDATE:
      return `/candidate/jobs/${jobId}`;
    case UserRole.AFFILIATE:
      return `/affiliate/jobs/${jobId}`;
    case UserRole.INTERNAL_HR:
      return '/hr/jobs';
    case UserRole.ADMIN:
      return '/admin/jobs';
    default:
      return `/jobs/${jobId}`;
  }
}

/**
 * Notifications often fall back to the public job page (/jobs/:id), which renders the
 * guest header. A signed-in user should stay in their portal, so remap that route.
 */
export function portalRoute(route: string, role: UserRole | null | undefined): string {
  const match = PUBLIC_JOB_ROUTE.exec(route);
  return match ? jobRouteForRole(decodeURIComponent(match[1]), role) : route;
}
