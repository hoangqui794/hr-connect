/**
 * @file SiteParts.tsx
 * @description Pieces shared by the public site and the Candidate workspace (mockup 03/11): company mark,
 * job card, search band and footer.
 */
import React, { useState } from 'react';
import { Dropdown } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { resolveApiAssetUrl } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { ALL_VIETNAM_PROVINCES, removeDiacritics } from '@/features/jobs-mf01/PublicJobSplitDiscovery';
import { useSavedJobs } from '@/hooks/useSavedJobs';
import { BrandMark } from '@/components/common/BrandMark';
import { CompanyLogo } from './CompanyLogo';

export const initialsOf = (name?: string | null) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'HR';

export const CompanyMark: React.FC<{ name?: string | null; logoUrl?: string | null; size?: number }> = ({ name, logoUrl, size = 56 }) => {
  return (
    <div style={{ width: size, height: size }} className="shrink-0 overflow-hidden rounded-lg border border-solid border-gray-200 bg-white flex items-center justify-center p-0.5 shadow-xs">
      <CompanyLogo companyName={name || ''} logoUrl={logoUrl} size={size - 4} />
    </div>
  );
};

/** "25 – 35 triệu" for VND, the raw numbers otherwise. */
export const salaryText = (job: { salaryMin?: number | null; salaryMax?: number | null; salaryNegotiable?: boolean; currencyCode?: string | null }) => {
  const { salaryMin: min, salaryMax: max, currencyCode } = job;
  if (!min && !max) return job.salaryNegotiable ? 'Thương lượng' : 'Thỏa thuận';
  if (currencyCode && currencyCode !== 'VND') {
    const raw = [min, max].filter(Boolean).map((v) => v!.toLocaleString('vi-VN')).join(' – ') + ` ${currencyCode}`;
    return job.salaryNegotiable ? `${raw} (Thương lượng)` : raw;
  }
  const m = (v: number) => (v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  let range = '';
  if (min && max) range = min === max ? `${m(min)} triệu` : `${m(min)} – ${m(max)} triệu`;
  else if (min) range = `Từ ${m(min)} triệu`;
  else range = `Đến ${m(max!)} triệu`;
  return job.salaryNegotiable ? `${range} (Thương lượng)` : range;
};

export const postedText = (date?: string | null) => {
  if (!date) return 'Hôm nay';
  const days = dayjs().startOf('day').diff(dayjs(date).startOf('day'), 'day');
  return days <= 0 ? 'Hôm nay' : `${days} ngày trước`;
};

export const jobHref = (jobId: string, _role?: UserRole, _isAuthenticated?: boolean): string => '/jobs/' + jobId;

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
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthenticated) navigate('/login', { state: { from: window.location.pathname } });
        else if (role === UserRole.CANDIDATE) void toggleSaveJob(jobId);
      }}
      className="-mr-1.5 -mt-1.5 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center self-start rounded-md border-0 bg-transparent text-gray-400 transition-colors duration-150 hover:text-[#C2410C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600"
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
    <article className="group flex min-w-0 gap-3.5 rounded-lg border border-solid border-gray-200 bg-white p-3.5 transition-all duration-200 hover:border-sky-300 hover:shadow-sm">
      <CompanyMark name={job.companyName} logoUrl={job.companyLogoUrl} size={54} />
      <div className="min-w-0 flex-1">
        <Link to={jobHref(job.jobId, role, isAuthenticated)} title={job.title} className="block truncate text-[15px] font-bold text-gray-900 no-underline transition-colors group-hover:text-sky-800">
          {job.title}
        </Link>
        <div className="mt-0.5 truncate text-[13px] text-gray-600">{job.companyName || 'Doanh nghiệp tuyển dụng'}</div>
        <div className="mt-1 font-semibold text-[#C2410C] text-[14px]">{salaryText(job)}</div>
        <div className="mt-1 truncate text-[12px] text-gray-500">{[job.location, postedText(job.postedAt)].filter(Boolean).join(' · ')}</div>
      </div>
      {canSave && <SaveJobButton jobId={job.jobId} title={job.title} />}
    </article>
  );
};

