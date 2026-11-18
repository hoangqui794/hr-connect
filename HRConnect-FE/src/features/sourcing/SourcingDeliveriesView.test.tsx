/**
 * @file features/sourcing/SourcingDeliveriesView.test.tsx
 * @description Unit and integration tests for SourcingDeliveriesView (MF-03 CV Sourcing).
 */

import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SourcingDeliveriesView } from './SourcingDeliveriesView';
import { sourcingApi } from '@/services/api/sourcingApi';
import type { SourcingDeliveriesResponse } from '@/types/api/sourcing';

vi.mock('@/services/api/sourcingApi', () => ({
  sourcingApi: {
    getDeliveries: vi.fn(),
    deliverCvs: vi.fn(),
    decideDelivery: vi.fn(),
    reviewRejection: vi.fn(),
    replaceDelivery: vi.fn(),
  },
}));

// Mock matchMedia for Ant Design responsive Grid & Table
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const mockSummary: SourcingDeliveriesResponse['summary'] = {
  sourcingTarget: 10,
  delivered: 5,
  accepted: 2,
  autoAccepted: 1,
  rejected: 1,
  pendingReview: 1,
  counted: 3,
};

const relativeDate = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

const mockDeliveries: SourcingDeliveriesResponse['items'] = [
  {
    deliveryId: 'del-1',
    applicationId: 'app-1',
    candidateName: 'Nguyễn Văn A',
    status: 'DELIVERED',
    deliveredAt: '2026-10-15T00:00:00Z',
    reviewDueAt: relativeDate(6),
    daysLeft: 6,
    decidedAt: null,
    rejectReasonCode: null,
    rejectNote: null,
    replacedByDeliveryId: null,
  },
  {
    deliveryId: 'del-2',
    applicationId: 'app-2',
    candidateName: 'Trần Thị B',
    status: 'ACCEPTED',
    deliveredAt: '2026-10-10T00:00:00Z',
    reviewDueAt: '2026-10-17T00:00:00Z',
    daysLeft: null,
    decidedAt: '2026-10-12T00:00:00Z',
    rejectReasonCode: null,
    rejectNote: null,
    replacedByDeliveryId: null,
  },
  {
    deliveryId: 'del-3',
    applicationId: 'app-3',
    candidateName: 'Lê Văn C',
    status: 'REJECTED',
    deliveredAt: '2026-10-09T00:00:00Z',
    reviewDueAt: '2026-10-16T00:00:00Z',
    daysLeft: null,
    decidedAt: '2026-10-11T00:00:00Z',
    rejectReasonCode: 'DUPLICATE_ALREADY_OWNED',
    rejectNote: 'Ứng viên đã nộp trực tiếp từ trước',
    replacedByDeliveryId: null,
  },
];

const renderComponent = (props: {
  jobId?: string;
  role?: 'client' | 'hr';
  onViewCandidate?: (id: string) => void;
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <SourcingDeliveriesView
          jobId={props.jobId || 'job-123'}
          jobTitle="Senior Backend Engineer"
          role={props.role || 'client'}
          onViewCandidate={props.onViewCandidate}
        />
      </AntApp>
    </QueryClientProvider>
  );
};

