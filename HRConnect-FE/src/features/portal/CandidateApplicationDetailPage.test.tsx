import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';
import { mf04Api } from '@/services/api/mf04Api';
import { jobsApi } from '@/services/api/jobsApi';
import { CandidateApplicationDetailPage } from './CandidateApplicationDetailPage';

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
    vi.spyOn(candidateApplicationsApi, 'list').mockResolvedValue({ items: [], page: 1, pageSize: 1, total: 0, totalPages: 0 });
    vi.spyOn(jobsApi, 'getById').mockResolvedValue({
      id: 'job-1',
      jobId: 'job-1',
      title: 'Senior .NET Developer',
      status: 'ACTIVE',
      isAcceptingApplications: true,
    } as any);
  });

  const mockMf04Application = {
    applicationId: 'application-1',
    candidateId: 'candidate-1',
    jobId: 'job-1',
    jobTitle: 'Senior .NET Developer',
    companyId: 'company-1',
    companyName: 'HR Connect',
    jobOverview: {
      description: 'Xây dựng nền tảng tuyển dụng.',
      benefits: 'Bảo hiểm và đào tạo.',
      location: 'TP. Hồ Chí Minh',
      workingTime: 'Thứ Hai - Thứ Sáu',
      employmentType: 'FULL_TIME',
      salaryMin: 30000000,
      salaryMax: 45000000,
      salaryNegotiable: false,
      currencyCode: 'VND',
      requirements: ['Từ 3 năm kinh nghiệm .NET'],
      skills: ['C#', 'PostgreSQL'],
    },
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
        expiryDate: '2099-10-25',
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

    expect(await screen.findByRole('heading', { name: 'Senior .NET Developer' })).toBeInTheDocument();
    expect(screen.getByText('HR Connect · TP. Hồ Chí Minh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CV Backend 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rút hồ sơ' })).toBeInTheDocument();

    // An offer waiting for an answer is the next thing to do; the interview moves to the other list.
    expect(screen.getByText('Trả lời offer phiên bản 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem và trả lời offer' })).toHaveAttribute('href', '/candidate/applications/application-1/offers/off-1');
    expect(screen.getByText(/Phỏng vấn vòng 1 · Đã lên lịch/)).toBeInTheDocument();

    expect(screen.getByText('Đã nộp hồ sơ thành công')).toBeInTheDocument();
  });

  it('makes the upcoming interview the next thing to do when no offer waits', async () => {
    vi.spyOn(candidateInterviewApi, 'getInterviewDetail').mockResolvedValue({ interviewId: 'int-1', status: 'SCHEDULED', candidateAttendanceStatus: null, statusHistories: [] } as any);
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce({
      ...mockMf04Application,
      offers: [],
      interviews: [{ ...mockMf04Application.interviews[0], scheduledAt: '2099-11-06T07:00:00Z', durationMinutes: 60 }],
    } as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({ applicationId: 'application-1', candidateName: 'A', jobTitle: 'x', currentStatus: 'INTERVIEW', events: [] });

    renderComponent();

    expect(await screen.findByText('Phỏng vấn vòng 1')).toBeInTheDocument();
    expect(await screen.findByText('Bạn chưa xác nhận tham gia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem và xác nhận lịch' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vào phòng họp' })).toHaveAttribute('href', 'https://meet.google.com/abc-xyz');
  });

  it('shows application-scoped job information without opening the public job page', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce(mockMf04Application as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEWING',
      events: [],
    });
    const user = userEvent.setup();
    renderComponent();

    await user.click(await screen.findByRole('button', { name: 'Senior .NET Developer' }));

    expect(screen.getByText('Xây dựng nền tảng tuyển dụng.')).toBeInTheDocument();
    expect(screen.getByText('Từ 3 năm kinh nghiệm .NET')).toBeInTheDocument();
    expect(screen.getByText('Bảo hiểm và đào tạo.')).toBeInTheDocument();
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

  it('asks for no answer if the offer is expired or status is not SENT', async () => {
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
    expect(screen.queryByRole('link', { name: 'Xem và trả lời offer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chi tiết offer phiên bản 2' })).toBeInTheDocument();
  });

  it('says nothing is waiting when there is no interview or offer', async () => {
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
    expect(screen.getByText(/Hiện chưa có việc nào cần bạn làm/)).toBeInTheDocument();
    expect(screen.queryByText('Phỏng vấn và offer khác')).not.toBeInTheDocument();
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

    const conflictError: any = new Error('Conflict');
    conflictError.isAxiosError = true;
    conflictError.response = { status: 409, data: { message: 'Concurrency conflict' } };
    vi.spyOn(mf04Api, 'withdrawApplication').mockRejectedValueOnce(conflictError);

    renderComponent();

    const withdrawBtn = await screen.findByRole('button', { name: 'Rút hồ sơ' });
    await userEvent.click(withdrawBtn);

    // Modal opens
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận rút hồ sơ/i });
    await userEvent.click(confirmBtn);

    expect(await screen.findByText(/Đơn ứng tuyển vừa được cập nhật/)).toBeInTheDocument();
  });

  it('renders error state with retry button when detail request fails', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockRejectedValueOnce(new Error('Network error'));
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
    expect(screen.getByRole('button', { name: 'CV Backend Legacy' })).toBeInTheDocument();
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

    expect(await screen.findByRole('status')).toHaveTextContent('Đang chuẩn bị offer');
    expect(screen.getByRole('list', { name: 'Tiến trình: Đang chuẩn bị offer' })).toBeInTheDocument();
  });

  it('shows reapply button when application is WITHDRAWN', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce({
      ...mockMf04Application,
      status: 'WITHDRAWN',
      offers: [],
      interviews: [],
    } as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'WITHDRAWN',
      events: [],
    });

    renderComponent();

    const reapplyButtons = await screen.findAllByRole('button', { name: /Ứng tuyển lại/i });
    expect(reapplyButtons.length).toBeGreaterThan(0);
    expect(screen.getByText(/Bạn đã rút đơn ứng tuyển vị trí này/i)).toBeInTheDocument();
  });

  it('disables reapply button when job is CLOSED', async () => {
    vi.spyOn(jobsApi, 'getById').mockResolvedValueOnce({
      id: 'job-1',
      jobId: 'job-1',
      title: 'Senior .NET Developer',
      status: 'CLOSED',
      isAcceptingApplications: false,
    } as any);
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce({
      ...mockMf04Application,
      jobStatus: 'CLOSED',
      status: 'WITHDRAWN',
      offers: [],
      interviews: [],
    } as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'WITHDRAWN',
      events: [],
    });

    renderComponent();

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Ứng tuyển lại/i });
      expect(button).toBeDisabled();
    });
    expect(screen.getByText(/Tin tuyển dụng này hiện đã đóng/i)).toBeInTheDocument();
  });

  it('protects candidate from seeing employer internal interview evaluation notes in timeline and status', async () => {
    vi.spyOn(mf04Api, 'getApplicationDetail').mockResolvedValueOnce({
      ...mockMf04Application,
      status: 'INTERVIEW',
      offers: [],
      interviews: [
        {
          interviewId: 'int-done',
          interviewRound: 1,
          interviewType: 'Trực tuyến Google Meet',
          scheduledAt: '2026-10-10T09:00:00Z',
          durationMinutes: 45,
          status: 'COMPLETED',
          result: 'PASS',
          feedback: 'cần pv thêm vòng nữa về system design',
        },
      ],
    } as any);
    vi.spyOn(mf04Api, 'getApplicationTimeline').mockResolvedValueOnce({
      applicationId: 'application-1',
      candidateName: 'Nguyễn Văn A',
      jobTitle: 'Senior .NET Developer',
      currentStatus: 'INTERVIEW',
      events: [
        {
          eventType: 'INTERVIEW_RESULT_RECORDED',
          title: 'Ghi kết quả phỏng vấn',
          description: 'cần pv thêm vòng nữa, chuyên môn còn thiếu',
          timestamp: '2026-10-10T10:00:00Z',
        },
      ],
    });

    renderComponent();

    // Neutral progress copy
    expect(await screen.findByText('Đã phỏng vấn')).toBeInTheDocument();
    expect(screen.getByText('Phỏng vấn vòng 1 · Đã phỏng vấn')).toBeInTheDocument();

    // Strictly ensure internal employer notes/feedback are NOT displayed
    expect(screen.queryByText(/cần pv thêm vòng nữa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chuyên môn còn thiếu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/system design/i)).not.toBeInTheDocument();
  });
});
