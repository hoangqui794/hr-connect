import { describe, expect, it } from 'vitest';
import { SALARY_RANGE_CUSTOM, salaryRangeOf } from './jobFormOptions';

// HR feedback 29/10: the salary is picked from ranges; a saved job must reopen on the right one.
describe('salaryRangeOf', () => {
  it('finds the preset matching the saved values', () => {
    expect(salaryRangeOf({ salaryMin: 15_000_000, salaryMax: 20_000_000 })).toBe('15_20');
    expect(salaryRangeOf({ salaryMin: null, salaryMax: 10_000_000 })).toBe('UNDER_10');
    expect(salaryRangeOf({ salaryMin: 50_000_000, salaryMax: null })).toBe('OVER_50');
  });

  it('treats "negotiable without amounts" as the Thỏa thuận preset and empty as not chosen', () => {
    expect(salaryRangeOf({ salaryNegotiable: true })).toBe('NEGOTIABLE');
    expect(salaryRangeOf({})).toBeUndefined();
  });

  it('falls back to custom for other amounts or another currency', () => {
    expect(salaryRangeOf({ salaryMin: 22_000_000, salaryMax: 25_000_000 })).toBe(SALARY_RANGE_CUSTOM);
    expect(salaryRangeOf({ salaryMin: 15_000_000, salaryMax: 20_000_000, currencyCode: 'USD' })).toBe(SALARY_RANGE_CUSTOM);
  });
});
