/**
 * @file jobDisplay.ts
 * @description Vietnamese labels and display rules for MF-01, keyed by backend values.
 * Business rules here mirror the backend (JobAccessPolicy, JobConstants) so the UI
 * never offers an option the API would reject.
 */
import type {
  EmploymentType,
  Job,
  JobCloseReasonCode,
  JobRejectReasonCode,
  JobStatus,
  ServiceTypeCode,
} from '@/types/api/jobs';

export const DEFAULT_STATUS_CONFIG: { label: string; color: string; hint: string } = {
  label: 'Không xác định',
  color: 'default',
  hint: '',
};

/** Ant Design Tag colors; each status also carries a text label so color is never the only signal. */
export const JOB_STATUS: Record<JobStatus, { label: string; color: string; hint: string }> = {
  DRAFT: { label: 'Bản nháp', color: 'default', hint: 'Chưa gửi duyệt. Bạn có thể chỉnh sửa.' },
  PENDING_REVIEW: { label: 'Chờ duyệt', color: 'processing', hint: 'Internal HR đang xét duyệt.' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', color: 'warning', hint: 'Nội dung đã được duyệt. Cần thanh toán phí để công bố tin.' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'warning', hint: 'Tin đang chờ HR duyệt' },
  REJECTED: { label: 'Bị từ chối', color: 'error', hint: 'Sửa theo lý do rồi gửi duyệt lại.' },
  ACTIVE: { label: 'Đang tuyển', color: 'success', hint: 'Đang hiển thị và nhận hồ sơ.' },
  PAUSED: { label: 'Tạm dừng', color: 'warning', hint: 'Tạm ngừng nhận hồ sơ.' },
  CLOSED: { label: 'Đã đóng', color: 'default', hint: 'Không còn nhận hồ sơ.' },
};

export const STATUS_CONFIG = JOB_STATUS;

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  CONTRACT: 'Hợp đồng',
  INTERNSHIP: 'Thực tập',
  FREELANCE: 'Freelance',
};

export const SERVICE_TYPE_LABEL: Record<ServiceTypeCode, { label: string; summary: string }> = {
  CV_APPLICATION: {
    label: 'Nhận CV ứng tuyển',
    summary: 'Ứng viên tự ứng tuyển và nộp CV trực tiếp vào tin.',
  },
  CV_SOURCING: {
    label: 'Tìm nguồn CV',
    summary: 'Nền tảng và đối tác tìm kiếm & sàng lọc nguồn hồ sơ.',
  },
  HEADHUNT_COD: {
    label: 'Headhunt (COD)',
    summary: 'Chuyên viên tuyển dụng trọn gói, trả phí khi tuyển thành công.',
  },
};

export const JOB_TEMPLATE_INDUSTRY_LABEL: Record<string, string> = {
  IT: 'Công nghệ thông tin',
  MARKETING: 'Marketing',
  SALES: 'Kinh doanh',
  ACCOUNTING: 'Kế toán',
  HR: 'Nhân sự',
  ADMIN: 'Hành chính',
};

export const JOB_TEMPLATE_LEVEL_LABEL: Record<string, string> = {
  INTERN: 'Thực tập sinh',
  JUNIOR: 'Nhân viên mới (Junior)',
  MIDDLE: 'Chuyên viên (Middle)',
  SENIOR: 'Chuyên viên cao cấp (Senior)',
  LEAD: 'Trưởng nhóm (Lead)',
};

export const JOB_TEMPLATE_CATEGORY_LABEL: Record<string, string> = {
  EXPERIENCE: 'Kinh nghiệm',
  SKILL: 'Kỹ năng',
  EDUCATION: 'Học vấn',
  OTHER: 'Khác',
};

export const REQUIREMENT_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'EXPERIENCE', label: 'Kinh nghiệm (EXPERIENCE)' },
  { value: 'SKILL', label: 'Kỹ năng (SKILL)' },
  { value: 'EDUCATION', label: 'Học vấn (EDUCATION)' },
  { value: 'OTHER', label: 'Khác (OTHER)' },
];

