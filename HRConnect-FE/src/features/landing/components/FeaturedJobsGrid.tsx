import React, { useState } from 'react';
import {
  Heart,
  MapPin,
  Briefcase,
  ArrowRight,
  Flame,
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
}

const SAMPLE_JOBS: JobCardData[] = [
  {
    id: 'job-001',
    title: 'Senior Frontend Engineer (React / Next.js)',
    company: 'FPT TELECOM & DIGITAL SOLUTIONS',
    companyId: 'fpt',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '3+ năm exp',
    salaryText: '35 - 55 triệu',
    badges: ['HOT', 'GẤP'],
    postedTime: '15 phút trước',
  },
  {
    id: 'job-002',
    title: 'Chuyên viên Quản lý Khách hàng Doanh nghiệp',
    company: 'NGÂN HÀNG TMCP KỸ THƯƠNG (TECHCOMBANK)',
    companyId: 'techcombank',
    location: 'Hà Nội & TP. HCM',
    locationRegion: 'ALL',
    experience: 'Từ 1 năm exp',
    salaryText: '20 - 35 triệu',
    badges: ['TOP'],
    postedTime: '30 phút trước',
  },
  {
    id: 'job-003',
    title: 'Trưởng nhóm Kinh doanh B2B (Tech & SaaS)',
    company: 'V-TECH SOLUTIONS GLOBAL',
    companyId: 'vtech',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '3 - 5 năm exp',
    salaryText: '25 - 45 triệu',
    badges: ['HOT'],
    postedTime: '1 giờ trước',
  },
  {
    id: 'job-004',
    title: 'Senior Java Backend Engineer (Microservices)',
    company: 'TẬP ĐOÀN CÔNG NGHIỆP VIỄN THÔNG (VIETTEL)',
    companyId: 'viettel',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: 'Senior (4+ năm)',
    salaryText: '40 - 65 triệu',
    badges: ['GẤP'],
    postedTime: '2 giờ trước',
  },
  {
    id: 'job-005',
    title: 'Chuyên viên Tuyển dụng & Đào tạo (HRBP)',
    company: 'CÔNG TY CP SỮA VIỆT NAM (VINAMILK)',
    companyId: 'vinamilk',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '2 - 4 năm exp',
    salaryText: '18 - 28 triệu',
    badges: ['TOP'],
    postedTime: '3 giờ trước',
  },
  {
    id: 'job-006',
    title: 'Senior Product Designer (UI/UX - Design System)',
    company: 'NOVATECH INNOVATION HUB',
    companyId: 'novatech',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '3+ năm exp',
    salaryText: '30 - 45 triệu',
    badges: ['HOT'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-007',
    title: 'Senior E-Commerce Operations Specialist',
    company: 'SHOPEE VIETNAM TECHNOLOGY',
    companyId: 'shopee',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '2+ năm exp',
    salaryText: '22 - 38 triệu',
    badges: ['HOT', 'TOP'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-008',
    title: 'Chuyên viên Kế toán Thuế & Quản trị Tài chính',
    company: 'NGÂN HÀNG TMCP VN THỊNH VƯỢNG (VPBANK)',
    companyId: 'vpbank',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '2 - 3 năm exp',
    salaryText: '18 - 26 triệu',
    badges: ['GẤP'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-009',
    title: 'DevOps / Cloud Platform Engineer (AWS, K8s)',
    company: 'SEED LABS & CONSUMER TECH',
    companyId: 'seedlabs',
    location: 'Đà Nẵng & Remote',
    locationRegion: 'DN',
    experience: 'Middle - Senior',
    salaryText: '35 - 55 triệu',
    badges: ['TOP'],
    postedTime: 'Mới cập nhật',
  },
];

const LOCATION_TABS = [
  { id: 'ALL', label: 'Tất cả địa điểm' },
  { id: 'HN', label: 'Hà Nội' },
  { id: 'HCM', label: 'TP. Hồ Chí Minh' },
  { id: 'DN', label: 'Đà Nẵng' },
];

export const FeaturedJobsGrid: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLocation, setSelectedLocation] = useState<'ALL' | 'HN' | 'HCM' | 'DN'>('ALL');
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set(['job-001']));

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
    if (selectedLocation === 'ALL') return true;
    return job.locationRegion === selectedLocation || job.locationRegion === 'ALL';
  });

  return (
    <section className="bg-white py-10 md:py-12 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 mb-1.5">
              <Flame className="h-3.5 w-3.5 fill-rose-600 text-rose-600" />
              <span>Cơ hội tuyển dụng gấp</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 m-0">
              Việc làm tốt nhất / Đang tuyển gấp
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Các vị trí đãi ngộ cạnh tranh, phỏng vấn nhanh và phản hồi hồ sơ trong vòng 24 giờ
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start md:self-auto"
          >
            <span>Xem thêm 41.500+ việc làm</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Location Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-semibold text-slate-500 mr-1">Lọc theo:</span>
          {LOCATION_TABS.map((tab) => {
            const isActive = selectedLocation === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedLocation(tab.id as any)}
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

        {/* Job Cards Grid (3 Columns chuẩn TopCV với Logo thật) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const isSaved = savedJobIds.has(job.id);
            return (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all p-4 flex flex-col justify-between h-full group cursor-pointer relative"
              >
                <div>
                  {/* Top Row: Real Company Logo + Badges + Heart Bookmark */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo công ty thật dạng SVG/image */}
                      <div className="w-14 h-14 rounded-xl border border-slate-200/90 p-1.5 flex items-center justify-center bg-white shadow-2xs flex-shrink-0 object-contain">
                        <CompanyLogo id={job.companyId} name={job.company} size={36} />
                      </div>

                      {/* Badges container */}
                      <div className="flex flex-wrap items-center gap-1">
                        {job.badges.map((badge) => {
                          if (badge === 'HOT') {
                            return (
                              <span
                                key={badge}
                                className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                              >
                                HOT
                              </span>
                            );
                          }
                          if (badge === 'GẤP') {
                            return (
                              <span
                                key={badge}
                                className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                              >
                                GẤP
                              </span>
                            );
                          }
                          return (
                            <span
                              key={badge}
                              className="bg-blue-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                            >
                              TOP
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bookmark Heart Button */}
                    <button
                      type="button"
                      aria-label="Lưu tin việc làm"
                      onClick={(e) => handleToggleSave(e, job.id, job.title)}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                        isSaved
                          ? 'text-rose-500 bg-rose-50'
                          : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50'
                      }`}
                    >
                      <Heart
                        className="h-4 w-4"
                        fill={isSaved ? 'currentColor' : 'none'}
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>

                  {/* Job Title */}
                  <h3 className="font-bold text-slate-900 text-sm hover:text-blue-600 line-clamp-1 transition-colors mt-3 mb-0">
                    {job.title}
                  </h3>

                  {/* Company Name */}
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 uppercase tracking-wide font-medium mb-0">
                    {job.company}
                  </p>

                  {/* Salary Highlight with Bold Green Font */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-emerald-700 font-extrabold text-sm bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/70 inline-block">
                      {job.salaryText}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {job.postedTime}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Location & Experience Tags + Quick Apply */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-500 text-xs flex items-center gap-1 truncate">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.location}</span>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500 text-xs flex items-center gap-1 truncate">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{job.experience}</span>
                    </span>
                  </div>

                  {/* Ghost Apply Button */}
                  <button
                    type="button"
                    onClick={(e) => handleApplyQuick(e, job.id)}
                    className="text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 cursor-pointer"
                  >
                    Ứng tuyển
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobsGrid;
