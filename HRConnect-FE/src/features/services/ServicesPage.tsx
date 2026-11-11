/**
 * @file ServicesPage.tsx
 * @description Client "Dịch vụ" page (canvas ServicesNew, 10/11): the three paid services, how each is charged,
 * a comparison that matches the code (who submits CVs, who screens) and the steps from sign-up to start of work.
 * Shown inside ClientShell at /client/services. Motion: opacity/transform only, revealed on scroll once,
 * switched off under prefers-reduced-motion.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '@/services/apiClient';
import { jobsApi } from '@/services/api/jobsApi';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';

interface ServiceTypeApiDto {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Plan {
  code: 'CV_APPLICATION' | 'HEADHUNT_COD' | 'CV_SOURCING';
  num: string;
  tag: string;
  title: string;
  lead: string;
  price: string;
  priceNote: string;
  points: string[];
  cta: string;
  href: string;
  featured?: boolean;
}

const PLANS: Plan[] = [
  {
    code: 'CV_APPLICATION',
    num: '01',
    tag: 'Tự tuyển',
    title: 'Đăng tin tuyển dụng',
    lead: 'Tin của bạn hiện cho ứng viên trên HR Connect. Bạn tự xem hồ sơ, có điểm phù hợp do AI chấm sẵn.',
    price: 'Theo gói đăng tin',
    priceNote: 'Trả trước khi tin được công khai',
    points: ['Ứng viên tự ứng tuyển vào tin', 'Điểm phù hợp AI cho từng hồ sơ', 'Bạn tự sàng lọc và hẹn phỏng vấn', 'Hợp vị trí phổ thông, nhiều người ứng tuyển'],
    cta: 'Đăng tin',
    href: '/client/jobs/create',
  },
  {
    code: 'HEADHUNT_COD',
    num: '02',
    tag: 'Trả phí khi tuyển được',
    title: 'Tuyển qua Affiliate',
    lead: 'Mạng lưới Affiliate tìm ứng viên, đội HR của chúng tôi sàng lọc trước khi gửi bạn.',
    price: 'Hệ số phí × lương gross tháng',
    priceNote: 'Chỉ trả khi ứng viên đi làm · hệ số theo hợp đồng',
    points: ['Không mất phí nếu không tuyển được', 'HR Connect sàng lọc trước khi gửi', 'Bảo hành: ứng viên nghỉ sớm được tuyển thay miễn phí', 'Hợp vị trí khó tuyển, cần kinh nghiệm'],
    cta: 'Nhận tư vấn',
    href: '/contact?service=HEADHUNT_COD',
    featured: true,
  },
  {
    code: 'CV_SOURCING',
    num: '03',
    tag: 'Nguồn hồ sơ nhanh',
    title: 'Mua CV theo số lượng',
    lead: 'Bạn đặt số CV cần. Affiliate tìm hồ sơ, HR Connect sàng lọc và giao CV đạt yêu cầu cho bạn.',
    price: 'Đơn giá × số CV nhận',
    priceNote: 'Đặt cọc trước, quyết toán theo CV được chấp nhận',
    points: ['Đặt đúng số CV bạn cần', 'CV không đạt có lý do hợp lệ được thay', 'Có hạn xem xét cho mỗi CV được giao', 'Hợp khi cần nguồn để tự phỏng vấn'],
    cta: 'Nhận tư vấn',
    href: '/contact?service=CV_SOURCING',
  },
];

/** Matches ServiceTypeAllowedRoleSeeder: CV_SOURCING and HEADHUNT_COD take CVs from Affiliates only. */
const COMPARE: { k: string; a: string; b: string; c: string }[] = [
  { k: 'Ai tìm ứng viên', a: 'Ứng viên tự ứng tuyển', b: 'Mạng lưới Affiliate', c: 'Mạng lưới Affiliate' },
  { k: 'Ai sàng lọc', a: 'Doanh nghiệp', b: 'HR Connect sàng lọc rồi gửi bạn', c: 'HR Connect sàng lọc rồi giao CV' },
  { k: 'Khi nào trả phí', a: 'Trước khi đăng tin', b: 'Sau khi ứng viên đi làm và được đối soát', c: 'Đặt cọc trước, quyết toán sau' },
  { k: 'Hợp đồng dịch vụ', a: 'Không cần', b: 'Có', c: 'Có' },
  { k: 'Bảo hành', a: '—', b: 'Tuyển thay miễn phí trong thời gian bảo hành', c: 'Thay CV không đạt có lý do' },
  { k: 'Thanh toán', a: 'VNPay hoặc chuyển khoản', b: 'VNPay hoặc chuyển khoản', c: 'VNPay hoặc chuyển khoản' },
];

