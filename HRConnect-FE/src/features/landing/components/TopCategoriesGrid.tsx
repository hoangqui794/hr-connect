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
  hoverColor: string;
  queryParam: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'it',
    name: 'Công nghệ Thông tin',
    jobCount: '1.607+ việc làm',
    icon: Code2,
    iconBg: 'bg-[#95f5ce]/40',
    iconColor: 'text-[#005f45]',
    hoverColor: 'group-hover:text-[#005f45]',
    queryParam: 'IT',
  },
  {
    id: 'sales',
    name: 'Kinh doanh / Bán hàng',
    jobCount: '8.321+ việc làm',
    icon: TrendingUp,
    iconBg: 'bg-[#ffdbd0]/60',
    iconColor: 'text-[#982e00]',
    hoverColor: 'group-hover:text-[#982e00]',
    queryParam: 'SALES',
  },
  {
    id: 'marketing',
    name: 'Marketing / Truyền thông',
    jobCount: '5.567+ việc làm',
    icon: Megaphone,
    iconBg: 'bg-[#d9e2ff]',
    iconColor: 'text-[#1d59c1]',
    hoverColor: 'group-hover:text-[#1d59c1]',
    queryParam: 'MARKETING',
  },
  {
    id: 'finance',
    name: 'Tài chính / Ngân hàng',
    jobCount: '1.420+ việc làm',
    icon: Landmark,
    iconBg: 'bg-[#eaedff]',
    iconColor: 'text-[#0f52ba]',
    hoverColor: 'group-hover:text-[#0f52ba]',
    queryParam: 'FINANCE',
  },
  {
    id: 'accounting',
    name: 'Kế toán / Kiểm toán / Thuế',
    jobCount: '3.608+ việc làm',
    icon: Calculator,
    iconBg: 'bg-[#f2f3ff]',
    iconColor: 'text-[#007a5a]',
    hoverColor: 'group-hover:text-[#007a5a]',
    queryParam: 'ACCOUNTING',
  },
  {
    id: 'hr',
    name: 'Nhân sự / Hành chính',
    jobCount: '2.560+ việc làm',
    icon: Users,
    iconBg: 'bg-[#ffdbd0]/70',
    iconColor: 'text-[#c03e05]',
    hoverColor: 'group-hover:text-[#c03e05]',
    queryParam: 'HR',
  },
  {
    id: 'design',
    name: 'Thiết kế UI/UX & Sáng tạo',
    jobCount: '890+ việc làm',
    icon: Palette,
    iconBg: 'bg-[#eaedff]',
    iconColor: 'text-[#6292fd]',
    hoverColor: 'group-hover:text-[#1d59c1]',
    queryParam: 'DESIGN',
  },
  {
    id: 'real-estate',
    name: 'Bất động sản / Xây dựng',
    jobCount: '740+ việc làm',
    icon: Building2,
    iconBg: 'bg-[#95f5ce]/30',
    iconColor: 'text-[#006c4f]',
    hoverColor: 'group-hover:text-[#006c4f]',
    queryParam: 'REAL_ESTATE',
  },
];

export const TopCategoriesGrid: React.FC = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (queryParam: string) => {
    navigate(`/jobs?category=${encodeURIComponent(queryParam)}`);
  };

  return (
    <section className="bg-[#faf8ff] border-b border-slate-200/80 py-10 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200/60 text-xs font-bold uppercase tracking-wider text-blue-700 px-3 py-1 rounded-full mb-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Khám phá cơ hội nghề nghiệp</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
              Top ngành nghề trọng điểm
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-0">
              Tìm kiếm công việc lý tưởng theo từng nhóm ngành nghề phát triển mạnh nhất năm 2026
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start sm:self-auto bg-transparent border-0 p-0"
          >
            <span>Xem tất cả ngành nghề</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => handleCategoryClick(cat.queryParam)}
                className="bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 shadow-xs hover:shadow-xl transition-all duration-300 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              >
                <div>
                  {/* Icon with Soft Tinted Color */}
                  <div
                    className={`${cat.iconBg} ${cat.iconColor} p-2.5 rounded-xl flex items-center justify-center w-12 h-12 transition-transform duration-200 group-hover:scale-110 shadow-2xs`}
                  >
                    <IconComponent className="h-5 w-5" strokeWidth={1.75} />
                  </div>

                  {/* Tên ngành */}
                  <h3
                    className="text-[#131b2e] font-bold text-sm sm:text-base group-hover:text-blue-600 transition-colors mt-3.5 mb-0 line-clamp-1"
                  >
                    {cat.name}
                  </h3>

                  {/* Số lượng */}
                  <p className="text-slate-500 text-xs mt-1 mb-0 font-medium">
                    {cat.jobCount}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
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

export default TopCategoriesGrid;

