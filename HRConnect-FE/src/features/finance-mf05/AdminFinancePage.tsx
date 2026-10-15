/**
 * Admin › Chi trả hoa hồng (MF-05, HEADHUNT_COD).
 * Commissions: approve (only after the Client paid the service fee), record payouts, adjust, cancel.
 * Service fees: record that the Client paid. Payouts: history of transfers.
 */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Form, Input, InputNumber, Modal, Radio, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus, Payout, ServiceFee, ServiceFeeStatus } from '@/types/api/finance';
import { FilterPills, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { COMMISSION_STATUS, PAYOUT_STATUS, SERVICE_FEE_STATUS, date, labelOf, money } from './financeLabels';

type Tab = 'commissions' | 'fees' | 'payouts';
type Dialog =
  | { kind: 'payout'; commission: Commission }
  | { kind: 'adjust'; commission: Commission }
  | { kind: 'cancel'; commission: Commission }
  | { kind: 'fee'; fee: ServiceFee }
  | null;

const PAGE_SIZE = 20;

export const AdminFinancePage: React.FC = () => {
  const { message, modal } = App.useApp();
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

  const refresh = () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('mf05-') });
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      message.success('Đã cập nhật.');
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
    { title: 'Hết bảo hành', dataIndex: 'warrantyEndDate', render: (v) => date(v) },
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
      title: '',
      key: 'actions',
      align: 'right',
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
    { title: 'Doanh nghiệp', dataIndex: 'companyName', render: (v) => v ?? '—' },
    {
      title: 'Ứng viên / Job',
      key: 'who',
      render: (_, f) => (
        <div>
          <div className="font-semibold text-slate-900">{f.candidateName ?? '—'}</div>
          <div className="text-xs text-slate-500">{f.jobTitle ?? '—'}</div>
        </div>
      ),
    },
    {
      title: 'Phí dịch vụ',
      key: 'amount',
      align: 'right',
      render: (_, f) => (
        <div className="text-right">
          <div className="font-semibold tabular-nums">{money(f.amount, f.currencyCode)}</div>
          <div className="text-xs text-slate-500">{money(f.baseSalary, f.currencyCode)} × {f.feeMultiplier}</div>
        </div>
      ),
    },
    { title: 'Hạn trả', dataIndex: 'dueDate', render: (v) => date(v) },
    { title: 'Trạng thái', dataIndex: 'status', render: (v: ServiceFeeStatus) => { const s = labelOf(SERVICE_FEE_STATUS, v); return <StatusDot tone={s.tone}>{s.label}</StatusDot>; } },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, f) =>
        (f.status === 'PENDING' || f.status === 'OVERDUE') && (
          <Button size="small" type="primary" onClick={() => { form.setFieldsValue({ paidAt: dayjs() }); setDialog({ kind: 'fee', fee: f }); }}>
            Ghi nhận đã thu
          </Button>
        ),
    },
  ];

  const payoutColumns: ColumnsType<Payout> = [
    { title: 'Ngày chi', dataIndex: 'payoutDate', render: (v) => date(v) },
    { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (v: number) => <span className="font-semibold tabular-nums">{money(v)}</span> },
    { title: 'Phương thức', dataIndex: 'method', render: (v) => v ?? '—' },
    { title: 'Mã giao dịch', dataIndex: 'transactionReference', render: (v) => v ?? '—' },
    { title: 'Lần', dataIndex: 'attemptNo' },
    { title: 'Kết quả', dataIndex: 'status', render: (v) => { const s = labelOf(PAYOUT_STATUS, v); return <StatusDot tone={s.tone}>{s.label}</StatusDot>; } },
  ];

  const active = tab === 'commissions' ? commissions : tab === 'fees' ? fees : payouts;
  const pagination = {
    current: page,
    pageSize: PAGE_SIZE,
    total: active.data?.totalCount ?? 0,
    onChange: setPage,
    showSizeChanger: false,
  };

  return (
    <div>
      <PageHero
        eyebrow="MF-05 · HEADHUNT_COD"
        title="Chi trả hoa hồng"
        description="Hoa hồng được nhận 100% khi ứng viên đi làm đủ thời hạn bảo hành, và chỉ được duyệt chi sau khi Client đã thanh toán phí dịch vụ."
        actions={<Button icon={<ReloadOutlined />} onClick={refresh}>Làm mới</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterPills<Tab>
          label="Mục"
          value={tab}
          onChange={(v) => { setTab(v); setPage(1); }}
          options={[
            { value: 'commissions', label: 'Hoa hồng' },
            { value: 'fees', label: 'Công nợ phí' },
            { value: 'payouts', label: 'Lịch sử chi' },
          ]}
        />
        {tab === 'commissions' && (
          <FilterPills<CommissionStatus | 'all'>
            label="Trạng thái hoa hồng"
            value={commissionStatus}
            onChange={(v) => { setCommissionStatus(v); setPage(1); }}
            options={[{ value: 'all', label: 'Tất cả' }, ...(['EARNED', 'PAYABLE', 'PENDING', 'IN_WARRANTY', 'ON_HOLD', 'PAID', 'CANCELLED'] as CommissionStatus[]).map((s) => ({ value: s, label: COMMISSION_STATUS[s].label }))]}
          />
        )}
        {tab === 'fees' && (
          <FilterPills<ServiceFeeStatus | 'all'>
            label="Trạng thái phí"
            value={feeStatus}
            onChange={(v) => { setFeeStatus(v); setPage(1); }}
            options={[{ value: 'all', label: 'Tất cả' }, ...(['PENDING', 'OVERDUE', 'PAID'] as ServiceFeeStatus[]).map((s) => ({ value: s, label: SERVICE_FEE_STATUS[s].label }))]}
          />
        )}
      </div>

      {active.isError && <Alert className="mb-4" type="error" showIcon message={getApiErrorMessage(active.error)} />}
      <Surface>
        {tab === 'commissions' && (
          <Table rowKey="commissionId" columns={commissionColumns} dataSource={commissions.data?.items} loading={commissions.isFetching} pagination={pagination} scroll={{ x: 900 }} locale={{ emptyText: 'Chưa có hoa hồng nào.' }} />
        )}
        {tab === 'fees' && (
          <Table rowKey="serviceFeeId" columns={feeColumns} dataSource={fees.data?.items} loading={fees.isFetching} pagination={pagination} scroll={{ x: 800 }} locale={{ emptyText: 'Chưa có công nợ phí nào.' }} />
        )}
        {tab === 'payouts' && (
          <Table rowKey="payoutId" columns={payoutColumns} dataSource={payouts.data?.items} loading={payouts.isFetching} pagination={pagination} scroll={{ x: 700 }} locale={{ emptyText: 'Chưa có lần chi nào.' }} />
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
