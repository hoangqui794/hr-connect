/**
 * @file PublicJobSplitDiscovery.tsx
 * @description Job search at /jobs (mockup 03/11, Jobs.dc.html) on GET /public/jobs. The URL holds the search and the applied filters.
 *  The API takes one employment type and always includes negotiable salaries; anything beyond that is filtered here
 *  over the first 100 results (see needsLocalFilter).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Select, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { Navbar } from '@/features/landing/components/Navbar';
import { CompanyMark, jobHref, postedText, salaryText } from '@/features/landing/components/SiteParts';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { EmploymentType, Job, JobSearchParams } from '@/types/api/jobs';
import { EMPLOYMENT_TYPE_LABEL, experienceText } from './jobDisplay';
import { usePublicJobSearch } from './useJobQueries';
import { useIndustryOptions } from './useIndustryOptions';

const PAGE_SIZE = 10;
/** The API's largest page; local filters run over this many results. */
const LOCAL_FILTER_SIZE = 100;
const REMOTE = 'REMOTE';

const LINK = 'text-[#0369A1] no-underline hover:text-[#075985] hover:underline';
const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";
const PAGE_BUTTON = 'flex items-center justify-center rounded-md text-[14px]';
const PAGE_OTHER = `${PAGE_BUTTON} h-[42px] w-[42px] cursor-pointer border border-solid border-[#D1D5DB] bg-white text-[#374151]`;

/** `years` is the value sent to the API, which keeps jobs whose experience range contains it. */
const EXPERIENCE = [
  { key: 'FRESHER', label: 'Chưa có kinh nghiệm', years: 0 },
  { key: 'UNDER_1', label: 'Dưới 1 năm', years: 0.5 },
  { key: 'FROM_1_3', label: '1 – 3 năm', years: 2 },
  { key: 'FROM_3_5', label: '3 – 5 năm', years: 4 },
  { key: 'OVER_5', label: 'Trên 5 năm', years: 6 },
];

const WORK_TYPES = [
  { key: 'FULL_TIME', label: 'Toàn thời gian' },
  { key: 'PART_TIME', label: 'Bán thời gian' },
  { key: 'INTERNSHIP', label: 'Thực tập' },
  { key: REMOTE, label: 'Làm từ xa' },
];

export const ALL_VIETNAM_PROVINCES = [
  'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương', 'Đồng Nai',
  'Hải Phòng', 'Cần Thơ', 'Bà Rịa - Vũng Tàu', 'Bắc Ninh', 'Quảng Ninh',
  'Khánh Hòa', 'Thừa Thiên Huế', 'Lâm Đồng', 'An Giang', 'Bắc Giang',
  'Bắc Kạn', 'Bạc Liêu', 'Bến Tre', 'Bình Định', 'Bình Phước',
  'Bình Thuận', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Đắk Nông',
  'Điện Biên', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam',
  'Hà Tĩnh', 'Hải Dương', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên',
  'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lạng Sơn', 'Lào Cai',
  'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận',
  'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi',
  'Quảng Trị', 'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình',
  'Thái Nguyên', 'Thanh Hóa', 'Tiền Giang', 'Trà Vinh', 'Tuyên Quang',
  'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
];

export const removeDiacritics = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd');

export const matchProvince = (jobLocation: string, province: string): boolean => {
  const normLoc = removeDiacritics(jobLocation).toLowerCase();
  const normProv = removeDiacritics(province).toLowerCase();
  if (normLoc.includes(normProv)) return true;
  if (normProv === 'ho chi minh' && (normLoc.includes('hcm') || normLoc.includes('sai gon') || normLoc.includes('thu duc'))) return true;
  if (normProv === 'ha noi' && normLoc.includes('hn')) return true;
  if (normProv === 'da nang' && normLoc.includes('dn')) return true;
  if (normProv === 'ba ria - vung tau' && (normLoc.includes('vung tau') || normLoc.includes('ba ria'))) return true;
  if (normProv === 'thua thien hue' && normLoc.includes('hue')) return true;
  return false;
};

