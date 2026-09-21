/**
 * @file ClientLayout.tsx
 * @description Enterprise Layout for Client / Company Portal (Role: CLIENT / COMPANY).
 * 
 * Spec A-04 Compliance:
 * 1. FIXED: Compact search command bar (Ctrl+K). NEVER auto-opens or floats over page titles.
 *    Only opens Modal search palette when clicked or upon pressing Ctrl+K / Cmd+K.
 * 2. Logged-in Enterprise Identity: Sarah Chen - TechCorp Việt Nam.
 * 3. 6 Standard Business Menu Items:
 *    - [Bảng điều khiển] (/client/dashboard)
 *    - [Tin tuyển dụng của tôi] (/client/jobs)
 *    - [Đăng tin tuyển dụng mới] (/client/jobs/create)
 *    - [Phễu quản lý Ứng viên] (/client/candidates)
 *    - [Lịch phỏng vấn & Offer] (/client/interviews-offers)
 *    - [Theo dõi Bảo hành 60 ngày] (/client/warranty)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layout, Menu, Input, Modal, Badge, Dropdown, Avatar, Space,
  Tag, Button, Tooltip, Breadcrumb, message, List,
} from 'antd';
import {
  SearchOutlined, BellOutlined, LogoutOutlined, ThunderboltOutlined,
  DashboardOutlined, FileTextOutlined, PlusCircleOutlined, TeamOutlined,
  CalendarOutlined, SafetyCertificateOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  SettingOutlined, BankOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useAlertStore } from '@/stores/alertStore';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { MockWebSocketService } from '@/services/mockWebSocket';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

// ─── 6 Standard Business Navigation Items for Client Portal ───────────────────
export const CLIENT_MENU_ITEMS = [
  {
    key: '/client/dashboard',
    label: 'Bảng điều khiển',
    icon: <DashboardOutlined />,
    description: 'Số liệu tổng quan: Tin đang tuyển, Lịch PV, Ứng viên mới',
  },
  {
    key: '/client/jobs',
    label: 'Tin tuyển dụng của tôi',
    icon: <FileTextOutlined />,
    description: 'Danh sách bài đăng của TechCorp Việt Nam',
  },
  {
    key: '/client/jobs/create',
    label: 'Đăng tin tuyển dụng mới',
    icon: <PlusCircleOutlined />,
    description: 'Wizard 3 bước: Thông tin JD -> Gói dịch vụ -> Gửi kiểm duyệt',
  },
  {
    key: '/client/candidates',
    label: 'Phễu quản lý Ứng viên',
    icon: <TeamOutlined />,
    badge: 'Mới',
    description: 'Bảng & Kanban quản lý ứng viên nộp vào tin',
  },
  {
    key: '/client/interviews-offers',
    label: 'Lịch phỏng vấn & Offer',
    icon: <CalendarOutlined />,
    badge: '3',
    description: 'Lịch Google Meet & trạng thái phát hành thư mời Offer',
  },
  {
    key: '/client/warranty',
    label: 'Theo dõi Bảo hành 60 ngày',
    icon: <SafetyCertificateOutlined />,
    badge: 'COD',
    description: 'Đếm ngược bảo hành thử việc cho gói Tuyển dụng trọn gói (COD)',
  },
];

// ─── Search Items for Command Palette (Ctrl+K) ────────────────────────────────
const SEARCH_NAV_ITEMS = [
  { key: '/client/dashboard', label: 'Bảng điều khiển doanh nghiệp', category: 'Tổng quan', icon: '📊' },
  { key: '/client/jobs', label: 'Tin tuyển dụng của tôi (TechCorp Việt Nam)', category: 'Tin tuyển dụng', icon: '💼' },
  { key: '/client/jobs/create', label: 'Đăng tin tuyển dụng mới (Wizard 3 bước)', category: 'Tin tuyển dụng', icon: '📝' },
  { key: '/client/candidates', label: 'Phễu quản lý Ứng viên (Candidate Pool)', category: 'Ứng viên', icon: '🎯' },
  { key: '/client/interviews-offers', label: 'Lịch phỏng vấn & Thư mời Offer', category: 'Phỏng vấn', icon: '📅' },
  { key: '/client/warranty', label: 'Theo dõi bảo hành thử việc 60 ngày (COD)', category: 'Bảo hành', icon: '🛡️' },
];

interface ClientLayoutProps {
  children?: React.ReactNode;
}

export const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { alerts, unreadCount, markAllRead, dismissAlert } = useAlertStore();

  const [collapsed, setCollapsed] = useState<boolean>(false);

  // CRITICAL FIX: searchOpen is strictly false by default. Never auto-opens on page load or hover.
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notifOpen, setNotifOpen] = useState<boolean>(false);

  // User & Company Identity according to Spec A-04
  const userName = user?.name || 'Sarah Chen';
  const companyName = user?.company || 'TechCorp Việt Nam';
  const userEmail = user?.email || 'sarah.chen@techcorp.vn';
  const userAvatar = user?.avatar || 'SC';

  // Listen for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    void message.success('Đã đăng xuất tài khoản doanh nghiệp!');
    navigate('/login');
  }, [logout, navigate]);

  // Determine active menu key
  const activeMenuKey = location.pathname.startsWith('/client/')
    ? location.pathname
    : location.pathname === '/jobs'
    ? '/client/jobs'
    : location.pathname === '/jobs/create'
    ? '/client/jobs/create'
    : location.pathname === '/candidates'
    ? '/client/candidates'
    : '/client/dashboard';

  // Breadcrumb current label
  const currentMenuItem = CLIENT_MENU_ITEMS.find((item) => item.key === activeMenuKey);

  const filteredSearch = SEARCH_NAV_ITEMS.filter(
    (item) =>
      !searchQuery ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 6px', minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{userName}</div>
          <div style={{ fontSize: 12, color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <BankOutlined /> {companyName}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, marginBottom: 8 }}>{userEmail}</div>
          <Tag color="blue" style={{ borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
            Tài khoản Doanh nghiệp (CLIENT)
          </Tag>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt tài khoản & Công ty',
      onClick: () => navigate('/client/dashboard'),
    },
    {
      key: 'warranty-quick',
      icon: <SafetyCertificateOutlined />,
      label: 'Chính sách bảo hành 60 ngày (COD)',
      onClick: () => navigate('/client/warranty'),
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

  return (
    <Layout style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* ─── Enterprise Sider ────────────────────────────────────────────── */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={250}
        collapsedWidth={68}
        trigger={null}
        theme="dark"
        style={{
          background: '#0f172a',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
        }}
      >
        {/* Brand Header */}
        <div
          onClick={() => navigate('/client/dashboard')}
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            gap: 10,
            cursor: 'pointer',
            background: '#0f172a',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 800,
              color: '#fff',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
            }}
          >
            H
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                HR Connect
              </div>
              <div style={{ color: '#38bdf8', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em' }}>
                CLIENT PORTAL
              </div>
            </div>
          )}
        </div>

        {/* 6 Enterprise Menu Items */}
        <div style={{ flex: 1, padding: '10px 6px', overflowY: 'auto' }}>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeMenuKey]}
            style={{ background: 'transparent', border: 'none' }}
            items={CLIENT_MENU_ITEMS.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</span>
                  {item.badge && (
                    <Tag
                      color={item.badge === 'COD' ? 'gold' : item.badge === 'Mới' ? 'cyan' : 'blue'}
                      style={{
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '0 5px',
                        borderRadius: 10,
                        lineHeight: '16px',
                      }}
                    >
                      {item.badge}
                    </Tag>
                  )}
                </div>
              ),
              onClick: () => navigate(item.key),
            }))}
          />
        </div>

        {/* Bottom Sider Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: collapsed ? '10px 0' : '12px 14px',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <Avatar
              size={32}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {userAvatar}
            </Avatar>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {companyName}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName}
                </div>
              </div>
            )}
          </div>
        </div>
      </Sider>

      {/* ─── Main Content Shell ─────────────────────────────────────────── */}
      <Layout
        style={{
          marginLeft: collapsed ? 68 : 250,
          transition: 'margin-left 0.25s cubic-bezier(0.2, 0, 0, 1)',
          minHeight: '100vh',
          background: '#f8fafc',
        }}
      >
        {/* Top Header - Compact, exactly 56px, NO overlay over title */}
        <Header
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            height: 56,
            lineHeight: '56px',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Sider Toggle & Compact Search Bar */}
          <Space size={12} align="center" style={{ height: 36 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, color: '#475569', width: 34, height: 34 }}
            />

            {/*
              CRITICAL FIX: Compact Search Input Trigger.
              Strictly height: 34px, no popover defaultOpen, opens Modal only upon click or Ctrl+K.
            */}
            <div
              id="header-command-search"
              onClick={() => setSearchOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '0 10px',
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
              <SearchOutlined style={{ color: '#64748b', fontSize: 13 }} />
              <span style={{ color: '#94a3b8', fontSize: 12, flex: 1, userSelect: 'none' }}>
                Tìm kiếm nhanh...
              </span>
              <Tag
                style={{
                  margin: 0,
                  background: '#e2e8f0',
                  border: 'none',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '0 4px',
                  borderRadius: 4,
                  lineHeight: '18px',
                }}
              >
                Ctrl+K
              </Tag>
            </div>
          </Space>

          {/* Right Header Actions */}
          <Space size={14} align="center" style={{ height: 36 }}>
            {/* Live Demo Trigger */}
            <Tooltip title="Kích hoạt sự kiện mẫu từ SignalR">
              <Button
                type="text"
                size="small"
                icon={<ThunderboltOutlined style={{ color: '#f59e0b', fontSize: 15 }} />}
                onClick={() => MockWebSocketService.triggerAlert(Math.floor(Math.random() * 7))}
              />
            </Tooltip>

            {/* Language Switcher */}
            <LanguageSwitcher theme="light" size="small" />

            {/* Notification Dropdown */}
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
                    borderRadius: 12,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                    width: 350,
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                      Thông báo tuyển dụng
                    </span>
                    <span
                      style={{ color: '#0284c7', fontSize: 11.5, cursor: 'pointer', fontWeight: 500 }}
                      onClick={() => useAlertStore.getState().clearAll()}
                    >
                      Xóa tất cả
                    </span>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {alerts.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
                        <BellOutlined style={{ fontSize: 22, marginBottom: 6, display: 'block' }} />
                        Không có thông báo mới
                      </div>
                    ) : (
                      <List
                        dataSource={alerts.slice(0, 10)}
                        renderItem={(alert) => (
                          <List.Item
                            key={alert.id}
                            style={{
                              padding: '9px 14px',
                              background: alert.read ? 'transparent' : '#f0f9ff',
                              borderBottom: '1px solid #f8fafc',
                              cursor: 'pointer',
                            }}
                            actions={[
                              <span
                                key="del"
                                style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
                                onClick={() => dismissAlert(alert.id)}
                              >
                                ✕
                              </span>,
                            ]}
                          >
                            <List.Item.Meta
                              title={<span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{alert.title}</span>}
                              description={<span style={{ fontSize: 11.5, color: '#64748b' }}>{alert.message}</span>}
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
                  icon={<BellOutlined style={{ fontSize: 17, color: '#475569' }} />}
                  style={{ width: 34, height: 34 }}
                />
              </Badge>
            </Dropdown>

            {/* User Profile Dropdown */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '3px 6px',
                  borderRadius: 6,
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar
                  size={30}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {userAvatar}
                </Avatar>
                <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: '#0f172a' }}>
                    {companyName}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#0284c7', fontWeight: 600 }}>
                    {userName}
                  </div>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Content Body with Breadcrumbs */}
        <Content
          style={{
            padding: '20px 24px',
            background: '#f8fafc',
            minHeight: 'calc(100vh - 56px)',
            overflowX: 'hidden',
          }}
        >
          {/* Breadcrumbs */}
          <div style={{ marginBottom: 14 }}>
            <Breadcrumb
              items={[
                { title: <span style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => navigate('/client/dashboard')}>Doanh nghiệp</span> },
                { title: <span style={{ fontWeight: 600, color: '#0f172a' }}>{currentMenuItem?.label || 'Tổng quan'}</span> },
              ]}
            />
          </div>

          {/* Page Content */}
          <div className="animate-fade-in">
            {children || <Outlet />}
          </div>
        </Content>
      </Layout>

      {/* ─── Controlled Search Command Modal (Ctrl+K) ────────────────────────── */}
      <Modal
        open={searchOpen}
        onCancel={() => {
          setSearchOpen(false);
          setSearchQuery('');
        }}
        footer={null}
        title={null}
        width={540}
        destroyOnClose
        centered
        mask={true}
        maskClosable={true}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <Input
            autoFocus
            prefix={<SearchOutlined style={{ color: '#0284c7', fontSize: 16, marginRight: 8 }} />}
            placeholder="Tìm nhanh trang, tính năng hoặc phễu ứng viên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            bordered={false}
            style={{ fontSize: 15, padding: 0 }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {filteredSearch.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>
              Không tìm thấy mục nào khớp với "{searchQuery}"
            </div>
          ) : (
            filteredSearch.map((item) => (
              <div
                key={item.key}
                onClick={() => {
                  navigate(item.key);
                  setSearchOpen(false);
                  setSearchQuery('');
                }}
                style={{
                  padding: '11px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  borderBottom: '1px solid #f8fafc',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f9ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{item.category}</div>
                </div>
                <RightOutlined style={{ fontSize: 11, color: '#cbd5e1' }} />
              </div>
            ))
          )}
        </div>
        <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
          <span>Nhấn ↵ để chọn</span>
          <span>ESC để đóng</span>
        </div>
      </Modal>
    </Layout>
  );
};
