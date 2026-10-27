/**
 * @file PaymentDemoModal.tsx
 * @description Hộp thanh toán phí gói đăng tin hoặc nộp cọc dịch vụ tìm kiếm hồ sơ (MF-01).
 * Giao diện hiện đại, tinh gọn, rõ ràng, hỗ trợ sao chép nhanh và mã VietQR.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Modal, Tag, Typography, message, Segmented } from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  CreditCardOutlined,
  FileProtectOutlined,
  QrcodeOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { formatMoney, jobQueryKeys, usePostingFee, usePostingPackages } from './useJobQueries';
import { formatPostingPackage } from './jobDisplay';
import { jobsApi } from '../../services/api/jobsApi';
import { useAlertStore } from '../../stores/alertStore';

const { Text } = Typography;

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

export const transferNote = (jobId: string) => `HRC ${jobId.slice(0, 8).toUpperCase()}`;
export const depositTransferNote = (jobId: string) => `COC ${jobId.slice(0, 8).toUpperCase()}`;

export const PaymentDemoModal: React.FC<PaymentDemoModalProps> = ({
  open,
  visible,
  jobId,
  jobTitle,
  serviceTypeCode,
  depositAmount,
  isDeposit,
  onSuccess,
  onPaymentSuccess,
  onClose,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOpen = Boolean(open ?? visible);
  const fee = usePostingFee(jobId, isOpen && !isDeposit);
  const packages = usePostingPackages();
  const pkg = packages.data?.find((p) => p.packageId === fee.data?.packageId);
  const [paying, setPaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'qr'>('info');

  const isDepositMode = Boolean(isDeposit || serviceTypeCode === 'CV_SOURCING' || (!fee.data && depositAmount));
  const finalDepositAmount = depositAmount ?? 200000;
  const note = isDepositMode ? depositTransferNote(jobId) : transferNote(jobId);
  const amountToPay = isDepositMode ? finalDepositAmount : (fee.data?.amount ?? 1500000);

  // Tạo URL VietQR chuẩn
  const qrUrl = `https://img.vietqr.io/image/MB-0988776655-compact2.png?amount=${amountToPay}&addInfo=${encodeURIComponent(note)}&accountName=CONG%20TY%20CP%20HR%20CONNECT`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`Đã sao chép ${label}!`);
  };

  const handleConfirmPayment = async () => {
    setPaying(true);
    try {
      if (!isDepositMode) {
        await jobsApi.payPostingFee(jobId, note);
      }

      // 1. Thông báo cho Client
      useAlertStore.getState().addAlert({
        targetRole: 'CLIENT',
        type: 'success',
        title: isDepositMode ? 'Đã nộp cọc tìm kiếm hồ sơ' : 'Thanh toán phí đăng tin thành công',
        message: isDepositMode
          ? `Khoản đặt cọc cho tin "${jobTitle}" đã được ghi nhận. Cộng tác viên sẽ bắt đầu tìm kiếm hồ sơ.`
          : `Gói đăng tin cho "${jobTitle}" đã kích hoạt. Tin đang được công khai tuyển dụng.`,
        actionLabel: 'Xem tin',
        actionRoute: `/client/jobs?status=ACTIVE&highlight=${encodeURIComponent(jobId)}`,
        relatedEntityId: jobId,
      });

      // 2. Thông báo cho Internal HR
      useAlertStore.getState().addAlert({
        targetRole: 'INTERNAL_HR',
        type: 'success',
        title: isDepositMode ? 'Doanh nghiệp đã nộp cọc' : 'Doanh nghiệp đã thanh toán phí đăng tin',
        message: isDepositMode
          ? `Doanh nghiệp đã nộp cọc mở nguồn tìm kiếm hồ sơ cho tin "${jobTitle}".`
          : `Tin tuyển dụng "${jobTitle}" đã hoàn tất thanh toán phí gói đăng tin và chuyển sang Đang tuyển.`,
        actionLabel: 'Xem tin',
        actionRoute: `/hr/jobs?status=ACTIVE&highlight=${encodeURIComponent(jobId)}`,
        relatedEntityId: jobId,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jobQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] }),
      ]);

      message.success(
        isDepositMode
          ? 'Đã xác nhận nộp cọc! Hệ thống đã ghi nhận khoản đặt cọc.'
          : 'Thanh toán thành công! Tin tuyển dụng đã được kích hoạt công khai.'
      );

      if (onPaymentSuccess) onPaymentSuccess();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Có lỗi xảy ra khi xử lý thanh toán.';
      message.error(errMsg);
    } finally {
      setPaying(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnClose
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
              Chuyển khoản để kích hoạt tin tuyển dụng
            </div>
          </div>
        </div>
      }
    >
      <div className="py-2 space-y-3.5">
        {/* Khối tóm tắt thông tin gói & số tiền */}
        <div className="rounded-xl bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/40 p-3.5 border border-solid border-indigo-100/80">
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
              {isDepositMode
                ? formatMoney(finalDepositAmount, 'VND')
                : formatMoney(fee.data?.amount ?? 1500000, fee.data?.currencyCode ?? 'VND')}
            </span>
          </div>

          {!isDepositMode && (
            <div className="text-[11px] text-slate-500 mt-0.5 text-right">
              {pkg?.durationDays ? `${pkg.durationDays} ngày hiển thị` : '30 ngày hiển thị'}
              {pkg?.maxApplications ? ` • Tối đa ${pkg.maxApplications} hồ sơ` : ''}
            </div>
          )}
        </div>

        {/* Tab chuyển đổi giữa Thông tin chuyển khoản và Mã QR */}
        <div className="flex justify-center">
          <Segmented
            options={[
              { label: 'Thông tin chuyển khoản', value: 'info', icon: <BankOutlined /> },
              { label: 'Quét mã VietQR', value: 'qr', icon: <QrcodeOutlined /> },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'info' | 'qr')}
            className="bg-slate-100 p-1 font-medium text-xs"
          />
        </div>

        {activeTab === 'info' ? (
          /* Card thông tin ngân hàng */
          <div className="rounded-xl bg-white p-3.5 border border-solid border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Ngân hàng:</span>
              <span className="font-semibold text-slate-800">MB Bank (TMCP Quân Đội)</span>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Số tài khoản:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 font-mono text-sm tracking-wide">0988776655</span>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  className="h-6 px-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  onClick={() => copyToClipboard('0988776655', 'Số tài khoản')}
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-500">Chủ tài khoản:</span>
              <span className="font-semibold text-slate-800">CONG TY CO PHAN HR CONNECT</span>
            </div>

            {/* Ô nội dung chuyển khoản highlight nổi bật */}
            <div className="rounded-lg bg-amber-50/90 border border-solid border-amber-200 p-2.5 mt-1.5">
              <div className="flex justify-between items-center">
                <span className="text-amber-800 font-medium">Nội dung chuyển khoản:</span>
                <Button
                  type="primary"
                  size="small"
                  icon={<CopyOutlined />}
                  className="!h-6 !text-xs !bg-blue-600 hover:!bg-blue-700 !border-blue-600 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-medium"
                  onClick={() => copyToClipboard(note, 'Nội dung chuyển khoản')}
                >
                  Sao chép mã
                </Button>
              </div>
              <div className="font-mono font-bold text-base text-amber-900 mt-1 select-all tracking-wider">
                {note}
              </div>
            </div>
          </div>
        ) : (
          /* Khối quét mã VietQR tự động */
          <div className="rounded-xl bg-white p-3 border border-solid border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="p-2 bg-white rounded-lg border border-solid border-slate-200 shadow-xs mb-1.5">
              <img
                src={qrUrl}
                alt="VietQR MB Bank"
                className="w-48 h-48 object-contain"
                loading="lazy"
              />
            </div>
            <div className="text-[12px] text-slate-600">
              Mở ứng dụng ngân hàng bất kỳ để quét mã thanh toán tự động
            </div>
          </div>
        )}

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
              size="middle"
              icon={<CheckCircleOutlined />}
              loading={paying}
              className="!bg-blue-600 hover:!bg-blue-700 text-white rounded-lg shadow-sm transition-all active:scale-[0.98] font-semibold"
              onClick={handleConfirmPayment}
            >
              {isDepositMode ? 'Xác nhận nộp cọc' : 'Xác nhận đã thanh toán'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
export default PaymentDemoModal;
