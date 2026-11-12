/**
 * @file routePrefetch.ts
 * @description Intelligent route and chunk pre-fetching service for instant page transitions.
 * Eliminates the ~0.5s white-screen chunk download delay by fetching code bundles
 * during idle time or immediately on link hover/focus.
 */

type RouteLoader = () => Promise<unknown>;

const PREFETCH_REGISTRY: Record<string, RouteLoader> = {
  '/': () => import('@/features/landing/LandingPage'),
  '/jobs': () => import('@/features/jobs-mf01/PublicJobPages'),
  '/companies': () => import('@/features/landing/CompanyPages'),
  '/contact': () => import('@/features/contact/ContactPage'),
  '/candidate/cv-builder': () => import('@/features/portal/candidate/cv-builder/CandidateCvBuilderPage'),
  '/candidate/applications': () => import('@/features/portal/CandidateApplicationsPage'),
  '/candidate/cvs': () => import('@/features/portal/CandidateCvsPage'),
  '/candidate/affiliate-cvs': () => import('@/features/portal/CandidateAffiliateCvsPage'),
  '/candidate/profile': () => import('@/features/candidates/CandidateProfilePage'),
  '/candidate/saved-jobs': () => import('@/features/candidates/CandidateSavedJobsPage'),
  '/login': () => import('@/features/auth/LoginPage'),
  '/register': () => import('@/features/auth/RegisterPage'),
};

const prefetchedCache = new Set<string>();

/**
 * Pre-fetches a route's code chunk into browser cache if not already loaded.
 * Safe to call repeatedly; subsequent calls are no-ops.
 */
export function prefetchRoute(to: string): void {
  // Normalize path without query/hash
  const path = to.split('?')[0].split('#')[0];
  if (prefetchedCache.has(path)) return;

  const loader = PREFETCH_REGISTRY[path];
  if (loader) {
    prefetchedCache.add(path);
    // Fire and catch errors silently (network failure or aborted request shouldn't crash app)
    loader().catch(() => {
      prefetchedCache.delete(path);
    });
  }
}

/**
 * Pre-fetches the most common candidate & public routes during idle time.
 */
export function prefetchCommonRoutes(isCandidate: boolean): void {
  const commonRoutes = isCandidate
    ? ['/jobs', '/companies', '/candidate/cv-builder', '/candidate/applications', '/candidate/profile', '/candidate/saved-jobs', '/candidate/cvs']
    : ['/jobs', '/companies', '/contact', '/login', '/register'];

  const runPrefetch = () => {
    commonRoutes.forEach((route, idx) => {
      setTimeout(() => prefetchRoute(route), idx * 40);
    });
  };

  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(runPrefetch, { timeout: 800 });
    } else {
      setTimeout(runPrefetch, 50);
    }
  }
}

