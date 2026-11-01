import { describe, expect, it } from 'vitest';
import { compactPhoneNumber, isValidVietnamPhoneNumber } from './phoneValidation';

describe('phoneValidation', () => {
  it.each([
    '0777569597',
    '0912345678',
    '0522345678',
    '0552345678',
    '+84912345678',
    '0912 345 678',
    '(077) 756-9597',
  ])('accepts a supported Vietnamese mobile number: %s', (phone) => {
    expect(isValidVietnamPhoneNumber(phone)).toBe(true);
  });

  it.each([
    '0122010010',
    '01227569597',
    '0223456789',
    '12345',
    '',
    undefined,
  ])('rejects an invalid or legacy phone number: %s', (phone) => {
    expect(isValidVietnamPhoneNumber(phone)).toBe(false);
  });

  it('removes presentation formatting before validation', () => {
    expect(compactPhoneNumber('+84 (912) 345-678')).toBe('+84912345678');
  });
});
