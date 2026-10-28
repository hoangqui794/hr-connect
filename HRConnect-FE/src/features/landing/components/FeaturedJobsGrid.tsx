/**
 * @file FeaturedJobsGrid.tsx
 * @description Danh sách việc làm chuẩn TopCV (Hình 1):
 * - Bộ lọc dạng Dropdown kết hợp dải Pill ngang cuộn mượt (< Ngẫu Nhiên | Hà Nội | TP.HCM... >).
 * - Banner gợi ý phong cách TopCV (💡 Gợi ý: Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết).
 * - Lưới 3 cột các thẻ việc làm gọn gàng: Logo vuông, Huy hiệu GẤP/HOT, Tiêu đề, Tên công ty viết hoa, Mức lương pill, Địa điểm pill và Nút lưu việc làm góc phải.
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  Heart,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from './CompanyLogo';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import type { Job } from '@/types/api/jobs';

type FilterCategory = 'LOCATION' | 'SALARY' | 'EXPERIENCE' | 'CATEGORY';

interface FilterOption {
  id: string;
  label: string;
}

const FILTER_CATEGORY_MAP: Record<FilterCategory, { label: string; pills: FilterOption[] }> = {
  LOCATION: {
    label: 'Địa điểm',
    pills: [
      { id: 'ALL', label: 'Ngẫu Nhiên' },
      { id: 'HN', label: 'Hà Nội' },
      { id: 'HCM', label: 'Thành phố Hồ Chí Minh (cũ)' },
      { id: 'NORTH', label: 'Miền Bắc' },
      { id: 'SOUTH', label: 'Miền Nam' },
      { id: 'DN', label: 'Đà Nẵng' },
      { id: 'REMOTE', label: 'Toàn quốc / Remote' },
    ],
  },
  SALARY: {
    label: 'Mức lương',
    pills: [
      { id: 'ALL', label: 'Ngẫu Nhiên' },
      { id: 'UNDER_10', label: 'Dưới 10 triệu' },
      { id: '10_15', label: '10 - 15 triệu' },
      { id: '15_20', label: '15 - 20 triệu' },
      { id: '20_30', label: '20 - 30 triệu' },
      { id: 'OVER_30', label: 'Trên 30 triệu' },
      { id: 'NEGOTIABLE', label: 'Thoả thuận' },
    ],
  },
  EXPERIENCE: {
    label: 'Kinh nghiệm',
    pills: [
      { id: 'ALL', label: 'Ngẫu Nhiên' },
      { id: 'NO_EXP', label: 'Chưa có kinh nghiệm' },
      { id: 'UNDER_1', label: 'Dưới 1 năm' },
      { id: '1_3', label: '1 - 3 năm' },
      { id: '3_5', label: '3 - 5 năm' },
      { id: 'OVER_5', label: 'Trên 5 năm' },
    ],
  },
  CATEGORY: {
    label: 'Ngành nghề',
    pills: [
      { id: 'ALL', label: 'Ngẫu Nhiên' },
      { id: 'IT', label: 'Công nghệ Thông tin' },
      { id: 'SALES', label: 'Kinh doanh / Bán hàng' },
      { id: 'MARKETING', label: 'Marketing / PR' },
      { id: 'FINANCE', label: 'Tài chính / Kế toán' },
      { id: 'HR', label: 'Nhân sự / Hành chính' },
    ],
  },
};

export const FeaturedJobsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<FilterCategory>('LOCATION');
  const [selectedPill, setSelectedPill] = useState<string>('ALL');
  const [showHint, setShowHint] = useState<boolean>(true);
  const pillsRef = useRef<HTMLDivElement>(null);
  const { isSaved, toggleSave } = useSavedJobs();

  // Gọi API lấy việc làm công khai thực tế từ Database
  const { data: jobPage, isLoading } = usePublicJobSearch({
    page: 1,
    pageSize: 24,
  });

  const rawJobs: Job[] = useMemo(() => jobPage?.items ?? [], [jobPage]);

  const scrollPills = (offset: number) => {
    if (pillsRef.current) {
      pillsRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Lọc danh sách việc làm dựa trên bộ lọc đã chọn
  const filteredJobs = useMemo(() => {
    return rawJobs.filter((job) => {
      if (selectedPill === 'ALL') return true;

      if (filterType === 'LOCATION') {
        const loc = (job.location || '').toLowerCase();
        if (selectedPill === 'HN') return loc.includes('hà nội') || loc.includes('hn');
        if (selectedPill === 'HCM') return loc.includes('hồ chí minh') || loc.includes('hcm') || loc.includes('sài gòn');
        if (selectedPill === 'NORTH') return loc.includes('hà nội') || loc.includes('bắc ninh') || loc.includes('hải phòng') || loc.includes('hưng yên');
        if (selectedPill === 'SOUTH') return loc.includes('hồ chí minh') || loc.includes('bình dương') || loc.includes('đồng nai') || loc.includes('tây ninh');
        if (selectedPill === 'DN') return loc.includes('đà nẵng');
        if (selectedPill === 'REMOTE') return loc.includes('remote') || loc.includes('toàn quốc');
      }

      if (filterType === 'SALARY') {
        if (selectedPill === 'NEGOTIABLE') return Boolean(job.salaryNegotiable);
        const min = job.salaryMin ?? 0;
        const max = job.salaryMax ?? min;
        if (selectedPill === 'UNDER_10') return max < 10000000;
        if (selectedPill === '10_15') return min >= 10000000 && max <= 15000000;
        if (selectedPill === '15_20') return min >= 15000000 && max <= 20000000;
        if (selectedPill === '20_30') return min >= 20000000 && max <= 30000000;
        if (selectedPill === 'OVER_30') return max >= 30000000 || min >= 30000000;
      }

      if (filterType === 'EXPERIENCE') {
        const exp = job.minExperienceYears ?? 0;
        if (selectedPill === 'NO_EXP') return exp === 0;
        if (selectedPill === 'UNDER_1') return exp > 0 && exp < 1;
        if (selectedPill === '1_3') return exp >= 1 && exp <= 3;
        if (selectedPill === '3_5') return exp >= 3 && exp <= 5;
        if (selectedPill === 'OVER_5') return exp >= 5;
      }

      if (filterType === 'CATEGORY') {
        const text = `${job.title} ${job.company?.industry || ''} ${(job.skills || []).map((s) => s.skillName).join(' ')}`.toLowerCase();
        if (selectedPill === 'IT') return text.match(/it|công nghệ|software|developer|devops|data|frontend|backend/i);
        if (selectedPill === 'SALES') return text.match(/sales|kinh doanh|bán hàng|phát triển thị trường/i);
        if (selectedPill === 'MARKETING') return text.match(/marketing|truyền thông|pr|quảng cáo|content/i);
        if (selectedPill === 'FINANCE') return text.match(/tài chính|kế toán|ngân hàng|kiểm toán/i);
        if (selectedPill === 'HR') return text.match(/nhân sự|tuyển dụng|hành chính|hr/i);
      }

      return true;
    });
  }, [rawJobs, filterType, selectedPill]);

  const formatSalary = (job: Job): string => {
    if (job.salaryNegotiable) return 'Thoả thuận';
    if (job.salaryMin && job.salaryMax) {
      const minM = Math.round(job.salaryMin / 1000000);
      const maxM = Math.round(job.salaryMax / 1000000);
      return `${minM} - ${maxM} triệu`;
    }
    if (job.salaryMin) {
      return `Từ ${Math.round(job.salaryMin / 1000000)} triệu`;
    }
    return 'Lương hấp dẫn';
  };

  const formatLocation = (loc?: string | null): string => {
    if (!loc) return 'Toàn quốc';
    if (loc.toLowerCase().includes('hồ chí minh') || loc.toLowerCase().includes('hcm')) return 'Hồ Chí Minh';
    if (loc.toLowerCase().includes('hà nội') || loc.toLowerCase().includes('hn')) return 'Hà Nội';
    if (loc.toLowerCase().includes('đà nẵng')) return 'Đà Nẵng';
    if (loc.toLowerCase().includes('bắc ninh')) return 'Bắc Ninh';
    if (loc.toLowerCase().includes('bình dương')) return 'Bình Dương';
    if (loc.toLowerCase().includes('tây ninh')) return 'Tây Ninh';
    return loc.length > 15 ? `${loc.slice(0, 15)}...` : loc;
  };

  const handleToggleSave = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    toggleSave(job.jobId, job.title);
  };

  const currentPills = FILTER_CATEGORY_MAP[filterType].pills;

  return (
    <section className="bg-white py-8 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ================================================================= */}
        {/* 1. THANH LỌC CHUẨN TOPCV (HÌNH 1)                                */}
        {/* ================================================================= */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
          {/* Dropdown "Lọc theo: [Tiêu chí]" */}
          <div className="relative inline-flex items-center shrink-0">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as FilterCategory);
                setSelectedPill('ALL');
              }}
              aria-label="Chọn nhóm tiêu chí lọc"
              className="appearance-none bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-xl pl-8 pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs transition-colors"
            >
              <option value="LOCATION">Lọc theo: Địa điểm</option>
              <option value="SALARY">Lọc theo: Mức lương</option>
              <option value="EXPERIENCE">Lọc theo: Kinh nghiệm</option>
              <option value="CATEGORY">Lọc theo: Ngành nghề</option>
            </select>
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
          </div>

          {/* Dải Pill điều hướng ngang với 2 nút < và > */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button
              type="button"
              aria-label="Cuộn sang trái"
              onClick={() => scrollPills(-180)}
              className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={pillsRef}
              className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 scroll-smooth"
            >
              {currentPills.map((pill) => {
                const isActive = selectedPill === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedPill(pill.id)}
                    className={`px-4 py-1.5 rounded-full text-xs whitespace-nowrap transition-all cursor-pointer border-0 ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Cuộn sang phải"
              onClick={() => scrollPills(180)}
              className="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. BANNER GỢI Ý CHUẨN TOPCV (HÌNH 1)                              */}
        {/* ================================================================= */}
        {showHint && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-200/80 bg-[#eef7ff] px-3.5 py-2 text-xs text-blue-900 shadow-2xs">
            <span className="flex items-center gap-2">
              <span className="text-sm">💡</span>
              <span>
                <strong className="font-bold">Gợi ý:</strong> Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết
              </span>
            </span>
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setShowHint(false)}
              className="text-blue-500 hover:text-blue-700 bg-transparent border-0 cursor-pointer p-0 text-xs font-bold leading-none ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. TRẠNG THÁI LOADING / EMPTY                                     */}
        {/* ================================================================= */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs animate-pulse flex flex-col justify-between h-[120px]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <div className="h-4 bg-slate-100 rounded w-16" />
                    <div className="h-4 bg-slate-100 rounded w-16" />
                  </div>
                  <div className="w-6 h-6 rounded-full bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredJobs.length === 0 && (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center my-4">
            <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800 m-0">
              Không tìm thấy việc làm phù hợp với tiêu chí lọc này
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Vui lòng thử chọn tiêu chí khác hoặc khám phá toàn bộ tin tuyển dụng.
            </p>
            <button
              type="button"
              onClick={() => setSelectedPill('ALL')}
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer border-0 shadow-xs"
            >
              Xem tất cả việc làm ngẫu nhiên
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* 4. LƯỚI VIỆC LÀM 3 CỘT CHUẨN TOPCV (HÌNH 1)                       */}
        {/* ================================================================= */}
        {!isLoading && filteredJobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredJobs.map((job, idx) => {
              const saved = isSaved(job.jobId);
              const isUrgent = idx % 4 === 0 || job.title.toLowerCase().includes('gấp');
              const isHot = idx % 3 === 1;

              return (
                <div
                  key={job.jobId}
                  onClick={() => navigate(`/jobs/${job.jobId}`)}
                  className="bg-white rounded-xl p-3.5 border border-slate-200/90 hover:border-blue-500 hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer relative"
                >
                  <div>
                    {/* Hàng trên: Logo bên trái, Tiêu đề + Công ty bên phải */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg border border-slate-200/80 p-0.5 bg-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                        <CompanyLogo
                          id={job.companyId || 'company'}
                          name={job.companyName || 'Doanh nghiệp'}
                          logoUrl={job.companyLogoUrl || job.company?.logoUrl}
                          size={44}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 line-clamp-1">
                          {isUrgent && (
                            <span className="bg-[#f27420] text-white font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0 leading-tight">
                              GẤP
                            </span>
                          )}
                          {isHot && !isUrgent && (
                            <span className="bg-blue-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5 leading-tight">
                              ⚡ HOT
                            </span>
                          )}
                          <h3
                            className="font-bold text-[13.5px] text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 m-0 leading-snug"
                            title={job.title}
                          >
                            {job.title}
                          </h3>
                        </div>

                        <p
                          className="text-[11.5px] text-slate-500 uppercase line-clamp-1 mt-1 m-0 font-medium tracking-tight"
                          title={job.companyName || 'CÔNG TY TNHH ĐỐI TÁC'}
                        >
                          {job.companyName || 'CÔNG TY TNHH ĐỐI TÁC'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hàng dưới: Lương pill, Địa điểm pill và Nút lưu việc làm hình trái tim */}
                  <div className="mt-3 pt-2.5 flex items-center justify-between gap-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="text-[11.5px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                        {formatSalary(job)}
                      </span>
                      <span className="text-[11.5px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[130px]">
                        {formatLocation(job.location)}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label="Lưu việc làm"
                      onClick={(e) => handleToggleSave(e, job)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer border shrink-0 ${
                        saved
                          ? 'text-rose-500 bg-rose-50 border-rose-200'
                          : 'text-slate-400 border-slate-200 hover:border-blue-500 hover:text-blue-600 bg-white'
                      }`}
                      title={saved ? 'Đã lưu việc làm' : 'Lưu việc làm'}
                    >
                      <Heart
                        className="h-3.5 w-3.5"
                        fill={saved ? 'currentColor' : 'none'}
                        strokeWidth={2}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Nút Xem tất cả việc làm */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
          >
            <span>Khám phá thêm các việc làm hấp dẫn khác</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobsGrid;
