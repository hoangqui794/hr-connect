/**
 * @file ApplicationPipelineTracker.tsx
 * @description Bảng Theo Dõi Đơn Ứng Tuyển (Application Pipeline Tracking) chuẩn trải nghiệm TopCV & LinkedIn.
 * Trình bày dạng danh sách thẻ phẳng mạch lạc:
 *  - Tên công việc, Tên công ty, Ngày nộp
 *  - Stepper 4 bước mini: Đã gửi → Đã xem → Phỏng vấn → Kết quả
 *  - Tag thông báo trạng thái mới (ví dụ: "NTD vừa xem hồ sơ của bạn hôm nay")
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Eye,
  CheckCircle2,
  Calendar,
  ArrowRight,
  FileText,
  AlertCircle,
  Building2,
  Briefcase,
  Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import type { CandidateApplication, CandidateApplicationDisplayGroup } from '@/types/api/mf02';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const PIPELINE_STEPS = [
  { key: 'SUBMITTED', label: 'Đã gửi' },
  { key: 'VIEWED', label: 'Đã xem' },
  { key: 'INTERVIEW', label: 'Phỏng vấn' },
  { key: 'OUTCOME', label: 'Kết quả' },
] as const;

/** Xác định bước hiện tại trên thang 0..3 */
const getPipelineStepIndex = (group: CandidateApplicationDisplayGroup): number => {
  switch (group) {
    case 'SUBMITTED':
      return 0; // Đã gửi
    case 'IN_REVIEW':
      return 1; // Đã xem / Đang xét duyệt
    case 'SELECTED':
    case 'INTERVIEW':
      return 2; // Phỏng vấn
    case 'OFFER':
    case 'HIRED':
    case 'NOT_SELECTED':
    case 'WITHDRAWN':
      return 3; // Kết quả
    default:
      return 0;
  }
};

/** Tạo tag thông báo trạng thái mới sinh động theo từng ngữ cảnh */
const getStatusNotificationTag = (group: CandidateApplicationDisplayGroup, appliedAt?: string) => {
  switch (group) {
    case 'IN_REVIEW':
      return {
        label: 'NTD vừa xem hồ sơ của bạn hôm nay',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
        icon: Eye,
      };
    case 'SELECTED':
      return {
        label: 'Đạt vòng sơ loại — Chờ lịch phỏng vấn',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        icon: Sparkles,
      };
    case 'INTERVIEW':
      return {
        label: 'Đang trong quy trình phỏng vấn',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/80',
        icon: Calendar,
      };
    case 'HIRED':
      return {
        label: 'Trúng tuyển chính thức 🎉',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold',
        icon: CheckCircle2,
      };
    case 'OFFER':
      return {
        label: 'Đã nhận thư mời nhận việc (Offer)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
        icon: CheckCircle2,
      };
    case 'NOT_SELECTED':
      return {
        label: 'Chưa phù hợp với đợt tuyển dụng này',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        icon: AlertCircle,
      };
    case 'WITHDRAWN':
      return {
        label: 'Bạn đã rút đơn ứng tuyển',
        badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
        icon: AlertCircle,
      };
    case 'SUBMITTED':
    default:
      return {
        label: 'Hồ sơ đã gửi thành công tới NTD',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: CheckCircle2,
      };
  }
};

interface ApplicationPipelineTrackerProps {
  applications?: CandidateApplication[];
  isLoading?: boolean;
  limit?: number;
  className?: string;
  onViewAll?: () => void;
}

export const ApplicationPipelineTracker: React.FC<ApplicationPipelineTrackerProps> = ({
  applications = [],
  isLoading = false,
  limit = 4,
  className = '',
  onViewAll,
}) => {
  const navigate = useNavigate();

  // Dữ liệu ứng tuyển hiển thị
  const displayedApps = limit ? applications.slice(0, limit) : applications;

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[0, 1].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-100 rounded w-1/4 mb-4" />
            <div className="h-8 bg-slate-50 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (displayedApps.length === 0) {
    return (
      <div className={`bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center ${className}`}>
        <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2.5" />
        <h4 className="text-base font-bold text-slate-800 m-0">Bạn chưa nộp hồ sơ vào vị trí nào</h4>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-4 max-w-md mx-auto">
          Khám phá cơ hội mới tại{' '}
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="text-blue-600 font-semibold hover:underline bg-transparent border-0 p-0 cursor-pointer"
          >
            Trang tìm việc làm
          </button>
        </p>
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer border-0 shadow-xs inline-flex items-center gap-1.5"
        >
          <span>Khám phá việc làm ngay</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {displayedApps.map((app) => {
        const stepIndex = getPipelineStepIndex(app.displayGroup);
        const statusNotif = getStatusNotificationTag(app.displayGroup, app.appliedAt);
        const StatusIcon = statusNotif.icon;

        return (
          <div
            key={app.applicationId}
            className="bg-white border border-slate-200/80 hover:border-blue-300 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
          >
            {/* 1. Header: Vị trí + Công ty + Tag thông báo trạng thái mới */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    onClick={() => navigate(`/candidate/applications/${app.applicationId}`)}
                    className="text-sm sm:text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors m-0 line-clamp-1"
                  >
                    {app.jobTitle}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-medium text-slate-700 flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    {app.companyName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    Nộp {dayjs(app.appliedAt).fromNow()}
                  </span>
                </div>
              </div>

              {/* Tag thông báo trạng thái mới nổi bật theo yêu cầu */}
              <div className="shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusNotif.badgeClass}`}
                >
                  <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{statusNotif.label}</span>
                </span>
              </div>
            </div>

            {/* 2. Stepper 4 bước mini: Đã gửi → Đã xem → Phỏng vấn → Kết quả */}
            <div className="py-1 px-2 sm:px-6">
              <div className="relative flex items-center justify-between">
                {/* Connecting background line */}
                <div className="absolute left-[8%] right-[8%] top-[10px] h-[2px] bg-slate-200 -z-0" />

                {/* Active progress colored line */}
                <div
                  className="absolute left-[8%] top-[10px] h-[2px] bg-emerald-500 -z-0 transition-all duration-500"
                  style={{
                    width: `${(stepIndex / (PIPELINE_STEPS.length - 1)) * 84}%`,
                  }}
                />

                {/* 4 Steps */}
                {PIPELINE_STEPS.map((step, idx) => {
                  const isPassed = idx < stepIndex;
                  const isCurrent = idx === stepIndex;

                  return (
                    <div
                      key={step.key}
                      className="relative z-10 flex flex-col items-center select-none"
                    >
                      {/* Step Indicator Node */}
                      {isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 border-2 border-white ring-4 ring-emerald-100 flex items-center justify-center shadow-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        </div>
                      ) : isPassed ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                          <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-300" />
                      )}

                      {/* Step Label */}
                      <span
                        className={`mt-1.5 text-[11px] sm:text-xs text-center transition-colors ${
                          isCurrent
                            ? 'font-bold text-emerald-700'
                            : isPassed
                              ? 'font-semibold text-slate-700'
                              : 'text-slate-400 font-medium'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Footer: CV đính kèm + Nút xem chi tiết tiến độ */}
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
              <div className="text-slate-500 flex items-center gap-1.5 min-w-0">
                <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">
                  Hồ sơ gửi: <strong className="text-slate-700">{app.cvTitle || 'CV Mặc định'}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/candidate/applications/${app.applicationId}`)}
                className="text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 hover:underline shrink-0"
              >
                <span>Xem chi tiết tiến trình</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApplicationPipelineTracker;
