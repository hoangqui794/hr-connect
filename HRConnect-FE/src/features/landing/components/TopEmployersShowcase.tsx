/**
 * @file TopEmployersShowcase.tsx
 * @description Khối Doanh nghiệp Hàng đầu (Brand Showcase) trên Trang chủ.
 * Tổng hợp động từ danh sách việc làm thực tế trong Database thông qua usePublicJobSearch,
 * loại bỏ hoàn toàn các ID và số liệu mock tĩnh ('emp-001', '39 việc', v.v.).
 */
import React, { useState, useMemo } from 'react';
import { ArrowRight, Sparkles, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from './CompanyLogo';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';

interface DynamicEmployer {
  companyId: string;
  name: string;
  industry: string;
  logoUrl?: string | null;
  activeJobs: number;
}

export const TopEmployersShowcase: React.FC = () => {
  const navigate = useNavigate();

  // Truy vấn danh sách việc làm công khai từ Database
  const { data: jobPage, isLoading } = usePublicJobSearch({
    page: 1,
    pageSize: 50,
  });

  // Tổng hợp danh sách doanh nghiệp thực tế từ các tin tuyển dụng
  const employers: DynamicEmployer[] = useMemo(() => {
    const map = new Map<string, DynamicEmployer>();
    const jobs = jobPage?.items ?? [];

    jobs.forEach((job) => {
      const companyName = job.companyName || job.company?.companyName || 'Doanh nghiệp đối tác';
      const companyKey = companyName.trim().toLowerCase();

      if (!map.has(companyKey)) {
        map.set(companyKey, {
          companyId: job.companyId || 'company',
          name: companyName,
          industry: job.company?.industry || 'Đa lĩnh vực & Dịch vụ',
          logoUrl: job.companyLogoUrl || job.company?.logoUrl,
          activeJobs: 0,
        });
      }

      const existing = map.get(companyKey)!;
      existing.activeJobs += 1;
    });

    return Array.from(map.values()).slice(0, 8);
  }, [jobPage]);

  const handleSelectEmployer = (companyName: string) => {
    navigate(`/jobs?company=${encodeURIComponent(companyName)}`);
  };

  return (
    <section className="bg-[#faf8ff] py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7a5900] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#5b4300]">
                Thương hiệu tuyển dụng hàng đầu
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
              Nhà Tuyển Dụng Nổi Bật
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Gia nhập các doanh nghiệp hàng đầu với môi trường làm việc chuyên nghiệp và đãi ngộ xứng tầm
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start md:self-auto border-0 bg-transparent p-0"
          >
            <span>Xem tất cả cơ hội</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-2xs animate-pulse h-40"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 mb-3" />
                <div className="h-4 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && employers.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center my-2">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 m-0">
              Đang kết nối danh sách nhà tuyển dụng uy tín từ hệ thống
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-3">
              Các doanh nghiệp mới đang liên tục cập nhật tin tuyển dụng.
            </p>
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 border-0 bg-transparent cursor-pointer underline"
            >
              Khám phá các việc làm đang mở →
            </button>
          </div>
        )}

        {/* Real Employers Grid */}
        {!isLoading && employers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {employers.map((emp) => (
              <div
                key={emp.name}
                onClick={() => handleSelectEmployer(emp.name)}
                className="group bg-white rounded-xl p-5 border border-slate-200/90 shadow-2xs hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl p-2 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                      <CompanyLogo
                        id={emp.companyId}
                        name={emp.name}
                        logoUrl={emp.logoUrl}
                        size={40}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full">
                      {emp.activeJobs} vị trí
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[#131b2e] group-hover:text-blue-600 transition-colors line-clamp-1 m-0">
                    {emp.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-1 mb-0">
                    {emp.industry}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                  <span>Khám phá việc làm</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TopEmployersShowcase;
