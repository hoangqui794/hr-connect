/**
 * @file AdminOverviewPage.tsx
 * @description Admin · "Việc cần xử lý" as a bento grid. Every number is a real API total
 * (no statistics endpoint exists, so no charts). "Hoạt động gần đây" is the latest audit log.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Button, Skeleton } from 'antd';
import { ArrowRightOutlined, AppstoreOutlined, DollarOutlined, BarChartOutlined, WalletOutlined } from '@ant-design/icons';
import { adminService } from '@/services/adminService';
import { adminAuditApi, adminCommissionApi, adminServiceTypesApi, adminUsersApi } from '@/services/api/adminApi';
import { Initials, StatTile, Surface } from './ui';
import { describeAuditAction } from './auditLabels';

const relativeTime = (iso: string) => {
  const minutes = dayjs().diff(dayjs(iso), 'minute');
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days} ngày trước` : dayjs(iso).format('DD/MM/YYYY');
};

const TweenNumber: React.FC<{ target: number }> = ({ target }) => {
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target === 0) {
      setDisplay(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const duration = 380;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <>{display.toLocaleString('vi-VN')}</>;
};

const Count: React.FC<{ q: { data?: number; isLoading: boolean; isError: boolean } }> = ({ q }) =>
  q.isLoading ? <Skeleton.Input active size="small" /> : <>{q.isError ? '—' : <TweenNumber target={q.data ?? 0} />}</>;

export const AdminOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const todayStart = dayjs().startOf('day').toISOString();

  const approvals = useQuery({
    queryKey: ['admin-overview', 'approvals'],
    queryFn: async () => (await adminService.getApprovals({ status: 'UNDER_REVIEW', pageSize: 1 })).data.total,
  });
  // Job review belongs to Internal HR (main-flows MF-01 step 3), so the Admin overview does not count it.
  const totalUsers = useQuery({
    queryKey: ['admin-overview', 'users-total'],
    queryFn: async () => (await adminUsersApi.list({ page: 1, pageSize: 1 })).total,
  });
  const suspended = useQuery({
    queryKey: ['admin-overview', 'suspended'],
    queryFn: async () => (await adminUsersApi.list({ status: 'SUSPENDED', page: 1, pageSize: 1 })).total,
  });
  const auditToday = useQuery({
    queryKey: ['admin-overview', 'audit', todayStart],
    queryFn: async () => (await adminAuditApi.list({ fromUtc: todayStart, page: 1, pageSize: 1 })).total,
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

  const waiting = approvals.data ?? 0;
  const loadingSummary = approvals.isLoading;

  return (
    <div className="admin-stagger space-y-6">
      {/* 1. Command Header Bar */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-0 border-b border-solid border-black/[0.08] pb-5">
        <div>
          <div className="font-mono text-xs font-medium text-[#6B7487]">
            {dayjs().format('dddd · DD/MM/YYYY')}
          </div>
          <h1 className="m-0 mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[#111827]">
            Điều hành hệ thống
          </h1>
          <p className="m-0 mt-1 text-[14.5px] text-[#4B5565]">
            {loadingSummary
              ? 'Đang tổng hợp trạng thái hàng chờ...'
              : waiting === 0
                ? 'Hàng chờ phê duyệt đang trống. Mọi hồ sơ đăng ký đã được xử lý.'
                : `Hiện có ${waiting} tài khoản đang chờ bạn phê duyệt.`}
          </p>
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

      {/* 2. Uniform 4-Column Stat Strip */}
      <section aria-label="Chỉ số vận hành" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Tài khoản chờ duyệt"
          value={<Count q={approvals} />}
          hint="Cộng tác viên và doanh nghiệp"
          tone="warning"
          onClick={() => navigate('/admin/approvals?status=UNDER_REVIEW')}
        />
        <StatTile
          label="Tổng người dùng"
          value={<Count q={totalUsers} />}
          hint="Mọi vai trò trên nền tảng"
          tone="info"
          onClick={() => navigate('/admin/users')}
        />
        <StatTile
          label="Tài khoản đang tạm khóa"
          value={<Count q={suspended} />}
          hint="Không đăng nhập được"
          tone="danger"
          onClick={() => navigate('/admin/users?status=SUSPENDED')}
        />
        <StatTile
          label="Sự kiện hôm nay"
          value={<Count q={auditToday} />}
          hint="Ghi nhận từ 00:00"
          tone="info"
          onClick={() =>
            navigate(`/admin/audit-trail?from=${encodeURIComponent(todayStart)}&to=${encodeURIComponent(dayjs().endOf('day').toISOString())}`)
          }
        />
      </section>

      {/* 3. Asymmetric 2/3 Ledger + 1/3 Configuration Rail */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <Surface className="lg:col-span-2 overflow-hidden">
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
  );
};

export default AdminOverviewPage;
