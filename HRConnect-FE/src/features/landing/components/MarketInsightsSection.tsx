import React from 'react';
import { TrendingUp, BarChart3, Clock, Briefcase, Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MarketInsightsSection: React.FC = () => {
  const navigate = useNavigate();

  const today = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const industryBars = [
    { name: 'Công nghệ Thông tin', count: '10.800', percent: 88, color: 'bg-blue-600' },
    { name: 'Kinh doanh & Bán lẻ', count: '9.600', percent: 78, color: 'bg-indigo-600' },
    { name: 'Marketing & Digital Ads', count: '8.400', percent: 68, color: 'bg-sky-600' },
    { name: 'Tài chính & Ngân hàng', count: '7.200', percent: 58, color: 'bg-teal-600' },
    { name: 'Kế toán & Kiểm toán', count: '6.000', percent: 48, color: 'bg-slate-600' },
  ];

  return (
    <section className="bg-slate-50/60 py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80">
      <div className="mx-auto max-w-6xl">
        {/* Clean Bright White Card Container */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-0.5 text-xs font-semibold text-blue-700 mb-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
                <span>Dữ liệu thị trường thời gian thực</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 m-0">
                Thị trường việc làm hôm nay{' '}
                <span className="text-blue-600 font-extrabold">{today}</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-500 mt-1.5 mb-0">
                Tổng hợp chỉ số nhu cầu tuyển dụng và biến động cơ hội nghề nghiệp toàn quốc
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start md:self-auto"
            >
              <span>Xem tất cả việc làm</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* 3 Core Metric Cards (Clean Light Theme) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-8">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>HÔM NAY</span>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
                2.764
              </div>
              <p className="mt-1 text-xs text-slate-500 m-0 font-medium">
                Việc làm mới 24h gần nhất
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold">
                <span>↑ +12.4% so với hôm qua</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>TỔNG THỂ</span>
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
                41.505
              </div>
              <p className="mt-1 text-xs text-slate-500 m-0 font-medium">
                Việc làm đang mở tuyển dụng
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 text-[11px] font-semibold">
                <span>Đa dạng trên 63 tỉnh thành</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>ĐỐI TÁC</span>
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">
                15.803
              </div>
              <p className="mt-1 text-xs text-slate-500 m-0 font-medium">
                Doanh nghiệp uy tín đang tuyển
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold">
                <span>100% hồ sơ đã xác thực</span>
              </div>
            </div>
          </div>

          {/* Detailed Insights: Primary Blue Curve Chart & Industry Demand */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Blue Sparkline Chart */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                      Tăng trưởng cơ hội việc làm toàn quốc
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">30 ngày qua</span>
                </div>

                {/* SVG Curve Chart in Corporate Primary Blue */}
                <div className="relative mt-2 h-40 w-full">
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 600 160"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="blueChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Subtle horizontal grid lines */}
                    <line x1="0" y1="20" x2="600" y2="20" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="0" y1="60" x2="600" y2="60" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="600" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />
                    <line x1="0" y1="140" x2="600" y2="140" stroke="#e2e8f0" strokeDasharray="3 3" />

                    {/* Shaded Area */}
                    <path
                      d="M0,130 C60,110 120,140 180,90 C240,40 300,120 360,70 C420,20 480,100 540,50 L600,65 L600,160 L0,160 Z"
                      fill="url(#blueChartGradient)"
                    />

                    {/* Smooth Primary Blue Curve */}
                    <path
                      d="M0,130 C60,110 120,140 180,90 C240,40 300,120 360,70 C420,20 480,100 540,50 L600,65"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    {/* Peak Point highlight */}
                    <circle cx="420" cy="20" r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="600" cy="65" r="4" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                  </svg>

                  {/* Scale Indicators */}
                  <div className="absolute top-1 left-2 text-[10px] text-slate-400 font-mono">49.000</div>
                  <div className="absolute top-10 left-2 text-[10px] text-slate-400 font-mono">46.000</div>
                  <div className="absolute bottom-5 left-2 text-[10px] text-slate-400 font-mono">43.000</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-blue-600" />
                  Xu hướng: Nhu cầu phục hồi mạnh mẽ ở quý cuối năm
                </span>
                <span className="text-blue-600 font-semibold">Đỉnh tuyển dụng: 48.500 job</span>
              </div>
            </div>

            {/* Industry Demand Bars */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                      Nhu cầu theo ngành
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Top vị trí</span>
                </div>

                <div className="space-y-3 mt-2">
                  {industryBars.map((bar) => (
                    <div key={bar.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium truncate">{bar.name}</span>
                        <span className="font-bold text-slate-900">{bar.count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bar.color}`}
                          style={{ width: `${bar.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="mt-5 w-full rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold py-2 text-center text-slate-700 transition-colors cursor-pointer shadow-2xs"
              >
                Khám phá báo cáo ngành
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketInsightsSection;
