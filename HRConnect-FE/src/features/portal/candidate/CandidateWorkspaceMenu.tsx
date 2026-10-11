import React from 'react';
import { Avatar, Button, Dropdown, Space } from 'antd';
import {
  CheckCircleOutlined,
  DashboardOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { getInitials, useAuthStore } from '@/stores/authStore';

interface CandidateWorkspaceMenuProps {
  showWorkspaceButton?: boolean;
}

export const CandidateWorkspaceMenu: React.FC<CandidateWorkspaceMenuProps> = ({
  showWorkspaceButton = false,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const name = user?.name || 'Ứng viên';
  const email = user?.email || '';

  const signOut = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      window.location.replace('/');
    }
  };

  const items = [
    {
      key: 'identity',
      label: (
        <div className="min-w-52 px-1 py-1">
          <div className="truncate text-sm font-bold text-slate-900">{name}</div>
          <div className="truncate text-xs text-slate-500">{email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Tổng quan Candidate',
      onClick: () => navigate('/candidate/dashboard'),
    },
    {
      key: 'applications',
      icon: <CheckCircleOutlined />,
      label: 'Đơn ứng tuyển',
      onClick: () => navigate('/candidate/applications'),
    },
    {
      key: 'cvs',
      icon: <FolderOpenOutlined />,
      label: 'Kho CV',
      onClick: () => navigate('/candidate/cvs'),
    },
    {
      key: 'profile',
      icon: <IdcardOutlined />,
      label: 'Hồ sơ cá nhân',
      onClick: () => navigate('/candidate/profile'),
    },
    {
      key: 'identities',
      icon: <MailOutlined />,
      label: 'Email liên kết',
      onClick: () => navigate('/candidate/settings/email-identities'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: () => void signOut(),
    },
  ];

  return (
    <Space size={8} align="center">
      {showWorkspaceButton && (
        <Button
          type="primary"
          icon={<DashboardOutlined />}
          onClick={() => navigate('/candidate/dashboard')}
          style={{ borderRadius: 10, height: 38, fontWeight: 650 }}
        >
          Vào không gian Candidate
        </Button>
      )}

      <Dropdown menu={{ items }} placement="bottomRight" trigger={['click']}>
        <button
          type="button"
          aria-label="Mở menu tài khoản Candidate"
          className="flex h-[38px] cursor-pointer items-center gap-2 rounded-full border border-solid border-slate-200 bg-white py-1 pl-1 pr-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Avatar size={30} style={{ background: '#2563eb', fontSize: 12, fontWeight: 700 }}>
            {user?.avatar || getInitials(name)}
          </Avatar>
          <span className="max-w-28 truncate text-sm font-semibold text-slate-800">
            {name.trim().split(/\s+/).slice(-1)[0] || 'Ứng viên'}
          </span>
        </button>
      </Dropdown>
    </Space>
  );
};

export default CandidateWorkspaceMenu;
