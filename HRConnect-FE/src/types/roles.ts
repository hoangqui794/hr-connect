export enum UserRole {
  GUEST = 'GUEST',
  CLIENT = 'CLIENT',
  CANDIDATE = 'CANDIDATE',
  AFFILIATE = 'AFFILIATE',
  INTERNAL_HR = 'INTERNAL_HR',
  ADMIN = 'ADMIN',
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  /** Every backend role retained for users who participate in multiple portals. */
  roles?: string[];
  permissions?: string[];
  status?: string;
  emailVerified?: boolean;
  company?: string;
  companyName?: string;
  companySize?: string;
  trustRating?: number; // For affiliates: 0-5
}

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.GUEST]: 'Khách vãng lai',
  [UserRole.CLIENT]: 'Doanh nghiệp tuyển dụng',
  [UserRole.CANDIDATE]: 'Ứng viên',
  [UserRole.AFFILIATE]: 'Cộng tác viên tuyển dụng (Headhunter)',
  [UserRole.INTERNAL_HR]: 'Chuyên viên nhân sự nội bộ (HR)',
  [UserRole.ADMIN]: 'Quản trị viên hệ thống',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.GUEST]: '#94a3b8',
  [UserRole.CLIENT]: '#0284c7',
  [UserRole.CANDIDATE]: '#8b5cf6',
  [UserRole.AFFILIATE]: '#f59e0b',
  [UserRole.INTERNAL_HR]: '#10b981',
  [UserRole.ADMIN]: '#ef4444',
};

export const DEMO_USERS: Record<UserRole, UserProfile> = {
  [UserRole.GUEST]: {
    id: 'guest-001',
    name: 'Khách Vãng Lai',
    email: 'guest@hrconnect.io',
    role: UserRole.GUEST,
  },
  [UserRole.CLIENT]: {
    id: 'usr-client-005',
    name: 'Doanh nghiệp Tuyển Dụng 5',
    email: 'tuyendung5@gmail.com',
    role: UserRole.CLIENT,
    company: 'Công ty TNHH Tuyển Dụng 5',
    avatar: 'TD',
  },
  [UserRole.CANDIDATE]: {
    id: 'usr-candidate-005',
    name: 'Nguyễn Văn B (Ứng viên 5)',
    email: 'ungvien5@gmail.com',
    role: UserRole.CANDIDATE,
    avatar: 'VB',
  },
  [UserRole.AFFILIATE]: {
    id: 'usr-affiliate-005',
    name: 'Cộng Tác Viên 5',
    email: 'cvt5@gmail.com',
    role: UserRole.AFFILIATE,
    company: 'Headhunter Network',
    trustRating: 4.9,
    avatar: 'CV',
  },
  [UserRole.INTERNAL_HR]: {
    id: 'usr-hr-test-01',
    name: 'My Test HR',
    email: 'myhr@hrconnect.io',
    role: UserRole.INTERNAL_HR,
    company: 'HR Connect Internal',
    avatar: 'HR',
  },
  [UserRole.ADMIN]: {
    id: 'usr-admin-test-01',
    name: 'Platform Admin',
    email: 'myadmin@hrconnect.io',
    role: UserRole.ADMIN,
    company: 'HR Connect Platform',
    avatar: 'AD',
  },
};

/**
 * Maps string roles returned from backend OpenAPI schema to frontend UserRole enum
 */
export const mapApiRoleToUserRole = (roles?: string[] | null): UserRole => {
  if (!roles || roles.length === 0) return UserRole.CANDIDATE;
  const normalized = roles.map((r) => r.toUpperCase());
  if (normalized.some((r) => r.includes('ADMIN'))) return UserRole.ADMIN;
  if (normalized.some((r) => r.includes('CLIENT') || r.includes('EMPLOYER'))) return UserRole.CLIENT;
  if (normalized.some((r) => r.includes('AFFILIATE') || r.includes('HEADHUNTER') || r.includes('RECRUITER'))) return UserRole.AFFILIATE;
  if (normalized.some((r) => r.includes('INTERNAL_HR') || r.includes('HR_OPS') || r.includes('HR'))) return UserRole.INTERNAL_HR;
  if (normalized.some((r) => r.includes('CANDIDATE') || r.includes('TALENT'))) return UserRole.CANDIDATE;
  return UserRole.CANDIDATE;
};

/** Maps every recognized backend role without losing multi-role membership. */
export const mapApiRolesToUserRoles = (roles?: string[] | null): UserRole[] => {
  if (!roles?.length) return [];
  const result = new Set<UserRole>();

  roles.forEach((rawRole) => {
    const normalized = rawRole.toUpperCase();
    if (normalized.includes('ADMIN')) result.add(UserRole.ADMIN);
    else if (normalized.includes('CLIENT') || normalized.includes('EMPLOYER')) result.add(UserRole.CLIENT);
    else if (normalized.includes('AFFILIATE') || normalized.includes('HEADHUNTER') || normalized.includes('RECRUITER')) result.add(UserRole.AFFILIATE);
    else if (normalized.includes('INTERNAL_HR') || normalized.includes('HR_OPS') || normalized === 'HR') result.add(UserRole.INTERNAL_HR);
    else if (normalized.includes('CANDIDATE') || normalized.includes('TALENT')) result.add(UserRole.CANDIDATE);
  });

  return [...result];
};
