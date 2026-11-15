import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDashboardRouteForRole, ProtectedRoute, ROLE_DASHBOARD_ROUTES, ROUTE_ACCESS } from './AppRoutes';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const renderProtected = (requiredPermissions: string[] = []) =>
  render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute
              requiredRoles={[UserRole.CANDIDATE]}
              requiredPermissions={requiredPermissions}
              redirectTo="/forbidden"
            >
              <div>Protected content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/forbidden" element={<div>Forbidden</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      role: UserRole.AFFILIATE,
      isAuthenticated: true,
      user: {
        id: 'multi-role-user',
        name: 'Multi Role',
        email: 'multi@example.com',
        role: UserRole.AFFILIATE,
        roles: ['AFFILIATE', 'CANDIDATE'],
        permissions: ['application.create'],
      },
    });
  });

  it('allows a secondary backend role with the required permission', () => {
    renderProtected(['application.create']);
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects when the permission claim is missing', () => {
    renderProtected(['application.delete']);
    expect(screen.getByText('Forbidden')).toBeInTheDocument();
  });
});

describe('Candidate workspace entry', () => {
  it('uses the owned Candidate dashboard consistently', () => {
    expect(getDashboardRouteForRole(UserRole.CANDIDATE)).toBe('/candidate/dashboard');
    expect(getDashboardRouteForRole('candidate')).toBe('/candidate/dashboard');
    expect(ROLE_DASHBOARD_ROUTES[UserRole.CANDIDATE]).toBe('/candidate/dashboard');
  });
});

describe('Admin placement reconciliations access', () => {
  it('declares ROUTE_ACCESS for /admin/placement-reconciliations as ADMIN only', () => {
    expect(ROUTE_ACCESS['/admin/placement-reconciliations']).toEqual([UserRole.ADMIN]);
  });

  it('allows ADMIN and denies INTERNAL_HR for /admin/placement-reconciliations', () => {
    useAuthStore.setState({
      role: UserRole.ADMIN,
      isAuthenticated: true,
      user: {
        id: 'admin-1',
        name: 'Platform Admin',
        email: 'admin@gmail.com',
        role: UserRole.ADMIN,
        roles: ['PLATFORM_ADMIN'],
        permissions: [],
      },
    });

    const { unmount } = render(
      <MemoryRouter initialEntries={['/admin/placement-reconciliations']}>
        <Routes>
          <Route
            path="/admin/placement-reconciliations"
            element={
              <ProtectedRoute requiredRoles={ROUTE_ACCESS['/admin/placement-reconciliations']}>
                <div>Admin Reconciliation View</div>
              </ProtectedRoute>
            }
          />
          <Route path="/hr/dashboard" element={<div>HR Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin Reconciliation View')).toBeInTheDocument();
    unmount();

    useAuthStore.setState({
      role: UserRole.INTERNAL_HR,
      isAuthenticated: true,
      user: {
        id: 'hr-1',
        name: 'Internal HR',
        email: 'internalhr@gmail.com',
        role: UserRole.INTERNAL_HR,
        roles: ['INTERNAL_HR'],
        permissions: [],
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin/placement-reconciliations']}>
        <Routes>
          <Route
            path="/admin/placement-reconciliations"
            element={
              <ProtectedRoute requiredRoles={ROUTE_ACCESS['/admin/placement-reconciliations']}>
                <div>Admin Reconciliation View</div>
              </ProtectedRoute>
            }
          />
          <Route path="/hr/dashboard" element={<div>HR Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Admin Reconciliation View')).not.toBeInTheDocument();
    expect(screen.getByText('HR Dashboard')).toBeInTheDocument();
  });
});
