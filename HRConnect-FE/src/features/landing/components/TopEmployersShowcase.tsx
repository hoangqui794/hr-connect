import React, { useState } from 'react';
import { Building2, ArrowRight, ShieldCheck, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EmployerItem {
  id: string;
  name: string;
  logoText: string;
  logoBg: string;
  industry: string;
  category: 'ALL' | 'TECH' | 'BANK' | 'RETAIL';
  activeJobs: number;
  highlightRole: string;
  verified: boolean;
}

const EMPLOYERS: EmployerItem[] = [
  {
    id: 'emp-001',
    name: 'V-Tech Software & AI Labs',
    logoText: 'V-TECH',
    logoBg: 'bg-gradient-to-br from-blue-700 to-indigo-900',
    industry: 'Công nghệ thông tin / Phần mềm',
    category: 'TECH',
    activeJobs: 18,
    highlightRole: '5 vị trí Senior & Tech Lead',
    verified: true,
  },
  {
    id: 'emp-002',
    name: 'Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)',
    logoText: 'TCB',
    logoBg: 'bg-gradient-to-br from-red-600 to-red-800',
    industry: 'Tài chính / Ngân hàng',
    category: 'BANK',
    activeJobs: 39,
    highlightRole: '12 việc quản lý / chuyên gia',
    verified: true,
  },
  {
    id: 'emp-003',
    name: 'NovaTech Innovation Global',
    logoText: 'NOVA',
    logoBg: 'bg-gradient-to-br from-purple-700 to-indigo-800',
    industry: 'SaaS & Trí tuệ Nhân tạo',
    category: 'TECH',
    activeJobs: 14,
    highlightRole: '4 vị trí AI Engineer & Design',
    verified: true,
  },
  {
    id: 'emp-004',
    name: 'FPT Telecom & Digital Services',
    logoText: 'FPT',
    logoBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
    industry: 'Viễn thông & Dịch vụ số',
    category: 'TECH',
    activeJobs: 42,
    highlightRole: '15 vị trí kỹ thuật & kinh doanh',
    verified: true,
  },
  {
    id: 'emp-005',
    name: 'SEED Retail & Consumer Tech',
    logoText: 'SEED',
    logoBg: 'bg-gradient-to-br from-emerald-600 to-teal-800',
    industry: 'Bán lẻ & Thương mại điện tử',
    category: 'RETAIL',
    activeJobs: 26,
    highlightRole: '8 vị trí Marketing & Vận hành',
    verified: true,
  },
  {
    id: 'emp-006',
    name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    logoText: 'VPB',
    logoBg: 'bg-gradient-to-br from-emerald-700 to-green-900',
    industry: 'Tài chính / Ngân hàng',
    category: 'BANK',
    activeJobs: 64,
    highlightRole: '22 việc quản lý / chuyên viên',
    verified: true,
  },
];

const CATEGORY_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'TECH', label: 'Công nghệ / IT' },
  { id: 'BANK', label: 'Ngân hàng & Tài chính' },
  { id: 'RETAIL', label: 'Bán lẻ & FMCG' },
];

export const TopEmployersShowcase: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState<'ALL' | 'TECH' | 'BANK' | 'RETAIL'>('ALL');

  const filteredEmployers = EMPLOYERS.filter(
    (emp) => selectedCat === 'ALL' || emp.category === selectedCat
  );

  return (
    <section className="bg-slate-50/70 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80">
      <div className="mx-auto max-w-6xl">
        {/* Banner Card Header (Chuẩn TopCV thương hiệu lớn) */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white shadow-lg mb-8 relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-blue-500/10 blur-2xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                <Award className="h-4 w-4" />
                <span>Nhà tuyển dụng hàng đầu</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white m-0">
                Thương hiệu lớn tiêu biểu
              </h2>
              <p className="mt-1 text-sm text-slate-300 m-0">
                Hàng trăm thương hiệu doanh nghiệp uy tín hàng đầu đang tuyển dụng trên HR Connect
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 text-sm transition-all shadow-sm active:scale-95 self-start md:self-auto cursor-pointer"
            >
              <span>Khám phá thương hiệu Pro</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filter Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {CATEGORY_TABS.map((tab) => {
            const isActive = selectedCat === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCat(tab.id as any)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Employers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEmployers.map((emp) => (
            <div
              key={emp.id}
              onClick={() => navigate(`/jobs?company=${encodeURIComponent(emp.name)}`)}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-md cursor-pointer"
            >
              <div>
                <div className="flex items-center gap-4">
                  {/* Employer Logo Tile */}
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${emp.logoBg} text-white font-extrabold text-xs tracking-wider shadow-xs p-1 text-center`}
                  >
                    {emp.logoText}
                  </div>

                  {/* Name and Industry */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 m-0">
                        {emp.name}
                      </h3>
                      {emp.verified && (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 fill-blue-50" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-1 m-0 font-medium">
                      {emp.industry}
                    </p>
                  </div>
                </div>

                {/* Positions Info */}
                <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-slate-800">
                      Đang tuyển {emp.activeJobs} vị trí
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                    Hot Job
                  </span>
                </div>
              </div>

              {/* Sub-label */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">{emp.highlightRole}</span>
                <span className="shrink-0 text-blue-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Xem ngay →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
