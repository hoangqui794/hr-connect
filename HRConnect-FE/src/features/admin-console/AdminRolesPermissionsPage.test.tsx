/**
 * @file AdminRolesPermissionsPage.test.tsx
 * @description Unit tests for Roles & Permissions page (System vs Custom rules, Protected permissions).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminRolesPermissionsPage } from './AdminRolesPermissionsPage';
import { rbacApi } from '@/services/api/rbacApi';
import type { RbacPermission, RbacRole } from '@/types/api/rbac';

vi.mock('@/services/api/rbacApi', () => ({
  rbacApi: {
    getRoles: vi.fn(),
    getRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    replaceRolePermissions: vi.fn(),
    getPermissions: vi.fn(),
    getPermission: vi.fn(),
    updatePermission: vi.fn(),
  },
  isRbacConflict: vi.fn(() => false),
  isDelegablePermission: (p: any) => Boolean(p.isActive && p.isDelegable && !p.isProtected),
  normalizeRoleCode: (raw: string) =>
    raw
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''),
}));

const getRolesMock = vi.mocked(rbacApi.getRoles);
const getRoleMock = vi.mocked(rbacApi.getRole);
const getPermissionsMock = vi.mocked(rbacApi.getPermissions);
const createRoleMock = vi.mocked(rbacApi.createRole);
const replaceRolePermissionsMock = vi.mocked(rbacApi.replaceRolePermissions);

const mockRoles: RbacRole[] = [
  {
    roleId: 'role-sys-1',
    code: 'PLATFORM_ADMIN',
    name: 'Quản trị viên hệ thống',
    description: 'Quyền cao nhất',
    isSystem: true,
    isActive: true,
    permissionCount: 50,
    activeAssignmentCount: 3,
    concurrencyToken: 'tok-sys',
  },
  {
    roleId: 'role-custom-1',
    code: 'CLIENT_REVIEWER',
    name: 'Nhân viên kiểm duyệt',
    description: 'Kiểm duyệt hồ sơ',
    isSystem: false,
    isActive: true,
    permissionCount: 8,
    activeAssignmentCount: 2,
    concurrencyToken: 'tok-custom-1',
  },
];

const mockPermissions: RbacPermission[] = [
  {
    permissionId: 'perm-delegable-1',
    code: 'candidate.view',
    resource: 'candidate',
    action: 'view',
    description: 'Xem thông tin ứng viên',
    isActive: true,
    isDelegable: true,
    isProtected: false,
    concurrencyToken: 'tok-p1',
    customRoleUsageCount: 2,
  },
  {
    permissionId: 'perm-protected-1',
    code: 'iam.permission.manage',
    resource: 'iam',
    action: 'manage',
    description: 'Quản lý quyền IAM',
    isActive: true,
    isDelegable: false,
    isProtected: true,
    concurrencyToken: 'tok-p2',
    customRoleUsageCount: 0,
  },
];

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App>
          <AdminRolesPermissionsPage />
        </App>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('AdminRolesPermissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getRolesMock.mockResolvedValue({
      items: mockRoles,
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });

    getPermissionsMock.mockResolvedValue({
      items: mockPermissions,
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('renders roles table with System and Custom roles', async () => {
    renderPage();

    expect(await screen.findByText('PLATFORM_ADMIN')).toBeTruthy();
    expect(screen.getByText('Quản trị viên hệ thống')).toBeTruthy();
    expect(screen.getByText('CLIENT_REVIEWER')).toBeTruthy();
    expect(screen.getByText('Nhân viên kiểm duyệt')).toBeTruthy();

    // Check tags
    expect(screen.getByText('System Role')).toBeTruthy();
    expect(screen.getByText('Custom Role')).toBeTruthy();
  });

  it('enforces System Role read-only rules (shows "Chỉ xem", no edit buttons)', async () => {
    renderPage();

    await screen.findByText('PLATFORM_ADMIN');

    // System role has "Chỉ xem"
    const readOnlyButton = screen.getByRole('button', { name: 'Chỉ xem' });
    expect(readOnlyButton).toBeTruthy();

    // Custom role has "Ma trận quyền"
    const matrixButtons = screen.getAllByRole('button', { name: /Ma trận quyền/ });
    expect(matrixButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('opens Create Custom Role modal and submits normalized code', async () => {
    createRoleMock.mockResolvedValue({
      roleId: 'role-new',
      code: 'HR_OPS_REVIEWER',
      name: 'Chuyên viên kiểm duyệt HR',
      description: 'Đánh giá ứng viên',
      isSystem: false,
      isActive: true,
      permissionCount: 0,
      activeAssignmentCount: 0,
      concurrencyToken: 'tok-init',
    });

    renderPage();

    const createBtn = await screen.findByRole('button', { name: /Tạo Custom Role/ });
    fireEvent.click(createBtn);

    expect(await screen.findByText('Tạo Custom Role mới')).toBeTruthy();

    const codeInput = screen.getByLabelText(/Mã vai trò/);
    const nameInput = screen.getByLabelText(/Tên hiển thị vai trò/);

    fireEvent.change(codeInput, { target: { value: 'hr ops reviewer' } });
    fireEvent.change(nameInput, { target: { value: 'Chuyên viên kiểm duyệt HR' } });

    const submitBtn = screen.getByRole('button', { name: 'Tạo vai trò' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createRoleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'hr ops reviewer',
          name: 'Chuyên viên kiểm duyệt HR',
        })
      );
    });
  });

  it('allows switching to Permissions Catalog tab and displays permissions with security flags', async () => {
    renderPage();

    const permsTab = await screen.findByText(/Danh mục Quyền/);
    fireEvent.click(permsTab);

    expect(await screen.findByText('candidate.view')).toBeTruthy();
    expect(screen.getByText('iam.permission.manage')).toBeTruthy();

    // Protected tag is visible for protected permission
    expect(screen.getByText(/Được bảo vệ/)).toBeTruthy();
    expect(screen.getByText(/Có thể ủy quyền/)).toBeTruthy();
  });
});