describe('SourcingDeliveriesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when fetching data', () => {
    vi.mocked(sourcingApi.getDeliveries).mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(document.querySelector('.ant-skeleton')).toBeInTheDocument();
  });

  it('renders error state with retry button when API fails', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockRejectedValueOnce(new Error('Network error'));
    renderComponent();

    expect(await screen.findByText('Không thể tải danh sách CV bàn giao', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no deliveries', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValueOnce({
      summary: {
        sourcingTarget: 5,
        delivered: 0,
        accepted: 0,
        autoAccepted: 0,
        rejected: 0,
        pendingReview: 0,
        counted: 0,
      },
      items: [],
    });

    renderComponent();

    expect(await screen.findByText('Chưa có hồ sơ CV nào trong danh sách này.', {}, { timeout: 10000 })).toBeInTheDocument();
  });

  it('renders progress summary and delivery items with 7-day deadline countdown', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: mockDeliveries,
    });

    renderComponent();

    // Summary target & progress
    expect(await screen.findByText('Tiến độ bàn giao CV Sourcing', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('Mục tiêu: 10 CV')).toBeInTheDocument();

    // Candidate names
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument();

    // 7-day countdown badge for DELIVERED item
    expect(screen.getByText('Còn 6 ngày')).toBeInTheDocument();

    // Rejection reason
    expect(screen.getByText(/Ứng viên công ty đã có sẵn/i)).toBeInTheDocument();
  });

  it('allows Client to accept CV and calls decideDelivery API', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: [mockDeliveries[0]], // DELIVERED
    });
    vi.mocked(sourcingApi.decideDelivery).mockResolvedValueOnce({
      ...mockDeliveries[0],
      status: 'ACCEPTED',
      decidedAt: '2026-10-16T12:00:00Z',
    });

    renderComponent({ role: 'client' });

    const acceptBtn = await screen.findByRole('button', { name: /Chấp nhận CV/i }, { timeout: 10000 });
    expect(acceptBtn).toBeInTheDocument();

    fireEvent.click(acceptBtn);

    // Confirmation modal should open
    const dialog = await screen.findByRole('dialog', {}, { timeout: 10000 });
    expect(within(dialog).getByText(/Xác nhận chấp nhận CV của Nguyễn Văn A/i)).toBeInTheDocument();

    // Confirm in modal
    const confirmBtn = within(dialog).getByRole('button', { name: 'Chấp nhận CV' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(sourcingApi.decideDelivery).toHaveBeenCalledWith('job-123', 'del-1', {
        decision: 'ACCEPTED',
      });
    });
  });

  it('allows Client to reject CV with a valid reason code', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: [mockDeliveries[0]], // DELIVERED
    });
    vi.mocked(sourcingApi.decideDelivery).mockResolvedValueOnce({
      ...mockDeliveries[0],
      status: 'REJECTED',
      rejectReasonCode: 'FALSE_INFORMATION',
      decidedAt: '2026-10-16T12:00:00Z',
    });

    renderComponent({ role: 'client' });

    const rejectBtn = await screen.findByRole('button', { name: /Từ chối CV/i }, { timeout: 10000 });
    fireEvent.click(rejectBtn);

    // Reject modal opens
    expect(await screen.findByText(/Từ chối hồ sơ ứng viên Nguyễn Văn A/i, {}, { timeout: 10000 })).toBeInTheDocument();

    // Select FALSE_INFORMATION radio
    const radioFalseInfo = screen.getByLabelText(/Thông tin ứng viên sai sự thật/i);
    fireEvent.click(radioFalseInfo);

    // Submit modal
    const submitBtn = screen.getByRole('button', { name: 'Xác nhận từ chối' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(sourcingApi.decideDelivery).toHaveBeenCalledWith('job-123', 'del-1', {
        decision: 'REJECTED',
        reasonCode: 'FALSE_INFORMATION',
        note: undefined,
      });
    });
  });

  it('displays overdue label and disables decision buttons when 7-day review window has closed', async () => {
    const expiredDelivery = {
      ...mockDeliveries[0],
      reviewDueAt: relativeDate(-1),
      daysLeft: 0,
    };

    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: [expiredDelivery],
    });

    renderComponent({ role: 'client' });

    expect(await screen.findByText('Quá hạn xem xét', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Chấp nhận CV/i })).not.toBeInTheDocument();
  });

  it('shows reviewDays, remaining count, finance totals, rejection review notes, replacement candidate and AI score', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: {
        ...mockSummary,
        reviewDays: 5,
        pricePerCv: 2_000_000,
        counted: 3,
        countedAmount: 6_000_000,
        depositPaidAmount: 3_500_000,
        remainingToDeliver: 7,
        jobStatus: 'ACTIVE',
      },
      items: [
        {
          ...mockDeliveries[1],
          deliveryId: 'del-overturned',
          candidateName: 'Ứng Viên Bị Bác Từ Chối',
          status: 'ACCEPTED',
          rejectionReviewStatus: 'OVERTURNED',
          rejectionReviewNote: 'Hồ sơ khớp toàn bộ tiêu chí bắt buộc',
          rejectionReviewedAt: '2026-10-13T08:30:00Z',
          aiMatchScore: 92.4,
        },
        {
          ...mockDeliveries[2],
          deliveryId: 'del-pending-review',
          candidateName: 'Ứng Viên Chờ HR Duyệt',
          status: 'REJECTED',
          rejectReasonCode: 'OTHER',
          rejectNote: 'Chưa phù hợp văn hóa',
          rejectionReviewStatus: 'PENDING_HR_REVIEW',
        },
        {
          ...mockDeliveries[2],
          deliveryId: 'del-replaced',
          candidateName: 'Ứng Viên Đã Đổi',
          status: 'REPLACED',
          replacedByDeliveryId: 'del-new',
          replacementCandidateName: 'Đỗ Thị D',
        },
      ],
    });

    renderComponent({ role: 'client' });

    expect(await screen.findByText('Hạn xem xét: 5 ngày/CV', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('Còn thiếu 7/10 CV')).toBeInTheDocument();
    expect(screen.getByText('2.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('6.000.000 đ')).toBeInTheDocument();
    expect(screen.getByText('3.500.000 đ')).toBeInTheDocument();
    expect(screen.getByText('2.500.000 đ')).toBeInTheDocument();
    expect(screen.getByText('Cần quyết toán dự kiến')).toBeInTheDocument();

    expect(screen.getByText('AI 92%')).toBeInTheDocument();
    expect(screen.getByText('HR Connect bác bỏ từ chối · tính phí')).toBeInTheDocument();
    expect(screen.getByText('"Hồ sơ khớp toàn bộ tiêu chí bắt buộc"')).toBeInTheDocument();
    expect(screen.getByText('Chờ HR Connect xác minh')).toBeInTheDocument();
    expect(screen.getByText('Đã thay bằng: Đỗ Thị D')).toBeInTheDocument();
  });

  it('explains why no CVs have been delivered yet when job is PENDING_PAYMENT', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValueOnce({
      summary: {
        sourcingTarget: 5,
        delivered: 0,
        accepted: 0,
        autoAccepted: 0,
        rejected: 0,
        pendingReview: 0,
        counted: 0,
        jobStatus: 'PENDING_PAYMENT',
      },
      items: [],
    });

    renderComponent({ role: 'client' });

    expect(
      await screen.findByText(/Tin đang chờ thanh toán tiền cọc CV Sourcing/i, {}, { timeout: 10000 })
    ).toBeInTheDocument();
  });
});

