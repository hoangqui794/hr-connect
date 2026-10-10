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
    accent: 'bg-teal-50 text-teal-700 ring-teal-100',
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
    <div className="min-h-screen bg-[#F7FAF9] text-slate-900">
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-0 border-b border-solid border-slate-200/70 bg-white">
          <div className="pointer-events-none absolute -right-28 -top-44 h-[520px] w-[520px] rounded-full bg-teal-100/55 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-48 -left-24 h-[420px] w-[420px] rounded-full bg-amber-100/45 blur-3xl" />

          <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-14 px-6 py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-solid border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800">
                <CheckCircleFilled aria-hidden />
                Một nền tảng cho toàn bộ hành trình tuyển dụng
              </div>

              <h1 className="m-0 max-w-[760px] text-[46px] font-extrabold leading-[1.08] tracking-[-0.045em] text-slate-950 lg:text-[62px]">
                Kết nối đúng người,
                <span className="block text-teal-700">đúng cơ hội, đúng quy trình.</span>
              </h1>

              <p className="mb-0 mt-7 max-w-[690px] text-lg leading-8 text-slate-600">
                HR Connect giúp Candidate, Affiliate Recruiter, doanh nghiệp và đội ngũ HR làm việc trên cùng một luồng rõ ràng — từ lúc nộp CV đến khi hoàn tất tuyển dụng.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-teal-700 px-6 text-base font-bold text-white shadow-[0_12px_30px_rgba(15,118,110,0.22)] transition hover:bg-teal-800"
                >
                  Khám phá việc làm
                  <ArrowRightOutlined aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex min-h-12 cursor-pointer items-center rounded-xl border border-solid border-slate-300 bg-white px-6 text-base font-bold text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
                >
                  Tạo tài khoản
                </button>
              </div>

              <p className="mb-0 mt-5 text-sm text-slate-500">
                Đã có tài khoản?{' '}
                <button type="button" onClick={() => navigate('/login')} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-teal-700 hover:text-teal-900">
                  Đăng nhập vào workspace của bạn
                </button>
              </p>
            </div>

            <div className="relative">
              <div className="rounded-[30px] border border-solid border-slate-200 bg-slate-950 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.2)] lg:p-8">
                <div className="flex items-center justify-between gap-4 border-0 border-b border-solid border-white/10 pb-5">
                  <div>
                    <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-teal-300">HR Connect workflow</p>
                    <h2 className="mb-0 mt-2 text-2xl font-bold">Một hồ sơ, một hành trình rõ ràng</h2>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-400/15 text-xl text-teal-300">
                    <SolutionOutlined aria-hidden />
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  {[
                    ['Candidate / Affiliate', 'Nộp hồ sơ đúng quyền'],
                    ['HR Connect', 'Kiểm tra danh tính & trùng lặp'],
                    ['AI Matching', 'Hỗ trợ chấm điểm hồ sơ'],
                    ['Client & HR', 'Theo dõi quy trình tuyển dụng'],
                  ].map(([owner, task], index) => (
                    <div key={owner} className="flex items-center gap-4 rounded-2xl border border-solid border-white/10 bg-white/[0.06] p-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-400 text-sm font-extrabold text-slate-950">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 text-xs font-semibold text-slate-400">{owner}</p>
                        <p className="mb-0 mt-1 font-semibold text-white">{task}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-2xl bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950">
                  <SafetyCertificateOutlined aria-hidden className="text-lg" />
                  Consent, phân quyền và audit được đặt trong cùng quy trình
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="roles" className="scroll-mt-24 px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-3xl">
              <p className="m-0 text-sm font-extrabold uppercase tracking-[0.16em] text-teal-700">Dành cho mọi vai trò</p>
              <h2 className="mb-0 mt-3 text-4xl font-extrabold tracking-[-0.035em] text-slate-950">Mỗi người thấy đúng việc mình cần làm</h2>
              <p className="mb-0 mt-4 text-lg leading-8 text-slate-600">Không cần học một hệ thống phức tạp. Mỗi workspace được tổ chức theo nhiệm vụ và quyền của từng vai trò.</p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              {ROLE_SOLUTIONS.map((role) => {
                const Icon = role.icon;
                return (
                  <article key={role.title} className="group rounded-[26px] border border-solid border-slate-200 bg-white p-7 shadow-[0_16px_45px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_20px_55px_rgba(15,118,110,0.10)]">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl ring-1 ${role.accent}`}>
                      <Icon aria-hidden />
                    </div>
                    <p className="mb-0 mt-6 text-sm font-bold uppercase tracking-[0.12em] text-slate-500">{role.title}</p>
                    <h3 className="mb-0 mt-2 text-2xl font-bold text-slate-950">{role.subtitle}</h3>
                    <p className="mb-0 mt-3 leading-7 text-slate-600">{role.description}</p>
                    <button type="button" onClick={() => navigate(role.path)} className="mt-6 inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-sm font-bold text-teal-700 group-hover:text-teal-900">
                      {role.action}
                      <ArrowRightOutlined aria-hidden />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-0 border-y border-solid border-slate-200 bg-white px-6 py-24 lg:px-10">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="m-0 text-sm font-extrabold uppercase tracking-[0.16em] text-teal-700">Quy trình xuyên suốt</p>
                <h2 className="mb-0 mt-3 text-4xl font-extrabold tracking-[-0.035em] text-slate-950">Dữ liệu đi cùng hồ sơ, không bị đứt đoạn giữa các bên</h2>
                <p className="mb-0 mt-5 text-lg leading-8 text-slate-600">Mỗi bước tạo ra đầu ra rõ ràng để bước tiếp theo có thể tiếp tục, đồng thời giữ được lịch sử khi cần đối chiếu.</p>
              </div>

              <div className="space-y-4">
                {PROCESS_STEPS.map((step) => (
                  <article key={step.number} className="grid grid-cols-[64px_1fr] gap-5 rounded-2xl border border-solid border-slate-200 bg-[#F9FBFA] p-6">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-sm font-extrabold text-teal-300">{step.number}</span>
                    <div>
                      <h3 className="m-0 text-xl font-bold text-slate-950">{step.title}</h3>
                      <p className="mb-0 mt-2 leading-7 text-slate-600">{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-24 lg:px-10">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 overflow-hidden rounded-[30px] border border-solid border-slate-200 bg-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.16)] lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-8 text-white lg:p-12">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-400/15 text-xl text-teal-300"><FileSearchOutlined aria-hidden /></span>
              <h2 className="mb-0 mt-6 text-4xl font-extrabold tracking-[-0.035em]">Tuyển dụng nhanh hơn nhưng vẫn giữ quyền kiểm soát</h2>
              <p className="mb-0 mt-5 max-w-2xl text-lg leading-8 text-slate-300">AI hỗ trợ phân tích và sắp xếp thông tin. Quyết định tuyển dụng vẫn thuộc về những người có thẩm quyền trong quy trình.</p>
            </div>
            <div className="border-0 border-t border-solid border-white/10 bg-white/[0.05] p-8 lg:border-l lg:border-t-0 lg:p-12">
              <div className="space-y-4">
                {GUARANTEES.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-slate-100">
                    <CheckCircleFilled aria-hidden className="mt-1 text-teal-300" />
                    <span className="leading-7">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-0 border-t border-solid border-slate-200 bg-white px-6 py-20 text-center lg:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="m-0 text-4xl font-extrabold tracking-[-0.035em] text-slate-950">Bắt đầu từ đúng workspace của bạn</h2>
            <p className="mb-0 mt-4 text-lg leading-8 text-slate-600">Tạo tài khoản để sử dụng HR Connect theo vai trò, hoặc xem trước các cơ hội việc làm đang mở.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => navigate('/register')} className="min-h-12 cursor-pointer rounded-xl border-0 bg-teal-700 px-7 text-base font-bold text-white hover:bg-teal-800">Đăng ký ngay</button>
              <button type="button" onClick={() => navigate('/jobs')} className="min-h-12 cursor-pointer rounded-xl border border-solid border-slate-300 bg-white px-7 text-base font-bold text-slate-800 hover:border-teal-300 hover:bg-teal-50">Xem việc làm</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-0 border-t border-solid border-slate-800 bg-slate-950 px-6 py-8 text-slate-400 lg:px-10">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 font-extrabold text-white">H</span>
            <span><strong className="text-white">HR Connect</strong> · Nền tảng tuyển dụng và kết nối nhân tài</span>
          </div>
          <span>© 2026 HR Connect</span>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
