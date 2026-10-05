import React, { useMemo } from 'react';
import {
  DollarOutlined,
  HeartOutlined,
  HeartFilled,
  ClockCircleOutlined,
  ThunderboltOutlined,
  GiftOutlined,
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ServiceType } from '@/types/job';
import { CompanyLogo } from './CompanyLogo';
import { JobCardData, formatSalaryVND, deduplicateTags } from './JobCard';
import { BookmarkButton } from './BookmarkButton';

interface JobCardHorizontalProps {
  job: JobCardData;
  isSaved?: boolean;
  onToggleSave?: (jobId: string, e: React.MouseEvent) => void;
  onViewDetail?: (job: JobCardData) => void;
  onQuickApply?: (job: JobCardData, e: React.MouseEvent) => void;
  className?: string;
}

export const JobCardHorizontal: React.FC<JobCardHorizontalProps> = ({
  job,
  isSaved = false,
  onToggleSave,
  onViewDetail,
  onQuickApply,
  className = '',
}) => {
  const navigate = useNavigate();

  if (!job) return null;

  const isCOD =
    job?.serviceType === ServiceType.HEADHUNT_COD ||
    String(job?.serviceType || '').toUpperCase() === 'HEADHUNT_COD' ||
    Boolean(job?.estimatedCommission);

  const deadlineText = job?.deadline || (job?.isUrgent ? 'Còn 3 ngày' : 'Còn 15 ngày');
  const uniqueTags = useMemo(() => deduplicateTags(job?.tags || []), [job?.tags]);

  const handleClickCard = () => {
    if (onViewDetail) {
      onViewDetail(job);
    } else if (job?.id) {
      navigate(`/jobs/${job.id}`);
    }
  };

  return (
    <div
      onClick={handleClickCard}
      className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/95 backdrop-blur-md border border-slate-200/90 hover:border-blue-400 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer text-left ${className}`}
    >
      {/* ── Left & Center Container: Logo + Job Info ── */}
      <div className="flex items-start gap-4 min-w-0 flex-1">
        {/* Real Company Logo (TopCV Standard) */}
        <CompanyLogo
          companyName={job.company}
          logoUrl={job.companyLogo}
          size="md"
          className="w-14 h-14 rounded-xl shrink-0"
        />

        {/* Center Details */}
        <div className="min-w-0 flex-1">
          {/* Job Title */}
          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug tracking-tight group-hover:text-blue-600 transition-colors line-clamp-1">
            {job.title}
          </h3>

          {/* Company Name */}
          <div className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors truncate mt-0.5">
            {job.company}
          </div>

          {/* Gom cụm Metadata: [Địa điểm • Hình thức • Cấp bậc] */}
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap mt-1.5">
            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
              <EnvironmentOutlined className="text-slate-400 text-2xs" />
              <span className="truncate max-w-[130px]">{job.location}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span>{job.workMode}</span>
            {job.level && (
              <>
                <span className="text-slate-300">•</span>
                <span className="font-medium text-slate-600">{job.level}</span>
              </>
            )}
          </div>

          {/* Skills & Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {uniqueTags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-2xs text-slate-600 bg-slate-100/90 border border-slate-200/70 px-2 py-0.5 rounded-md font-medium"
              >
                {tag}
              </span>
            ))}
            {uniqueTags.length > 3 && (
              <span className="text-2xs text-slate-400 font-medium px-1">
                +{uniqueTags.length - 3}
              </span>
            )}

            <span className="text-slate-300 mx-1 hidden sm:inline">•</span>

            {/* Deadline */}
            <span className="text-2xs text-slate-400 inline-flex items-center gap-1">
              <ClockCircleOutlined className="text-3xs" />
              {deadlineText}
            </span>
          </div>
        </div>
      </div>

      {/* ── Right Container: Salary + Badges + Bookmark + Action ── */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
        <div className="flex flex-col sm:items-end">
          {/* Emerald Salary Badge */}
          <span className="text-emerald-600 font-extrabold text-sm sm:text-base bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg inline-flex items-center gap-1 shadow-2xs">
            <DollarOutlined className="text-xs" />
            {formatSalaryVND(job.salaryMin, job.salaryMax)}
          </span>

          {/* HR Connect Special Badges */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap sm:justify-end">
            {isCOD && (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80">
                <GiftOutlined className="text-amber-600 text-3xs" />
                Thưởng COD: {job.estimatedCommission || `${job.commissionRate || 15}%`}
              </span>
            )}

            {job.aiMatchScore ? (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80">
                <ThunderboltOutlined className="text-blue-500 text-3xs" />
                Khớp ATS {job.aiMatchScore}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 border border-indigo-200/60">
                <SafetyCertificateOutlined className="text-indigo-500 text-3xs" />
                Khớp ATS 90%+
              </span>
            )}
          </div>
        </div>

        {/* Buttons: Bookmark + Quick Action */}
        <div className="flex items-center gap-2">
          {onQuickApply && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickApply(job, e);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors"
            >
              Nộp nhanh
            </button>
          )}

          {/* Bookmark Button */}
          {onToggleSave ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave?.(job.id, e);
              }}
              title={isSaved ? 'Bỏ lưu tin' : 'Lưu việc làm'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0 border cursor-pointer ${
                isSaved
                  ? 'bg-rose-50 text-rose-500 border-rose-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-400 border-slate-200/70 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200'
              }`}
            >
              {isSaved ? (
                <HeartFilled className="text-rose-500 fill-rose-500 text-xs" style={{ color: '#f43f5e' }} />
              ) : (
                <HeartOutlined className="text-xs" />
              )}
            </button>
          ) : (
            <BookmarkButton jobId={job.id} jobTitle={job.title} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
};

export default JobCardHorizontal;
