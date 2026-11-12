/**
 * @file AdminUsersPage.tsx
 * @description Admin · Platform Users & RBAC Authorization (/admin/users).
 * Soft-UI layout adhering to Vercel & Anthropic guidelines:
 * - Real-time KPI summary stats
 * - Fluid table with clear typography, roles, status, and last activity
 * - 2-in-1 Drawer: Account management + Complete RBAC Authorization (assign/revoke roles & inspect effective permissions)
 */

import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  KeyOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UnlockOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  CheckSquareOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { adminUsersApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AdminUserListItem, AdminUserStatus, RoleCode } from '@/types/api/admin';
import { adminTokens, formatDateTime } from './adminTheme';
import { Initials, PageHero, PersonCell, StatusDot, Surface, type Tone } from './ui';
import { UserAuthorizationTab } from './UserAuthorizationTab';

const PAGE_SIZE = 20;

export const ROLE_LABEL: Record<RoleCode, string> = {
  CANDIDATE: 'Ứng viên',
  AFFILIATE: 'Cộng tác viên',
  CLIENT_COMPANY_USER: 'Doanh nghiệp',
  INTERNAL_HR: 'Internal HR',
  PLATFORM_ADMIN: 'Quản trị viên',
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'success' },
  PENDING: { label: 'Chờ kích hoạt', tone: 'warning' },
  SUSPENDED: { label: 'Tạm khóa', tone: 'danger' },
  LOCKED: { label: 'Bị khóa', tone: 'danger' },
  REJECTED: { label: 'Bị từ chối', tone: 'neutral' },
};

const ROLE_BADGE_STYLES: Partial<Record<RoleCode, string>> = {
  PLATFORM_ADMIN: 'bg-purple-50 text-purple-700 border border-purple-200/80',
  CLIENT_COMPANY_USER: 'bg-blue-50 text-blue-700 border border-blue-200/80',
  AFFILIATE: 'bg-amber-50 text-amber-700 border border-amber-200/80',
  CANDIDATE: 'bg-slate-100 text-slate-700 border border-slate-200/80',
  INTERNAL_HR: 'bg-sky-50 text-sky-700 border border-sky-200/80',
};

