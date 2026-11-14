/**
 * Affiliate › Hoa hồng và chi trả (MF-05). The API returns only the affiliate's own commissions
 * and payouts. A commission is earned once the warranty passes (Headhunt) or the CV is accepted
 * (CV Sourcing), and paid out after the Client settles the service fee and Admin approves payout.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Pagination, Skeleton, Tag } from 'antd';
import { affiliateBankApi, financeApi } from '@/services/api/financeApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Commission, CommissionStatus } from '@/types/api/finance';
import { COMMISSION_STATUS, PAYOUT_STATUS, date, labelOf, money, replacementCountdownText } from './financeLabels';
import { StatusChip } from '@/features/portal/affiliate/AffiliateUi';

const PAGE_SIZE = 20;

const STATUS_CHIP: Record<CommissionStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Đang bảo hành', tone: 'info' },
  IN_WARRANTY: { label: 'Đang bảo hành', tone: 'info' },
  EARNED: { label: 'Chờ trả phí', tone: 'warning' },
  PAYABLE: { label: 'Chờ chuyển khoản', tone: 'amber' },
  PAID: { label: 'Đã nhận tiền', tone: 'success' },
  ON_HOLD: { label: 'Tạm giữ', tone: 'danger' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

const statusChipFor = (c: Commission): { label: string; tone: string } => {
  if (c.status === 'EARNED' && c.serviceFeeStatus === 'PAID') {
    return { label: 'Chờ Admin duyệt', tone: 'info' };
  }
  return STATUS_CHIP[c.status] ?? { label: c.status, tone: 'neutral' };
};

const daysLeft = (end?: string | null) => {
  if (!end) return null;
  const ms = new Date(end).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86_400_000));
};

/** What the current status means for this commission, in one plain Vietnamese line. */
const statusNote = (c: Commission): string | null => {
  switch (c.status) {
    case 'IN_WARRANTY': {
      if (!c.warrantyEndDate) return null;
      const left = daysLeft(c.warrantyEndDate);
      return `${left === 0 ? 'Hết bảo hành hôm nay' : `Còn ${left} ngày`} · hết ${date(c.warrantyEndDate)}`;
    }
    case 'EARNED':
      return c.serviceFeeStatus === 'PAID'
        ? 'Doanh nghiệp đã trả phí, chờ Admin duyệt chi'
        : 'Đã hết bảo hành, chờ doanh nghiệp trả phí';
    case 'PAYABLE':
      return 'Admin đã duyệt, chuẩn bị chuyển khoản';
    case 'PAID':
      return c.approvedAt ? `Đã duyệt chi ${date(c.approvedAt)}` : 'Đã chuyển khoản vào tài khoản';
    case 'PENDING':
      return 'Chờ ứng viên bắt đầu đi làm';
    case 'ON_HOLD':
      return 'Đang tạm giữ, bộ phận vận hành đang xác minh';
    case 'CANCELLED': {
      if (c.warrantyStatus === 'VOIDED') {
        switch (c.replacementSlotStatus) {
          case 'OPEN': {
            const countdown = replacementCountdownText(c.replacementExpiresAt);
            return c.replacementExpiresAt && countdown
              ? `Đã mở suất thay thế · ${countdown} · hết ${date(c.replacementExpiresAt)}`
              : 'Đã mở suất thay thế';
          }
          case 'WAITING_PAYMENT':
            return 'Đang chờ doanh nghiệp thanh toán phí để mở suất thay thế';
          case 'FILLED':
            return 'Suất thay thế đã có người đi làm';
          case 'EXPIRED':
            return 'Đã hết hạn suất thay thế';
          case 'CANCELLED':
            return 'Suất thay thế đã hủy';
          default:
            return 'Ứng viên nghỉ trong bảo hành · Không còn suất thay thế';
        }
      }
      return labelOf(COMMISSION_STATUS, c.status).hint ?? null;
    }
    default:
      return null;
  }
};

const FLOW = [
  ['1. Đang bảo hành', 'Ứng viên đã đi làm, chờ hết thời hạn bảo hành'],
  ['2. Chờ trả phí', 'Hết bảo hành, chờ doanh nghiệp thanh toán'],
  ['3. Chờ chuyển khoản', 'Doanh nghiệp đã trả, Admin đã duyệt chi'],
  ['4. Đã nhận tiền', 'Tiền đã chuyển vào tài khoản ngân hàng của bạn'],
] as const;

type FilterTab = 'ALL' | 'WARRANTY' | 'EARNED' | 'PAYABLE' | 'PAID' | 'CANCELLED';

