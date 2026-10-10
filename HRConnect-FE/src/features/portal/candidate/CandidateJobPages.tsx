import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Skeleton } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/services/apiClient';
import { JobDiscoveryPage } from '@/features/jobs-mf01/JobDiscoveryPage';
import { JobDetailPanel } from '@/features/jobs-mf01/JobDetailPanel';
import { useJobDetail } from '@/features/jobs-mf01/useJobQueries';
import { JobApplyActions } from '@/features/portal/JobApplyActions';

export const CandidateJobsPage: React.FC = () => (
  <div className="space-y-5">
    <header>
      <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--console-accent-strong)]">Cơ hội dành cho bạn</p>
      <h1 className="m-0 mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Tìm việc làm phù hợp</h1>
      <p className="m-0 mt-2 text-sm text-slate-600">Tìm kiếm, xem chi tiết và ứng tuyển mà không rời khỏi không gian Candidate.</p>
    </header>
    <JobDiscoveryPage detailBasePath="/candidate/jobs" />
  </div>
);

export const CandidateJobDetailPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const detail = useJobDetail(jobId);

  return (
    <div className="space-y-4">
      <Link to="/candidate/jobs" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 no-underline hover:text-[color:var(--console-accent-strong)]">
        <ArrowLeftOutlined aria-hidden />
        Quay lại danh sách việc làm
      </Link>
      <section className="rounded-2xl border border-solid border-slate-200 bg-white p-4 shadow-sm sm:p-6">
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
      </section>
    </div>
  );
};
