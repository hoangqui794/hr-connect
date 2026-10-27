/**
 * @file ProfileStrengthMeter.tsx
 * @description Thước Đo Sức Mạnh Hồ Sơ (Profile Strength Meter) phân tầng trực quan chuẩn LinkedIn & TopCV.
 * 4 cấp độ: Khởi tạo (25%) → Tiềm năng (50%) → Hoàn thiện (75%) → Ngôi sao/Toàn diện (100%).
 * Đi kèm thanh tiến độ mượt mà và Actionable Checklist để nâng điểm hồ sơ.
 */
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Star,
  Award,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  FolderGit2,
  Languages,
  PlusCircle,
} from 'lucide-react';
import { Tooltip } from 'antd';

export type ProfileTierLevel = 'INIT' | 'POTENTIAL' | 'COMPLETED' | 'ALL_STAR';

interface ProfileStrengthMeterProps {
  scorePercent?: number;
  cvCount?: number;
  hasSkills?: boolean;
  hasCertificates?: boolean;
  hasProjects?: boolean;
  className?: string;
  onOpenCvModal?: () => void;
}

export const ProfileStrengthMeter: React.FC<ProfileStrengthMeterProps> = ({
  scorePercent,
  cvCount = 1,
  hasSkills = true,
  hasCertificates = false,
  hasProjects = false,
  className = '',
  onOpenCvModal,
}) => {
  const navigate = useNavigate();

  // Tính toán điểm số sức mạnh hồ sơ thông minh
  const calculatedScore = useMemo(() => {
    if (typeof scorePercent === 'number') return scorePercent;
    let score = 25; // Base khởi tạo
    if (cvCount > 0) score += 25; // Đã có CV
    if (hasSkills) score += 25; // Đã cập nhật kỹ năng & tiểu sử
    if (hasCertificates || hasProjects) score += 25; // Có chứng chỉ hoặc dự án
    return Math.min(100, score);
  }, [scorePercent, cvCount, hasSkills, hasCertificates, hasProjects]);

  // Phân tầng 4 cấp độ
  const tierConfig = useMemo(() => {
    if (calculatedScore >= 90) {
      return {
        level: 'ALL_STAR' as ProfileTierLevel,
        name: 'Ngôi sao / Toàn diện',
        percentageText: '100%',
        colorText: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 border-emerald-200/80 text-emerald-800',
        icon: Star,
        description: 'Hồ sơ của bạn đã hoàn hảo! Đạt thứ hạng ưu tiên cao nhất trong kết quả tìm kiếm của NTD.',
      };
    }
    if (calculatedScore >= 70) {
      return {
        level: 'COMPLETED' as ProfileTierLevel,
        name: 'Hoàn thiện',
        percentageText: '75%',
        colorText: 'text-blue-700',
        badgeBg: 'bg-blue-50 border-blue-200/80 text-blue-800',
        icon: FileCheck2,
        description: 'Hồ sơ đầy đủ thông tin cốt lõi. Bổ sung thêm chứng chỉ để bứt phá lên mức Ngôi sao.',
      };
    }
    if (calculatedScore >= 45) {
      return {
        level: 'POTENTIAL' as ProfileTierLevel,
        name: 'Tiềm năng',
        percentageText: '50%',
        colorText: 'text-cyan-700',
        badgeBg: 'bg-cyan-50 border-cyan-200/80 text-cyan-800',
        icon: TrendingUp,
        description: 'Đã có thông tin nền tảng. Thêm kỹ năng chuyên sâu để thu hút đúng công việc mục tiêu.',
      };
    }
    return {
      level: 'INIT' as ProfileTierLevel,
      name: 'Khởi tạo',
      percentageText: '25%',
      colorText: 'text-slate-700',
      badgeBg: 'bg-slate-100 border-slate-200 text-slate-700',
      icon: PlusCircle,
      description: 'Hồ sơ mới tạo. Tải lên CV đầu tiên để bắt đầu đón nhận gợi ý việc làm chuẩn xác.',
    };
  }, [calculatedScore]);

  // Danh sách gợi ý việc cần làm tiếp theo (Actionable Checklist)
  const checklistItems = useMemo(() => {
    const items = [];
    if (!hasCertificates) {
      items.push({
        id: 'cert',
        title: '+15% Thêm chứng chỉ hoặc ngoại ngữ',
        desc: 'IELTS, TOEIC, chứng chỉ kỹ thuật AWS, Google hoặc PMP giúp hồ sơ tăng 2.5x lượt click.',
        actionText: 'Cập nhật',
        icon: Languages,
        action: () => (onOpenCvModal ? onOpenCvModal() : navigate('/candidate/profile?tab=career-info')),
      });
    }
    if (!hasProjects) {
      items.push({
        id: 'proj',
        title: '+10% Bổ sung dự án thực tế tiêu biểu',
        desc: 'Mô tả ngắn gọn vai trò, công nghệ sử dụng và kết quả đạt được trong các dự án quan trọng.',
        actionText: 'Bổ sung',
        icon: FolderGit2,
        action: () => navigate('/candidate/profile?tab=career-info'),
      });
    }
    if (cvCount === 0) {
      items.push({
        id: 'cv',
        title: '+25% Tải lên CV chuẩn ATS',
        desc: 'Sử dụng CV định dạng PDF để hệ thống AI trích xuất kỹ năng nhanh chóng.',
        actionText: 'Tải CV',
        icon: FileCheck2,
        action: () => navigate('/candidate/cvs'),
      });
    }
    return items;
  }, [hasCertificates, hasProjects, cvCount, navigate, onOpenCvModal]);

  return (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ${className}`}
    >
      {/* 1. Header: Thước đo cấp bậc */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 m-0">
              Sức mạnh hồ sơ nghề nghiệp
            </h3>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${tierConfig.badgeBg}`}
            >
              <tierConfig.icon className="h-3.5 w-3.5" />
              <span>{tierConfig.name}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 m-0 mt-1">{tierConfig.description}</p>
        </div>

        {/* Điểm số lớn */}
        <div className="flex items-baseline gap-1 text-right sm:shrink-0">
          <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono tracking-tight">
            {calculatedScore}%
          </span>
          <span className="text-xs text-slate-400 font-medium">/ 100%</span>
        </div>
      </div>

      {/* 2. Thanh tiến độ đa đoạn với màu chuyển đổi mượt mà */}
      <div className="space-y-1.5 mb-5">
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative p-0.5 border border-slate-200/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 transition-all duration-700 ease-out shadow-xs"
            style={{ width: `${calculatedScore}%` }}
          />
        </div>

        {/* 4 Mốc phân tầng trực quan */}
        <div className="grid grid-cols-4 text-[11px] font-semibold text-slate-500 pt-1">
          <div className="text-left">
            <span className={calculatedScore >= 25 ? 'text-blue-600 font-bold' : ''}>Khởi tạo (25%)</span>
          </div>
          <div className="text-center">
            <span className={calculatedScore >= 50 ? 'text-blue-600 font-bold' : ''}>Tiềm năng (50%)</span>
          </div>
          <div className="text-center">
            <span className={calculatedScore >= 75 ? 'text-cyan-700 font-bold' : ''}>Hoàn thiện (75%)</span>
          </div>
          <div className="text-right">
            <span className={calculatedScore >= 95 ? 'text-emerald-700 font-bold' : ''}>Ngôi sao (100%)</span>
          </div>
        </div>
      </div>

      {/* 3. Actionable Checklist (Gợi ý nâng điểm hồ sơ) */}
      {checklistItems.length > 0 ? (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Gợi ý nâng điểm để đạt mức Ngôi sao
            </span>
            <span className="text-xs text-blue-600 font-medium">
              Còn {checklistItems.length} việc cần làm
            </span>
          </div>

          <div className="space-y-2">
            {checklistItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-slate-50 hover:bg-blue-50/40 border border-slate-200/70 hover:border-blue-200 rounded-xl p-3 transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-blue-700 transition-colors">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-500 line-clamp-1">
                        {item.desc}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={item.action}
                    className="shrink-0 bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Hồ sơ của bạn đã hoàn thiện 100%! Bạn đang có cơ hội tiếp cận cao nhất với các nhà tuyển dụng hàng đầu.</span>
        </div>
      )}
    </div>
  );
};

export default ProfileStrengthMeter;
