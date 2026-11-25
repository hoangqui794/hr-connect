/**
 * @file ClientBillingPage.tsx
 * @description Client "Công nợ" page (HR feedback 28/10): every fee the company owes HR Connect across the
 * three services, so the warranty page can stay Headhunt only.
 * - HH (HEADHUNT_COD) placement fees and SS (CV_SOURCING) deposits, settlements and credits: GET /service-fees.
 * - AP (CV_APPLICATION) paid posting packages: the `postingFee` that GET /jobs/mine carries per job (C-07); only a
 *   backend without that field is asked GET /jobs/{id}/posting-fee per paid-package job.
 * "Thanh toán" pays one fee through VNPay (the fee turns paid by itself on VNPay's confirmation) or shows the bank
 * transfer details, which Platform Admin still records by hand.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { a11yItemRender } from '@/components/common/paginationA11y';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LockOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { matchesSearch } from '@/utils/searchMatch';
import type { ServiceFee, ServiceFeeKind, ServiceFeeStatus } from '@/types/api/finance';
import type { ServiceTypeCode } from '@/types/api/jobs';
import { FilterPills, StatusDot, Surface, type Tone } from '@/features/admin-console/ui';
import { isDeadlineExpired, SERVICE_TYPE_LABEL } from '@/features/jobs-mf01/jobDisplay';
import { SERVICE_FEE_KIND, SERVICE_FEE_STATUS, labelOf, money, OWED_FEE_STATUS, isOwedToClient } from '@/features/finance-mf05/financeLabels';
import { depositTransferNote, serviceFeeTransferNote, transferNote } from '@/features/finance-mf05/platformBankAccount';
import { BillingPaymentModal } from './BillingPaymentModal';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const PAGE_SIZE = 10;

const serviceLabel = (code: ServiceTypeCode): string => SERVICE_TYPE_LABEL[code]?.label ?? code;

const resolveServiceType = (serviceTypeCode: string | null | undefined, fallback: ServiceTypeCode): ServiceTypeCode =>
  serviceTypeCode && serviceTypeCode in SERVICE_TYPE_LABEL ? (serviceTypeCode as ServiceTypeCode) : fallback;

const RECONCILIATION_REASON: Record<'PENDING' | 'FLAGGED', string> = {
  PENDING: 'Chờ xác nhận ngày đi làm thực tế',
  FLAGGED: 'Đang rà soát sai lệch đối soát',
};

const reconciliationHintOf = (status?: BillingRow['reconciliationStatus']): string | null =>
  status === 'PENDING' || status === 'FLAGGED' ? RECONCILIATION_REASON[status] : null;
const CLIENT_FEE_NAME: Record<ServiceFeeKind, string> = {
  PLACEMENT: 'Phí tuyển thành công',
  DEPOSIT: 'Đặt cọc',
  SETTLEMENT: 'Quyết toán theo CV',
  CREDIT: 'Hoàn cọc dư',
  REPLACEMENT_REFUND: 'Hoàn phí do không tìm được người thay',
};

/** Why a refund exists, with the real share from the row (never a fixed number). */
export const refundNote = (f: ServiceFee): string | null => {
  if (f.kind === 'REPLACEMENT_REFUND') {
    const when = f.replacementExpiredAt ? ` ngày ${dayjs(f.replacementExpiredAt).format('DD/MM/YYYY')}` : '';
    return `Suất thay thế hết hạn${when} mà chưa có ứng viên nào. HR Connect hoàn ${percent(f.feeMultiplier)} phí đã trả.`;
  }
  if (f.kind === 'CREDIT') return 'Số CV được nhận ít hơn số đã đặt cọc, phần cọc dư được hoàn lại.';
  return null;
};

import type { Bucket, BillingRow, BreakdownLine } from './billingTypes';
export type { Bucket, BillingRow, BreakdownLine };

const percent = (ratio: number) => `${Number((ratio * 100).toFixed(2))}%`;

