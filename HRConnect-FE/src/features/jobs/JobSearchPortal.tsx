import React, { useState, useEffect, useMemo } from 'react';
import {
  Input,
  Select,
  TreeSelect,
  Button,
  message,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  ApartmentOutlined,
  DollarOutlined,
  FilterOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { JobCardHorizontal } from '@/components/common/JobCardHorizontal';
import { JobCardData, deduplicateTags } from '@/components/common/JobCard';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { INDUSTRY_TAXONOMY } from '@/constants/industryTaxonomy';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { ServiceType } from '@/types/job';

export const JobSearchPortal: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const { cvs, toggleSaveJob, isJobSaved } = useCandidateStore();

  // Search & Filter state initialized from URL query params
  const [keyword, setKeyword] = useState(() => searchParams.get('keyword') || '');
  const [searchTarget, setSearchTarget] = useState<'all' | 'title' | 'company'>(() => {
    const t = searchParams.get('target');
    return t === 'company' || t === 'all' ? t : 'title';
  });
  const [industry, setIndustry] = useState<string | undefined>(
    () => searchParams.get('industry') || undefined
  );
  const [location, setLocation] = useState<string | undefined>(
    () => searchParams.get('location') || undefined
  );
  const [sortBy, setSortBy] = useState<string>(() => searchParams.get('sort') || 'AI_MATCH');

  // Sync state when URL params change (e.g. Back/Forward button, or navigation from HomePage)
  useEffect(() => {
    const kw = searchParams.get('keyword');
    if (kw !== null && kw !== keyword) {
      setKeyword(kw);
    }
    const loc = searchParams.get('location');
    if (loc !== null && loc !== location) {
      setLocation(loc || undefined);
    }
    const ind = searchParams.get('industry');
    if (ind !== null && ind !== industry) {
      setIndustry(ind || undefined);
    }
    const target = searchParams.get('target');
    if (target && (target === 'company' || target === 'all' || target === 'title')) {
      setSearchTarget(target);
    }
  }, [searchParams]);

  // Synchronize state back into URL query params
  const syncParamsToUrl = (newKw?: string, newLoc?: string, newInd?: string, newTarget?: string) => {
    const params = new URLSearchParams();
    const currentKw = newKw !== undefined ? newKw : keyword;
    const currentLoc = newLoc !== undefined ? newLoc : location;
    const currentInd = newInd !== undefined ? newInd : industry;
    const currentTarget = newTarget !== undefined ? newTarget : searchTarget;

    if (currentKw.trim()) params.set('keyword', currentKw.trim());
    if (currentLoc && currentLoc !== 'ALL') params.set('location', currentLoc);
    if (currentInd) params.set('industry', currentInd);
    if (currentTarget && currentTarget !== 'title') params.set('target', currentTarget);

    setSearchParams(params, { replace: true });
  };

  // Salary Filter
  const [salaryQuick, setSalaryQuick] = useState<string>('ALL');
  const [salaryMinInput, setSalaryMinInput] = useState<string>('');
  const [salaryMaxInput, setSalaryMaxInput] = useState<string>('');
  const [appliedCustomSalary, setAppliedCustomSalary] = useState<{ min?: number; max?: number }>({});

  // Work Mode & Multi-Level
  const [workModeFilter, setWorkModeFilter] = useState<string>('ALL');
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('ALL');

  // Modals
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<FeaturedJobItem | null>(null);

  // Load jobs from localStorage or fallback
  const [allPublicJobs, setAllPublicJobs] = useState<FeaturedJobItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('hrconnect_all_jobs');
      let storedJobs: any[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          storedJobs = parsed;
        }
      }

      const activeStoredJobs: FeaturedJobItem[] = storedJobs
        .filter((j) => j.status === 'ACTIVE')
        .map((j) => {
          const salaryMin = j.salaryRange?.min || 20000000;
          const salaryMax = j.salaryRange?.max || 45000000;
          const commRate = j.engagementTerms?.commissionRate || 15;
          const estComm =
            Math.round((salaryMax * commRate) / 100).toLocaleString('vi-VN') + '₫';
          const rawTags = [...(j.mustHaveTags || []), ...(j.shouldHaveTags || [])];
          const tags = rawTags.length > 0 ? deduplicateTags(rawTags) : ['Công nghệ', 'Fulltime'];

          return {
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location || 'Hồ Chí Minh',
            workMode: j.remote ? 'Remote' : 'Hybrid',
            level: (j.level || 'Senior') as any,
            salaryMin,
            salaryMax,
            serviceType: (j.serviceType || 'HEADHUNT_COD') as any,
            commissionRate: commRate,
            estimatedCommission: estComm,
            tags,
            isUrgent: true,
          };
        });

      const existingIds = new Set(activeStoredJobs.map((j) => j.id));
      const merged = [
        ...activeStoredJobs,
        ...FEATURED_HOT_JOBS.filter((j) => !existingIds.has(j.id)),
      ];
      setAllPublicJobs(merged);
    } catch {
      setAllPublicJobs(FEATURED_HOT_JOBS);
    }
  }, []);

  const handleToggleLevel = (lvl: string) => {
    setSelectedLevels((prev) =>
      prev.includes(lvl) ? prev.filter((item) => item !== lvl) : [...prev, lvl]
    );
  };

  const handleApplyCustomSalary = () => {
    const minVal = salaryMinInput ? parseFloat(salaryMinInput) : undefined;
    const maxVal = salaryMaxInput ? parseFloat(salaryMaxInput) : undefined;

    if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
      message.error('Mức lương tối thiểu không được lớn hơn mức tối đa!');
      return;
    }

    setSalaryQuick('ALL');
    setAppliedCustomSalary({ min: minVal, max: maxVal });
    message.success('Đã áp dụng khoảng lương tùy chỉnh!');
  };

  const handleResetFilters = () => {
    setKeyword('');
    setSearchTarget('title');
    setLocation(undefined);
    setIndustry(undefined);
    setSalaryQuick('ALL');
    setSalaryMinInput('');
    setSalaryMaxInput('');
    setAppliedCustomSalary({});
    setWorkModeFilter('ALL');
    setSelectedLevels([]);
    setServiceTypeFilter('ALL');
    setSortBy('AI_MATCH');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const isAnyFilterActive =
    Boolean(keyword) ||
    searchTarget !== 'title' ||
    Boolean(location) ||
    Boolean(industry) ||
    salaryQuick !== 'ALL' ||
    Boolean(appliedCustomSalary.min) ||
    Boolean(appliedCustomSalary.max) ||
    workModeFilter !== 'ALL' ||
    selectedLevels.length > 0 ||
    serviceTypeFilter !== 'ALL' ||
    sortBy !== 'AI_MATCH';

  // Filter Jobs logic
  const filteredJobs = useMemo(() => {
    const list = allPublicJobs.length > 0 ? allPublicJobs : FEATURED_HOT_JOBS;

    const matched = list.filter((job) => {
      const q = keyword.toLowerCase().trim();
      if (q) {
        if (searchTarget === 'title') {
          const matchTitle =
            job.title.toLowerCase().includes(q) ||
            job.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle) return false;
        } else if (searchTarget === 'company') {
          if (!job.company.toLowerCase().includes(q)) return false;
        } else {
          const matchAll =
            job.title.toLowerCase().includes(q) ||
            job.company.toLowerCase().includes(q) ||
            job.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchAll) return false;
        }
      }

      if (location && location !== 'ALL') {
        const matchLocation =
          (location === 'HN' && job.location.includes('Hà Nội')) ||
          (location === 'HCM' && job.location.includes('Hồ Chí Minh')) ||
          (location === 'DN' && job.location.includes('Đà Nẵng')) ||
          (location === 'REMOTE' && job.workMode.toLowerCase().includes('remote'));
        if (!matchLocation) return false;
      }

      if (workModeFilter !== 'ALL') {
        if (workModeFilter === 'REMOTE' && !job.workMode.toLowerCase().includes('remote')) {
          return false;
        }
        if (workModeFilter === 'HYBRID' && !job.workMode.toLowerCase().includes('hybrid')) {
          return false;
        }
        if (workModeFilter === 'ON_SITE' && !job.workMode.toLowerCase().includes('site')) {
          return false;
        }
      }

      if (selectedLevels.length > 0) {
        const jobLvl = (job.level || '').toLowerCase();
        const matchesLevel = selectedLevels.some((lvl) => {
          if (lvl === 'INTERN') return jobLvl.includes('intern') || jobLvl.includes('fresher');
          if (lvl === 'JUNIOR') return jobLvl.includes('junior');
          if (lvl === 'MIDDLE') return jobLvl.includes('middle');
          if (lvl === 'SENIOR') return jobLvl.includes('senior');
          if (lvl === 'LEAD') return jobLvl.includes('lead') || jobLvl.includes('manager');
          return false;
        });
        if (!matchesLevel) return false;
      }

      if (serviceTypeFilter !== 'ALL') {
        if (String(job.serviceType) !== serviceTypeFilter) {
          return false;
        }
      }

      if (salaryQuick !== 'ALL') {
        const maxM = job.salaryMax / 1000000;
        const minM = job.salaryMin / 1000000;

        if (salaryQuick === 'UNDER_10' && minM > 10) return false;
        if (salaryQuick === '10_15' && (maxM < 10 || minM > 15)) return false;
        if (salaryQuick === '15_20' && (maxM < 15 || minM > 20)) return false;
        if (salaryQuick === '20_30' && (maxM < 20 || minM > 30)) return false;
        if (salaryQuick === 'OVER_30' && maxM < 30) return false;
      }

      if (appliedCustomSalary.min !== undefined && appliedCustomSalary.min > 0) {
        if (job.salaryMax < appliedCustomSalary.min * 1000000) return false;
      }
      if (appliedCustomSalary.max !== undefined && appliedCustomSalary.max > 0) {
        if (job.salaryMin > appliedCustomSalary.max * 1000000) return false;
      }

      return true;
    });

    return matched.sort((a, b) => {
      if (sortBy === 'SALARY_HIGH') {
        return (b.salaryMax || 0) - (a.salaryMax || 0);
      }
      if (sortBy === 'SALARY_LOW') {
        return (a.salaryMin || 0) - (b.salaryMin || 0);
      }
      if (sortBy === 'URGENT') {
        return (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0);
      }
      const scoreA = a.aiMatchScore || (a.isUrgent ? 95 : 90);
      const scoreB = b.aiMatchScore || (b.isUrgent ? 95 : 90);
      return scoreB - scoreA;
    });
  }, [
    allPublicJobs,
    keyword,
    searchTarget,
    location,
    workModeFilter,
    selectedLevels,
    serviceTypeFilter,
    salaryQuick,
    appliedCustomSalary,
    sortBy,
  ]);

  const handleApplyClick = (job: FeaturedJobItem | JobCardData) => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập tài khoản Ứng viên để nộp hồ sơ!');
      navigate('/login');
      return;
    }
    setSelectedJob(job as FeaturedJobItem);
    setApplyModalOpen(true);
  };

  const locationOptions = [
    { value: 'ALL', label: 'Toàn quốc' },
    { value: 'HN', label: '📍 Hà Nội' },
    { value: 'HCM', label: '📍 TP. Hồ Chí Minh' },
    { value: 'DN', label: '📍 Đà Nẵng' },
    { value: 'REMOTE', label: '🌐 Remote' },
  ];

  return (
    <div className="w-full">
      {/* ── 1. THANH TÌM KIẾM PHỨC HỢP (MULTI-INPUT SEARCH BAR) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 flex flex-col md:flex-row items-stretch md:items-center gap-1.5 mb-6">
        {/* Phân vùng 1: Dropdown "Danh mục Nghề" */}
        <div className="w-full md:w-56 flex items-center px-3 py-1">
          <ApartmentOutlined className="text-blue-600 text-base mr-2 shrink-0" />
          <TreeSelect
            showSearch
            allowClear
            bordered={false}
            value={industry}
            onChange={(val) => {
              setIndustry(val);
              syncParamsToUrl(undefined, undefined, val);
            }}
            treeData={INDUSTRY_TAXONOMY}
            placeholder={<span className="text-slate-500 font-medium">Danh mục Nghề</span>}
            popupMatchSelectWidth={false}
            className="w-full font-medium text-sm"
            dropdownStyle={{ borderRadius: 12, maxHeight: 380 }}
          />
        </div>

        {/* Ngăn cách 1 */}
        <div className="hidden md:block h-6 w-[1px] bg-slate-200 shrink-0" />

        {/* Phân vùng 2: Ô gõ từ khóa */}
        <div className="flex-1 flex items-center px-3 py-1">
          <SearchOutlined className="text-slate-400 text-base mr-2 shrink-0" />
          <Input
            bordered={false}
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => syncParamsToUrl()}
            placeholder="Tìm kiếm vị trí, kỹ năng, công ty..."
            className="w-full text-sm font-medium focus:ring-0 placeholder:text-slate-400"
          />
        </div>

        {/* Ngăn cách 2 */}
        <div className="hidden md:block h-6 w-[1px] bg-slate-200 shrink-0" />

        {/* Phân vùng 3: Dropdown "Địa điểm" */}
        <div className="w-full md:w-48 flex items-center px-3 py-1">
          <EnvironmentOutlined className="text-emerald-600 text-base mr-2 shrink-0" />
          <Select
            bordered={false}
            allowClear
            value={location}
            onChange={(val) => {
              setLocation(val);
              syncParamsToUrl(undefined, val, undefined);
            }}
            placeholder={<span className="text-slate-500 font-medium">Địa điểm</span>}
            options={locationOptions}
            className="w-full font-medium text-sm"
          />
        </div>

        {/* Nút Action: [Tìm kiếm] */}
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={() => syncParamsToUrl()}
          className="h-11 px-7 font-bold bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white shadow-xs border-none flex items-center justify-center shrink-0 transition-colors"
        >
          Tìm kiếm
        </Button>
      </div>

      {/* ── 2. HEADER KẾT QUẢ & CỤM ĐIỀU KHIỂN (SEARCH CONTROLS BAR) ── */}
      <div className="mb-5 space-y-2">
        <div className="text-xs text-slate-400 flex items-center gap-1.5 font-normal">
          <span className="hover:text-slate-600 cursor-pointer" onClick={() => navigate('/')}>
            Trang chủ
          </span>
          <span>&gt;</span>
          <span className="hover:text-slate-600 cursor-pointer" onClick={() => navigate('/jobs')}>
            Việc làm
          </span>
          <span>&gt;</span>
          <span className="text-slate-600 font-medium">Tìm kiếm việc làm</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Tuyển dụng <span className="text-emerald-600 font-extrabold">{filteredJobs.length}</span> việc làm phù hợp
            </h2>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              Update mới nhất
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <span className="hidden xl:inline text-slate-400">Tìm kiếm theo:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    setSearchTarget('title');
                    syncParamsToUrl(undefined, undefined, undefined, 'title');
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                    searchTarget === 'title'
                      ? 'bg-white text-blue-600 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {searchTarget === 'title' ? '✓ ' : ''}Tên việc làm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTarget('company');
                    syncParamsToUrl(undefined, undefined, undefined, 'company');
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                    searchTarget === 'company'
                      ? 'bg-white text-blue-600 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {searchTarget === 'company' ? '✓ ' : ''}Tên công ty
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTarget('all');
                    syncParamsToUrl(undefined, undefined, undefined, 'all');
                  }}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                    searchTarget === 'all'
                      ? 'bg-white text-blue-600 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {searchTarget === 'all' ? '✓ ' : ''}Cả hai
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-slate-400 hidden sm:inline">Sắp xếp theo:</span>
              <Select
                size="small"
                value={sortBy}
                onChange={setSortBy}
                className="w-40 font-medium text-xs"
                options={[
                  { value: 'AI_MATCH', label: 'Khớp lệnh AI Match' },
                  { value: 'SALARY_HIGH', label: 'Lương cao đến thấp' },
                  { value: 'SALARY_LOW', label: 'Lương thấp đến cao' },
                  { value: 'NEWEST', label: 'Mới nhất' },
                  { value: 'URGENT', label: 'Cần tuyển gấp' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. BỐ CỤC 2 CỘT (28% Left Sidebar - 72% Right Job List) ── */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Cột Trái (Sidebar Bộ Lọc Nâng Cao - 28% width, sticky top-20) ── */}
        <aside className="w-full lg:w-[28%] lg:sticky lg:top-20 space-y-5 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FilterOutlined className="text-emerald-600 text-base" />
              <span className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                Lọc nâng cao
              </span>
            </div>
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
              >
                <ClearOutlined /> Đặt lại
              </button>
            )}
          </div>

          {/* Khoảng lương */}
          <div>
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Khoảng lương (VNĐ)</span>
              {appliedCustomSalary.min || appliedCustomSalary.max ? (
                <span className="text-2xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {appliedCustomSalary.min || 0}M - {appliedCustomSalary.max || '∞'}M
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              {[
                { label: 'Tất cả mức lương', val: 'ALL' },
                { label: 'Dưới 10 triệu', val: 'UNDER_10' },
                { label: '10 - 15 triệu', val: '10_15' },
                { label: '15 - 20 triệu', val: '15_20' },
                { label: '20 - 30 triệu', val: '20_30' },
                { label: 'Trên 30 triệu', val: 'OVER_30' },
              ].map((item) => (
                <label
                  key={item.val}
                  className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                    salaryQuick === item.val
                      ? 'bg-emerald-50/70 text-emerald-800 font-semibold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="salaryQuickPortal"
                    checked={salaryQuick === item.val}
                    onChange={() => {
                      setSalaryQuick(item.val);
                      setAppliedCustomSalary({});
                    }}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-2xs text-slate-500 mb-1.5">Tự nhập khoảng lương (Triệu):</div>
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="Từ"
                  type="number"
                  size="small"
                  value={salaryMinInput}
                  onChange={(e) => setSalaryMinInput(e.target.value)}
                  className="rounded-lg text-xs"
                />
                <span className="text-slate-400 text-xs">-</span>
                <Input
                  placeholder="Đến"
                  type="number"
                  size="small"
                  value={salaryMaxInput}
                  onChange={(e) => setSalaryMaxInput(e.target.value)}
                  className="rounded-lg text-xs"
                />
                <Button
                  size="small"
                  type="primary"
                  onClick={handleApplyCustomSalary}
                  className="rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 shrink-0"
                >
                  Áp dụng
                </Button>
              </div>
            </div>
          </div>

          {/* Cấp bậc */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Cấp bậc chuyên môn
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              {[
                { label: 'Intern / Fresher', val: 'INTERN' },
                { label: 'Junior', val: 'JUNIOR' },
                { label: 'Middle', val: 'MIDDLE' },
                { label: 'Senior', val: 'SENIOR' },
                { label: 'Lead / Manager', val: 'LEAD' },
              ].map((lvl) => {
                const isChecked = selectedLevels.includes(lvl.val);
                return (
                  <label
                    key={lvl.val}
                    className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                      isChecked ? 'bg-blue-50/70 text-blue-800 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleLevel(lvl.val)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>{lvl.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Hình thức làm việc */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Hình thức làm việc
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              {[
                { label: 'Tất cả hình thức', val: 'ALL' },
                { label: 'Làm việc từ xa (Remote)', val: 'REMOTE' },
                { label: 'Linh hoạt (Hybrid)', val: 'HYBRID' },
                { label: 'Tại văn phòng (On-site)', val: 'ON_SITE' },
              ].map((m) => (
                <label
                  key={m.val}
                  className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                    workModeFilter === m.val ? 'bg-slate-100 text-slate-900 font-semibold' : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="workModeFilterPortal"
                    checked={workModeFilter === m.val}
                    onChange={() => setWorkModeFilter(m.val)}
                    className="text-slate-800 focus:ring-slate-700"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Dịch vụ HR Connect */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Dịch vụ tuyển dụng
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              {[
                { label: 'Tất cả dịch vụ', val: 'ALL' },
                { label: 'Headhunt COD (Hoa hồng cao)', val: ServiceType.HEADHUNT_COD },
                { label: 'Cung cấp hồ sơ (CV Sourcing)', val: ServiceType.CV_SOURCING },
                { label: 'Tuyển dụng mở (CV Application)', val: ServiceType.CV_APPLICATION },
              ].map((s) => (
                <label
                  key={s.val}
                  className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                    serviceTypeFilter === s.val
                      ? 'bg-emerald-50/70 text-emerald-800 font-semibold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="serviceTypeFilterPortal"
                    checked={serviceTypeFilter === s.val}
                    onChange={() => setServiceTypeFilter(s.val)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button
              block
              icon={<ClearOutlined />}
              onClick={handleResetFilters}
              className="rounded-xl font-semibold text-xs text-slate-600 hover:text-rose-600 hover:border-rose-300"
            >
              Đặt lại tất cả bộ lọc
            </Button>
          </div>
        </aside>

        {/* ── Cột Phải (Danh sách việc làm - 72% width: Horizontal Job Cards) ── */}
        <div className="w-full lg:w-[72%] min-w-0 space-y-3.5">
          {filteredJobs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <SearchOutlined className="text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Không tìm thấy công việc phù hợp
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Hãy thử điều chỉnh từ khóa tìm kiếm, mở rộng khoảng lương hoặc xóa các tiêu chí lọc đang chọn.
              </p>
              <Button
                type="primary"
                onClick={handleResetFilters}
                className="rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 border-none"
              >
                Xem tất cả việc làm
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredJobs.map((job) => {
                const isSaved = isJobSaved(job.id);

                return (
                  <JobCardHorizontal
                    key={job.id}
                    job={{
                      id: job.id,
                      title: job.title,
                      company: job.company,
                      companyLogo: job.companyLogo,
                      location: job.location,
                      workMode: job.workMode,
                      level: job.level,
                      salaryMin: job.salaryMin,
                      salaryMax: job.salaryMax,
                      serviceType: job.serviceType,
                      commissionRate: job.commissionRate,
                      estimatedCommission: job.estimatedCommission,
                      tags: job.tags,
                      isUrgent: job.isUrgent,
                      deadline: job.deadline,
                    }}
                    isSaved={isSaved}
                    onToggleSave={(jobId) => {
                      const saved = toggleSaveJob(jobId);
                      if (saved) {
                        message.success(`Đã lưu "${job.title}" vào danh sách!`);
                      } else {
                        message.info(`Đã gỡ lưu "${job.title}".`);
                      }
                    }}
                    onViewDetail={(j) => navigate(`/jobs/${j.id}`)}
                    onQuickApply={(j) => handleApplyClick(j)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Apply Modal */}
      <ApplyJobModal
        open={applyModalOpen}
        job={selectedJob}
        onClose={() => setApplyModalOpen(false)}
      />
    </div>
  );
};

export default JobSearchPortal;
