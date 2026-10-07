/**
 * @file PublicJobPages.tsx
 * @description Public-site wrappers (landing Navbar, no AppShell) for MF-01 discovery and
 * job detail. Data still requires login: GET /jobs and GET /jobs/{id} are authorized endpoints.
 */
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Skeleton, Typography } from 'antd';
import { ArrowLeftOutlined, LoginOutlined } from '@ant-design/icons';
import { Navbar } from '@/features/landing/components/Navbar';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { JobDiscoveryPage } from './JobDiscoveryPage';
import { JobDetailPanel } from './JobDetailPanel';
import { useJobDetail } from './useJobQueries';

const { Title, Text } = Typography;

const PublicFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
    <Navbar />
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">{children}</main>
  </div>
);

export const PublicJobSearchPage: React.FC = () => (
  <PublicFrame>
    <header className="mb-6">
      <Title level={2} className="!mb-1">
        Việc làm đang tuyển
      </Title>
      <Text type="secondary">Tin đã được Internal HR duyệt, cập nhật trực tiếp từ hệ thống.</Text>
    </header>
    <JobDiscoveryPage />
  </PublicFrame>
);

export const PublicJobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const detail = useJobDetail(isAuthenticated ? id : undefined);

  return (
    <PublicFrame>
      <Link to="/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-emerald-700">
        <ArrowLeftOutlined aria-hidden /> Tất cả việc làm
      </Link>
      <div className="rounded-xl border border-solid border-slate-200 bg-white p-6">
        {!isAuthenticated ? (
          <div className="py-10 text-center">
            <Title level={4}>Đăng nhập để xem chi tiết việc làm</Title>
            <Button type="primary" icon={<LoginOutlined />} onClick={() => navigate('/login')}>
              Đăng nhập
            </Button>
          </div>
        ) : detail.isError ? (
          <Alert type="error" showIcon message="Không xem được việc làm này" description={getApiErrorMessage(detail.error)} />
        ) : detail.isLoading || !detail.data ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : (
          <JobDetailPanel job={detail.data} />
        )}
      </div>
    </PublicFrame>
  );
};

/** In-app (AppShell) variant used by Affiliate, Client and Admin menus. */
export const InAppJobDiscoveryPage: React.FC = () => (
  <div className="space-y-5">
    <header>
      <Title level={3} className="!mb-1">
        Khám phá việc làm
      </Title>
      <Text type="secondary">Các tin đang tuyển mà vai trò của bạn được xem.</Text>
    </header>
    <JobDiscoveryPage />
  </div>
);
