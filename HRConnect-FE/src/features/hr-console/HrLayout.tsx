/**
 * @file HrLayout.tsx
 * @description Internal HR workspace shell: light sidebar with a sky accent (distinct from the
 * navy Admin console), sticky top bar with breadcrumb and account menu. Pages reuse the Admin
 * soft-UI kit; the `.hr-console` class switches its accent variables to sky.
 * Menu follows the backend: MF-01 job review, MF-03 screening, MF-04 read-only progress.
 */
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from 'antd';
import {
  AuditOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { useCompactLayout } from '@/features/admin-console/useCompactLayout';
import { Initials } from '@/features/admin-console/ui';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import '@/features/admin-console/admin-console.css';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  muted?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Tổng quan', items: [{ to: '/hr/dashboard', label: 'Việc cần làm', icon: <DashboardOutlined /> }] },
  {
    group: 'Vận hành',
    items: [
      { to: '/hr/jobs', label: 'Duyệt tin tuyển dụng', icon: <FileTextOutlined /> },
      { to: '/hr/screening', label: 'Sàng lọc hồ sơ', icon: <FileSearchOutlined /> },
    ],
  },
  { group: 'Theo dõi', items: [{ to: '/hr/pipeline', label: 'Tiến độ tuyển dụng', icon: <CalendarOutlined /> }] },
  {
    group: 'Chưa có API',
    items: [
      { to: '/hr/placement-review', label: 'Đối soát nhận việc', icon: <AuditOutlined />, muted: true },
      { to: '/hr/warranty-tracking', label: 'Bảo hành & thử việc', icon: <SafetyCertificateOutlined />, muted: true },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

export const HrLayout: React.FC = () => {
  const [collapsedPref, setCollapsed] = useState(false);
  const compact = useCompactLayout();
  const collapsed = collapsedPref && !compact;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Off-canvas menu below lg: close it on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [location.pathname, compact]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const current = useMemo(
    () =>
      ALL_ITEMS.find((i) => location.pathname.startsWith(i.to)) ??
      (location.pathname === '/hr/profile' ? { label: 'Hồ sơ', group: 'Tài khoản' } : null),
    [location.pathname]
  );

  const signOut = async () => {
    try {
      await authService.logout(); // revokes the refresh token server-side
    } finally {
      logout();
      navigate('/login');
    }
  };

  const name = user?.name || 'Chuyên viên nhân sự';
  const width = collapsed ? 76 : 256;

  return (
    <div className="hr-console min-h-screen bg-[#F4F7FB] text-slate-900">
      {/* ── Sidebar (light) ─────────────────────────────────────────────── */}
      {compact && menuOpen && (
        <div className="fixed inset-0 z-[25] bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-0 border-r border-solid border-slate-200 bg-white transition-[width,transform] duration-200${compact && menuOpen ? ' shadow-2xl' : ''}`}
        style={{
          width: compact ? 272 : width,
          transform: compact && !menuOpen ? 'translateX(-100%)' : undefined,
          visibility: compact && !menuOpen ? 'hidden' : undefined,
        }}
        aria-label="Điều hướng Internal HR"
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0369A1] text-base font-extrabold text-white">
            H
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold text-slate-900">HR Connect</div>
              <div className="text-[11px] font-medium tracking-wide text-sky-800">Không gian Internal HR</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mt-5 first:mt-2">
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{g.group}</div>
              )}
              <ul className="m-0 list-none space-y-0.5 p-0">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <Tooltip title={collapsed ? item.label : ''} placement="right">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          [
                            'flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium no-underline transition-colors duration-150',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-700',
                            collapsed ? 'justify-center' : '',
                            isActive
                              ? 'bg-sky-50 font-semibold text-sky-900 shadow-[inset_3px_0_0_#0369A1]'
                              : item.muted
                                ? 'font-normal text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                          ].join(' ')
                        }
                      >
                        <span className="text-[16px]" aria-hidden>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {!compact && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-11 cursor-pointer items-center gap-2 border-0 border-t border-solid border-slate-200 bg-transparent px-5 text-slate-500 transition-colors hover:text-slate-900"
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && <span className="text-xs">Thu gọn</span>}
        </button>
        )}
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="transition-[padding] duration-200" style={{ paddingLeft: compact ? 0 : width }}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-0 border-b border-solid border-slate-200/70 bg-white/80 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
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
          <nav aria-label="Vị trí hiện tại" className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden text-slate-500 sm:inline">{current?.group ?? 'Internal HR'}</span>
            {current && (
              <>
                <span className="hidden text-slate-300 sm:inline" aria-hidden>/</span>
                <span className="truncate font-semibold text-slate-900">{current.label}</span>
              </>
            )}
          </nav>
          </div>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ của tôi' },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
              ],
              onClick: ({ key }) => (key === 'logout' ? signOut() : navigate('/hr/profile')),
            }}
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"
              aria-label="Tài khoản"
            >
              <Initials name={name} size={34} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold text-slate-900">{name}</span>
                <span className="block text-xs text-slate-500">{user?.email}</span>
              </span>
            </button>
          </Dropdown>
        </header>

        <AdminTopProgress offsetLeft={compact ? 0 : width} />
        <main className="mx-auto max-w-[1360px] px-4 py-6 lg:px-8 lg:py-8">
          <AdminPageEnter pathKey={location.pathname}>
            <Suspense fallback={<AdminPageSkeleton />}>
              <Outlet />
            </Suspense>
          </AdminPageEnter>
        </main>
      </div>
    </div>
  );
};

export default HrLayout;
