/**
 * @file AdminUserAuthorizationPage.test.tsx
 * @description Unit tests for User Authorization page (sourceRoles display, self-mutation guard, assign/revoke).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUserAuthorizationPage } from './AdminUserAuthorizationPage';
import { adminUsersApi } from '@/services/api/adminApi';
import { rbacApi } from '@/services/api/rbacApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { RbacUserAuthorization } from '@/types/api/rbac';

vi.mock('@/services/api/adminApi', () => ({
  adminUsersApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/services/api/rbacApi', () => ({
  rbacApi: {
    getUserAuthorization: vi.fn(),
    getRoles: vi.fn(),
    assignUserRole: vi.fn(),
    revokeUserRole: vi.fn(),
  },
  isRbacConflict: vi.fn(() => false),
  isSelfRoleMutationForbidden: vi.fn(() => false),
}));

const usersListMock = vi.mocked(adminUsersApi.list);
const getUserAuthMock = vi.mocked(rbacApi.getUserAuthorization);
const getRolesMock = vi.mocked(rbacApi.getRoles);
const assignRoleMock = vi.mocked(rbacApi.assignUserRole);
const revokeRoleMock = vi.mocked(rbacApi.revokeUserRole);

const mockUserAuth: RbacUserAuthorization = {
  userId: 'target-user-1',
  email: 'employee1@example.com',
  status: 'ACTIVE',
  authorizationConcurrencyToken: 'tok-auth-1',
  roles: [
    {
      assignmentId: 'assign-sys',
      roleId: 'role-sys-1',
      roleCode: 'CLIENT_COMPANY_USER',
      roleName: 'Doanh nghiệp tuyển dụng',
      isSystem: true,
      status: 'ACTIVE',
      assignedAt: '2026-10-01T00:00:00Z',
      assignedByEmail: 'system@hrconnect.io',
      assignReason: 'Đăng ký tài khoản',
    },
    {
      assignmentId: 'assign-custom',
      roleId: 'role-custom-1',
      roleCode: 'CLIENT_REVIEWER',
      roleName: 'Nhân viên kiểm duyệt hồ sơ',
      isSystem: false,
      status: 'ACTIVE',
      assignedAt: '2026-10-05T00:00:00Z',
      assignedByEmail: 'admin@hrconnect.io',
      assignReason: 'Bổ nhiệm kiểm duyệt',
    },
  ],
  effectivePermissions: [
    {
      permissionId: 'perm-1',
      code: 'candidate.view',
      resource: 'candidate',
      action: 'view',
      description: 'Xem hồ sơ ứng viên',
      sourceRoles: ['CLIENT_COMPANY_USER', 'CLIENT_REVIEWER'],
    },
    {
      permissionId: 'perm-2',
      code: 'screening.manage',
      resource: 'screening',
      action: 'manage',
      description: 'Đánh giá sơ loại hồ sơ',
      sourceRoles: ['CLIENT_REVIEWER'],
    },
  ],
};

const renderPage = (initialUrl = '/admin/user-authorization') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <App>
          <Routes>
            <Route path="/admin/user-authorization" element={<AdminUserAuthorizationPage />} />
          </Routes>
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AdminUserAuthorizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.setState({
      role: UserRole.ADMIN,
      user: {
        id: 'admin-current-user',
        email: 'admin@hrconnect.io',
        name: 'Quản trị viên',
        role: UserRole.ADMIN,
      },
      isAuthenticated: true,
    });

    usersListMock.mockResolvedValue({
      items: [
        {
          userId: 'target-user-1',
          email: 'employee1@example.com',
          displayName: 'Nhân viên 1',
          status: 'ACTIVE',
          roles: ['CLIENT_COMPANY_USER' as any],
          isLoginLocked: false,
          lastLoginAt: null,
          createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ],
      page: 1,
      pageSize: 30,
      total: 1,
      totalPages: 1,
    });

    getUserAuthMock.mockResolvedValue(mockUserAuth);

    getRolesMock.mockResolvedValue({
      items: [
        {
          roleId: 'role-custom-2',
          code: 'FINANCE_AUDITOR',
          name: 'Kiểm toán tài chính',
          description: 'Soát xét thanh toán',
          isSystem: false,
          isActive: true,
          permissionCount: 3,
          activeAssignmentCount: 0,
          concurrencyToken: 'tok-r2',
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    });
  });

  it('renders prompt when no user is selected', () => {
    renderPage('/admin/user-authorization');
    expect(screen.getByText('Chưa chọn người dùng')).toBeTruthy();
  });

  it('loads user authorization details and displays roles and effective permissions with sourceRoles', async () => {
    renderPage('/admin/user-authorization?userId=target-user-1');

    // Header user info
    expect(await screen.findByText('employee1@example.com')).toBeTruthy();

    // Roles section
    expect(screen.getByText('Doanh nghiệp tuyển dụng')).toBeTruthy();
    expect(screen.getByText('Nhân viên kiểm duyệt hồ sơ')).toBeTruthy();

    // System role shows "Cố định", Custom role has "Thu hồi"
    expect(screen.getByText('Cố định')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Thu hồi/ })).toBeTruthy();

    // Effective permissions section with sourceRoles
    expect(screen.getByText('candidate.view')).toBeTruthy();
    expect(screen.getByText('screening.manage')).toBeTruthy();

    // Check that sourceRoles tags are displayed
    expect(screen.getAllByText('CLIENT_REVIEWER').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CLIENT_COMPANY_USER').length).toBeGreaterThanOrEqual(1);
  });

  it('enforces self-role mutation prevention when logged-in admin views themselves', async () => {
    // Current user email matches target user email
    useAuthStore.setState({
      role: UserRole.ADMIN,
      user: {
        id: 'target-user-1',
        email: 'employee1@example.com',
        name: 'Nhân viên 1 (Self)',
        role: UserRole.ADMIN,
      },
      isAuthenticated: true,
    });

    renderPage('/admin/user-authorization?userId=target-user-1');

    await screen.findByText('employee1@example.com');

    // Shows self protection banner
    expect(screen.getByText('Chế độ bảo vệ tài khoản cá nhân')).toBeTruthy();

    // Assign button is disabled
    const assignBtn = screen.getByRole('button', { name: /Gán Custom Role mới/ });
    expect(assignBtn).toBeDisabled();

    // Revoke button is disabled
    const revokeBtn = screen.getByRole('button', { name: /Thu hồi/ });
    expect(revokeBtn).toBeDisabled();
  });

  it('allows opening Assign Custom Role modal for another user', async () => {
    renderPage('/admin/user-authorization?userId=target-user-1');

    await screen.findByText('employee1@example.com');
    const assignBtn = await screen.findByRole('button', { name: /Gán Custom Role mới/ });
    expect(assignBtn).not.toBeDisabled();
    fireEvent.click(assignBtn);

    expect(await screen.findByText('Gán Custom Role cho người dùng')).toBeTruthy();
    expect(screen.getByLabelText(/Lý do phân công/)).toBeTruthy();
  });

  it('allows opening Revoke Custom Role modal and confirms revoke', async () => {
    revokeRoleMock.mockResolvedValue({
      ...mockUserAuth,
      authorizationConcurrencyToken: 'tok-auth-2',
      roles: [],
    });

    renderPage('/admin/user-authorization?userId=target-user-1');

    await screen.findByText('employee1@example.com');
    const revokeBtn = await screen.findByRole('button', { name: /Thu hồi/ });
    fireEvent.click(revokeBtn);

    expect(await screen.findByText('Thu hồi Custom Role')).toBeTruthy();

    const reasonInput = screen.getByLabelText(/Lý do thu hồi vai trò/);
    fireEvent.change(reasonInput, { target: { value: 'Kết thúc nhiệm kỳ kiểm duyệt' } });

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận thu hồi' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(revokeRoleMock).toHaveBeenCalledWith(
        'target-user-1',
        'role-custom-1',
        expect.objectContaining({
          concurrencyToken: 'tok-auth-1',
          reason: 'Kết thúc nhiệm kỳ kiểm duyệt',
        })
      );
    });
  });
});
