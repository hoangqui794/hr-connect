import React, { useState } from 'react';
import { Button } from 'antd';
import {
  HeartFilled,
  SearchOutlined,
  ArrowRightOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSavedJobs, JobItem } from '@/hooks/useSavedJobs';
import { FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { JobCardHorizontal } from '@/components/common/JobCardHorizontal';
import { JobDetailModal } from '@/components/common/JobDetailModal';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { JobCardData } from '@/components/common/JobCard';

export const SavedJobsPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Single Source of Truth từ useSavedJobs() (mặc định mảng rỗng [] cho tài khoản mới)
  const { savedJobs = [], isSaved, toggleSaveJob } = useSavedJobs();
  const savedCount = savedJobs?.length ?? 0;

  // Modal states
  const [selectedJobForApply, setSelectedJobForApply] = useState<FeaturedJobItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalJob, setDetailModalJob] = useState<JobCardData | null>(null);

  const handleOpenDetail = (job: JobCardData) => {
    if (!job) return;
    setDetailModalJob(job);
    setDetailModalOpen(true);
  };

  const handleQuickApply = (job: JobCardData, e: React.MouseEvent) => {
    e?.stopPropagation?.();
    if (!job) return;
    setSelectedJobForApply(job as unknown as FeaturedJobItem);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* ─── Page Header Banner ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 shadow-2xs">
              <HeartFilled className="text-sm" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight m-0">
              Việc Làm Đã Lưu (Bookmarked Jobs)
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80">
              {savedCount} việc làm
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 m-0">
            Quản lý danh sách các cơ hội nghề nghiệp bạn đã đánh dấu lưu từ Sàn tuyển dụng để sẵn sàng ứng tuyển.
          </p>
        </div>

        <Button
          type="primary"
          icon={<CompassOutlined />}
          onClick={() => navigate('/')}
          className="h-10 px-5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white border-none shadow-xs shrink-0 inline-flex items-center gap-2"
        >
          Tìm kiếm thêm việc làm
        </Button>
      </div>

      {/* ─── Danh Sách Hoặc Empty State ─── */}
      {savedCount === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 sm:p-14 text-center shadow-xs">
          <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-slate-50 border border-slate-200/80 flex items-center justify-center relative shadow-inner">
            {/* Icon Chiếc túi việc làm / Bookmark Rỗng */}
            <svg
              className="w-12 h-12 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z"
              />
            </svg>
            <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
              <HeartFilled className="text-xs" />
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
            Bạn chưa lưu cơ hội việc làm nào
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
            Khám phá các vị trí tuyển dụng phù hợp và bấm lưu để xem lại sau.
          </p>

          <Button
            type="primary"
            size="large"
            icon={<SearchOutlined />}
            onClick={() => navigate('/')}
            className="h-11 px-7 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs border-none inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Tìm kiếm thêm việc làm</span>
            <ArrowRightOutlined />
          </Button>
        </div>
      ) : (
        /* Danh sách việc làm đã lưu hoàn chỉnh */
        <div className="space-y-3.5">
          {(savedJobs || []).filter(Boolean).map((job) => (
            <JobCardHorizontal
              key={job?.id || Math.random()}
              job={job as unknown as JobCardData}
              isSaved={true}
              onToggleSave={() => toggleSaveJob?.(job)}
              onViewDetail={handleOpenDetail}
              onQuickApply={handleQuickApply}
            />
          ))}
        </div>
      )}

      {/* ─── Detail Modal ─── */}
      <JobDetailModal
        open={detailModalOpen}
        job={detailModalJob}
        onClose={() => setDetailModalOpen(false)}
        onApply={(job) => {
          setDetailModalOpen(false);
          if (job) {
            setSelectedJobForApply(job as unknown as FeaturedJobItem);
          }
        }}
        isSaved={detailModalJob?.id && typeof isSaved === 'function' ? isSaved(detailModalJob.id) : false}
        onToggleSave={(jobId) => {
          toggleSaveJob?.(jobId);
        }}
      />

      {/* ─── Quick Apply Modal ─── */}
      <ApplyJobModal
        open={!!selectedJobForApply}
        job={selectedJobForApply}
        onClose={() => setSelectedJobForApply(null)}
      />
    </div>
  );
};

export default SavedJobsPage;
