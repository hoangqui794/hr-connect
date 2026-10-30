/**
 * Admin › Tài chính MF-05 (HEADHUNT_COD, CV_SOURCING, CV_APPLICATION).
 * Top: "việc cần làm" tiles (fees to collect / overdue, commissions to approve / to pay) that jump to the filtered list.
 * Commissions: approve (only after the Client paid the service fee), record payouts, adjust, cancel.
 * Service fees: newest activity first, with the payment date, how it was paid (VNPay or transfer) and its reference;
 * record a transfer by hand. Posting fees: record CV_APPLICATION posting fees (N4). Payouts: who was paid, newest first.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Modal, Radio, Select, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { financeApi } from '@/services/api/financeApi';
import { placementReconciliationApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus, Payout, ServiceFee, ServiceFeeStatus } from '@/types/api/finance';
import { PageHero, StatTile, StatusDot, Surface } from '@/features/admin-console/ui';
import { PostingFeePaymentsPanel } from './PostingFeePaymentsPanel';
import { COMMISSION_STATUS, PAYOUT_STATUS, SERVICE_FEE_KIND, SERVICE_FEE_STATUS, date, labelOf, money } from './financeLabels';

const byDateDesc = (a?: string | null, b?: string | null) => (b ? Date.parse(b) : 0) - (a ? Date.parse(a) : 0);

/** Whole days from today to the due date (negative once it has passed). */
const daysUntil = (due: string) => dayjs(due).startOf('day').diff(dayjs().startOf('day'), 'day');

/** VNPay payments are recorded with a "VNPAY-<transaction no>" reference; anything else was a transfer Admin recorded. */
const PaidVia: React.FC<{ reference?: string | null }> = ({ reference }) =>
  reference?.startsWith('VNPAY-') ? (
    <Tag color="blue" className="m-0">VNPay</Tag>
  ) : (
    <Tag className="m-0">Chuyển khoản</Tag>
  );

const SECTIONS: { value: Tab; label: string }[] = [
  { value: 'commissions', label: 'Hoa hồng' },
  { value: 'fees', label: 'Công nợ phí' },
  { value: 'postingFees', label: 'Phí đăng tin' },
  { value: 'payouts', label: 'Lịch sử chi' },
];

// Ordered by what Admin acts on first.
const COMMISSION_FILTERS: CommissionStatus[] = ['EARNED', 'PAYABLE', 'PENDING', 'IN_WARRANTY', 'ON_HOLD', 'PAID', 'CANCELLED'];
const FEE_FILTERS: ServiceFeeStatus[] = ['PENDING', 'DUE', 'OVERDUE', 'PAID'];

const KIND_SERVICE: Record<string, { short: string; color: string }> = {
  PLACEMENT: { short: 'HH', color: 'gold' },
  DEPOSIT: { short: 'SS', color: 'purple' },
  SETTLEMENT: { short: 'SS', color: 'purple' },
  CREDIT: { short: 'SS', color: 'purple' },
};

/** Number of rows for one status, from a one-row page (the API returns the total). */
const useCount = (key: string, fetch: () => Promise<{ totalCount: number }>) =>
  useQuery({ queryKey: ['mf05-count', key], queryFn: async () => (await fetch()).totalCount, staleTime: 30_000 });

type Tab = 'commissions' | 'fees' | 'postingFees' | 'payouts';
type Dialog =
  | { kind: 'payout'; commission: Commission }
  | { kind: 'adjust'; commission: Commission }
  | { kind: 'cancel'; commission: Commission }
  | { kind: 'fee'; fee: ServiceFee }
  | null;

const PAGE_SIZE = 20;

