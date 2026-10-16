/**
 * @file features/sourcing/sourcingUtils.test.ts
 * @description Unit tests for 7-day review window calculations, deadline countdown, and status utils.
 */

import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  calculateDaysLeft,
  isReviewWindowClosed,
  getSourcingReviewDeadlineInfo,
  getRejectReasonLabel,
  SOURCING_STATUS_CONFIG,
} from './sourcingUtils';

describe('sourcingUtils', () => {
  const baseNow = new Date('2026-10-16T10:00:00Z');

  describe('calculateDaysLeft', () => {
    it('returns 7 when reviewDueAt is exactly 7 days in the future', () => {
      const reviewDueAt = '2026-10-23T10:00:00Z';
      expect(calculateDaysLeft(reviewDueAt, baseNow)).toBe(7);
    });

    it('returns ceiling of fractional days (e.g. 6.2 days -> 7 days)', () => {
      const reviewDueAt = '2026-10-22T14:48:00Z'; // 6.2 days later
      expect(calculateDaysLeft(reviewDueAt, baseNow)).toBe(7);
    });

    it('returns 1 day when reviewDueAt is within the next 24 hours', () => {
      const reviewDueAt = '2026-10-16T18:00:00Z'; // 8 hours later
      expect(calculateDaysLeft(reviewDueAt, baseNow)).toBe(1);
    });

    it('returns 0 when reviewDueAt is in the past', () => {
      const reviewDueAt = '2026-10-15T10:00:00Z'; // yesterday
      expect(calculateDaysLeft(reviewDueAt, baseNow)).toBe(0);
    });
  });

  describe('isReviewWindowClosed', () => {
    it('returns false when current time is before reviewDueAt', () => {
      const reviewDueAt = '2026-10-23T10:00:00Z';
      expect(isReviewWindowClosed(reviewDueAt, baseNow)).toBe(false);
    });

    it('returns true when current time is after reviewDueAt', () => {
      const reviewDueAt = '2026-10-16T09:00:00Z';
      expect(isReviewWindowClosed(reviewDueAt, baseNow)).toBe(true);
    });
  });

  describe('getSourcingReviewDeadlineInfo', () => {
    it('provides active countdown and canDecide=true for DELIVERED delivery within 7-day window', () => {
      const delivery = {
        status: 'DELIVERED' as const,
        reviewDueAt: '2026-10-21T10:00:00Z', // 5 days left
      };

      const info = getSourcingReviewDeadlineInfo(delivery, baseNow);

      expect(info.isExpired).toBe(false);
      expect(info.canDecide).toBe(true);
      expect(info.daysLeft).toBe(5);
      expect(info.countdownText).toBe('Còn 5 ngày');
    });

    it('shows warning tone and special label when 1 day or less remaining', () => {
      const delivery = {
        status: 'DELIVERED' as const,
        reviewDueAt: '2026-10-17T02:00:00Z', // 16 hours left
      };

      const info = getSourcingReviewDeadlineInfo(delivery, baseNow);

      expect(info.isExpired).toBe(false);
      expect(info.canDecide).toBe(true);
      expect(info.daysLeft).toBe(1);
      expect(info.countdownText).toBe('Hạn hôm nay (còn dưới 24h)');
      expect(info.badgeTone).toBe('warning');
    });

    it('marks isExpired=true and canDecide=false when 7 days have passed without response', () => {
      const delivery = {
        status: 'DELIVERED' as const,
        reviewDueAt: '2026-10-15T10:00:00Z', // past due
      };

      const info = getSourcingReviewDeadlineInfo(delivery, baseNow);

      expect(info.isExpired).toBe(true);
      expect(info.canDecide).toBe(false);
      expect(info.daysLeft).toBe(0);
      expect(info.countdownText).toContain('Quá hạn 7 ngày');
      expect(info.badgeTone).toBe('error');
    });

    it('disables decision for AUTO_ACCEPTED deliveries', () => {
      const delivery = {
        status: 'AUTO_ACCEPTED' as const,
        reviewDueAt: '2026-10-15T10:00:00Z',
      };

      const info = getSourcingReviewDeadlineInfo(delivery, baseNow);

      expect(info.canDecide).toBe(false);
      expect(info.countdownText).toBe('Tự động chấp nhận (quá 7 ngày)');
    });

    it('disables decision for ACCEPTED deliveries', () => {
      const delivery = {
        status: 'ACCEPTED' as const,
        reviewDueAt: '2026-10-23T10:00:00Z',
      };

      const info = getSourcingReviewDeadlineInfo(delivery, baseNow);

      expect(info.canDecide).toBe(false);
      expect(info.countdownText).toBe('Đã kết thúc xem xét');
    });

    it('disables decision for REJECTED deliveries', () => {
      const delivery = {
        status: 'REJECTED' as const,
        reviewDueAt: '2026-10-23T10:00:00Z',
      };

      const info = getSourcingReviewDeadlineInfo(delivery, baseNow);

      expect(info.canDecide).toBe(false);
      expect(info.countdownText).toBe('Đã kết thúc xem xét');
    });
  });

  describe('getRejectReasonLabel', () => {
    it('returns proper Vietnamese labels for known reasons', () => {
      expect(getRejectReasonLabel('DUPLICATE_ALREADY_OWNED')).toBe('Ứng viên công ty đã có sẵn');
      expect(getRejectReasonLabel('FALSE_INFORMATION')).toBe('Thông tin ứng viên sai sự thật');
      expect(getRejectReasonLabel('UNREACHABLE')).toBe('Không liên lạc được / hết nhu cầu');
      expect(getRejectReasonLabel('WRONG_JOB')).toBe('Không đúng job hoặc tiêu chí cơ bản');
      expect(getRejectReasonLabel('OTHER')).toBe('Lý do khác (bắt buộc ghi chú)');
    });

    it('returns raw code for unrecognized codes', () => {
      expect(getRejectReasonLabel('CUSTOM_REASON')).toBe('CUSTOM_REASON');
    });

    it('returns — for null or undefined', () => {
      expect(getRejectReasonLabel(null)).toBe('—');
      expect(getRejectReasonLabel(undefined)).toBe('—');
    });
  });

  describe('SOURCING_STATUS_CONFIG', () => {
    it('contains configs for all statuses', () => {
      expect(SOURCING_STATUS_CONFIG.DELIVERED.label).toBe('Chờ phản hồi');
      expect(SOURCING_STATUS_CONFIG.ACCEPTED.label).toBe('Đã chấp nhận');
      expect(SOURCING_STATUS_CONFIG.AUTO_ACCEPTED.label).toBe('Tự động chấp nhận');
      expect(SOURCING_STATUS_CONFIG.REJECTED.label).toBe('Đã từ chối');
      expect(SOURCING_STATUS_CONFIG.REPLACED.label).toBe('Đã thay thế');
    });
  });
});
