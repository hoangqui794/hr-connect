/**
 * @file AdminOverviewPage.tsx
 * @description Admin · "Việc cần xử lý" as a bento grid. Every number is a real API total
 * (no statistics endpoint exists, so no charts). "Hoạt động gần đây" is the latest audit log.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Button, Skeleton } from 'antd';
import { ArrowRightOutlined, AppstoreOutlined, DollarOutlined } from '@ant-design/icons';
import { adminService } from '@/services/adminService';
import { adminAuditApi, adminCommissionApi, adminServiceTypesApi, adminUsersApi } from '@/services/api/adminApi';
import { useAuthStore } from '@/stores/authStore';
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

const Count: React.FC<{ q: { data?: number; isLoading: boolean; isError: boolean } }> = ({ q }) =>
  q.isLoading ? <Skeleton.Input active size="small" /> : <>{q.isError ? '—' : q.data}</>;

export const AdminOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
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
  const firstName = (user?.name || 'bạn').trim().split(/\s+/).slice(-1)[0];

  return (
    <div className="grid gap-5 lg:grid-cols-4">
      {/* Hero (2 cols) */}
      <Surface className="relative overflow-hidden p-7 lg:col-span-2">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(4,120,87,0.12), transparent 70%)' }}
        />
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-800">
          {dayjs().format('dddd, DD/MM/YYYY')}
        </div>
        <h1 className="m-0 mt-2 text-[28px] font-bold leading-tight tracking-[-0.01em] text-slate-900">Chào {firstName},</h1>
        <p className="m-0 mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
          {loadingSummary
            ? 'Đang tổng hợp việc cần làm...'
            : waiting === 0
              ? 'Không có tài khoản nào đang chờ duyệt. Mọi đăng ký đã được xử lý.'
              : `Có ${waiting} tài khoản đang chờ bạn duyệt.`}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="primary" size="large" onClick={() => navigate('/admin/approvals?status=UNDER_REVIEW')}>
            Duyệt tài khoản
          </Button>
          <Button size="large" onClick={() => navigate('/admin/users')}>
            Quản lý người dùng
          </Button>
        </div>
      </Surface>

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

      {/* Recent activity (2 cols, 2 rows) */}
      <Surface className="p-6 lg:col-span-2 lg:row-span-2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-base font-semibold text-slate-900">Hoạt động gần đây</h2>
          <Button type="link" className="!px-0" onClick={() => navigate('/admin/audit-trail')}>
            Xem nhật ký <ArrowRightOutlined />
          </Button>
        </div>
        {recent.isLoading ? (
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        ) : recent.isError ? (
          <p className="m-0 text-sm text-slate-600">Không tải được nhật ký.</p>
        ) : (recent.data ?? []).length === 0 ? (
          <p className="m-0 text-sm text-slate-600">Chưa có hoạt động nào.</p>
        ) : (
          <ol className="m-0 list-none space-y-1 p-0">
            {recent.data!.map((log) => {
              const actor = log.actorDisplayName || log.actorEmail || (log.actorType === 'SERVICE' ? 'Dịch vụ AI' : 'Hệ thống');
              return (
                <li key={log.auditLogId}>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/audit-trail?action=${encodeURIComponent(log.action)}`)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-2 py-2.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  >
                    <Initials name={actor} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-slate-900">
                        <b className="font-semibold">{actor}</b> {describeAuditAction(log.action)}
                      </span>
                      <span className="block truncate text-xs text-slate-600">{log.entityType ?? log.source}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-600">{relativeTime(log.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </Surface>

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

      {/* Configuration shortcuts (2 cols) */}
      <Surface className="p-6 lg:col-span-2">
        <h2 className="m-0 mb-4 text-base font-semibold text-slate-900">Cấu hình nền tảng</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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
          ].map((c) => (
            <button
              key={c.to}
              type="button"
              onClick={() => navigate(c.to)}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-solid border-slate-200 bg-white p-4 text-left transition-colors hover:border-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg text-emerald-800" aria-hidden>
                {c.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">{c.title}</span>
                <span className="block text-xs text-slate-600">{c.value}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="m-0 mt-4 text-xs text-slate-600">Biểu đồ và báo cáo chưa hiển thị vì backend chưa có API thống kê.</p>
      </Surface>
    </div>
  );
};

export default AdminOverviewPage;