export const AdminFinancePage: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('commissions');
  const [commissionStatus, setCommissionStatus] = useState<CommissionStatus | 'all'>('all');
  const [feeStatus, setFeeStatus] = useState<ServiceFeeStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form] = Form.useForm();

  const commissions = useQuery({
    queryKey: ['mf05-commissions', commissionStatus, page],
    queryFn: () => financeApi.commissions({ status: commissionStatus, page, pageSize: PAGE_SIZE }),
    enabled: tab === 'commissions',
  });
  const fees = useQuery({
    queryKey: ['mf05-fees', feeStatus, page],
    queryFn: () => financeApi.serviceFees({ status: feeStatus, page, pageSize: PAGE_SIZE }),
    enabled: tab === 'fees',
  });
  const payouts = useQuery({
    queryKey: ['mf05-payouts', page],
    queryFn: () => financeApi.payouts({ page, pageSize: PAGE_SIZE }),
    enabled: tab === 'payouts',
  });
  const flaggedReconciliations = useQuery({
    queryKey: ['placement-reconciliations', 'admin', 'FLAGGED', 1],
    queryFn: () => placementReconciliationApi.list({ status: 'FLAGGED', page: 1, pageSize: 1 }, true),
  });
  const feesToCollect = useCount('fees-PENDING', () => financeApi.serviceFees({ status: 'PENDING', page: 1, pageSize: 1 }));
  const feesOverdue = useCount('fees-OVERDUE', () => financeApi.serviceFees({ status: 'OVERDUE', page: 1, pageSize: 1 }));
  const toApprove = useCount('commissions-EARNED', () => financeApi.commissions({ status: 'EARNED', page: 1, pageSize: 1 }));
  const toPay = useCount('commissions-PAYABLE', () => financeApi.commissions({ status: 'PAYABLE', page: 1, pageSize: 1 }));

  const openFees = (status: ServiceFeeStatus) => { setTab('fees'); setFeeStatus(status); setPage(1); };
  const openCommissions = (status: CommissionStatus) => { setTab('commissions'); setCommissionStatus(status); setPage(1); };

  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('mf05-') });
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      message.success('Đã lưu thay đổi.');
      setDialog(null);
      form.resetFields();
      refresh();
    },
    onError: (error) => message.error(getApiErrorMessage(error)),
  });

  const approve = (c: Commission) =>
    modal.confirm({
      title: 'Duyệt hoa hồng để chi trả?',
      content: `${c.affiliateName ?? 'Affiliate'} — ${money(c.amount)}. Chỉ duyệt được khi Client đã thanh toán phí dịch vụ.`,
      okText: 'Duyệt',
      cancelText: 'Hủy',
      onOk: () => action.mutateAsync(() => financeApi.approveCommission(c.commissionId)),
    });

  const submitDialog = async () => {
    const v = await form.validateFields();
    if (!dialog) return;
    if (dialog.kind === 'payout') {
      action.mutate(() =>
        financeApi.recordPayout(dialog.commission.commissionId, {
          succeeded: v.result === 'success',
          payoutDate: (v.payoutDate as Dayjs).toISOString(),
          method: v.method,
          transactionReference: v.transactionReference,
        })
      );
    } else if (dialog.kind === 'adjust') {
      action.mutate(() => financeApi.adjustCommission(dialog.commission.commissionId, v.newAmount, v.reason));
    } else if (dialog.kind === 'cancel') {
      action.mutate(() => financeApi.cancelCommission(dialog.commission.commissionId, v.reason));
    } else {
      action.mutate(() =>
        financeApi.recordFeePayment(dialog.fee.serviceFeeId, { paidAt: (v.paidAt as Dayjs).toISOString(), paymentReference: v.paymentReference })
      );
    }
  };

  const commissionColumns: ColumnsType<Commission> = [
    {
      title: 'Ứng viên / Job',
      key: 'who',
      render: (_, c) => (
        <div>
          <div className="font-semibold text-slate-900">{c.candidateName ?? '—'}</div>
          <div className="text-xs text-slate-500">{c.jobTitle ?? '—'}</div>
        </div>
      ),
    },
    { title: 'Affiliate', dataIndex: 'affiliateName', render: (v) => v ?? '—' },
    { title: 'Hoa hồng', dataIndex: 'amount', align: 'right', render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    {
      title: 'Hết bảo hành',
      dataIndex: 'warrantyEndDate',
      sorter: (a, b) => byDateDesc(b.warrantyEndDate, a.warrantyEndDate),
      render: (v) => <span className="tabular-nums">{date(v)}</span>,
    },
    {
      title: 'Ngày duyệt',
      dataIndex: 'approvedAt',
      sorter: (a, b) => byDateDesc(b.approvedAt, a.approvedAt),
      render: (v) => <span className="tabular-nums">{date(v)}</span>,
    },
    { title: 'Phí Client', dataIndex: 'serviceFeeStatus', render: (v: ServiceFeeStatus | null) => { const s = labelOf(SERVICE_FEE_STATUS, v); return <StatusDot tone={s.tone}>{s.label}</StatusDot>; } },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: CommissionStatus) => {
        const s = labelOf(COMMISSION_STATUS, v);
        return (
          <Tooltip title={s.hint}>
            <span><StatusDot tone={s.tone}>{s.label}</StatusDot></span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      width: 112,
      className: 'w-28 text-right pr-4',
      render: (_, c) => (
        <Space size={4} wrap>
          {c.status === 'EARNED' && (
            <Tooltip title={c.serviceFeeStatus !== 'PAID' ? 'Client chưa thanh toán phí dịch vụ' : undefined}>
              <Button size="small" type="primary" disabled={c.serviceFeeStatus !== 'PAID'} onClick={() => approve(c)}>Duyệt</Button>
            </Tooltip>
          )}
          {c.status === 'PAYABLE' && (
            <Button size="small" type="primary" onClick={() => { form.setFieldsValue({ result: 'success', payoutDate: dayjs() }); setDialog({ kind: 'payout', commission: c }); }}>
              Ghi nhận chi
            </Button>
          )}
          {!['PAID', 'CANCELLED'].includes(c.status) && (
            <>
              <Button size="small" onClick={() => { form.setFieldsValue({ newAmount: c.amount }); setDialog({ kind: 'adjust', commission: c }); }}>Điều chỉnh</Button>
              <Button size="small" danger onClick={() => setDialog({ kind: 'cancel', commission: c })}>Hủy</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const feeColumns: ColumnsType<ServiceFee> = [
    {
      title: 'Khoản phí',
      key: 'item',
      render: (_, f) => {
        const kind = f.kind ?? 'PLACEMENT';
        const svc = KIND_SERVICE[kind];
        return (
          <div className="flex items-start gap-2">
            <Tag color={svc.color} className="m-0 font-semibold">{svc.short}</Tag>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900">{f.companyName ?? '—'}</div>
              <div className="text-xs text-slate-600">
                {labelOf(SERVICE_FEE_KIND, kind).label} · {f.jobTitle ?? '—'}
                {kind === 'PLACEMENT' && f.candidateName ? ` · ${f.candidateName}` : ''}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Số tiền',
      key: 'amount',
      align: 'right',
      sorter: (a, b) => a.amount - b.amount,
      render: (_, f) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{money(f.amount, f.currencyCode)}</div>
          <div className="text-xs tabular-nums text-slate-500">{money(f.baseSalary, f.currencyCode)} × {f.feeMultiplier}</div>
        </div>
      ),
    },
    {
      title: 'Hạn trả',
      dataIndex: 'dueDate',
      sorter: (a, b) => byDateDesc(b.dueDate, a.dueDate),
      render: (v: string, f) => {
        const open = f.status === 'PENDING' || f.status === 'DUE' || f.status === 'OVERDUE';
        const days = v ? daysUntil(v) : null;
        return (
          <div>
            <div className="tabular-nums">{date(v)}</div>
            {open && days !== null && (
              <div className={`text-xs font-medium ${days < 0 ? 'text-red-600' : days <= 3 ? 'text-amber-700' : 'text-slate-500'}`}>
                {days < 0 ? `Quá hạn ${-days} ngày` : days === 0 ? 'Đến hạn hôm nay' : `Còn ${days} ngày`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Ngày thanh toán',
      dataIndex: 'paidAt',
      sorter: (a, b) => byDateDesc(b.paidAt, a.paidAt),
      render: (v: string | null | undefined, f) =>
        v ? (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium tabular-nums text-slate-900">{date(v)}</span>
              <PaidVia reference={f.paymentReference} />
            </div>
            {f.paymentReference && <div className="mt-0.5 font-mono text-xs text-slate-500">{f.paymentReference}</div>}
          </div>
        ) : (
          <span className="text-slate-400">Chưa thanh toán</span>
        ),
    },
    { title: 'Trạng thái', dataIndex: 'status', render: (v: ServiceFeeStatus) => { const s = labelOf(SERVICE_FEE_STATUS, v); return <StatusDot tone={s.tone}>{s.label}</StatusDot>; } },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      width: 112,
      className: 'w-28 text-right pr-4',
      render: (_, f) => {
        if (f.status !== 'PENDING' && f.status !== 'DUE' && f.status !== 'OVERDUE') return null;
        const waitingForReconciliation = Boolean(f.reconciliationStatus && f.reconciliationStatus !== 'CONFIRMED');
        return (
          <Tooltip title={waitingForReconciliation ? 'Chờ Internal HR hoàn tất đối soát nhận việc' : undefined}>
            <span>
              <Button
                size="small"
                type="primary"
                disabled={waitingForReconciliation}
                onClick={() => { form.setFieldsValue({ paidAt: dayjs() }); setDialog({ kind: 'fee', fee: f }); }}
              >
                {waitingForReconciliation ? 'Chờ đối soát' : 'Ghi nhận đã thu'}
              </Button>
            </span>
          </Tooltip>
        );
      },
    },
  ];

  const payoutColumns: ColumnsType<Payout> = [
    {
      title: 'Ngày chi',
      dataIndex: 'payoutDate',
      sorter: (a, b) => byDateDesc(b.payoutDate ?? b.createdAt, a.payoutDate ?? a.createdAt),
      render: (v, p) => <span className="font-medium tabular-nums text-slate-900">{date(v ?? p.createdAt)}</span>,
    },
    {
      title: 'Affiliate / Ứng viên',
      key: 'who',
      render: (_, p) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{p.affiliateName ?? '—'}</div>
          <div className="text-xs text-slate-600">{[p.candidateName, p.jobTitle].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      ),
    },
    { title: 'Số tiền', dataIndex: 'amount', align: 'right', sorter: (a, b) => a.amount - b.amount, render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    {
      title: 'Phương thức / Mã giao dịch',
      key: 'method',
      render: (_, p) => (
        <div>
          <div>{p.method ?? '—'}</div>
          {p.transactionReference && <div className="font-mono text-xs text-slate-500">{p.transactionReference}</div>}
        </div>
      ),
    },
    { title: 'Lần', dataIndex: 'attemptNo', align: 'center', width: 64 },
    { title: 'Kết quả', dataIndex: 'status', render: (v) => { const s = labelOf(PAYOUT_STATUS, v); return <StatusDot tone={s.tone}>{s.label}</StatusDot>; } },
  ];

  const active = tab === 'commissions' ? commissions : tab === 'fees' ? fees : tab === 'payouts' ? payouts : null;
  const pagination = {
    current: page,
    pageSize: PAGE_SIZE,
    total: active?.data?.totalCount ?? 0,
    onChange: setPage,
    showSizeChanger: false,
  };

  return (
    <div>
      <PageHero
        eyebrow="Phí dịch vụ và hoa hồng"
        title="Tài chính"
        description="Ghi nhận tiền Client đã trả (phí dịch vụ, cọc CV Sourcing, phí đăng tin) và chi hoa hồng cho Affiliate. Hoa hồng chỉ được duyệt chi sau khi Client đã thanh toán phí."
        actions={<Button icon={<ReloadOutlined />} onClick={refresh}>Làm mới</Button>}
      />

      {/* Shown only when there is something to fix: an always-on "0 hồ sơ" banner is noise. */}
      {(flaggedReconciliations.data?.totalCount ?? 0) > 0 && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Đối soát cần xử lý"
          description={`${flaggedReconciliations.data!.totalCount} hồ sơ có thông tin nhận việc không khớp; phí của các hồ sơ này chưa thu được.`}
          action={<Button onClick={() => navigate('/admin/placement-reconciliations')}>Mở danh sách đối soát</Button>}
        />
      )}

      <section aria-label="Việc cần làm" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Phí chờ thu"
          value={feesToCollect.data ?? '—'}
          hint="Client chưa thanh toán"
          tone="warning"
          active={tab === 'fees' && feeStatus === 'PENDING'}
          onClick={() => openFees('PENDING')}
        />
        <StatTile
          label="Phí quá hạn"
          value={feesOverdue.data ?? '—'}
          hint="Cần nhắc Client"
          tone="danger"
          active={tab === 'fees' && feeStatus === 'OVERDUE'}
          onClick={() => openFees('OVERDUE')}
        />
        <StatTile
          label="Hoa hồng chờ duyệt"
          value={toApprove.data ?? '—'}
          hint="Đã qua bảo hành"
          tone="info"
          active={tab === 'commissions' && commissionStatus === 'EARNED'}
          onClick={() => openCommissions('EARNED')}
        />
        <StatTile
          label="Hoa hồng chờ chi"
          value={toPay.data ?? '—'}
          hint="Đã duyệt, chờ chuyển khoản"
          tone="success"
          active={tab === 'commissions' && commissionStatus === 'PAYABLE'}
          onClick={() => openCommissions('PAYABLE')}
        />
      </section>

      {active?.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(active.error)} />}
      <Surface>
        {/* Sections are tabs (primary navigation); the status filter is one dropdown beside them (secondary). */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-solid border-slate-200 px-5 pt-3">
          <div role="tablist" aria-label="Mục tài chính" className="-mb-px flex flex-wrap gap-1">
            {SECTIONS.map((s) => {
              const selected = tab === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => { setTab(s.value); setPage(1); }}
                  className={`cursor-pointer border-0 border-b-2 border-solid bg-transparent px-3 pb-3 pt-2 text-[14px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--console-accent)] ${
                    selected
                      ? 'border-[color:var(--console-accent)] text-[color:var(--console-accent-strong)]'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {(tab === 'commissions' || tab === 'fees') && (
            <label className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-slate-600">
              Trạng thái
              {tab === 'commissions' ? (
                <Select<CommissionStatus | 'all'>
                  aria-label="Trạng thái hoa hồng"
                  className="w-60"
                  value={commissionStatus}
                  onChange={(v) => { setCommissionStatus(v); setPage(1); }}
                  options={[{ value: 'all', label: 'Tất cả' }, ...COMMISSION_FILTERS.map((s) => ({ value: s, label: COMMISSION_STATUS[s].label }))]}
                />
              ) : (
                <Select<ServiceFeeStatus | 'all'>
                  aria-label="Trạng thái phí"
                  className="w-48"
                  value={feeStatus}
                  onChange={(v) => { setFeeStatus(v); setPage(1); }}
                  options={[{ value: 'all', label: 'Tất cả' }, ...FEE_FILTERS.map((s) => ({ value: s, label: SERVICE_FEE_STATUS[s].label }))]}
                />
              )}
            </label>
          )}
        </div>
        {tab === 'commissions' && (
          <Table className="admin-soft-table w-full table-auto" rowKey="commissionId" columns={commissionColumns} dataSource={commissions.data?.items} loading={commissions.isFetching} pagination={pagination} scroll={{ x: 960 }} locale={{ emptyText: 'Chưa có hoa hồng nào.' }} />
        )}
        {tab === 'fees' && (
          <Table className="admin-soft-table w-full table-auto" rowKey="serviceFeeId" columns={feeColumns} dataSource={fees.data?.items} loading={fees.isFetching} pagination={pagination} scroll={{ x: 960 }} locale={{ emptyText: 'Chưa có công nợ phí nào.' }} />
        )}
        {tab === 'postingFees' && <PostingFeePaymentsPanel enabled={tab === 'postingFees'} />}
        {tab === 'payouts' && (
          <Table className="admin-soft-table w-full table-auto" rowKey="payoutId" columns={payoutColumns} dataSource={payouts.data?.items} loading={payouts.isFetching} pagination={pagination} scroll={{ x: 760 }} locale={{ emptyText: 'Chưa có lần chi nào.' }} />
        )}
      </Surface>

      <Modal
        open={Boolean(dialog)}
        title={
          dialog?.kind === 'payout' ? 'Ghi nhận chi hoa hồng'
            : dialog?.kind === 'adjust' ? 'Điều chỉnh số tiền hoa hồng'
              : dialog?.kind === 'cancel' ? 'Hủy hoa hồng'
                : 'Ghi nhận Client đã thanh toán phí'
        }
        okText="Xác nhận"
        cancelText="Đóng"
        okButtonProps={{ danger: dialog?.kind === 'cancel' }}
        confirmLoading={action.isPending}
        onOk={submitDialog}
        onCancel={() => { setDialog(null); form.resetFields(); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          {dialog?.kind === 'payout' && (
            <>
              <Alert className="mb-4" type="info" showIcon message={`Số tiền chi: ${money(dialog.commission.amount)} cho ${dialog.commission.affiliateName ?? 'Affiliate'}. Việc chuyển khoản thực hiện ngoài hệ thống.`} />
              {dialog.commission.affiliateBank?.bankAccountNumber ? (
                <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-[13.5px]">
                  <dt className="text-slate-500">Ngân hàng</dt>
                  <dd className="m-0 font-medium">{dialog.commission.affiliateBank.bankName}{dialog.commission.affiliateBank.bankBranch ? ` — ${dialog.commission.affiliateBank.bankBranch}` : ''}</dd>
                  <dt className="text-slate-500">Số tài khoản</dt>
                  <dd className="m-0 font-semibold tabular-nums">{dialog.commission.affiliateBank.bankAccountNumber}</dd>
                  <dt className="text-slate-500">Chủ tài khoản</dt>
                  <dd className="m-0 font-medium">{dialog.commission.affiliateBank.bankAccountHolder}</dd>
                </dl>
              ) : (
                <Alert className="mb-4" type="warning" showIcon message="Affiliate chưa khai báo tài khoản nhận tiền. Liên hệ Affiliate trước khi chuyển khoản." />
              )}
              <Form.Item name="result" label="Kết quả chuyển khoản" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="success">Thành công</Radio>
                  <Radio value="failed">Thất bại (giữ để chi lại)</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="payoutDate" label="Ngày chi" rules={[{ required: true, message: 'Chọn ngày chi.' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
              </Form.Item>
              <Form.Item name="method" label="Phương thức">
                <Input placeholder="Chuyển khoản ngân hàng" maxLength={50} />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.result !== b.result}>
                {({ getFieldValue }) => (
                  <Form.Item
                    name="transactionReference"
                    label="Mã giao dịch"
                    rules={[{ required: getFieldValue('result') === 'success', whitespace: true, message: 'Lần chi thành công cần mã giao dịch.' }]}
                  >
                    <Input placeholder="VD: FT26283XXXX" maxLength={200} />
                  </Form.Item>
                )}
              </Form.Item>
            </>
          )}
          {dialog?.kind === 'adjust' && (
            <>
              <Form.Item name="newAmount" label="Số tiền mới (VND)" rules={[{ required: true, message: 'Nhập số tiền.' }]}>
                <InputNumber<number> className="w-full" min={0} step={100000} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number((v ?? '').replace(/\./g, ''))} />
              </Form.Item>
              <Form.Item name="reason" label="Lý do" rules={[{ required: true, whitespace: true, message: 'Nhập lý do.' }, { max: 1000 }]}>
                <Input.TextArea rows={3} placeholder="Số cũ và số mới được lưu kèm lý do và người điều chỉnh." />
              </Form.Item>
            </>
          )}
          {dialog?.kind === 'cancel' && (
            <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, message: 'Nhập lý do.' }, { max: 1000 }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
          )}
          {dialog?.kind === 'fee' && (
            <>
              <Alert className="mb-4" type="info" showIcon message={`${dialog.fee.companyName ?? 'Client'} — ${money(dialog.fee.amount, dialog.fee.currencyCode)}. Đối chiếu sao kê trước khi ghi nhận.`} />
              <Form.Item name="paidAt" label="Ngày Client thanh toán" rules={[{ required: true, message: 'Chọn ngày.' }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
              </Form.Item>
              <Form.Item name="paymentReference" label="Mã tham chiếu chuyển khoản" rules={[{ required: true, whitespace: true, message: 'Nhập mã tham chiếu.' }, { max: 200 }]}>
                <Input placeholder="VD: VCB-20261015-001" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default AdminFinancePage;
