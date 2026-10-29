/** Human-friendly choices shared by MF-01 job and template forms. */
export const EXPERIENCE_YEAR_OPTIONS = Array.from({ length: 16 }, (_, years) => ({
  value: years,
  label: years === 0 ? 'Không yêu cầu kinh nghiệm' : years === 15 ? 'Từ 15 năm trở lên' : `Tối thiểu ${years} năm`,
}));

export const JOB_EXPERIENCE_SELECT_OPTIONS = [
  { value: 0, label: 'Không yêu cầu kinh nghiệm' },
  { value: 0.5, label: 'Tối thiểu 6 tháng' },
  { value: 1, label: 'Tối thiểu 1 năm' },
  { value: 1.5, label: 'Tối thiểu 1.5 năm' },
  { value: 2, label: 'Tối thiểu 2 năm' },
  { value: 2.5, label: 'Tối thiểu 2.5 năm' },
  { value: 3, label: 'Tối thiểu 3 năm' },
  { value: 5, label: 'Tối thiểu 5 năm' },
  { value: 'custom', label: 'Khác' },
] as const;

export const PRESET_EXPERIENCE_VALUES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 5];

export const LOCATION_OPTIONS = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bình Dương',
  'Đồng Nai',
  'Làm việc từ xa',
  'Kết hợp tại văn phòng và từ xa',
].map((value) => ({ value, label: value }));

export const WORKING_TIME_OPTIONS = [
  { value: 'Thứ 2 – Thứ 6, giờ hành chính', label: 'Thứ 2 – Thứ 6, giờ hành chính' },
  { value: 'Thứ 2 – Thứ 7, giờ hành chính', label: 'Thứ 2 – Thứ 7, giờ hành chính' },
  { value: 'Lịch làm việc linh hoạt', label: 'Lịch làm việc linh hoạt' },
  { value: 'Làm việc theo ca', label: 'Làm việc theo ca' },
  { value: 'Bán thời gian theo lịch thỏa thuận', label: 'Bán thời gian theo lịch thỏa thuận' },
];

export const WARRANTY_DAY_OPTIONS = [30, 45, 60, 90, 120].map((value) => ({
  value,
  label: `${value} ngày`,
}));

export const PAYMENT_DUE_DAY_OPTIONS = [7, 15, 20, 30, 45, 60].map((value) => ({
  value,
  label: `${value} ngày kể từ ngày ứng viên đi làm`,
}));

export const HEADHUNT_FEE_OPTIONS = [
  { value: 1, label: '1 tháng lương' },
  { value: 1.5, label: '1,5 tháng lương' },
  { value: 2, label: '2 tháng lương' },
  { value: 2.5, label: '2,5 tháng lương' },
  { value: 3, label: '3 tháng lương' },
];

/** Salary ranges offered in the job form (VND, gross per month); "CUSTOM" opens the from/to inputs. */
export interface SalaryRangePreset {
  value: string;
  label: string;
  min: number | null;
  max: number | null;
}

const MILLION = 1_000_000;

export const SALARY_RANGE_PRESETS: SalaryRangePreset[] = [
  { value: 'NEGOTIABLE', label: 'Thỏa thuận', min: null, max: null },
  { value: 'UNDER_10', label: 'Dưới 10 triệu', min: null, max: 10 * MILLION },
  { value: '10_15', label: '10 – 15 triệu', min: 10 * MILLION, max: 15 * MILLION },
  { value: '15_20', label: '15 – 20 triệu', min: 15 * MILLION, max: 20 * MILLION },
  { value: '20_30', label: '20 – 30 triệu', min: 20 * MILLION, max: 30 * MILLION },
  { value: '30_50', label: '30 – 50 triệu', min: 30 * MILLION, max: 50 * MILLION },
  { value: 'OVER_50', label: 'Trên 50 triệu', min: 50 * MILLION, max: null },
];

export const SALARY_RANGE_CUSTOM = 'CUSTOM';

/** Which preset the current values match; CUSTOM when values are set but match none, undefined when empty. */
export const salaryRangeOf = (v: {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean;
  currencyCode?: string | null;
}): string | undefined => {
  const min = v.salaryMin ?? null;
  const max = v.salaryMax ?? null;
  if (min == null && max == null) return v.salaryNegotiable ? 'NEGOTIABLE' : undefined;
  if ((v.currencyCode ?? 'VND') !== 'VND') return SALARY_RANGE_CUSTOM;
  return SALARY_RANGE_PRESETS.find((p) => p.value !== 'NEGOTIABLE' && p.min === min && p.max === max)?.value ?? SALARY_RANGE_CUSTOM;
};
