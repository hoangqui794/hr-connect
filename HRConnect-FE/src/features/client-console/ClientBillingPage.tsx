/**
 * @file ClientBillingPage.tsx
 * @description Client "Công nợ" page (HR feedback 28/10): every fee the company owes HR Connect across the
 * three services, so the warranty page can stay Headhunt only.
 * - HH (HEADHUNT_COD) placement fees and SS (CV_SOURCING) deposits, settlements and credits: GET /service-fees.
 * - AP (CV_APPLICATION) paid posting packages: GET /jobs/{id}/posting-fee for each paid-package job.
 * Payments are recorded by Platform Admin, so the page is read-only.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { ServiceFeeKind, ServiceFeeStatus } from '@/types/api/finance';
import type { ServiceTypeCode } from '@/types/api/jobs';
import { FilterPills, PageHero, StatusDot, Surface, type Tone } from '@/features/admin-console/ui';
import { SERVICE_FEE_KIND, SERVICE_FEE_STATUS, date, labelOf, money } from '@/features/finance-mf05/financeLabels';
import { SERVICE_TYPE_LABEL } from '@/features/jobs-mf01/jobDisplay';

const PAGE_SIZE = 10;

type Bucket = 'UNPAID' | 'OVERDUE' | 'PAID' | 'OTHER';

export interface BillingRow {
  key: string;
  service: ServiceTypeCode;
  item: string;
  jobTitle: string;
  candidateName: string | null;
  /** Negative for a CREDIT returned to the Client. */
  amount: number;
  currencyCode: string;
  dueDate: string | null;
  statusLabel: string;
  tone: Tone;
  bucket: Bucket;
  paidAt: string | null;
  paymentReference: string | null;
}

