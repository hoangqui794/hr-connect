import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Briefcase,
  DollarSign,
  ArrowRight,
  Sparkles,
  TrendingUp,
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
  { value: 'REMOTE', label: 'Remote (Từ xa)' },
];

const CAREER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả ngành nghề' },
  { value: 'it', label: 'IT / Phần mềm' },
  { value: 'finance', label: 'Tài chính / Ngân hàng' },
  { value: 'marketing', label: 'Marketing / Truyền thông' },
  { value: 'sales', label: 'Kinh doanh / Bán hàng' },
  { value: 'hr', label: 'Nhân sự / Tuyển dụng' },
  { value: 'accounting', label: 'Kế toán / Kiểm toán' },
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
  '#Java_Backend',
  '#Digital_Marketing',
  '#HR_Generalist',
  '#Data_Analyst',
  '#ReactJS',
  '#Thực_tập_sinh_2026',
  '#Kế_toán_trưởng',
  '#Product_Manager',
];

export const JobHeroSearch: React.FC<JobHeroSearchProps> = ({ onSearch }) => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('ALL');
  const [career, setCareer] = useState('ALL');
  const [salary, setSalary] = useState('ALL');

  const executeSearch = (kw = keyword, loc = location, sal = salary, car = career) => {
    if (onSearch) {
      onSearch(kw, loc, sal);
      return;
    }

    const params = new URLSearchParams();
    if (kw.trim()) params.append('keyword', kw.trim());
    if (loc && loc !== 'ALL') params.append('location', loc);
    if (sal && sal !== 'ALL') params.append('salary', sal);
    if (car && car !== 'ALL') params.append('category', car.toUpperCase());

    const query = params.toString();
    navigate(query ? `/jobs?${query}` : '/jobs');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch();
    }
  };

  const handleTagClick = (tag: string) => {
    const cleanTag = tag.replace('#', '').replace(/_/g, ' ');
    setKeyword(cleanTag);
    executeSearch(cleanTag, location, salary, career);
  };

  return (
    <section className="relative bg-gradient-to-b from-[#e2e7ff]/35 via-[#faf8ff] to-[#faf8ff] pt-6 pb-12 overflow-hidden border-b border-slate-200/80">
      {/* Ambient Atmospheric Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute top-1/3 left-10 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl pointer-events-none -z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* 1. Eyebrow & Live Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex items-center gap-2 bg-[#95f5ce]/45 px-3.5 py-1 rounded-full shadow-2xs border border-emerald-300/40">
            <span className="w-2 h-2 rounded-full bg-[#007a5a] animate-pulse" />
            <span className="text-[11px] font-bold text-[#005f45] uppercase tracking-wider">
              Cổng tuyển dụng thông minh 2026
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-slate-600 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="font-extrabold text-[#007a5a]">1,420+</span> việc làm mới hôm nay
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="font-extrabold text-[#1d59c1]">10,850+</span> nhà tuyển dụng xác thực
            </span>
          </div>
        </div>

        {/* 2. Main Headline & Subtitle */}
        <div className="max-w-4xl mb-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#131b2e] leading-tight mb-3">
            Khám phá{' '}
            <span className="text-[#005f45] underline decoration-[#79d9b2] decoration-4 underline-offset-8">
              45,000+ cơ hội
            </span>{' '}
            nghề nghiệp bứt phá
          </h1>
          <p className="text-slate-600 text-sm sm:text-base font-normal max-w-2xl leading-relaxed mb-0">
            Kết nối trực tiếp với các tập đoàn hàng đầu và doanh nghiệp công nghệ uy tín tại Việt Nam thông qua hệ thống gợi ý AI chuẩn xác.
          </p>
        </div>

        {/* 3. Search Command Center Card */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xl border border-slate-200/90 mb-6 sm:mb-8">
          <form
            className="grid grid-cols-1 md:grid-cols-12 gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch();
            }}
          >
            {/* Keyword Input */}
            <div className="md:col-span-4 relative flex items-center bg-[#f2f3ff]/70 hover:bg-[#eaedff]/60 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#007a5a]/25 border border-slate-200/60 rounded-xl px-3.5 py-2.5 transition-all">
              <Search className="h-5 w-5 text-[#007a5a] shrink-0 mr-2" strokeWidth={2} />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Vị trí, kỹ năng: React, Java, Marketing, Kế toán..."
                className="w-full bg-transparent border-0 focus:outline-none text-sm text-[#131b2e] placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Location Dropdown */}
            <div className="md:col-span-2 relative flex items-center bg-[#f2f3ff]/70 hover:bg-[#eaedff]/60 focus-within:bg-white border border-slate-200/60 rounded-xl px-3 py-2.5 transition-all">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mr-2" strokeWidth={1.75} />
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-label="Chọn địa điểm"
                className="w-full bg-transparent border-0 focus:outline-none text-xs sm:text-sm text-[#131b2e] cursor-pointer font-medium"
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Career Field Dropdown */}
            <div className="md:col-span-3 relative flex items-center bg-[#f2f3ff]/70 hover:bg-[#eaedff]/60 focus-within:bg-white border border-slate-200/60 rounded-xl px-3 py-2.5 transition-all">
              <Briefcase className="h-4 w-4 text-slate-400 shrink-0 mr-2" strokeWidth={1.75} />
              <select
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                aria-label="Chọn ngành nghề"
                className="w-full bg-transparent border-0 focus:outline-none text-xs sm:text-sm text-[#131b2e] cursor-pointer font-medium"
              >
                {CAREER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Salary Dropdown */}
            <div className="md:col-span-2 relative flex items-center bg-[#f2f3ff]/70 hover:bg-[#eaedff]/60 focus-within:bg-white border border-slate-200/60 rounded-xl px-3 py-2.5 transition-all">
              <DollarSign className="h-4 w-4 text-slate-400 shrink-0 mr-1.5" strokeWidth={1.75} />
              <select
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                aria-label="Chọn mức lương"
                className="w-full bg-transparent border-0 focus:outline-none text-xs sm:text-sm text-[#131b2e] cursor-pointer font-medium"
              >
                {SALARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-1 flex">
              <button
                type="submit"
                className="w-full h-full min-h-[44px] bg-[#007a5a] hover:bg-[#005f45] text-white font-semibold rounded-xl flex items-center justify-center p-3 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
                title="Tìm việc ngay"
              >
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </form>

          {/* Trending Keywords */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-semibold mr-1">
              <TrendingUp className="h-3.5 w-3.5 text-[#007a5a]" />
              <span className="uppercase text-[11px] tracking-wider text-slate-400 font-bold">Tìm kiếm nhiều:</span>
            </div>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="bg-[#eaedff]/50 hover:bg-[#dae2fd] text-slate-700 hover:text-[#005f45] border border-slate-200/60 text-xs px-2.5 py-0.5 rounded-full transition-all font-medium cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Talent Spotlight & Pro Banner */}
        <div className="bg-gradient-to-r from-[#005f45] via-[#007a5a] to-[#1d59c1] text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Decorative ambient shape */}
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-[#95f5ce]/15 blur-2xl" />

          <div className="relative z-10 max-w-2xl">
            {/* Badge FinCareer */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#95f5ce] px-3.5 py-1 text-xs font-bold text-[#002116] mb-3 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-[#005f45]" />
              <span>HR CONNECT PRO — ĐẶC QUYỀN THĂNG TIẾN</span>
            </div>

            {/* Banner Headline */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight m-0">
              ĐÃ ĐẾN LÚC NÂNG TẦM THU NHẬP
            </h2>
            <p className="mt-2 text-xs sm:text-sm font-medium text-emerald-100 max-w-xl m-0 leading-relaxed">
              Mở ra hàng ngàn cơ hội tuyển dụng cấp quản lý cùng hệ thống kết nối việc làm kín đáo, nhận lời mời phỏng vấn trực tiếp từ 10.000+ doanh nghiệp hàng đầu.
            </p>

            {/* 3 Value Pillars */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 backdrop-blur-sm px-2.5 py-1 font-medium">
                <span className="text-[#a4ffd8]">✓</span> Phỏng vấn 1-1 cấp cao
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 backdrop-blur-sm px-2.5 py-1 font-medium">
                <span className="text-[#a4ffd8]">✓</span> Cơ hội đột phá thu nhập
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 backdrop-blur-sm px-2.5 py-1 font-medium">
                <span className="text-[#a4ffd8]">✓</span> Ẩn danh bảo mật hồ sơ
              </span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="relative z-10 flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="bg-[#c03e05] hover:bg-[#982e00] text-white font-extrabold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 inline-flex items-center justify-center gap-2 text-sm cursor-pointer whitespace-nowrap"
            >
              <span>Khám phá cơ hội ngay</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/cv-builder')}
              className="bg-white/15 hover:bg-white/25 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors cursor-pointer text-center whitespace-nowrap border border-white/20"
            >
              Tạo CV Pro chuẩn ATS
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobHeroSearch;
