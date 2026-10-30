import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientBillingPage, feeBreakdown } from './ClientBillingPage';
import { financeApi, vnPayApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';

vi.mock('@/services/api/financeApi', () => ({
  financeApi: { serviceFees: vi.fn() },
  vnPayApi: { enabled: vi.fn(), createPayment: vi.fn() },
}));
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

  it('offers payment for an unpaid fee only, with transfer details as the fallback', async () => {
    vi.mocked(vnPayApi.enabled).mockResolvedValue(false);
    renderPage();
    await screen.findByText('Lập trình viên .NET');

    // HH overdue + AP posting fee are payable; the paid SS deposit is not.
    expect(screen.getAllByRole('button', { name: /^Thanh toán:/ })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Kế toán tổng hợp/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán: Gói đăng tin · Gói tiêu chuẩn · Lập trình viên .NET' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1\.500\.000/)).toBeTruthy();
    expect(within(dialog).getByText('0988776655')).toBeTruthy();
    expect(within(dialog).getByText('HRC J-AP')).toBeTruthy();
    // VNPay is off: no VNPay button, and never an "I have paid" button.
    expect(within(dialog).queryByRole('button', { name: /VNPay/ })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /đã thanh toán/i })).toBeNull();
  });

  it('explains a Sourcing deposit and settlement as CVs × price per CV', () => {
    const deposit = feeBreakdown(fee({ kind: 'DEPOSIT', baseSalary: 6_000_000, feeMultiplier: 0.2, amount: 1_200_000, sourcingTarget: 6, sourcingPricePerCv: 1_000_000 }) as never);
    expect(deposit.map((l) => l.label)).toEqual(['Số CV đặt mua', 'Đơn giá mỗi CV', 'Tổng giá trị gói', 'Tỷ lệ đặt cọc']);
    expect(deposit[0].value).toBe('6 CV');
    expect(deposit[3].value).toBe('20%');

    const settlement = feeBreakdown(fee({ kind: 'SETTLEMENT', baseSalary: 5_000_000, feeMultiplier: 1, amount: 3_800_000, sourcingPricePerCv: 1_000_000 }) as never);
    expect(settlement[0].value).toMatch(/^5 CV × 1\.000\.000/);
    expect(settlement[2].value).toMatch(/^− 1\.200\.000/);
  });

  it('sends the Client to VNPay for the chosen fee', async () => {
    vi.mocked(vnPayApi.enabled).mockResolvedValue(true);
    vi.mocked(vnPayApi.createPayment).mockResolvedValue({ onlinePaymentId: 'op', paymentUrl: 'https://sandbox.vnpayment.vn/pay?x=1' });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderPage();
    await screen.findByText('Backend .NET');

    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán: Phí Headhunt · Backend .NET' }));
    // The VNPay button waits for the "is VNPay on" query; CI runners are slow, so allow more than the 1s default.
    fireEvent.click(await screen.findByRole('button', { name: /Thanh toán qua VNPay/ }, { timeout: 5000 }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://sandbox.vnpayment.vn/pay?x=1'), { timeout: 5000 });
    expect(vnPayApi.createPayment).toHaveBeenCalledWith('SERVICE_FEE', 'hh');
    vi.unstubAllGlobals();
  }, 15000);
});
