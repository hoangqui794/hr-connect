import React, { useEffect } from 'react';
import {
  ArrowRightOutlined,
  BankOutlined,
  CheckCircleFilled,
  CheckOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { BrandMark } from '@/components/common/BrandMark';

const ROLE_SOLUTIONS = [
  {
    title: 'Candidate',
    description: 'Tìm kiếm cơ hội việc làm mơ ước, tối ưu CV bằng AI và theo dõi minh bạch từng vòng ứng tuyển.',
    icon: UserOutlined,
    accent: 'bg-blue-50 text-blue-600 border border-blue-100',
    action: 'Tìm việc ngay',
    path: '/jobs',
  },
  {
    title: 'Affiliate Recruiter',
    description: 'Giới thiệu nhân tài với xác thực ủy quyền Consent, cơ chế chống trùng nguồn và nhận hoa hồng tự động.',
    icon: TeamOutlined,
    accent: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    action: 'Đăng ký Affiliate',
    path: '/register',
  },
  {
    title: 'Client Company',
    description: 'Đăng tin tuyển dụng đa kênh, tiếp cận nguồn ứng viên chất lượng cao đã qua sàng lọc AI và tối ưu chi phí.',
    icon: BankOutlined,
    accent: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    action: 'Đăng ký Doanh nghiệp',
    path: '/register',
  },
  {
    title: 'Internal HR & Admin',
    description: 'Điều phối toàn diện pipeline phỏng vấn, kiểm soát phân quyền RBAC và truy vết audit log minh bạch.',
    icon: SafetyCertificateOutlined,
    accent: 'bg-slate-100 text-slate-700 border border-slate-200',
    action: 'Đăng nhập hệ thống',
    path: '/login',
  },
] as const;

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Mở nhu cầu tuyển dụng',
    description: 'Doanh nghiệp tạo Job và chọn gói dịch vụ tuyển dụng phù hợp với nhu cầu.',
  },
  {
    number: '02',
    title: 'Tiếp nhận hồ sơ có kiểm soát',
    description: 'Candidate tự ứng tuyển hoặc Affiliate giới thiệu sau khi được ủy quyền Consent rõ ràng.',
  },
  {
    number: '03',
    title: 'Sàng lọc thông minh bằng AI',
    description: 'CV và yêu cầu công việc được đối chiếu tự động, chấm điểm độ phù hợp chính xác.',
  },
  {
    number: '04',
    title: 'Phối hợp & hoàn tất tuyển dụng',
    description: 'Tất cả các bên phối hợp phỏng vấn và theo dõi trên một luồng dữ liệu thời gian thực.',
  },
] as const;

