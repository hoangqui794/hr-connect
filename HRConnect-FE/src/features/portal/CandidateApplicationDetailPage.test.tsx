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
        expiryDate: '2026-10-25',
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
    expect(screen.getByRole('link', { name: /Vào phòng họp/i })).toBeInTheDocument();

    // Check Offer
    expect(screen.getByText(/Phiên bản #1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phản hồi Offer/i })).toBeInTheDocument();

    // Check Timeline event
    expect(screen.getByText('Đã nộp hồ sơ thành công')).toBeInTheDocument();
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
});
