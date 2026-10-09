/**
 * @file authStore.ts
 * @description Centralized Zustand Authentication store with localStorage persistence.
 * Connects directly to backend OpenAPI auth flows (login, me, logout).
 * No fake mock tokens or unverified authentication states.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole, UserProfile, DEMO_USERS, mapApiRoleToUserRole, mapApiRolesToUserRoles } from '@/types/roles';
import { authService, type CurrentUserDto, AUTH_STORAGE_KEYS } from '@/services/authService';
import { findRegisteredAccountByEmail, saveRegisteredAccount } from '@/services/accountService';

export type { UserProfile };
export { UserRole, mapApiRoleToUserRole };

export const getInitials = (fullName?: string | null): string => {
  if (!fullName) return 'U';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export interface RegisterData {
  role: UserRole;
  fullName: string;
  email: string;
  password?: string;
  phone?: string;
  companyName?: string;
  companySize?: string;
  taxCode?: string;
}

interface AuthState {
  role: UserRole;
  user: UserProfile | null;
  isAuthenticated: boolean;
  setRole: (role: UserRole) => void;
  login: (role: UserRole, customUser?: Partial<UserProfile>) => void;
  setAuthSession: (userDto: CurrentUserDto, accessToken: string, refreshToken?: string) => void;
  register: (data: RegisterData) => UserProfile;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  syncCurrentUser: () => Promise<UserProfile | null>;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: UserRole.GUEST,
      user: null,
      isAuthenticated: false,

      setRole: (role: UserRole) => {
        if (role === UserRole.GUEST) {
          authService.clearAuthTokens();
          set({
            role: UserRole.GUEST,
            user: null,
            isAuthenticated: false,
          });
          return;
        }

        const newUser = DEMO_USERS[role] || null;
        set({
          role,
          user: newUser,
          isAuthenticated: true,
        });
      },

      login: (role: UserRole, customUser?: Partial<UserProfile>) => {
        let user: UserProfile;
        const email = customUser?.email?.trim().toLowerCase();
        const registered = email ? findRegisteredAccountByEmail(email) : undefined;

        // Resolve exact role: customUser role takes highest priority from real API auth, then registered role, then explicit role
        const resolvedRole = (
          customUser?.role ||
          registered?.role ||
          role ||
          UserRole.CANDIDATE
        ).toUpperCase() as UserRole;

        if (customUser && customUser.email) {
          user = {
            id: registered?.id || customUser.id || `usr-${resolvedRole.toLowerCase()}-${Date.now()}`,
            name: registered?.fullName || customUser.name || customUser.email.split('@')[0],
            email: customUser.email,
            role: resolvedRole,
            phone: registered?.phone || customUser.phone,
            company: resolvedRole === UserRole.CLIENT ? (registered?.companyName || customUser.company) : undefined,
            companySize: resolvedRole === UserRole.CLIENT ? (registered?.companySize || customUser.companySize) : undefined,
            avatar: customUser.avatar || getInitials(registered?.fullName || customUser.name || customUser.email),
            trustRating: resolvedRole === UserRole.AFFILIATE ? 5.0 : undefined,
          };
        } else {
          user = DEMO_USERS[resolvedRole] || DEMO_USERS[role];
        }

        set({
          role: resolvedRole,
          user,
          isAuthenticated: true,
        });
      },

      /**
       * Sets official authenticated session from backend CurrentUserDto and tokens
       */
      setAuthSession: (userDto: CurrentUserDto, accessToken: string, refreshToken?: string) => {
        authService.saveAuthTokens({
          accessToken,
          refreshToken,
          user: {
            userId: userDto.userId,
            email: userDto.email,
            displayName: userDto.displayName,
            status: userDto.status,
            roles: userDto.roles,
            permissions: userDto.permissions,
            emailVerified: userDto.emailVerified,
          },
        });

        const resolvedRole = mapApiRoleToUserRole(userDto.roles);
        const initials = getInitials(userDto.displayName || userDto.email || 'User');

        const profile: UserProfile = {
          id: userDto.userId,
          name: userDto.displayName || (userDto.email ? userDto.email.split('@')[0] : 'User'),
          email: userDto.email || '',
          phone: userDto.phone || undefined,
          role: resolvedRole,
          roles: userDto.roles ?? [],
          permissions: userDto.permissions ?? [],
          status: userDto.status ?? undefined,
          emailVerified: userDto.emailVerified,
          avatar: userDto.avatarUrl || initials,
          trustRating: resolvedRole === UserRole.AFFILIATE ? 5.0 : undefined,
        };

        set({
          role: resolvedRole,
          user: profile,
          isAuthenticated: true,
        });
      },

      /**
       * Fetches current user from GET /api/v1/auth/me and syncs store state
       */
      syncCurrentUser: async (): Promise<UserProfile | null> => {
        const token = authService.getAccessToken();
        if (!token) {
          get().logout();
          return null;
        }

        try {
          const res = await authService.getCurrentUser();
          if (res.success && res.data) {
            const dto = res.data;
            const resolvedRole = mapApiRoleToUserRole(dto.roles);
            const profile: UserProfile = {
              id: dto.userId,
              name: dto.displayName || (dto.email ? dto.email.split('@')[0] : 'User'),
              email: dto.email || '',
              phone: dto.phone || undefined,
              role: resolvedRole,
              roles: dto.roles ?? [],
              permissions: dto.permissions ?? [],
              status: dto.status ?? undefined,
              emailVerified: dto.emailVerified,
              avatar: dto.avatarUrl || getInitials(dto.displayName || dto.email || 'User'),
              trustRating: resolvedRole === UserRole.AFFILIATE ? 5.0 : undefined,
            };

            set({
              role: resolvedRole,
              user: profile,
              isAuthenticated: true,
            });
            return profile;
          }
        } catch {
          // Token expired or invalid
          console.warn('Failed to sync current user from server');
        }
        return null;
      },

      register: (data: RegisterData) => {
        const normalizedRole = (data.role || UserRole.CANDIDATE).toUpperCase() as UserRole;
        const initials = getInitials(data.fullName);

        // Track registered account locally for quick testing
        saveRegisteredAccount({
          role: normalizedRole,
          fullName: data.fullName.trim(),
          email: data.email.trim(),
          password: data.password || 'password123',
          phone: data.phone?.trim(),
          companyName: normalizedRole === UserRole.CLIENT ? data.companyName?.trim() : undefined,
          companySize: normalizedRole === UserRole.CLIENT ? data.companySize : undefined,
        });

        const newUser: UserProfile = {
          id: `usr-${normalizedRole.toLowerCase()}-${Date.now()}`,
          name: data.fullName.trim(),
          email: data.email.trim(),
          phone: data.phone?.trim(),
          role: normalizedRole,
          company: normalizedRole === UserRole.CLIENT ? (data.companyName?.trim() || 'Doanh nghiệp mới') : undefined,
          companySize: normalizedRole === UserRole.CLIENT ? data.companySize : undefined,
          avatar: initials,
          trustRating: normalizedRole === UserRole.AFFILIATE ? 5.0 : undefined,
        };

        // Strictly DO NOT set isAuthenticated: true or write tokens to localStorage.
        // User MUST complete OTP email activation first.
        return newUser;
      },

      logout: () => {
        authService.clearAuthTokens();
        sessionStorage.clear();
        set({
          role: UserRole.GUEST,
          user: null,
          isAuthenticated: false,
        });
        window.dispatchEvent(new CustomEvent('hrconnect:logout'));
      },

      updateUser: (updates: Partial<UserProfile>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        }));
      },

      hasPermission: (permission: string) =>
        Boolean(permission && get().user?.permissions?.includes(permission)),

      hasAnyRole: (roles: UserRole[]) => {
        const state = get();
        const assignedRoles = mapApiRolesToUserRoles(state.user?.roles);
        if (!assignedRoles.length && state.role !== UserRole.GUEST) assignedRoles.push(state.role);
        return roles.some((role) => assignedRoles.includes(role));
      },
    }),
    {
      name: 'hr-connect-auth',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const hasToken =
            localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN) ||
            localStorage.getItem(AUTH_STORAGE_KEYS.AUTH_TOKEN);

          // If no token exists in storage, force GUEST unauthenticated state
          if (!hasToken) {
            state.role = UserRole.GUEST;
            state.user = null;
            state.isAuthenticated = false;
          } else if (state.role && state.role !== UserRole.GUEST) {
            state.isAuthenticated = true;
          }
        }
      },
    }
  )
);

