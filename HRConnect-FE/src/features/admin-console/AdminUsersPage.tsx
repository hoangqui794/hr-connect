/**
 * @file AdminUsersPage.tsx
 * @description Admin · platform users (GET /admin/users). Suspend needs a reason (backend rule),
 * reactivate and unlock are separate actions. Platform Admin accounts are read-only here
 * because the backend refuses those mutations.
 */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Avatar,
  Button,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LockOutlined, ReloadOutlined, StopOutlined, UnlockOutlined, UserOutlined } from '@ant-design/icons';
import { adminUsersApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { AdminUserListItem, AdminUserStatus, RoleCode } from '@/types/api/admin';
import { AdminPageHeader, StatusBadge, adminTokens, formatDateTime } from './adminTheme';

const PAGE_SIZE = 20;

export const ROLE_LABEL: Record<RoleCode, string> = {
  CANDIDATE: 'Ứng viên',
  AFFILIATE_RECRUITER: 'Cộng tác viên',
  CLIENT_COMPANY_USER: 'Doanh nghiệp',
  INTERNAL_HR: 'Internal HR',
  PLATFORM_ADMIN: 'Quản trị viên',
};

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'success' },
  PENDING: { label: 'Chờ kích hoạt', tone: 'warning' },
  SUSPENDED: { label: 'Tạm khóa', tone: 'danger' },
  LOCKED: { label: 'Bị khóa', tone: 'danger' },
  REJECTED: { label: 'Bị từ chối', tone: 'neutral' },
};

const UserStatus: React.FC<{ user: Pick<AdminUserListItem, 'status' | 'isLoginLocked'> }> = ({ user }) => (
  <div className="flex flex-wrap gap-1">
    <StatusBadge tone={STATUS[user.status]?.tone ?? 'neutral'}>{STATUS[user.status]?.label ?? user.status}</StatusBadge>
    {user.isLoginLocked && (
      <StatusBadge tone="warning">
        <LockOutlined aria-hidden /> Khóa đăng nhập
      </StatusBadge>
    )}
  </div>
);

