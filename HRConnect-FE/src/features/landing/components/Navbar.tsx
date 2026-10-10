import React, { useState } from 'react';
import { Button, Space, Tag, Avatar, Dropdown, Badge, List, message } from 'antd';
import {
  LogoutOutlined,
  DashboardOutlined,
  CompassOutlined,
  SearchOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, getInitials } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { useI18nStore } from '@/i18n';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { CandidateWorkspaceMenu } from '@/features/portal/candidate/CandidateWorkspaceMenu';
import { DEMO_USERS, UserRole } from '@/types/roles';
import { ROLE_DASHBOARD_ROUTES } from '@/routes/AppRoutes';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18nStore();
  const { isAuthenticated, role, user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const userName = user?.name || 'Người dùng';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar || getInitials(userName);

  const handleLogout = () => {
    logout();
    void message.success('Đã đăng xuất thành công!');
    navigate('/');
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

  // Ẩn mục "Bảng giá dịch vụ" đối với CANDIDATE; Chỉ hiển thị khi là Khách (chưa đăng nhập) hoặc Doanh nghiệp
  const showServicesPricing =
    !isAuthenticated ||
    role === UserRole.CLIENT ||
    role === UserRole.ADMIN ||
    role === UserRole.INTERNAL_HR;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 40px',
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Brand Logo */}
      <div
        onClick={() => navigate('/')}
        title="HR Connect — AI-Powered Recruitment Platform"
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: '#fff',
            fontSize: 19,
            boxShadow: '0 3px 12px rgba(15, 118, 110, 0.26)',
          }}
        >
          H
        </div>
        <span style={{ color: '#0f172a', fontWeight: 800, fontSize: 19, letterSpacing: '-0.3px' }}>
          HR Connect
        </span>
        <Tag
          style={{
            background: '#f0fdfa',
            color: '#115e59',
            border: '1px solid #99f6e4',
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '1px 8px',
          }}
        >
          Recruitment Platform
        </Tag>
      </div>

      {/* Các chức năng Guest: xem giới thiệu, tìm việc và xem thông tin dịch vụ. */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type="text"
          icon={<CompassOutlined />}
          onClick={() => navigate('/')}
          style={{
            color: isHomeActive ? '#115e59' : '#475569',
            fontWeight: isHomeActive ? 700 : 500,
            fontSize: 14,
            background: isHomeActive ? '#f0fdfa' : 'transparent',
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
            color: isJobsActive ? '#115e59' : '#475569',
            fontWeight: isJobsActive ? 700 : 500,
            fontSize: 14,
            background: isJobsActive ? '#f0fdfa' : 'transparent',
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
            color: isRolesActive ? '#115e59' : '#475569',
            fontWeight: isRolesActive ? 700 : 500,
            fontSize: 14,
            background: isRolesActive ? '#f0fdfa' : 'transparent',
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
              color: location.pathname === '/services' ? '#115e59' : '#475569',
              fontWeight: location.pathname === '/services' ? 700 : 500,
              fontSize: 14,
              borderRadius: 8,
            }}
          >
            Giải pháp dịch vụ
          </Button>
        )}
      </nav>

      {/* Right Controls: Language, Notification, Avatar / Auth */}
      <Space size={14} align="center">
        {/* Nút chuyển ngôn ngữ [VN / EN] */}
        <LanguageSwitcher theme="light" size="middle" />

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
                  <span style={{ color: '#0f766e', fontSize: 11, cursor: 'pointer', fontWeight: 600 }} onClick={() => useAlertStore.getState().clearAll()}>
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
                    background: 'linear-gradient(135deg, #0f766e, #115e59)',
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
                background: '#0f766e',
                border: 'none',
                boxShadow: '0 2px 8px rgba(15, 118, 110, 0.25)',
              }}
            >
              {t.nav.register}
            </Button>
          </Space>
        )}
      </Space>
    </header>
  );
};
