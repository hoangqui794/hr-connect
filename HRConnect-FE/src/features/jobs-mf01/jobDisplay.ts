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
  JobVisibility,
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
    summary: 'Ứng viên tự nộp; doanh nghiệp tự sàng lọc hồ sơ.',
  },
  CV_SOURCING: {
    label: 'Tìm nguồn CV',
    summary: 'Nền tảng và Affiliate tìm CV; Internal HR lọc trước khi giao.',
  },
  HEADHUNT_COD: {
    label: 'Headhunt (trả phí khi tuyển được)',
    summary: 'Affiliate giới thiệu ứng viên; Internal HR sàng lọc và liên hệ ứng viên.',
  },
};

export const VISIBILITY_LABEL: Record<JobVisibility, { label: string; summary: string }> = {
  PUBLIC: { label: 'Công khai', summary: 'Ứng viên và Affiliate đều thấy.' },
  PARTNER_ONLY: { label: 'Chỉ đối tác', summary: 'Chỉ Affiliate thấy, ứng viên không tự nộp.' },
  INTERNAL_ONLY: { label: 'Nội bộ', summary: 'Chỉ doanh nghiệp và Internal HR thấy.' },
};

/** Mirrors JobAccessPolicy.IsVisibilityAllowedForServiceType. */
export const allowedVisibilities = (code: ServiceTypeCode | null | undefined): JobVisibility[] => {
  if (code === 'CV_APPLICATION') return ['PUBLIC', 'INTERNAL_ONLY'];
  if (code === 'CV_SOURCING' || code === 'HEADHUNT_COD') return ['PARTNER_ONLY', 'INTERNAL_ONLY'];
  return [];
};

export const REJECT_REASONS: { value: JobRejectReasonCode; label: string }[] = [
  { value: 'REJECTED_INCOMPLETE_DESCRIPTION', label: 'Mô tả công việc chưa đầy đủ' },
  { value: 'REJECTED_INCOMPLETE_REQUIREMENTS', label: 'Yêu cầu ứng viên chưa đầy đủ' },
  { value: 'REJECTED_OTHER', label: 'Lý do khác' },
];

export const CLOSE_REASONS: { value: JobCloseReasonCode; label: string }[] = [
  { value: 'CLOSED_POSITION_FILLED', label: 'Đã tuyển đủ người' },
  { value: 'CLOSED_BY_CLIENT', label: 'Doanh nghiệp dừng tuyển' },
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
};

/** What a Client may do next, per JobTransitions on the backend. */
export const clientActions = (status: JobStatus) => ({
  canEdit: status === 'DRAFT' || status === 'REJECTED',
  canSubmit: status === 'DRAFT' || status === 'REJECTED',
  canPause: status === 'ACTIVE',
  canResume: status === 'PAUSED',
  canClose: status === 'ACTIVE' || status === 'PAUSED',
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
