import React, { useState } from 'react';
import { Button, Space, Tag, Avatar, Dropdown, Badge, List, message, Drawer, Divider } from 'antd';
import {
  LogoutOutlined,
  DashboardOutlined,
  CompassOutlined,
  SearchOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  BellOutlined,
  MenuOutlined,
  LoginOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, getInitials } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { useI18nStore } from '@/i18n';
import { CandidateWorkspaceMenu } from '@/features/portal/candidate/CandidateWorkspaceMenu';
import { UserRole } from '@/types/roles';
import { ROLE_DASHBOARD_ROUTES } from '@/routes/AppRoutes';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18nStore();
  const { isAuthenticated, role, user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userName = user?.name || 'Người dùng';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar || getInitials(userName);

  const handleLogout = () => {
    logout();
    void message.success('Đã đăng xuất thành công!');
    setMobileMenuOpen(false);
    navigate('/');
  };

  const navigateAndClose = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  // Generic non-candidate dropdown
  const genericMenuItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '6px 4px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{userName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{userEmail}</div>
        </div>
      ),
      disabled: true,
    },
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Vào Dashboard',
      onClick: () => navigate(ROLE_DASHBOARD_ROUTES[role] || '/dashboard'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const isRolesActive = location.pathname === '/' && location.hash === '#roles';
  const isHomeActive = location.pathname === '/' && !isRolesActive;
  const isJobsActive = location.pathname === '/jobs' || location.pathname.startsWith('/jobs/');
  const isServicesActive = location.pathname === '/services';

  // Ẩn mục "Bảng giá dịch vụ" đối với CANDIDATE; Chỉ hiển thị khi là Khách (chưa đăng nhập) hoặc Doanh nghiệp
  const showServicesPricing =
    !isAuthenticated ||
    role === UserRole.CLIENT ||
    role === UserRole.ADMIN ||
    role === UserRole.INTERNAL_HR;

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm transition-all">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div
          onClick={() => navigate('/')}
          title="HR Connect — AI-Powered Recruitment Platform"
          className="flex cursor-pointer select-none items-center gap-2.5 sm:gap-3 shrink-0"
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 text-lg sm:text-xl font-extrabold text-white shadow-md shadow-blue-500/20">
            H
          </div>
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
            HR Connect
          </span>
          <Tag
            className="hidden xl:inline-flex m-0 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-blue-700"
          >
            Recruitment Platform
          </Tag>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          <Button
            type="text"
            icon={<CompassOutlined />}
            onClick={() => navigate('/')}
            style={{
              color: isHomeActive ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              background: isHomeActive ? '#eff6ff' : 'transparent',
              borderRadius: 8,
            }}
          >
            Giới thiệu
          </Button>

          <Button
            type="text"
            icon={<SearchOutlined />}
            onClick={() => navigate('/jobs')}
            style={{
              color: isJobsActive ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              background: isJobsActive ? '#eff6ff' : 'transparent',
              borderRadius: 8,
            }}
          >
            Việc làm
          </Button>

          <Button
            type="text"
            icon={<TeamOutlined />}
            onClick={() => navigate('/#roles')}
            style={{
              color: isRolesActive ? '#1d4ed8' : '#475569',
              fontWeight: 600,
              fontSize: 14,
              background: isRolesActive ? '#eff6ff' : 'transparent',
              borderRadius: 8,
            }}
          >
            Vai trò
          </Button>

          {showServicesPricing && (
            <Button
              type="text"
              icon={<DollarCircleOutlined />}
              onClick={() => navigate('/services')}
              style={{
                color: isServicesActive ? '#1d4ed8' : '#475569',
                fontWeight: 600,
                fontSize: 14,
                background: isServicesActive ? '#eff6ff' : 'transparent',
                borderRadius: 8,
              }}
            >
              Giải pháp dịch vụ
            </Button>
          )}
        </nav>

        {/* Desktop Right Controls */}
        <div className="hidden lg:flex items-center gap-3">
          {isAuthenticated && (
            <Dropdown
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open);
                if (open && unreadCount > 0) markAllRead();
              }}
              trigger={['click']}
              dropdownRender={() => (
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: 14,
                    boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.08)',
                    width: 340,
                    maxHeight: 400,
                    overflow: 'hidden',
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(241, 245, 249, 0.9)', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Thông báo</span>
                    <span style={{ color: '#2563eb', fontSize: 11, cursor: 'pointer', fontWeight: 600 }} onClick={() => useAlertStore.getState().clearAll()}>
                      Xóa tất cả
                    </span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {alerts.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Chưa có thông báo mới
                      </div>
                    ) : (
                      <List
                        dataSource={alerts.slice(0, 8)}
                        renderItem={(alert) => (
                          <List.Item
                            key={alert.id}
                            style={{
                              padding: '10px 14px',
                              background: alert.read ? 'transparent' : 'rgba(239, 246, 255, 0.9)',
                              borderBottom: '1px solid rgba(241, 245, 249, 0.9)',
                            }}
                            actions={[
                              <span key="del" style={{ fontSize: 10, color: '#94a3b8', cursor: 'pointer' }} onClick={() => dismissAlert(alert.id)}>✕</span>,
                            ]}
                          >
                            <List.Item.Meta
                              title={<span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{alert.title}</span>}
                              description={<span style={{ fontSize: 11, color: '#64748b' }}>{alert.message}</span>}
                            />
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}
            >
              <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 17, color: '#475569' }} />} />
              </Badge>
            </Dropdown>
          )}

          {isAuthenticated ? (
            role === UserRole.CANDIDATE ? (
              <CandidateWorkspaceMenu showWorkspaceButton />
            ) : (
              <Dropdown menu={{ items: genericMenuItems }} placement="bottomRight" trigger={['click']}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    background: 'rgba(241, 245, 249, 0.8)',
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                  }}
                >
                  <Avatar
                    size={28}
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {userAvatar}
                  </Avatar>
                  <span style={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>
                    {userName.split(' ').slice(-1)[0]}
                  </span>
                </div>
              </Dropdown>
            )
          ) : (
            <Space size={8}>
              <Button
                type="text"
                onClick={() => navigate('/login')}
                style={{
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: 13,
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  background: '#ffffff',
                  borderRadius: 8,
                }}
              >
                {t.nav.signIn}
              </Button>
              <Button
                type="primary"
                onClick={() => navigate('/register')}
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  borderRadius: 8,
                  background: '#2563eb',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                {t.nav.register}
              </Button>
            </Space>
          )}
        </div>

        {/* Mobile / Tablet Controls (< lg) */}
        <div className="flex lg:hidden items-center gap-2">
          {isAuthenticated && (
            <Dropdown
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open);
                if (open && unreadCount > 0) markAllRead();
              }}
              trigger={['click']}
              dropdownRender={() => (
                <div className="w-80 rounded-xl bg-white p-2 shadow-xl border border-slate-100">
                  <div className="flex justify-between p-2 text-xs font-bold border-b border-slate-100">
                    <span>Thông báo</span>
                    <span className="text-blue-600 cursor-pointer" onClick={() => useAlertStore.getState().clearAll()}>
                      Xóa tất cả
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto text-xs p-2">
                    {alerts.length === 0 ? 'Chưa có thông báo' : alerts.slice(0, 5).map(a => (
                      <div key={a.id} className="py-1 border-b border-slate-50">{a.title}</div>
                    ))}
                  </div>
                </div>
              )}
            >
              <Badge count={unreadCount} size="small">
                <Button type="text" shape="circle" icon={<BellOutlined className="text-base text-slate-700" />} />
              </Badge>
            </Dropdown>
          )}

          {!isAuthenticated && (
            <Button
              type="primary"
              size="small"
              onClick={() => navigate('/login')}
              className="text-xs font-semibold rounded-lg h-8 bg-blue-600"
            >
              Đăng nhập
            </Button>
          )}

          <Button
            type="text"
            icon={<MenuOutlined className="text-lg text-slate-700" />}
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-lg hover:bg-slate-100"
            aria-label="Menu điều hướng"
          />
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        placement="right"
        width={300}
        styles={{ body: { padding: '16px 20px' } }}
        title={
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">
              H
            </div>
            <span className="font-bold text-slate-900">HR Connect</span>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <Button
            type="text"
            block
            icon={<CompassOutlined />}
            onClick={() => navigateAndClose('/')}
            className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
              isHomeActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
            }`}
          >
            Giới thiệu
          </Button>

          <Button
            type="text"
            block
            icon={<SearchOutlined />}
            onClick={() => navigateAndClose('/jobs')}
            className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
              isJobsActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
            }`}
          >
            Việc làm
          </Button>

          <Button
            type="text"
            block
            icon={<TeamOutlined />}
            onClick={() => navigateAndClose('/#roles')}
            className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
              isRolesActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
            }`}
          >
            Vai trò
          </Button>

          {showServicesPricing && (
            <Button
              type="text"
              block
              icon={<DollarCircleOutlined />}
              onClick={() => navigateAndClose('/services')}
              className={`flex items-center justify-start h-10 px-3 font-semibold rounded-lg text-left ${
                isServicesActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              Giải pháp dịch vụ
            </Button>
          )}
        </div>

        <Divider className="my-4" />

        {isAuthenticated ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
              <Avatar
                size={36}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {userAvatar}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 truncate">{userName}</div>
                <div className="text-xs text-slate-500 truncate">{userEmail}</div>
              </div>
            </div>

            <Button
              type="primary"
              block
              icon={<DashboardOutlined />}
              onClick={() => navigateAndClose(ROLE_DASHBOARD_ROUTES[role] || '/dashboard')}
              className="h-10 font-bold bg-blue-600 rounded-lg"
            >
              Vào Dashboard ({role})
            </Button>

            <Button
              danger
              block
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="h-10 font-semibold rounded-lg"
            >
              Đăng xuất
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button
              type="primary"
              block
              icon={<UserAddOutlined />}
              onClick={() => navigateAndClose('/register')}
              className="h-10 font-bold bg-blue-600 rounded-lg shadow-sm"
            >
              {t.nav.register}
            </Button>

            <Button
              block
              icon={<LoginOutlined />}
              onClick={() => navigateAndClose('/login')}
              className="h-10 font-semibold rounded-lg border-slate-300 text-slate-700"
            >
              {t.nav.signIn}
            </Button>
          </div>
        )}
      </Drawer>
    </header>
  );
};