const RoleChips: React.FC<{ roles: RoleCode[] }> = ({ roles }) => (
  <div className="flex flex-wrap gap-1.5">
    {roles.length === 0
      ? '—'
      : roles.map((r) => (
          <span
            key={r}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              ROLE_BADGE_STYLES[r] ?? 'bg-slate-100 text-slate-700 border border-slate-200/80'
            }`}
          >
            {ROLE_LABEL[r] ?? r}
          </span>
        ))}
  </div>
);

const UserState: React.FC<{ user: Pick<AdminUserListItem, 'status' | 'isLoginLocked'> }> = ({ user }) => (
  <div className="flex flex-col gap-1">
    <StatusDot tone={STATUS[user.status]?.tone ?? 'neutral'}>
      {STATUS[user.status]?.label ?? user.status}
    </StatusDot>
    {user.isLoginLocked && (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
        <LockOutlined aria-hidden /> Khóa đăng nhập
      </span>
    )}
  </div>
);

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-0 border-t border-solid border-slate-100 py-2.5 first:border-t-0">
    <span className="text-[13px] text-slate-500">{label}</span>
    <span className="text-right text-[13.5px] font-medium text-slate-900">{children}</span>
  </div>
);

/** Total accounts for a status (pageSize 1, read `total`). */
const useUserCount = (status?: AdminUserStatus) =>
  useQuery({
    queryKey: ['admin-users-count', status ?? 'ALL'],
    queryFn: async () => (await adminUsersApi.list({ status, page: 1, pageSize: 1 })).total,
  });

export const AdminUsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected user and active drawer tab ('info' | 'rbac')
  const [selectedId, setSelectedId] = useState<string | undefined>(searchParams.get('userId') || undefined);
  const [drawerTab, setDrawerTab] = useState<'info' | 'rbac'>('info');
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();

  const params = {
    search: searchParams.get('q') ?? undefined,
    status: (searchParams.get('status') as AdminUserStatus | null) ?? undefined,
    role: (searchParams.get('role') as RoleCode | null) ?? undefined,
    page: Number(searchParams.get('page')) || 1,
    pageSize: PAGE_SIZE,
  };

  const list = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => adminUsersApi.list(params),
    placeholderData: (p) => p,
  });

  const totalAll = useUserCount();
  const totalActive = useUserCount('ACTIVE');
  const totalPending = useUserCount('PENDING');
  const totalSuspended = useUserCount('SUSPENDED');

  const detail = useQuery({
    queryKey: ['admin-user', selectedId],
    queryFn: () => adminUsersApi.get(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const setParam = (key: string, value?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const refresh = () => {
    ['admin-users', 'admin-user', 'admin-users-count', 'admin-overview'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const changeStatus = useMutation({
    mutationFn: (v: { status: 'ACTIVE' | 'SUSPENDED'; reason?: string }) =>
      adminUsersApi.changeStatus(selectedId as string, v.status, v.reason),
    onSuccess: (res) => {
      message.success(res.message ?? 'Đã cập nhật trạng thái.');
      setSuspendOpen(false);
      refresh();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const unlock = useMutation({
    mutationFn: () => adminUsersApi.unlock(selectedId as string),
    onSuccess: (res) => {
      message.success(res.message ?? 'Đã mở khóa đăng nhập.');
      refresh();
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const openUserDrawer = (userId: string, tab: 'info' | 'rbac' = 'info') => {
    setSelectedId(userId);
    setDrawerTab(tab);
  };

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, u) => (
        <PersonCell
          name={u.displayName || u.email}
          secondary={u.displayName ? u.email : `Tạo lúc ${formatDateTime(u.createdAt)}`}
        />
      ),
    },
    {
      title: 'Vai trò & Chức vụ',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: RoleCode[]) => <RoleChips roles={roles} />,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_, u) => <UserState user={u} />,
    },
    {
      title: 'Hoạt động gần nhất',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 170,
      render: (v: string | null) => (
        <span className="tabular-nums text-xs text-slate-600">
          {v ? formatDateTime(v) : 'Chưa đăng nhập'}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, u) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openUserDrawer(u.userId, 'info');
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-solid border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span>Tài khoản</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openUserDrawer(u.userId, 'rbac');
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-solid border-sky-200 bg-sky-50 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors cursor-pointer"
          >
            <KeyOutlined className="text-xs text-sky-600" />
            <span>Phân quyền</span>
          </button>
        </div>
      ),
    },
  ];

  const user = detail.data;
  const readOnly = user ? user.roles.includes('PLATFORM_ADMIN') : true;
  const page = list.data;
  const v = (q: { data?: number; isLoading: boolean }) => (q.isLoading ? '…' : q.data ?? '—');

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Vận hành"
        title="Quản lý Người dùng & Phân quyền"
        description="Tra cứu tài khoản người dùng, quản trị trạng thái hoạt động và cấu hình phân quyền vai trò (RBAC) trực tiếp."
        actions={
          <Button
            icon={<ReloadOutlined spin={list.isFetching && !list.isLoading} />}
            loading={list.isFetching && !list.isLoading}
            onClick={() => list.refetch()}
            className="rounded-lg font-medium"
          >
            Làm mới
          </Button>
        }
      />

      {/* ── KPI Tiles ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Card: Tất cả tài khoản */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setParam('status', undefined)}
          onKeyDown={(e) => e.key === 'Enter' && setParam('status', undefined)}
          className={`cursor-pointer select-none rounded-xl border border-solid p-4 transition-all duration-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
            !params.status
              ? 'border-2 border-[#0284C7] bg-sky-50/50 text-sky-950 ring-2 ring-[#0284C7]/20 shadow-sm'
              : 'border-slate-200/90 bg-white text-slate-900 hover:border-sky-300 hover:bg-slate-50/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                !params.status ? 'text-[#0369A1]' : 'text-slate-500'
              }`}
            >
              Tất cả tài khoản
            </span>
            <div className="flex items-center gap-1.5">
              {!params.status && (
                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-sky-700">
                  Đang lọc
                </span>
              )}
              <InboxOutlined className={`text-base ${!params.status ? 'text-[#0284C7]' : 'text-slate-400'}`} />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-extrabold tabular-nums ${!params.status ? 'text-[#0284C7]' : 'text-slate-900'}`}>
            {v(totalAll)}
          </div>
        </div>

        {/* Card: Đang hoạt động */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setParam('status', 'ACTIVE')}
          onKeyDown={(e) => e.key === 'Enter' && setParam('status', 'ACTIVE')}
          className={`cursor-pointer select-none rounded-xl border border-solid p-4 transition-all duration-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
            params.status === 'ACTIVE'
              ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-emerald-200 bg-emerald-50/40 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                params.status === 'ACTIVE' ? 'text-emerald-900 font-bold' : 'text-emerald-700'
              }`}
            >
              Đang hoạt động
            </span>
            <div className="flex items-center gap-1.5">
              {params.status === 'ACTIVE' && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                  Đang lọc
                </span>
              )}
              <CheckCircleOutlined className={`text-base ${params.status === 'ACTIVE' ? 'text-emerald-700' : 'text-emerald-600'}`} />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-extrabold tabular-nums ${params.status === 'ACTIVE' ? 'text-emerald-700' : 'text-emerald-800'}`}>
            {v(totalActive)}
          </div>
        </div>

        {/* Card: Chờ kích hoạt */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setParam('status', 'PENDING')}
          onKeyDown={(e) => e.key === 'Enter' && setParam('status', 'PENDING')}
          className={`cursor-pointer select-none rounded-xl border border-solid p-4 transition-all duration-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
            params.status === 'PENDING'
              ? 'border-2 border-amber-500 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500/20 shadow-sm'
              : 'border-amber-200 bg-amber-50/40 text-amber-800 hover:border-amber-300 hover:bg-amber-50/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                params.status === 'PENDING' ? 'text-amber-900 font-bold' : 'text-amber-700'
              }`}
            >
              Chờ kích hoạt
            </span>
            <div className="flex items-center gap-1.5">
              {params.status === 'PENDING' && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-800">
                  Đang lọc
                </span>
              )}
              <ThunderboltOutlined className={`text-base ${params.status === 'PENDING' ? 'text-amber-700' : 'text-amber-600'}`} />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-extrabold tabular-nums ${params.status === 'PENDING' ? 'text-amber-700' : 'text-amber-800'}`}>
            {v(totalPending)}
          </div>
        </div>

        {/* Card: Tạm khóa */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setParam('status', 'SUSPENDED')}
          onKeyDown={(e) => e.key === 'Enter' && setParam('status', 'SUSPENDED')}
          className={`cursor-pointer select-none rounded-xl border border-solid p-4 transition-all duration-200 shadow-xs hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] ${
            params.status === 'SUSPENDED'
              ? 'border-2 border-rose-500 bg-rose-50/80 text-rose-950 ring-2 ring-rose-500/20 shadow-sm'
              : 'border-rose-200 bg-rose-50/40 text-rose-800 hover:border-rose-300 hover:bg-rose-50/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                params.status === 'SUSPENDED' ? 'text-rose-900 font-bold' : 'text-rose-700'
              }`}
            >
              Tạm khóa
            </span>
            <div className="flex items-center gap-1.5">
              {params.status === 'SUSPENDED' && (
                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-rose-800">
                  Đang lọc
                </span>
              )}
              <StopOutlined className={`text-base ${params.status === 'SUSPENDED' ? 'text-rose-700' : 'text-rose-600'}`} />
            </div>
          </div>
          <div className={`mt-2 text-2xl font-extrabold tabular-nums ${params.status === 'SUSPENDED' ? 'text-rose-700' : 'text-rose-800'}`}>
            {v(totalSuspended)}
          </div>
        </div>
      </div>

      {/* ── Table Surface ────────────────────────────────────────────────── */}
      <Surface padded className="space-y-4">
        <div key={searchParams.toString()} className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
            <div className="w-full sm:w-72">
              <Input
                allowClear
                defaultValue={params.search}
                prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
                placeholder="Tìm theo tên hoặc email, nhấn Enter"
                className="rounded-lg h-9"
                onPressEnter={(e) => setParam('q', e.currentTarget.value.trim() || undefined)}
                onChange={(e) => !e.target.value && params.search && setParam('q', undefined)}
                aria-label="Tìm người dùng"
              />
            </div>
            <Select
              allowClear
              value={params.role}
              placeholder="Mọi vai trò"
              className="w-48 h-9"
              onChange={(val) => setParam('role', val)}
              options={(Object.keys(ROLE_LABEL) as RoleCode[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
              aria-label="Lọc theo vai trò"
            />
          </div>
          {page && (
            <span className="text-xs text-slate-500 tabular-nums">
              Hiển thị {page.items.length} / {page.total} tài khoản
            </span>
          )}
        </div>

        {list.isError ? (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message="Không tải được danh sách người dùng"
              description={getApiErrorMessage(list.error)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table<AdminUserListItem>
              className="admin-soft-table w-full [&_.ant-table-thead>tr>th]:!bg-slate-50/80 [&_.ant-table-thead>tr>th]:!text-[12px] [&_.ant-table-thead>tr>th]:!font-bold [&_.ant-table-thead>tr>th]:!text-slate-600"
              rowKey="userId"
              loading={list.isLoading}
              columns={columns}
              dataSource={page?.items ?? []}
              locale={{ emptyText: <div className="py-10 text-slate-500">Không có tài khoản phù hợp bộ lọc.</div> }}
              onRow={(u) => ({
                onClick: () => openUserDrawer(u.userId, 'info'),
                className: 'cursor-pointer hover:bg-slate-50/80 transition-colors',
              })}
              pagination={{
                current: page?.page ?? params.page,
                pageSize: PAGE_SIZE,
                total: page?.total ?? 0,
                showSizeChanger: false,
                hideOnSinglePage: true,
                onChange: (p) => setParam('page', String(p)),
              }}
            />
          </div>
        )}
      </Surface>

      {/* ── User & RBAC Drawer ───────────────────────────────────────────── */}
      <Drawer
        open={Boolean(selectedId)}
        width="min(680px, 100vw)"
        onClose={() => setSelectedId(undefined)}
        title={
          user ? (
            <div className="flex items-center gap-3">
              <Initials name={user.displayName || user.email} size={36} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-sm truncate">{user.displayName || user.email}</div>
                <div className="text-xs text-slate-500 truncate">{user.email}</div>
              </div>
            </div>
          ) : (
            'Chi tiết tài khoản'
          )
        }
        closable
        destroyOnHidden
      >
        {detail.isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton active avatar paragraph={{ rows: 8 }} />
          </div>
        ) : detail.isError || !user ? (
          <div className="p-4">
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(detail.error, 'Không tải được tài khoản.')}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Drawer Tabs: Info vs Authorization */}
            <Tabs
              activeKey={drawerTab}
              onChange={(key) => setDrawerTab(key as 'info' | 'rbac')}
              className="user-detail-tabs"
              items={[
                {
                  key: 'info',
                  label: (
                    <span className="flex items-center gap-2 font-medium">
                      <UserOutlined />
                      <span>Thông tin tài khoản</span>
                    </span>
                  ),
                  children: (
                    <div className="space-y-4 pt-1">
                      {/* Status and roles header */}
                      <div className="rounded-xl border border-solid border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</span>
                            <div className="mt-1">
                              <UserState user={user} />
                            </div>
                          </div>
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vai trò</span>
                            <div className="mt-1">
                              <RoleChips roles={user.roles} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {readOnly ? (
                        <Alert
                          type="info"
                          showIcon
                          message="Tài khoản Quản trị viên chỉ xem, không chỉnh sửa trạng thái ở đây."
                          className="rounded-xl"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2.5 p-3 rounded-xl border border-solid border-slate-200 bg-white shadow-2xs">
                          {user.status === 'SUSPENDED' ? (
                            <Button
                              type="primary"
                              block
                              loading={changeStatus.isPending}
                              onClick={() =>
                                modal.confirm({
                                  title: 'Kích hoạt lại tài khoản?',
                                  content: `${user.email} sẽ đăng nhập và dùng nền tảng bình thường trở lại.`,
                                  okText: 'Kích hoạt lại',
                                  cancelText: 'Hủy',
                                  onOk: () => changeStatus.mutateAsync({ status: 'ACTIVE' }),
                                })
                              }
                              className="bg-emerald-600 hover:bg-emerald-700 font-semibold h-9"
                            >
                              Kích hoạt lại tài khoản
                            </Button>
                          ) : (
                            user.status === 'ACTIVE' && (
                              <Button
                                danger
                                className="flex-1 h-9 font-medium"
                                icon={<StopOutlined />}
                                onClick={() => setSuspendOpen(true)}
                              >
                                Tạm khóa
                              </Button>
                            )
                          )}
                          <Button
                            className="flex-1 h-9 font-medium"
                            icon={<UnlockOutlined />}
                            loading={unlock.isPending}
                            disabled={!user.isLoginLocked && user.failedLoginAttempts === 0}
                            onClick={() => unlock.mutate()}
                          >
                            Mở khóa đăng nhập
                          </Button>
                        </div>
                      )}

                      {/* Details specs */}
                      <div className="rounded-xl border border-solid border-slate-200 bg-white px-4 py-1 shadow-2xs">
                        <InfoRow label="Số điện thoại">{user.phone ?? '—'}</InfoRow>
                        <InfoRow label="Email">
                          {user.isEmailVerified ? (
                            <span className="text-emerald-700 font-semibold">Đã xác thực</span>
                          ) : (
                            <span className="text-amber-700 font-medium">Chưa xác thực</span>
                          )}
                        </InfoRow>
                        <InfoRow label="Đăng nhập sai liên tiếp">
                          <span className="tabular-nums font-semibold text-slate-800">{user.failedLoginAttempts} lần</span>
                        </InfoRow>
                        <InfoRow label="Khóa đăng nhập đến">{formatDateTime(user.lockoutEndAt)}</InfoRow>
                        <InfoRow label="Đăng nhập gần nhất">{formatDateTime(user.lastLoginAt)}</InfoRow>
                        <InfoRow label="Ngày tạo tài khoản">{formatDateTime(user.createdAt)}</InfoRow>
                        <InfoRow label="Mã người dùng (User ID)">
                          <code className="text-xs text-slate-700 font-mono select-all bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                            {user.userId}
                          </code>
                        </InfoRow>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'rbac',
                  label: (
                    <span className="flex items-center gap-2 font-medium">
                      <KeyOutlined />
                      <span>Phân quyền & Vai trò</span>
                    </span>
                  ),
                  children: (
                    <div className="pt-1">
                      <UserAuthorizationTab userId={user.userId} userEmail={user.email} />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>

      {/* ── Suspend Modal ────────────────────────────────────────────────── */}
      <Modal
        open={suspendOpen}
        title={<span className="text-base font-bold text-slate-900">Tạm khóa tài khoản người dùng</span>}
        okText="Xác nhận tạm khóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: changeStatus.isPending }}
        onCancel={() => setSuspendOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
        centered
      >
        <p className="text-xs text-slate-500 leading-relaxed">
          Mọi phiên đăng nhập hiện tại của người dùng sẽ bị thu hồi và tài khoản không thể truy cập hệ thống cho đến khi được kích hoạt lại.
        </p>
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={({ reason }) => changeStatus.mutate({ status: 'SUSPENDED', reason: reason.trim() })}
          className="mt-3"
        >
          <Form.Item
            name="reason"
            label={<span className="text-xs font-semibold text-slate-700">Lý do tạm khóa (Bắt buộc)</span>}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do tạm khóa tài khoản!' },
              { max: 500, message: 'Tối đa 500 ký tự!' },
            ]}
          >
            <Input.TextArea rows={4} showCount maxLength={500} placeholder="Nhập lý do vi phạm hoặc yêu cầu tạm ngưng dịch vụ..." className="rounded-lg" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
