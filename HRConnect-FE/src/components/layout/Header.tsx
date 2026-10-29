import React, { useState, useCallback, useEffect } from 'react';
import {
  Layout, Input, Badge, Dropdown, Space, Modal, List,
  Typography, Tooltip, Button, Tag, message,
} from 'antd';
import {
  SearchOutlined, BellOutlined, LogoutOutlined,
  ThunderboltOutlined, KeyOutlined, UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AccountAvatar } from '@/components/common/AccountAvatar';
import { RoleBadge } from '@/components/common/RoleBadge';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { ChangePasswordModal } from '@/components/common/ChangePasswordModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  // Dynamic user display without mock fallback
  const userName = user?.name || 'Người dùng';
  const userEmail = user?.email || '';

  const filteredSearch = SEARCH_ITEMS.filter(
    (item) =>
      !searchQuery ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = useCallback(() => {
    logout();
    void message.success('Đã đăng xuất thành công!');
    window.location.replace('/login');
  }, [logout]);

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
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
      onClick: () => navigate('/candidate/profile'),
    },
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: 'Đổi mật khẩu',
      onClick: () => setChangePasswordOpen(true),
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

          {/* Language Switcher */}
          <LanguageSwitcher theme="light" size="middle" />

          {/* Notifications Dropdown */}
          <NotificationBell />

          {/* User Avatar Menu */}
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
            <AccountAvatar name={userName} avatar={user?.avatar} size={34} />
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

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
};
