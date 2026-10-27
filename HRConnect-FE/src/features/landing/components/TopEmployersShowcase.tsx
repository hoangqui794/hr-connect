import React, { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from './CompanyLogo';

interface EmployerItem {
  id: string;
  name: string;
  companyId: string;
  industry: string;
  category: 'ALL' | 'BANK' | 'TECH' | 'RETAIL' | 'FMCG';
  activeJobs: number;
}

const EMPLOYERS: EmployerItem[] = [
  {
    id: 'emp-001',
    name: 'Techcombank',
    companyId: 'techcombank',
    industry: 'Ngân hàng & Tài chính',
    category: 'BANK',
    activeJobs: 39,
  },
  {
    id: 'emp-002',
    name: 'FPT Telecom',
    companyId: 'fpt',
    industry: 'Công nghệ thông tin & Viễn thông',
    category: 'TECH',
    activeJobs: 42,
  },
  {
    id: 'emp-003',
    name: 'Viettel Solutions',
    companyId: 'viettel',
    industry: 'Viễn thông & Công nghệ số',
    category: 'TECH',
    activeJobs: 58,
  },
  {
    id: 'emp-004',
    name: 'Vinamilk Group',
    companyId: 'vinamilk',
    industry: 'Bán lẻ & FMCG',
    category: 'FMCG',
    activeJobs: 26,
  },
  {
    id: 'emp-005',
    name: 'Shopee Vietnam',
    companyId: 'shopee',
    industry: 'Thương mại điện tử & Tech',
    category: 'RETAIL',
    activeJobs: 34,
  },
  {
    id: 'emp-006',
    name: 'VPBank',
    companyId: 'vpbank',
    industry: 'Ngân hàng TMCP VN Thịnh Vượng',
    category: 'BANK',
    activeJobs: 64,
  },
  {
    id: 'emp-007',
    name: 'V-Tech Solutions',
    companyId: 'vtech',
    industry: 'Phần mềm & AI Solutions',
    category: 'TECH',
    activeJobs: 18,
  },
  {
    id: 'emp-008',
    name: 'NovaTech Hub',
    companyId: 'novatech',
    industry: 'SaaS & Trí tuệ Nhân tạo',
    category: 'TECH',
    activeJobs: 15,
  },
];

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'BANK', label: 'Ngân hàng' },
  { id: 'TECH', label: 'IT - Phần mềm' },
  { id: 'FMCG', label: 'Hàng tiêu dùng - FMCG' },
  { id: 'RETAIL', label: 'Bán lẻ & E-Commerce' },
];

export const TopEmployersShowcase: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState<'ALL' | 'BANK' | 'TECH' | 'RETAIL' | 'FMCG'>('ALL');

  const filteredEmployers = EMPLOYERS.filter(
    (emp) => selectedCat === 'ALL' || emp.category === selectedCat
  );

  return (
    <section className="bg-[#faf8ff] py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Banner Đối tác Tuyển dụng Chiến lược - Tone Sáng & Trang Nhã Chuẩn DESIGN.md */}
        <div className="bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/80 border border-slate-200/90 rounded-2xl p-6 sm:p-7 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm relative overflow-hidden">
          {/* Subtle Ambient Glows */}
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
          <div className="pointer-events-none absolute top-0 left-1/3 h-32 w-32 rounded-full bg-indigo-200/40 blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50/90 border border-blue-200/60 px-3 py-1 rounded-full mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Đối tác tuyển dụng chiến lược</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
              Thương hiệu lớn tiêu biểu
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 m-0 leading-relaxed max-w-2xl font-normal">
              Hàng trăm thương hiệu doanh nghiệp uy tín hàng đầu đang tuyển dụng trên HR Connect Pro
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="relative z-10 shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-sm hover:shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer border-0"
          >
            Pro Company ⭐
          </button>
        </div>

        {/* Filter Category Chips (Đồng bộ Brand Primary Blue) */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCat === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCat(tab.id as any)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm border-0'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Grid các thương hiệu lớn với Logo to rõ ràng ở giữa và hiệu ứng hover */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredEmployers.map((emp) => (
            <div
              key={emp.id}
              onClick={() => navigate(`/jobs?company=${encodeURIComponent(emp.name)}`)}
              className="bg-white rounded-xl border border-slate-200/80 hover:border-blue-300 shadow-xs hover:shadow-xl transition-all duration-300 p-5 flex flex-col items-center text-center cursor-pointer group hover:-translate-y-1"
            >
              {/* Logo to rõ ràng ở giữa trong squircle container mở rộng */}
              <div className="w-16 h-16 rounded-xl border border-slate-200 p-2 flex items-center justify-center bg-slate-50 shadow-2xs mb-3 group-hover:scale-105 transition-transform overflow-hidden">
                <CompanyLogo id={emp.companyId} name={emp.name} size={48} className="w-full h-full object-contain" />
              </div>

              {/* Tên công ty */}
              <h3 className="text-sm font-bold text-[#131b2e] group-hover:text-blue-600 transition-colors line-clamp-1 m-0">
                {emp.name}
              </h3>

              {/* Lĩnh vực */}
              <p className="text-xs text-slate-500 line-clamp-1 mt-1 mb-0 font-medium">
                {emp.industry}
              </p>

              {/* Số lượng vị trí - Tone nhẹ nhàng tinh tế */}
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-3.5 py-1 rounded-full mt-3.5 group-hover:bg-blue-100/70 transition-colors">
                Đang tuyển {emp.activeJobs} vị trí
              </span>
            </div>
          ))}
        </div>

        {/* Khám phá 500+ doanh nghiệp link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            <span>Khám phá 500+ doanh nghiệp hàng đầu</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TopEmployersShowcase;

