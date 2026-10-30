/**
 * @file BillingPaymentModal.tsx
 * @description "Thanh toán" on the Công nợ page for one unpaid fee. VNPay first: the Client pays on VNPay and the fee turns
 * paid by itself when VNPay confirms. Bank transfer stays as the fallback (Platform Admin records it), so there is no
 * "I have paid" button.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Modal } from 'antd';
import { CopyOutlined, CreditCardOutlined } from '@ant-design/icons';
import { vnPayApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { PLATFORM_BANK_ACCOUNT as BANK } from '@/features/finance-mf05/platformBankAccount';
import { date, money } from '@/features/finance-mf05/financeLabels';
import type { BillingRow } from './ClientBillingPage';

const Line: React.FC<{ label: string; value: string; copyLabel?: string; mono?: boolean; onCopy: (text: string, label: string) => void }> = ({
  label,
  value,
  copyLabel,
  mono,
  onCopy,
}) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-[13px] text-slate-600">{label}</span>
    <span className="flex min-w-0 items-center gap-1">
      <span className={`text-right font-semibold text-slate-900 ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</span>
      {copyLabel && (
        <Button type="text" size="small" icon={<CopyOutlined />} aria-label={`Sao chép ${copyLabel}`} onClick={() => onCopy(value, copyLabel)} />
      )}
    </span>
  </div>
);

export const BillingPaymentModal: React.FC<{ row: BillingRow | null; onClose: () => void }> = ({ row, onClose }) => {
  const { message } = App.useApp();
  const vnPay = useQuery({ queryKey: ['vnpay-enabled'], queryFn: () => vnPayApi.enabled(), enabled: Boolean(row), staleTime: 5 * 60_000 });
  const [redirecting, setRedirecting] = useState(false);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(`Đã sao chép ${label}.`);
    } catch {
      message.error('Trình duyệt không cho sao chép, vui lòng chép tay.');
    }
  };

  const payWithVnPay = async () => {
    if (!row) return;
    setRedirecting(true);
    try {
      const { paymentUrl } = await vnPayApi.createPayment(row.payTarget.type, row.payTarget.id);
      window.location.assign(paymentUrl);
    } catch (error) {
      message.error(getApiErrorMessage(error));
      setRedirecting(false);
    }
  };

  return (
    <Modal
      open={Boolean(row)}
      title="Thanh toán"
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={460}
      centered
      destroyOnClose
    >
      {row && (
        <div className="space-y-4 pt-1">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-[13px] text-slate-600">{row.item}</div>
            <div className="mt-0.5 font-medium text-slate-900">{row.jobTitle}</div>
            {row.breakdown.length > 0 && (
              <dl className="m-0 mt-3 space-y-1.5 border-t border-solid border-slate-200 pt-3">
                {row.breakdown.map((line) => (
                  <div key={line.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <dt className="text-slate-600">{line.label}</dt>
                    <dd className="m-0 text-right font-medium tabular-nums text-slate-800">{line.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-dashed border-slate-200 pt-3">
              <span className="text-[13px] text-slate-600">Số tiền cần thanh toán</span>
              <span className="text-xl font-bold tabular-nums text-slate-900">{money(row.amount, row.currencyCode)}</span>
            </div>
            {row.dueDate && (
              <div className={`mt-1 text-right text-xs ${row.bucket === 'OVERDUE' ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                {row.bucket === 'OVERDUE' ? 'Đã quá hạn từ ' : 'Hạn thanh toán '}
                {date(row.dueDate)}
              </div>
            )}
          </div>

          {vnPay.data && (
            <div>
              <Button type="primary" size="large" block icon={<CreditCardOutlined />} loading={redirecting} onClick={payWithVnPay}>
                Thanh toán qua VNPay
              </Button>
              <p className="m-0 mt-2 text-center text-xs text-slate-500">
                Thẻ ATM, thẻ quốc tế hoặc QR ngân hàng. Khoản phí chuyển Đã thanh toán ngay khi VNPay xác nhận.
              </p>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-slate-700">{vnPay.data ? 'Hoặc chuyển khoản' : 'Chuyển khoản'}</div>
            <div className="divide-y divide-slate-100 rounded-xl border border-solid border-slate-200 px-4 py-1">
              <Line label="Ngân hàng" value={BANK.bankName} onCopy={copy} />
              <Line label="Số tài khoản" value={BANK.accountNumber} copyLabel="số tài khoản" mono onCopy={copy} />
              <Line label="Chủ tài khoản" value={BANK.accountHolder} onCopy={copy} />
              {row.transferNote && <Line label="Nội dung chuyển khoản" value={row.transferNote} copyLabel="nội dung chuyển khoản" mono onCopy={copy} />}
            </div>
            <p className="m-0 mt-2 text-[13px] leading-relaxed text-slate-600">
              Ghi đúng nội dung chuyển khoản để HR Connect đối chiếu; trạng thái cập nhật khi HR Connect nhận được tiền.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
};
