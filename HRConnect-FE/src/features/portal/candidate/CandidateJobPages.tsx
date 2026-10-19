import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Skeleton, Tabs } from 'antd';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getApiErrorMessage } from '@/services/apiClient';
import { JobDiscoveryPage } from '@/features/jobs-mf01/JobDiscoveryPage';
import { JobDetailPanel } from '@/features/jobs-mf01/JobDetailPanel';
import { useJobDetail } from '@/features/jobs-mf01/useJobQueries';
import { JobApplyActions } from '@/features/portal/JobApplyActions';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { CandidatePageHeader, CandidateSurface } from './CandidateUi';
import { CandidateJobMatchesSection } from './CandidateJobMatchesSection';

export const CandidateJobsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'matches';

  const handleTabChange = (key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'matches') {
      next.delete('tab');
    } else {
      next.set('tab', key);
    }
    setSearchParams(next);
  };

  return (
    <div className="candidate-page candidate-jobs-page space-y-4">
      <CandidatePageHeader
        eyebrow="Cơ hội dành cho bạn"
        title="Tìm việc làm & Cơ hội nghề nghiệp"
        description="Khám phá công việc phù hợp với CV của bạn hoặc tìm kiếm theo kỹ năng, vị trí và địa điểm."
      />

      <Tabs
        activeKey={currentTab === 'all' ? 'all' : 'matches'}
        onChange={handleTabChange}
        size="large"
        items={[
          {
            key: 'matches',
            label: (
              <span className="flex items-center gap-2 font-bold text-slate-800">
                <ThunderboltOutlined className="text-amber-500" />
                Việc phù hợp với bạn
              </span>
            ),
            children: (
              <div className="pt-2">
                <CandidateJobMatchesSection showHeader={false} />
              </div>
            ),
          },
          {
            key: 'all',
            label: (
              <span className="flex items-center gap-2 font-semibold">
                <AppstoreOutlined />
                Tất cả việc làm
              </span>
            ),
            children: (
              <div className="candidate-job-discovery pt-2">
                <JobDiscoveryPage detailBasePath="/candidate/jobs" />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export const CandidateJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const detail = useJobDetail(jobId);

  return (
    <div className="candidate-page candidate-job-detail-page">
      <Link to="/candidate/jobs" className="candidate-back-link">
        <ArrowLeftOutlined aria-hidden />
        Quay lại danh sách việc làm
      </Link>
      <CandidateSurface className="candidate-job-detail-surface">
        {detail.isError ? (
          <Alert type="error" showIcon message="Không thể mở việc làm này" description={getApiErrorMessage(detail.error)} />
        ) : detail.isLoading || !detail.data ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : (
          <>
            <div className="mb-5 flex items-center justify-end gap-3">
              <BookmarkButton jobId={detail.data.jobId} jobTitle={detail.data.title} size="lg" />
              <JobApplyActions job={detail.data} />
            </div>
            <JobDetailPanel job={detail.data} isApplicantView />
          </>
        )}
      </CandidateSurface>
    </div>
  );
};

export default CandidateJobsPage;
