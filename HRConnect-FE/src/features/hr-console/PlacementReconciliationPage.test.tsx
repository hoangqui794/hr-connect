import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPlacementReconciliationPage, HrPlacementReconciliationPage } from './PlacementReconciliationPage';
import { placementReconciliationApi } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({
  placementReconciliationApi: {
    list: vi.fn(),
    reconcile: vi.fn(),
    resolve: vi.fn(),
  },
}));

const pending = {
  reconciliationId: 'rec-1',
  applicationId: 'app-1',
  placementId: 'placement-1',
  jobTitle: 'Backend Developer',
  companyName: 'ABC Technology',
  candidateName: 'Nguyễn Văn An',
  candidateEmail: 'ng***@mail.com',
  affiliateName: 'Cộng tác viên A',
  claimedOutcome: 'STARTED' as const,
  actualStartDate: '2026-10-23',
  serviceFeeAmount: 30_000_000,
  serviceFeeCurrency: 'VND',
  status: 'PENDING' as const,
  contactChannel: null,
  note: null,
  resolutionNote: null,
  resolutionAction: null,
  concurrencyToken: 'token-1',
  createdAt: '2026-10-23T01:00:00Z',
  reviewedAt: null,
};

const renderPage = (admin = false) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AntApp>{admin ? <AdminPlacementReconciliationPage /> : <HrPlacementReconciliationPage />}</AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const exactButton = (text: string, last = false) => {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
    (item) => item.textContent?.replace(/\s+/g, ' ').trim() === text
  );
  const button = last ? buttons[buttons.length - 1] : buttons[0];
  expect(button).toBeDefined();
  return button!;
};

describe('PlacementReconciliationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({ items: [pending], totalCount: 1, page: 1, pageSize: 10 });
    vi.mocked(placementReconciliationApi.reconcile).mockResolvedValue({});
    vi.mocked(placementReconciliationApi.resolve).mockResolvedValue({});
  });

  it('lets Internal HR confirm a pending result with its concurrency token', async () => {
    renderPage();
    await screen.findByText('Xem');
    await userEvent.click(exactButton('Xem'));
    await userEvent.click(exactButton('Xác nhận đúng'));
    await userEvent.click(exactButton('Xác nhận đúng', true));

    await waitFor(() => expect(placementReconciliationApi.reconcile).toHaveBeenCalledWith('app-1', {
      decision: 'CONFIRM',
      contactChannel: 'CANDIDATE',
      note: null,
      concurrencyToken: 'token-1',
    }));
  });

  it('requires a note before Internal HR can report a mismatch', async () => {
    renderPage();
    await screen.findByText('Xem');
    await userEvent.click(exactButton('Xem'));
    await userEvent.click(exactButton('Báo không khớp'));
    await userEvent.click(exactButton('Chuyển Admin xử lý', true));

    expect(await screen.findByText('Nhập nội dung xác minh.')).toBeInTheDocument();
    expect(placementReconciliationApi.reconcile).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Thông tin không khớp'), { target: { value: 'Ứng viên xác nhận đã đi làm.' } });
    await userEvent.click(exactButton('Chuyển Admin xử lý', true));
    await waitFor(() => expect(placementReconciliationApi.reconcile).toHaveBeenCalled());
  });

  it('lets Platform Admin resolve a flagged record without erasing the HR note', async () => {
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({
      items: [{ ...pending, status: 'FLAGGED', note: 'Client và ứng viên cung cấp thông tin khác nhau.' }],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
    renderPage(true);
    await screen.findByText('Xem');
    await userEvent.click(exactButton('Xem'));
    expect(await screen.findByText('Client và ứng viên cung cấp thông tin khác nhau.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã xử lý' }));
    fireEvent.change(screen.getByLabelText('Kết quả xử lý'), { target: { value: 'Đã đối chiếu biên bản nhận việc.' } });
    await userEvent.click(exactButton('Hoàn tất xử lý', true));
    await waitFor(() => expect(placementReconciliationApi.resolve).toHaveBeenCalledWith('app-1', {
      action: 'CONFIRM_REPORTED_OUTCOME',
      note: 'Đã đối chiếu biên bản nhận việc.',
      concurrencyToken: 'token-1',
    }));
  });

  it('lets Platform Admin reopen an incorrect not-started report', async () => {
    vi.mocked(placementReconciliationApi.list).mockResolvedValue({
      items: [{ ...pending, placementId: null, claimedOutcome: 'NOT_STARTED', status: 'FLAGGED', note: 'Ứng viên xác nhận đã đi làm.' }],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });
    renderPage(true);
    await screen.findByText('Xem');
    await userEvent.click(exactButton('Xem'));
    await userEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã xử lý' }));
    await userEvent.click(screen.getByLabelText('Client khai sai — mở lại để xác nhận đi làm'));
    fireEvent.change(screen.getByLabelText('Kết quả xử lý'), { target: { value: 'Đã xác minh ứng viên thực tế đi làm.' } });
    await userEvent.click(exactButton('Hoàn tất xử lý', true));
    await waitFor(() => expect(placementReconciliationApi.resolve).toHaveBeenCalledWith('app-1', {
      action: 'REOPEN_FOR_CLIENT_CONFIRMATION',
      note: 'Đã xác minh ứng viên thực tế đi làm.',
      concurrencyToken: 'token-1',
    }));
  });
});