const isAdmin = (roles: RoleCode[]) => roles.includes('PLATFORM_ADMIN');

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

  const list = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => adminUsersApi.list(params),
    placeholderData: (prev) => prev,
  });
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
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-user'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
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

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: 'Người dùng',
      key: 'user',
      render: (_, u) => (
        <div className="flex min-w-[240px] items-center gap-3">
          <Avatar size={32} style={{ background: adminTokens.navy }} icon={<UserOutlined />} aria-hidden />
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-900">{u.displayName || '(chưa đặt tên)'}</div>
            <div className="truncate text-xs text-slate-600">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'roles',
      width: 200,
      render: (roles: RoleCode[]) => (
        <div className="flex flex-wrap gap-1">
          {roles.length === 0 ? '—' : roles.map((r) => <Tag key={r} className="m-0">{ROLE_LABEL[r] ?? r}</Tag>)}
        </div>
      ),
    },
    { title: 'Trạng thái', key: 'status', width: 210, render: (_, u) => <UserStatus user={u} /> },
    { title: 'Đăng nhập gần nhất', dataIndex: 'lastLoginAt', width: 170, render: (v: string | null) => <span className="tabular-nums">{formatDateTime(v)}</span> },
    { title: 'Tạo lúc', dataIndex: 'createdAt', width: 150, render: (v: string) => <span className="tabular-nums">{formatDateTime(v)}</span> },
  ];

  const user = detail.data;
  const readOnly = user ? isAdmin(user.roles) : true;
  const page = list.data;

  return (
    <div>
      <AdminPageHeader
        title="Người dùng"
        description="Tra cứu tài khoản, tạm khóa khi vi phạm và mở khóa đăng nhập khi người dùng nhập sai mật khẩu quá số lần."
        actions={
          <Button icon={<ReloadOutlined />} loading={list.isFetching && !list.isLoading} onClick={() => list.refetch()}>
            Tải lại
          </Button>
        }
      />

      <section className="rounded-xl border border-solid border-slate-200 bg-white">
        <div key={searchParams.toString()} className="flex flex-wrap items-center gap-3 border-b border-solid border-slate-100 p-3">
          <Input.Search
            allowClear
            defaultValue={params.search}
            placeholder="Tên hoặc email..."
            className="w-72"
            onSearch={(v) => setParam('q', v.trim() || undefined)}
            aria-label="Tìm người dùng"
          />
          <Select
            allowClear
            value={params.role}
            placeholder="Mọi vai trò"
            className="w-48"
            onChange={(v) => setParam('role', v)}
            options={(Object.keys(ROLE_LABEL) as RoleCode[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            aria-label="Lọc theo vai trò"
          />
          <Select
            allowClear
            value={params.status}
            placeholder="Mọi trạng thái"
            className="w-48"
            onChange={(v) => setParam('status', v)}
            options={Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))}
            aria-label="Lọc theo trạng thái"
          />
          {page && <span className="ml-auto text-sm text-slate-600 tabular-nums">{page.total} tài khoản</span>}
        </div>

        {list.isError ? (
          <div className="p-4">
            <Alert type="error" showIcon message="Không tải được danh sách người dùng" description={getApiErrorMessage(list.error)} />
          </div>
        ) : (
          <Table<AdminUserListItem>
            rowKey="userId"
            loading={list.isLoading}
            columns={columns}
            dataSource={page?.items ?? []}
            scroll={{ x: 980 }}
            locale={{ emptyText: 'Không có tài khoản phù hợp bộ lọc.' }}
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
      </section>

      <Drawer
        open={Boolean(selectedId)}
        width={520}
        onClose={() => setSelectedId(undefined)}
        title="Chi tiết tài khoản"
        destroyOnClose
      >
        {detail.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : detail.isError || !user ? (
          <Alert type="error" showIcon message={getApiErrorMessage(detail.error, 'Không tải được tài khoản.')} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar size={48} src={user.avatarUrl ?? undefined} style={{ background: adminTokens.navy }} icon={<UserOutlined />} />
              <div className="min-w-0">
                <Typography.Title level={5} className="!mb-0 truncate">
                  {user.displayName || '(chưa đặt tên)'}
                </Typography.Title>
                <div className="truncate text-sm text-slate-600">{user.email}</div>
              </div>
            </div>
            <UserStatus user={user} />

            {!readOnly && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-solid border-slate-200 bg-slate-50 p-3">
                {user.status === 'SUSPENDED' ? (
                  <Button
                    type="primary"
                    loading={changeStatus.isPending}
                    onClick={() =>
                      modal.confirm({
                        title: 'Kích hoạt lại tài khoản?',
                        content: `${user.email} sẽ đăng nhập và sử dụng nền tảng bình thường trở lại.`,
                        okText: 'Kích hoạt lại',
                        cancelText: 'Hủy',
                        onOk: () => changeStatus.mutateAsync({ status: 'ACTIVE' }),
                      })
                    }
                  >
                    Kích hoạt lại
                  </Button>
                ) : (
                  user.status === 'ACTIVE' && (
                    <Button danger icon={<StopOutlined />} onClick={() => setSuspendOpen(true)}>
                      Tạm khóa tài khoản
                    </Button>
                  )
                )}
                <Button
                  icon={<UnlockOutlined />}
                  loading={unlock.isPending}
                  disabled={!user.isLoginLocked && user.failedLoginAttempts === 0}
                  onClick={() => unlock.mutate()}
                >
                  Mở khóa đăng nhập
                </Button>
              </div>
            )}
            {readOnly && (
              <Alert type="info" showIcon message="Tài khoản Quản trị viên chỉ xem, không thao tác được ở trang này." />
            )}

            <Descriptions size="small" column={1} labelStyle={{ width: 170, color: adminTokens.textMuted }}>
              <Descriptions.Item label="Vai trò">
                {user.roles.map((r) => ROLE_LABEL[r] ?? r).join(', ') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Điện thoại">{user.phone ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Email đã xác thực">{user.isEmailVerified ? 'Đã xác thực' : 'Chưa xác thực'}</Descriptions.Item>
              <Descriptions.Item label="Đăng nhập sai liên tiếp">
                <span className="tabular-nums">{user.failedLoginAttempts} lần</span>
              </Descriptions.Item>
              <Descriptions.Item label="Khóa đăng nhập đến">{formatDateTime(user.lockoutEndAt)}</Descriptions.Item>
              <Descriptions.Item label="Đăng nhập gần nhất">{formatDateTime(user.lastLoginAt)}</Descriptions.Item>
              <Descriptions.Item label="Tạo lúc">{formatDateTime(user.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Mã người dùng">
                <code style={{ fontFamily: adminTokens.mono }} className="break-all text-xs">{user.userId}</code>
              </Descriptions.Item>
            </Descriptions>
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
        <Typography.Paragraph style={{ color: adminTokens.textMuted }}>
          Mọi phiên đăng nhập của người dùng bị thu hồi (phiên đang mở hết hiệu lực khi token hết hạn) và họ
          không đăng nhập được cho tới khi bạn kích hoạt lại.
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
