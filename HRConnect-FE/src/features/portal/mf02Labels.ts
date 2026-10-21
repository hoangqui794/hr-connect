/**
 * @file mf02Labels.ts
 * @description Vietnamese wording for MF-02 codes and candidate-facing application stages.
 */
import type { Tone } from '@/features/admin-console/ui';
import type { CandidateApplicationDisplayGroup } from '@/types/api/mf02';

export const MAX_CV_MB = 10; // R2Settings.MaxCvFileSizeMb

/** Validates a CV the same way the backend does (PDF, ≤ 10 MB). Returns an error message or null. */
export const cvFileError = (file: File): string | null => {
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) return 'Chỉ nhận file PDF.';
  if (file.size > MAX_CV_MB * 1024 * 1024) return `File tối đa ${MAX_CV_MB}MB.`;
  return null;
};

export const fileSize = (bytes?: number | null) =>
  bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Candidate-facing stages, in order; each backend status maps onto one step. */
export const CANDIDATE_STEPS = [
  'Đã nộp',
  'Đang được xem',
  'Được chọn',
  'Phỏng vấn',
  'Chờ offer',
  'Đã nhận offer',
  'Đi làm',
] as const;

export interface CandidateDisplayStage {
  step: number;
  label: string;
  tone: Tone;
  closed: boolean;
  terminalMessage?: string;
}

/** Maps the sanitized status groups exposed by the Candidate application list API. */
export const candidateDisplayStage = (
  group: CandidateApplicationDisplayGroup,
  serverLabel?: string
): CandidateDisplayStage => {
  const mapped: Record<CandidateApplicationDisplayGroup, CandidateDisplayStage> = {
    SUBMITTED: { step: 0, label: 'Đã nộp', tone: 'info', closed: false },
    IN_REVIEW: { step: 1, label: 'Đang xem xét', tone: 'info', closed: false },
    SELECTED: { step: 2, label: 'Được chọn phỏng vấn', tone: 'success', closed: false },
    INTERVIEW: { step: 3, label: 'Phỏng vấn', tone: 'info', closed: false },
    OFFER: { step: 5, label: 'Đã nhận lời mời', tone: 'success', closed: false },
    HIRED: { step: 6, label: 'Đã tuyển', tone: 'success', closed: true },
    NOT_SELECTED: {
      step: 1,
      label: 'Chưa phù hợp lần này',
      tone: 'neutral',
      closed: true,
      terminalMessage: 'Quy trình tuyển dụng cho đơn này đã kết thúc.',
    },
    WITHDRAWN: {
      step: 0,
      label: 'Đã rút đơn',
      tone: 'neutral',
      closed: true,
      terminalMessage: 'Đơn ứng tuyển này không còn trong quy trình tuyển dụng.',
    },
  };
  const stage = mapped[group] ?? mapped.IN_REVIEW;
  const label = serverLabel?.trim() || stage.label;
  const step = group === 'OFFER' && label.toLocaleLowerCase('vi').includes('chuẩn bị') ? 4 : stage.step;
  return { ...stage, step, label };
};

