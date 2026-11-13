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
  BarChartOutlined,
  DashboardOutlined,
  DollarOutlined,
  KeyOutlined,
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
  UserSwitchOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { useCompactLayout } from './useCompactLayout';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from './AdminRouteProgress';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BrandMark } from '@/components/common/BrandMark';

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
      { to: '/admin/approvals', label: 'Phê duyệt tài khoản', icon: <SafetyCertificateOutlined /> },
      { to: '/admin/candidate-identity-claims', label: 'Danh tính Candidate', icon: <LinkOutlined /> },
      { to: '/admin/disputes', label: 'Tranh chấp & Khiếu nại', icon: <SolutionOutlined /> },
      { to: '/admin/users', label: 'Người dùng', icon: <TeamOutlined /> },
      { to: '/admin/contact-requests', label: 'Yêu cầu tư vấn', icon: <CustomerServiceOutlined /> },
    ],
  },
  {
    group: 'Cấu hình',
    items: [
      { to: '/admin/roles-permissions', label: 'Vai trò & Phân quyền', icon: <KeyOutlined /> },
      { to: '/admin/service-types', label: 'Loại dịch vụ', icon: <AppstoreOutlined /> },
      { to: '/admin/commission-rules', label: 'Quy tắc hoa hồng', icon: <DollarOutlined /> },
      { to: '/admin/settings', label: 'Cài đặt hệ thống', icon: <SettingOutlined /> },
    ],
  },
  { group: 'Tài chính', items: [{ to: '/admin/payouts', label: 'Tài chính', icon: <BankOutlined /> }] },
  {
    group: 'Giám sát',
    items: [
      { to: '/admin/reports', label: 'Báo cáo & Thống kê', icon: <BarChartOutlined /> },
      { to: '/admin/audit-trail', label: 'Nhật ký hệ thống', icon: <AuditOutlined /> },
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

  const navGroups = useMemo(() => NAV, []);

  const allItems = useMemo(
    () => navGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group }))),
    [navGroups]
  );

  const current = useMemo(
    () => allItems.find((i) => location.pathname.startsWith(i.to)) ?? (location.pathname === '/admin/profile' ? { label: 'Hồ sơ', group: 'Tài khoản' } : null),
    [allItems, location.pathname]
  );

  const signOut = async () => {
    try {
      await authService.logout(); // revokes the refresh token server-side
    } finally {
      logout();
      window.location.replace('/login');
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
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-white border-0 border-r border-solid border-slate-200/90 transition-[width,transform] duration-200${compact && menuOpen ? ' shadow-2xl' : ' shadow-[1px_0_3px_0_rgba(0,0,0,0.02)]'}`}
        style={{
          width: compact ? 272 : width,
          transform: compact && !menuOpen ? 'translateX(-100%)' : undefined,
          visibility: compact && !menuOpen ? 'hidden' : undefined,
        }}
        aria-label="Điều hướng quản trị"
      >
        <div className="flex h-16 items-center gap-2.5 px-4 border-0 border-b border-solid border-slate-100">
          <BrandMark size={34} className="shrink-0" />
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[16px] font-black tracking-tight text-slate-900">HR Connect</span>
              <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200/80">
                Quản trị
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((g) => (
            <div key={g.group} className="mt-5 first:mt-3">
              {!collapsed && (
                <div className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">{g.group}</div>
              )}
              <ul className="m-0 list-none space-y-0.5 p-0">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <Tooltip title={collapsed ? item.label : ''} placement="right">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          [
                            'relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm no-underline transition-colors duration-150',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-sky-500',
                            collapsed ? 'justify-center' : '',
                            isActive
                              ? 'bg-sky-50/90 font-bold text-[#0284C7] shadow-2xs before:absolute before:inset-y-2 before:left-0 before:w-[3.5px] before:rounded-r before:bg-[#0284C7] before:content-[""]'
                              : 'font-medium text-slate-700 hover:bg-slate-100/80 hover:text-[#0284C7]',
                          ].join(' ')
                        }
                      >
                        <span className="text-[17px] shrink-0" aria-hidden>
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
            className="flex h-11 cursor-pointer items-center gap-2 border-0 border-t border-solid border-slate-100 bg-slate-50/60 px-5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            {!collapsed && <span className="text-xs font-semibold">Thu gọn thanh bên</span>}
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
            <span className="hidden text-slate-500 sm:inline">
              {current?.group && current.group !== current.label ? current.group : 'Quản trị'}
            </span>
            {current && (
              <>
                <span className="hidden text-slate-300 sm:inline" aria-hidden>/</span>
                <span className="truncate font-semibold text-slate-900">{current.label}</span>
              </>
            )}
          </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
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
                className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                aria-label="Tài khoản"
              >
                <AccountAvatar name={name} avatar={user?.avatar} size={34} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-semibold text-slate-900">{name}</span>
                  <span className="block text-xs text-slate-500">{user?.email}</span>
                </span>
              </button>
            </Dropdown>
          </div>
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
