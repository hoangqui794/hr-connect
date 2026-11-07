/**
 * @file CompanyPages.tsx
 * @description Public company directory and company profile (mockup 03/11), on GET /public/companies.
 */
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Pagination, Skeleton } from 'antd';
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

export const CompaniesPage: React.FC = () => {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const featured = useQuery({ queryKey: ['public-companies', 'featured'], queryFn: () => companyDirectoryApi.featured(), staleTime: 5 * 60_000 });
  const list = useQuery({
    queryKey: ['public-companies', 'list', search, page],
    queryFn: () => companyDirectoryApi.search({ search: search || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  return (
    <Frame>
      <section className="border-0 border-b border-solid border-slate-200 bg-white">
        <div className="mx-auto max-w-[1248px] px-4 pb-5 pt-6 sm:px-6">
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.14em] text-sky-700">Khám phá doanh nghiệp</p>
          <h1 className="m-0 mt-1 text-[24px] font-bold text-slate-950">Danh sách công ty</h1>
          <p className="m-0 mt-1 text-[14px] text-slate-600">Tìm hiểu môi trường làm việc và các cơ hội đang tuyển tại doanh nghiệp phù hợp.</p>
        </div>
      </section>
      <section aria-label="Tìm kiếm công ty" className="border-0 border-b border-solid border-slate-200 bg-[#F7F8FA]">
        <div className="mx-auto max-w-[1248px] px-4 py-4 sm:px-6">
          <form
            role="search"
            className="flex flex-wrap gap-2 rounded-xl border border-solid border-slate-200 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(draft.trim());
            }}
          >
            <label className="min-w-[240px] flex-1 px-3">
              <span className="sr-only">Tên công ty</span>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tên công ty" className="h-11 w-full border-0 bg-transparent text-[15px] text-gray-800 outline-none placeholder:text-gray-500" />
            </label>
            <button type="submit" className="h-11 cursor-pointer rounded-md border-0 bg-[#C2410C] px-7 text-[15px] font-semibold text-white hover:bg-[#9A3412] max-sm:w-full">Tìm công ty</button>
          </form>
        </div>
      </section>
      <main className="mx-auto flex max-w-[1248px] flex-col gap-8 px-4 pb-14 pt-7 sm:px-6">
        {!search && (featured.data ?? []).length > 0 && (
          <section aria-labelledby="co-top">
            <h2 id="co-top" className="m-0 mb-3.5 text-[20px] font-bold text-gray-900">Công ty nổi bật</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(featured.data ?? []).slice(0, 4).map((c) => (
                <Link key={c.companyId} to={`/companies/${c.companyId}`} className="flex flex-col items-start gap-1.5 rounded-lg border border-solid border-gray-200 bg-white p-4 text-gray-900 no-underline hover:border-sky-300">
                  <CompanyMark name={c.companyName} logoUrl={c.logoUrl} />
                  <b className="mt-1 line-clamp-2">{c.companyName}</b>
                  {c.industry?.name && <span className="text-[13px] text-gray-600">{c.industry.name}</span>}
                  <span className="text-[13px] text-sky-700">{c.activeJobCount} việc làm đang mở</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="co-all">
          <div className="mb-3.5 flex items-baseline justify-between gap-3">
            <h2 id="co-all" className="m-0 text-[20px] font-bold text-gray-900">{search ? `Kết quả cho "${search}"` : 'Tất cả công ty'}</h2>
            {list.data && <span className="text-gray-600">{list.data.totalCount.toLocaleString('vi-VN')} công ty</span>}
          </div>
          {list.isError ? (
            <Alert type="error" showIcon message="Không tải được danh sách công ty" description={getApiErrorMessage(list.error)} action={<Button onClick={() => list.refetch()}>Thử lại</Button>} />
          ) : list.isLoading ? (
            <div className="rounded-lg border border-solid border-gray-200 bg-white p-4"><Skeleton active avatar paragraph={{ rows: 4 }} /></div>
          ) : (list.data?.items ?? []).length === 0 ? (
            <p className="m-0 rounded-lg border border-solid border-gray-200 bg-white px-4 py-10 text-center text-gray-600">Không tìm thấy công ty phù hợp.</p>
          ) : (
            <div className="rounded-lg border border-solid border-gray-200 bg-white">
              {(list.data?.items ?? []).map((c) => (
                <Link key={c.companyId} to={`/companies/${c.companyId}`} className="flex items-center gap-3.5 border-0 border-b border-solid border-slate-100 p-4 text-gray-900 no-underline last:border-b-0 hover:bg-slate-50">
                  <CompanyMark name={c.companyName} logoUrl={c.logoUrl} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{c.companyName}</b>
                    <span className="block truncate text-[13px] text-gray-600">{[c.industry?.name, c.companySize?.label, c.address].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-sky-700">{c.activeJobCount} việc làm</span>
                </Link>
              ))}
            </div>
          )}
          {(list.data?.totalPages ?? 0) > 1 && (
            <div className="mt-4 flex justify-end">
              <Pagination current={page} pageSize={PAGE_SIZE} total={list.data?.totalCount ?? 0} showSizeChanger={false} onChange={setPage} />
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
    <aside aria-labelledby="co-about" className="min-w-0 flex-[1_1_300px] self-start rounded-lg border border-solid border-gray-200 bg-white p-5">
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
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-sky-700 hover:text-sky-900 border-0 bg-transparent p-0 cursor-pointer transition-colors"
        >
          {isExpanded ? (
            <>Thu gọn <UpOutlined className="text-[11px]" /></>
          ) : (
            <>Xem thêm giới thiệu <DownOutlined className="text-[11px]" /></>
          )}
        </button>
      )}
    </aside>
  );
};

export const CompanyDetailPage: React.FC = () => {
  const { companyId = '' } = useParams();
  const { isAuthenticated, role } = useAuthStore();
  const detail = useQuery({
    queryKey: ['public-companies', 'detail', companyId],
    queryFn: () => companyDirectoryApi.detail(companyId),
    enabled: Boolean(companyId),
    retry: false,
  });
  const company = detail.data?.company;
  const jobs = detail.data?.jobs ?? [];

  return (
    <Frame>
      <section aria-label="Tìm kiếm việc làm" className="border-0 border-b border-solid border-slate-200 bg-[#F7F8FA]">
        <div className="mx-auto max-w-[1248px] px-4 py-4 sm:px-6"><SearchForm /></div>
      </section>
      <main className="mx-auto max-w-[1248px] px-4 pb-14 pt-5 sm:px-6">
        <nav aria-label="Đường dẫn" className="mb-3.5 text-[13px] text-gray-600">
          <Link to="/" className="text-sky-700">Trang chủ</Link> › <Link to="/companies" className="text-sky-700">Công ty</Link>{company ? ` › ${company.companyName}` : ''}
        </nav>
        {detail.isLoading ? (
          <Skeleton active avatar paragraph={{ rows: 8 }} />
        ) : detail.isError || !company ? (
          <div className="rounded-lg border border-solid border-gray-200 bg-white px-4 py-14 text-center">
            <div className="text-[16px] font-semibold text-gray-900">Không tìm thấy công ty</div>
            <p className="m-0 mb-3 mt-1 text-gray-600">Công ty có thể chưa được xác minh hoặc không còn hoạt động.</p>
            <Link to="/companies" className="font-semibold text-sky-700">Xem danh sách công ty</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <section aria-labelledby="co-name" className="flex flex-wrap items-center gap-4 rounded-lg border border-solid border-gray-200 bg-white p-5">
              <CompanyMark name={company.companyName} logoUrl={company.logoUrl} size={88} />
              <div className="min-w-0 flex-[1_1_320px]">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 id="co-name" className="m-0 text-[22px] font-bold text-gray-900">{company.companyName}</h1>
                  <span className="rounded bg-green-100 px-2 py-0.5 text-[12px] font-semibold text-green-800">Đã xác minh</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-gray-600">
                  {company.industry?.name && <span>{company.industry.name}</span>}
                  {company.companySize?.label && <span>{company.companySize.label}</span>}
                  {company.address && <span>{company.address}</span>}
                  {company.website && <a href={company.website} target="_blank" rel="noreferrer" className="text-sky-700">{company.website.replace(/^https?:\/\//, '')}</a>}
                </div>
              </div>
              {jobs.length > 0 && <a href="#co-jobs" className="rounded-md bg-[#C2410C] px-4 py-2.5 font-semibold text-white no-underline hover:bg-[#9A3412] hover:text-white">Xem {jobs.length} việc làm</a>}
            </section>

            <div className="flex flex-wrap items-start gap-5">
              <section id="co-jobs" aria-labelledby="co-jobs-h" className="min-w-0 flex-[999_1_560px] scroll-mt-5">
                <h2 id="co-jobs-h" className="m-0 mb-3 text-[18px] font-bold text-gray-900">Việc làm đang tuyển ({jobs.length})</h2>
                {jobs.length === 0 ? (
                  <p className="m-0 rounded-lg border border-solid border-gray-200 bg-white px-4 py-10 text-center text-gray-600">Công ty chưa có việc làm đang mở.</p>
                ) : (
                  <div className="rounded-lg border border-solid border-gray-200 bg-white">
                    {jobs.map((j) => (
                      <article key={j.jobId} className="flex gap-3 border-0 border-b border-solid border-slate-100 p-4 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <Link to={jobHref(j.jobId, role, isAuthenticated)} className="text-[15px] font-semibold text-gray-900 no-underline hover:text-sky-800">{j.title}</Link>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-gray-600">
                            <span className="font-semibold text-[#C2410C]">{salaryText(j)}</span>
                            {j.location && <span>{j.location}</span>}
                            {j.minExperienceYears != null && <span>{j.maxExperienceYears != null ? `${j.minExperienceYears} – ${j.maxExperienceYears} năm` : `Từ ${j.minExperienceYears} năm`}</span>}
                            {j.applicationDeadline && <span>Hạn {dayjs(j.applicationDeadline).format('DD/MM')}</span>}
                          </div>
                        </div>
                        <SaveJobButton jobId={j.jobId} title={j.title} />
                      </article>
                    ))}
                  </div>
                )}
              </section>
              {company.description && <CompanyAboutCard description={company.description} />}
            </div>
          </div>
        )}
      </main>
    </Frame>
  );
};
