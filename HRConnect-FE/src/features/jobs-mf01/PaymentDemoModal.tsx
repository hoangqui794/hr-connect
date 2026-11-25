/**
 * @file PaymentDemoModal.tsx
 * @description Hộp thanh toán phí gói đăng tin hoặc nộp cọc dịch vụ tìm kiếm hồ sơ (MF-01).
 * Cả phí đăng tin và tiền cọc đều chuyển sang VNPay; callback BE tự ghi nhận và kích hoạt dịch vụ.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Modal, Tag, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CreditCardOutlined,
  FileProtectOutlined,
  InfoCircleOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { formatMoney, usePostingFee, usePostingPackages } from './useJobQueries';
import { formatDate, formatPostingPackage, isDeadlineExpired } from './jobDisplay';
import { financeApi, vnPayApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

interface PaymentDemoModalProps {
  open?: boolean;
  visible?: boolean;
  jobId: string;
  jobTitle: string;
  serviceTypeCode?: string | null;
  depositAmount?: number | null;
  isDeposit?: boolean;
  applicationDeadline?: string | null;
  onSuccess?: () => void;
  onPaymentSuccess?: () => void;
  onClose: () => void;
}

export const PaymentDemoModal: React.FC<PaymentDemoModalProps> = ({
  open,
  visible,
  jobId,
  jobTitle,
  serviceTypeCode,
  depositAmount,
  isDeposit,
  applicationDeadline,
  onClose,
}) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const isOpen = Boolean(open ?? visible);
  const fee = usePostingFee(jobId, isOpen && !isDeposit);
  const packages = usePostingPackages();
  const pkg = packages.data?.find((p) => p.packageId === fee.data?.packageId);
  const [paying, setPaying] = useState(false);

  const isDepositMode = Boolean(isDeposit || serviceTypeCode === 'CV_SOURCING' || (!fee.data && depositAmount));
  const isExpiredUnpublished = isDeadlineExpired(applicationDeadline);
  const finalDepositAmount = depositAmount ?? null;
  const depositFee = useQuery({
    queryKey: ['service-fees', 'deposit', jobId],
    queryFn: () => financeApi.serviceFees({ jobId, kind: 'DEPOSIT', page: 1, pageSize: 10 }),
    enabled: isOpen && isDepositMode && !isExpiredUnpublished,
    staleTime: 30_000,
  });
  const payableDeposit = depositFee.data?.items.find((item) =>
    item.kind === 'DEPOSIT' && ['PENDING', 'DUE', 'OVERDUE'].includes(item.status)
  );
  const displayedAmount = isDepositMode ? (payableDeposit?.amount ?? finalDepositAmount) : (fee.data?.amount ?? null);
  const isActionDisabled = isDepositMode && (!payableDeposit || depositFee.isLoading);

  const handleConfirmPayment = async () => {
    if (isExpiredUnpublished) {
      return;
    }
    setPaying(true);
    try {
      if (isDepositMode) {
        if (!payableDeposit) {
          throw new Error('Chưa tìm thấy khoản đặt cọc cần thanh toán. Vui lòng tải lại trang hoặc liên hệ HR Connect.');
        }
        const { paymentUrl } = await vnPayApi.createPayment('SERVICE_FEE', payableDeposit.serviceFeeId);
        window.location.assign(paymentUrl);
        return;
      }

      const { paymentUrl } = await vnPayApi.createPayment('POSTING_FEE', jobId);
      window.location.assign(paymentUrl);
    } catch (err: any) {
      message.error(getApiErrorMessage(err) || 'Có lỗi xảy ra khi xử lý thanh toán.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={isExpiredUnpublished ? 440 : 460}
      className={FONT}
      title={
        <div className="flex items-center gap-2.5 pr-5 text-slate-900">
          <div
            className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-bold text-base border ${
              isExpiredUnpublished
                ? 'bg-rose-50 text-rose-600 border-rose-200/80'
                : 'bg-sky-50 text-[#0C4A6E] border-sky-100'
            }`}
          >
            {isExpiredUnpublished ? <LockOutlined /> : <CreditCardOutlined />}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base leading-tight">
              {isExpiredUnpublished
                ? (isDepositMode ? 'Đã khóa đặt cọc dịch vụ' : 'Đã khóa thanh toán phí gói')
                : (isDepositMode ? 'Đặt cọc dịch vụ tìm hồ sơ' : 'Thanh toán phí gói đăng tin')}
            </div>
            <div className={`text-xs font-normal mt-0.5 ${isExpiredUnpublished ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
              {isExpiredUnpublished
                ? `Quá hạn nhận hồ sơ từ ${formatDate(applicationDeadline)}`
                : 'Thanh toán an toàn và được xác nhận tự động'}
            </div>
          </div>
        </div>
      }
    >
      {isExpiredUnpublished ? (
        <div className="pt-2 space-y-3">
          {/* Thẻ tóm tắt tin gọn gàng, làm dịu số tiền để tránh cảm giác vẫn đang đòi phí */}
          <div className="rounded-xl border border-solid border-slate-200/90 bg-slate-50/80 p-3.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
                {jobTitle}
              </div>
              <Tag color={isDepositMode ? 'purple' : 'blue'} className="m-0 font-medium shrink-0 text-xs rounded">
                {isDepositMode ? 'CV Sourcing' : formatPostingPackage(fee.data?.packageCode, fee.data?.packageName)}
              </Tag>
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">
                {isDepositMode ? 'Khoản cọc dự kiến:' : 'Mức phí gói:'}
              </span>
              <div className="flex items-center gap-2">
                {displayedAmount != null && (
                  <span className="font-semibold text-slate-400 line-through tabular-nums">
                    {formatMoney(displayedAmount, isDepositMode ? (payableDeposit?.currencyCode ?? 'VND') : (fee.data?.currencyCode ?? 'VND'))}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/70">
                  Không thu phí
                </span>
              </div>
            </div>
          </div>

          {/* Ghi chú ngắn gọn 2 dòng hướng dẫn hành động tiếp theo */}
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/70 bg-rose-50/50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700">
            <InfoCircleOutlined className="mt-0.5 shrink-0 text-rose-500 text-sm" />
            <span>
              Tin chưa công bố nhưng đã qua hạn nộp hồ sơ nên hệ thống tự động ngưng thu phí. Hãy tạo tin mới với hạn nộp mới để tiếp tục tuyển dụng.
            </span>
          </div>

          {/* Footer hướng hành động (Action-oriented UX) */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            {isDepositMode ? (
              <Button
                type="text"
                size="small"
                icon={<FileProtectOutlined />}
                className="!px-2 text-xs font-medium text-slate-500 hover:!text-slate-800"
                onClick={() => {
                  onClose();
                  navigate(`/client/agreements?jobId=${jobId}`);
                }}
              >
                Xem hợp đồng
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button size="middle" onClick={onClose} className="!h-9 rounded-xl border-slate-200 px-4 text-slate-700 font-medium">
                Đóng
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<PlusOutlined />}
                className="!bg-[#0C4A6E] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-sm font-semibold !h-9 px-4"
                onClick={() => {
                  onClose();
                  navigate('/client/jobs/create');
                }}
              >
                Đăng tin mới
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-2 space-y-3.5">
          {/* Khối tóm tắt thông tin gói & số tiền */}
          <div className="rounded-xl border border-solid border-slate-200/90 bg-slate-50 p-4">
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="font-semibold text-slate-900 text-sm leading-snug break-words">
                {jobTitle}
              </div>
              <Tag color={isDepositMode ? 'purple' : 'blue'} className="m-0 font-medium shrink-0 text-xs rounded">
                {isDepositMode ? 'CV Sourcing' : formatPostingPackage(fee.data?.packageCode, fee.data?.packageName)}
              </Tag>
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-dashed border-slate-200">
              <span className="text-xs text-slate-600">Số tiền cần thanh toán:</span>
              <span className="text-xl font-bold text-[#0C4A6E] tabular-nums">
                {displayedAmount == null
                  ? (isDepositMode ? 'HR Connect đang chốt số tiền cọc' : '—')
                  : formatMoney(displayedAmount, isDepositMode ? (payableDeposit?.currencyCode ?? 'VND') : (fee.data?.currencyCode ?? 'VND'))}
              </span>
            </div>

            {!isDepositMode && (
              <div className="text-[11px] text-slate-500 mt-1 text-right">
                {pkg?.durationDays ? `${pkg.durationDays} ngày hiển thị` : '30 ngày hiển thị'}
                {pkg?.maxApplications ? ` • Tối đa ${pkg.maxApplications} hồ sơ` : ''}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-solid border-sky-200/80 bg-sky-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0C4A6E] shadow-xs border border-sky-100">
                <SafetyCertificateOutlined className="text-lg" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-sm">
                  {isDepositMode ? 'Đặt cọc trực tuyến qua VNPay' : 'Thanh toán trực tuyến qua VNPay'}
                </div>
                <p className="m-0 mt-1 text-xs leading-relaxed text-slate-600">
                  Bạn sẽ được chuyển sang cổng VNPay để thanh toán bằng ứng dụng ngân hàng, thẻ ATM hoặc thẻ quốc tế.
                  {isDepositMode ? ' Dịch vụ tìm hồ sơ' : ' Tin tuyển dụng'} tự động được kích hoạt sau khi VNPay xác nhận thành công.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/80 border border-sky-100/80 px-3 py-2 text-xs text-slate-600">
              <CheckCircleOutlined className="text-emerald-600" />
              Không cần gửi ảnh giao dịch hoặc xác nhận thanh toán thủ công.
            </div>
            {isDepositMode && depositFee.isLoading && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Spin size="small" /> Đang tải khoản đặt cọc…</div>
            )}
            {isDepositMode && depositFee.isError && (
              <div className="mt-3 text-xs font-medium text-red-600">Không tải được khoản đặt cọc. Vui lòng đóng và mở lại cửa sổ.</div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100">
            {isDepositMode ? (
              <Button
                size="middle"
                icon={<FileProtectOutlined />}
                className="!h-9 rounded-xl border-slate-200 text-slate-700"
                onClick={() => {
                  onClose();
                  navigate(`/client/agreements?jobId=${jobId}`);
                }}
              >
                Hợp đồng cọc
              </Button>
            ) : (
              <span className="text-xs text-slate-400">
                Tự động công bố sau thanh toán
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button size="middle" onClick={onClose} className="!h-9 rounded-xl border-slate-200 text-slate-700">
                Đóng
              </Button>
              <Button
                type="primary"
                size={isDepositMode ? 'middle' : 'large'}
                icon={isDepositMode ? <CheckCircleOutlined /> : <CreditCardOutlined />}
                loading={paying}
                disabled={isActionDisabled}
                className={
                  isActionDisabled
                    ? 'rounded-xl font-semibold !h-10 px-4'
                    : '!bg-[#0C4A6E] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-sm transition-all active:scale-[0.98] font-semibold !h-10 px-4'
                }
                onClick={handleConfirmPayment}
              >
                {isDepositMode ? 'Đặt cọc qua VNPay' : 'Thanh toán qua VNPay'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
export default PaymentDemoModal;
