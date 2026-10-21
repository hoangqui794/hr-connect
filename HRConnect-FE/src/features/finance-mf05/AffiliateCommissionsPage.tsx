/**
 * Affiliate › Hoa hồng & chi trả (MF-05, HEADHUNT_COD). The API returns only the affiliate's own
 * commissions and payouts. A commission is earned in full once the candidate has worked through the
 * warranty, and is paid after the Client has paid the service fee.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Form, Input, Modal, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BankOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { affiliateBankApi, financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus, Payout } from '@/types/api/finance';
import { FilterPills, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { COMMISSION_STATUS, PAYOUT_STATUS, date, labelOf, money } from './financeLabels';

const PAGE_SIZE = 20;

/** Where HR Connect transfers the commission; payouts cannot be made without it. */
const PayoutAccountCard: React.FC = () => {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const account = useQuery({ queryKey: ['mf05-my-bank-account'], queryFn: () => affiliateBankApi.get() });
  const save = useMutation({
    mutationFn: async () => affiliateBankApi.update(await form.validateFields()),
    onSuccess: () => {
      message.success('Đã lưu tài khoản nhận tiền.');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['mf05-my-bank-account'] });
    },
    onError: (error) => {
      if (!(error && typeof error === 'object' && 'errorFields' in error)) message.error(getApiErrorMessage(error));
    },
  });
  const data = account.data;
  const hasAccount = Boolean(data?.bankAccountNumber);

  return (
    <Surface padded className="mb-5">
      <div className="flex flex-wrap items-center gap-4">
        <BankOutlined className="text-2xl text-[color:var(--console-accent)]" aria-hidden />
        <div className="min-w-[220px] flex-1">
          <div className="text-[15px] font-semibold text-slate-900">Tài khoản nhận tiền</div>
          {account.isLoading ? (
            <Skeleton active paragraph={false} />
          ) : account.isError ? (
            <div className="text-[13.5px] text-red-700">{getApiErrorMessage(account.error)}</div>
          ) : hasAccount ? (
            <div className="text-[13.5px] text-slate-600">
              {data?.bankName}
              {data?.bankBranch ? ` — ${data.bankBranch}` : ''} · <span className="font-semibold tabular-nums text-slate-900">{data?.bankAccountNumber}</span> ·{' '}
              {data?.bankAccountHolder}
            </div>
          ) : (
            <div className="text-[13.5px] text-amber-700">Chưa khai báo. HR Connect cần tài khoản này để chuyển hoa hồng cho bạn.</div>
          )}
        </div>
        <Button
          type={hasAccount ? 'default' : 'primary'}
          onClick={() => {
            form.setFieldsValue({
              bankName: data?.bankName ?? '',
              bankAccountNumber: data?.bankAccountNumber ?? '',
              bankAccountHolder: data?.bankAccountHolder ?? '',
              bankBranch: data?.bankBranch ?? '',
            });
            setEditing(true);
          }}
        >
          {hasAccount ? 'Sửa' : 'Khai báo tài khoản'}
        </Button>
      </div>
      <Modal
        open={editing}
        title="Tài khoản nhận hoa hồng"
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={save.isPending}
        onOk={() => save.mutate()}
        onCancel={() => setEditing(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="bankName" label="Ngân hàng" rules={[{ required: true, whitespace: true, message: 'Nhập tên ngân hàng.' }, { min: 2, max: 100, message: 'Từ 2 đến 100 ký tự.' }]}>
            <Input placeholder="Vietcombank" />
          </Form.Item>
          <Form.Item
            name="bankAccountNumber"
            label="Số tài khoản"
            rules={[{ required: true, message: 'Nhập số tài khoản.' }, { pattern: /^[a-zA-Z0-9]{5,50}$/, message: 'Từ 5 đến 50 ký tự, chỉ gồm chữ và số.' }]}
          >
            <Input placeholder="0123456789" />
          </Form.Item>
          <Form.Item name="bankAccountHolder" label="Chủ tài khoản" rules={[{ required: true, whitespace: true, message: 'Nhập tên chủ tài khoản.' }, { min: 2, max: 180, message: 'Từ 2 đến 180 ký tự.' }]}>
            <Input placeholder="NGUYEN VAN A" />
          </Form.Item>
          <Form.Item name="bankBranch" label="Chi nhánh" rules={[{ max: 180 }]}>
            <Input placeholder="Không bắt buộc" />
          </Form.Item>
        </Form>
      </Modal>
    </Surface>
  );
};

/** The four (Headhunt) or three (Sourcing) steps a commission walks through. */
const HEADHUNT_STEPS = ['Đi làm', 'Bảo hành', 'Đã đạt', 'Đã nhận'];
const SOURCING_STEPS = ['CV được nhận', 'Đã đạt', 'Đã nhận'];

/** Index of the step the commission is on; steps before it are done. */
const stepIndex = (c: Commission): number => {
  const sourcing = !c.placementId;
  switch (c.status) {
    case 'PENDING':
      return 0;
    case 'IN_WARRANTY':
    case 'ON_HOLD':
      return sourcing ? 0 : 1;
    case 'EARNED':
    case 'PAYABLE':
      return sourcing ? 1 : 2;
    case 'PAID':
      return sourcing ? 3 : 4;
    default:
      return -1;
  }
};

const daysLeft = (end?: string | null) => {
  if (!end) return null;
  const ms = new Date(end).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86_400_000));
};

