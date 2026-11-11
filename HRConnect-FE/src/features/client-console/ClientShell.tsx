/**
 * @file ClientShell.tsx
 * @description Client Company workspace shell, laid out like the Affiliate workspace: a white sidebar with the
 * orange "Đăng tin" CTA and a flat menu (collapsible from 1024px), a slim top bar with the page title, bell and
 * account, and a full-width content area with no side gaps. Below 1024px the sidebar becomes an off-canvas menu and
 * phones get a bottom bar with the four most used pages.
 */
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  BankOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
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

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { to: '/client/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
  { to: '/client/jobs', label: 'Tin tuyển dụng', icon: <FileTextOutlined /> },
  { to: '/client/agreements', label: 'Thỏa thuận dịch vụ', icon: <FileDoneOutlined /> },
  { to: '/client/candidates', label: 'Hồ sơ ứng viên', icon: <TeamOutlined /> },
  { to: '/client/interviews-offers', label: 'Phỏng vấn & Offer', icon: <ScheduleOutlined /> },
  { to: '/client/warranty', label: 'Bảo hành', icon: <SafetyCertificateOutlined /> },
  { to: '/client/billing', label: 'Công nợ', icon: <DollarOutlined /> },
  { to: '/client/services', label: 'Dịch vụ', icon: <AppstoreOutlined /> },
];

// Phones: the four most used pages at the bottom; the rest stay in the off-canvas menu.
const BOTTOM_NAV = ['/client/dashboard', '/client/jobs', '/client/candidates', '/client/billing'];
const BOTTOM_LABEL: Record<string, string> = { '/client/jobs': 'Tin', '/client/candidates': 'Hồ sơ' };

// Pages reached from the CTA or the account menu still get a top-bar title.
const ALL_ITEMS: NavItem[] = [
  { to: '/client/jobs/create', label: 'Đăng tin tuyển dụng', icon: <PlusOutlined /> },
  ...NAV,
  { to: '/client/profile', label: 'Hồ sơ cá nhân', icon: <UserOutlined /> },
  { to: '/client/company', label: 'Hồ sơ doanh nghiệp', icon: <BankOutlined /> },
];

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C4A6E]';