const SERVICE_OF_KIND: Record<ServiceFeeKind, ServiceTypeCode> = {
  PLACEMENT: 'HEADHUNT_COD',
  DEPOSIT: 'CV_SOURCING',
  SETTLEMENT: 'CV_SOURCING',
  CREDIT: 'CV_SOURCING',
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
  });
  const postingFees = useQuery({
    queryKey: ['client-billing', 'posting-fees'],
    queryFn: async () => {
      const jobs = await jobsApi.getMine();
      const paidPackageJobs = jobs.filter(
        (j) => j.serviceTypeCode === 'CV_APPLICATION' && j.postingFeeStatus && j.postingPackageCode !== 'FREE'
      );
      const fees = await Promise.all(paidPackageJobs.map((j) => jobsApi.getPostingFee(j.jobId).then((fee) => ({ job: j, fee }))));
      return fees.filter((f) => f.fee && f.fee.amount > 0);
    },
  });

  const rows = useMemo<BillingRow[]>(() => {
    const serviceRows: BillingRow[] = (fees.data?.items ?? []).map((f) => {
      const kind: ServiceFeeKind = f.kind ?? 'PLACEMENT';
      const status = labelOf(SERVICE_FEE_STATUS, f.status);
      const reconciling = f.reconciliationStatus === 'PENDING' || f.reconciliationStatus === 'FLAGGED';
      return {
        key: `fee-${f.serviceFeeId}`,
        service: SERVICE_OF_KIND[kind],
        item: labelOf(SERVICE_FEE_KIND, kind).label,
        jobTitle: f.jobTitle ?? '—',
        candidateName: f.candidateName ?? null,
        amount: kind === 'CREDIT' ? -f.amount : f.amount,
        currencyCode: f.currencyCode,
        dueDate: reconciling ? null : f.dueDate,
        statusLabel: reconciling ? 'Đang đối soát' : status.label,
        tone: reconciling ? 'info' : status.tone,
        bucket: kind === 'CREDIT' ? 'OTHER' : bucketOf(f.status),
        paidAt: f.paidAt ?? null,
        paymentReference: f.paymentReference ?? null,
      };
    });
    const postingRows: BillingRow[] = (postingFees.data ?? []).map(({ job, fee }) => {
      const st = POSTING_STATUS[fee!.status];
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
        bucket: bucketOf(fee!.status),
        paidAt: fee!.paidAt,
        paymentReference: fee!.paymentReference,
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
  <Surface padded className="!p-5">
    <div className="text-[13px] font-medium text-slate-600">{label}</div>
    <div
      className={`mt-1 text-[22px] font-bold tabular-nums ${
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

  const byService = service === 'all' ? rows : rows.filter((r) => r.service === service);
  const visible = status === 'all' ? byService : byService.filter((r) => r.bucket === status || (status === 'UNPAID' && r.bucket === 'OVERDUE'));
  const unpaid = rows.filter((r) => r.bucket === 'UNPAID' || r.bucket === 'OVERDUE');
  const overdue = rows.filter((r) => r.bucket === 'OVERDUE');
  const paid = rows.filter((r) => r.bucket === 'PAID');

  const columns: ColumnsType<BillingRow> = [
    {
      title: 'Dịch vụ',
      key: 'service',
      width: 210,
      render: (_, r) => (
        <div className="flex items-start gap-2">
          <Tag className="m-0 font-semibold" color={r.service === 'HEADHUNT_COD' ? 'gold' : r.service === 'CV_SOURCING' ? 'purple' : 'blue'}>
            {SERVICE_TYPE_LABEL[r.service].short}
          </Tag>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-slate-900">{r.item}</div>
            <div className="text-xs text-slate-500">{SERVICE_TYPE_LABEL[r.service].label}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Tin tuyển dụng',
      key: 'job',
      render: (_, r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-900">{r.jobTitle}</div>
          {r.candidateName && <div className="truncate text-xs text-slate-500">Ứng viên: {r.candidateName}</div>}
        </div>
      ),
    },
    {
      title: 'Số tiền',
      key: 'amount',
      align: 'right',
      width: 150,
      render: (_, r) => (
        <span className={`font-semibold tabular-nums ${r.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
          {r.amount < 0 ? `Hoàn ${money(-r.amount, r.currencyCode)}` : money(r.amount, r.currencyCode)}
        </span>
      ),
    },
    {
      title: 'Hạn thanh toán',
      key: 'due',
      align: 'center',
      width: 130,
      render: (_, r) => <span className="tabular-nums">{r.dueDate ? date(r.dueDate) : '—'}</span>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'center',
      width: 170,
      render: (_, r) => (
        <div>
          <StatusDot tone={r.tone}>{r.statusLabel}</StatusDot>
          {r.paidAt && (
            <div className="mt-0.5 text-xs text-slate-500">
              {date(r.paidAt)}
              {r.paymentReference ? ` · ${r.paymentReference}` : ''}
            </div>
          )}
        </div>
      ),
    },
  ];

  const count = (code: ServiceTypeCode) => rows.filter((r) => r.service === code).length;

  return (
    <div>
      <PageHero
        eyebrow="Tài chính"
        title="Công nợ phí dịch vụ"
        tip
        description="Mọi khoản phí với HR Connect của 3 dịch vụ HH, SS và AP ở cùng một nơi. Bạn thanh toán bằng chuyển khoản; trạng thái tự cập nhật khi HR Connect nhận được tiền."
        actions={
          <Button icon={<ReloadOutlined spin={fetching} />} onClick={refetch}>
            Làm mới
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
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
              { value: 'HEADHUNT_COD', label: SERVICE_TYPE_LABEL.HEADHUNT_COD.short, count: count('HEADHUNT_COD') },
              { value: 'CV_SOURCING', label: SERVICE_TYPE_LABEL.CV_SOURCING.short, count: count('CV_SOURCING') },
              { value: 'CV_APPLICATION', label: SERVICE_TYPE_LABEL.CV_APPLICATION.short, count: count('CV_APPLICATION') },
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
            scroll={{ x: 760 }}
            pagination={{ current: page, pageSize: PAGE_SIZE, total: visible.length, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
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
    </div>
  );
};

export default ClientBillingPage;