/** What the step under way means for this commission, in one short line. */
const stepNote = (c: Commission): string | null => {
  if (c.status === 'IN_WARRANTY' && c.warrantyEndDate) {
    const left = daysLeft(c.warrantyEndDate);
    return `${left === 0 ? 'Hết bảo hành hôm nay' : `Còn ${left} ngày`} · hết bảo hành ${date(c.warrantyEndDate)}`;
  }
  if (c.status === 'EARNED') return c.serviceFeeStatus === 'PAID' ? 'Client đã trả phí, chờ Admin duyệt' : 'Chờ Client thanh toán phí dịch vụ';
  if (c.status === 'PAYABLE') return 'Đã duyệt, chờ chuyển khoản cho bạn';
  if (c.status === 'PENDING') return 'Chờ ứng viên bắt đầu đi làm';
  return null;
};

const CommissionCard: React.FC<{ c: Commission }> = ({ c }) => {
  const steps = c.placementId ? HEADHUNT_STEPS : SOURCING_STEPS;
  const current = stepIndex(c);
  const s = labelOf(COMMISSION_STATUS, c.status);
  const onHold = c.status === 'ON_HOLD';
  const cancelled = c.status === 'CANCELLED';
  const note = stepNote(c);
  return (
    <li
      className={`rounded-2xl border bg-white p-4 sm:p-5 ${onHold ? 'border-amber-300' : 'border-slate-200'}`}
      aria-label={`${c.candidateName ?? 'Ứng viên'} – ${s.label}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-slate-900">{c.candidateName ?? '—'}</div>
          <div className="truncate text-[13px] text-slate-500">
            {c.jobTitle ?? '—'} · {c.placementId ? 'Headhunt' : 'CV Sourcing'}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[17px] font-bold tabular-nums ${cancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{money(c.amount)}</div>
          {c.baseAmount ? <div className="text-xs text-slate-500">tính trên phí {money(c.baseAmount)}</div> : null}
        </div>
      </div>

      {cancelled ? (
        <div className="mt-3">
          <StatusDot tone={s.tone}>{s.label}</StatusDot>
          <div className="mt-1 text-[13px] text-slate-500">{s.hint}</div>
        </div>
      ) : (
        <>
          <ol
            className="mt-4 grid list-none gap-1.5 p-0"
            style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            aria-label="Tiến trình hoa hồng"
          >
            {steps.map((label, i) => {
              const done = i < current;
              const now = i === current;
              const bar = done
                ? 'bg-[color:var(--console-accent)]'
                : now
                  ? onHold
                    ? 'bg-amber-400'
                    : 'bg-[color:var(--console-accent-soft)] ring-1 ring-[color:var(--console-accent)]'
                  : 'bg-slate-200';
              return (
                <li key={label} aria-current={now ? 'step' : undefined}>
                  <div className={`h-1.5 rounded-full ${bar}`} />
                  <div className={`mt-1.5 text-xs ${done || now ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>
                    {label}
                    {done && <span className="sr-only"> (xong)</span>}
                  </div>
                </li>
              );
            })}
          </ol>
          {onHold ? (
            <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <ExclamationCircleOutlined className="mr-1.5" aria-hidden />
              Client báo ứng viên nghỉ việc; Internal HR đang xác minh. Nếu báo nghỉ bị bác bỏ, hoa hồng tiếp tục bảo hành.
            </div>
          ) : note ? (
            <div className="mt-2 text-[13px] text-slate-600">{note}</div>
          ) : null}
        </>
      )}
    </li>
  );
};

type Group = 'all' | 'warranty' | 'payout' | 'hold' | 'paid';
const GROUPS: Record<Exclude<Group, 'all'>, CommissionStatus[]> = {
  warranty: ['PENDING', 'IN_WARRANTY'],
  payout: ['EARNED', 'PAYABLE'],
  hold: ['ON_HOLD'],
  paid: ['PAID'],
};

