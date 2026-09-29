import React from 'react';
import { Layout, Menu, Tooltip, Avatar } from 'antd';
import {
  DashboardOutlined, FileTextOutlined, TeamOutlined, RobotOutlined,
  DollarOutlined, UserAddOutlined, AppstoreOutlined, SearchOutlined,
  SettingOutlined, LoginOutlined, HomeOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, CalendarOutlined, SafetyCertificateOutlined,
  PlusCircleOutlined, BankOutlined, ApartmentOutlined, AuditOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { SIDEBAR_MENU_ITEMS, SidebarMenuItem } from '@/constants/rbac';

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
  BankOutlined: <BankOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  AuditOutlined: <AuditOutlined />,
  SolutionOutlined: <SolutionOutlined />,
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

  const transformMenuItem = (item: SidebarMenuItem): any => {
    if (item.type === 'group') {
      return {
        type: 'group',
        key: item.label,
        label: (
          <span
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#94a3b8',
              fontWeight: 700,
            }}
          >
            {item.label}
          </span>
        ),
        children: item.children?.map(transformMenuItem),
      };
    }
    return {
      key: item.key,
      icon: item.icon ? ICON_MAP[item.icon] : undefined,
      label: item.label,
      onClick: () => {
        if (item.key) navigate(item.key);
      },
    };
  };

  const antdMenuItems = menuItems.map(transformMenuItem);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      width={240}
      collapsedWidth={64}
      trigger={null}
      theme="light"
      style={{
        background: '#ffffff',
        borderRight: '1px solid rgba(226, 232, 240, 0.85)',
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
          borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
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
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
            color: '#fff',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
            transition: 'transform 0.2s',
          }}
        >
          H
        </div>
        {!collapsed && (
          <span
            style={{
              color: '#0f172a',
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
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={antdMenuItems}
          style={{ background: 'transparent', border: 'none' }}
        />
      </div>

      {/* User Profile Footer */}
      <div
        style={{
          borderTop: '1px solid rgba(226, 232, 240, 0.85)',
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
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
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
                color: '#0f172a',
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
          color: '#94a3b8',
          borderTop: '1px solid rgba(226, 232, 240, 0.85)',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0f172a')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>
    </Sider>
  );
};
