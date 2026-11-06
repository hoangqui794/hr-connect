/**
 * @file Navbar.tsx
 * @description Site header for the public pages and the Candidate workspace (mockup 03/11): navy bar with
 * the main links, then sign-in actions for guests or the account menu for signed-in users.
 */
import React, { useState } from 'react';
import { Dropdown, Drawer, message } from 'antd';
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
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role, user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isCandidate = isAuthenticated && role === UserRole.CANDIDATE;

  const links: { to: string; label: string; active: boolean }[] = [
    {
      to: '/jobs',
      label: 'Việc làm',
      active: location.pathname === '/' || location.pathname.startsWith('/jobs') || location.pathname.startsWith('/candidate/jobs'),
    },
    { to: '/companies', label: 'Công ty', active: location.pathname.startsWith('/companies') },
    ...(isCandidate ? [{ to: '/candidate/cv-builder', label: 'Tạo CV', active: location.pathname.startsWith('/candidate/cv-builder') }] : []),
    { to: '/services', label: 'Dịch vụ', active: location.pathname === '/services' },
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
    navigate(to);
  };

  return (
    <header className="bg-[#0C4A6E] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-white [line-height:normal] [&_button]:[font-family:inherit]">
      <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-5 lg:gap-7">
          <Link to="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[18px] font-bold text-white no-underline hover:text-white">
            <BrandMark size={32} tone="light" /> HR Connect
          </Link>
          <nav aria-label="Điều hướng chính" className="hidden h-16 items-stretch gap-1 lg:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                aria-current={l.active ? 'page' : undefined}
                className={`relative inline-flex h-full min-w-[78px] items-center justify-center whitespace-nowrap px-2.5 font-medium no-underline transition-colors duration-150 hover:bg-white/5 hover:text-white ${l.active ? 'text-white' : 'text-slate-300'}`}
              >
                {l.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2.5 bottom-0 h-0.5 rounded-full transition-colors duration-150 ${l.active ? 'bg-white' : 'bg-transparent'}`}
                />
              </Link>
            ))}
          </nav>
        </div>

        <div className={`ml-auto flex min-w-0 shrink-0 items-center ${isCandidate ? 'gap-2' : 'gap-3'}`}>
          {isAuthenticated && (
            <span className="site-bell">
              <NotificationBell className="!h-11 !w-11 !border-0 !bg-transparent" variant={isCandidate ? 'candidate' : 'default'} />
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
              <button type="button" className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-white">
                <AccountAvatar name={user?.name || 'Người dùng'} avatar={user?.avatar} size={32} />
                <span className="hidden max-w-[160px] truncate sm:block">{user?.name}</span>
              </button>
            </Dropdown>
          ) : (
            <>
              <Link to="/services" className="hidden whitespace-nowrap text-slate-300 no-underline hover:text-white xl:block">Dành cho nhà tuyển dụng</Link>
              <Link to="/login" className="hidden whitespace-nowrap rounded-md border border-solid border-[#7FA6C2] px-3.5 py-2 font-medium text-white no-underline hover:bg-white/10 hover:text-white sm:block">Đăng nhập</Link>
              <Link to="/register" className="whitespace-nowrap rounded-md bg-[#C2410C] px-3.5 py-[9px] font-semibold text-white no-underline transition-colors duration-150 hover:bg-[#9A3412] hover:text-white">Đăng ký</Link>
            </>
          )}
          <button
            type="button"
            aria-label="Mở menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[18px] text-white lg:hidden"
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
              <button type="button" onClick={() => go('/services')} className="h-11 cursor-pointer border-0 border-b border-solid border-slate-100 bg-transparent text-left text-[15px] text-gray-800">Dành cho nhà tuyển dụng</button>
              <button type="button" onClick={() => go('/login')} className="mt-4 h-11 cursor-pointer rounded-md border border-solid border-[#0C4A6E] bg-white font-semibold text-[#0C4A6E]">Đăng nhập</button>
            </>
          )}
        </nav>
      </Drawer>
    </header>
  );
};

export default Navbar;
