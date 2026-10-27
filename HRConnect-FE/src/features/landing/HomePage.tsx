import React, { useEffect } from 'react';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import {
  UserCheck,
  Users,
  Briefcase,
  ShieldCheck,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { JobHeroSearch } from './components/JobHeroSearch';
import { TopCategoriesGrid } from './components/TopCategoriesGrid';
import { FeaturedJobsGrid } from './components/FeaturedJobsGrid';
import { TopEmployersShowcase } from './components/TopEmployersShowcase';
import { MarketInsightsSection } from './components/MarketInsightsSection';
import { BrandMark } from '@/components/common/BrandMark';

const ROLE_SOLUTIONS = [
  {
    title: 'Ứng viên (Candidate)',
    description: 'Tìm kiếm cơ hội việc làm mơ ước, tối ưu CV bằng AI chuẩn ATS và theo dõi minh bạch từng vòng ứng tuyển.',
    icon: UserCheck,
    action: 'Tìm việc ngay',
    path: '/jobs',
  },
  {
    title: 'Affiliate Recruiter',
    description: 'Giới thiệu nhân tài với xác thực ủy quyền Consent, cơ chế chống trùng nguồn tự động và nhận hoa hồng minh bạch.',
    icon: Users,
    action: 'Đăng ký Affiliate',
    path: '/register?role=AFFILIATE',
  },
  {
    title: 'Doanh nghiệp (Client)',
    description: 'Đăng tin tuyển dụng đa kênh, tiếp cận nguồn ứng viên chất lượng cao đã qua sàng lọc AI và tối ưu chi phí.',
    icon: Briefcase,
    action: 'Đăng tin tuyển dụng',
    path: '/register?role=CLIENT',
  },
  {
    title: 'Internal HR & Admin',
    description: 'Điều phối toàn diện pipeline phỏng vấn, kiểm soát phân quyền RBAC và truy vết audit log bảo mật tuyệt đối.',
    icon: ShieldCheck,
    action: 'Đăng nhập hệ thống',
    path: '/login',
  },
] as const;

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Mở nhu cầu tuyển dụng',
    description: 'Doanh nghiệp tạo Job và lựa chọn phương thức tiếp cận ứng viên tối ưu theo ngân sách.',
  },
  {
    number: '02',
    title: 'Tiếp nhận hồ sơ có kiểm soát',
    description: 'Ứng viên tự ứng tuyển hoặc Affiliate Recruiter giới thiệu sau khi được ủy quyền Consent rõ ràng.',
  },
  {
    number: '03',
    title: 'Sàng lọc thông minh bằng AI',
    description: 'CV và yêu cầu công việc được đối chiếu tự động bằng AI, chấm điểm độ phù hợp chính xác theo chuẩn ATS.',
  },
  {
    number: '04',
    title: 'Phối hợp & hoàn tất tuyển dụng',
    description: 'Tất cả các bên phối hợp phỏng vấn, cập nhật kết quả và theo dõi trên một luồng dữ liệu thời gian thực.',
  },
] as const;

