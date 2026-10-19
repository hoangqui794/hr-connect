import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  confirmedAt: '2026-10-15T08:00:00Z',
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

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <HrPlacementStartDateCorrectionPage />
      </AntApp>
    </QueryClientProvider>
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
});
