import React, { useState } from 'react';
import {
  Search,
  MapPin,
  DollarSign,
  TrendingUp,
  ChevronRight,
  Briefcase,
  Megaphone,
  Headset,
  Users,
  Code2,
  Calculator,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HandMetal,
  EyeOff,
  Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface JobHeroSearchProps {
  onSearch?: (keyword: string, location: string, salary: string) => void;
}

const LOCATION_OPTIONS = [
  { value: 'ALL', label: 'Toàn quốc' },
  { value: 'HN', label: 'Hà Nội' },
  { value: 'HCM', label: 'TP. Hồ Chí Minh' },
  { value: 'DN', label: 'Đà Nẵng' },
  { value: 'BD', label: 'Bình Dương' },
  { value: 'REMOTE', label: 'Làm việc từ xa (Remote)' },
];

const SALARY_OPTIONS = [
  { value: 'ALL', label: 'Mức lương: Tất cả' },
  { value: 'UNDER_10', label: 'Dưới 10 triệu' },
  { value: '10_20', label: '10 - 20 triệu' },
  { value: '20_35', label: '20 - 35 triệu' },
  { value: 'OVER_35', label: 'Trên 35 triệu' },
  { value: 'NEGOTIABLE', label: 'Thỏa thuận' },
];

const TRENDING_TAGS = [
  'ReactJS',
  'NodeJS',
  'Frontend',
  'Kế toán',
  'Marketing',
  'HR Tech',
  'Java Spring',
  'UI/UX Designer',
];

const QUICK_CATEGORIES = [
  {
    name: 'Kinh doanh / Bán hàng',
    icon: Briefcase,
    color: 'text-[#982e00] bg-[#ffdbd0]/60',
    param: 'SALES',
  },
  {
    name: 'Marketing / PR / Quảng cáo',
    icon: Megaphone,
    color: 'text-[#1d59c1] bg-[#d9e2ff]',
    param: 'MARKETING',
  },
  {
    name: 'Chăm sóc khách hàng',
    icon: Headset,
    color: 'text-[#0f52ba] bg-[#eaedff]',
    param: 'CS',
  },
  {
    name: 'Nhân sự / Hành chính',
    icon: Users,
    color: 'text-[#c03e05] bg-[#ffdbd0]/70',
    param: 'HR',
  },
  {
    name: 'Công nghệ Thông tin',
    icon: Code2,
    color: 'text-[#005f45] bg-[#95f5ce]/40',
    param: 'IT',
  },
  {
    name: 'Tài chính / Kế toán',
    icon: Calculator,
    color: 'text-[#007a5a] bg-[#f2f3ff]',
    param: 'FINANCE',
  },
];

export const JobHeroSearch: React.FC<JobHeroSearchProps> = ({ onSearch }) => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('ALL');
  const [salary, setSalary] = useState('ALL');

  const executeSearch = (kw = keyword, loc = location, sal = salary) => {
    if (onSearch) {
      onSearch(kw, loc, sal);
      return;
    }

    const params = new URLSearchParams();
    if (kw.trim()) params.append('keyword', kw.trim());
    if (loc && loc !== 'ALL') params.append('location', loc);
    if (sal && sal !== 'ALL') params.append('salary', sal);

    const query = params.toString();
    navigate(query ? `/jobs?${query}` : '/jobs');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  };

  const handleTagClick = (tag: string) => {
    setKeyword(tag);
    executeSearch(tag, location, salary);
  };

  return (
    <section className="relative w-full bg-gradient-to-b from-[#e2e7ff]/35 via-[#faf8ff] to-[#faf8ff] pt-6 pb-10 border-b border-slate-200/80 overflow-hidden">
      {/* Ambient background glows theo DESIGN.md */}
      <div className="pointer-events-none absolute -top-16 right-1/4 h-80 w-80 rounded-full bg-[#95f5ce]/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/4 left-10 h-72 w-72 rounded-full bg-[#d9e2ff]/35 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* 1. Eyebrow & Live Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200/60 px-3.5 py-1 rounded-full shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
              Cổng tuyển dụng thông minh 2026
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-slate-600 text-xs font-semibold">
            <span className="flex items-center gap-1">
              <span className="font-extrabold text-blue-600">1,420+</span> việc làm mới hôm nay
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="font-extrabold text-blue-600">10,850+</span> nhà tuyển dụng xác thực
            </span>
          </div>
        </div>

        {/* 2. Main Headline & Subtitle */}
        <div className="max-w-4xl mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#131b2e] leading-tight m-0">
            Khám phá{' '}
            <span className="text-blue-600 underline decoration-blue-200 decoration-4 underline-offset-8">
              45,000+ cơ hội
            </span>{' '}
            nghề nghiệp bứt phá
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl font-normal leading-relaxed m-0">
            Kết nối trực tiếp với các tập đoàn hàng đầu và doanh nghiệp công nghệ uy tín tại Việt Nam thông qua hệ thống gợi ý AI chuẩn xác.
          </p>
        </div>

        {/* 3. Search Command Center Card */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-200/80 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
            {/* Input từ khóa */}
            <div className="md:col-span-5 relative flex items-center bg-[#f2f3ff] rounded-xl px-3.5 py-2.5 border border-slate-200/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <Search className="h-4.5 w-4.5 text-blue-600 shrink-0 mr-2.5" strokeWidth={2} />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Vị trí, kỹ năng: React, Product Manager, Kế toán..."
                className="w-full bg-transparent border-0 focus:outline-none text-sm text-[#131b2e] font-medium placeholder:text-slate-400"
              />
            </div>

            {/* Dropdown Địa điểm */}
            <div className="md:col-span-3 relative flex items-center bg-[#f2f3ff] rounded-xl px-3 py-2.5 border border-slate-200/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mr-2" strokeWidth={2} />
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-label="Chọn địa điểm"
                className="w-full bg-transparent border-0 focus:outline-none text-sm text-slate-700 font-medium cursor-pointer"
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown Mức lương */}
            <div className="md:col-span-2 relative flex items-center bg-[#f2f3ff] rounded-xl px-3 py-2.5 border border-slate-200/60 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <DollarSign className="h-4 w-4 text-slate-400 shrink-0 mr-2" strokeWidth={2} />
              <select
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                aria-label="Chọn mức lương"
                className="w-full bg-transparent border-0 focus:outline-none text-sm text-slate-700 font-medium cursor-pointer"
              >
                {SALARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Nút Tìm kiếm chuẩn Brand Primary Blue */}
            <div className="md:col-span-2 flex">
              <button
                type="button"
                onClick={() => executeSearch()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl py-3 px-5 shadow-sm hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <span>Tìm kiếm</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Trending Keywords dưới ô search */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
              Tìm kiếm nhiều:
            </span>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="text-xs font-semibold bg-[#eaedff] hover:bg-blue-100/70 text-slate-700 hover:text-blue-700 px-3 py-1 rounded-full transition-colors cursor-pointer border-0"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Trust Badges Strip (Xanh lá giữ duy nhất cho 100% Việc làm xác thực) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 pb-5">
          <div className="flex items-center gap-2.5 text-slate-700">
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">100% Việc làm xác thực</span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-700">
            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
              <HandMetal className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">Ứng tuyển 1-chạm hồ sơ</span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-700">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 shrink-0">
              <EyeOff className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">Tìm việc ẩn danh bảo mật</span>
          </div>

          <div className="flex items-center gap-2.5 text-slate-700">
            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0">
              <Wand2 className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">Hỗ trợ tối ưu CV bằng AI</span>
          </div>
        </div>

        {/* 5. Quick Categories + Pro Banner Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch mt-1">
          {/* Cột trái (3/12): Menu danh mục rút gọn */}
          <div className="lg:col-span-3 bg-white text-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/80 hidden lg:flex flex-col justify-between">
            <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#131b2e]">
                Ngành nghề nổi bật
              </span>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0"
              >
                Tất cả
              </button>
            </div>

            <div className="divide-y divide-slate-100 flex-1 flex flex-col justify-around">
              {QUICK_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.param}
                    onClick={() => navigate(`/jobs?category=${cat.param}`)}
                    className="group flex items-center justify-between py-2 px-1.5 rounded-lg hover:bg-blue-50/70 hover:text-blue-600 transition-colors cursor-pointer text-xs font-semibold text-slate-700"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${cat.color} shrink-0`}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </div>
                      <span className="truncate">{cat.name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cột phải (9/12): Banner HR Connect Pro sang trọng, trang nhã */}
          <div className="lg:col-span-9 rounded-2xl overflow-hidden shadow-md relative min-h-[290px] flex items-center bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 sm:p-8 md:p-9">
            {/* Ambient Lighting */}
            <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-cyan-400/15 blur-2xl" />

            <div className="relative z-10 max-w-xl">
              {/* Badge Pro */}
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-3.5 py-1 text-xs font-bold text-cyan-200 mb-3 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                <span>HR Connect Pro — Đặc quyền thăng tiến</span>
              </div>

              {/* Banner Headline */}
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight m-0">
                ĐÃ ĐẾN LÚC NÂNG TẦM THU NHẬP
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-blue-100 font-normal leading-relaxed m-0">
                Mở ra hàng ngàn cơ hội tuyển dụng cấp quản lý cùng HR Connect Pro
              </p>

              {/* 3 Value Pillars */}
              <div className="mt-4 flex flex-wrap gap-2 sm:gap-2.5 text-xs text-white">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/20 backdrop-blur-sm px-2.5 py-1 font-medium">
                  <span className="text-cyan-300">✓</span> Phỏng vấn 1-1 cấp cao
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/20 backdrop-blur-sm px-2.5 py-1 font-medium">
                  <span className="text-cyan-300">✓</span> Cơ hội đột phá thu nhập
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/20 backdrop-blur-sm px-2.5 py-1 font-medium">
                  <span className="text-cyan-300">✓</span> Cố vấn sự nghiệp 24/7
                </span>
              </div>

              {/* CTA Buttons */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 inline-flex items-center gap-2 text-sm cursor-pointer border-0"
                >
                  <span>Khám phá ngay</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/cv-builder')}
                  className="bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold px-4.5 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Tạo CV Pro
                </button>
              </div>
            </div>

            {/* Chuyên viên HR Connect Masked Image */}
            <div className="hidden sm:block absolute right-0 bottom-0 top-0 w-2/5 overflow-hidden pointer-events-none">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80"
                alt="Chuyên viên HR Connect"
                className="w-full h-full object-cover object-top"
                style={{
                  maskImage: 'linear-gradient(to right, transparent 0%, black 35%)',
                  WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 35%)',
                }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobHeroSearch;

