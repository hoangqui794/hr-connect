import React, { useState } from 'react';
import { Button, Space, Tag, Avatar, Dropdown, Badge, List, message } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  CompassOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, getInitials } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { useI18nStore } from '@/i18n';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { DEMO_USERS, UserRole } from '@/types/roles';
import { ROLE_DASHBOARD_ROUTES } from '@/routes/AppRoutes';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18nStore();
  const { isAuthenticated, role, user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const userName = user?.name || DEMO_USERS[role]?.name || 'Người dùng';
  const userEmail = user?.email || DEMO_USERS[role]?.email || '';
  const userAvatar = user?.avatar || getInitials(userName);

  const handleLogout = () => {
    logout();
    void message.success('Đã đăng xuất thành công!');
    navigate('/');
  };

  // Candidate-specific dropdown menu
  const candidateMenuItems = [
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
    { type: 'divider' as const },
    {
      key: 'profile',
      icon: <IdcardOutlined style={{ color: '#8b5cf6' }} />,
      label: 'Trang cá nhân & Quản lý CV',
      onClick: () => navigate('/candidate/profile'),
    },
    {
      key: 'applications',
      icon: <CheckCircleOutlined style={{ color: '#10b981' }} />,
      label: 'Lịch sử ứng tuyển & Lịch PV',
      onClick: () => navigate('/candidate/applications'),
    },
    {
      key: 'saved-jobs',
      icon: <HeartOutlined style={{ color: '#ef4444' }} />,
      label: 'Việc làm đã lưu',
      onClick: () => navigate('/candidate/saved-jobs'),
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

  const userMenuItems = role === UserRole.CANDIDATE ? candidateMenuItems : genericMenuItems;

  const isRecruiterActive = location.search.includes('mode=recruiters');
  const isHomeActive = location.pathname === '/' && !isRecruiterActive;

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
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
            background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            color: '#fff',
            fontSize: 19,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.45)',
          }}
        >
          H
        </div>
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 19, letterSpacing: '-0.3px' }}>
          HR Connect
        </span>
        <Tag
          style={{
            background: 'rgba(2, 132, 199, 0.18)',
            color: '#38bdf8',
            border: '1px solid rgba(2, 132, 199, 0.35)',
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '1px 8px',
          }}
        >
          AI-Powered
        </Tag>
      </div>

      {/* Menu điều hướng chính: [Trang chủ / Tìm việc], [Mạng lưới Recruiter], [Bảng giá dịch vụ] */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          type="text"
          icon={<CompassOutlined />}
          onClick={() => navigate('/')}
          style={{
            color: isHomeActive ? '#38bdf8' : '#cbd5e1',
            fontWeight: isHomeActive ? 700 : 500,
            fontSize: 14,
            background: isHomeActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
          }}
        >
          Trang chủ / Tìm việc
        </Button>

        <Button
          type="text"
          icon={<TeamOutlined />}
          onClick={() => navigate('/?mode=recruiters')}
          style={{
            color: isRecruiterActive ? '#38bdf8' : '#cbd5e1',
            fontWeight: isRecruiterActive ? 700 : 500,
            fontSize: 14,
            background: isRecruiterActive ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
          }}
        >
          Mạng lưới Recruiter
        </Button>

        {showServicesPricing && (
          <Button
            type="text"
            icon={<DollarCircleOutlined />}
            onClick={() => navigate('/services')}
            style={{
              color: location.pathname === '/services' ? '#38bdf8' : '#cbd5e1',
              fontWeight: location.pathname === '/services' ? 700 : 500,
              fontSize: 14,
            }}
          >
            Bảng giá dịch vụ
          </Button>
        )}
      </nav>

      {/* Right Controls: Language, Notification, Avatar / Auth */}
      <Space size={14} align="center">
        {/* Nút chuyển ngôn ngữ [VN / EN] */}
        <LanguageSwitcher theme="dark" size="middle" />

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
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)',
                  width: 340,
                  maxHeight: 400,
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>Thông báo</span>
                  <span style={{ color: '#0284c7', fontSize: 11, cursor: 'pointer' }} onClick={() => useAlertStore.getState().clearAll()}>
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
                          style={{ padding: '10px 14px', background: alert.read ? 'transparent' : '#f0f9ff' }}
                          actions={[
                            <span key="del" style={{ fontSize: 10, color: '#94a3b8', cursor: 'pointer' }} onClick={() => dismissAlert(alert.id)}>✕</span>,
                          ]}
                        >
                          <List.Item.Meta
                            title={<span style={{ fontSize: 12, fontWeight: 600 }}>{alert.title}</span>}
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
              <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 17, color: '#cbd5e1' }} />} />
            </Badge>
          </Dropdown>
        )}

        {isAuthenticated ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <Avatar
                size={28}
                style={{
                  background:
                    role === UserRole.CANDIDATE
                      ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                      : 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {userAvatar}
              </Avatar>
              <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600 }}>
                {userName.split(' ').slice(-1)[0]}
              </span>
            </div>
          </Dropdown>
        ) : (
          <Space size={8}>
            <Button
              type="text"
              onClick={() => navigate('/login')}
              style={{
                color: '#e2e8f0',
                fontWeight: 600,
                fontSize: 13,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.04)',
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
                background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
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
