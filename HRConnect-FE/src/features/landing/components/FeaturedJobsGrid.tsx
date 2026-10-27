import React, { useState } from 'react';
import {
  Heart,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { CompanyLogo } from './CompanyLogo';

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  locationRegion: 'HN' | 'HCM' | 'DN' | 'ALL';
  experience: string;
  salaryText: string;
  badges: Array<'HOT' | 'GẤP' | 'TOP'>;
  postedTime: string;
  tag: 'FOR_YOU' | 'HIGH_SALARY' | 'URGENT' | 'REMOTE' | 'ENTERPRISE';
}

const SAMPLE_JOBS: JobCardData[] = [
  {
    id: 'job-001',
    title: 'Senior Frontend Engineer (React/Next)',
    company: 'Techcombank Digital Banking Hub',
    companyId: 'techcombank',
    location: 'Hà Nội & HCM',
    locationRegion: 'ALL',
    experience: '3 năm kinh nghiệm',
    salaryText: '35 - 55 Triệu VND',
    badges: ['HOT'],
    postedTime: '2 giờ trước',
    tag: 'HIGH_SALARY',
  },
  {
    id: 'job-002',
    title: 'Product Growth Specialist (Fintech)',
    company: 'VNG Corporation - ZaloPay',
    companyId: 'vng',
    location: 'Quận 7, TP.HCM',
    locationRegion: 'HCM',
    experience: '2+ năm kinh nghiệm',
    salaryText: '1,800 - 2,500 USD',
    badges: ['GẤP'],
    postedTime: '4 giờ trước',
    tag: 'FOR_YOU',
  },
  {
    id: 'job-003',
    title: 'Senior Data Analyst (E-Commerce)',
    company: 'Shopee Vietnam HQ',
    companyId: 'shopee',
    location: 'Quận 1, TP.HCM',
    locationRegion: 'HCM',
    experience: 'SQL / Tableau / Python',
    salaryText: '30 - 45 Triệu VND',
    badges: ['TOP'],
    postedTime: '5 giờ trước',
    tag: 'HIGH_SALARY',
  },
  {
    id: 'job-004',
    title: 'Cloud Solutions Architect (AWS/GCP)',
    company: 'FPT Software Global',
    companyId: 'fpt',
    location: 'Cầu Giấy, Hà Nội',
    locationRegion: 'HN',
    experience: '5+ năm kinh nghiệm',
    salaryText: '50 - 75 Triệu VND',
    badges: ['HOT', 'GẤP'],
    postedTime: '6 giờ trước',
    tag: 'ENTERPRISE',
  },
  {
    id: 'job-005',
    title: 'Trưởng Phòng Nhân Sự (HR Manager)',
    company: 'Viettel Solutions Corporate',
    companyId: 'viettel',
    location: 'Ba Đình, Hà Nội',
    locationRegion: 'HN',
    experience: 'HR Business Partner',
    salaryText: '40 - 60 Triệu VND',
    badges: ['HOT'],
    postedTime: '8 giờ trước',
    tag: 'URGENT',
  },
  {
    id: 'job-006',
    title: 'Brand Marketing Manager (FMCG)',
    company: 'Vinamilk Vietnam Corporation',
    companyId: 'vinamilk',
    location: 'Quận 7, TP.HCM',
    locationRegion: 'HCM',
    experience: 'Campaign & Strategy',
    salaryText: 'Thỏa thuận (Hấp dẫn)',
    badges: ['TOP'],
    postedTime: '9 giờ trước',
    tag: 'FOR_YOU',
  },
  {
    id: 'job-007',
    title: 'Chuyên viên Kế toán Thuế & Quản trị',
    company: 'Ngân Hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    companyId: 'vpbank',
    location: 'Đống Đa, Hà Nội',
    locationRegion: 'HN',
    experience: '2 - 3 năm kinh nghiệm',
    salaryText: '20 - 32 Triệu VND',
    badges: ['GẤP'],
    postedTime: '10 giờ trước',
    tag: 'ENTERPRISE',
  },
  {
    id: 'job-008',
    title: 'Fullstack Engineer (Node.js & React)',
    company: 'V-Tech Solutions Global',
    companyId: 'vtech',
    location: 'Remote (Toàn quốc)',
    locationRegion: 'ALL',
    experience: 'Middle - Senior (3+ năm)',
    salaryText: '28 - 48 Triệu VND',
    badges: ['HOT'],
    postedTime: 'Hôm nay',
    tag: 'REMOTE',
  },
  {
    id: 'job-009',
    title: 'DevOps & AI Infrastructure Engineer',
    company: 'NovaTech Innovation Hub',
    companyId: 'novatech',
    location: 'Hải Châu, Đà Nẵng',
    locationRegion: 'DN',
    experience: 'Kubernetes, Terraform, MLOps',
    salaryText: '35 - 55 Triệu VND',
    badges: ['TOP'],
    postedTime: 'Hôm nay',
    tag: 'FOR_YOU',
  },
];

const SEGMENT_TABS = [
  { id: 'FOR_YOU', label: 'Dành riêng cho bạn' },
  { id: 'HIGH_SALARY', label: 'Lương cao 30M+' },
  { id: 'URGENT', label: 'Tuyển gấp / Thưởng nóng' },
  { id: 'REMOTE', label: 'Việc làm Remote' },
  { id: 'ENTERPRISE', label: 'Tập đoàn lớn' },
];

