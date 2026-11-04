/**
 * @file HomePage.tsx
 * @description The homepage for guests and Candidates (mockup 03/11): one page, one header. A signed-in
 * Candidate sees their own view under the same search band.
 */
import React, { Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { Navbar } from './components/Navbar';
import { CompactFooter, CompanyMark, JobCard, SearchForm, SiteFooter } from './components/SiteParts';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const CandidateHome = React.lazy(() => import('./CandidateHome').then((m) => ({ default: m.CandidateHome })));

const SUGGESTED = ['.NET Developer', 'Kế toán tổng hợp', 'Nhân viên kinh doanh', 'Digital Marketing', 'Tester'];

/** `param` is what the job search page understands; `match` picks the jobs of a category from a loaded page. */
const CATEGORIES = [
  { param: 'IT', name: 'IT phần mềm', short: 'IT phần mềm', match: /developer|lập trình|software|frontend|backend|fullstack|devops|tester|\bqa\b|engineer|\.net|java/i },
  { param: 'SALES', name: 'Kinh doanh – Bán hàng', short: 'Kinh doanh', match: /sale|kinh doanh|bán hàng|account executive|telesale/i },
  { param: 'FINANCE', name: 'Tài chính – Ngân hàng', short: 'Kế toán – Tài chính', match: /kế toán|kiểm toán|tài chính|ngân hàng|tín dụng|finance|accountant/i },
  { param: 'MARKETING', name: 'Marketing', short: 'Marketing', match: /marketing|truyền thông|\bseo\b|content|brand/i },
  { param: 'DESIGN', name: 'Thiết kế', short: '', match: /design|thiết kế|figma|graphic/i },
  { param: 'REAL_ESTATE', name: 'Bất động sản – Xây dựng', short: '', match: /bất động sản|xây dựng|kiến trúc/i },
];

const HomeBanners: React.FC = () => {
  const [index, setIndex] = useState(0);
  const featured = useQuery({ queryKey: ['public-companies', 'featured'], queryFn: () => companyDirectoryApi.featured(), staleTime: 5 * 60_000 });
  const list = (featured.data ?? []).filter((c) => c.activeJobCount > 0);
  if (featured.isLoading) return <Skeleton.Node active className="!h-[320px] !w-full" />;
  if (list.length === 0) return null;
  const main = list[index % list.length];
  const side = list.filter((c) => c.companyId !== main.companyId).slice(0, 2);
  const arrow = 'absolute top-24 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-solid border-gray-200 bg-white text-gray-800 hover:bg-slate-50';
  return (
    <section aria-label="Công ty nổi bật" className="flex flex-wrap gap-3">
      <div className="relative h-80 min-w-0 flex-[2_1_560px] overflow-hidden rounded-lg border border-solid border-gray-200 bg-[#DCE9F3]">
        <div className="absolute inset-x-0 bottom-24 top-0 flex items-center justify-center px-20 text-center max-sm:px-16 max-sm:text-[15px] text-[18px] leading-relaxed text-[#0C4A6E]">
          <span className="line-clamp-4">{main.description || `${main.companyName} đang tuyển dụng trên HR Connect.`}</span>
        </div>
        {list.length > 1 && (
          <>
            <button type="button" aria-label="Công ty trước" className={`${arrow} left-3`} onClick={() => setIndex((i) => (i - 1 + list.length) % list.length)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" aria-label="Công ty tiếp theo" className={`${arrow} right-3`} onClick={() => setIndex((i) => (i + 1) % list.length)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 flex h-24 items-center gap-3.5 border-0 border-t border-solid border-gray-200 bg-white px-5 max-sm:gap-2.5 max-sm:px-3">
          <span className="max-sm:hidden"><CompanyMark name={main.companyName} logoUrl={main.logoUrl} /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold text-gray-900">{main.companyName}</div>
            <div className="mt-0.5 truncate text-[13px] text-gray-600">{[main.industry?.name, main.address].filter(Boolean).join(' · ')}</div>
          </div>
          <Link to={`/companies/${main.companyId}`} className="shrink-0 whitespace-nowrap rounded-md border border-solid border-[#0C4A6E] px-4 py-2 font-semibold text-[#0C4A6E] no-underline hover:bg-sky-50">
            Xem {main.activeJobCount} việc làm
          </Link>
        </div>
      </div>
      {side.length > 0 && (
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          {side.map((c) => (
            <Link key={c.companyId} to={`/companies/${c.companyId}`} className="flex min-h-[154px] flex-1 flex-col overflow-hidden rounded-lg border border-solid border-gray-200 bg-white text-gray-900 no-underline hover:border-sky-300">
              <span className="flex flex-1 items-center justify-center bg-[#E7ECF3] p-3"><CompanyMark name={c.companyName} logoUrl={c.logoUrl} /></span>
              <span className="truncate px-3.5 py-2.5 font-semibold">{c.companyName} mở {c.activeJobCount} vị trí</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
};

const GuestHome: React.FC = () => {
  const [pill, setPill] = useState('');
  const jobs = usePublicJobSearch({ page: 1, pageSize: 50 });
  const companies = useQuery({
    queryKey: ['public-companies', 'hiring'],
    queryFn: () => companyDirectoryApi.search({ page: 1, pageSize: 50 }),
    staleTime: 5 * 60_000,
  });
  const items = useMemo(() => jobs.data?.items ?? [], [jobs.data]);
  const total = jobs.data?.totalCount ?? 0;
  const textOf = (j: (typeof items)[number]) => [j.title, j.description, ...(j.skills ?? []).map((s) => s.skillName)].filter(Boolean).join(' ');
  const inCategory = (param: string) => {
    const c = CATEGORIES.find((x) => x.param === param);
    return c ? items.filter((j) => c.match.test(textOf(j))) : items;
  };
  const shown = (pill ? inCategory(pill) : items).slice(0, 9);
  const hiring = [...(companies.data?.items ?? [])].filter((c) => c.activeJobCount > 0).sort((a, b) => b.activeJobCount - a.activeJobCount).slice(0, 6);

  return (
    <main className="mx-auto flex max-w-[1248px] flex-col gap-10 px-4 pb-14 pt-8 sm:px-6">
      <HomeBanners />

      <section aria-labelledby="home-best">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="home-best" className="m-0 text-[22px] font-bold text-gray-900">Việc làm tốt nhất</h2>
          <Link to="/jobs" className="font-semibold text-sky-700 no-underline hover:text-sky-900 hover:underline">Xem tất cả {total > 0 ? `${total.toLocaleString('vi-VN')} ` : ''}việc làm</Link>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ param: '', short: 'Tất cả' }, ...CATEGORIES.filter((c) => c.short)].map((c) => (
            <button
              key={c.param}
              type="button"
              aria-pressed={pill === c.param}
              onClick={() => setPill(c.param)}
              className={`cursor-pointer rounded-md border border-solid px-3.5 py-[7px] text-[14px] transition-colors duration-150 ${pill === c.param ? 'border-[#0C4A6E] bg-[#0C4A6E] font-medium text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'}`}
            >
              {c.short}
            </button>
          ))}
        </div>
        {jobs.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="rounded-lg border border-solid border-gray-200 bg-white p-3.5"><Skeleton active avatar paragraph={{ rows: 2 }} title={false} /></div>)}
          </div>
        ) : jobs.isError ? (
          <div className="rounded-lg border border-solid border-gray-200 bg-white px-4 py-10 text-center">
            <div className="font-semibold text-gray-900">Không tải được việc làm</div>
            <button type="button" onClick={() => jobs.refetch()} className="mt-3 h-10 cursor-pointer rounded-md border border-solid border-gray-300 bg-white px-4 font-semibold">Thử lại</button>
          </div>
        ) : shown.length === 0 ? (
          <p className="m-0 rounded-lg border border-solid border-gray-200 bg-white px-4 py-10 text-center text-gray-600">Chưa có việc làm ở mục này.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((job) => <JobCard key={job.jobId} job={job} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="home-industries">
        <h2 id="home-industries" className="m-0 mb-3.5 text-[22px] font-bold text-gray-900">Ngành nghề trọng điểm</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link key={c.param} to={`/jobs?category=${c.param}`} className="flex flex-col gap-1 rounded-lg border border-solid border-gray-200 bg-white p-4 text-gray-900 no-underline hover:border-sky-300">
              <span className="font-semibold">{c.name}</span>
              {/* A count from one loaded page is only true when that page holds every job. */}
              {total > 0 && total <= items.length && <span className="text-[13px] text-gray-500">{inCategory(c.param).length} việc làm</span>}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="home-cv" className="flex flex-wrap items-stretch overflow-hidden rounded-lg border border-solid border-gray-200 bg-white">
        <div className="flex flex-[1_1_420px] flex-col justify-center gap-2.5 px-8 py-7 max-sm:px-5">
          <h2 id="home-cv" className="m-0 text-[20px] font-bold text-gray-900">Tạo CV với CV Builder</h2>
          <p className="m-0 max-w-[460px] text-gray-600">Chọn mẫu, điền thông tin, tải về PDF. CV tạo xong dùng được ngay để ứng tuyển và để hệ thống gợi ý việc phù hợp.</p>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            <Link to="/candidate/cv-builder" className="rounded-md bg-[#C2410C] px-[18px] py-2.5 font-semibold text-white no-underline hover:bg-[#9A3412] hover:text-white">Tạo CV ngay</Link>
          </div>
        </div>
        <div aria-hidden className="flex min-h-[200px] flex-[1_1_360px] items-center justify-center gap-4 bg-[#E7ECF3] p-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex h-40 w-28 flex-col gap-1.5 rounded border border-solid border-gray-200 bg-white p-3">
              <span className="h-2 w-3/4 rounded bg-[#0C4A6E]" />
              <span className="h-1.5 w-1/2 rounded bg-slate-300" />
              {[0, 1, 2, 3, 4, 5].map((n) => <span key={n} className="h-1 rounded bg-slate-200" />)}
            </div>
          ))}
        </div>
      </section>

      {hiring.length > 0 && (
        <section aria-labelledby="home-companies">
          <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="home-companies" className="m-0 text-[22px] font-bold text-gray-900">Công ty đang tuyển nhiều</h2>
            <Link to="/companies" className="font-semibold text-sky-700 no-underline hover:text-sky-900 hover:underline">Xem tất cả công ty</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {hiring.map((c) => (
              <Link key={c.companyId} to={`/companies/${c.companyId}`} className="flex flex-col items-center gap-2 rounded-lg border border-solid border-gray-200 bg-white px-3 py-[18px] text-center text-gray-900 no-underline hover:border-sky-300">
                <CompanyMark name={c.companyName} logoUrl={c.logoUrl} size={64} />
                <span className="line-clamp-2 text-[13px] font-semibold">{c.companyName}</span>
                <span className="text-[13px] text-sky-700">{c.activeJobCount} việc làm</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="home-employer" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-solid border-gray-200 bg-white p-6">
        <div>
          <h2 id="home-employer" className="m-0 text-[18px] font-bold text-gray-900">Bạn đang cần tuyển người?</h2>
          <p className="m-0 mt-1.5 text-gray-600">Đăng tin tuyển dụng, tuyển qua mạng lưới Affiliate và chỉ trả phí khi tuyển được, hoặc mua CV theo số lượng.</p>
        </div>
        <Link to="/services" className="rounded-md border border-solid border-[#0C4A6E] px-[18px] py-2.5 font-semibold text-[#0C4A6E] no-underline hover:bg-sky-50">Xem dịch vụ cho nhà tuyển dụng</Link>
      </section>
    </main>
  );
};

export const HomePage: React.FC = () => {
  const { isAuthenticated, role } = useAuthStore();
  const candidate = isAuthenticated && role === UserRole.CANDIDATE;

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[14px] text-gray-800 [line-height:normal] [&_button]:[font-family:inherit] [&_input]:[font-family:inherit] [&_select]:[font-family:inherit]">
      <Navbar />
      <div className="bg-[#0C4A6E]">
        <div className={`mx-auto max-w-[1248px] px-4 pt-5 sm:px-6 ${candidate ? 'pb-6' : 'pb-7'}`}>
          <SearchForm />
          {!candidate && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-[13px] text-slate-300">
              <span>Gợi ý:</span>
              {SUGGESTED.map((s) => (
                <Link key={s} to={`/jobs?keyword=${encodeURIComponent(s)}`} className="rounded border border-solid border-[#3E7090] px-2.5 py-[3px] text-slate-200 no-underline hover:bg-white/10 hover:text-white">{s}</Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {candidate ? (
        <Suspense fallback={<div className="mx-auto max-w-[1248px] px-6 py-8"><Skeleton active paragraph={{ rows: 8 }} /></div>}>
          <CandidateHome />
        </Suspense>
      ) : (
        <GuestHome />
      )}
      {candidate ? <CompactFooter /> : <SiteFooter />}
    </div>
  );
};

export default HomePage;
