import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminFinancePage } from './AdminFinancePage';
import { HrWarrantyPage } from './WarrantyPages';
import { financeApi } from '@/services/api/financeApi';
import type { Commission, Warranty } from '@/types/api/finance';

vi.mock('@/services/api/financeApi', () => ({
  financeApi: {
    commissions: vi.fn(),
    serviceFees: vi.fn(),
    payouts: vi.fn(),
    warranties: vi.fn(),
    approveCommission: vi.fn(),
    resolveResignation: vi.fn(),
    getPlacements: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
    getReplacementSlots: vi.fn().mockResolvedValue([]),
    cancelReplacementSlot: vi.fn(),
  },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }),
});

const page = <T,>(items: T[]) => ({ items, totalCount: items.length, page: 1, pageSize: 20 });
const renderWith = (node: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <App>{node}</App>
      </MemoryRouter>
    </QueryClientProvider>
  );


const earned = (feeStatus: Commission['serviceFeeStatus']): Commission => ({
  commissionId: 'c1', placementId: 'p1', attributionId: 'a1', affiliateId: 'af1', affiliateName: 'Affiliate Hùng',
  jobTitle: 'Java Backend', candidateName: 'Nguyễn Văn Nam', amount: 9_000_000, status: 'EARNED',
  serviceFeeStatus: feeStatus, warrantyEndDate: '2026-10-01', createdAt: '2026-09-01',
});

describe('MF-05 admin finance', () => {
  beforeEach(() => vi.mocked(financeApi.commissions).mockReset());

  it('blocks approval until the Client has paid the service fee', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([earned('PENDING')]));

    renderWith(<AdminFinancePage />);

    const approve = await screen.findByRole('button', { name: 'Duyệt' });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows approval once the fee is paid', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([earned('PAID')]));

    renderWith(<AdminFinancePage />);

    const approve = await screen.findByRole('button', { name: 'Duyệt' });
    expect((approve as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('MF-05 HR warranty verification', () => {
  const claimed: Warranty = {
    warrantyId: 'w1', placementId: 'p1', companyName: 'ABC', jobTitle: 'Java Backend', candidateName: 'Nguyễn Văn Nam',
    startDate: '2026-09-01', endDate: '2026-10-01', status: 'CLAIMED', placementStatus: 'STARTED',
    resultNote: 'Client báo nghỉ', commissionStatus: 'ON_HOLD', commissionAmount: 9_000_000,
  };

  beforeEach(() => {
    vi.mocked(financeApi.warranties).mockResolvedValue(page([claimed]));
    vi.mocked(financeApi.getPlacements).mockResolvedValue({ items: [], totalCount: 0 });
    vi.mocked(financeApi.getReplacementSlots).mockResolvedValue([]);
    vi.mocked(financeApi.resolveResignation).mockReset().mockResolvedValue({
      placementId: 'p1',
      warrantyStatus: 'VOIDED',
      placementStatus: 'RESIGNED',
      commissions: [],
      replacement: null,
    });
  });



  it('requires a note to reject a reported resignation', async () => {
    renderWith(<HrWarrantyPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xác minh' }));
    fireEvent.click(await screen.findByLabelText('Không đúng, ứng viên vẫn đi làm'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Bác bỏ cần ghi chú lý do.')).toBeTruthy();
    expect(financeApi.resolveResignation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  });


  it('confirms a resignation', async () => {
    renderWith(<HrWarrantyPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xác minh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(financeApi.resolveResignation).toHaveBeenCalledWith('p1', { confirmed: true, note: undefined }));
  });
});