export const FeaturedJobsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<string>('FOR_YOU');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set(['job-001', 'job-004']));

  const handleToggleSave = (e: React.MouseEvent, jobId: string, jobTitle: string) => {
    e.stopPropagation();
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        void message.info(`Đã bỏ lưu "${jobTitle}"`);
      } else {
        next.add(jobId);
        void message.success(`Đã lưu "${jobTitle}" vào danh sách yêu thích!`);
      }
      return next;
    });
  };

  const handleApplyQuick = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    navigate(`/jobs/${jobId}`);
  };

  const filteredJobs = SAMPLE_JOBS.filter((job) => {
    if (selectedTab === 'FOR_YOU') return true;
    if (selectedTab === 'HIGH_SALARY') return job.tag === 'HIGH_SALARY' || job.salaryText.includes('50') || job.salaryText.includes('USD');
    if (selectedTab === 'URGENT') return job.badges.includes('GẤP') || job.badges.includes('HOT');
    if (selectedTab === 'REMOTE') return job.location.includes('Remote') || job.tag === 'REMOTE';
    if (selectedTab === 'ENTERPRISE') return job.tag === 'ENTERPRISE' || ['techcombank', 'fpt', 'viettel', 'vinamilk'].includes(job.companyId);
    return true;
  });

  return (
    <section className="bg-white py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header & Segment Tabs (Chuẩn code.html lines 184-201) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c03e05] animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#982e00]">
                Cơ hội việc làm hot
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#131b2e] m-0">
              Việc Làm Tốt Nhất Dành Cho Bạn
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Các vị trí đãi ngộ cạnh tranh, phỏng vấn nhanh và phản hồi hồ sơ trong vòng 24 giờ
            </p>
          </div>

          {/* Segment Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {SEGMENT_TABS.map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedTab(tab.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-0 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-[#f2f3ff] hover:bg-[#eaedff] text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Job Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => {
            const isSaved = savedJobIds.has(job.id);
            return (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="bg-white rounded-xl p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group border border-slate-200/80 hover:border-blue-300 hover:-translate-y-1 cursor-pointer relative"
              >
                <div>
                  {/* Top Row: Real Vector Logo (w-12 h-12 p-2) + Badge + Bookmark */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Logo Squircle Box rộng rãi, sắc nét */}
                    <div className="w-12 h-12 rounded-xl p-2 bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                      <CompanyLogo id={job.companyId} name={job.company} size={40} className="w-full h-full object-contain" />
                    </div>

                    {/* Badges & Bookmark */}
                    <div className="flex items-center gap-1.5">
                      {job.badges.map((badge) => {
                        if (badge === 'HOT') {
                          return (
                            <span
                              key={badge}
                              className="inline-flex items-center gap-1 bg-[#ffdbd0] text-[#982e00] font-bold text-[11px] px-2 py-0.5 rounded-full"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#c03e05] animate-ping" /> HOT
                            </span>
                          );
                        }
                        if (badge === 'GẤP') {
                          return (
                            <span
                              key={badge}
                              className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold text-[11px] px-2.5 py-0.5 rounded-full"
                            >
                              Tuyển gấp
                            </span>
                          );
                        }
                        return (
                          <span
                            key={badge}
                            className="inline-flex items-center gap-1 bg-[#d9e2ff] text-[#001945] font-bold text-[11px] px-2 py-0.5 rounded-full"
                          >
                            Top Đãi Ngộ
                          </span>
                        );
                      })}

                      {/* Bookmark Heart Button */}
                      <button
                        type="button"
                        aria-label="Lưu việc làm"
                        onClick={(e) => handleToggleSave(e, job.id, job.title)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer border-0 ${
                          isSaved
                            ? 'text-rose-500 bg-rose-50'
                            : 'text-slate-400 hover:text-rose-500 hover:bg-[#f2f3ff]'
                        }`}
                        title="Lưu việc làm"
                      >
                        <Heart
                          className="h-4 w-4"
                          fill={isSaved ? 'currentColor' : 'none'}
                          strokeWidth={1.75}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3 className="font-bold text-base text-[#131b2e] group-hover:text-blue-600 transition-colors line-clamp-1 mb-1 m-0">
                    {job.title}
                  </h3>

                  {/* Company Name */}
                  <p className="text-xs text-slate-500 mb-2.5 line-clamp-1 font-medium m-0">
                    {job.company}
                  </p>

                  {/* Salary Chip (Giữ màu xanh lá duy nhất cho Mức lương) */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="font-bold text-sm text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-md inline-block">
                      {job.salaryText}
                    </span>
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs bg-[#f2f3ff] text-slate-700 px-2 py-1 rounded font-medium">
                      {job.location}
                    </span>
                    <span className="text-xs bg-[#f2f3ff] text-slate-700 px-2 py-1 rounded font-medium">
                      {job.experience}
                    </span>
                    <span className="text-xs bg-[#f2f3ff] text-slate-700 px-2 py-1 rounded font-medium">
                      Phúc lợi tốt
                    </span>
                  </div>
                </div>

                {/* Bottom Row - Nút Ứng tuyển ngay màu Brand Primary Blue */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">
                    Đăng {job.postedTime}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleApplyQuick(e, job.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer border-0"
                  >
                    Ứng tuyển ngay
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Button */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-2 bg-[#eaedff] hover:bg-blue-100/70 text-slate-800 hover:text-blue-700 font-semibold text-sm px-6 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer border-0"
          >
            <span>Xem tất cả 45,210 việc làm đang mở</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobsGrid;

