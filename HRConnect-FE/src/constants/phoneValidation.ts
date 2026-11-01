const VIETNAM_MOBILE_PHONE_PATTERN = /^(?:\+84|0)(?:3[2-9]|5[25689]|7(?:0|[6-9])|8[1-9]|9[0-9])[0-9]{7}$/;

export const VIETNAM_PHONE_VALIDATION_MESSAGE = 'Số điện thoại Việt Nam chưa hợp lệ.';

export const compactPhoneNumber = (phone: string): string =>
  phone.trim().replace(/[\s().-]/g, '');

export const isValidVietnamPhoneNumber = (phone: unknown): boolean =>
  typeof phone === 'string' && VIETNAM_MOBILE_PHONE_PATTERN.test(compactPhoneNumber(phone));
