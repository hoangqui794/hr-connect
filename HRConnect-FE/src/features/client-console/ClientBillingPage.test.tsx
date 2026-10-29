import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientBillingPage } from './ClientBillingPage';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';

vi.mock('@/services/api/financeApi', () => ({ financeApi: { serviceFees: vi.fn() } }));
vi.mock('@/services/api/jobsApi', () => ({ jobsApi: { getMine: vi.fn(), getPostingFee: vi.fn() } }));

const fee = (over: Record<string, unknown>) => ({
  serviceFeeId: 'f', placementId: null, companyId: 'co', jobTitle: 'Tin', candidateName: null, baseSalary: 0,
  feeMultiplier: 0, amount: 0, currencyCode: 'VND', dueDate: '2026-11-01', status: 'PENDING', createdAt: '2026-10-01', ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AntApp>
          <ClientBillingPage />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('ClientBillingPage', () => {
  beforeEach(() => {
    vi.mocked(financeApi.serviceFees).mockResolvedValue({
      items: [
        fee({ serviceFeeId: 'hh', kind: 'PLACEMENT', jobTitle: 'Backend .NET', candidateName: 'qui3', amount: 42_000_000, status: 'OVERDUE' }),
        fee({ serviceFeeId: 'ss', kind: 'DEPOSIT', jobTitle: 'Kế toán tổng hợp', amount: 200_000, status: 'PAID', paidAt: '2026-10-20', paymentReference: 'HRC-1' }),
      ],
      totalCount: 2, page: 1, pageSize: 100,
    } as never);
    vi.mocked(jobsApi.getMine).mockResolvedValue([
      { jobId: 'j-ap', title: 'Lập trình viên .NET', serviceTypeCode: 'CV_APPLICATION', postingFeeStatus: 'PENDING', postingPackageCode: 'STANDARD' },
      { jobId: 'j-free', title: 'Tin miễn phí', serviceTypeCode: 'CV_APPLICATION', postingFeeStatus: 'PAID', postingPackageCode: 'FREE' },
    ] as never);
    vi.mocked(jobsApi.getPostingFee).mockResolvedValue({
      postingFeeId: 'pf', jobId: 'j-ap', packageId: 'p', packageCode: 'STANDARD', packageName: 'Gói tiêu chuẩn',
      amount: 1_500_000, currencyCode: 'VND', status: 'PENDING', paidAt: null, paymentReference: null,
      activatedAt: null, expiresAt: null, createdAt: '2026-10-01',
    });
  });

  // HR feedback 28/10: one place for the fees of all three services.
  it('lists Headhunt, Sourcing and paid posting fees with totals', async () => {
    renderPage();

    expect(await screen.findByText('Backend .NET')).toBeTruthy();
    expect(await screen.findByText('Lập trình viên .NET')).toBeTruthy();
    expect(screen.getByText('Kế toán tổng hợp')).toBeTruthy();
    expect(screen.queryByText('Tin miễn phí')).toBeNull();
    expect(jobsApi.getPostingFee).toHaveBeenCalledTimes(1);

    // Cần thanh toán = 42.000.000 (overdue) + 1.500.000 (posting fee pending)
    expect(screen.getByText(/43\.500\.000/)).toBeTruthy();
    expect(screen.getByText('2 khoản chưa thanh toán')).toBeTruthy();
    expect(screen.getByText('1 khoản quá hạn')).toBeTruthy();
  });

  it('filters by service code', async () => {
    renderPage();
    await screen.findByText('Lập trình viên .NET');

    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Lọc theo dịch vụ' })).getByRole('radio', { name: /^SS/ }));

    expect(screen.getByText('Kế toán tổng hợp')).toBeTruthy();
    expect(screen.queryByText('Backend .NET')).toBeNull();
    expect(screen.queryByText('Lập trình viên .NET')).toBeNull();
  });
});
