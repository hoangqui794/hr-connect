/**
 * Admin › Tài chính MF-05 (HEADHUNT_COD, CV_SOURCING, CV_APPLICATION).
 * Top: "việc cần làm" tiles (fees to collect / overdue, commissions to approve / to pay) that jump to the filtered list.
 * Commissions: approve (only after the Client paid the service fee), record payouts, adjust, cancel.
 * Service fees: newest activity first, with the payment date, how it was paid (VNPay or transfer) and its reference;
 * record a transfer by hand. Posting fees: record CV_APPLICATION posting fees (N4). Payouts: who was paid, newest first.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Dropdown, Form, Input, InputNumber, Modal, Pagination, Radio, Select, Spin, Tag, Tooltip } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, MoreOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { financeApi } from '@/services/api/financeApi';
import { placementReconciliationApi } from '@/services/api/hrApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus, Payout, ServiceFee, ServiceFeeStatus } from '@/types/api/finance';
import { PageHero, StatTile, StatusDot } from '@/features/admin-console/ui';
import { PostingFeePaymentsPanel } from './PostingFeePaymentsPanel';
import { COMMISSION_STATUS, PAYOUT_STATUS, SERVICE_FEE_KIND, SERVICE_FEE_STATUS, date, labelOf, money, OWED_FEE_STATUS, isOwedToClient } from './financeLabels';

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
  REPLACEMENT_REFUND: { short: 'HH', color: 'gold' },
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
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form] = Form.useForm();

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  };

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
  // PENDING also holds money owed back to the Client, which is not a fee to collect.
  const creditsPending = useCount('fees-PENDING-CREDIT', () => financeApi.serviceFees({ status: 'PENDING', kind: 'CREDIT', page: 1, pageSize: 1 }));
  const refundsPending = useCount('fees-PENDING-REFUND', () => financeApi.serviceFees({ status: 'PENDING', kind: 'REPLACEMENT_REFUND', page: 1, pageSize: 1 }));
  const owedPending = (creditsPending.data ?? 0) + (refundsPending.data ?? 0);
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
      title: 'Duyệt chi hoa hồng?',
      content: `${c.affiliateName ?? 'Affiliate'} — ${money(c.amount)}. Xác nhận đủ điều kiện để chuyển sang bước Ghi nhận chi trả.`,
      okText: 'Duyệt chi',
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

  type SimpleCol<T> = {
    key: string;
    title: React.ReactNode;
    align?: 'left' | 'right' | 'center';
    sortBy?: (a: T, b: T) => number;
    width?: string;
    render: (row: T) => React.ReactNode;
  };

  const renderDataTable = <T,>(
    cols: SimpleCol<T>[],
    rows: T[] | undefined,
    getKey: (row: T) => string | number,
    loading: boolean,
    emptyText: string,
  ) => {
    const raw = rows ?? [];
    const activeSortCol = sort ? cols.find((c) => c.key === sort.key && c.sortBy) : undefined;
    const sorted = activeSortCol?.sortBy
      ? [...raw].sort((a, b) => (sort?.dir === 'asc' ? activeSortCol.sortBy!(a, b) : activeSortCol.sortBy!(b, a)))
      : raw;
    const total = active?.data?.totalCount ?? 0;
    // Fixed layout: every column keeps its width, the column without one takes the rest (at least 200px).
    // Below that width the table scrolls horizontally instead of squeezing columns together.
    const minWidth = cols.reduce((sum, c) => sum + (c.width ? parseInt(c.width, 10) : 200), 0);
    const cellAlign = (align?: 'left' | 'right' | 'center') =>
      align === 'right' ? 'text-right pr-6' : align === 'center' ? 'text-center' : 'text-left';

    return (
      <Spin spinning={loading}>
        {!loading && sorted.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-400">{emptyText}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-[13px]" style={{ minWidth }}>
              {/* Same look as the admin-soft-table antd tables (Quy tắc hoa hồng...): white header with a
                  bottom rule, a light rule between rows, none after the last row. */}
              <thead className="bg-white">
                <tr>
                  {cols.map((col) => {
                    const alignCls = cellAlign(col.align);
                    const isSorted = sort?.key === col.key;
                    return (
                      <th
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        className={`border-0 border-b border-solid border-[#eef2f6] bg-white px-3.5 py-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-slate-600 whitespace-nowrap ${alignCls}`}
                      >
                        {col.sortBy ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={`inline-flex items-center gap-1 uppercase hover:text-slate-800 transition-colors cursor-pointer ${
                              col.align === 'right' ? 'flex-row-reverse' : ''
                            }`}
                          >
                            <span>{col.title}</span>
                            <SwapOutlined
                              className={`rotate-90 text-[10px] ${isSorted ? 'text-blue-600' : 'text-slate-300'}`}
                            />
                          </button>
                        ) : (
                          col.title
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white">
                {sorted.map((row) => (
                  <tr key={getKey(row)} className="transition-colors hover:bg-[#f8fafc] [&:last-child>td]:border-b-0">
                    {cols.map((col) => {
                      const alignCls = cellAlign(col.align);
                      return (
                        <td key={col.key} className={`border-0 border-b border-solid border-[#f1f5f9] px-3.5 py-3 align-middle text-slate-700 break-words ${alignCls}`}>
                          {col.render(row)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="flex items-center justify-end border-t border-slate-100 bg-white px-4 py-3">
            <Pagination
              current={page}
              pageSize={PAGE_SIZE}
              total={total}
              onChange={setPage}
              showSizeChanger={false}
              size="small"
            />
          </div>
        )}
      </Spin>
    );
  };

  const commissionColumns: SimpleCol<Commission>[] = [
    {
      key: 'who',
      title: 'Ứng viên / Job',
      render: (c) => {
        const isSourcing = Boolean(c.sourcingDeliveryId && !c.placementId);
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-900">{c.candidateName ?? '—'}</span>
              <Tag color={isSourcing ? 'cyan' : 'blue'} className="m-0 text-[11px] leading-4 px-1.5 py-0">
                {isSourcing ? 'CV Sourcing' : 'Headhunt'}
              </Tag>
            </div>
            <Tooltip title={c.jobTitle ?? undefined}>
              <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{c.jobTitle ?? '—'}</div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      key: 'affiliateName',
      title: 'Affiliate',
      width: '150px',
      render: (c) => <span className="text-slate-800">{c.affiliateName ?? '—'}</span>,
    },
    {
      key: 'amount',
      title: 'Hoa hồng',
      align: 'right',
      width: '140px',
      render: (c) => <span className="font-semibold tabular-nums whitespace-nowrap">{money(c.amount)}</span>,
    },
    {
      key: 'warrantyEndDate',
      title: 'Hết bảo hành',
      width: '130px',
      sortBy: (a, b) => byDateDesc(b.warrantyEndDate, a.warrantyEndDate),
      render: (c) => {
        const isSourcing = Boolean(c.sourcingDeliveryId && !c.placementId);
        if (isSourcing && !c.warrantyEndDate) {
          return <span className="text-xs text-slate-400 whitespace-nowrap">Không áp dụng</span>;
        }
        return <span className="tabular-nums whitespace-nowrap">{date(c.warrantyEndDate)}</span>;
      },
    },
    {
      key: 'approvedAt',
      title: 'Ngày duyệt',
      width: '120px',
      sortBy: (a, b) => byDateDesc(b.approvedAt, a.approvedAt),
      render: (c) => <span className="tabular-nums whitespace-nowrap">{date(c.approvedAt)}</span>,
    },
    {
      key: 'serviceFeeStatus',
      title: 'Phí Client',
      width: '170px',
      render: (c) => {
        if (!c.serviceFeeStatus) {
          return (
            <Tooltip title="Khoản phí dịch vụ của Client chưa được tạo hoặc đang chờ đối soát">
              <span><StatusDot tone="neutral">Chưa phát sinh phí</StatusDot></span>
            </Tooltip>
          );
        }
        const s = labelOf(SERVICE_FEE_STATUS, c.serviceFeeStatus);
        return <StatusDot tone={s.tone}>{s.label}</StatusDot>;
      },
    },
    {
      key: 'status',
      title: 'Trạng thái',
      width: '200px',
      render: (c) => {
        let s = labelOf(COMMISSION_STATUS, c.status);
        if (c.status === 'EARNED') {
          s = c.serviceFeeStatus === 'PAID'
            ? { label: 'Đủ điều kiện · Chờ duyệt', tone: 'info', hint: 'Client đã thanh toán phí dịch vụ, chờ Admin duyệt chi' }
            : { label: 'Đã đạt · Chờ Client thanh toán', tone: 'warning', hint: 'Ứng viên đã hết bảo hành, chờ Client thanh toán phí dịch vụ' };
        }
        return (
          <Tooltip title={s.hint}>
            <span><StatusDot tone={s.tone}>{s.label}</StatusDot></span>
          </Tooltip>
        );
      },
    },
    {
      key: 'actions',
      title: 'Thao tác',
      align: 'right',
      width: '170px',
      render: (c) => {
        const canModify = !['PAID', 'CANCELLED'].includes(c.status);
        if (c.status !== 'EARNED' && c.status !== 'PAYABLE' && !canModify) {
          return <span className="text-slate-400 text-xs">—</span>;
        }
        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {c.status === 'EARNED' && (
              <Tooltip title={c.serviceFeeStatus !== 'PAID' ? 'Cần ghi nhận Client thanh toán phí dịch vụ trước khi duyệt chi' : 'Duyệt cho phép chi trả hoa hồng này'}>
                <span className="inline-block">
                  <Button
                    size="small"
                    type="primary"
                    className="!h-8 px-3 text-xs font-semibold rounded-lg"
                    disabled={c.serviceFeeStatus !== 'PAID'}
                    onClick={() => approve(c)}
                  >
                    Duyệt chi
                  </Button>
                </span>
              </Tooltip>
            )}
            {c.status === 'PAYABLE' && (
              <Button
                size="small"
                type="primary"
                className="!h-8 px-3 text-xs font-semibold rounded-lg"
                onClick={() => { form.setFieldsValue({ result: 'success', payoutDate: dayjs(), method: 'Chuyển khoản ngân hàng' }); setDialog({ kind: 'payout', commission: c }); }}
              >
                Ghi nhận chi
              </Button>
            )}
            {canModify && (
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{
                  items: [
                    ...(c.status === 'EARNED' && c.serviceFeeStatus !== 'PAID'
                      ? [
                          {
                            key: 'view-fees',
                            icon: <EyeOutlined />,
                            label: 'Xem công nợ phí',
                            onClick: () => {
                              setTab('fees');
                              setFeeStatus('all');
                              setPage(1);
                            },
                          },
                        ]
                      : []),
                    {
                      key: 'adjust',
                      icon: <EditOutlined />,
                      label: 'Điều chỉnh số tiền',
                      onClick: () => { form.setFieldsValue({ newAmount: c.amount }); setDialog({ kind: 'adjust', commission: c }); },
                    },
                    {
                      key: 'cancel',
                      icon: <DeleteOutlined />,
                      label: 'Hủy hoa hồng',
                      danger: true,
                      onClick: () => setDialog({ kind: 'cancel', commission: c }),
                    },
                  ],
                }}
              >
                <Button
                  size="small"
                  icon={<MoreOutlined />}
                  aria-label={`Thao tác khác: ${c.candidateName ?? c.commissionId}`}
                  className="!h-8 !w-8 rounded-lg"
                />
              </Dropdown>
            )}
          </div>
        );
      },
    },
  ];

  const feeColumns: SimpleCol<ServiceFee>[] = [
    {
      key: 'item',
      title: 'Khoản phí',
      render: (f) => {
        const kind = f.kind ?? 'PLACEMENT';
        const svc = KIND_SERVICE[kind];
        return (
          <div className="flex items-start gap-2 min-w-[200px]">
            <Tag color={svc.color} className="m-0 mt-0.5 font-semibold shrink-0">{svc.short}</Tag>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-slate-900">{f.companyName ?? '—'}</span>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {labelOf(SERVICE_FEE_KIND, kind).label}
                </span>
              </div>
              <Tooltip title={f.jobTitle ?? undefined}>
                <div className="mt-1 text-xs text-slate-600 line-clamp-2">{f.jobTitle ?? '—'}</div>
              </Tooltip>
              {kind === 'PLACEMENT' && f.candidateName && (
                <div className="mt-0.5 text-xs text-slate-500">
                  Ứng viên: <span className="font-medium text-slate-700">{f.candidateName}</span>
                </div>
              )}
              {f.sourcingTarget && f.sourcingTarget > 0 ? (
                <div className="mt-1 inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 tabular-nums">
                  Đã nhận: {f.sourcingCounted ?? 0}/{f.sourcingTarget} CV
                </div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      key: 'amount',
      title: 'Số tiền',
      align: 'right',
      width: '150px',
      sortBy: (a, b) => a.amount - b.amount,
      render: (f) => (
        <div className="text-right whitespace-nowrap">
          <div className="font-semibold text-slate-900 tabular-nums">{money(f.amount, f.currencyCode)}</div>
          <div className="text-xs tabular-nums text-slate-500">{money(f.baseSalary, f.currencyCode)} × {f.feeMultiplier}</div>
        </div>
      ),
    },
    {
      key: 'dueDate',
      title: 'Hạn trả',
      width: '150px',
      sortBy: (a, b) => byDateDesc(b.dueDate, a.dueDate),
      render: (f) => {
        const open = f.status === 'PENDING' || f.status === 'DUE' || f.status === 'OVERDUE';
        const days = f.dueDate ? daysUntil(f.dueDate) : null;
        return (
          <div className="whitespace-nowrap">
            <div className="tabular-nums text-slate-800">{date(f.dueDate)}</div>
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
      key: 'paidAt',
      title: 'Thanh toán',
      width: '190px',
      sortBy: (a, b) => byDateDesc(b.paidAt, a.paidAt),
      render: (f) =>
        f.paidAt ? (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="font-medium tabular-nums text-slate-900">{date(f.paidAt)}</span>
              <PaidVia reference={f.paymentReference} />
            </div>
            {f.paymentReference && <div className="mt-0.5 font-mono text-xs text-slate-500">{f.paymentReference}</div>}
          </div>
        ) : (
          <span className="text-slate-400 whitespace-nowrap">{isOwedToClient(f.kind) ? 'Chưa hoàn tiền' : 'Chưa thanh toán'}</span>
        ),
    },
    {
      key: 'status',
      title: 'Trạng thái',
      width: '170px',
      render: (f) => {
        const s = (isOwedToClient(f.kind) && OWED_FEE_STATUS[f.status]) || labelOf(SERVICE_FEE_STATUS, f.status);
        return <StatusDot tone={s.tone}>{s.label}</StatusDot>;
      },
    },
    {
      key: 'actions',
      title: 'Thao tác',
      align: 'right',
      width: '190px',
      render: (f) => {
        if (f.status !== 'PENDING' && f.status !== 'DUE' && f.status !== 'OVERDUE') {
          return <span className="text-slate-400 text-xs">—</span>;
        }
        const waitingForReconciliation = Boolean(f.reconciliationStatus && f.reconciliationStatus !== 'CONFIRMED');
        return (
          <Tooltip title={waitingForReconciliation ? 'Chờ Internal HR hoàn tất đối soát nhận việc' : undefined}>
            <span>
              <Button
                size="small"
                type="primary"
                className="!h-8 px-3 text-xs font-semibold rounded-lg whitespace-nowrap"
                disabled={waitingForReconciliation}
                onClick={() => { form.setFieldsValue({ paidAt: dayjs() }); setDialog({ kind: 'fee', fee: f }); }}
              >
                {waitingForReconciliation ? 'Chờ đối soát' : isOwedToClient(f.kind) ? 'Ghi nhận đã hoàn' : 'Ghi nhận đã thu'}
              </Button>
            </span>
          </Tooltip>
        );
      },
    },
  ];

  const payoutColumns: SimpleCol<Payout>[] = [
    {
      key: 'payoutDate',
      title: 'Ngày chi',
      width: '130px',
      sortBy: (a, b) => byDateDesc(b.payoutDate ?? b.createdAt, a.payoutDate ?? a.createdAt),
      render: (p) => <span className="font-medium tabular-nums text-slate-900">{date(p.payoutDate ?? p.createdAt)}</span>,
    },
    {
      key: 'who',
      title: 'Affiliate / Ứng viên',
      render: (p) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">{p.affiliateName ?? '—'}</div>
          <div className="text-xs text-slate-600">{[p.candidateName, p.jobTitle].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      title: 'Số tiền',
      align: 'right',
      width: '150px',
      sortBy: (a, b) => a.amount - b.amount,
      render: (p) => <span className="font-semibold tabular-nums">{money(p.amount)}</span>,
    },
    {
      key: 'method',
      title: 'Phương thức / Mã giao dịch',
      width: '240px',
      render: (p) => (
        <div>
          <div>{p.method ?? '—'}</div>
          {p.transactionReference && <div className="font-mono text-xs text-slate-500">{p.transactionReference}</div>}
        </div>
      ),
    },
    {
      key: 'attemptNo',
      title: 'Lần',
      align: 'center',
      width: '64px',
      render: (p) => <span className="tabular-nums">{p.attemptNo}</span>,
    },
    {
      key: 'status',
      title: 'Kết quả',
      width: '160px',
      render: (p) => {
        const s = labelOf(PAYOUT_STATUS, p.status);
        return <StatusDot tone={s.tone}>{s.label}</StatusDot>;
      },
    },
  ];

  const active = tab === 'commissions' ? commissions : tab === 'fees' ? fees : tab === 'payouts' ? payouts : null;

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
          value={feesToCollect.data === undefined ? '—' : Math.max(0, feesToCollect.data - owedPending)}
          hint={owedPending > 0 ? `Client chưa thanh toán · ${owedPending} khoản cần hoàn cho Client` : 'Client chưa thanh toán'}
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
      <section className="admin-surface overflow-hidden">
        {/* Toolbar: segmented pill tabs on the left, contextual status filter on the right. */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3.5">
          <div
            role="tablist"
            aria-label="Mục tài chính"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-200/70 p-1"
          >
            {SECTIONS.map((s) => {
              const selected = tab === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => { setTab(s.value); setPage(1); }}
                  className={`cursor-pointer rounded-lg border-0 px-3.5 py-1.5 text-[13.5px] transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--console-accent)] ${
                    selected
                      ? 'bg-white font-semibold text-slate-900 shadow-xs'
                      : 'bg-transparent font-medium text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          {(tab === 'commissions' || tab === 'fees') && (
            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
              <span>Trạng thái</span>
              {tab === 'commissions' ? (
                <Select<CommissionStatus | 'all'>
                  aria-label="Trạng thái hoa hồng"
                  className="w-56"
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
        {tab === 'commissions' && renderDataTable(commissionColumns, commissions.data?.items, (c) => c.commissionId, commissions.isFetching, 'Chưa có hoa hồng nào.')}
        {tab === 'fees' && renderDataTable(feeColumns, fees.data?.items, (f) => f.serviceFeeId, fees.isFetching, 'Chưa có công nợ phí nào.')}
        {tab === 'postingFees' && <PostingFeePaymentsPanel enabled={tab === 'postingFees'} />}
        {tab === 'payouts' && renderDataTable(payoutColumns, payouts.data?.items, (p) => p.payoutId, payouts.isFetching, 'Chưa có lần chi nào.')}
      </section>

      <Modal
        open={Boolean(dialog)}
        title={
          dialog?.kind === 'payout' ? 'Ghi nhận chi hoa hồng'
            : dialog?.kind === 'adjust' ? 'Điều chỉnh số tiền hoa hồng'
              : dialog?.kind === 'cancel' ? 'Hủy hoa hồng'
                : dialog?.kind === 'fee' && isOwedToClient(dialog.fee.kind) ? 'Ghi nhận đã hoàn tiền cho Client' : 'Ghi nhận Client đã thanh toán phí'
        }
        okText="Xác nhận"
        cancelText="Đóng"
        okButtonProps={{ danger: dialog?.kind === 'cancel' }}
        confirmLoading={action.isPending}
        onOk={submitDialog}
        onCancel={() => { setDialog(null); form.resetFields(); }}
        destroyOnHidden
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
              <Form.Item name="result" label="Trạng thái chuyển khoản" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="success">Đã chuyển thành công</Radio>
                  <Radio value="failed">Chuyển thất bại (giữ lại để chi sau)</Radio>
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
              <Form.Item name="paidAt" label={isOwedToClient(dialog.fee.kind) ? 'Ngày chuyển tiền cho Client' : 'Ngày Client thanh toán'} rules={[{ required: true, message: 'Chọn ngày.' }]}>
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
