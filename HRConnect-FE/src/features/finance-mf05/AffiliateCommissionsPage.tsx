/**
 * Affiliate › Hoa hồng và chi trả (MF-05, mockup 03/11). The API returns only the affiliate's own
 * commissions and payouts. A commission is earned in full once the candidate has worked through the
 * warranty, and is paid after the Client has paid the service fee.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Pagination, Skeleton } from 'antd';
import { affiliateBankApi, financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus } from '@/types/api/finance';
import { COMMISSION_STATUS, PAYOUT_STATUS, date, labelOf, money } from './financeLabels';
import { StatusChip } from '@/features/portal/affiliate/AffiliateUi';

const PAGE_SIZE = 20;

const STATUS_CHIP: Record<CommissionStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Trong bảo hành', tone: 'info' },
  IN_WARRANTY: { label: 'Trong bảo hành', tone: 'info' },
  EARNED: { label: 'Đủ điều kiện', tone: 'warning' },
  PAYABLE: { label: 'Chờ chi', tone: 'amber' },
  PAID: { label: 'Đã chi', tone: 'success' },
  ON_HOLD: { label: 'Tạm giữ', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const daysLeft = (end?: string | null) => {
  if (!end) return null;
  const ms = new Date(end).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86_400_000));
};

/** What the current status means for this commission, in one short line. */
const statusNote = (c: Commission): string | null => {
  switch (c.status) {
    case 'IN_WARRANTY': {
      if (!c.warrantyEndDate) return null;
      const left = daysLeft(c.warrantyEndDate);
      return `${left === 0 ? 'Hết bảo hành hôm nay' : `Còn ${left} ngày`} · hết bảo hành ${date(c.warrantyEndDate)}`;
    }
    case 'EARNED':
      return c.serviceFeeStatus === 'PAID' ? 'Doanh nghiệp đã thanh toán, chờ Admin duyệt' : 'Chờ doanh nghiệp thanh toán phí dịch vụ';
    case 'PAYABLE':
      return 'Admin đã duyệt, chờ chuyển khoản';
    case 'PENDING':
      return 'Chờ ứng viên bắt đầu đi làm';
    case 'ON_HOLD':
      return 'Đang tạm giữ, bộ phận vận hành đang xác minh';
    case 'CANCELLED':
      return labelOf(COMMISSION_STATUS, c.status).hint ?? null;
    default:
      return c.approvedAt ? `Duyệt ${date(c.approvedAt)}` : null;
  }
};

const FLOW = [
  ['Trong bảo hành', 'Ứng viên đã đi làm'],
  ['Đủ điều kiện', 'Hết bảo hành, chờ doanh nghiệp trả phí'],
  ['Chờ chi', 'Doanh nghiệp đã trả, Admin đã duyệt'],
  ['Đã chi', 'Chuyển vào tài khoản của bạn'],
];

const lastDigits = (account: string) => `••• ${account.slice(-4)}`;

