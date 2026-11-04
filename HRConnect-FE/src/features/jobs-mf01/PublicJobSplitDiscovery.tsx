/**
 * @file PublicJobSplitDiscovery.tsx
 * @description Job search at /jobs (mockup 03/11, Jobs.dc.html) on GET /public/jobs. The URL holds the search and the applied filters.
 *  The API takes one employment type and always includes negotiable salaries; anything beyond that is filtered here
 *  over the first 100 results (see needsLocalFilter).
 */
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
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

const LOCATIONS = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Bình Dương', 'Cần Thơ'];

const SORTS = [
  { value: 'FIT', label: 'Phù hợp nhất', candidateOnly: true },
  { value: 'LATEST', label: 'Mới đăng' },
  { value: 'SALARY', label: 'Lương cao nhất' },
];

const SR_ONLY = 'absolute left-[-9999px]';
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

const JobRow: React.FC<{ job: Job; fit?: number; canSave: boolean; saved: boolean; onSave: () => void; action: string }> = ({ job, fit, canSave, saved, onSave, action }) => {
  const deadline = job.applicationDeadline ?? job.expiresAt;
  const href = jobHref(job.jobId);
  return (
    <article className="flex flex-wrap gap-[14px] border-0 border-b border-solid border-[#F1F5F9] p-4">
      <CompanyMark name={job.companyName} logoUrl={job.companyLogoUrl} size={66} />
      <div className="min-w-0 flex-[1_1_360px]">
        <Link to={href} className="text-[16px] font-semibold text-[#111827] no-underline hover:text-[#075985] hover:underline">{job.title}</Link>
        <div className="mt-0.5 text-[#4B5563]">{job.companyName}</div>
        <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-[#4B5563]">
          <span className="text-[14px] font-semibold text-[#C2410C]">{salaryText(job)}</span>
          {job.location && <span>{job.location}</span>}
          <span>{experienceText(job.minExperienceYears, job.maxExperienceYears)}</span>
          {job.employmentType && <span>{EMPLOYMENT_TYPE_LABEL[job.employmentType]}</span>}
        </div>
        {job.skills?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.skills.map((skill) => (
              <span key={skill.skillId} className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#374151]">{skill.skillName}</span>
            ))}
          </div>
        )}
      </div>
      <div className="flex w-full flex-col items-start gap-2 sm:w-[180px] sm:flex-none sm:items-end sm:text-right">
        {fit !== undefined && (
          <span className="rounded border border-solid border-[#CBD5E1] bg-[#F8FAFC] px-2 py-0.5 text-[12px] font-semibold text-[#1E293B]">Phù hợp {Math.round(fit)}%</span>
        )}
        <span className="text-[12px] text-[#6B7280]">
          {postedText(job.postedAt)}{deadline ? ` · Hạn ${dayjs(deadline).format('DD/MM')}` : ''}
        </span>
        <div className="flex gap-1.5 sm:mt-auto">
          {canSave && (
            <button
              type="button"
              aria-label={saved ? `Bỏ lưu ${job.title}` : `Lưu ${job.title}`}
              aria-pressed={saved}
              onClick={onSave}
              className="flex h-10 w-11 cursor-pointer items-center justify-center rounded-md border border-solid border-[#D1D5DB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? '#C2410C' : 'none'} stroke={saved ? '#C2410C' : 'currentColor'} strokeWidth="1.8" aria-hidden="true">
                <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
              </svg>
            </button>
          )}
          <Link to={href} className="flex h-10 items-center rounded-md bg-[#C2410C] px-[14px] font-semibold text-white no-underline hover:bg-[#9A3412] hover:text-white">{action}</Link>
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
  const types = (params.get('modes') || '').split(',').filter(Boolean);
  const experience = EXPERIENCE.find((level) => level.key === expKey);

  // Drafts until the visitor submits.
  const [keywordDraft, setKeywordDraft] = useState(keyword);
  const [locationDraft, setLocationDraft] = useState(location);
  const [minDraft, setMinDraft] = useState(salaryMin);
  const [maxDraft, setMaxDraft] = useState(salaryMax);
  const [negotiableDraft, setNegotiableDraft] = useState(negotiable);
  const [expDraft, setExpDraft] = useState(expKey);
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
    setTypesDraft(typesKey ? typesKey.split(',') : []);
  }, [keyword, location, salaryMin, salaryMax, negotiable, expKey, typesKey]);

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
    sortBy: sort === 'SALARY' ? 'SALARY' : 'POSTED_AT',
    sortDirection: 'DESC',
    page: needsLocalFilter ? 1 : page,
    pageSize: needsLocalFilter ? LOCAL_FILTER_SIZE : PAGE_SIZE,
  };
  const results = usePublicJobSearch(query);

  const matches = useQuery({
    queryKey: ['candidate-job-matches'],
    queryFn: () => candidateJobMatchApi.getJobMatches(),
    enabled: isCandidate,
    staleTime: 5 * 60_000,
  });
  const fitOf = new Map((matches.data?.items ?? []).map((match) => [match.jobId, match.matchScore]));

  const jobs = (results.data?.items ?? []).filter((job) => {
    if (!needsLocalFilter) return true;
    if (excludeNegotiable && (job.salaryNegotiable || (!job.salaryMin && !job.salaryMax))) return false;
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
      setOrDelete(next, 'modes', typesDraft.join(','));
    });
    setFiltersOpen(false);
  };
  const clearFilters = () => update((next) => ['salaryMin', 'salaryMax', 'negotiable', 'exp', 'modes'].forEach((key) => next.delete(key)));
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
      <div className="bg-[#0C4A6E]">
        <div className="mx-auto max-w-[1248px] px-4 pb-5 pt-3 sm:px-6">
          <form role="search" onSubmit={submitSearch} className="flex flex-wrap gap-2 rounded-lg bg-white p-1.5">
            <label className="relative box-content flex flex-[3_1_320px] items-center gap-2.5 px-3 text-[#6B7280]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span className={SR_ONLY}>Từ khóa</span>
              <input
                type="text"
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                placeholder="Chức danh, kỹ năng, tên công ty"
                className={`${FONT} h-[44px] w-full border-0 bg-transparent px-0.5 text-[15px] text-[#1F2937] outline-none placeholder:text-[#6B7280]`}
              />
            </label>
            <label className="relative box-content flex flex-[1_1_200px] items-center gap-2 border-0 px-3 text-[#6B7280] sm:border-l sm:border-solid sm:border-[#E5E7EB]">
              <span className={SR_ONLY}>Địa điểm</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              <select value={locationDraft} onChange={(event) => setLocationDraft(event.target.value)} className={`${FONT} h-[42px] w-full border-0 bg-transparent text-[15px] text-[#1F2937] outline-none`}>
                <option value="">Tất cả địa điểm</option>
                {LOCATIONS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <button type="submit" className={`${FONT} h-[42px] cursor-pointer self-start rounded-md border-0 bg-[#C2410C] px-[26px] text-[15px] font-semibold text-white hover:bg-[#9A3412] max-sm:w-full`}>Tìm việc</button>
          </form>
        </div>
      </div>

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

          <aside aria-label="Bộ lọc" className={`${filtersOpen ? 'flex' : 'hidden'} w-full shrink-0 flex-col gap-[18px] rounded-lg border border-solid border-[#E5E7EB] bg-white p-4 lg:flex lg:w-[284.3px]`}>
            <div className="flex items-baseline justify-between">
              <b className="text-[15px]">Bộ lọc</b>
              <button type="button" onClick={clearFilters} className={`${FONT} cursor-pointer border-0 bg-transparent p-0 text-[13px] ${LINK}`}>Xóa lọc</button>
            </div>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 px-0.5 font-semibold">Mức lương (triệu/tháng)</legend>
              <div className="flex items-center gap-2">
                <label className="relative min-w-0 flex-1">
                  <span className={SR_ONLY}>Từ</span>
                  <input type="number" min="0" value={minDraft} onChange={(event) => setMinDraft(event.target.value)} className={`${FONT} h-[38px] w-full rounded-md border border-solid border-[#D1D5DB] px-2.5 text-[14px] text-[#1F2937]`} />
                </label>
                <span className="text-[#6B7280]">–</span>
                <label className="relative min-w-0 flex-1">
                  <span className={SR_ONLY}>Đến</span>
                  <input type="number" min="0" value={maxDraft} onChange={(event) => setMaxDraft(event.target.value)} className={`${FONT} h-[38px] w-full rounded-md border border-solid border-[#D1D5DB] px-2.5 text-[14px] text-[#1F2937]`} />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[#374151]">
                <Checkbox type="checkbox" checked={negotiableDraft} onChange={(event) => setNegotiableDraft(event.target.checked)} /> Gồm việc lương thương lượng
              </label>
            </fieldset>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 px-0.5 font-semibold">Kinh nghiệm</legend>
              {EXPERIENCE.map((level) => (
                <label key={level.key} className="flex cursor-pointer items-center gap-2">
                  <Checkbox type="radio" name="exp" checked={expDraft === level.key} onChange={() => setExpDraft(level.key)} /> {level.label}
                </label>
              ))}
            </fieldset>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 px-0.5 font-semibold">Hình thức làm việc</legend>
              {WORK_TYPES.map((type) => (
                <label key={type.key} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    type="checkbox"
                    checked={typesDraft.includes(type.key)}
                    onChange={(event) => setTypesDraft((current) => (event.target.checked ? [...current, type.key] : current.filter((key) => key !== type.key)))}
                  /> {type.label}
                </label>
              ))}
            </fieldset>
            <button type="button" onClick={applyFilters} className={`${FONT} h-10 cursor-pointer rounded-md border border-solid border-[#0C4A6E] bg-[#0C4A6E] text-[14px] font-semibold text-white hover:bg-[#075985]`}>Áp dụng</button>
          </aside>

          <section aria-labelledby="results" className="w-full min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h1 id="results" className="m-0 text-[18px] font-bold text-[#1F2937]">
                {results.isLoading ? 'Đang tìm việc làm…' : `${total.toLocaleString('vi-VN')} việc làm${searchText ? ` ${searchText}` : ''}`}
              </h1>
              <label className="flex items-center gap-2 text-[#4B5563]">
                Sắp xếp
                <select
                  value={sort}
                  onChange={(event) => update((next) => next.set('sort', event.target.value))}
                  className={`${FONT} h-9 rounded-md border border-solid border-[#D1D5DB] bg-white px-2.5 text-[14px] text-[#1F2937]`}
                >
                  {SORTS.filter((option) => !option.candidateOnly || isCandidate).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
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
              <div className="rounded-lg border border-solid border-[#E5E7EB] bg-white">
                {shown.map((job) => (
                  <JobRow key={job.jobId} job={job} fit={fitOf.get(job.jobId)} canSave={canSave} saved={isCandidate && isSaved(job.jobId)} onSave={() => onSave(job)} action={actionFor(job)} />
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
                      className={`${FONT} ${p === page ? `${PAGE_BUTTON} h-10 w-10 cursor-pointer border-0 bg-[#0C4A6E] font-semibold text-white` : PAGE_OTHER}`}
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
