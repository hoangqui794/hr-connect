/**
 * @file SiteParts.tsx
 * @description Pieces shared by the public site and the Candidate workspace (mockup 03/11): company mark,
 * job card, search band and footer.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { resolveApiAssetUrl } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { BrandMark } from '@/components/common/BrandMark';

export const initialsOf = (name?: string | null) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'HR';

export const CompanyMark: React.FC<{ name?: string | null; logoUrl?: string | null; size?: number }> = ({ name, logoUrl, size = 56 }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveApiAssetUrl(logoUrl);
  // The mockup's size is the content box; the 1px border sits outside it.
  const box = { width: size + 2, height: size + 2 };
  return src && !failed ? (
    <img src={src} alt="" style={box} onError={() => setFailed(true)} className="shrink-0 rounded-md border border-solid border-gray-200 bg-white object-contain" />
  ) : (
    <span aria-hidden style={box} className={`flex shrink-0 items-center justify-center rounded-md border border-solid border-gray-200 bg-white font-bold text-[#0C4A6E] ${size < 48 ? 'text-[12px]' : 'text-[13px]'}`}>
      {initialsOf(name)}
    </span>
  );
};

/** "25 – 35 triệu" for VND, the raw numbers otherwise. */
export const salaryText = (job: { salaryMin?: number | null; salaryMax?: number | null; salaryNegotiable?: boolean; currencyCode?: string | null }) => {
  const { salaryMin: min, salaryMax: max, currencyCode } = job;
  if (job.salaryNegotiable || (!min && !max)) return 'Thương lượng';
  if (currencyCode && currencyCode !== 'VND') return [min, max].filter(Boolean).map((v) => v!.toLocaleString('vi-VN')).join(' – ') + ` ${currencyCode}`;
  const m = (v: number) => (v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (min && max) return min === max ? `${m(min)} triệu` : `${m(min)} – ${m(max)} triệu`;
  return min ? `Từ ${m(min)} triệu` : `Đến ${m(max!)} triệu`;
};

export const postedText = (date?: string | null) => {
  if (!date) return '';
  const days = dayjs().startOf('day').diff(dayjs(date).startOf('day'), 'day');
  return days <= 0 ? 'Hôm nay' : `${days} ngày trước`;
};

export const jobHref = (jobId: string, role?: UserRole, isAuthenticated?: boolean) =>
  isAuthenticated && role === UserRole.CANDIDATE ? `/candidate/jobs/${jobId}` : `/jobs/${jobId}`;

export const SaveJobButton: React.FC<{ jobId: string; title: string }> = ({ jobId, title }) => {
  const { isAuthenticated, role } = useAuthStore();
  const navigate = useNavigate();
  const { isSaved, toggleSaveJob } = useSavedJobs();
  const saved = isAuthenticated && isSaved(jobId);
  return (
    <button
      type="button"
      aria-label={saved ? `Bỏ lưu ${title}` : `Lưu ${title}`}
      aria-pressed={saved}
      onClick={() => {
        if (!isAuthenticated) navigate('/login', { state: { from: window.location.pathname } });
        else if (role === UserRole.CANDIDATE) void toggleSaveJob(jobId);
      }}
      className="-mr-2.5 -mt-2.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center self-start rounded-md border-0 bg-transparent text-gray-500 transition-colors duration-150 hover:text-[#C2410C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? '#C2410C' : 'none'} stroke={saved ? '#C2410C' : 'currentColor'} strokeWidth="1.8" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
      </svg>
    </button>
  );
};

export interface JobCardData {
  jobId: string;
  title: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  location?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean;
  currencyCode?: string | null;
  postedAt?: string | null;
}

export const JobCard: React.FC<{ job: JobCardData; saveable?: boolean }> = ({ job, saveable = true }) => {
  const { isAuthenticated, role } = useAuthStore();
  const canSave = saveable && (!isAuthenticated || role === UserRole.CANDIDATE);
  return (
    <article className="flex min-w-0 gap-3 rounded-lg border border-solid border-gray-200 bg-white p-3.5">
      <CompanyMark name={job.companyName} logoUrl={job.companyLogoUrl} />
      <div className="min-w-0 flex-1">
        <Link to={jobHref(job.jobId, role, isAuthenticated)} title={job.title} className="block truncate text-[15px] font-semibold text-gray-900 no-underline hover:text-sky-800">
          {job.title}
        </Link>
        <div className="mt-0.5 truncate text-[13px] text-gray-600">{job.companyName || 'Doanh nghiệp tuyển dụng'}</div>
        <div className="mt-1.5 font-semibold text-[#C2410C]">{salaryText(job)}</div>
        <div className="mt-0.5 truncate text-[13px] text-gray-500">{[job.location, postedText(job.postedAt)].filter(Boolean).join(' · ')}</div>
      </div>
      {canSave && <SaveJobButton jobId={job.jobId} title={job.title} />}
    </article>
  );
};

const CITIES = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng'];

/** The white search box on the navy band under the header. Goes to the job list of the current role. */
export const SearchForm: React.FC<{ defaultKeyword?: string; defaultLocation?: string }> = ({ defaultKeyword = '', defaultLocation = '' }) => {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [location, setLocation] = useState(defaultLocation);
  const candidate = isAuthenticated && role === UserRole.CANDIDATE;
  return (
    <form
      role="search"
      className="flex flex-wrap gap-2 rounded-lg bg-white p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(candidate ? { tab: 'all' } : {});
        if (keyword.trim()) params.set('keyword', keyword.trim());
        if (location) params.set('location', location);
        const q = params.toString();
        navigate(`${candidate ? '/candidate/jobs' : '/jobs'}${q ? `?${q}` : ''}`);
      }}
    >
      <label className="flex min-w-[240px] flex-[3_1_344px] items-center gap-2.5 px-3 text-gray-500">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <span className="sr-only">Từ khóa</span>
        <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Chức danh, kỹ năng, tên công ty" className="h-[46px] w-full border-0 bg-transparent text-[15px] text-gray-800 outline-none placeholder:text-gray-500" />
      </label>
      <label className="flex min-w-[180px] flex-[1_1_225px] items-center gap-2 border-0 border-l border-solid border-gray-200 px-3 text-gray-500 max-sm:border-l-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
        <span className="sr-only">Địa điểm</span>
        <select value={location} onChange={(e) => setLocation(e.target.value)} className="h-[46px] w-full border-0 bg-transparent text-[15px] text-gray-800 outline-none">
          <option value="">Tất cả địa điểm</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button type="submit" className="h-11 flex-none cursor-pointer rounded-md border-0 bg-[#C2410C] px-7 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#9A3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 max-sm:w-full">
        Tìm việc
      </button>
    </form>
  );
};

