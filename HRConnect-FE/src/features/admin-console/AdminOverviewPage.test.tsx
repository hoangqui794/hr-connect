import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import { AdminOverviewPage } from './AdminOverviewPage';
import { adminAuditApi, adminCommissionApi, adminDashboardApi, adminServiceTypesApi } from '@/services/api/adminApi';
import type { AdminDashboardMetrics } from '@/types/api/admin';

vi.mock('@/services/api/adminApi', () => ({
  adminDashboardApi: { getMetrics: vi.fn() },
  adminAuditApi: { list: vi.fn() },
  adminServiceTypesApi: { list: vi.fn() },
  adminCommissionApi: { list: vi.fn() },
}));

const days = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17'];

const metrics = (range: AdminDashboardMetrics['range'] = '7d'): AdminDashboardMetrics => ({
  range,
  generatedAtUtc: '2026-11-17T05:00:00Z',
  currencyCode: 'VND',
  kpis: {
    pendingApprovals: 5,
    activeUsers: 420,
    suspendedUsers: 3,
    auditEventsToday: 128,
    overdueServiceFeesCount: 2,
    overdueServiceFeesAmount: 45_000_000,
    payableCommissionsCount: 4,
    payableCommissionsAmount: 18_500_000,
    openDisputesCount: 1,
  },
  cashflowSeries: days.map((date, i) => ({
    date,
    serviceFeesPaidAmount: i * 1_000_000,
    refundsPaidAmount: 0,
    postingFeesPaidAmount: 0,
    payoutsAmount: i === 3 ? 500_000 : 0,
  })),
  activitySeries: days.map((date, i) => ({ date, newUsers: i % 2, auditEvents: i * 3, approvalsCompleted: 0 })),
  userRoleBreakdown: [
    { role: 'CANDIDATE', count: 260 },
    { role: 'AFFILIATE', count: 68 },
    { role: 'CLIENT_COMPANY_USER', count: 85 },
    { role: 'INTERNAL_HR', count: 7 },
    { role: 'PLATFORM_ADMIN', count: 2 },
  ],
});

const axiosError = (status: number, message: string) =>
  new AxiosError(message, String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { success: false, message },
  });

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminOverviewPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const location = () => screen.getByTestId('location').textContent;

describe('AdminOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminDashboardApi.getMetrics).mockImplementation(async (range) => metrics(range));
    vi.mocked(adminAuditApi.list).mockResolvedValue({
      items: [
        {
          auditLogId: 1,
          actorUserId: null,
          actorType: 'USER',
          actorEmail: 'admin@test.com',
          actorDisplayName: 'Quản trị viên',
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: null,
          correlationId: null,
          source: 'APPLICATION',
          serviceName: null,
          createdAt: new Date().toISOString(),
        },
      ],
      page: 1,
      pageSize: 6,
      total: 1,
    } as never);
    vi.mocked(adminServiceTypesApi.list).mockResolvedValue([]);
    vi.mocked(adminCommissionApi.list).mockResolvedValue({ items: [], page: 1, pageSize: 1, total: 3 } as never);
  });

  it('loads the 30-day metrics by default and shows the four KPIs', async () => {
    renderPage();

    const kpis = await screen.findByRole('region', { name: 'Chỉ số vận hành' });
    expect(adminDashboardApi.getMetrics).toHaveBeenCalledWith('30d');
    for (const label of ['Chờ duyệt tài khoản', 'Phí quá hạn', 'Hoa hồng chờ chi', 'Sự kiện hôm nay']) {
      expect(within(kpis).getByText(label)).toBeInTheDocument();
    }
    expect(within(kpis).getByText('45.000.000 đ')).toBeInTheDocument();
    expect(within(kpis).getByText('18.500.000 đ')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '30 ngày' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls the API again with the new range when the range changes', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Chỉ số vận hành' });

    fireEvent.click(screen.getByRole('radio', { name: '7 ngày' }));

    await waitFor(() => expect(adminDashboardApi.getMetrics).toHaveBeenLastCalledWith('7d'));
    expect(screen.getByRole('radio', { name: '7 ngày' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '90 ngày' }));
    await waitFor(() => expect(adminDashboardApi.getMetrics).toHaveBeenLastCalledWith('90d'));
  });

  it.each([
    ['Chờ duyệt tài khoản', '/admin/approvals?status=UNDER_REVIEW'],
    ['Phí quá hạn', '/admin/finance'],
    ['Hoa hồng chờ chi', '/admin/finance'],
  ])('KPI "%s" navigates to %s', async (label, route) => {
    renderPage();
    const kpis = await screen.findByRole('region', { name: 'Chỉ số vận hành' });

    fireEvent.click(within(kpis).getByText(label).closest('button')!);

    expect(location()).toBe(route);
  });

  it('KPI "Sự kiện hôm nay" opens the audit trail filtered to today', async () => {
    renderPage();
    const kpis = await screen.findByRole('region', { name: 'Chỉ số vận hành' });

    fireEvent.click(within(kpis).getByText('Sự kiện hôm nay').closest('button')!);

    expect(location()).toMatch(/^\/admin\/audit-trail\?from=.+&to=.+/);
  });

  it('keeps active and suspended users visible and clickable', async () => {
    renderPage();

    const active = await screen.findByRole('button', { name: /Người dùng đang hoạt động/ });
    expect(active).toHaveTextContent('420');
    const suspended = screen.getByRole('button', { name: /Đang tạm khóa/ });
    expect(suspended).toHaveTextContent('3');

    fireEvent.click(suspended);
    expect(location()).toBe('/admin/users?status=SUSPENDED');
  });

  it('opens the user list from the active users count', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Người dùng đang hoạt động/ }));

    expect(location()).toBe('/admin/users');
  });

  it('renders the charts and the role breakdown from the API series', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Chỉ số vận hành' });

    expect(screen.getByRole('group', { name: /Chi tiết dòng tiền theo ngày/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Chi tiết hoạt động theo ngày/ })).toBeInTheDocument();
    expect(screen.getByText('Ứng viên')).toBeInTheDocument();
    expect(screen.getByText('Hoạt động gần đây')).toBeInTheDocument();
  });

  it('shows an error alert with a retry button when the metrics fail', async () => {
    vi.mocked(adminDashboardApi.getMetrics).mockRejectedValue(axiosError(500, 'Máy chủ đang bận'));
    renderPage();

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent('Không tải được số liệu tổng quan');
    expect(alert).toHaveTextContent('Máy chủ đang bận');

    vi.mocked(adminDashboardApi.getMetrics).mockImplementation(async (range) => metrics(range));
    fireEvent.click(within(alert).getByRole('button', { name: /Thử lại/ }));

    expect(await screen.findByRole('region', { name: 'Chỉ số vận hành' })).toBeInTheDocument();
  });

  it('on 403 explains the missing permission, offers no retry and still shows recent activity', async () => {
    vi.mocked(adminDashboardApi.getMetrics).mockRejectedValue(axiosError(403, 'Forbidden'));
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bạn không có quyền xem số liệu tổng quan');
    expect(within(alert).queryByRole('button', { name: /Thử lại/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Chỉ số vận hành' })).not.toBeInTheDocument();
    expect(screen.getByText('Hoạt động gần đây')).toBeInTheDocument();
    expect(await screen.findByText(/USER_LOGIN|Quản trị viên/)).toBeInTheDocument();
    // 403 is not retried.
    expect(adminDashboardApi.getMetrics).toHaveBeenCalledTimes(1);
  });
});
