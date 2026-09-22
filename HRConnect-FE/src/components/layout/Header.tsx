import React, { useState, useCallback } from 'react';
import {
  Layout, Input, Badge, Dropdown, Avatar, Space, Modal, List,
  Typography, Tooltip, Button, Tag, message,
} from 'antd';
import {
  SearchOutlined, BellOutlined, LogoutOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { DEMO_USERS } from '@/types/roles';
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
          <Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
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
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '0 12px',
            height: 34,
            cursor: 'pointer',
            width: 270,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0284c7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
        >
          <SearchOutlined style={{ color: '#94a3b8', fontSize: 13 }} />
          <span style={{ color: '#94a3b8', fontSize: 12.5, flex: 1, userSelect: 'none' }}>Tìm kiếm nhanh...</span>
          <Tag style={{ margin: 0, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, padding: '0 4px', borderRadius: 4, lineHeight: '18px' }}>
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
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)',
                  width: 360,
                  maxHeight: 480,
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                    Thông báo trực tiếp
                  </span>
                  <span style={{ color: '#0284c7', fontSize: 12, cursor: 'pointer' }} onClick={() => useAlertStore.getState().clearAll()}>
                    Xóa tất cả
                  </span>
                </div>
                <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                  {alerts.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      <BellOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                      Chưa có thông báo nào
                    </div>
                  ) : (
                    <List
                      dataSource={alerts.slice(0, 15)}
                      renderItem={(alert) => (
                        <List.Item
                          key={alert.id}
                          style={{
                            padding: '12px 16px',
                            background: alert.read ? 'transparent' : '#f0f9ff',
                            borderBottom: '1px solid #f8fafc',
                            cursor: 'pointer',
                          }}
                          actions={[
                            <span
                              key="dismiss"
                              style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
                              onClick={() => dismissAlert(alert.id)}
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
            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
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
                background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
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
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tìm kiếm trang, chức năng, ứng viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            bordered={false}
            style={{ fontSize: 16, fontWeight: 400 }}
            size="large"
          />
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', maxHeight: 360, overflowY: 'auto' }}>
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
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 500, fontSize: 14, color: '#0f172a' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.category}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>↵ Điều hướng</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>ESC Đóng</Text>
        </div>
      </Modal>
    </>
  );
};
