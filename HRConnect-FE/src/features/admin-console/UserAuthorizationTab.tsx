/**
 * @file UserAuthorizationTab.tsx
 * @description RBAC User Authorization tab embedded directly in Admin Users drawer.
 * Allows platform admins to inspect effective permissions, assign custom roles, and revoke roles with required reasons.
 */

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { isRbacConflict, isSelfRoleMutationForbidden, rbacApi } from '@/services/api/rbacApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  RbacEffectivePermission,
  RbacRole,
  RbacUserAuthorization,
  RbacUserRoleAssignment,
} from '@/types/api/rbac';
import { formatDateTime } from './adminTheme';

interface UserAuthorizationTabProps {
  userId: string;
  userEmail: string;
}

export const UserAuthorizationTab: React.FC<UserAuthorizationTabProps> = ({ userId, userEmail }) => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm] = Form.useForm<{ roleId: string; reason: string }>();

  const [revokeRole, setRevokeRole] = useState<RbacUserRoleAssignment | null>(null);
  const [revokeForm] = Form.useForm<{ reason: string }>();

  const [reactivateRole, setReactivateRole] = useState<RbacUserRoleAssignment | null>(null);
  const [reactivateForm] = Form.useForm<{ reason: string }>();

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetForm] = Form.useForm<{ reason: string }>();

  const [permSearch, setPermSearch] = useState('');

  // 1. Fetch user authorization
  const authQuery = useQuery({
    queryKey: ['admin-rbac-user-authorization', userId],
    queryFn: () => rbacApi.getUserAuthorization(userId),
    enabled: Boolean(userId),
  });

  const authData: RbacUserAuthorization | undefined = authQuery.data;

  // 2. Fetch active roles for assignment
  const rolesQuery = useQuery({
    queryKey: ['admin-rbac-roles-active'],
    queryFn: () => rbacApi.getRoles({ isActive: true, pageSize: 100 }),
    enabled: assignModalOpen,
  });

  // Self-mutation guard
  const isSelf = useMemo(() => {
    if (!currentUser || !authData) return false;
    return (
      currentUser.id === authData.userId ||
      currentUser.email?.toLowerCase() === authData.email.toLowerCase()
    );
  }, [currentUser, authData]);

  // Handle conflict refresh
  const handleConflictRefresh = () => {
    message.warning(
      'Dữ liệu phân quyền đã bị thay đổi bởi phiên khác. Hệ thống đã tự động làm mới dữ liệu.'
    );
    void queryClient.invalidateQueries({ queryKey: ['admin-rbac-user-authorization', userId] });
  };

  // Assign role mutation
  const assignMutation = useMutation({
    mutationFn: (values: { roleId: string; reason: string }) => {
      if (!authData) throw new Error('Chưa có thông tin phân quyền.');
      return rbacApi.assignUserRole(userId, {
        roleId: values.roleId,
        concurrencyToken: authData.authorizationConcurrencyToken,
        reason: values.reason,
      });
    },
    onSuccess: (updated) => {
      void message.success('Đã gán vai trò thành công cho tài khoản.');
      setAssignModalOpen(false);
      assignForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', userId], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        void message.error('Quản trị viên không được phép tự phân quyền cho chính mình.');
      } else {
        void message.error(getApiErrorMessage(err));
      }
    },
  });

  // Revoke role mutation
  const revokeMutation = useMutation({
    mutationFn: (values: { reason: string }) => {
      if (!authData || !revokeRole) throw new Error('Chưa chọn vai trò cần thu hồi.');
      return rbacApi.revokeUserRole(userId, revokeRole.roleId, {
        concurrencyToken: authData.authorizationConcurrencyToken,
        reason: values.reason,
      });
    },
    onSuccess: (updated) => {
      void message.success('Đã thu hồi vai trò thành công.');
      setRevokeRole(null);
      revokeForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', userId], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        void message.error('Quản trị viên không được phép tự thu hồi vai trò của chính mình.');
      } else {
        void message.error(getApiErrorMessage(err));
      }
    },
  });

  // Reactivate role mutation
  const reactivateMutation = useMutation({
    mutationFn: (values: { reason: string }) => {
      if (!authData || !reactivateRole) throw new Error('Chưa chọn vai trò cần kích hoạt lại.');
      return rbacApi.assignUserRole(userId, {
        roleId: reactivateRole.roleId,
        concurrencyToken: authData.authorizationConcurrencyToken,
        reason: values.reason.trim(),
      });
    },
    onSuccess: (updated) => {
      void message.success('Đã kích hoạt lại vai trò thành công.');
      setReactivateRole(null);
      reactivateForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', userId], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        void message.error('Quản trị viên không được phép tự phân quyền cho chính mình.');
      } else {
        void message.error(getApiErrorMessage(err));
      }
    },
  });

  // Reset to default roles mutation (revoking all active custom roles)
  const resetDefaultMutation = useMutation({
    mutationFn: async (values: { reason: string }) => {
      if (!authData) throw new Error('Chưa có dữ liệu phân quyền.');
      const activeCustomRoles = (authData.roles || []).filter((r) => !r.isSystem && r.status === 'ACTIVE');
      if (activeCustomRoles.length === 0) return authData;

      let currentAuth = authData;
      for (const role of activeCustomRoles) {
        currentAuth = await rbacApi.revokeUserRole(userId, role.roleId, {
          concurrencyToken: currentAuth.authorizationConcurrencyToken,
          reason: values.reason.trim(),
        });
      }
      return currentAuth;
    },
    onSuccess: (updated) => {
      void message.success('Đã khôi phục quyền mặc định thành công cho tài khoản.');
      setResetModalOpen(false);
      resetForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', userId], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        void message.error('Quản trị viên không được phép tự phân quyền cho chính mình.');
      } else {
        void message.error(getApiErrorMessage(err));
      }
    },
  });

  // Available roles for select (excluding already assigned active roles)
  const availableRoles = useMemo(() => {
    const allRoles: RbacRole[] = rolesQuery.data?.items || [];
    const assignedIds = new Set(
      (authData?.roles || []).filter((r) => r.status === 'ACTIVE').map((r) => r.roleId)
    );
    return allRoles.filter((r) => !assignedIds.has(r.roleId));
  }, [rolesQuery.data, authData?.roles]);

  // Filtered effective permissions
  const filteredPermissions = useMemo(() => {
    const list = authData?.effectivePermissions || [];
    if (!permSearch.trim()) return list;
    const q = permSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.resource.toLowerCase().includes(q) ||
        p.sourceRoles.some((r) => r.toLowerCase().includes(q))
    );
  }, [authData?.effectivePermissions, permSearch]);

  const permColumns: ColumnsType<RbacEffectivePermission> = [
    {
      title: 'Mã quyền',
      dataIndex: 'code',
      key: 'code',
      render: (code: string, record) => (
        <div>
          <div className="font-mono text-xs font-bold text-slate-800">{code}</div>
          <div className="text-[11.5px] text-slate-500 line-clamp-1">{record.description || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Tài nguyên',
      dataIndex: 'resource',
      key: 'resource',
      width: 100,
      render: (res: string) => (
        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
          {res}
        </span>
      ),
    },
    {
      title: 'Nguồn vai trò',
      dataIndex: 'sourceRoles',
      key: 'sourceRoles',
      render: (roles: string[]) => (
        <div className="flex flex-wrap gap-1">
          {roles.map((r) => (
            <Tag key={r} color="blue" className="!m-0 text-[11px]">
              {r}
            </Tag>
          ))}
        </div>
      ),
    },
  ];

  if (authQuery.isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (authQuery.isError) {
    return (
      <div className="p-4">
        <Alert
          type="error"
          showIcon
          message="Không thể tải dữ liệu phân quyền"
          description={getApiErrorMessage(authQuery.error)}
          action={
            <Button size="small" onClick={() => authQuery.refetch()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  const assignedRoles = authData?.roles || [];
  const effectivePerms = authData?.effectivePermissions || [];
  const activeCustomRoles = assignedRoles.filter((r) => !r.isSystem && r.status === 'ACTIVE');
  const systemRole = assignedRoles.find((r) => r.isSystem);

  // Role visual helper
  const getRoleVisual = (roleCode: string) => {
    const code = roleCode.toUpperCase();
    if (code.includes('CANDIDATE')) {
      return {
        icon: <UserOutlined className="text-emerald-600 text-sm" />,
        bg: 'bg-emerald-50 border-emerald-200/80',
      };
    }
    if (code.includes('AFFILIATE')) {
      return {
        icon: <TeamOutlined className="text-amber-600 text-sm" />,
        bg: 'bg-amber-50 border-amber-200/80',
      };
    }
    if (code.includes('CLIENT') || code.includes('EMPLOYER')) {
      return {
        icon: <ApartmentOutlined className="text-sky-600 text-sm" />,
        bg: 'bg-sky-50 border-sky-200/80',
      };
    }
    if (code.includes('ADMIN')) {
      return {
        icon: <KeyOutlined className="text-violet-600 text-sm" />,
        bg: 'bg-violet-50 border-violet-200/80',
      };
    }
    return {
      icon: <SafetyCertificateOutlined className="text-slate-600 text-sm" />,
      bg: 'bg-slate-100 border-slate-200',
    };
  };

  return (
    <div className="space-y-4 p-0.5">
      {isSelf && (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          message="Bảo vệ bảo mật Quản trị viên"
          description="Bạn đang xem tài khoản của chính mình. Chính sách bảo mật RBAC nghiêm cấm tự gán hoặc thu hồi vai trò cho bản thân."
          className="rounded-xl border-amber-200 bg-amber-50"
        />
      )}

      {/* ── Section: Assigned Roles ────────────────────────────────────── */}
      <div className="rounded-xl border border-solid border-slate-200/90 bg-white p-4 shadow-2xs">
        {/* Tier 1: Title and Actions (Never wrap) */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-900 text-sm tracking-tight whitespace-nowrap">
              Vai trò đang kích hoạt
            </span>
            <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80 tabular-nums">
              {assignedRoles.filter((r) => r.status === 'ACTIVE').length}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isSelf && (
              <Tooltip
                title={
                  activeCustomRoles.length > 0
                    ? `Thu hồi ${activeCustomRoles.length} vai trò tùy chỉnh để tài khoản về quyền mặc định (${systemRole?.roleName || 'Hệ thống'})`
                    : `Tài khoản đang ở quyền mặc định (${systemRole?.roleName || 'Hệ thống'}), không có vai trò tùy chỉnh cần khôi phục.`
                }
              >
                <button
                  type="button"
                  disabled={activeCustomRoles.length === 0 || resetDefaultMutation.isPending}
                  onClick={() => {
                    if (activeCustomRoles.length === 0) return;
                    resetForm.resetFields();
                    setResetModalOpen(true);
                  }}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-solid text-xs transition-all whitespace-nowrap ${
                    activeCustomRoles.length > 0
                      ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold shadow-2xs cursor-pointer'
                      : 'border-slate-200 bg-slate-50 text-slate-400 font-medium cursor-not-allowed opacity-75'
                  }`}
                >
                  <UndoOutlined className={activeCustomRoles.length > 0 ? 'text-xs text-amber-600' : 'text-xs text-slate-400'} />
                  <span>Khôi phục mặc định</span>
                </button>
              </Tooltip>
            )}
            {!isSelf && (
              <button
                type="button"
                onClick={() => setAssignModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg border-0 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                <PlusOutlined className="text-xs" />
                <span>Gán vai trò</span>
              </button>
            )}
          </div>
        </div>

        {/* Tier 2: Status Indicator & Context */}
        <div className="mt-2.5 pt-2.5 border-0 border-t border-solid border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {activeCustomRoles.length === 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-solid border-emerald-200/80">
                <CheckCircleOutlined className="text-[10px]" /> Đang dùng quyền mặc định
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-solid border-amber-200/80">
                <ThunderboltOutlined className="text-[10px]" /> +{activeCustomRoles.length} vai trò tùy chỉnh
              </span>
            )}
            <span className="text-xs text-slate-500">
              {activeCustomRoles.length === 0
                ? `Kế thừa từ vai trò hệ thống (${systemRole?.roleName || 'Mặc định'})`
                : 'Được gán thêm chức năng mở rộng'}
            </span>
          </div>
        </div>

        {/* Roles List */}
        {assignedRoles.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Tài khoản chưa được gán vai trò bổ sung nào.
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {assignedRoles.map((role) => {
              const isActive = role.status === 'ACTIVE';
              const visual = getRoleVisual(role.roleCode);
              return (
                <div
                  key={role.roleId}
                  className={`rounded-xl border border-solid transition-all p-3.5 ${
                    isActive
                      ? 'border-slate-200/90 bg-gradient-to-r from-white to-slate-50/60 hover:border-slate-300 hover:shadow-2xs'
                      : 'border-slate-200 bg-slate-50/70 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Role Avatar */}
                      <div className={`w-8 h-8 rounded-lg border border-solid flex items-center justify-center shrink-0 mt-0.5 ${visual.bg}`}>
                        {visual.icon}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm tracking-tight">{role.roleName}</span>
                          <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                            {role.roleCode}
                          </span>
                          {role.isSystem ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Hệ thống
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Tùy chỉnh
                            </span>
                          )}
                          {!isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Đã thu hồi
                            </span>
                          )}
                        </div>

                        {role.description && (
                          <div className="text-xs text-slate-600 leading-relaxed mt-1">
                            {role.description}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-slate-400 mt-2 font-mono tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <ClockCircleOutlined className="text-[11px]" /> Gán lúc: {formatDateTime(role.assignedAt)}
                          </span>
                          {role.isSystem && (
                            <span className="text-slate-400 text-[11px] font-sans">
                              (Vai trò gốc theo tài khoản)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {!role.isSystem && isActive && !isSelf && (
                      <Tooltip title="Thu hồi vai trò này khỏi người dùng">
                        <button
                          type="button"
                          onClick={() => {
                            setRevokeRole(role);
                            revokeForm.resetFields();
                          }}
                          className="h-7 px-2.5 rounded-md border border-solid border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold cursor-pointer transition-colors shrink-0"
                        >
                          <DeleteOutlined className="mr-1" /> Thu hồi
                        </button>
                      </Tooltip>
                    )}

                    {!role.isSystem && !isActive && !isSelf && (
                      <Tooltip title="Kích hoạt lại vai trò tùy chỉnh này cho người dùng">
                        <button
                          type="button"
                          onClick={() => {
                            setReactivateRole(role);
                            reactivateForm.resetFields();
                          }}
                          className="h-7 px-2.5 rounded-md border border-solid border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold cursor-pointer transition-colors shrink-0"
                        >
                          <CheckCircleOutlined className="mr-1 text-sky-600" /> Kích hoạt lại
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section: Effective Permissions ───────────────────────────────── */}
      <div className="rounded-xl border border-solid border-slate-200/90 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-0 border-b border-solid border-slate-100">
          <div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <SafetyCertificateOutlined className="text-emerald-600" />
              <span>Quyền hạn thực tế</span>
              <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/80 tabular-nums">
                {effectivePerms.length}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Tổng hợp tất cả quyền người này được thực thi từ các vai trò.</div>
          </div>
          <div className="w-full sm:w-56">
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined className="text-slate-400" />}
              placeholder="Lọc mã quyền, tài nguyên..."
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              className="rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-solid border-slate-100">
          <Table<RbacEffectivePermission>
            columns={permColumns}
            dataSource={filteredPermissions}
            rowKey="permissionId"
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
            className="admin-soft-table [&_.ant-table-thead>tr>th]:!bg-slate-50/80 [&_.ant-table-thead>tr>th]:!text-[11.5px] [&_.ant-table-thead>tr>th]:!font-bold [&_.ant-table-thead>tr>th]:!text-slate-600"
          />
        </div>
      </div>

      {/* ── Modal: Assign Role ───────────────────────────────────────────── */}
      <Modal
        title={<span className="font-bold text-slate-900 text-[16px]">Gán vai trò cho {userEmail}</span>}
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        footer={null}
        destroyOnHidden
        centered
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={(values) => assignMutation.mutate(values)}
          className="pt-3 space-y-4"
        >
          <Form.Item
            name="roleId"
            label={<span className="font-semibold text-slate-700 text-xs">Chọn vai trò cần gán</span>}
            rules={[{ required: true, message: 'Vui lòng chọn vai trò!' }]}
          >
            <Select
              placeholder="Chọn vai trò khả dụng"
              loading={rolesQuery.isLoading}
              options={availableRoles.map((r) => ({
                value: r.roleId,
                label: `${r.name} (${r.code})`,
              }))}
              className="w-full h-10"
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label={<span className="font-semibold text-slate-700 text-xs">Lý do phân quyền (Bắt buộc phục vụ kiểm toán)</span>}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do phân quyền!' },
              { min: 5, message: 'Lý do tối thiểu 5 ký tự!' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Điều chuyển nhân sự kiêm nhiệm kiểm duyệt hồ sơ..."
              showCount
              maxLength={300}
              className="rounded-lg"
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-0 border-t border-solid border-slate-100">
            <Button onClick={() => setAssignModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={assignMutation.isPending}
              className="bg-sky-600 hover:bg-sky-700 font-semibold"
            >
              Xác nhận gán
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Modal: Revoke Role ───────────────────────────────────────────── */}
      <Modal
        title={<span className="font-bold text-slate-900 text-[16px]">Thu hồi vai trò: {revokeRole?.roleName}</span>}
        open={Boolean(revokeRole)}
        onCancel={() => setRevokeRole(null)}
        footer={null}
        destroyOnHidden
        centered
      >
        <Form
          form={revokeForm}
          layout="vertical"
          onFinish={(values) => revokeMutation.mutate(values)}
          className="pt-3 space-y-4"
        >
          <Alert
            type="warning"
            showIcon
            message="Cảnh báo thu hồi quyền"
            description={`Người dùng ${userEmail} sẽ mất ngay lập tức các quyền hạn liên kết với vai trò ${revokeRole?.roleName}.`}
            className="rounded-xl border-amber-200 bg-amber-50"
          />

          <Form.Item
            name="reason"
            label={<span className="font-semibold text-slate-700 text-xs">Lý do thu hồi vai trò (Bắt buộc phục vụ kiểm toán)</span>}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do thu hồi!' },
              { min: 5, message: 'Lý do tối thiểu 5 ký tự!' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Hết hạn phụ trách công việc kiểm duyệt..."
              showCount
              maxLength={300}
              className="rounded-lg"
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-0 border-t border-solid border-slate-100">
            <Button onClick={() => setRevokeRole(null)}>Hủy</Button>
            <Button
              danger
              type="primary"
              htmlType="submit"
              loading={revokeMutation.isPending}
              className="font-semibold"
            >
              Xác nhận thu hồi
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Modal: Reactivate Role ───────────────────────────────────────── */}
      <Modal
        title={<span className="font-bold text-slate-900 text-[16px]">Kích hoạt lại vai trò: {reactivateRole?.roleName}</span>}
        open={Boolean(reactivateRole)}
        onCancel={() => setReactivateRole(null)}
        footer={null}
        destroyOnHidden
        centered
      >
        <Form
          form={reactivateForm}
          layout="vertical"
          onFinish={(values) => reactivateMutation.mutate(values)}
          className="pt-3 space-y-4"
        >
          <Alert
            type="info"
            showIcon
            message="Kích hoạt lại vai trò tùy chỉnh"
            description={`Tài khoản ${userEmail} sẽ được cấp lại các quyền hạn của vai trò ${reactivateRole?.roleName}.`}
            className="rounded-xl border-sky-200 bg-sky-50"
          />

          <Form.Item
            name="reason"
            label={<span className="font-semibold text-slate-700 text-xs">Lý do kích hoạt lại (Bắt buộc phục vụ kiểm toán)</span>}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do kích hoạt lại!' },
              { min: 5, message: 'Lý do tối thiểu 5 ký tự!' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Tiếp tục phân công công việc kiểm duyệt hồ sơ..."
              showCount
              maxLength={300}
              className="rounded-lg"
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-0 border-t border-solid border-slate-100">
            <Button onClick={() => setReactivateRole(null)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={reactivateMutation.isPending}
              className="bg-sky-600 hover:bg-sky-700 font-semibold"
            >
              Xác nhận kích hoạt
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── Modal: Reset to Default Roles ─────────────────────────────────── */}
      <Modal
        title={
          <span className="font-bold text-slate-900 text-[16px] flex items-center gap-2">
            <UndoOutlined className="text-amber-600" />
            <span>Khôi phục quyền mặc định</span>
          </span>
        }
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        footer={null}
        destroyOnHidden
        centered
      >
        <Form
          form={resetForm}
          layout="vertical"
          onFinish={(values) => resetDefaultMutation.mutate(values)}
          className="pt-3 space-y-4"
        >
          <Alert
            type="warning"
            showIcon
            message="Xác nhận khôi phục quyền mặc định ban đầu"
            description={
              <div>
                Thao tác này sẽ thu hồi toàn bộ <strong>{activeCustomRoles.length} vai trò tùy chỉnh</strong> đang gán cho tài khoản <strong>{userEmail}</strong>.
                Tài khoản sẽ trở về <strong>100% tập quyền mặc định</strong> của vai trò hệ thống ({systemRole ? `${systemRole.roleName} - ${systemRole.roleCode}` : 'Hệ thống'}).
              </div>
            }
            className="rounded-xl border-amber-200 bg-amber-50"
          />

          <Form.Item
            name="reason"
            label={<span className="font-semibold text-slate-700 text-xs">Lý do khôi phục quyền mặc định (Bắt buộc kiểm toán)</span>}
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do khôi phục quyền mặc định!' },
              { min: 5, message: 'Lý do tối thiểu 5 ký tự!' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Thu hồi phân quyền tạm thời để đưa tài khoản về chuẩn mặc định..."
              showCount
              maxLength={300}
              className="rounded-lg"
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-0 border-t border-solid border-slate-100">
            <Button onClick={() => setResetModalOpen(false)}>Hủy</Button>
            <Button
              danger
              type="primary"
              htmlType="submit"
              loading={resetDefaultMutation.isPending}
              className="font-semibold"
            >
              Xác nhận khôi phục mặc định
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default UserAuthorizationTab;
