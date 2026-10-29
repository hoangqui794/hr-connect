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
  BankOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  BookOutlined,
  DollarCircleOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { Job, JobRequirement, PublicJobCompany } from '@/types/api/jobs';
import { useAuthStore, UserRole } from '@/stores/authStore';
import { useCandidateAppliedJobs } from '@/features/portal/candidate/useCandidateAppliedJobs';
import { SourcingDeliveriesView } from '@/features/sourcing/SourcingDeliveriesView';
import { PaymentDemoModal } from './PaymentDemoModal';
import { renderFormattedMultilineText } from './RichTextEditor';
import { formatMoney, useCurrentServiceAgreement, useJobFeeInfo, useJobTemplate } from './useJobQueries';
import {
  EMPLOYMENT_TYPE_LABEL,
  JOB_STATUS,
  REASON_CODE_LABEL,
  SERVICE_TYPE_LABEL,
  formatDate,
  formatDateTime,
  formatExperience,
  formatMultilineText,
  formatPostingPackage,
  formatSalary,
  formatHeadcount,
  isAwaitingSourcingDeposit,
  sourcingDepositAmount,
} from './jobDisplay';

const { Paragraph, Text, Title } = Typography;

// Standardized SaaS status tags: ACTIVE (emerald), PENDING_REVIEW (amber), CLOSED (slate)
const STATUS_TAG_CLASS: Record<Job['status'], string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  PENDING_REVIEW: 'border-amber-200 bg-amber-50 text-amber-700',
  PENDING_APPROVAL: 'border-amber-200 bg-amber-50 text-amber-700',
  PENDING_AGREEMENT: 'border-purple-200 bg-purple-50 text-purple-700',
  PENDING_PAYMENT: 'border-blue-200 bg-blue-50 text-blue-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PAUSED: 'border-amber-200 bg-amber-50 text-amber-700',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-600',
};

