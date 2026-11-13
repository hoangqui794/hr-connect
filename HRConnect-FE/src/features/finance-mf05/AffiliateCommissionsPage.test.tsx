import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AffiliateCommissionsPage } from './AffiliateCommissionsPage';
import { affiliateBankApi, financeApi } from '@/services/api/financeApi';
import type { Commission } from '@/types/api/finance';

vi.mock('@/services/api/financeApi', () => ({
  financeApi: { commissions: vi.fn(), payouts: vi.fn() },
  affiliateBankApi: { get: vi.fn(), update: vi.fn() },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }),
});

const page = <T,>(items: T[]) => ({ items, totalCount: items.length, page: 1, pageSize: 100 });
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const commission = (over: Partial<Commission>): Commission => ({
  commissionId: over.commissionId ?? Math.random().toString(36),
  placementId: 'p1', attributionId: 'a1', affiliateId: 'af1',
  jobTitle: 'Backend .NET', candidateName: 'Nguyễn Văn An',
  amount: 13_500_000, baseAmount: 45_000_000, status: 'IN_WARRANTY', createdAt: '2026-10-20',
  ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <App><AffiliateCommissionsPage /></App>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('Affiliate › Hoa hồng và chi trả', () => {
  beforeEach(() => {
    vi.mocked(financeApi.payouts).mockResolvedValue(page([]));
    vi.mocked(affiliateBankApi.get).mockResolvedValue({ bankName: 'VCB', bankAccountNumber: '0123456789', bankAccountHolder: 'NGUYEN VAN A' });
  });

  it('totals each stage and shows every commission with how it was worked out', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([
      commission({ commissionId: 'w', status: 'IN_WARRANTY', warrantyEndDate: inDays(18) }),
      commission({ commissionId: 'e', candidateName: 'Trần Thị Bình', status: 'PAYABLE', amount: 9_000_000 }),
    ]));
    renderPage();

    await screen.findByText('Nguyễn Văn An');
    expect(within(screen.getByRole('region', { name: 'Chờ chuyển khoản' })).getByText(/9\.000\.000/)).toBeInTheDocument();

    const warranty = screen.getByText('Nguyễn Văn An').closest('tr')!;
    expect(within(warranty).getByText(/Còn (17|18) ngày/)).toBeInTheDocument();
    expect(within(warranty).getByText(/Trên phí 45\.000\.000/)).toBeInTheDocument();
    expect(within(warranty).getByText('Đang bảo hành')).toBeInTheDocument();
  });

  it('shows Hoa hồng tuyển dụng for Headhunt when baseAmount is hidden', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([
      commission({ commissionId: 'hh-hidden', placementId: 'p1', baseAmount: null, status: 'IN_WARRANTY' }),
    ]));
    renderPage();

    const row = (await screen.findByText('Nguyễn Văn An')).closest('tr')!;
    expect(within(row).getByText('Hoa hồng tuyển dụng')).toBeInTheDocument();
    expect(within(row).queryByText('Theo CV được nhận')).not.toBeInTheDocument();
  });

  it('explains a commission on hold instead of showing a raw status', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([commission({ status: 'ON_HOLD' })]));
    renderPage();

    expect(await screen.findByText(/bộ phận vận hành đang xác minh/)).toBeInTheDocument();
  });

  it('shows the account that receives payouts, masked', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText(/Nhận vào: VCB ••• 6789/)).toBeInTheDocument();
    expect(screen.queryByText(/0123456789/)).not.toBeInTheDocument();
  });

  it('invites a new affiliate when there is no commission yet', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('Chưa có hoa hồng')).toBeInTheDocument();
  });
});
