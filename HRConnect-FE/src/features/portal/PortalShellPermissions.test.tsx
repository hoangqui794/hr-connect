import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AffiliateShell } from './AffiliateShell';
import { CandidateAccountFrame } from './candidate/CandidateAccountFrame';
import { CandidateWorkspaceMenu } from './candidate/CandidateWorkspaceMenu';
import { affiliateApi, candidateApplicationsApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/authService', () => ({
  AUTH_STORAGE_KEYS: { ACCESS_TOKEN: 'access_token', AUTH_TOKEN: 'auth_token' },
  authService: {
    getAccessToken: vi.fn(() => null),
    logout: vi.fn(),
  },
}));

vi.mock('@/services/api/mf02Api', () => ({
  affiliateApi: {
    submissions: vi.fn(),
  },
  candidateApplicationsApi: {
    list: vi.fn(),
  },
}));

vi.mock('@/hooks/useSavedJobs', () => ({
  useSavedJobs: () => ({ savedJobsCount: 2 }),
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

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('AffiliateShell & CandidateAccountFrame permission guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(affiliateApi.submissions).mockResolvedValue({ items: [], totalCount: 3 } as any);
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({ items: [], total: 5 } as any);
  });

  it('AffiliateShell skips affiliateApi.submissions when ADMIN visits /affiliate without submission.view_own', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1',
        name: 'Platform Admin',
        email: 'admin@gmail.com',
        role: UserRole.ADMIN,
        roles: [UserRole.ADMIN],
        permissions: ['job.review'],
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/affiliate/dashboard']}>
          <Routes>
            <Route path="/affiliate" element={<AffiliateShell />}>
              <Route path="dashboard" element={<div data-testid="aff-outlet">Affiliate Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('aff-outlet')).toBeInTheDocument();
    expect(affiliateApi.submissions).not.toHaveBeenCalled();
  });

  it('AffiliateShell calls affiliateApi.submissions when AFFILIATE has submission.view_own', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.AFFILIATE,
      user: {
        id: 'aff-1',
        name: 'Affiliate User',
        email: 'affiliate@gmail.com',
        role: UserRole.AFFILIATE,
        roles: [UserRole.AFFILIATE],
        permissions: ['submission.view_own'],
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/affiliate/dashboard']}>
          <Routes>
            <Route path="/affiliate" element={<AffiliateShell />}>
              <Route path="dashboard" element={<div data-testid="aff-outlet">Affiliate Dashboard</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(affiliateApi.submissions).toHaveBeenCalledWith({
        status: 'PENDING_CONSENT',
        page: 1,
        pageSize: 1,
      });
    });
  });

  it('CandidateAccountFrame skips candidateApplicationsApi.list when caller lacks application.view_own', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1',
        name: 'Platform Admin',
        email: 'admin@gmail.com',
        role: UserRole.ADMIN,
        roles: [UserRole.ADMIN],
        permissions: ['job.review'],
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/candidate/profile']}>
          <CandidateAccountFrame>
            <div data-testid="cand-child">Candidate Profile</div>
          </CandidateAccountFrame>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('cand-child')).toBeInTheDocument();
    expect(candidateApplicationsApi.list).not.toHaveBeenCalled();
  });

  it('CandidateAccountFrame fetches applications count when caller has application.view_own', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.CANDIDATE,
      user: {
        id: 'cand-1',
        name: 'Candidate User',
        email: 'candidate@gmail.com',
        role: UserRole.CANDIDATE,
        roles: [UserRole.CANDIDATE],
        permissions: ['application.view_own'],
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter initialEntries={['/candidate/profile']}>
          <CandidateAccountFrame>
            <div data-testid="cand-child">Candidate Profile</div>
          </CandidateAccountFrame>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(candidateApplicationsApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
    });
  });

  it('CandidateWorkspaceMenu skips candidateApplicationsApi.list when opened by caller without application.view_own', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1',
        name: 'Platform Admin',
        email: 'admin@gmail.com',
        role: UserRole.ADMIN,
        roles: [UserRole.ADMIN],
        permissions: ['job.review'],
      },
    });

    render(
      <QueryClientProvider client={createClient()}>
        <MemoryRouter>
          <CandidateWorkspaceMenu />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Platform Admin/i }));
    expect(candidateApplicationsApi.list).not.toHaveBeenCalled();
  });
});
