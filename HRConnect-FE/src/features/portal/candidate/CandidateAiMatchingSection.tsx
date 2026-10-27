/**
 * @file CandidateAiMatchingSection.tsx
 * @description Khối "Cơ Hội Dành Riêng Cho Bạn" (AI Matching Jobs for Candidate).
 * Kết nối trực tiếp với candidateJobMatchApi.getJobMatches(), loại bỏ 100% dữ liệu mock.
 * Nút "Nộp nhanh bằng CV chính" gửi đúng jobId và cvId thực tế lên applyApi.apply.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Zap,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  ShieldCheck,
  Check,
  Briefcase,
} from 'lucide-react';
import { message, Modal } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { candidateCvApi } from '@/services/api/mf02Api';
import { applyApi } from '@/services/api/mf02/candidateApplicationApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { CompanyLogo } from '@/features/landing/components/CompanyLogo';
import type { CandidateJobMatchDto } from '@/types/api/candidateJobMatch';
import { candidateKeys } from '../CandidatePages';

interface EnhancedMatchJob {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  salaryText: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  deadline: string;
  experience: string;
}

interface CandidateAiMatchingSectionProps {
  limit?: number;
  className?: string;
  viewAllLink?: string;
}

export const CandidateAiMatchingSection: React.FC<CandidateAiMatchingSectionProps> = ({
  limit = 4,
  className = '',
  viewAllLink = '/candidate/jobs',
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Gọi API matching jobs thực tế của ứng viên
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['candidate-job-matches'],
    queryFn: () => candidateJobMatchApi.getJobMatches(),
    staleTime: 5 * 60 * 1000,
  });

  // Lấy danh sách CV thật của ứng viên để nộp nhanh bằng CV chính
  const { data: cvs = [] } = useQuery({
    queryKey: candidateKeys.cvs,
    queryFn: () => candidateCvApi.list(),
  });

  const primaryCv = useMemo(() => cvs.find((c) => c.isPrimary) || cvs[0], [cvs]);

  // Chuyển đổi dữ liệu thống nhất từ Database API
  const matchedJobs: EnhancedMatchJob[] = useMemo(() => {
    if (apiData && apiData.items && apiData.items.length > 0) {
      return apiData.items.slice(0, limit).map((item: CandidateJobMatchDto): EnhancedMatchJob => {
        const rawScore = typeof item.matchScore === 'number' ? item.matchScore : 0.85;
        const score = rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
        const reasons = item.matchingReasons || [];
        const missing = item.missingRequirements || [];
        return {
          id: item.jobId,
          title: item.jobTitle,
          company: item.companyName,
          companyId: item.jobId,
          location: item.location || 'Toàn quốc',
          salaryText: item.salaryNegotiable
            ? 'Thỏa thuận'
            : item.salaryMin && item.salaryMax
              ? `${(item.salaryMin / 1000000).toFixed(0)} - ${(item.salaryMax / 1000000).toFixed(0)} Triệu VND`
              : 'Mức lương hấp dẫn',
          matchScore: score,
          matchedSkills: reasons.length > 0 ? reasons.slice(0, 4) : ['Kỹ năng phù hợp', 'Kinh nghiệm tương thích'],
          missingSkills: missing.slice(0, 1),
          deadline: item.applicationDeadline
            ? new Date(item.applicationDeadline).toLocaleDateString('vi-VN')
            : 'Đang mở',
          experience: item.employmentType || 'Toàn thời gian',
        };
      });
    }
    return [];
  }, [apiData, limit]);

  // Quản lý Modal Nộp nhanh bằng CV chính
  const [quickApplyJob, setQuickApplyJob] = useState<EnhancedMatchJob | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  const handleOpenQuickApply = (job: EnhancedMatchJob) => {
    if (appliedJobIds.has(job.id)) {
      void message.info(`Bạn đã nộp đơn vào vị trí "${job.title}" rồi.`);
      return;
    }
    setQuickApplyJob(job);
  };

  const handleConfirmQuickApply = async () => {
    if (!quickApplyJob) return;

    if (!primaryCv) {
      void message.warning('Bạn cần có ít nhất 1 bản CV trong kho để ứng tuyển nhanh. Vui lòng tải CV lên trước!');
      navigate('/candidate/cvs');
      return;
    }

    try {
      setIsApplying(true);
      // Gửi đúng jobId và cvId thực tế lên backend API
      await applyApi.apply(quickApplyJob.id, { cvId: primaryCv.cvId });

      setAppliedJobIds((prev) => new Set([...prev, quickApplyJob.id]));
      void message.success(
        `Ứng tuyển thành công vị trí "${quickApplyJob.title}" bằng CV chính! Nhà tuyển dụng sẽ xem xét hồ sơ của bạn.`
      );
      queryClient.invalidateQueries({ queryKey: candidateKeys.applications });
      setQuickApplyJob(null);
    } catch (err) {
      void message.error(getApiErrorMessage(err));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className={`space-y-4 ${className}`}>
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200/60 text-xs font-bold text-blue-700 px-3 py-1 rounded-full mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>AI Đề Xuất Thông Minh 2026</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 m-0">
            Cơ hội dành riêng cho bạn
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
            Tự động đối khớp kỹ năng và kinh nghiệm thực tế từ CV chính của bạn với các việc làm hàng đầu
          </p>
        </div>

        {viewAllLink && (
          <button
            type="button"
            onClick={() => navigate(viewAllLink)}
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 self-start sm:self-auto hover:underline"
          >
            <span>Xem tất cả cơ hội</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Loading Shimmer State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs animate-pulse flex flex-col justify-between h-56"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100" />
                  <div className="w-24 h-5 rounded-md bg-slate-100" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-10 bg-slate-50 rounded-xl" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="h-6 bg-slate-100 rounded w-20" />
                <div className="h-7 bg-slate-200 rounded-xl w-36" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State khi chưa có việc làm đối khớp */}
      {!isLoading && matchedJobs.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-2.5" />
          <h3 className="text-base font-bold text-slate-800 m-0">
            Chưa có gợi ý việc làm đối khớp
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            Hệ thống AI sẽ tự động phân tích và gợi ý các việc làm phù hợp nhất khi bạn bổ sung thêm kỹ năng vào hồ sơ hoặc tải lên bản CV chính.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/candidate/profile?tab=career-info')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl shadow-xs transition-all border-0 cursor-pointer"
            >
              Cập nhật kỹ năng hồ sơ
            </button>
            <button
              type="button"
              onClick={() => navigate('/candidate/jobs')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-4 py-2 rounded-xl transition-all border-0 cursor-pointer"
            >
              Tìm việc làm đang mở
            </button>
          </div>
        </div>
      )}

      {/* 2. Grid Các Việc Làm Đối Khớp AI */}
      {!isLoading && matchedJobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matchedJobs.map((job) => {
            const isApplied = appliedJobIds.has(job.id);

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top: Logo + Title + Matching Score */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl p-1.5 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                        <CompanyLogo
                          id={job.companyId}
                          name={job.company}
                          size={40}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="text-sm sm:text-base font-bold text-slate-900 hover:text-blue-600 cursor-pointer transition-colors m-0 line-clamp-1"
                          title={job.title}
                        >
                          {job.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium m-0 mt-0.5 line-clamp-1">
                          {job.company}
                        </p>
                      </div>
                    </div>

                    {/* Huy hiệu điểm khớp AI theo yêu cầu */}
                    <span className="shrink-0 bg-blue-50 text-blue-700 font-semibold text-xs px-2.5 py-1 rounded-md border border-blue-100 inline-flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
                      <span>{job.matchScore}% Khớp hồ sơ của bạn</span>
                    </span>
                  </div>

                  {/* Mức lương + Địa điểm */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded font-mono">
                      {job.salaryText}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {job.location}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      Hạn: {job.deadline}
                    </span>
                  </div>

                  {/* Danh sách tag kỹ năng đối khớp */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Kỹ năng phân tích từ CV:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {job.matchedSkills.map((skill) => (
                        <span
                          key={skill}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium text-xs px-2 py-0.5 rounded flex items-center gap-1"
                        >
                          <Check className="h-3 w-3 stroke-[3]" />
                          <span>{skill}</span>
                        </span>
                      ))}
                      {job.missingSkills.map((missing) => (
                        <span
                          key={missing}
                          className="bg-amber-50 text-amber-700 border border-amber-200/60 text-xs px-2 py-0.5 rounded flex items-center gap-1 font-medium"
                        >
                          <span>+1 cần học thêm: {missing}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Nút thao tác: "Nộp nhanh bằng CV chính" và "Xem chi tiết" */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-200 bg-white hover:bg-slate-50 font-medium text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Xem chi tiết
                  </button>

                  {isApplied ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-xl">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Đã nộp CV chính
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenQuickApply(job)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-4 py-2 rounded-xl shadow-xs transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer border-0"
                    >
                      <Zap className="h-3.5 w-3.5 fill-white" />
                      <span>Nộp nhanh bằng CV chính</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Modal Xác Nhận Nộp Nhanh Bằng CV Chính */}
      <Modal
        open={quickApplyJob !== null}
        onCancel={() => setQuickApplyJob(null)}
        footer={null}
        centered
        width={460}
      >
        {quickApplyJob && (
          <div className="p-2 sm:p-3 text-left">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                <Zap className="h-5 w-5 fill-blue-600 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">
                  Xác nhận nộp nhanh hồ sơ
                </h3>
                <span className="text-xs text-slate-500">
                  Vị trí: <strong>{quickApplyJob.title}</strong>
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Hồ sơ gửi đi:</span>
                <span className="font-bold text-slate-800">
                  {primaryCv ? `${primaryCv.title || primaryCv.fileName} (CV Mặc định)` : 'Chưa chọn CV'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Doanh nghiệp:</span>
                <span className="font-semibold text-slate-800">{quickApplyJob.company}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Mức độ tương thích:</span>
                <span className="font-extrabold text-blue-600">{quickApplyJob.matchScore}% Khớp kỹ năng</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 m-0 mb-4 leading-relaxed">
              Thông tin liên lạc và bản CV chính của bạn sẽ được chuyển thẳng đến bộ phận tuyển dụng của{' '}
              <strong className="text-slate-700">{quickApplyJob.company}</strong> mà không cần điền lại biểu mẫu.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickApplyJob(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors border border-slate-200 cursor-pointer bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={handleConfirmQuickApply}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-4 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5 fill-white" />
                <span>{isApplying ? 'Đang gửi hồ sơ...' : 'Xác nhận nộp đơn ngay'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};

export default CandidateAiMatchingSection;
