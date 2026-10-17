/**
 * @file JobDetailPanel.tsx
 * @description Read-only view of one JobDto, shared by the Client list, the HR review
 * queue and job discovery. Shows exactly what the backend stores — nothing invented.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Descriptions, Drawer, Empty, Tag, Timeline, Typography } from 'antd';
import {
  AuditOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  BookOutlined,
  DollarCircleOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { Job, JobRequirement } from '@/types/api/jobs';
import { useAuthStore, UserRole } from '@/stores/authStore';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { SourcingDeliveriesView } from '@/features/sourcing/SourcingDeliveriesView';
import { PaymentDemoModal } from './PaymentDemoModal';
import { formatMoney, useJobFeeInfo, useJobTemplate } from './useJobQueries';
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_STATUS,
  REASON_CODE_LABEL,
  SERVICE_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatExperience,
  formatSalary,
  isAwaitingSourcingDeposit,
  sourcingDepositAmount,
} from './jobDisplay';

const { Paragraph, Text, Title } = Typography;

// Fixed colours (text on tinted bg ≥ 4.5:1) so the tag reads the same under every console theme.
const STATUS_TAG_CLASS: Record<Job['status'], string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  PENDING_REVIEW: 'border-sky-200 bg-sky-50 text-sky-800',
  PENDING_APPROVAL: 'border-sky-200 bg-sky-50 text-sky-800',
  PENDING_PAYMENT: 'border-blue-200 bg-blue-50 text-blue-800',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  PAUSED: 'border-amber-200 bg-amber-50 text-amber-800',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-600',
};

export const JobStatusTag: React.FC<{ status: Job['status'] }> = ({ status }) => (
  <Tag className={`m-0 border border-solid font-medium ${STATUS_TAG_CLASS[status]}`}>{JOB_STATUS[status].label}</Tag>
);

export const JobTemplateOriginTag: React.FC<{ templateId: string }> = ({ templateId }) => {
  const { data: template, isLoading } = useJobTemplate(templateId);
  const displayName = template?.name || template?.title || template?.code || (isLoading ? 'Đang tải...' : templateId);

  return (
    <Tag color="cyan" icon={<BookOutlined />} className="m-0 font-medium">
      Tạo từ mẫu: {displayName}
    </Tag>
  );
};

const RequirementList: React.FC<{ title: string; items: JobRequirement[]; emptyText: string }> = ({
  title,
  items,
  emptyText,
}) => (
  <section aria-label={title}>
    <Text strong className="block mb-2">
      {title}
    </Text>
    {items.length === 0 ? (
      <Text type="secondary">{emptyText}</Text>
    ) : (
      <ul className="m-0 pl-0 list-none space-y-1.5">
        {items.map((req) => (
          <li key={req.requirementId} className="flex gap-2 items-start">
            <CheckCircleOutlined className="text-emerald-700 mt-1 shrink-0" aria-hidden />
            <span>
              {req.content}
              {req.category && <Text type="secondary"> · {req.category}</Text>}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/** Multi-line backend text, rendered as plain paragraphs (never as HTML). */
const LongText: React.FC<{ value: string | null; emptyText: string }> = ({ value, emptyText }) =>
  value ? (
    <Paragraph className="whitespace-pre-line mb-0">{value}</Paragraph>
  ) : (
    <Text type="secondary">{emptyText}</Text>
  );

