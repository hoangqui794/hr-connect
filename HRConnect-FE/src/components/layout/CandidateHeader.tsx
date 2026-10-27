import React from 'react';
import {
  Layout,
  Space,
  Button,
  Tag,
} from 'antd';
import {
  CompassOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { CandidateWorkspaceMenu } from '@/features/portal/candidate/CandidateWorkspaceMenu';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { BrandMark } from '@/components/common/BrandMark';

const { Header } = Layout;

export const CandidateHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', textDecoration: 'none' }}
          title="HR Connect — Nền tảng Tuyển dụng AI, về trang chủ"
        >
          <BrandMark size={36} className="shrink-0" />
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
        </Link>

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
        <NotificationBell />

        <CandidateWorkspaceMenu />
      </Space>
    </Header>
  );
};
