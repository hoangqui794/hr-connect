import { UserRole } from '@/types/roles';

export interface RoutePermission {
  path: string;
  allowedRoles: UserRole[];
  redirectTo: string;
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  { path: '/', allowedRoles: Object.values(UserRole), redirectTo: '/' },
  { path: '/login', allowedRoles: [UserRole.GUEST], redirectTo: '/dashboard' },
  { path: '/register', allowedRoles: [UserRole.GUEST], redirectTo: '/dashboard' },
  {
    path: '/dashboard',
    allowedRoles: [UserRole.CLIENT, UserRole.CANDIDATE, UserRole.AFFILIATE, UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/login',
  },
  {
    path: '/jobs/create',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/client/dashboard',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/login',
  },
  {
    path: '/client/jobs',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/client/jobs/create',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/client/candidates',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/client/interviews-offers',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/client/warranty',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/jobs/create',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/jobs',
    allowedRoles: [UserRole.CLIENT, UserRole.AFFILIATE, UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/dashboard',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/jobs',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/submissions',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/submit-candidate',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/commissions',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/referral',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/affiliate/ledger',
    allowedRoles: [UserRole.AFFILIATE, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/screening',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/candidates',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN, UserRole.CLIENT],
    redirectTo: '/dashboard',
  },
  {
    path: '/cv-builder',
    allowedRoles: [UserRole.CANDIDATE],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/dashboard',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/users',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/companies',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/affiliates',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/disputes',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/payouts',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/finance',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/settings',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/audit-trail',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/admin/jobs',
    allowedRoles: [UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/dashboard',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/jobs',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/candidates',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/screening',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/interviews',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/offers',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
  {
    path: '/hr/warranty-tracking',
    allowedRoles: [UserRole.INTERNAL_HR, UserRole.ADMIN],
    redirectTo: '/dashboard',
  },
];

export interface SidebarMenuItem {
  key?: string;
  label: string;
  icon?: string;
  type?: 'group';
  children?: SidebarMenuItem[];
}

export const SIDEBAR_MENU_ITEMS: Record<UserRole, SidebarMenuItem[]> = {
  [UserRole.GUEST]: [
    { key: '/', label: 'Trang chủ', icon: 'HomeOutlined' },
    { key: '/login', label: 'Đăng nhập', icon: 'LoginOutlined' },
    { key: '/register', label: 'Đăng ký', icon: 'UserAddOutlined' },
  ],
  [UserRole.CLIENT]: [
    { key: '/client/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
    { key: '/client/jobs', label: 'Tin tuyển dụng của tôi', icon: 'FileTextOutlined' },
    { key: '/client/jobs/create', label: 'Đăng tin tuyển dụng mới', icon: 'PlusCircleOutlined' },
    { key: '/client/candidates', label: 'Phễu quản lý Ứng viên', icon: 'TeamOutlined' },
    { key: '/client/interviews-offers', label: 'Lịch phỏng vấn & Offer', icon: 'CalendarOutlined' },
    { key: '/client/warranty', label: 'Theo dõi Bảo hành 60 ngày', icon: 'SafetyCertificateOutlined' },
  ],
  [UserRole.CANDIDATE]: [
    { key: '/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
    { key: '/jobs', label: 'Khám phá việc làm', icon: 'SearchOutlined' },
    { key: '/cv-builder', label: 'Hồ sơ & CV của tôi', icon: 'FileTextOutlined' },
  ],
  [UserRole.AFFILIATE]: [
    { key: '/affiliate/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
    { key: '/affiliate/jobs', label: 'Sàn việc làm nhận tuyển', icon: 'AppstoreOutlined' },
    { key: '/affiliate/submissions', label: 'Hồ sơ đã giới thiệu & Tiến độ', icon: 'TeamOutlined' },
    { key: '/affiliate/submit-candidate', label: 'Nộp hồ sơ ứng viên', icon: 'UserAddOutlined' },
    { key: '/affiliate/commissions', label: 'Sổ cái hoa hồng & Payout', icon: 'DollarOutlined' },
  ],
  [UserRole.INTERNAL_HR]: [
    { key: '/hr/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
    { key: '/hr/jobs', label: 'Duyệt tin tuyển dụng', icon: 'FileTextOutlined' },
    { key: '/hr/candidates', label: 'Kho hồ sơ ứng viên', icon: 'TeamOutlined' },
    { key: '/hr/screening', label: 'Sàng lọc AI', icon: 'RobotOutlined' },
    { key: '/hr/interviews', label: 'Lịch phỏng vấn', icon: 'CalendarOutlined' },
    { key: '/hr/offers', label: 'Quản lý Offer & Onboarding', icon: 'SolutionOutlined' },
    { key: '/hr/warranty-tracking', label: 'Theo dõi Bảo hành & Milestone', icon: 'SafetyCertificateOutlined' },
  ],
  [UserRole.ADMIN]: [
    {
      label: 'Bảng điều khiển',
      type: 'group',
      children: [
        { key: '/admin/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
      ],
    },
    {
      label: 'Quản lý tài khoản & Đối tác',
      type: 'group',
      children: [
        { key: '/admin/users', label: 'Quản lý người dùng & phân quyền', icon: 'TeamOutlined' },
        { key: '/admin/companies', label: 'Doanh nghiệp tuyển dụng', icon: 'BankOutlined' },
        { key: '/admin/affiliates', label: 'Mạng lưới CTV & Headhunter', icon: 'ApartmentOutlined' },
      ],
    },
    {
      label: 'Vận hành & Tranh chấp',
      type: 'group',
      children: [
        { key: '/admin/disputes', label: 'Xử lý tranh chấp hồ sơ', icon: 'SafetyCertificateOutlined' },
        { key: '/admin/payouts', label: 'Duyệt chi trả hoa hồng', icon: 'DollarOutlined' },
      ],
    },
    {
      label: 'Cấu hình hệ thống & Audit',
      type: 'group',
      children: [
        { key: '/admin/settings', label: 'Cấu hình hệ thống & hoa hồng', icon: 'SettingOutlined' },
        { key: '/admin/audit-trail', label: 'Nhật ký kiểm toán hệ thống', icon: 'AuditOutlined' },
      ],
    },
  ],
};
