/**
 * Affiliate › Hoa hồng & chi trả (MF-05, HEADHUNT_COD). The API returns only the affiliate's own
 * commissions and payouts. A commission is earned in full once the candidate has worked through the
 * warranty, and is paid after the Client has paid the service fee.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus, Payout } from '@/types/api/finance';
import { FilterPills, PageHero, StatusDot, Surface } from '@/features/admin-console/ui';
import { COMMISSION_STATUS, PAYOUT_STATUS, date, labelOf, money } from './financeLabels';

const PAGE_SIZE = 20;
type Tab = 'commissions' | 'payouts';

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
        eyebrow="Headhunt"
        title="Hoa hồng & chi trả"
        description="Bạn nhận 100% hoa hồng khi ứng viên mình giới thiệu đi làm đủ thời hạn bảo hành. Hoa hồng được chi sau khi doanh nghiệp đã thanh toán phí dịch vụ."
        actions={<Button icon={<ReloadOutlined />} onClick={() => active.refetch()} loading={active.isFetching}>Làm mới</Button>}
      />

      {tab === 'commissions' && items.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Đang chờ đủ thời hạn', value: sum(['PENDING', 'ON_HOLD']) },
            { label: 'Đã đạt, chờ chi', value: sum(['EARNED', 'PAYABLE']) },
            { label: 'Đã nhận', value: sum(['PAID']) },
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