export const JobStatusTag: React.FC<{
  status: Job['status'];
  hasSignedAgreement?: boolean;
  isChangeRequested?: boolean;
}> = ({
  status,
  hasSignedAgreement,
  isChangeRequested,
}) => {
  if (status === 'PENDING_AGREEMENT' && isChangeRequested) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border border-solid border-amber-300 bg-amber-50 text-amber-800">
        DN yêu cầu sửa
      </span>
    );
  }

  if (status === 'PENDING_AGREEMENT' && hasSignedAgreement) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border border-solid border-teal-200 bg-teal-50 text-teal-700">
        Đã nộp bản ký - Chờ HR duyệt
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border border-solid ${STATUS_TAG_CLASS[status]}`}>
      {JOB_STATUS[status]?.label || status}
    </span>
  );
};

export const JobTemplateOriginTag: React.FC<{ templateId: string }> = ({ templateId }) => {
  const { data: template, isLoading } = useJobTemplate(templateId);
  const displayName = template?.name || template?.title || template?.code || (isLoading ? 'Đang tải...' : templateId);

  return (
    <Tag color="cyan" icon={<BookOutlined />} className="m-0 font-medium">
      Tạo từ mẫu: {displayName}
    </Tag>
  );
};

const requirementCategoryLabel = (category?: string | null) => {
  const labels: Record<string, string> = {
    EXPERIENCE: 'Kinh nghiệm',
    SKILL: 'Kỹ năng',
    EDUCATION: 'Học vấn',
    LANGUAGE: 'Ngoại ngữ',
    CERTIFICATE: 'Chứng chỉ',
    OTHER: 'Yêu cầu khác',
  };
  return category ? labels[category] : undefined;
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
        {items.map((req) => {
          const category = requirementCategoryLabel(req.category);
          return (
            <li key={req.requirementId} className="flex gap-2 items-start">
              <CheckCircleOutlined className="text-emerald-700 mt-1 shrink-0" aria-hidden />
              <span className="whitespace-pre-line break-words">
                {formatMultilineText(req.content)}
                {category && <Text type="secondary"> · {category}</Text>}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

/** Multi-line backend text, rendered as plain paragraphs (never as HTML). */
const LongText: React.FC<{ value: string | null; emptyText: string }> = ({ value, emptyText }) =>
  value ? (
    <Paragraph className="whitespace-pre-line break-words leading-relaxed mb-0">{renderFormattedMultilineText(value)}</Paragraph>
  ) : (
    <Text type="secondary">{emptyText}</Text>
  );

const companyInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase('vi-VN'))
    .join('') || 'DN';

const safeWebsiteUrl = (website: string | null) => {
  if (!website) return null;
  try {
    const url = new URL(website);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export const JobCompanyCard: React.FC<{ company: PublicJobCompany }> = ({ company }) => {
  const websiteUrl = safeWebsiteUrl(company.website);
  const facts = [
    company.industry ? { icon: <BankOutlined aria-hidden />, label: 'Lĩnh vực', value: company.industry } : null,
    company.companySize ? { icon: <TeamOutlined aria-hidden />, label: 'Quy mô', value: company.companySize } : null,
    company.address ? { icon: <EnvironmentOutlined aria-hidden />, label: 'Địa điểm', value: company.address } : null,
  ].filter((fact): fact is NonNullable<typeof fact> => fact !== null);

  return (
    <section
      aria-label="Thông tin doanh nghiệp"
      className="overflow-hidden rounded-2xl border border-solid border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-sky-50/60"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={`Logo ${company.companyName}`}
                className="h-14 w-14 shrink-0 rounded-2xl border border-solid border-blue-100 bg-white object-contain p-1.5"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-extrabold tracking-wide text-white"
              >
                {companyInitials(company.companyName)}
              </span>
            )}

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-lg font-bold leading-snug text-slate-950">{company.companyName}</h2>
                {company.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <CheckCircleFilled aria-hidden /> Đã xác minh
                  </span>
                )}
              </div>
              <p className="m-0 flex items-center gap-1.5 text-sm font-medium text-blue-700">
                <ShopOutlined aria-hidden /> Về doanh nghiệp tuyển dụng
              </p>
            </div>
          </div>

          {websiteUrl && (
            <Button
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              icon={<GlobalOutlined />}
              className="!rounded-full !border-blue-200 !bg-white !font-semibold !text-blue-700 hover:!border-blue-400"
            >
              Website công ty
            </Button>
          )}
        </div>

        {facts.length > 0 && (
          <dl className="m-0 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-xl border border-solid border-slate-200/80 bg-white/90 px-3.5 py-3">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className="text-blue-600">{fact.icon}</span>
                  {fact.label}
                </dt>
                <dd className="m-0 mt-1 text-sm font-medium leading-relaxed text-slate-800">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="border-0 border-t border-solid border-blue-100 pt-4">
          <p className="m-0 text-sm leading-6 text-slate-600">
            {company.description?.trim() || 'Doanh nghiệp chưa cập nhật phần giới thiệu.'}
          </p>
        </div>
      </div>
    </section>
  );
};

interface JobDetailPanelProps {
  job: Job;
  /** Status history is only useful to the owner and reviewers. */
  showHistory?: boolean;
  /** Whether the panel is rendered inside Internal HR review view. */
  isInternalReview?: boolean;
  onPaySuccess?: () => void;
  /** Whether the panel is rendered for an applicant (candidate or public visitor). */
  isApplicantView?: boolean;
  /** Optional agreement status for agreement-related alerts. */
  agreementStatus?: string;
  /** Optional reason for change request from business. */
  changeRequestReason?: string;
  /** Optional callback to open terms/agreement modal directly from the alert. */
  onOpenTermsModal?: () => void;
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
  job,
  showHistory = false,
  isInternalReview = false,
  onPaySuccess,
  isApplicantView,
  agreementStatus,
  changeRequestReason,
  onOpenTermsModal,
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
  // While waiting for the signature, the numbers HR sent live in the current agreement draft.
  const hasTermsCard = !isApplicant && (job.serviceTypeCode === 'HEADHUNT_COD' || job.serviceTypeCode === 'CV_SOURCING');
  const draftQuery = useCurrentServiceAgreement(job.jobId, hasTermsCard && !agreed && job.status === 'PENDING_AGREEMENT');
  const draft = !agreed ? draftQuery.data ?? null : null;
  const termSource: 'AGREED' | 'DRAFT' | 'PROPOSED' = agreed ? 'AGREED' : draft ? 'DRAFT' : 'PROPOSED';
  const termLabel =
    termSource === 'AGREED' ? 'Đã thống nhất' : termSource === 'DRAFT' ? `Dự thảo chờ ký · v${draft?.version}` : 'Doanh nghiệp đề xuất';
  const termTagColor = termSource === 'AGREED' ? 'success' : termSource === 'DRAFT' ? 'purple' : 'default';
  const feeMultiplier = agreed?.feeMultiplier ?? draft?.feeMultiplier ?? proposed?.feeMultiplier ?? null;
  const warrantyDays = agreed?.warrantyDays ?? draft?.warrantyDays ?? proposed?.warrantyDays ?? null;
  const paymentDueDays = agreed?.paymentDueDays ?? draft?.paymentDueDays ?? proposed?.paymentDueDays ?? null;
  const NOT_SET = 'Chưa chốt';

  const isChangeRequested = Boolean(
    agreementStatus === 'CHANGE_REQUESTED' ||
    job.agreementStatus === 'CHANGE_REQUESTED' ||
    Boolean(changeRequestReason)
  );

  const finalChangeReason =
    changeRequestReason ||
    job.agreementChangeRequestReason ||
    draft?.changeRequestReason ||
    'Doanh nghiệp yêu cầu điều chỉnh các điều khoản trong thỏa thuận dịch vụ.';

  const hasSignedAgreement = Boolean(
    !isChangeRequested && (
      job.hasSignedAgreement ||
      agreementStatus === 'SIGNED' ||
      draft?.status === 'SIGNED' ||
      draft?.hasSignedDocument ||
      draft?.signedAt
    )
  );

  const isExpired =
    (job.expiresAt && new Date(job.expiresAt) <= new Date()) ||
    (job.status === 'CLOSED' && Boolean(job.statusReason?.toLowerCase().includes('hết hạn')));

  return (
    <div className={`space-y-6 ${isApplicant ? 'candidate-job-detail-panel' : ''}`}>
      <header className="candidate-job-detail-panel__hero space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <JobStatusTag
            status={job.status}
            hasSignedAgreement={hasSignedAgreement}
            isChangeRequested={isChangeRequested}
          />
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
              {awaitingDeposit ? 'Chờ đặt cọc dịch vụ tìm kiếm hồ sơ' : 'Chờ thanh toán phí đăng tin'}
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
        {!isApplicant && !isInternalReview && job.status === 'REJECTED' && job.statusReason && (
          <div role="note" className="rounded-lg border border-solid border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <Text strong className="text-red-800">
              Lý do từ chối:{' '}
            </Text>
            {job.statusReason}
          </div>
        )}

        {/* Thông báo thỏa thuận dịch vụ - Headhunt & CV Sourcing (Chỉ hiển thị cho Client, Internal Review đã có thanh tác vụ phía trên) */}
        {!isApplicant && !isInternalReview && job.status === 'PENDING_AGREEMENT' && (
          isChangeRequested ? (
            <Alert
              type="warning"
              showIcon
              className="border-amber-300 bg-amber-50/90 text-amber-950 rounded-xl shadow-xs"
              message={
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-amber-900 text-sm">
                    Doanh nghiệp yêu cầu điều chỉnh thỏa thuận dịch vụ
                  </span>
                  <Tag color="warning" className="m-0 font-medium text-xs rounded-full px-2">
                    Cần xử lý điều chỉnh
                  </Tag>
                </div>
              }
              description={
                <div className="mt-2 space-y-2.5">
                  <div className="rounded-lg border border-solid border-amber-200/90 bg-white/80 p-3 shadow-2xs">
                    <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      Lý do / Ghi chú từ Doanh nghiệp:
                    </div>
                    <div className="text-sm font-medium text-slate-900 whitespace-pre-wrap leading-relaxed">
                      "{finalChangeReason}"
                    </div>
                  </div>
                  <p className="text-xs text-amber-800 m-0">
                    {isInternalReview
                      ? 'Vui lòng xem lại các điều khoản hoặc trao đổi với doanh nghiệp, sau đó cập nhật và gửi lại bản thỏa thuận mới.'
                      : 'Yêu cầu điều chỉnh đã được gửi tới chuyên viên Internal HR để cập nhật lại thỏa thuận.'}
                  </p>
                </div>
              }
              action={
                isInternalReview && onOpenTermsModal ? (
                  <Button
                    type="primary"
                    size="small"
                    className="!bg-amber-600 hover:!bg-amber-700 !border-amber-600 text-white rounded-lg shadow-sm font-medium transition-all active:scale-[0.98]"
                    onClick={onOpenTermsModal}
                  >
                    Gửi bản mới (v{(draft?.version ?? 1) + 1})
                  </Button>
                ) : undefined
              }
            />
          ) : hasSignedAgreement ? (
            <Alert
              type="info"
              showIcon
              className="border-teal-200 bg-teal-50/80 text-teal-900"
              message="Đã nộp hợp đồng ký · Đang chờ kiểm tra & duyệt tin"
              description={
                isInternalReview
                  ? 'Doanh nghiệp đã nộp bản hợp đồng có chữ ký. Vui lòng kiểm tra và xử lý duyệt tin.'
                  : 'Doanh nghiệp đã tải lên bản hợp đồng có chữ ký. Vui lòng chờ kiểm tra và hoàn tất duyệt tin.'
              }
              action={
                !isInternalReview ? (
                  <Button
                    type="primary"
                    size="small"
                    className="!bg-teal-600 hover:!bg-teal-700 !border-teal-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
                    onClick={() => navigate(`/client/agreements?jobId=${job.jobId}`)}
                  >
                    Xem hợp đồng
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Alert
              type="info"
              showIcon
              className="border-blue-200 bg-blue-50/70"
              message={
                isInternalReview
                  ? 'Đã gửi hợp đồng cho DN'
                  : 'Hợp đồng dịch vụ đã soạn xong'
              }
              description={
                isInternalReview
                  ? 'Đã gửi bản hợp đồng có sẵn chữ ký cho Doanh nghiệp tải về ký ngoài hệ thống.'
                  : 'Internal HR đã soạn xong hợp đồng. Doanh nghiệp vui lòng tải hợp đồng về xem và ký kết.'
              }
              action={
                !isInternalReview ? (
                  <Button
                    type="primary"
                    size="small"
                    className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
                    onClick={() => navigate(`/client/agreements?jobId=${job.jobId}`)}
                  >
                    Xem hợp đồng
                  </Button>
                ) : undefined
              }
            />
          )
        )}

        {/* Thông báo chờ thanh toán phí đăng tin - hiển thị cho Client (Internal Review đã có banner phía trên) */}
        {!isApplicant && !isInternalReview && job.status === 'PENDING_PAYMENT' && (
          <Alert
            type={job.hasSubmittedDeposit ? 'info' : 'warning'}
            showIcon
            message={
              awaitingDeposit
                ? job.hasSubmittedDeposit
                  ? `Tin đã duyệt · Đã nộp tiền cọc (${feeText})`
                  : `Tin đã duyệt · Chờ đặt cọc dịch vụ (${feeText})`
                : `Tin đã duyệt · Chờ thanh toán phí gói (${feeText})`
            }
            description={
              awaitingDeposit
                ? job.hasSubmittedDeposit
                  ? 'Doanh nghiệp đã gửi thông tin nộp cọc. Đang chờ HR Connect đối soát và công khai tin tuyển dụng.'
                  : 'Vui lòng hoàn tất nộp tiền cọc để kích hoạt dịch vụ tìm kiếm hồ sơ ứng viên.'
                : `Vui lòng hoàn tất thanh toán ${feeText} để công bố tin tuyển dụng.`
            }
            action={
              awaitingDeposit ? (
                <div className="flex items-center gap-2">
                  {job.hasSubmittedDeposit ? (
                    <Button
                      disabled
                      size="small"
                      className="!bg-slate-100 !text-slate-400 !border-slate-200 cursor-not-allowed"
                    >
                      Đã nộp cọc
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CreditCardOutlined />}
                      className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
                      onClick={() => setShowPaymentModal(true)}
                    >
                      Nộp cọc
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => navigate(`/client/agreements?jobId=${job.jobId}`)}
                  >
                    Hợp đồng cọc
                  </Button>
                </div>
              ) : (
                <Button
                  type="primary"
                  size="small"
                  icon={<CreditCardOutlined />}
                  className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98]"
                  onClick={() => setShowPaymentModal(true)}
                >
                  Thanh toán ngay
                </Button>
              )
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
                className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-medium text-xs"
                onClick={() => navigate(`/candidate/applications/${appliedApp.applicationId}`)}
              >
                Xem chi tiết đơn
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Key facts: label above value so long values never squeeze the label; values stay whole. */}
      <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-solid border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { label: 'Mức lương', value: <span className="tabular-nums">{formatSalary(job)}</span> },
          { label: 'Kinh nghiệm', value: formatExperience(job.minExperienceYears, job.maxExperienceYears) },
          { label: 'Hình thức', value: job.employmentType ? EMPLOYMENT_TYPE_LABEL[job.employmentType] : '—' },
          {
            label: job.serviceTypeCode === 'CV_SOURCING' ? 'Số hồ sơ cần nhận' : 'Số lượng cần tuyển',
            value: (<span className="inline-flex items-center gap-1.5 whitespace-nowrap"><TeamOutlined aria-hidden className="text-slate-400" />{formatHeadcount(job)}</span>),
          },
          {
            label: 'Địa điểm',
            value: (<span className="inline-flex items-start gap-1.5"><EnvironmentOutlined aria-hidden className="mt-1 text-slate-400" />{job.location ?? '—'}</span>),
          },
          // Keep the line breaks the Client typed (HR feedback 28/10).
          { label: 'Thời gian làm việc', value: <span className="whitespace-pre-line leading-relaxed">{job.workingTime ?? '—'}</span> },
          ...(job.salaryNote
            ? [{ label: 'Ghi chú lương', value: <span className="whitespace-pre-line leading-relaxed">{job.salaryNote}</span> }]
            : []),
          { label: 'Ngày đăng', value: job.postedAt ? formatDate(job.postedAt) : 'Chưa công bố' },
          ...(!isApplicant && job.postingPackageName
            ? [{ label: 'Gói đăng tin', value: formatPostingPackage(job.postingPackageCode, job.postingPackageName) }]
            : []),
          ...(!isApplicant && job.maxApplications ? [{ label: 'Hạn mức hồ sơ', value: `Tối đa ${job.maxApplications} hồ sơ hợp lệ` }] : []),
          ...(job.expiresAt
            ? [{
              label: isApplicant ? 'Hạn nộp hồ sơ' : 'Hạn hiển thị',
              value: (<span className={isExpired ? 'font-semibold text-red-600' : ''}>{formatDateTime(job.expiresAt)}{isExpired ? ' (Đã hết hạn)' : ''}</span>),
            }]
            : []),
        ].map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs font-medium text-slate-500">{fact.label}</dt>
            <dd className="m-0 mt-0.5 text-sm font-medium text-slate-900">{fact.value}</dd>
          </div>
        ))}
      </dl>

      {isApplicant && job.company && <JobCompanyCard company={job.company} />}

      {/* ── Thông tin dịch vụ & Phí đăng tin (CHỈ hiển thị cho Doanh nghiệp, KHÔNG hiển thị khi Internal HR duyệt hay cho Ứng viên) ── */}
      {!isApplicant && !isInternalReview && job.serviceTypeCode === 'CV_APPLICATION' && (
        <section aria-label="Gói dịch vụ tuyển dụng" className="rounded-xl border border-solid border-slate-200/90 bg-slate-50/60 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-0 border-b border-solid border-slate-200/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <AuditOutlined className="text-sm" />
              </span>
              <div>
                <span className="font-bold text-slate-800 text-sm">{formatPostingPackage(job.postingPackageCode, feeInfo.packageName)}</span>
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

      {/* ── Thông tin dịch vụ CV SOURCING & HEADHUNT: Khung điều khoản đã được chuyển trực tiếp vào văn bản hợp đồng dịch vụ ── */}


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
        isDeposit={awaitingDeposit}
        depositAmount={sourcingDepositAmount(job) ?? 200000}
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
        title={`Hồ sơ được tìm kiếm · ${job.title}`}
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
