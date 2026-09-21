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
  company?: string;
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
    name: 'Guest User',
    email: 'guest@example.com',
    role: UserRole.GUEST,
  },
  [UserRole.CLIENT]: {
    id: 'client-001',
    name: 'Sarah Chen',
    email: 'sarah.chen@techcorp.vn',
    role: UserRole.CLIENT,
    company: 'TechCorp Vietnam',
    avatar: 'SC',
  },
  [UserRole.CANDIDATE]: {
    id: 'cand-001',
    name: 'Nguyen Van Minh',
    email: 'minh.nguyen@gmail.com',
    role: UserRole.CANDIDATE,
    avatar: 'NM',
  },
  [UserRole.AFFILIATE]: {
    id: 'aff-001',
    name: 'David Tran',
    email: 'david.tran@recruitpro.vn',
    role: UserRole.AFFILIATE,
    company: 'RecruitPro Network',
    trustRating: 4.8,
    avatar: 'DT',
  },
  [UserRole.INTERNAL_HR]: {
    id: 'hr-001',
    name: 'Lisa Pham',
    email: 'lisa.pham@hrconnect.io',
    role: UserRole.INTERNAL_HR,
    company: 'HR Connect',
    avatar: 'LP',
  },
  [UserRole.ADMIN]: {
    id: 'admin-001',
    name: 'Alex Nguyen',
    email: 'alex@hrconnect.io',
    role: UserRole.ADMIN,
    company: 'HR Connect',
    avatar: 'AN',
  },
};
