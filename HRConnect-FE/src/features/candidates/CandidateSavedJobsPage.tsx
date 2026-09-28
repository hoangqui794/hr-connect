import React, { useState, useMemo } from 'react';
import { Button, message } from 'antd';
import {
  HeartFilled,
  SearchOutlined,
  ArrowRightOutlined,
  FireOutlined,
  CompassOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { JobCardHorizontal } from '@/components/common/JobCardHorizontal';
import { JobDetailModal } from '@/components/common/JobDetailModal';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { JobCardData } from '@/components/common/JobCard';

export const CandidateSavedJobsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const currentUserEmail = (user?.email || '').toLowerCase().trim();
  const { savedJobs, toggleSaveJob, isJobSaved } = useCandidateStore();

  const [selectedJobForApply, setSelectedJobForApply] = useState<FeaturedJobItem | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalJob, setDetailModalJob] = useState<JobCardData | null>(null);

  // Read saved job ids isolated by currentUser.email from localStorage or store
  const userSavedJobIds = useMemo(() => {
    if (!currentUserEmail) return [];
    try {
      const userKey = `hrconnect_saved_jobs_${currentUserEmail}`;
      const raw = localStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    const list = savedJobs || [];
    return list
      .filter((j) => (j.userEmail || '').toLowerCase().trim() === currentUserEmail)
      .map((j) => j.jobId);
  }, [currentUserEmail, savedJobs]);

  // Unified jobs pool (FEATURED_HOT_JOBS + localStorage hrconnect_all_jobs)
  const allAvailableJobs = useMemo(() => {
    try {
      const raw = localStorage.getItem('hrconnect_all_jobs');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, FeaturedJobItem>();
          FEATURED_HOT_JOBS.forEach((j) => map.set(j.id, j));
          parsed.forEach((j: any) => {
            if (j.id && j.title) {
              map.set(j.id, {
                id: j.id,
                title: j.title,
                company: j.company || 'Doanh nghiệp',
                location: j.location || 'Hồ Chí Minh',
                workMode: j.remote ? 'Remote' : 'Hybrid',
                level: (j.level || 'Senior') as any,
                salaryMin: j.salaryRange?.min || 20000000,
                salaryMax: j.salaryRange?.max || 45000000,
                serviceType: (j.serviceType || 'HEADHUNT_COD') as any,
                commissionRate: j.engagementTerms?.commissionRate || 15,
                estimatedCommission: `${Math.round(((j.salaryRange?.max || 45000000) * (j.engagementTerms?.commissionRate || 15)) / 100).toLocaleString('vi-VN')}₫`,
                tags: [...(j.mustHaveTags || []), ...(j.shouldHaveTags || [])],
                isUrgent: true,
              });
            }
          });
          return Array.from(map.values());
        }
      }
    } catch {}
    return FEATURED_HOT_JOBS;
  }, []);

  // Filter saved jobs
  const savedJobsList = useMemo(() => {
    return allAvailableJobs.filter((job) => userSavedJobIds.includes(job.id));
  }, [allAvailableJobs, userSavedJobIds]);

  // Suggested jobs (2-3 jobs from pool that are not currently saved)
  const recommendedJobs = useMemo(() => {
    return allAvailableJobs
      .filter((job) => !userSavedJobIds.includes(job.id))
      .slice(0, 3);
  }, [allAvailableJobs, userSavedJobIds]);

  const handleToggleSave = (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const saved = toggleSaveJob(jobId, currentUserEmail);
    if (saved) {
      message.success('Đã lưu việc làm vào danh sách!');
    } else {
      message.info('Đã gỡ việc làm khỏi danh sách đã lưu.');
    }
  };

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
      {/* ─── Page Header Banner (TopCV Style) ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 shadow-2xs">
              <HeartFilled className="text-sm" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight m-0">
              Việc Làm Đã Lưu (Bookmarked Jobs)
            </h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80">
              {savedJobsList.length} việc làm
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
      {savedJobsList.length === 0 ? (
        <div className="space-y-8">
          {/* Empty State Box chuẩn TopCV */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-10 sm:p-14 text-center shadow-xs">
            {/* Vector Archive Box Illustration */}
            <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-slate-50 border border-slate-200/80 flex items-center justify-center relative shadow-inner">
              {/* Storage Box Vector */}
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
              {/* Small Heart Badge Accent */}
              <span className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                <HeartFilled className="text-xs" />
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
              Bạn chưa lưu công việc nào!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              Hãy bấm vào biểu tượng trái tim tại các tin tuyển dụng trên HR Connect để lưu lại các vị trí yêu thích và ứng tuyển bất cứ khi nào bạn sẵn sàng.
            </p>

            {/* CTA Button */}
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

          {/* Khối Gợi Ý Việc Làm Tương Tự (TopCV Vibe) */}
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
                  isSaved={isJobSaved(job.id, currentUserEmail)}
                  onToggleSave={(id, e) => handleToggleSave(id, e)}
                  onViewDetail={handleOpenDetail}
                  onQuickApply={handleQuickApply}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Danh sách các việc làm đã lưu */
        <div className="space-y-3.5">
          {savedJobsList.map((job) => (
            <JobCardHorizontal
              key={job.id}
              job={job as unknown as JobCardData}
              isSaved={true}
              onToggleSave={(id, e) => handleToggleSave(id, e)}
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
        isSaved={detailModalJob ? isJobSaved(detailModalJob.id, currentUserEmail) : false}
        onToggleSave={(jobId) => {
          toggleSaveJob(jobId, currentUserEmail);
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

export default CandidateSavedJobsPage;
