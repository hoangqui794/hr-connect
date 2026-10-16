/**
 * @file features/finance-mf05/replacementUtils.ts
 * @description Helper functions and UI configurations for MF-05 Replacement Slots (Suất tuyển thay thế).
 */
import dayjs from 'dayjs';
import type { ReplacementSlotDto, ReplacementSlotStatus } from '@/types/api/finance';

export interface ReplacementStatusConfig {
  label: string;
  tagColor: string;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  badgeStatus: 'success' | 'processing' | 'default' | 'error' | 'warning';
  description: string;
}

export const REPLACEMENT_STATUS_CONFIG: Record<ReplacementSlotStatus, ReplacementStatusConfig> = {
  OPEN: {
    label: 'Đang tìm ứng viên',
    tagColor: 'green',
    tone: 'success',
    badgeStatus: 'processing',
    description: 'Suất tuyển thay thế đang có hiệu lực. Doanh nghiệp và HR Connect có thể tiếp nhận hồ sơ giới thiệu thay thế miễn phí.',
  },
  WAITING_PAYMENT: {
    label: 'Chờ thanh toán phí',
    tagColor: 'gold',
    tone: 'warning',
    badgeStatus: 'warning',
    description: 'Ứng viên đã nghỉ việc trong bảo hành. Suất thay thế sẽ tự động kích hoạt sau khi Doanh nghiệp thanh toán phí dịch vụ.',
  },
  FILLED: {
    label: 'Đã hoàn tất thay thế',
    tagColor: 'blue',
    tone: 'info',
    badgeStatus: 'success',
    description: 'Đã có ứng viên thay thế đi làm chính thức cho vị trí này.',
  },
  CANCELLED: {
    label: 'Đã hủy',
    tagColor: 'default',
    tone: 'neutral',
    badgeStatus: 'default',
    description: 'Suất thay thế đã được Internal HR hủy bỏ theo thỏa thuận.',
  },
  EXPIRED: {
    label: 'Đã hết hạn',
    tagColor: 'red',
    tone: 'danger',
    badgeStatus: 'error',
    description: 'Đã quá thời hạn 30 ngày tìm người thay thế.',
  },
};

/**
 * Calculates remaining days/hours until expiresAt.
 */
export function calculateDaysLeft(expiresAt: string | null | undefined, referenceDate = new Date()): number | null {
  if (!expiresAt) return null;
  const target = dayjs(expiresAt);
  const now = dayjs(referenceDate);
  const diffHours = target.diff(now, 'hour', true);
  if (diffHours <= 0) return 0;
  return Math.ceil(diffHours / 24);
}

/**
 * Checks whether the replacement slot window is closed or expired.
 */
export function isSlotExpired(slot: { expiresAt: string | null; status: ReplacementSlotStatus }, referenceDate = new Date()): boolean {
  if (slot.status === 'EXPIRED') return true;
  if (!slot.expiresAt) return false;
  return dayjs(slot.expiresAt).isBefore(dayjs(referenceDate));
}

/**
 * Returns formatted countdown display and styling information.
 */
export function getReplacementCountdownInfo(
  slot: { expiresAt: string | null; status: ReplacementSlotStatus },
  referenceDate = new Date()
): {
  isExpired: boolean;
  countdownText: string;
  badgeColor: string;
  daysRemaining: number | null;
} {
  if (slot.status === 'FILLED') {
    return { isExpired: false, countdownText: 'Đã hoàn tất', badgeColor: 'blue', daysRemaining: null };
  }
  if (slot.status === 'CANCELLED') {
    return { isExpired: false, countdownText: 'Đã hủy', badgeColor: 'default', daysRemaining: null };
  }
  if (slot.status === 'WAITING_PAYMENT') {
    return { isExpired: false, countdownText: 'Chờ thanh toán', badgeColor: 'gold', daysRemaining: null };
  }

  if (!slot.expiresAt) {
    return { isExpired: false, countdownText: 'Không giới hạn', badgeColor: 'blue', daysRemaining: null };
  }

  const target = dayjs(slot.expiresAt);
  const now = dayjs(referenceDate);
  const diffHours = target.diff(now, 'hour');

  if (diffHours <= 0 || slot.status === 'EXPIRED') {
    return { isExpired: true, countdownText: 'Đã hết hạn', badgeColor: 'red', daysRemaining: 0 };
  }

  if (diffHours < 24) {
    return {
      isExpired: false,
      countdownText: `Còn ${Math.max(1, diffHours)} giờ`,
      badgeColor: 'volcano',
      daysRemaining: 1,
    };
  }

  const days = Math.ceil(diffHours / 24);
  return {
    isExpired: false,
    countdownText: `Còn ${days} ngày`,
    badgeColor: days <= 7 ? 'warning' : 'green',
    daysRemaining: days,
  };
}