describe('SourcingDeliveriesView HR rejection review (FE-C02, FE-M03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const rejectedOther = (overrides: Partial<SourcingDeliveriesResponse['items'][number]>) => ({
    ...mockDeliveries[2],
    rejectReasonCode: 'OTHER' as const,
    rejectNote: 'Chưa phù hợp văn hóa',
    ...overrides,
  });

  it('requires a note when HR overturns an OTHER rejection and does not call the API without it', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: [rejectedOther({ deliveryId: 'del-pending', candidateName: 'Ứng Viên Chờ HR Duyệt', rejectionReviewStatus: 'PENDING_HR_REVIEW' })],
    });

    renderComponent({ role: 'hr' });

    fireEvent.click(await screen.findByRole('button', { name: 'Xác minh' }, { timeout: 10000 }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Ghi chú xác minh (Không bắt buộc)')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('radio', { name: /Bác bỏ từ chối/ }));
    expect(await within(dialog).findByText('Ghi chú xác minh (Bắt buộc)')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByPlaceholderText('Ghi chú nội dung xác minh...'), { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu kết quả xác minh' }));

    expect(await within(dialog).findByText('Nhập lý do bác bỏ từ chối của Doanh nghiệp.')).toBeInTheDocument();
    expect(sourcingApi.reviewRejection).not.toHaveBeenCalled();

    // Switching back to "keep the rejection" makes the note optional again and clears the error.
    fireEvent.click(within(dialog).getByRole('radio', { name: /Giữ nguyên từ chối/ }));
    expect(await within(dialog).findByText('Ghi chú xác minh (Không bắt buộc)')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).queryByText('Nhập lý do bác bỏ từ chối của Doanh nghiệp.')).not.toBeInTheDocument()
    );
  });

  it('sends the trimmed note when HR overturns an OTHER rejection with a note', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: [rejectedOther({ deliveryId: 'del-pending', candidateName: 'Ứng Viên Chờ HR Duyệt', rejectionReviewStatus: 'PENDING_HR_REVIEW' })],
    });
    vi.mocked(sourcingApi.reviewRejection).mockResolvedValue({} as any);

    renderComponent({ role: 'hr' });

    fireEvent.click(await screen.findByRole('button', { name: 'Xác minh' }, { timeout: 10000 }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: /Bác bỏ từ chối/ }));
    fireEvent.change(within(dialog).getByPlaceholderText('Ghi chú nội dung xác minh...'), {
      target: { value: '  Hồ sơ khớp tiêu chí bắt buộc  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu kết quả xác minh' }));

    await waitFor(() =>
      expect(sourcingApi.reviewRejection).toHaveBeenCalledWith('job-123', 'del-pending', {
        upheld: false,
        note: 'Hồ sơ khớp tiêu chí bắt buộc',
      })
    );
  });

  it('hides the Xác minh button once HR has already upheld the rejection', async () => {
    vi.mocked(sourcingApi.getDeliveries).mockResolvedValue({
      summary: mockSummary,
      items: [
        rejectedOther({
          deliveryId: 'del-upheld',
          candidateName: 'Ứng Viên Đã Xác Minh',
          rejectionReviewStatus: 'UPHELD',
          rejectionReviewNote: 'Đúng là chưa phù hợp',
        }),
      ],
    });

    renderComponent({ role: 'hr' });

    expect(await screen.findByText('Ứng Viên Đã Xác Minh', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thay CV dự phòng/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác minh' })).not.toBeInTheDocument();
  });
});
