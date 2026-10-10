/**
 * @file CandidateShell.tsx
 * @description Persistent Candidate workspace with task-oriented desktop and mobile navigation.
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from 'antd';
import {
  CloseOutlined,
  FileDoneOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  MailOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { Initials } from '@/features/admin-console/ui';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import { useCompactLayout } from '@/features/admin-console/useCompactLayout';
import '@/features/admin-console/admin-console.css';
import './candidate/candidate.css';

const PRIMARY_NAV = [
  { to: '/candidate/dashboard', label: 'Tổng quan', icon: HomeOutlined, matches: ['/candidate/dashboard'] },
  { to: '/candidate/jobs', label: 'Tìm việc', icon: SearchOutlined, matches: ['/candidate/jobs'] },
  { to: '/candidate/applications', label: 'Đơn ứng tuyển', icon: FileDoneOutlined, matches: ['/candidate/applications', '/candidate/submission-consents'] },
  {
    to: '/candidate/cvs',
    label: 'Hồ sơ & CV',
    icon: FolderOpenOutlined,
    matches: ['/candidate/cvs', '/candidate/affiliate-cvs'],
  },
] as const;

const ACCOUNT_LINKS = [
  { to: '/candidate/profile', label: 'Hồ sơ cá nhân', icon: UserOutlined },
  { to: '/candidate/affiliate-cvs', label: 'CV do Affiliate gửi', icon: FolderOpenOutlined },
  { to: '/candidate/settings/email-identities', label: 'Email liên kết & khôi phục dữ liệu', icon: MailOutlined },
] as const;

const desktopLinkClass = (active: boolean) =>
  [
    'flex h-10 items-center gap-2 rounded-full px-4 text-[14px] no-underline transition-colors duration-150',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--console-accent)]',
    active
      ? 'bg-[color:var(--console-accent-soft)] font-semibold text-[color:var(--console-accent-strong)] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18)]'
      : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export const CandidateShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useCompactLayout();
  const { user, logout } = useAuthStore();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isPathActive = (prefixes: readonly string[]) =>
    prefixes.some((prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`));
  const isAccountPathActive = isPathActive(ACCOUNT_LINKS.map((item) => item.to));

  const closeAccount = (restoreFocus = false) => {
    setAccountOpen(false);
    if (restoreFocus) window.setTimeout(() => accountButtonRef.current?.focus(), 0);
  };

  useEffect(() => setAccountOpen(false), [location.pathname, compact]);
  useEffect(() => {
    if (!accountOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAccount(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const signOut = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      navigate('/login');
    }
  };

  const name = user?.name || 'Ứng viên';
  const accountMenuItems = [
    ...ACCOUNT_LINKS.map((item) => ({ key: item.to, icon: React.createElement(item.icon), label: item.label })),
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
  ];

  return (
    <div className="candidate-console min-h-screen bg-[#F5F8F7] text-slate-900">
      <header className="sticky top-0 z-30 border-0 border-b border-solid border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-5 px-4 lg:px-8">
          <NavLink to="/candidate/dashboard" className="flex shrink-0 items-center gap-2.5 no-underline" aria-label="HR Connect, về tổng quan">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--console-accent)] text-base font-extrabold text-white shadow-sm">H</span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold text-slate-900">HR Connect</span>
              <span className="hidden text-[11px] font-medium tracking-wide text-[color:var(--console-accent-strong)] sm:block">Không gian Candidate</span>
            </span>
          </NavLink>

          {!compact && (
            <nav aria-label="Điều hướng Candidate" className="ml-2 flex items-center gap-1 rounded-full bg-slate-50 p-1 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
              {PRIMARY_NAV.map((item) => {
                const active = isPathActive(item.matches);
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} className={desktopLinkClass(active)} aria-current={active ? 'page' : undefined}>
                    <Icon aria-hidden />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          )}

          <div className="ml-auto flex items-center">
            {compact ? (
              <button
                ref={accountButtonRef}
                type="button"
                aria-label="Mở tài khoản và cài đặt"
                aria-expanded={accountOpen}
                aria-controls="candidate-account-panel"
                onClick={() => setAccountOpen(true)}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent p-1 pr-2 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
              >
                <Initials name={name} size={36} />
                <span className="max-w-28 truncate text-sm font-semibold text-slate-800">{name}</span>
              </button>
            ) : (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: accountMenuItems,
                  selectedKeys: isAccountPathActive ? ACCOUNT_LINKS.filter((item) => isPathActive([item.to])).map((item) => item.to) : [],
                  onClick: ({ key }) => (key === 'logout' ? signOut() : navigate(key)),
                }}
              >
                <button
                  type="button"
                  aria-label="Tài khoản và cài đặt"
                  data-active={isAccountPathActive}
                  className={`flex cursor-pointer items-center gap-3 rounded-full border-0 py-1 pl-1 pr-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                    isAccountPathActive
                      ? 'bg-[color:var(--console-accent-soft)] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.18)]'
                      : 'bg-transparent hover:bg-slate-100'
                  }`}
                >
                  <Initials name={name} size={36} />
                  <span className="text-left leading-tight">
                    <span className="block max-w-[170px] truncate text-sm font-semibold text-slate-900">{name}</span>
                    <span className="block max-w-[170px] truncate text-xs text-slate-500">{user?.email}</span>
                  </span>
                </button>
              </Dropdown>
            )}
          </div>
        </div>
      </header>

      {compact && accountOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => closeAccount(true)} aria-hidden />
      )}
      {compact && (
        <aside
          id="candidate-account-panel"
          aria-label="Tài khoản và cài đặt"
          aria-hidden={!accountOpen}
          className="candidate-account-drawer fixed inset-y-0 right-0 z-50 w-[320px] max-w-[88vw] bg-white p-4 shadow-2xl"
          data-open={accountOpen}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Initials name={name} size={44} />
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold text-slate-900">{name}</p>
                <p className="m-0 mt-0.5 truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => closeAccount(true)}
              aria-label="Đóng tài khoản và cài đặt"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
            >
              <CloseOutlined />
            </button>
          </div>
          <nav aria-label="Liên kết tài khoản" className="space-y-1">
            {ACCOUNT_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  tabIndex={accountOpen ? 0 : -1}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 no-underline hover:bg-slate-100 hover:text-slate-950"
                >
                  <Icon aria-hidden className="text-[color:var(--console-accent)]" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <button
            type="button"
            tabIndex={accountOpen ? 0 : -1}
            onClick={signOut}
            className="mt-5 flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            <LogoutOutlined aria-hidden />
            Đăng xuất
          </button>
        </aside>
      )}

      <AdminTopProgress offsetLeft={0} />
      <main className="mx-auto max-w-[1280px] px-4 py-6 pb-28 lg:px-8 lg:py-8">
        <AdminPageEnter pathKey={location.pathname}>
          <Suspense fallback={<AdminPageSkeleton />}>
            <Outlet />
          </Suspense>
        </AdminPageEnter>
      </main>

      {compact && (
        <nav aria-label="Điều hướng Candidate trên thiết bị di động" className="candidate-bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-0 border-t border-solid border-slate-200 bg-white/95 px-1 pt-1 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          {PRIMARY_NAV.map((item) => {
            const active = isPathActive(item.matches);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] no-underline ${
                  active ? 'font-semibold text-[color:var(--console-accent-strong)]' : 'font-medium text-slate-500'
                }`}
              >
                <Icon aria-hidden className="text-lg" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
};

export default CandidateShell;
