import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Skeleton } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/services/apiClient';
import { JobDiscoveryPage } from '@/features/jobs-mf01/JobDiscoveryPage';
import { JobDetailPanel } from '@/features/jobs-mf01/JobDetailPanel';
import { useJobDetail } from '@/features/jobs-mf01/useJobQueries';
import { JobApplyActions } from '@/features/portal/JobApplyActions';
import { CandidatePageHeader, CandidateSurface } from './CandidateUi';

export const CandidateJobsPage: React.FC = () => (
  <div className="candidate-page candidate-jobs-page">
    <CandidatePageHeader
      eyebrow="Cơ hội dành cho bạn"
      title="Tìm việc làm phù hợp"
      description="Khám phá công việc đang tuyển và ứng tuyển nhanh bằng CV đã lưu của bạn."
    />
    <div className="candidate-job-discovery">
      <JobDiscoveryPage detailBasePath="/candidate/jobs" />
    </div>
  </div>
);

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
            <div className="mb-5 flex justify-end">
              <JobApplyActions job={detail.data} />
            </div>
            <JobDetailPanel job={detail.data} />
          </>
        )}
      </CandidateSurface>
    </div>
  );
};
