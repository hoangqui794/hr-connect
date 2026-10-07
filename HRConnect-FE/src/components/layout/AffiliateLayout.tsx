/**
 * @file AffiliateLayout.tsx
 * @path src/components/layout/AffiliateLayout.tsx
 * @description Enterprise Layout for Headhunter / Affiliate Recruiter (Role: AFFILIATE RECRUITER / OPR HUB - David Tran).
 * 
 * Spec Compliance:
 * 1. 5 Standard Business Menu Items:
 *    - [Bảng điều khiển] (/affiliate/dashboard)
 *    - [Sàn việc làm nhận tuyển] (/affiliate/jobs)
 *    - [Hồ sơ đã giới thiệu & Tiến độ] (/affiliate/submissions) (MỚI)
 *    - [Nộp hồ sơ ứng viên] (/affiliate/submit-candidate)
 *    - [Sổ cái hoa hồng & Payout] (/affiliate/commissions)
 * 2. Identity: David Tran - RecruitPro Network (Trust Rating 4.8 ⭐ / 5.0 - Top Recruiter Tier)
 * 3. Compact Search Bar (Ctrl+K) without automatic popover opening.
 */

import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Input, Modal, Badge, Dropdown, Avatar, Space,
  Tag, Button, Breadcrumb, List, message,
} from 'antd';
import {
  DashboardOutlined, AppstoreOutlined, TeamOutlined, UserAddOutlined,
  DollarOutlined, SearchOutlined, BellOutlined, LogoutOutlined,
  ThunderboltOutlined, StarFilled, SettingOutlined, BankOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

// ─── 5 Standard Business Menu Items for Affiliate Recruiter ───────────────────
export const AFFILIATE_MENU_ITEMS = [
  {
    key: '/affiliate/dashboard',
    label: 'Bảng điều khiển',
    icon: <DashboardOutlined />,
    description: 'Tổng quan hoa hồng, tỷ lệ chuyển đổi, tin nổi bật',
  },
  {
    key: '/affiliate/jobs',
    label: 'Sàn việc làm nhận tuyển',
    icon: <AppstoreOutlined />,
    description: 'Bảng tin Job mở cho Headhunter, lọc theo % hoa hồng & COD',
  },
  {
    key: '/affiliate/submissions',
    label: 'Hồ sơ đã giới thiệu & Tiến độ',
    icon: <TeamOutlined />,
    description: 'Theo dõi phễu ứng viên & khiếu nại tranh chấp Attribution',
  },
  {
    key: '/affiliate/submit-candidate',
    label: 'Nộp hồ sơ ứng viên',
    icon: <UserAddOutlined />,
    description: 'Gửi CV ứng viên kèm kiểm tra trùng lặp email/SĐT tự động',
  },
  {
    key: '/affiliate/commissions',
    label: 'Sổ cái hoa hồng & Payout',
    icon: <DollarOutlined />,
    description: 'Quản lý dòng tiền hoa hồng theo các mốc 60 ngày bảo hành',
  },
];

interface AffiliateLayoutProps {
  children?: React.ReactNode;
}

export const AffiliateLayout: React.FC<AffiliateLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { alerts, unreadCount, markRead, markAllRead } = useAlertStore();

  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Headhunter Identity from active session
  const affiliateUser = {
    name: user?.name || 'Chuyên viên Tuyển dụng',
    network: user?.company || 'Cộng tác viên Độc lập',
    affiliateId: user?.id || 'aff-user',
    role: 'HEADHUNTER / AFFILIATE',
    trustRating: user?.trustRating ?? 5.0,
    avatar: user?.avatar || (user?.name ? user.name.slice(0, 2).toUpperCase() : 'HH'),
  };

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Quick navigation items for search palette
  const searchResults = AFFILIATE_MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchSelect = (path: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  };

  const userDropdownMenu: MenuProps = {
    items: [
      {
        key: 'profile-header',
        disabled: true,
        label: (
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>{affiliateUser.name}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>{affiliateUser.network}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Tag color="gold" style={{ margin: 0, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <StarFilled /> {affiliateUser.trustRating} / 5.0 Rating
              </Tag>
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                OPR HUB
              </Tag>
            </div>
          </div>
        ),
      },
      { type: 'divider' },
      {
        key: 'payout-accounts',
        icon: <BankOutlined />,
        label: 'Tài khoản nhận hoa hồng',
        onClick: () => navigate('/affiliate/settings?tab=bank'),
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Cài đặt tài khoản & Hồ sơ',
        onClick: () => navigate('/affiliate/settings'),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        danger: true,
        label: 'Đăng xuất',
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
  };

  const notificationMenu: MenuProps = {
    items: [
      {
        key: 'notif-header',
        disabled: true,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 260 }}>
            <span style={{ fontWeight: 600 }}>Thông báo Headhunter</span>
            {unreadCount > 0 && (
              <Button type="link" size="small" onClick={() => markAllRead()} style={{ padding: 0, fontSize: 12 }}>
                Đọc hết
              </Button>
            )}
          </div>
        ),
      },
      { type: 'divider' },
      ...(alerts.length === 0
        ? [
            {
              key: 'empty',
              disabled: true,
              label: <div style={{ textAlign: 'center', padding: '12px 0', color: '#94a3b8' }}>Không có thông báo mới</div>,
            },
          ]
        : alerts.slice(0, 5).map((notif) => ({
            key: notif.id,
            label: (
              <div
                onClick={() => markRead(notif.id)}
                style={{
                  padding: '6px 0',
                  opacity: notif.read ? 0.6 : 1,
                  maxWidth: 280,
                }}
              >
                <div style={{ fontWeight: notif.read ? 400 : 600, fontSize: 13, color: '#0f172a' }}>{notif.title}</div>
                <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'normal' }}>{notif.message}</div>
              </div>
            ),
          }))),
    ],
  };

  // Determine active key (mapping aliases like /affiliate/referral -> /affiliate/submit-candidate, /affiliate/ledger -> /affiliate/commissions)
  const currentPath = location.pathname;
  let activeMenuKey = currentPath;
  if (currentPath === '/affiliate/referral') activeMenuKey = '/affiliate/submit-candidate';
  if (currentPath === '/affiliate/ledger') activeMenuKey = '/affiliate/commissions';

  const currentMenuItem = AFFILIATE_MENU_ITEMS.find((item) => item.key === activeMenuKey);
  const breadcrumbItems = [
    { title: 'Affiliate Recruiter Portal' },
    { title: currentMenuItem ? currentMenuItem.label : 'Trang làm việc' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* ─── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={250}
        style={{
          background: '#070a11',
          borderRight: '1px solid rgba(51, 65, 85, 0.65)',
          boxShadow: '2px 0 12px rgba(0,0,0,0.3)',
          zIndex: 100,
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {/* Brand Logo & Recruiter Badge */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 18px' : '0 20px',
            background: '#070a11',
            borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/affiliate/dashboard')}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <ThunderboltOutlined />
          </div>
          {!collapsed && (
            <div style={{ marginLeft: 12, overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>HR CONNECT</div>
              <div style={{ color: '#f59e0b', fontSize: 11, letterSpacing: '0.04em', fontWeight: 600 }}>
                AFFILIATE / OPR HUB
              </div>
            </div>
          )}
        </div>

        {/* Headhunter Identity Card */}
        {!collapsed && (
          <div
            style={{
              margin: '12px 14px 8px 14px',
              padding: '10px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.07)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar src={affiliateUser.avatar} size={36} style={{ border: '1.5px solid #f59e0b' }}>
                {affiliateUser.name.charAt(0)}
              </Avatar>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {affiliateUser.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <StarFilled style={{ color: '#f59e0b', fontSize: 11 }} />
                  <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>{affiliateUser.trustRating}</span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>• {affiliateUser.affiliateId}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeMenuKey]}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            marginTop: 8,
            borderRight: 0,
          }}
          items={AFFILIATE_MENU_ITEMS.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>,
          }))}
        />
      </Sider>

      {/* ─── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <Layout style={{ background: '#0B0F17' }}>
        {/* Top Header Bar */}
        <Header
          style={{
            background: 'rgba(11, 15, 23, 0.85)',
            backdropFilter: 'blur(16px)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(51, 65, 85, 0.65)',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            height: 64,
          }}
        >
          {/* Left: Collapse Button + Breadcrumbs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 36, height: 36, color: '#94a3b8' }}
            />
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* Center: Non-intrusive Search Trigger Bar (Ctrl+K) */}
          <div
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: 320,
              height: 36,
              padding: '0 12px',
              borderRadius: 12,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.65)',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: 13,
              transition: 'all 0.2s ease',
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#f59e0b')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(51, 65, 85, 0.65)')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SearchOutlined style={{ color: '#94a3b8' }} />
              <span style={{ color: '#64748b' }}>Tìm job, hồ sơ, hoa hồng...</span>
            </span>
            <Tag
              style={{
                margin: 0,
                padding: '0 5px',
                fontSize: 11,
                lineHeight: '18px',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(51, 65, 85, 0.6)',
                color: '#94a3b8',
                borderRadius: 6,
              }}
            >
              Ctrl+K
            </Tag>
          </div>

          {/* Right Controls: Trust Tag, Notifications, Avatar */}
          <Space size={16} align="center">
            {/* Top Recruiter Rating Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <CheckCircleOutlined style={{ color: '#f59e0b', fontSize: 13 }} />
              <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>Top Recruiter Tier</span>
            </div>

            <LanguageSwitcher />

            <Dropdown menu={notificationMenu} placement="bottomRight" trigger={['click']}>
              <Badge count={unreadCount} size="small" offset={[-2, 4]}>
                <Button
                  type="text"
                  shape="circle"
                  icon={<BellOutlined style={{ fontSize: 17, color: '#94a3b8' }} />}
                  style={{ width: 38, height: 38 }}
                />
              </Badge>
            </Dropdown>

            <Dropdown menu={userDropdownMenu} placement="bottomRight" trigger={['click']}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  padding: '4px 10px',
                  borderRadius: 12,
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(51, 65, 85, 0.65)',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)')}
              >
                <Avatar src={affiliateUser.avatar} size={32} style={{ border: '2px solid #f59e0b' }}>
                  {affiliateUser.name.charAt(0)}
                </Avatar>
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{affiliateUser.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>RecruitPro Network</div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Page Content Body */}
        <Content style={{ padding: '24px', background: '#0B0F17', minHeight: 'calc(100vh - 64px)' }}>
          {children || <Outlet />}
        </Content>
      </Layout>

      {/* ─── MODAL SEARCH PALETTE (Triggered ONLY on Click or Ctrl+K) ───────────── */}
      <Modal
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        closable={false}
        destroyOnClose
        centered
        width={560}
        styles={{
          body: {
            padding: '16px',
            background: '#0f172a',
            borderRadius: 16,
            border: '1px solid rgba(51, 65, 85, 0.8)',
          },
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#f59e0b', fontSize: 16 }} />}
          placeholder="Tìm chức năng, sàn việc làm, hồ sơ đã nộp, sổ cái... (Esc để đóng)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
          style={{
            height: 44,
            fontSize: 14,
            borderRadius: 10,
            marginBottom: 12,
            border: '1px solid rgba(245, 158, 11, 0.5)',
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#f8fafc',
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 4, textTransform: 'uppercase' }}>
          ĐIỀU HƯỚNG NHANH
        </div>

        <List
          dataSource={searchResults}
          renderItem={(item) => (
            <List.Item
              onClick={() => handleSearchSelect(item.key)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background 0.15s',
                borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <span style={{ fontSize: 18, color: '#f59e0b' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{item.label}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{item.description}</div>
                </div>
                <Tag style={{ margin: 0, fontSize: 11, background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(51, 65, 85, 0.6)', color: '#cbd5e1' }}>Đi tới</Tag>
              </div>
            </List.Item>
          )}
        />
      </Modal>
    </Layout>
  );
};

export default AffiliateLayout;
