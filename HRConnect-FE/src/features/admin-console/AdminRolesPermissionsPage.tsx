/**
 * @file AdminRolesPermissionsPage.tsx
 * @description Admin · Roles & Permissions Management (/admin/roles-permissions).
 * Soft-UI layout adhering to "Slate Command" theme and specifications in FRONTEND-INTEGRATION.md.
 * Tab 1: Roles (System/Custom badge, status, permissions count, user assignments, detail drawer, permission matrix).
 * Tab 2: Permissions Catalog (filters by resource/action/status/delegable, protected lock indicator, edit modal).
 */
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { isRbacConflict, rbacApi } from '@/services/api/rbacApi';
import { getApiErrorMessage } from '@/services/apiClient';
import {
  isDelegablePermission,
  normalizeRoleCode,
  type RbacCreateRoleInput,
  type RbacPermission,
  type RbacRole,
} from '@/types/api/rbac';
import { adminTokens, formatDateTime } from './adminTheme';
import { PageHero, StatTile, StatusDot, Surface, type Tone } from './ui';

const PAGE_SIZE = 20;

export const AdminRolesPermissionsPage: React.FC = () => {
  const { message, modal } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: 'roles' or 'permissions'
  const activeTab = searchParams.get('tab') || 'roles';
  const handleTabChange = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    next.delete('page');
    setSearchParams(next);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 1: ROLES STATE & QUERIES
  // ───────────────────────────────────────────────────────────────────────────

  const roleParams = useMemo(
    () => ({
      search: searchParams.get('role_search') || undefined,
      isSystem:
        searchParams.get('is_system') === 'true'
          ? true
          : searchParams.get('is_system') === 'false'
            ? false
            : undefined,
      isActive:
        searchParams.get('role_active') === 'true'
          ? true
          : searchParams.get('role_active') === 'false'
            ? false
            : undefined,
      page: Number(searchParams.get('role_page')) || 1,
      pageSize: PAGE_SIZE,
    }),
    [searchParams]
  );

  const rolesQuery = useQuery({
    queryKey: ['admin-rbac-roles', roleParams],
    queryFn: () => rbacApi.getRoles(roleParams),
  });

  const rolesCountsQuery = useQuery({
    queryKey: ['admin-rbac-roles-counts'],
    queryFn: async () => {
      const [all, system, custom] = await Promise.all([
        rbacApi.getRoles({ pageSize: 1 }),
        rbacApi.getRoles({ isSystem: true, pageSize: 1 }),
        rbacApi.getRoles({ isSystem: false, pageSize: 1 }),
      ]);
      return {
        all: all.total,
        system: system.total,
        custom: custom.total,
      };
    },
  });

  // Drawer / Modals
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [matrixReasonModalOpen, setMatrixReasonModalOpen] = useState(false);
  const [stagedPermissionIds, setStagedPermissionIds] = useState<string[]>([]);
  const [matrixDrawerTab, setMatrixDrawerTab] = useState<'matrix' | 'info' | 'delete'>('matrix');

  // Role detail query
  const roleDetailQuery = useQuery({
    queryKey: ['admin-rbac-role-detail', selectedRoleId],
    queryFn: () => rbacApi.getRole(selectedRoleId as string),
    enabled: Boolean(selectedRoleId),
  });

  // All delegable permissions for matrix assignment
  const allPermissionsForMatrixQuery = useQuery({
    queryKey: ['admin-rbac-all-permissions-matrix'],
    queryFn: () => rbacApi.getPermissions({ pageSize: 100 }),
    enabled: Boolean(selectedRoleId),
  });

  // Sync staged permissions when role detail loads
  const roleDetail = roleDetailQuery.data;
  React.useEffect(() => {
    if (roleDetail?.permissions) {
      setStagedPermissionIds(roleDetail.permissions.map((p) => p.permissionId));
    } else {
      setStagedPermissionIds([]);
    }
  }, [roleDetail]);

  // Create role form
  const [createRoleForm] = Form.useForm<{ code: string; name: string; description?: string }>();
  const [roleCodeInput, setRoleCodeInput] = useState('');

  // Reason forms
  const [matrixReasonForm] = Form.useForm<{ reason: string }>();
  const [editRoleForm] = Form.useForm<{ name: string; description?: string; isActive: boolean; reason: string }>();
  const [deleteRoleForm] = Form.useForm<{ reason: string }>();

  // Set initial form values for edit role
  React.useEffect(() => {
    if (roleDetail) {
      editRoleForm.setFieldsValue({
        name: roleDetail.name,
        description: roleDetail.description || '',
        isActive: roleDetail.isActive,
        reason: '',
      });
    }
  }, [roleDetail, editRoleForm]);

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: (input: RbacCreateRoleInput) => rbacApi.createRole(input),
    onSuccess: (newRole) => {
      message.success(`Đã tạo thành công vai trò ${newRole.name} (${newRole.code}).`);
      setCreateRoleOpen(false);
      createRoleForm.resetFields();
      setRoleCodeInput('');
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles-counts'] });
      // Open matrix configuration drawer for the new custom role
      setSelectedRoleId(newRole.roleId);
      setMatrixDrawerTab('matrix');
    },
    onError: (err) => message.error(getApiErrorMessage(err)),
  });

  const updateRoleMutation = useMutation({
    mutationFn: (values: { name: string; description?: string; isActive: boolean; reason: string }) => {
      if (!selectedRoleId || !roleDetail) throw new Error('Chưa chọn vai trò.');
      return rbacApi.updateRole(selectedRoleId, {
        name: values.name,
        description: values.description,
        isActive: values.isActive,
        concurrencyToken: roleDetail.concurrencyToken,
        reason: values.reason,
      });
    },
    onSuccess: (updated) => {
      message.success(`Đã cập nhật thông tin vai trò ${updated.name}.`);
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-role-detail', selectedRoleId] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        message.warning('Dữ liệu vai trò đã bị thay đổi bởi người khác. Hệ thống đang tải lại dữ liệu mới nhất...');
        queryClient.invalidateQueries({ queryKey: ['admin-rbac-role-detail', selectedRoleId] });
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!selectedRoleId || !roleDetail) throw new Error('Chưa chọn vai trò.');
      return rbacApi.deleteRole(selectedRoleId, {
        concurrencyToken: roleDetail.concurrencyToken,
        reason,
      });
    },
    onSuccess: () => {
      message.success('Đã ngừng sử dụng (xóa) vai trò thành công.');
      setSelectedRoleId(null);
      deleteRoleForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles-counts'] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        message.warning('Dữ liệu vai trò đã bị thay đổi bởi người khác. Hệ thống đang tải lại dữ liệu mới nhất...');
        queryClient.invalidateQueries({ queryKey: ['admin-rbac-role-detail', selectedRoleId] });
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  const replacePermissionsMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!selectedRoleId || !roleDetail) throw new Error('Chưa chọn vai trò.');
      return rbacApi.replaceRolePermissions(selectedRoleId, {
        permissionIds: stagedPermissionIds,
        concurrencyToken: roleDetail.concurrencyToken,
        reason,
      });
    },
    onSuccess: (updated) => {
      message.success(`Đã cập nhật ma trận quyền hạn cho vai trò ${updated.name}.`);
      setMatrixReasonModalOpen(false);
      matrixReasonForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-role-detail', selectedRoleId] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        message.warning('Dữ liệu vai trò đã bị thay đổi bởi người khác. Hệ thống đang tải lại dữ liệu mới nhất...');
        queryClient.invalidateQueries({ queryKey: ['admin-rbac-role-detail', selectedRoleId] });
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TAB 2: PERMISSIONS STATE & QUERIES
  // ───────────────────────────────────────────────────────────────────────────

  const permParams = useMemo(
    () => ({
      search: searchParams.get('perm_search') || undefined,
      resource: searchParams.get('perm_resource') || undefined,
      action: searchParams.get('perm_action') || undefined,
      isActive:
        searchParams.get('perm_active') === 'true'
          ? true
          : searchParams.get('perm_active') === 'false'
            ? false
            : undefined,
      isDelegable:
        searchParams.get('perm_delegable') === 'true'
          ? true
          : searchParams.get('perm_delegable') === 'false'
            ? false
            : undefined,
      page: Number(searchParams.get('perm_page')) || 1,
      pageSize: PAGE_SIZE,
    }),
    [searchParams]
  );

  const permissionsQuery = useQuery({
    queryKey: ['admin-rbac-permissions', permParams],
    queryFn: () => rbacApi.getPermissions(permParams),
  });

  const permissionsCountsQuery = useQuery({
    queryKey: ['admin-rbac-permissions-counts'],
    queryFn: async () => {
      const [all, active] = await Promise.all([
        rbacApi.getPermissions({ pageSize: 1 }),
        rbacApi.getPermissions({ isActive: true, pageSize: 1 }),
      ]);
      return {
        all: all.total,
        active: active.total,
      };
    },
  });

  // Edit permission modal
  const [editingPermission, setEditingPermission] = useState<RbacPermission | null>(null);
  const [editPermForm] = Form.useForm<{ description?: string; isActive: boolean; reason: string }>();

  React.useEffect(() => {
    if (editingPermission) {
      editPermForm.setFieldsValue({
        description: editingPermission.description || '',
        isActive: editingPermission.isActive,
        reason: '',
      });
    }
  }, [editingPermission, editPermForm]);

  const updatePermissionMutation = useMutation({
    mutationFn: (values: { description?: string; isActive: boolean; reason: string }) => {
      if (!editingPermission) throw new Error('Chưa chọn quyền.');
      return rbacApi.updatePermission(editingPermission.permissionId, {
        description: values.description,
        isActive: values.isActive,
        concurrencyToken: editingPermission.concurrencyToken,
        reason: values.reason,
      });
    },
    onSuccess: (updated) => {
      message.success(`Đã cập nhật quyền ${updated.code}.`);
      setEditingPermission(null);
      editPermForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-permissions-counts'] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        message.warning('Quyền đã bị thay đổi bởi người khác. Hệ thống đang tải lại dữ liệu mới nhất...');
        queryClient.invalidateQueries({ queryKey: ['admin-rbac-permissions'] });
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  // Helper for URL parameters
  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value !== undefined && value !== null && value !== '') {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // TABLE COLUMNS: ROLES
  // ───────────────────────────────────────────────────────────────────────────

  const roleColumns: ColumnsType<RbacRole> = [
    {
      title: 'Mã vai trò',
      dataIndex: 'code',
      key: 'code',
      width: 220,
      render: (code: string) => (
        <code
          style={{ fontFamily: adminTokens.mono }}
          className="rounded bg-slate-100 px-2 py-1 text-[13px] font-semibold text-slate-800"
        >
          {code}
        </code>
      ),
    },
    {
      title: 'Tên vai trò & Mô tả',
      key: 'name',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-slate-900">{r.name}</div>
          {r.description && <div className="text-xs text-slate-500">{r.description}</div>}
        </div>
      ),
    },
    {
      title: 'Phân loại',
      dataIndex: 'isSystem',
      key: 'isSystem',
      width: 140,
      render: (isSystem: boolean) =>
        isSystem ? (
          <Tag color="blue" icon={<LockOutlined />} className="font-medium">
            System Role
          </Tag>
        ) : (
          <Tag color="green" icon={<SafetyCertificateOutlined />} className="font-medium">
            Custom Role
          </Tag>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (isActive: boolean) => (
        <StatusDot tone={isActive ? 'success' : 'neutral'}>
          {isActive ? 'Hoạt động' : 'Tạm ngưng'}
        </StatusDot>
      ),
    },
    {
      title: 'Số quyền',
      dataIndex: 'permissionCount',
      key: 'permissionCount',
      width: 110,
      align: 'center',
      render: (count: number) => (
        <Badge
          count={count}
          showZero
          style={{ backgroundColor: count > 0 ? '#2563EB' : '#94A3B8' }}
        />
      ),
    },
    {
      title: 'Số lượt gán',
      dataIndex: 'activeAssignmentCount',
      key: 'activeAssignmentCount',
      width: 110,
      align: 'center',
      render: (count: number) => (
        <span className="tabular-nums font-medium text-slate-700">{count}</span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 128,
      align: 'right',
      className: 'w-32 text-right pr-4',
      render: (_, r) => (
        <Space size="small">
          {r.isSystem ? (
            <Button
              size="small"
              onClick={() => {
                setSelectedRoleId(r.roleId);
                setMatrixDrawerTab('matrix');
              }}
            >
              Chỉ xem
            </Button>
          ) : (
            <>
              <Button
                type="primary"
                size="small"
                icon={<KeyOutlined />}
                onClick={() => {
                  setSelectedRoleId(r.roleId);
                  setMatrixDrawerTab('matrix');
                }}
              >
                Ma trận quyền
              </Button>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedRoleId(r.roleId);
                  setMatrixDrawerTab('info');
                }}
              />
            </>
          )}
        </Space>
      ),
    },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // TABLE COLUMNS: PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────────

  const permissionColumns: ColumnsType<RbacPermission> = [
    {
      title: 'Mã quyền',
      dataIndex: 'code',
      key: 'code',
      width: 240,
      render: (code: string) => (
        <code
          style={{ fontFamily: adminTokens.mono }}
          className="rounded bg-slate-100 px-2 py-1 text-[13px] font-semibold text-slate-800"
        >
          {code}
        </code>
      ),
    },
    {
      title: 'Phân hệ & Hành động',
      key: 'resource_action',
      width: 180,
      render: (_, p) => (
        <div className="flex flex-wrap gap-1">
          <Tag color="cyan" className="font-mono text-xs">
            {p.resource}
          </Tag>
          <Tag color="purple" className="font-mono text-xs">
            {p.action}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | null) => (
        <span className="text-[13.5px] text-slate-700">{desc || '—'}</span>
      ),
    },
    {
      title: 'Thuộc tính bảo mật',
      key: 'security_flags',
      width: 210,
      render: (_, p) => (
        <Space direction="vertical" size={2}>
          {p.isProtected && (
            <Tag color="error" icon={<LockOutlined />}>
              Được bảo vệ (Protected)
            </Tag>
          )}
          {p.isDelegable ? (
            <Tag color="success">Có thể ủy quyền</Tag>
          ) : (
            <Tag color="default">Không thể ủy quyền</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (isActive: boolean) => (
        <StatusDot tone={isActive ? 'success' : 'neutral'}>
          {isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
        </StatusDot>
      ),
    },
    {
      title: 'Custom Roles',
      dataIndex: 'customRoleUsageCount',
      key: 'customRoleUsageCount',
      width: 120,
      align: 'center',
      render: (count?: number) => (
        <span className="tabular-nums font-semibold text-slate-700">{count ?? '—'}</span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, p) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => setEditingPermission(p)}
        >
          Sửa
        </Button>
      ),
    },
  ];

  // Helper counts display
  const v = (q: { data?: { all?: number; system?: number; custom?: number; active?: number }; isLoading: boolean }, key: string) =>
    q.isLoading ? '…' : (q.data as any)?.[key] ?? '—';

  return (
    <div>
      <PageHero
        eyebrow="Quản trị phân quyền RBAC"
        title="Vai trò & Danh mục quyền"
        description="Quản lý vai trò tùy chỉnh (Custom Role), cấu hình ma trận quyền hạn bảo mật và tra cứu danh mục quyền hệ thống."
        actions={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
                queryClient.invalidateQueries({ queryKey: ['admin-rbac-permissions'] });
              }}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createRoleForm.resetFields();
                setRoleCodeInput('');
                setCreateRoleOpen(true);
              }}
            >
              Tạo Custom Role
            </Button>
          </Space>
        }
      />

      {/* Top Stat Tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Tất cả vai trò"
          value={v(rolesCountsQuery, 'all')}
          tone="neutral"
          active={activeTab === 'roles' && !roleParams.isSystem}
          onClick={() => {
            handleTabChange('roles');
            setParam('is_system', undefined);
          }}
        />
        <StatTile
          label="Custom Roles"
          value={v(rolesCountsQuery, 'custom')}
          tone="success"
          active={activeTab === 'roles' && roleParams.isSystem === false}
          onClick={() => {
            handleTabChange('roles');
            setParam('is_system', 'false');
          }}
        />
        <StatTile
          label="System Roles (Cố định)"
          value={v(rolesCountsQuery, 'system')}
          tone="info"
          active={activeTab === 'roles' && roleParams.isSystem === true}
          onClick={() => {
            handleTabChange('roles');
            setParam('is_system', 'true');
          }}
        />
        <StatTile
          label="Tổng quyền hệ thống"
          value={v(permissionsCountsQuery, 'all')}
          tone="warning"
          active={activeTab === 'permissions'}
          onClick={() => handleTabChange('permissions')}
        />
      </div>

      <Surface>
        <div className="px-5 pt-4">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              {
                key: 'roles',
                label: (
                  <span className="flex items-center gap-2 px-1 text-[15px] font-semibold">
                    <SafetyCertificateOutlined /> Danh sách Vai trò (Roles)
                  </span>
                ),
              },
              {
                key: 'permissions',
                label: (
                  <span className="flex items-center gap-2 px-1 text-[15px] font-semibold">
                    <KeyOutlined /> Danh mục Quyền (Permissions)
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* ── TAB 1: ROLES ─────────────────────────────────────────────────── */}
        {activeTab === 'roles' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-1">
              <Input
                allowClear
                size="large"
                defaultValue={roleParams.search}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm theo mã hoặc tên vai trò, nhấn Enter"
                className="max-w-xs"
                onPressEnter={(e) => setParam('role_search', e.currentTarget.value.trim() || undefined)}
                onChange={(e) => !e.target.value && roleParams.search && setParam('role_search', undefined)}
                aria-label="Tìm vai trò"
              />
              <Select
                allowClear
                size="large"
                value={
                  roleParams.isSystem === true
                    ? 'system'
                    : roleParams.isSystem === false
                      ? 'custom'
                      : undefined
                }
                placeholder="Mọi phân loại"
                className="w-44"
                onChange={(val) => {
                  setParam('is_system', val === 'system' ? 'true' : val === 'custom' ? 'false' : undefined);
                }}
                options={[
                  { value: 'custom', label: 'Custom Role' },
                  { value: 'system', label: 'System Role' },
                ]}
                aria-label="Lọc theo loại vai trò"
              />
              <Select
                allowClear
                size="large"
                value={
                  roleParams.isActive === true
                    ? 'active'
                    : roleParams.isActive === false
                      ? 'inactive'
                      : undefined
                }
                placeholder="Mọi trạng thái"
                className="w-44"
                onChange={(val) => {
                  setParam('role_active', val === 'active' ? 'true' : val === 'inactive' ? 'false' : undefined);
                }}
                options={[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'inactive', label: 'Tạm ngưng' },
                ]}
                aria-label="Lọc theo trạng thái vai trò"
              />
              {rolesQuery.data && (
                <span className="ml-auto text-sm tabular-nums text-slate-500">
                  {rolesQuery.data.total} vai trò
                </span>
              )}
            </div>

            {rolesQuery.isError ? (
              <div className="p-5">
                <Alert
                  type="error"
                  showIcon
                  message="Không thể tải danh sách vai trò"
                  description={getApiErrorMessage(rolesQuery.error)}
                  action={
                    <Button size="small" onClick={() => rolesQuery.refetch()}>
                      Thử lại
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table<RbacRole>
                className="admin-soft-table w-full table-auto"
                rowKey="roleId"
                loading={rolesQuery.isLoading}
                columns={roleColumns}
                dataSource={rolesQuery.data?.items ?? []}
                locale={{ emptyText: <div className="py-10 text-slate-500">Không tìm thấy vai trò nào.</div> }}
                pagination={{
                  current: rolesQuery.data?.page ?? roleParams.page,
                  pageSize: PAGE_SIZE,
                  total: rolesQuery.data?.total ?? 0,
                  showSizeChanger: false,
                  hideOnSinglePage: true,
                  onChange: (p) => setParam('role_page', String(p)),
                }}
              />
            )}
          </div>
        )}

        {/* ── TAB 2: PERMISSIONS ───────────────────────────────────────────── */}
        {activeTab === 'permissions' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-1">
              <Input
                allowClear
                size="large"
                defaultValue={permParams.search}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Tìm mã hoặc mô tả quyền, nhấn Enter"
                className="max-w-xs"
                onPressEnter={(e) => setParam('perm_search', e.currentTarget.value.trim() || undefined)}
                onChange={(e) => !e.target.value && permParams.search && setParam('perm_search', undefined)}
                aria-label="Tìm quyền"
              />
              <Input
                allowClear
                size="large"
                defaultValue={permParams.resource}
                placeholder="Lọc Resource (VD: role, job)"
                className="w-48"
                onPressEnter={(e) => setParam('perm_resource', e.currentTarget.value.trim() || undefined)}
                onChange={(e) => !e.target.value && permParams.resource && setParam('perm_resource', undefined)}
                aria-label="Lọc resource"
              />
              <Select
                allowClear
                size="large"
                value={
                  permParams.isActive === true
                    ? 'active'
                    : permParams.isActive === false
                      ? 'inactive'
                      : undefined
                }
                placeholder="Mọi trạng thái"
                className="w-40"
                onChange={(val) => {
                  setParam('perm_active', val === 'active' ? 'true' : val === 'inactive' ? 'false' : undefined);
                }}
                options={[
                  { value: 'active', label: 'Hoạt động' },
                  { value: 'inactive', label: 'Vô hiệu hóa' },
                ]}
                aria-label="Lọc trạng thái quyền"
              />
              <Select
                allowClear
                size="large"
                value={
                  permParams.isDelegable === true
                    ? 'delegable'
                    : permParams.isDelegable === false
                      ? 'non_delegable'
                      : undefined
                }
                placeholder="Ủy quyền cho Custom Role"
                className="w-52"
                onChange={(val) => {
                  setParam('perm_delegable', val === 'delegable' ? 'true' : val === 'non_delegable' ? 'false' : undefined);
                }}
                options={[
                  { value: 'delegable', label: 'Được ủy quyền' },
                  { value: 'non_delegable', label: 'Không ủy quyền' },
                ]}
                aria-label="Lọc ủy quyền"
              />
              {permissionsQuery.data && (
                <span className="ml-auto text-sm tabular-nums text-slate-500">
                  {permissionsQuery.data.total} quyền
                </span>
              )}
            </div>

            {permissionsQuery.isError ? (
              <div className="p-5">
                <Alert
                  type="error"
                  showIcon
                  message="Không thể tải danh mục quyền"
                  description={getApiErrorMessage(permissionsQuery.error)}
                  action={
                    <Button size="small" onClick={() => permissionsQuery.refetch()}>
                      Thử lại
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table<RbacPermission>
                className="admin-soft-table w-full table-auto"
                rowKey="permissionId"
                loading={permissionsQuery.isLoading}
                columns={permissionColumns}
                dataSource={permissionsQuery.data?.items ?? []}
                locale={{ emptyText: <div className="py-10 text-slate-500">Không tìm thấy quyền nào.</div> }}
                pagination={{
                  current: permissionsQuery.data?.page ?? permParams.page,
                  pageSize: PAGE_SIZE,
                  total: permissionsQuery.data?.total ?? 0,
                  showSizeChanger: false,
                  hideOnSinglePage: true,
                  onChange: (p) => setParam('perm_page', String(p)),
                }}
              />
            )}
          </div>
        )}
      </Surface>

      {/* ── CREATE CUSTOM ROLE MODAL ─────────────────────────────────────── */}
      <Modal
        open={createRoleOpen}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <SafetyCertificateOutlined className="text-emerald-600" />
            Tạo Custom Role mới
          </div>
        }
        okText="Tạo vai trò"
        cancelText="Hủy"
        confirmLoading={createRoleMutation.isPending}
        onCancel={() => setCreateRoleOpen(false)}
        onOk={() => createRoleForm.submit()}
        destroyOnClose
      >
        <Form
          form={createRoleForm}
          layout="vertical"
          preserve={false}
          onFinish={(values) => createRoleMutation.mutate(values)}
          className="pt-2"
        >
          <Form.Item
            name="code"
            label="Mã vai trò (Code)"
            extra={
              roleCodeInput ? (
                <span className="text-xs text-slate-500">
                  Chuẩn hóa: <code className="font-bold text-emerald-700">{normalizeRoleCode(roleCodeInput)}</code>
                </span>
              ) : (
                'Chỉ chấp nhận chữ in hoa (A-Z), số (0-9) và gạch dưới (_).'
              )
            }
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập mã vai trò.' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  const norm = normalizeRoleCode(value);
                  if (!/^[A-Z0-9_]+$/.test(norm)) {
                    return Promise.reject(new Error('Mã vai trò chỉ được chứa chữ cái, số và dấu gạch dưới.'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              placeholder="VD: CLIENT_REVIEWER, HR_OPS_AUDITOR"
              onChange={(e) => setRoleCodeInput(e.target.value)}
              className="font-mono"
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên hiển thị vai trò"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập tên vai trò.' },
              { max: 150, message: 'Tối đa 150 ký tự.' },
            ]}
          >
            <Input placeholder="VD: Nhân viên kiểm duyệt hồ sơ" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả phạm vi quyền hạn"
            rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}
          >
            <Input.TextArea rows={3} placeholder="Mô tả tóm tắt trách nhiệm hoặc phạm vi ủy quyền của vai trò này" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── ROLE DETAIL & PERMISSIONS MATRIX DRAWER ───────────────────────── */}
      <Drawer
        open={Boolean(selectedRoleId)}
        width="min(860px, 100vw)"
        onClose={() => setSelectedRoleId(null)}
        title={
          roleDetail ? (
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2">
                {roleDetail.isSystem ? (
                  <Tag color="blue" icon={<LockOutlined />}>
                    System Role
                  </Tag>
                ) : (
                  <Tag color="green" icon={<SafetyCertificateOutlined />}>
                    Custom Role
                  </Tag>
                )}
                <span className="font-bold text-slate-900">{roleDetail.name}</span>
                <code
                  style={{ fontFamily: adminTokens.mono }}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                >
                  {roleDetail.code}
                </code>
              </div>
            </div>
          ) : (
            'Chi tiết vai trò'
          )
        }
        destroyOnClose
        styles={{ body: { padding: 0, background: '#F8FAFC' } }}
      >
        {roleDetailQuery.isLoading ? (
          <div className="p-6">
            <Skeleton active paragraph={{ rows: 10 }} />
          </div>
        ) : roleDetailQuery.isError || !roleDetail ? (
          <div className="p-6">
            <Alert
              type="error"
              showIcon
              message="Không tải được chi tiết vai trò"
              description={getApiErrorMessage(roleDetailQuery.error)}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* System Role Notification Banner */}
            {roleDetail.isSystem ? (
              <div className="p-5">
                <Alert
                  type="info"
                  showIcon
                  icon={<LockOutlined />}
                  message="Vai trò hệ thống cố định (Read-only)"
                  description="System Role do mã nguồn nền tảng quản lý cố định. Không cho phép sửa tên, trạng thái, xóa hoặc thay đổi danh mục quyền hạn của vai trò này."
                  className="mb-4"
                />
                <div className="admin-surface p-5">
                  <Typography.Title level={5} className="!mb-3">
                    Quyền hạn được cấp ({roleDetail.permissions?.length ?? 0})
                  </Typography.Title>
                  <div className="flex flex-wrap gap-2">
                    {roleDetail.permissions?.map((p) => (
                      <Tag key={p.permissionId} color="geekblue" className="py-1">
                        <span className="font-mono font-semibold">{p.code}</span> - {p.description || p.action}
                      </Tag>
                    ))}
                    {(!roleDetail.permissions || roleDetail.permissions.length === 0) && (
                      <span className="text-sm text-slate-500">Chưa có quyền hạn nào được gán.</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Custom Role: Tabs (Matrix / Info / Delete) */
              <div className="flex flex-col flex-1">
                <div className="bg-white px-5 pt-3 border-0 border-b border-solid border-slate-200">
                  <Tabs
                    activeKey={matrixDrawerTab}
                    onChange={(k) => setMatrixDrawerTab(k as any)}
                    items={[
                      {
                        key: 'matrix',
                        label: (
                          <span className="flex items-center gap-1.5 font-semibold">
                            <KeyOutlined /> Ma trận quyền ({stagedPermissionIds.length})
                          </span>
                        ),
                      },
                      {
                        key: 'info',
                        label: (
                          <span className="flex items-center gap-1.5 font-semibold">
                            <EditOutlined /> Thông tin & Trạng thái
                          </span>
                        ),
                      },
                      {
                        key: 'delete',
                        label: (
                          <span className="flex items-center gap-1.5 font-semibold text-red-600">
                            <DeleteOutlined /> Ngừng sử dụng (Xóa)
                          </span>
                        ),
                      },
                    ]}
                  />
                </div>

                {/* Sub-Tab 1: Permissions Matrix Checklist */}
                {matrixDrawerTab === 'matrix' && (
                  <div className="flex-1 overflow-y-auto p-5">
                    <Alert
                      type="info"
                      showIcon
                      message="Quy tắc cấu hình quyền cho Custom Role"
                      description="Chỉ cho phép gán các quyền đang hoạt động, có thể ủy quyền (isDelegable=true) và không bị bảo vệ (isProtected=false). Các quyền hệ thống IAM nhạy cảm bị khóa tự động."
                      className="mb-4"
                    />

                    <div className="admin-surface p-4 mb-4 flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-600">Số quyền đang chọn cho vai trò: </span>
                        <strong className="text-base text-emerald-700">{stagedPermissionIds.length}</strong>
                      </div>
                      <Space>
                        <Button
                          size="small"
                          onClick={() => {
                            const delegableIds = (allPermissionsForMatrixQuery.data?.items ?? [])
                              .filter(isDelegablePermission)
                              .map((p) => p.permissionId);
                            setStagedPermissionIds(delegableIds);
                          }}
                        >
                          Chọn tất cả quyền hợp lệ
                        </Button>
                        <Button size="small" onClick={() => setStagedPermissionIds([])}>
                          Bỏ chọn tất cả
                        </Button>
                      </Space>
                    </div>

                    {allPermissionsForMatrixQuery.isLoading ? (
                      <Skeleton active paragraph={{ rows: 6 }} />
                    ) : (
                      <div className="space-y-4">
                        {/* Group permissions by resource */}
                        {Object.entries(
                          (allPermissionsForMatrixQuery.data?.items ?? []).reduce(
                            (acc, p) => {
                              acc[p.resource] = acc[p.resource] || [];
                              acc[p.resource].push(p);
                              return acc;
                            },
                            {} as Record<string, RbacPermission[]>
                          )
                        ).map(([resource, perms]) => (
                          <div key={resource} className="admin-surface p-4">
                            <div className="mb-3 flex items-center gap-2 border-0 border-b border-solid border-slate-100 pb-2">
                              <AppstoreOutlined className="text-slate-500" />
                              <span className="font-bold uppercase tracking-wider text-slate-700 text-xs">
                                Phân hệ: {resource}
                              </span>
                              <Badge count={perms.length} style={{ backgroundColor: '#E2E8F0', color: '#475569' }} />
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {perms.map((p) => {
                                const delegable = isDelegablePermission(p);
                                const isChecked = stagedPermissionIds.includes(p.permissionId);

                                return (
                                  <div
                                    key={p.permissionId}
                                    className={`flex items-start gap-2.5 rounded-lg border border-solid p-2.5 transition-colors ${
                                      !delegable
                                        ? 'border-slate-200 bg-slate-50/70 opacity-60'
                                        : isChecked
                                          ? 'border-emerald-300 bg-emerald-50/40'
                                          : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    <Checkbox
                                      disabled={!delegable}
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setStagedPermissionIds((prev) => [...prev, p.permissionId]);
                                        } else {
                                          setStagedPermissionIds((prev) =>
                                            prev.filter((id) => id !== p.permissionId)
                                          );
                                        }
                                      }}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <code className="text-xs font-semibold text-slate-900">{p.code}</code>
                                        {!delegable && (
                                          <Tooltip title="Quyền bảo vệ hệ thống / không thể ủy quyền">
                                            <Tag color="default" className="text-[10px] px-1 py-0 mr-0">
                                              <LockOutlined /> Khóa
                                            </Tag>
                                          </Tooltip>
                                        )}
                                      </div>
                                      <div className="text-[12px] text-slate-500 leading-tight mt-0.5">
                                        {p.description || p.action}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bottom Save Action Bar */}
                    <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white shadow-xl">
                      <div>
                        <div className="text-sm font-semibold">Cập nhật ma trận phân quyền</div>
                        <div className="text-xs text-slate-300">
                          {stagedPermissionIds.length} quyền sẽ được áp dụng cho vai trò này.
                        </div>
                      </div>
                      <Button
                        type="primary"
                        size="large"
                        icon={<CheckCircleOutlined />}
                        onClick={() => {
                          matrixReasonForm.resetFields();
                          setMatrixReasonModalOpen(true);
                        }}
                      >
                        Lưu ma trận quyền
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sub-Tab 2: Edit Role Info */}
                {matrixDrawerTab === 'info' && (
                  <div className="p-5 max-w-xl">
                    <div className="admin-surface p-5">
                      <Form
                        form={editRoleForm}
                        layout="vertical"
                        onFinish={(v) => updateRoleMutation.mutate(v)}
                      >
                        <Form.Item label="Mã vai trò (Code)">
                          <Input value={roleDetail.code} disabled className="font-mono bg-slate-50" />
                        </Form.Item>

                        <Form.Item
                          name="name"
                          label="Tên hiển thị vai trò"
                          rules={[{ required: true, whitespace: true, message: 'Nhập tên vai trò.' }]}
                        >
                          <Input />
                        </Form.Item>

                        <Form.Item name="description" label="Mô tả">
                          <Input.TextArea rows={3} />
                        </Form.Item>

                        <Form.Item
                          name="isActive"
                          label="Trạng thái hoạt động"
                          valuePropName="checked"
                        >
                          <Switch
                            checkedChildren="Hoạt động"
                            unCheckedChildren="Tạm ngưng"
                          />
                        </Form.Item>

                        <Form.Item
                          name="reason"
                          label="Lý do điều chỉnh (Bắt buộc)"
                          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do cập nhật vai trò.' }]}
                        >
                          <Input.TextArea rows={2} placeholder="Nhập lý do nghiệp vụ..." />
                        </Form.Item>

                        <Button
                          type="primary"
                          size="large"
                          htmlType="submit"
                          loading={updateRoleMutation.isPending}
                          block
                        >
                          Lưu thông tin vai trò
                        </Button>
                      </Form>
                    </div>
                  </div>
                )}

                {/* Sub-Tab 3: Soft Delete Role */}
                {matrixDrawerTab === 'delete' && (
                  <div className="p-5 max-w-xl">
                    <div className="admin-surface p-5 border-l-4 border-solid border-red-500">
                      <Typography.Title level={4} className="!text-red-700 !mb-2">
                        Ngừng sử dụng vai trò (Soft Delete)
                      </Typography.Title>
                      <Typography.Paragraph className="text-slate-600 text-sm">
                        Sau khi xóa, vai trò sẽ bị vô hiệu hóa hoàn toàn và không thể gán mới cho người dùng.
                      </Typography.Paragraph>

                      {roleDetail.activeAssignmentCount > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message={`Hiện đang có ${roleDetail.activeAssignmentCount} người dùng đang dùng vai trò này!`}
                          description="Theo quy tắc an toàn, bạn phải thu hồi vai trò khỏi tất cả người dùng trước khi thực hiện xóa."
                          className="mb-4"
                        />
                      )}

                      <Form
                        form={deleteRoleForm}
                        layout="vertical"
                        onFinish={({ reason }) => deleteRoleMutation.mutate(reason)}
                      >
                        <Form.Item
                          name="reason"
                          label="Lý do ngừng sử dụng vai trò (Bắt buộc)"
                          rules={[{ required: true, whitespace: true, message: 'Nhập lý do xóa vai trò.' }]}
                        >
                          <Input.TextArea rows={3} placeholder="VD: Vai trò không còn phù hợp với cơ cấu tổ chức mới..." />
                        </Form.Item>

                        <Button
                          danger
                          type="primary"
                          size="large"
                          htmlType="submit"
                          icon={<DeleteOutlined />}
                          loading={deleteRoleMutation.isPending}
                          disabled={roleDetail.activeAssignmentCount > 0}
                          block
                        >
                          Xác nhận ngừng sử dụng vai trò
                        </Button>
                      </Form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ── MODAL PROMPT REASON FOR MATRIX SAVE ─────────────────────────────── */}
      <Modal
        open={matrixReasonModalOpen}
        title="Lý do điều chỉnh ma trận quyền"
        okText="Xác nhận lưu"
        cancelText="Hủy"
        confirmLoading={replacePermissionsMutation.isPending}
        onCancel={() => setMatrixReasonModalOpen(false)}
        onOk={() => matrixReasonForm.submit()}
        destroyOnClose
      >
        <Typography.Paragraph className="text-slate-600">
          Mọi thay đổi quyền hạn sẽ có hiệu lực ngay từ request tiếp theo của người dùng được gán vai trò này.
        </Typography.Paragraph>
        <Form
          form={matrixReasonForm}
          layout="vertical"
          preserve={false}
          onFinish={({ reason }) => replacePermissionsMutation.mutate(reason)}
        >
          <Form.Item
            name="reason"
            label="Lý do cập nhật ma trận quyền"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do nghiệp vụ.' },
              { max: 500, message: 'Tối đa 500 ký tự.' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Cập nhật quyền hạn bổ sung phục vụ quy trình đánh giá mới..."
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── EDIT PERMISSION MODAL ─────────────────────────────────────────── */}
      <Modal
        open={Boolean(editingPermission)}
        title={
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <KeyOutlined className="text-blue-600" />
            Cập nhật Quyền hạn
          </div>
        }
        okText="Lưu quyền"
        cancelText="Hủy"
        confirmLoading={updatePermissionMutation.isPending}
        onCancel={() => setEditingPermission(null)}
        onOk={() => editPermForm.submit()}
        destroyOnClose
      >
        {editingPermission && (
          <Form
            form={editPermForm}
            layout="vertical"
            preserve={false}
            onFinish={(v) => updatePermissionMutation.mutate(v)}
            className="pt-2"
          >
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Mã quyền:</span>
                <code className="font-bold text-slate-800">{editingPermission.code}</code>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Resource / Action:</span>
                <span className="font-medium text-slate-700">
                  {editingPermission.resource} / {editingPermission.action}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Được bảo vệ (Protected):</span>
                <span>{editingPermission.isProtected ? 'Có (Cố định)' : 'Không'}</span>
              </div>
            </div>

            <Form.Item
              name="description"
              label="Mô tả quyền"
              rules={[{ max: 500, message: 'Tối đa 500 ký tự.' }]}
            >
              <Input.TextArea rows={3} placeholder="Mô tả ý nghĩa và phạm vi của quyền này" />
            </Form.Item>

            <Form.Item
              name="isActive"
              label="Trạng thái hoạt động"
              valuePropName="checked"
              extra={
                editingPermission.isProtected ? (
                  <span className="text-xs text-amber-700">
                    * Quyền protected của hệ thống không thể bị tắt.
                  </span>
                ) : undefined
              }
            >
              <Switch
                disabled={editingPermission.isProtected}
                checkedChildren="Hoạt động"
                unCheckedChildren="Vô hiệu"
              />
            </Form.Item>

            <Form.Item
              name="reason"
              label="Lý do điều chỉnh (Bắt buộc)"
              rules={[
                { required: true, whitespace: true, message: 'Vui lòng nhập lý do thay đổi quyền.' },
                { max: 500, message: 'Tối đa 500 ký tự.' },
              ]}
            >
              <Input.TextArea rows={2} placeholder="Nhập lý do nghiệp vụ..." showCount maxLength={500} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default AdminRolesPermissionsPage;
