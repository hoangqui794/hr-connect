/**
 * TEST 17/10 label fixes: N8/N24 status per service, N18 Sourcing headcount, N12 commission estimate text.
 */
import { describe, expect, it } from 'vitest';
import { applicationStatusOf } from './hrLabels';
import { formatHeadcount } from '@/features/jobs-mf01/jobDisplay';
import { formatEstimate, type JobCommissionEstimate } from '@/features/portal/CommissionEstimateCard';

describe('applicationStatusOf', () => {
  it('labels SHORTLISTED by service', () => {
    expect(applicationStatusOf('SHORTLISTED', 'CV_APPLICATION').label).toBe('Đã chọn phỏng vấn');
    expect(applicationStatusOf('SHORTLISTED', 'HEADHUNT_COD').label).toBe('Đã chọn gửi Client');
    expect(applicationStatusOf('SHORTLISTED', 'CV_SOURCING').label).toBe('Đã chọn · chưa giao CV');
  });

  it('shows the Sourcing hand-over status once the CV is delivered', () => {
    expect(applicationStatusOf('SHORTLISTED', 'CV_SOURCING', 'DELIVERED').label).toBe('Đã giao CV · chờ phản hồi');
    expect(applicationStatusOf('SHORTLISTED', 'CV_SOURCING', 'ACCEPTED').label).toBe('Client đã chấp nhận CV');
  });
});

describe('formatHeadcount', () => {
  it('counts CVs for Sourcing and people otherwise', () => {
    expect(formatHeadcount({ serviceTypeCode: 'CV_SOURCING', quantity: 1, sourcingTarget: 3 })).toBe('3 CV');
    expect(formatHeadcount({ serviceTypeCode: 'HEADHUNT_COD', quantity: 2, sourcingTarget: null })).toBe('2 người');
  });
});

describe('formatEstimate', () => {
  const base: JobCommissionEstimate = {
    jobId: 'j', serviceTypeCode: 'HEADHUNT_COD', hasCommission: true, rateType: 'PERCENT', rateValue: 20,
    feeMultiplier: 1.5, warrantyDays: 30, estimatedMin: null, estimatedMax: null, amountPerCv: null,
    currencyCode: 'VND', explanation: '',
  };

  it('shows a range, a per-CV amount, or the rate', () => {
    expect(formatEstimate({ ...base, estimatedMin: 6_000_000, estimatedMax: 9_000_000 })).toMatch(/6\.000\.000.*9\.000\.000/);
    expect(formatEstimate({ ...base, serviceTypeCode: 'CV_SOURCING', amountPerCv: 180_000 })).toMatch(/180\.000.*CV được chấp nhận/);
    expect(formatEstimate(base)).toBe('20% phí dịch vụ');
    expect(formatEstimate({ ...base, hasCommission: false })).toBeNull();
  });
});
