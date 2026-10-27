import React, { useState } from 'react';
import { Building2, ArrowRight, ShieldCheck, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EmployerItem {
  id: string;
  name: string;
  logoCode: string;
  industry: string;
  category: 'ALL' | 'TECH' | 'BANK' | 'RETAIL';
  activeJobs: number;
  highlightRole: string;
}

const EMPLOYERS: EmployerItem[] = [
  {
    id: 'emp-001',
    name: 'V-Tech Software & AI Labs',
    logoCode: 'V-TECH GROUP',
    industry: 'Công nghệ thông tin / Phần mềm',
    category: 'TECH',
    activeJobs: 18,
    highlightRole: 'Tuyển Senior & Tech Lead',
  },
  {
    id: 'emp-002',
    name: 'Ngân hàng TMCP Kỹ Thương (Techcombank)',
    logoCode: 'TECHCOMBANK',
    industry: 'Tài chính / Ngân hàng',
    category: 'BANK',
    activeJobs: 39,
    highlightRole: '12 việc quản lý / chuyên gia',
  },
  {
    id: 'emp-003',
    name: 'NovaTech Innovation Global',
    logoCode: 'NOVATECH',
    industry: 'SaaS & Trí tuệ Nhân tạo',
    category: 'TECH',
    activeJobs: 14,
    highlightRole: 'AI Engineer & Product Design',
  },
  {
    id: 'emp-004',
    name: 'FPT Telecom & Digital Services',
    logoCode: 'FPT TELECOM',
    industry: 'Viễn thông & Dịch vụ số',
    category: 'TECH',
    activeJobs: 42,
    highlightRole: 'Kỹ sư phần mềm & Network',
  },
  {
    id: 'emp-005',
    name: 'SEED Retail & Consumer Tech',
    logoCode: 'SEED LABS',
    industry: 'Bán lẻ & Thương mại điện tử',
    category: 'RETAIL',
    activeJobs: 26,
    highlightRole: 'Marketing & Vận hành sàn',
  },
  {
    id: 'emp-006',
    name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    logoCode: 'VPBANK',
    industry: 'Tài chính / Ngân hàng',
    category: 'BANK',
    activeJobs: 64,
    highlightRole: 'Chuyên viên QLKH & Tín dụng',
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
    <section className="bg-white py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80">
      <div className="mx-auto max-w-6xl">
        {/* Clean Bright Container */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">
                <Award className="h-4 w-4" />
                <span>Nhà tuyển dụng uy tín</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 m-0">
                Thương hiệu lớn tiêu biểu
              </h2>
              <p className="text-sm sm:text-base text-slate-500 mt-1.5 mb-0">
                Các doanh nghiệp và tập đoàn hàng đầu đang tuyển dụng nhân tài trên HR Connect
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start md:self-auto"
            >
              <span>Xem tất cả công ty</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Filter Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {CATEGORY_TABS.map((tab) => {
              const isActive = selectedCat === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCat(tab.id as any)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Employers Grid with Corporate Rectangular Logos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredEmployers.map((emp) => (
              <div
                key={emp.id}
                onClick={() => navigate(`/jobs?company=${encodeURIComponent(emp.name)}`)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all p-5 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    {/* Logo hình chữ nhật chuẩn corporate */}
                    <div className="h-10 px-3 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs tracking-wider uppercase">
                      {emp.logoCode}
                    </div>

                    <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 text-[11px] font-semibold">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Xác thực</span>
                    </span>
                  </div>

                  {/* Company Name */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors mt-3.5 mb-0 line-clamp-1">
                    {emp.name}
                  </h3>

                  {/* Industry */}
                  <p className="text-xs text-slate-500 mt-0.5 mb-0 font-medium line-clamp-1">
                    {emp.industry}
                  </p>
                </div>

                {/* Positions Info & CTA */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Đang tuyển {emp.activeJobs} vị trí
                  </span>
                  <span className="text-slate-500 font-medium group-hover:text-blue-600 transition-colors inline-flex items-center gap-1">
                    <span>{emp.highlightRole}</span>
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopEmployersShowcase;
