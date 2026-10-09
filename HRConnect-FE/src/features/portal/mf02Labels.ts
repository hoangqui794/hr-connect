/**
 * @file mf02Labels.ts
 * @description Vietnamese wording for MF-02 codes and candidate-facing application stages.
 */
import type { Tone } from '@/features/admin-console/ui';

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
export const CANDIDATE_STEPS = ['Đã nộp', 'Đang được xem', 'Được chọn', 'Phỏng vấn', 'Offer', 'Đi làm'] as const;

export const candidateStage = (status: string): { step: number; label: string; tone: Tone; closed?: boolean } => {
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
      return { step: 4, label: 'Đang chuẩn bị offer', tone: 'success' };
    case 'OFFER_ACCEPTED':
      return { step: 4, label: 'Đã nhận offer', tone: 'success' };
    case 'PLACED':
      return { step: 5, label: 'Đã đi làm', tone: 'success', closed: true };
    case 'REJECTED':
      return { step: 1, label: 'Chưa phù hợp lần này', tone: 'neutral', closed: true };
    case 'BACKUP_NOT_SELECTED':
    case 'INTERVIEW_FAILED':
      return { step: 3, label: 'Chưa phù hợp lần này', tone: 'neutral', closed: true };
    case 'OFFER_DECLINED':
      return { step: 4, label: 'Đã từ chối offer', tone: 'neutral', closed: true };
    case 'NOT_STARTED':
      return { step: 4, label: 'Không nhận việc', tone: 'neutral', closed: true };
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
  ACCEPTED: { label: 'Ứng viên đã đồng ý', tone: 'success', hint: 'Hồ sơ đã vào quy trình tuyển dụng và được ghi attribution cho bạn.' },
  CONSENT_REJECTED: { label: 'Ứng viên từ chối', tone: 'danger', hint: 'Ứng viên không đồng ý cho bạn giới thiệu.' },
  CONSENT_EXPIRED: { label: 'Hết hạn xác nhận', tone: 'neutral', hint: 'Ứng viên không trả lời trong hạn; hãy tạo lượt giới thiệu mới.' },
  BLOCKED_DUPLICATE: { label: 'Bị chặn do trùng', tone: 'danger', hint: 'Ứng viên đã có hồ sơ trong tin này; attribution cũ được giữ nguyên.' },
  JOB_UNAVAILABLE: { label: 'Tin không còn nhận hồ sơ', tone: 'neutral', hint: 'Job đã đóng hoặc không còn cho phép nhận hồ sơ.' },
};

export const submissionStatus = (s: string) => SUBMISSION_STATUS[s] ?? { label: s, tone: 'neutral' as Tone, hint: '' };

export const ATTRIBUTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Đang hiệu lực', tone: 'success' },
  VOID: { label: 'Đã hủy', tone: 'neutral' },
  DISPUTED: { label: 'Đang tranh chấp', tone: 'warning' },
};
