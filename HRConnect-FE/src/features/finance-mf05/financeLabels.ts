import type { Tone } from '@/features/admin-console/ui';
import type { CommissionStatus, PayoutStatus, ServiceFeeStatus, WarrantyStatus } from '@/types/api/finance';

interface StatusLabel {
  label: string;
  tone: Tone;
  hint?: string;
}

export const COMMISSION_STATUS: Record<CommissionStatus, StatusLabel> = {
  PENDING: { label: 'Mới ghi nhận', tone: 'neutral', hint: 'Mới có giới thiệu/Attribution hợp lệ, chờ ứng viên đi làm.' },
  EARNED: { label: 'Đã đạt mốc đi làm', tone: 'info', hint: 'Ứng viên đã chính thức nhận việc và bắt đầu làm việc.' },
  ON_HOLD: { label: 'Đang trong bảo hành', tone: 'warning', hint: 'Đang trong thời gian bảo hành thử việc, hoa hồng được tạm giữ bảo lưu.' },
  PAYABLE: { label: 'Chờ chi trả', tone: 'warning', hint: 'Đã qua thời hạn bảo hành và Client đã thanh toán phí dịch vụ, đủ điều kiện payout.' },
  PAID: { label: 'Đã thanh toán', tone: 'success', hint: 'HR Connect đã chuyển khoản hoa hồng cho Affiliate.' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger', hint: 'Ứng viên nghỉ trong bảo hành hoặc hợp đồng bị hủy theo quy định.' },
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