export const AffiliateCommissionsPage: React.FC = () => {
  const [group, setGroup] = useState<Group>('all');
  const [payoutPage, setPayoutPage] = useState(1);
  // One page of up to 100 (the API maximum) covers an affiliate's commissions; the totals need all of them.
  const commissions = useQuery({
    queryKey: ['mf05-my-commissions'],
    queryFn: () => financeApi.commissions({ page: 1, pageSize: 100 }),
  });
  const payouts = useQuery({
    queryKey: ['mf05-my-payouts', payoutPage],
    queryFn: () => financeApi.payouts({ page: payoutPage, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const items = commissions.data?.items ?? [];
  const inGroup = (statuses: CommissionStatus[]) => items.filter((c) => statuses.includes(c.status));
  const sum = (statuses: CommissionStatus[]) => inGroup(statuses).reduce((t, c) => t + c.amount, 0);
  const shown = group === 'all' ? items : inGroup(GROUPS[group]);

  const payoutColumns: ColumnsType<Payout> = [
    { title: 'Ngày chi', dataIndex: 'payoutDate', render: (v) => date(v) },
    { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    { title: 'Mã giao dịch', dataIndex: 'transactionReference', render: (v) => v ?? '—' },
    {
      title: 'Kết quả',
      dataIndex: 'status',
      render: (v) => {
        const st = labelOf(PAYOUT_STATUS, v);
        return <StatusDot tone={st.tone}>{st.label}</StatusDot>;
      },
    },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Thu nhập"
        title="Hoa hồng & chi trả"
        description="Theo dõi từng ca giới thiệu từ lúc ứng viên đi làm đến khi bạn nhận tiền."
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              commissions.refetch();
              payouts.refetch();
            }}
            loading={commissions.isFetching || payouts.isFetching}
          >
            Làm mới
          </Button>
        }
      />

      {commissions.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(commissions.error)} />}

      {commissions.isLoading ? (
        <Skeleton active />
      ) : (
        <div className="mb-5 grid gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="rounded-2xl bg-[color:var(--console-accent-soft)] p-4 sm:p-5">
            <div className="text-[13px] font-medium text-[color:var(--console-accent-strong)]">Sắp nhận</div>
            <div className="mt-1 text-[28px] font-bold leading-tight tabular-nums text-[color:var(--console-accent-strong)]">{money(sum(GROUPS.payout))}</div>
            <div className="mt-1 text-[13px] text-[color:var(--console-accent-strong)]">Đã đạt; chuyển khoản sau khi Client thanh toán phí và Admin duyệt.</div>
          </div>
          <Surface padded>
            <div className="text-[13px] text-slate-500">Đang bảo hành</div>
            <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900">{money(sum(GROUPS.warranty))}</div>
          </Surface>
          <Surface padded>
            <div className="text-[13px] text-slate-500">Đã nhận</div>
            <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900">{money(sum(GROUPS.paid))}</div>
          </Surface>
        </div>
      )}

      <PayoutAccountCard />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold text-slate-900">Các ca giới thiệu</h2>
        <FilterPills<Group>
          label="Lọc hoa hồng"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'Tất cả', count: items.length },
            { value: 'warranty', label: 'Đang bảo hành', count: inGroup(GROUPS.warranty).length },
            { value: 'payout', label: 'Chờ chi', count: inGroup(GROUPS.payout).length },
            { value: 'hold', label: 'Tạm giữ', count: inGroup(GROUPS.hold).length },
            { value: 'paid', label: 'Đã nhận', count: inGroup(GROUPS.paid).length },
          ]}
        />
      </div>

      {!commissions.isLoading && shown.length === 0 ? (
        <Surface padded>
          <div className="py-6 text-center">
            <div className="text-[15px] font-semibold text-slate-900">{items.length === 0 ? 'Chưa có hoa hồng' : 'Không có ca nào ở mục này'}</div>
            <div className="mt-1 text-[13px] text-slate-500">
              {items.length === 0
                ? 'Hoa hồng xuất hiện khi ứng viên bạn giới thiệu bắt đầu đi làm hoặc CV được Client nhận.'
                : 'Chọn mục khác để xem.'}
            </div>
          </div>
        </Surface>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {shown.map((c) => (
            <CommissionCard key={c.commissionId} c={c} />
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-8 text-base font-semibold text-slate-900">Lịch sử chi</h2>
      {payouts.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(payouts.error)} />}
      <Surface>
        <Table
          rowKey="payoutId"
          columns={payoutColumns}
          dataSource={payouts.data?.items}
          loading={payouts.isFetching}
          scroll={{ x: 560 }}
          pagination={{
            current: payoutPage,
            pageSize: PAGE_SIZE,
            total: payouts.data?.totalCount ?? 0,
            onChange: setPayoutPage,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          locale={{ emptyText: 'Chưa có lần chi nào.' }}
        />
      </Surface>
    </div>
  );
};

export default AffiliateCommissionsPage;
