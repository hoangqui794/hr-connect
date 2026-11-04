/**
 * @file PublicJobPages.tsx
 * @description Public-site wrappers (landing Navbar, no AppShell) for MF-01 discovery and
 * job detail. Guests can browse the same ACTIVE/PUBLIC scope as Candidate; authentication is
 * requested only when they choose to apply.
 */
import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Alert, Skeleton, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/services/apiClient';
import { JobDiscoveryPage } from './JobDiscoveryPage';
import { JobDetailPanel } from './JobDetailPanel';
import { useJobDetail } from './useJobQueries';
import { JobApplyActions } from '@/features/portal/JobApplyActions';
import { CommissionEstimateCard } from '@/features/portal/CommissionEstimateCard';

import { PublicJobSplitDiscovery } from './PublicJobSplitDiscovery';
import { JobPublicDetailView } from './JobPublicDetailView';

const { Title, Text } = Typography;

export const PublicJobSearchPage: React.FC = () => <PublicJobSplitDiscovery />;

export const PublicJobDetailPage: React.FC = () => <JobPublicDetailView />;

/** In-app (AppShell) variant used by Affiliate, Client and Admin menus. */
export const InAppJobDiscoveryPage: React.FC = () => {
  // N11: inside the affiliate portal, job cards open the affiliate detail page and keep the sidebar.
  const inAffiliatePortal = useLocation().pathname.startsWith('/affiliate');
  return (
    <div className="space-y-5">
      <header className={inAffiliatePortal ? 'affiliate-page-header' : undefined}>
        <div className={inAffiliatePortal ? 'affiliate-page-header__copy' : undefined}>
          {inAffiliatePortal && <span className="affiliate-page-header__eyebrow">Cơ hội giới thiệu</span>}
          <Title level={3} className="!mb-1">
            {inAffiliatePortal ? 'Tìm cơ hội tuyển dụng' : 'Khám phá việc làm'}
          </Title>
          <Text type="secondary">
            {inAffiliatePortal
              ? 'Chọn vị trí phù hợp với ứng viên của bạn và xem trước mức hoa hồng dự kiến.'
              : 'Các tin tuyển dụng đang mở mà tài khoản của bạn có thể xem.'}
          </Text>
        </div>
      </header>
      <JobDiscoveryPage detailBasePath={inAffiliatePortal ? '/affiliate/jobs' : '/jobs'} />
    </div>
  );
};

/** N11 + N12: job detail inside the affiliate portal, with the estimated commission and the referral action. */
export const AffiliateJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const detail = useJobDetail(jobId);

  return (
    <div className="space-y-4">
      <Link to="/affiliate/jobs" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700">
        <ArrowLeftOutlined aria-hidden /> Quay lại cơ hội tuyển dụng
      </Link>
      <header className="affiliate-page-header">
        <div className="affiliate-page-header__copy">
          <span className="affiliate-page-header__eyebrow">Chi tiết cơ hội</span>
          <Title level={3} className="!mb-1">Thông tin tuyển dụng và quyền lợi giới thiệu</Title>
          <Text type="secondary">Kiểm tra yêu cầu của vị trí trước khi giới thiệu ứng viên phù hợp.</Text>
        </div>
      </header>
      {detail.isError ? (
        <Alert type="error" showIcon message="Không xem được việc làm này" description={getApiErrorMessage(detail.error)} />
      ) : detail.isLoading || !detail.data ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-2xl border border-solid border-slate-200 bg-white p-5 sm:p-6">
            <JobDetailPanel job={detail.data} isApplicantView />
          </div>
          <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
            <CommissionEstimateCard jobId={detail.data.jobId} />
            <div className="flex flex-col items-stretch">
              <JobApplyActions job={detail.data} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
