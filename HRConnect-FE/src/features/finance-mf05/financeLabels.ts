import type { Tone } from '@/features/admin-console/ui';
import type { CommissionStatus, PayoutStatus, ServiceFeeStatus } from '@/types/api/finance';

interface StatusLabel {
  label: string;
  tone: Tone;
  hint?: string;
}

export const COMMISSION_STATUS: Record<CommissionStatus, StatusLabel> = {
  PENDING: { label: 'Chờ đủ 30 ngày', tone: 'neutral', hint: 'Ứng viên chưa đi làm đủ thời hạn bảo hành.' },
  EARNED: { label: 'Đã đạt', tone: 'info', hint: 'Đủ thời hạn bảo hành; chờ Client trả phí và Admin duyệt.' },
  PAYABLE: { label: 'Chờ chi', tone: 'warning', hint: 'Admin đã duyệt, chờ chuyển khoản.' },
  PAID: { label: 'Đã chi', tone: 'success' },
  ON_HOLD: { label: 'Tạm giữ', tone: 'warning', hint: 'Client báo ứng viên nghỉ; chờ Internal HR xác minh.' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
};

export const SERVICE_FEE_STATUS: Record<ServiceFeeStatus, StatusLabel> = {
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
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

export const WARRANTY_STATUS: Record<string, StatusLabel> = {
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
