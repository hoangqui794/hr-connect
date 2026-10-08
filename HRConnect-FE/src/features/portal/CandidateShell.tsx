/**
 * @file CandidateShell.tsx
 * @description Candidate workspace (MF-02 branch A): job-site style top navigation, teal accent.
 * Derived from ClientShell: same off-canvas menu below lg, loading feedback and Escape handling.
 */
import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Dropdown } from 'antd';
import { CloseOutlined, LogoutOutlined, MenuOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { Initials } from '@/features/admin-console/ui';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import { useCompactLayout } from '@/features/admin-console/useCompactLayout';
import '@/features/admin-console/admin-console.css';

const NAV = [
  { to: '/candidate/dashboard', label: 'Tổng quan' },
  { to: '/candidate/applications', label: 'Đơn ứng tuyển' },
  { to: '/candidate/cvs', label: 'Kho CV' },
  { to: '/candidate/profile', label: 'Hồ sơ cá nhân' },
] as const;

const linkClass = (active: boolean, muted?: boolean, compact?: boolean) =>
  [
    'no-underline transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--console-accent)]',
    compact ? 'block rounded-xl px-4 py-3 text-[15px]' : 'flex h-10 items-center rounded-full px-4 text-[14px]',
    active
      ? 'bg-[color:var(--console-accent-soft)] font-semibold text-[color:var(--console-accent-strong)] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18)]'
      : muted
        ? 'font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800'
        : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export const CandidateShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useCompactLayout();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

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
      navigate('/login');
    }
  };

  const name = user?.name || 'Ứng viên';
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="candidate-console min-h-screen bg-[#F3F8F7] text-slate-900">
      <header className="sticky top-0 z-30 border-0 border-b border-solid border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 lg:px-8">
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

          <NavLink to="/candidate/dashboard" className="flex shrink-0 items-center gap-2.5 no-underline" aria-label="HR Connect, về tổng quan">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--console-accent)] text-base font-extrabold text-white">H</span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold text-slate-900">HR Connect</span>
              <span className="hidden text-[11px] font-medium tracking-wide text-[color:var(--console-accent-strong)] sm:block">Ứng viên</span>
            </span>
          </NavLink>

          {!compact && (
            <nav aria-label="Điều hướng chính" className="ml-2 flex items-center gap-1 rounded-full bg-slate-50 p-1 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={linkClass(isActive(n.to), false)} aria-current={isActive(n.to) ? 'page' : undefined}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-3">
            <Button type="primary" icon={<SearchOutlined />} onClick={() => navigate('/jobs')} className="hidden !rounded-full !px-5 sm:inline-flex">
              Tìm việc
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'company', icon: <UserOutlined />, label: 'Hồ sơ cá nhân' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => (key === 'logout' ? signOut() : navigate('/candidate/profile')),
              }}
            >
              <button
                type="button"
                aria-label="Tài khoản"
                className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] sm:pr-3"
              >
                <Initials name={name} size={34} />
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
              <NavLink key={n.to} to={n.to} className={linkClass(isActive(n.to), false, true)}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/jobs" className={linkClass(false, false, true)}>
              Tìm việc làm
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
    </div>
  );
};

export default CandidateShell;