/** Candidate pages: one line. Terms and privacy pages do not exist yet, so only working links are shown. */
export const CompactFooter: React.FC = () => (
  <footer className="border-0 border-t border-solid border-gray-200 bg-white">
    <div className="mx-auto flex max-w-[1248px] flex-wrap justify-between gap-4 p-6 text-[13px] text-gray-600">
      <span>© 2026 HR Connect</span>
      <span className="flex flex-wrap gap-[18px]"><Link to="/contact" className="text-sky-700 no-underline hover:text-sky-900 hover:underline">Liên hệ</Link></span>
    </div>
  </footer>
);

export const SiteFooter: React.FC = () => {
  const columns: { title: string; links: [string, string][] }[] = [
    { title: 'Người tìm việc', links: [['Tìm việc làm', '/jobs'], ['Tạo CV', '/candidate/cv-builder'], ['Danh sách công ty', '/companies']] },
    { title: 'Nhà tuyển dụng', links: [['Đăng tin tuyển dụng', '/services'], ['Tuyển qua Affiliate', '/services'], ['Mua CV theo số lượng', '/services']] },
    { title: 'Hỗ trợ', links: [['Liên hệ', '/contact'], ['Trở thành Affiliate', '/register/affiliate']] },
  ];
  return (
    <footer className="border-0 border-t border-solid border-gray-200 bg-white">
      <div className="mx-auto grid max-w-[1248px] grid-cols-2 gap-6 px-4 py-8 text-[13px] text-gray-600 sm:px-6 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-[16px] font-bold text-[#0C4A6E]"><BrandMark size={28} /> HR Connect</div>
          <p className="m-0 mt-2">Nền tảng tuyển dụng kết nối doanh nghiệp, ứng viên và Affiliate tại Việt Nam.</p>
        </div>
        {columns.map((c) => (
          <div key={c.title} className="flex flex-col gap-2">
            <b className="text-gray-900">{c.title}</b>
            {c.links.map(([label, to]) => <Link key={label} to={to} className="text-sky-700 no-underline hover:text-sky-900 hover:underline">{label}</Link>)}
          </div>
        ))}
      </div>
    </footer>
  );
};
