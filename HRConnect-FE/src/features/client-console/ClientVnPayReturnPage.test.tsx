import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ClientVnPayReturnPage } from './ClientVnPayReturnPage';
import { vnPayApi } from '@/services/api/financeApi';
import type { OnlinePaymentResult } from '@/types/api/finance';

vi.mock('@/services/api/financeApi', () => ({ vnPayApi: { confirmReturn: vi.fn() } }));

const search = '?vnp_TxnRef=abc&vnp_ResponseCode=00&vnp_SecureHash=x';
const payment = (over: Partial<OnlinePaymentResult>): OnlinePaymentResult => ({
  onlinePaymentId: 'op', targetType: 'SERVICE_FEE', targetId: 'fee', amount: 42_000_000, currencyCode: 'VND',
  status: 'SUCCEEDED', providerTransactionNo: '14123456', responseCode: '00', paidAt: '2026-10-30T11:00:00Z', ...over,
});

const renderPage = (query = search) =>
  render(
    <MemoryRouter initialEntries={[`/client/billing/vnpay-return${query}`]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ClientVnPayReturnPage />
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('ClientVnPayReturnPage', () => {
  it('forwards VNPay query to the backend and shows a successful payment', async () => {
    vi.mocked(vnPayApi.confirmReturn).mockResolvedValue(payment({}));
    renderPage();

    expect(await screen.findByText('Thanh toán thành công')).toBeTruthy();
    expect(screen.getByText(/14123456/)).toBeTruthy();
    expect(vnPayApi.confirmReturn).toHaveBeenCalledWith(search);
  });

  it('says the payment was cancelled when the Client cancelled on VNPay', async () => {
    vi.mocked(vnPayApi.confirmReturn).mockResolvedValue(payment({ status: 'FAILED', responseCode: '24', providerTransactionNo: null }));
    renderPage();

    expect(await screen.findByText('Bạn đã hủy thanh toán')).toBeTruthy();
  });

  it('shows pending timeline and transaction details while waiting for VNPay confirmation', async () => {
    vi.mocked(vnPayApi.confirmReturn).mockResolvedValue(payment({ status: 'PENDING', providerTransactionNo: null, paidAt: null }));
    renderPage('?vnp_TxnRef=abc&vnp_Amount=4200000000&vnp_BankCode=NCB&vnp_CardType=ATM&vnp_BankTranNo=VNP15736274&vnp_SecureHash=x');

    expect(await screen.findByText('Đang chờ VNPay xác nhận')).toBeTruthy();
    expect(screen.getByText('Đối soát & xác nhận giao dịch')).toBeTruthy();
    expect(screen.getByText('NCB · ATM')).toBeTruthy();
    expect(screen.getByText('VNP15736274')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Kiểm tra lại ngay/ })).toBeTruthy();
  });

  it('does not call the backend without a VNPay query', () => {
    vi.mocked(vnPayApi.confirmReturn).mockClear();
    renderPage('');

    expect(screen.getByText('Không có kết quả thanh toán')).toBeTruthy();
    expect(vnPayApi.confirmReturn).not.toHaveBeenCalled();
  });
});
