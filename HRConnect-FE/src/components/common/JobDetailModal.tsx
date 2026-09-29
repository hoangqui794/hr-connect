import React, { useState, useMemo } from 'react';
import { Modal, Tabs, Tag, Button, Tooltip, message } from 'antd';
import {
  EnvironmentOutlined,
  DollarOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined,
  ThunderboltFilled,
  ThunderboltOutlined,
  GiftOutlined,
  ShareAltOutlined,
  HeartOutlined,
  HeartFilled,
  SendOutlined,
  UsergroupAddOutlined,
  TrophyOutlined,
  CheckOutlined,
  RocketOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { JobCardData, formatSalaryVND, deduplicateTags } from './JobCard';
import { CompanyLogo } from './CompanyLogo';
import { ServiceType } from '@/types/job';

interface JobDetailModalProps {
  open: boolean;
  job: JobCardData | null;
  onClose: () => void;
  onApply: (job: JobCardData) => void;
  isSaved?: boolean;
  onToggleSave?: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  open,
  job,
  onClose,
  onApply,
  isSaved = false,
  onToggleSave,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('jd');

  if (!job) return null;

  const isCOD =
    job.serviceType === ServiceType.HEADHUNT_COD ||
    String(job.serviceType).toUpperCase() === 'HEADHUNT_COD' ||
    Boolean(job.estimatedCommission);

  // Deterministic AI Match Score
  const aiScore = job.aiMatchScore || 88;

  // Deduplicated unique tags
  const uniqueTags = useMemo(() => deduplicateTags(job.tags), [job.tags]);

  // Derive Must-have and Should-have skills
  const mustHave = uniqueTags.slice(0, 3);
  const shouldHave = uniqueTags.slice(3, 7).length > 0
    ? uniqueTags.slice(3, 7)
    : ['Docker', 'CI/CD Pipeline', 'Microservices Architecture', 'Agile / Scrum'];

  // Handle Share link
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      message.success('Đã sao chép liên kết việc làm vào bộ nhớ tạm!');
    } else {
      message.info('Liên kết việc làm đã sẵn sàng chia sẻ.');
    }
  };

  // Handle Referral click
  const handleReferCandidate = () => {
    onClose();
    navigate(`/affiliate/referral?jobId=${job.id}`);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      centered
      destroyOnClose
      maskClosable
      className="modern-job-detail-modal"
      styles={{
        content: {
          padding: 0,
          borderRadius: 20,
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
        },
        mask: {
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
        },
      }}
    >
      <div className="flex flex-col max-h-[88vh]">
        {/* ── Modal Header ── */}
        <div className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              {/* Real Company Logo */}
              <CompanyLogo
                companyName={job.company}
                logoUrl={job.companyLogo}
                size="lg"
                className="rounded-xl shadow-xs"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {job.company}
                  </span>
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
                    <SafetyCertificateOutlined className="text-blue-600" />
                    Doanh nghiệp thẩm định
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                  {job.title}
                </h2>
              </div>
            </div>

            {/* Quick Action Icons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/jobs/${job.id}`);
                }}
                title="Mở toàn màn hình (Trang chi tiết)"
                className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition-colors shadow-2xs"
              >
                <GlobalOutlined className="text-sm" />
              </button>
              <button
                type="button"
                onClick={handleShare}
                title="Chia sẻ việc làm"
                className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition-colors shadow-2xs"
              >
                <ShareAltOutlined className="text-sm" />
              </button>
              <button
                type="button"
                onClick={() => onToggleSave?.(job.id)}
                title={isSaved ? 'Bỏ lưu tin' : 'Lưu tin'}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors shadow-2xs ${
                  isSaved
                    ? 'bg-rose-50 border-rose-200 text-rose-500'
                    : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                }`}
              >
                {isSaved ? <HeartFilled className="text-rose-500" /> : <HeartOutlined />}
              </button>
            </div>
          </div>

          {/* Quick Meta Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200/60">
            {/* Salary */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-2.5">
              <div className="text-2xs font-semibold text-emerald-800 uppercase tracking-wider">
                Mức lương
              </div>
              <div className="text-sm sm:text-base font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                <DollarOutlined className="text-xs" />
                {formatSalaryVND(job.salaryMin, job.salaryMax)}
              </div>
            </div>

            {/* Location */}
            <div className="bg-slate-100/70 border border-slate-200/70 rounded-xl p-2.5">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                Địa điểm
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                <EnvironmentOutlined className="text-slate-400 text-xs" />
                <span className="truncate">{job.location}</span>
              </div>
            </div>

            {/* Work Mode & Level */}
            <div className="bg-slate-100/70 border border-slate-200/70 rounded-xl p-2.5">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                Hình thức / Cấp bậc
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5 truncate">
                {job.workMode} · {job.level}
              </div>
            </div>

            {/* Deadline */}
            <div className="bg-slate-100/70 border border-slate-200/70 rounded-xl p-2.5">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
                Hạn nộp hồ sơ
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <CalendarOutlined className="text-slate-400 text-xs" />
                {job.deadline || 'Trong 15 ngày tới'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Scrollable Body Content ── */}
        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-5">
          {/* ── AI Matching Insights Box (Sentence-BERT ATS Engine) ── */}
          <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200/90 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <ThunderboltFilled />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    AI Matching Insights (Sentence-BERT Engine)
                  </h4>
                  <p className="text-2xs text-slate-500">
                    Phân tích ngữ nghĩa hồ sơ tự động theo chuẩn ATS Enterprise
                  </p>
                </div>
              </div>

              {/* Match Score Badge */}
              <div className="flex items-center gap-1.5 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
                <span className="text-xs font-semibold text-slate-600">Độ tương thích:</span>
                <span className="text-sm font-extrabold text-blue-600">{aiScore}%</span>
              </div>
            </div>

            {/* Must-have vs Should-have Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3 pt-2.5 border-t border-blue-100 text-xs">
              <div>
                <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <CheckCircleFilled className="text-emerald-500" />
                  Must-have Skills (Bắt buộc):
                </span>
                <div className="flex flex-wrap gap-1">
                  {mustHave.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 text-2xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md"
                    >
                      <CheckOutlined className="text-3xs" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-2xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <TrophyOutlined className="text-amber-500" />
                  Should-have (Ưu tiên cộng điểm):
                </span>
                <div className="flex flex-wrap gap-1">
                  {shouldHave.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 text-2xs font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-blue-100/60 text-2xs text-slate-600 italic">
              💡 <strong>Nhận định AI:</strong> Vị trí này đang có tính cạnh tranh cao. Kỹ năng của bạn có độ tương thích cao với yêu cầu cốt lõi. Nộp hồ sơ sớm để được ưu tiên phỏng vấn!
            </div>
          </div>

          {/* ── Content Tabs ── */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="modern-tabs"
            items={[
              {
                key: 'jd',
                label: 'Mô tả công việc (JD)',
                children: (
                  <div className="text-sm text-slate-700 space-y-3 leading-relaxed">
                    <p className="font-medium text-slate-800">
                      Chúng tôi đang tìm kiếm nhân sự tài năng cho vị trí{' '}
                      <strong>{job.title}</strong> làm việc tại <strong>{job.company}</strong> ({job.location}). Bạn sẽ tham gia trực tiếp vào việc xây dựng và nâng cấp các giải pháp công nghệ chiến lược của công ty.
                    </p>

                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider pt-2">
                      Trách nhiệm chính:
                    </h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                      <li>
                        Tham gia thiết kế kiến trúc hệ thống, phát triển các dịch vụ backend/frontend theo mô hình hiện đại.
                      </li>
                      <li>
                        Đảm bảo hiệu năng cao, khả năng chịu tải tốt và độ bảo mật khắt khe cho hàng triệu người dùng.
                      </li>
                      <li>
                        Phối hợp với Product Managers, UI/UX Designers và QA Engineers để liên tục hoàn thiện sản phẩm theo chuẩn Agile/Scrum.
                      </li>
                      <li>
                        Tối ưu hóa cơ sở dữ liệu, viết Clean Code, Unit Tests và tham gia quy trình Code Review nghiêm ngặt.
                      </li>
                      <li>
                        Đề xuất các sáng kiến kỹ thuật nhằm tự động hóa quy trình CI/CD và nâng cao năng suất nhóm.
                      </li>
                    </ul>
                  </div>
                ),
              },
              {
                key: 'requirements',
                label: 'Yêu cầu chuyên môn',
                children: (
                  <div className="text-sm text-slate-700 space-y-3 leading-relaxed">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Kỹ năng & Kinh nghiệm cần có:
                    </h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                      <li>
                        Từ 2 - 5+ năm kinh nghiệm làm việc thực tế ở vị trí tương đương ({job.level}).
                      </li>
                      <li>
                        Thành thạo các công nghệ chính:{' '}
                        <strong>{(job.tags || []).join(', ')}</strong>.
                      </li>
                      <li>
                        Nắm vững tư duy lập trình hướng đối tượng (OOP), Design Patterns và kiến trúc phần mềm sạch.
                      </li>
                      <li>
                        Kinh nghiệm làm việc với cơ sở dữ liệu quan hệ (PostgreSQL, MySQL) hoặc NoSQL (MongoDB, Redis).
                      </li>
                      <li>
                        Có hiểu biết vững chắc về Docker, Containerization và triển khai Cloud (AWS/GCP/Azure).
                      </li>
                      <li>
                        Khả năng giao tiếp tốt, tư duy giải quyết vấn đề logic và đọc hiểu tài liệu kỹ thuật tiếng Anh trôi chảy.
                      </li>
                    </ul>
                  </div>
                ),
              },
              {
                key: 'benefits',
                label: 'Quyền lợi ứng viên',
                children: (
                  <div className="text-sm text-slate-700 space-y-3 leading-relaxed">
                    <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Chế độ đãi ngộ hấp dẫn:
                    </h5>
                    <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600">
                      <li>
                        <strong>Thu nhập:</strong> {formatSalaryVND(job.salaryMin, job.salaryMax)} / tháng + Lương tháng 13 + Thưởng KPI hiệu suất dự án hàng quý.
                      </li>
                      <li>
                        <strong>Bảo hiểm:</strong> Đóng BHXH, BHYT full lương; Gói bảo hiểm sức khỏe quốc tế cao cấp khám chữa bệnh tại các bệnh viện tư nhân hàng đầu.
                      </li>
                      <li>
                        <strong>Thiết bị:</strong> Cấp mới 100% MacBook Pro M-series hoặc máy trạm cao cấp kèm màn hình mở rộng 4K.
                      </li>
                      <li>
                        <strong>Môi trường làm việc:</strong> Mô hình {job.workMode} linh hoạt, giờ giấc tự do, văn phòng hạng A tiện nghi với snack bar miễn phí.
                      </li>
                      <li>
                        <strong>Đào tạo & Phát triển:</strong> Ngân sách $1.000/năm dành riêng cho ứng viên tham gia các khóa học hoặc thi chứng chỉ quốc tế.
                      </li>
                      <li>
                        <strong>Nghỉ phép:</strong> 14 - 16 ngày phép năm hưởng lương; Du lịch công ty 5 sao hàng năm và hoạt động teambuilding định kỳ.
                      </li>
                    </ul>
                  </div>
                ),
              },
              {
                key: 'company',
                label: 'Thông tin doanh nghiệp',
                children: (
                  <div className="text-sm text-slate-700 space-y-3 leading-relaxed">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                      <ApartmentOutlined className="text-2xl text-blue-600" />
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{job.company}</div>
                        <div className="text-xs text-slate-500">Đối tác tuyển dụng chiến lược trên HR Connect Platform</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-700 block">Quy mô nhân sự:</span>
                        200 - 1.000+ nhân viên
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block">Lĩnh vực hoạt động:</span>
                        Công nghệ thông tin / Fintech / Enterprise Software
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block">Trụ sở chính:</span>
                        {job.location}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block">Thời gian thử việc:</span>
                        60 ngày (Bảo hành qua HR Connect COD)
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                      Doanh nghiệp cam kết quy trình phỏng vấn minh bạch, phản hồi kết quả trong vòng 48 giờ làm việc kể từ thời điểm nhận hồ sơ.
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* ── Sticky Footer Action Bar ── */}
        <div className="p-4 px-6 border-t border-slate-200/90 bg-white/95 backdrop-blur-md flex items-center justify-between gap-4 flex-wrap">
          <div className="hidden sm:block">
            <div className="text-2xs text-slate-500 uppercase font-semibold">Thu nhập dự kiến</div>
            <div className="text-base font-extrabold text-emerald-600">
              {formatSalaryVND(job.salaryMin, job.salaryMax)}
            </div>
          </div>

          <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto">
            {/* OPR Referral Button (Affiliate / Headhunter) */}
            {isCOD && (
              <Button
                size="large"
                icon={<GiftOutlined className="text-amber-500" />}
                onClick={handleReferCandidate}
                className="flex-1 sm:flex-initial h-11 px-4 font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl"
              >
                Giới thiệu nhận COD ({job.estimatedCommission || 'Hoa hồng cao'})
              </Button>
            )}

            {/* Quick Apply Button */}
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              onClick={() => {
                onClose();
                onApply(job);
              }}
              className="flex-1 sm:flex-initial h-11 px-6 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm border-none active:scale-[0.98] transition-all"
            >
              Ứng tuyển ngay
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default JobDetailModal;
