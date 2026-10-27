/**
 * @file PublicJobSplitDiscovery.tsx
 * @description Trang tìm việc làm nâng cao chuẩn TopCV (Hình 2):
 * - Thanh tìm kiếm Brand Green trên đầu (Danh mục nghề, Từ khóa với nút xóa, Địa điểm, Nút Tìm kiếm, Quick links tỉnh thành).
 * - Bố cục 2 cột:
 *   + Cột trái: Bộ lọc nâng cao (Sidebar "Lọc nâng cao" với Nghỉ thứ 7 AI, Danh mục nghề kèm số lượng, Mức lương, Kinh nghiệm, Cấp bậc, Hình thức làm việc).
 *   + Cột phải: Thanh tùy chọn tìm kiếm theo (Tên việc làm / Tên công ty / Cả hai) & Sắp xếp (Search by AI...), kèm danh sách thẻ việc làm ngang to bản, hiển thị Logo lớn, Tên việc làm, Badge xác thực, Tên công ty, Thẻ địa điểm/kinh nghiệm, Mức lương xanh lá và Nút lưu tin.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Briefcase,
  Heart,
  CheckCircle2,
  Filter,
  RotateCcw,
  Star,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';
import { message } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { Navbar } from '@/features/landing/components/Navbar';
import { CompanyLogo } from '@/features/landing/components/CompanyLogo';
import { usePublicJobSearch } from './useJobQueries';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import type { Job } from '@/types/api/jobs';

dayjs.extend(relativeTime);
dayjs.locale('vi');

// ── Dropdown Options ────────────────────────────────────────────────────────
export const LOCATION_OPTIONS = [
  { value: 'ALL', label: 'Tất cả địa điểm' },
  { value: 'HN', label: 'Hà Nội' },
  { value: 'HCM', label: 'Hồ Chí Minh' },
  { value: 'DN', label: 'Đà Nẵng' },
  { value: 'BN', label: 'Bắc Ninh' },
  { value: 'BD', label: 'Bình Dương' },
  { value: 'HP', label: 'Hải Phòng' },
  { value: 'REMOTE', label: 'Toàn quốc / Remote' },
];

export const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'Tất cả danh mục nghề', count: 4276 },
  { value: 'DESIGN', label: 'Thiết kế và Kiến trúc', count: 987 },
  { value: 'CONSTRUCTION', label: 'Quản lý dự án xây dựng', count: 674 },
  { value: 'MECHANICAL', label: 'Thiết kế / Chế tạo máy', count: 668 },
  { value: 'ELECTRICAL', label: 'Điện / Tự động hoá', count: 560 },
  { value: 'SAFETY', label: 'An toàn lao động / Môi trường', count: 132 },
  { value: 'IT', label: 'Công nghệ Thông tin', count: 1240 },
  { value: 'SALES', label: 'Kinh doanh / Bán hàng', count: 850 },
  { value: 'MARKETING', label: 'Marketing / PR / Quảng cáo', count: 520 },
  { value: 'FINANCE', label: 'Tài chính / Kế toán / Ngân hàng', count: 430 },
  { value: 'HR', label: 'Nhân sự / Hành chính', count: 310 },
];

export const SALARY_OPTIONS = [
  { value: 'ALL', label: 'Tất cả mức lương' },
  { value: 'UNDER_10', label: 'Dưới 10 triệu' },
  { value: '10_15', label: '10 - 15 triệu' },
  { value: '15_20', label: '15 - 20 triệu' },
  { value: '20_30', label: '20 - 30 triệu' },
  { value: 'OVER_30', label: 'Trên 30 triệu' },
  { value: 'NEGOTIABLE', label: 'Thoả thuận' },
];

export const EXPERIENCE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả kinh nghiệm' },
  { value: 'NO_EXP', label: 'Chưa có kinh nghiệm' },
  { value: 'UNDER_1', label: 'Dưới 1 năm' },
  { value: '1_2', label: '1 - 2 năm' },
  { value: '2_3', label: '2 - 3 năm' },
  { value: '3_5', label: '3 - 5 năm' },
  { value: 'OVER_5', label: 'Trên 5 năm' },
];

export const LEVEL_OPTIONS = [
  { value: 'ALL', label: 'Tất cả cấp bậc' },
  { value: 'STAFF', label: 'Nhân viên' },
  { value: 'LEAD', label: 'Trưởng nhóm' },
  { value: 'MANAGER', label: 'Trưởng phòng / Quản lý' },
  { value: 'DIRECTOR', label: 'Giám đốc' },
  { value: 'INTERN', label: 'Thực tập sinh' },
];

export const WORK_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả hình thức' },
  { value: 'FULL_TIME', label: 'Toàn thời gian' },
  { value: 'PART_TIME', label: 'Bán thời gian' },
  { value: 'REMOTE', label: 'Làm việc từ xa (Remote)' },
];

export const SATURDAY_OPTIONS = [
  { value: 'ALL', label: 'Không lọc' },
  { value: 'SATURDAY_WORK', label: 'Làm thứ 7' },
  { value: 'SATURDAY_OFF', label: 'Nghỉ thứ 7' },
  { value: 'NOT_MENTIONED', label: 'Tin đăng không đề cập' },
];

export const PublicJobSplitDiscovery: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedJobs();

  // Params từ URL
  const queryKeyword = searchParams.get('keyword') || '';
  const queryLocation = searchParams.get('location') || 'ALL';
  const queryCategory = searchParams.get('category') || 'ALL';
  const querySalary = searchParams.get('salary') || 'ALL';
  const queryExperience = searchParams.get('experience') || 'ALL';
  const queryLevel = searchParams.get('level') || 'ALL';
  const querySaturday = searchParams.get('saturday') || 'ALL';
  const queryWorkType = searchParams.get('workType') || 'ALL';

  // Local Search Input States
  const [keywordInput, setKeywordInput] = useState(queryKeyword);
  const [locationSelect, setLocationSelect] = useState(queryLocation);
  const [categorySelect, setCategorySelect] = useState(queryCategory);

  // Search Field: 'TITLE' | 'COMPANY' | 'ALL'
  const [searchField, setSearchField] = useState<'TITLE' | 'COMPANY' | 'ALL'>('TITLE');
  // Sort: 'AI' | 'NEWEST' | 'SALARY' | 'URGENT'
  const [sortBy, setSortBy] = useState<string>('AI');
  // Show more categories toggle in sidebar
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Đồng bộ URL khi đổi query param từ ngoài
  useEffect(() => {
    setKeywordInput(queryKeyword);
    setLocationSelect(queryLocation);
    setCategorySelect(queryCategory);
  }, [queryKeyword, queryLocation, queryCategory]);

  // Gọi API lấy việc làm công khai
  const { data: jobPage, isLoading } = usePublicJobSearch({
    page: 1,
    pageSize: 50,
  });

  const rawJobs: Job[] = useMemo(() => jobPage?.items ?? [], [jobPage]);

  // Cập nhật URL Query
  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (!val || val === 'ALL' || val === '') {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    setSearchParams(params);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateParams({
      keyword: keywordInput.trim() || null,
      location: locationSelect,
      category: categorySelect,
    });
  };

  const handleResetFilters = () => {
    setKeywordInput('');
    setLocationSelect('ALL');
    setCategorySelect('ALL');
    setSearchParams(new URLSearchParams());
    void message.info('Đã xóa toàn bộ bộ lọc');
  };

  const handleSaveFilterAlert = () => {
    void message.success('Đã lưu tiêu chí lọc vào tài khoản của bạn!');
  };

  // Lọc kết quả tìm kiếm đa tiêu chí
  const filteredJobs = useMemo(() => {
    return rawJobs.filter((job) => {
      // 1. Keyword search (theo Tên việc làm, Tên công ty hoặc Cả hai)
      if (queryKeyword.trim()) {
        const kw = queryKeyword.toLowerCase().trim();
        const matchTitle = job.title.toLowerCase().includes(kw);
        const matchCompany = (job.companyName || '').toLowerCase().includes(kw);
        const matchSkills = (job.skills || []).some((s) => (s.skillName || '').toLowerCase().includes(kw));

        if (searchField === 'TITLE' && !matchTitle && !matchSkills) return false;
        if (searchField === 'COMPANY' && !matchCompany) return false;
        if (searchField === 'ALL' && !matchTitle && !matchCompany && !matchSkills) return false;
      }

      // 2. Location
      if (queryLocation !== 'ALL') {
        const loc = (job.location || '').toLowerCase();
        if (queryLocation === 'HN' && !loc.includes('hà nội') && !loc.includes('hn')) return false;
        if (queryLocation === 'HCM' && !loc.includes('hồ chí minh') && !loc.includes('hcm')) return false;
        if (queryLocation === 'DN' && !loc.includes('đà nẵng')) return false;
        if (queryLocation === 'BN' && !loc.includes('bắc ninh')) return false;
        if (queryLocation === 'BD' && !loc.includes('bình dương')) return false;
        if (queryLocation === 'HP' && !loc.includes('hải phòng')) return false;
        if (queryLocation === 'REMOTE' && !loc.includes('remote') && !loc.includes('toàn quốc')) return false;
      }

      // 3. Category
      if (queryCategory !== 'ALL') {
        const fullText = `${job.title} ${job.company?.industry || ''} ${(job.skills || []).map((s) => s.skillName).join(' ')}`.toLowerCase();
        if (queryCategory === 'DESIGN' && !fullText.match(/thiết kế|kiến trúc|design|autocad|revit|3d|2d|animator/i)) return false;
        if (queryCategory === 'CONSTRUCTION' && !fullText.match(/xây dựng|dự án|kỹ sư hạ tầng|công trình|giao thông/i)) return false;
        if (queryCategory === 'MECHANICAL' && !fullText.match(/cơ khí|chế tạo|máy|mep|khí cụ/i)) return false;
        if (queryCategory === 'ELECTRICAL' && !fullText.match(/điện|tự động hoá|plc|scada|điện tử/i)) return false;
        if (queryCategory === 'IT' && !fullText.match(/it|công nghệ|software|developer|frontend|backend/i)) return false;
        if (queryCategory === 'SALES' && !fullText.match(/kinh doanh|bán hàng|sales|thương mại/i)) return false;
        if (queryCategory === 'MARKETING' && !fullText.match(/marketing|pr|quảng cáo|truyền thông/i)) return false;
        if (queryCategory === 'FINANCE' && !fullText.match(/tài chính|kế toán|thuế|ngân hàng/i)) return false;
        if (queryCategory === 'HR' && !fullText.match(/nhân sự|tuyển dụng|hành chính|c&b/i)) return false;
      }

      // 4. Salary
      if (querySalary !== 'ALL') {
        if (querySalary === 'NEGOTIABLE') return Boolean(job.salaryNegotiable);
        const min = job.salaryMin ?? 0;
        const max = job.salaryMax ?? min;
        if (querySalary === 'UNDER_10' && max >= 10000000) return false;
        if (querySalary === '10_15' && (min > 15000000 || max < 10000000)) return false;
        if (querySalary === '15_20' && (min > 20000000 || max < 15000000)) return false;
        if (querySalary === '20_30' && (min > 30000000 || max < 20000000)) return false;
        if (querySalary === 'OVER_30' && max < 30000000) return false;
      }

      // 5. Experience
      if (queryExperience !== 'ALL') {
        const exp = job.minExperienceYears ?? 0;
        if (queryExperience === 'NO_EXP' && exp > 0) return false;
        if (queryExperience === 'UNDER_1' && (exp <= 0 || exp >= 1)) return false;
        if (queryExperience === '1_2' && (exp < 1 || exp > 2)) return false;
        if (queryExperience === '2_3' && (exp < 2 || exp > 3)) return false;
        if (queryExperience === '3_5' && (exp < 3 || exp > 5)) return false;
        if (queryExperience === 'OVER_5' && exp < 5) return false;
      }

      // 6. Saturday
      if (querySaturday !== 'ALL') {
        const text = `${job.description || ''} ${job.workingTime || ''}`.toLowerCase();
        if (querySaturday === 'SATURDAY_OFF' && !text.includes('nghỉ thứ 7') && !text.includes('từ thứ 2 đến thứ 6')) return false;
        if (querySaturday === 'SATURDAY_WORK' && !text.includes('thứ 7') && !text.includes('saturday')) return false;
      }

      return true;
    });
  }, [rawJobs, queryKeyword, queryLocation, queryCategory, querySalary, queryExperience, querySaturday, searchField]);

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

  const visibleCategories = showAllCategories ? CATEGORY_OPTIONS : CATEGORY_OPTIONS.slice(1, 6);

  return (
    <div className="min-h-screen bg-[#F4F5F5] text-slate-900 font-sans">
      {/* 1. TOP NAVBAR */}
      <Navbar />

      {/* =================================================================== */}
      {/* 2. KHỐI TÌM KIẾM BRAND THEME HRCONNECT                             */}
      {/* =================================================================== */}
      <section className="bg-gradient-to-r from-[#0C4A6E] via-[#075985] to-[#0284c7] py-5 px-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Thanh tìm kiếm tổng hợp: Danh mục nghề | Input từ khóa | Địa điểm | Nút Tìm kiếm */}
          <form
            onSubmit={handleSearchSubmit}
            className="bg-white rounded-xl p-1.5 shadow-md flex flex-col md:flex-row items-stretch md:items-center gap-1.5 md:gap-2 border border-sky-200/50"
          >
            {/* Dropdown Danh mục nghề */}
            <div className="relative flex items-center px-3 py-1.5 md:w-[220px] shrink-0">
              <SlidersHorizontal className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
              <select
                value={categorySelect}
                onChange={(e) => setCategorySelect(e.target.value)}
                aria-label="Chọn danh mục nghề"
                className="w-full bg-transparent border-0 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer appearance-none truncate pr-4"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
            </div>

            <div className="hidden md:block w-px h-6 bg-slate-200 shrink-0" />

            {/* Ô nhập từ khóa công việc có nút Xóa nhanh */}
            <div className="relative flex items-center flex-1 px-3 py-1.5">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Vị trí tuyển dụng, tên công ty, kỹ năng..."
                className="w-full bg-transparent border-0 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              {keywordInput && (
                <button
                  type="button"
                  aria-label="Xóa từ khóa"
                  onClick={() => setKeywordInput('')}
                  className="text-slate-400 hover:text-slate-600 bg-transparent border-0 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="hidden md:block w-px h-6 bg-slate-200 shrink-0" />

            {/* Dropdown Địa điểm */}
            <div className="relative flex items-center px-3 py-1.5 md:w-[190px] shrink-0">
              <MapPin className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
              <select
                value={locationSelect}
                onChange={(e) => setLocationSelect(e.target.value)}
                aria-label="Chọn địa điểm"
                className="w-full bg-transparent border-0 text-xs sm:text-sm font-semibold text-slate-700 focus:outline-none cursor-pointer appearance-none truncate pr-4"
              >
                {LOCATION_OPTIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>
                    {loc.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Nút Tìm kiếm Xanh Primary HRConnect */}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-7 py-2.5 rounded-lg transition-colors cursor-pointer border-0 shadow-xs whitespace-nowrap active:scale-[0.98]"
            >
              Tìm kiếm
            </button>
          </form>

          {/* Dải liên kết nhanh theo tỉnh thành (Breadcrumb / Quick tags) */}
          <div className="text-xs text-white/95 mt-2.5 flex flex-wrap items-center gap-1.5 font-medium">
            <span>Xem việc làm &ldquo;{queryKeyword || 'tuyển dụng'}&rdquo; tại</span>
            <button
              type="button"
              onClick={() => updateParams({ location: 'HN' })}
              className={`hover:underline bg-transparent border-0 p-0 text-white cursor-pointer font-semibold ${queryLocation === 'HN' ? 'underline font-bold' : ''}`}
            >
              Hà Nội
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => updateParams({ location: 'HCM' })}
              className={`hover:underline bg-transparent border-0 p-0 text-white cursor-pointer font-semibold ${queryLocation === 'HCM' ? 'underline font-bold' : ''}`}
            >
              Hồ Chí Minh
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => updateParams({ location: 'ALL' })}
              className="hover:underline bg-transparent border-0 p-0 text-white/90 cursor-pointer inline-flex items-center gap-1"
            >
              <span>Chọn tỉnh thành của tôi</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. BỐ CỤC 2 CỘT CHUẨN TOPCV (HÌNH 2)                                 */}
      {/* =================================================================== */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* CỘT TRÁI (3.5 CỘT / ~28%): BỘ LỌC NÂNG CAO (FILLS KẾ BÊN)          */}
        {/* ================================================================= */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-5">
            {/* Header Lọc nâng cao */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Filter className="w-4 h-4 text-blue-600" />
                <span>Lọc nâng cao</span>
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-semibold text-slate-400 hover:text-red-500 bg-transparent border-0 cursor-pointer p-0"
              >
                Xóa tất cả
              </button>
            </div>

            {/* ── 1. Nghỉ thứ 7 (AI ✨) ── */}
            <div>
              <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                <span>Nghỉ thứ 7</span>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200/60 inline-flex items-center gap-0.5">
                  AI ✨
                </span>
              </div>
              <div className="space-y-2">
                {SATURDAY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600"
                  >
                    <input
                      type="radio"
                      name="saturday"
                      checked={querySaturday === opt.value}
                      onChange={() => updateParams({ saturday: opt.value })}
                      className="accent-blue-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 2. Theo danh mục nghề (Checkboxes kèm count) ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2.5">Theo danh mục nghề</div>
              <div className="space-y-2">
                {visibleCategories.map((cat) => {
                  const isChecked = queryCategory === cat.value;
                  return (
                    <label
                      key={cat.value}
                      className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => updateParams({ category: isChecked ? 'ALL' : cat.value })}
                          className="accent-blue-600 rounded cursor-pointer"
                        />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <span className="text-[11px] text-slate-400">({cat.count})</span>
                    </label>
                  );
                })}
              </div>

              {/* Xem thêm / Thu gọn danh mục */}
              <button
                type="button"
                onClick={() => setShowAllCategories(!showAllCategories)}
                className="mt-2 text-xs font-semibold text-blue-600 hover:underline bg-transparent border-0 p-0 flex items-center gap-1 cursor-pointer"
              >
                <span>{showAllCategories ? 'Thu gọn' : 'Xem thêm'}</span>
                {showAllCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {/* Nút Xóa lọc & Lưu bộ lọc */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => updateParams({ category: 'ALL' })}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer p-0"
                >
                  Xóa lọc
                </button>
                <button
                  type="button"
                  onClick={handleSaveFilterAlert}
                  className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-1.5 rounded-full font-bold shadow-2xs transition-colors cursor-pointer border-0"
                >
                  <Star className="w-3 h-3 fill-current" />
                  <span>Lưu bộ lọc</span>
                </button>
              </div>
            </div>

            {/* ── 3. Mức lương ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2.5">Mức lương</div>
              <div className="space-y-2">
                {SALARY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600"
                  >
                    <input
                      type="radio"
                      name="salary"
                      checked={querySalary === opt.value}
                      onChange={() => updateParams({ salary: opt.value })}
                      className="accent-blue-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 4. Kinh nghiệm ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2.5">Kinh nghiệm</div>
              <div className="space-y-2">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600"
                  >
                    <input
                      type="radio"
                      name="experience"
                      checked={queryExperience === opt.value}
                      onChange={() => updateParams({ experience: opt.value })}
                      className="accent-blue-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 5. Cấp bậc ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2.5">Cấp bậc</div>
              <div className="space-y-2">
                {LEVEL_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600"
                  >
                    <input
                      type="radio"
                      name="level"
                      checked={queryLevel === opt.value}
                      onChange={() => updateParams({ level: opt.value })}
                      className="accent-blue-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 6. Hình thức làm việc ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2.5">Hình thức làm việc</div>
              <div className="space-y-2">
                {WORK_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-blue-600"
                  >
                    <input
                      type="radio"
                      name="workType"
                      checked={queryWorkType === opt.value}
                      onChange={() => updateParams({ workType: opt.value })}
                      className="accent-blue-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ================================================================= */}
        {/* CỘT PHẢI (8.5 CỘT / ~72%): DANH SÁCH VIỆC LÀM NGANG (HÌNH 2)       */}
        {/* ================================================================= */}
        <section className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Thanh Control: Tìm kiếm theo + Sắp xếp theo */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
            {/* Tìm kiếm theo: Tên việc làm | Tên công ty | Cả hai */}
            <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
              <span className="font-semibold text-slate-700">Tìm kiếm theo:</span>
              <button
                type="button"
                onClick={() => setSearchField('TITLE')}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer border ${
                  searchField === 'TITLE'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                {searchField === 'TITLE' ? '✓ ' : ''}Tên việc làm
              </button>
              <button
                type="button"
                onClick={() => setSearchField('COMPANY')}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer border ${
                  searchField === 'COMPANY'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                {searchField === 'COMPANY' ? '✓ ' : ''}Tên công ty
              </button>
              <button
                type="button"
                onClick={() => setSearchField('ALL')}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer border ${
                  searchField === 'ALL'
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                {searchField === 'ALL' ? '✓ ' : ''}Cả hai
              </button>
            </div>

            {/* Sắp xếp theo: Search by AI */}
            <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
              <span className="font-semibold text-slate-700">⇅ Sắp xếp theo:</span>
              <div className="relative inline-flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sắp xếp kết quả tìm kiếm"
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="AI">Search by AI</option>
                  <option value="NEWEST">Mới nhất</option>
                  <option value="SALARY">Lương cao nhất</option>
                  <option value="URGENT">Cần tuyển gấp</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Dòng thông báo số lượng tìm thấy */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Tìm thấy <strong className="text-slate-900 font-bold">{filteredJobs.length}</strong> việc làm phù hợp
              {queryKeyword ? (
                <> cho từ khóa &ldquo;<strong className="text-blue-600">{queryKeyword}</strong>&rdquo;</>
              ) : ''}
            </span>
            <span className="text-slate-400">Ưu tiên hiển thị tin tuyển dụng xác thực</span>
          </div>

          {/* Trạng thái Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3.5">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs animate-pulse flex items-start gap-4"
                >
                  <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-5 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                    <div className="h-4 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trạng thái Rỗng */}
          {!isLoading && filteredJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center my-4 shadow-2xs">
              <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 m-0">
                Không tìm thấy việc làm nào phù hợp với bộ lọc hiện tại
              </h3>
              <p className="text-xs text-slate-500 mt-1 mb-5">
                Vui lòng thử bỏ bớt điều kiện lọc ở cột bên trái hoặc tìm kiếm từ khóa khác.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer border-0 shadow-xs inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ bộ lọc</span>
              </button>
            </div>
          )}

          {/* Danh sách thẻ việc làm ngang chuẩn TopCV (Hình 2) */}
          {!isLoading && filteredJobs.length > 0 && (
            <div className="space-y-3.5">
              {filteredJobs.map((job) => {
                const saved = isSaved(job.jobId);
                const postedText = job.createdAt ? dayjs(job.createdAt).fromNow() : 'Đăng gần đây';

                return (
                  <div
                    key={job.jobId}
                    onClick={() => navigate(`/jobs/${job.jobId}`)}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-500 hover:shadow-md p-4 transition-all flex flex-col sm:flex-row items-start gap-4 cursor-pointer relative group"
                  >
                    {/* Logo doanh nghiệp lớn bên trái */}
                    <div className="w-20 h-20 rounded-xl border border-slate-200/80 p-2 bg-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                      <CompanyLogo
                        id={job.companyId || 'company'}
                        name={job.companyName || 'Doanh nghiệp'}
                        size={64}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Khối thông tin trung tâm */}
                    <div className="flex-1 min-w-0">
                      {/* Tiêu đề việc làm + Huy hiệu xác thực */}
                      <div className="flex items-center gap-1.5">
                        <h3
                          className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 m-0 leading-tight"
                          title={job.title}
                        >
                          {job.title}
                        </h3>
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 fill-blue-50" />
                      </div>

                      {/* Tên công ty viết hoa */}
                      <p
                        className="text-xs font-semibold text-slate-500 uppercase mt-1.5 line-clamp-1 m-0 tracking-tight"
                        title={job.companyName || 'CÔNG TY TNHH ĐỐI TÁC'}
                      >
                        {job.companyName || 'CÔNG TY CỔ PHẦN ĐỐI TÁC HR CONNECT'}
                      </p>

                      {/* Dải Tags: Địa điểm & Kinh nghiệm */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded font-medium">
                          {job.location || 'Toàn quốc'}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded font-medium">
                          {job.minExperienceYears ? `${job.minExperienceYears} năm` : 'Không yêu cầu KN'}
                        </span>
                      </div>

                      {/* Dải kỹ năng / thông tin mở rộng */}
                      <div className="text-xs text-slate-400 mt-2 line-clamp-1 font-normal">
                        {(job.skills || []).map((s) => s.skillName).filter(Boolean).slice(0, 3).join(' | ') ||
                          `${job.employmentType || 'Toàn thời gian'} | Phỏng vấn nhanh | Môi trường chuyên nghiệp`}
                      </div>
                    </div>

                    {/* Khối bên phải: Mức lương + Ngày đăng + Nút lưu tin */}
                    <div className="shrink-0 flex sm:flex-col justify-between sm:items-end w-full sm:w-auto sm:h-full sm:min-h-[80px] mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                      {/* Mức lương nổi bật */}
                      <span className="font-bold text-base text-blue-600 whitespace-nowrap">
                        {formatSalary(job)}
                      </span>

                      {/* Ngày đăng & Nút Heart */}
                      <div className="flex items-center gap-2 mt-auto">
                        <span className="text-xs text-slate-400 font-normal">
                          {postedText}
                        </span>
                        <button
                          type="button"
                          aria-label="Lưu việc làm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSave(job.jobId, job.title);
                          }}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                            saved
                              ? 'text-rose-500 bg-rose-50 border-rose-200'
                              : 'text-slate-400 border-slate-200 hover:border-blue-500 hover:text-blue-600 bg-white'
                          }`}
                          title={saved ? 'Đã lưu việc làm' : 'Lưu việc làm'}
                        >
                          <Heart
                            className="h-4 w-4"
                            fill={saved ? 'currentColor' : 'none'}
                            strokeWidth={1.8}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default PublicJobSplitDiscovery;
