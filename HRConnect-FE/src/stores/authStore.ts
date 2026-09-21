import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserRole, UserProfile, DEMO_USERS } from '@/types/roles';

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
  phone?: string;
  companyName?: string;
  companySize?: string;
}

interface AuthState {
  role: UserRole;
  user: UserProfile;
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
      user: DEMO_USERS[UserRole.GUEST],
      isAuthenticated: false,

      setRole: (role: UserRole) => {
        set({
          role,
          user: DEMO_USERS[role],
          isAuthenticated: role !== UserRole.GUEST,
        });
      },

      login: (role: UserRole, customUser?: Partial<UserProfile>) => {
        const base = DEMO_USERS[role];
        const user = customUser ? { ...base, ...customUser } : base;
        set({
          role,
          user,
          isAuthenticated: true,
        });
        localStorage.setItem('auth_token', `demo-token-${role.toLowerCase()}-${Date.now()}`);
      },

      register: (data: RegisterData) => {
        const initials = getInitials(data.fullName);

        const newUser: UserProfile = {
          id: `usr-${data.role.toLowerCase()}-${Date.now()}`,
          name: data.fullName.trim(),
          email: data.email.trim(),
          phone: data.phone?.trim(),
          role: data.role,
          company: data.companyName?.trim() || (data.role === UserRole.CLIENT ? 'Doanh nghiệp mới' : undefined),
          companySize: data.companySize,
          avatar: initials,
          trustRating: data.role === UserRole.AFFILIATE ? 5.0 : undefined,
        };

        set({
          role: data.role,
          user: newUser,
          isAuthenticated: true,
        });
        localStorage.setItem('auth_token', `token-${data.role.toLowerCase()}-${Date.now()}`);
        return newUser;
      },

      logout: () => {
        set({
          role: UserRole.GUEST,
          user: DEMO_USERS[UserRole.GUEST],
          isAuthenticated: false,
        });
        localStorage.removeItem('hr-connect-auth');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        sessionStorage.clear();
      },
    }),
    {
      name: 'hr-connect-auth',
    }
  )
);