const FILTER_TABS: { key: FilterTab; label: string; matches: (s: CommissionStatus) => boolean }[] = [
  { key: 'ALL', label: 'Tất cả', matches: () => true },
  { key: 'WARRANTY', label: 'Đang bảo hành', matches: (s) => s === 'PENDING' || s === 'IN_WARRANTY' },
  { key: 'EARNED', label: 'Chờ trả phí', matches: (s) => s === 'EARNED' },
  { key: 'PAYABLE', label: 'Chờ chuyển khoản', matches: (s) => s === 'PAYABLE' },
  { key: 'PAID', label: 'Đã nhận tiền', matches: (s) => s === 'PAID' },
  { key: 'CANCELLED', label: 'Đã hủy', matches: (s) => s === 'CANCELLED' || s === 'ON_HOLD' },
];

const lastDigits = (account: string) => `••• ${account.slice(-4)}`;

export const AffiliateCommissionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab')?.toUpperCase();
  const defaultFilter: FilterTab = FILTER_TABS.some((t) => t.key === initialTab) ? (initialTab as FilterTab) : 'ALL';
  const [payoutPage, setPayoutPage] = useState(1);
  const [filter, setFilter] = useState<FilterTab>(defaultFilter);
  useEffect(() => {
    const tabParam = searchParams.get('tab')?.toUpperCase();
    if (tabParam && FILTER_TABS.some((t) => t.key === tabParam)) {
      setFilter(tabParam as FilterTab);
    }
  }, [searchParams]);
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

  const items = useMemo(() => commissions.data?.items ?? [], [commissions.data?.items]);
  const inStatus = (statuses: CommissionStatus[]) => items.filter((c) => statuses.includes(c.status));
  const sum = (statuses: CommissionStatus[]) => inStatus(statuses).reduce((t, c) => t + c.amount, 0);
  const count = (statuses: CommissionStatus[]) => `${inStatus(statuses).length} khoản`;

  const visibleItems = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.key === filter);
    return tab ? items.filter((c) => tab.matches(c.status)) : items;
  }, [items, filter]);

  const kpis = [
    { label: 'Đang bảo hành', statuses: ['PENDING', 'IN_WARRANTY'] as CommissionStatus[], note: 'Ứng viên đang đi làm', accent: 'border-l-sky-500', color: 'text-slate-900' },
    { label: 'Chờ trả phí', statuses: ['EARNED'] as CommissionStatus[], note: 'Chờ doanh nghiệp thanh toán', accent: 'border-l-[#0284C7]', color: 'text-[#0284C7]' },
    { label: 'Chờ chuyển khoản', statuses: ['PAYABLE'] as CommissionStatus[], note: 'Admin đã duyệt chi', accent: 'border-l-amber-500', color: 'text-amber-600' },
    { label: 'Đã nhận tiền', statuses: ['PAID'] as CommissionStatus[], note: 'Đã chuyển khoản', accent: 'border-l-emerald-500', color: 'text-emerald-600' },
  ];

  const payoutItems = payouts.data?.items ?? [];
  const hasAccount = Boolean(account.data?.bankAccountNumber);

  return (
    <div className="affiliate-commissions-page flex flex-col gap-5">
      <h1 className="sr-only">Hoa hồng và chi trả</h1>
      {commissions.isError && (
        <Alert
          type="error"
          showIcon
          message="Không tải được hoa hồng"
          description={getApiErrorMessage(commissions.error)}
          action={<Button onClick={() => commissions.refetch()}>Thử lại</Button>}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <section
            key={k.label}
            aria-label={k.label}
            className={`flex flex-col justify-between rounded-xl border border-solid border-slate-200/80 border-l-4 ${k.accent} bg-white p-4 shadow-sm`}
          >
            <div className="text-[13px] font-medium text-slate-600">{k.label}</div>
            <div className={`mt-1.5 text-xl font-extrabold tabular-nums sm:text-[22px] ${k.color}`}>
              {commissions.isLoading ? <Skeleton.Input active size="small" /> : money(sum(k.statuses))}
            </div>
            <div className="mt-1 text-xs text-slate-500">{k.note} · {count(k.statuses)}</div>
          </section>
        ))}
      </div>

      <section aria-labelledby="aff-commission-flow" className="rounded-xl border border-solid border-slate-200/80 bg-white p-4 shadow-sm">
        <h2 id="aff-commission-flow" className="m-0 mb-3 text-[15px] font-bold text-slate-900">Quy trình nhận hoa hồng</h2>
        <ol className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map(([title, body]) => (
            <li key={title} className="rounded-lg border border-solid border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <div className="font-semibold text-slate-900">{title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-slate-600">{body}</div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="aff-commission-list" className="overflow-hidden rounded-xl border border-solid border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-0 border-b border-solid border-slate-100 px-4 py-3.5">
          <h2 id="aff-commission-list" className="m-0 text-[15px] font-bold text-slate-900">Danh sách hoa hồng</h2>
          <div role="tablist" aria-label="Lọc theo trạng thái hoa hồng" className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((t) => {
              const cnt = items.filter((c) => t.matches(c.status)).length;
              const active = filter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(t.key)}
                  className={`inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-solid px-3 text-xs font-medium transition-colors ${
                    active
                      ? 'border-[#0284C7] bg-sky-50 text-[#0369A1]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`tabular-nums ${active ? 'text-[#0284C7]' : 'text-slate-400'}`}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {commissions.isLoading ? (
          <div className="p-4"><Skeleton active paragraph={{ rows: 4 }} /></div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="font-semibold text-slate-900">Chưa có hoa hồng</div>
            <p className="m-0 mt-1 text-sm text-slate-600">Hoa hồng xuất hiện khi ứng viên bạn giới thiệu đi làm hoặc doanh nghiệp nhận CV.</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">Không có khoản hoa hồng nào ở mục này.</div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Ứng viên / Vị trí</th>
                  <th className="px-4 py-3 whitespace-nowrap">Dịch vụ</th>
                  <th className="px-4 py-3 whitespace-nowrap">Cách tính</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Số tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((c) => {
                  const chip = statusChipFor(c);
                  const note = statusNote(c);
                  const canReplace =
                    c.status === 'CANCELLED' &&
                    c.warrantyStatus === 'VOIDED' &&
                    c.replacementSlotStatus === 'OPEN' &&
                    Boolean(c.jobId);
                  return (
                    <tr key={c.commissionId} className="border-0 border-t border-solid border-slate-100 align-middle hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{c.candidateName ?? '—'}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{c.jobTitle ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Tag color={c.placementId ? 'orange' : 'cyan'} className="m-0 rounded-md border-0 font-semibold">
                          {c.placementId ? 'Tuyển qua Affiliate' : 'Mua CV theo số lượng'}
                        </Tag>
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">
                        {c.baseAmount
                          ? `Trên phí ${money(c.baseAmount)}`
                          : c.placementId
                            ? 'Hoa hồng tuyển dụng'
                            : 'Theo CV được nhận'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3.5 text-right text-[14px] font-bold tabular-nums ${
                          c.status === 'CANCELLED'
                            ? 'text-slate-400 line-through'
                            : c.status === 'PAID'
                              ? 'text-emerald-600 font-extrabold'
                              : 'text-[#0284C7]'
                        }`}
                      >
                        {money(c.amount)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                        {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {canReplace ? (
                          <Link
                            to={`/affiliate/submit-candidate?job=${c.jobId}`}
                            className="inline-flex min-h-[32px] items-center rounded-lg bg-[#C2410C] px-3 text-xs font-semibold text-white no-underline transition-colors hover:bg-[#9A3412] hover:text-white"
                          >
                            Giới thiệu thay thế
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="aff-payouts" className="overflow-hidden rounded-xl border border-solid border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-0 border-b border-solid border-slate-100 px-4 py-3.5">
          <h2 id="aff-payouts" className="m-0 text-[15px] font-bold text-slate-900">Lịch sử chuyển khoản</h2>
          {!account.isLoading && (
            <span className={`text-[13px] ${hasAccount ? 'text-slate-600' : 'font-medium text-amber-700'}`}>
              {hasAccount ? (
                <>Nhận vào: {account.data?.bankName} {lastDigits(account.data?.bankAccountNumber ?? '')} · <Link to="/affiliate/profile" className="font-medium text-[#0284C7] hover:text-[#0369A1]">Đổi tài khoản</Link></>
              ) : (
                <>Chưa có tài khoản nhận tiền · <Link to="/affiliate/profile" className="font-medium text-[#0284C7] hover:text-[#0369A1]">Thêm tài khoản</Link></>
              )}
            </span>
          )}
        </div>
        {payouts.isError ? (
          <div className="p-4"><Alert type="error" showIcon message={getApiErrorMessage(payouts.error)} /></div>
        ) : payouts.isLoading ? (
          <div className="p-4"><Skeleton active paragraph={{ rows: 2 }} /></div>
        ) : payoutItems.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-sm text-slate-600">Chưa có giao dịch chuyển khoản nào.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Ngày chuyển</th>
                  <th className="px-4 py-3">Mã giao dịch</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {payoutItems.map((p) => {
                  const st = labelOf(PAYOUT_STATUS, p.status);
                  return (
                    <tr key={p.payoutId} className="border-0 border-t border-solid border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 tabular-nums text-slate-700">{date(p.payoutDate ?? p.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-[13px] text-slate-700">{p.transactionReference ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{money(p.amount)}</td>
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
