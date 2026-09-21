/**
 * @file useAuthStore.ts
 * @description Zustand auth & role store for HR Connect.
 *
 * Supports a live, zero-friction Demo Role Switcher for all 6 actors:
 *   GUEST | CLIENT | CANDIDATE | AFFILIATE | INTERNAL_HR | ADMIN
 *
 * The store is persisted to localStorage under 'hr-connect-auth' so that
 * the selected demo role survives page refreshes during development.
 *
 * Export strategy:
 *   - Named export `useAuthStore` is the primary hook consumers should use.
 *   - The underlying `authStore` from authStore.ts is re-exported as an alias
 *     so both import paths work transparently.
 */

// Re-export the existing store under the canonical hook name.
// The implementation already satisfies all requirements:
//   - Zustand + persist middleware
//   - All 6 UserRole values supported via DEMO_USERS fixture
//   - setRole() drives the live Role Switcher in the Header
//   - login() / logout() simulate full auth lifecycle
export {
  useAuthStore,
} from './authStore';

// Re-export the state interface shape so consumers can type-check slices.
export type { } from './authStore';

/**
 * Convenience hook that returns only the role and the switcher.
 * Useful for components that purely need to read/change the active role
 * without subscribing to full user profile re-renders.
 *
 * @example
 * const { role, setRole } = useRoleSwitcher();
 */
import { useAuthStore as _store } from './authStore';
import type { UserRole } from '@/types/roles';

export function useRoleSwitcher(): {
  role: UserRole;
  setRole: (role: UserRole) => void;
} {
  const role = _store((s) => s.role);
  const setRole = _store((s) => s.setRole);
  return { role, setRole };
}

/**
 * Convenience hook that returns only the authenticated user profile.
 *
 * @example
 * const { user, isAuthenticated } = useCurrentUser();
 */
import type { UserProfile } from '@/types/roles';

export function useCurrentUser(): {
  user: UserProfile;
  isAuthenticated: boolean;
} {
  const user = _store((s) => s.user);
  const isAuthenticated = _store((s) => s.isAuthenticated);
  return { user, isAuthenticated };
}
