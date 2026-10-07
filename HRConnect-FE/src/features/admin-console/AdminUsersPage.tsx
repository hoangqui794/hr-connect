/**
 * @file AdminUsersPage.tsx
 * @description Admin · platform users (GET /admin/users), soft-UI layout. Status tiles are real
 * totals and act as filters. Suspend needs a reason (backend rule); reactivate and unlock are
 * separate actions; Platform Admin accounts are read-only because the backend refuses them.
 */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App as AntApp, Button, Drawer, Form, Input, Modal, Select, Skeleton, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LockOutlined, ReloadOutlined, SearchOutlined, StopOutlined, UnlockOutlined } from '@ant-design/icons';
import { adminUsersApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AdminUserListItem, AdminUserStatus, RoleCode } from '@/types/api/admin';
import { adminTokens, formatDateTime } from './adminTheme';
import { Initials, PageHero, PersonCell, StatTile, StatusDot, Surface, type Tone } from './ui';

const PAGE_SIZE = 20;

export const ROLE_LABEL: Record<RoleCode, string> = {
  CANDIDATE: 'Ứng viên',
  AFFILIATE_RECRUITER: 'Cộng tác viên',
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

const RoleChips: React.FC<{ roles: RoleCode[] }> = ({ roles }) => (
  <div className="flex flex-wrap gap-1">
    {roles.length === 0
      ? '—'
      : roles.map((r) => (
          <span key={r} className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-medium text-slate-700">
            {ROLE_LABEL[r] ?? r}
          </span>
        ))}
  </div>
);

const UserState: React.FC<{ user: Pick<AdminUserListItem, 'status' | 'isLoginLocked'> }> = ({ user }) => (
  <div className="flex flex-col gap-1">
    <StatusDot tone={STATUS[user.status]?.tone ?? 'neutral'}>{STATUS[user.status]?.label ?? user.status}</StatusDot>
    {user.isLoginLocked && (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-800">
        <LockOutlined aria-hidden /> Khóa đăng nhập
      </span>
    )}
  </div>
);

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-0 border-t border-solid border-slate-100 py-2.5 first:border-t-0">
    <span className="text-[13px] text-slate-600">{label}</span>
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
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>();
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [form] = Form.useForm<{ reason: string }>();

  const params = {
    search: searchParams.get('q') ?? undefined,
    status: (searchParams.get('status') as AdminUserStatus | null) ?? undefined,
    role: (searchParams.get('role') as RoleCode | null) ?? undefined,
    page: Number(searchParams.get('page')) || 1,
    pageSize: PAGE_SIZE,
  };

  const list = useQuery({ queryKey: ['admin-users', params], queryFn: () => adminUsersApi.list(params), placeholderData: (p) => p });
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
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const refresh = () => {
    ['admin-users', 'admin-user', 'admin-users-count', 'admin-overview'].forEach((k) =>
      queryClient.invalidateQueries({ queryKey: [k] })
    );
  };

  const changeStatus = useMutation({
    mutationFn: (v: { status: 'ACTIVE' | 'SUSPENDED'; reason?: string }) => adminUsersApi.changeStatus(selectedId as string, v.status, v.reason),
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

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, u) => (
        <div className="min-w-[260px]">
          <PersonCell name={u.displayName || u.email} secondary={u.displayName ? u.email : null} />
        </div>
      ),
    },
    { title: 'Vai trò', dataIndex: 'roles', width: 200, render: (roles: RoleCode[]) => <RoleChips roles={roles} /> },
    { title: 'Trạng thái', key: 'status', width: 170, render: (_, u) => <UserState user={u} /> },
    {
      title: 'Hoạt động gần nhất',
      dataIndex: 'lastLoginAt',
      width: 170,
      render: (v: string | null) => <span className="tabular-nums text-slate-700">{v ? formatDateTime(v) : 'Chưa đăng nhập'}</span>,
    },
  ];

  const user = detail.data;
  const readOnly = user ? user.roles.includes('PLATFORM_ADMIN') : true;
  const page = list.data;
  const v = (q: { data?: number; isLoading: boolean }) => (q.isLoading ? '…' : q.data ?? '—');

  return (
    <div>
      <PageHero
        eyebrow="Vận hành"
        title="Người dùng"
        description="Tra cứu tài khoản, tạm khóa khi vi phạm và mở khóa đăng nhập cho người nhập sai mật khẩu quá số lần."
        actions={
          <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tất cả tài khoản" value={v(totalAll)} tone="neutral" active={!params.status} onClick={() => setParam('status', undefined)} />
        <StatTile label="Đang hoạt động" value={v(totalActive)} tone="success" active={params.status === 'ACTIVE'} onClick={() => setParam('status', 'ACTIVE')} />
        <StatTile label="Chờ kích hoạt" value={v(totalPending)} tone="warning" active={params.status === 'PENDING'} onClick={() => setParam('status', 'PENDING')} />
        <StatTile label="Tạm khóa" value={v(totalSuspended)} tone="danger" active={params.status === 'SUSPENDED'} onClick={() => setParam('status', 'SUSPENDED')} />
      </div>

      <Surface>
        <div key={searchParams.toString()} className="flex flex-wrap items-center gap-3 px-5 pb-2 pt-5">
          <Input
            allowClear
            size="large"
            defaultValue={params.search}
            prefix={<SearchOutlined className="text-slate-500" aria-hidden />}
            placeholder="Tìm theo tên hoặc email, nhấn Enter"
            className="max-w-sm"
            onPressEnter={(e) => setParam('q', e.currentTarget.value.trim() || undefined)}
            onChange={(e) => !e.target.value && params.search && setParam('q', undefined)}
            aria-label="Tìm người dùng"
          />
          <Select
            allowClear
            size="large"
            value={params.role}
            placeholder="Mọi vai trò"
            className="w-52"
            onChange={(val) => setParam('role', val)}
            options={(Object.keys(ROLE_LABEL) as RoleCode[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            aria-label="Lọc theo vai trò"
          />
          {page && <span className="ml-auto text-sm tabular-nums text-slate-600">{page.total} kết quả</span>}
        </div>

        {list.isError ? (
          <div className="p-5">
            <Alert type="error" showIcon message="Không tải được danh sách người dùng" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<AdminUserListItem>
            className="admin-soft-table"
            rowKey="userId"
            loading={list.isLoading}
            columns={columns}
            dataSource={page?.items ?? []}
            scroll={{ x: 820 }}
            locale={{ emptyText: <div className="py-10 text-slate-600">Không có tài khoản phù hợp bộ lọc.</div> }}
            onRow={(u) => ({
              onClick: () => setSelectedId(u.userId),
              onKeyDown: (e) => {
                if (e.key === 'Enter') setSelectedId(u.userId);
              },
              tabIndex: 0,
              className: 'cursor-pointer',
              'aria-label': `Mở tài khoản ${u.email}`,
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
        )}
      </Surface>

      <Drawer
        open={Boolean(selectedId)}
        width={480}
        onClose={() => setSelectedId(undefined)}
        title={null}
        closable
        destroyOnClose
        styles={{ body: { padding: 0, background: '#F4F6FA' } }}
      >
        {detail.isLoading ? (
          <div className="p-6">
            <Skeleton active avatar paragraph={{ rows: 8 }} />
          </div>
        ) : detail.isError || !user ? (
          <div className="p-6">
            <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được tài khoản.')} />
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <div className="admin-surface flex flex-col items-center gap-3 p-6 text-center">
              <Initials name={user.displayName || user.email} size={64} />
              <div>
                <Typography.Title level={4} className="!mb-0">
                  {user.displayName || '(chưa đặt tên)'}
                </Typography.Title>
                <div className="text-sm text-slate-600">{user.email}</div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <UserState user={user} />
                <RoleChips roles={user.roles} />
              </div>
            </div>

            {readOnly ? (
              <Alert type="info" showIcon message="Tài khoản Quản trị viên chỉ xem, không thao tác được ở đây." />
            ) : (
              <div className="admin-surface flex flex-wrap gap-2 p-4">
                {user.status === 'SUSPENDED' ? (
                  <Button
                    type="primary"
                    size="large"
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
                  >
                    Kích hoạt lại tài khoản
                  </Button>
                ) : (
                  user.status === 'ACTIVE' && (
                    <Button danger size="large" className="flex-1" icon={<StopOutlined />} onClick={() => setSuspendOpen(true)}>
                      Tạm khóa
                    </Button>
                  )
                )}
                <Button
                  size="large"
                  className="flex-1"
                  icon={<UnlockOutlined />}
                  loading={unlock.isPending}
                  disabled={!user.isLoginLocked && user.failedLoginAttempts === 0}
                  onClick={() => unlock.mutate()}
                >
                  Mở khóa đăng nhập
                </Button>
              </div>
            )}

            <div className="admin-surface px-5 py-2">
              <InfoRow label="Điện thoại">{user.phone ?? '—'}</InfoRow>
              <InfoRow label="Email">{user.isEmailVerified ? 'Đã xác thực' : 'Chưa xác thực'}</InfoRow>
              <InfoRow label="Đăng nhập sai liên tiếp">
                <span className="tabular-nums">{user.failedLoginAttempts} lần</span>
              </InfoRow>
              <InfoRow label="Khóa đăng nhập đến">{formatDateTime(user.lockoutEndAt)}</InfoRow>
              <InfoRow label="Đăng nhập gần nhất">{formatDateTime(user.lastLoginAt)}</InfoRow>
              <InfoRow label="Tạo lúc">{formatDateTime(user.createdAt)}</InfoRow>
              <InfoRow label="Mã người dùng">
                <code style={{ fontFamily: adminTokens.mono }} className="break-all text-xs font-normal text-slate-700">
                  {user.userId}
                </code>
              </InfoRow>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={suspendOpen}
        title="Tạm khóa tài khoản"
        okText="Tạm khóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: changeStatus.isPending }}
        onCancel={() => setSuspendOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Typography.Paragraph className="text-slate-600">
          Mọi phiên đăng nhập của người dùng bị thu hồi (phiên đang mở hết hiệu lực khi token hết hạn) và họ không đăng
          nhập được cho tới khi bạn kích hoạt lại.
        </Typography.Paragraph>
        <Form form={form} layout="vertical" preserve={false} onFinish={({ reason }) => changeStatus.mutate({ status: 'SUSPENDED', reason: reason.trim() })}>
          <Form.Item
            name="reason"
            label="Lý do tạm khóa"
            rules={[
              { required: true, whitespace: true, message: 'Nhập lý do tạm khóa.' },
              { max: 500, message: 'Tối đa 500 ký tự.' },
            ]}
          >
            <Input.TextArea rows={4} showCount maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
