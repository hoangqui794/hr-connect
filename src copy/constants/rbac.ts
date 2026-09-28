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
];

export const SIDEBAR_MENU_ITEMS = {
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
    { key: '/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
    { key: '/jobs', label: 'Tin tuyển dụng đang mở', icon: 'FileTextOutlined' },
    { key: '/candidates', label: 'Kho hồ sơ ứng viên', icon: 'TeamOutlined' },
    { key: '/screening', label: 'Sàng lọc AI', icon: 'RobotOutlined' },
    { key: '/affiliate/ledger', label: 'Sổ cái hoa hồng CTV', icon: 'DollarOutlined' },
  ],
  [UserRole.ADMIN]: [
    { key: '/dashboard', label: 'Bảng điều khiển', icon: 'DashboardOutlined' },
    { key: '/jobs', label: 'Tất cả tin tuyển dụng', icon: 'FileTextOutlined' },
    { key: '/candidates', label: 'Tất cả ứng viên', icon: 'TeamOutlined' },
    { key: '/screening', label: 'Sàng lọc AI', icon: 'RobotOutlined' },
    { key: '/affiliate/ledger', label: 'Sổ cái tài chính', icon: 'DollarOutlined' },
    { key: '/admin', label: 'Quản trị hệ thống', icon: 'SettingOutlined' },
  ],
};
