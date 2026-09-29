import React, { useState, useMemo } from 'react';
import { Button } from 'antd';
import {
  HeartFilled,
  SearchOutlined,
  ArrowRightOutlined,
  FireOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSavedJobs, JobItem } from '@/hooks/useSavedJobs';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { JobCardHorizontal } from '@/components/common/JobCardHorizontal';
import { JobDetailModal } from '@/components/common/JobDetailModal';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { JobCardData } from '@/components/common/JobCard';

export const SavedJobsPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Single Source of Truth từ useSavedJobs()
  const { savedJobs, savedJobIds, isSaved, toggleSaveJob } = useSavedJobs();

  // Modal states
  const [selectedJobForApply, setSelectedJobForApply] = useState<FeaturedJobItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalJob, setDetailModalJob] = useState<JobCardData | null>(null);

  // Suggested jobs (lấy từ FEATURED_HOT_JOBS những job chưa lưu để gợi ý khi trống)
  const recommendedJobs = useMemo(() => {
    return FEATURED_HOT_JOBS.filter((job) => !savedJobIds.includes(job.id)).slice(0, 3);
  }, [savedJobIds]);

  const handleOpenDetail = (job: JobCardData) => {
    setDetailModalJob(job);
    setDetailModalOpen(true);
  };

  const handleQuickApply = (job: JobCardData, e: React.MouseEvent) => {
    e.stopPropagation();
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
              Việc Làm Đã Lưu (Bookmarked Jobs) - {savedJobs.length} việc làm
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80">
              {savedJobs.length} việc làm
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 m-0">
            Quản lý danh sách các cơ hội nghề nghiệp bạn đã đánh dấu lưu từ Sàn tuyển dụng để sẵn sàng ứng tuyển.
          </p>
        </div>

        <Button
          type="primary"
          icon={<CompassOutlined />}
          onClick={() => navigate('/jobs')}
          className="h-10 px-5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white border-none shadow-xs shrink-0 inline-flex items-center gap-2"
        >
          Tìm kiếm thêm việc làm
        </Button>
      </div>

      {/* ─── Danh Sách Hoặc Empty State ─── */}
      {savedJobs.length === 0 ? (
        <div className="space-y-8">
          {/* Empty State Box chuẩn TopCV */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-10 sm:p-14 text-center shadow-xs">
            <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-slate-50 border border-slate-200/80 flex items-center justify-center relative shadow-inner">
              <svg
                width="54"
                height="54"
                viewBox="0 0 64 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-slate-400"
              >
                <path
                  d="M10 20L32 9L54 20L32 31L10 20Z"
                  fill="#E2E8F0"
                  stroke="#94A3B8"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 20V44L32 55V31L10 20Z"
                  fill="#CBD5E1"
                  stroke="#94A3B8"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M54 20V44L32 55V31L54 20Z"
                  fill="#F1F5F9"
                  stroke="#94A3B8"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M24 37L32 41L40 37"
                  stroke="#64748B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                <HeartFilled className="text-xs" />
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
              Bạn chưa lưu công việc nào!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              Hãy bấm vào biểu tượng trái tim tại các tin tuyển dụng trên HR Connect để lưu lại các vị trí yêu thích và ứng tuyển bất cứ khi nào bạn sẵn sàng.
            </p>

            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={() => navigate('/jobs')}
              className="h-11 px-7 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs border-none inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Tìm việc ngay</span>
              <ArrowRightOutlined />
            </Button>
          </div>

          {/* Gợi Ý Việc Làm Tương Tự */}
          {recommendedJobs.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-full mb-1">
                    <FireOutlined className="text-rose-500" />
                    Gợi ý nổi bật
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight m-0">
                    Gợi ý việc làm tương tự dành cho bạn
                  </h3>
                </div>
                <Button
                  type="link"
                  onClick={() => navigate('/jobs')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 p-0"
                >
                  Xem tất cả việc làm →
                </Button>
              </div>

              <div className="space-y-3">
                {recommendedJobs.map((job) => (
                  <JobCardHorizontal
                    key={job.id}
                    job={job as unknown as JobCardData}
                    isSaved={isSaved(job.id)}
                    onToggleSave={() => toggleSaveJob(job as unknown as JobItem)}
                    onViewDetail={handleOpenDetail}
                    onQuickApply={handleQuickApply}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Danh sách việc làm đã lưu hoàn chỉnh */
        <div className="space-y-3.5">
          {savedJobs.map((job) => (
            <JobCardHorizontal
              key={job.id}
              job={job as unknown as JobCardData}
              isSaved={true}
              onToggleSave={() => toggleSaveJob(job)}
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
          setSelectedJobForApply(job as unknown as FeaturedJobItem);
        }}
        isSaved={detailModalJob ? isSaved(detailModalJob.id) : false}
        onToggleSave={(jobId) => {
          toggleSaveJob(jobId);
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
