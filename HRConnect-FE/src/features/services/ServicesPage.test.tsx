import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesPage } from './ServicesPage';
import { ProtectedRoute } from '@/routes/AppRoutes';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import { apiClient } from '@/services/apiClient';
import { jobsApi } from '@/services/api/jobsApi';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';

vi.mock('@/services/api/jobsApi', () => ({ jobsApi: { searchPublic: vi.fn() } }));
vi.mock('@/services/api/companyDirectoryApi', () => ({ companyDirectoryApi: { search: vi.fn() } }));

const wrap = (ui: React.ReactNode, path = '/client/services') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );

describe('ServicesPage (Client)', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { data: { items: [] } } } as never);
    vi.mocked(jobsApi.searchPublic).mockResolvedValue({ items: [], totalCount: 17, page: 1, pageSize: 1, totalPages: 17 } as never);
    vi.mocked(companyDirectoryApi.search).mockResolvedValue({ items: [], totalCount: 13, page: 1, pageSize: 1, totalPages: 13 } as never);
  });

  it('shows the three services and a comparison that matches who submits and screens CVs', async () => {
    wrap(<ServicesPage />);

    expect(await screen.findByRole('heading', { name: 'Đăng tin tuyển dụng' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tuyển qua Affiliate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mua CV theo số lượng' })).toBeInTheDocument();

    const who = screen.getByRole('row', { name: /Ai tìm ứng viên/ });
    expect(within(who).getAllByText('Mạng lưới Affiliate')).toHaveLength(2);
    expect(within(who).getByText('Ứng viên tự ứng tuyển')).toBeInTheDocument();
  });

  it('shows only platform numbers the API returns, never made-up ones', async () => {
    wrap(<ServicesPage />);
    expect(await screen.findByText('Tin đang tuyển')).toBeInTheDocument();
    expect(screen.getByText('Doanh nghiệp đã xác minh')).toBeInTheDocument();
    expect(screen.queryByText(/Affiliate đang hoạt động/)).toBeNull();
  });
});

describe('/services access', () => {
  const routes = (
    <Routes>
      <Route path="/services" element={<ProtectedRoute requiredRoles={[UserRole.CLIENT]} redirectTo="/jobs"><div>client services</div></ProtectedRoute>} />
      <Route path="/jobs" element={<div>job list</div>} />
    </Routes>
  );

  it('sends a guest to the job list', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null, role: null } as never);
    wrap(routes, '/services');
    expect(screen.getByText('job list')).toBeInTheDocument();
  });

  it('sends a Candidate to the job list', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.CANDIDATE,
      user: { id: 'u', name: 'C', email: 'c@x', role: UserRole.CANDIDATE, permissions: [] },
      hasAnyRole: (roles: UserRole[]) => roles.includes(UserRole.CANDIDATE),
    } as never);
    wrap(routes, '/services');
    expect(screen.getByText('job list')).toBeInTheDocument();
  });
});
