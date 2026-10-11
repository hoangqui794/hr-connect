import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDashboardRouteForRole, ProtectedRoute, ROLE_DASHBOARD_ROUTES } from './AppRoutes';
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
        roles: ['AFFILIATE_RECRUITER', 'CANDIDATE'],
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
