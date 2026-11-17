/**
 * @file AdminOverviewPage.tsx
 * @description Admin · command & analytics overview. KPIs, cash flow, activity and users by role come
 * from one endpoint (GET /admin/dashboard/metrics, permission report.view); "Hoạt động gần đây" is the
 * latest audit log and "Cấu hình & Điều hành" reads service types and commission rules.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Alert, Button, Skeleton } from 'antd';
import { ArrowRightOutlined, AppstoreOutlined, DollarOutlined, BarChartOutlined, WalletOutlined } from '@ant-design/icons';
import { getApiError } from '@/services/apiClient';
import { adminAuditApi, adminCommissionApi, adminDashboardApi, adminServiceTypesApi } from '@/services/api/adminApi';
import { money } from '@/features/finance-mf05/financeLabels';
import type { DashboardRange } from '@/types/api/admin';
import { FilterPills, Initials, StatTile, Surface } from './ui';
import { describeAuditAction } from './auditLabels';
import { ActivityBarChart, CashflowAreaChart, RoleBreakdownBar } from './components/DashboardCharts';

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: '90d', label: '90 ngày' },
];

const RANGE_TEXT: Record<DashboardRange, string> = { '7d': '7 ngày qua', '30d': '30 ngày qua', '90d': '90 ngày qua' };

const isForbidden = (error: unknown) => getApiError(error).status === 403;

const relativeTime = (iso: string) => {
  const minutes = dayjs().diff(dayjs(iso), 'minute');
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} ngày trước` : dayjs(iso).format('DD/MM/YYYY');
};

const SectionHeader: React.FC<{ title: string; subtitle: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      <h2 className="m-0 text-[15px] font-semibold text-[#111827]">{title}</h2>
      <p className="m-0 mt-0.5 text-xs text-[#6B7487]">{subtitle}</p>
    </div>
    {action}
  </div>
);

/** Same footprint as the loaded tiles/charts so the page does not jump when data arrives. */
const KpiSkeleton: React.FC = () => (
  <section aria-label="Đang tải chỉ số" aria-busy className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="admin-surface flex h-[106px] flex-col justify-between border border-solid border-black/[0.08] p-4">
        <Skeleton.Input active size="small" className="!w-28 !min-w-0" />
        <Skeleton.Input active className="!h-7 !w-16 !min-w-0" />
      </div>
    ))}
  </section>
);

const ChartSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div aria-hidden className="w-full animate-pulse rounded-xl bg-[#ECEFF4]" style={{ height }} />
);

