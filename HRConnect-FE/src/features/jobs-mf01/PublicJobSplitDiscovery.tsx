/**
 * @file PublicJobSplitDiscovery.tsx
 * @description Trang tìm việc làm nâng cao chuẩn TopCV (Hình 3):
 * - Thanh tìm kiếm Brand HRConnect trên đầu (Danh mục nghề, Từ khóa với nút xóa, Địa điểm, Nút Tìm kiếm, Quick links tỉnh thành).
 * - Bố cục 2 cột:
 *   + Cột trái: Bộ lọc nâng cao (Sidebar "Lọc nâng cao"):
 *     * Nghỉ thứ 7 AI.
 *     * Theo danh mục nghề: Tìm kiếm danh mục động theo database thực tế (người dùng điền gì sẽ lọc theo đó, đếm số lượng thực tế từ DB).
 *     * Mức lương.
 *     * Kinh nghiệm: Tối thiểu 1 năm, Tối thiểu 2 năm, Tối thiểu 3 năm, Tối thiểu 5 năm, Không yêu cầu KN.
 *     * Cấp bậc, Hình thức làm việc.
 *   + Cột phải: Khối "Việc làm nổi bật" chuẩn TopCV (Hình 3):
 *     * Tabs: Việc văn phòng, Việc phổ thông, Tất cả.
 *     * Dải Pills lọc nhanh: Lọc theo Địa điểm (Ngẫu nhiên, Hà Nội, TP.HCM, Đà Nẵng, Miền Bắc, Miền Nam, Toàn quốc).
 *     * Banner gợi ý: Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết.
 *     * Lưới thẻ việc làm Card Grid (2-3 cột) chuẩn TopCV kèm nút chuyển đổi xem List / Grid.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  ArrowRight,
  LayoutGrid,
  List as ListIcon,
  Zap,
  Info,
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

export interface BaseCategory {
  value: string;
  label: string;
  keywords: RegExp;
}

export const BASE_CATEGORIES: BaseCategory[] = [
  { value: 'DESIGN', label: 'Thiết kế và Kiến trúc', keywords: /thiết kế|kiến trúc|design|ui\/ux|figma|graphic|nội thất|nhà|bản vẽ|cad|revit|chế tạo/i },
  { value: 'IT', label: 'Công nghệ Thông tin / Phần mềm', keywords: /it|công nghệ|software|developer|engineer|frontend|backend|data|devops|fullstack|python|react|java|system|lập trình/i },
  { value: 'CONSTRUCTION', label: 'Quản lý dự án xây dựng', keywords: /xây dựng|dự án|kỹ sư xây dựng|công trình|hạ tầng|giao thông/i },
  { value: 'MECHANICAL', label: 'Cơ khí / Tự động hoá / Chế tạo máy', keywords: /cơ khí|chế tạo máy|điện|tự động hoá|mep|khí cụ|plc/i },
  { value: 'SALES', label: 'Kinh doanh / Bán hàng', keywords: /kinh doanh|bán hàng|sales|telesales|account|thương mại|phát triển thị trường/i },
  { value: 'MARKETING', label: 'Marketing / PR / Quảng cáo', keywords: /marketing|pr|quảng cáo|truyền thông|content|seo|social|media/i },
  { value: 'FINANCE', label: 'Tài chính / Kế toán / Ngân hàng', keywords: /tài chính|kế toán|thuế|ngân hàng|kiểm toán|audit/i },
  { value: 'HR', label: 'Nhân sự / Tuyển dụng / Hành chính', keywords: /nhân sự|tuyển dụng|hành chính|hr|c&b/i },
  { value: 'OPERATIONS', label: 'Vận hành / Chuỗi cung ứng / Logistics', keywords: /vận hành|logistics|kho|chuỗi cung ứng|operations|kho bãi/i },
  { value: 'SAFETY', label: 'An toàn lao động / Môi trường', keywords: /an toàn lao động|môi trường|hse|bảo hộ/i },
];

// Fallback compatibility
export const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'Tất cả danh mục nghề', count: 0 },
  ...BASE_CATEGORIES.map((c) => ({ value: c.value, label: c.label, count: 0 })),
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

// Updated Experience filter according to requirement: "tối thiểu 1 năm 2 năm"
export const EXPERIENCE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả kinh nghiệm' },
  { value: 'NO_EXP', label: 'Không yêu cầu kinh nghiệm' },
  { value: 'MIN_1', label: 'Tối thiểu 1 năm' },
  { value: 'MIN_2', label: 'Tối thiểu 2 năm' },
  { value: 'MIN_3', label: 'Tối thiểu 3 năm' },
  { value: 'MIN_5', label: 'Tối thiểu 5 năm' },
  { value: 'UNDER_1', label: 'Dưới 1 năm' },
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

export const QUICK_LOCATION_PILLS = [
  { id: 'ALL', label: 'Ngẫu Nhiên' },
  { id: 'HN', label: 'Hà Nội' },
  { id: 'HCM', label: 'Thành phố Hồ Chí Minh (cũ)' },
  { id: 'NORTH', label: 'Miền Bắc' },
  { id: 'SOUTH', label: 'Miền Nam' },
  { id: 'DN', label: 'Đà Nẵng' },
  { id: 'REMOTE', label: 'Toàn quốc / Remote' },
];

export const PublicJobSplitDiscovery: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSaved, toggleSave } = useSavedJobs();
  const pillsRef = useRef<HTMLDivElement>(null);

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

  // Ô tìm kiếm lọc danh mục nghề động bên sidebar trái
  const [categorySearchText, setCategorySearchText] = useState('');
  // Tab phân loại: 'OFFICE' (Việc văn phòng) | 'MANUAL' (Việc phổ thông) | 'ALL' (Tất cả)
  const [jobTypeTab, setJobTypeTab] = useState<'OFFICE' | 'MANUAL' | 'ALL'>('OFFICE');
  // Chế độ hiển thị: 'GRID' (chuẩn TopCV) | 'LIST' (dạng ngang)
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  // Pill địa điểm nhanh chuẩn TopCV
  const [activeLocationPill, setActiveLocationPill] = useState<string>(queryLocation !== 'ALL' ? queryLocation : 'ALL');
  // Banner gợi ý TopCV
  const [showTip, setShowTip] = useState(true);

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
    setActiveLocationPill(queryLocation !== 'ALL' ? queryLocation : 'ALL');
  }, [queryKeyword, queryLocation, queryCategory]);

  // Gọi API lấy việc làm công khai thực tế từ Database
  const { data: jobPage, isLoading } = usePublicJobSearch({
    page: 1,
    pageSize: 50,
  });

  const rawJobs: Job[] = useMemo(() => jobPage?.items ?? [], [jobPage]);

  // Tính toán danh mục nghề ĐỘNG kèm số lượng thực tế từ database
  const dynamicCategories = useMemo(() => {
    return BASE_CATEGORIES.map((cat) => {
      const count = rawJobs.filter((job) => {
        const fullText = `${job.title} ${job.companyName || ''} ${job.company?.industry || ''} ${(job.skills || []).map((s) => s.skillName).join(' ')}`.toLowerCase();
        return cat.keywords.test(fullText);
      }).length;
      return {
        value: cat.value,
        label: cat.label,
        count,
        keywords: cat.keywords,
      };
    });
  }, [rawJobs]);

  // Lọc danh mục hiển thị khi người dùng nhập vào ô tìm kiếm danh mục (VD: "thiết kế")
  const visibleCategories = useMemo(() => {
    const kw = categorySearchText.toLowerCase().trim();
    if (!kw) {
      return showAllCategories ? dynamicCategories : dynamicCategories.slice(0, 5);
    }

    const matched = dynamicCategories.filter(
      (cat) => cat.label.toLowerCase().includes(kw) || cat.keywords.test(kw)
    );

    // Kiểm tra số lượng job thực tế khớp với từ khóa người dùng nhập (VD: "thiết kế nhà")
    const countCustom = rawJobs.filter((job) => {
      const text = `${job.title} ${job.companyName || ''} ${job.company?.industry || ''} ${(job.skills || []).map((s) => s.skillName).join(' ')}`.toLowerCase();
      return text.includes(kw);
    }).length;

    const alreadyExact = matched.some((m) => m.label.toLowerCase() === kw);
    if (!alreadyExact && countCustom > 0) {
      return [
        {
          value: `QUERY_${kw}`,
          label: `Lọc theo: "${categorySearchText.trim()}"`,
          count: countCustom,
          keywords: new RegExp(kw, 'i'),
        },
        ...matched,
      ];
    }

    return matched;
  }, [dynamicCategories, categorySearchText, showAllCategories, rawJobs]);

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
    setCategorySearchText('');
    setActiveLocationPill('ALL');
    setSearchParams(new URLSearchParams());
    void message.info('Đã xóa toàn bộ bộ lọc');
  };

  const handleSaveFilterAlert = () => {
    void message.success('Đã lưu tiêu chí lọc vào tài khoản của bạn!');
  };

  const scrollPills = (offset: number) => {
    if (pillsRef.current) {
      pillsRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Lọc kết quả tìm kiếm đa tiêu chí
  const filteredJobs = useMemo(() => {
    return rawJobs.filter((job) => {
      // 1. Phân loại Tab TopCV: Việc văn phòng vs Việc phổ thông
      const jobDesc = `${job.title} ${job.description || ''} ${job.employmentType || ''}`.toLowerCase();
      const isManual = jobDesc.match(/lao động phổ thông|tạp vụ|bảo vệ|lái xe|phục vụ|giao hàng|shipper|công nhân|phụ kho|thời vụ/i);
      if (jobTypeTab === 'MANUAL' && !isManual) return false;
      if (jobTypeTab === 'OFFICE' && isManual) return false;

      // 2. Keyword search (theo Tên việc làm, Tên công ty hoặc Cả hai)
      if (queryKeyword.trim()) {
        const kw = queryKeyword.toLowerCase().trim();
        const matchTitle = job.title.toLowerCase().includes(kw);
        const matchCompany = (job.companyName || '').toLowerCase().includes(kw);
        const matchSkills = (job.skills || []).some((s) => (s.skillName || '').toLowerCase().includes(kw));

        if (searchField === 'TITLE' && !matchTitle && !matchSkills) return false;
        if (searchField === 'COMPANY' && !matchCompany) return false;
        if (searchField === 'ALL' && !matchTitle && !matchCompany && !matchSkills) return false;
      }

      // 3. Location (từ Dropdown hoặc từ TopCV Quick Pill)
      const targetLocation = activeLocationPill !== 'ALL' ? activeLocationPill : queryLocation;
      if (targetLocation !== 'ALL') {
        const loc = (job.location || '').toLowerCase();
        if (targetLocation === 'HN' && !loc.includes('hà nội') && !loc.includes('hn')) return false;
        if (targetLocation === 'HCM' && !loc.includes('hồ chí minh') && !loc.includes('hcm') && !loc.includes('sài gòn')) return false;
        if (targetLocation === 'DN' && !loc.includes('đà nẵng')) return false;
        if (targetLocation === 'BN' && !loc.includes('bắc ninh')) return false;
        if (targetLocation === 'BD' && !loc.includes('bình dương')) return false;
        if (targetLocation === 'HP' && !loc.includes('hải phòng')) return false;
        if (targetLocation === 'NORTH' && !loc.includes('hà nội') && !loc.includes('bắc ninh') && !loc.includes('hải phòng') && !loc.includes('hưng yên')) return false;
        if (targetLocation === 'SOUTH' && !loc.includes('hồ chí minh') && !loc.includes('bình dương') && !loc.includes('đồng nai')) return false;
        if (targetLocation === 'REMOTE' && !loc.includes('remote') && !loc.includes('toàn quốc')) return false;
      }

      // 4. Category (Lọc danh mục động từ DB hoặc từ khóa tự do do người dùng chọn)
      if (queryCategory !== 'ALL') {
        const fullText = `${job.title} ${job.companyName || ''} ${job.company?.industry || ''} ${(job.skills || []).map((s) => s.skillName).join(' ')}`.toLowerCase();
        if (queryCategory.startsWith('QUERY_')) {
          const customQuery = queryCategory.replace('QUERY_', '').toLowerCase();
          if (!fullText.includes(customQuery)) return false;
        } else {
          const matchedDef = BASE_CATEGORIES.find((c) => c.value === queryCategory);
          if (matchedDef && !matchedDef.keywords.test(fullText)) {
            return false;
          }
        }
      }

      // 5. Salary
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

      // 6. Experience (Tối thiểu 1 năm, 2 năm...)
      if (queryExperience !== 'ALL') {
        const exp = job.minExperienceYears ?? 0;
        if (queryExperience === 'NO_EXP' && exp > 0) return false;
        if (queryExperience === 'MIN_1' && exp < 1) return false;
        if (queryExperience === 'MIN_2' && exp < 2) return false;
        if (queryExperience === 'MIN_3' && exp < 3) return false;
        if (queryExperience === 'MIN_5' && exp < 5) return false;
        if (queryExperience === 'UNDER_1' && (exp <= 0 || exp >= 1)) return false;
      }

      // 7. Saturday
      if (querySaturday !== 'ALL') {
        const text = `${job.description || ''} ${job.workingTime || ''}`.toLowerCase();
        if (querySaturday === 'SATURDAY_OFF' && !text.includes('nghỉ thứ 7') && !text.includes('từ thứ 2 đến thứ 6')) return false;
        if (querySaturday === 'SATURDAY_WORK' && !text.includes('thứ 7') && !text.includes('saturday')) return false;
      }

      return true;
    });
  }, [rawJobs, jobTypeTab, queryKeyword, queryLocation, activeLocationPill, queryCategory, querySalary, queryExperience, querySaturday, searchField]);

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
    return loc.length > 14 ? `${loc.slice(0, 14)}...` : loc;
  };

  const formatExperience = (exp?: number | null): string => {
    if (!exp || exp <= 0) return 'Không yêu cầu KN';
    return `Tối thiểu ${exp} năm`;
  };

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
                <option value="ALL">Tất cả danh mục nghề</option>
                {dynamicCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label} ({cat.count})
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

            {/* Nút Tìm kiếm Primary HRConnect */}
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
              onClick={() => {
                updateParams({ location: 'HN' });
                setActiveLocationPill('HN');
              }}
              className={`hover:underline bg-transparent border-0 p-0 text-white cursor-pointer font-semibold ${queryLocation === 'HN' ? 'underline font-bold' : ''}`}
            >
              Hà Nội
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => {
                updateParams({ location: 'HCM' });
                setActiveLocationPill('HCM');
              }}
              className={`hover:underline bg-transparent border-0 p-0 text-white cursor-pointer font-semibold ${queryLocation === 'HCM' ? 'underline font-bold' : ''}`}
            >
              Hồ Chí Minh
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => {
                updateParams({ location: 'ALL' });
                setActiveLocationPill('ALL');
              }}
              className="hover:underline bg-transparent border-0 p-0 text-white/90 cursor-pointer inline-flex items-center gap-1"
            >
              <span>Chọn tỉnh thành của tôi</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. BỐ CỤC 2 CỘT CHUẨN TOPCV (HÌNH 3)                                 */}
      {/* =================================================================== */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================================================================= */}
        {/* CỘT TRÁI (3.5 CỘT): BỘ LỌC NÂNG CAO (FILLS DYNAMIC THEO DATABASE)  */}
        {/* ================================================================= */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-5">
            {/* Header Lọc nâng cao */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Filter className="w-4 h-4 text-emerald-600" />
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
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200/60 inline-flex items-center gap-0.5">
                  AI ✨
                </span>
              </div>
              <div className="space-y-2">
                {SATURDAY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-emerald-600"
                  >
                    <input
                      type="radio"
                      name="saturday"
                      checked={querySaturday === opt.value}
                      onChange={() => updateParams({ saturday: opt.value })}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 2. Theo danh mục nghề (DYNAMIC THEO DATABASE & TÌM KIẾM TỰ DO) ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                <span>Theo danh mục nghề</span>
                <span className="text-[11px] font-normal text-slate-400">Theo database</span>
              </div>

              {/* Ô nhập tìm nhanh danh mục (VD: thiết kế, kiến trúc) */}
              <div className="relative mb-2.5">
                <input
                  type="text"
                  value={categorySearchText}
                  onChange={(e) => setCategorySearchText(e.target.value)}
                  placeholder="Nhập để tìm danh mục (VD: thiết kế)..."
                  className="w-full text-xs bg-slate-50 border border-slate-200/90 rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:border-emerald-500 text-slate-800 placeholder:text-slate-400"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                {categorySearchText && (
                  <button
                    type="button"
                    onClick={() => setCategorySearchText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer p-0"
                    title="Xóa tìm kiếm danh mục"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Danh sách danh mục động với số lượng job thực tế */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {visibleCategories.map((cat) => {
                  const isChecked = queryCategory === cat.value;
                  return (
                    <label
                      key={cat.value}
                      className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-emerald-600"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => updateParams({ category: isChecked ? 'ALL' : cat.value })}
                          className="accent-emerald-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="truncate">{cat.label}</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">({cat.count})</span>
                    </label>
                  );
                })}

                {visibleCategories.length === 0 && (
                  <div className="text-[11px] text-slate-400 py-2 italic text-center">
                    Không tìm thấy danh mục nào khớp với &ldquo;{categorySearchText}&rdquo;
                  </div>
                )}
              </div>

              {/* Xem thêm / Thu gọn danh mục */}
              {!categorySearchText && dynamicCategories.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="mt-2 text-xs font-semibold text-emerald-600 hover:underline bg-transparent border-0 p-0 flex items-center gap-1 cursor-pointer"
                >
                  <span>{showAllCategories ? 'Thu gọn' : `Xem thêm (${dynamicCategories.length - 5} danh mục)`}</span>
                  {showAllCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              {/* Nút Xóa lọc & Lưu bộ lọc */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    updateParams({ category: 'ALL' });
                    setCategorySearchText('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer p-0"
                >
                  Xóa lọc
                </button>
                <button
                  type="button"
                  onClick={handleSaveFilterAlert}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3.5 py-1.5 rounded-full font-bold shadow-2xs transition-colors cursor-pointer border-0"
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
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-emerald-600"
                  >
                    <input
                      type="radio"
                      name="salary"
                      checked={querySalary === opt.value}
                      onChange={() => updateParams({ salary: opt.value })}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── 4. Kinh nghiệm (ĐÚNG YÊU CẦU: TỐI THIỂU 1 NĂM, 2 NĂM...) ── */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-800 mb-2.5">Kinh nghiệm</div>
              <div className="space-y-2">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-emerald-600"
                  >
                    <input
                      type="radio"
                      name="experience"
                      checked={queryExperience === opt.value}
                      onChange={() => updateParams({ experience: opt.value })}
                      className="accent-emerald-600 cursor-pointer"
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
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-emerald-600"
                  >
                    <input
                      type="radio"
                      name="level"
                      checked={queryLevel === opt.value}
                      onChange={() => updateParams({ level: opt.value })}
                      className="accent-emerald-600 cursor-pointer"
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
                    className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none hover:text-emerald-600"
                  >
                    <input
                      type="radio"
                      name="workType"
                      checked={queryWorkType === opt.value}
                      onChange={() => updateParams({ workType: opt.value })}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ================================================================= */}
        {/* CỘT PHẢI (8.5 CỘT): DANH SÁCH VIỆC LÀM CHUẨN TOPCV (HÌNH 3)        */}
        {/* ================================================================= */}
        <section className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* =============================================================== */}
          {/* HEADER TOPCV: VIỆC LÀM NỔI BẬT + TABS + VIEW TOGGLE             */}
          {/* =============================================================== */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Tiêu đề & Pill Tabs (Việc văn phòng, Việc phổ thông, Tất cả) */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 m-0 whitespace-nowrap">
                  Việc làm nổi bật
                </h2>
                <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-full">
                  <button
                    type="button"
                    onClick={() => setJobTypeTab('OFFICE')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border-0 ${
                      jobTypeTab === 'OFFICE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Việc văn phòng
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobTypeTab('MANUAL')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border-0 ${
                      jobTypeTab === 'MANUAL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Việc phổ thông
                  </button>
                  <button
                    type="button"
                    onClick={() => setJobTypeTab('ALL')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border-0 ${
                      jobTypeTab === 'ALL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {/* Chuyển đổi View Mode (Grid 3 cột chuẩn TopCV / List ngang) & Điều hướng */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Chế độ xem:</span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                  <button
                    type="button"
                    aria-label="Xem dạng lưới chuẩn TopCV"
                    onClick={() => setViewMode('GRID')}
                    className={`p-1.5 rounded-md border-0 cursor-pointer transition-colors ${
                      viewMode === 'GRID' ? 'bg-white text-emerald-600 shadow-2xs' : 'bg-transparent text-slate-500 hover:text-slate-800'
                    }`}
                    title="Dạng lưới thẻ TopCV"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Xem dạng danh sách ngang"
                    onClick={() => setViewMode('LIST')}
                    className={`p-1.5 rounded-md border-0 cursor-pointer transition-colors ${
                      viewMode === 'LIST' ? 'bg-white text-emerald-600 shadow-2xs' : 'bg-transparent text-slate-500 hover:text-slate-800'
                    }`}
                    title="Dạng danh sách ngang"
                  >
                    <ListIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* DẢI PILLS LỌC NHANH ĐỊA ĐIỂM CHUẨN TOPCV (HÌNH 3) */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600 shrink-0 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Lọc theo:</span>
              </span>

              {/* Nút scroll trái */}
              <button
                type="button"
                aria-label="Cuộn trái"
                onClick={() => scrollPills(-180)}
                className="w-6 h-6 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Scrollable Pills container */}
              <div
                ref={pillsRef}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {QUICK_LOCATION_PILLS.map((pill) => {
                  const isActive = activeLocationPill === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => {
                        setActiveLocationPill(pill.id);
                        updateParams({ location: pill.id });
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                          : 'bg-slate-100 text-slate-700 border-transparent hover:bg-slate-200/90'
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>

              {/* Nút scroll phải */}
              <button
                type="button"
                aria-label="Cuộn phải"
                onClick={() => scrollPills(180)}
                className="w-6 h-6 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* BANNER GỢI Ý CHUẨN TOPCV (HÌNH 3) */}
          {showTip && (
            <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <span className="font-medium">
                  <strong>Gợi ý:</strong> Bấm vào việc làm để xem chi tiết yêu cầu, mức lương và nộp hồ sơ nhanh chóng.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTip(false)}
                className="text-emerald-700 hover:text-emerald-900 bg-transparent border-0 cursor-pointer p-0.5"
                title="Đóng gợi ý"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
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
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
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
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                    : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200'
                }`}
              >
                {searchField === 'ALL' ? '✓ ' : ''}Cả hai
              </button>
            </div>

            {/* Sắp xếp theo */}
            <div className="flex items-center gap-2 text-xs text-slate-600 shrink-0">
              <span className="font-semibold text-slate-700">⇅ Sắp xếp theo:</span>
              <div className="relative inline-flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sắp xếp kết quả tìm kiếm"
                  className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-7 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                <> cho từ khóa &ldquo;<strong className="text-emerald-600">{queryKeyword}</strong>&rdquo;</>
              ) : ''}
            </span>
            <span className="text-slate-400">Ưu tiên hiển thị tin tuyển dụng xác thực</span>
          </div>

          {/* Trạng thái Loading Skeleton */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs animate-pulse space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-4/5" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-6 bg-slate-100 rounded w-2/3" />
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
                Vui lòng thử bỏ bớt điều kiện lọc ở cột bên trái hoặc nhập từ khóa khác.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer border-0 shadow-xs inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ bộ lọc</span>
              </button>
            </div>
          )}

          {/* =============================================================== */}
          {/* LƯỚI THẺ VIỆC LÀM CARD GRID (CHUẨN TOPCV HÌNH 3)               */}
          {/* =============================================================== */}
          {!isLoading && filteredJobs.length > 0 && viewMode === 'GRID' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredJobs.map((job) => {
                const saved = isSaved(job.jobId);
                const isFeatured = (job.salaryMin != null && job.salaryMin >= 20000000) || job.postingPackageCode === 'STANDARD';

                return (
                  <div
                    key={job.jobId}
                    onClick={() => navigate(`/jobs/${job.jobId}`)}
                    className="bg-white rounded-xl border border-slate-200/90 hover:border-emerald-500 hover:shadow-md transition-all p-3.5 flex flex-col justify-between cursor-pointer group relative hover:-translate-y-0.5 duration-200"
                  >
                    <div>
                      {/* Logo + Tiêu đề + Tên công ty */}
                      <div className="flex items-start gap-3">
                        {/* Logo công ty hình vuông bo góc */}
                        <div className="w-12 h-12 rounded-lg border border-slate-100 p-1 bg-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                          <CompanyLogo
                            id={job.companyId || 'company'}
                            name={job.companyName || 'Doanh nghiệp'}
                            size={42}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Badge NỔI BẬT / TOP + Tiêu đề */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isFeatured && (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200/70 inline-flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                NỔI BẬT
                              </span>
                            )}
                            <h3
                              className="font-bold text-sm text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2 m-0 leading-snug"
                              title={job.title}
                            >
                              {job.title}
                            </h3>
                          </div>

                          {/* Tên công ty */}
                          <p
                            className="text-xs font-medium text-slate-500 truncate mt-1 m-0 uppercase tracking-tight"
                            title={job.companyName || 'CÔNG TY ĐỐI TÁC'}
                          >
                            {job.companyName || 'CÔNG TY CỔ PHẦN ĐỐI TÁC'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Hàng dưới cùng: Tag lương + Tag địa điểm + Tag kinh nghiệm + Nút Lưu */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {/* Tag Mức lương xanh nổi bật */}
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded whitespace-nowrap">
                          {formatSalary(job)}
                        </span>
                        {/* Tag Địa điểm */}
                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-medium truncate max-w-[100px]">
                          {formatLocation(job.location)}
                        </span>
                        {/* Tag Kinh nghiệm (Tối thiểu 1 năm...) */}
                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap">
                          {formatExperience(job.minExperienceYears)}
                        </span>
                      </div>

                      {/* Nút lưu việc làm trái tim */}
                      <button
                        type="button"
                        aria-label="Lưu việc làm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSave(job.jobId, job.title);
                        }}
                        className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          saved
                            ? 'text-rose-500 bg-rose-50 border-rose-200'
                            : 'text-slate-400 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 bg-white'
                        }`}
                        title={saved ? 'Đã lưu việc làm' : 'Lưu việc làm'}
                      >
                        <Heart
                          className="h-3.5 w-3.5"
                          fill={saved ? 'currentColor' : 'none'}
                          strokeWidth={1.8}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* =============================================================== */}
          {/* CHẾ ĐỘ XEM LIST (DANH SÁCH NGANG)                               */}
          {/* =============================================================== */}
          {!isLoading && filteredJobs.length > 0 && viewMode === 'LIST' && (
            <div className="space-y-3.5">
              {filteredJobs.map((job) => {
                const saved = isSaved(job.jobId);
                const postedText = job.createdAt ? dayjs(job.createdAt).fromNow() : 'Đăng gần đây';
                const isFeatured = (job.salaryMin != null && job.salaryMin >= 20000000) || job.postingPackageCode === 'STANDARD';

                return (
                  <div
                    key={job.jobId}
                    onClick={() => navigate(`/jobs/${job.jobId}`)}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:shadow-md p-4 transition-all flex flex-col sm:flex-row items-start gap-4 cursor-pointer relative group"
                  >
                    {/* Logo doanh nghiệp lớn bên trái */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-200/80 p-2 bg-white flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                      <CompanyLogo
                        id={job.companyId || 'company'}
                        name={job.companyName || 'Doanh nghiệp'}
                        size={64}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Khối thông tin trung tâm */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isFeatured && (
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200/70 inline-flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            NỔI BẬT
                          </span>
                        )}
                        <h3
                          className="font-bold text-base text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1 m-0 leading-tight"
                          title={job.title}
                        >
                          {job.title}
                        </h3>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 fill-emerald-50" />
                      </div>

                      <p
                        className="text-xs font-semibold text-slate-500 uppercase mt-1 line-clamp-1 m-0 tracking-tight"
                        title={job.companyName || 'CÔNG TY TNHH ĐỐI TÁC'}
                      >
                        {job.companyName || 'CÔNG TY CỔ PHẦN ĐỐI TÁC HR CONNECT'}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded font-medium">
                          {formatLocation(job.location)}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded font-medium">
                          {formatExperience(job.minExperienceYears)}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-0.5 rounded border border-emerald-200/50">
                          {formatSalary(job)}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mt-2 line-clamp-1 font-normal">
                        {(job.skills || []).map((s) => s.skillName).filter(Boolean).slice(0, 4).join(' | ') ||
                          `${job.employmentType || 'Toàn thời gian'} | Môi trường chuyên nghiệp | Đãi ngộ tốt`}
                      </div>
                    </div>

                    {/* Khối bên phải */}
                    <div className="shrink-0 flex sm:flex-col justify-between sm:items-end w-full sm:w-auto sm:h-full sm:min-h-[80px] mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
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
                        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer mt-auto ${
                          saved
                            ? 'text-rose-500 bg-rose-50 border-rose-200'
                            : 'text-slate-400 border-slate-200 hover:border-emerald-500 hover:text-emerald-600 bg-white'
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
