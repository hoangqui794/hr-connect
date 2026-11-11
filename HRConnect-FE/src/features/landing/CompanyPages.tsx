/**
 * @file CompanyPages.tsx
 * @description Public company directory and company profile (mockup 03/11), on GET /public/companies.
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Pagination, Select, Skeleton } from 'antd';
import { a11yItemRender } from '@/components/common/paginationA11y';
import { ALL_VIETNAM_PROVINCES } from '@/features/jobs-mf01/PublicJobSplitDiscovery';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Navbar } from './components/Navbar';
import { CompanyMark, SaveJobButton, SearchForm, SiteFooter, jobHref, salaryText } from './components/SiteParts';

const PAGE_SIZE = 20;

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen w-full bg-[#F7F8FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-gray-800">
    <Navbar />
    {children}
    <SiteFooter />
  </div>
);

const PIN_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);

type CompanyFilter = 'all' | 'hiring';

export const CompaniesPage: React.FC = () => {
  const [draft, setDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [filter, setFilter] = useState<CompanyFilter>('all');
  const [page, setPage] = useState(1);
  const featured = useQuery({ queryKey: ['public-companies', 'featured'], queryFn: () => companyDirectoryApi.featured(), staleTime: 5 * 60_000 });
  const list = useQuery({
    queryKey: ['public-companies', 'list', search, location, page],
    queryFn: () => companyDirectoryApi.search({ search: search || undefined, location: location || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });
  // "Đang tuyển" narrows the loaded page; the API has no open-jobs filter yet.
  const items = (list.data?.items ?? []).filter((c) => filter === 'all' || c.activeJobCount > 0);
  const filtered = Boolean(search || location);

  return (
    <Frame>
      <section aria-label="Tìm kiếm công ty" className="border-0 border-b border-solid border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-[928px] px-4 py-4 sm:px-6">
          <form
            role="search"
            className="flex flex-wrap overflow-hidden rounded-lg border border-solid border-[#CBD5E1] bg-white transition-colors focus-within:border-sky-500"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(draft.trim());
              setLocation(locationDraft);
            }}
          >
            <label className="flex min-w-0 flex-[3_1_320px] items-center gap-2.5 px-3 text-[#64748B]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
              <span className="sr-only">Tên công ty hoặc lĩnh vực</span>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tên công ty, lĩnh vực" className="h-11 w-full border-0 bg-transparent text-[14px] text-gray-800 outline-none placeholder:text-[#64748B]" />
            </label>
            <div className="flex min-w-0 flex-[2_1_200px] items-center gap-2 px-3 text-[#64748B] sm:border-0 sm:border-l sm:border-solid sm:border-[#E2E8F0]">
              {PIN_ICON}
              <Select
                aria-label="Địa điểm"
                showSearch
                allowClear
                variant="borderless"
                value={locationDraft || undefined}
                placeholder="Tất cả địa điểm"
                onChange={(v) => setLocationDraft(v || '')}
                optionFilterProp="label"
                options={ALL_VIETNAM_PROVINCES.map((name) => ({ value: name, label: name }))}
                className="h-11 min-w-0 flex-1 [&_.ant-select-selector]:!px-0"
                popupMatchSelectWidth={false}
              />
            </div>
            <button type="submit" className="h-11 cursor-pointer border-0 bg-gradient-to-r from-[#0284C7] to-[#2563EB] px-[24px] text-[14px] font-bold text-white transition-all hover:from-[#0369A1] hover:to-[#1D4ED8] hover:shadow-md hover:shadow-sky-500/25 active:scale-[0.98] max-sm:w-full">Tìm công ty</button>
          </form>
        </div>
      </section>
      <main className="hrc-fade-up mx-auto flex max-w-[1248px] flex-col gap-8 px-4 pb-14 pt-7 sm:px-6">
        {!filtered && (featured.data ?? []).length > 0 && (
          <section aria-labelledby="co-top">
            <h2 id="co-top" className="m-0 mb-3.5 text-[20px] font-bold text-gray-900">Công ty nổi bật</h2>
            <div className="hrc-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(featured.data ?? []).slice(0, 4).map((c) => (
                <Link key={c.companyId} to={`/companies/${c.companyId}`} className="hrc-card flex flex-col items-start gap-1.5 rounded-xl border border-solid border-[#E2E8F0] bg-white p-4 text-gray-900 no-underline">
                  <CompanyMark name={c.companyName} logoUrl={c.logoUrl} />
                  <b className="mt-1 line-clamp-2">{c.companyName}</b>
                  {c.industry?.name && <span className="text-[13px] text-gray-600">{c.industry.name}</span>}
                  <span className="text-[13px] font-semibold text-[#0284C7]">{c.activeJobCount} việc làm đang mở</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="co-all">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="co-all" className="m-0 text-[20px] font-bold text-gray-900">
              {search ? `Kết quả cho "${search}"` : 'Tất cả công ty'}
              {list.data && <span className="ml-2 text-[14px] font-medium text-[#64748B]">· {list.data.totalCount.toLocaleString('vi-VN')} công ty</span>}
            </h2>
            <div role="radiogroup" aria-label="Lọc công ty" className="flex gap-2">
              {([['all', 'Tất cả'], ['hiring', 'Đang tuyển']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={filter === key}
                  onClick={() => setFilter(key)}
                  className={`min-h-[40px] cursor-pointer rounded-full border border-solid px-4 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 max-sm:min-h-[44px] ${filter === key ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-xs' : 'border-[#CBD5E1] bg-white text-[#334155] hover:border-[#94A3B8]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {list.isError ? (
            <Alert type="error" showIcon message="Không tải được danh sách công ty" description={getApiErrorMessage(list.error)} action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
          ) : list.isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <div key={i} className="rounded-xl border border-solid border-[#E2E8F0] bg-white p-5"><Skeleton active avatar paragraph={{ rows: 2 }} /></div>)}
            </div>
          ) : items.length === 0 ? (
            <p className="m-0 rounded-xl border border-solid border-[#E2E8F0] bg-white px-4 py-10 text-center text-gray-600">
              {filter === 'hiring' ? 'Không có công ty nào đang tuyển ở trang này.' : 'Không tìm thấy công ty phù hợp.'}
            </p>
          ) : (
            <div
              key={`${search}-${location}-${page}-${filter}`}
              aria-busy={list.isFetching && !list.isLoading}
              className="hrc-dim hrc-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {items.map((c) => (
                <article key={c.companyId} className="hrc-card flex flex-col gap-3.5 rounded-xl border border-solid border-[#E2E8F0] bg-white p-5">
                  <div className="flex items-start gap-3.5">
                    <CompanyMark name={c.companyName} logoUrl={c.logoUrl} size={60} />
                    <div className="min-w-0">
                      <h3 className="m-0 text-[16px] font-bold leading-snug">
                        <Link to={`/companies/${c.companyId}`} className="text-[#0F172A] no-underline hover:text-sky-600 hover:underline">{c.companyName}</Link>
                      </h3>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[12px] font-semibold text-[#047857]">Đã xác minh</span>
                        {(c.companySize?.label || c.industry?.name) && (
                          <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[12px] text-[#334155]">{c.companySize?.label || c.industry?.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {c.address && (
                    <p className="m-0 flex gap-1.5 text-[13.5px] leading-relaxed text-[#475569]">
                      <span className="mt-0.5 shrink-0">{PIN_ICON}</span>
                      <span className="line-clamp-2">{c.address}</span>
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between border-0 border-t border-solid border-[#F1F5F9] pt-3.5">
                    <span className={`text-[14px] font-bold ${c.activeJobCount > 0 ? 'text-[#0284C7]' : 'text-[#64748B]'}`}>
                      {c.activeJobCount > 0 ? `${c.activeJobCount} việc làm đang mở` : 'Chưa có việc làm'}
                    </span>
                    <Link to={`/companies/${c.companyId}`} className="inline-flex min-h-[44px] items-center rounded-lg border border-solid border-sky-200 bg-sky-50 px-3.5 text-[14px] font-semibold text-sky-700 no-underline transition-colors hover:border-sky-400 hover:bg-sky-100">
                      Xem công ty
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
          {(list.data?.totalPages ?? 0) > 1 && (
            <div className="mt-5 flex justify-center">
              <Pagination current={page} pageSize={PAGE_SIZE} total={list.data?.totalCount ?? 0} showSizeChanger={false} onChange={setPage} itemRender={a11yItemRender} />
            </div>
          )}
        </section>
      </main>
    </Frame>
  );
};

const CompanyAboutCard: React.FC<{ description: string }> = ({ description }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const trimmed = description.trim();
  const lineCount = trimmed.split('\n').length;
  const isLong = trimmed.length > 280 || lineCount > 5;

  return (
    <section id="co-about-sec" aria-labelledby="co-about" className="scroll-mt-24 rounded-xl border border-solid border-[#E2E8F0] bg-white p-5">
      <h2 id="co-about" className="m-0 mb-2.5 text-[15px] font-bold text-gray-900">Giới thiệu công ty</h2>
      <div className="relative">
        <div
          className={`whitespace-pre-line text-[14px] leading-relaxed text-gray-700 transition-all duration-200 ${
            !isExpanded && isLong ? 'max-h-[220px] overflow-hidden' : ''
          }`}
        >
          {trimmed}
        </div>
        {!isExpanded && isLong && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/85 to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 text-[14px] font-bold text-sky-700 hover:text-sky-800 border-0 bg-transparent p-0 cursor-pointer transition-colors"
        >
          {isExpanded ? (
            <>Thu gọn <UpOutlined className="text-[11px]" /></>
          ) : (
            <>Xem thêm giới thiệu <DownOutlined className="text-[11px]" /></>
          )}
        </button>
      )}
    </section>
  );
};

const DETAIL_TABS = [
  { href: '#co-jobs', label: 'Việc làm' },
  { href: '#co-about-sec', label: 'Giới thiệu' },
  { href: '#co-address', label: 'Địa chỉ' },
];

export const CompanyDetailPage: React.FC = () => {
  const { companyId = '' } = useParams();
  const { isAuthenticated, role } = useAuthStore();
  const [tab, setTab] = useState('#co-jobs');
  const detail = useQuery({
    queryKey: ['public-companies', 'detail', companyId],
    queryFn: () => companyDirectoryApi.detail(companyId),
    enabled: Boolean(companyId),
    retry: false,
  });
  const company = detail.data?.company;
  const jobs = detail.data?.jobs ?? [];
  const city = company?.address?.split(',').map((part) => part.trim()).filter(Boolean).pop();
  const website = company?.website?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const tabs = DETAIL_TABS.filter((t) => t.href !== '#co-about-sec' || company?.description).filter((t) => t.href !== '#co-address' || company?.address);

  return (
    <Frame>
      {detail.isLoading ? (
        <div className="mx-auto max-w-[1248px] px-4 py-8 sm:px-6"><Skeleton active avatar paragraph={{ rows: 8 }} /></div>
      ) : detail.isError || !company ? (
        <main className="mx-auto max-w-[1248px] px-4 py-10 sm:px-6">
          <div className="rounded-xl border border-solid border-[#E2E8F0] bg-white px-4 py-14 text-center">
            <div className="text-[16px] font-semibold text-gray-900">Không tìm thấy công ty</div>
            <p className="m-0 mb-3 mt-1 text-gray-600">Công ty có thể chưa được xác minh hoặc không còn hoạt động.</p>
            <Link to="/companies" className="font-semibold text-sky-700">Xem danh sách công ty</Link>
          </div>
        </main>
      ) : (
        <>
          <section aria-labelledby="co-name" className="hrc-fade-up border-0 border-b border-solid border-[#E2E8F0] bg-white">
            <div className="mx-auto max-w-[1248px] px-4 pt-4 sm:px-6">
              <nav aria-label="Đường dẫn" className="mb-5 text-[13px] text-[#64748B]">
                <Link to="/" className="text-sky-600 no-underline hover:text-sky-700 hover:underline">Trang chủ</Link> › <Link to="/companies" className="text-sky-600 no-underline hover:text-sky-700 hover:underline">Công ty</Link> › {company.companyName}
              </nav>
              <div className="flex flex-wrap items-center gap-5">
                <span className="overflow-hidden rounded-lg border border-solid border-[#E2E8F0]">
                  <CompanyMark name={company.companyName} logoUrl={company.logoUrl} size={72} />
                </span>
                <div className="min-w-0 flex-[1_1_360px]">
                  <h1 id="co-name" className="m-0 mb-1.5 text-[24px] font-bold leading-snug text-[#0F172A]">{company.companyName}</h1>
                  <p className="m-0 text-[14px] leading-relaxed text-[#475569]">
                    {[company.industry?.name, company.companySize?.label, city].filter(Boolean).join(' · ')}
                    {website && (
                      <> · <a href={company.website!} target="_blank" rel="noreferrer" className="font-medium text-sky-600 hover:text-sky-700 hover:underline">{website}</a></>
                    )}
                    {' · '}<span className="font-semibold text-[#047857]">Đã xác minh</span>
                  </p>
                </div>
                {company.website && (
                  <a href={company.website} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-[18px] font-semibold text-white no-underline shadow-sm shadow-sky-500/20 transition-all hover:from-sky-600 hover:to-blue-700 hover:text-white active:scale-[0.98]">
                    Xem trang web
                  </a>
                )}
              </div>
              <nav aria-label="Mục trang công ty" className="mt-6 flex gap-6 overflow-x-auto text-[14px]">
                {tabs.map((t) => (
                  <a
                    key={t.href}
                    href={t.href}
                    onClick={() => setTab(t.href)}
                    aria-current={tab === t.href ? 'true' : undefined}
                    className={`whitespace-nowrap border-0 border-b-2 border-solid py-3 no-underline transition-colors ${tab === t.href ? 'border-sky-600 font-semibold text-sky-700' : 'border-transparent text-[#475569] hover:text-[#0F172A]'}`}
                  >
                    {t.href === '#co-jobs' ? `${t.label} (${jobs.length})` : t.label}
                  </a>
                ))}
              </nav>
            </div>
          </section>

          <main className="mx-auto max-w-[1248px] px-4 pb-14 pt-6 sm:px-6">
            <div className="flex flex-wrap items-start gap-5">
              <section id="co-jobs" aria-labelledby="co-jobs-h" className="min-w-0 flex-[999_1_560px] scroll-mt-24">
                <h2 id="co-jobs-h" className="m-0 mb-3 text-[19px] font-bold text-[#0F172A]">Việc làm đang tuyển <span className="font-medium text-[#64748B]">({jobs.length})</span></h2>
                {jobs.length === 0 ? (
                  <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-[#CBD5E1] bg-white px-6 py-10 text-center">
                    <h3 className="m-0 text-[16px] font-bold text-[#0F172A]">Công ty chưa có việc làm đang mở</h3>
                    <p className="m-0 max-w-[420px] text-[14px] text-[#64748B]">Quay lại sau để xem tin mới, hoặc xem các việc làm khác đang tuyển.</p>
                    <Link to="/jobs" className="mt-1.5 inline-flex min-h-[44px] items-center rounded-lg border border-solid border-sky-200 bg-sky-50 px-[18px] font-semibold text-sky-700 no-underline transition-colors hover:border-sky-400 hover:bg-sky-100">Xem việc làm khác</Link>
                  </div>
                ) : (
                  <div className="hrc-stagger flex flex-col gap-3">
                    {jobs.map((j) => (
                      <article key={j.jobId} className="hrc-card flex gap-3 rounded-xl border border-solid border-[#E2E8F0] bg-white p-4">
                        <div className="min-w-0 flex-1">
                          <Link to={jobHref(j.jobId, role, isAuthenticated)} className="text-[16px] font-bold text-[#0F172A] no-underline hover:text-sky-600 hover:underline">{j.title}</Link>
                          <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
                            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">{salaryText(j)}</span>
                            {j.location && <span className="max-w-[260px] truncate rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[#334155]">{j.location}</span>}
                            {j.minExperienceYears != null && <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[#334155]">{j.maxExperienceYears != null ? `${j.minExperienceYears} – ${j.maxExperienceYears} năm` : `Từ ${j.minExperienceYears} năm`}</span>}
                            {j.applicationDeadline && <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[#334155]">Hạn {dayjs(j.applicationDeadline).format('DD/MM')}</span>}
                          </div>
                        </div>
                        <SaveJobButton jobId={j.jobId} title={j.title} />
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <aside aria-label="Thông tin công ty" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 lg:max-w-[380px]">
                {company.description && <CompanyAboutCard description={company.description} />}
                {company.address && (
                  <section id="co-address" aria-labelledby="co-address-h" className="scroll-mt-24 rounded-xl border border-solid border-[#E2E8F0] bg-white p-5">
                    <h2 id="co-address-h" className="m-0 mb-2.5 text-[15px] font-bold text-gray-900">Địa chỉ</h2>
                    <p className="m-0 text-[14px] leading-relaxed text-[#334155]">{company.address}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex min-h-[40px] items-center text-[14px] font-bold text-sky-600 no-underline hover:text-sky-700 hover:underline"
                    >
                      Xem trên bản đồ
                    </a>
                  </section>
                )}
              </aside>
            </div>
          </main>
        </>
      )}
    </Frame>
  );
};