export const AdminOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>('30d');
  const todayStart = dayjs().startOf('day').toISOString();

  const metrics = useQuery({
    queryKey: ['admin-dashboard-metrics', range],
    queryFn: () => adminDashboardApi.getMetrics(range),
    // A 403 (no report.view) will not change on retry; other errors keep the app default of one retry.
    retry: (failureCount, error) => !isForbidden(error) && failureCount < 1,
    placeholderData: (previous) => previous,
  });
  const recent = useQuery({
    queryKey: ['admin-overview', 'recent'],
    queryFn: async () => (await adminAuditApi.list({ page: 1, pageSize: 6 })).items,
  });
  const serviceTypes = useQuery({ queryKey: ['admin-service-types'], queryFn: () => adminServiceTypesApi.list() });
  const rules = useQuery({
    queryKey: ['admin-overview', 'rules'],
    queryFn: async () => (await adminCommissionApi.list({ isActive: true, page: 1, pageSize: 1 })).total,
  });

  const data = metrics.data;
  const kpis = data?.kpis;
  const currency = data?.currencyCode ?? 'VND';
  const forbidden = metrics.isError && isForbidden(metrics.error);
  // KPIs need data; the chart cards stay (with the range switcher) on any error except 403,
  // so a failing range can still be switched away from.
  const showKpis = !metrics.isError || Boolean(data);
  const showCards = !forbidden;
  // While a new range loads, the previous range stays on screen, dimmed.
  const stale = metrics.isPlaceholderData;

  const cardBody = (render: () => React.ReactNode, skeletonHeight: number) =>
    data ? (
      <div aria-busy={stale} className={stale ? 'opacity-60 transition-opacity duration-150' : 'transition-opacity duration-150'}>
        {render()}
      </div>
    ) : metrics.isError ? (
      <p className="m-0 py-6 text-center text-sm text-[#6B7487]">Chưa tải được số liệu cho khoảng này.</p>
    ) : (
      <ChartSkeleton height={skeletonHeight} />
    );

  const summary = metrics.isLoading
    ? 'Đang tổng hợp số liệu vận hành...'
    : !kpis
      ? 'Theo dõi hàng chờ, dòng tiền và nhịp hoạt động của nền tảng.'
      : kpis.pendingApprovals === 0
        ? 'Hàng chờ phê duyệt đang trống. Mọi hồ sơ đăng ký đã được xử lý.'
        : `Hiện có ${kpis.pendingApprovals.toLocaleString('vi-VN')} tài khoản đang chờ bạn phê duyệt.`;

  const rangePills = (
    <FilterPills<DashboardRange> label="Khoảng thời gian" value={range} onChange={setRange} options={RANGE_OPTIONS} />
  );

  return (
    <div className="admin-stagger space-y-6">
      {/* 1. Command Header Bar */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-0 border-b border-solid border-black/[0.08] pb-5">
        <div className="min-w-0">
          <div className="font-mono text-xs font-medium text-[#6B7487]">{dayjs().format('dddd · DD/MM/YYYY')}</div>
          <h1 className="m-0 mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[#111827]">
            Điều hành hệ thống
          </h1>
          <p className="m-0 mt-1 text-[14.5px] text-[#4B5565]">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="primary"
            size="large"
            onClick={() => navigate('/admin/approvals?status=UNDER_REVIEW')}
            className="active:scale-[0.985] transition-transform duration-100"
          >
            Duyệt tài khoản
          </Button>
          <Button
            size="large"
            onClick={() => navigate('/admin/users')}
            className="active:scale-[0.985] transition-transform duration-100"
          >
            Quản lý người dùng
          </Button>
        </div>
      </header>

      {/* 2. Metrics errors: 403 has no retry, other errors can retry. */}
      {metrics.isError && !data && (
        forbidden ? (
          <Alert
            type="warning"
            showIcon
            message="Bạn không có quyền xem số liệu tổng quan"
            description="Chỉ số, dòng tiền và nhịp hoạt động cần quyền report.view. Nhật ký và cấu hình bên dưới vẫn dùng được."
          />
        ) : (
          <Alert
            type="error"
            showIcon
            message="Không tải được số liệu tổng quan"
            description={getApiError(metrics.error, 'Vui lòng thử lại sau ít phút.').message}
            action={
              <Button size="small" onClick={() => void metrics.refetch()} loading={metrics.isFetching}>
                Thử lại
              </Button>
            }
          />
        )
      )}

      {/* 3. KPI strip */}
      {showKpis &&
        (metrics.isLoading || !kpis ? (
          <KpiSkeleton />
        ) : (
          <section aria-label="Chỉ số vận hành" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              label="Chờ duyệt tài khoản"
              value={kpis.pendingApprovals}
              hint="Affiliate và doanh nghiệp"
              tone="warning"
              onClick={() => navigate('/admin/approvals?status=UNDER_REVIEW')}
            />
            <StatTile
              label="Phí quá hạn"
              value={kpis.overdueServiceFeesCount}
              hint={money(kpis.overdueServiceFeesAmount, currency)}
              tone="danger"
              onClick={() => navigate('/admin/finance')}
            />
            <StatTile
              label="Hoa hồng chờ chi"
              value={kpis.payableCommissionsCount}
              hint={money(kpis.payableCommissionsAmount, currency)}
              tone="success"
              onClick={() => navigate('/admin/finance')}
            />
            <StatTile
              label="Sự kiện hôm nay"
              value={kpis.auditEventsToday}
              hint="Ghi nhận từ 00:00"
              tone="info"
              onClick={() =>
                navigate(
                  `/admin/audit-trail?from=${encodeURIComponent(todayStart)}&to=${encodeURIComponent(dayjs().endOf('day').toISOString())}`
                )
              }
            />
          </section>
        ))}

      {/* 4. Two columns: charts + ledger on the left, users + configuration on the right */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {showCards && (
            <>
              <Surface className="p-4 sm:p-5">
                <SectionHeader title="Dòng tiền" subtitle={`Thu phí và chi hoa hồng · ${RANGE_TEXT[range]}`} action={rangePills} />
                {cardBody(() => <CashflowAreaChart points={data!.cashflowSeries} currencyCode={currency} />, 236)}
              </Surface>

              <Surface className="p-4 sm:p-5">
                <SectionHeader title="Nhịp hoạt động" subtitle={`Sự kiện audit và người dùng mới mỗi ngày · ${RANGE_TEXT[range]}`} />
                {cardBody(() => <ActivityBarChart points={data!.activitySeries} />, 196)}
              </Surface>
            </>
          )}

          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between border-0 border-b border-solid border-black/[0.08] px-6 py-4">
              <div>
                <h2 className="m-0 text-[15px] font-semibold text-[#111827]">Hoạt động gần đây</h2>
                <p className="m-0 mt-0.5 text-xs text-[#6B7487]">Nhật ký thao tác mới nhất trên toàn hệ thống</p>
              </div>
              <Button type="link" className="!px-0 text-[13px] font-medium" onClick={() => navigate('/admin/audit-trail')}>
                Xem nhật ký <ArrowRightOutlined />
              </Button>
            </div>

            <div className="px-3 py-2">
              {recent.isLoading ? (
                <div className="p-3">
                  <Skeleton active avatar paragraph={{ rows: 4 }} />
                </div>
              ) : recent.isError ? (
                <p className="m-0 p-4 text-sm text-[#6B7487]">Không tải được nhật ký.</p>
              ) : (recent.data ?? []).length === 0 ? (
                <p className="m-0 p-4 text-sm text-[#6B7487]">Chưa có hoạt động nào.</p>
              ) : (
                <ol className="m-0 list-none divide-y divide-black/[0.05] p-0">
                  {recent.data!.map((log) => {
                    const actor = log.actorDisplayName || log.actorEmail || (log.actorType === 'SERVICE' ? 'Dịch vụ AI' : 'Hệ thống');
                    return (
                      <li key={log.auditLogId}>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/audit-trail?action=${encodeURIComponent(log.action)}`)}
                          className="flex w-full cursor-pointer items-center gap-3.5 rounded-lg border-0 bg-transparent px-3 py-3 text-left transition-[background-color,transform] duration-150 hover:bg-[#ECEFF4]/70 active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                        >
                          <Initials name={actor} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] text-[#111827]">
                              <span className="font-medium">{actor}</span> {describeAuditAction(log.action)}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[11.5px] text-[#6B7487]">
                              {log.entityType ?? log.source}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-[#6B7487]">
                            {relativeTime(log.createdAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </Surface>
        </div>

        <div className="min-w-0 space-y-5">
          {showCards && (
            <Surface className="p-4 sm:p-5">
              <SectionHeader title="Người dùng" subtitle="Theo trạng thái và vai trò hiện tại" />
              {cardBody(() => (
                <>
                  <div className="mb-5 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigate('/admin/users')}
                      className="flex cursor-pointer flex-col gap-1 rounded-xl border border-solid border-black/[0.08] bg-[#F9FAFC] p-3 text-left transition-[background-color,border-color] duration-150 hover:border-blue-600/40 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <span className="text-xs text-[#4b5565]">Người dùng đang hoạt động</span>
                      <span className="font-mono text-xl font-semibold tabular-nums text-[#111827]">
                        {data!.kpis.activeUsers.toLocaleString('vi-VN')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/admin/users?status=SUSPENDED')}
                      className="flex cursor-pointer flex-col gap-1 rounded-xl border border-solid border-black/[0.08] bg-[#F9FAFC] p-3 text-left transition-[background-color,border-color] duration-150 hover:border-blue-600/40 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      <span className="text-xs text-[#4b5565]">Đang tạm khóa</span>
                      <span className="font-mono text-xl font-semibold tabular-nums text-[#111827]">
                        {data!.kpis.suspendedUsers.toLocaleString('vi-VN')}
                      </span>
                    </button>
                  </div>
                  <RoleBreakdownBar items={data!.userRoleBreakdown} />
                </>
              ), 180)}
            </Surface>
          )}

          <Surface className="p-5">
            <h2 className="m-0 mb-1 text-[15px] font-semibold text-[#111827]">Cấu hình & Điều hành</h2>
            <p className="m-0 mb-4 text-xs text-[#6B7487]">Truy cập nhanh các tham số cốt lõi</p>
            <div className="space-y-2.5">
              {[
                {
                  icon: <AppstoreOutlined />,
                  title: 'Loại dịch vụ',
                  value: serviceTypes.isLoading ? '…' : `${(serviceTypes.data ?? []).filter((s) => s.isActive).length} đang dùng`,
                  to: '/admin/service-types',
                },
                {
                  icon: <DollarOutlined />,
                  title: 'Quy tắc hoa hồng',
                  value: rules.isLoading ? '…' : `${rules.data ?? 0} đang áp dụng`,
                  to: '/admin/commission-rules',
                },
                {
                  icon: <WalletOutlined />,
                  title: 'Chi trả tài chính',
                  value: 'Đối soát & giải ngân',
                  to: '/admin/payouts',
                },
                {
                  icon: <BarChartOutlined />,
                  title: 'Báo cáo tổng hợp',
                  value: 'Doanh thu & hiệu suất',
                  to: '/admin/reports',
                },
              ].map((c) => (
                <button
                  key={c.to}
                  type="button"
                  onClick={() => navigate(c.to)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-solid border-black/[0.08] bg-[#F9FAFC] p-3.5 text-left transition-[background-color,border-color,transform] duration-150 hover:border-blue-600/40 hover:bg-white active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--console-accent-soft)] text-base text-[color:var(--console-accent)]" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-[#111827]">{c.title}</span>
                    <span className="block truncate text-xs text-[#6B7487]">{c.value}</span>
                  </span>
                  <ArrowRightOutlined className="text-xs text-[#8B93A7]" aria-hidden />
                </button>
              ))}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
};

export default AdminOverviewPage;
