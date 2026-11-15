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

  it('shows Giới thiệu thay thế only when replacementSlotStatus is OPEN and explains non-open states', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(
      page([
        commission({
          commissionId: 'c-open',
          candidateName: 'Ứng viên Mở',
          jobId: 'job-open',
          status: 'CANCELLED',
          warrantyStatus: 'VOIDED',
          replacementSlotId: 'slot-open',
          replacementSlotStatus: 'OPEN',
          replacementExpiresAt: inDays(10),
        }),
        commission({
          commissionId: 'c-wait',
          candidateName: 'Ứng viên Chờ phí',
          jobId: 'job-wait',
          status: 'CANCELLED',
          warrantyStatus: 'VOIDED',
          replacementSlotId: 'slot-wait',
          replacementSlotStatus: 'WAITING_PAYMENT',
        }),
        commission({
          commissionId: 'c-filled',
          candidateName: 'Ứng viên Đã đủ',
          jobId: 'job-filled',
          status: 'CANCELLED',
          warrantyStatus: 'VOIDED',
          replacementSlotId: 'slot-filled',
          replacementSlotStatus: 'FILLED',
        }),
        commission({
          commissionId: 'c-expired',
          candidateName: 'Ứng viên Hết hạn',
          jobId: 'job-expired',
          status: 'CANCELLED',
          warrantyStatus: 'VOIDED',
          replacementSlotId: 'slot-expired',
          replacementSlotStatus: 'EXPIRED',
        }),
        commission({
          commissionId: 'c-none',
          candidateName: 'Ứng viên Không suất',
          jobId: 'job-none',
          status: 'CANCELLED',
          warrantyStatus: 'VOIDED',
          replacementSlotId: null,
          replacementSlotStatus: null,
        }),
      ])
    );
    renderPage();

    const openRow = (await screen.findByText('Ứng viên Mở')).closest('tr')!;
    const replaceLink = within(openRow).getByRole('link', { name: 'Giới thiệu thay thế' });
    expect(replaceLink).toHaveAttribute('href', '/affiliate/submit-candidate?job=job-open');
    expect(within(openRow).getByText(/Đã mở suất thay thế · Còn (9|10) ngày/)).toBeInTheDocument();

    const waitRow = screen.getByText('Ứng viên Chờ phí').closest('tr')!;
    expect(within(waitRow).queryByRole('link', { name: 'Giới thiệu thay thế' })).not.toBeInTheDocument();
    expect(within(waitRow).getByText('Đang chờ doanh nghiệp thanh toán phí để mở suất thay thế')).toBeInTheDocument();

    const filledRow = screen.getByText('Ứng viên Đã đủ').closest('tr')!;
    expect(within(filledRow).queryByRole('link', { name: 'Giới thiệu thay thế' })).not.toBeInTheDocument();
    expect(within(filledRow).getByText('Suất thay thế đã có người đi làm')).toBeInTheDocument();

    const expiredRow = screen.getByText('Ứng viên Hết hạn').closest('tr')!;
    expect(within(expiredRow).queryByRole('link', { name: 'Giới thiệu thay thế' })).not.toBeInTheDocument();
    expect(within(expiredRow).getByText('Đã hết hạn suất thay thế')).toBeInTheDocument();

    const noneRow = screen.getByText('Ứng viên Không suất').closest('tr')!;
    expect(within(noneRow).queryByRole('link', { name: 'Giới thiệu thay thế' })).not.toBeInTheDocument();
    expect(within(noneRow).getByText('Ứng viên nghỉ trong bảo hành · Không còn suất thay thế')).toBeInTheDocument();
  });
});
