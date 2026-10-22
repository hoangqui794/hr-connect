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
});
