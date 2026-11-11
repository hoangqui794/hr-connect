/**
 * @file ClientShell.tsx
 * @description Client Company workspace shell: enterprise top navigation (no sidebar), indigo/navy accent.
 * From 1280px the links sit in the header on one line; below 1280px they open in an off-canvas menu.
 * Between 1280px and 1440px the brand subtitle, badge and account details are hidden to make room. The page area is
 * wide and airy, with the same loading feedback (progress bar, skeleton, enter motion) as the
 * other consoles.
 */
import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Dropdown } from 'antd';
import { BankOutlined, CloseOutlined, LogoutOutlined, MenuOutlined, PlusOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { ChangePasswordModal } from '@/components/common/ChangePasswordModal';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import { useCompactLayout } from '@/features/admin-console/useCompactLayout';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import '@/features/admin-console/admin-console.css';
import { BrandMark } from '@/components/common/BrandMark';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
/** The eight header links need about 1360px; below that the menu moves into the drawer. */
const COMPACT_QUERY = '(max-width: 1359px)';

const NAV = [
  { to: '/client/dashboard', label: 'Tổng quan' },
  { to: '/client/jobs', label: 'Tin tuyển dụng' },
  { to: '/client/agreements', label: 'Thỏa thuận dịch vụ' },
  { to: '/client/candidates', label: 'Hồ sơ ứng viên' },
  { to: '/client/interviews-offers', label: 'Phỏng vấn & Offer' },
  { to: '/client/warranty', label: 'Bảo hành' },
  { to: '/client/billing', label: 'Công nợ' },
  { to: '/client/services', label: 'Dịch vụ' },
] as const;

const linkClass = (active: boolean, compact?: boolean) => {
  if (compact) {
    return [
      FONT,
      'flex items-center justify-between rounded-xl px-4 py-3 text-[14px] no-underline transition-all duration-150',
      active
        ? 'bg-[#0C4A6E]/10 font-bold text-[#0C4A6E]'
        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    ].join(' ');
  }
  return [
    FONT,
    `group relative inline-flex h-16 shrink-0 items-center whitespace-nowrap px-2 text-[14px] no-underline transition-colors duration-200 ease-out 2xl:px-3`,
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0C4A6E]/30',
    active ? 'font-bold text-[#0C4A6E]' : 'font-medium text-slate-700 hover:text-[#0C4A6E]',
  ].join(' ');
};

export const ClientShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useCompactLayout(COMPACT_QUERY);
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname, compact]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const signOut = async () => {
    try {
      await authService.logout(); // revokes the refresh token server-side
    } finally {
      logout();
      window.location.replace('/login');
    }
  };

  const name = user?.name || 'Doanh nghiệp';
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className={`${FONT} client-console min-h-screen bg-[#F8FAFC] text-slate-900`}>
      <header className="sticky top-0 z-30 border-0 border-b border-solid border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            {compact && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Mở menu"
                aria-expanded={menuOpen}
                className="-ml-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-lg text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0C4A6E]"
              >
                <MenuOutlined />
              </button>
            )}

            <NavLink to="/client/dashboard" className="flex shrink-0 items-center gap-2.5 no-underline group" aria-label="HR Connect, về tổng quan">
              <BrandMark size={36} />
              <div className="leading-tight">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-extrabold text-[#0C4A6E]">HR Connect</span>
                  <span className={`hidden min-[1440px]:inline-flex items-center rounded border border-solid border-slate-300 px-1.5 py-0.5 text-[12px] font-semibold text-slate-600`}>
                    Doanh nghiệp
                  </span>
                </div>
              </div>
            </NavLink>
          </div>

          {!compact && (
            <nav aria-label="Điều hướng chính" className="flex h-16 min-w-0 flex-1 items-stretch gap-0.5">
              {NAV.map((n) => {
                const active = isActive(n.to);
                return (
                  <NavLink key={n.to} to={n.to} className={linkClass(active)} aria-current={active ? 'page' : undefined}>
                    {n.label}
                    <span
                      aria-hidden
                      className={`absolute inset-x-2 bottom-0 h-0.5 origin-center rounded-full bg-[#0C4A6E] transition-transform duration-200 ease-out motion-reduce:transition-none ${active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
                    />
                  </NavLink>
                );
              })}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-2.5">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/client/jobs/create')}
              className="hidden sm:inline-flex !bg-gradient-to-r !from-[#0284C7] !to-[#2563EB] hover:!from-[#0369A1] hover:!to-[#1D4ED8] !text-white !rounded-lg !border-0 !shadow-sm hover:!shadow-md hover:!shadow-sky-500/25 font-bold transition-all duration-150 active:scale-[0.97] !h-10 !px-4"
            >
              Đăng tin
            </Button>
            <NotificationBell />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân' },
                  { key: 'company', icon: <BankOutlined />, label: 'Hồ sơ doanh nghiệp' },
                  { key: 'password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') signOut();
                  else if (key === 'password') setShowPasswordModal(true);
                  else if (key === 'profile') navigate('/client/profile');
                  else navigate('/client/company');
                },
              }}
            >
              <button
                type="button"
                aria-label="Tài khoản"
                className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/80 py-1 pl-1 pr-2.5 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0C4A6E]"
              >
                <AccountAvatar name={name} avatar={user?.avatar} size={30} />
                <span className={`hidden text-left leading-tight 2xl:block`}>
                  <span className="block max-w-[140px] truncate text-xs font-bold text-slate-900">{name}</span>
                  <span className="block max-w-[140px] truncate text-[11px] text-slate-500">{user?.email}</span>
                </span>
              </button>
            </Dropdown>
          </div>
        </div>
      </header>

      {compact && menuOpen && <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden />}
      {compact && (
        <aside
          aria-label="Menu"
          className="fixed inset-y-0 left-0 z-50 w-[288px] max-w-[85vw] bg-white p-3 shadow-2xl transition-transform duration-200"
          style={{ transform: menuOpen ? 'none' : 'translateX(-100%)', visibility: menuOpen ? 'visible' : 'hidden' }}
        >
          <div className="mb-3 flex items-center justify-between px-2 pt-1">
            <span className="text-[15px] font-bold text-slate-900">Menu</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Đóng menu"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-slate-600 hover:bg-slate-100"
            >
              <CloseOutlined />
            </button>
          </div>
          <nav aria-label="Điều hướng chính" className="space-y-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkClass(isActive(n.to), true)}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/client/jobs/create" className={linkClass(location.pathname === '/client/jobs/create', true)}>
              + Đăng tin tuyển dụng
            </NavLink>
          </nav>
        </aside>
      )}

      <AdminTopProgress offsetLeft={0} />
      <main className={location.pathname === '/client/services' ? 'w-full min-w-0' : 'mx-auto w-full max-w-[1280px] min-w-0 px-4 py-6 lg:px-8 lg:py-8'}>
        <AdminPageEnter pathKey={location.pathname}>
          <Suspense fallback={<AdminPageSkeleton />}>
            <Outlet />
          </Suspense>
        </AdminPageEnter>
      </main>
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default ClientShell;
