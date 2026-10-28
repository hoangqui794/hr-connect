import { describe, expect, it } from 'vitest';
import type { Job } from '@/types/api/jobs';
import { formatExperience, formatMultilineText, formatPostingPackage, isAwaitingSourcingDeposit, sourcingDepositAmount } from './jobDisplay';
import { EXPERIENCE_YEAR_OPTIONS, JOB_EXPERIENCE_SELECT_OPTIONS } from './jobFormOptions';

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

describe('Nhãn biểu mẫu MF-01', () => {
  it('không hiển thị mã gói kỹ thuật cho người dùng', () => {
    expect(formatPostingPackage('FREE', 'Free')).toBe('Gói dùng thử');
    expect(formatPostingPackage('STANDARD', 'Standard')).toBe('Gói tiêu chuẩn');
    expect(formatPostingPackage('PREMIUM', 'Premium')).toBe('Gói nổi bật');
  });

  it('cho phép chọn một mức kinh nghiệm tối thiểu duy nhất', () => {
    expect(EXPERIENCE_YEAR_OPTIONS[0]).toEqual({ value: 0, label: 'Không yêu cầu kinh nghiệm' });
    expect(EXPERIENCE_YEAR_OPTIONS.find((option) => option.value === 3)?.label).toBe('Tối thiểu 3 năm');
    expect(EXPERIENCE_YEAR_OPTIONS[EXPERIENCE_YEAR_OPTIONS.length - 1]?.label).toBe('Từ 15 năm trở lên');
  });

  it('hỗ trợ hiển thị và lựa chọn kinh nghiệm số lẻ và 6 tháng', () => {
    expect(formatExperience(0.5, null)).toBe('Từ 6 tháng');
    expect(formatExperience(1.5, null)).toBe('Từ 1.5 năm');
    expect(formatExperience(2.5, 2.5)).toBe('2.5 năm');
    expect(formatExperience(0, null)).toBe('Không yêu cầu');

    expect(JOB_EXPERIENCE_SELECT_OPTIONS.some((opt) => opt.value === 0.5 && opt.label === 'Tối thiểu 6 tháng')).toBe(true);
    expect(JOB_EXPERIENCE_SELECT_OPTIONS.some((opt) => opt.value === 1.5 && opt.label === 'Tối thiểu 1.5 năm')).toBe(true);
    const customOpt = JOB_EXPERIENCE_SELECT_OPTIONS.find((opt) => opt.value === 'custom');
    expect(customOpt).toBeDefined();
    expect((customOpt?.label as string) === 'Khác' || customOpt?.label.includes('Tự nhập')).toBe(true);
  });
});

