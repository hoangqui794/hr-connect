/**
 * @file ClientShell.tsx
 * @description Client Company workspace shell: enterprise top navigation (no sidebar), indigo accent.
 * Desktop shows the links in the header; below lg they open in an off-canvas menu. The page area is
 * wide and airy, with the same loading feedback (progress bar, skeleton, enter motion) as the
 * other consoles. Menu follows the backend: jobs (MF-01), applications and interviews/offers
 * (MF-03/04); warranty has no API yet and opens an empty state.
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

const NAV = [
  { to: '/client/dashboard', label: 'Tổng quan' },
  { to: '/client/jobs', label: 'Tin tuyển dụng' },
  { to: '/client/agreements', label: 'Thỏa thuận dịch vụ' },
  { to: '/client/candidates', label: 'Hồ sơ ứng viên' },
  { to: '/client/interviews-offers', label: 'Phỏng vấn & Offer' },
  { to: '/client/warranty', label: 'Bảo hành', muted: true },
  { to: '/client/billing', label: 'Công nợ', muted: true },
] as const;

const linkClass = (active: boolean, muted?: boolean, compact?: boolean) => {
  if (compact) {
    return [
      'block rounded-xl px-4 py-3 text-[15px] no-underline transition-colors duration-150',
      active
        ? 'bg-blue-50 font-semibold text-blue-600'
        : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    ].join(' ');
  }
  return [
    'flex h-16 items-center px-3.5 text-sm no-underline transition-colors duration-150',
    active
      ? 'border-0 border-b-2 border-solid border-blue-600 font-semibold text-slate-900'
      : muted
        ? 'border-0 border-b-2 border-solid border-transparent font-medium text-slate-400 hover:text-slate-700'
        : 'border-0 border-b-2 border-solid border-transparent font-medium text-slate-500 hover:text-slate-900',
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
      window.location.replace('/');
    }
  };

  const name = user?.name || 'Doanh nghiệp';
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="client-console min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-0 border-b border-solid border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            {compact && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Mở menu"
                aria-expanded={menuOpen}
                className="-ml-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-lg text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
              >
                <MenuOutlined />
              </button>
            )}

            <NavLink to="/client/dashboard" className="flex shrink-0 items-center gap-2.5 no-underline" aria-label="HR Connect, về tổng quan">
              <BrandMark size={36} />
              <span className="leading-tight">
                <span className="block text-[15px] font-bold text-slate-900">HR Connect</span>
                <span className="hidden text-[11px] font-medium tracking-wide text-blue-600 sm:block">Doanh nghiệp tuyển dụng</span>
              </span>
            </NavLink>
          </div>

          {!compact && (
            <nav aria-label="Điều hướng chính" className="flex items-center gap-1 h-16">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={linkClass(isActive(n.to), 'muted' in n && n.muted)} aria-current={isActive(n.to) ? 'page' : undefined}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-3">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/client/jobs/create')}
              className="hidden sm:inline-flex !bg-blue-600 hover:!bg-blue-700 !text-white !rounded-lg !border-0 shadow-sm font-medium transition-all active:scale-[0.98] !h-9 !px-4"
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
                className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] sm:pr-3"
              >
                <AccountAvatar name={name} avatar={user?.avatar} size={34} />
                <span className="hidden text-left leading-tight md:block">
                  <span className="block max-w-[160px] truncate text-sm font-semibold text-slate-900">{name}</span>
                  <span className="block max-w-[160px] truncate text-xs text-slate-500">{user?.email}</span>
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
              <NavLink key={n.to} to={n.to} className={linkClass(isActive(n.to), 'muted' in n && n.muted, true)}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/client/jobs/create" className={linkClass(location.pathname === '/client/jobs/create', false, true)}>
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
