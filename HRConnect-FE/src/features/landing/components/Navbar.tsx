/**
 * @file Navbar.tsx
 * @description Site header for the public pages and the Candidate workspace (mockup 03/11): navy bar with
 * the main links, then sign-in actions for guests or the account menu for signed-in users.
 */
import React, { useState } from 'react';
import { App, Dropdown, Drawer } from 'antd';
import { DashboardOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CandidateWorkspaceMenu } from '@/features/portal/candidate/CandidateWorkspaceMenu';
import { UserRole } from '@/types/roles';
import { ROLE_DASHBOARD_ROUTES } from '@/routes/routeHelpers';
import { BrandMark } from '@/components/common/BrandMark';

export const Navbar: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCandidate = isAuthenticated && role === UserRole.CANDIDATE;

  const links: { to: string; label: string; active: boolean }[] = [
    {
      to: '/',
      label: 'Trang chủ',
      active: location.pathname === '/',
    },
    {
      to: '/jobs',
      label: 'Việc làm',
      active: location.pathname.startsWith('/jobs') || location.pathname.startsWith('/candidate/jobs'),
    },
    { to: '/companies', label: 'Công ty', active: location.pathname.startsWith('/companies') },
    ...(isCandidate ? [{ to: '/candidate/cv-builder', label: 'Tạo CV', active: location.pathname.startsWith('/candidate/cv-builder') }] : []),
    ...(!isCandidate ? [{ to: '/contact', label: 'Liên hệ', active: location.pathname === '/contact' }] : []),
  ];

  const signOut = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      void message.success('Đã đăng xuất.');
      setMobileMenuOpen(false);
      navigate('/login');
    }
  };

  const go = (to: string) => {
    setMobileMenuOpen(false);
    navigate(to, { viewTransition: true });
  };

  return (
    <header className="hrc-site-header sticky top-0 z-40 border-b border-white/20 bg-gradient-to-r from-[#0369A1] via-[#0284C7] to-[#0369A1] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-white shadow-[0_4px_20px_-4px_rgba(2,132,199,0.3)] backdrop-blur-md [line-height:normal] [&_button]:[font-family:inherit]">
      <div className="mx-auto flex h-[66px] w-full max-w-[1520px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-7">
          <Link to="/" viewTransition className="group flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[18px] font-extrabold tracking-tight text-white no-underline transition-opacity hover:opacity-95">
            <div className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <BrandMark size={32} tone="light" />
            </div>
            <span className="font-extrabold text-white tracking-tight">
              HR Connect
            </span>
          </Link>
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1.5 lg:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                viewTransition
                aria-current={l.active ? 'page' : undefined}
                className={`group relative inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium no-underline transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                  l.active
                    ? 'bg-white/20 font-semibold text-white shadow-xs backdrop-blur-xs border border-white/30'
                    : 'text-sky-100 hover:bg-white/15 hover:text-white'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={`ml-auto flex min-w-0 shrink-0 items-center ${isCandidate ? 'gap-2.5' : 'gap-3'}`}>
          {isAuthenticated && (
            <span className="site-bell flex items-center">
              <NotificationBell className="!h-10 !w-10 !border !border-white/20 !bg-white/10 hover:!bg-white/20 !rounded-full text-white transition-colors" variant={isCandidate ? 'candidate' : 'default'} />
            </span>
          )}
          {isCandidate ? (
            <CandidateWorkspaceMenu />
          ) : isAuthenticated ? (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'dashboard', icon: <DashboardOutlined />, label: 'Vào Dashboard', onClick: () => navigate(ROLE_DASHBOARD_ROUTES[role] || '/dashboard') },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: () => void signOut() },
                ],
              }}
            >
              <button type="button" className="flex cursor-pointer items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-white transition-all hover:bg-white/20 hover:border-white/30">
                <AccountAvatar name={user?.name || 'Người dùng'} avatar={user?.avatar} size={28} />
                <span className="hidden max-w-[150px] truncate text-[13.5px] font-medium sm:block">{user?.name}</span>
              </button>
            </Dropdown>
          ) : (
            <>
              <Link to="/register?role=CLIENT" className="hidden whitespace-nowrap text-[13.5px] font-medium text-sky-100 no-underline transition-colors hover:text-white xl:block">
                Dành cho nhà tuyển dụng
              </Link>
              <Link to="/login" className="hidden whitespace-nowrap rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-[13.5px] font-medium text-white no-underline transition-all hover:bg-white/20 hover:border-white/40 sm:block">
                Đăng nhập
              </Link>
              <Link to="/register" className="whitespace-nowrap rounded-lg bg-white px-4 py-2 text-[13.5px] font-bold text-[#0369A1] no-underline shadow-sm transition-all hover:bg-sky-50 hover:shadow-md active:scale-[0.98]">
                Đăng ký
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-[18px] text-white transition-colors hover:bg-white/20 lg:hidden"
          >
            <MenuOutlined />
          </button>
        </div>
      </div>

      <Drawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} placement="right" width={280} title="HR Connect">
        <nav aria-label="Menu" className="flex flex-col">
          {links.map((l) => (
            <button key={l.label} type="button" onClick={() => go(l.to)} className="h-11 cursor-pointer border-0 border-b border-solid border-slate-100 bg-transparent text-left text-[15px] text-gray-800">
              {l.label}
            </button>
          ))}
          {!isAuthenticated && (
            <>
              <button type="button" onClick={() => go('/register?role=CLIENT')} className="h-11 cursor-pointer border-0 border-b border-solid border-slate-100 bg-transparent text-left text-[15px] text-gray-800">Dành cho nhà tuyển dụng</button>
              <button type="button" onClick={() => go('/login')} className="mt-4 h-11 cursor-pointer rounded-lg border border-solid border-blue-600 bg-white font-semibold text-blue-600">Đăng nhập</button>
            </>
          )}
        </nav>
      </Drawer>
    </header>
  );
};

export default Navbar;
