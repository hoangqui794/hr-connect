import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs } from 'antd';
import {
  AppstoreOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { JobDiscoveryPage } from '@/features/jobs-mf01/JobDiscoveryPage';
import { CandidatePageHeader } from './CandidateUi';
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
  return <Navigate to={`/jobs/${jobId}`} replace />;
};
