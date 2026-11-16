import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrLayout } from './HrLayout';
import { contactApi } from '@/services/api/contactApi';
import { jobsApi } from '@/services/api/jobsApi';
import { placementReconciliationApi, screeningApi } from '@/services/api/hrApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/authService', () => ({
  AUTH_STORAGE_KEYS: { ACCESS_TOKEN: 'access_token', AUTH_TOKEN: 'auth_token' },
  authService: {
    getAccessToken: vi.fn(() => null),
    logout: vi.fn(),
  },
}));

vi.mock('@/services/api/jobsApi', () => ({
  jobsApi: {
    getReviewQueue: vi.fn(),
  },
}));

vi.mock('@/services/api/hrApi', () => ({
  HR_SCREENED_SERVICE_TYPES: 'HEADHUNT_COD,CV_SOURCING',
  screeningApi: {
    list: vi.fn(),
  },
  placementReconciliationApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/services/api/contactApi', () => ({
  contactApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/features/admin-console/useCompactLayout', () => ({
  useCompactLayout: () => false,
}));

vi.mock('@/features/admin-console/AdminRouteProgress', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    AdminPageEnter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AdminPageSkeleton: () => <div data-testid="page-skeleton" />,
    AdminTopProgress: () => null,
    MotionPageOutlet: () => <Outlet />,
  };
});

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/components/common/ChangePasswordModal', () => ({
  ChangePasswordModal: () => null,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const renderHrLayout = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/hr/dashboard']}>
        <Routes>
          <Route path="/hr" element={<HrLayout />}>
            <Route path="dashboard" element={<div data-testid="hr-dashboard-outlet">HR Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('HrLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jobsApi.getReviewQueue).mockResolvedValue([]);
    vi.mocked(screeningApi.list).mockResolvedValue({ items: [], total: 0 } as any);
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({ items: [], totalCount: 0 } as any);
    vi.mocked(contactApi.list).mockResolvedValue({ items: [], totalCount: 4 } as any);
  });

  it('fetches pending contact requests and shows the contact requests nav item when user has contact_request.manage', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.INTERNAL_HR,
      user: {
        id: 'hr-1',
        name: 'Internal HR',
        email: 'internalhr@gmail.com',
        role: UserRole.INTERNAL_HR,
        roles: [UserRole.INTERNAL_HR],
        permissions: ['job.review', 'contact_request.manage'],
      },
    });

    renderHrLayout();

    expect(screen.getByTestId('hr-dashboard-outlet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Yêu cầu tư vấn/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(contactApi.list).toHaveBeenCalledWith({ status: 'NEW', page: 1, pageSize: 1 });
    });
    expect(await screen.findByLabelText('4 chờ xử lý')).toBeInTheDocument();
  });

  it('skips contactApi.list and hides the contact requests nav item when user lacks contact_request.manage', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.INTERNAL_HR,
      user: {
        id: 'hr-1',
        name: 'Internal HR',
        email: 'internalhr@gmail.com',
        role: UserRole.INTERNAL_HR,
        roles: [UserRole.INTERNAL_HR],
        permissions: ['job.review'],
      },
    });

    renderHrLayout();

    expect(screen.getByTestId('hr-dashboard-outlet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Yêu cầu tư vấn/i })).toBeNull();

    await waitFor(() => {
      expect(jobsApi.getReviewQueue).toHaveBeenCalled();
    });
    expect(contactApi.list).not.toHaveBeenCalled();
  });

  it('skips contactApi.list and hides the contact requests nav item when permissions array is missing', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.INTERNAL_HR,
      user: {
        id: 'hr-2',
        name: 'Internal HR Legacy',
        email: 'legacyhr@gmail.com',
        role: UserRole.INTERNAL_HR,
        roles: [UserRole.INTERNAL_HR],
      },
    });

    renderHrLayout();

    expect(screen.getByTestId('hr-dashboard-outlet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Yêu cầu tư vấn/i })).toBeNull();

    expect(jobsApi.getReviewQueue).not.toHaveBeenCalled();
    expect(screeningApi.list).not.toHaveBeenCalled();
    expect(placementReconciliationApi.list).not.toHaveBeenCalled();
    expect(contactApi.list).not.toHaveBeenCalled();
  });

  it('uses the admin placement reconciliation endpoint when PLATFORM_ADMIN visits /hr', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1',
        name: 'Platform Admin',
        email: 'admin@gmail.com',
        role: UserRole.ADMIN,
        roles: [UserRole.ADMIN],
        permissions: ['job.review', 'contact_request.manage'],
      },
    });

    renderHrLayout();

    await waitFor(() => {
      expect(placementReconciliationApi.list).toHaveBeenCalledWith(
        { status: 'PENDING', page: 1, pageSize: 1 },
        true
      );
      expect(screeningApi.list).toHaveBeenCalled();
      expect(jobsApi.getReviewQueue).toHaveBeenCalled();
    });
  });

  it('uses the internal HR reconciliation endpoint only when INTERNAL_HR has placement.reconcile', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.INTERNAL_HR,
      user: {
        id: 'hr-3',
        name: 'Internal HR Full',
        email: 'fullhr@gmail.com',
        role: UserRole.INTERNAL_HR,
        roles: [UserRole.INTERNAL_HR],
        permissions: ['job.review', 'application.view', 'placement.reconcile'],
      },
    });

    renderHrLayout();

    await waitFor(() => {
      expect(placementReconciliationApi.list).toHaveBeenCalledWith(
        { status: 'PENDING', page: 1, pageSize: 1 },
        false
      );
      expect(screeningApi.list).toHaveBeenCalled();
    });
  });
});
