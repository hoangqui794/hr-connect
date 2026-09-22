import React, { useState } from 'react';
import {
  Layout,
  Badge,
  Dropdown,
  Avatar,
  Space,
  Button,
  Tag,
  message,
  List,
} from 'antd';
import {
  BellOutlined,
  LogoutOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  HeartOutlined,
  CompassOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore, getInitials } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { DEMO_USERS, UserRole } from '@/types/roles';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import type { MenuProps } from 'antd';

const { Header } = Layout;

export const CandidateHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const userName = user?.name || 'Ứng viên';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar || getInitials(userName);

  const handleLogout = () => {
    logout();
    void message.success('Đã đăng xuất tài khoản thành công!');
    navigate('/login');
  };

  /**
   * Menu Dropdown Avatar dành riêng cho Ứng viên (Candidate):
   * 1. [Trang cá nhân & Quản lý CV] -> /profile
   * 2. [Lịch sử ứng tuyển & Lịch PV] -> /profile?tab=applications
   * 3. [Việc làm đã lưu] -> /profile?tab=saved
   * Divider
   * 4. [Đăng xuất] -> Xóa session, về trang chủ
   */
  const candidateMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 6px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{userName}</span>
            <Tag color="#8b5cf6" style={{ borderRadius: 10, fontSize: 10, fontWeight: 700, margin: 0 }}>
              Ứng viên
            </Tag>
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{userEmail}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <IdcardOutlined style={{ fontSize: 15, color: '#8b5cf6' }} />,
      label: (
        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
          Trang cá nhân & Quản lý CV
        </span>
      ),
      onClick: () => navigate('/candidate/profile'),
    },
    {
      key: 'applications',
      icon: <CheckCircleOutlined style={{ fontSize: 15, color: '#10b981' }} />,
      label: (
        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
          Lịch sử ứng tuyển & Lịch PV
        </span>
      ),
      onClick: () => navigate('/candidate/applications'),
    },
    {
      key: 'saved-jobs',
      icon: <HeartOutlined style={{ fontSize: 15, color: '#ef4444' }} />,
      label: (
        <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
          Việc làm đã lưu
        </span>
      ),
      onClick: () => navigate('/candidate/saved-jobs'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined style={{ fontSize: 15 }} />,
      label: <span style={{ fontWeight: 600, fontSize: 13 }}>Đăng xuất</span>,
      danger: true,
      onClick: handleLogout,
    },
  ];

  const isHomeActive = location.pathname === '/' || location.pathname === '/jobs';
  const isRecruiterActive = location.search.includes('mode=recruiters');

  return (
    <Header
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Left: Brand Logo & Navigation Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {/* Logo: HR Connect (Badge: AI-Powered) */}
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
          title="HR Connect — Nền tảng Tuyển dụng AI"
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
              fontSize: 20,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            }}
          >
            H
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', letterSpacing: '-0.3px' }}>
              HR Connect
            </span>
            <Tag
              color="blue"
              style={{
                borderRadius: 100,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 8px',
                background: '#e0f2fe',
                color: '#0284c7',
                border: 'none',
              }}
            >
              AI-Powered
            </Tag>
          </div>
        </div>

        {/* Menu điều hướng chính: [Trang chủ / Tìm việc], [Mạng lưới Recruiter] (Ẩn Bảng giá dịch vụ cho Candidate) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            type={isHomeActive && !isRecruiterActive ? 'primary' : 'text'}
            icon={<CompassOutlined />}
            onClick={() => navigate('/')}
            style={{
              borderRadius: 8,
              fontWeight: isHomeActive && !isRecruiterActive ? 700 : 500,
              fontSize: 14,
              height: 38,
              ...(isHomeActive && !isRecruiterActive
                ? { background: '#f5f3ff', color: '#8b5cf6', border: 'none' }
                : { color: '#475569' }),
            }}
          >
            Trang chủ / Tìm việc
          </Button>

          <Button
            type={isRecruiterActive ? 'primary' : 'text'}
            icon={<TeamOutlined />}
            onClick={() => navigate('/?mode=recruiters')}
            style={{
              borderRadius: 8,
              fontWeight: isRecruiterActive ? 700 : 500,
              fontSize: 14,
              height: 38,
              ...(isRecruiterActive
                ? { background: '#f5f3ff', color: '#8b5cf6', border: 'none' }
                : { color: '#475569' }),
            }}
          >
            Mạng lưới Recruiter
          </Button>
        </div>
      </div>

      {/* Right Controls: Language, Notification, Avatar */}
      <Space size={16} align="center">
        {/* Nút chuyển ngôn ngữ [VN / EN] */}
        <LanguageSwitcher theme="light" size="middle" />

        {/* Chuông thông báo */}
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
                width: 360,
                maxHeight: 450,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  Thông báo ứng tuyển
                </span>
                <span
                  style={{ color: '#8b5cf6', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => useAlertStore.getState().clearAll()}
                >
                  Đánh dấu đã đọc
                </span>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {alerts.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    <BellOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                    Chưa có thông báo nào
                  </div>
                ) : (
                  <List
                    dataSource={alerts.slice(0, 10)}
                    renderItem={(alert) => (
                      <List.Item
                        key={alert.id}
                        style={{ padding: '12px 16px', background: alert.read ? 'transparent' : '#faf5ff', borderBottom: '1px solid #f8fafc' }}
                        actions={[
                          <span key="dismiss" style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }} onClick={() => dismissAlert(alert.id)}>
                            ✕
                          </span>,
                        ]}
                      >
                        <List.Item.Meta
                          title={<span style={{ fontSize: 13, fontWeight: 600 }}>{alert.title}</span>}
                          description={<span style={{ fontSize: 12, color: '#64748b' }}>{alert.message}</span>}
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
            <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18, color: '#475569' }} />} style={{ width: 38, height: 38 }} />
          </Badge>
        </Dropdown>

        {/* Avatar cá nhân (Click mở Dropdown) */}
        <Dropdown menu={{ items: candidateMenuItems }} trigger={['click']} placement="bottomRight">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 24,
              border: '1px solid #e2e8f0',
              background: '#faf5ff',
              transition: 'all 0.2s',
            }}
          >
            <Avatar
              size={34}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.35)',
              }}
            >
              {userAvatar}
            </Avatar>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', paddingRight: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                {userName.split(' ').slice(-1)[0]}
              </span>
              <span style={{ fontSize: 10, color: '#8b5cf6', fontWeight: 600 }}>Ứng viên</span>
            </div>
          </div>
        </Dropdown>
      </Space>
    </Header>
  );
};
