import { describe, expect, it } from 'vitest';
import { SERVICE_TYPE_LABEL, serviceTypeText } from './jobDisplay';

// HR feedback 28/10: one naming for the three services, with the codes HR uses in titles and filters.
describe('service type names', () => {
  it('uses the HR names and two-letter codes', () => {
    expect(SERVICE_TYPE_LABEL.HEADHUNT_COD).toMatchObject({ short: 'HH', label: 'Tuyển dụng theo kết quả', name: 'Headhunt COD' });
    expect(SERVICE_TYPE_LABEL.CV_APPLICATION).toMatchObject({ short: 'AP', label: 'Nhận hồ sơ ứng tuyển', name: 'CV Application' });
    expect(SERVICE_TYPE_LABEL.CV_SOURCING).toMatchObject({ short: 'SS', label: 'Tìm hồ sơ phù hợp', name: 'CV Sourcing' });
  });

  it('formats a compact label and falls back to the raw code', () => {
    expect(serviceTypeText('HEADHUNT_COD')).toBe('HH · Tuyển dụng theo kết quả');
    expect(serviceTypeText('UNKNOWN')).toBe('UNKNOWN');
    expect(serviceTypeText(null)).toBe('—');
  });
});