const LOCATION_OPTIONS = [
  { value: '', label: 'Tất cả địa điểm', region: 'Toàn quốc', isAll: true },
  { value: 'Hồ Chí Minh', label: 'Hồ Chí Minh', region: 'Miền Nam' },
  { value: 'Hà Nội', label: 'Hà Nội', region: 'Miền Bắc' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng', region: 'Miền Trung' },
  { value: 'Bình Dương', label: 'Bình Dương', region: 'Đông Nam Bộ' },
  { value: 'Cần Thơ', label: 'Cần Thơ', region: 'Tây Nam Bộ' },
];

/** Standalone job search panel below the site header. Goes to the job list of the current role. */
export const SearchForm: React.FC<{ defaultKeyword?: string; defaultLocation?: string }> = ({ defaultKeyword = '', defaultLocation = '' }) => {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [location, setLocation] = useState(defaultLocation);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [locFilter, setLocFilter] = useState('');
  const candidate = isAuthenticated && role === UserRole.CANDIDATE;

  const popularLocations = [
    { value: '', label: 'Tất cả địa điểm', region: 'Toàn quốc', isAll: true },
    { value: 'Hồ Chí Minh', label: 'Hồ Chí Minh', region: 'Miền Nam' },
    { value: 'Hà Nội', label: 'Hà Nội', region: 'Miền Bắc' },
    { value: 'Đà Nẵng', label: 'Đà Nẵng', region: 'Miền Trung' },
    { value: 'Bình Dương', label: 'Bình Dương', region: 'Đông Nam Bộ' },
    { value: 'Hải Phòng', label: 'Hải Phòng', region: 'Miền Bắc' },
    { value: 'Đồng Nai', label: 'Đồng Nai', region: 'Đông Nam Bộ' },
    { value: 'Cần Thơ', label: 'Cần Thơ', region: 'Tây Nam Bộ' },
  ];

  const visibleLocationOptions = React.useMemo(() => {
    if (!locFilter.trim()) {
      return popularLocations;
    }
    const norm = removeDiacritics(locFilter).toLowerCase();
    const all = [
      { value: '', label: 'Tất cả địa điểm', region: 'Toàn quốc', isAll: true },
      ...ALL_VIETNAM_PROVINCES.map((p) => ({ value: p, label: p, region: 'Việt Nam', isAll: false })),
    ];
    return all.filter((opt) => removeDiacritics(opt.label).toLowerCase().includes(norm));
  }, [locFilter]);

  return (
    <form
      role="search"
      className="flex flex-wrap gap-2 rounded-xl border border-solid border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams(candidate ? { tab: 'all' } : {});
        if (keyword.trim()) params.set('keyword', keyword.trim());
        if (location) params.set('location', location);
        const q = params.toString();
        navigate(`/jobs${q ? `?${q}` : ''}`);
      }}
    >
      <label className="flex min-w-[240px] flex-[3_1_344px] items-center gap-2.5 px-3 text-slate-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-slate-400">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <span className="sr-only">Từ khóa</span>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Chức danh, kỹ năng, tên công ty"
          className="h-[46px] w-full border-0 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400 font-normal"
        />
      </label>

      {/* Modern High-End Location Selector */}
      <div className="relative flex min-w-[200px] flex-[1_1_235px] items-center border-0 border-l border-solid border-slate-200 px-2 max-sm:border-l-0">
        <Dropdown
          open={dropdownOpen}
          onOpenChange={setDropdownOpen}
          trigger={['click']}
          placement="bottomLeft"
          popupRender={() => (
            <div
              role="listbox"
              aria-label="Chọn địa điểm làm việc"
              className="w-[300px] overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/15 ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between border-b border-solid border-slate-100 px-3 pb-2 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>Địa điểm làm việc</span>
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                  {visibleLocationOptions.length} khu vực
                </span>
              </div>
              <div className="px-2 pt-2 pb-1">
                <input
                  type="text"
                  value={locFilter}
                  onChange={(e) => setLocFilter(e.target.value)}
                  placeholder="Nhập tỉnh thành tìm kiếm..."
                  className="w-full rounded-lg border border-solid border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] outline-none focus:border-sky-500 focus:bg-white"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="mt-1 max-h-[240px] overflow-y-auto space-y-1">
                {visibleLocationOptions.map((loc) => {
                  const isSelected = location === loc.value;
                  return (
                    <button
                      key={loc.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setLocation(loc.value);
                        setDropdownOpen(false);
                      }}
                      className={`group flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left transition-all duration-150 border-0 outline-none ${
                        isSelected
                          ? 'bg-sky-50/90 font-semibold text-sky-950 shadow-sm ring-1 ring-sky-500/20'
                          : 'bg-transparent text-slate-800 hover:bg-slate-100/80 hover:text-slate-950'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-sky-100 group-hover:text-sky-700'
                          }`}
                        >
                          {loc.isAll ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M2 12h20" />
                              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" />
                              <circle cx="12" cy="10" r="2.5" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className={`text-[14px] leading-tight ${isSelected ? 'font-bold text-sky-950' : 'font-medium text-slate-800 group-hover:text-slate-950'}`}>
                            {loc.label}
                          </div>
                          <div className={`text-[11px] ${isSelected ? 'text-sky-700 font-medium' : 'text-slate-400 group-hover:text-slate-500'}`}>
                            {loc.region}
                          </div>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                          Chọn
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        >
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className={`group flex h-[46px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 px-2.5 transition-all outline-none ${
              dropdownOpen ? 'bg-slate-100/90 ring-1 ring-slate-200' : 'bg-transparent hover:bg-slate-50'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                  location ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </div>
              <span className={`truncate text-[14.5px] ${location ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                {location || 'Tất cả địa điểm'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {location && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Xóa địa điểm đã chọn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation('');
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </span>
              )}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180 text-sky-600' : 'group-hover:text-slate-600'}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </button>
        </Dropdown>
      </div>

      <button type="submit" className="h-11 flex-none cursor-pointer rounded-md border-0 bg-[#C2410C] px-7 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#9A3412] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 max-sm:w-full">
        Tìm việc
      </button>
    </form>
  );
};

export const CompactFooter: React.FC = () => (
  <footer className="border-0 border-t border-solid border-gray-200 bg-white">
    <div className="mx-auto flex max-w-[1248px] flex-wrap justify-between items-center gap-4 py-5 px-4 sm:px-6 text-[13px] text-gray-600">
      <span>© 2026 HR Connect</span>
      <div className="flex flex-wrap items-center gap-4 text-[13px]">
        <Link to="/contact" className="text-gray-600 no-underline hover:text-sky-800 hover:underline">Liên hệ</Link>
        <span className="text-gray-300">·</span>
        <Link to="/contact" className="text-gray-600 no-underline hover:text-sky-800 hover:underline">Điều khoản sử dụng</Link>
        <span className="text-gray-300">·</span>
        <Link to="/contact" className="text-gray-600 no-underline hover:text-sky-800 hover:underline">Chính sách bảo mật</Link>
      </div>
    </div>
  </footer>
);

export const SiteFooter: React.FC = () => {
  const columns: { title: string; links: [string, string][] }[] = [
    { title: 'Người tìm việc', links: [['Tìm việc làm', '/jobs'], ['Tạo CV', '/candidate/cv-builder'], ['Danh sách công ty', '/companies']] },
    { title: 'Nhà tuyển dụng', links: [['Đăng tin tuyển dụng', '/services'], ['Tuyển qua Affiliate', '/services'], ['Mua CV theo số lượng', '/services']] },
    { title: 'Hỗ trợ', links: [['Liên hệ', '/contact'], ['Điều khoản sử dụng', '/contact'], ['Chính sách bảo mật', '/contact']] },
  ];
  return (
    <footer className="border-0 border-t border-solid border-gray-200 bg-white">
      <div className="mx-auto grid max-w-[1248px] grid-cols-2 gap-8 px-4 py-10 text-[13px] text-gray-600 sm:px-6 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5 text-[17px] font-bold text-[#0C4A6E]"><BrandMark size={28} /> HR Connect</div>
          <p className="m-0 mt-3 text-gray-600 leading-relaxed">Nền tảng tuyển dụng kết nối doanh nghiệp, ứng viên và Affiliate tại Việt Nam.</p>
        </div>
        {columns.map((c) => (
          <div key={c.title} className="flex flex-col gap-2.5">
            <b className="text-gray-900 text-[14px]">{c.title}</b>
            {c.links.map(([label, to]) => <Link key={label} to={to} className="text-gray-600 no-underline hover:text-sky-800 hover:underline transition-colors">{label}</Link>)}
          </div>
        ))}
      </div>
    </footer>
  );
};
