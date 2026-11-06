/**
 * @file features/sourcing/ClientJobSourcingDeliveriesPage.tsx
 * @description Page for Client Company to view delivered CVs for a CV_SOURCING job,
 * review 7-day deadlines, and accept or reject candidates.
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Spin } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { PageHero, Surface } from '@/features/admin-console/ui';
import { useJobDetail } from '@/features/jobs-mf01/useJobQueries';
import { ApplicationWorkbench } from '@/features/recruitment/ApplicationWorkbench';
import { SourcingDeliveriesView } from './SourcingDeliveriesView';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

export const ClientJobSourcingDeliveriesPage: React.FC = () => {
  const { id, jobId: paramJobId } = useParams<{ id?: string; jobId?: string }>();
  const jobId = id || paramJobId || '';
  const navigate = useNavigate();
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>();

  const { data: job, isLoading, refetch } = useJobDetail(jobId);

  return (
    <div className={`${FONT} animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      <PageHero
        eyebrow="SS · Tìm hồ sơ phù hợp"
        title={job ? `Hồ sơ nhận được · ${job.title}` : 'Hồ sơ nhận được (CV Sourcing)'}
        tip
        description="Hồ sơ ứng viên HR Connect đã sàng lọc và bàn giao cho tin SS. Hãy chấp nhận hoặc từ chối từng hồ sơ trong thời hạn xem xét ghi ở mỗi hồ sơ."
        actions={
          <div className="flex items-center gap-2">
            <Button
              icon={<ArrowLeftOutlined />}
              size="large"
              className="!h-10 !rounded-lg border-slate-200 hover:!border-slate-300 text-slate-700"
              onClick={() => navigate('/client/jobs')}
            >
              Về danh sách tin
            </Button>
            <Button
              icon={<ReloadOutlined />}
              size="large"
              type="primary"
              className="!bg-[#0C4A6E] hover:!bg-[#075985] !border-0 text-white !h-10 !rounded-lg font-semibold shadow-sm transition-all active:scale-[0.98] !px-4"
              onClick={() => refetch()}
            >
              Tải lại tin
            </Button>
          </div>
        }
      />

      <Surface>
        <div className="p-6">
          {isLoading && !job ? (
            <div className="flex justify-center p-12">
              <Spin size="large" tip="Đang tải thông tin tin tuyển dụng..." />
            </div>
          ) : (
            <SourcingDeliveriesView
              jobId={jobId}
              jobTitle={job?.title}
              role="client"
              onViewCandidate={(appId) => setSelectedApplicationId(appId)}
            />
          )}
        </div>
      </Surface>

      {/* Application Workbench Drawer */}
      <ApplicationWorkbench
        applicationId={selectedApplicationId}
        audience="client"
        onClose={() => setSelectedApplicationId(undefined)}
      />
    </div>
  );
};

export default ClientJobSourcingDeliveriesPage;
