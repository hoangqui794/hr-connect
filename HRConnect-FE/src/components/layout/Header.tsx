import React, { useState, useCallback, useEffect } from 'react';
import {
  Layout, Input, Badge, Dropdown, Avatar, Space, Modal, List,
  Typography, Tooltip, Button, Tag, message,
} from 'antd';
import {
  SearchOutlined, BellOutlined, LogoutOutlined,
  ThunderboltOutlined, UserOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { RoleBadge } from '@/components/common/RoleBadge';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { MockWebSocketService } from '@/services/mockWebSocket';
import type { MenuProps } from 'antd';

const { Header } = Layout;
const { Text } = Typography;

// Command palette search items
const SEARCH_ITEMS = [
  { key: '/jobs/create', label: 'Đăng tin tuyển dụng mới', category: 'Tuyển dụng', icon: '📝' },
  { key: '/jobs', label: 'Xem bảng tin việc làm', category: 'Tuyển dụng', icon: '💼' },
  { key: '/screening', label: 'Sàng lọc hồ sơ AI', category: 'Sàng lọc', icon: '🤖' },
  { key: '/affiliate/referral', label: 'Gửi hồ sơ giới thiệu ứng viên', category: 'Cộng tác viên', icon: '👤' },
  { key: '/affiliate/ledger', label: 'Sổ cái hoa hồng', category: 'Tài chính', icon: '💰' },
  { key: '/candidates', label: 'Kho ứng viên', category: 'Ứng viên', icon: '🎯' },
  { key: '/cv-builder', label: 'Công cụ tạo CV', category: 'Ứng viên', icon: '📄' },
  { key: '/admin', label: 'Quản trị hệ thống', category: 'Quản trị', icon: '⚙️' },
];

interface AppHeaderProps {
  siderWidth: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ siderWidth }) => {
  const navigate = useNavigate();
  const { role, user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);

  // Dynamic notification state from hrconnect_notifications filtered by currentUser.email
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);

  useEffect(() => {
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

  const handleClearAllNotifications = () => {
    useAlertStore.getState().clearAll();
    try {
      const raw = localStorage.getItem('hrconnect_notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const currentEmail = user?.email?.toLowerCase().trim();
          const updated = parsed.map((n: any) => {
            if (!currentEmail || !n.recipientEmail || n.recipientEmail.toLowerCase().trim() === currentEmail) {
              return { ...n, isRead: true };
            }
            return n;
          });
          localStorage.setItem('hrconnect_notifications', JSON.stringify(updated));
        }
      }
    } catch (e) {
      console.error(e);
    }
    setUnreadNotifsCount(0);
  };

  // Dynamic user display without mock fallback
  const userName = user?.name || 'Người dùng';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar || (user?.name ? user.name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(-2).join('').toUpperCase() : 'U');

  const filteredSearch = SEARCH_ITEMS.filter(
    (item) =>
      !searchQuery ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = useCallback(() => {
    logout();
    void message.success('Đã đăng xuất thành công!');
    navigate('/login');
  }, [logout, navigate]);

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '6px 4px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
            {userName}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
            {userEmail}
          </div>
          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Vai trò hiện tại
          </Text>
          <div style={{ marginTop: 4 }}>
            <RoleBadge role={role} />
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    ...(role === 'AFFILIATE'
      ? [
          {
            key: 'affiliate-settings',
            icon: <SettingOutlined />,
            label: 'Hồ sơ đối tác & Ngân hàng',
            onClick: () => navigate('/affiliate/settings'),
          },
        ]
      : role === 'CLIENT'
      ? [
          {
            key: 'client-settings',
            icon: <SettingOutlined />,
            label: 'Hồ sơ doanh nghiệp',
            onClick: () => navigate('/client/settings'),
          },
        ]
      : role === 'CANDIDATE'
      ? [
          {
            key: 'candidate-profile',
            icon: <UserOutlined />,
            label: 'Hồ sơ cá nhân & Tìm việc',
            onClick: () => navigate('/candidate/profile'),
          },
        ]
      : [
          {
            key: 'admin-settings',
            icon: <SettingOutlined />,
            label: 'Cấu hình hệ thống',
            onClick: () => navigate('/admin/settings'),
          },
        ]),
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Keyboard shortcut (Cmd/Ctrl + K) - ONLY toggles when explicitly pressed
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <Header
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 64,
          marginLeft: siderWidth,
          transition: 'margin-left 0.3s',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}
      >
        {/* Command Search Bar - Click to open */}
        <div
          id="header-search-box"
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(241, 245, 249, 0.8)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: 10,
            padding: '0 12px',
            height: 36,
            cursor: 'pointer',
            width: 270,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#3b82f6';
            e.currentTarget.style.background = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.9)';
            e.currentTarget.style.background = 'rgba(241, 245, 249, 0.8)';
          }}
        >
          <SearchOutlined style={{ color: '#64748b', fontSize: 13 }} />
          <span style={{ color: '#64748b', fontSize: 12.5, flex: 1, userSelect: 'none' }}>Tìm kiếm nhanh...</span>
          <Tag style={{ margin: 0, background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.9)', color: '#64748b', fontSize: 11, padding: '0 6px', borderRadius: 6, lineHeight: '18px' }}>
            Ctrl+K
          </Tag>
        </div>

        {/* Right Section */}
        <Space size={16}>
          {/* Live Demo Alert Trigger */}
          <Tooltip title="Kích hoạt thông báo mẫu">
            <Button
              type="text"
              size="small"
              icon={<ThunderboltOutlined style={{ color: '#f59e0b' }} />}
              onClick={() => MockWebSocketService.triggerAlert(Math.floor(Math.random() * 7))}
            />
          </Tooltip>

          {/* Language Switcher */}
          <LanguageSwitcher theme="light" size="middle" />

          {/* Notifications Dropdown */}
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
                  maxHeight: 480,
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
                    Thông báo trực tiếp
                  </span>
                  <span style={{ color: '#2563eb', fontSize: 12, cursor: 'pointer', fontWeight: 600 }} onClick={handleClearAllNotifications}>
                    Xóa tất cả
                  </span>
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {userNotifications.length === 0 && alerts.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      <BellOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                      Chưa có thông báo nào
                    </div>
                  ) : (
                    <List
                      dataSource={[
                        ...userNotifications.map((n) => ({
                          id: n.id,
                          title: n.title,
                          message: n.content,
                          read: n.isRead,
                          isCustom: true,
                        })),
                        ...alerts,
                      ].slice(0, 15)}
                      renderItem={(alert: any) => (
                        <List.Item
                          key={alert.id}
                          style={{
                            padding: '12px 16px',
                            background: alert.read ? 'transparent' : 'rgba(239, 246, 255, 0.9)',
                            borderBottom: '1px solid rgba(241, 245, 249, 0.9)',
                            cursor: 'pointer',
                          }}
                          actions={[
                            <span
                              key="dismiss"
                              style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
                              onClick={() => {
                                if (alert.isCustom) {
                                  try {
                                    const raw = localStorage.getItem('hrconnect_notifications');
                                    if (raw) {
                                      const parsed = JSON.parse(raw);
                                      const updated = parsed.map((x: any) => x.id === alert.id ? { ...x, isRead: true } : x);
                                      localStorage.setItem('hrconnect_notifications', JSON.stringify(updated));
                                      setUnreadNotifsCount((prev) => Math.max(0, prev - 1));
                                    }
                                  } catch (e) {
                                    console.error(e);
                                  }
                                } else {
                                  dismissAlert(alert.id);
                                }
                              }}
                            >
                              ✕
                            </span>,
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                {alert.title}
                              </span>
                            }
                            description={
                              <span style={{ fontSize: 12, color: '#64748b' }}>{alert.message}</span>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </div>
            )}
          >
            <Badge count={unreadNotifsCount + unreadCount} offset={[-2, 6]} size="small">
              <Button
                type="text"
                shape="circle"
                icon={<BellOutlined style={{ fontSize: 18, color: '#475569' }} />}
                style={{ width: 36, height: 36 }}
              />
            </Badge>
          </Dropdown>

          {/* User Avatar Menu */}
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <Avatar
              size={34}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
            >
              {userAvatar}
            </Avatar>
          </Dropdown>
        </Space>
      </Header>

      {/* Command Search Modal */}
      <Modal
        open={searchOpen}
        onCancel={() => { setSearchOpen(false); setSearchQuery(''); }}
        footer={null}
        title={null}
        width={560}
        className="command-search"
        styles={{ body: { padding: 0 } }}
        centered
      >
        <div style={{ padding: '16px 16px 0' }}>
          <Input
            autoFocus
            prefix={<SearchOutlined style={{ color: '#64748b' }} />}
            placeholder="Tìm kiếm trang, chức năng, ứng viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            bordered={false}
            style={{ fontSize: 15, fontWeight: 400, color: '#0f172a' }}
            size="large"
          />
        </div>
        <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.9)', maxHeight: 360, overflowY: 'auto' }}>
          {filteredSearch.map((item) => (
            <div
              key={item.key}
              onClick={() => {
                navigate(item.key);
                setSearchOpen(false);
                setSearchQuery('');
              }}
              style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(241, 245, 249, 0.8)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{item.category}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(226, 232, 240, 0.9)', display: 'flex', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>↵ Điều hướng</Text>
          <Text type="secondary" style={{ fontSize: 11, color: '#94a3b8' }}>ESC Đóng</Text>
        </div>
      </Modal>
    </>
  );
};
