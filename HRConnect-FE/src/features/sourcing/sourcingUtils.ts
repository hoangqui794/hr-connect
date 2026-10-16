/**
 * @file features/sourcing/sourcingUtils.ts
 * @description Utilities and helper functions for MF-03 CV Sourcing deliveries:
 *   - 7-day review window calculations & countdown
 *   - Status labels and color tokens
 *   - Rejection reason codes and human-readable Vietnamese labels
 */

import dayjs from 'dayjs';
import type { SourcingDeliveryStatus, SourcingRejectReasonCode } from '@/types/api/sourcing';

export interface SourcingStatusConfig {
  label: string;
  tagColor: string;
  badgeTone: 'default' | 'processing' | 'success' | 'error' | 'warning';
  description: string;
}

export const SOURCING_STATUS_CONFIG: Record<SourcingDeliveryStatus, SourcingStatusConfig> = {
  DELIVERED: {
    label: 'Chờ phản hồi',
    tagColor: 'processing',
    badgeTone: 'processing',
    description: 'CV đã bàn giao, đang chờ Doanh nghiệp xem xét (thời hạn 7 ngày).',
  },
  ACCEPTED: {
    label: 'Đã chấp nhận',
    tagColor: 'success',
    badgeTone: 'success',
    description: 'Doanh nghiệp đã chấp nhận CV hợp lệ.',
  },
  AUTO_ACCEPTED: {
    label: 'Tự động chấp nhận',
    tagColor: 'green',
    badgeTone: 'success',
    description: 'Quá 7 ngày chưa phản hồi, hệ thống tự động tính là đã chấp nhận.',
  },
  REJECTED: {
    label: 'Đã từ chối',
    tagColor: 'error',
    badgeTone: 'error',
    description: 'Doanh nghiệp đã từ chối CV kèm lý do hợp lệ.',
  },
  REPLACED: {
    label: 'Đã thay thế',
    tagColor: 'default',
    badgeTone: 'default',
    description: 'CV bị từ chối hợp lệ đã được Internal HR thay bằng CV dự phòng khác.',
  },
};

export const SOURCING_REJECT_REASONS: { value: SourcingRejectReasonCode; label: string; description: string }[] = [
  {
    value: 'DUPLICATE_ALREADY_OWNED',
    label: 'Ứng viên công ty đã có sẵn',
    description: 'Ứng viên đã nộp trực tiếp hoặc công ty đã có thông tin trước đó.',
  },
  {
    value: 'FALSE_INFORMATION',
    label: 'Thông tin ứng viên sai sự thật',
    description: 'Thông tin trong hồ sơ không đúng thực tế hoặc giả mạo.',
  },
  {
    value: 'UNREACHABLE',
    label: 'Không liên lạc được / hết nhu cầu',
    description: 'Không thể liên lạc được hoặc ứng viên không còn nhu cầu tìm việc.',
  },
  {
    value: 'WRONG_JOB',
    label: 'Không đúng job hoặc tiêu chí cơ bản',
    description: 'Hồ sơ không đúng vị trí hoặc thiếu các tiêu chí bắt buộc cơ bản.',
  },
  {
    value: 'OTHER',
    label: 'Lý do khác (bắt buộc ghi chú)',
    description: 'Lý do khác cần ghi chú cụ thể để Internal HR xác minh.',
  },
];

export const getRejectReasonLabel = (reasonCode?: string | null): string => {
  if (!reasonCode) return '—';
  const found = SOURCING_REJECT_REASONS.find((r) => r.value === reasonCode);
  return found ? found.label : reasonCode;
};

/**
 * Calculates days remaining until reviewDueAt.
 * Mirrors backend rule: Math.Max(0, (int)Math.Ceiling((reviewDueAt - now).TotalDays)).
 */
export const calculateDaysLeft = (reviewDueAt: string | Date, now: Date = new Date()): number => {
  const due = dayjs(reviewDueAt);
  const current = dayjs(now);
  const diffDays = due.diff(current, 'day', true);
  return Math.max(0, Math.ceil(diffDays));
};

/**
 * Checks whether the 7-day review window has closed (now > reviewDueAt).
 */
export const isReviewWindowClosed = (reviewDueAt: string | Date, now: Date = new Date()): boolean => {
  return dayjs(now).isAfter(dayjs(reviewDueAt));
};

export interface DeadlineInfo {
  isExpired: boolean;
  daysLeft: number;
  formattedDueAt: string;
  countdownText: string;
  badgeTone: 'default' | 'processing' | 'success' | 'error' | 'warning';
  canDecide: boolean;
}

/**
 * Calculates comprehensive deadline info for a sourcing delivery item.
 */
export const getSourcingReviewDeadlineInfo = (
  delivery: {
    status: SourcingDeliveryStatus;
    reviewDueAt: string;
    daysLeft?: number | null;
  },
  now: Date = new Date()
): DeadlineInfo => {
  const isExpired = isReviewWindowClosed(delivery.reviewDueAt, now);
  const daysLeft = delivery.daysLeft != null ? Math.max(0, delivery.daysLeft) : calculateDaysLeft(delivery.reviewDueAt, now);
  const formattedDueAt = dayjs(delivery.reviewDueAt).format('HH:mm DD/MM/YYYY');

  if (delivery.status !== 'DELIVERED') {
    return {
      isExpired,
      daysLeft,
      formattedDueAt,
      countdownText: delivery.status === 'AUTO_ACCEPTED' ? 'Tự động chấp nhận (quá 7 ngày)' : 'Đã kết thúc xem xét',
      badgeTone: 'default',
      canDecide: false,
    };
  }

  if (isExpired || daysLeft <= 0) {
    return {
      isExpired: true,
      daysLeft: 0,
      formattedDueAt,
      countdownText: 'Quá hạn 7 ngày (Tự động chấp nhận)',
      badgeTone: 'error',
      canDecide: false,
    };
  }

  let countdownText = `Còn ${daysLeft} ngày`;
  let badgeTone: 'warning' | 'processing' = 'processing';
  if (daysLeft <= 1) {
    countdownText = 'Hạn hôm nay (còn dưới 24h)';
    badgeTone = 'warning';
  } else if (daysLeft <= 3) {
    badgeTone = 'warning';
  }

  return {
    isExpired: false,
    daysLeft,
    formattedDueAt,
    countdownText,
    badgeTone,
    canDecide: true,
  };
};
