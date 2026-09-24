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
