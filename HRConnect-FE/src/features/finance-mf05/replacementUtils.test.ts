/**
 * @file features/finance-mf05/replacementUtils.test.ts
 * @description Unit tests for replacementUtils (countdown calculation, status mappings, edge cases).
 */
import { describe, expect, it } from 'vitest';
import {
  REPLACEMENT_STATUS_CONFIG,
  calculateDaysLeft,
  getReplacementCountdownInfo,
  isSlotExpired,
} from './replacementUtils';
import type { ReplacementSlotStatus } from '@/types/api/finance';

describe('replacementUtils', () => {
  describe('REPLACEMENT_STATUS_CONFIG', () => {
    it('defines configs for all 5 replacement statuses', () => {
      const statuses: ReplacementSlotStatus[] = ['WAITING_PAYMENT', 'OPEN', 'FILLED', 'CANCELLED', 'EXPIRED'];
      statuses.forEach((status) => {
        expect(REPLACEMENT_STATUS_CONFIG[status]).toBeDefined();
        expect(REPLACEMENT_STATUS_CONFIG[status].label).toBeTruthy();
        expect(REPLACEMENT_STATUS_CONFIG[status].tagColor).toBeTruthy();
        expect(REPLACEMENT_STATUS_CONFIG[status].tone).toBeTruthy();
      });
    });
  });

  describe('calculateDaysLeft', () => {
    it('returns null when expiresAt is missing or null', () => {
      expect(calculateDaysLeft(null)).toBeNull();
      expect(calculateDaysLeft(undefined)).toBeNull();
    });

    it('returns positive days remaining when expiresAt is in the future', () => {
      const now = new Date('2026-10-16T12:00:00Z');
      const expiresAt = '2026-10-26T12:00:00Z'; // 10 days
      expect(calculateDaysLeft(expiresAt, now)).toBe(10);
    });

    it('returns 0 when expiresAt is in the past', () => {
      const now = new Date('2026-10-16T12:00:00Z');
      const expiresAt = '2026-10-15T12:00:00Z';
      expect(calculateDaysLeft(expiresAt, now)).toBe(0);
    });
  });

  describe('isSlotExpired', () => {
    it('returns true when status is EXPIRED', () => {
      expect(isSlotExpired({ status: 'EXPIRED', expiresAt: null })).toBe(true);
    });

    it('returns true when expiresAt is before reference date', () => {
      const now = new Date('2026-10-16T12:00:00Z');
      expect(isSlotExpired({ status: 'OPEN', expiresAt: '2026-10-15T00:00:00Z' }, now)).toBe(true);
    });

    it('returns false when expiresAt is after reference date', () => {
      const now = new Date('2026-10-16T12:00:00Z');
      expect(isSlotExpired({ status: 'OPEN', expiresAt: '2026-10-20T00:00:00Z' }, now)).toBe(false);
    });
  });

  describe('getReplacementCountdownInfo', () => {
    const refDate = new Date('2026-10-16T12:00:00Z');

    it('handles FILLED status', () => {
      const info = getReplacementCountdownInfo({ status: 'FILLED', expiresAt: null }, refDate);
      expect(info.countdownText).toBe('Đã hoàn tất');
      expect(info.badgeColor).toBe('blue');
    });

    it('handles CANCELLED status', () => {
      const info = getReplacementCountdownInfo({ status: 'CANCELLED', expiresAt: null }, refDate);
      expect(info.countdownText).toBe('Đã hủy');
      expect(info.badgeColor).toBe('default');
    });

    it('handles WAITING_PAYMENT status', () => {
      const info = getReplacementCountdownInfo({ status: 'WAITING_PAYMENT', expiresAt: null }, refDate);
      expect(info.countdownText).toBe('Chờ thanh toán');
      expect(info.badgeColor).toBe('gold');
    });

    it('handles OPEN with > 7 days remaining', () => {
      const info = getReplacementCountdownInfo({ status: 'OPEN', expiresAt: '2026-10-30T12:00:00Z' }, refDate);
      expect(info.isExpired).toBe(false);
      expect(info.countdownText).toBe('Còn 14 ngày');
      expect(info.badgeColor).toBe('green');
    });

    it('handles OPEN with <= 7 days remaining', () => {
      const info = getReplacementCountdownInfo({ status: 'OPEN', expiresAt: '2026-10-21T12:00:00Z' }, refDate);
      expect(info.isExpired).toBe(false);
      expect(info.countdownText).toBe('Còn 5 ngày');
      expect(info.badgeColor).toBe('warning');
    });

    it('handles OPEN with < 24 hours remaining', () => {
      const info = getReplacementCountdownInfo({ status: 'OPEN', expiresAt: '2026-10-16T18:00:00Z' }, refDate);
      expect(info.isExpired).toBe(false);
      expect(info.countdownText).toBe('Còn 6 giờ');
      expect(info.badgeColor).toBe('volcano');
    });

    it('handles OPEN with past expiration', () => {
      const info = getReplacementCountdownInfo({ status: 'OPEN', expiresAt: '2026-10-15T12:00:00Z' }, refDate);
      expect(info.isExpired).toBe(true);
      expect(info.countdownText).toBe('Đã hết hạn');
      expect(info.badgeColor).toBe('red');
    });
  });
});
