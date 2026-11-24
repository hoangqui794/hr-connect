import { describe, expect, it } from 'vitest';
import {
  filterBySearch,
  matchesSearch,
  normalizeSearchText,
} from './searchMatch';

describe('searchMatch', () => {
  it('normalizes Vietnamese diacritics, đ/Đ, case and extra spaces', () => {
    expect(normalizeSearchText('  Nguyễn   Đức   Thịnh  ')).toBe('nguyen duc thinh');
    expect(normalizeSearchText('ĐÀ NẴNG')).toBe('da nang');
    expect(normalizeSearchText('   ')).toBe('');
  });

  it('returns true when query is empty or whitespace', () => {
    expect(matchesSearch('', 'ABC')).toBe(true);
    expect(matchesSearch('   ', null, undefined)).toBe(true);
  });

  it('matches accented and unaccented Vietnamese text interchangeably', () => {
    expect(matchesSearch('nguyen van', 'Nguyễn Văn An', 'an@example.com')).toBe(true);
    expect(matchesSearch('nguyễn văn', 'Nguyen Van An')).toBe(true);
    expect(matchesSearch('da nang', 'Kỹ sư phần mềm - Đà Nẵng')).toBe(true);
    expect(matchesSearch('đà nẵng', 'Ky su phan mem - Da Nang')).toBe(true);
  });

  it('handles numeric and nullish fields safely', () => {
    expect(matchesSearch('12345', null, undefined, 12345)).toBe(true);
    expect(matchesSearch('xyz', null, undefined, 'abc')).toBe(false);
  });

  it('filters collections with filterBySearch', () => {
    const rows = [
      { id: '1', name: 'Trần Thị Hoa', job: 'Backend .NET' },
      { id: '2', name: 'Lê Đắc Minh', job: 'Frontend React' },
    ];
    expect(filterBySearch(rows, '', (r) => [r.name, r.job])).toHaveLength(2);
    expect(filterBySearch(rows, 'dac minh', (r) => [r.name, r.job])).toEqual([rows[1]]);
    expect(filterBySearch(rows, 'backend', (r) => [r.name, r.job])).toEqual([rows[0]]);
    expect(filterBySearch(rows, 'không tồn tại', (r) => [r.name, r.job])).toEqual([]);
  });
});