interface JobDetailPanelProps {
  job: Job;
  /** Status history is only useful to the owner and reviewers. */
  showHistory?: boolean;
  /** Whether the panel is rendered inside Internal HR review view. */
  isInternalReview?: boolean;
  onPaySuccess?: () => void;
  /** Whether the panel is rendered for an applicant (candidate or public visitor). */
  isApplicantView?: boolean;
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
  job,
  showHistory = false,
  isInternalReview = false,
  onPaySuccess,
  isApplicantView,
}) => {
  const navigate = useNavigate();
  const currentRole = useAuthStore((s) => s.role);
  const isApplicant = isApplicantView ?? (currentRole === UserRole.CANDIDATE || currentRole === UserRole.GUEST);
  const { isApplied, getApplication } = useCandidateAppliedJobs();
  const applied = isApplicant && isApplied(job.jobId);
  const appliedApp = applied ? getApplication(job.jobId) : undefined;

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSourcingDrawer, setShowSourcingDrawer] = useState(false);
  const feeInfo = useJobFeeInfo(isApplicant ? null : job);
  const awaitingDeposit = isAwaitingSourcingDeposit(job);
  const feeText = awaitingDeposit
    ? formatMoney(sourcingDepositAmount(job) ?? 0, 'VND')
    : formatMoney(feeInfo.amount, feeInfo.currencyCode);
  const mustHave = job.requirements.filter((r) => r.requirementType === 'MUST_HAVE');
  const shouldHave = job.requirements.filter((r) => r.requirementType === 'SHOULD_HAVE');
  const service = job.serviceTypeCode ? SERVICE_TYPE_LABEL[job.serviceTypeCode] : null;

  // Agreed terms (after approval) win; before approval show what the Client proposed.
  const agreed = job.commercialTerms ?? null;
  const proposed = job.proposedTerms ?? null;
  const termLabel = agreed ? 'Đã chốt' : 'Client đề xuất';
  const feeMultiplier = agreed?.feeMultiplier ?? proposed?.feeMultiplier ?? null;
  const warrantyDays = agreed?.warrantyDays ?? proposed?.warrantyDays ?? null;
  const paymentDueDays = agreed?.paymentDueDays ?? proposed?.paymentDueDays ?? null;

  const isExpired =
    (job.expiresAt && new Date(job.expiresAt) <= new Date()) ||
    (job.status === 'CLOSED' && Boolean(job.statusReason?.toLowerCase().includes('hết hạn')));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatusTag status={job.status} />
          {/* F4: Hiện nguồn mẫu ở trang duyệt job — chỉ hiển thị với Internal HR / Admin ở trang duyệt, Client và ứng viên không thấy */}
          {(isInternalReview || currentRole === UserRole.INTERNAL_HR || currentRole === UserRole.ADMIN) &&
            !isApplicant &&
            job.templateId && <JobTemplateOriginTag templateId={job.templateId} />}
          {applied && (
            <Tag color="success" icon={<CheckCircleOutlined />} className="m-0 font-medium">
              Đã ứng tuyển
            </Tag>
          )}
          {service && !isApplicant && <Tag className="m-0 font-medium">{service.label}</Tag>}
          {!isApplicant && job.status === 'PENDING_PAYMENT' && (
            <Tag color="warning" className="m-0 font-medium">
              {awaitingDeposit ? 'Chờ đặt cọc CV Sourcing' : 'Chờ thanh toán phí đăng tin'}
            </Tag>
          )}
          {!isApplicant && job.postingFeeStatus === 'PAID' && (
            <Tag color="success" className="m-0 font-medium">
              Đã thanh toán phí
            </Tag>
          )}
        </div>
        <Title level={4} className="!mb-0">
          {job.title || 'Vị trí chưa đặt tên'}
        </Title>
        <Text type="secondary">{job.companyName ?? '—'}</Text>
        {!isApplicant && job.status === 'REJECTED' && job.statusReason && (
          <div role="note" className="rounded-lg border border-solid border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <Text strong className="text-red-800">
              Lý do từ chối:{' '}
            </Text>
            {job.statusReason}
          </div>
        )}

        {/* Thông báo chờ thanh toán phí đăng tin - CHỈ hiển thị khi đã được duyệt và cho Client/HR */}
        {!isApplicant && job.status === 'PENDING_PAYMENT' && (
          <Alert
            type={isInternalReview ? 'info' : 'warning'}
            showIcon
            message={
              awaitingDeposit
                ? isInternalReview
                  ? `Đang chờ Doanh nghiệp đặt cọc CV Sourcing (${feeText})`
                  : `Tin đã được duyệt · Chờ đặt cọc CV Sourcing (${feeText})`
                : isInternalReview
                  ? `Đang chờ Doanh nghiệp thanh toán (${feeText})`
                  : `Tin đã được duyệt · Chờ thanh toán phí đăng tin (${feeText})`
            }
            description={
              awaitingDeposit
                ? 'Tin CV Sourcing chỉ được công bố cho Affiliate sau khi HR Connect nhận tiền cọc. Platform Admin ghi nhận khoản cọc ở trang Tài chính; tin tự chuyển sang Đang tuyển ngay sau đó.'
                : isInternalReview
                  ? 'Nội dung tin tuyển dụng đã đạt yêu cầu. Đã gửi thông báo yêu cầu thanh toán tới Doanh nghiệp. Tin sẽ tự động công khai ngay sau khi nhận được thanh toán.'
                  : `Quý khách vui lòng hoàn tất thanh toán ${feeText} để tin tuyển dụng được công khai trên hệ thống và bắt đầu nhận hồ sơ ứng viên (kèm AI chấm điểm CV).`
            }
            action={
              !isInternalReview && !awaitingDeposit ? (
                <Button
                  type="primary"
                  size="small"
                  icon={<CreditCardOutlined />}
                  onClick={() => setShowPaymentModal(true)}
                >
                  Thanh toán ngay
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Thông báo khi đóng tin do đủ hồ sơ hoặc lý do khác */}
        {job.status === 'CLOSED' && job.statusReason && !isExpired && (
          <Alert
            type="info"
            showIcon
            message="Tin tuyển dụng đã đóng"
            description={job.statusReason}
          />
        )}

        {/* Thông báo khi hết hạn hiển thị */}
        {isExpired && (
          <Alert
            type={isApplicant ? 'warning' : 'info'}
            showIcon
            message={isApplicant ? 'Tin tuyển dụng đã hết hạn tiếp nhận hồ sơ' : 'Tin tuyển dụng đã hết hạn hiển thị'}
            description={
              isApplicant
                ? 'Vị trí này hiện đã dừng tiếp nhận hồ sơ ứng tuyển mới.'
                : 'Thời hạn hiển thị của tin đã kết thúc theo quy định của gói. Quý khách có thể đăng tin mới để tiếp tục tuyển dụng.'
            }
            action={
              !isApplicant ? (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/client/jobs/create')}
                >
                  Đăng tin mới
                </Button>
              ) : undefined
            }
          />
        )}

        {applied && (
          <div className="rounded-xl border border-solid border-emerald-200 bg-emerald-50/80 p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-xs text-emerald-900">
              <CheckCircleOutlined className="text-emerald-600 text-base shrink-0" />
              <div>
                <span className="font-semibold text-sm block text-emerald-950">Bạn đã ứng tuyển vào vị trí này</span>
                <span className="text-emerald-800">
                  Hồ sơ ứng tuyển đã được ghi nhận trên hệ thống
                  {appliedApp?.appliedAt ? ` vào ngày ${formatDateTime(appliedApp.appliedAt)}` : ''}.
                </span>
              </div>
            </div>
            {appliedApp?.applicationId && (
              <Button
                type="primary"
                size="small"
                className="!bg-emerald-600 hover:!bg-emerald-500 !border-emerald-600 font-medium text-xs shadow-2xs"
                onClick={() => navigate(`/candidate/applications/${appliedApp.applicationId}`)}
              >
                Xem chi tiết đơn
              </Button>
            )}
          </div>
        )}
      </header>

      <Descriptions size="small" column={{ xs: 1, sm: 2 }} colon={false} labelStyle={{ color: '#475569' }}>
        <Descriptions.Item label="Mức lương">{formatSalary(job)}</Descriptions.Item>
        <Descriptions.Item label="Kinh nghiệm">
          {formatExperience(job.minExperienceYears, job.maxExperienceYears)}
        </Descriptions.Item>
        <Descriptions.Item label="Hình thức">
          {job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Số lượng">
          <TeamOutlined aria-hidden className="mr-1" />
          {job.quantity} người
        </Descriptions.Item>
        <Descriptions.Item label="Địa điểm">
          <EnvironmentOutlined aria-hidden className="mr-1" />
          {job.location ?? '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Thời gian làm việc">{job.workingTime ?? '—'}</Descriptions.Item>
        {job.salaryNote && <Descriptions.Item label="Ghi chú lương">{job.salaryNote}</Descriptions.Item>}
        <Descriptions.Item label="Ngày đăng">{formatDate(job.postedAt)}</Descriptions.Item>
        {!isApplicant && job.postingPackageName && (
          <Descriptions.Item label="Gói đăng tin">{job.postingPackageName}</Descriptions.Item>
        )}
        {!isApplicant && job.maxApplications && (
          <Descriptions.Item label="Hạn mức hồ sơ">Tối đa {job.maxApplications} hồ sơ hợp lệ</Descriptions.Item>
        )}
        {job.expiresAt && (
          <Descriptions.Item label={isApplicant ? 'Hạn nộp hồ sơ' : 'Hạn hiển thị'}>
            <span className={isExpired ? 'text-red-600 font-semibold' : ''}>
              {formatDateTime(job.expiresAt)} {isExpired ? '(Đã hết hạn)' : ''}
            </span>
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* ── Thông tin dịch vụ & Phí đăng tin (CHỈ hiển thị cho Doanh nghiệp & Quản trị/HR, KHÔNG hiển thị cho Ứng viên) ── */}
      {!isApplicant && job.serviceTypeCode === 'CV_APPLICATION' && (
        <section aria-label="Gói dịch vụ tuyển dụng" className="rounded-xl border border-solid border-slate-200/90 bg-slate-50/60 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-slate-200/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <AuditOutlined className="text-sm" />
              </span>
              <div>
                <span className="font-bold text-slate-800 text-sm">{feeInfo.packageName ?? 'Gói đăng tin'}</span>
                <span className="text-xs text-slate-500 ml-2">Đăng tin trực tiếp & tiếp nhận hồ sơ</span>
              </div>
            </div>
            <Tag color="blue" className="m-0 font-medium rounded-full px-2.5">
              {feeInfo.durationDays ? `${feeInfo.durationDays} ngày hiển thị` : 'Đăng tin'}
            </Tag>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <DollarCircleOutlined className="text-indigo-500" /> Phí dịch vụ
              </div>
              <div className="font-bold text-slate-900 text-[13px] mt-1 text-indigo-700">
                {feeText}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <CalendarOutlined className="text-slate-500" /> Thời hạn tin
              </div>
              <div className="font-bold text-slate-800 text-[13px] mt-1">{feeInfo.durationDays ? `${feeInfo.durationDays} ngày` : '—'}</div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <TeamOutlined className="text-emerald-500" /> Hạn mức nhận hồ sơ
              </div>
              <div className="font-bold text-emerald-700 text-[13px] mt-1">
                {feeInfo.maxApplications ? `Tối đa ${feeInfo.maxApplications} hồ sơ` : 'Không giới hạn'}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <ThunderboltOutlined className="text-sky-500" /> Đánh giá ứng viên
              </div>
              <div className="font-bold text-sky-700 text-[13px] mt-1">AI hỗ trợ chấm điểm</div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600 border border-solid border-slate-200/70">
            <InfoCircleOutlined className="text-blue-500 shrink-0 text-sm" />
            <span>
              Tin tuyển dụng sẽ được tự động kích hoạt công khai và mở nhận hồ sơ ngay khi Doanh nghiệp hoàn tất thanh toán phí.
            </span>
          </div>
        </section>
      )}

      {/* ── Thông tin dịch vụ HEADHUNT (CHỈ hiển thị cho Doanh nghiệp & Quản trị/HR, KHÔNG hiển thị cho Ứng viên) ── */}
      {!isApplicant && job.serviceTypeCode === 'HEADHUNT_COD' && (
        <section aria-label="Điều khoản dịch vụ Headhunt" className="rounded-xl border border-solid border-indigo-200/90 bg-indigo-50/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-indigo-200/70 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <SafetyCertificateOutlined className="text-sm" />
              </span>
              <div>
                <span className="font-bold text-indigo-950 text-sm">Dịch Vụ Headhunt — Thỏa Thuận Riêng</span>
                <span className="text-xs text-indigo-700/80 ml-2">Phí tuyển dụng thành công</span>
              </div>
            </div>
            <Tag color="purple" className="m-0 font-medium rounded-full px-2.5">
              {termLabel}
            </Tag>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <DollarCircleOutlined className="text-indigo-500" /> Phí thành công (Success Fee)
              </div>
              <div className="font-bold text-indigo-700 text-[13px] mt-1">
                {feeMultiplier != null ? `${feeMultiplier}× tháng lương` : 'Chờ Internal HR chốt'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Chỉ trả khi ứng viên đi làm</div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <SafetyCertificateOutlined className="text-emerald-500" /> Bảo hành thay thế
              </div>
              <div className="font-bold text-emerald-700 text-[13px] mt-1">
                {warrantyDays != null ? `${warrantyDays} ngày` : 'Chờ Internal HR chốt'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tìm ứng viên thay thế miễn phí</div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-solid border-slate-200/80 shadow-2xs">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <CalendarOutlined className="text-blue-500" /> Hạn thanh toán
              </div>
              <div className="font-bold text-slate-800 text-[13px] mt-1">
                {paymentDueDays != null ? `${paymentDueDays} ngày` : 'Chờ Internal HR chốt'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Kể từ ngày bắt đầu đi làm</div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600 border border-solid border-indigo-100">
            <InfoCircleOutlined className="text-indigo-500 shrink-0 text-sm" />
            <span>
              Phí phát sinh khi ứng viên chính thức đi làm. Áp dụng chính sách bảo hành thay thế ứng viên trong thời hạn đã thỏa thuận theo hợp đồng.
            </span>
          </div>
        </section>
      )}

      {!isApplicant && job.serviceTypeCode === 'CV_SOURCING' && (
        <section aria-label="Điều khoản CV Sourcing" className="rounded-xl border border-solid border-teal-200/90 bg-teal-50/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-teal-200/70 pb-2.5">
            <span className="font-bold text-teal-950 text-sm">Dịch vụ CV Sourcing — trả theo số CV được chấp nhận</span>
            <div className="flex items-center gap-2">
              <Tag color={agreed ? 'success' : 'default'} className="m-0 font-medium rounded-full px-2.5">
                {termLabel}
              </Tag>
              <Button
                size="small"
                type="primary"
                className="!bg-teal-700 hover:!bg-teal-600 !border-teal-700 text-xs font-semibold"
                onClick={() => {
                  if (isInternalReview) {
                    setShowSourcingDrawer(true);
                  } else {
                    navigate(`/client/jobs/${job.jobId}/sourcing`);
                  }
                }}
              >
                {isInternalReview ? 'Quản lý CV đã giao' : 'Xem hồ sơ nhận được'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: 'Số CV giao', value: agreed?.sourcingTarget ?? job.sourcingTarget, unit: 'CV' },
              { label: 'Giá mỗi CV', value: agreed?.pricePerCv ?? proposed?.pricePerCv, unit: 'đ' },
              { label: 'Tiền cọc', value: agreed?.depositPercent, unit: '%' },
              { label: 'Thời gian duyệt CV', value: agreed?.reviewDays, unit: 'ngày' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white p-3 border border-solid border-slate-200/80">
                <div className="text-[11px] text-slate-600">{item.label}</div>
                <div className="font-bold text-slate-900 text-[13px] mt-1">
                  {item.value != null
                    ? `${item.unit === 'đ' ? Number(item.value).toLocaleString('vi-VN') : item.value} ${item.unit}`
                    : 'Chờ Internal HR chốt'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isApplicant && agreed && (agreed.agreedAt || agreed.agreementReference) && (
        <div className="rounded-lg border border-solid border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          Điều khoản chốt {agreed.agreedAt ? `ngày ${formatDateTime(agreed.agreedAt)}` : ''}
          {agreed.agreementReference ? ` · Căn cứ: ${agreed.agreementReference}` : ''}
        </div>
      )}

      <section aria-label="Mô tả công việc">
        <Text strong className="block mb-2">
          Mô tả công việc
        </Text>
        <LongText value={job.description} emptyText="Chưa có mô tả." />
      </section>

      <RequirementList title="Yêu cầu bắt buộc" items={mustHave} emptyText="Chưa có yêu cầu bắt buộc." />
      <RequirementList title="Yêu cầu ưu tiên" items={shouldHave} emptyText="Không có yêu cầu ưu tiên." />

      {job.skills.length > 0 && (
        <section aria-label="Kỹ năng">
          <Text strong className="block mb-2">
            Kỹ năng
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {job.skills.map((s) => (
              <Tag key={s.skillId} color={s.isMandatory ? 'green' : undefined} className="m-0">
                {s.skillName ?? s.skillId}
                {s.isMandatory ? ' · bắt buộc' : ''}
              </Tag>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Quyền lợi">
        <Text strong className="block mb-2">
          Quyền lợi
        </Text>
        <LongText value={job.benefits} emptyText="Chưa cập nhật quyền lợi." />
      </section>

      {showHistory && (
        <section aria-label="Lịch sử trạng thái">
          <Text strong className="block mb-3">
            Lịch sử trạng thái
          </Text>
          {job.statusHistories.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có lịch sử." />
          ) : (
            <Timeline
              items={job.statusHistories.map((h) => ({
                dot: <ClockCircleOutlined aria-hidden />,
                children: (
                  <div>
                    <Text strong>{JOB_STATUS[h.newStatus]?.label ?? h.newStatus}</Text>
                    <Text type="secondary"> · {formatDateTime(h.changedAt)}</Text>
                    {(h.reasonCode || h.reasonText) && (
                      <div className="text-sm text-slate-600">
                        {h.reasonCode ? REASON_CODE_LABEL[h.reasonCode] ?? h.reasonCode : ''}
                        {h.reasonText ? `${h.reasonCode ? ': ' : ''}${h.reasonText}` : ''}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </section>
      )}

      <PaymentDemoModal
        visible={showPaymentModal}
        jobId={job.jobId}
        jobTitle={job.title}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={() => {
          setShowPaymentModal(false);
          onPaySuccess?.();
        }}
      />

      <Drawer
        open={showSourcingDrawer}
        width="min(800px, 100vw)"
        onClose={() => setShowSourcingDrawer(false)}
        title={`CV Sourcing · ${job.title}`}
        destroyOnClose
      >
        <SourcingDeliveriesView
          jobId={job.jobId}
          jobTitle={job.title}
          role={isInternalReview ? 'hr' : 'client'}
        />
      </Drawer>
    </div>
  );
};

export default JobDetailPanel;
