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
import { a11yItemRender } from '@/components/common/paginationA11y';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { OnlinePaymentTargetType, ServiceFee, ServiceFeeKind, ServiceFeeStatus } from '@/types/api/finance';
import type { ServiceTypeCode } from '@/types/api/jobs';
import { FilterPills, PageHero, StatusDot, Surface, type Tone } from '@/features/admin-console/ui';
import { SERVICE_FEE_KIND, SERVICE_FEE_STATUS, labelOf, money, OWED_FEE_STATUS, isOwedToClient } from '@/features/finance-mf05/financeLabels';
import { depositTransferNote, serviceFeeTransferNote, transferNote } from '@/features/finance-mf05/platformBankAccount';
import { BillingPaymentModal } from './BillingPaymentModal';

const FONT = "font-['Be_Vietnam_Pro',system-ui,sans-serif]";

const PAGE_SIZE = 10;

/** Client wording (no "Client", no HH/SS/AP); Admin keeps the finance labels. */
const CLIENT_SERVICE_NAME: Record<ServiceTypeCode, string> = {
  HEADHUNT_COD: 'Tuyển qua Affiliate',
  CV_SOURCING: 'Mua CV theo số lượng',
  CV_APPLICATION: 'Nhận hồ sơ ứng tuyển',
};
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
      { label: 'Hệ số phí', value: `× ${f.feeMultiplier}` },
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
      type Fee = { postingFeeId: string; amount: number; currencyCode: string; status: 'PENDING' | 'PAID' | 'CANCELLED'; paidAt: string | null; paymentReference: string | null; packageName: string | null };
      const fees: Array<{ job: (typeof paidPackageJobs)[number]; fee: Fee | null | undefined }> = paidPackageJobs.map(
        (j) => ({ job: j, fee: j.postingFee })
      );
      const missing = fees.filter((f) => f.fee === undefined);
      for (let i = 0; i < missing.length; i += 4) {
        await Promise.all(
          missing.slice(i, i + 4).map(async (f) => {
            f.fee = await jobsApi.getPostingFee(f.job.jobId);
          })
        );
      }
      return fees.filter((f): f is { job: (typeof paidPackageJobs)[number]; fee: Fee } => !!f.fee && f.fee.amount > 0);
    },
  });

  const rows = useMemo<BillingRow[]>(() => {
    const serviceRows: BillingRow[] = (fees.data?.items ?? []).map((f) => {
      const kind: ServiceFeeKind = f.kind ?? 'PLACEMENT';
      const status = (isOwedToClient(kind) && OWED_FEE_STATUS[f.status]) || labelOf(SERVICE_FEE_STATUS, f.status);
      const reconciling = f.reconciliationStatus === 'PENDING' || f.reconciliationStatus === 'FLAGGED';
      const bucket: Bucket = isOwedToClient(kind) ? 'OTHER' : bucketOf(f.status);
      return {
        key: `fee-${f.serviceFeeId}`,
        service: SERVICE_OF_KIND[kind],
        item: CLIENT_FEE_NAME[kind] ?? labelOf(SERVICE_FEE_KIND, kind).label,
        note: refundNote(f),
        owedToClient: isOwedToClient(kind),
        jobTitle: f.jobTitle ?? '—',
        candidateName: f.candidateName ?? null,
        amount: isOwedToClient(kind) ? -f.amount : f.amount,
        currencyCode: f.currencyCode,
        dueDate: reconciling ? null : f.dueDate,
        statusLabel: reconciling ? 'Đang đối soát' : status.label,
        tone: reconciling ? 'info' : status.tone,
        bucket,
        paidAt: f.paidAt ?? null,
        paymentReference: f.paymentReference ?? null,
        transferNote: kind === 'DEPOSIT' && f.jobId ? depositTransferNote(f.jobId) : serviceFeeTransferNote(f.serviceFeeId),
        payable: !reconciling && (bucket === 'UNPAID' || bucket === 'OVERDUE'),
        payTarget: { type: 'SERVICE_FEE', id: f.serviceFeeId },
        breakdown: feeBreakdown(f),
      };
    });
    const postingRows: BillingRow[] = (postingFees.data ?? []).map(({ job, fee }) => {
      const st = POSTING_STATUS[fee!.status];
      const bucket = bucketOf(fee!.status);
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
        payable: bucket === 'UNPAID',
        payTarget: { type: 'POSTING_FEE', id: job.jobId },
        breakdown: [{ label: 'Gói đăng tin', value: fee!.packageName ?? '—' }],
      };
    });
    return [...serviceRows, ...postingRows].sort((a, b) => {
      const rank = { OVERDUE: 0, UNPAID: 1, PAID: 2, OTHER: 3 } as const;
      return rank[a.bucket] - rank[b.bucket];
    });
  }, [fees.data, postingFees.data]);

  return {
    rows,
    loading: fees.isLoading || postingFees.isLoading,
    fetching: fees.isFetching || postingFees.isFetching,
    error: fees.error ?? postingFees.error,
    refetch: () => {
      void fees.refetch();
      void postingFees.refetch();
    },
  };
};

type ServiceFilter = 'all' | ServiceTypeCode;
type StatusFilter = 'all' | 'UNPAID' | 'OVERDUE' | 'PAID';

