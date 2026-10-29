import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminFinancePage } from './AdminFinancePage';
import { ClientWarrantyPage, HrWarrantyPage } from './WarrantyPages';
import { financeApi } from '@/services/api/financeApi';
import { placementReconciliationApi } from '@/services/api/hrApi';
import type { Commission, ServiceFee, Warranty } from '@/types/api/finance';

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

vi.mock('@/services/api/hrApi', () => ({
  placementReconciliationApi: {
    list: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 1 }),
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
  beforeEach(() => {
    vi.mocked(financeApi.commissions).mockReset();
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 1 });
  });

  it('blocks approval until the Client has paid the service fee', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([earned('PENDING')]));

    renderWith(<AdminFinancePage />);

    const approve = await screen.findByRole('button', { name: 'Duyệt' }, { timeout: 10000 });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows approval once the fee is paid', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([earned('PAID')]));

    renderWith(<AdminFinancePage />);

    const approve = await screen.findByRole('button', { name: 'Duyệt' }, { timeout: 10000 });
    expect((approve as HTMLButtonElement).disabled).toBe(false);
  });

  it('links Platform Admin to placement reconciliation exceptions', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));

    renderWith(<AdminFinancePage />);

    expect(await screen.findByText('Đối soát cần xử lý')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở danh sách đối soát' })).toBeInTheDocument();
  });

  it('does not let Admin record a placement fee before reconciliation finishes', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    const fee: ServiceFee = {
      serviceFeeId: 'fee-1', placementId: 'placement-1', kind: 'PLACEMENT', companyId: 'company-1',
      companyName: 'ABC', jobTitle: 'Backend Developer', candidateName: 'Nguyễn Văn Nam',
      baseSalary: 20_000_000, feeMultiplier: 1.5, amount: 30_000_000, currencyCode: 'VND',
      dueDate: '2026-11-01', status: 'PENDING', reconciliationStatus: 'PENDING', createdAt: '2026-10-23',
    };
    vi.mocked(financeApi.serviceFees).mockResolvedValue(page([fee]));

    renderWith(<AdminFinancePage />);
    fireEvent.click(screen.getByRole('radio', { name: 'Công nợ phí' }));

    const blocked = await screen.findByRole('button', { name: 'Chờ đối soát' });
    expect((blocked as HTMLButtonElement).disabled).toBe(true);
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

    fireEvent.click(await screen.findByRole('button', { name: 'Xác minh' }, { timeout: 10000 }));
    fireEvent.click(await screen.findByLabelText('Không đúng, ứng viên vẫn đi làm'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Bác bỏ cần ghi chú lý do.', {}, { timeout: 10000 })).toBeTruthy();
    expect(financeApi.resolveResignation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  });


  it('confirms a resignation', async () => {
    renderWith(<HrWarrantyPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xác minh' }, { timeout: 10000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(financeApi.resolveResignation).toHaveBeenCalledWith('p1', { confirmed: true, note: undefined }));
  });
});

// HR feedback 28/10: the warranty page is Headhunt only, so its fee list must not mix in CV Sourcing deposits.
describe('MF-05 Client warranty page', () => {
  it('lists only Headhunt placement fees', async () => {
    vi.mocked(financeApi.warranties).mockResolvedValue(page<Warranty>([]));
    vi.mocked(financeApi.serviceFees).mockReset();
    vi.mocked(financeApi.serviceFees).mockResolvedValue(page<ServiceFee>([]));

    renderWith(<ClientWarrantyPage />);

    await waitFor(() => expect(financeApi.serviceFees).toHaveBeenCalled());
    for (const [params] of vi.mocked(financeApi.serviceFees).mock.calls) {
      expect(params).toEqual(expect.objectContaining({ kind: 'PLACEMENT' }));
    }
  });
});