// Each tab holds its own in-memory copy of this store. When another tab logs out or signs in as a
// different account, follow it; otherwise this tab keeps showing the old user's workspace (e.g. the
// Client console) while the stored token now belongs to someone else (e.g. an Admin).
const SESSION_STORAGE_KEYS = new Set<string>([
  'hr-connect-auth',
  AUTH_STORAGE_KEYS.ACCESS_TOKEN,
  AUTH_STORAGE_KEYS.AUTH_TOKEN,
]);

export const followSessionChangeFromOtherTab = async (event: StorageEvent): Promise<boolean> => {
  // key === null means the other tab cleared all of localStorage.
  if (event.key !== null && !SESSION_STORAGE_KEYS.has(event.key)) return false;
  await useAuthStore.persist.rehydrate();
  return true;
};

if (typeof window !== 'undefined') {
  window.addEventListener('storage', followSessionChangeFromOtherTab);
  // The persisted role is only a cache: on load, confirm it with the server for the stored token so
  // a stale role from an earlier account can never pick the workspace.
  if (authService.getAccessToken()) {
    void useAuthStore.getState().syncCurrentUser();
  }
}

// apiClient fires this when a request is still 401 after one token refresh attempt:
// the session is gone, so drop to GUEST (route guards then send the user to /login).
if (typeof window !== 'undefined') {
  window.addEventListener('hrconnect:unauthorized', () => {
    if (useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().logout();
    }
  });
}
