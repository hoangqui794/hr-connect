import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminFinancePage } from './AdminFinancePage';
import { ClientWarrantyPage, HrWarrantyPage } from './WarrantyPages';
import { financeApi } from '@/services/api/financeApi';
import { placementReconciliationApi } from '@/services/api/hrApi';
import type { Commission, ReplacementSlotDto, ServiceFee, Warranty } from '@/types/api/finance';

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
    replacementSlots: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 }),
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

    const approve = await screen.findByRole('button', { name: 'Duyệt chi' }, { timeout: 10000 });
    expect((approve as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows approval once the fee is paid', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([earned('PAID')]));

    renderWith(<AdminFinancePage />);

    const approve = await screen.findByRole('button', { name: 'Duyệt chi' }, { timeout: 10000 });
    expect((approve as HTMLButtonElement).disabled).toBe(false);
  });

  it('links Platform Admin to placement reconciliation exceptions when there are some', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({ items: [], totalCount: 2, page: 1, pageSize: 1 });

    renderWith(<AdminFinancePage />);

    expect(await screen.findByText('Đối soát cần xử lý')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở danh sách đối soát' })).toBeInTheDocument();
  });

  it('hides the reconciliation banner when nothing needs fixing', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));

    renderWith(<AdminFinancePage />);

    await screen.findByText('Hoa hồng chờ duyệt');
    expect(screen.queryByText('Đối soát cần xử lý')).toBeNull();
  });

  it('shows when and how each fee was paid, and opens overdue fees from the to-do tiles', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    const paid: ServiceFee = {
      serviceFeeId: 'fee-paid', placementId: null, kind: 'DEPOSIT', companyId: 'company-1', companyName: 'ABC',
      jobTitle: 'Kế toán', candidateName: null, baseSalary: 2_400_000, feeMultiplier: 0.5, amount: 1_200_000,
      currencyCode: 'VND', dueDate: '2026-11-09', status: 'PAID', paidAt: '2026-10-30T11:00:00Z',
      paymentReference: 'VNPAY-99137506', createdAt: '2026-10-20',
    };
    vi.mocked(financeApi.serviceFees).mockResolvedValue(page([paid]));

    renderWith(<AdminFinancePage />);
    fireEvent.click(await screen.findByRole('button', { name: /Phí quá hạn/ }));

    expect(await screen.findByText('VNPAY-99137506')).toBeInTheDocument();
    expect(screen.getByText('VNPay')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-10-30T11:00:00Z').toLocaleDateString('vi-VN'))).toBeInTheDocument();
    await waitFor(() =>
      expect(financeApi.serviceFees).toHaveBeenCalledWith({ status: 'OVERDUE', page: 1, pageSize: 20 }));
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
    fireEvent.click(screen.getByRole('tab', { name: 'Công nợ phí' }));

    const blocked = await screen.findByRole('button', { name: 'Chờ đối soát' }, { timeout: 10000 });
    expect((blocked as HTMLButtonElement).disabled).toBe(true);
  });

  it('distinguishes Headhunt vs CV Sourcing, handles null serviceFeeStatus, and navigates to Công nợ phí', async () => {
    const sourcingRow: Commission = {
      commissionId: 'c-src',
      placementId: null,
      sourcingDeliveryId: 'sd-1',
      attributionId: 'a2',
      affiliateId: 'af1',
      affiliateName: 'Demo Affiliate',
      jobTitle: 'Lập trình viên Backend .NET',
      candidateName: 'Cao Hữu Trí',
      amount: 360_000,
      status: 'ON_HOLD',
      serviceFeeStatus: null,
      warrantyEndDate: null,
      createdAt: '2026-11-13',
    };
    const headhuntUnpaid = earned('PENDING');
    vi.mocked(financeApi.commissions).mockResolvedValue(page([sourcingRow, headhuntUnpaid]));

    renderWith(<AdminFinancePage />);

    expect(await screen.findByText('CV Sourcing', {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText('Headhunt')).toBeTruthy();
    expect(screen.getByText('Không áp dụng')).toBeTruthy();
    expect(screen.getByText('Chưa phát sinh phí')).toBeTruthy();

    const moreBtn = screen.getByRole('button', { name: /Thao tác khác: Nguyễn Văn Nam/i });
    fireEvent.click(moreBtn);

    const viewFeesItem = await screen.findByText('Xem công nợ phí');
    fireEvent.click(viewFeesItem);

    const feesTab = screen.getByRole('tab', { name: 'Công nợ phí' });
    expect(feesTab.getAttribute('aria-selected')).toBe('true');
  });

  it('sets the fees table filter to PENDING when clicking the "Phí chờ thu" KPI tile', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    vi.mocked(financeApi.serviceFees).mockReset().mockResolvedValue(page<ServiceFee>([]));

    renderWith(<AdminFinancePage />);

    const pendingTile = await screen.findByRole('button', { name: /Phí chờ thu/ });
    fireEvent.click(pendingTile);

    await waitFor(() =>
      expect(financeApi.serviceFees).toHaveBeenCalledWith({ status: 'PENDING', page: 1, pageSize: 20 })
    );
    expect(screen.getByRole('tab', { name: 'Công nợ phí' }).getAttribute('aria-selected')).toBe('true');
    expect(pendingTile.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Trạng thái phí' })).toBeInTheDocument();
    expect(screen.getByText('Chờ thanh toán')).toBeInTheDocument();
  });

  it('shows baseSalary × feeMultiplier formula only for PLACEMENT fees, not SETTLEMENT or CREDIT', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue(page([]));
    const placementFee: ServiceFee = {
      serviceFeeId: 'fee-plc', placementId: 'p-1', kind: 'PLACEMENT', companyId: 'co-1', companyName: 'Công ty Placement',
      jobTitle: 'Backend Engineer', candidateName: 'Nguyễn Văn A', baseSalary: 20_000_000, feeMultiplier: 1.5,
      amount: 30_000_000, currencyCode: 'VND', dueDate: '2026-11-10', status: 'PAID', paidAt: '2026-11-05T10:00:00Z',
      createdAt: '2026-11-01',
    };
    const settlementFee: ServiceFee = {
      serviceFeeId: 'fee-set', placementId: null, kind: 'SETTLEMENT', companyId: 'co-2', companyName: 'Công ty Settlement',
      jobTitle: 'QA Engineer', candidateName: null, baseSalary: 5_000_000, feeMultiplier: 1,
      amount: 3_800_000, currencyCode: 'VND', dueDate: '2026-11-10', status: 'PAID', paidAt: '2026-11-05T10:00:00Z',
      createdAt: '2026-11-01',
    };
    const creditFee: ServiceFee = {
      serviceFeeId: 'fee-crd', placementId: null, kind: 'CREDIT', companyId: 'co-3', companyName: 'Công ty Credit',
      jobTitle: 'FE Engineer', candidateName: null, baseSalary: 2_000_000, feeMultiplier: 1,
      amount: 1_200_000, currencyCode: 'VND', dueDate: '2026-11-10', status: 'PAID', paidAt: '2026-11-05T10:00:00Z',
      createdAt: '2026-11-01',
    };
    vi.mocked(financeApi.serviceFees).mockResolvedValue(page([placementFee, settlementFee, creditFee]));

    renderWith(<AdminFinancePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Công nợ phí' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết khoản phí Công ty Placement' }, { timeout: 10000 }));
    expect(await screen.findByText(/Công thức:.*20\.000\.000.*×\s*1\.5/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết khoản phí Công ty Settlement' }));
    expect(await screen.findByText('fee-set')).toBeInTheDocument();
    expect(screen.queryByText(/Công thức:/)).toBeNull();
    expect(screen.queryByText(/×\s*1\b/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết khoản phí Công ty Credit' }));
    expect(await screen.findByText('fee-crd')).toBeInTheDocument();
    expect(screen.queryByText(/Công thức:/)).toBeNull();
    expect(screen.queryByText(/×\s*1\b/)).toBeNull();
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
    vi.mocked(financeApi.replacementSlots).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 } as never);
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

    await waitFor(() => expect(financeApi.serviceFees).toHaveBeenCalledWith(expect.objectContaining({ kind: 'PLACEMENT' })));
    // Headhunt only: the fee table asks PLACEMENT, the replacement slots ask their refunds; never Sourcing kinds.
    for (const [params] of vi.mocked(financeApi.serviceFees).mock.calls) {
      expect(['PLACEMENT', 'REPLACEMENT_REFUND']).toContain(params.kind);
    }
  });

  it('shows clear refund status, replacement semantics, and linked slot ID on voided warranty', async () => {
    const expiredSlot: ReplacementSlotDto = {
      replacementSlotId: '68ef9a24-1234-5678-9012-000000000000',
      jobId: 'job-1',
      jobTitle: '[Headhunt] Principal Solutions Architect',
      companyName: 'HR Connect Demo Company',
      status: 'EXPIRED',
      originalPlacementId: 'p-void-1',
      originalCandidateName: 'Demo Candidate 2',
      serviceFeeId: 'fee-orig',
      fillWindowDays: 30,
      openedAt: '2026-11-12',
      expiresAt: '2026-11-12',
      extendedAt: '2026-11-12',
      filledByPlacementId: null,
      replacementCandidateName: null,
      closedAt: '2026-11-12',
      cancelReason: null,
      concurrencyToken: 'tok-1',
      createdAt: '2026-11-12',
    };
    const pendingRefund: ServiceFee = {
      serviceFeeId: 'fee-refund-1',
      placementId: 'p-void-1',
      jobId: 'job-1',
      kind: 'REPLACEMENT_REFUND',
      companyId: 'company-1',
      baseSalary: 18_000_000,
      amount: 5_400_000,
      feeMultiplier: 0.3,
      currencyCode: 'VND',
      dueDate: '2026-11-13',
      status: 'PENDING',
      createdAt: '2026-11-12',
    };
    const voidedWarranty: Warranty = {
      warrantyId: 'w-void-1',
      placementId: 'p-void-1',
      companyName: 'HR Connect Demo Company',
      jobTitle: '[Headhunt] Principal Solutions Architect',
      candidateName: 'Demo Candidate 2',
      startDate: '2026-11-12',
      endDate: '2026-11-13',
      status: 'VOIDED',
      placementStatus: 'RESIGNED',
      serviceFeeStatus: 'PAID',
      serviceFeeAmount: 18_000_000,
    };

    vi.mocked(financeApi.replacementSlots).mockResolvedValue({ items: [expiredSlot], totalCount: 1, page: 1, pageSize: 100 } as never);
    vi.mocked(financeApi.warranties).mockResolvedValue(page([voidedWarranty]));
    vi.mocked(financeApi.serviceFees).mockImplementation(async (params) => {
      if (params?.kind === 'REPLACEMENT_REFUND') return page([pendingRefund]);
      return page<ServiceFee>([]);
    });

    renderWith(<ClientWarrantyPage />);

    expect(await screen.findByText('Chưa tuyển được người thay', {}, { timeout: 10000 })).toBeTruthy();
    expect(await screen.findByText(/Chờ hoàn 30%/)).toBeTruthy();
    expect(screen.getByText('Suất #68EF9A24 · Mở 12/11/2026')).toBeTruthy();
    expect(screen.queryByText('Xem Công nợ')).toBeNull();
  });

  it('displays daysRemaining pill, claim summary, serviceFeeDueDate, and AP/SS exclusion hint', async () => {
    const activeWarranty: Warranty = {
      warrantyId: 'w-act-1',
      placementId: 'p-act-1',
      jobId: 'job-act-1',
      companyName: 'ABC Tech',
      jobTitle: 'Senior Backend .NET',
      candidateName: 'Nguyễn Minh Quân',
      startDate: '2026-11-01',
      endDate: '2026-12-01',
      status: 'ACTIVE',
      daysRemaining: 6,
      placementStatus: 'ACTIVE',
      serviceFeeStatus: 'PENDING',
      serviceFeeAmount: 20_000_000,
      serviceFeeDueDate: '2026-11-25',
    };
    const claimedWarranty: Warranty = {
      warrantyId: 'w-clm-1',
      placementId: 'p-clm-1',
      jobId: 'job-clm-1',
      companyName: 'ABC Tech',
      jobTitle: 'Tech Lead',
      candidateName: 'Trần Thu Hà',
      startDate: '2026-10-01',
      endDate: '2026-11-30',
      status: 'CLAIMED',
      placementStatus: 'LEFT_DURING_WARRANTY',
      daysRemaining: null,
      claimReportedAt: '2026-11-10T09:00:00Z',
      lastWorkingDate: '2026-11-08',
      resignationReason: 'Chuyển công tác ra nước ngoài',
      replacementSlotId: 'aa11bb22-3344-5566-7788-9900aabbccdd',
      replacementSlotStatus: 'WAITING_PAYMENT',
      serviceFeeStatus: 'PAID',
      serviceFeeAmount: 25_000_000,
    };

    vi.mocked(financeApi.replacementSlots).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 } as never);
    vi.mocked(financeApi.warranties).mockResolvedValue(page([activeWarranty, claimedWarranty]));
    vi.mocked(financeApi.serviceFees).mockResolvedValue(page<ServiceFee>([]));

    renderWith(<ClientWarrantyPage />);

    expect(await screen.findByText('Còn 6 ngày', {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText('Hạn TT: 25/11/2026')).toBeTruthy();
    expect(screen.getByText(/Chỉ áp dụng cho Headhunt COD/)).toBeTruthy();
    expect(screen.getByText(/Nghỉ 8\/11\/2026 · Báo 10\/11\/2026/)).toBeTruthy();
    expect(screen.getByText('Lý do: Chuyển công tác ra nước ngoài')).toBeTruthy();
    expect(screen.getByText('Suất #AA11BB22')).toBeTruthy();
    expect(screen.getByText('Chờ xác minh')).toBeTruthy();
  });

  it('shows replacement-only wording without fee adjustment when opening client resignation modal', async () => {
    const activeWarranty: Warranty = {
      warrantyId: 'w-act-2',
      placementId: 'p-act-2',
      jobId: 'job-act-2',
      companyName: 'ABC Tech',
      jobTitle: 'Senior Backend .NET',
      candidateName: 'Nguyễn Minh Quân',
      startDate: '2026-11-01',
      endDate: '2026-12-01',
      status: 'ACTIVE',
      daysRemaining: 6,
      placementStatus: 'ACTIVE',
      serviceFeeStatus: 'PENDING',
      serviceFeeAmount: 20_000_000,
    };

    vi.mocked(financeApi.replacementSlots).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 100 } as never);
    vi.mocked(financeApi.warranties).mockResolvedValue(page([activeWarranty]));
    vi.mocked(financeApi.serviceFees).mockResolvedValue(page<ServiceFee>([]));

    renderWith(<ClientWarrantyPage />);

    const reportBtn = await screen.findByRole('button', { name: 'Báo nghỉ việc' }, { timeout: 10000 });
    fireEvent.click(reportBtn);

    expect(
      await screen.findByText(/để xác minh và mở suất tìm ứng viên thay thế miễn phí theo thỏa thuận/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/điều chỉnh phí/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  });
});
