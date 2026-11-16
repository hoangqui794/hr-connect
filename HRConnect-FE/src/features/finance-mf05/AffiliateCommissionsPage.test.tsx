import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const renderPage = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App><AffiliateCommissionsPage /></App>
      </MemoryRouter>
    </QueryClientProvider>
  ),
});

describe('Affiliate › Hoa hồng và chi trả', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('paginates commissions at PAGE_SIZE=20 with page in queryKey while keeping KPI totals accurate across pages', async () => {
    const allItems: Commission[] = [
      ...Array.from({ length: 20 }, (_, i) =>
        commission({
          commissionId: `w-${i + 1}`,
          candidateName: `Ứng viên BH ${i + 1}`,
          status: 'IN_WARRANTY',
          amount: 1_000_000,
        })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        commission({
          commissionId: `p-${i + 1}`,
          candidateName: `Ứng viên Paid ${i + 1}`,
          status: 'PAID',
          amount: 2_000_000,
        })
      ),
    ];

    vi.mocked(financeApi.commissions).mockImplementation(async ({ page: p, pageSize }) => {
      const start = (p - 1) * pageSize;
      return {
        items: allItems.slice(start, start + pageSize),
        totalCount: allItems.length,
        page: p,
        pageSize,
      };
    });

    const { queryClient } = renderPage();

    expect(await screen.findByText('Ứng viên BH 1')).toBeInTheDocument();
    expect(screen.queryByText('Ứng viên Paid 1')).not.toBeInTheDocument();

    expect(financeApi.commissions).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(financeApi.commissions).toHaveBeenCalledWith({ page: 1, pageSize: 100 });
    expect(queryClient.getQueryData(['mf05-my-commissions', 1])).toBeDefined();
    expect(queryClient.getQueryData(['mf05-my-commissions', 'summary'])).toBeDefined();

    // Totals reflect all 25 commissions even though page 1 only renders the 20 IN_WARRANTY items.
    const warrantyCard = screen.getByRole('region', { name: 'Đang bảo hành' });
    const paidCard = screen.getByRole('region', { name: 'Đã nhận tiền' });
    expect(within(warrantyCard).getByText(/20\.000\.000/)).toBeInTheDocument();
    expect(within(warrantyCard).getByText(/20 khoản/)).toBeInTheDocument();
    expect(within(paidCard).getByText(/10\.000\.000/)).toBeInTheDocument();
    expect(within(paidCard).getByText(/5 khoản/)).toBeInTheDocument();

    const listSection = screen.getByRole('heading', { name: 'Danh sách hoa hồng' }).closest('section')!;
    fireEvent.click(within(listSection).getByTitle('2'));

    await waitFor(() => {
      expect(financeApi.commissions).toHaveBeenCalledWith({ page: 2, pageSize: 20 });
      expect(screen.getByText('Ứng viên Paid 1')).toBeInTheDocument();
    });
    expect(screen.queryByText('Ứng viên BH 1')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(['mf05-my-commissions', 2])).toBeDefined();

    // KPI totals stay unchanged after switching to page 2.
    expect(within(warrantyCard).getByText(/20\.000\.000/)).toBeInTheDocument();
    expect(within(paidCard).getByText(/10\.000\.000/)).toBeInTheDocument();

    // Filtering resets back to page 1 so matches from any page are visible immediately.
    fireEvent.click(within(listSection).getByRole('tab', { name: /Đang bảo hành/ }));
    expect(await screen.findByText('Ứng viên BH 1')).toBeInTheDocument();
    expect(screen.queryByText('Ứng viên Paid 1')).not.toBeInTheDocument();
  });

  it('aggregates all summary pages when totalCount exceeds 100', async () => {
    const allItems: Commission[] = [
      ...Array.from({ length: 100 }, (_, i) =>
        commission({
          commissionId: `w-${i + 1}`,
          candidateName: `Ứng viên BH ${i + 1}`,
          status: 'IN_WARRANTY',
          amount: 1_000_000,
        })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        commission({
          commissionId: `p-${i + 1}`,
          candidateName: `Ứng viên Paid ${i + 1}`,
          status: 'PAID',
          amount: 2_000_000,
        })
      ),
    ];

    vi.mocked(financeApi.commissions).mockImplementation(async ({ page: p, pageSize }) => {
      const start = (p - 1) * pageSize;
      return {
        items: allItems.slice(start, start + pageSize),
        totalCount: allItems.length,
        page: p,
        pageSize,
      };
    });

    renderPage();

    expect(await screen.findByText('Ứng viên BH 1')).toBeInTheDocument();
    const paidCard = screen.getByRole('region', { name: 'Đã nhận tiền' });
    await waitFor(() => {
      expect(financeApi.commissions).toHaveBeenCalledWith({ page: 2, pageSize: 100 });
      expect(within(paidCard).getByText(/10\.000\.000/)).toBeInTheDocument();
      expect(within(paidCard).getByText(/5 khoản/)).toBeInTheDocument();
    });
  });
});
