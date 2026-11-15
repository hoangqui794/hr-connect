import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { placementReconciliationApi } from '@/services/api/hrApi';
import { notificationApi } from '@/services/api/notificationApi';

vi.mock('@/services/api/hrApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api/hrApi')>();
  return {
    ...actual,
    placementReconciliationApi: {
      list: vi.fn(),
      reconcile: vi.fn(),
      resolve: vi.fn(),
    },
  };
});

vi.mock('@/services/api/notificationApi', () => ({
  notificationApi: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

describe('router /admin/placement-reconciliations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationApi.getNotifications).mockResolvedValue({
      items: [],
      totalCount: 0,
      totalPages: 0,
      page: 1,
      pageSize: 10,
    });
    vi.mocked(notificationApi.getUnreadCount).mockResolvedValue({ unreadCount: 0 });
    vi.mocked(placementReconciliationApi.resolve).mockResolvedValue({});
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({
      items: [
        {
          reconciliationId: 'rec-flagged-1',
          applicationId: 'app-flagged-1',
          placementId: 'pl-1',
          jobTitle: 'Senior Backend Engineer',
          companyName: 'ABC Technology',
          candidateName: 'Nguyễn Minh Quân',
          candidateEmail: 'qu***@mail.com',
          affiliateName: 'Demo Affiliate',
          claimedOutcome: 'STARTED',
          actualStartDate: '2026-10-25',
          serviceFeeAmount: 25_000_000,
          serviceFeeCurrency: 'VND',
          status: 'FLAGGED',
          contactChannel: 'CANDIDATE',
          note: 'Ứng viên báo ngày đi làm khác với Client khai.',
          resolutionNote: null,
          resolutionAction: null,
          concurrencyToken: 'tok-flagged-1',
          createdAt: '2026-10-26T00:00:00Z',
          reviewedAt: null,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it('renders AdminPlacementReconciliationPage on /admin/placement-reconciliations without redirecting to /hr', async () => {
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

    const memoryRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/admin/placement-reconciliations'],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <RouterProvider router={memoryRouter} />
        </AntApp>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Xử lý đối soát nhận việc')).toBeInTheDocument();
    expect(memoryRouter.state.location.pathname).toBe('/admin/placement-reconciliations');

    // Default filter pill in Admin mode is FLAGGED ("Cần xử lý") and API is called with admin=true
    const flaggedFilter = screen.getByRole('radio', { name: 'Cần xử lý' });
    expect(flaggedFilter).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => {
      expect(placementReconciliationApi.list).toHaveBeenCalledWith(
        { status: 'FLAGGED', page: 1, pageSize: 10 },
        true
      );
    });
    expect(await screen.findByText('Nguyễn Minh Quân')).toBeInTheDocument();

    // Admin resolve action ("Ghi nhận đã xử lý") is shown and resolves via Admin endpoint
    await userEvent.click(screen.getByRole('button', { name: /xem/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ghi nhận đã xử lý' }));
    fireEvent.change(screen.getByLabelText('Kết quả xử lý'), {
      target: { value: 'Admin đã xác minh hồ sơ nhận việc.' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất xử lý' }));

    await waitFor(() => {
      expect(placementReconciliationApi.resolve).toHaveBeenCalledWith('app-flagged-1', {
        action: 'CONFIRM_REPORTED_OUTCOME',
        note: 'Admin đã xác minh hồ sơ nhận việc.',
        concurrencyToken: 'tok-flagged-1',
      });
    });
    expect(placementReconciliationApi.reconcile).not.toHaveBeenCalled();
  });

  it('redirects INTERNAL_HR away from /admin/placement-reconciliations to /hr/dashboard', async () => {
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

    const memoryRouter = createMemoryRouter(router.routes, {
      initialEntries: ['/admin/placement-reconciliations'],
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <RouterProvider router={memoryRouter} />
        </AntApp>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(memoryRouter.state.location.pathname).toBe('/hr/dashboard');
    });
    expect(placementReconciliationApi.list).not.toHaveBeenCalled();
  });
});
