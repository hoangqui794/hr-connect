import React from 'react';
import { Layout, Menu, Tooltip, Avatar, ConfigProvider } from 'antd';
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
import { UserRole } from '@/types/roles';

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

  // Admin uses the navy "Slate Command" sidebar so the control area is never mistaken for
  // a customer area; every other role keeps the light sidebar. Pairs meet WCAG AA.
  const isAdminConsole = role === UserRole.ADMIN;
  const pal = isAdminConsole
    ? { bg: '#0F172A', border: 'rgba(148, 163, 184, 0.16)', title: '#F8FAFC', group: '#94A3B8', name: '#F8FAFC', email: '#94A3B8', trigger: '#94A3B8', triggerHover: '#F8FAFC', logo: '#047857' }
    : { bg: '#ffffff', border: 'rgba(226, 232, 240, 0.85)', title: '#0f172a', group: '#94a3b8', name: '#0f172a', email: '#64748b', trigger: '#94a3b8', triggerHover: '#0f172a', logo: 'linear-gradient(135deg, #2563eb, #3b82f6)' };

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
              color: pal.group,
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
      theme={isAdminConsole ? 'dark' : 'light'}
      className={isAdminConsole ? 'admin-console-sider' : undefined}
      style={{
        background: pal.bg,
        borderRight: `1px solid ${pal.border}`,
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
          borderBottom: `1px solid ${pal.border}`,
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
            background: pal.logo,
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
              color: pal.title,
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
        <ConfigProvider
          theme={{
            components: {
              Menu: {
                darkItemBg: '#0F172A',
                darkItemColor: '#CBD5E1',
                darkItemHoverColor: '#FFFFFF',
                darkItemHoverBg: 'rgba(148, 163, 184, 0.12)',
                darkItemSelectedBg: '#047857',
                darkItemSelectedColor: '#FFFFFF',
                darkGroupTitleColor: '#94A3B8',
              },
            },
          }}
        >
          <Menu
            theme={isAdminConsole ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={[location.pathname]}
            items={antdMenuItems}
            style={{ background: 'transparent', border: 'none' }}
          />
        </ConfigProvider>
      </div>

      {/* User Profile Footer */}
      <div
        style={{
          borderTop: `1px solid ${pal.border}`,
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
              background: pal.logo,
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
                color: pal.name,
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
                color: pal.email,
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
          color: pal.trigger,
          borderTop: `1px solid ${pal.border}`,
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = pal.triggerHover)}
        onMouseLeave={(e) => (e.currentTarget.style.color = pal.trigger)}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>
    </Sider>
  );
};
