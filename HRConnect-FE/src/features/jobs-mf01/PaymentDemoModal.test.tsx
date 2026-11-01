import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentDemoModal } from './PaymentDemoModal';
import { vnPayApi } from '@/services/api/financeApi';

vi.mock('./useJobQueries', () => ({
  formatMoney: (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`,
  jobQueryKeys: { all: ['jobs-mf01'] },
  usePostingFee: () => ({
    data: {
      packageId: 'standard',
      packageCode: 'STANDARD',
      packageName: 'Gói tiêu chuẩn',
      amount: 1_500_000,
      currencyCode: 'VND',
    },
  }),
  usePostingPackages: () => ({ data: [{ packageId: 'standard', durationDays: 90, maxApplications: 100 }] }),
}));

vi.mock('@/services/api/financeApi', () => ({
  vnPayApi: { createPayment: vi.fn() },
}));

vi.mock('@/services/api/jobsApi', () => ({
  jobsApi: { notifyDeposit: vi.fn() },
}));

const renderModal = () =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PaymentDemoModal
          open
          jobId="job-1"
          jobTitle="Kế toán Tổng hợp"
          serviceTypeCode="CV_APPLICATION"
          onClose={vi.fn()}
        />
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('PaymentDemoModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('replaces manual posting-fee confirmation with VNPay checkout', async () => {
    vi.mocked(vnPayApi.createPayment).mockResolvedValue({
      onlinePaymentId: 'online-payment-1',
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?token=1',
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    renderModal();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Thanh toán trực tuyến qua VNPay')).toBeInTheDocument();
    expect(within(dialog).queryByText('Thông tin chuyển khoản')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Xác nhận đã thanh toán/i })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Thanh toán qua VNPay/i }));

    await waitFor(() => {
      expect(vnPayApi.createPayment).toHaveBeenCalledWith('POSTING_FEE', 'job-1');
      expect(assign).toHaveBeenCalledWith('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?token=1');
    });
  });
});
