import React, { useEffect } from 'react';
import {
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { BrandMark } from '@/components/common/BrandMark';

const ROLE_SOLUTIONS = [
  {
    title: 'Candidate',
    subtitle: 'Tìm việc và quản lý hành trình ứng tuyển',
    description: 'Lưu CV, ứng tuyển, xác nhận hồ sơ do Affiliate giới thiệu và theo dõi từng thay đổi của đơn ứng tuyển.',
    icon: UserOutlined,
    accent: 'bg-blue-50 text-blue-600 border border-blue-100/80',
    action: 'Khám phá việc làm',
    path: '/jobs',
  },
  {
    title: 'Affiliate Recruiter',
    subtitle: 'Giới thiệu đúng người, theo dõi đúng nguồn',
    description: 'Nộp hồ sơ có sự đồng ý của Candidate, theo dõi trạng thái và giữ nguồn giới thiệu minh bạch.',
    icon: TeamOutlined,
    accent: 'bg-emerald-50 text-emerald-600 border border-emerald-100/80',
    action: 'Đăng ký Affiliate',
    path: '/register',
  },
  {
    title: 'Client Company',
    subtitle: 'Tuyển dụng theo một quy trình thống nhất',
    description: 'Quản lý tin tuyển dụng, xem ứng viên theo từng Job và phối hợp cùng HR trên cùng một luồng dữ liệu.',
    icon: BankOutlined,
    accent: 'bg-indigo-50 text-indigo-600 border border-indigo-100/80',
    action: 'Đăng ký doanh nghiệp',
    path: '/register',
  },
  {
    title: 'Internal HR & Admin',
    subtitle: 'Vận hành, kiểm soát và truy vết rõ ràng',
    description: 'Duyệt tài khoản, hỗ trợ sàng lọc, kiểm soát quyền truy cập và tra cứu audit log khi cần.',
    icon: SafetyCertificateOutlined,
    accent: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    action: 'Đăng nhập hệ thống',
    path: '/login',
  },
] as const;

const PIPELINE_STEPS = [
  {
    step: '01',
    role: 'Candidate & Affiliate',
    action: 'Tiếp nhận hồ sơ & xác thực ủy quyền Consent',
    badge: 'Verified',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    nodeClass: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  },
  {
    step: '02',
    role: 'HR Connect Core',
    action: 'Kiểm tra danh tính, chống trùng lặp dữ liệu & tách nguồn',
    badge: 'Anti-Duplicate',
    badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    nodeClass: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400',
  },
  {
    step: '03',
    role: 'AI Matching Engine',
    action: 'Đối chiếu CV & Job Description, chấm điểm kỹ năng tự động',
    badge: 'AI Matching',
    badgeClass: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    nodeClass: 'border-violet-500/40 bg-violet-500/10 text-violet-400',
  },
  {
    step: '04',
    role: 'Client & HR Partner',
    action: 'Phối hợp phỏng vấn, theo dõi tiến độ & hoàn tất tuyển dụng',
    badge: 'Live Sync',
    badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    nodeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  },
] as const;

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Mở nhu cầu tuyển dụng',
    description: 'Doanh nghiệp tạo Job và chọn loại dịch vụ phù hợp với nhu cầu.',
  },
  {
    number: '02',
    title: 'Tiếp nhận hồ sơ có kiểm soát',
    description: 'Candidate tự ứng tuyển hoặc Affiliate giới thiệu sau khi Candidate đồng ý.',
  },
  {
    number: '03',
    title: 'Hỗ trợ sàng lọc bằng AI',
    description: 'CV và yêu cầu công việc được đối chiếu để hỗ trợ người có thẩm quyền đánh giá.',
  },
  {
    number: '04',
    title: 'Theo dõi đến khi hoàn tất',
    description: 'Mọi bên theo dõi đúng phần việc của mình trên cùng một hành trình tuyển dụng.',
  },
] as const;

