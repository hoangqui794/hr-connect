/**
 * @file hrLabels.ts
 * @description Vietnamese labels and tones for backend codes used in the HR workspace
 * (ApplicationStates, ApplicationReasonCodes, interview/offer/placement statuses).
 * Unknown codes fall back to the code itself.
 */
import type { Tone } from '@/features/admin-console/ui';

export const APPLICATION_STATUS: Record<string, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'Mới nộp', tone: 'warning' },
  SCREENING: { label: 'Đang sàng lọc', tone: 'info' },
  SHORTLISTED: { label: 'Đã chọn gửi Client', tone: 'success' },
  REJECTED: { label: 'Đã loại', tone: 'danger' },
  BACKUP: { label: 'Dự phòng', tone: 'neutral' },
  BACKUP_NOT_SELECTED: { label: 'Dự phòng không chọn', tone: 'neutral' },
  INTERVIEW: { label: 'Đang phỏng vấn', tone: 'info' },
  INTERVIEW_FAILED: { label: 'Trượt phỏng vấn', tone: 'danger' },
  OFFER_PENDING: { label: 'Chờ phản hồi offer', tone: 'warning' },
  OFFER_ACCEPTED: { label: 'Đã nhận offer', tone: 'success' },
  OFFER_DECLINED: { label: 'Từ chối offer', tone: 'danger' },
  NOT_STARTED: { label: 'Không đi làm', tone: 'danger' },
  WITHDRAWN: { label: 'Đã rút hồ sơ', tone: 'neutral' },
  PLACED: { label: 'Đã đi làm', tone: 'success' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
};

export const statusOf = (code: string) => APPLICATION_STATUS[code] ?? { label: code, tone: 'neutral' as Tone };

/** ApplicationReasonCodes.ScreeningRejectionCodes, in backend order. */
export const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: 'SKILL_MISMATCH', label: 'Thiếu kỹ năng yêu cầu' },
  { value: 'INSUFFICIENT_EXPERIENCE', label: 'Chưa đủ kinh nghiệm' },
  { value: 'SALARY_MISMATCH', label: 'Mức lương không phù hợp' },
  { value: 'LOCATION_MISMATCH', label: 'Địa điểm không phù hợp' },
  { value: 'LANGUAGE_REQUIREMENT', label: 'Không đạt yêu cầu ngoại ngữ' },
  { value: 'CANDIDATE_UNREACHABLE', label: 'Không liên hệ được ứng viên' },
  { value: 'POSITION_FILLED', label: 'Vị trí đã tuyển đủ' },
  { value: 'OTHER', label: 'Lý do khác (cần ghi chú)' },
];

export const reasonLabel = (code?: string | null) =>
  code ? REJECTION_REASONS.find((r) => r.value === code)?.label ?? code : null;

export const SERVICE_TYPE: Record<string, string> = {
  HEADHUNT_COD: 'Headhunt (trả phí khi tuyển được)',
  CV_SOURCING: 'Tìm nguồn CV',
  CV_APPLICATION: 'Đăng tin nhận CV',
};

export const INTERVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  SCHEDULED: { label: 'Đã lên lịch', tone: 'info' },
  COMPLETED: { label: 'Đã phỏng vấn', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
  NO_SHOW: { label: 'Vắng mặt', tone: 'danger' },
};

export const INTERVIEW_RESULT: Record<string, string> = { PASS: 'Đạt', FAIL: 'Không đạt', BACKUP: 'Dự phòng' };

export const OFFER_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  SENT: { label: 'Đã gửi', tone: 'info' },
  ACCEPTED: { label: 'Đã nhận', tone: 'success' },
  DECLINED: { label: 'Từ chối', tone: 'danger' },
  WITHDRAWN: { label: 'Đã thu hồi', tone: 'neutral' },
  EXPIRED: { label: 'Hết hạn', tone: 'warning' },
};

/** PlacementStates: the backend currently only writes STARTED. */
export const PLACEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  STARTED: { label: 'Đã đi làm', tone: 'success' },
};

export const pick = (map: Record<string, { label: string; tone: Tone }>, code: string) =>
  map[code] ?? { label: code, tone: 'neutral' as Tone };

/** candidateHighlight is a JSON array encoded as a string; fall back to the raw text. */
export const parseHighlights = (raw?: string | null): string[] => {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.map(String) : [String(value)];
  } catch {
    return [raw];
  }
};
