import React from 'react';
import {
  TrendingUp,
  BarChart3,
  Clock,
  Briefcase,
  Building2,
  ArrowRight,
  Download,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MarketInsightsSection: React.FC = () => {
  const navigate = useNavigate();

  const today = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  return (
    <section className="bg-slate-50/70 py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Container Surface (Chuẩn code.html lines 538-640) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-[#95f5ce]/40 px-3 py-1 text-xs font-bold text-[#005f45] mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007a5a]" />
                </span>
                <span>BÁO CÁO TUYỂN DỤNG & LƯƠNG THỜI GIAN THỰC</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
                Thị Trường Tuyển Dụng & Xu Hướng Thu Nhập
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
                Dữ liệu phân tích cập nhật ngày {today} từ 120.000+ hồ sơ và tin tuyển dụng được xác thực bởi HRConnect Data Lab.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#007a5a] hover:text-[#005f45] transition-colors cursor-pointer self-start md:self-auto"
            >
              <span>Xem tất cả việc làm</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* 3 Core Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-slate-200/80 bg-[#f2f3ff]/60 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>HÔM NAY</span>
                <Clock className="h-4 w-4 text-[#007a5a]" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#131b2e] tracking-tight">
                2,764
              </div>
              <p className="mt-0.5 text-xs text-slate-500 m-0 font-medium">
                Việc làm mới 24h gần nhất
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded bg-[#95f5ce]/40 text-[#005f45] border border-emerald-200/60 px-2 py-0.5 text-[11px] font-bold">
                <span>↑ +12.4% so với hôm qua</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-[#f2f3ff]/60 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>TỔNG THỂ</span>
                <Briefcase className="h-4 w-4 text-[#1d59c1]" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#131b2e] tracking-tight">
                45,210
              </div>
              <p className="mt-0.5 text-xs text-slate-500 m-0 font-medium">
                Việc làm đang mở tuyển dụng
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded bg-[#d9e2ff] text-[#001945] border border-blue-200/60 px-2 py-0.5 text-[11px] font-bold">
                <span>Đa dạng trên 63 tỉnh thành</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-[#f2f3ff]/60 p-4 sm:p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>ĐỐI TÁC</span>
                <Building2 className="h-4 w-4 text-[#c03e05]" />
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#131b2e] tracking-tight">
                15,850
              </div>
              <p className="mt-0.5 text-xs text-slate-500 m-0 font-medium">
                Doanh nghiệp uy tín đang tuyển
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded bg-[#ffdbd0]/60 text-[#982e00] border border-amber-200/60 px-2 py-0.5 text-[11px] font-bold">
                <span>100% hồ sơ đã xác thực</span>
              </div>
            </div>
          </div>

          {/* Detailed Insights Grid (Left: Sector Growth, Right: Salary Bar Chart) */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Sector Growth Rates */}
            <div className="lg:w-5/12 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-base text-[#131b2e] mb-2 m-0">
                  Tăng trưởng nhu cầu theo nhóm ngành
                </h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Đánh giá tốc độ gia tăng số lượng tin tuyển dụng chất lượng cao so với cùng kỳ năm trước.
                </p>

                {/* Metrics List (Chuẩn code.html lines 551-582) */}
                <div className="space-y-3">
                  <div className="bg-[#f2f3ff]/70 p-3.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#131b2e] block">
                        AI & Kỹ sư Dữ liệu
                      </span>
                      <span className="text-xs text-slate-500">
                        Mức tuyển dụng tăng đột biến
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#007a5a] block">+32%</span>
                      <span className="text-[11px] text-slate-400">So với cùng kỳ</span>
                    </div>
                  </div>

                  <div className="bg-[#f2f3ff]/70 p-3.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#131b2e] block">
                        Fintech & Ngân hàng số
                      </span>
                      <span className="text-xs text-slate-500">
                        Nhu cầu nhân sự cấp cao
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#1d59c1] block">+24%</span>
                      <span className="text-[11px] text-slate-400">So với cùng kỳ</span>
                    </div>
                  </div>

                  <div className="bg-[#f2f3ff]/70 p-3.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#131b2e] block">
                        Marketing & E-Commerce
                      </span>
                      <span className="text-xs text-slate-500">
                        Tập trung Performance & Growth
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-[#c03e05] block">+18%</span>
                      <span className="text-[11px] text-slate-400">So với cùng kỳ</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007a5a] hover:underline cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Tải báo cáo thị trường lao động 2026 (PDF)</span>
                </button>
              </div>
            </div>

            {/* Right: Salary Visual Comparison Chart (Chuẩn code.html lines 591-638) */}
            <div className="lg:w-7/12 bg-[#f2f3ff]/70 p-5 rounded-xl border border-slate-200/70 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-base text-[#131b2e] m-0">
                      Mức Lương Bình Quân Theo Năm Kinh Nghiệm
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 mb-0">
                      Đơn vị: Triệu VNĐ / tháng (Khối ngành Công nghệ & Kinh doanh)
                    </p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-slate-400" />
                </div>

                {/* Inline SVG Visual Bar Chart */}
                <div className="w-full py-2">
                  <svg className="w-full h-44" fill="none" viewBox="0 0 500 170" xmlns="http://www.w3.org/2000/svg">
                    {/* Grid lines */}
                    <line stroke="#dae2fd" strokeDasharray="4 4" x1="40" x2="480" y1="20" y2="20" />
                    <line stroke="#dae2fd" strokeDasharray="4 4" x1="40" x2="480" y1="55" y2="55" />
                    <line stroke="#dae2fd" strokeDasharray="4 4" x1="40" x2="480" y1="95" y2="95" />
                    <line stroke="#dae2fd" x1="40" x2="480" y1="135" y2="135" />

                    {/* Y-axis labels */}
                    <text fill="#6e7a73" fontSize="10" fontWeight="600" x="10" y="24">60M</text>
                    <text fill="#6e7a73" fontSize="10" fontWeight="600" x="10" y="59">40M</text>
                    <text fill="#6e7a73" fontSize="10" fontWeight="600" x="10" y="99">20M</text>
                    <text fill="#6e7a73" fontSize="10" fontWeight="600" x="10" y="139">0M</text>

                    {/* Fresher Bar (<1 year) */}
                    <rect fill="#79d9b2" height="30" rx="4" width="46" x="70" y="105" />
                    <text fill="#005f45" fontSize="11" fontWeight="800" x="80" y="97">12M</text>
                    <text fill="#3e4943" fontSize="11" fontWeight="600" x="72" y="155">&lt;1 Năm</text>

                    {/* Junior Bar (1-3 yrs) */}
                    <rect fill="#007a5a" height="55" rx="4" width="46" x="175" y="80" />
                    <text fill="#005f45" fontSize="11" fontWeight="800" x="185" y="72">24M</text>
                    <text fill="#3e4943" fontSize="11" fontWeight="600" x="175" y="155">1-3 Năm</text>

                    {/* Senior Bar (3-5 yrs) */}
                    <rect fill="#1d59c1" height="90" rx="4" width="46" x="280" y="45" />
                    <text fill="#1d59c1" fontSize="11" fontWeight="800" x="290" y="37">42M</text>
                    <text fill="#3e4943" fontSize="11" fontWeight="600" x="280" y="155">3-5 Năm</text>

                    {/* Lead/Manager Bar (5+ yrs) */}
                    <rect fill="#c03e05" height="120" rx="4" width="46" x="385" y="15" />
                    <text fill="#c03e05" fontSize="11" fontWeight="800" x="395" y="10">68M</text>
                    <text fill="#3e4943" fontSize="11" fontWeight="600" x="380" y="155">Quản lý (5+)</text>
                  </svg>
                </div>
              </div>

              {/* Bottom Survey Prompt Bar */}
              <div className="bg-white p-3 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs mt-3">
                <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-[#007a5a]" />
                  Bạn muốn biết mức lương của vị trí cụ thể?
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="font-bold text-[#007a5a] hover:underline cursor-pointer"
                >
                  Khảo sát ngay →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketInsightsSection;
