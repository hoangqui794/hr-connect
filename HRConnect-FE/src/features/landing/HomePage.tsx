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

const ROLE_SOLUTIONS = [
  {
    title: 'Candidate',
    subtitle: 'Tìm việc và quản lý hành trình ứng tuyển',
    description: 'Lưu CV, ứng tuyển, xác nhận hồ sơ do Affiliate giới thiệu và theo dõi từng thay đổi của đơn ứng tuyển.',
    icon: UserOutlined,
    accent: 'bg-blue-50 text-blue-700 ring-blue-100',
    action: 'Khám phá việc làm',
    path: '/jobs',
  },
  {
    title: 'Affiliate Recruiter',
    subtitle: 'Giới thiệu đúng người, theo dõi đúng nguồn',
    description: 'Nộp hồ sơ có sự đồng ý của Candidate, theo dõi trạng thái và giữ nguồn giới thiệu minh bạch.',
    icon: TeamOutlined,
    accent: 'bg-amber-50 text-amber-700 ring-amber-100',
    action: 'Đăng ký Affiliate',
    path: '/register',
  },
  {
    title: 'Client Company',
    subtitle: 'Tuyển dụng theo một quy trình thống nhất',
    description: 'Quản lý tin tuyển dụng, xem ứng viên theo từng Job và phối hợp cùng HR trên cùng một luồng dữ liệu.',
    icon: BankOutlined,
    accent: 'bg-sky-50 text-sky-700 ring-sky-100',
    action: 'Đăng ký doanh nghiệp',
    path: '/register',
  },
  {
    title: 'Internal HR & Admin',
    subtitle: 'Vận hành, kiểm soát và truy vết rõ ràng',
    description: 'Duyệt tài khoản, hỗ trợ sàng lọc, kiểm soát quyền truy cập và tra cứu audit log khi cần.',
    icon: SafetyCertificateOutlined,
    accent: 'bg-slate-100 text-slate-700 ring-slate-200',
    action: 'Đăng nhập hệ thống',
    path: '/login',
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

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F7FAF9] text-slate-900">
      <Navbar />

      <main className="w-full">
        <section className="relative overflow-hidden border-0 border-b border-solid border-slate-200/70 bg-white">
          <div className="pointer-events-none absolute -right-28 -top-44 h-[520px] w-[520px] rounded-full bg-blue-100/55 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-amber-100/45 blur-3xl" />

          <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-10 sm:gap-14 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 py-12 sm:py-16 lg:py-24">
            <div className="min-w-0">
              <div className="mb-5 sm:mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-solid border-blue-200 bg-blue-50 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-blue-800">
                <CheckCircleFilled aria-hidden className="shrink-0" />
                <span className="truncate sm:whitespace-normal">Một nền tảng cho toàn bộ hành trình tuyển dụng</span>
              </div>

              <h1 className="m-0 max-w-[760px] text-3xl sm:text-4xl md:text-5xl lg:text-[60px] font-extrabold leading-[1.15] sm:leading-[1.1] tracking-[-0.04em] text-slate-950 break-words">
                Kết nối đúng người,
                <span className="block text-blue-700">đúng cơ hội, đúng quy trình.</span>
              </h1>

              <p className="mb-0 mt-5 sm:mt-7 max-w-[690px] text-base sm:text-lg leading-7 sm:leading-8 text-slate-600">
                HR Connect giúp Candidate, Affiliate Recruiter, doanh nghiệp và đội ngũ HR làm việc trên cùng một luồng rõ ràng — từ lúc nộp CV đến khi hoàn tất tuyển dụng.
              </p>

              <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-blue-700 px-6 text-base font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.22)] transition hover:bg-blue-800"
                >
                  Khám phá việc làm
                  <ArrowRightOutlined aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-solid border-slate-300 bg-white px-6 text-base font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  Tạo tài khoản
                </button>
              </div>

              <p className="mb-0 mt-5 text-sm text-slate-500">
                Đã có tài khoản?{' '}
                <button type="button" onClick={() => navigate('/login')} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-blue-700 hover:text-blue-900">
                  Đăng nhập vào workspace của bạn
                </button>
              </p>
            </div>

            <div className="relative min-w-0">
              <div className="w-full rounded-2xl sm:rounded-[30px] border border-solid border-blue-200/50 bg-blue-950 p-5 sm:p-6 lg:p-8 text-white shadow-[0_30px_80px_rgba(23,37,84,0.25)]">
                <div className="flex items-center justify-between gap-4 border-0 border-b border-solid border-white/10 pb-5">
                  <div className="min-w-0">
                    <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-blue-300">HR Connect workflow</p>
                    <h2 className="mb-0 mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold break-words">Một hồ sơ, một hành trình rõ ràng</h2>
                  </div>
                  <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-400/15 text-lg sm:text-xl text-blue-300">
                    <SolutionOutlined aria-hidden />
                  </span>
                </div>

                <div className="mt-5 sm:mt-6 space-y-3">
                  {[
                    ['Candidate / Affiliate', 'Nộp hồ sơ đúng quyền'],
                    ['HR Connect', 'Kiểm tra danh tính & trùng lặp'],
                    ['AI Matching', 'Hỗ trợ chấm điểm hồ sơ'],
                    ['Client & HR', 'Theo dõi quy trình tuyển dụng'],
                  ].map(([owner, task], index) => (
                    <div key={owner} className="flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-solid border-white/10 bg-white/[0.06] p-3.5 sm:p-4">
                      <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-blue-400 text-xs sm:text-sm font-extrabold text-slate-950">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-semibold text-slate-400 truncate">{owner}</p>
                        <p className="mb-0 mt-0.5 sm:mt-1 text-sm sm:text-base font-semibold text-white break-words">{task}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl bg-blue-400 px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold text-slate-950">
                  <SafetyCertificateOutlined aria-hidden className="text-base sm:text-lg shrink-0" />
                  <span className="leading-snug">Consent, phân quyền và audit được đặt trong cùng quy trình</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className="scroll-mt-24 px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <p className="m-0 text-xs sm:text-sm font-extrabold uppercase tracking-[0.16em] text-blue-700">Dành cho mọi vai trò</p>
              <h2 className="mb-0 mt-2 sm:mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-0.035em] text-slate-950">Mỗi người thấy đúng việc mình cần làm</h2>
              <p className="mb-0 mt-3 sm:mt-4 text-base sm:text-lg leading-7 sm:leading-8 text-slate-600">Không cần học một hệ thống phức tạp. Mỗi workspace được tổ chức theo nhiệm vụ và quyền của từng vai trò.</p>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              {ROLE_SOLUTIONS.map((role) => {
                const Icon = role.icon;
                return (
                  <article key={role.title} className="group rounded-2xl sm:rounded-[26px] border border-solid border-slate-200 bg-white p-6 sm:p-7 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_55px_rgba(37,99,235,0.10)]">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ring-1 ${role.accent}`}>
                      <Icon aria-hidden />
                    </div>
                    <p className="mb-0 mt-5 sm:mt-6 text-xs sm:text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{role.title}</p>
                    <h3 className="mb-0 mt-2 text-xl sm:text-2xl font-bold text-slate-950">{role.subtitle}</h3>
                    <p className="mb-0 mt-2.5 sm:mt-3 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600">{role.description}</p>
                    <button type="button" onClick={() => navigate(role.path)} className="mt-5 sm:mt-6 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-sm font-bold text-blue-700 group-hover:text-blue-900">
                      {role.action}
                      <ArrowRightOutlined aria-hidden />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-0 border-y border-solid border-slate-200 bg-white px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="m-0 text-xs sm:text-sm font-extrabold uppercase tracking-[0.16em] text-blue-700">Quy trình xuyên suốt</p>
                <h2 className="mb-0 mt-2 sm:mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-0.035em] text-slate-950">Dữ liệu đi cùng hồ sơ, không bị đứt đoạn giữa các bên</h2>
                <p className="mb-0 mt-4 sm:mt-5 text-base sm:text-lg leading-7 sm:leading-8 text-slate-600">Mỗi bước tạo ra đầu ra rõ ràng để bước tiếp theo có thể tiếp tục, đồng thời giữ được lịch sử khi cần đối chiếu.</p>
              </div>

              <div className="space-y-4">
                {PROCESS_STEPS.map((step) => (
                  <article key={step.number} className="grid grid-cols-[48px_1fr] sm:grid-cols-[64px_1fr] gap-4 sm:gap-5 rounded-2xl border border-solid border-slate-200 bg-[#F9FBFA] p-5 sm:p-6">
                    <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-700 text-xs sm:text-sm font-extrabold text-white">{step.number}</span>
                    <div className="min-w-0">
                      <h3 className="m-0 text-lg sm:text-xl font-bold text-slate-950 break-words">{step.title}</h3>
                      <p className="mb-0 mt-1.5 sm:mt-2 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600">{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 overflow-hidden rounded-2xl sm:rounded-[30px] border border-solid border-blue-900/50 bg-gradient-to-br from-blue-950 to-indigo-950 shadow-[0_28px_80px_rgba(23,37,84,0.2)] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-12 text-white">
              <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-blue-400/15 text-lg sm:text-xl text-blue-300"><FileSearchOutlined aria-hidden /></span>
              <h2 className="mb-0 mt-5 sm:mt-6 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-0.035em]">Tuyển dụng nhanh hơn nhưng vẫn giữ quyền kiểm soát</h2>
              <p className="mb-0 mt-4 sm:mt-5 max-w-2xl text-base sm:text-lg leading-7 sm:leading-8 text-slate-300">AI hỗ trợ phân tích và sắp xếp thông tin. Quyết định tuyển dụng vẫn thuộc về những người có thẩm quyền trong quy trình.</p>
            </div>
            <div className="border-0 border-t border-solid border-white/10 bg-white/[0.05] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-12">
              <div className="space-y-4">
                {GUARANTEES.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-slate-100">
                    <CheckCircleFilled aria-hidden className="mt-1 text-blue-300 shrink-0" />
                    <span className="leading-6 sm:leading-7 text-sm sm:text-base">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-0 border-t border-solid border-slate-200 bg-white px-4 sm:px-6 lg:px-10 py-16 sm:py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="m-0 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-0.035em] text-slate-950">Bắt đầu từ đúng workspace của bạn</h2>
            <p className="mb-0 mt-3 sm:mt-4 text-base sm:text-lg leading-7 sm:leading-8 text-slate-600">Tạo tài khoản để sử dụng HR Connect theo vai trò, hoặc xem trước các cơ hội việc làm đang mở.</p>
            <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button type="button" onClick={() => navigate('/register')} className="min-h-12 cursor-pointer rounded-xl border-0 bg-blue-700 px-7 text-base font-bold text-white hover:bg-blue-800">Đăng ký ngay</button>
              <button type="button" onClick={() => navigate('/jobs')} className="min-h-12 cursor-pointer rounded-xl border border-solid border-slate-300 bg-white px-7 text-base font-bold text-slate-800 hover:border-blue-300 hover:bg-blue-50">Xem việc làm</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-0 border-t border-solid border-blue-900 bg-blue-950 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 text-slate-400">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 text-xs sm:text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-600 font-extrabold text-white">H</span>
            <span><strong className="text-white">HR Connect</strong> · Nền tảng tuyển dụng và kết nối nhân tài</span>
          </div>
          <span>© 2026 HR Connect</span>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