export const AffiliateCommissionsPage: React.FC = () => {
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
  const account = useQuery({ queryKey: ['mf05-my-bank-account'], queryFn: () => affiliateBankApi.get() });

  const items = commissions.data?.items ?? [];
  const inStatus = (statuses: CommissionStatus[]) => items.filter((c) => statuses.includes(c.status));
  const sum = (statuses: CommissionStatus[]) => inStatus(statuses).reduce((t, c) => t + c.amount, 0);
  const count = (statuses: CommissionStatus[]) => `${inStatus(statuses).length} khoản`;

  const kpis = [
    { label: 'Trong bảo hành', statuses: ['PENDING', 'IN_WARRANTY'] as CommissionStatus[], note: 'Ứng viên đang đi làm', color: 'text-slate-900' },
    { label: 'Đủ điều kiện', statuses: ['EARNED'] as CommissionStatus[], note: 'Hết bảo hành', color: 'text-[#0284C7]' },
    { label: 'Chờ chi', statuses: ['PAYABLE'] as CommissionStatus[], note: 'Đã được Admin duyệt', color: 'text-amber-600 font-extrabold' },
    { label: 'Đã nhận', statuses: ['PAID'] as CommissionStatus[], note: 'Đã chuyển khoản', color: 'text-emerald-600 font-extrabold' },
  ];

  const payoutItems = payouts.data?.items ?? [];
  const hasAccount = Boolean(account.data?.bankAccountNumber);

  return (
    <div className="affiliate-commissions-page flex flex-col gap-5">
      <h1 className="sr-only">Hoa hồng và chi trả</h1>
      {commissions.isError && (
        <Alert type="error" showIcon message="Không tải được hoa hồng" description={getApiErrorMessage(commissions.error)} action={<Button onClick={() => commissions.refetch()}>Thử lại</Button>} />
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <section key={k.label} aria-label={k.label} className="rounded-xl border border-solid border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="text-[13px] text-slate-600">{k.label}</div>
            <div className={`mt-1 text-lg font-bold tabular-nums sm:text-[22px] ${k.color}`}>
              {commissions.isLoading ? <Skeleton.Input active size="small" /> : money(sum(k.statuses))}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{k.note} · {count(k.statuses)}</div>
          </section>
        ))}
      </div>

      <section aria-labelledby="aff-commission-flow" className="rounded-xl border border-solid border-slate-200/80 bg-white p-4 shadow-sm">
        <h2 id="aff-commission-flow" className="m-0 mb-2.5 text-[15px] font-bold text-slate-900">Hoa hồng đi qua các bước</h2>
        <ol className="m-0 grid list-none grid-cols-2 gap-2 p-0 text-[13px] lg:grid-cols-4">
          {FLOW.map(([title, body]) => (
            <li key={title} className="rounded-lg bg-slate-50 border border-slate-100 p-2.5"><b className="text-slate-900">{title}</b><div className="text-slate-600">{body}</div></li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="aff-commission-list" className="rounded-xl border border-solid border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <h2 id="aff-commission-list" className="m-0 border-0 border-b border-solid border-slate-100 px-4 py-3.5 text-[15px] font-bold text-slate-900">Hoa hồng</h2>
        {commissions.isLoading ? (
          <div className="p-4"><Skeleton active paragraph={{ rows: 4 }} /></div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="font-semibold text-gray-900">Chưa có hoa hồng</div>
            <p className="m-0 mt-1 text-sm text-gray-600">Hoa hồng xuất hiện khi ứng viên bạn giới thiệu đi làm hoặc doanh nghiệp nhận CV.</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Ứng viên / Việc làm</th>
                  <th className="px-4 py-2.5 font-medium">Dịch vụ</th>
                  <th className="px-4 py-2.5 font-medium">Cách tính</th>
                  <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const chip = STATUS_CHIP[c.status] ?? { label: c.status, tone: 'neutral' };
                  const note = statusNote(c);
                  return (
                    <tr key={c.commissionId} className="border-0 border-t border-solid border-slate-100">
                      <td className="px-4 py-3">
                        <b className="text-gray-900">{c.candidateName ?? '—'}</b>
                        <div className="text-[13px] text-gray-600">{c.jobTitle ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-[13px]">{c.placementId ? 'Tuyển qua Affiliate' : 'Mua CV'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{c.baseAmount ? `Trên phí ${money(c.baseAmount)}` : 'Theo CV được nhận'}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${c.status === 'CANCELLED' ? 'text-gray-400 line-through' : c.status === 'PAID' ? 'text-emerald-600 font-extrabold' : 'text-[#0284C7]'}`}>{money(c.amount)}</td>
                      <td className="px-4 py-3">
                        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                        {note && <div className="mt-0.5 text-xs text-gray-500">{note}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="aff-payouts" className="rounded-xl border border-solid border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-0 border-b border-solid border-slate-100 px-4 py-3.5">
          <h2 id="aff-payouts" className="m-0 text-[15px] font-bold text-gray-900">Lịch sử chi trả</h2>
          {!account.isLoading && (
            <span className={`text-[13px] ${hasAccount ? 'text-gray-600' : 'text-amber-700 font-medium'}`}>
              {hasAccount ? (
                <>Nhận vào: {account.data?.bankName} {lastDigits(account.data?.bankAccountNumber ?? '')} · <Link to="/affiliate/profile" className="text-[#0284C7] hover:text-[#0369A1] font-medium">Đổi tài khoản</Link></>
              ) : (
                <>Chưa có tài khoản nhận tiền · <Link to="/affiliate/profile" className="text-[#0284C7] hover:text-[#0369A1] font-medium">Thêm tài khoản</Link></>
              )}
            </span>
          )}
        </div>
        {payouts.isError ? (
          <div className="p-4"><Alert type="error" showIcon message={getApiErrorMessage(payouts.error)} /></div>
        ) : payouts.isLoading ? (
          <div className="p-4"><Skeleton active paragraph={{ rows: 2 }} /></div>
        ) : payoutItems.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-sm text-gray-600">Chưa có lần chi nào.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Ngày</th>
                  <th className="px-4 py-2.5 font-medium">Mã giao dịch</th>
                  <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2.5 font-medium">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {payoutItems.map((p) => {
                  const st = labelOf(PAYOUT_STATUS, p.status);
                  return (
                    <tr key={p.payoutId} className="border-0 border-t border-solid border-slate-100">
                      <td className="px-4 py-3 tabular-nums">{date(p.payoutDate ?? p.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{p.transactionReference ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{money(p.amount)}</td>
                      <td className="px-4 py-3"><StatusChip tone={st.tone}>{st.label}</StatusChip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(payouts.data?.totalCount ?? 0) > PAGE_SIZE && (
          <div className="flex justify-end border-0 border-t border-solid border-slate-100 p-3">
            <Pagination current={payoutPage} pageSize={PAGE_SIZE} total={payouts.data?.totalCount ?? 0} showSizeChanger={false} onChange={setPayoutPage} />
          </div>
        )}
      </section>
    </div>
  );
};

export default AffiliateCommissionsPage;