/** HH: salary × multiplier. SS deposit: CVs × price = package, × deposit rate. SS settlement: counted CVs × price − deposit. */
export const feeBreakdown = (f: ServiceFee): BreakdownLine[] => {
  const kind: ServiceFeeKind = f.kind ?? 'PLACEMENT';
  const cur = f.currencyCode;
  const price = f.sourcingPricePerCv ?? null;
  if (kind === 'PLACEMENT') {
    return [
      { label: 'Lương gross tháng', value: money(f.baseSalary, cur) },
      { label: 'Hệ số phí', value: `${f.feeMultiplier} tháng lương` },
    ];
  }
  if (kind === 'REPLACEMENT_REFUND') {
    return [
      { label: 'Phí dịch vụ đã trả', value: money(f.baseSalary, cur) },
      { label: 'Tỷ lệ hoàn khi hết hạn thay thế', value: percent(f.feeMultiplier) },
    ];
  }
  if (kind === 'DEPOSIT') {
    return [
      ...(f.sourcingTarget && price
        ? [
            { label: 'Số CV đặt mua', value: `${f.sourcingTarget} CV` },
            ...(f.sourcingCounted != null ? [{ label: 'Đã nhận CV', value: `${f.sourcingCounted}/${f.sourcingTarget} CV` }] : []),
            { label: 'Đơn giá mỗi CV', value: money(price, cur) },
          ]
        : []),
      { label: 'Tổng giá trị gói', value: money(f.baseSalary, cur) },
      { label: 'Tỷ lệ đặt cọc', value: percent(f.feeMultiplier) },
    ];
  }
  // SETTLEMENT / CREDIT: total of the CVs counted, minus the deposit already paid.
  return [
    ...(price ? [{ label: 'Số CV được tính', value: `${Math.round(f.baseSalary / price)} CV × ${money(price, cur)}` }] : []),
    { label: 'Tổng giá trị CV được tính', value: money(f.baseSalary, cur) },
    {
      label: 'Đã đặt cọc',
      value: `− ${money(kind === 'CREDIT' ? f.baseSalary + f.amount : f.baseSalary - f.amount, cur)}`,
    },
  ];
};

const SERVICE_OF_KIND: Record<ServiceFeeKind, ServiceTypeCode> = {
  PLACEMENT: 'HEADHUNT_COD',
  DEPOSIT: 'CV_SOURCING',
  SETTLEMENT: 'CV_SOURCING',
  CREDIT: 'CV_SOURCING',
  REPLACEMENT_REFUND: 'HEADHUNT_COD',
};

const bucketOf = (status: ServiceFeeStatus | 'PENDING' | 'PAID' | 'CANCELLED'): Bucket =>
  status === 'PAID' ? 'PAID' : status === 'OVERDUE' ? 'OVERDUE' : status === 'CANCELLED' ? 'OTHER' : 'UNPAID';