const GUARANTEES = [
  'Candidate kiểm soát việc Affiliate sử dụng hồ sơ',
  'Nguồn giới thiệu được ghi nhận minh bạch',
  'Quyền truy cập được tách theo từng vai trò',
  'Thao tác quan trọng có lịch sử để kiểm tra',
] as const;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#roles') {
      window.requestAnimationFrame(() => {
        document.getElementById('roles')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.hash]);

  const scrollToWorkflow = () => {
    document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC] text-slate-900">
      <Navbar />

      <main className="w-full">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden border-0 border-b border-solid border-slate-200/80 bg-white">
          {/* Subtle Ambient Glows */}
          <div className="pointer-events-none absolute -right-28 -top-44 h-[520px] w-[520px] rounded-full bg-blue-100/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-indigo-50/60 blur-3xl" />

          <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-12 sm:gap-16 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 py-14 sm:py-20 lg:py-24">
            {/* Left Content */}
            <div className="min-w-0">
              <div className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-solid border-blue-200/80 bg-blue-50/70 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 shadow-sm backdrop-blur-sm">
                <CheckCircleFilled aria-hidden className="shrink-0 text-blue-600" />
                <span className="truncate sm:whitespace-normal">Nền tảng tuyển dụng hợp nhất & AI Matching</span>
              </div>

              <h1 className="m-0 max-w-[760px] text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-extrabold leading-[1.15] sm:leading-[1.12] tracking-tight text-slate-950 break-words">
                Kết nối đúng người,
                <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  đúng cơ hội, đúng quy trình.
                </span>
              </h1>

              <p className="mb-0 mt-5 sm:mt-6 max-w-[640px] text-base sm:text-lg leading-relaxed text-slate-600">
                HR Connect giúp Candidate, Affiliate Recruiter, doanh nghiệp và đội ngũ HR làm việc trên cùng một luồng rõ ràng — từ lúc nộp CV đến khi hoàn tất tuyển dụng.
              </p>

              {/* CTAs */}
              <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row sm:items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-blue-600 px-6 text-sm sm:text-base font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98]"
                >
                  <span>Khám phá cơ hội</span>
                  <ArrowRightOutlined aria-hidden className="text-xs transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={scrollToWorkflow}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-solid border-slate-200/90 bg-white px-6 text-sm sm:text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
                >
                  Tìm hiểu quy trình
                </button>
              </div>

              <p className="mb-0 mt-5 text-sm text-slate-500">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="cursor-pointer border-0 bg-transparent p-0 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Đăng nhập vào workspace của bạn
                </button>
              </p>
            </div>

            {/* Right SaaS Pipeline Card */}
            <div id="workflow" className="relative min-w-0">
              <div className="pointer-events-none absolute -inset-1 rounded-[32px] bg-gradient-to-tr from-blue-600/20 via-indigo-500/10 to-teal-500/20 opacity-70 blur-xl" />

              <div className="relative w-full rounded-2xl sm:rounded-3xl border border-solid border-slate-800/80 bg-slate-900/95 p-5 sm:p-7 text-white shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
                {/* Header status bar */}
                <div className="flex items-center justify-between border-0 border-b border-solid border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                    </div>
                    <span className="ml-2 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Workflow Pipeline
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-solid border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Real-time Sync</span>
                  </div>
                </div>

                <div className="mt-4 mb-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-blue-400">
                        HR Connect workflow
                      </p>
                      <h2 className="mb-0 mt-1 text-lg sm:text-xl font-bold tracking-tight text-white break-words">
                        Một hồ sơ, một hành trình rõ ràng
                      </h2>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-solid border-blue-500/20 text-blue-400">
                      <SolutionOutlined aria-hidden className="text-base" />
                    </span>
                  </div>
                </div>

                {/* Timeline Stepper */}
                <div className="relative space-y-0">
                  {PIPELINE_STEPS.map((item, index) => {
                    const isLast = index === PIPELINE_STEPS.length - 1;
                    return (
                      <div key={item.step} className="group relative flex items-start gap-3.5 pb-5 last:pb-0">
                        {/* Connecting line */}
                        {!isLast && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-[15px] top-8 bottom-0 w-px bg-slate-800 transition-colors group-hover:bg-slate-700"
                          />
                        )}

                        {/* Stepper node */}
                        <div
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-solid font-mono text-xs font-bold transition-all duration-200 ${item.nodeClass}`}
                        >
                          {item.step}
                        </div>

                        {/* Step Details & Status Badge */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-400 truncate">{item.role}</span>
                            <span
                              className={`shrink-0 rounded-md border border-solid px-2 py-0.5 text-[10px] font-semibold tracking-wide ${item.badgeClass}`}
                            >
                              {item.badge}
                            </span>
                          </div>
                          <p className="mb-0 mt-1 text-xs sm:text-sm font-medium leading-snug text-slate-200">
                            {item.action}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Trust & Security Pill */}
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-solid border-slate-800 bg-slate-800/40 p-3 sm:p-3.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-solid border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <SafetyCertificateOutlined className="text-base" />
                  </div>
                  <p className="m-0 text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-white">Trust & Security:</span> Consent, phân quyền và audit được đặt trong cùng quy trình.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROLE SOLUTIONS */}
        <section id="roles" className="scroll-mt-24 px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <p className="m-0 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-600">
                Dành cho mọi vai trò
              </p>
              <h2 className="mb-0 mt-2 sm:mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950">
                Mỗi người thấy đúng việc mình cần làm
              </h2>
              <p className="mb-0 mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
                Không cần học một hệ thống phức tạp. Mỗi workspace được tổ chức theo nhiệm vụ và quyền của từng vai trò.
              </p>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {ROLE_SOLUTIONS.map((role) => {
                const Icon = role.icon;
                return (
                  <article
                    key={role.title}
                    className="group flex flex-col justify-between rounded-2xl border border-solid border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-transform duration-200 group-hover:scale-105 ${role.accent}`}
                        >
                          <Icon aria-hidden />
                        </div>
                        <span className="rounded-full border border-solid border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {role.title}
                        </span>
                      </div>

                      <h3 className="mb-0 mt-5 text-xl font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                        {role.subtitle}
                      </h3>
                      <p className="mb-0 mt-2.5 text-sm sm:text-base leading-relaxed text-slate-600">
                        {role.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(role.path)}
                      className="mt-6 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
                    >
                      <span>{role.action}</span>
                      <ArrowRightOutlined aria-hidden className="transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* PROCESS STEPS */}
        <section id="process" className="scroll-mt-24 border-0 border-y border-solid border-slate-200/80 bg-white px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="m-0 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-600">
                  Quy trình xuyên suốt
                </p>
                <h2 className="mb-0 mt-2 sm:mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950">
                  Dữ liệu đi cùng hồ sơ, không bị đứt đoạn giữa các bên
                </h2>
                <p className="mb-0 mt-4 sm:mt-5 text-base sm:text-lg leading-relaxed text-slate-600">
                  Mỗi bước tạo ra đầu ra rõ ràng để bước tiếp theo có thể tiếp tục, đồng thời giữ được lịch sử khi cần đối chiếu.
                </p>
              </div>

              <div className="space-y-4">
                {PROCESS_STEPS.map((step) => (
                  <article
                    key={step.number}
                    className="grid grid-cols-[44px_1fr] sm:grid-cols-[52px_1fr] gap-4 sm:gap-5 rounded-2xl border border-solid border-slate-200/80 bg-slate-50/50 p-5 sm:p-6 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                  >
                    <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-blue-50 font-mono text-xs sm:text-sm font-bold text-blue-600 border border-solid border-blue-100">
                      {step.number}
                    </span>
                    <div className="min-w-0">
                      <h3 className="m-0 text-base sm:text-lg font-bold text-slate-950 break-words">{step.title}</h3>
                      <p className="mb-0 mt-1.5 text-sm sm:text-base leading-relaxed text-slate-600">{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ENTERPRISE GUARANTEE & AI */}
        <section className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 overflow-hidden rounded-3xl border border-solid border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 shadow-2xl ring-1 ring-white/10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-12 text-white">
              <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-solid border-blue-500/20 bg-blue-500/15 text-lg sm:text-xl text-blue-400">
                <FileSearchOutlined aria-hidden />
              </span>
              <h2 className="mb-0 mt-5 sm:mt-6 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                Tuyển dụng nhanh hơn nhưng vẫn giữ quyền kiểm soát
              </h2>
              <p className="mb-0 mt-4 sm:mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
                AI hỗ trợ phân tích và sắp xếp thông tin. Quyết định tuyển dụng vẫn thuộc về những người có thẩm quyền trong quy trình.
              </p>
            </div>
            <div className="border-0 border-t border-solid border-slate-800 bg-slate-950/30 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-12 flex flex-col justify-center">
              <div className="space-y-3.5">
                {GUARANTEES.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-solid border-slate-800/80 bg-slate-800/40 p-3.5 sm:p-4 backdrop-blur-sm transition-colors hover:border-slate-700"
                  >
                    <CheckCircleFilled aria-hidden className="mt-0.5 text-blue-400 shrink-0 text-base" />
                    <span className="leading-relaxed text-sm sm:text-base text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="border-0 border-t border-solid border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 px-4 sm:px-6 lg:px-10 py-16 sm:py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="m-0 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-950">
              Bắt đầu từ đúng workspace của bạn
            </h2>
            <p className="mb-0 mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-slate-600">
              Tạo tài khoản để sử dụng HR Connect theo vai trò, hoặc xem trước các cơ hội việc làm đang mở.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-0 bg-blue-600 px-7 text-sm sm:text-base font-semibold text-white shadow-sm shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98]"
              >
                Đăng ký ngay
              </button>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-solid border-slate-200/90 bg-white px-7 text-sm sm:text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
              >
                Xem việc làm
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-0 border-t border-solid border-slate-800 bg-slate-950 px-4 sm:px-6 lg:px-10 py-8 text-slate-400">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 text-xs sm:text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size={32} tone="light" />
            <span>
              <strong className="text-white font-semibold">HR Connect</strong> · Nền tảng tuyển dụng và kết nối nhân tài
            </span>
          </div>
          <span className="text-slate-500">© 2026 HR Connect. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

