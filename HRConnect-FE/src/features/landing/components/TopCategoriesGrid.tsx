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
  queryParam: string;
}

const CATEGORIES: CategoryItem[] = [
  {
    id: 'it',
    name: 'Công nghệ Thông tin',
    jobCount: '1.607+ việc làm',
    icon: Code2,
    queryParam: 'IT',
  },
  {
    id: 'sales',
    name: 'Kinh doanh / Bán hàng',
    jobCount: '8.321+ việc làm',
    icon: TrendingUp,
    queryParam: 'SALES',
  },
  {
    id: 'marketing',
    name: 'Marketing / Truyền thông',
    jobCount: '5.567+ việc làm',
    icon: Megaphone,
    queryParam: 'MARKETING',
  },
  {
    id: 'finance',
    name: 'Tài chính / Ngân hàng',
    jobCount: '1.420+ việc làm',
    icon: Landmark,
    queryParam: 'FINANCE',
  },
  {
    id: 'accounting',
    name: 'Kế toán / Kiểm toán / Thuế',
    jobCount: '3.608+ việc làm',
    icon: Calculator,
    queryParam: 'ACCOUNTING',
  },
  {
    id: 'hr',
    name: 'Nhân sự / Hành chính',
    jobCount: '2.560+ việc làm',
    icon: Users,
    queryParam: 'HR',
  },
  {
    id: 'design',
    name: 'Thiết kế UI/UX & Sáng tạo',
    jobCount: '890+ việc làm',
    icon: Palette,
    queryParam: 'DESIGN',
  },
  {
    id: 'real-estate',
    name: 'Bất động sản',
    jobCount: '740+ việc làm',
    icon: Building2,
    queryParam: 'REAL_ESTATE',
  },
];

export const TopCategoriesGrid: React.FC = () => {
  const navigate = useNavigate();

  const handleCategoryClick = (queryParam: string) => {
    navigate(`/jobs?category=${encodeURIComponent(queryParam)}`);
  };

  return (
    <section className="bg-slate-50/60 border-b border-slate-200/80 py-10 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Khám phá cơ hội nghề nghiệp</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 m-0">
              Top ngành nghề trọng điểm
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Tìm kiếm công việc lý tưởng theo từng nhóm ngành nghề phát triển mạnh nhất
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>Xem tất cả ngành nghề</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Categories Grid (Clean Flat White Theme) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => {
            const IconComponent = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => handleCategoryClick(cat.queryParam)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all p-4 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Icon stroke mảnh 1.5px tone xanh dịu */}
                  <div className="text-blue-600 bg-blue-50/60 p-2.5 rounded-xl flex items-center justify-center w-11 h-11 transition-transform duration-200 group-hover:scale-105">
                    <IconComponent className="h-5 w-5" strokeWidth={1.5} />
                  </div>

                  {/* Tên ngành */}
                  <h3 className="text-slate-800 font-semibold text-sm group-hover:text-blue-600 transition-colors mt-3 mb-0 line-clamp-1">
                    {cat.name}
                  </h3>

                  {/* Số lượng */}
                  <p className="text-slate-400 text-xs mt-0.5 mb-0 font-medium">
                    {cat.jobCount}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
                  <span>Khám phá</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
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
