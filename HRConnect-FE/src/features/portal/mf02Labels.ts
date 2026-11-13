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
    HIRED: { step: 6, label: 'Đang làm việc', tone: 'success', closed: true },
    ENDED: {
      step: 6,
      label: 'Đã nghỉ việc',
      tone: 'neutral',
      closed: true,
      terminalMessage: 'Hồ sơ nhận việc tại vị trí này đã kết thúc.',
    },
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
  let label = serverLabel?.trim() || stage.label;
  if (group === 'HIRED' && (label === 'Đã tuyển' || label === 'Đã nhận việc' || label === 'Đi làm')) {
    label = 'Đang làm việc';
  }
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
  RESIGNED: { title: 'Đã kết thúc công việc', description: 'Trạng thái đã ghi nhận nghỉ việc. Bạn có thể tiếp tục tìm kiếm các cơ hội việc làm mới.' },
  REJECTED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  NOT_SELECTED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  INTERVIEW_FAILED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  BACKUP_NOT_SELECTED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  CLOSED: { title: 'Chưa phù hợp lần này', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  WITHDRAWN: { title: 'Bạn đã rút đơn ứng tuyển', description: 'Đơn này không còn trong quy trình tuyển dụng.' },
  OFFER_DECLINED: { title: 'Bạn đã từ chối lời mời nhận việc', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
  NOT_STARTED: { title: 'Không tiếp tục nhận việc', description: 'Quy trình tuyển dụng cho đơn này đã kết thúc.' },
};

/**
 * Prevents an older API deployment or cached response from exposing internal workflow codes
 * and strictly prevents leaking employer internal interview evaluation/notes/feedback to the candidate.
 */
export const candidateTimelineEventCopy = (event: {
  eventType?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
}) => {
  const eventType = (event.eventType || '').toUpperCase();

  // Neutral candidate-safe copy for all interview-related events
  // Strictly protects employer internal interview evaluation, feedback, and notes from candidate view
  if (eventType.includes('INTERVIEW')) {
    if (eventType.includes('SCHEDULE') || eventType === 'INTERVIEW_SCHEDULED') {
      return {
        title: 'Đã lên lịch phỏng vấn',
        description: 'Lịch phỏng vấn đã được sắp xếp. Vui lòng kiểm tra thời gian và xác nhận tham gia.',
      };
    }
    if (eventType.includes('RESCHEDULE') || eventType === 'INTERVIEW_RESCHEDULED') {
      return {
        title: 'Đã dời lịch phỏng vấn',
        description: 'Lịch phỏng vấn đã được cập nhật lại.',
      };
    }
    if (eventType.includes('CANCEL') || eventType === 'INTERVIEW_CANCELLED') {
      return {
        title: 'Đã hủy lịch phỏng vấn',
        description: 'Buổi phỏng vấn đã được hủy.',
      };
    }
    if (eventType.includes('COMPLETED') || eventType.includes('RESULT')) {
      return {
        title: 'Đã phỏng vấn',
        description: 'Buổi phỏng vấn đã hoàn tất. Nhà tuyển dụng đang xem xét tiến trình hồ sơ của bạn.',
      };
    }
    return {
      title: 'Cập nhật tiến trình phỏng vấn',
      description: 'Lịch trình phỏng vấn của bạn đã có cập nhật mới.',
    };
  }

  if (event.eventType !== 'APPLICATION_STATUS_CHANGED') {
    // Sanitize any raw description that might contain leaked internal evaluation keywords
    const rawDesc = event.description || null;
    const isInternalNote = rawDesc && /(feedback|nhận xét|ghi chú|đánh giá|kết quả|note|pv thêm)/i.test(rawDesc);
    return {
      title: event.title || 'Tiến trình hồ sơ được cập nhật',
      description: isInternalNote ? 'Tiến trình hồ sơ của bạn đã có cập nhật mới.' : rawDesc,
    };
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
  offerStatuses: string[] = [],
  placementStatus?: string
): { step: number; label: string; tone: Tone; closed?: boolean } => {
  if (placementStatus === 'LEFT_DURING_WARRANTY' || placementStatus === 'RESIGNED' || status === 'RESIGNED') {
    return { step: 6, label: 'Đã nghỉ việc', tone: 'neutral', closed: true };
  }
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
    case 'RESIGNED':
      return { step: 6, label: 'Đã nghỉ việc', tone: 'neutral', closed: true };
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
  RECEIVED: { label: 'Đã tiếp nhận', tone: 'info', hint: 'HR Connect đã tiếp nhận hồ sơ và đang kiểm tra thông tin.' },
  PENDING_CONSENT: { label: 'Chờ ứng viên xác nhận', tone: 'warning', hint: 'Đã gửi email, ứng viên cần đồng ý trước khi lời mời hết hạn.' },
  PENDING_IDENTITY_REVIEW: { label: 'Đang xác minh ứng viên', tone: 'warning', hint: 'HR Connect đang kiểm tra thông tin để bảo vệ quyền lợi của các bên.' },
  ACCEPTED: { label: 'Đã cho phép giới thiệu', tone: 'success', hint: 'Ứng viên đã xác nhận cho phép giới thiệu hồ sơ vào vị trí này; quyền ghi nhận của bạn đã được thiết lập.' },
  CONSENT_REJECTED: { label: 'Ứng viên từ chối', tone: 'danger', hint: 'Ứng viên không đồng ý cho bạn giới thiệu.' },
  CONSENT_EXPIRED: { label: 'Hết hạn xác nhận', tone: 'neutral', hint: 'Ứng viên không trả lời trong hạn; hãy tạo lượt giới thiệu mới.' },
  BLOCKED_DUPLICATE: { label: 'Bị chặn do trùng', tone: 'danger', hint: 'Ứng viên đã có hồ sơ trong tin này; người giới thiệu trước vẫn được ghi nhận.' },
  BLOCKED_CLIENT_OWNED: { label: 'Doanh nghiệp đã có hồ sơ', tone: 'neutral', hint: 'Ứng viên đã được doanh nghiệp tiếp nhận trước lượt giới thiệu này.' },
  REJECTED_INVALID: { label: 'Hồ sơ không hợp lệ', tone: 'danger', hint: 'Hồ sơ chưa đáp ứng điều kiện tiếp nhận. Hãy kiểm tra lại thông tin đã gửi.' },
  JOB_UNAVAILABLE: { label: 'Tin không còn nhận hồ sơ', tone: 'neutral', hint: 'Tin tuyển dụng đã đóng hoặc không còn nhận hồ sơ.' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral', hint: 'Lượt giới thiệu đã được kết thúc.' },
};

export const submissionStatus = (s: string) => SUBMISSION_STATUS[s] ?? { label: 'Đang xử lý', tone: 'neutral' as Tone, hint: 'Trạng thái đang được HR Connect cập nhật.' };

export const candidateAiStatus = (status?: string | null) => {
  const labels: Record<string, string> = {
    PENDING: 'Đang chờ đánh giá',
    PROCESSING: 'Đang đánh giá',
    COMPLETED: 'Đã đánh giá',
    FAILED: 'Chưa thể đánh giá',
    SKIPPED: 'Không áp dụng',
  };
  return status ? labels[status.toUpperCase()] ?? 'Đã cập nhật' : 'Chưa có kết quả';
};

export const candidateAiTier = (tier?: string | null) => {
  const labels: Record<string, string> = {
    HIGH: 'Rất phù hợp',
    MEDIUM: 'Khá phù hợp',
    LOW: 'Cần cân nhắc',
  };
  return tier ? labels[tier.toUpperCase()] ?? 'Đã đánh giá' : '—';
};

export const candidateDocumentStatus = (status?: string | null) => {
  const labels: Record<string, string> = {
    ACTIVE: 'Đang sử dụng',
    INACTIVE: 'Ngừng sử dụng',
    DELETED: 'Đã xóa',
    QUARANTINED: 'Đang kiểm tra',
  };
  return status ? labels[status.toUpperCase()] ?? 'Đã cập nhật' : '—';
};

export const candidateInterviewType = (type?: string | null) => {
  const normalized = type?.trim().toUpperCase();
  const labels: Record<string, string> = {
    ONLINE: 'Trực tuyến',
    OFFLINE: 'Trực tiếp',
    ONSITE: 'Trực tiếp',
    IN_PERSON: 'Trực tiếp',
    PHONE: 'Qua điện thoại',
    VIDEO: 'Trực tuyến',
  };
  return normalized ? labels[normalized] ?? type?.trim() ?? 'Phỏng vấn' : 'Phỏng vấn';
};

export const candidateInterviewStatus = (status?: string | null) => {
  const labels: Record<string, string> = {
    SCHEDULED: 'Đã lên lịch',
    CONFIRMED: 'Đã xác nhận tham gia',
    COMPLETED: 'Đã hoàn thành',
    RESCHEDULED: 'Đã dời lịch',
    CANCELLED: 'Đã hủy',
    NO_SHOW: 'Vắng mặt',
  };
  return status ? labels[status.toUpperCase()] ?? 'Đã cập nhật' : 'Đã cập nhật';
};

export const candidateOfferStatus = (status?: string | null) => {
  const labels: Record<string, string> = {
    DRAFT: 'Đang chuẩn bị',
    SENT: 'Chờ phản hồi',
    ACCEPTED: 'Đã chấp nhận',
    DECLINED: 'Đã từ chối',
    EXPIRED: 'Đã hết hạn',
    WITHDRAWN: 'Đã thu hồi',
  };
  return status ? labels[status.toUpperCase()] ?? 'Đã cập nhật' : 'Đã cập nhật';
};

export const ATTRIBUTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Đang hiệu lực', tone: 'success' },
  VOID: { label: 'Đã hủy', tone: 'neutral' },
  DISPUTED: { label: 'Đang tranh chấp', tone: 'warning' },
};
