/**
 * Affiliate › Hoa hồng & chi trả (MF-05, HEADHUNT_COD). The API returns only the affiliate's own
 * commissions and payouts. A commission is earned in full once the candidate has worked through the
 * warranty, and is paid after the Client has paid the service fee.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Form, Input, Modal, Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BankOutlined, ReloadOutlined } from '@ant-design/icons';
import { affiliateBankApi, financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus, Payout } from '@/types/api/finance';
import { FilterPills, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { COMMISSION_STATUS, PAYOUT_STATUS, date, labelOf, money } from './financeLabels';

const PAGE_SIZE = 20;
type Tab = 'commissions' | 'payouts';

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

export const AffiliateCommissionsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('commissions');
  const [page, setPage] = useState(1);
  const commissions = useQuery({
    queryKey: ['mf05-my-commissions', page],
    queryFn: () => financeApi.commissions({ page, pageSize: PAGE_SIZE }),
    enabled: tab === 'commissions',
    placeholderData: (previous) => previous,
  });
  const payouts = useQuery({
    queryKey: ['mf05-my-payouts', page],
    queryFn: () => financeApi.payouts({ page, pageSize: PAGE_SIZE }),
    enabled: tab === 'payouts',
    placeholderData: (previous) => previous,
  });
  const active = tab === 'commissions' ? commissions : payouts;

  const items = commissions.data?.items ?? [];
  const sum = (statuses: CommissionStatus[]) => items.filter((c) => statuses.includes(c.status)).reduce((t, c) => t + c.amount, 0);

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
    { title: 'Hoa hồng', dataIndex: 'amount', align: 'right', render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    { title: 'Đủ điều kiện từ', dataIndex: 'warrantyEndDate', render: (v) => date(v) },
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
  ];
  const payoutColumns: ColumnsType<Payout> = [
    { title: 'Ngày chi', dataIndex: 'payoutDate', render: (v) => date(v) },
    { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    { title: 'Mã giao dịch', dataIndex: 'transactionReference', render: (v) => v ?? '—' },
    { title: 'Kết quả', dataIndex: 'status', render: (v) => { const s = labelOf(PAYOUT_STATUS, v); return <StatusDot tone={s.tone}>{s.label}</StatusDot>; } },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Headhunt · MF-05"
        title="Hoa hồng & chi trả"
        description="Hoa hồng Headhunt minh bạch qua 5 giai đoạn: PENDING (ghi nhận ứng viên) → EARNED (ứng viên đi làm) → ON_HOLD (bảo lưu trong thời gian bảo hành) → PAYABLE (qua bảo hành & DN thanh toán) → PAID (đã chuyển khoản)."
        actions={<Button icon={<ReloadOutlined />} onClick={() => active.refetch()} loading={active.isFetching}>Làm mới</Button>}
      />

      <PayoutAccountCard />

      {tab === 'commissions' && items.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Bảo lưu trong bảo hành', value: sum(['PENDING', 'ON_HOLD']) },
            { label: 'Đạt điều kiện, chờ chi', value: sum(['EARNED', 'PAYABLE']) },
            { label: 'Đã nhận thành công', value: sum(['PAID']) },
          ].map((k) => (
            <Surface key={k.label} padded>
              <div className="text-[13px] text-slate-500">{k.label}</div>
              <div className="mt-1 text-[22px] font-bold tabular-nums text-slate-900">{money(k.value)}</div>
            </Surface>
          ))}
        </div>
      )}

      <div className="mb-4">
        <FilterPills<Tab>
          label="Mục"
          value={tab}
          onChange={(v) => { setTab(v); setPage(1); }}
          options={[
            { value: 'commissions', label: 'Hoa hồng' },
            { value: 'payouts', label: 'Lịch sử chi' },
          ]}
        />
      </div>
      {active.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(active.error)} />}
      <Surface>
        {tab === 'commissions' ? (
          <Table rowKey="commissionId" columns={commissionColumns} dataSource={commissions.data?.items} loading={commissions.isFetching} scroll={{ x: 600 }}
            pagination={{ current: page, pageSize: PAGE_SIZE, total: commissions.data?.totalCount ?? 0, onChange: setPage, showSizeChanger: false }}
            locale={{ emptyText: 'Chưa có hoa hồng. Hoa hồng xuất hiện khi ứng viên bạn giới thiệu bắt đầu đi làm.' }} />
        ) : (
          <Table rowKey="payoutId" columns={payoutColumns} dataSource={payouts.data?.items} loading={payouts.isFetching} scroll={{ x: 560 }}
            pagination={{ current: page, pageSize: PAGE_SIZE, total: payouts.data?.totalCount ?? 0, onChange: setPage, showSizeChanger: false }}
            locale={{ emptyText: 'Chưa có lần chi nào.' }} />
        )}
      </Surface>
    </div>
  );
};

export default AffiliateCommissionsPage;
