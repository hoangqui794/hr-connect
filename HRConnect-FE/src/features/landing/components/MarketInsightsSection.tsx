import React from 'react';
import { TrendingUp, BarChart3, Clock, Sparkles, Building2, Briefcase, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const MarketInsightsSection: React.FC = () => {
  const navigate = useNavigate();

  // Dynamic date in Vietnamese format
  const today = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const recentJobsTicker = [
    {
      title: 'Kế Toán Tổng Hợp Tại Hà Nội - Đi Làm Ngay',
      company: 'CÔNG TY TNHH VIETNAM SAFETY',
      location: 'Hà Nội',
      time: '2 phút trước',
    },
    {
      title: 'Chuyên Viên Content Video - Social Media',
      company: 'UNIO MEDIA VIETNAM',
      location: 'TP. Hồ Chí Minh',
      time: '5 phút trước',
    },
    {
      title: 'Senior Java Backend Engineer (Microservices)',
      company: 'FINTECH ASIA LABS',
      location: 'Đà Nẵng',
      time: '8 phút trước',
    },
  ];

  const industryBars = [
    { name: 'Công nghệ Thông tin', count: '10.800', percent: 88, color: 'bg-emerald-500' },
    { name: 'Kinh doanh & Bán lẻ', count: '9.600', percent: 78, color: 'bg-blue-500' },
    { name: 'Marketing & Digital Ads', count: '8.400', percent: 68, color: 'bg-purple-500' },
    { name: 'Tài chính & Ngân hàng', count: '7.200', percent: 58, color: 'bg-amber-500' },
    { name: 'Kế toán & Kiểm toán', count: '6.000', percent: 48, color: 'bg-indigo-500' },
  ];

  return (
    <section className="bg-slate-900 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl -z-0" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl -z-0" />

      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Dữ liệu thời gian thực</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white m-0">
              Thị trường việc làm hôm nay{' '}
              <span className="text-emerald-400 font-extrabold">{today}</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-2 mb-0">
              Cập nhật xu hướng tuyển dụng mới nhất, cơ hội nghề nghiệp và biến động chỉ số cung cầu lao động
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors self-start md:self-auto cursor-pointer"
          >
            <span>Phân tích thị trường chi tiết →</span>
          </button>
        </div>

        {/* 3 Core Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>HÔM NAY</span>
              <Clock className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              2.764
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 m-0">
              Việc làm mới 24h gần nhất
            </p>
            <div className="mt-3 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <span>↑ +12.4% so với ngày hôm qua</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>TỔNG THỂ</span>
              <Briefcase className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              41.505
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 m-0">
              Việc làm đang tuyển dụng
            </p>
            <div className="mt-3 text-[11px] text-blue-400 font-medium flex items-center gap-1">
              <span>Đa dạng trên 63 tỉnh thành</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>ĐỐI TÁC</span>
              <Building2 className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-3 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              15.803
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 m-0">
              Doanh nghiệp đang tuyển
            </p>
            <div className="mt-3 text-[11px] text-amber-400 font-medium flex items-center gap-1">
              <span>100% tài khoản đã xác thực</span>
            </div>
          </div>
        </div>

        {/* Detailed Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trend Chart (Tăng trưởng cơ hội việc làm) */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-base font-bold text-white m-0">
                    Tăng trưởng cơ hội việc làm toàn quốc
                  </h3>
                </div>
                <span className="text-xs text-slate-400">30 ngày qua</span>
              </div>

              {/* Vector Sparkline Curve */}
              <div className="relative mt-2 h-44 w-full">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox="0 0 600 160"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  <line x1="0" y1="20" x2="600" y2="20" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="0" y1="60" x2="600" y2="60" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="0" y1="100" x2="600" y2="100" stroke="#334155" strokeDasharray="3 3" />
                  <line x1="0" y1="140" x2="600" y2="140" stroke="#334155" strokeDasharray="3 3" />

                  {/* Shaded Area */}
                  <path
                    d="M0,130 C60,110 120,140 180,90 C240,40 300,120 360,70 C420,20 480,100 540,50 L600,65 L600,160 L0,160 Z"
                    fill="url(#chartGradient)"
                  />

                  {/* Smooth Curve */}
                  <path
                    d="M0,130 C60,110 120,140 180,90 C240,40 300,120 360,70 C420,20 480,100 540,50 L600,65"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Peak Point highlight */}
                  <circle cx="420" cy="20" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="600" cy="65" r="4" fill="#38bdf8" />
                </svg>

                {/* Scale Indicators */}
                <div className="absolute top-1 left-2 text-[10px] text-slate-500 font-mono">49.000</div>
                <div className="absolute top-11 left-2 text-[10px] text-slate-500 font-mono">46.000</div>
                <div className="absolute bottom-6 left-2 text-[10px] text-slate-500 font-mono">43.000</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Xu hướng: Nhu cầu phục hồi mạnh mẽ ở quý cuối năm
              </span>
              <span className="text-emerald-400 font-semibold">Đỉnh tuyển dụng: 48.500 job</span>
            </div>
          </div>

          {/* Industry Demand Bars (Nhu cầu tuyển dụng theo ngành nghề) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <h3 className="text-base font-bold text-white m-0">
                    Nhu cầu theo ngành
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Top volume</span>
              </div>

              {/* Progress bars */}
              <div className="space-y-3.5 mt-3">
                {industryBars.map((bar) => (
                  <div key={bar.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium truncate">{bar.name}</span>
                      <span className="font-bold text-white">{bar.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
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
              className="mt-6 w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold py-2.5 text-center text-slate-200 transition-colors cursor-pointer"
            >
              Xem tất cả báo cáo thị trường
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
