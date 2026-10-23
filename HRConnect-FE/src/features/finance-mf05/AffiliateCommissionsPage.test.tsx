import { fireEvent, render, screen, within } from '@testing-library/react';
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

describe('Affiliate › Hoa hồng & chi trả', () => {
  beforeEach(() => {
    vi.mocked(financeApi.payouts).mockResolvedValue(page([]));
    vi.mocked(affiliateBankApi.get).mockResolvedValue({ bankName: 'VCB', bankAccountNumber: '0123456789', bankAccountHolder: 'NGUYEN VAN A' });
  });

  it('puts the amount about to be paid first and shows each referral with its progress', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([
      commission({ commissionId: 'w', status: 'IN_WARRANTY', warrantyEndDate: inDays(18) }),
      commission({ commissionId: 'e', candidateName: 'Trần Thị Bình', status: 'PAYABLE', amount: 9_000_000 }),
    ]));
    renderPage();

    const card = (await screen.findByText('Sắp nhận')).parentElement!;
    expect(within(card).getByText(/9\.000\.000/)).toBeInTheDocument();

    const warranty = screen.getByRole('listitem', { name: /Nguyễn Văn An/ });
    expect(within(warranty).getByText(/Còn (17|18) ngày/)).toBeInTheDocument();
    expect(within(warranty).getByText(/tính trên phí 45\.000\.000/)).toBeInTheDocument();
    expect(within(warranty).getByText('Bảo hành').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('explains a commission on hold instead of showing a raw status', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([commission({ status: 'ON_HOLD' })]));
    renderPage();

    expect(await screen.findByText(/Internal HR đang xác minh/)).toBeInTheDocument();
  });

  it('filters by group and shows an empty state for an empty group', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([commission({ status: 'IN_WARRANTY' })]));
    renderPage();
    await screen.findByRole('listitem', { name: /Nguyễn Văn An/ });

    fireEvent.click(screen.getByRole('radio', { name: /Tạm giữ/ }));

    expect(screen.getByText('Không có ca nào ở mục này')).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /Nguyễn Văn An/ })).not.toBeInTheDocument();
  });

  it('invites a new affiliate when there is no commission yet', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByText('Chưa có hoa hồng')).toBeInTheDocument();
  });
});