const POSTING_STATUS: Record<'PENDING' | 'PAID' | 'CANCELLED', { label: string; tone: Tone }> = {
  PENDING: { label: 'Chờ thanh toán', tone: 'warning' },
  PAID: { label: 'Đã thanh toán', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const useBillingRows = () => {
  const fees = useQuery({
    queryKey: ['client-billing', 'service-fees'],
    queryFn: () => financeApi.serviceFees({ page: 1, pageSize: 100 }),
    staleTime: 60_000,
  });
  const summaryQuery = useQuery({
    queryKey: ['client-billing', 'service-fees-summary'],
    queryFn: async () => (await financeApi.serviceFeesSummary?.()) ?? null,
    enabled: typeof financeApi.serviceFeesSummary === 'function',
    staleTime: 60_000,
  });
  const postingFees = useQuery({
    queryKey: ['client-billing', 'posting-fees'],
    // GET /jobs/mine already carries each job's posting fee (C-07). Paid fees feed the "Đã thanh toán"
    // total, so every paid-package job is kept; only an older backend without the field is asked per job.
    staleTime: 60_000,
    queryFn: async () => {
      const jobs = await jobsApi.getMine();
      const paidPackageJobs = jobs.filter(
        (j) => j.serviceTypeCode === 'CV_APPLICATION' && j.postingFeeStatus && j.postingPackageCode !== 'FREE'
      );
      type Fee = {
        postingFeeId: string;
        amount: number;
        currencyCode: string;
        status: 'PENDING' | 'PAID' | 'CANCELLED';
        paidAt: string | null;
        paymentReference: string | null;
        packageName: string | null;
        createdAt?: string | null;
      };
      const items: Array<{ job: (typeof paidPackageJobs)[number]; fee: Fee | null | undefined }> = paidPackageJobs.map(
        (j) => ({ job: j, fee: j.postingFee })
      );
      const missing = items.filter((f) => f.fee === undefined);
      for (let i = 0; i < missing.length; i += 4) {
        await Promise.all(
          missing.slice(i, i + 4).map(async (f) => {
            f.fee = await jobsApi.getPostingFee(f.job.jobId);
          })
        );
      }
      return {
        allJobs: jobs,
        items: items.filter((f): f is { job: (typeof paidPackageJobs)[number]; fee: Fee } => !!f.fee && f.fee.amount > 0),
      };
    },
  });

  const rows = useMemo<BillingRow[]>(() => {
    const jobById = new Map((postingFees.data?.allJobs ?? []).map((j) => [j.jobId, j]));
    const serviceRows: BillingRow[] = (fees.data?.items ?? []).map((f) => {
      const kind: ServiceFeeKind = f.kind ?? 'PLACEMENT';
      const owed = isOwedToClient(kind);
      const status = (owed && OWED_FEE_STATUS[f.status]) || labelOf(SERVICE_FEE_STATUS, f.status);
      const reconciling =
        !owed &&
        f.status !== 'PAID' &&
        f.status !== 'CANCELLED' &&
        (f.reconciliationStatus === 'PENDING' || f.reconciliationStatus === 'FLAGGED');
      const bucket: Bucket = owed ? 'OTHER' : bucketOf(f.status);
      const awaitingConfirm = !owed && f.status !== 'PAID' && f.status !== 'CANCELLED' && Boolean(f.paymentSubmittedAt);
      const vnpayPending = !owed && f.status !== 'PAID' && f.status !== 'CANCELLED' && Boolean(f.pendingOnlinePayment);
      const relatedJob = kind === 'DEPOSIT' && f.jobId ? jobById.get(f.jobId) : undefined;
      const blockedByExpiredJob =
        !owed &&
        f.status !== 'PAID' &&
        f.status !== 'CANCELLED' &&
        kind === 'DEPOSIT' &&
        relatedJob?.status === 'PENDING_PAYMENT' &&
        isDeadlineExpired(relatedJob.applicationDeadline);
      return {
        key: `fee-${f.serviceFeeId}`,
        service: resolveServiceType(f.serviceTypeCode, SERVICE_OF_KIND[kind]),
        item: CLIENT_FEE_NAME[kind] ?? labelOf(SERVICE_FEE_KIND, kind).label,
        note: refundNote(f),
        owedToClient: owed,
        jobTitle: f.jobTitle ?? '—',
        candidateName: f.candidateName ?? null,
        amount: owed ? -f.amount : f.amount,
        currencyCode: f.currencyCode,
        dueDate: reconciling ? null : f.dueDate,
        statusLabel: reconciling ? 'Đang đối soát' : status.label,
        tone: reconciling ? 'info' : status.tone,
        bucket,
        paidAt: f.paidAt ?? null,
        paymentReference: f.paymentReference ?? null,
        transferNote: kind === 'DEPOSIT' && f.jobId ? depositTransferNote(f.jobId) : serviceFeeTransferNote(f.serviceFeeId),
        payable: !reconciling && !awaitingConfirm && !vnpayPending && !blockedByExpiredJob && (bucket === 'UNPAID' || bucket === 'OVERDUE'),
        payTarget: { type: 'SERVICE_FEE', id: f.serviceFeeId },
        breakdown: feeBreakdown(f),
        sourcingProgress: f.sourcingTarget && f.sourcingTarget > 0
          ? { counted: f.sourcingCounted ?? 0, target: f.sourcingTarget }
          : null,
        createdAt: f.createdAt ?? null,
        placementId: f.placementId ?? null,
        reconciliationStatus: reconciling ? f.reconciliationStatus ?? null : null,
        cancelled: f.status === 'CANCELLED',
        serviceTypeCode: f.serviceTypeCode ?? null,
        daysOverdue: f.daysOverdue ?? null,
        paymentSubmittedAt: f.paymentSubmittedAt ?? null,
        pendingOnlinePayment: f.pendingOnlinePayment ?? false,
        blockedByExpiredJob,
        applicationDeadline: relatedJob?.applicationDeadline ?? null,
      };
    });
    const postingRows: BillingRow[] = (postingFees.data?.items ?? []).map(({ job, fee }) => {
      const st = POSTING_STATUS[fee!.status];
      const bucket = bucketOf(fee!.status);
      const blockedByExpiredJob =
        fee!.status === 'PENDING' &&
        job.status === 'PENDING_PAYMENT' &&
        isDeadlineExpired(job.applicationDeadline);
      return {
        key: `posting-${fee!.postingFeeId}`,
        service: 'CV_APPLICATION',
        item: `Gói đăng tin${fee!.packageName ? ` · ${fee!.packageName}` : ''}`,
        jobTitle: job.title,
        candidateName: null,
        amount: fee!.amount,
        currencyCode: fee!.currencyCode,
        dueDate: null,
        statusLabel: st.label,
        tone: st.tone,
        bucket,
        paidAt: fee!.paidAt,
        paymentReference: fee!.paymentReference,
        transferNote: transferNote(job.jobId),
        payable: bucket === 'UNPAID' && !blockedByExpiredJob,
        payTarget: { type: 'POSTING_FEE', id: job.jobId },
        breakdown: [{ label: 'Gói đăng tin', value: fee!.packageName ?? '—' }],
        createdAt: fee!.createdAt ?? null,
        cancelled: fee!.status === 'CANCELLED',
        blockedByExpiredJob,
        applicationDeadline: job.applicationDeadline ?? null,
      };
    });
    return [...serviceRows, ...postingRows].sort((a, b) => {
      const rank = { OVERDUE: 0, UNPAID: 1, PAID: 2, OTHER: 3 } as const;
      return rank[a.bucket] - rank[b.bucket];
    });
  }, [fees.data, postingFees.data]);

  return {
    rows,
    serviceFeeSummary: summaryQuery.data ?? null,
    loadedServiceFees: fees.data?.items?.length ?? 0,
    totalServiceFees: fees.data?.totalCount ?? 0,
    loading: fees.isLoading || postingFees.isLoading,
    fetching: fees.isFetching || postingFees.isFetching || summaryQuery.isFetching,
    error: fees.error ?? postingFees.error,
    refetch: () => {
      void fees.refetch();
      void postingFees.refetch();
      void summaryQuery.refetch();
    },
  };
};

type ServiceFilter = 'all' | ServiceTypeCode;
type StatusFilter = 'all' | 'UNPAID' | 'OVERDUE' | 'PAID' | 'REFUND';

const timestampOf = (iso?: string | null) => (iso ? Date.parse(iso) || 0 : 0);
const isPendingRefundRow = (r: BillingRow) =>
  r.owedToClient && !r.paidAt && !r.cancelled && r.statusLabel !== 'Đã hoàn tiền';
const isPaidRefundRow = (r: BillingRow) => r.owedToClient && Boolean(r.paidAt) && !r.cancelled;

const sumVnd = (rows: BillingRow[]) => rows.filter((r) => r.currencyCode === 'VND').reduce((s, r) => s + r.amount, 0);

const sumByMainCurrency = (list: BillingRow[]) => {
  const currencies = Array.from(new Set(list.map((r) => r.currencyCode)));
  if (currencies.length === 1) {
    return { amount: list.reduce((s, r) => s + r.amount, 0), currency: currencies[0] };
  }
  return { amount: sumVnd(list), currency: 'VND' };
};

const Kpi: React.FC<{
  label: string;
  value: string;
  hint: string;
  tone?: 'danger' | 'success' | 'info';
  onClick?: () => void;
}> = ({ label, value, hint, tone, onClick }) => {
  const content = (
    <Surface
      padded
      className={`!px-4 !py-3 shadow-xs transition-shadow hover:shadow-sm ${onClick ? 'cursor-pointer hover:border-sky-300' : ''}`}
    >
      <div className="text-[13px] font-medium text-slate-600">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums ${
          tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-700' : tone === 'info' ? 'text-sky-700' : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
    </Surface>
  );
  if (!onClick) return content;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 rounded-xl"
    >
      {content}
    </div>
  );
};

export const ClientBillingPage: React.FC = () => {
  const { rows, serviceFeeSummary, loadedServiceFees, totalServiceFees, loading, fetching, error, refetch } = useBillingRows();
  const [service, setService] = useState<ServiceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<BillingRow | null>(null);

  const byService = service === 'all' ? rows : rows.filter((r) => r.service === service);
  const byStatus = (() => {
    if (status === 'all') return byService;
    if (status === 'REFUND') {
      return byService
        .filter((r) => r.owedToClient)
        .sort((a, b) => {
          const rankOf = (r: BillingRow) => (isPendingRefundRow(r) ? 0 : isPaidRefundRow(r) ? 1 : 2);
          const rankDiff = rankOf(a) - rankOf(b);
          if (rankDiff !== 0) return rankDiff;
          const paidDiff = timestampOf(b.paidAt) - timestampOf(a.paidAt);
          if (paidDiff !== 0) return paidDiff;
          return timestampOf(b.createdAt) - timestampOf(a.createdAt);
        });
    }
    if (status === 'PAID') {
      return byService
        .filter((r) => r.bucket === 'PAID' || isPaidRefundRow(r))
        .sort((a, b) => {
          const paidDiff = timestampOf(b.paidAt) - timestampOf(a.paidAt);
          if (paidDiff !== 0) return paidDiff;
          return timestampOf(b.createdAt) - timestampOf(a.createdAt);
        });
    }
    return byService.filter((r) => r.bucket === status || (status === 'UNPAID' && r.bucket === 'OVERDUE'));
  })();
  const visible = useMemo(
    () =>
      byStatus.filter((r) =>
        matchesSearch(
          searchText,
          r.jobTitle,
          r.candidateName,
          r.item,
          r.paymentReference,
          r.transferNote,
          r.placementId,
          r.statusLabel,
          serviceLabel(r.service)
        )
      ),
    [byStatus, searchText]
  );
  const unpaid = rows.filter((r) => r.bucket === 'UNPAID' || r.bucket === 'OVERDUE');
  const overdue = rows.filter((r) => r.bucket === 'OVERDUE');
  const paid = rows.filter((r) => r.bucket === 'PAID');
  const pendingRefunds = rows.filter((r) => r.owedToClient && !r.paidAt && !r.cancelled && r.statusLabel !== 'Đã hoàn tiền');

  const postingRows = rows.filter((r) => r.key.startsWith('posting-'));
  const postingUnpaid = postingRows.filter((r) => r.bucket === 'UNPAID' || r.bucket === 'OVERDUE');
  const postingOverdue = postingRows.filter((r) => r.bucket === 'OVERDUE');
  const postingPaid = postingRows.filter((r) => r.bucket === 'PAID');
  const sumCurrency = (list: BillingRow[], currency: string) =>
    list
      .filter((r) => (r.currencyCode ?? 'VND').toUpperCase() === currency.toUpperCase())
      .reduce((s, r) => s + r.amount, 0);

  const summaryCurrency = serviceFeeSummary?.currencyCode || 'VND';
  const summaryBreakdown = serviceFeeSummary?.currencyBreakdowns?.find(
    (b) => (b.currencyCode ?? 'VND').toUpperCase() === summaryCurrency.toUpperCase()
  );
  const countCurrency = (list: BillingRow[], currency: string) =>
    list.filter((r) => (r.currencyCode ?? 'VND').toUpperCase() === currency.toUpperCase()).length;
  const postingUnpaidCount = countCurrency(postingUnpaid, summaryCurrency);
  const postingOverdueCount = countCurrency(postingOverdue, summaryCurrency);
  const postingPaidCount = countCurrency(postingPaid, summaryCurrency);

  const unpaidTotal = serviceFeeSummary
    ? { amount: (summaryBreakdown?.unpaidAmount ?? serviceFeeSummary.unpaidAmount) + sumCurrency(postingUnpaid, summaryCurrency), currency: summaryCurrency }
    : sumByMainCurrency(unpaid);
  const unpaidCount = serviceFeeSummary
    ? (summaryBreakdown?.unpaidCount ?? serviceFeeSummary.unpaidCount) + postingUnpaidCount
    : countCurrency(unpaid, unpaidTotal.currency);
  const overdueTotal = serviceFeeSummary
    ? { amount: (summaryBreakdown?.overdueAmount ?? serviceFeeSummary.overdueAmount) + sumCurrency(postingOverdue, summaryCurrency), currency: summaryCurrency }
    : sumByMainCurrency(overdue);
  const overdueCount = serviceFeeSummary
    ? (summaryBreakdown?.overdueCount ?? serviceFeeSummary.overdueCount) + postingOverdueCount
    : countCurrency(overdue, overdueTotal.currency);
  const paidTotal = serviceFeeSummary
    ? { amount: (summaryBreakdown?.paidAmount ?? serviceFeeSummary.paidAmount) + sumCurrency(postingPaid, summaryCurrency), currency: summaryCurrency }
    : sumByMainCurrency(paid);
  const paidCount = serviceFeeSummary
    ? (summaryBreakdown?.paidCount ?? serviceFeeSummary.paidCount) + postingPaidCount
    : countCurrency(paid, paidTotal.currency);
  const refundTotal = serviceFeeSummary
    ? { amount: summaryBreakdown?.pendingRefundAmount ?? serviceFeeSummary.pendingRefundAmount, currency: summaryCurrency }
    : sumByMainCurrency(pendingRefunds);
  const pendingRefundCount = serviceFeeSummary
    ? (summaryBreakdown?.pendingRefundCount ?? serviceFeeSummary.pendingRefundCount)
    : countCurrency(pendingRefunds, refundTotal.currency);
  const totalFeeRowsBadgeCount = serviceFeeSummary ? serviceFeeSummary.totalCount + postingRows.length : rows.length;

  const columns: ColumnsType<BillingRow> = [
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      width: 240,
      render: (_, r) => (
        <div className="min-w-0 py-1">
          <div className="truncate font-semibold text-[13.5px] text-slate-900 leading-snug" title={r.jobTitle}>
            {r.jobTitle}
          </div>
          {r.candidateName ? (
            <div className="truncate text-xs text-slate-500 mt-0.5">
              Ứng viên: <span className="font-medium text-slate-700">{r.candidateName}</span>
            </div>
          ) : null}
          {r.sourcingProgress ? (
            <div className="truncate text-xs text-slate-500 mt-0.5 tabular-nums">
              Đã nhận:{' '}
              <span className="font-semibold text-sky-700">
                {r.sourcingProgress.counted}/{r.sourcingProgress.target} CV
              </span>
            </div>
          ) : null}
          {r.note && <div className="mt-0.5 whitespace-normal text-[11.5px] font-medium leading-snug text-emerald-700">{r.note}</div>}
        </div>
      ),
    },
    {
      title: 'Dịch vụ',
      key: 'service',
      width: 170,
      render: (_, r) => (
        <div className="py-1">
          <Tag
            className="m-0 rounded-md border-0 px-2 py-0.5 text-[11.5px] font-bold"
            color={r.service === 'HEADHUNT_COD' ? 'orange' : r.service === 'CV_SOURCING' ? 'cyan' : 'blue'}
          >
            {serviceLabel(r.service)}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Khoản phí',
      key: 'item',
      width: 210,
      render: (_, r) => (
        <div className="min-w-0 py-1">
          <div className="text-[13.5px] font-semibold leading-snug text-slate-900">{r.item}</div>
          {(r.createdAt || r.placementId) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-slate-500 tabular-nums">
              {r.createdAt && <span>Lập {dayjs(r.createdAt).format('DD/MM/YYYY')}</span>}
              {r.placementId && (
                <Tooltip title={`Xem chi tiết nhận việc (${r.placementId})`}>
                  <Link
                    to={`/client/placements/${r.placementId}`}
                    aria-label={`Xem chi tiết nhận việc #${r.placementId.slice(0, 8).toUpperCase()}`}
                    className="font-mono text-[#0369A1] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
                  >
                    #{r.placementId.slice(0, 8).toUpperCase()}
                  </Link>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Số tiền',
      key: 'amount',
      align: 'right',
      width: 150,
      render: (_, r) => (
        <span className={`font-semibold tabular-nums text-[13.5px] ${r.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
          {r.amount < 0 ? `Hoàn ${money(-r.amount, r.currencyCode)}` : money(r.amount, r.currencyCode)}
        </span>
      ),
    },
    {
      title: 'Hạn thanh toán',
      key: 'due',
      align: 'center',
      width: 140,
      render: (_, r) => {
        if (r.owedToClient && r.dueDate && !r.cancelled && r.statusLabel !== 'Đã hoàn tiền' && !r.paidAt) {
          return (
            <span className="text-[12px] leading-snug text-emerald-700">
              HR Connect hoàn
              <br />
              trước {dayjs(r.dueDate).format('DD/MM/YYYY')}
            </span>
          );
        }
        const overdueDays =
          !r.reconciliationStatus && Boolean(r.dueDate)
            ? typeof r.daysOverdue === 'number'
              ? Math.max(0, r.daysOverdue)
              : !r.owedToClient && r.bucket === 'OVERDUE' && r.dueDate
              ? Math.max(0, dayjs().startOf('day').diff(dayjs(r.dueDate).startOf('day'), 'day'))
              : 0
            : 0;
        return (
          <div className="tabular-nums">
            <span className="text-[13px] text-slate-700">{r.dueDate ? dayjs(r.dueDate).format('DD/MM/YYYY') : '—'}</span>
            {overdueDays > 0 && <div className="mt-0.5 text-[11px] font-semibold text-red-600">Quá hạn {overdueDays} ngày</div>}
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'left',
      width: 215,
      render: (_, r) => {
        const reconcileHint = reconciliationHintOf(r.reconciliationStatus);
        const submittedDate =
          r.paymentSubmittedAt && dayjs(r.paymentSubmittedAt).isValid()
            ? dayjs(r.paymentSubmittedAt).format('DD/MM/YYYY')
            : null;
        return (
          <div className="py-1 space-y-0.5 text-left">
            <StatusDot tone={r.blockedByExpiredJob ? 'danger' : r.tone}>
              {r.blockedByExpiredJob ? 'Quá hạn nhận hồ sơ' : r.statusLabel}
            </StatusDot>
            {reconcileHint && <div className="pl-3.5 text-[11.5px] leading-snug text-sky-700">{reconcileHint}</div>}
            {!r.paidAt && !r.cancelled && r.paymentSubmittedAt && (
              <div className="pl-3.5 text-[11.5px] font-medium leading-snug text-sky-700">
                Đã báo chuyển khoản – chờ xác nhận{submittedDate ? ` (${submittedDate})` : ''}
              </div>
            )}
            {!r.paidAt && !r.cancelled && r.pendingOnlinePayment && (
              <div className="pl-3.5 text-[11.5px] font-medium leading-snug text-amber-700">
                VNPay đang xử lý
              </div>
            )}
            {r.paidAt && (
              <div className="text-[11.5px] text-slate-500 pl-3.5">
                {dayjs(r.paidAt).format('DD/MM/YYYY')}
                {r.paymentReference ? ` · ${r.paymentReference}` : ''}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      width: 130,
      render: (_, r) => {
        const reconcileHint = reconciliationHintOf(r.reconciliationStatus);
        const blockedBySubmittedTransfer = !r.payable && !r.paidAt && !r.cancelled && Boolean(r.paymentSubmittedAt);
        const blockedByVnpay = !r.payable && !r.paidAt && !r.cancelled && Boolean(r.pendingOnlinePayment);
        return (
          <div className="flex justify-end py-1">
            {r.payable ? (
              <Button
                type="primary"
                size="small"
                className="!bg-[#0369A1] hover:!bg-[#075985] !border-0 text-white w-[100px] !h-8 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98]"
                onClick={() => setPaying(r)}
                aria-label={`Thanh toán: ${r.item} · ${r.jobTitle}`}
              >
                Thanh toán
              </Button>
            ) : r.blockedByExpiredJob ? (
              <Tooltip title="Tin chưa phát hành nhưng đã quá hạn nhận hồ sơ — đã khóa thanh toán">
                <Button
                  size="small"
                  icon={<LockOutlined />}
                  className="!border-rose-200 !bg-rose-50 !text-rose-700 hover:!border-rose-300 w-[100px] !h-8 text-xs font-semibold rounded-lg"
                  onClick={() => setPaying(r)}
                  aria-label={`Đã khóa thanh toán: ${r.item} · ${r.jobTitle}`}
                >
                  Đã khóa
                </Button>
              </Tooltip>
            ) : blockedByVnpay ? (
              <Tooltip title="Đang có giao dịch VNPay chờ kết quả xác nhận">
                <span className="inline-block w-[110px] text-center text-amber-700 text-[11.5px] font-medium">VNPay chờ XL</span>
              </Tooltip>
            ) : blockedBySubmittedTransfer ? (
              <Tooltip title="Đã gửi xác nhận chuyển khoản, đang chờ HR Connect đối soát">
                <span className="inline-block w-[110px] text-center text-sky-700 text-[11.5px] font-medium">Chờ xác nhận</span>
              </Tooltip>
            ) : reconcileHint ? (
              <Tooltip title={`Chưa mở thanh toán: ${reconcileHint}`}>
                <span className="inline-block w-[100px] text-center text-sky-700 text-[11.5px] font-medium">Chờ đối soát</span>
              </Tooltip>
            ) : (
              <span className="inline-block w-[100px] text-center text-slate-400 text-xs">—</span>
            )}
          </div>
        );
      },
    },
  ];

  const count = (code: ServiceTypeCode) => rows.filter((r) => r.service === code).length;

  return (
    <div className={`${FONT} animate-[admin-page-in_220ms_cubic-bezier(0.2,0.8,0.2,1)_both]`}>
      {/* ── Compact header: the top bar already shows the page title ── */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sr-only">
              Công nợ & phí dịch vụ
            </h1>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-[#0284C7] border border-sky-100">
              {totalFeeRowsBadgeCount} khoản phí
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            icon={<ReloadOutlined spin={fetching} />}
            className="!h-10 !rounded-xl border-slate-200 hover:!border-slate-300 font-semibold text-slate-700"
            onClick={refetch}
          >
            Làm mới
          </Button>
        </div>
      </div>

      <div className={`mb-4 grid gap-3 ${pendingRefundCount > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <Kpi label="Cần thanh toán" value={money(unpaidTotal.amount, unpaidTotal.currency)} hint={`${unpaidCount} khoản chưa thanh toán`} />
        <Kpi label="Quá hạn" value={money(overdueTotal.amount, overdueTotal.currency)} hint={`${overdueCount} khoản quá hạn`} tone={overdueCount ? 'danger' : undefined} />
        <Kpi label="Đã thanh toán" value={money(paidTotal.amount, paidTotal.currency)} hint={`${paidCount} khoản`} tone="success" />
        {pendingRefundCount > 0 && (
          <Kpi
            label="HR Connect cần hoàn"
            value={money(Math.abs(refundTotal.amount), refundTotal.currency)}
            hint={`${pendingRefundCount} khoản chờ hoàn tiền`}
            tone="info"
            onClick={() => {
              setStatus('REFUND');
              setPage(1);
            }}
          />
        )}
      </div>

      {totalServiceFees > loadedServiceFees && (
        <Alert
          type="info"
          showIcon
          className="mb-4 rounded-xl"
          message={
            serviceFeeSummary
              ? `Đang hiển thị ${loadedServiceFees}/${totalServiceFees} khoản phí dịch vụ gần nhất · Số liệu KPI đã tổng hợp toàn bộ hệ thống.`
              : `Đang hiển thị ${loadedServiceFees}/${totalServiceFees} khoản phí dịch vụ gần nhất.`
          }
        />
      )}

      <Surface>
        <div className="flex flex-col gap-3 px-5 pb-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterPills<ServiceFilter>
              label="Lọc theo dịch vụ"
              value={service}
              onChange={(v) => {
                setService(v);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Tất cả', count: rows.length },
                { value: 'HEADHUNT_COD', label: serviceLabel('HEADHUNT_COD'), count: count('HEADHUNT_COD') },
                { value: 'CV_SOURCING', label: serviceLabel('CV_SOURCING'), count: count('CV_SOURCING') },
                { value: 'CV_APPLICATION', label: serviceLabel('CV_APPLICATION'), count: count('CV_APPLICATION') },
              ]}
            />
            <Input
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Tìm tin tuyển dụng, ứng viên, khoản phí, mã GD..."
              aria-label="Tìm kiếm công nợ và phí dịch vụ"
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-[320px] !rounded-xl"
            />
          </div>
          <FilterPills<StatusFilter>
            label="Lọc theo trạng thái"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'Mọi trạng thái' },
              { value: 'UNPAID', label: 'Cần thanh toán' },
              { value: 'OVERDUE', label: 'Quá hạn' },
              { value: 'PAID', label: 'Đã thanh toán' },
              { value: 'REFUND', label: 'Hoàn tiền', count: byService.filter((r) => r.owedToClient).length },
            ]}
          />
        </div>
        {error ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được công nợ" description={getApiErrorMessage(error)} />
          </div>
        ) : (
          <Table<BillingRow>
            className="admin-soft-table"
            rowKey="key"
            columns={columns}
            dataSource={visible}
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{ itemRender: a11yItemRender, current: page, pageSize: PAGE_SIZE, total: visible.length, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {searchText.trim()
                    ? `Không tìm thấy khoản phí nào khớp với "${searchText.trim()}".`
                    : rows.length
                    ? 'Không có khoản phí nào khớp bộ lọc.'
                    : 'Chưa phát sinh khoản phí nào với HR Connect.'}
                </div>
              ),
            }}
          />
        )}
      </Surface>

      <BillingPaymentModal row={paying} onClose={() => setPaying(null)} />
    </div>
  );
};

export default ClientBillingPage;
