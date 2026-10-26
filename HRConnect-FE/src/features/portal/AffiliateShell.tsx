/**
 * @file AffiliateShell.tsx
 * @description Affiliate workspace (MF-02 branch B): light sidebar, violet accent.
 * Derived from HrLayout: same off-canvas menu below lg, loading feedback and Escape handling.
 */
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from 'antd';
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

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Tổng quan',
    items: [
      { to: '/affiliate/dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
      { to: '/affiliate/performance', label: 'Kết quả giới thiệu', icon: <TrophyOutlined /> },
    ],
  },
  {
    group: 'Tuyển dụng',
    items: [
      { to: '/affiliate/jobs', label: 'Tìm cơ hội tuyển dụng', icon: <FileTextOutlined /> },
      { to: '/affiliate/submit-candidate', label: 'Giới thiệu ứng viên', icon: <UserAddOutlined /> },
      { to: '/affiliate/submissions', label: 'Lượt giới thiệu', icon: <SendOutlined /> },
      { to: '/affiliate/candidates', label: 'Kho ứng viên', icon: <TeamOutlined /> },
    ],
  },
  {
    group: 'Quyền lợi & hỗ trợ',
    items: [
      { to: '/affiliate/attributions', label: 'Quyền ghi nhận', icon: <SafetyCertificateOutlined /> },
      { to: '/affiliate/disputes', label: 'Khiếu nại', icon: <SolutionOutlined /> },
      { to: '/affiliate/commissions', label: 'Hoa hồng & chi trả', icon: <DollarOutlined /> },
    ],
  },
  {
    group: 'Tài khoản',
    items: [
      { to: '/affiliate/profile', label: 'Hồ sơ & cài đặt', icon: <UserOutlined /> },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

export const AffiliateShell: React.FC = () => {
  const [collapsedPref, setCollapsed] = useState(false);
  const compact = useCompactLayout();
  const collapsed = collapsedPref && !compact;
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

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
      window.location.replace('/');
    }
  };

  const name = user?.name || 'Cộng tác viên';
  const width = collapsed ? 76 : 236;

  return (
    <div className="affiliate-console min-h-screen bg-[#F7F5FC] text-slate-900">
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
        aria-label="Điều hướng cộng tác viên"
      >
        <div className="affiliate-sidebar-brand flex h-[58px] items-center gap-3 px-4">
          <BrandMark size={36} className="shrink-0" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-bold text-white">HR Connect</div>
              <div className="text-[11px] font-medium tracking-wide text-violet-200">Cộng tác viên tuyển dụng</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mt-5 first:mt-2">
              {!collapsed && (
                <div className="affiliate-nav-group px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.11em]">{g.group}</div>
              )}
              <ul className="m-0 list-none space-y-0.5 p-0">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <Tooltip title={collapsed ? item.label : ''} placement="right">
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          [
                            'affiliate-nav-link relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium no-underline transition-colors duration-150',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400',
                            collapsed ? 'justify-center' : '',
                            isActive ? 'active font-semibold' : item.muted ? 'font-normal opacity-80' : '',
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

        {!collapsed && (
          <div className="affiliate-sidebar-footer px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <QuestionCircleOutlined aria-hidden /> Cần hỗ trợ?
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-slate-300">Xem hướng dẫn tại từng màn hình hoặc liên hệ bộ phận vận hành HR Connect.</div>
          </div>
        )}

        {!compact && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-11 cursor-pointer items-center gap-2 border-0 border-t border-solid border-white/10 bg-transparent px-5 text-slate-300 transition-colors hover:text-white"
          aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && <span className="text-xs">Thu gọn</span>}
        </button>
        )}
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="transition-[padding] duration-200" style={{ paddingLeft: compact ? 0 : width }}>
        <header className="affiliate-topbar sticky top-0 z-20 flex h-[58px] items-center justify-between border-0 border-b border-solid px-4 backdrop-blur lg:px-6">
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
            <span className="hidden text-slate-500 sm:inline">Không gian cộng tác viên</span>
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
        <main className="affiliate-main mx-auto px-4 py-5 lg:px-6 lg:py-6">
          <AdminPageEnter pathKey={location.pathname}>
            <Suspense fallback={<AdminPageSkeleton />}>
              <Outlet />
            </Suspense>
          </AdminPageEnter>
        </main>
      </div>
      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
};

export default AffiliateShell;
