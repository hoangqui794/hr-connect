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
