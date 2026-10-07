/**
 * @file AdminOverviewPage.tsx
 * @description Admin · "Việc cần xử lý". The backend has no statistics endpoint, so each card is
 * the `total` of a real list endpoint, and clicking it opens that list already filtered.
 * No charts, no invented numbers.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Skeleton, Typography } from 'antd';
import { AuditOutlined, FileTextOutlined, SafetyCertificateOutlined, StopOutlined } from '@ant-design/icons';
import { adminService } from '@/services/adminService';
import { adminAuditApi, adminUsersApi } from '@/services/api/adminApi';
import { jobsApi } from '@/services/api/jobsApi';
import { AdminPageHeader, adminTokens } from './adminTheme';

interface CardProps {
  title: string;
  hint: string;
  icon: React.ReactNode;
  to: string;
  query: { data?: number; isLoading: boolean; isError: boolean };
  tone: 'warning' | 'danger' | 'info';
}

const TONE_COLOR = { warning: adminTokens.warning, danger: adminTokens.danger, info: adminTokens.info };

const TaskCard: React.FC<CardProps> = ({ title, hint, icon, to, query, tone }) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(to)}
      className="group flex w-full cursor-pointer flex-col gap-3 rounded-xl border border-solid border-slate-200 bg-white p-5 text-left transition-colors duration-200 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <span aria-hidden className="text-lg" style={{ color: TONE_COLOR[tone] }}>
          {icon}
        </span>
      </div>
      {query.isLoading ? (
        <Skeleton.Input active size="large" />
      ) : (
        <span className="text-3xl font-bold tabular-nums text-slate-900">
          {query.isError ? '—' : query.data}
        </span>
      )}
      <span className="text-xs text-slate-600">{query.isError ? 'Không tải được số liệu.' : hint}</span>
      <span className="text-xs font-semibold text-emerald-800 group-hover:underline">Mở danh sách →</span>
    </button>
  );
};

export const AdminOverviewPage: React.FC = () => {
  const todayStart = dayjs().startOf('day').toISOString();
  const pendingApprovals = useQuery({
    queryKey: ['admin-overview', 'approvals'],
    queryFn: async () => (await adminService.getApprovals({ status: 'UNDER_REVIEW', pageSize: 1 })).data.total,
  });
  const pendingJobs = useQuery({
    queryKey: ['admin-overview', 'jobs'],
    queryFn: async () => (await jobsApi.getReviewQueue()).length,
  });
  const suspended = useQuery({
    queryKey: ['admin-overview', 'suspended'],
    queryFn: async () => (await adminUsersApi.list({ status: 'SUSPENDED', page: 1, pageSize: 1 })).total,
  });
  const auditToday = useQuery({
    queryKey: ['admin-overview', 'audit', todayStart],
    queryFn: async () => (await adminAuditApi.list({ fromUtc: todayStart, page: 1, pageSize: 1 })).total,
  });

  return (
    <div>
      <AdminPageHeader
        title="Việc cần xử lý"
        description="Số liệu lấy trực tiếp từ hệ thống. Bấm vào thẻ để mở danh sách tương ứng."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TaskCard
          title="Tài khoản chờ duyệt"
          hint="Cộng tác viên và doanh nghiệp đang chờ phê duyệt."
          icon={<SafetyCertificateOutlined />}
          to="/admin/approvals?status=UNDER_REVIEW"
          query={pendingApprovals}
          tone="warning"
        />
        <TaskCard
          title="Tin tuyển dụng chờ duyệt"
          hint="Tin doanh nghiệp đã gửi, chưa được công bố."
          icon={<FileTextOutlined />}
          to="/admin/jobs"
          query={pendingJobs}
          tone="warning"
        />
        <TaskCard
          title="Tài khoản đang tạm khóa"
          hint="Người dùng không đăng nhập được cho tới khi kích hoạt lại."
          icon={<StopOutlined />}
          to="/admin/users?status=SUSPENDED"
          query={suspended}
          tone="danger"
        />
        <TaskCard
          title="Sự kiện nhật ký hôm nay"
          hint="Thao tác được ghi lại từ 00:00 hôm nay."
          icon={<AuditOutlined />}
          to={`/admin/audit-trail?from=${encodeURIComponent(todayStart)}&to=${encodeURIComponent(dayjs().endOf('day').toISOString())}`}
          query={auditToday}
          tone="info"
        />
      </div>
      <Typography.Paragraph className="mt-6 text-xs" style={{ color: adminTokens.textMuted }}>
        Biểu đồ và báo cáo doanh thu chưa hiển thị vì backend chưa có API thống kê.
      </Typography.Paragraph>
    </div>
  );
};

export default AdminOverviewPage;
