/**
 * @file PaymentDemoModal.tsx
 * @description Modal mô phỏng thanh toán phí gói đăng tin STANDARD (MF-01 Giai đoạn 3).
 * Số tiền, tên gói, thời hạn và hạn mức hồ sơ đọc từ backend (GET /jobs/{id}/posting-fee, /jobs/posting-packages).
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Divider, Modal, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CreditCardOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { formatMoney, jobQueryKeys, usePostingFee, usePostingPackages } from './useJobQueries';

const { Text, Title, Paragraph } = Typography;

interface PaymentDemoModalProps {
  open?: boolean;
  visible?: boolean;
  jobId: string;
  jobTitle: string;
  onSuccess?: () => void;
  onPaymentSuccess?: () => void;
  onClose: () => void;
}

export const PaymentDemoModal: React.FC<PaymentDemoModalProps> = ({
  open,
  visible,
  jobId,
  jobTitle,
  onSuccess,
  onPaymentSuccess,
  onClose,
}) => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const isOpen = Boolean(open ?? visible);
  const fee = usePostingFee(jobId, isOpen);
  const packages = usePostingPackages();
  const pkg = packages.data?.find((p) => p.packageId === fee.data?.packageId);
  const amount = fee.data?.amount ?? null;

  const handlePay = async () => {
    setLoading(true);
    try {
      const demoRef = `PAY-${Date.now().toString().slice(-6)}`;
      await jobsApi.payPostingFee(jobId, demoRef);
      message.success('Thanh toán thành công! Phí đăng tin đã được ghi nhận và tin đã được kích hoạt.');
      queryClient.invalidateQueries({ queryKey: jobQueryKeys.all });
      onSuccess?.();
      onPaymentSuccess?.();
    } catch (err) {
      message.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      centered
      width={520}
      title={
        <div className="flex items-center gap-2 text-slate-800">
          <CreditCardOutlined className="text-indigo-600 text-lg" />
          <span>Thanh toán phí gói đăng tin tuyển dụng</span>
        </div>
      }
    >
      <div className="py-2 space-y-4">
        <Alert
          type="info"
          showIcon
          message="Cổng thanh toán HR Connect"
          description="Quý khách vui lòng kiểm tra thông tin gói đăng tin và xác nhận thanh toán để kích hoạt tin tuyển dụng."
        />

        <div className="rounded-xl border border-solid border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <Text type="secondary" className="text-xs">Vị trí tuyển dụng</Text>
              <div className="font-semibold text-slate-900 text-base">{jobTitle}</div>
            </div>
            <Tag color="blue" className="m-0 font-medium">{fee.data?.packageCode ?? '—'}</Tag>
          </div>

          <Divider className="my-2" />

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <Text type="secondary" className="text-xs">Gói dịch vụ:</Text>
              <div className="font-medium text-slate-800">
                {fee.data?.packageName ?? '—'}
                {pkg?.durationDays ? ` (${pkg.durationDays} ngày)` : ''}
              </div>
            </div>
            <div>
              <Text type="secondary" className="text-xs">Quyền lợi gói:</Text>
              <div className="font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircleOutlined />{' '}
                {pkg?.maxApplications ? `Tối đa ${pkg.maxApplications} hồ sơ & AI chấm điểm CV` : 'AI chấm điểm CV'}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-baseline border-t border-dashed border-slate-300">
            <span className="font-semibold text-slate-700">Tổng thanh toán:</span>
            <span className="text-2xl font-bold text-indigo-600">
              {fee.isLoading ? '…' : formatMoney(amount, fee.data?.currencyCode)}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center gap-1 text-slate-600 font-medium">
            <SafetyCertificateOutlined className="text-emerald-600" /> Thanh toán an toàn qua cổng HRConnect
          </div>
          <p className="m-0">
            Sau khi thanh toán thành công, tin tuyển dụng đã duyệt nội dung sẽ được kích hoạt công khai ngay lập tức, bắt đầu tính thời hạn hiển thị của gói và mở nhận hồ sơ ứng viên.
          </p>
        </div>

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <Button onClick={onClose} disabled={loading}>
            Để sau
          </Button>
          <Button
            type="primary"
            className="!bg-indigo-600 hover:!bg-indigo-500"
            loading={loading}
            disabled={!fee.data || fee.data.status !== 'PENDING'}
            onClick={handlePay}
          >
            Xác nhận thanh toán ngay
          </Button>
        </div>
      </div>
    </Modal>
  );
};
