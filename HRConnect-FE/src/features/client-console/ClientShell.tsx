/**
 * @file ClientShell.tsx
 * @description Client Company workspace shell: enterprise top navigation (no sidebar), indigo/navy accent.
 * Desktop shows the links in the header; below lg they open in an off-canvas menu. The page area is
 * wide and airy, with the same loading feedback (progress bar, skeleton, enter motion) as the
 * other consoles.
 */
import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Dropdown } from 'antd';
import { BankOutlined, CloseOutlined, LogoutOutlined, MenuOutlined, PlusOutlined, KeyOutlined } from '@ant-design/icons';
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

const NAV = [
  { to: '/client/dashboard', label: 'Tổng quan' },
  { to: '/client/jobs', label: 'Tin tuyển dụng' },
  { to: '/client/agreements', label: 'Thỏa thuận dịch vụ' },
  { to: '/client/candidates', label: 'Hồ sơ ứng viên' },
  { to: '/client/interviews-offers', label: 'Phỏng vấn & Offer' },
  { to: '/client/warranty', label: 'Bảo hành' },
  { to: '/client/billing', label: 'Công nợ' },
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
    'relative inline-flex items-center gap-1.5 px-3 py-1.5 text-[13.5px] rounded-lg no-underline transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4A6E]/30',
    active
      ? 'bg-slate-100 text-[#0C4A6E] font-bold shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]'
      : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900',
  ].join(' ');
};

export const ClientShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useCompactLayout();
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
                  <span className="text-[15px] font-bold text-slate-900 group-hover:text-[#0C4A6E] transition-colors">HR Connect</span>
                  <span className="hidden sm:inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-[#0C4A6E] border border-sky-200/60">
                    Doanh nghiệp
                  </span>
                </div>
                <span className="hidden text-[11px] font-medium text-slate-500 sm:block">Trung tâm quản lý tuyển dụng</span>
              </div>
            </NavLink>
          </div>

          {!compact && (
            <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
              {NAV.map((n) => {
                const active = isActive(n.to);
                return (
                  <NavLink key={n.to} to={n.to} className={linkClass(active)} aria-current={active ? 'page' : undefined}>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[#0C4A6E]" aria-hidden />}
                    {n.label}
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
              className="hidden sm:inline-flex !bg-gradient-to-r !from-[#0C4A6E] !to-[#0284C7] hover:!from-[#075985] hover:!to-[#0369A1] !text-white !rounded-lg !border-0 shadow-sm font-semibold transition-all active:scale-[0.98] !h-9 !px-4"
            >
              Đăng tin
            </Button>
            <NotificationBell />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'company', icon: <BankOutlined />, label: 'Hồ sơ doanh nghiệp' },
                  { key: 'password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') signOut();
                  else if (key === 'password') setShowPasswordModal(true);
                  else navigate('/client/company');
                },
              }}
            >
              <button
                type="button"
                aria-label="Tài khoản"
                className="flex cursor-pointer items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/80 py-1 pl-1 pr-2.5 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0C4A6E]"
              >
                <AccountAvatar name={name} avatar={user?.avatar} size={30} />
                <span className="hidden text-left leading-tight md:block">
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
      <main className="mx-auto max-w-[1280px] px-4 py-6 lg:px-8 lg:py-8">
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
