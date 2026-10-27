import React from 'react';
import {
  Code2,
  TrendingUp,
  Megaphone,
  Landmark,
  Calculator,
  Users,
  Palette,
  Building2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CategoryItem {
  id: string;
  name: string;
  jobCount: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  queryParam: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'it',
    name: 'Công nghệ Thông tin',
    jobCount: '1.607+ việc làm',
    icon: Code2,
    iconBg: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600',
    queryParam: 'IT',
  },
  {
    id: 'sales',
    name: 'Kinh doanh / Bán hàng',
    jobCount: '8.321+ việc làm',
    icon: TrendingUp,
    iconBg: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
    queryParam: 'SALES',
  },
  {
    id: 'marketing',
    name: 'Marketing / Truyền thông',
    jobCount: '5.567+ việc làm',
    icon: Megaphone,
    iconBg: 'bg-purple-50 border-purple-100',
    iconColor: 'text-purple-600',
    queryParam: 'MARKETING',
  },
  {
    id: 'finance',
    name: 'Tài chính / Ngân hàng',
    jobCount: '1.420+ việc làm',
    icon: Landmark,
    iconBg: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-600',
    queryParam: 'FINANCE',
  },
  {
    id: 'accounting',
    name: 'Kế toán / Kiểm toán / Thuế',
    jobCount: '3.608+ việc làm',
    icon: Calculator,
    iconBg: 'bg-indigo-50 border-indigo-100',
    iconColor: 'text-indigo-600',
    queryParam: 'ACCOUNTING',
  },
  {
    id: 'hr',
    name: 'Nhân sự / Hành chính',
    jobCount: '2.560+ việc làm',
    icon: Users,
    iconBg: 'bg-teal-50 border-teal-100',
    iconColor: 'text-teal-600',
    queryParam: 'HR',
  },
  {
    id: 'design',
    name: 'Thiết kế UI/UX & Sáng tạo',
    jobCount: '890+ việc làm',
    icon: Palette,
    iconBg: 'bg-rose-50 border-rose-100',
    iconColor: 'text-rose-600',
    queryParam: 'DESIGN',
  },
  {
    id: 'real-estate',
    name: 'Bất động sản',
    jobCount: '740+ việc làm',
    icon: Building2,
    iconBg: 'bg-sky-50 border-sky-100',
    iconColor: 'text-sky-600',
    queryParam: 'REAL_ESTATE',
  },
];

export const TopCategoriesGrid: React.FC = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (queryParam: string) => {
    navigate(`/jobs?category=${encodeURIComponent(queryParam)}`);
  };

  return (
    <section className="bg-slate-50/70 border-b border-slate-200/80 py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Thị trường tuyển dụng sôi động</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 m-0">
              Top ngành nghề trọng điểm
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-2 mb-0">
              Khám phá cơ hội nghề nghiệp đa dạng theo từng nhóm ngành hot nhất hiện nay
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:gap-2.5 transition-all cursor-pointer self-start sm:self-auto"
          >
            <span>Xem tất cả ngành nghề</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => handleCategoryClick(cat.queryParam)}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md cursor-pointer"
              >
                <div>
                  {/* Icon wrapper */}
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl border ${cat.iconBg} ${cat.iconColor} transition-transform duration-200 group-hover:scale-105`}
                  >
                    <IconComponent className="h-6 w-6" strokeWidth={1.75} />
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 m-0">
                    {cat.name}
                  </h3>

                  {/* Job Count */}
                  <p className="mt-1 text-xs font-medium text-slate-500 m-0">
                    {cat.jobCount}
                  </p>
                </div>

                {/* Subtle indicator */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                  <span>Khám phá ngay</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
