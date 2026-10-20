/**
 * Authentication links can come from transactional email. Keep their return target
 * deliberately narrow so a crafted link cannot turn login into an open redirect.
 */
const CANDIDATE_RETURN_PATHS = new Set([
  '/candidate/dashboard',
  '/candidate/applications',
  '/candidate/interviews',
  '/candidate/offers',
]);

export const DEFAULT_CANDIDATE_RETURN_PATH = '/candidate/dashboard';

export const getSafeCandidateReturnPath = (value: string | null | undefined): string | undefined => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return undefined;
  const [path, query = ''] = value.split('?', 2);
  return CANDIDATE_RETURN_PATHS.has(path) ? `${path}${query ? `?${query}` : ''}` : undefined;
};

export const appendCandidateReturnPath = (path: string, returnTo?: string): string => {
  const safeReturnTo = getSafeCandidateReturnPath(returnTo);
  if (!safeReturnTo) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}returnTo=${encodeURIComponent(safeReturnTo)}`;
};