const GUARANTEES = [
  'Ứng viên toàn quyền kiểm soát việc ủy quyền và sử dụng hồ sơ',
  'Cơ chế Anti-Duplicate bảo vệ minh bạch 100% nguồn giới thiệu',
  'Phân quyền RBAC nghiêm ngặt và tách biệt theo từng vai trò',
  'Audit Log bất biến ghi nhận mọi thay đổi trạng thái tuyển dụng',
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

  const scrollToRoles = () => {
    const rolesSection = document.getElementById('roles');
    if (rolesSection) {
      rolesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC] text-slate-900 font-sans">
      <Navbar />

      <main className="w-full">
        {/* ================================================================= */}
        {/* 1. AIRY HERO SECTION (LIGHT & CLEAN)                              */}
        {/* ================================================================= */}
        <section className="relative overflow-hidden bg-white py-14 sm:py-18 lg:py-22">
          {/* Subtle Ambient Background Gradients */}
          <div className="pointer-events-none absolute -right-20 -top-32 h-[500px] w-[500px] rounded-full bg-blue-50/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-[400px] w-[400px] rounded-full bg-indigo-50/60 blur-3xl" />

          <div className="relative mx-auto grid max-w-[1240px] grid-cols-1 items-center gap-12 sm:gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
            {/* Left Content Column */}
            <div className="min-w-0">
              {/* Badge Tag */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-solid border-blue-200/70 bg-blue-50/60 px-3.5 py-1 text-xs font-semibold text-blue-700">
                <CheckCircleFilled aria-hidden className="shrink-0 text-blue-600 text-xs" />
                <span>Nền tảng Tuyển dụng & AI Matching</span>
              </div>

              {/* Headline */}
              <h1 className="m-0 max-w-[620px] text-3xl sm:text-4xl md:text-5xl lg:text-[50px] font-extrabold leading-[1.12] tracking-tight text-slate-900 break-words">
                Kết nối đúng nhân tài,
                <span className="block mt-1 sm:mt-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                  bứt phá tốc độ cùng AI.
                </span>
              </h1>

              {/* 1 Concise Sentence Description */}
              <p className="mb-0 mt-4 sm:mt-5 max-w-[520px] text-base sm:text-lg leading-relaxed text-slate-600">
                Nền tảng hợp nhất Ứng viên, Đối tác Affiliate và Doanh nghiệp trên một quy trình minh bạch — tự động hóa sàng lọc và rút ngắn 60% thời gian tuyển dụng.
              </p>

              {/* Quick Actions (Cụm 2 nút CTA chính) */}
              <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="group inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 text-sm sm:text-base"
                >
                  <span>Tìm việc ngay</span>
                  <ArrowRightOutlined aria-hidden className="text-xs transition-transform duration-200 group-hover:translate-x-1" />
                </button>
                <button
                  type="button"
                  onClick={scrollToRoles}
                  className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-white border border-solid border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-6 py-3 font-medium shadow-sm transition-all duration-200 active:scale-[0.98] text-sm sm:text-base"
                >
                  Dành cho Nhà tuyển dụng / Đối tác
                </button>
              </div>

              {/* Secondary Sign-in Link */}
              <p className="mb-0 mt-4 text-xs sm:text-sm text-slate-500">
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="cursor-pointer border-0 bg-transparent p-0 font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Đăng nhập vào workspace
                </button>
              </p>
            </div>

            {/* ============================================================= */}
            {/* 2. VISUAL CARD BÊN PHẢI (LIGHT MODE CLEAN & MODERN)          */}
            {/* ============================================================= */}
            <div id="workflow" className="relative min-w-0">
              {/* Quầng sáng mờ tuyệt đối phía sau (Ambient Glow) */}
              <div className="pointer-events-none absolute -inset-6 rounded-full bg-blue-400/15 blur-3xl -z-10" />

              {/* Surface Card Trắng Cao Cấp */}
              <div className="relative w-full rounded-2xl border border-solid border-slate-200/90 bg-white/80 p-5 sm:p-6 shadow-xl shadow-slate-200/50 backdrop-blur-md">
                {/* Header status bar */}
                <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                    </div>
                    <span className="ml-1 text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Live AI Matching Engine
                    </span>
                  </div>

                  {/* Status Pill with pulse dot */}
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-solid border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>Đang hoạt động</span>
                  </div>
                </div>

                {/* Candidate Mini-Card: Nền xám nhạt tinh tế */}
                <div className="mt-4 rounded-xl border border-solid border-slate-200/60 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-sm">
                          QA
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="m-0 text-sm sm:text-base font-bold text-slate-900 truncate">Nguyễn Quốc Anh</h4>
                          <span className="shrink-0 rounded bg-blue-100/70 border border-blue-200/60 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            Senior
                          </span>
                        </div>
                        <p className="mb-0 mt-0.5 text-xs text-slate-500 truncate">
                          Senior React Developer · 5 năm kinh nghiệm
                        </p>
                      </div>
                    </div>

                    {/* Badge 96% Phù hợp: Màu xanh ngọc nhẹ nhàng */}
                    <div className="shrink-0 text-right">
                      <div className="inline-flex items-center gap-1 rounded-lg border border-solid border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-xs">
                        <ThunderboltFilled className="text-emerald-600 text-xs" />
                        <span>96% Phù hợp</span>
                      </div>
                    </div>
                  </div>

                  {/* Skill Tags */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {['React', 'TypeScript', 'Next.js', 'Tailwind CSS'].map((skill) => (
                      <span
                        key={skill}
                        className="rounded-md border border-solid border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  {/* Evaluation Line */}
                  <div className="mt-3 pt-2.5 border-0 border-t border-solid border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                    <span>Khớp JD: <strong className="text-slate-800">9.6 / 10</strong></span>
                    <span className="text-emerald-700 font-semibold">Chuẩn ATS ✓</span>
                  </div>
                </div>

                {/* Mini Pipeline: 4 Step tròn thanh mảnh trên nền trắng */}
                <div className="mt-4 pt-1">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Tiến độ xét duyệt
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded border border-solid border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Verified
                      </span>
                      <span className="rounded border border-solid border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                        Anti-duplicate
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    {/* Đường line kết nối slate-200 */}
                    <div className="absolute top-[16px] left-[10%] right-[10%] h-[2px] bg-slate-200 -z-0" />
                    <div className="absolute top-[16px] left-[10%] w-[58%] h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 -z-0" />

                    <div className="grid grid-cols-4 gap-2 relative z-10">
                      {/* Step 1 */}
                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-solid border-blue-200 bg-blue-50 text-blue-600 shadow-xs">
                          <CheckOutlined className="text-xs" />
                        </div>
                        <span className="mt-1.5 text-[11px] font-semibold text-slate-800">Ứng tuyển</span>
                      </div>

                      {/* Step 2 */}
                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-solid border-indigo-200 bg-indigo-50 text-indigo-600 shadow-xs">
                          <CheckOutlined className="text-xs" />
                        </div>
                        <span className="mt-1.5 text-[11px] font-semibold text-slate-800">Xác thực</span>
                      </div>

                      {/* Step 3 */}
                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-solid border-emerald-300 bg-emerald-50 text-emerald-600 shadow-xs ring-2 ring-emerald-100">
                          <ThunderboltFilled className="text-xs text-emerald-600" />
                        </div>
                        <span className="mt-1.5 text-[11px] font-semibold text-emerald-700">AI Chấm điểm</span>
                      </div>

                      {/* Step 4 */}
                      <div className="flex flex-col items-center text-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-solid border-slate-200 bg-white text-slate-400 font-semibold text-xs shadow-xs">
                          4
                        </div>
                        <span className="mt-1.5 text-[11px] font-medium text-slate-400">Phỏng vấn</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 2. DẢI SỐ LIỆU RIÊNG BIỆT NGANG MÀN HÌNH (METRICS STRIP)          */}
        {/* ================================================================= */}
        <section className="border-0 border-y border-solid border-slate-200/80 bg-white/70 backdrop-blur-sm px-4 sm:px-6 lg:px-10 py-5">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80">
              <div className="flex items-center justify-center gap-3 py-1 sm:py-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 text-lg">
                  ⚡
                </span>
                <div>
                  <p className="m-0 text-sm sm:text-base font-bold text-slate-900">95% Độ chính xác AI</p>
                  <p className="m-0 text-xs text-slate-500">Đối chiếu kỹ năng & JD chuẩn xác</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-3 sm:pt-0 sm:pl-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 text-lg">
                  ⏱️
                </span>
                <div>
                  <p className="m-0 text-sm sm:text-base font-bold text-slate-900">Giảm 60% thời gian tuyển</p>
                  <p className="m-0 text-xs text-slate-500">Tối ưu hóa quy trình từ CV đến Offer</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-3 sm:pt-0 sm:pl-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-lg">
                  🔒
                </span>
                <div>
                  <p className="m-0 text-sm sm:text-base font-bold text-slate-900">100% Minh bạch nguồn</p>
                  <p className="m-0 text-xs text-slate-500">Xác thực Consent & bảo vệ giới thiệu</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3. TỐI GIẢN 4 ROLE CARDS (CLEAN & MODERN)                          */}
        {/* ================================================================= */}
        <section id="roles" className="scroll-mt-24 px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-2xl">
              <p className="m-0 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-600">
                Dành cho mọi vai trò
              </p>
              <h2 className="mb-0 mt-2 sm:mt-2.5 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Mỗi người thấy đúng việc mình cần làm
              </h2>
              <p className="mb-0 mt-2.5 sm:mt-3 text-base sm:text-lg leading-relaxed text-slate-500">
                Workspace chuyên biệt hóa theo nhiệm vụ, giúp bạn thao tác nhanh và chuẩn xác.
              </p>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {ROLE_SOLUTIONS.map((role) => {
                const Icon = role.icon;
                return (
                  <article
                    key={role.title}
                    className="group flex flex-col justify-between rounded-2xl border border-solid border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                  >
                    <div>
                      {/* Icon vuông bo góc mềm */}
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-transform duration-200 group-hover:scale-105 ${role.accent}`}
                      >
                        <Icon aria-hidden />
                      </div>

                      {/* Tiêu đề vai trò rõ nét */}
                      <h3 className="mb-0 mt-4 text-lg font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                        {role.title}
                      </h3>

                      {/* Đúng 1 câu mô tả giá trị cốt lõi */}
                      <p className="mb-0 mt-2 text-sm leading-relaxed text-slate-500">
                        {role.description}
                      </p>
                    </div>

                    {/* Nút link hành động với mũi tên trượt nhẹ */}
                    <button
                      type="button"
                      onClick={() => navigate(role.path)}
                      className="mt-6 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 group-hover:gap-2.5"
                    >
                      <span>{role.action}</span>
                      <ArrowRightOutlined aria-hidden className="text-xs transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 4. PROCESS STEPS SECTION                                          */}
        {/* ================================================================= */}
        <section id="process" className="scroll-mt-24 border-0 border-y border-solid border-slate-200/80 bg-white px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-[1240px]">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="m-0 text-xs sm:text-sm font-extrabold uppercase tracking-wider text-blue-600">
                  Quy trình xuyên suốt
                </p>
                <h2 className="mb-0 mt-2 sm:mt-3 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                  Dữ liệu liền mạch, không đứt đoạn giữa các bên
                </h2>
                <p className="mb-0 mt-4 sm:mt-5 text-base sm:text-lg leading-relaxed text-slate-500">
                  Mỗi bước tạo ra đầu ra chuẩn xác cho bước tiếp theo, giữ vững tính toàn vẹn và lịch sử truy vết cho toàn bộ quy trình tuyển dụng.
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
                      <h3 className="m-0 text-base sm:text-lg font-bold text-slate-900 break-words">{step.title}</h3>
                      <p className="mb-0 mt-1.5 text-sm sm:text-base leading-relaxed text-slate-500">{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 5. ENTERPRISE GUARANTEE & AI SECURITY                             */}
        {/* ================================================================= */}
        <section className="px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-[1240px] grid-cols-1 overflow-hidden rounded-3xl border border-solid border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/80 shadow-2xl ring-1 ring-white/10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-12 text-white">
              <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-solid border-blue-500/20 bg-blue-500/15 text-lg sm:text-xl text-blue-400">
                <FileSearchOutlined aria-hidden />
              </span>
              <h2 className="mb-0 mt-5 sm:mt-6 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                Tuyển dụng nhanh hơn nhưng vẫn giữ trọn quyền kiểm soát
              </h2>
              <p className="mb-0 mt-4 sm:mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-300">
                AI đóng vai trò đồng hành hỗ trợ phân tích và xếp loại ứng viên. Quyết định tuyển dụng và ủy quyền vẫn thuộc về con người với sự minh bạch tuyệt đối.
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

        {/* ================================================================= */}
        {/* 6. BOTTOM CONVERSION CTA                                          */}
        {/* ================================================================= */}
        <section className="border-0 border-t border-solid border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 px-4 sm:px-6 lg:px-10 py-16 sm:py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <h2 className="m-0 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Bắt đầu từ đúng workspace của bạn
            </h2>
            <p className="mb-0 mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed text-slate-500">
              Đăng ký tài khoản để trải nghiệm HR Connect theo đúng vai trò, hoặc khám phá ngay các vị trí tuyển dụng hàng đầu.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-0 bg-blue-600 px-7 text-sm sm:text-base font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-200 hover:bg-blue-700 active:scale-[0.98]"
              >
                Đăng ký ngay
              </button>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-solid border-slate-200 bg-white px-7 text-sm sm:text-base font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98]"
              >
                Xem việc làm
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================= */}
      {/* 7. FOOTER                                                         */}
      {/* ================================================================= */}
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
