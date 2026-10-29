/**
 * @file AdminUserAuthorizationPage.tsx
 * @description Admin · User Authorization Management (/admin/user-authorization).
 * Allows platform admins to inspect effective permissions with sourceRoles,
 * assign active custom roles, and revoke custom roles with required business reasons.
 * Complies strictly with all security rules in FRONTEND-INTEGRATION.md.
 */
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App as AntApp,
  Badge,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { adminUsersApi } from '@/services/api/adminApi';
import { isRbacConflict, isSelfRoleMutationForbidden, rbacApi } from '@/services/api/rbacApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { useAuthStore } from '@/stores/authStore';
import type {
  RbacEffectivePermission,
  RbacUserAuthorization,
  RbacUserRoleAssignment,
} from '@/types/api/rbac';
import { adminTokens, formatDateTime } from './adminTheme';
import { Initials, PageHero, PersonCell, StatusDot, Surface } from './ui';

interface SystemRoleMatrixItem {
  code: string;
  name: string;
  badgeClass: string;
  description: string;
  scope: string;
  permissions: string[];
}

const USER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  PENDING: 'Chờ kích hoạt',
  SUSPENDED: 'Tạm khóa',
  LOCKED: 'Đã khóa',
  INACTIVE: 'Ngừng hoạt động',
};

const DEFAULT_SYSTEM_MATRIX: SystemRoleMatrixItem[] = [
  {
    code: 'PLATFORM_ADMIN',
    name: 'Quản trị viên',
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200/80',
    description: 'Toàn quyền kiểm soát và quản trị cấu hình nền tảng, phân quyền RBAC, người dùng và đối soát tài chính.',
    scope: 'Toàn hệ thống',
    permissions: ['user.manage', 'role.manage', 'job.manage', 'finance.manage', 'system.configure'],
  },
  {
    code: 'INTERNAL_HR',
    name: 'Nhân sự nội bộ',
    badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    description: 'Kiểm duyệt tin tuyển dụng, điều phối hợp đồng dịch vụ, sàng lọc ứng viên AI và đối soát nhận việc.',
    scope: 'Vận hành tuyển dụng & Hợp đồng',
    permissions: ['job.review', 'agreement.manage', 'screening.review', 'placement.reconcile'],
  },
  {
    code: 'CLIENT_COMPANY_USER',
    name: 'Doanh nghiệp tuyển dụng',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200/80',
    description: 'Đăng tin tuyển dụng, quản lý quy trình phỏng vấn, ký kết thỏa thuận dịch vụ & kích hoạt bảo hành.',
    scope: 'Không gian Doanh nghiệp',
    permissions: ['job.create', 'candidate.view', 'interview.schedule', 'warranty.claim'],
  },
  {
    code: 'AFFILIATE_RECRUITER',
    name: 'Cộng tác viên / Headhunter',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    description: 'Tìm kiếm nguồn ứng viên, nộp hồ sơ vào tin tuyển dụng mở, theo dõi hoa hồng và yêu cầu quyết toán.',
    scope: 'Mạng lưới tuyển dụng',
    permissions: ['candidate.submit', 'commission.view', 'payout.request', 'dispute.create'],
  },
  {
    code: 'CANDIDATE',
    name: 'Ứng viên',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    description: 'Ứng tuyển việc làm, khởi tạo CV trực tuyến, nhận gợi ý việc làm phù hợp từ AI và quản lý hồ sơ cá nhân.',
    scope: 'Cá nhân ứng viên',
    permissions: ['job.apply', 'cv.manage', 'profile.update'],
  },
];