/** Salary filter as ranges (triệu/tháng); they map onto the existing salaryMin/salaryMax URL params. */
const SALARY_RANGES = [
  { key: '', label: 'Tất cả mức lương', min: '', max: '' },
  { key: '0-10', label: 'Dưới 10 triệu', min: '', max: '10' },
  { key: '10-15', label: '10 – 15 triệu', min: '10', max: '15' },
  { key: '15-20', label: '15 – 20 triệu', min: '15', max: '20' },
  { key: '20-30', label: '20 – 30 triệu', min: '20', max: '30' },
  { key: '30-50', label: '30 – 50 triệu', min: '30', max: '50' },
  { key: '50-', label: 'Trên 50 triệu', min: '50', max: '' },
];
const salaryRangeKey = (min: string, max: string) =>
  SALARY_RANGES.find((r) => r.min === min && r.max === max)?.key ?? (min || max ? 'custom' : '');

/** A deadline within a week gets the "Hạn gần" tag. */
const isDeadlineNear = (deadline?: string | null) => {
  if (!deadline) return false;
  const days = dayjs(deadline).endOf('day').diff(dayjs(), 'day', true);
  return days >= 0 && days <= 7;
};

const SORTS = [
  { value: 'FIT', label: 'Phù hợp nhất', candidateOnly: true },
  { value: 'LATEST', label: 'Mới đăng' },
  { value: 'SALARY', label: 'Lương cao nhất' },
];

const SR_ONLY = 'absolute left-[-9999px]';
const SELECT_TEXT = `${FONT} [&_.ant-select-selection-item]:font-[inherit] [&_.ant-select-selection-item]:!text-[#1F2937]`;
/** The job list has no reliable work mode field yet, so remote jobs are also recognised from their text. */
const isRemote = (job: Job) =>
  job.workMode?.toUpperCase() === REMOTE || /remote|từ xa/i.test(`${job.location ?? ''} ${job.workingTime ?? ''}`);
const positive = (value: string | null) => (value && Number(value) > 0 ? value : '');

/** Page numbers with gaps, e.g. 1 2 3 … 5. */
const pageList = (current: number, total: number): (number | null)[] => {
  const wanted = new Set([1, total, current - 1, current, current + 1, ...(current <= 2 ? [2, 3] : [])]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
};

const Checkbox: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`h-[18px] w-[18px] shrink-0 cursor-pointer ${props.type === 'radio' ? 'ml-[5px] mr-[3px] mt-[3px]' : 'mx-[3px] ml-1 my-[3px]'}`} />
);

