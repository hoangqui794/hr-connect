import React, { useState } from 'react';
import { Search, MapPin, DollarSign, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
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
    <section className="relative overflow-hidden bg-slate-950 py-16 sm:py-20 lg:py-24 text-white">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[880px] rounded-full bg-gradient-to-b from-blue-600/20 via-sky-500/10 to-transparent blur-3xl -z-0" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-emerald-600/10 blur-3xl -z-0" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-indigo-600/10 blur-3xl -z-0" />

      {/* Grid Pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Live Status Pill */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/80 px-4 py-1.5 text-xs text-slate-300 backdrop-blur-md shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-medium">Sàn tuyển dụng & AI Matching chất lượng cao</span>
          <span className="text-slate-500">|</span>
          <span className="font-semibold text-emerald-400">41.500+ vị trí đang mở</span>
        </div>

        {/* Title */}
        <h1 className="mx-auto max-w-4xl text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-extrabold tracking-tight text-white leading-[1.15]">
          Tìm việc làm nhanh 24h, cơ hội nghề nghiệp uy tín
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
          Kết nối trực tiếp với hơn 15.000 doanh nghiệp hàng đầu và ứng tuyển thông minh với hệ thống chấm điểm CV tự động.
        </p>

        {/* All-in-one Search Bar */}
        <div className="mt-8 sm:mt-10 mx-auto max-w-5xl rounded-2xl bg-white p-2.5 sm:p-3 shadow-2xl shadow-black/40 border border-slate-200/90 text-left">
          <div className="flex flex-col md:flex-row gap-2.5 items-stretch">
            {/* Input 1: Keyword */}
            <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <Search className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2} />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Vị trí tuyển dụng, kỹ năng, tên công ty..."
                className="w-full bg-transparent text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none"
              />
            </div>

            {/* Dropdown 2: Location */}
            <div className="w-full md:w-48 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-label="Chọn địa điểm"
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none cursor-pointer"
              >
                {LOCATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown 3: Salary */}
            <div className="w-full md:w-48 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <DollarSign className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              <select
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                aria-label="Chọn mức lương"
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none cursor-pointer"
              >
                {SALARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="text-slate-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => executeSearch()}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-7 py-3 shadow-md shadow-blue-600/30 active:scale-[0.98] transition-all cursor-pointer text-sm sm:text-base shrink-0"
            >
              <span>Tìm kiếm</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Trending Tags */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium mr-1">
            <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            <span>Xu hướng:</span>
          </div>
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className="rounded-full border border-slate-800 bg-slate-900/90 px-3.5 py-1 text-xs text-slate-300 hover:border-blue-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Quick Market Snapshot Counters */}
        <div className="mt-12 sm:mt-14 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">2.764</span>
            <span className="mt-1 text-xs sm:text-sm text-slate-400">Việc làm mới 24h gần nhất</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">41.505</span>
            <span className="mt-1 text-xs sm:text-sm text-slate-400">Việc làm đang tuyển dụng</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-400 tracking-tight">15.803</span>
            <span className="mt-1 text-xs sm:text-sm text-slate-400">Doanh nghiệp uy tín đồng hành</span>
          </div>
        </div>
      </div>
    </section>
  );
};
