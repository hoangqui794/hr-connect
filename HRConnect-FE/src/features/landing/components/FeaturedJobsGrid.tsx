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

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  logoText: string;
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
    company: 'TECHCORP SOLUTIONS VIETNAM',
    logoText: 'TC',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '3+ năm exp',
    salaryText: '35 - 55 triệu',
    badges: ['HOT', 'GẤP'],
    postedTime: '15 phút trước',
  },
  {
    id: 'job-002',
    title: 'Chuyên viên Kế toán Tổng hợp & Thuế',
    company: 'CÔNG TY CP TẬP ĐOÀN AN KHANG',
    logoText: 'AK',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '2 năm exp',
    salaryText: '15 - 22 triệu',
    badges: ['TOP'],
    postedTime: '30 phút trước',
  },
  {
    id: 'job-003',
    title: 'Trưởng nhóm Kinh doanh B2B (Tech & SaaS)',
    company: 'V-TECH SOLUTIONS GLOBAL',
    logoText: 'VT',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '3 - 5 năm exp',
    salaryText: '25 - 45 triệu',
    badges: ['HOT', 'PRO'],
    postedTime: '1 giờ trước',
  },
  {
    id: 'job-004',
    title: 'Senior Java Backend Engineer (Spring / Kafka)',
    company: 'DIGITALWAVE FINTECH LABS',
    logoText: 'DW',
    location: 'TP. Hồ Chí Minh',
    locationRegion: 'HCM',
    experience: '4+ năm exp',
    salaryText: '40 - 65 triệu',
    badges: ['GẤP'],
    postedTime: '2 giờ trước',
  },
  {
    id: 'job-005',
    title: 'Chuyên viên Tuyển dụng & Đào tạo (HRBP)',
    company: 'SEED RETAIL GROUP',
    logoText: 'SR',
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
    logoText: 'NT',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '3+ năm exp',
    salaryText: '30 - 45 triệu',
    badges: ['HOT', 'PRO'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-007',
    title: 'DevOps / Cloud Platform Engineer (AWS, K8s)',
    company: 'CLOUDNATIVE SYSTEMS LTD',
    logoText: 'CN',
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
    company: 'MEDIAMAX COMMUNICATIONS',
    logoText: 'MM',
    location: 'Hà Nội',
    locationRegion: 'HN',
    experience: '1 - 3 năm exp',
    salaryText: '16 - 26 triệu',
    badges: ['GẤP'],
    postedTime: 'Hôm nay',
  },
  {
    id: 'job-009',
    title: 'Chuyên viên Quản lý Khách hàng Doanh nghiệp (SME)',
    company: 'NGÂN HÀNG TMCP KỸ THƯƠNG (TECHCOMBANK)',
    logoText: 'TCB',
    location: 'Hà Nội & TP. HCM',
    locationRegion: 'ALL',
    experience: 'Từ 1 năm exp',
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
    <section className="bg-white py-16 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80">
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
            <p className="text-sm sm:text-base text-slate-500 mt-1.5 mb-0">
              Vị trí đãi ngộ cạnh tranh, phỏng vấn nhanh và phản hồi hồ sơ trong 24 giờ
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer self-start md:self-auto"
          >
            <span>Xem thêm 40.000+ việc làm</span>
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

        {/* Helper Hint Bar */}
        <div className="mb-6 rounded-lg bg-blue-50/60 border border-blue-100 px-3.5 py-2 text-xs text-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">💡</span>
            <span>Gợi ý: Nhấp vào thẻ việc làm để xem mô tả chi tiết, chế độ phúc lợi hoặc ứng tuyển trực tiếp.</span>
          </div>
          <span className="text-[11px] font-medium text-blue-600 hidden sm:inline">Cập nhật liên tục</span>
        </div>

        {/* Job Cards Grid (Refactored Clean TopCV Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredJobs.map((job) => {
            const isSaved = savedJobIds.has(job.id);
            return (
              <div
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="bg-white rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all p-4 flex flex-col justify-between h-full group cursor-pointer relative"
              >
                <div>
                  {/* Top Row: Slate Corporate Avatar + Badges + Heart Bookmark */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo công ty tối giản chuẩn corporate */}
                      <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm flex-shrink-0">
                        {job.logoText}
                      </div>

                      {/* Badges container mỏng nhẹ */}
                      <div className="flex flex-wrap items-center gap-1">
                        {job.badges.map((badge) => {
                          if (badge === 'HOT') {
                            return (
                              <span
                                key={badge}
                                className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded uppercase"
                              >
                                HOT
                              </span>
                            );
                          }
                          if (badge === 'GẤP') {
                            return (
                              <span
                                key={badge}
                                className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase"
                              >
                                GẤP
                              </span>
                            );
                          }
                          if (badge === 'TOP') {
                            return (
                              <span
                                key={badge}
                                className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase"
                              >
                                TOP
                              </span>
                            );
                          }
                          return (
                            <span
                              key={badge}
                              className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase"
                            >
                              PRO
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Nút Trái tim Bookmark mảnh */}
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

                  {/* Tiêu đề việc làm */}
                  <h3 className="font-bold text-slate-900 text-sm hover:text-blue-600 line-clamp-1 transition-colors mt-3 mb-0">
                    {job.title}
                  </h3>

                  {/* Tên công ty uppercase tracking-wide */}
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 uppercase tracking-wide font-medium mb-0">
                    {job.company}
                  </p>

                  {/* Hàng mức lương nhã nhặn */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100/80 inline-block">
                      {job.salaryText}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {job.postedTime}
                    </span>
                  </div>
                </div>

                {/* Hàng tag phụ và nút ứng tuyển ghost/outline */}
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

                  {/* Nút Ghost / Outline tinh tế */}
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

        {/* Bottom Banner Callout (Clean Light Style) */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-indigo-50 border border-blue-200/80 p-6 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 m-0">
              Bạn chưa tìm thấy cơ hội việc làm mong muốn?
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 m-0">
              Tải CV lên hệ thống để AI tự động so khớp và gợi ý công việc phù hợp nhất với kinh nghiệm của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/cv-builder')}
            className="shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            Tạo CV AI ngay
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedJobsGrid;
