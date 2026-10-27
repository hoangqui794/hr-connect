/**
 * @file TopCategoriesGrid.tsx
 * @description Lưới danh mục ngành nghề việc làm trên Trang chủ (Landing Page).
 * Tính toán động từ danh sách công việc thực tế từ Database, loại bỏ toàn bộ số liệu ảo fix cứng.
 */
import React, { useMemo } from 'react';
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
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';

interface CategoryConfig {
  id: string;
  name: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  hoverColor: string;
  queryParam: string;
  matchRegex: RegExp;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    id: 'it',
    name: 'Công nghệ Thông tin',
    icon: Code2,
    iconBg: 'bg-[#95f5ce]/40',
    iconColor: 'text-[#005f45]',
    hoverColor: 'group-hover:text-[#005f45]',
    queryParam: 'IT',
    matchRegex: /react|frontend|backend|developer|lập trình|it|software|tech|data|engineer|devops|fullstack|node/i,
  },
  {
    id: 'sales',
    name: 'Kinh doanh / Bán hàng',
    icon: TrendingUp,
    iconBg: 'bg-[#ffdbd0]/60',
    iconColor: 'text-[#982e00]',
    hoverColor: 'group-hover:text-[#982e00]',
    queryParam: 'SALES',
    matchRegex: /sale|kinh doanh|bán hàng|account executive|tư vấn|telesale|b2b|b2c|growth/i,
  },
  {
    id: 'marketing',
    name: 'Marketing / Truyền thông',
    icon: Megaphone,
    iconBg: 'bg-[#d9e2ff]',
    iconColor: 'text-[#1d59c1]',
    hoverColor: 'group-hover:text-[#1d59c1]',
    queryParam: 'MARKETING',
    matchRegex: /marketing|truyền thông|pr|seo|content|digital|brand|quảng cáo/i,
  },
  {
    id: 'finance',
    name: 'Tài chính / Ngân hàng',
    icon: Landmark,
    iconBg: 'bg-[#eaedff]',
    iconColor: 'text-[#0f52ba]',
    hoverColor: 'group-hover:text-[#0f52ba]',
    queryParam: 'FINANCE',
    matchRegex: /tài chính|ngân hàng|bank|tín dụng|đầu tư|fintech|thẩm định/i,
  },
  {
    id: 'accounting',
    name: 'Kế toán / Kiểm toán / Thuế',
    icon: Calculator,
    iconBg: 'bg-[#f2f3ff]',
    iconColor: 'text-[#007a5a]',
    hoverColor: 'group-hover:text-[#007a5a]',
    queryParam: 'ACCOUNTING',
    matchRegex: /kế toán|thuế|kiểm toán|accounting|audit|cpa|thu chi/i,
  },
  {
    id: 'hr',
    name: 'Nhân sự / Hành chính',
    icon: Users,
    iconBg: 'bg-[#ffdbd0]/70',
    iconColor: 'text-[#c03e05]',
    hoverColor: 'group-hover:text-[#c03e05]',
    queryParam: 'HR',
    matchRegex: /nhân sự|hr|hành chính|tuyển dụng|recruiter|hrbp|c&b/i,
  },
  {
    id: 'design',
    name: 'Thiết kế UI/UX & Sáng tạo',
    icon: Palette,
    iconBg: 'bg-[#eaedff]',
    iconColor: 'text-[#6292fd]',
    hoverColor: 'group-hover:text-[#1d59c1]',
    queryParam: 'DESIGN',
    matchRegex: /ui\/ux|design|thiết kế|figma|graphic|sáng tạo|creative/i,
  },
  {
    id: 'real-estate',
    name: 'Bất động sản / Xây dựng',
    icon: Building2,
    iconBg: 'bg-[#95f5ce]/30',
    iconColor: 'text-[#007a5a]',
    hoverColor: 'group-hover:text-[#007a5a]',
    queryParam: 'REAL_ESTATE',
    matchRegex: /bất động sản|xây dựng|kiến trúc|dự án|mặt bằng|thầu/i,
  },
];

export const TopCategoriesGrid: React.FC = () => {
  const navigate = useNavigate();

  // Truy vấn dữ liệu công việc thực tế từ Database
  const { data: jobPage, isLoading } = usePublicJobSearch({
    page: 1,
    pageSize: 50,
  });

  const totalJobs = jobPage?.totalCount ?? 0;

  // Tính toán số lượng việc làm theo từng ngành nghề từ dữ liệu thực tế
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const jobs = jobPage?.items ?? [];

    CATEGORY_CONFIGS.forEach((config) => {
      const matched = jobs.filter((job) => {
        const fullText = [
          job.title,
          job.companyName,
          job.description,
          job.company?.industry,
          ...(job.requirements?.map((r) => r.content) ?? []),
          ...(job.skills?.map((s) => s.skillName) ?? []),
        ]
          .filter(Boolean)
          .join(' ');
        return config.matchRegex.test(fullText);
      });
      counts[config.queryParam] = matched.length;
    });

    return counts;
  }, [jobPage]);

  const handleSelectCategory = (queryParam: string) => {
    navigate(`/jobs?category=${encodeURIComponent(queryParam)}`);
  };

  return (
    <section className="bg-[#f8f9ff] py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#007a5a] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#005f45]">
                Định hướng phát triển
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
              Top Ngành Nghề Nổi Bật Nhất
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              {totalJobs > 0
                ? `Khám phá các vị trí tuyển dụng chất lượng cao đang mở tuyển trên toàn hệ thống`
                : `Lựa chọn lĩnh vực chuyên môn của bạn để kết nối trực tiếp với nhà tuyển dụng`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#007a5a] hover:text-[#005f45] transition-colors cursor-pointer self-start sm:self-auto group border-0 bg-transparent p-0"
          >
            <span>Khám phá tất cả ngành nghề</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* 8 Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {CATEGORY_CONFIGS.map((cat) => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.queryParam] ?? 0;
            const countLabel = isLoading
              ? 'Đang cập nhật...'
              : count > 0
                ? `${count} việc làm đang tuyển`
                : 'Đang mở tuyển';

            return (
              <div
                key={cat.id}
                onClick={() => handleSelectCategory(cat.queryParam)}
                className="group bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${cat.iconBg}`}
                  >
                    <Icon className={`h-6 w-6 ${cat.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <h3
                      className={`text-sm sm:text-base font-bold text-[#131b2e] transition-colors truncate m-0 ${cat.hoverColor}`}
                    >
                      {cat.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium m-0 mt-0.5">
                      {countLabel}
                    </p>
                  </div>
                </div>

                <div className="w-7 h-7 rounded-full bg-slate-50 group-hover:bg-[#f2f3ff] flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors shrink-0">
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
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