const sumVnd = (rows: BillingRow[]) => rows.filter((r) => r.currencyCode === 'VND').reduce((s, r) => s + r.amount, 0);

const Kpi: React.FC<{ label: string; value: string; hint: string; tone?: 'danger' | 'success' }> = ({ label, value, hint, tone }) => (
  <Surface padded className="!px-4 !py-3 shadow-xs transition-shadow hover:shadow-sm">
    <div className="text-[13px] font-medium text-slate-600">{label}</div>
    <div
      className={`text-lg font-bold tabular-nums ${
        tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900'
      }`}
    >
      {value}
    </div>
    <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
  </Surface>
);

export const ClientBillingPage: React.FC = () => {
  const { rows, loading, fetching, error, refetch } = useBillingRows();
  const [service, setService] = useState<ServiceFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<BillingRow | null>(null);

  const byService = service === 'all' ? rows : rows.filter((r) => r.service === service);
  const visible = status === 'all' ? byService : byService.filter((r) => r.bucket === status || (status === 'UNPAID' && r.bucket === 'OVERDUE'));
  const unpaid = rows.filter((r) => r.bucket === 'UNPAID' || r.bucket === 'OVERDUE');
  const overdue = rows.filter((r) => r.bucket === 'OVERDUE');
  const paid = rows.filter((r) => r.bucket === 'PAID');

  const columns: ColumnsType<BillingRow> = [
    {
      title: 'Dịch vụ',
      key: 'service',
      width: 280,
      render: (_, r) => (
        <div className="min-w-0 py-1">
          <div className="text-[13.5px] font-semibold leading-snug text-slate-900">{r.item}</div>
          <Tag
            className="m-0 mt-1 rounded-md border-0 px-1.5 py-0.5 text-[11px] font-bold"
            color={r.service === 'HEADHUNT_COD' ? 'orange' : r.service === 'CV_SOURCING' ? 'cyan' : 'blue'}
          >
            {CLIENT_SERVICE_NAME[r.service]}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      width: 260,
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
          {r.note && <div className="mt-0.5 whitespace-normal text-[11.5px] font-medium leading-snug text-emerald-700">{r.note}</div>}
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
      width: 130,
      render: (_, r) => (
        r.owedToClient && r.dueDate && r.bucket !== 'PAID' && !r.paidAt ? (
          <span className="text-[12px] leading-snug text-emerald-700">
            HR Connect hoàn
            <br />
            trước {dayjs(r.dueDate).format('DD/MM/YYYY')}
          </span>
        ) : (
          <span className="tabular-nums text-[13px] text-slate-700">{r.dueDate ? dayjs(r.dueDate).format('DD/MM/YYYY') : '—'}</span>
        )
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'left',
      width: 170,
      render: (_, r) => (
        <div className="py-1 space-y-0.5 text-left">
          <StatusDot tone={r.tone}>{r.statusLabel}</StatusDot>
          {r.paidAt && (
            <div className="text-[11.5px] text-slate-500 pl-3.5">
              {dayjs(r.paidAt).format('DD/MM/YYYY')}
              {r.paymentReference ? ` · ${r.paymentReference}` : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      width: 120,
      render: (_, r) => (
        <div className="flex justify-end py-1">
          {r.payable ? (
            <Button
              type="primary"
              size="small"
              className="!bg-gradient-to-r !from-[#0284C7] !to-[#2563EB] hover:!from-[#0369A1] hover:!to-[#1D4ED8] !border-0 text-white w-[100px] !h-8 text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-[0.98]"
              onClick={() => setPaying(r)}
              aria-label={`Thanh toán: ${r.item} · ${r.jobTitle}`}
            >
              Thanh toán
            </Button>
          ) : (
            <span className="inline-block w-[100px] text-center text-slate-400 text-xs">—</span>
          )}
        </div>
      ),
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
              {rows.length} khoản phí
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kpi label="Cần thanh toán" value={money(sumVnd(unpaid))} hint={`${unpaid.length} khoản chưa thanh toán`} />
        <Kpi label="Quá hạn" value={money(sumVnd(overdue))} hint={`${overdue.length} khoản quá hạn`} tone={overdue.length ? 'danger' : undefined} />
        <Kpi label="Đã thanh toán" value={money(sumVnd(paid))} hint={`${paid.length} khoản`} tone="success" />
      </div>

      <Surface>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
          <FilterPills<ServiceFilter>
            label="Lọc theo dịch vụ"
            value={service}
            onChange={(v) => {
              setService(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'Tất cả', count: rows.length },
              { value: 'HEADHUNT_COD', label: CLIENT_SERVICE_NAME.HEADHUNT_COD, count: count('HEADHUNT_COD') },
              { value: 'CV_SOURCING', label: CLIENT_SERVICE_NAME.CV_SOURCING, count: count('CV_SOURCING') },
              { value: 'CV_APPLICATION', label: CLIENT_SERVICE_NAME.CV_APPLICATION, count: count('CV_APPLICATION') },
            ]}
          />
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
            scroll={{ x: 1040 }}
            pagination={{ itemRender: a11yItemRender, current: page, pageSize: PAGE_SIZE, total: visible.length, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <div className="py-10 text-slate-600">
                  {rows.length ? 'Không có khoản phí nào khớp bộ lọc.' : 'Chưa phát sinh khoản phí nào với HR Connect.'}
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