const STEPS = [
  { t: 'Đăng ký', d: 'Tạo tài khoản doanh nghiệp, chờ xác minh công ty.' },
  { t: 'Tạo tin', d: 'Chọn dịch vụ và đề xuất điều khoản cho vị trí.' },
  { t: 'Duyệt và ký', d: 'HR Connect duyệt tin; Affiliate và Mua CV ký hợp đồng.' },
  { t: 'Thanh toán', d: 'Phí đăng tin hoặc tiền cọc qua VNPay, chuyển khoản.' },
  { t: 'Nhận hồ sơ', d: 'Hồ sơ kèm điểm phù hợp, phỏng vấn và gửi offer.' },
  { t: 'Đi làm', d: 'Xác nhận ứng viên đi làm; phí Affiliate tính sau đối soát.' },
];

const FAQ = [
  { q: 'Tôi có thể dùng nhiều dịch vụ cùng lúc không?', a: 'Có. Mỗi tin tuyển dụng chọn một dịch vụ, nên bạn dùng dịch vụ khác nhau cho các vị trí khác nhau.' },
  { q: 'Tuyển qua Affiliate: nếu không tuyển được thì sao?', a: 'Bạn không trả phí dịch vụ. Phí chỉ phát sinh khi ứng viên đi làm và HR Connect đã đối soát.' },
  { q: 'Ứng viên nghỉ việc trong thời gian bảo hành?', a: 'Bạn báo nghỉ việc, HR Connect xác minh và mở một suất tuyển thay miễn phí cho vị trí đó.' },
  { q: 'Mua CV: CV không đạt thì xử lý thế nào?', a: 'Trong hạn xem xét, bạn từ chối CV kèm lý do hợp lệ; CV đó không tính phí và được thay CV khác.' },
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Adds `is-in` once the element scrolls into view (CSS does the motion). A callback ref, so an element that
 * mounts later (the stats strip appears after its data loads) is still observed. */
const useReveal = <T extends HTMLElement>() => {
  const [el, setEl] = useState<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el || shown) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, shown]);
  return { ref: setEl, shown, className: shown ? 'svc-reveal is-in' : 'svc-reveal' };
};

/** Counts from 0 to `value` once, when `run` turns true. */
const useCountUp = (value: number | undefined, run: boolean) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value == null || !run) return;
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 600);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, run]);
  return n;
};

const Stat: React.FC<{ label: string; value: number; run: boolean }> = ({ label, value, run }) => {
  const n = useCountUp(value, run);
  return (
    <div className="bg-[#0C4A6E] px-5 py-4">
      <dt className="text-[12px] text-[#BAE6FD]">{label}</dt>
      <dd className="m-0 mt-1.5 text-[26px] font-extrabold tabular-nums text-white" aria-label={`${value}`}>
        {n.toLocaleString('vi-VN')}
      </dd>
    </div>
  );
};

const Reveal: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' }> = ({ as = 'section', className = '', children, ...rest }) => {
  const r = useReveal<HTMLElement>();
  const Tag = as as 'section';
  return (
    <Tag ref={r.ref} className={`${r.className} ${className}`} {...rest}>
      {children}
    </Tag>
  );
};