export const AdminUserAuthorizationPage: React.FC = () => {
  const { message } = AntApp.useApp();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Logged-in admin user to prevent self-role mutations
  const currentUser = useAuthStore((s) => s.user);

  // Selected User ID from URL search param
  const selectedUserId = searchParams.get('userId') || undefined;

  const setSelectedUserId = (id?: string) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('userId', id);
    else next.delete('userId');
    setSearchParams(next);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // USER SEARCH / LIST QUERY
  // ───────────────────────────────────────────────────────────────────────────

  const [userSearchText, setUserSearchText] = useState('');

  const usersListQuery = useQuery({
    queryKey: ['admin-rbac-user-select-list', userSearchText],
    queryFn: () =>
      adminUsersApi.list({
        search: userSearchText || undefined,
        page: 1,
        pageSize: 30,
      }),
  });

  // Selected user detail for authorization
  const authQuery = useQuery({
    queryKey: ['admin-rbac-user-authorization', selectedUserId],
    queryFn: () => rbacApi.getUserAuthorization(selectedUserId as string),
    enabled: Boolean(selectedUserId),
  });

  // Active custom roles available for assignment
  const activeCustomRolesQuery = useQuery({
    queryKey: ['admin-rbac-available-custom-roles'],
    queryFn: () => rbacApi.getRoles({ isSystem: false, isActive: true, pageSize: 100 }),
    enabled: Boolean(selectedUserId),
  });

  const authData: RbacUserAuthorization | undefined = authQuery.data;

  // Self-mutation check
  const isSelf = useMemo(() => {
    if (!currentUser || !authData) return false;
    return (
      currentUser.id === authData.userId ||
      currentUser.email?.toLowerCase() === authData.email.toLowerCase()
    );
  }, [currentUser, authData]);

  // Modals state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm] = Form.useForm<{ roleId: string; reason: string }>();

  const [revokeRole, setRevokeRole] = useState<RbacUserRoleAssignment | null>(null);
  const [revokeForm] = Form.useForm<{ reason: string }>();

  const [reactivateRole, setReactivateRole] = useState<RbacUserRoleAssignment | null>(null);
  const [reactivateForm] = Form.useForm<{ reason: string }>();

  // Filter effective permissions
  const [permFilterSearch, setPermFilterSearch] = useState('');
  const [permFilterResource, setPermFilterResource] = useState<string>();

  // ───────────────────────────────────────────────────────────────────────────
  // MUTATIONS
  // ───────────────────────────────────────────────────────────────────────────

  const handleConflictRefresh = () => {
    message.warning(
      'Dữ liệu phân quyền đã bị thay đổi bởi người khác. Hệ thống đã tự động làm mới dữ liệu mới nhất. Vui lòng thao tác lại.'
    );
    queryClient.invalidateQueries({ queryKey: ['admin-rbac-user-authorization', selectedUserId] });
  };

  const assignRoleMutation = useMutation({
    mutationFn: (values: { roleId: string; reason: string }) => {
      if (!selectedUserId || !authData) throw new Error('Chưa chọn người dùng.');
      return rbacApi.assignUserRole(selectedUserId, {
        roleId: values.roleId,
        concurrencyToken: authData.authorizationConcurrencyToken,
        reason: values.reason,
      });
    },
    onSuccess: (updated) => {
      message.success('Đã gán vai trò thành công cho người dùng.');
      setAssignModalOpen(false);
      assignForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', selectedUserId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        message.error('Quản trị viên không được phép tự phân quyền cho chính mình.');
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!selectedUserId || !authData || !revokeRole) throw new Error('Dữ liệu không hợp lệ.');
      return rbacApi.revokeUserRole(selectedUserId, revokeRole.roleId, {
        concurrencyToken: authData.authorizationConcurrencyToken,
        reason,
      });
    },
    onSuccess: (updated) => {
      message.success(`Đã thu hồi vai trò ${revokeRole?.roleName} khỏi người dùng.`);
      setRevokeRole(null);
      revokeForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', selectedUserId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        message.error('Quản trị viên không được phép tự thu hồi vai trò của chính mình.');
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  const reactivateRoleMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!selectedUserId || !authData || !reactivateRole) throw new Error('Dữ liệu không hợp lệ.');
      return rbacApi.assignUserRole(selectedUserId, {
        roleId: reactivateRole.roleId,
        concurrencyToken: authData.authorizationConcurrencyToken,
        reason,
      });
    },
    onSuccess: (updated) => {
      message.success(`Đã kích hoạt lại vai trò ${reactivateRole?.roleName} cho người dùng.`);
      setReactivateRole(null);
      reactivateForm.resetFields();
      queryClient.setQueryData(['admin-rbac-user-authorization', selectedUserId], updated);
      queryClient.invalidateQueries({ queryKey: ['admin-rbac-roles'] });
    },
    onError: (err) => {
      if (isRbacConflict(err)) {
        handleConflictRefresh();
      } else if (isSelfRoleMutationForbidden(err)) {
        message.error('Quản trị viên không được phép tự phân quyền cho chính mình.');
      } else {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  // Filtered effective permissions
  const filteredEffectivePermissions = useMemo(() => {
    if (!authData?.effectivePermissions) return [];
    return authData.effectivePermissions.filter((p) => {
      const matchSearch =
        !permFilterSearch ||
        p.code.toLowerCase().includes(permFilterSearch.toLowerCase()) ||
        p.description?.toLowerCase().includes(permFilterSearch.toLowerCase()) ||
        p.resource.toLowerCase().includes(permFilterSearch.toLowerCase());
      const matchResource = !permFilterResource || p.resource === permFilterResource;
      return matchSearch && matchResource;
    });
  }, [authData?.effectivePermissions, permFilterSearch, permFilterResource]);

  const uniqueResources = useMemo(() => {
    if (!authData?.effectivePermissions) return [];
    return Array.from(new Set(authData.effectivePermissions.map((p) => p.resource)));
  }, [authData?.effectivePermissions]);

  // Available roles for assignment (excluding already ACTIVE custom roles)
  const assignableRoles = useMemo(() => {
    const activeAssignedRoleIds = new Set(
      authData?.roles?.filter((r) => r.status === 'ACTIVE').map((r) => r.roleId) ?? []
    );
    return (activeCustomRolesQuery.data?.items ?? []).filter(
      (r) => !activeAssignedRoleIds.has(r.roleId)
    );
  }, [activeCustomRolesQuery.data, authData?.roles]);

  // ───────────────────────────────────────────────────────────────────────────
  // TABLE COLUMNS: USER ROLES
  // ───────────────────────────────────────────────────────────────────────────

  const roleColumns: ColumnsType<RbacUserRoleAssignment> = [
    {
      title: 'Vai trò',
      key: 'role',
      render: (_, r) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{r.roleName}</span>
            <code
              style={{ fontFamily: adminTokens.mono }}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
            >
              {r.roleCode}
            </code>
          </div>
          {r.assignReason && (
            <div className="text-xs text-slate-500 mt-0.5">
              Lý do gán: <span className="italic">{r.assignReason}</span>
            </div>
          )}
          {r.revokeReason && (
            <div className="text-xs text-red-500 mt-0.5">
              Lý do thu hồi: <span className="italic">{r.revokeReason}</span>
            </div>
          )}
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
          <Tag color="blue" icon={<LockOutlined />}>
            System Role
          </Tag>
        ) : (
          <Tag color="green" icon={<SafetyCertificateOutlined />}>
            Custom Role
          </Tag>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => {
        const isActive = status === 'ACTIVE';
        return (
          <StatusDot tone={isActive ? 'success' : 'danger'}>
            {isActive ? 'Hoạt động' : 'Đã thu hồi'}
          </StatusDot>
        );
      },
    },
    {
      title: 'Lịch sử gán / Thu hồi',
      key: 'history',
      width: 220,
      render: (_, r) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div>
            Gán: {formatDateTime(r.assignedAt)}
            {r.assignedByEmail && <span className="text-slate-400"> ({r.assignedByEmail})</span>}
          </div>
          {r.revokedAt && (
            <div className="text-red-600">
              Thu hồi: {formatDateTime(r.revokedAt)}
              {r.revokedByEmail && <span className="text-red-400"> ({r.revokedByEmail})</span>}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 128,
      align: 'right',
      className: 'w-32 text-right pr-4',
      render: (_, r) => {
        if (r.isSystem) {
          return (
            <Tooltip title="System Role do quy trình hệ thống quản lý, không thể thu hồi tại đây.">
              <Tag color="default">Cố định</Tag>
            </Tooltip>
          );
        }

        if (r.status === 'ACTIVE') {
          return (
            <Button
              danger
              size="small"
              icon={<StopOutlined />}
              disabled={isSelf}
              onClick={() => {
                setRevokeRole(r);
                revokeForm.resetFields();
              }}
            >
              Thu hồi
            </Button>
          );
        }

        return (
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            disabled={isSelf || authData?.status !== 'ACTIVE'}
            onClick={() => {
              setReactivateRole(r);
              reactivateForm.resetFields();
            }}
          >
            Kích hoạt lại
          </Button>
        );
      },
    },
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // TABLE COLUMNS: EFFECTIVE PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────────

  const permissionColumns: ColumnsType<RbacEffectivePermission> = [
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
      title: 'Mô tả quyền',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string | null) => (
        <span className="text-[13px] text-slate-700">{desc || '—'}</span>
      ),
    },
    {
      title: 'Nguồn gốc quyền',
      dataIndex: 'sourceRoles',
      key: 'sourceRoles',
      width: 280,
      render: (sourceRoles: string[]) => (
        <div className="flex flex-wrap gap-1.5">
          {sourceRoles?.map((role) => (
            <Tag key={role} color="geekblue" className="font-semibold text-xs">
              {role}
            </Tag>
          ))}
          {(!sourceRoles || sourceRoles.length === 0) && <span className="text-slate-400">—</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHero
        eyebrow="Quản trị truy cập"
        title="Phân quyền người dùng"
        description="Tra cứu quyền hiệu lực, gán Custom Role và thu hồi vai trò bổ sung cho từng người dùng trên nền tảng."
        actions={
          selectedUserId && (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ['admin-rbac-user-authorization', selectedUserId],
                });
              }}
            >
              Làm mới quyền
            </Button>
          )
        }
      />

      {/* User Selector Card */}
      <Surface className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[280px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Chọn người dùng để kiểm tra & phân quyền
            </label>
            <Select
              showSearch
              allowClear
              size="large"
              placeholder="Nhập tên hoặc email người dùng..."
              className="w-full max-w-lg"
              value={selectedUserId}
              filterOption={false}
              onSearch={(val) => setUserSearchText(val.trim())}
              onChange={(val) => setSelectedUserId(val)}
              loading={usersListQuery.isLoading}
              options={(usersListQuery.data?.items ?? []).map((u) => ({
                value: u.userId,
                label: `${u.displayName ? `${u.displayName} (${u.email})` : u.email} — ${USER_STATUS_LABEL[u.status] ?? u.status}`,
              }))}
            />
          </div>

          {selectedUserId && (
            <Button onClick={() => setSelectedUserId(undefined)}>Chọn người dùng khác</Button>
          )}
        </div>
      </Surface>

      {/* Main Content Area */}
      {!selectedUserId ? (
        <div className="space-y-5">
          <Surface className="p-4 border-l-4 border-l-blue-600 bg-blue-50/30">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <KeyOutlined className="text-base" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  Chưa chọn người dùng
                </div>
                <div className="font-bold text-slate-900 text-sm">Tra cứu Ma trận Vai trò & Quyền hạn Hệ thống</div>
                <div className="text-xs text-slate-500">
                  Chọn một người dùng từ thanh tìm kiếm ở trên để cấu hình phân quyền chi tiết. Dưới đây là ma trận đặc quyền và phạm vi trách nhiệm mặc định của hệ thống để tra cứu nhanh.
                </div>
              </div>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <SafetyCertificateOutlined className="text-base text-blue-600" />
                <span className="text-base font-bold text-slate-900">Ma trận vai trò mặc định (System Roles)</span>
                <Badge count={DEFAULT_SYSTEM_MATRIX.length} style={{ backgroundColor: '#2563EB' }} />
              </div>
              <span className="text-xs text-slate-500">Quy tắc RBAC chuẩn hóa</span>
            </div>

            <Table<SystemRoleMatrixItem>
              className="admin-soft-table w-full table-auto"
              rowKey="code"
              dataSource={DEFAULT_SYSTEM_MATRIX}
              pagination={false}
              columns={[
                {
                  title: 'Mã vai trò',
                  dataIndex: 'code',
                  key: 'code',
                  width: 200,
                  render: (code: string) => (
                    <code
                      style={{ fontFamily: adminTokens.mono }}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800"
                    >
                      {code}
                    </code>
                  ),
                },
                {
                  title: 'Vai trò hiển thị',
                  key: 'name',
                  width: 220,
                  render: (_, r) => (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${r.badgeClass}`}
                    >
                      {r.name}
                    </span>
                  ),
                },
                {
                  title: 'Mô tả & Phạm vi quyền hạn',
                  key: 'desc',
                  render: (_, r) => (
                    <div>
                      <div className="text-xs text-slate-700 leading-relaxed">{r.description}</div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <span>Phạm vi:</span>
                        <strong className="text-slate-600">{r.scope}</strong>
                      </div>
                    </div>
                  ),
                },
                {
                  title: 'Quyền hạn cơ sở',
                  dataIndex: 'permissions',
                  key: 'perms',
                  width: 280,
                  render: (perms: string[]) => (
                    <div className="flex flex-wrap gap-1">
                      {perms.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600 border border-slate-200/80"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  ),
                },
                {
                  title: 'Phân loại',
                  key: 'type',
                  width: 140,
                  align: 'right',
                  render: () => (
                    <Tag color="blue" icon={<LockOutlined />} className="m-0 font-medium text-xs">
                      System Role
                    </Tag>
                  ),
                },
              ]}
            />
          </Surface>
        </div>
      ) : authQuery.isLoading ? (
        <Surface className="p-8">
          <Skeleton active avatar paragraph={{ rows: 8 }} />
        </Surface>
      ) : authQuery.isError || !authData ? (
        <Surface className="p-6">
          <Alert
            type="error"
            showIcon
            message="Không thể tải dữ liệu phân quyền người dùng"
            description={getApiErrorMessage(authQuery.error)}
            action={
              <Button size="small" onClick={() => authQuery.refetch()}>
                Thử lại
              </Button>
            }
          />
        </Surface>
      ) : (
        <div className="space-y-6">
          {/* User Info Header Card */}
          <Surface className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Initials name={authData.email} size={48} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{authData.email}</span>
                    <StatusDot tone={authData.status === 'ACTIVE' ? 'success' : 'danger'}>
                      {USER_STATUS_LABEL[authData.status] ?? authData.status}
                    </StatusDot>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>Mã định danh: <code>{authData.userId}</code></span>
                    <span>•</span>
                    <span>
                      Token: <code className="font-mono text-slate-600">{authData.authorizationConcurrencyToken?.slice(0, 8)}…</code>
                    </span>
                  </div>
                </div>
              </div>

              {/* Assign custom role button */}
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                disabled={isSelf || authData.status !== 'ACTIVE'}
                onClick={() => {
                  assignForm.resetFields();
                  setAssignModalOpen(true);
                }}
              >
                Gán Custom Role mới
              </Button>
            </div>

            {/* Self-mutation warning alert */}
            {isSelf && (
              <Alert
                type="warning"
                showIcon
                icon={<ExclamationCircleOutlined />}
                message="Chế độ bảo vệ tài khoản cá nhân"
                description="Bạn đang mở thông tin phân quyền của chính mình. Theo quy định bảo mật hệ thống, Quản trị viên không thể tự gán hoặc tự thu hồi vai trò của chính mình."
                className="mt-4"
              />
            )}

            {authData.status !== 'ACTIVE' && (
              <Alert
                type="info"
                showIcon
                message="Tài khoản chưa ACTIVE"
                description="Người dùng này hiện không ở trạng thái ACTIVE, do đó không thể gán thêm vai trò mới."
                className="mt-4"
              />
            )}
          </Surface>

          {/* Section 1: Assigned Roles */}
          <Surface>
            <div className="flex items-center justify-between border-0 border-b border-solid border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <SafetyCertificateOutlined className="text-base text-emerald-600" />
                <span className="text-base font-bold text-slate-900">Vai trò được gán</span>
                <Badge
                  count={authData.roles?.length ?? 0}
                  style={{ backgroundColor: '#2563EB' }}
                />
              </div>
            </div>

            <Table<RbacUserRoleAssignment>
              className="admin-soft-table w-full table-auto"
              rowKey={(r) => `${r.roleId}_${r.status}`}
              columns={roleColumns}
              dataSource={authData.roles ?? []}
              pagination={false}
              locale={{ emptyText: <div className="py-8 text-slate-500">Chưa được gán vai trò nào.</div> }}
            />
          </Surface>

          {/* Section 2: Effective Permissions with sourceRoles */}
          <Surface>
            <div className="border-0 border-b border-solid border-slate-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyOutlined className="text-base text-blue-600" />
                  <span className="text-base font-bold text-slate-900">Quyền hiệu lực tổng hợp</span>
                  <Badge
                    count={authData.effectivePermissions?.length ?? 0}
                    style={{ backgroundColor: '#2563EB' }}
                  />
                </div>
                <div className="text-xs text-slate-500">
                  Quyền hiệu lực được hệ thống tổng hợp và loại trùng từ toàn bộ vai trò ACTIVE.
                </div>
              </div>

              {/* Filter bar */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Input
                  allowClear
                  prefix={<SearchOutlined className="text-slate-400" />}
                  placeholder="Lọc mã quyền hoặc mô tả..."
                  className="max-w-xs"
                  value={permFilterSearch}
                  onChange={(e) => setPermFilterSearch(e.target.value)}
                />
                <Select
                  allowClear
                  placeholder="Mọi phân hệ"
                  className="w-48"
                  value={permFilterResource}
                  onChange={(val) => setPermFilterResource(val)}
                  options={uniqueResources.map((res) => ({ value: res, label: res }))}
                />
                <span className="ml-auto text-xs tabular-nums text-slate-500">
                  Hiển thị {filteredEffectivePermissions.length} / {authData.effectivePermissions?.length ?? 0} quyền
                </span>
              </div>
            </div>

            <Table<RbacEffectivePermission>
              className="admin-soft-table w-full table-auto"
              rowKey="permissionId"
              columns={permissionColumns}
              dataSource={filteredEffectivePermissions}
              pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
              locale={{ emptyText: <div className="py-8 text-slate-500">Không có quyền hiệu lực nào phù hợp.</div> }}
            />
          </Surface>
        </div>
      )}

      {/* ── MODAL: ASSIGN CUSTOM ROLE ────────────────────────────────────── */}
      <Modal
        open={assignModalOpen}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <PlusOutlined className="text-emerald-600" />
            Gán Custom Role cho người dùng
          </div>
        }
        okText="Gán vai trò"
        cancelText="Hủy"
        confirmLoading={assignRoleMutation.isPending}
        onCancel={() => setAssignModalOpen(false)}
        onOk={() => assignForm.submit()}
        destroyOnClose
      >
        <Form
          form={assignForm}
          layout="vertical"
          preserve={false}
          onFinish={(values) => assignRoleMutation.mutate(values)}
          className="pt-2"
        >
          <Form.Item
            name="roleId"
            label="Chọn vai trò tùy chỉnh (Custom Role)"
            rules={[{ required: true, message: 'Vui lòng chọn vai trò.' }]}
          >
            <Select
              placeholder="Chọn vai trò đang hoạt động..."
              loading={activeCustomRolesQuery.isLoading}
              options={assignableRoles.map((r) => ({
                value: r.roleId,
                label: `${r.name} — ${r.permissionCount} quyền`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý do phân công vai trò (Bắt buộc)"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập lý do phân công.' },
              { max: 500, message: 'Tối đa 500 ký tự.' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Bổ nhiệm làm chuyên viên kiểm duyệt hồ sơ theo Quyết định số..."
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── MODAL: REVOKE CUSTOM ROLE ─────────────────────────────────────── */}
      <Modal
        open={Boolean(revokeRole)}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-red-700">
            <StopOutlined />
            Thu hồi Custom Role
          </div>
        }
        okText="Xác nhận thu hồi"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={revokeRoleMutation.isPending}
        onCancel={() => setRevokeRole(null)}
        onOk={() => revokeForm.submit()}
        destroyOnClose
      >
        {revokeRole && (
          <Form
            form={revokeForm}
            layout="vertical"
            preserve={false}
            onFinish={({ reason }) => revokeRoleMutation.mutate(reason)}
            className="pt-2"
          >
            <Typography.Paragraph className="text-slate-600">
              Bạn đang thu hồi vai trò <strong>{revokeRole.roleName}</strong> khỏi tài khoản{' '}
              <strong>{authData?.email}</strong>. Các quyền hạn gắn liền với vai trò này sẽ hết hiệu lực ngay lập tức.
            </Typography.Paragraph>

            <Form.Item
              name="reason"
              label="Lý do thu hồi vai trò (Bắt buộc)"
              rules={[
                { required: true, whitespace: true, message: 'Vui lòng nhập lý do thu hồi.' },
                { max: 500, message: 'Tối đa 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="VD: Kết thúc thời gian luân chuyển vị trí, thu hồi quyền kiểm duyệt..."
                showCount
                maxLength={500}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* ── MODAL: REACTIVATE CUSTOM ROLE ─────────────────────────────────── */}
      <Modal
        open={Boolean(reactivateRole)}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CheckCircleOutlined className="text-emerald-600" />
            Kích hoạt lại Custom Role
          </div>
        }
        okText="Kích hoạt lại"
        cancelText="Hủy"
        confirmLoading={reactivateRoleMutation.isPending}
        onCancel={() => setReactivateRole(null)}
        onOk={() => reactivateForm.submit()}
        destroyOnClose
      >
        {reactivateRole && (
          <Form
            form={reactivateForm}
            layout="vertical"
            preserve={false}
            onFinish={({ reason }) => reactivateRoleMutation.mutate(reason)}
            className="pt-2"
          >
            <Typography.Paragraph className="text-slate-600">
              Kích hoạt lại vai trò <strong>{reactivateRole.roleName}</strong> cho người dùng{' '}
              <strong>{authData?.email}</strong>.
            </Typography.Paragraph>

            <Form.Item
              name="reason"
              label="Lý do kích hoạt lại vai trò (Bắt buộc)"
              rules={[
                { required: true, whitespace: true, message: 'Vui lòng nhập lý do kích hoạt lại.' },
                { max: 500, message: 'Tối đa 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="VD: Tiếp tục phân công nhiệm vụ kiểm duyệt hồ sơ..."
                showCount
                maxLength={500}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default AdminUserAuthorizationPage;
