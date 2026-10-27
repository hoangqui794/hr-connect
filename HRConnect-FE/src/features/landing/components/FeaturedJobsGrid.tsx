import React, { useState } from 'react';
import {
  Heart,
  MapPin,
  Clock,
  Briefcase,
  Zap,
  ArrowRight,
  Flame,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  logoText: string;
  logoBg: string;
  location: string;
  locationRegion: 'HN' | 'HCM' | 'DN' | 'ALL';
  experience: string;
  salaryText: string;
  badges: Array<'HOT' | 'GẤP' | 'TOP' | 'PRO'>;
  postedTime: string;
}

const SAMPLE_JOBS: JobCardData[] = [
  {
    id: 'job-001',
    title: 'Senior Frontend Developer (React / Next.js)',
    company: 'TechCorp Enterprise Solutions',
    logoText: 'TC',
    logoBg: 'bg-blue-600',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '3+ năm kinh nghiệm',
    salaryText: '35 - 55 triệu',
    badges: ['HOT', 'GẤP'],
    postedTime: '15 phút trước',
  },
  {
    id: 'job-002',
    title: 'Chuyên viên Kế toán Tổng hợp & Thuế',
    company: 'CÔNG TY CỔ PHẦN TẬP ĐOÀN AN KHANG',
    logoText: 'AK',
    logoBg: 'bg-indigo-600',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '2 năm kinh nghiệm',
    salaryText: '15 - 22 triệu',
    badges: ['TOP'],
    postedTime: '30 phút trước',
  },
  {
    id: 'job-003',
    title: 'Trưởng nhóm Kinh doanh B2B (Tech & SaaS)',
    company: 'V-Tech Solutions Vietnam',
    logoText: 'VT',
    logoBg: 'bg-emerald-600',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '3 - 5 năm kinh nghiệm',
    salaryText: '25 - 45 triệu',
    badges: ['HOT', 'PRO'],
    postedTime: '1 giờ trước',
  },
  {
    id: 'job-004',
    title: 'Senior Java Backend Engineer (Spring / Kafka)',
    company: 'DigitalWave FinTech Global',
    logoText: 'DW',
    logoBg: 'bg-amber-600',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: 'Senior (4+ năm)',
    salaryText: '40 - 65 triệu',
    badges: ['GẤP'],
    postedTime: '2 giờ trước',
  },
  {
    id: 'job-005',
    title: 'Chuyên viên Tuyển dụng & Đào tạo (HRBP Specialist)',
    company: 'SEED Retail & Logistics Group',
    logoText: 'SR',
    logoBg: 'bg-teal-600',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '2 - 4 năm kinh nghiệm',
    salaryText: '18 - 28 triệu',
    badges: ['TOP'],
    postedTime: '3 giờ trước',
  },
  {
    id: 'job-006',
    title: 'Senior Product Designer (UI/UX - Design System)',
    company: 'NovaTech Innovation Hub',
    logoText: 'NT',
    logoBg: 'bg-rose-600',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '3+ năm kinh nghiệm',
    salaryText: '30 - 45 triệu',
    badges: ['HOT', 'PRO'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-007',
    title: 'DevOps / Cloud Platform Engineer (AWS, Kubernetes)',
    company: 'CloudNative Systems Ltd.',
    logoText: 'CN',
    logoBg: 'bg-cyan-600',
    location: 'Đà Nẵng',
    locationRegion: 'DN',
    experience: 'Middle - Senior',
    salaryText: '35 - 55 triệu',
    badges: ['HOT'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-008',
    title: 'Chuyên viên Digital Marketing & Performance Ads',
    company: 'MediaMax Communications Agency',
    logoText: 'MM',
    logoBg: 'bg-purple-600',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '1 - 3 năm kinh nghiệm',
    salaryText: '16 - 26 triệu',
    badges: ['GẤP'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-009',
    title: 'Chuyên viên Quản lý Khách hàng Doanh nghiệp (SME)',
    company: 'Ngân hàng TMCP Kỹ Thương (Techcombank)',
    logoText: 'TCB',
    logoBg: 'bg-red-600',
    location: 'Hà Nội & TP. HCM',
    locationRegion: 'ALL',
    experience: 'Từ 1 năm kinh nghiệm',
    salaryText: '20 - 35 triệu',
    badges: ['TOP', 'PRO'],
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
    <section className="bg-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80">
      <div className="mx-auto max-w-6xl">
        {/* Section Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">
              <Flame className="h-3.5 w-3.5 fill-rose-600 text-rose-600" />
              <span>Cơ hội tuyển dụng hấp dẫn</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 m-0">
              Việc làm tốt nhất / Đang tuyển gấp
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-2 mb-0">
              Các vị trí đãi ngộ cao, phỏng vấn nhanh và phản hồi hồ sơ trong vòng 24 giờ
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:gap-2.5 transition-all cursor-pointer self-start md:self-auto"
          >
            <span>Xem thêm 40.000+ việc làm</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Location Filter Bar (Chuẩn TopCV) */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-semibold text-slate-500 mr-1">Lọc theo:</span>
          {LOCATION_TABS.map((tab) => {
            const isActive = selectedLocation === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedLocation(tab.id as any)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Helper Hint Bar */}
        <div className="mb-6 rounded-lg bg-blue-50/70 border border-blue-100 px-3.5 py-2 text-xs text-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">💡</span>
            <span>Gợi ý: Nhấp vào việc làm để xem chi tiết yêu cầu, chế độ đãi ngộ hoặc ứng tuyển trực tiếp.</span>
          </div>
          <span className="text-[11px] font-medium text-blue-600 hidden sm:inline">Cập nhật liên tục</span>
        </div>

        {/* Job Cards Grid (3 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => {
            const isSaved = savedJobIds.has(job.id);
            return (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="group relative flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md cursor-pointer"
              >
                <div>
                  {/* Top Row: Logo + Badges + Bookmark */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Company Avatar / Logo */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${job.logoBg} text-white font-bold text-sm shadow-xs`}
                      >
                        {job.logoText}
                      </div>

                      {/* Badges container */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {job.badges.map((badge) => {
                          if (badge === 'HOT') {
                            return (
                              <span
                                key={badge}
                                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase bg-rose-500 text-white"
                              >
                                HOT
                              </span>
                            );
                          }
                          if (badge === 'GẤP') {
                            return (
                              <span
                                key={badge}
                                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase bg-amber-500 text-white"
                              >
                                GẤP
                              </span>
                            );
                          }
                          if (badge === 'TOP') {
                            return (
                              <span
                                key={badge}
                                className="rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase bg-blue-600 text-white"
                              >
                                TOP
                              </span>
                            );
                          }
                          return (
                            <span
                              key={badge}
                              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200"
                            >
                              PRO
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
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
                        isSaved
                          ? 'border-rose-200 bg-rose-50 text-rose-600'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-rose-300 hover:text-rose-500'
                      }`}
                    >
                      <Heart
                        className="h-4 w-4"
                        fill={isSaved ? 'currentColor' : 'none'}
                        strokeWidth={2}
                      />
                    </button>
                  </div>

                  {/* Job Title */}
                  <h3 className="mt-3.5 text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 m-0">
                    {job.title}
                  </h3>

                  {/* Company Name */}
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1 m-0 font-medium">
                    {job.company}
                  </p>

                  {/* Salary highlight badge */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                      💰 {job.salaryText}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {job.postedTime}
                    </span>
                  </div>
                </div>

                {/* Bottom Badges & Action */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{job.location}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 truncate">
                      <Briefcase className="h-3 w-3" />
                      <span className="truncate">{job.experience}</span>
                    </span>
                  </div>

                  {/* Quick Apply Button on Hover */}
                  <button
                    type="button"
                    onClick={(e) => handleApplyQuick(e, job.id)}
                    className="shrink-0 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-600 hover:text-white px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                  >
                    Ứng tuyển
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Banner callout */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-blue-900 to-indigo-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div className="text-center sm:text-left">
            <h3 className="text-lg sm:text-xl font-bold m-0 text-white">
              Bạn chưa tìm thấy cơ hội việc làm mong muốn?
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-blue-200 m-0">
              Tải CV lên hệ thống để AI tự động so khớp và thông báo cho bạn ngay khi có vị trí phù hợp nhất.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/cv-builder')}
            className="shrink-0 rounded-xl bg-white text-blue-900 hover:bg-blue-50 font-bold px-6 py-3 text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            Tạo CV AI ngay
          </button>
        </div>
      </div>
    </section>
  );
};