export const ServicesPage: React.FC = () => {
  const serviceTypes = useQuery({
    queryKey: ['public-service-types'],
    queryFn: async () => {
      const res = await apiClient.get<{ data?: { items?: ServiceTypeApiDto[] } }>('/service-types', {
        params: { isActive: true, page: 1, pageSize: 20 },
      });
      return res.data?.data?.items ?? [];
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // Real platform numbers from the public lists; a number the API cannot give is not shown.
  const openJobs = useQuery({ queryKey: ['services', 'open-jobs'], queryFn: () => jobsApi.searchPublic({ page: 1, pageSize: 1 }), staleTime: 5 * 60_000 });
  const companies = useQuery({ queryKey: ['services', 'companies'], queryFn: () => companyDirectoryApi.search({ page: 1, pageSize: 1 }), staleTime: 5 * 60_000 });

  const plans = useMemo(() => {
    const items = serviceTypes.data;
    if (!items || items.length === 0) return PLANS;
    const byCode = new Map(items.map((i) => [i.code.trim().toUpperCase(), i]));
    return PLANS.filter((p) => byCode.get(p.code)?.isActive !== false);
  }, [serviceTypes.data]);

  const statsRef = useReveal<HTMLDListElement>();
  const stats = [
    openJobs.data ? { label: 'Tin đang tuyển', value: openJobs.data.totalCount } : null,
    companies.data ? { label: 'Doanh nghiệp đã xác minh', value: companies.data.totalCount } : null,
  ].filter(Boolean) as { label: string; value: number }[];

  return (
    <div className="svc-page bg-white font-['Be_Vietnam_Pro',system-ui,sans-serif] text-[#0F172A]">
      {/* Hero */}
      <section className="bg-[#0C4A6E] text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-6 py-14 lg:py-20">
          <div className="svc-hero min-w-0 flex-[1_1_520px]">
            <p className="m-0 mb-3.5 text-[13px] font-semibold text-[#7DD3FC]">Dịch vụ tuyển dụng cho doanh nghiệp</p>
            <h1 className="m-0 text-[32px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[38px]" style={{ textWrap: 'balance' } as React.CSSProperties}>
              Chọn cách tuyển theo <span className="whitespace-nowrap">từng vị trí.</span>
              <br />
              Trả tiền theo <span className="whitespace-nowrap">kết quả bạn nhận.</span>
            </h1>
            <p className="m-0 mt-4 max-w-[560px] text-[16px] leading-relaxed text-[#E0F2FE]">
              Tự đăng tin khi cần nhiều ứng viên, mua CV đã sàng lọc khi cần nguồn nhanh, hoặc để mạng lưới Affiliate tìm người cho vị trí khó và chỉ trả phí khi ứng viên đi làm.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#svc-compare" className="svc-btn inline-flex min-h-[48px] items-center rounded-lg bg-[#C2410C] px-6 font-bold text-white no-underline hover:bg-[#9A3412] hover:text-white">
                So sánh 3 dịch vụ
              </a>
              <Link to="/contact" className="svc-btn inline-flex min-h-[48px] items-center rounded-lg border border-solid border-white/50 px-6 font-semibold text-white no-underline hover:bg-white/10 hover:text-white">
                Nhận tư vấn
              </Link>
            </div>
          </div>
          <div className="svc-hero-media relative aspect-[3/2] w-full max-w-[520px] flex-[1_1_380px]" aria-hidden="true">
            {/* Product illustration of the three services (no photo, no invented numbers). */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0E5A85] to-[#0B3A57] ring-1 ring-white/10" />
            <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-[#C2410C]/25 blur-2xl" />
            <div className="absolute -bottom-8 left-6 h-36 w-36 rounded-full bg-[#38BDF8]/20 blur-2xl" />

            <div className="svc-float-a absolute left-[7%] top-[10%] w-[52%] rounded-xl bg-white p-4 text-[#0F172A] shadow-[0_18px_40px_rgba(2,22,40,0.35)]">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#E0F2FE] text-[#0369A1]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
                </span>
                <div>
                  <div className="text-[13px] font-bold">Đăng tin tuyển dụng</div>
                  <div className="text-[11px] text-[#64748B]">Ứng viên tự ứng tuyển</div>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-[#E2E8F0]" />
                <div className="h-1.5 w-4/5 rounded-full bg-[#E2E8F0]" />
                <div className="h-1.5 w-3/5 rounded-full bg-[#E2E8F0]" />
              </div>
            </div>

            <div className="svc-float-b absolute right-[6%] top-[30%] w-[54%] rounded-xl bg-[#0C4A6E] p-4 text-white shadow-[0_22px_48px_rgba(2,22,40,0.45)] ring-1 ring-white/15">
              <span className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-[#C2410C]" />
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#C2410C] text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M17 11l2 2 3.5-4" /></svg>
                </span>
                <div>
                  <div className="text-[13px] font-bold">Tuyển qua Affiliate</div>
                  <div className="text-[11px] text-[#BAE6FD]">Trả phí khi tuyển được</div>
                </div>
              </div>
              <div className="mt-3 flex -space-x-2">
                {['#7DD3FC', '#FDBA74', '#A7F3D0', '#C4B5FD'].map((c) => (
                  <span key={c} className="h-7 w-7 rounded-full ring-2 ring-[#0C4A6E]" style={{ background: c }} />
                ))}
              </div>
            </div>

            <div className="svc-float-c absolute bottom-[9%] left-[14%] w-[50%] rounded-xl bg-white p-4 text-[#0F172A] shadow-[0_18px_40px_rgba(2,22,40,0.35)]">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#ECFDF5] text-[#047857]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h10" /><path d="M17 15l2 2 3-3.5" /></svg>
                </span>
                <div>
                  <div className="text-[13px] font-bold">Mua CV theo số lượng</div>
                  <div className="text-[11px] text-[#64748B]">CV đã sàng lọc</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-6 rounded-md bg-[#F1F5F9]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {stats.length > 0 && (
        <div className="border-0 border-t border-solid border-white/15 bg-[#0C4A6E]">
          <dl
            ref={statsRef.ref}
            className={`${statsRef.className} m-0 mx-auto grid max-w-[1200px] gap-px px-6 pb-8`}
            style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
          >
            {stats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} run={statsRef.shown} />
            ))}
          </dl>
        </div>
      )}

      {/* Plans */}
      <Reveal aria-labelledby="svc-plans" className="mx-auto max-w-[1200px] px-6 pb-6 pt-16">
        <h2 id="svc-plans" className="m-0 text-[28px] font-extrabold tracking-[-0.01em]">Ba dịch vụ, ba cách trả phí</h2>
        <p className="m-0 mb-8 mt-2 text-[15px] text-[#475569]">Mỗi tin tuyển dụng chọn một dịch vụ. Bạn có thể dùng cả ba cho các vị trí khác nhau.</p>
        <div className="svc-stagger grid grid-cols-1 gap-5 lg:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.code}
              className={`svc-card relative flex flex-col gap-5 overflow-hidden rounded-xl p-7 ${p.featured ? 'bg-[#0C4A6E] text-white' : 'border border-solid border-[#E2E8F0] bg-white'}`}
            >
              {p.featured && <span aria-hidden="true" className="svc-bar absolute inset-x-0 top-0 h-1 bg-[#C2410C]" />}
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[40px] font-extrabold leading-none ${p.featured ? 'text-[#7DD3FC]' : 'text-[#CBD5E1]'}`}>{p.num}</span>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${p.featured ? 'bg-[#C2410C] text-white' : 'bg-[#F1F5F9] text-[#334155]'}`}>{p.tag}</span>
              </div>
              <div>
                <h3 className="m-0 text-[22px] font-extrabold leading-snug">{p.title}</h3>
                <p className={`m-0 mt-2 text-[14px] leading-relaxed ${p.featured ? 'text-[#BAE6FD]' : 'text-[#475569]'}`}>{p.lead}</p>
              </div>
              <div className={`rounded-lg p-4 ${p.featured ? 'bg-white/10' : 'bg-[#F8FAFC]'}`}>
                <p className={`m-0 text-[12px] ${p.featured ? 'text-[#BAE6FD]' : 'text-[#475569]'}`}>Bạn trả</p>
                <p className="m-0 mt-1 text-[18px] font-extrabold">{p.price}</p>
                <p className={`m-0 mt-1 text-[13px] ${p.featured ? 'text-[#BAE6FD]' : 'text-[#475569]'}`}>{p.priceNote}</p>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[14px] leading-relaxed">
                {p.points.map((pt) => (
                  <li key={pt} className="pl-4 [text-indent:-1rem]">— {pt}</li>
                ))}
              </ul>
              <Link
                to={p.href}
                className={`svc-btn mt-auto flex min-h-[48px] items-center justify-center rounded-lg font-bold no-underline ${p.featured ? 'bg-[#C2410C] text-white hover:bg-[#9A3412] hover:text-white' : 'border border-solid border-[#0C4A6E] text-[#0C4A6E] hover:bg-[#F0F9FF]'}`}
              >
                {p.cta}
              </Link>
            </article>
          ))}
        </div>
      </Reveal>

      {/* Compare */}
      <Reveal id="svc-compare" aria-labelledby="svc-compare-h" className="mx-auto max-w-[1200px] scroll-mt-24 px-6 py-12">
        <h2 id="svc-compare-h" className="m-0 mb-5 text-[22px] font-extrabold">So sánh nhanh</h2>
        <div className="overflow-x-auto rounded-lg border border-solid border-[#E2E8F0] bg-white">
          <table className="w-full min-w-[760px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#F8FAFC] text-left">
                <th scope="col" className="w-[22%] px-4 py-3.5 font-semibold text-[#475569]"><span className="sr-only">Tiêu chí</span></th>
                <th scope="col" className="px-4 py-3.5 font-bold">Đăng tin tuyển dụng</th>
                <th scope="col" className="px-4 py-3.5 font-bold text-[#9A3412]">Tuyển qua Affiliate</th>
                <th scope="col" className="px-4 py-3.5 font-bold">Mua CV theo số lượng</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.k} className="border-0 border-t border-solid border-[#E2E8F0]">
                  <th scope="row" className="px-4 py-3.5 text-left font-semibold text-[#475569]">{r.k}</th>
                  <td className="px-4 py-3.5">{r.a}</td>
                  <td className="bg-[#FFFBF7] px-4 py-3.5">{r.b}</td>
                  <td className="px-4 py-3.5">{r.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Steps */}
      <section aria-labelledby="svc-steps" className="border-0 border-y border-solid border-[#E2E8F0] bg-[#F8FAFC]">
        <Reveal as="div" className="mx-auto max-w-[1200px] px-6 py-14">
          <h2 id="svc-steps" className="m-0 mb-7 text-[22px] font-extrabold">Từ lúc đăng ký đến khi ứng viên đi làm</h2>
          <ol className="svc-stagger svc-steps m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-6">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative pt-3.5">
                <span aria-hidden="true" className="svc-line absolute inset-x-0 top-0 h-0.5 bg-[#0C4A6E]" style={{ transitionDelay: `${i * 90}ms` }} />
                <span className="text-[13px] font-extrabold text-[#0C4A6E]">{String(i + 1).padStart(2, '0')}</span>
                <p className="m-0 mt-1.5 text-[15px] font-bold">{s.t}</p>
                <p className="m-0 mt-1.5 text-[13px] leading-relaxed text-[#475569]">{s.d}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* FAQ */}
      <Reveal aria-labelledby="svc-faq" className="mx-auto flex max-w-[1200px] flex-wrap gap-12 px-6 py-14">
        <div className="flex-[1_1_280px]">
          <h2 id="svc-faq" className="m-0 text-[22px] font-extrabold">Câu hỏi thường gặp</h2>
          <p className="m-0 mt-2.5 text-[14px] leading-relaxed text-[#475569]">Chưa thấy câu trả lời? Đội HR Connect sẽ gọi lại cho bạn trong giờ làm việc.</p>
        </div>
        <div className="svc-stagger flex-[2_1_560px] border-0 border-t border-solid border-[#E2E8F0]">
          {FAQ.map((f) => (
            <details key={f.q} className="svc-faq border-0 border-b border-solid border-[#E2E8F0]">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <svg className="svc-chevron shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </summary>
              <div className="svc-faq-body">
                <div className="overflow-hidden">
                  <p className="m-0 pb-4 text-[14px] leading-relaxed text-[#475569]">{f.a}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Reveal>

      {/* Closing band */}
      <Reveal className="bg-[#0C4A6E] text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-6 py-12">
          <div>
            <h2 className="m-0 text-[24px] font-extrabold">Chưa biết chọn dịch vụ nào?</h2>
            <p className="m-0 mt-2 text-[15px] text-[#E0F2FE]">Gửi vị trí bạn cần tuyển, chúng tôi đề xuất dịch vụ và mức phí phù hợp.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/contact" className="svc-btn inline-flex min-h-[48px] items-center rounded-lg bg-[#C2410C] px-6 font-bold text-white no-underline hover:bg-[#9A3412] hover:text-white">Nhận tư vấn</Link>
            <Link to="/client/jobs/create" className="svc-btn inline-flex min-h-[48px] items-center rounded-lg border border-solid border-white/50 px-6 font-semibold text-white no-underline hover:bg-white/10 hover:text-white">Đăng tin ngay</Link>
          </div>
        </div>
      </Reveal>
    </div>
  );
};

export default ServicesPage;
