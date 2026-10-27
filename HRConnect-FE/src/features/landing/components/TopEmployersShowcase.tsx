import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CompanyLogo } from './CompanyLogo';

interface EmployerItem {
  id: string;
  name: string;
  companyId: string;
  industry: string;
  description: string;
  followers: string;
  category: 'ALL' | 'BANK' | 'TECH' | 'RETAIL' | 'FMCG';
  activeJobs: number;
  bannerGradient: string;
}

const EMPLOYERS: EmployerItem[] = [
  {
    id: 'emp-001',
    name: 'VNG Corporation',
    companyId: 'vng',
    industry: 'Công nghệ & Fintech',
    description: 'Kỳ lân công nghệ đầu tiên tại Việt Nam, kiến tạo trải nghiệm số cho hàng chục triệu người dùng.',
    followers: '12.5k Theo dõi',
    category: 'TECH',
    activeJobs: 28,
    bannerGradient: 'from-[#1d59c1] via-[#007a5a] to-[#79d9b2]',
  },
  {
    id: 'emp-002',
    name: 'FPT Software',
    companyId: 'fpt',
    industry: 'Công nghệ thông tin & Viễn thông',
    description: 'Tập đoàn công nghệ dịch vụ phần mềm số 1 Đông Nam Á, môi trường làm việc toàn cầu năng động.',
    followers: '35.2k Theo dõi',
    category: 'TECH',
    activeJobs: 64,
    bannerGradient: 'from-[#005f45] via-[#007a5a] to-[#1d59c1]',
  },
  {
    id: 'emp-003',
    name: 'Techcombank',
    companyId: 'techcombank',
    industry: 'Ngân hàng & Tài chính số',
    description: 'Ngân hàng dẫn đầu chuyển đổi số tại Việt Nam với chế độ đãi ngộ và lộ trình phát triển vượt trội.',
    followers: '21.8k Theo dõi',
    category: 'BANK',
    activeJobs: 42,
    bannerGradient: 'from-[#c03e05] via-[#1d59c1] to-[#007a5a]',
  },
  {
    id: 'emp-004',
    name: 'Viettel Solutions',
    companyId: 'viettel',
    industry: 'Viễn thông & Công nghệ số',
    description: 'Tiên phong kiến tạo xã hội số, xây dựng các giải pháp số quy mô quốc gia và khu vực.',
    followers: '29.4k Theo dõi',
    category: 'TECH',
    activeJobs: 58,
    bannerGradient: 'from-[#ba1a1a] via-[#c03e05] to-[#1d59c1]',
  },
  {
    id: 'emp-005',
    name: 'Vinamilk Corporation',
    companyId: 'vinamilk',
    industry: 'Bán lẻ & FMCG',
    description: 'Thương hiệu sữa quốc gia số 1 Việt Nam, môi trường làm việc lý tưởng hàng đầu châu Á.',
    followers: '18.7k Theo dõi',
    category: 'FMCG',
    activeJobs: 26,
    bannerGradient: 'from-[#0f52ba] via-[#1d59c1] to-[#007a5a]',
  },
  {
    id: 'emp-006',
    name: 'Shopee Vietnam HQ',
    companyId: 'shopee',
    industry: 'Thương mại điện tử & Tech',
    description: 'Hệ sinh thái TMĐT số 1 khu vực, môi trường làm việc sáng tạo, năng động và đãi ngộ top đầu.',
    followers: '45.1k Theo dõi',
    category: 'RETAIL',
    activeJobs: 34,
    bannerGradient: 'from-[#ff6b35] via-[#c03e05] to-[#982e00]',
  },
  {
    id: 'emp-007',
    name: 'VPBank',
    companyId: 'vpbank',
    industry: 'Ngân hàng TMCP VN Thịnh Vượng',
    description: 'Ngân hàng có tốc độ tăng trưởng bứt phá, văn hóa doanh nghiệp đổi mới và đãi ngộ nhân tài hấp dẫn.',
    followers: '19.3k Theo dõi',
    category: 'BANK',
    activeJobs: 48,
    bannerGradient: 'from-[#059669] via-[#007a5a] to-[#0f52ba]',
  },
  {
    id: 'emp-008',
    name: 'NovaTech Innovation Hub',
    companyId: 'novatech',
    industry: 'SaaS & AI Solutions',
    description: 'Vườn ươm công nghệ AI thế hệ mới, tiên phong phát triển các ứng dụng GenAI cho doanh nghiệp.',
    followers: '8.9k Theo dõi',
    category: 'TECH',
    activeJobs: 15,
    bannerGradient: 'from-[#4338ca] via-[#1d59c1] to-[#007a5a]',
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
    <section className="bg-slate-50/70 py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (Chuẩn code.html lines 444-453) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#007a5a] block mb-1">
              Môi trường làm việc lý tưởng
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
              Top Doanh Nghiệp Tiêu Biểu
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Khám phá các tổ chức hàng đầu với văn hóa doanh nghiệp cởi mở và đãi ngộ cạnh tranh
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#007a5a] hover:text-[#005f45] hover:underline cursor-pointer self-start md:self-auto"
          >
            <span>Khám phá 500+ công ty hàng đầu</span>
            <ChevronRight className="h-4 w-4" />
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
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#007a5a] text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:border-[#79d9b2] hover:bg-[#eaedff]/30'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Company Cards Grid (Chuẩn code.html lines 455-534) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredEmployers.map((emp) => (
            <div
              key={emp.id}
              onClick={() => navigate(`/jobs?company=${encodeURIComponent(emp.name)}`)}
              className="bg-white rounded-xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group border border-slate-200/90 hover:border-[#79d9b2] hover:-translate-y-0.5 cursor-pointer"
            >
              <div>
                {/* Banner Gradient with Overlapping Logo */}
                <div className={`h-24 bg-gradient-to-r ${emp.bannerGradient} relative`}>
                  <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-xl bg-white p-1 shadow-md border border-slate-100 flex items-center justify-center">
                    <CompanyLogo id={emp.companyId} name={emp.name} size={38} />
                  </div>
                </div>

                {/* Company Info */}
                <div className="pt-8 px-4 pb-3">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="font-bold text-sm sm:text-base text-[#131b2e] group-hover:text-[#007a5a] transition-colors line-clamp-1 m-0">
                      {emp.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">
                      {emp.followers}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed mb-0">
                    {emp.description}
                  </p>
                </div>
              </div>

              {/* Bottom Action Row */}
              <div className="px-4 pb-3.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#005f45] bg-[#95f5ce]/40 px-2 py-0.5 rounded-md">
                  {emp.activeJobs} vị trí đang mở
                </span>
                <span className="text-xs font-semibold text-[#1d59c1] group-hover:underline flex items-center gap-0.5">
                  <span>Xem việc làm</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopEmployersShowcase;
