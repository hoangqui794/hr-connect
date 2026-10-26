import { App as AntApp, message } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
import { CandidateApplicationDetailPage } from './CandidatePages';

// Mock matchMedia for Ant Design responsive Grid
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

describe('CandidateApplicationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, 'warning').mockImplementation((() => undefined) as any);
    vi.spyOn(message, 'success').mockImplementation((() => undefined) as any);
    vi.spyOn(message, 'error').mockImplementation((() => undefined) as any);
  });

  const mockMf04Application = {
    applicationId: 'application-1',
    candidateId: 'candidate-1',
    jobId: 'job-1',
    jobTitle: 'Senior .NET Developer',
    companyId: 'company-1',
    companyName: 'HR Connect',
    status: 'INTERVIEWING',
    currentStage: 'INTERVIEW',
    statusReason: null,
    appliedAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-08T10:05:00Z',
    concurrencyToken: 'token-abc-123',
    submittedCv: {
      cvId: 'cv-1',
      title: 'CV Backend 2026',
      fileName: 'backend.pdf',
    },
    interviews: [
      {
        interviewId: 'int-1',
        interviewRound: 1,
        interviewType: 'Trực tuyến Google Meet',
        scheduledAt: '2026-10-15T09:00:00Z',
        durationMinutes: 45,
        meetingLink: 'https://meet.google.com/abc-xyz',
        status: 'SCHEDULED',
        concurrencyToken: 'token-int-1',
      },
    ],
    offers: [
      {
        offerId: 'off-1',
        offerVersion: 1,
        salary: 45000000,
        currencyCode: 'VND',
        startDate: '2026-11-01',
        expiryDate: '2026-12-31',
        status: 'SENT',
        concurrencyToken: 'token-off-1',
        canRespond: true,
      },
    ],
    allowedActions: ['WITHDRAW_APPLICATION', 'RESPOND_OFFER'],
  };

  const renderComponent = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <MemoryRouter initialEntries={['/candidate/applications/application-1']}>
        <QueryClientProvider client={queryClient}>
          <AntApp>
            <Routes>
              <Route path="/candidate/applications/:applicationId" element={<CandidateApplicationDetailPage />} />
            </Routes>
          </AntApp>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it('loads MF-04 application with interviews, offers, and allowedActions', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce(mockMf04Application as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEWING',
      events: [
        {
          eventType: 'APPLICATION_SUBMITTED',
          title: 'Đã nộp hồ sơ thành công',
          timestamp: '2026-10-08T10:00:00Z',
        },
      ],
    });

    renderComponent();

    // Check Job title and Company
    expect(await screen.findByRole('heading', { name: 'Senior .NET Developer' })).toBeInTheDocument();
    expect(screen.getByText('HR Connect')).toBeInTheDocument();

    // Check CV name and download button
    expect(screen.getByText('CV Backend 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải CV đã nộp/i })).toBeInTheDocument();

    // Check Server-driven action button
    expect(screen.getByRole('button', { name: /Rút đơn ứng tuyển/i })).toBeInTheDocument();

    // Check Interview
    expect(screen.getByText(/Vòng 1: Trực tuyến Google Meet/i)).toBeInTheDocument();
    expect(screen.getByText('Đã lên lịch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chi tiết/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Vào phòng họp/i })).toBeInTheDocument();

    // Check Offer - Accept and Decline buttons are rendered
    expect(screen.getByText(/Phiên bản #1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Chấp nhận$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Từ chối$/i })).toBeInTheDocument();

    // Check Timeline event
    expect(screen.getByText('Đã nộp hồ sơ thành công')).toBeInTheDocument();
  });

  it('translates legacy internal status codes into candidate-friendly timeline copy', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce(mockMf04Application as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'SHORTLISTED',
      events: [{
        eventType: 'APPLICATION_STATUS_CHANGED',
        title: 'Chuyển trạng thái: SHORTLISTED',
        description: 'Trạng thái chuyển từ SCREENING sang SHORTLISTED.',
        status: 'SHORTLISTED',
        timestamp: '2026-10-08T10:05:00Z',
      }],
    });

    renderComponent();

    expect(await screen.findByText('Bạn đã được chọn vào vòng phỏng vấn')).toBeInTheDocument();
    expect(screen.getByText('Nhà tuyển dụng đã chọn hồ sơ của bạn để tiếp tục quy trình.')).toBeInTheDocument();
    expect(screen.queryByText(/SHORTLISTED/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SCREENING/)).not.toBeInTheDocument();
  });

  it('submits ACCEPTED offer response when clicking Chấp nhận', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValue(mockMf04Application as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValue({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEWING',
      events: [],
    });
    const respondSpy = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({
      success: true,
      message: 'Đã chấp nhận offer thành công',
    });

    renderComponent();

    const acceptBtn = await screen.findByRole('button', { name: /^Chấp nhận$/i });
    await userEvent.click(acceptBtn);

    // Modal opens with ACCEPTED selected
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận chấp nhận/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith('off-1', {
        response: 'ACCEPTED',
        declineReason: undefined,
        concurrencyToken: 'token-off-1',
      });
    });
  });

  it('submits DECLINED offer response with reason when clicking Từ chối', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValue(mockMf04Application as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValue({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEWING',
      events: [],
    });
    const respondSpy = vi.spyOn(mf04Api, 'respondOffer').mockResolvedValue({
      success: true,
      message: 'Đã từ chối offer',
    });

    renderComponent();

    const declineBtn = await screen.findByRole('button', { name: /^Từ chối$/i });
    await userEvent.click(declineBtn);

    // Modal opens with DECLINED selected; reason is required
    const reasonInput = screen.getByPlaceholderText(/Mức đãi ngộ chưa đạt kỳ vọng/i);
    await userEvent.type(reasonInput, 'Mức đãi ngộ chưa phù hợp định hướng');

    const confirmDeclineBtn = screen.getByRole('button', { name: /Xác nhận từ chối/i });
    await userEvent.click(confirmDeclineBtn);

    await waitFor(() => {
      expect(respondSpy).toHaveBeenCalledWith('off-1', {
        response: 'DECLINED',
        declineReason: 'Mức đãi ngộ chưa phù hợp định hướng',
        concurrencyToken: 'token-off-1',
      });
    });
  });

  it('hides Chấp nhận / Từ chối buttons if offer is expired or status is not SENT', async () => {
    const expiredApp = {
      ...mockMf04Application,
      offers: [
        {
          offerId: 'off-expired',
          offerVersion: 1,
          salary: 30000000,
          currencyCode: 'VND',
          status: 'SENT',
          expiryDate: '2020-01-01',
          concurrencyToken: 'tok-exp',
        },
        {
          offerId: 'off-declined',
          offerVersion: 2,
          salary: 35000000,
          currencyCode: 'VND',
          status: 'DECLINED',
          expiryDate: '2099-01-01',
          concurrencyToken: 'tok-dec',
        },
      ],
    };
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce(expiredApp as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEWING',
      events: [],
    });

    renderComponent();

    await screen.findByRole('heading', { name: 'Senior .NET Developer' });
    expect(screen.queryByRole('button', { name: /^Chấp nhận$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Từ chối$/i })).not.toBeInTheDocument();
  });

  it('renders empty states for interviews and offers when arrays are empty', async () => {
    const emptyApp = {
      ...mockMf04Application,
      interviews: [],
      offers: [],
    };
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce(emptyApp as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'APPLIED',
      events: [],
    });

    renderComponent();

    await screen.findByRole('heading', { name: 'Senior .NET Developer' });
    expect(screen.getByText(/Chưa có lịch phỏng vấn nào được lên lịch/i)).toBeInTheDocument();
    expect(screen.getByText(/Chưa có thư mời nhận việc nào/i)).toBeInTheDocument();
  });

  it('handles 409 Conflict gracefully when withdrawing application', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValue(mockMf04Application as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValue({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEWING',
      events: [],
    });

    const warningSpy = vi.spyOn(message, 'warning');
    const conflictError: any = new Error('Conflict');
    conflictError.response = { status: 409, data: { message: 'Concurrency conflict' } };
    vi.spyOn(mf04Api, 'withdrawApplication').mockRejectedValueOnce(conflictError);

    renderComponent();

    const withdrawBtn = await screen.findByRole('button', { name: /Rút đơn ứng tuyển/i });
    await userEvent.click(withdrawBtn);

    // Modal opens
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận rút đơn/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('Dữ liệu đơn ứng tuyển đã được cập nhật từ hệ thống')
      );
    });
  });

  it('renders error state with retry button when detail request fails', async () => {
    const detailSpy = vi.spyOn(mf04Api, 'getApplicationDetail').mockRejectedValueOnce(new Error('Network error'));
    vi.spyOn(candidateApplicationsApi, 'detail').mockRejectedValueOnce(new Error('Network error fallback'));

    renderComponent();

    expect(await screen.findByText('Không tải được chi tiết đơn ứng tuyển')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('falls back to legacy MF-02 endpoint if recruitment detail fails', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockRejectedValueOnce(new Error('MF-04 unavailable'));
    vi.spyOn(candidateApplicationsApi, 'detail').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      jobTitle: 'Senior .NET Developer (Legacy)',
      companyId: 'company-1',
      companyName: 'HR Connect',
      cvId: 'cv-1',
      cvTitle: 'CV Backend Legacy',
      cvFileName: 'backend.pdf',
      displayGroup: 'IN_REVIEW',
      displayLabel: 'Đang xem xét',
      status: 'APPLIED',
      currentStage: 'SCREENING',
      statusReason: null,
      submissionSource: 'CANDIDATE',
      appliedAt: '2026-10-08T10:00:00Z',
      updatedAt: '2026-10-08T10:05:00Z',
      aiStatus: 'PENDING',
      aiMatchScore: null,
      aiMatchTier: null,
    });

    renderComponent();

    expect(await screen.findByRole('heading', { name: 'Senior .NET Developer (Legacy)' })).toBeInTheDocument();
    expect(screen.getByText('CV Backend Legacy')).toBeInTheDocument();
  });

  it('highlights the current application status with its candidate-facing tone', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce({
      ...mockMf04Application,
      status: 'OFFER_PENDING',
      offers: [],
    } as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'OFFER_PENDING',
      events: [],
    });

    renderComponent();

    const status = (await screen.findByText('Đang chuẩn bị offer')).closest('[role="status"]');
    expect(status).toHaveClass('candidate-detail-status', 'candidate-detail-status--warning');
  });
});
