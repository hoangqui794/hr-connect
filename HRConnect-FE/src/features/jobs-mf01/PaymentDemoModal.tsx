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
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { formatMoney, usePostingFee, usePostingPackages } from './useJobQueries';
import { formatPostingPackage } from './jobDisplay';
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
  const { message } = App.useApp();
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
      className={FONT}
      title={
        <div className="flex items-center gap-2.5 text-slate-900">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#0C4A6E] flex items-center justify-center font-bold text-base border border-sky-100">
            <CreditCardOutlined />
          </div>
          <div>
            <div className="font-bold text-base leading-tight">
              {isDepositMode ? 'Đặt cọc dịch vụ tìm hồ sơ' : 'Thanh toán phí gói đăng tin'}
            </div>
            <div className="text-xs text-slate-500 font-normal mt-0.5">
              Thanh toán an toàn và được xác nhận tự động
            </div>
          </div>
        </div>
      }
    >
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
              {formatMoney(displayedAmount, isDepositMode ? (payableDeposit?.currencyCode ?? 'VND') : (fee.data?.currencyCode ?? 'VND'))}
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
              Tin được công bố ngay sau thanh toán
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
              disabled={isDepositMode && (!payableDeposit || depositFee.isLoading)}
              className="!bg-[#0C4A6E] hover:!bg-[#075985] !border-0 text-white rounded-xl shadow-sm transition-all active:scale-[0.98] font-semibold !h-10 px-4"
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