const CANDIDATE_TIMELINE_STATUS_COPY: Record<string, { title: string; description: string }> = {
  SUBMITTED: { title: 'Hồ sơ đã được gửi', description: 'Nhà tuyển dụng đã nhận được hồ sơ của bạn.' },
  SCREENING: { title: 'Nhà tuyển dụng đang xem hồ sơ', description: 'Hồ sơ của bạn đang được nhà tuyển dụng xem xét.' },
  IN_REVIEW: { title: 'Nhà tuyển dụng đang xem hồ sơ', description: 'Hồ sơ của bạn đang được nhà tuyển dụng xem xét.' },
  SHORTLISTED: { title: 'Bạn đã được chọn vào vòng phỏng vấn', description: 'Nhà tuyển dụng đã chọn hồ sơ của bạn để tiếp tục quy trình.' },
  SELECTED: { title: 'Bạn đã được chọn vào vòng phỏng vấn', description: 'Nhà tuyển dụng đã chọn hồ sơ của bạn để tiếp tục quy trình.' },
  BACKUP: { title: 'Hồ sơ đang được cân nhắc', description: 'Nhà tuyển dụng vẫn đang cân nhắc hồ sơ của bạn.' },
  INTERVIEW: { title: 'Hồ sơ đã chuyển sang bước phỏng vấn', description: 'Nhà tuyển dụng sẽ cập nhật lịch phỏng vấn khi sẵn sàng.' },
  OFFER_PENDING: { title: 'Nhà tuyển dụng đang chuẩn bị lời mời', description: 'Quy trình của bạn đang ở bước chuẩn bị lời mời nhận việc.' },
  OFFER_ACCEPTED: { title: 'Bạn đã chấp nhận lời mời nhận việc', description: 'Nhà tuyển dụng sẽ tiếp tục hướng dẫn thủ tục nhận việc.' },
  PLACED: { title: 'Bạn đã hoàn tất quy trình tuyển dụng', description: 'Thông tin nhận việc của bạn đã được xác nhận.' },
  REJECTED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  NOT_SELECTED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  INTERVIEW_FAILED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  BACKUP_NOT_SELECTED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  CLOSED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  WITHDRAWN: { title: 'Bạn đã rút đơn ứng tuyển', description: 'Đơn này không còn trong quy trình tuyển dụng.' },
  OFFER_DECLINED: { title: 'Bạn đã từ chối lời mời nhận việc', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  NOT_STARTED: { title: 'Không tiếp tục nhận việc', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
};

/** Prevents an older API deployment or cached response from exposing internal workflow codes. */
export const candidateTimelineEventCopy = (event: {
  eventType?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
}) => {
  if (event.eventType !== 'APPLICATION_STATUS_CHANGED') {
    return { title: event.title || 'Tiến trình hồ sơ được cập nhật', description: event.description || null };
  }

  const normalizedStatus = event.status?.trim().toUpperCase();
  const directCopy = normalizedStatus ? CANDIDATE_TIMELINE_STATUS_COPY[normalizedStatus] : undefined;
  if (directCopy) return directCopy;

  const rawText = `${event.title || ''} ${event.description || ''}`.toUpperCase();
  const statusFromLegacyText = Object.keys(CANDIDATE_TIMELINE_STATUS_COPY).find((status) => rawText.includes(status));
  return statusFromLegacyText
    ? CANDIDATE_TIMELINE_STATUS_COPY[statusFromLegacyText]
    : { title: 'Hồ sơ đã được cập nhật', description: 'Nhà tuyển dụng vừa cập nhật tiến trình hồ sơ của bạn.' };
};

export const candidateStage = (
  status: string,
  offerStatuses: string[] = []
): { step: number; label: string; tone: Tone; closed?: boolean } => {
  switch (status) {
    case 'SUBMITTED':
      return { step: 0, label: 'Đã nộp, chờ xem', tone: 'info' };
    case 'SCREENING':
      return { step: 1, label: 'Nhà tuyển dụng đang xem', tone: 'info' };
    case 'SHORTLISTED':
      return { step: 2, label: 'Được chọn phỏng vấn', tone: 'success' };
    case 'BACKUP':
      return { step: 2, label: 'Trong danh sách dự phòng', tone: 'warning' };
    case 'INTERVIEW':
      return { step: 3, label: 'Đang phỏng vấn', tone: 'info' };
    case 'OFFER_PENDING':
      return offerStatuses.some((offerStatus) => offerStatus.toUpperCase() === 'SENT')
        ? { step: 5, label: 'Đã nhận offer', tone: 'success' }
        : { step: 4, label: 'Đang chuẩn bị offer', tone: 'warning' };
    case 'OFFER_ACCEPTED':
      return { step: 5, label: 'Đã chấp nhận offer', tone: 'success' };
    case 'PLACED':
      return { step: 6, label: 'Đã đi làm', tone: 'success', closed: true };
    case 'REJECTED':
      return { step: 1, label: 'Chưa phù hợp lần này', tone: 'neutral', closed: true };
    case 'BACKUP_NOT_SELECTED':
    case 'INTERVIEW_FAILED':
      return { step: 3, label: 'Chưa phù hợp lần này', tone: 'neutral', closed: true };
    case 'OFFER_DECLINED':
      return { step: 5, label: 'Đã từ chối offer', tone: 'neutral', closed: true };
    case 'NOT_STARTED':
      return { step: 5, label: 'Không nhận việc', tone: 'neutral', closed: true };
    case 'WITHDRAWN':
      return { step: 0, label: 'Đã rút đơn', tone: 'neutral', closed: true };
    case 'CLOSED':
      return { step: 0, label: 'Tin đã đóng', tone: 'neutral', closed: true };
    default:
      return { step: 0, label: status, tone: 'neutral' };
  }
};

export const SUBMISSION_STATUS: Record<string, { label: string; tone: Tone; hint: string }> = {
  PENDING_CONSENT: { label: 'Chờ ứng viên xác nhận', tone: 'warning', hint: 'Đã gửi email, ứng viên có 48 giờ để đồng ý.' },
  PENDING_IDENTITY_REVIEW: { label: 'Đang đối chiếu danh tính', tone: 'warning', hint: 'Ứng viên đã đồng ý. Admin đang đối chiếu hồ sơ nghi trùng trước khi đưa vào tuyển dụng.' },
  ACCEPTED: { label: 'Ứng viên đã đồng ý', tone: 'success', hint: 'Hồ sơ đã vào quy trình tuyển dụng và được ghi attribution cho bạn.' },
  CONSENT_REJECTED: { label: 'Ứng viên từ chối', tone: 'danger', hint: 'Ứng viên không đồng ý cho bạn giới thiệu.' },
  CONSENT_EXPIRED: { label: 'Hết hạn xác nhận', tone: 'neutral', hint: 'Ứng viên không trả lời trong hạn; hãy tạo lượt giới thiệu mới.' },
  BLOCKED_DUPLICATE: { label: 'Hồ sơ trùng đã được xử lý', tone: 'danger', hint: 'Một lượt giới thiệu hợp lệ khác đã được giữ lại cho tin tuyển dụng này. Bạn có thể khiếu nại nếu có bằng chứng.' },
  JOB_UNAVAILABLE: { label: 'Tin không còn nhận hồ sơ', tone: 'neutral', hint: 'Job đã đóng hoặc không còn cho phép nhận hồ sơ.' },
};

export const submissionStatus = (s: string) => SUBMISSION_STATUS[s] ?? { label: s, tone: 'neutral' as Tone, hint: '' };

export const ATTRIBUTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Đang hiệu lực', tone: 'success' },
  VOID: { label: 'Đã hủy', tone: 'neutral' },
  DISPUTED: { label: 'Đang tranh chấp', tone: 'warning' },
};
