import React, { useState } from 'react';
import { Search, MapPin, DollarSign, TrendingUp, Sparkles } from 'lucide-react';
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
  { value: 'REMOTE', label: 'Remote / Từ xa' },
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
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-slate-50 to-white py-16 px-4 border-b border-slate-200/80">
      {/* Subtle ambient lighting */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-[720px] rounded-full bg-blue-100/40 blur-3xl -z-0" />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* Clean Light Live Status Badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/90 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
          </span>
          <span>Sàn việc làm & AI Matching hàng đầu</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-medium">41.500+ cơ hội nghề nghiệp</span>
        </div>

        {/* Headline */}
        <h1 className="text-slate-900 font-extrabold text-4xl sm:text-5xl tracking-tight text-center leading-[1.18] m-0">
          Tìm việc làm nhanh 24h, cơ hội nghề nghiệp uy tín
        </h1>

        {/* Subtitle */}
        <p className="text-slate-600 text-base max-w-2xl mx-auto text-center mt-3 mb-0 leading-relaxed">
          Tiếp cận hàng nghìn việc làm chất lượng cao từ các doanh nghiệp hàng đầu, đối chiếu CV chuẩn xác với AI Matching.
        </p>

        {/* All-in-one Search Box chuẩn TopCV */}
        <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-slate-200 max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-2 mt-8">
          {/* Ô Input từ khóa */}
          <div className="flex-1 flex items-center px-3 py-2 w-full gap-2.5">
            <Search className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={1.75} />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Vị trí tuyển dụng, kỹ năng, tên công ty..."
              className="border-0 focus:ring-0 text-slate-800 text-sm outline-none placeholder:text-slate-400 w-full bg-transparent font-medium"
            />
          </div>

          {/* Vách ngăn dọc 1 */}
          <div className="hidden md:block w-px h-8 bg-slate-200 shrink-0" />

          {/* Dropdown Địa điểm */}
          <div className="w-full md:w-44 flex items-center px-2 py-2 gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="Chọn địa điểm"
              className="border-0 text-sm text-slate-700 bg-transparent cursor-pointer focus:ring-0 outline-none w-full font-medium"
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Vách ngăn dọc 2 */}
          <div className="hidden md:block w-px h-8 bg-slate-200 shrink-0" />

          {/* Dropdown Mức lương */}
          <div className="w-full md:w-44 flex items-center px-2 py-2 gap-2">
            <DollarSign className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
            <select
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              aria-label="Chọn mức lương"
              className="border-0 text-sm text-slate-700 bg-transparent cursor-pointer focus:ring-0 outline-none w-full font-medium"
            >
              {SALARY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Nút Tìm kiếm */}
          <button
            type="button"
            onClick={() => executeSearch()}
            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-8 py-3 rounded-xl shadow-md transition-all active:scale-[0.98] whitespace-nowrap cursor-pointer shrink-0"
          >
            Tìm kiếm
          </button>
        </div>

        {/* Trending Tags (Pill nền trắng viền mỏng) */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-1">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
            <span>Từ khóa hot:</span>
          </div>
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className="bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-400 text-xs px-3 py-1 rounded-full shadow-2xs transition-all cursor-pointer font-medium"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* 3 Chỉ số dưới Hero */}
        <div className="mt-12 pt-8 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center max-w-3xl mx-auto">
          <div className="flex flex-col items-center">
            <span className="text-blue-600 font-bold text-2xl sm:text-3xl tracking-tight">2.764</span>
            <span className="text-slate-500 text-xs mt-0.5 font-medium">Việc làm mới 24h gần nhất</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-blue-600 font-bold text-2xl sm:text-3xl tracking-tight">41.505</span>
            <span className="text-slate-500 text-xs mt-0.5 font-medium">Việc làm đang tuyển dụng</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-blue-600 font-bold text-2xl sm:text-3xl tracking-tight">15.803</span>
            <span className="text-slate-500 text-xs mt-0.5 font-medium">Doanh nghiệp uy tín kết nối</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobHeroSearch;