const JobRow: React.FC<{ job: Job; fit?: number; canSave: boolean; saved: boolean; onSave: () => void; action: string; applied: boolean }> = ({ job, fit, canSave, saved, onSave, action, applied }) => {
  const deadline = job.applicationDeadline ?? job.expiresAt;
  const href = jobHref(job.jobId);
  return (
    <article className="hrc-card flex flex-wrap gap-4 rounded-xl border border-solid border-[#E2E8F0] bg-white p-[18px]">
      <CompanyMark name={job.companyName} logoUrl={job.companyLogoUrl} size={56} />
      <div className="min-w-0 flex-[1_1_360px]">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={href} className="text-[17px] font-bold text-[#0F172A] no-underline hover:text-[#075985] hover:underline">{job.title}</Link>
          {isDeadlineNear(deadline) && (
            <span className="rounded-full bg-[#FFEDD5] px-2.5 py-0.5 text-[12px] font-bold text-[#9A3412]">Hạn gần</span>
          )}
        </div>
        <div className="mt-0.5 text-[14px] text-[#475569]">{job.companyName}</div>
        <div className="mt-2.5 flex flex-wrap gap-2 text-[13px]">
          <span className="rounded-lg border border-solid border-emerald-200/80 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{salaryText(job)}</span>
          {job.location && <span title={job.location} className="max-w-[260px] truncate rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[#334155]">{job.location}</span>}
          <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[#334155]">{experienceText(job.minExperienceYears, job.maxExperienceYears)}</span>
          {job.employmentType && <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[#334155]">{EMPLOYMENT_TYPE_LABEL[job.employmentType]}</span>}
        </div>
        {job.skills?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.skills.map((skill) => (
              <span key={skill.skillId} className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#374151]">{skill.skillName}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex w-full flex-col items-start gap-2 sm:w-[210px] sm:flex-none sm:items-end sm:text-right">
        {fit !== undefined && (
          <span className="rounded-md border border-solid border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[12px] font-semibold text-sky-800">Phù hợp {Math.round(fit)}%</span>
        )}
        <span className="text-[12px] text-slate-500">
          {postedText(job.postedAt)}{deadline ? ` · Hạn ${dayjs(deadline).format('DD/MM')}` : ''}
        </span>
        <div className="flex items-center gap-2 sm:mt-auto">
          {canSave && (
            <button
              type="button"
              aria-label={saved ? `Bỏ lưu ${job.title}` : `Lưu ${job.title}`}
              aria-pressed={saved}
              onClick={onSave}
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-solid border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? '#E11D48' : 'none'} stroke={saved ? '#E11D48' : 'currentColor'} strokeWidth="1.8" aria-hidden="true">
                <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
              </svg>
            </button>
          )}
          <Link
            to={href}
            className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 text-[13.5px] font-bold no-underline transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
              applied
                ? 'border border-solid border-emerald-200 bg-emerald-50 text-emerald-700 shadow-2xs hover:bg-emerald-100 hover:text-emerald-800'
                : 'bg-[#0369A1] text-white shadow-sm shadow-blue-500/20 hover:bg-[#075985] hover:shadow-md hover:shadow-blue-500/30 hover:text-white active:scale-[0.98]'
            }`}
          >
            {applied ? (
              <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
                <svg className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Đã ứng tuyển
              </span>
            ) : (
              action
            )}
          </Link>
        </div>
      </div>
    </article>
  );
};

export const PublicJobSplitDiscovery: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname, search: currentSearch } = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasAnyRole = useAuthStore((s) => s.hasAnyRole);
  const isCandidate = isAuthenticated && hasAnyRole([UserRole.CANDIDATE]);
  const { isSaved, toggleSave } = useSavedJobs();
  const { isApplied } = useCandidateAppliedJobs();

  // Applied search, from the URL.
  const keyword = params.get('keyword') || params.get('search') || '';
  const location = params.get('location') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sort = params.get('sort') || (isCandidate ? 'FIT' : 'LATEST');
  const salaryMin = positive(params.get('salaryMin'));
  const salaryMax = positive(params.get('salaryMax'));
  const negotiable = params.get('negotiable') === 'true';
  const expKey = params.get('exp') || '';
  const industry = params.get('industry') || '';
  const industries = useIndustryOptions();
  const types = (params.get('modes') || '').split(',').filter(Boolean);
  const experience = EXPERIENCE.find((level) => level.key === expKey);

  // Drafts until the visitor submits.
  const [keywordDraft, setKeywordDraft] = useState(keyword);
  const [locationDraft, setLocationDraft] = useState(location);
  const [minDraft, setMinDraft] = useState(salaryMin);
  const [maxDraft, setMaxDraft] = useState(salaryMax);
  const [negotiableDraft, setNegotiableDraft] = useState(negotiable);
  const [expDraft, setExpDraft] = useState(expKey);
  const [industryDraft, setIndustryDraft] = useState(industry);
  const [typesDraft, setTypesDraft] = useState(types);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const typesKey = types.join(',');

  useEffect(() => {
    setKeywordDraft(keyword);
    setLocationDraft(location);
    setMinDraft(salaryMin);
    setMaxDraft(salaryMax);
    setNegotiableDraft(negotiable);
    setExpDraft(expKey);
    setIndustryDraft(industry);
    setTypesDraft(typesKey ? typesKey.split(',') : []);
  }, [keyword, location, salaryMin, salaryMax, negotiable, expKey, industry, typesKey]);

  const hasSalaryRange = Boolean(salaryMin || salaryMax);
  const excludeNegotiable = hasSalaryRange && !negotiable;
  const singleType = types.length === 1 && types[0] !== REMOTE ? (types[0] as EmploymentType) : undefined;
  const needsLocalFilter = excludeNegotiable || (types.length > 0 && !singleType);

  const query: JobSearchParams = {
    search: keyword || undefined,
    location: location || undefined,
    employmentType: singleType,
    salaryMin: salaryMin ? Number(salaryMin) * 1_000_000 : undefined,
    salaryMax: salaryMax ? Number(salaryMax) * 1_000_000 : undefined,
    experienceYears: experience?.years,
    industryId: industry || undefined,
    sortBy: sort === 'SALARY' ? 'SALARY' : 'POSTED_AT',
    sortDirection: 'DESC',
    page: needsLocalFilter ? 1 : page,
    pageSize: needsLocalFilter ? LOCAL_FILTER_SIZE : PAGE_SIZE,
  };
  const results = usePublicJobSearch(query);
  const allActiveJobsQuery = usePublicJobSearch({ page: 1, pageSize: 100 });

  // "Tìm nhiều": the most common skills across open jobs (real data, no fixed list).
  const popularSkills = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of allActiveJobsQuery.data?.items ?? []) {
      for (const skill of job.skills ?? []) if (skill.skillName) counts.set(skill.skillName, (counts.get(skill.skillName) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
  }, [allActiveJobsQuery.data?.items]);

  const typeCounts = useMemo(() => {
    const items = allActiveJobsQuery.data?.items;
    if (!items) return {} as Record<string, number>;
    return Object.fromEntries(
      WORK_TYPES.map((type) => [type.key, items.filter((job) => (type.key === REMOTE ? isRemote(job) : job.employmentType === type.key)).length])
    ) as Record<string, number>;
  }, [allActiveJobsQuery.data?.items]);

  const activeLocationCounts = useMemo(() => {
    const items = allActiveJobsQuery.data?.items ?? [];
    const counts: Record<string, number> = {};
    for (const prov of ALL_VIETNAM_PROVINCES) {
      const matchCount = items.filter((j) => j.location && matchProvince(j.location, prov)).length;
      if (matchCount > 0) {
        counts[prov] = matchCount;
      }
    }
    return counts;
  }, [allActiveJobsQuery.data?.items]);

  const activeProvinces = useMemo(
    () => ALL_VIETNAM_PROVINCES.filter((p) => (activeLocationCounts[p] ?? 0) > 0),
    [activeLocationCounts]
  );
  const otherProvinces = useMemo(
    () => ALL_VIETNAM_PROVINCES.filter((p) => !(activeLocationCounts[p] ?? 0)),
    [activeLocationCounts]
  );

  const locationOptions = useMemo(() => {
    const options: any[] = [{ value: '', label: 'Tất cả địa điểm' }];

    if (activeProvinces.length > 0) {
      options.push({
        label: 'Địa điểm có việc tuyển dụng',
        title: 'Địa điểm có việc tuyển dụng',
        options: activeProvinces.map((name) => ({
          value: name,
          label: `${name} (${activeLocationCounts[name]} việc)`,
        })),
      });
    }

    options.push({
      label: 'Tất cả tỉnh thành khác',
      title: 'Tất cả tỉnh thành khác',
      options: otherProvinces.map((name) => ({
        value: name,
        label: name,
      })),
    });

    return options;
  }, [activeProvinces, otherProvinces, activeLocationCounts]);

  const matches = useQuery({
    queryKey: ['candidate-job-matches'],
    queryFn: () => candidateJobMatchApi.getJobMatches(),
    enabled: isCandidate,
    staleTime: 5 * 60_000,
  });
  const fitOf = new Map((matches.data?.items ?? []).map((match) => [match.jobId, match.matchScore]));

  const jobs = (results.data?.items ?? []).filter((job) => {
    if (!needsLocalFilter) return true;
    if (excludeNegotiable && !job.salaryMin && !job.salaryMax) return false;
    if (types.length === 0) return true;
    return types.some((type) => (type === REMOTE ? isRemote(job) : job.employmentType === type));
  });
  const shown = sort === 'FIT' ? [...jobs].sort((a, b) => (fitOf.get(b.jobId) ?? -1) - (fitOf.get(a.jobId) ?? -1)) : jobs;
  const total = needsLocalFilter ? jobs.length : results.data?.totalCount ?? 0;
  const totalPages = needsLocalFilter ? 1 : results.data?.totalPages ?? 1;

  const searchText = [keyword, location && `tại ${location}`].filter(Boolean).join(' ');

  const update = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params);
    change(next);
    if (!next.has('keepPage')) next.delete('page');
    next.delete('keepPage');
    setParams(next);
  };
  const setOrDelete = (next: URLSearchParams, key: string, value: string) => (value ? next.set(key, value) : next.delete(key));

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    update((next) => {
      next.delete('search');
      setOrDelete(next, 'keyword', keywordDraft.trim());
      setOrDelete(next, 'location', locationDraft);
    });
  };
  const applyFilters = () => {
    update((next) => {
      setOrDelete(next, 'salaryMin', positive(minDraft));
      setOrDelete(next, 'salaryMax', positive(maxDraft));
      setOrDelete(next, 'negotiable', negotiableDraft ? 'true' : '');
      setOrDelete(next, 'exp', expDraft);
      setOrDelete(next, 'industry', industryDraft);
      setOrDelete(next, 'modes', typesDraft.join(','));
    });
    setFiltersOpen(false);
  };
  const clearFilters = () => update((next) => ['salaryMin', 'salaryMax', 'negotiable', 'exp', 'industry', 'modes'].forEach((key) => next.delete(key)));
  const goToPage = (target: number) => {
    update((next) => {
      next.set('page', String(target));
      next.set('keepPage', '1');
    });
    window.scrollTo({ top: 0 });
  };

  const salaryChip = salaryMin && salaryMax ? `${salaryMin} – ${salaryMax} triệu` : salaryMin ? `Từ ${salaryMin} triệu` : `Đến ${salaryMax} triệu`;
  const chips = [
    ...(hasSalaryRange ? [{ label: salaryChip, aria: 'mức lương', remove: () => update((next) => { next.delete('salaryMin'); next.delete('salaryMax'); }) }] : []),
    ...(experience ? [{ label: experience.label, aria: 'kinh nghiệm', remove: () => update((next) => next.delete('exp')) }] : []),
    ...(industry ? [{ label: industries.labelOf(industry) ?? 'Ngành nghề', aria: 'ngành nghề', remove: () => update((next) => next.delete('industry')) }] : []),
    ...types.flatMap((type) => {
      const work = WORK_TYPES.find((item) => item.key === type);
      return work ? [{ label: work.label, aria: 'hình thức', remove: () => update((next) => setOrDelete(next, 'modes', types.filter((t) => t !== type).join(','))) }] : [];
    }),
  ];

  const onSave = (job: Job) => {
    if (isAuthenticated) toggleSave(job.jobId, job.title);
    else navigate('/login', { state: { from: pathname + currentSearch } });
  };
  const canSave = !isAuthenticated || isCandidate;
  const actionFor = (job: Job) => {
    if (isCandidate && isApplied(job.jobId)) return 'Đã ứng tuyển';
    return !isAuthenticated || isCandidate ? 'Ứng tuyển' : 'Xem chi tiết';
  };

  return (
    <div className={`min-h-screen w-full bg-[#F7F8FA] ${FONT} text-[14px] text-[#1F2937] [line-height:normal]`}>
      <Navbar />
      <section aria-label="Tìm kiếm việc làm" className="border-0 border-b border-solid border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-[928px] px-4 py-4 sm:px-6">
          <form role="search" onSubmit={submitSearch} className="flex flex-wrap overflow-hidden rounded-lg border border-solid border-[#CBD5E1] bg-white transition-colors focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">
            <label className="relative box-content flex flex-[3_1_320px] items-center gap-2.5 px-3 text-[#6B7280]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span className={SR_ONLY}>Từ khóa</span>
              <input
                type="text"
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                placeholder="Chức danh, kỹ năng, tên công ty"
                className={`${FONT} h-[44px] w-full border-0 bg-transparent px-0.5 text-[14px] text-[#1F2937] outline-none placeholder:text-[#64748B]`}
              />
            </label>
            <div className="relative box-content flex flex-[1_1_200px] items-center gap-2 border-0 px-3 text-[#6B7280] sm:border-l sm:border-solid sm:border-[#E5E7EB]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              <Select
                aria-label="Địa điểm"
                showSearch
                allowClear
                variant="borderless"
                value={locationDraft || undefined}
                placeholder="Tất cả địa điểm"
                onChange={(val) => setLocationDraft(val || '')}
                filterOption={(input, option) => {
                  if (!input) return true;
                  const label = String(option?.label ?? option?.value ?? '');
                  const normInput = removeDiacritics(input).toLowerCase();
                  const normLabel = removeDiacritics(label).toLowerCase();
                  return normLabel.includes(normInput);
                }}
                options={locationOptions}
                className={`${SELECT_TEXT} h-[44px] min-w-0 flex-1 [&_.ant-select-selector]:!px-0 [&_.ant-select-selection-item]:!text-[14px]`}
                popupMatchSelectWidth={false}
              />
            </div>
            <button type="submit" className={`${FONT} h-[44px] cursor-pointer border-0 bg-[#0369A1] px-[24px] text-[14px] font-bold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-[#075985] hover:shadow-md hover:shadow-blue-500/30 active:scale-[0.98] max-sm:w-full`}>Tìm việc</button>
          </form>
          {popularSkills.length > 0 && (
            <p className="m-0 mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] leading-none text-[#475569]">
              <span>Tìm nhiều:</span>
              {popularSkills.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => update((next) => { next.delete('search'); next.set('keyword', skill); })}
                  className={`${FONT} inline-flex min-h-[28px] cursor-pointer items-center border-0 bg-transparent p-0 text-[13px] leading-none ${LINK}`}
                >
                  {skill}
                </button>
              ))}
            </p>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-[1248px] px-4 pb-14 pt-5 sm:px-6">
        <nav aria-label="Đường dẫn" className="mb-[14px] text-[13px] text-[#6B7280]">
          <Link to="/" className={LINK}>Trang chủ</Link> › Việc làm{searchText ? ` › ${searchText}` : ''}
        </nav>

        <div className="flex flex-col items-start gap-5 lg:flex-row">
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
            className={`${FONT} flex h-11 w-full cursor-pointer items-center justify-center rounded-md border border-solid border-[#D1D5DB] bg-white text-[14px] font-medium text-[#1F2937] lg:hidden`}
          >
            Bộ lọc{chips.length > 0 ? ` (${chips.length})` : ''}
          </button>

          <aside aria-label="Bộ lọc" className={`${filtersOpen ? 'flex' : 'hidden'} hrc-fade-up w-full shrink-0 flex-col gap-[22px] rounded-2xl border border-solid border-[#E2E8F0] bg-white p-5 lg:flex lg:w-[290px]`}>
            <div className="flex items-baseline justify-between">
              <b className="text-[15px]">Bộ lọc</b>
              <button type="button" onClick={clearFilters} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`}>Xóa lọc</button>
            </div>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 px-0.5 font-semibold">Mức lương (triệu/tháng)</legend>
              <Select
                aria-label="Mức lương"
                value={salaryRangeKey(minDraft, maxDraft)}
                onChange={(key) => {
                  const range = SALARY_RANGES.find((r) => r.key === key);
                  if (!range) return;
                  setMinDraft(range.min);
                  setMaxDraft(range.max);
                }}
                options={[
                  ...SALARY_RANGES.map((r) => ({ value: r.key, label: r.label })),
                  ...(salaryRangeKey(minDraft, maxDraft) === 'custom'
                    ? [{ value: 'custom', label: `${minDraft || 0} – ${maxDraft || '…'} triệu` }]
                    : []),
                ]}
                className={`${SELECT_TEXT} h-[42px] w-full [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#CBD5E1]`}
              />
              <label className="flex cursor-pointer items-center gap-2 text-[#374151]">
                <Checkbox type="checkbox" checked={negotiableDraft} onChange={(event) => setNegotiableDraft(event.target.checked)} /> Gồm việc lương thương lượng
              </label>
            </fieldset>
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 px-0.5 font-semibold">Kinh nghiệm</legend>
              <div role="radiogroup" aria-label="Kinh nghiệm" className="flex flex-wrap gap-2">
                {EXPERIENCE.map((level) => {
                  const on = expDraft === level.key;
                  return (
                    <button
                      key={level.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setExpDraft(on ? '' : level.key)}
                      className={`${FONT} min-h-[36px] cursor-pointer rounded-full border border-solid px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 max-lg:min-h-[44px] ${on ? 'border-sky-500 bg-sky-50 text-sky-700 font-semibold' : 'border-[#CBD5E1] bg-white text-[#334155] hover:border-[#94A3B8]'}`}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend id="industry-label" className="mb-2 px-0.5 font-semibold">Ngành nghề</legend>
              <Select
                aria-labelledby="industry-label"
                showSearch
                allowClear
                value={industryDraft || undefined}
                placeholder="Tất cả ngành nghề"
                loading={industries.isLoading}
                onChange={(value) => setIndustryDraft(value || '')}
                optionFilterProp="label"
                options={industries.options}
                className={`${SELECT_TEXT} h-[38px] w-full [&_.ant-select-selector]:!rounded-md [&_.ant-select-selector]:!border-[#D1D5DB]`}
                popupMatchSelectWidth={false}
              />
            </fieldset>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 px-0.5 font-semibold">Hình thức làm việc</legend>
              {WORK_TYPES.map((type) => (
                <label key={type.key} className="flex min-h-[32px] cursor-pointer items-center justify-between gap-2 text-[#334155]">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      type="checkbox"
                      checked={typesDraft.includes(type.key)}
                      onChange={(event) => setTypesDraft((current) => (event.target.checked ? [...current, type.key] : current.filter((key) => key !== type.key)))}
                    /> {type.label}
                  </span>
                  {typeCounts[type.key] !== undefined && <span className="text-[12px] text-[#64748B]">{typeCounts[type.key]}</span>}
                </label>
              ))}
            </fieldset>
            <button type="button" onClick={applyFilters} className={`${FONT} h-11 cursor-pointer rounded-xl border-0 bg-[#0369A1] px-5 text-[14px] font-bold text-white shadow-sm shadow-blue-500/25 transition-all hover:bg-[#075985] hover:shadow-md hover:shadow-blue-500/35 active:scale-[0.98]`}>Áp dụng</button>
          </aside>

          <section aria-labelledby="results" className="w-full min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h1 id="results" className="m-0 text-[18px] font-bold text-[#1F2937]">
                {results.isLoading ? 'Đang tìm việc làm…' : `${total.toLocaleString('vi-VN')} việc làm${searchText ? ` ${searchText}` : ''}`}
              </h1>
              <div className="flex items-center gap-2 text-[#4B5563]">
                <span id="sort-label">Sắp xếp</span>
                <Select
                  aria-labelledby="sort-label"
                  value={sort}
                  onChange={(value) => update((next) => next.set('sort', value))}
                  options={SORTS.filter((option) => !option.candidateOnly || isCandidate).map(({ value, label }) => ({ value, label }))}
                  className={`${SELECT_TEXT} h-9 w-[150px] [&_.ant-select-selector]:!rounded-md [&_.ant-select-selector]:!border-[#D1D5DB]`}
                  popupMatchSelectWidth={false}
                />
              </div>
            </div>

            {chips.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 text-[13px]">
                {chips.map((chip) => (
                  <span key={chip.label} className="inline-flex items-center gap-1.5 rounded bg-[#E0F2FE] py-1 pl-2.5 pr-1 text-[#075985]">
                    {chip.label}
                    <button type="button" aria-label={`Bỏ lọc ${chip.aria}`} onClick={chip.remove} className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0 text-[#075985]">×</button>
                  </span>
                ))}
              </div>
            )}

            {results.isError ? (
              <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white px-6 py-12 text-center">
                <h2 className="m-0 text-[16px] font-bold">Không tải được danh sách việc làm</h2>
                <button type="button" onClick={() => results.refetch()} className={`${FONT} mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}>Thử lại</button>
              </div>
            ) : results.isLoading ? (
              <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white p-4"><Skeleton active avatar paragraph={{ rows: 6 }} /></div>
            ) : shown.length === 0 ? (
              <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white px-6 py-12 text-center">
                <h2 className="m-0 text-[16px] font-bold">Không tìm thấy việc làm phù hợp</h2>
                <p className="m-0 mt-2 text-[#4B5563]">Thử bỏ bớt bộ lọc hoặc đổi từ khóa khác.</p>
                {chips.length > 0 && <button type="button" onClick={clearFilters} className={`${FONT} mt-3 cursor-pointer border-0 bg-transparent p-0 font-semibold ${LINK}`}>Xóa lọc</button>}
              </div>
            ) : (
              <div aria-busy={results.isFetching && !results.isLoading} className="hrc-dim hrc-stagger flex flex-col gap-3" key={`${page}-${currentSearch}`}>
                {shown.map((job) => (
                  <JobRow key={job.jobId} job={job} fit={fitOf.get(job.jobId)} canSave={canSave} saved={isCandidate && isSaved(job.jobId)} onSave={() => onSave(job)} action={actionFor(job)} applied={isCandidate && isApplied(job.jobId)} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <nav aria-label="Phân trang" className="mt-5 flex flex-wrap items-start justify-center gap-1.5">
                <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => goToPage(page - 1)} className={`${PAGE_OTHER} ${FONT} disabled:cursor-not-allowed disabled:opacity-50`}>‹</button>
                {pageList(page, totalPages).map((p, index) =>
                  p === null ? (
                    <span key={`gap-${index}`} className={`${PAGE_BUTTON} h-10 w-10 text-[#6B7280]`}>…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      aria-current={p === page ? 'page' : undefined}
                      onClick={() => goToPage(p)}
                      className={`${FONT} ${p === page ? `${PAGE_BUTTON} h-10 w-10 cursor-pointer border-0 bg-[#0369A1] font-bold text-white shadow-xs` : PAGE_OTHER}`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button type="button" aria-label="Trang sau" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className={`${PAGE_OTHER} ${FONT} disabled:cursor-not-allowed disabled:opacity-50`}>›</button>
              </nav>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default PublicJobSplitDiscovery;
