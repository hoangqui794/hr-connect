/**
 * @file PublicJobPages.tsx
 * @description Public-site wrappers (landing Navbar, no AppShell) for MF-01 discovery and
 * job detail. Guests can browse the same ACTIVE/PUBLIC scope as Candidate; authentication is
 * requested only when they choose to apply.
 */
import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Skeleton, Typography } from 'antd';
import { ArrowLeftOutlined, LoginOutlined } from '@ant-design/icons';
import { Navbar } from '@/features/landing/components/Navbar';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { JobDiscoveryPage } from './JobDiscoveryPage';
import { JobDetailPanel } from './JobDetailPanel';
import { useJobDetail } from './useJobQueries';
import { JobApplyActions } from '@/features/portal/JobApplyActions';

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
    <JobDiscoveryPage publicAccess />
  </PublicFrame>
);

export const PublicJobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const detail = useJobDetail(id);
  const resumeApply = (location.state as { intent?: string } | null)?.intent === 'apply';

  useEffect(() => {
    if (isAuthenticated && resumeApply && detail.data) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [detail.data, isAuthenticated, location.pathname, navigate, resumeApply]);

  return (
    <PublicFrame>
      <Link to="/jobs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700">
        <ArrowLeftOutlined aria-hidden /> Tất cả việc làm
      </Link>
      <div className="rounded-xl border border-solid border-slate-200 bg-white p-6">
        {detail.isError ? (
          <Alert type="error" showIcon message="Không xem được việc làm này" description={getApiErrorMessage(detail.error)} />
        ) : detail.isLoading || !detail.data ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : (
          <>
            {/* MF-02: candidates apply here, affiliates go to the referral form. */}
            <div className="mb-5 flex flex-col items-end">
              {isAuthenticated ? (
                <JobApplyActions job={detail.data} autoOpen={resumeApply} />
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<LoginOutlined />}
                  onClick={() => navigate('/login', { state: { from: location.pathname, intent: 'apply' } })}
                >
                  Đăng nhập để ứng tuyển
                </Button>
              )}
            </div>
            <JobDetailPanel job={detail.data} />
          </>
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