const GUARANTEES = [
  'Ứng viên toàn quyền kiểm soát việc ủy quyền và sử dụng thông tin cá nhân',
  'Cơ chế Anti-Duplicate bảo vệ minh bạch 100% nguồn giới thiệu cho Affiliate',
  'Phân quyền RBAC nghiêm ngặt và tách biệt tuyệt đối theo từng vai trò nghiệp vụ',
  'Audit Log bất biến ghi nhận mọi thay đổi trạng thái tuyển dụng và bảo hành',
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
    if (location.hash === '#process') {
      window.requestAnimationFrame(() => {
        document.getElementById('process')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.hash]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. TOP NAVBAR */}
      <Navbar />

      <main className="w-full">
        {/* ================================================================= */}
        {/* 1. HERO SEARCH SECTION (CHUẨN TOPCV HERO VỚI BANNER & MENU)       */}
        {/* ================================================================= */}
        <JobHeroSearch />

        {/* ================================================================= */}
        {/* 2. KHỐI DANH MỤC NGHỀ NGHIỆP TRỌNG ĐIỂM (TOP CATEGORIES GRID)     */}
        {/* ================================================================= */}
        <TopCategoriesGrid />

        {/* ================================================================= */}
        {/* 3. KHỐI VIỆC LÀM TỐT NHẤT / ĐANG TUYỂN GẤP (FEATURED JOBS GRID)   */}
        {/* ================================================================= */}
        <FeaturedJobsGrid />

        {/* ================================================================= */}
        {/* 4. KHỐI DOANH NGHIỆP HÀNG ĐẦU (TOP EMPLOYERS SHOWCASE)            */}
        {/* ================================================================= */}
        <TopEmployersShowcase />

        {/* ================================================================= */}
        {/* 5. THỊ TRƯỜNG VIỆC LÀM HÔM NAY (MARKET INSIGHTS & REALTIME DATA)  */}
        {/* ================================================================= */}
        <MarketInsightsSection />

        {/* ================================================================= */}
        {/* 6. CỔNG WORKSPACE THEO VAI TRÒ (MULTI-PORTAL GATEWAY)              */}
        {/* ================================================================= */}
        <section id="roles" className="scroll-mt-24 px-4 sm:px-6 lg:px-8 py-10 md:py-12 bg-white border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1.5">
                <Layers className="h-3.5 w-3.5" />
                <span>Không gian làm việc chuyên biệt</span>
              </div>
              <h2 className="mb-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Mỗi người thấy đúng việc mình cần làm
              </h2>
              <p className="mb-0 mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                Workspace chuyên biệt hóa theo từng vai trò, giúp ứng viên, headhunter và doanh nghiệp thao tác nhanh và chuẩn xác.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
              {ROLE_SOLUTIONS.map((role) => {
                const Icon = role.icon;
                return (
                  <article
                    key={role.title}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200"
                  >
                    <div>
                      {/* Icon */}
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-700 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/70 group-hover:text-blue-600">
                        <Icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>

                      {/* Role title */}
                      <h3 className="mb-0 mt-3.5 text-base font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                        {role.title}
                      </h3>

                      {/* Description */}
                      <p className="mb-0 mt-1.5 text-xs leading-relaxed text-slate-600">
                        {role.description}
                      </p>
                    </div>

                    {/* Action link */}
                    <button
                      type="button"
                      onClick={() => navigate(role.path)}
                      className="mt-5 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 group-hover:gap-2.5"
                    >
                      <span>{role.action}</span>
                      <ArrowRightOutlined aria-hidden className="text-[10px] transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 7. QUY TRÌNH XUYÊN SUỐT (PROCESS STEPS)                           */}
        {/* ================================================================= */}
        <section id="process" className="scroll-mt-24 border-b border-slate-200/80 bg-slate-50/60 px-4 sm:px-6 lg:px-8 py-10 md:py-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div className="lg:sticky lg:top-24">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Quy trình minh bạch</span>
                </div>
                <h2 className="mb-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Dữ liệu tuyển dụng liền mạch, không đứt đoạn
                </h2>
                <p className="mb-0 mt-2 text-xs sm:text-sm leading-relaxed text-slate-500">
                  Mỗi bước tạo ra đầu ra chuẩn xác cho bước tiếp theo, giữ vững tính toàn vẹn và lịch sử truy vết cho toàn bộ quy trình từ nộp hồ sơ đến ngày nhận việc (Onboarding).
                </p>
              </div>

              <div className="space-y-3">
                {PROCESS_STEPS.map((step) => (
                  <article
                    key={step.number}
                    className="grid grid-cols-[44px_1fr] sm:grid-cols-[48px_1fr] gap-3 sm:gap-4 rounded-xl border border-slate-200/80 bg-white p-4 transition-all duration-200 hover:border-slate-300 hover:shadow-xs"
                  >
                    <span className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-blue-50 font-mono text-xs sm:text-sm font-bold text-blue-600 border border-blue-100">
                      {step.number}
                    </span>
                    <div className="min-w-0">
                      <h3 className="m-0 text-sm sm:text-base font-bold text-slate-900 break-words">{step.title}</h3>
                      <p className="mb-0 mt-1 text-xs sm:text-sm leading-relaxed text-slate-500">{step.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 8. CAM KẾT & AN TOÀN NGUỒN DỮ LIỆU                               */}
        {/* ================================================================= */}
        <section className="px-4 sm:px-6 lg:px-8 py-10 md:py-12 bg-white border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs lg:grid-cols-2">
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600">
                <ShieldCheck className="h-5 w-5 text-blue-600" strokeWidth={1.5} />
              </span>
              <h2 className="mb-0 mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Tuyển dụng nhanh hơn nhưng vẫn kiểm soát tối đa
              </h2>
              <p className="mb-0 mt-2.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-slate-600">
                Hệ sinh thái HR Connect tôn trọng quyền riêng tư ứng viên và đảm bảo quyền lợi hoa hồng tuyệt đối cho đối tác với cơ chế tự động đối soát minh bạch.
              </p>
            </div>
            <div className="border-t lg:border-t-0 lg:border-l border-slate-200/80 bg-slate-50/60 p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
              <div className="space-y-3">
                {GUARANTEES.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs transition-colors hover:border-blue-200"
                  >
                    <CheckCircleFilled aria-hidden className="mt-0.5 text-blue-600 shrink-0 text-sm" />
                    <span className="leading-relaxed text-xs sm:text-sm text-slate-700 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 9. BOTTOM CONVERSION CTA BANNER                                   */}
        {/* ================================================================= */}
        <section className="bg-gradient-to-b from-white to-slate-100 px-4 sm:px-6 lg:px-8 py-10 md:py-12 text-center">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-2xl mx-auto">
              <h2 className="m-0 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Sẵn sàng bứt phá sự nghiệp cùng HR Connect?
              </h2>
              <p className="mb-0 mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-500">
                Đăng ký tài khoản ngay hôm nay để trải nghiệm sàn tuyển dụng thông minh hàng đầu, hoặc kết nối tuyển dụng doanh nghiệp hiệu quả.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 px-6 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  Đăng ký tài khoản mới
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-6 text-sm font-semibold text-slate-700 shadow-xs transition-all active:scale-[0.98]"
                >
                  Tìm việc làm ngay
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================= */}
      {/* 10. FOOTER                                                        */}
      {/* ================================================================= */}
      <footer className="border-t border-slate-800 bg-slate-950 px-4 sm:px-6 lg:px-8 py-8 text-slate-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <BrandMark size={36} tone="light" />
              <div>
                <span className="text-white font-extrabold text-base tracking-tight block">
                  HR Connect
                </span>
                <span className="text-xs text-slate-400">
                  Sàn việc làm & Nền tảng kết nối nhân tài chuẩn ATS
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 whitespace-nowrap"
              >
                Tìm việc làm
              </button>
              <button
                type="button"
                onClick={() => navigate('/cv-builder')}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 whitespace-nowrap"
              >
                Tạo CV AI
              </button>
              <button
                type="button"
                onClick={() => navigate('/register?role=CLIENT')}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 whitespace-nowrap"
              >
                Đăng tin tuyển dụng
              </button>
              <button
                type="button"
                onClick={() => navigate('/register?role=AFFILIATE')}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 whitespace-nowrap"
              >
                Trở thành Affiliate
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© 2026 HR Connect Marketplace. Mọi quyền được bảo lưu.</span>
            <span>Hotline hỗ trợ: 1900 6868 · Email: contact@hrconnect.vn</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
