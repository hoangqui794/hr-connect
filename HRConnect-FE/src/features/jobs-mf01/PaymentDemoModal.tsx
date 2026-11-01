/**
 * @file PaymentDemoModal.tsx
 * @description Hộp thanh toán phí gói đăng tin hoặc nộp cọc dịch vụ tìm kiếm hồ sơ (MF-01).
 * Cả phí đăng tin và tiền cọc đều chuyển sang VNPay; callback BE tự ghi nhận và kích hoạt dịch vụ.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Modal, Tag, message, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CreditCardOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { formatMoney, usePostingFee, usePostingPackages } from './useJobQueries';
import { formatPostingPackage } from './jobDisplay';
import { financeApi, vnPayApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';

interface PaymentDemoModalProps {
  open?: boolean;
  visible?: boolean;
  jobId: string;
  jobTitle: string;
  serviceTypeCode?: string | null;
  depositAmount?: number | null;
  isDeposit?: boolean;
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
  onClose,
}) => {
  const navigate = useNavigate();
  const isOpen = Boolean(open ?? visible);
  const fee = usePostingFee(jobId, isOpen && !isDeposit);
  const packages = usePostingPackages();
  const pkg = packages.data?.find((p) => p.packageId === fee.data?.packageId);
  const [paying, setPaying] = useState(false);

  const isDepositMode = Boolean(isDeposit || serviceTypeCode === 'CV_SOURCING' || (!fee.data && depositAmount));
  const finalDepositAmount = depositAmount ?? 200000;
  const depositFee = useQuery({
    queryKey: ['service-fees', 'deposit', jobId],
    queryFn: () => financeApi.serviceFees({ jobId, kind: 'DEPOSIT', page: 1, pageSize: 10 }),
    enabled: isOpen && isDepositMode,
    staleTime: 30_000,
  });
  const payableDeposit = depositFee.data?.items.find((item) =>
    item.kind === 'DEPOSIT' && ['PENDING', 'DUE', 'OVERDUE'].includes(item.status)
  );
  const displayedAmount = isDepositMode ? (payableDeposit?.amount ?? finalDepositAmount) : (fee.data?.amount ?? 1_500_000);

  const handleConfirmPayment = async () => {
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
      width={460}
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base">
            <CreditCardOutlined />
          </div>
          <div>
            <div className="font-bold text-base leading-tight">
              {isDepositMode ? 'Đặt cọc dịch vụ tìm hồ sơ' : 'Thanh toán phí gói đăng tin'}
            </div>
            <div className="text-[12px] text-slate-500 font-normal">
              Thanh toán an toàn và được xác nhận tự động
            </div>
          </div>
        </div>
      }
    >
      <div className="py-2 space-y-3.5">
        {/* Khối tóm tắt thông tin gói & số tiền */}
        <div className="rounded-xl border border-solid border-blue-100 bg-slate-50 p-3.5">
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <div className="font-semibold text-slate-900 text-sm leading-snug break-words">
              {jobTitle}
            </div>
            <Tag color={isDepositMode ? 'purple' : 'blue'} className="m-0 font-medium shrink-0 text-xs">
              {isDepositMode ? 'CV Sourcing' : formatPostingPackage(fee.data?.packageCode, fee.data?.packageName)}
            </Tag>
          </div>

          <div className="flex items-baseline justify-between pt-1 border-t border-dashed border-indigo-200/60">
            <span className="text-xs text-slate-600">Số tiền cần thanh toán:</span>
            <span className="text-xl font-bold text-indigo-700 tabular-nums">
              {formatMoney(displayedAmount, isDepositMode ? (payableDeposit?.currencyCode ?? 'VND') : (fee.data?.currencyCode ?? 'VND'))}
            </span>
          </div>

          {!isDepositMode && (
            <div className="text-[11px] text-slate-500 mt-0.5 text-right">
              {pkg?.durationDays ? `${pkg.durationDays} ngày hiển thị` : '30 ngày hiển thị'}
              {pkg?.maxApplications ? ` • Tối đa ${pkg.maxApplications} hồ sơ` : ''}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-solid border-blue-200 bg-blue-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
                <SafetyCertificateOutlined className="text-lg" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {isDepositMode ? 'Đặt cọc trực tuyến qua VNPay' : 'Thanh toán trực tuyến qua VNPay'}
                </div>
                <p className="m-0 mt-1 text-[13px] leading-5 text-slate-600">
                  Bạn sẽ được chuyển sang cổng VNPay để thanh toán bằng ứng dụng ngân hàng, thẻ ATM hoặc thẻ quốc tế.
                  {isDepositMode ? ' Dịch vụ tìm hồ sơ' : ' Tin tuyển dụng'} tự động được kích hoạt sau khi VNPay xác nhận thành công.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
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

        <div className="pt-2.5 flex items-center justify-between gap-2 border-t border-slate-100">
          {isDepositMode ? (
            <Button
              size="middle"
              icon={<FileProtectOutlined />}
              onClick={() => {
                onClose();
                navigate(`/client/agreements?jobId=${jobId}`);
              }}
            >
              Hợp đồng cọc
            </Button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Tin được công bố ngay sau thanh toán
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button size="middle" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="primary"
              size={isDepositMode ? 'middle' : 'large'}
              icon={isDepositMode ? <CheckCircleOutlined /> : <CreditCardOutlined />}
              loading={paying}
              disabled={isDepositMode && (!payableDeposit || depositFee.isLoading)}
              className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold"
              onClick={handleConfirmPayment}
            >
              {isDepositMode ? 'Đặt cọc qua VNPay' : 'Thanh toán qua VNPay'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
export default PaymentDemoModal;
