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
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { CandidateUserDropdown } from '@/components/common/CandidateUserDropdown';
import type { MenuProps } from 'antd';

const { Header } = Layout;

export const CandidateHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();
  const [notifOpen, setNotifOpen] = useState(false);

  // Dynamic notification state from hrconnect_notifications filtered by currentUser.email
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchNotifications = () => {
      try {
        const raw = localStorage.getItem('hrconnect_notifications');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const currentEmail = user?.email?.toLowerCase().trim();
            const filtered = parsed.filter((n: any) =>
              !currentEmail || !n.recipientEmail || n.recipientEmail.toLowerCase().trim() === currentEmail
            );
            setUserNotifications(filtered);
            const unread = filtered.filter((n: any) => n.isRead === false).length;
            setUnreadNotifsCount(unread);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to read hrconnect_notifications:', e);
      }
      setUnreadNotifsCount(0);
      setUserNotifications([]);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 1500);
    return () => clearInterval(interval);
  }, [user?.email]);

  const userName = user?.name || 'Ứng viên';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar || getInitials(userName);

  const isHomeActive = location.pathname === '/' || location.pathname === '/jobs';
  const isRecruiterActive = location.search.includes('mode=recruiters');

  return (
    <Header
      style={{
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
        padding: '0 32px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
      }}
    >
      {/* Left: Brand Logo & Navigation Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {/* Logo: HR Connect */}
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
          title="HR Connect — Nền tảng Tuyển dụng AI"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: 18,
              boxShadow: '0 3px 10px rgba(37, 99, 235, 0.3)',
            }}
          >
            H
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#0f172a', letterSpacing: '-0.3px' }}>
              HR Connect
            </span>
            <Tag
              style={{
                borderRadius: 100,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 8px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
              }}
            >
              AI-Powered
            </Tag>
          </div>
        </div>

        {/* Menu điều hướng chính */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            type="text"
            icon={<CompassOutlined />}
            onClick={() => navigate('/')}
            style={{
              borderRadius: 10,
              fontWeight: isHomeActive && !isRecruiterActive ? 600 : 500,
              fontSize: 14,
              height: 36,
              transition: 'all 0.2s',
              ...(isHomeActive && !isRecruiterActive
                ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe' }
                : { color: '#475569', border: '1px solid transparent' }),
            }}
          >
            Trang chủ / Tìm việc
          </Button>

          <Button
            type="text"
            icon={<TeamOutlined />}
            onClick={() => navigate('/?mode=recruiters')}
            style={{
              borderRadius: 10,
              fontWeight: isRecruiterActive ? 600 : 500,
              fontSize: 14,
              height: 36,
              transition: 'all 0.2s',
              ...(isRecruiterActive
                ? { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe' }
                : { color: '#475569', border: '1px solid transparent' }),
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
                background: '#ffffff',
                borderRadius: 14,
                boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.08)',
                width: 360,
                maxHeight: 450,
                overflow: 'hidden',
                border: '1px solid rgba(226, 232, 240, 0.9)',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(241, 245, 249, 0.9)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                  Thông báo ứng tuyển
                </span>
                <span
                  style={{ color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
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
                        style={{ padding: '12px 16px', background: alert.read ? 'transparent' : 'rgba(239, 246, 255, 0.9)', borderBottom: '1px solid rgba(241, 245, 249, 0.9)' }}
                        actions={[
                          <span key="dismiss" style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }} onClick={() => dismissAlert(alert.id)}>
                            ✕
                          </span>,
                        ]}
                      >
                        <List.Item.Meta
                          title={<span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{alert.title}</span>}
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
          <Badge count={unreadNotifsCount !== 0 ? unreadNotifsCount : unreadCount} size="small" offset={[-2, 2]}>
            <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18, color: '#475569' }} />} style={{ width: 36, height: 36 }} />
          </Badge>
        </Dropdown>

        {/* Avatar cá nhân TopCV Dropdown Menu */}
        <CandidateUserDropdown />
      </Space>
    </Header>
  );
};