export const formatTemplateIndustry = (industry: string | null | undefined): string => {
  if (!industry) return '—';
  return JOB_TEMPLATE_INDUSTRY_LABEL[industry] || industry;
};

export const formatTemplateLevel = (level: string | null | undefined): string => {
  if (!level) return '—';
  return JOB_TEMPLATE_LEVEL_LABEL[level] || level;
};

export const formatTemplateCategory = (category: string | null | undefined): string => {
  if (!category) return 'Khác';
  return JOB_TEMPLATE_CATEGORY_LABEL[category.toUpperCase()] || category;
};


export const REJECT_REASONS: { value: JobRejectReasonCode; label: string }[] = [
  { value: 'REJECTED_INCOMPLETE_DESCRIPTION', label: 'Mô tả công việc chưa đầy đủ' },
  { value: 'REJECTED_INCOMPLETE_REQUIREMENTS', label: 'Yêu cầu ứng viên chưa đầy đủ' },
  { value: 'REJECTED_TERMS_NOT_AGREED', label: 'Chưa thống nhất điều khoản thương mại' },
  { value: 'REJECTED_OTHER', label: 'Lý do khác' },
];

export const CLOSE_REASONS: { value: JobCloseReasonCode; label: string }[] = [
  { value: 'CLOSED_POSITION_FILLED', label: 'Đã tuyển đủ người' },
  { value: 'CLOSED_BY_CLIENT', label: 'Doanh nghiệp dừng tuyển' },
  { value: 'CLOSED_EXPIRED', label: 'Hết hạn đăng tin' },
  { value: 'CLOSED_QUOTA_REACHED', label: 'Đã nhận đủ hạn mức hồ sơ' },
  { value: 'CLOSED_OTHER', label: 'Lý do khác' },
];

/** Labels for every reason code that can appear in status history. */
export const REASON_CODE_LABEL: Record<string, string> = {
  ...Object.fromEntries(REJECT_REASONS.map((r) => [r.value, r.label])),
  ...Object.fromEntries(CLOSE_REASONS.map((r) => [r.value, r.label])),
  DRAFT_CREATED: 'Tạo bản nháp',
  SUBMITTED_FOR_REVIEW: 'Gửi duyệt',
  APPROVED: 'Được duyệt',
  PAUSED_BY_CLIENT: 'Doanh nghiệp tạm dừng',
  RESUMED_BY_CLIENT: 'Doanh nghiệp mở lại',
  CLOSED_EXPIRED: 'Hết hạn đăng tin',
  CLOSED_QUOTA_REACHED: 'Đã nhận đủ hạn mức hồ sơ',
};

/** What a Client may do next, per JobTransitions on the backend. */
export const clientActions = (status: JobStatus) => ({
  canEdit: status === 'DRAFT' || status === 'REJECTED',
  canSubmit: status === 'DRAFT' || status === 'REJECTED',
  canPause: status === 'ACTIVE',
  canResume: status === 'PAUSED',
  canClose: status === 'ACTIVE' || status === 'PAUSED' || status === 'PENDING_PAYMENT',
  canPay: status === 'PENDING_PAYMENT',
});

const moneyFormatter = (currency: string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 });

export const formatSalary = (job?: Partial<Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryNegotiable' | 'currencyCode'>> | null): string => {
  if (!job) return 'Chưa công bố';
  const fmt = moneyFormatter(job.currencyCode || 'VND');
  const { salaryMin: min, salaryMax: max } = job;
  if (min != null && max != null) return `${fmt.format(min)} – ${fmt.format(max)}`;
  if (min != null) return `Từ ${fmt.format(min)}`;
  if (max != null) return `Đến ${fmt.format(max)}`;
  return job.salaryNegotiable ? 'Thỏa thuận' : 'Chưa công bố';
};

export const formatExperience = (min: number | null, max: number | null): string => {
  if (min != null && max != null) return min === max ? `${min} năm` : `${min}–${max} năm`;
  if (min != null) return `Từ ${min} năm`;
  if (max != null) return `Tối đa ${max} năm`;
  return 'Không yêu cầu';
};

export const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const formatDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
