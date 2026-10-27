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
    <section className="bg-slate-50/60 py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Banner Vàng Kim / Đồng Sang Trọng Chuẩn TopCV Pro */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 text-white rounded-2xl p-6 sm:p-7 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg relative overflow-hidden">
          <div className="pointer-events-none absolute -right-8 -bottom-8 h-44 w-44 rounded-full bg-yellow-400/20 blur-2xl" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-200 mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Đối tác tuyển dụng chiến lược</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white m-0">
              Thương hiệu lớn tiêu biểu
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-amber-100 m-0">
              Hàng trăm thương hiệu doanh nghiệp uy tín hàng đầu đang tuyển dụng trên HR Connect Pro
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="relative z-10 shrink-0 bg-gradient-to-r from-amber-200 to-yellow-400 hover:from-amber-100 hover:to-yellow-300 text-amber-950 font-extrabold px-6 py-2.5 rounded-xl text-sm shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            Pro Company ⭐
          </button>
        </div>

        {/* Filter Category Chips */}
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
                    ? 'bg-amber-800 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50/50'
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
              className="bg-white rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-lg transition-all p-5 flex flex-col items-center text-center cursor-pointer group hover:scale-[1.02]"
            >
              {/* Logo to rõ ràng ở giữa */}
              <div className="w-16 h-16 rounded-xl border border-slate-200 p-2 flex items-center justify-center bg-white shadow-2xs mb-3 group-hover:scale-110 transition-transform">
                <CompanyLogo id={emp.companyId} name={emp.name} size={44} />
              </div>

              {/* Tên công ty */}
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-1 m-0">
                {emp.name}
              </h3>

              {/* Lĩnh vực */}
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 mb-0 font-medium">
                {emp.industry}
              </p>

              {/* Số lượng vị trí */}
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full mt-3">
                Đang tuyển {emp.activeJobs} vị trí
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopEmployersShowcase;
