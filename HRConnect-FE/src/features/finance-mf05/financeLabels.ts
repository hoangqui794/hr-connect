import type { Tone } from '@/features/admin-console/ui';
import type { CommissionStatus, PayoutStatus, ServiceFeeStatus, WarrantyStatus } from '@/types/api/finance';

interface StatusLabel {
  label: string;
  tone: Tone;
  hint?: string;
}

export const COMMISSION_STATUS: Record<CommissionStatus, StatusLabel> = {
  PENDING: { label: 'Đang chờ ứng viên đi làm', tone: 'neutral', hint: 'Đã giới thiệu hợp lệ, ứng viên chưa bắt đầu đi làm.' },
  IN_WARRANTY: { label: 'Đang trong thời gian bảo hành', tone: 'info', hint: 'Ứng viên đã đi làm; hoa hồng đạt khi ứng viên làm đủ thời gian bảo hành của job.' },
  ON_HOLD: { label: 'Tạm giữ – đang xác minh', tone: 'warning', hint: 'Client báo ứng viên nghỉ việc, Internal HR đang xác minh.' },
  EARNED: { label: 'Đã đạt, chờ Client thanh toán', tone: 'info', hint: 'Ứng viên đã làm đủ thời gian bảo hành; chờ Client thanh toán phí dịch vụ.' },
  PAYABLE: { label: 'Chờ chuyển tiền', tone: 'warning', hint: 'Client đã thanh toán và Admin đã duyệt, chờ chuyển khoản cho Affiliate.' },
  PAID: { label: 'Đã nhận', tone: 'success', hint: 'HR Connect đã chuyển khoản hoa hồng cho Affiliate.' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger', hint: 'Ứng viên nghỉ trước khi hết thời gian bảo hành (đã xác minh).' },
};

export const SERVICE_FEE_STATUS: Record<ServiceFeeStatus, StatusLabel> = {
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  DUE: { label: 'Sắp đến hạn', tone: 'warning' },
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  OVERDUE: { label: 'Quá hạn', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

export const PAYOUT_STATUS: Record<PayoutStatus, StatusLabel> = {
  PENDING: { label: 'Đang xử lý', tone: 'neutral' },
  COMPLETED: { label: 'Thành công', tone: 'success' },
  FAILED: { label: 'Thất bại', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

export const WARRANTY_STATUS: Record<WarrantyStatus, StatusLabel> = {
  ACTIVE: { label: 'Đang bảo hành', tone: 'info' },
  CLAIMED: { label: 'Báo nghỉ — chờ xác minh', tone: 'warning' },
  PASSED: { label: 'Đã qua bảo hành', tone: 'success' },
  VOIDED: { label: 'Nghỉ trong bảo hành', tone: 'danger' },
};

export const labelOf = <T extends string>(map: Record<T, StatusLabel>, status?: T | null): StatusLabel =>
  (status && map[status]) || { label: status ?? '—', tone: 'neutral' };

export const money = (amount?: number | null, currency = 'VND') =>
  amount === null || amount === undefined
    ? '—'
    : `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ${currency === 'VND' ? 'đ' : currency}`;

export const date = (value?: string | null) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');
