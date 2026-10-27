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
  Award,
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
    color: 'text-emerald-600 bg-emerald-50',
    param: 'SALES',
  },
  {
    name: 'Marketing / PR / Quảng cáo',
    icon: Megaphone,
    color: 'text-purple-600 bg-purple-50',
    param: 'MARKETING',
  },
  {
    name: 'Chăm sóc khách hàng',
    icon: Headset,
    color: 'text-sky-600 bg-sky-50',
    param: 'CS',
  },
  {
    name: 'Nhân sự / Hành chính',
    icon: Users,
    color: 'text-amber-600 bg-amber-50',
    param: 'HR',
  },
  {
    name: 'Công nghệ Thông tin',
    icon: Code2,
    color: 'text-blue-600 bg-blue-50',
    param: 'IT',
  },
  {
    name: 'Tài chính / Kế toán',
    icon: Calculator,
    color: 'text-indigo-600 bg-indigo-50',
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
    <section className="w-full bg-[#F8FAFC] pt-3 pb-8 md:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tone xanh thương hiệu sang trọng chuẩn TopCV */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          {/* Subtle ambient lightings */}
          <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

          {/* 1. Header Title & Subtitle */}
          <div className="text-center relative z-10 max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight m-0">
              HR Connect — Nền Tảng Tìm Việc Làm & Tuyển Dụng Hàng Đầu
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-blue-100 font-normal max-w-2xl mx-auto m-0">
              Tiếp cận 41.500+ cơ hội nghề nghiệp uy tín, kết nối trực tiếp với hơn 15.000 doanh nghiệp hàng đầu
            </p>
          </div>

          {/* 2. All-in-one Search Bar Nổi Bật Chuẩn TopCV */}
          <div className="relative z-10 mt-6 bg-white p-2.5 rounded-2xl shadow-2xl border border-slate-200/90 text-slate-800 max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-2">
            {/* Input từ khóa */}
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

          {/* Trending Tags dưới ô search */}
          <div className="relative z-10 mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-blue-200 font-medium mr-1">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-300" />
              <span>Từ khóa phổ biến:</span>
            </div>
            {TRENDING_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagClick(tag)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm cursor-pointer transition-all font-medium"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* 3. Phía dưới thanh Search: Layout 2 cột chuẩn TopCV */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 mt-7 items-stretch">
            {/* Cột trái (25% ~ col-span-3): Menu danh mục ngành nghề rút gọn */}
            <div className="lg:col-span-3 bg-white text-slate-800 rounded-2xl p-4 shadow-md hidden lg:flex flex-col justify-between">
              <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Ngành nghề nổi bật
                </span>
                <span className="text-[11px] text-blue-600 font-semibold cursor-pointer" onClick={() => navigate('/jobs')}>
                  Tất cả
                </span>
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

            {/* Cột phải (75% ~ col-span-9): Banner hình ảnh sống động chuẩn TopCV */}
            <div className="lg:col-span-9 rounded-2xl overflow-hidden shadow-md relative min-h-[300px] flex items-center bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white p-6 sm:p-8 md:p-9">
              {/* Decorative background shapes */}
              <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />

              <div className="relative z-10 max-w-xl">
                {/* Badge FinCareer */}
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1 text-xs font-bold text-white mb-3 shadow-xs">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                  <span>HR Connect Pro — Đặc quyền thăng tiến</span>
                </div>

                {/* Banner Headline */}
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight m-0">
                  ĐÃ ĐẾN LÚC NÂNG TẦM THU NHẬP
                </h2>
                <p className="mt-1.5 text-sm sm:text-base font-medium text-cyan-100 m-0">
                  Mở ra hàng ngàn cơ hội tuyển dụng cấp quản lý cùng HR Connect Pro
                </p>

                {/* 3 Value Pillars */}
                <div className="mt-4 flex flex-wrap gap-2 sm:gap-3 text-xs text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 backdrop-blur-sm px-2.5 py-1 font-medium">
                    <span className="text-emerald-300">✓</span> Phỏng vấn 1-1 cấp cao
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 backdrop-blur-sm px-2.5 py-1 font-medium">
                    <span className="text-emerald-300">✓</span> Cơ hội đột phá thu nhập
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/15 backdrop-blur-sm px-2.5 py-1 font-medium">
                    <span className="text-emerald-300">✓</span> Cố vấn sự nghiệp 24/7
                  </span>
                </div>

                {/* CTA Button */}
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/jobs')}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 inline-flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <span>Khám phá ngay</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/cv-builder')}
                    className="bg-white/20 hover:bg-white/30 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    Tạo CV Pro
                  </button>
                </div>
              </div>

              {/* Right Side Corporate Image */}
              <div className="hidden sm:block absolute right-0 bottom-0 top-0 w-2/5 overflow-hidden pointer-events-none">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80"
                  alt="Chuyên viên HR Connect"
                  className="w-full h-full object-cover object-top mask-radial"
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
      </div>
    </section>
  );
};

export default JobHeroSearch;
