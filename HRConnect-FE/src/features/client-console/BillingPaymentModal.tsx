/**
 * @file BillingPaymentModal.tsx
 * @description "Thanh toán" on the Công nợ page for one unpaid fee. VNPay first: the Client pays on VNPay and the fee turns
 * paid by itself when VNPay confirms. Bank transfer stays as the fallback (Platform Admin records it), so there is no
 * "I have paid" button.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App, Button, Modal } from 'antd';
import { CheckOutlined, CopyOutlined, CreditCardOutlined } from '@ant-design/icons';
import { vnPayApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { PLATFORM_BANK_ACCOUNT as BANK } from '@/features/finance-mf05/platformBankAccount';
import { date, money } from '@/features/finance-mf05/financeLabels';
import type { BillingRow } from './billingTypes';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const CopyButton: React.FC<{
  copied: boolean;
  copyLabel: string;
  onClick: () => void;
}> = ({ copied, copyLabel, onClick }) => (
  <button
    type="button"
    aria-label={`Sao chép ${copyLabel}`}
    onClick={onClick}
    className={`inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1] focus-visible:ring-offset-1 [touch-action:manipulation] ${
      copied
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    {copied ? <CheckOutlined className="text-[11px]" /> : <CopyOutlined className="text-[11px]" />}
    <span>{copied ? 'Đã chép' : 'Chép'}</span>
  </button>
);

const BankFieldRow: React.FC<{
  label: string;
  value: string;
  copyLabel?: string;
  copied?: boolean;
  mono?: boolean;
  highlight?: boolean;
  onCopy?: () => void;
}> = ({ label, value, copyLabel, copied = false, mono, highlight, onCopy }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <span className="shrink-0 text-[13px] text-slate-500">{label}</span>
    <div className="flex min-w-0 items-center justify-end gap-2">
      <span
        className={`truncate text-right text-[13px] font-semibold text-slate-900 ${
          mono ? 'font-mono tracking-wide tabular-nums' : ''
        } ${highlight ? 'rounded-md bg-slate-100 px-2 py-0.5 text-slate-950' : ''}`}
      >
        {value}
      </span>
      {copyLabel && onCopy && <CopyButton copied={copied} copyLabel={copyLabel} onClick={onCopy} />}
    </div>
  </div>
);

export const BillingPaymentModal: React.FC<{ row: BillingRow | null; onClose: () => void }> = ({ row, onClose }) => {
  const { message } = App.useApp();
  const vnPay = useQuery({ queryKey: ['vnpay-enabled'], queryFn: () => vnPayApi.enabled(), enabled: Boolean(row), staleTime: 5 * 60_000 });
  const [redirecting, setRedirecting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setCopiedKey(null);
    setRedirecting(false);
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, [row?.payTarget.type, row?.payTarget.id]);

  const copy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1800);
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

  const isOverdue = row?.bucket === 'OVERDUE';

  return (
    <Modal
      open={Boolean(row)}
      title={
        row ? (
          <div className="flex flex-wrap items-center gap-2.5 pr-6">
            <span className="text-[17px] font-bold tracking-tight text-slate-900">Thanh toán khoản phí</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isOverdue ? 'Quá hạn' : 'Chờ thanh toán'}
            </span>
          </div>
        ) : (
          'Thanh toán'
        )
      }
      onCancel={onClose}
      footer={
        <div className="flex items-center justify-end">
          <Button
            onClick={onClose}
            className="!h-9 rounded-lg border-slate-200 px-4 font-medium text-slate-700 hover:!border-slate-300 hover:!text-slate-900"
          >
            Đóng
          </Button>
        </div>
      }
      width={760}
      centered
      destroyOnHidden
      className={FONT}
    >
      {row && (
        <div className="grid grid-cols-1 gap-5 pt-1 md:grid-cols-12">
          {/* Cột trái: Bảng tóm tắt hóa đơn tông sáng thanh lịch */}
          <aside
            aria-label="Tóm tắt khoản phí"
            className="flex flex-col justify-between rounded-2xl border border-solid border-[#DCE9F5] bg-gradient-to-b from-[#F2F8FD] to-[#F8FAFC] p-5 text-slate-900 md:col-span-5"
          >
            <div>
              <div className="text-xs font-semibold text-[#0369A1]">{row.item}</div>
              <h3 className="m-0 mt-1 text-base font-bold leading-snug text-slate-900">{row.jobTitle}</h3>

              {row.breakdown.length > 0 && (
                <dl className="m-0 mt-4 space-y-2 border-0 border-t border-solid border-slate-200/80 pt-4">
                  {row.breakdown.map((line) => (
                    <div key={line.label} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <dt className="text-slate-500">{line.label}</dt>
                      <dd className="m-0 text-right font-semibold tabular-nums text-slate-800">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-solid border-slate-200/80 bg-white/90 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="text-xs font-medium text-slate-500">Số tiền cần thanh toán</div>
              <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-[#0369A1]">
                {money(row.amount, row.currencyCode)}
              </div>
              {row.dueDate && (
                <div className={`mt-1 text-xs ${isOverdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                  {isOverdue ? 'Đã quá hạn từ ' : 'Hạn thanh toán '}
                  {date(row.dueDate)}
                </div>
              )}
            </div>
          </aside>

          {/* Cột phải: Phương thức thanh toán */}
          <div className="flex flex-col justify-between space-y-5 md:col-span-7">
            {vnPay.data && (
              <div className="rounded-2xl border border-solid border-sky-200/80 bg-sky-50/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">Thanh toán trực tuyến</span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    Xác nhận tức thì
                  </span>
                </div>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<CreditCardOutlined />}
                  loading={redirecting}
                  onClick={payWithVnPay}
                  className="!h-11 rounded-xl !border-0 !bg-[#0369A1] font-semibold text-white shadow-sm transition-colors hover:!bg-[#075985] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[#0369A1] focus-visible:!ring-offset-2 active:scale-[0.99] [touch-action:manipulation]"
                >
                  Thanh toán qua VNPay
                </Button>
                <p className="m-0 mt-2 text-xs leading-relaxed text-slate-500">
                  Hỗ trợ thẻ ATM nội địa, thẻ quốc tế hoặc quét mã QR ngân hàng.
                </p>
              </div>
            )}

            <div>
              {vnPay.data ? (
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-medium text-slate-400">Hoặc chuyển khoản ngân hàng</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
              ) : (
                <div className="mb-2 text-[13px] font-semibold text-slate-800">Thông tin chuyển khoản ngân hàng</div>
              )}

              <div className="divide-y divide-slate-100 rounded-xl border border-solid border-slate-200/90 bg-white px-3.5 py-0.5">
                <BankFieldRow label="Ngân hàng" value={BANK.bankName} />
                <BankFieldRow
                  label="Số tài khoản"
                  value={BANK.accountNumber}
                  copyLabel="số tài khoản"
                  copied={copiedKey === 'account'}
                  mono
                  onCopy={() => copy('account', BANK.accountNumber, 'số tài khoản')}
                />
                <BankFieldRow label="Chủ tài khoản" value={BANK.accountHolder} />
                {row.transferNote && (() => {
                  const transferNote = row.transferNote;
                  return (
                    <BankFieldRow
                      label="Nội dung chuyển khoản"
                      value={transferNote}
                      copyLabel="nội dung chuyển khoản"
                      copied={copiedKey === 'note'}
                      mono
                      highlight
                      onCopy={() => copy('note', transferNote, 'nội dung chuyển khoản')}
                    />
                  );
                })()}
              </div>

              <p className="m-0 mt-2 text-xs leading-relaxed text-slate-500">
                Ghi đúng nội dung chuyển khoản để HR Connect đối chiếu; trạng thái cập nhật khi nhận được tiền.
              </p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
