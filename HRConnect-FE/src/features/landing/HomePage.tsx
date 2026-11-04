/**
 * @file HomePage.tsx
 * @description The homepage for guests and Candidates following "HR Connect – Trang chủ Guest và Candidate.pdf":
 * one unified brand header with deep navy search band, modern SaaS layout, and complete bento visual fidelity.
 */
import React, { Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'antd';
import { Navbar } from './components/Navbar';
import { CompactFooter, CompanyMark, JobCard, type JobCardData, SearchForm, SiteFooter } from './components/SiteParts';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const CandidateHome = React.lazy(() => import('./CandidateHome').then((m) => ({ default: m.CandidateHome })));

const SUGGESTED = ['.NET Developer', 'Kế toán tổng hợp', 'Nhân viên kinh doanh', 'Digital Marketing', 'Tester'];

/** Exact 6 focal categories from design PDF Page 1 */
const CATEGORIES = [
  { param: 'IT', name: 'IT phần mềm', short: 'IT phần mềm', defaultCount: 412, match: /developer|lập trình|software|frontend|backend|fullstack|devops|tester|\bqa\b|engineer|\.net|java|react|node/i },
  { param: 'SALES', name: 'Kinh doanh – Bán hàng', short: 'Kinh doanh', defaultCount: 268, match: /sale|kinh doanh|bán hàng|account executive|telesale|tư vấn bán hàng/i },
  { param: 'FINANCE', name: 'Kế toán – Kiểm toán', short: 'Kế toán – Tài chính', defaultCount: 157, match: /kế toán|kiểm toán|tài chính|ngân hàng|tín dụng|finance|accountant/i },
  { param: 'MARKETING', name: 'Marketing', short: 'Marketing', defaultCount: 134, match: /marketing|truyền thông|\bseo\b|content|brand|digital/i },
  { param: 'BANKING', name: 'Ngân hàng', short: 'Ngân hàng', defaultCount: 96, match: /ngân hàng|bank|tín dụng|giao dịch viên|thẩm định/i },
  { param: 'MANUFACTURING', name: 'Sản xuất', short: 'Sản xuất', defaultCount: 88, match: /sản xuất|chế tạo|vận hành|kho vận|logistics|qa qc/i },
];

/** Curated Featured Banners matching PDF Page 1 */
const CURATED_BANNERS = [
  {
    companyId: 'fpt',
    companyName: 'FPT Software',
    title: 'FPT Software tuyển 120 kỹ sư phần mềm năm 2026',
    sub: 'Hồ Chí Minh, Hà Nội, Đà Nẵng · .NET, Java, Embedded',
    activeJobs: 24,
    headline: 'FPT Software tuyển dụng 120 kỹ sư phần mềm chất lượng cao tại 3 miền',
    image: '/images/banners/banner-fpt.jpg',
  },
  {
    companyId: 'vng',
    companyName: 'VNG Corporation',
    title: 'Gia nhập VNG Corporation - Đổi mới công nghệ tại Việt Nam',
    sub: 'Hồ Chí Minh, Hà Nội · Golang, React, Cloud & Gaming Platform',
    activeJobs: 12,
    headline: 'Khám phá cơ hội phát triển tại kỳ lân công nghệ hàng đầu Việt Nam',
    image: '/images/banners/banner-vng.jpg',
  },
  {
    companyId: 'momo',
    companyName: 'MoMo',
    title: 'MoMo mở 9 vị trí Engineering & AI Platform',
    sub: 'Hồ Chí Minh · Microservices, Data Science, Fintech Core',
    activeJobs: 9,
    headline: 'Tham gia xây dựng siêu ứng dụng tài chính phục vụ 31 triệu người dùng',
    image: '/images/banners/banner-momo-hero.jpg',
  },
];

/** Fallback jobs matching PDF Page 1 if API returns fewer than 9 */
const FALLBACK_JOBS: JobCardData[] = [
  { jobId: 'fb-1', title: 'Backend Developer (.NET Core)', companyName: 'FPT Software', location: 'Hồ Chí Minh', salaryMin: 25000000, salaryMax: 35000000, postedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { jobId: 'fb-2', title: 'Senior Fullstack Engineer', companyName: 'VNG Corporation', location: 'Hồ Chí Minh', salaryMin: 35000000, salaryMax: 50000000, postedAt: new Date().toISOString() },
  { jobId: 'fb-3', title: 'Chuyên viên Phân tích Tín dụng', companyName: 'Ngân hàng TMCP Quân đội', location: 'Hà Nội', salaryNegotiable: true, postedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { jobId: 'fb-4', title: 'Product Designer', companyName: 'Tiki', location: 'Hồ Chí Minh', salaryMin: 20000000, salaryMax: 30000000, postedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { jobId: 'fb-5', title: 'QA Engineer (Automation)', companyName: 'KMS Technology', location: 'Đà Nẵng', salaryMin: 18000000, salaryMax: 28000000, postedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { jobId: 'fb-6', title: 'Kế toán tổng hợp', companyName: 'Thế Giới Di Động', location: 'Hồ Chí Minh', salaryMin: 12000000, salaryMax: 18000000, postedAt: new Date().toISOString() },
  { jobId: 'fb-7', title: 'Software Engineer (C#)', companyName: 'MoMo', location: 'Hồ Chí Minh', salaryMin: 30000000, salaryMax: 40000000, postedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
  { jobId: 'fb-8', title: 'Trưởng nhóm Kinh doanh Kênh MT', companyName: 'Vinamilk', location: 'Bình Dương', salaryMin: 20000000, salaryMax: 25000000, postedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { jobId: 'fb-9', title: 'Digital Marketing Executive', companyName: 'Haravan', location: 'Hồ Chí Minh', salaryMin: 15000000, salaryMax: 20000000, postedAt: new Date(Date.now() - 6 * 86400000).toISOString() },
];

const HomeBanners: React.FC = () => {
  const [index, setIndex] = useState(0);
  const featured = useQuery({
    queryKey: ['public-companies', 'featured'],
    queryFn: () => companyDirectoryApi.featured(),
    staleTime: 5 * 60_000,
  });

  const apiList = (featured.data ?? []).filter((c) => c.activeJobCount > 0);
  const banners = apiList.length >= 2
    ? apiList.map((c, i) => ({
        companyId: c.companyId,
        companyName: c.companyName,
        title: `${c.companyName} tuyển dụng các vị trí chất lượng cao năm 2026`,
        sub: [c.industry?.name, c.address].filter(Boolean).join(' · '),
        activeJobs: c.activeJobCount,
        headline: c.description || `${c.companyName} đang tuyển dụng tích cực trên HR Connect.`,
        image: CURATED_BANNERS[i % CURATED_BANNERS.length].image,
      }))
    : CURATED_BANNERS;

  const main = banners[index % banners.length];
  const side = [
    {
      company: 'MoMo',
      text: 'MoMo mở 9 vị trí Engineering',
      link: '/jobs?keyword=MoMo',
      image: '/images/banners/banner-momo-side.jpg',
    },
    {
      company: 'Vinamilk',
      text: 'Vinamilk tuyển Quản lý khu vực',
      link: '/jobs?keyword=Vinamilk',
      image: '/images/banners/banner-vinamilk-side.jpg',
    },
  ];

  const arrow =
    'absolute top-28 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-solid border-white/60 bg-white/90 text-slate-800 shadow-md backdrop-blur-md transition-all hover:bg-white hover:scale-105 z-20';

  return (
    <section aria-label="Công ty nổi bật" className="flex flex-wrap gap-4">
      {/* Main 1200x400 style banner with real photo & readable overlay */}
      <div className="group relative h-[340px] min-w-0 flex-[2_1_560px] overflow-hidden rounded-xl border border-solid border-gray-200 bg-slate-900 shadow-xs">
        {/* Real photo background */}
        <img
          src={main.image || '/images/banners/banner-fpt.jpg'}
          alt={main.companyName}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Gradient Scrim for contrast & readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-slate-950/30" />

        {/* Top Dots indicator */}
        <div className="absolute top-3.5 inset-x-0 flex justify-center gap-1.5 z-20">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Chuyển đến banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${(index % banners.length) === i ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>

        {/* Hero headline in the photo section */}
        <div className="absolute inset-x-0 bottom-24 top-0 flex flex-col items-center justify-center px-12 text-center z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-md px-3.5 py-1 text-[11px] font-bold text-[#0C4A6E] mb-2.5 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-600 animate-pulse" />
            ĐỐI TÁC TUYỂN DỤNG HÀNG ĐẦU
          </div>
          <span className="line-clamp-2 text-[22px] font-extrabold text-white max-w-[620px] leading-snug drop-shadow-md">
            {main.headline}
          </span>
          <p className="mt-1.5 text-[13px] text-slate-200 hidden sm:block max-w-[520px] drop-shadow-sm font-medium">
            Môi trường chuyên nghiệp, chế độ đãi ngộ vượt trội và cơ hội thăng tiến bền vững
          </p>
        </div>

        {/* Carousel arrows */}
        <button type="button" aria-label="Banner trước" className={`${arrow} left-3.5`} onClick={() => setIndex((i) => (i - 1 + banners.length) % banners.length)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button type="button" aria-label="Banner tiếp theo" className={`${arrow} right-3.5`} onClick={() => setIndex((i) => (i + 1) % banners.length)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
        </button>

        {/* White bottom overlay card */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex h-24 items-center gap-3.5 border-0 border-t border-solid border-gray-200 bg-white px-5 max-sm:gap-2.5 max-sm:px-3">
          <CompanyMark name={main.companyName} size={52} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-gray-900">{main.title}</div>
            <div className="mt-0.5 truncate text-[13px] text-gray-500">{main.sub}</div>
          </div>
          <Link
            to={`/jobs?keyword=${encodeURIComponent(main.companyName)}`}
            className="shrink-0 whitespace-nowrap rounded-lg border border-solid border-[#0C4A6E] px-4 py-2 text-[14px] font-semibold text-[#0C4A6E] no-underline transition-all hover:bg-sky-50 active:scale-98"
          >
            Xem {main.activeJobs} việc làm
          </Link>
        </div>
      </div>

      {/* 2 Side Stacked Banners with real images matching PDF Page 1 */}
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
        {side.map((s, idx) => (
          <Link
            key={idx}
            to={s.link}
            className="group flex min-h-[164px] flex-1 flex-col overflow-hidden rounded-xl border border-solid border-gray-200 bg-white text-gray-900 no-underline transition-all duration-200 hover:border-sky-300 hover:shadow-md"
          >
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-100 min-h-[110px]">
              <img
                src={s.image}
                alt={s.company}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-2.5 left-3.5 z-10 flex items-center gap-2">
                <div className="rounded-md shadow-sm border border-white/40 overflow-hidden">
                  <CompanyMark name={s.company} size={36} />
                </div>
                <span className="text-[13px] font-bold text-white drop-shadow-md">
                  {s.company}
                </span>
              </div>
              <span className="absolute top-2.5 right-2.5 z-10 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 shadow-sm">
                Nổi bật
              </span>
            </div>
            <div className="px-4 py-2.5 font-bold text-[14px] text-gray-900 truncate group-hover:text-sky-800 transition-colors bg-white">
              {s.text}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

const GuestHome: React.FC = () => {
  const [pill, setPill] = useState('');
  const jobs = usePublicJobSearch({ page: 1, pageSize: 50 });

  const liveItems = useMemo(() => jobs.data?.items ?? [], [jobs.data]);
  const total = jobs.data?.totalCount ?? 1284;

  // Convert live items to JobCardData
  const liveCardData: JobCardData[] = useMemo(() => {
    return liveItems.map((j) => ({
      jobId: j.jobId,
      title: j.title,
      companyName: j.companyName,
      companyLogoUrl: j.companyLogoUrl,
      location: j.location,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      salaryNegotiable: j.salaryNegotiable,
      currencyCode: j.currencyCode,
      postedAt: j.postedAt,
    }));
  }, [liveItems]);

  const textOf = (j: any) =>
    [j.title, j.description, ...(j.skills ?? []).map((s: any) => s.skillName || s)].filter(Boolean).join(' ');

  const inCategory = (param: string, list: JobCardData[]) => {
    const c = CATEGORIES.find((x) => x.param === param);
    return c ? list.filter((j) => c.match.test(textOf(j))) : list;
  };

  // Ensure 9 jobs for the 3x3 grid
  const combinedJobs: JobCardData[] = useMemo(() => {
    if (liveCardData.length >= 9) return liveCardData;
    const missing = 9 - liveCardData.length;
    return [...liveCardData, ...FALLBACK_JOBS.slice(0, missing)];
  }, [liveCardData]);

  const shown = (pill ? inCategory(pill, combinedJobs) : combinedJobs).slice(0, 9);

  // 6 hiring companies for the grid
  const topCompanies = [
    { name: 'FPT Software', jobs: 24 },
    { name: 'VNG Corporation', jobs: 12 },
    { name: 'MoMo', jobs: 9 },
    { name: 'Tiki', jobs: 7 },
    { name: 'KMS Technology', jobs: 11 },
    { name: 'Thế Giới Di Động', jobs: 18 },
  ];

  return (
    <main className="mx-auto flex max-w-[1248px] flex-col gap-10 px-4 pb-14 pt-8 sm:px-6">
      {/* 1. Hero Banners */}
      <HomeBanners />

      {/* 2. Việc làm tốt nhất */}
      <section aria-labelledby="home-best">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="home-best" className="m-0 text-[22px] font-bold text-gray-900">Việc làm tốt nhất</h2>
          <Link to="/jobs" className="font-semibold text-sky-700 no-underline hover:text-sky-900 hover:underline">
            Xem tất cả {total > 0 ? `${total.toLocaleString('vi-VN')} ` : '1.284 '}việc làm
          </Link>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ param: '', short: 'Tất cả' }, ...CATEGORIES.filter((c) => c.short).slice(0, 4)].map((c) => (
            <button
              key={c.param}
              type="button"
              aria-pressed={pill === c.param}
              onClick={() => setPill(c.param)}
              className={`cursor-pointer rounded-md border border-solid px-3.5 py-[7px] text-[14px] transition-colors duration-150 ${
                pill === c.param
                  ? 'border-[#0C4A6E] bg-[#0C4A6E] font-medium text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {c.short}
            </button>
          ))}
        </div>
        {jobs.isLoading && liveCardData.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-lg border border-solid border-gray-200 bg-white p-3.5">
                <Skeleton active avatar paragraph={{ rows: 2 }} title={false} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Ngành nghề trọng điểm (6 cards matching PDF Page 1) */}
      <section aria-labelledby="home-industries">
        <h2 id="home-industries" className="m-0 mb-3.5 text-[22px] font-bold text-gray-900">Ngành nghề trọng điểm</h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((c) => (
            <Link
              key={c.param}
              to={`/jobs?category=${c.param}`}
              className="flex flex-col gap-1 rounded-xl border border-solid border-gray-200 bg-white p-4 text-gray-900 no-underline transition-all duration-200 hover:border-sky-300 hover:shadow-xs group"
            >
              <span className="font-bold text-[15px] group-hover:text-sky-800 transition-colors">{c.name}</span>
              <span className="text-[13px] text-gray-500 font-medium">
                {c.defaultCount} việc làm
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Banner CV Builder (Tạo CV trong 10 phút với CV Builder) */}
      <section aria-labelledby="home-cv" className="flex flex-wrap items-stretch overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white shadow-xs transition-all hover:shadow-md">
        <div className="flex flex-[1_1_420px] flex-col justify-center gap-3 px-8 py-8 max-sm:px-5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[12px] font-bold text-amber-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            TỐI ƯU HỒ SƠ ỨNG TUYỂN
          </div>
          <h2 id="home-cv" className="m-0 text-[24px] font-bold tracking-tight text-slate-900">
            Tạo CV trong 10 phút với CV Builder
          </h2>
          <p className="m-0 max-w-[480px] text-slate-600 text-[14.5px] leading-relaxed">
            Chọn mẫu CV chuẩn quốc tế, điền thông tin tự động, tải về PDF chất lượng cao. CV tạo xong dùng được ngay để ứng tuyển và kích hoạt AI gợi ý việc làm phù hợp.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              to="/candidate/cv-builder"
              className="inline-flex items-center gap-2 rounded-xl bg-[#C2410C] px-6 py-3 text-[14.5px] font-bold text-white no-underline shadow-sm transition-all hover:bg-[#9A3412] hover:text-white active:scale-98"
            >
              <span>Tạo CV ngay</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link
              to="/candidate/cv-builder"
              className="inline-flex items-center gap-2 rounded-xl border border-solid border-slate-300 bg-white px-5 py-3 text-[14.5px] font-semibold text-slate-700 no-underline transition-all hover:bg-slate-50 hover:text-slate-900 active:scale-98"
            >
              <span>Xem các mẫu CV</span>
            </Link>
          </div>
        </div>

        {/* High-Resolution Professional CV Mockup Image */}
        <div aria-hidden className="flex flex-[1_1_380px] items-center justify-center bg-gradient-to-br from-[#F0F6FA] to-[#E2EDF6] p-4 sm:p-6">
          <img
            src="/images/banners/cv-builder-mockup.png"
            alt="Mẫu CV ATS chuẩn 2026"
            className="w-full max-w-[500px] h-auto rounded-xl shadow-xl shadow-slate-900/10 border border-slate-200/90 transition-transform duration-300 hover:scale-[1.02]"
          />
        </div>
      </section>

      {/* 5. Công ty đang tuyển nhiều (6 companies matching PDF Page 1) */}
      <section aria-labelledby="home-companies">
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="home-companies" className="m-0 text-[22px] font-bold text-gray-900">Công ty đang tuyển nhiều</h2>
          <Link to="/companies" className="font-semibold text-sky-700 no-underline hover:text-sky-900 hover:underline">
            Xem tất cả công ty
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-6">
          {topCompanies.map((c, i) => (
            <Link
              key={i}
              to={`/jobs?keyword=${encodeURIComponent(c.name)}`}
              className="flex flex-col items-center gap-2.5 rounded-xl border border-solid border-gray-200 bg-white p-4 text-center text-gray-900 no-underline transition-all duration-200 hover:border-sky-300 hover:shadow-xs group"
            >
              <CompanyMark name={c.name} size={64} />
              <span className="line-clamp-1 text-[14px] font-bold group-hover:text-sky-800 transition-colors">{c.name}</span>
              <span className="text-[13px] font-semibold text-sky-700">{c.jobs} việc làm</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. Banner Nhà tuyển dụng ("Bạn đang cần tuyển người?") */}
      <section aria-labelledby="home-employer" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-solid border-gray-200 bg-white p-6 shadow-xs">
        <div>
          <h2 id="home-employer" className="m-0 text-[18px] font-bold text-gray-900">Bạn đang cần tuyển người?</h2>
          <p className="m-0 mt-1.5 text-gray-600 text-[14px]">
            Đăng tin tuyển dụng, tuyển qua mạng lưới Affiliate và chỉ trả phí khi tuyển được, hoặc mua CV theo số lượng.
          </p>
        </div>
        <Link
          to="/services"
          className="rounded-md border border-solid border-[#0C4A6E] px-5 py-2.5 font-semibold text-[#0C4A6E] no-underline transition-colors hover:bg-sky-50"
        >
          Xem dịch vụ cho nhà tuyển dụng
        </Link>
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
              <span className="font-semibold text-white">Tìm nhiều:</span>
              {SUGGESTED.map((s) => (
                <Link
                  key={s}
                  to={`/jobs?keyword=${encodeURIComponent(s)}`}
                  className="rounded border border-solid border-[#3E7090] px-2.5 py-[3px] text-slate-200 no-underline transition-colors hover:bg-white/10 hover:text-white"
                >
                  {s}
                </Link>
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
