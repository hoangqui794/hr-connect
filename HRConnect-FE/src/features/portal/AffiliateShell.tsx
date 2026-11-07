/**
 * @file AffiliateShell.tsx
 * @description Affiliate workspace (MF-02 branch B): white sidebar with a flat menu, sky accent
 * and an orange "Giới thiệu ứng viên" CTA (mockup canvas 03/11).
 * Derived from HrLayout: same off-canvas menu below lg, loading feedback and Escape handling.
 */
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { affiliateApi } from '@/services/api/mf02Api';
import {
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
  KeyOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { TrophyOutlined, SolutionOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';
import { useCompactLayout } from '@/features/admin-console/useCompactLayout';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { ChangePasswordModal } from '@/components/common/ChangePasswordModal';
import { AdminPageEnter, AdminPageSkeleton, AdminTopProgress } from '@/features/admin-console/AdminRouteProgress';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import '@/features/admin-console/admin-console.css';
import './affiliate/affiliate.css';
import { BrandMark } from '@/components/common/BrandMark';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  muted?: boolean;
}

const NAV: NavItem[] = [
  { to: '/affiliate/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
  { to: '/affiliate/jobs', label: 'Việc làm', icon: <FileTextOutlined /> },
  { to: '/affiliate/submissions', label: 'Lượt giới thiệu', icon: <SendOutlined /> },
  { to: '/affiliate/attributions', label: 'Ghi nhận nguồn', icon: <SafetyCertificateOutlined /> },
  { to: '/affiliate/candidates', label: 'Kho ứng viên', icon: <TeamOutlined /> },
  { to: '/affiliate/commissions', label: 'Hoa hồng và chi trả', icon: <DollarOutlined /> },
  { to: '/affiliate/performance', label: 'Hiệu suất', icon: <TrophyOutlined /> },
  { to: '/affiliate/disputes', label: 'Khiếu nại', icon: <SolutionOutlined /> },
  { to: '/affiliate/profile', label: 'Hồ sơ và ngân hàng', icon: <UserOutlined /> },
];

// Phones get the four most used pages at the bottom; the rest stay in the off-canvas menu.
const BOTTOM_NAV = ['/affiliate/dashboard', '/affiliate/jobs', '/affiliate/submissions', '/affiliate/commissions'];
const BOTTOM_LABEL: Record<string, string> = { '/affiliate/submissions': 'Giới thiệu', '/affiliate/commissions': 'Hoa hồng' };

// Pages reached from the CTA rather than the menu still need a header title.
const ALL_ITEMS: NavItem[] = [
  ...NAV,
  { to: '/affiliate/submit-candidate', label: 'Giới thiệu ứng viên', icon: <UserAddOutlined /> },
];

export const AffiliateShell: React.FC = () => {
  const [collapsedPref, setCollapsed] = useState(false);
  const compact = useCompactLayout();
  const collapsed = collapsedPref && !compact;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const pendingCount = useQuery({
    queryKey: ['aff-submissions', 'count', 'PENDING_CONSENT'],
    queryFn: async () => (await affiliateApi.submissions({ status: 'PENDING_CONSENT', page: 1, pageSize: 1 })).totalCount,
  });

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
      (null),
    [location.pathname]
  );

  const signOut = async () => {
    try {
      await authService.logout(); // revokes the refresh token server-side
    } finally {
      logout();
      window.location.replace('/login');
    }
  };

  const name = user?.name || 'Affiliate';
  const width = collapsed ? 76 : 248;

  return (
    <div className="affiliate-console min-h-screen max-w-full overflow-x-hidden bg-slate-50 text-slate-900">
      {/* ── Sidebar (light) ─────────────────────────────────────────────── */}
      {compact && menuOpen && (
        <div className="fixed inset-0 z-[25] bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden />
      )}
      <aside
        className={`affiliate-sidebar fixed inset-y-0 left-0 z-30 flex flex-col border-0 border-r border-solid transition-[width,transform] duration-200${compact && menuOpen ? ' shadow-2xl' : ''}`}
        style={{
          width: compact ? 272 : width,
          transform: compact && !menuOpen ? 'translateX(-100%)' : undefined,
          visibility: compact && !menuOpen ? 'hidden' : undefined,
        }}
        aria-label="Điều hướng Affiliate"
      >
        <div className="affiliate-sidebar-brand flex h-16 items-center gap-2.5 px-4">
          <BrandMark size={32} className="shrink-0" />
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[17px] font-bold text-[color:var(--affiliate-brand)]">HR Connect</span>
              <span className="rounded bg-sky-100 px-1.5 py-px text-[11px] font-semibold text-sky-800">Affiliate</span>
            </div>
          )}
        </div>

        <div className="px-3 pt-4">
          <Tooltip title={collapsed ? 'Giới thiệu ứng viên' : ''} placement="right">
            <NavLink
              to="/affiliate/submit-candidate"
              aria-label={collapsed ? 'Giới thiệu ứng viên' : undefined}
              className="affiliate-sidebar-cta flex h-11 items-center justify-center gap-2 rounded-md text-sm font-semibold no-underline transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
              <UserAddOutlined aria-hidden />
              {!collapsed && <span>Giới thiệu ứng viên</span>}
            </NavLink>
          </Tooltip>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
          <ul className="m-0 list-none space-y-0.5 p-0">
            {NAV.map((item) => (
              <li key={item.to}>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        'affiliate-nav-link relative flex h-10 items-center gap-3 rounded-md px-3 text-sm no-underline transition-colors duration-150',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600',
                        collapsed ? 'justify-center' : '',
                        isActive ? 'active font-semibold' : item.muted ? 'font-normal opacity-80' : 'font-normal',
                      ].join(' ')
                    }
                  >
                    <span className="text-[16px]" aria-hidden>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.to === '/affiliate/submissions' && Boolean(pendingCount.data) && (
                      <span className="ml-auto text-xs text-orange-800" aria-label={`${pendingCount.data} lượt chờ xác nhận`}>{pendingCount.data}</span>
                    )}
                  </NavLink>
                </Tooltip>
              </li>
            ))}
          </ul>
        </nav>

        {!collapsed && (
          <div className="affiliate-sidebar-footer px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <QuestionCircleOutlined aria-hidden /> Cần hỗ trợ?
            </div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">Xem hướng dẫn tại từng màn hình hoặc liên hệ bộ phận vận hành HR Connect.</div>
          </div>
        )}

        {!compact && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-11 cursor-pointer items-center gap-2 border-0 border-t border-solid border-slate-100 bg-transparent px-5 text-slate-500 transition-colors hover:text-slate-900"
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && <span className="text-xs">Thu gọn</span>}
        </button>
        )}
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="min-w-0 max-w-full overflow-x-hidden transition-[padding] duration-200" style={{ paddingLeft: compact ? 0 : width }}>
        <header className="affiliate-topbar sticky top-0 z-20 flex h-16 items-center justify-between border-0 border-b border-solid px-4 lg:px-6">
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
            {current && <span className="truncate text-lg font-bold text-slate-900">{current.label}</span>}
          </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ & Tài khoản' },
                  { key: 'password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
                  { type: 'divider' },
                  { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') signOut();
                  else if (key === 'password') setShowPasswordModal(true);
                  else if (key === 'profile') navigate('/affiliate/profile');
                },
              }}
            >
              <button
                type="button"
                className="flex cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)]"
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
        <main className="affiliate-main min-w-0 max-w-full overflow-x-hidden mx-auto px-4 py-5 pb-24 md:pb-5 lg:px-6 lg:py-6">
          <AdminPageEnter pathKey={location.pathname}>
            <Suspense fallback={<AdminPageSkeleton />}>
              <Outlet />
            </Suspense>
          </AdminPageEnter>
        </main>
      </div>
      <nav aria-label="Menu chính" className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-4 border-0 border-t border-solid border-gray-200 bg-white md:hidden">
        {NAV.filter((i) => BOTTOM_NAV.includes(i.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-[11px] no-underline ${isActive ? 'font-semibold text-[color:var(--affiliate-brand)]' : 'text-gray-500'}`
            }
          >
            <span className="text-lg" aria-hidden>{item.icon}</span>
            {BOTTOM_LABEL[item.to] ?? item.label}
          </NavLink>
        ))}
      </nav>
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default AffiliateShell;
