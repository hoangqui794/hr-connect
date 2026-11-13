/**
 * @file ClientVnPayReturnPage.tsx
 * @description Where VNPay sends the Client back after paying (/client/billing/vnpay-return?vnp_...). The signed query
 * goes to the backend, which confirms the payment if VNPay's IPN has not already, and the page shows the outcome.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ClockCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { vnPayApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { money } from '@/features/finance-mf05/financeLabels';
import type { OnlinePaymentResult, OnlinePaymentTargetType } from '@/types/api/finance';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

// VNPay response code 24 = the customer cancelled on VNPay.
const CANCELLED = '24';
const MAX_PENDING_POLLS = 15;
const PENDING_POLL_INTERVAL_MS = 2000;

const TARGET_LABEL: Record<OnlinePaymentTargetType, string> = {
  SERVICE_FEE: 'Phí dịch vụ tuyển dụng',
  POSTING_FEE: 'Phí đăng tin tuyển dụng',
};

const formatDateTime = (iso?: string | null, vnpPayDate?: string | null): string => {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
  }
  if (vnpPayDate && /^\d{14}$/.test(vnpPayDate)) {
    const y = vnpPayDate.slice(0, 4);
    const m = vnpPayDate.slice(4, 6);
    const day = vnpPayDate.slice(6, 8);
    const hh = vnpPayDate.slice(8, 10);
    const mm = vnpPayDate.slice(10, 12);
    const ss = vnpPayDate.slice(12, 14);
    return `${hh}:${mm}:${ss} ${day}/${m}/${y}`;
  }
  return '—';
};

const DetailRow: React.FC<{
  label: string;
  value: string;
  mono?: boolean;
  copyKey?: string;
  copiedKey?: string | null;
  onCopy?: (key: string, value: string) => void;
}> = ({ label, value, mono, copyKey, copiedKey, onCopy }) => {
  const isCopied = Boolean(copyKey && copiedKey === copyKey);
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-slate-500">{label}</dt>
      <dd className="m-0 flex min-w-0 items-center justify-end gap-2 text-right">
        <span
          className={`break-words text-[13px] font-semibold text-slate-900 ${
            mono ? 'font-mono tracking-wide tabular-nums' : ''
          }`}
        >
          {value}
        </span>
        {copyKey && onCopy && (
          <button
            type="button"
            aria-label={`Sao chép ${label.toLowerCase()}`}
            onClick={() => onCopy(copyKey, value)}
            className={`inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1] [touch-action:manipulation] print:hidden ${
              isCopied
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {isCopied ? <CheckOutlined className="text-[10px]" /> : <CopyOutlined className="text-[10px]" />}
            <span>{isCopied ? 'Đã chép' : 'Chép'}</span>
          </button>
        )}
      </dd>
    </div>
  );
};

const StepTimeline: React.FC<{ activeStep: 2 | 3; isFailed?: boolean }> = ({ activeStep, isFailed }) => {
  const steps = [
    { id: 1, label: 'Thanh toán tại VNPay', done: true },
    { id: 2, label: 'Đối soát & xác nhận giao dịch', done: activeStep > 2, current: activeStep === 2 },
    { id: 3, label: isFailed ? 'Chưa cập nhật công nợ' : 'Cập nhật trạng thái công nợ', done: activeStep === 3 && !isFailed },
  ];

  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-2 rounded-xl border border-solid border-slate-200 bg-slate-50/80 p-3.5 sm:grid-cols-3 sm:gap-3">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-2.5">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              step.done
                ? 'bg-emerald-100 text-emerald-700'
                : step.current
                  ? 'bg-sky-100 text-[#0369A1]'
                  : 'bg-slate-200 text-slate-500'
            }`}
          >
            {step.done ? <CheckOutlined className="text-[11px]" /> : step.current ? <LoadingOutlined spin className="text-[11px]" /> : step.id}
          </span>
          <span
            className={`text-xs leading-snug ${
              step.done || step.current ? 'font-semibold text-slate-800' : 'text-slate-500'
            }`}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
};

export const ClientVnPayReturnPage: React.FC = () => {
  const { search } = useLocation();
  const queryClient = useQueryClient();
  const pollCountRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    pollCountRef.current = 0;
    setCopiedKey(null);
  }, [search]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const vnpMeta = useMemo(() => {
    const params = new URLSearchParams(search);
    const rawAmount = Number(params.get('vnp_Amount'));
    const parsedAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount / 100) : null;
    const bankCode = params.get('vnp_BankCode');
    const cardType = params.get('vnp_CardType');
    const method = [bankCode, cardType].filter(Boolean).join(' · ') || null;
    return {
      amount: parsedAmount,
      bankTranNo: params.get('vnp_BankTranNo'),
      transactionNo: params.get('vnp_TransactionNo'),
      txnRef: params.get('vnp_TxnRef'),
      orderInfo: params.get('vnp_OrderInfo'),
      payDate: params.get('vnp_PayDate'),
      responseCode: params.get('vnp_ResponseCode'),
      method,
    };
  }, [search]);

  const result = useQuery({
    queryKey: ['vnpay-return', search],
    queryFn: () => vnPayApi.confirmReturn(search),
    enabled: search.includes('vnp_'),
    retry: 1,
    retryDelay: 1000,
    staleTime: Infinity,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if ((status === 'PENDING' || status === 'PROCESSING') && pollCountRef.current < MAX_PENDING_POLLS) {
        pollCountRef.current += 1;
        return PENDING_POLL_INTERVAL_MS;
      }
      return false;
    },
  });

  useEffect(() => {
    const status = result.data?.status;
    if (status === 'SUCCEEDED' || status === 'NEEDS_REVIEW' || status === 'FAILED') {
      void queryClient.invalidateQueries({ queryKey: ['client-billing'] });
    }
  }, [result.data?.status, queryClient]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard API unavailable in restricted browser context; ignore silently.
    }
  };

  const backButton = (
    <Link to="/client/billing" className="inline-flex">
      <Button
        type="primary"
        icon={<ArrowLeftOutlined />}
        className="!h-10 rounded-xl !border-0 !bg-[#0369A1] px-5 font-semibold text-white shadow-sm transition-colors hover:!bg-[#075985] focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-[#0369A1] focus-visible:!ring-offset-2 active:scale-[0.99] [touch-action:manipulation]"
      >
        Về trang Công nợ
      </Button>
    </Link>
  );

  const renderReceiptRows = (p?: OnlinePaymentResult) => {
    const providerTx = p?.providerTransactionNo || vnpMeta.transactionNo;
    const paidAtText = formatDateTime(p?.paidAt, vnpMeta.payDate);
    const refCode = vnpMeta.txnRef || p?.onlinePaymentId;

    return (
      <dl className="m-0 divide-y divide-slate-100 rounded-2xl border border-solid border-slate-200 bg-white px-4 py-1">
        {p?.targetType && <DetailRow label="Loại khoản phí" value={TARGET_LABEL[p.targetType] ?? p.targetType} />}
        {vnpMeta.orderInfo && <DetailRow label="Nội dung thanh toán" value={vnpMeta.orderInfo} />}
        {providerTx && (
          <DetailRow
            label="Mã giao dịch VNPay"
            value={providerTx}
            mono
            copyKey="providerTx"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        )}
        {vnpMeta.bankTranNo && (
          <DetailRow
            label="Mã giao dịch ngân hàng"
            value={vnpMeta.bankTranNo}
            mono
            copyKey="bankTranNo"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        )}
        {vnpMeta.method && <DetailRow label="Phương thức / Ngân hàng" value={vnpMeta.method} />}
        {refCode && (
          <DetailRow
            label="Mã tham chiếu"
            value={refCode}
            mono
            copyKey="txnRef"
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        )}
        {paidAtText !== '—' && <DetailRow label="Thời gian thanh toán" value={paidAtText} mono />}
      </dl>
    );
  };

  if (!search.includes('vnp_')) {
    return (
      <div className={`${FONT} mx-auto max-w-[560px] py-8 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
        <div className="rounded-2xl border border-solid border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ExclamationCircleFilled className="text-2xl" />
          </div>
          <h1 className="m-0 mt-4 text-xl font-bold tracking-tight text-slate-900">Không có kết quả thanh toán</h1>
          <p className="m-0 mt-2 text-sm leading-relaxed text-slate-500">
            Trang này chỉ hiển thị kết quả giao dịch khi bạn được VNPay chuyển hướng về sau khi thanh toán.
          </p>
          <div className="mt-6 flex justify-center">{backButton}</div>
        </div>
      </div>
    );
  }

  if (result.isLoading) {
    const previewAmount = vnpMeta.amount !== null ? money(vnpMeta.amount, 'VND') : null;
    return (
      <div className={`${FONT} mx-auto max-w-[600px] py-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
        <div className="overflow-hidden rounded-2xl border border-solid border-slate-200 bg-white shadow-sm">
          <div className="border-0 border-b border-solid border-slate-100 bg-sky-50/60 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0369A1] text-white shadow-sm">
              <LoadingOutlined spin className="text-xl" />
            </div>
            <h1 className="m-0 mt-4 text-xl font-bold tracking-tight text-slate-900">
              Đang xác nhận kết quả thanh toán với VNPay…
            </h1>
            <p className="m-0 mt-1.5 text-sm text-slate-600">
              Hệ thống đang đối soát chữ ký và cập nhật công nợ. Vui lòng giữ nguyên trang trong giây lát.
            </p>
            {previewAmount && (
              <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl border border-solid border-sky-200 bg-white px-4 py-2">
                <span className="text-xs font-medium text-slate-500">Số tiền giao dịch</span>
                <span className="text-lg font-bold tabular-nums text-slate-900">{previewAmount}</span>
              </div>
            )}
          </div>
          <div className="space-y-4 p-6">
            <StepTimeline activeStep={2} />
            {(vnpMeta.transactionNo || vnpMeta.method || vnpMeta.orderInfo) && renderReceiptRows()}
          </div>
        </div>
      </div>
    );
  }

  if (result.isError || !result.data) {
    return (
      <div className={`${FONT} mx-auto max-w-[600px] py-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
        <div className="overflow-hidden rounded-2xl border border-solid border-red-200 bg-white shadow-sm">
          <div className="border-0 border-b border-solid border-red-100 bg-red-50/60 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <CloseCircleFilled className="text-2xl" />
            </div>
            <h1 className="m-0 mt-4 text-xl font-bold tracking-tight text-slate-900">Không xác nhận được kết quả</h1>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">{getApiErrorMessage(result.error)}</p>
          </div>
          <div className="space-y-4 p-6">
            {(vnpMeta.transactionNo || vnpMeta.txnRef || vnpMeta.method) && renderReceiptRows()}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button
                icon={<ReloadOutlined />}
                loading={result.isFetching}
                onClick={() => void result.refetch()}
                className="!h-10 rounded-xl border-slate-200 px-4 font-medium text-slate-700 hover:!border-slate-300 hover:!text-slate-900"
              >
                Thử kiểm tra lại
              </Button>
              {backButton}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const p = result.data;
  const amount = money(p.amount, p.currencyCode);

  if (p.status === 'SUCCEEDED') {
    return (
      <div className={`${FONT} mx-auto max-w-[600px] py-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
        <div className="overflow-hidden rounded-2xl border border-solid border-emerald-200 bg-white shadow-sm">
          <div className="border-0 border-b border-solid border-emerald-100 bg-emerald-50/60 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <CheckCircleFilled className="text-2xl" />
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <SafetyCertificateOutlined />
              Đã xác nhận qua VNPay
            </div>
            <h1 className="m-0 mt-2.5 text-xl font-bold tracking-tight text-slate-900">Thanh toán thành công</h1>
            <div className="mt-3 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{amount}</div>
            <p className="m-0 mt-1.5 text-sm text-slate-600">
              Khoản phí đã chuyển sang trạng thái <span className="font-semibold text-emerald-700">Đã thanh toán</span>.
            </p>
          </div>

          <div className="space-y-4 p-6">
            <StepTimeline activeStep={3} />
            {renderReceiptRows(p)}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 print:hidden">
              <Button
                icon={<PrinterOutlined />}
                onClick={() => window.print()}
                className="!h-10 rounded-xl border-slate-200 px-4 font-medium text-slate-700 hover:!border-slate-300 hover:!text-slate-900"
              >
                In biên lai
              </Button>
              {backButton}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (p.status === 'PENDING' || p.status === 'PROCESSING') {
    const pollingExhausted = pollCountRef.current >= MAX_PENDING_POLLS;
    return (
      <div className={`${FONT} mx-auto max-w-[600px] py-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
        <div className="overflow-hidden rounded-2xl border border-solid border-sky-200 bg-white shadow-sm">
          <div className="border-0 border-b border-solid border-sky-100 bg-sky-50/60 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0369A1] text-white shadow-sm">
              {pollingExhausted ? <ClockCircleFilled className="text-2xl" /> : <LoadingOutlined spin className="text-xl" />}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-[#0369A1] ring-1 ring-inset ring-sky-200">
              {pollingExhausted ? 'Đang chờ IPN từ VNPay' : 'Đang tự động cập nhật mỗi 2 giây'}
            </div>
            <h1 className="m-0 mt-2.5 text-xl font-bold tracking-tight text-slate-900">Đang chờ VNPay xác nhận</h1>
            <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900">{amount}</div>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">
              {pollingExhausted
                ? 'VNPay mất nhiều thời gian hơn dự kiến để gửi xác nhận. Bạn có thể bấm Kiểm tra lại hoặc quay về trang Công nợ sau ít phút.'
                : 'Giao dịch đang được hệ thống đối soát tự động. Trang sẽ tự cập nhật ngay khi VNPay hoàn tất xác nhận.'}
            </p>
          </div>

          <div className="space-y-4 p-6">
            <StepTimeline activeStep={2} />
            {renderReceiptRows(p)}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Button
                icon={<ReloadOutlined />}
                loading={result.isFetching}
                onClick={() => void result.refetch()}
                className="!h-10 rounded-xl border-slate-200 px-4 font-medium text-slate-700 hover:!border-slate-300 hover:!text-slate-900"
              >
                Kiểm tra lại ngay
              </Button>
              {backButton}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (p.status === 'NEEDS_REVIEW') {
    return (
      <div className={`${FONT} mx-auto max-w-[600px] py-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
        <div className="overflow-hidden rounded-2xl border border-solid border-amber-200 bg-white shadow-sm">
          <div className="border-0 border-b border-solid border-amber-100 bg-amber-50/70 px-6 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
              <ExclamationCircleFilled className="text-2xl" />
            </div>
            <div className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
              Cần đối soát thủ công
            </div>
            <h1 className="m-0 mt-2.5 text-xl font-bold tracking-tight text-slate-900">
              Đã nhận tiền, đang chờ HR Connect kiểm tra
            </h1>
            <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900">{amount}</div>
            <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">
              VNPay đã ghi nhận thanh toán nhưng khoản phí chưa tự động cập nhật. Đội ngũ HR Connect sẽ đối soát và cập nhật cho bạn sớm nhất.
            </p>
          </div>

          <div className="space-y-4 p-6">
            {renderReceiptRows(p)}
            <div className="flex justify-end pt-1">{backButton}</div>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = p.responseCode === CANCELLED;
  return (
    <div className={`${FONT} mx-auto max-w-[600px] py-6 animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      <div className="overflow-hidden rounded-2xl border border-solid border-red-200 bg-white shadow-sm">
        <div className="border-0 border-b border-solid border-red-100 bg-red-50/60 px-6 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm">
            <CloseCircleFilled className="text-2xl" />
          </div>
          <div className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
            {isCancelled ? 'Đã hủy giao dịch' : `Giao dịch không thành công${p.responseCode ? ` · Mã ${p.responseCode}` : ''}`}
          </div>
          <h1 className="m-0 mt-2.5 text-xl font-bold tracking-tight text-slate-900">
            {isCancelled ? 'Bạn đã hủy thanh toán' : 'Thanh toán không thành công'}
          </h1>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900">{amount}</div>
          <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">
            Khoản phí vẫn ở trạng thái chờ thanh toán. Bạn có thể quay lại trang Công nợ để thực hiện thanh toán lại.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <StepTimeline activeStep={3} isFailed />
          {renderReceiptRows(p)}
          <div className="flex justify-end pt-1">{backButton}</div>
        </div>
      </div>
    </div>
  );
};

export default ClientVnPayReturnPage;
