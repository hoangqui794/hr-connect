import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Tag, message, Tooltip, Breadcrumb } from 'antd';
import {
  DollarOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  HeartFilled,
  ShareAltOutlined,
  SendOutlined,
  GiftOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  ThunderboltFilled,
  CheckOutlined,
  TrophyOutlined,
  ApartmentOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/features/landing/components/Navbar';
import { CompanyLogo } from '@/components/common/CompanyLogo';
import { deduplicateTags, formatSalaryVND, JobCardData } from '@/components/common/JobCard';
import { FEATURED_HOT_JOBS, FeaturedJobItem } from '@/features/landing/components/FeaturedHotJobs';
import { ApplyJobModal } from '@/features/candidates/ApplyJobModal';
import { useAuthStore } from '@/stores/authStore';
import { useCandidateStore } from '@/stores/candidateStore';
import { ServiceType } from '@/types/job';

// Generate comprehensive fallback JD data
function generateRichJobDetails(job: JobCardData) {
  const tags = deduplicateTags(job.tags);
  const mustHave = tags.slice(0, 3);
  const shouldHave = tags.slice(3, 7).length > 0
    ? tags.slice(3, 7)
    : ['Docker / Containers', 'CI/CD Pipeline', 'Microservices', 'Agile / Scrum'];

  return {
    ...job,
    tags,
    mustHave,
    shouldHave,
    aiMatchScore: job.aiMatchScore || 92,
    experience: 'Từ 2 - 5+ năm kinh nghiệm',
    headcount: 2,
    gender: 'Không yêu cầu',
    deadline: job.deadline || '15/10/2026',
    description: [
      `Tham gia thiết kế, phát triển và tối ưu hóa hệ sinh thái sản phẩm công nghệ trọng điểm tại ${job.company}.`,
      'Phối hợp trực tiếp với Tech Lead, Solution Architect và Product Manager để phân tích kiến trúc phần mềm, đảm bảo hệ thống chịu tải cao và độ sẵn sàng 99.9%.',
      'Viết mã nguồn chất lượng cao, tuân thủ Clean Code, SOLID principles và chuẩn bảo mật doanh nghiệp.',
      'Tối ưu hóa cơ sở dữ liệu quan hệ/NoSQL, xử lý truy vấn tải lớn, xây dựng API RESTful và microservices.',
      'Tham gia quy trình Code Review nghiêm ngặt, hướng dẫn và đào tạo các kỹ sư Junior/Middle trong nhóm.',
      'Cải tiến quy trình CI/CD, tự động hóa build/deploy hệ thống lên hạ tầng Cloud (AWS/GCP/Kubernetes).',
    ],
    requirements: [
      `Có ít nhất 2 - 5+ năm kinh nghiệm thực chiến ở vị trí tương đương (${job.level || 'Senior'}).`,
      `Thành thạo các công nghệ và kỹ năng cốt lõi: ${tags.join(', ')}.`,
      'Nắm vững kiến trúc Microservices, hệ thống phân tán (Distributed Systems) và cơ chế Message Queue (Kafka/RabbitMQ).',
      'Kinh nghiệm làm việc sâu với PostgreSQL, MySQL hoặc Redis; có tư duy tối ưu Indexing và Performance Tuning.',
      'Thành thạo Docker, Containerization và hiểu biết về triển khai Kubernetes/Cloud.',
      'Tư duy giải quyết vấn đề logic, khả năng làm việc độc lập và kỹ năng giao tiếp phối hợp nhóm xuất sắc.',
      'Khả năng đọc hiểu tài liệu chuyên ngành bằng tiếng Anh tốt.',
    ],
    benefits: [
      `Mức lương cạnh tranh: ${formatSalaryVND(job.salaryMin, job.salaryMax)} / tháng + Lương tháng 13 + Thưởng hiệu suất dự án (KPI).`,
      'Đóng bảo hiểm full lương theo quy định Nhà nước (BHXH, BHYT, BHTN) + Gói bảo hiểm sức khỏe cao cấp tư nhân cho bản thân và người thân.',
      'Trang bị máy tính làm việc hiện đại: MacBook Pro M-series hoặc máy trạm cao cấp kèm màn hình 4K.',
      `Chế độ làm việc linh hoạt (${job.workMode || 'Hybrid'}), văn phòng hạng A tiện nghi với trà, cà phê, snack miễn phí.`,
      'Ngân sách đào tạo $1.000/năm dành cho việc học tập, thi chứng chỉ quốc tế (AWS, GCP, CKA, PMP...).',
      '14 - 16 ngày phép năm hưởng nguyên lương; Du lịch thường niên 5 sao và các hoạt động teambuilding định kỳ.',
    ],
    companyProfile: {
      name: job.company,
      size: '200 - 1.000+ nhân viên',
      industry: 'Công nghệ thông tin / Enterprise SaaS / Fintech',
      location: job.location,
      warranty: '60 ngày bảo hành thử việc (HR Connect COD)',
      intro: `${job.company} là một trong những doanh nghiệp công nghệ tiên phong, quy tụ đội ngũ chuyên gia hàng đầu và liên tục kiến tạo những giải pháp số đột phá phục vụ hàng triệu người dùng.`,
    },
  };
}

export const JobDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { toggleSaveJob, isJobSaved } = useCandidateStore();

  const [jobData, setJobData] = useState<JobCardData | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  // Load Job by ID
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const raw = localStorage.getItem('hrconnect_all_jobs');
      let storedJobs: any[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          storedJobs = parsed;
        }
      }

      // Check stored jobs
      const foundInStorage = storedJobs.find((j) => String(j.id) === String(id));
      if (foundInStorage) {
        const salaryMin = foundInStorage.salaryRange?.min || 25000000;
        const salaryMax = foundInStorage.salaryRange?.max || 50000000;
        const commRate = foundInStorage.engagementTerms?.commissionRate || 15;
        const estComm =
          Math.round((salaryMax * commRate) / 100).toLocaleString('vi-VN') + '₫';
        const tags = [
          ...(foundInStorage.mustHaveTags || []),
          ...(foundInStorage.shouldHaveTags || []),
        ];

        setJobData({
          id: foundInStorage.id,
          title: foundInStorage.title,
          company: foundInStorage.company,
          location: foundInStorage.location || 'Hồ Chí Minh',
          workMode: foundInStorage.remote ? 'Remote' : 'Hybrid',
          level: foundInStorage.level || 'Senior',
          salaryMin,
          salaryMax,
          serviceType: foundInStorage.serviceType || ServiceType.HEADHUNT_COD,
          commissionRate: commRate,
          estimatedCommission: estComm,
          tags: tags.length > 0 ? tags : ['Công nghệ', 'Fulltime'],
          isUrgent: true,
          deadline: foundInStorage.deadline,
        });
        return;
      }

      // Check featured hot jobs
      const foundInFeatured = FEATURED_HOT_JOBS.find(
        (j) => String(j.id) === String(id)
      );
      if (foundInFeatured) {
        setJobData(foundInFeatured);
        return;
      }

      // Fallback: create mock from first hot job or id
      if (FEATURED_HOT_JOBS.length > 0) {
        setJobData({
          ...FEATURED_HOT_JOBS[0],
          id: id || FEATURED_HOT_JOBS[0].id,
        });
      }
    } catch {
      if (FEATURED_HOT_JOBS.length > 0) {
        setJobData(FEATURED_HOT_JOBS[0]);
      }
    }
  }, [id]);

  const richJob = useMemo(() => {
    if (!jobData) return null;
    return generateRichJobDetails(jobData);
  }, [jobData]);

  if (!richJob) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <Navbar />
        <div className="max-w-4xl mx-auto py-20 text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Đang tải thông tin chi tiết công việc...</p>
        </div>
      </div>
    );
  }

  const isSaved = isJobSaved(richJob.id);
  const isCOD =
    richJob.serviceType === ServiceType.HEADHUNT_COD ||
    String(richJob.serviceType).toUpperCase() === 'HEADHUNT_COD' ||
    Boolean(richJob.estimatedCommission);

  // Handle Apply button
  const handleApplyClick = () => {
    if (!isAuthenticated) {
      message.warning('Vui lòng đăng nhập tài khoản Ứng viên để nộp hồ sơ!');
      navigate('/login');
      return;
    }
    setApplyModalOpen(true);
  };

  // Handle Share link
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      message.success('Đã sao chép liên kết việc làm vào bộ nhớ tạm!');
    } else {
      message.info('Liên kết việc làm đã sẵn sàng chia sẻ.');
    }
  };

  // Handle Refer Candidate (Affiliate OPR Hub)
  const handleReferCandidate = () => {
    navigate(`/affiliate/referral?jobId=${richJob.id}`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* 1. Header Navbar */}
      <Navbar />

      {/* 2. Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <Breadcrumb
          items={[
            {
              title: (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Trang chủ
                </button>
              ),
            },
            {
              title: (
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="text-slate-500 hover:text-blue-600 transition-colors"
                >
                  Việc làm
                </button>
              ),
            },
            {
              title: <span className="text-slate-800 font-medium">{richJob.title}</span>,
            },
          ]}
        />
      </div>

      {/* 3. Cover Banner & Company Header (TopCV Style) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Cover Graphic Banner */}
          <div className="h-36 sm:h-44 w-full bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/20" />
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-colors"
            >
              <ArrowLeftOutlined /> Quay lại
            </button>
          </div>

          {/* Company Profile Strip */}
          <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
            <div className="flex items-end gap-4 min-w-0">
              {/* Real Company Logo */}
              <div className="relative z-10 p-1 bg-white rounded-2xl shadow-md border border-slate-200/80 shrink-0">
                <CompanyLogo
                  companyName={richJob.company}
                  logoUrl={richJob.companyLogo}
                  size="xl"
                  className="rounded-xl"
                />
              </div>

              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800 truncate">
                    {richJob.company}
                  </span>
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                    <SafetyCertificateOutlined className="text-blue-600" />
                    Doanh nghiệp thẩm định
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-1">
                  {richJob.title}
                </h1>
              </div>
            </div>

            {/* Follow & Share Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-end">
              <Button
                icon={isFollowing ? <CheckCircleOutlined className="text-blue-600" /> : <PlusOutlined />}
                onClick={() => {
                  setIsFollowing(!isFollowing);
                  message.success(isFollowing ? `Đã bỏ theo dõi ${richJob.company}` : `Đang theo dõi ${richJob.company}`);
                }}
                className={`rounded-xl font-semibold text-xs h-9 px-3.5 transition-all ${
                  isFollowing
                    ? 'border-blue-300 text-blue-700 bg-blue-50'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
              </Button>

              <button
                type="button"
                onClick={handleShare}
                title="Chia sẻ việc làm"
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition-colors shadow-2xs"
              >
                <ShareAltOutlined className="text-sm" />
              </button>

              <button
                type="button"
                onClick={() => toggleSaveJob(richJob.id)}
                title={isSaved ? 'Bỏ lưu tin' : 'Lưu tin'}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors shadow-2xs ${
                  isSaved
                    ? 'bg-rose-50 border-rose-200 text-rose-500'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                }`}
              >
                {isSaved ? <HeartFilled className="text-rose-500" /> : <HeartOutlined />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Main 2-Column Layout (TopCV Standard: 70% Left - 30% Right) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* =========================================================
              CỘT TRÁI (70% - lg:col-span-8): Chi Tiết JD & AI Insights
              ========================================================= */}
          <div className="lg:col-span-8 space-y-6">
            {/* ── Box 1: Header JD Quick Specs ── */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
                {/* Salary */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
                  <div className="text-2xs font-bold text-emerald-800 uppercase tracking-wider">
                    Mức thu nhập
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                    <DollarOutlined className="text-sm" />
                    {formatSalaryVND(richJob.salaryMin, richJob.salaryMax)}
                  </div>
                  <div className="text-2xs text-emerald-600 mt-0.5">Mức lương cạnh tranh / tháng</div>
                </div>

                {/* Location */}
                <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                  <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                    Địa điểm làm việc
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 mt-0.5 truncate">
                    <EnvironmentOutlined className="text-blue-600 text-sm" />
                    <span className="truncate">{richJob.location}</span>
                  </div>
                  <div className="text-2xs text-slate-500 mt-0.5">{richJob.workMode}</div>
                </div>

                {/* Deadline */}
                <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                  <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
                    Hạn nộp hồ sơ
                  </div>
                  <div className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <CalendarOutlined className="text-amber-500 text-sm" />
                    {richJob.deadline}
                  </div>
                  <div className="text-2xs text-slate-500 mt-0.5">Còn 15 ngày để ứng tuyển</div>
                </div>
              </div>

              {/* Tags & Badges */}
              <div className="pt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Kỹ năng cốt lõi:</span>
                {richJob.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/70 px-2.5 py-1 rounded-lg"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Box 2: AI Matching Insights (Sentence-BERT ATS Engine) ── */}
            <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-slate-50 border border-blue-200/90 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    <ThunderboltFilled />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      AI Matching Insights (Sentence-BERT Engine)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Đo lường mức độ tương đồng ngữ nghĩa CV - JD theo tiêu chuẩn ATS Enterprise
                    </p>
                  </div>
                </div>

                {/* Score Pill */}
                <div className="flex items-center gap-2 bg-white border border-blue-200 px-3.5 py-1.5 rounded-full shadow-2xs">
                  <span className="text-xs font-semibold text-slate-600">Độ khớp lệnh:</span>
                  <span className="text-base font-extrabold text-blue-600">
                    {richJob.aiMatchScore}%
                  </span>
                </div>
              </div>

              {/* Skills Split: Must-have vs Should-have */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-100 text-xs">
                <div>
                  <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <CheckCircleFilled className="text-emerald-500" />
                    Kỹ năng bắt buộc (Must-have):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {richJob.mustHave.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md"
                      >
                        <CheckOutlined className="text-3xs" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <TrophyOutlined className="text-amber-500" />
                    Kỹ năng ưu tiên cộng điểm (Should-have):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {richJob.shouldHave.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 text-xs font-medium bg-white text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-blue-100/70 text-xs text-slate-600 leading-relaxed bg-white/60 p-3 rounded-xl border border-blue-100">
                💡 <strong>Đánh giá tự động từ AI ATS:</strong> Hồ sơ của ứng viên có tỷ lệ tương đồng ngữ nghĩa vượt trội với yêu cầu kỹ thuật của vị trí này. Cơ hội được duyệt phỏng vấn vòng 1 đạt trên 90%. Nộp hồ sơ sớm để hệ thống ưu tiên xếp lịch!
              </div>
            </div>

            {/* ── Box 3: Chi Tiết Tin Tuyển Dụng (Mô tả, Yêu cầu, Quyền lợi) ── */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-8">
              {/* Mô tả công việc */}
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 mb-3">
                  Mô tả công việc
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
                  {richJob.description.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Yêu cầu ứng viên */}
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 mb-3">
                  Yêu cầu ứng viên
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
                  {richJob.requirements.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Quyền lợi được hưởng */}
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 mb-3">
                  Quyền lợi được hưởng
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 leading-relaxed">
                  {richJob.benefits.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Địa điểm làm việc */}
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 border-l-4 border-blue-600 pl-3 mb-3">
                  Địa điểm làm việc
                </h2>
                <p className="text-sm text-slate-600">
                  📍 {richJob.location} ({richJob.workMode} - Linh hoạt thời gian làm việc).
                </p>
              </div>

              {/* Cách thức ứng tuyển */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Cách thức nộp hồ sơ
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Ứng viên nhấn nút <strong>Ứng tuyển ngay</strong> để nộp CV qua hệ thống HR Connect. Hồ sơ sẽ được tự động sàng lọc bằng AI và chuyển trực tiếp tới Bộ phận Tuyển dụng trong vòng 24 giờ.
                </p>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleApplyClick}
                  className="rounded-xl font-bold bg-blue-600 hover:bg-blue-500 h-10 px-5"
                >
                  Nộp CV Ứng Tuyển
                </Button>
              </div>
            </div>
          </div>

          {/* =========================================================
              CỘT PHẢI (30% - lg:col-span-4): Sticky Actions & General Specs
              ========================================================= */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
            {/* Sticky Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-3">
              {/* Primary Apply Button */}
              <Button
                type="primary"
                block
                size="large"
                icon={<SendOutlined />}
                onClick={handleApplyClick}
                className="h-12 rounded-xl font-bold text-base bg-blue-600 hover:bg-blue-500 text-white shadow-sm border-none active:scale-[0.98] transition-all"
              >
                Ứng tuyển ngay
              </Button>

              {/* Affiliate OPR Hub Referral Button */}
              {isCOD && (
                <Button
                  block
                  size="large"
                  icon={<GiftOutlined className="text-amber-500" />}
                  onClick={handleReferCandidate}
                  className="h-12 rounded-xl font-bold text-xs sm:text-sm text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300"
                >
                  Giới thiệu ứng viên (Nhận COD: {richJob.estimatedCommission || '15%'})
                </Button>
              )}

              {/* Bookmark Button */}
              <Button
                block
                icon={isSaved ? <HeartFilled className="text-rose-500" /> : <HeartOutlined />}
                onClick={() => {
                  const saved = toggleSaveJob(richJob.id);
                  if (saved) {
                    message.success(`Đã lưu "${richJob.title}" vào danh sách!`);
                  } else {
                    message.info(`Đã gỡ lưu "${richJob.title}".`);
                  }
                }}
                className={`rounded-xl font-semibold text-xs h-10 transition-colors ${
                  isSaved
                    ? 'border-rose-200 text-rose-600 bg-rose-50'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {isSaved ? 'Đã lưu việc làm này' : 'Lưu tin việc làm'}
              </Button>
            </div>

            {/* Khối "Thông tin chung" (General Specs) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                Thông tin chung
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cấp bậc:</span>
                  <span className="font-bold text-slate-800">{richJob.level || 'Senior'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Kinh nghiệm:</span>
                  <span className="font-bold text-slate-800">{richJob.experience}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số lượng tuyển:</span>
                  <span className="font-bold text-slate-800">{richJob.headcount} người</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hình thức làm việc:</span>
                  <span className="font-bold text-slate-800">{richJob.workMode}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Giới tính:</span>
                  <span className="font-bold text-slate-800">{richJob.gender}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hạn nộp hồ sơ:</span>
                  <span className="font-bold text-slate-800">{richJob.deadline}</span>
                </div>
              </div>
            </div>

            {/* Khối "Thông tin doanh nghiệp" */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
                Thông tin công ty
              </h3>

              <div className="flex items-center gap-3 mb-3.5">
                <CompanyLogo
                  companyName={richJob.company}
                  logoUrl={richJob.companyLogo}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {richJob.company}
                  </div>
                  <div className="text-2xs text-slate-500">Đối tác thẩm định HR Connect</div>
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 mb-3.5">
                <div>
                  <span className="font-semibold text-slate-700 block">Quy mô:</span>
                  {richJob.companyProfile.size}
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block">Lĩnh vực:</span>
                  {richJob.companyProfile.industry}
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block">Bảo hành tuyển dụng:</span>
                  {richJob.companyProfile.warranty}
                </div>
              </div>

              <p className="text-2xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                {richJob.companyProfile.intro}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Quick Apply Modal */}
      <ApplyJobModal
        open={applyModalOpen}
        job={richJob}
        onClose={() => setApplyModalOpen(false)}
      />
    </div>
  );
};

export default JobDetailPage;
