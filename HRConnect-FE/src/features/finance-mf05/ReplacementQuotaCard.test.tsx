/**
 * @file features/finance-mf05/ReplacementQuotaCard.test.tsx
 * @description Unit and integration tests for ReplacementQuotaCard (MF-05 Replacement Quota).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReplacementQuotaCard } from './ReplacementQuotaCard';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';
import type { PlacementListItem, ReplacementSlotDto } from '@/types/api/finance';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/api/financeApi', () => ({
  financeApi: {
    getPlacements: vi.fn(),
    getReplacementSlots: vi.fn(),
    cancelReplacementSlot: vi.fn(),
  },
}));

vi.mock('@/services/api/jobsApi', () => ({
  jobsApi: {
    getMine: vi.fn(),
  },
}));

const mockPlacements: PlacementListItem[] = [
  {
    placementId: 'pl-1',
    applicationId: 'app-1',
    offerId: 'off-1',
    actualStartDate: '2026-09-01',
    position: 'Senior Java Engineer',
    department: 'Backend',
    status: 'RESIGNED',
    candidate: {
      candidateId: 'cand-1',
      fullName: 'Trần Văn An',
      email: 'an@example.com',
      phoneNumber: '0901234567',
    },
    job: {
      jobId: 'job-101',
      title: 'Senior Java Engineer',
      companyId: 'comp-1',
      companyName: 'FPT Software',
    },
  },
];

const mockSlots: ReplacementSlotDto[] = [
  {
    replacementSlotId: 'slot-uuid-1',
    jobId: 'job-101',
    status: 'OPEN',
    originalPlacementId: 'pl-1',
    originalCandidateName: 'Trần Văn An',
    serviceFeeId: 'fee-1',
    fillWindowDays: 30,
    openedAt: '2026-10-10T00:00:00Z',
    expiresAt: '2026-11-09T00:00:00Z', // ~23 days remaining
    filledByPlacementId: null,
    replacementCandidateName: null,
    closedAt: null,
    cancelReason: null,
    concurrencyToken: 'token-abc-1',
    createdAt: '2026-10-10T00:00:00Z',
  },
  {
    replacementSlotId: 'slot-uuid-2',
    jobId: 'job-101',
    status: 'WAITING_PAYMENT',
    originalPlacementId: 'pl-2',
    originalCandidateName: 'Lê Thị Bình',
    serviceFeeId: 'fee-2',
    fillWindowDays: 30,
    openedAt: null,
    expiresAt: null,
    filledByPlacementId: null,
    replacementCandidateName: null,
    closedAt: null,
    cancelReason: null,
    concurrencyToken: 'token-abc-2',
    createdAt: '2026-10-12T00:00:00Z',
  },
];

const renderComponent = (props: { mode?: 'client' | 'hr'; selectedJobId?: string } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AntApp>
          <ReplacementQuotaCard
            mode={props.mode || 'client'}
            selectedJobId={props.selectedJobId}
          />
        </AntApp>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('ReplacementQuotaCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when fetching data', () => {
    vi.mocked(financeApi.getPlacements).mockReturnValue(new Promise(() => {}));
    vi.mocked(jobsApi.getMine).mockReturnValue(new Promise(() => {}));

    renderComponent();

    expect(document.querySelector('.ant-skeleton')).toBeInTheDocument();
  });

  it('renders error state with retry button when query fails', async () => {
    vi.mocked(financeApi.getPlacements).mockResolvedValue({
      items: mockPlacements,
      totalCount: 1,
    });
    vi.mocked(jobsApi.getMine).mockResolvedValue([]);
    vi.mocked(financeApi.getReplacementSlots).mockRejectedValue(new Error('Network error'));

    renderComponent();

    expect(await screen.findByText('Không thể tải danh sách suất tuyển thay thế', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no replacement slots', async () => {
    vi.mocked(financeApi.getPlacements).mockResolvedValue({
      items: mockPlacements,
      totalCount: 1,
    });
    vi.mocked(jobsApi.getMine).mockResolvedValue([]);
    vi.mocked(financeApi.getReplacementSlots).mockResolvedValue([]);

    renderComponent();

    expect(await screen.findByText('Chưa có suất tuyển thay thế nào', {}, { timeout: 10000 })).toBeInTheDocument();
  });

  it('renders replacement slot items with countdown and status badges', async () => {
    vi.mocked(financeApi.getPlacements).mockResolvedValue({
      items: mockPlacements,
      totalCount: 1,
    });
    vi.mocked(jobsApi.getMine).mockResolvedValue([]);
    vi.mocked(financeApi.getReplacementSlots).mockResolvedValue(mockSlots);

    renderComponent({ mode: 'client' });

    expect(await screen.findByText('Trần Văn An', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('Lê Thị Bình')).toBeInTheDocument();
    expect(screen.getByText('Đang tìm ứng viên')).toBeInTheDocument();
    expect(screen.getByText('Chờ thanh toán phí')).toBeInTheDocument();
  });

  it('allows Client to click "Sử dụng suất" to navigate to job creation with replacement quota', async () => {
    vi.mocked(financeApi.getPlacements).mockResolvedValue({
      items: mockPlacements,
      totalCount: 1,
    });
    vi.mocked(jobsApi.getMine).mockResolvedValue([]);
    vi.mocked(financeApi.getReplacementSlots).mockResolvedValue([mockSlots[0]]); // OPEN

    renderComponent({ mode: 'client' });

    const useBtn = await screen.findByRole('button', { name: /Sử dụng suất/i }, { timeout: 10000 });
    expect(useBtn).toBeInTheDocument();

    fireEvent.click(useBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      '/client/post-job?jobId=job-101&replacementSlotId=slot-uuid-1&serviceType=HEADHUNT_COD'
    );
  });

  it('allows Internal HR to cancel a slot with a reason', async () => {
    vi.mocked(financeApi.getPlacements).mockResolvedValue({
      items: mockPlacements,
      totalCount: 1,
    });
    vi.mocked(financeApi.getReplacementSlots).mockResolvedValue([mockSlots[0]]);
    vi.mocked(financeApi.cancelReplacementSlot).mockResolvedValue({
      ...mockSlots[0],
      status: 'CANCELLED',
      cancelReason: 'Khách hàng cơ cấu lại phòng ban',
    });


    renderComponent({ mode: 'hr' });

    const cancelBtn = await screen.findByRole('button', { name: /Hủy suất/i }, { timeout: 10000 });
    fireEvent.click(cancelBtn);

    // Cancel modal opens
    expect(await screen.findByText('Hủy suất tuyển thay thế', {}, { timeout: 10000 })).toBeInTheDocument();

    // Input reason
    const reasonInput = screen.getByPlaceholderText(/Ví dụ: Doanh nghiệp đã cơ cấu lại phòng ban/i);
    fireEvent.change(reasonInput, { target: { value: 'Khách hàng cơ cấu lại phòng ban' } });

    // Submit
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận hủy' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(financeApi.cancelReplacementSlot).toHaveBeenCalledWith('slot-uuid-1', {
        reason: 'Khách hàng cơ cấu lại phòng ban',
        concurrencyToken: 'token-abc-1',
      });
    });
  });
});
