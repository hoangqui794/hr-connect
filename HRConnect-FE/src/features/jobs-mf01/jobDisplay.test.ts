import { describe, expect, it } from 'vitest';
import type { Job } from '@/types/api/jobs';
import { isAwaitingSourcingDeposit, sourcingDepositAmount } from './jobDisplay';

const terms = (sourcingTarget: number | null, pricePerCv: number | null, depositPercent: number | null) =>
  ({
    commercialTerms: {
      serviceTypeCode: 'CV_SOURCING',
      feeMultiplier: null,
      warrantyDays: null,
      paymentDueDays: 20,
      sourcingTarget,
      pricePerCv,
      depositPercent,
      reviewDays: 7,
      agreedAt: null,
      agreedBy: null,
    },
  }) as Pick<Job, 'commercialTerms'>;

describe('CV_SOURCING deposit', () => {
  it('waits for the deposit only for a CV_SOURCING job in PENDING_PAYMENT', () => {
    expect(isAwaitingSourcingDeposit({ status: 'PENDING_PAYMENT', serviceTypeCode: 'CV_SOURCING' })).toBe(true);
    expect(isAwaitingSourcingDeposit({ status: 'PENDING_PAYMENT', serviceTypeCode: 'CV_APPLICATION' })).toBe(false);
    expect(isAwaitingSourcingDeposit({ status: 'ACTIVE', serviceTypeCode: 'CV_SOURCING' })).toBe(false);
  });

  it('is target × price per CV × deposit percent', () => {
    expect(sourcingDepositAmount(terms(3, 600_000, 50))).toBe(900_000);
    expect(sourcingDepositAmount(terms(10, 600_000, 50))).toBe(3_000_000);
  });

  it('is unknown while a term is missing', () => {
    expect(sourcingDepositAmount(terms(3, null, 50))).toBeNull();
    expect(sourcingDepositAmount({ commercialTerms: null })).toBeNull();
  });
});
