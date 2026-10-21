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
  PENDING_REVIEW: { label: 'Chờ duyệt', color: 'processing', hint: 'Bộ phận kiểm duyệt của HR Connect đang xử lý.' },
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
    label: 'Nhận hồ sơ ứng tuyển',
    summary: 'Ứng viên tự tìm việc và gửi hồ sơ trực tiếp vào tin tuyển dụng.',
  },
  CV_SOURCING: {
    label: 'Tìm kiếm hồ sơ phù hợp',
    summary: 'HR Connect và đối tác chủ động tìm kiếm, sàng lọc hồ sơ phù hợp.',
  },
  HEADHUNT_COD: {
    label: 'Tuyển dụng theo kết quả',
    summary: 'HR Connect phụ trách tuyển dụng và doanh nghiệp trả phí khi tuyển thành công.',
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
  { value: 'EXPERIENCE', label: 'Kinh nghiệm làm việc' },
  { value: 'SKILL', label: 'Kỹ năng chuyên môn' },
  { value: 'EDUCATION', label: 'Học vấn và chứng chỉ' },
  { value: 'OTHER', label: 'Yêu cầu khác' },
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
/**
 * CV_SOURCING waiting for its deposit (PENDING_PAYMENT): it has no posting fee; the job opens when
 * Platform Admin records the deposit in MF-05. Amount = target × price per CV × deposit percent.
 */
/** N18: CV_SOURCING asks for a number of CVs, not hires. */
export const formatHeadcount = (job: { serviceTypeCode?: string | null; quantity?: number | null; sourcingTarget?: number | null }): string =>
  job.serviceTypeCode === 'CV_SOURCING' && job.sourcingTarget
    ? `${job.sourcingTarget} hồ sơ`
    : `${job.quantity ?? 1} người`;

export const isAwaitingSourcingDeposit = (job: Pick<Job, 'status' | 'serviceTypeCode'>): boolean =>
  job.status === 'PENDING_PAYMENT' && job.serviceTypeCode === 'CV_SOURCING';

export const sourcingDepositAmount = (job: Pick<Job, 'commercialTerms'>): number | null => {
  const terms = job.commercialTerms;
  if (!terms?.sourcingTarget || !terms.pricePerCv || !terms.depositPercent) return null;
  return Math.round(terms.sourcingTarget * terms.pricePerCv * terms.depositPercent) / 100;
};

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

export const formatPostingPackage = (code?: string | null, fallback?: string | null): string => {
  if (code === 'FREE') return 'Gói dùng thử';
  if (code === 'STANDARD') return 'Gói tiêu chuẩn';
  if (code === 'PREMIUM') return 'Gói nổi bật';
  return fallback || 'Gói đăng tin';
};

/** Preserve authored line breaks and force common bullet markers onto separate lines. */
export const formatMultilineText = (value: string | null | undefined): string =>
  (value ?? '')
    .replace(/\s*([•▪◦])\s*/g, '\n$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const formatDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const formatDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
