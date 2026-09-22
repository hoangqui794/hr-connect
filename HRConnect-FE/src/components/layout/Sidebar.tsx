import React from 'react';
import { Layout, Menu, Tooltip, Avatar } from 'antd';
import {
  DashboardOutlined, FileTextOutlined, TeamOutlined, RobotOutlined,
  DollarOutlined, UserAddOutlined, AppstoreOutlined, SearchOutlined,
  SettingOutlined, LoginOutlined, HomeOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, CalendarOutlined, SafetyCertificateOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { DEMO_USERS } from '@/types/roles';
import { SIDEBAR_MENU_ITEMS } from '@/constants/rbac';

const { Sider } = Layout;

const ICON_MAP: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  TeamOutlined: <TeamOutlined />,
  RobotOutlined: <RobotOutlined />,
  DollarOutlined: <DollarOutlined />,
  UserAddOutlined: <UserAddOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  SearchOutlined: <SearchOutlined />,
  SettingOutlined: <SettingOutlined />,
  LoginOutlined: <LoginOutlined />,
  HomeOutlined: <HomeOutlined />,
  PlusCircleOutlined: <PlusCircleOutlined />,
  CalendarOutlined: <CalendarOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
};

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (val: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user } = useAuthStore();
  const displayName = user?.name || 'Người dùng';
  const displayEmail = user?.email || '';
  const displayAvatar = user?.avatar || (user?.name ? user.name.slice(0, 2).toUpperCase() : 'U');

  const menuItems = SIDEBAR_MENU_ITEMS[role] ?? [];

  const antdMenuItems = menuItems.map((item) => ({
    key: item.key,
    icon: ICON_MAP[item.icon],
    label: item.label,
    onClick: () => navigate(item.key),
  }));

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      width={240}
      collapsedWidth={64}
      trigger={null}
      theme="dark"
      style={{
        background: '#0f172a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div
        onClick={() => navigate('/')}
        title="Quay về trang chủ"
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: 10,
          transition: 'all 0.3s',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(2,132,199,0.4)',
            transition: 'transform 0.2s',
          }}
        >
          H
        </div>
        {!collapsed && (
          <span
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: '-0.3px',
              whiteSpace: 'nowrap',
            }}
          >
            HR Connect
          </span>
        )}
      </div>

      {/* Navigation Menu */}
      <div style={{ padding: '8px 0', flex: 1 }}>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={antdMenuItems}
          style={{ background: 'transparent', border: 'none' }}
        />
      </div>

      {/* User Profile Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: collapsed ? '12px 0' : '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <Tooltip title={collapsed ? displayName : ''} placement="right">
          <Avatar
            size={32}
            style={{
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {displayAvatar}
          </Avatar>
        </Tooltip>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div
              style={{
                color: '#f1f5f9',
                fontWeight: 600,
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                color: '#64748b',
                fontSize: 11,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {displayEmail}
            </div>
          </div>
        )}
      </div>

      {/* Collapse trigger */}
      <div
        onClick={() => onCollapse(!collapsed)}
        style={{
          padding: '10px',
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
          cursor: 'pointer',
          color: '#64748b',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>
    </Sider>
  );
};
