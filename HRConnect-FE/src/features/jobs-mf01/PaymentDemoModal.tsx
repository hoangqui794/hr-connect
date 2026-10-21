/**
 * @file PaymentDemoModal.tsx
 * @description Hướng dẫn Client thanh toán phí gói đăng tin (MF-01). N4 (chốt 19/10): Client chuyển khoản ngoài
 * hệ thống, chỉ Platform Admin ghi nhận tiền đã thu; tin được công bố ngay sau khi Admin ghi nhận.
 * Số tiền, tên gói, thời hạn và hạn mức hồ sơ đọc từ backend (GET /jobs/{id}/posting-fee, /jobs/posting-packages).
 */
import React from 'react';
import { Alert, Button, Divider, Modal, Tag, Typography } from 'antd';
import { CheckCircleOutlined, CreditCardOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { formatMoney, usePostingFee, usePostingPackages } from './useJobQueries';
import { formatPostingPackage } from './jobDisplay';

const { Text } = Typography;

interface PaymentDemoModalProps {
  open?: boolean;
  visible?: boolean;
  jobId: string;
  jobTitle: string;
  /** Kept for callers; payment is now confirmed by Platform Admin, not in this modal. */
  onSuccess?: () => void;
  onPaymentSuccess?: () => void;
  onClose: () => void;
}

/** Nội dung chuyển khoản giúp Platform Admin đối chiếu đúng tin. */
export const transferNote = (jobId: string) => `HRC ${jobId.slice(0, 8).toUpperCase()}`;

export const PaymentDemoModal: React.FC<PaymentDemoModalProps> = ({ open, visible, jobId, jobTitle, onClose }) => {
  const isOpen = Boolean(open ?? visible);
  const fee = usePostingFee(jobId, isOpen);
  const packages = usePostingPackages();
  const pkg = packages.data?.find((p) => p.packageId === fee.data?.packageId);
  const paid = fee.data?.status === 'PAID';

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
          <CreditCardOutlined className="text-indigo-600 text-lg" aria-hidden />
          <span>Thanh toán phí gói đăng tin</span>
        </div>
      }
    >
      <div className="py-2 space-y-4">
        {paid ? (
          <Alert type="success" showIcon message="HR Connect đã nhận phí đăng tin. Tin đã được công bố." />
        ) : (
          <Alert
            type="info"
            showIcon
            message="Chuyển khoản theo thông tin trong hợp đồng / email HR Connect gửi"
            description="Ghi đúng nội dung chuyển khoản bên dưới. Sau khi HR Connect đối chiếu và ghi nhận tiền, tin được công bố ngay và bạn nhận thông báo."
          />
        )}

        <div className="rounded-xl border border-solid border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <Text type="secondary" className="text-xs">Vị trí tuyển dụng</Text>
              <div className="font-semibold text-slate-900 text-base break-words">{jobTitle}</div>
            </div>
            <Tag color="blue" className="m-0 font-medium shrink-0">
              {formatPostingPackage(fee.data?.packageCode, fee.data?.packageName)}
            </Tag>
          </div>

          <Divider className="my-2" />

          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <Text type="secondary" className="text-xs">Gói dịch vụ</Text>
              <div className="font-medium text-slate-800">
                {formatPostingPackage(fee.data?.packageCode, fee.data?.packageName)}
                {pkg?.durationDays ? ` (${pkg.durationDays} ngày)` : ''}
              </div>
            </div>
            <div>
              <Text type="secondary" className="text-xs">Quyền lợi gói</Text>
              <div className="font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircleOutlined aria-hidden />
                {pkg?.maxApplications
                  ? `Tối đa ${pkg.maxApplications} hồ sơ và được trí tuệ nhân tạo hỗ trợ chấm điểm`
                  : 'Trí tuệ nhân tạo hỗ trợ chấm điểm hồ sơ'}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-baseline gap-3 border-t border-dashed border-slate-300">
            <span className="font-semibold text-slate-700">Số tiền</span>
            <span className="text-2xl font-bold text-indigo-600 tabular-nums">
              {fee.isLoading ? '…' : formatMoney(fee.data?.amount ?? null, fee.data?.currencyCode)}
            </span>
          </div>
          <div className="flex justify-between items-center gap-3 text-sm">
            <span className="text-slate-600">Nội dung chuyển khoản</span>
            <Text copyable={{ text: transferNote(jobId) }} className="font-semibold tabular-nums">
              {transferNote(jobId)}
            </Text>
          </div>
        </div>

        <p className="m-0 flex gap-1.5 text-xs text-slate-500">
          <InfoCircleOutlined className="mt-0.5 text-slate-400" aria-hidden />
          Thời hạn hiển thị của gói bắt đầu tính từ lúc tin được công bố.
        </p>

        <div className="pt-3 flex justify-end border-t border-slate-100">
          <Button type="primary" className="!bg-indigo-600 hover:!bg-indigo-500" onClick={onClose}>
            Đã hiểu
          </Button>
        </div>
      </div>
    </Modal>
  );
};
