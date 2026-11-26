import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrPlacementStartDateCorrectionPage } from './HrPlacementStartDateCorrectionPage';
import { placementCorrectionApi } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({
  placementCorrectionApi: {
    list: vi.fn(),
    get: vi.fn(),
    correctStartDate: vi.fn(),
  },
}));

const placement = {
  placementId: 'placement-1',
  applicationId: 'application-1',
  actualStartDate: '2026-10-15',
  position: 'Backend Engineer',
  department: 'Engineering',
  status: 'ACTIVE',
  confirmedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  confirmedByName: 'Client HR',
  candidate: { candidateId: 'candidate-1', fullName: 'Nguyễn Văn A', email: 'candidate@example.com', phoneNumber: '0900000000' },
  job: { jobId: 'job-1', title: 'Senior Backend Engineer', companyId: 'company-1', companyName: 'HR Connect' },
};

const placementDetail = {
  ...placement,
  offerId: 'offer-1',
  confirmedBy: 'client-user-1',
  confirmationNote: 'Ứng viên đã bắt đầu làm việc.',
  isReplacement: false,
  replacementSlotId: null,
  replacesPlacementId: null,
  candidate: { candidateId: 'candidate-1', fullName: 'Nguyễn Văn A', email: 'candidate@example.com', phone: '0900000000', summary: null },
  allowedActions: ['CORRECT_START_DATE'],
  createdAt: '2026-10-15T08:00:00Z',
  updatedAt: '2026-10-15T08:00:00Z',
};

const renderPage = (
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) => {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <HrPlacementStartDateCorrectionPage />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const findButtonWithText = (text: string) => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === text
  );

  expect(button, `Expected a button labelled "${text}"`).toBeDefined();
  return button!;
};

describe('HrPlacementStartDateCorrectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(placementCorrectionApi.list).mockResolvedValue({ items: [placement], page: 1, pageSize: 10, total: 1, totalPages: 1 });
    vi.mocked(placementCorrectionApi.get).mockResolvedValue(placementDetail as any);
    vi.mocked(placementCorrectionApi.correctStartDate).mockResolvedValue({ success: true, message: 'Đã cập nhật ngày đi làm thực tế.' });
  });

  it('lets Internal HR correct a selected placement only after providing a reason', async () => {
    renderPage();

    await screen.findByText('Xem');
    await userEvent.click(findButtonWithText('Xem'));
    await waitFor(() => expect(placementCorrectionApi.get).toHaveBeenCalledWith('placement-1'));
    await screen.findByText('Sửa ngày đi làm');
    await userEvent.click(findButtonWithText('Sửa ngày đi làm'));

    expect(screen.getByLabelText('Ngày đi làm thực tế')).toBeInTheDocument();
    const reason = screen.getByLabelText('Lý do chỉnh sửa');
    fireEvent.change(reason, { target: { value: 'Client nhập nhầm ngày bắt đầu làm việc.' } });
    fireEvent.click(findButtonWithText('Lưu ngày mới'));

    await waitFor(() => {
      expect(placementCorrectionApi.correctStartDate).toHaveBeenCalledWith('placement-1', {
        actualStartDate: '2026-10-15',
        reason: 'Client nhập nhầm ngày bắt đầu làm việc.',
      });
    });
  });

  it('disables correction after the seven-day window', async () => {
    vi.mocked(placementCorrectionApi.get).mockResolvedValue({
      ...placementDetail,
      confirmedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    } as any);
    renderPage();

    await screen.findByText('Xem');
    await userEvent.click(findButtonWithText('Xem'));

    expect(await screen.findByText('Đã hết thời hạn chỉnh sửa')).toBeInTheDocument();
    expect(findButtonWithText('Sửa ngày đi làm')).toBeDisabled();
  });

  it('locks correction when service fee is already PAID and shows warranty end date', async () => {
    vi.mocked(placementCorrectionApi.get).mockResolvedValue({
      ...placementDetail,
      financial: { serviceFeeAmount: 30_000_000, serviceFeeStatus: 'PAID', commissionAmount: null, commissionStatus: null },
      warranty: { warrantyId: 'war-1', startDate: '2026-10-15', endDate: '2026-11-14', status: 'ACTIVE', resultNote: null },
    } as any);
    renderPage();

    await screen.findByText('Xem');
    await userEvent.click(findButtonWithText('Xem'));

    expect(await screen.findByText('Không thể sửa ngày đi làm (đã thu phí)')).toBeInTheDocument();
    expect(screen.getByText('Hạn bảo hành hiện tại')).toBeInTheDocument();
    expect(screen.getByText('14/11/2026')).toBeInTheDocument();
    expect(findButtonWithText('Sửa ngày đi làm')).toBeDisabled();
  });

  it('invalidates reconciliation, warranty, fee and nav-count caches after correction', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderPage(queryClient);

    await screen.findByText('Xem');
    await userEvent.click(findButtonWithText('Xem'));
    await screen.findByText('Sửa ngày đi làm');
    await userEvent.click(findButtonWithText('Sửa ngày đi làm'));

    fireEvent.change(screen.getByLabelText('Lý do chỉnh sửa'), { target: { value: 'Sửa lại ngày nhận việc thực tế.' } });
    fireEvent.click(findButtonWithText('Lưu ngày mới'));

    await waitFor(() => {
      for (const queryKey of [
        ['placement-reconciliations'],
        ['hr-nav-counts'],
        ['mf05-warranties'],
        ['mf05-fees'],
        ['placements'],
      ]) {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
      }
    });
  });

  it('passes keyword search and status filter to placementCorrectionApi.list', async () => {
    renderPage();
    await screen.findByText('Xem');

    fireEvent.change(screen.getByLabelText('Tìm kiếm danh sách nhận việc'), { target: { value: 'Nguyễn' } });
    await waitFor(() =>
      expect(placementCorrectionApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: 'Nguyễn', page: 1, pageSize: 10 })
      )
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Nghỉ trong bảo hành' }));
    await waitFor(() =>
      expect(placementCorrectionApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'LEFT_DURING_WARRANTY', keyword: 'Nguyễn', page: 1, pageSize: 10 })
      )
    );
  });
});
