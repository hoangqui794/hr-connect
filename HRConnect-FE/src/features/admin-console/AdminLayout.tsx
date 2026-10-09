/**
 * @file AdminLayout.tsx
 * @description Dedicated Admin shell ("Slate Command" + soft UI): navy sidebar built from plain
 * links (no antd Layout/Menu, so the global light-sidebar CSS cannot leak in), a top bar with
 * breadcrumb and account menu, and a soft canvas. Every other role keeps AppShell.
 */
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { useCompactLayout } from './useCompactLayout';
import { Initials } from './ui';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from './AdminRouteProgress';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  muted?: boolean;
}

const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Tổng quan', items: [{ to: '/admin/dashboard', label: 'Việc cần xử lý', icon: <DashboardOutlined /> }] },
  {
    group: 'Vận hành',
    items: [
      { to: '/admin/jobs', label: 'Duyệt tin tuyển dụng', icon: <FileTextOutlined /> },
      { to: '/admin/approvals', label: 'Phê duyệt tài khoản', icon: <SafetyCertificateOutlined /> },
      { to: '/admin/candidate-identity-claims', label: 'Danh tính Candidate', icon: <LinkOutlined /> },
      { to: '/admin/users', label: 'Người dùng', icon: <TeamOutlined /> },
    ],
  },
  {
    group: 'Cấu hình',
    items: [
      { to: '/admin/service-types', label: 'Loại dịch vụ', icon: <AppstoreOutlined /> },
      { to: '/admin/commission-rules', label: 'Quy tắc hoa hồng', icon: <DollarOutlined /> },
    ],
  },
  { group: 'Giám sát', items: [{ to: '/admin/audit-trail', label: 'Nhật ký hệ thống', icon: <AuditOutlined /> }] },
  {
    group: 'Chưa có API',
    items: [
      { to: '/admin/disputes', label: 'Tranh chấp', icon: <SolutionOutlined />, muted: true },
      { to: '/admin/payouts', label: 'Chi trả hoa hồng', icon: <BankOutlined />, muted: true },
      { to: '/admin/settings', label: 'Cài đặt hệ thống', icon: <SettingOutlined />, muted: true },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

export const AdminLayout: React.FC = () => {
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
    () => ALL_ITEMS.find((i) => location.pathname.startsWith(i.to)) ?? (location.pathname === '/admin/profile' ? { label: 'Hồ sơ', group: 'Tài khoản' } : null),
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

  const name = user?.name || 'Quản trị viên';
  const width = collapsed ? 76 : 260;

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {compact && menuOpen && (
        <div className="fixed inset-0 z-[25] bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-[#0F172A] transition-[width,transform] duration-200${compact && menuOpen ? ' shadow-2xl' : ''}`}
        style={{
          width: compact ? 272 : width,
          transform: compact && !menuOpen ? 'translateX(-100%)' : undefined,
          visibility: compact && !menuOpen ? 'hidden' : undefined,
        }}
        aria-label="Điều hướng quản trị"
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#047857] text-base font-extrabold text-white">
            H
          </span>
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold text-white">HR Connect</div>
              <div className="text-[11px] font-medium tracking-wide text-slate-400">Bảng quản trị</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mt-5 first:mt-2">
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{g.group}</div>
              )}
              <ul className="m-0 list-none space-y-0.5 p-0">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <Tooltip title={collapsed ? item.label : ''} placement="right">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          [
                            'group flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium no-underline transition-colors duration-150',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-emerald-400',
                            collapsed ? 'justify-center' : '',
                            isActive
                              ? 'bg-white/[0.08] text-white shadow-[inset_3px_0_0_#34D399]'
                              : item.muted
                                ? 'text-slate-400 font-normal hover:bg-white/[0.04] hover:text-slate-200'
                                : 'text-slate-300 hover:bg-white/[0.05] hover:text-white',
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
          className="flex h-11 cursor-pointer items-center gap-2 border-0 border-t border-solid border-white/10 bg-transparent px-5 text-slate-400 transition-colors hover:text-white"
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
            <span className="hidden text-slate-500 sm:inline">{current?.group ?? 'Quản trị'}</span>
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
              onClick: ({ key }) => (key === 'logout' ? signOut() : navigate('/admin/profile')),
            }}
          >
            <button
              type="button"
              className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
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

export default AdminLayout;
