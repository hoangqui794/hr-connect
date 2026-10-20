import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationWorkbench } from './ApplicationWorkbench';
import { clientActionsApi, interviewHistoryApi, screeningApi } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({
  clientActionsApi: {
    scheduleInterview: vi.fn(),
    rescheduleInterview: vi.fn(),
    updateInterview: vi.fn(),
    cancelInterview: vi.fn(),
    recordResult: vi.fn(),
    recordNoShow: vi.fn(),
    decideBackup: vi.fn(),
    createOffer: vi.fn(),
    updateOffer: vi.fn(),
    sendOffer: vi.fn(),
    withdrawOffer: vi.fn(),
    setPlannedStart: vi.fn(),
    confirmStartWork: vi.fn(),
    markNotStarted: vi.fn(),
  },
  interviewHistoryApi: { get: vi.fn() },
  screeningApi: {
    get: vi.fn(),
    timeline: vi.fn(),
    startScreening: vi.fn(),
    updateStatus: vi.fn(),
    retryAiScoring: vi.fn(),
    cvDownloadUrl: vi.fn(),
  },
}));

const baseApplication = {
  applicationId: 'app-1',
  jobId: 'job-1',
  jobTitle: 'Senior Backend Engineer',
  companyId: 'company-1',
  companyName: 'HR Connect',
  candidateId: 'candidate-1',
  candidateFullName: 'Nguyễn Văn A',
  candidateEmail: 'candidate@example.com',
  candidatePhone: '0900000000',
  dateOfBirth: null,
  gender: null,
  currentAddress: null,
  yearsOfExperience: 5,
  highestEducation: 'Đại học',
  status: 'OFFER_PENDING',
  currentStage: 'OFFER',
  statusReason: null,
  statusReasonCode: null,
  appliedAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-02T08:00:00Z',
  plannedStartDate: null,
  concurrencyToken: 'application-token',
  isReplacement: false,
  replacementSlotId: null,
  replacementForPlacementId: null,
  cv: null,
  aiMatch: null,
  interviews: [],
  placement: null,
  serviceTypeCode: 'CV_APPLICATION',
  contactOwner: 'ClientCompany',
  isContactMasked: false,
};

const renderWorkbench = (data: Record<string, unknown>, audience: 'client' | 'hr' = 'client') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.mocked(screeningApi.get).mockResolvedValue(data as any);
  vi.mocked(screeningApi.timeline).mockResolvedValue([]);

  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <ApplicationWorkbench applicationId="app-1" audience={audience} onClose={vi.fn()} />
      </AntApp>
    </QueryClientProvider>
  );
};

describe('ApplicationWorkbench MF-04', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(interviewHistoryApi.get).mockResolvedValue([]);
    vi.mocked(clientActionsApi.updateOffer).mockResolvedValue({ message: 'Đã lưu offer.' });
  });

  it('loads the existing offer document link and sends its edited value when Client updates a draft', async () => {
    renderWorkbench({
      ...baseApplication,
      allowedActions: ['UPDATE_OFFER'],
      offers: [
        {
          offerId: 'offer-1',
          offerVersion: 1,
          salary: 40000000,
          currencyCode: 'VND',
          salaryBasis: 'GROSS',
          salaryPeriod: 'MONTHLY',
          monthlyGrossSalary: 40000000,
          startDate: '2026-12-01',
          expiryDate: '2026-11-20',
          status: 'DRAFT',
          offerDocumentUrl: 'https://files.example.com/offer-v1.pdf',
          sentAt: null,
          respondedAt: null,
          declineReason: null,
          concurrencyToken: 'offer-token',
        },
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa offer' }));

    const documentUrl = screen.getByLabelText('Link tài liệu/PDF Offer (không bắt buộc)');
    expect(documentUrl).toHaveValue('https://files.example.com/offer-v1.pdf');

    fireEvent.change(documentUrl, { target: { value: 'https://files.example.com/offer-v2.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu offer' }));

    await waitFor(() => {
      expect(clientActionsApi.updateOffer).toHaveBeenCalledWith(
        'offer-1',
        expect.objectContaining({
          offerDocumentUrl: 'https://files.example.com/offer-v2.pdf',
          concurrencyToken: 'offer-token',
        })
      );
    });
  });

  it('does not render Client MF-04 mutation controls for Internal HR when the backend does not allow them', async () => {
    renderWorkbench({ ...baseApplication, allowedActions: [], offers: [] }, 'hr');

    await screen.findByText('Nguyễn Văn A');

    expect(screen.queryByRole('button', { name: 'Lên lịch phỏng vấn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tạo offer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận đã đi làm' })).not.toBeInTheDocument();
  });
});
