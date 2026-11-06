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
      {/* ── Studio Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-2xl font-black tracking-tight text-slate-900 sm:text-[26px]">
              {job ? `Bàn Giao Hồ Sơ · ${job.title}` : 'Bàn Giao Hồ Sơ Ứng Viên'}
            </h1>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700 border border-purple-200/80">
              Dịch vụ CV Sourcing
            </span>
          </div>
          <p className="m-0 mt-1 text-sm text-slate-500">
            Hồ sơ do chuyên viên HR Connect sàng lọc và chuyển giao. Vui lòng phản hồi chấp thuận hoặc từ chối trong thời hạn xem xét.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            icon={<ArrowLeftOutlined />}
            className="!h-10 !rounded-xl border-slate-200 hover:!border-slate-300 font-semibold text-slate-700"
            onClick={() => navigate('/client/jobs')}
          >
            Về danh sách tin
          </Button>
          <Button
            icon={<ReloadOutlined />}
            type="primary"
            className="!bg-[#0C4A6E] hover:!bg-[#075985] !border-0 text-white !h-10 !rounded-xl font-bold shadow-sm transition-all active:scale-[0.98] !px-4"
            onClick={() => refetch()}
          >
            Tải lại tin
          </Button>
        </div>
      </div>

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
