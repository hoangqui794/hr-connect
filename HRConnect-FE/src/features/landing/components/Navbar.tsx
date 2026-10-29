import React, { useState } from 'react';
import { Button, Space, Tag, Dropdown, Badge, List, message, Drawer, Divider } from 'antd';
import {
  LogoutOutlined,
  DashboardOutlined,
  CompassOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  DollarCircleOutlined,
  BellOutlined,
  MenuOutlined,
  LoginOutlined,
  UserAddOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useI18nStore } from '@/i18n';
import { CandidateWorkspaceMenu } from '@/features/portal/candidate/CandidateWorkspaceMenu';
import { UserRole } from '@/types/roles';
import { ROLE_DASHBOARD_ROUTES } from '@/routes/AppRoutes';
import { BrandMark } from '@/components/common/BrandMark';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18nStore();
  const { isAuthenticated, role, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userName = user?.name || 'Người dùng';
  const userEmail = user?.email || '';

  const handleLogout = () => {
    logout();
    void message.success('Đã đăng xuất thành công!');
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const navigateAndClose = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  // Generic non-candidate dropdown
  const genericMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '6px 4px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{userName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{userEmail}</div>
        </div>
      ),
      disabled: true,
    },
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Vào Dashboard',
      onClick: () => navigate(ROLE_DASHBOARD_ROUTES[role] || '/dashboard'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const isHomeActive = location.pathname === '/';
  const isCandidate = isAuthenticated && role === UserRole.CANDIDATE;
  const isCandidateMatchesActive = isCandidate && location.pathname === '/candidate/jobs' && !new URLSearchParams(location.search).get('tab');
  const isJobsActive = isCandidate
    ? location.pathname.startsWith('/candidate/jobs') && !isCandidateMatchesActive
    : location.pathname === '/jobs' || location.pathname.startsWith('/jobs/');
  const jobsPath = isCandidate ? '/candidate/jobs?tab=all' : '/jobs';
  const isServicesActive = location.pathname === '/services';
  const isContactActive = location.pathname === '/contact';

  // Ẩn mục "Bảng giá dịch vụ" đối với CANDIDATE; Chỉ hiển thị khi là Khách (chưa đăng nhập) hoặc Doanh nghiệp
  const showServicesPricing =
    !isAuthenticated ||
    role === UserRole.CLIENT ||
    role === UserRole.ADMIN ||
    role === UserRole.INTERNAL_HR;

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm transition-all">
      <div className="relative w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          to="/"
          title="HR Connect — Nền tảng tuyển dụng, về trang chủ"
          className="flex cursor-pointer select-none items-center gap-2.5 sm:gap-3 shrink-0 no-underline text-inherit z-10"
        >
          <BrandMark size={36} />
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
            HR Connect
          </span>
          <Tag
            className="hidden xl:inline-flex m-0 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-blue-700"
          >
            Recruitment Platform
          </Tag>
        </Link>

        {/* Desktop Navigation - Centered */}
        <nav className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1 xl:gap-2">
          <Button
            type="text"
            icon={<CompassOutlined />}
            onClick={() => navigate('/')}
            style={{
              color: isHomeActive ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              background: isHomeActive ? '#eff6ff' : 'transparent',
              borderRadius: 8,
            }}
          >
            Giới thiệu
          </Button>

          <Button
            type="text"
            icon={<SearchOutlined />}
            onClick={() => navigate(jobsPath)}
            style={{
              color: isJobsActive ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              background: isJobsActive ? '#eff6ff' : 'transparent',
              borderRadius: 8,
            }}
          >
            Việc làm
          </Button>

          {isCandidate && (
            <Button
              type="text"
              icon={<ThunderboltOutlined />}
              onClick={() => navigate('/candidate/jobs')}
              style={{
                color: isCandidateMatchesActive ? '#1d4ed8' : '#475569',
                fontWeight: 600,
                fontSize: 14,
                background: isCandidateMatchesActive ? '#eff6ff' : 'transparent',
                borderRadius: 8,
              }}
            >
              Phù hợp với bạn
            </Button>
          )}

          {showServicesPricing && (
            <Button
              type="text"
              icon={<DollarCircleOutlined />}
              onClick={() => navigate('/services')}
              style={{
                color: isServicesActive ? '#1d4ed8' : '#475569',
                fontWeight: 600,
                fontSize: 14,
                background: isServicesActive ? '#eff6ff' : 'transparent',
                borderRadius: 8,
              }}
            >
              Giải pháp dịch vụ
            </Button>
          )}

          <Button
            type="text"
            icon={<CustomerServiceOutlined />}
            onClick={() => navigate('/contact')}
            style={{
              color: isContactActive ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              background: isContactActive ? '#eff6ff' : 'transparent',
              borderRadius: 8,
            }}
          >
            Liên hệ
          </Button>
        </nav>

        {/* Desktop Right Controls */}
        <div className="hidden lg:flex items-center gap-3 z-10 ml-auto">
          {isAuthenticated && <NotificationBell />}

          {isAuthenticated ? (
            role === UserRole.CANDIDATE ? (
              <CandidateWorkspaceMenu />
            ) : (
              <Dropdown menu={{ items: genericMenuItems }} placement="bottomRight" trigger={['click']}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    background: 'rgba(241, 245, 249, 0.8)',
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <AccountAvatar name={userName} avatar={user?.avatar} size={28} />
                  <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>
                    {userName.split(' ').slice(-1)[0]}
                  </span>
                </div>
              </Dropdown>
            )
          ) : (
            <Space size={8}>
              <Button
                type="text"
                onClick={() => navigate('/login')}
                style={{
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: 13,
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  background: '#ffffff',
                  borderRadius: 8,
                }}
              >
                {t.nav.signIn}
              </Button>
              <Button
                type="primary"
                onClick={() => navigate('/register')}
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #1E9EDB 0%, #53B7E8 100%)',
                  border: 'none',
                  boxShadow: '0 3px 10px rgba(30, 158, 219, 0.35)',
                  color: '#ffffff',
                }}
              >
                {t.nav.register}
              </Button>
            </Space>
          )}
        </div>

        {/* Mobile / Tablet Controls (< lg) */}
        <div className="flex lg:hidden items-center gap-2 z-10">
          {isAuthenticated && <NotificationBell />}

          {!isAuthenticated && (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate('/login')}
              className="text-xs font-semibold rounded-lg h-8 bg-blue-600"
            >
              Đăng nhập
            </Button>
          )}

          <Button
            type="text"
            icon={<MenuOutlined className="text-lg text-slate-700" />}
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100"
            aria-label="Menu điều hướng"
          />
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="right"
        width={300}
        styles={{ body: { padding: '16px 20px' } }}
        title={
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <span className="font-bold text-slate-900">HR Connect</span>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <Button
            type="text"
            block
            icon={<CompassOutlined />}
            onClick={() => navigateAndClose('/')}
            className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
              isHomeActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
            }`}
          >
            Giới thiệu
          </Button>

          <Button
            type="text"
            block
            icon={<SearchOutlined />}
            onClick={() => navigateAndClose(jobsPath)}
            className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
              isJobsActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
            }`}
          >
            Việc làm
          </Button>

          {isCandidate && (
            <Button
              type="text"
              block
              icon={<ThunderboltOutlined />}
              onClick={() => navigateAndClose('/candidate/jobs')}
              className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
                isCandidateMatchesActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              Phù hợp với bạn
            </Button>
          )}

          {showServicesPricing && (
            <Button
              type="text"
              block
              icon={<DollarCircleOutlined />}
              onClick={() => navigateAndClose('/services')}
              className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
                isServicesActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              Giải pháp dịch vụ
            </Button>
          )}

          <Button
            type="text"
            block
            icon={<CustomerServiceOutlined />}
            onClick={() => navigateAndClose('/contact')}
            className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
              isContactActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
            }`}
          >
            Liên hệ tư vấn
          </Button>
        </div>

        <Divider className="my-4" />

        {isAuthenticated ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
              <AccountAvatar name={userName} avatar={user?.avatar} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{userName}</div>
                <div className="text-xs text-slate-500 truncate">{userEmail}</div>
              </div>
            </div>

            <Button
              type="primary"
              block
              icon={<DashboardOutlined />}
              onClick={() => navigateAndClose(ROLE_DASHBOARD_ROUTES[role] || '/dashboard')}
              className="h-10 font-bold bg-blue-600 rounded-lg"
            >
              Vào trang làm việc
            </Button>

            <Button
              danger
              block
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="h-10 font-semibold rounded-lg"
            >
              Đăng xuất
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button
              type="primary"
              block
              icon={<UserAddOutlined />}
              onClick={() => navigateAndClose('/register')}
              style={{
                background: 'linear-gradient(135deg, #1E9EDB 0%, #53B7E8 100%)',
                border: 'none',
                boxShadow: '0 3px 10px rgba(30, 158, 219, 0.35)',
                color: '#ffffff',
              }}
              className="h-10 font-bold rounded-lg shadow-sm"
            >
              {t.nav.register}
            </Button>

            <Button
              block
              icon={<LoginOutlined />}
              onClick={() => navigateAndClose('/login')}
              className="h-10 font-semibold rounded-lg border-slate-300 text-slate-700"
            >
              {t.nav.signIn}
            </Button>
          </div>
        )}
      </Drawer>
    </header>
  );
};