export const ClientShell: React.FC = () => {
  const [collapsedPref, setCollapsed] = useState(false);
  const compact = useCompactLayout();
  const collapsed = collapsedPref && !compact;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname, compact]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const current = useMemo(() => ALL_ITEMS.find((i) => location.pathname.startsWith(i.to)) ?? null, [location.pathname]);

  const signOut = async () => {
    try {
      await authService.logout(); // revokes the refresh token server-side
    } finally {
      logout();
      window.location.replace('/login');
    }
  };

  const name = user?.name || 'Doanh nghiệp';
  const width = collapsed ? 76 : 248;
  const fullBleed = location.pathname === '/client/services';

  return (
    <div className={`${FONT} client-console min-h-screen max-w-full overflow-x-clip bg-[#F8FAFC] text-slate-900`}>
      {compact && menuOpen && <div className="fixed inset-0 z-[25] bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden />}

      <aside
        aria-label="Điều hướng doanh nghiệp"
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-0 border-r border-solid border-[#E2E8F0] bg-white transition-[width,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none${compact && menuOpen ? ' shadow-2xl' : ''}`}
        style={{
          width: compact ? 272 : width,
          transform: compact && !menuOpen ? 'translateX(-100%)' : undefined,
          visibility: compact && !menuOpen ? 'hidden' : undefined,
        }}
      >
        <NavLink to="/client/dashboard" aria-label="HR Connect, về tổng quan" className={`flex h-16 shrink-0 items-center gap-2.5 px-4 no-underline ${focusRing}`}>
          <BrandMark size={32} className="shrink-0" />
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[17px] font-extrabold text-[#0C4A6E]">HR Connect</span>
              <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500">Doanh nghiệp</span>
            </span>
          )}
        </NavLink>

        <div className="px-3 pt-3">
          <Tooltip title={collapsed ? 'Đăng tin' : ''} placement="right">
            <NavLink
              to="/client/jobs/create"
              aria-label={collapsed ? 'Đăng tin' : undefined}
              className={`flex h-11 items-center justify-center gap-2 rounded-lg bg-[#C2410C] text-sm font-bold text-white no-underline transition-[background-color,transform] duration-150 hover:bg-[#9A3412] hover:text-white active:scale-[0.97] ${focusRing}`}
            >
              <PlusOutlined aria-hidden />
              {!collapsed && <span>Đăng tin</span>}
            </NavLink>
          </Tooltip>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 pb-4 pt-3">
          <ul className="m-0 list-none space-y-0.5 p-0">
            {NAV.map((item) => (
              <li key={item.to}>
                <Tooltip title={collapsed ? item.label : ''} placement="right">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        'relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm no-underline transition-colors duration-150',
                        focusRing,
                        collapsed ? 'justify-center' : '',
                        isActive
                          ? 'bg-[#E0F2FE] font-bold text-[#0C4A6E] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r before:bg-[#0C4A6E] before:content-[""]'
                          : 'font-medium text-slate-700 hover:bg-slate-100 hover:text-[#0C4A6E]',
                      ].join(' ')
                    }
                  >
                    <span className="text-[16px]" aria-hidden>{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </Tooltip>
              </li>
            ))}
          </ul>
        </nav>

        {!collapsed && (
          <div className="border-0 border-t border-solid border-slate-100 px-4 py-3">
            <div className="text-xs font-semibold text-slate-800">HR Connect là nền tảng</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-600">Ứng viên tự nộp hoặc Affiliate giới thiệu; HR Connect sàng lọc theo dịch vụ bạn chọn.</div>
          </div>
        )}

        {!compact && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            className="flex h-11 cursor-pointer items-center gap-2 border-0 border-t border-solid border-slate-100 bg-transparent px-5 text-slate-500 transition-colors hover:text-slate-900"
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            {!collapsed && <span className="text-xs">Thu gọn</span>}
          </button>
        )}
      </aside>

      <div className="min-w-0 max-w-full overflow-x-clip transition-[padding] duration-200 motion-reduce:transition-none" style={{ paddingLeft: compact ? 0 : width }}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-0 border-b border-solid border-[#E2E8F0] bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {compact && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Mở menu"
                aria-expanded={menuOpen}
                className={`-ml-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-lg text-slate-700 hover:bg-slate-100 ${focusRing}`}
              >
                <MenuOutlined />
              </button>
            )}
            {current && <span className="truncate text-lg font-bold text-slate-900">{current.label}</span>}
          </div>
          <div className="flex items-center gap-3">
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
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 ${focusRing}`}
              >
                <AccountAvatar name={name} avatar={user?.avatar} size={34} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block max-w-[180px] truncate text-sm font-semibold text-slate-900">{name}</span>
                  <span className="block max-w-[180px] truncate text-xs text-slate-500">{user?.email}</span>
                </span>
              </button>
            </Dropdown>
          </div>
        </header>

        <AdminTopProgress offsetLeft={compact ? 0 : width} />
        <main className={fullBleed ? 'w-full min-w-0 pb-24 md:pb-0' : 'w-full min-w-0 px-4 py-5 pb-24 md:pb-6 lg:px-6 lg:py-6'}>
          <AdminPageEnter pathKey={location.pathname}>
            <Suspense fallback={<AdminPageSkeleton />}>
              <Outlet />
            </Suspense>
          </AdminPageEnter>
        </main>
      </div>

      <nav aria-label="Menu nhanh" className="fixed inset-x-0 bottom-0 z-20 grid h-16 grid-cols-4 border-0 border-t border-solid border-[#E2E8F0] bg-white md:hidden">
        {NAV.filter((i) => BOTTOM_NAV.includes(i.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 text-[11px] no-underline ${isActive ? 'font-semibold text-[#0C4A6E]' : 'text-slate-500'}`
            }
          >
            <span className="text-lg" aria-hidden>{item.icon}</span>
            {BOTTOM_LABEL[item.to] ?? item.label}
          </NavLink>
        ))}
      </nav>

      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
};

export default ClientShell;
