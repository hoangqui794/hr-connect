import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole, UserProfile, DEMO_USERS } from '@/types/roles';
import { resetAllAppStores } from '@/constants/mockConfig';
import { findRegisteredAccountByEmail, saveRegisteredAccount } from '@/services/accountService';

export type { UserProfile };

export const getInitials = (fullName: string): string => {
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
}

interface AuthState {
  role: UserRole;
  user: UserProfile | null;
  isAuthenticated: boolean;
  setRole: (role: UserRole) => void;
  login: (role: UserRole, customUser?: Partial<UserProfile>) => void;
  register: (data: RegisterData) => UserProfile;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: UserRole.GUEST,
      user: null,
      isAuthenticated: false,

      setRole: (role: UserRole) => {
        set({
          role,
          isAuthenticated: role !== UserRole.GUEST,
        });
      },

      login: (role: UserRole, customUser?: Partial<UserProfile>) => {
        let user: UserProfile;
        const email = customUser?.email?.trim().toLowerCase();
        const registered = email ? findRegisteredAccountByEmail(email) : undefined;

        // Resolve exact role: Registered role takes highest priority, then customUser role, then explicit role
        const resolvedRole = (registered?.role || customUser?.role || role || UserRole.CANDIDATE).toUpperCase() as UserRole;

        if (customUser && customUser.email) {
          user = {
            id: registered?.id || customUser.id || `usr-${resolvedRole.toLowerCase()}-${Date.now()}`,
            name: registered?.fullName || customUser.name || customUser.email.split('@')[0],
            email: customUser.email,
            role: resolvedRole,
            phone: registered?.phone || customUser.phone,
            // STRICT: Never assign company to non-CLIENT roles
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
        localStorage.setItem('auth_token', `token-${resolvedRole.toLowerCase()}-${Date.now()}`);
      },

      register: (data: RegisterData) => {
        const normalizedRole = (data.role || UserRole.CANDIDATE).toUpperCase() as UserRole;
        const initials = getInitials(data.fullName);

        // Persist into registered accounts storage
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

        set({
          role: normalizedRole,
          user: newUser,
          isAuthenticated: true,
        });
        localStorage.setItem('auth_token', `token-${normalizedRole.toLowerCase()}-${Date.now()}`);
        return newUser;
      },

      logout: () => {
        set({
          role: UserRole.GUEST,
          user: null,
          isAuthenticated: false,
        });
        resetAllAppStores();
        // Dispatch custom event for stores that need resetting in-memory
        window.dispatchEvent(new CustomEvent('hrconnect:logout'));
      },
    }),
    {
      name: 'hr-connect-auth',
    }
  )
);
