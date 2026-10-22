import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CandidateInterviewDetailPage } from './CandidateInterviewDetailPage';
import { CandidateInterviewDetailView } from './CandidateInterviewDetailView';
import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';

vi.mock('@/services/api/candidateInterviewApi', () => ({
  candidateInterviewApi: {
    getInterviewDetail: vi.fn(),
    confirmAttendance: vi.fn(),
  },
}));

const relativeIso = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/candidate/interviews/iv-1') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/candidate/interviews/:interviewId" element={ui} />
          <Route path="/candidate/applications/:applicationId/interviews/:interviewId" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockOnlineInterview = {
  interviewId: 'iv-online-1',
  applicationId: 'app-1',
  jobId: 'job-1',
  jobTitle: 'Senior React Developer',
  companyId: 'comp-1',
  companyName: 'VNG Corporation',
  candidateId: 'cand-1',
  candidateFullName: 'Nguyễn Văn A',
  interviewRound: 1,
  interviewType: 'ONLINE',
  scheduledAt: relativeIso(3),
  durationMinutes: 45,
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  status: 'SCHEDULED',
  statusHistories: [
    {
      interviewStatusHistoryId: 'hist-1',
      oldStatus: null,
      newStatus: 'SCHEDULED',
      newScheduledAt: relativeIso(3),
      changedAt: relativeIso(-2),
    },
  ],
  createdAt: relativeIso(-2),
  updatedAt: relativeIso(-2),
};

const mockOfflineInterview = {
  ...mockOnlineInterview,
  interviewId: 'iv-offline-2',
  interviewRound: 2,
  interviewType: 'OFFLINE',
  location: 'Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh',
  meetingLink: null,
};

describe('CandidateInterviewDetailPage & CandidateInterviewDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-online-1');

    expect(screen.getByTestId('interview-detail-loading')).toBeInTheDocument();
  });

  it('renders error state with retry button when query fails', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockRejectedValueOnce(
      new Error('Không thể kết nối đến máy chủ')
    );

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-err');

    await waitFor(() => {
      expect(screen.getByTestId('interview-detail-error')).toBeInTheDocument();
    });

    expect(screen.getByText(/Không thể kết nối đến máy chủ/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();

    // Verify retry button triggers refetch
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValueOnce(mockOnlineInterview as any);
    fireEvent.click(screen.getByRole('button', { name: /Thử lại/i }));

    await waitFor(() => {
      expect(screen.getByTestId('interview-detail-content')).toBeInTheDocument();
    });
  });

  it('renders empty state when interview is null or not found', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValueOnce(null as any);

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-empty');

    await waitFor(() => {
      expect(screen.getByTestId('interview-detail-empty')).toBeInTheDocument();
    });
    expect(screen.getByText(/Không tìm thấy thông tin lịch phỏng vấn/i)).toBeInTheDocument();
  });

  it('renders complete online interview details with status badge, round, time, and meeting link', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValueOnce(mockOnlineInterview as any);

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-online-1');

    await waitFor(() => {
      expect(screen.getByTestId('interview-detail-content')).toBeInTheDocument();
    });

    // Header info
    expect(screen.getByText('Senior React Developer')).toBeInTheDocument();
    expect(screen.getByText('VNG Corporation')).toBeInTheDocument();
    expect(screen.getByText(/Vòng 1/i)).toBeInTheDocument();
    expect(screen.getByText('Trực tuyến')).toBeInTheDocument();
    expect(screen.getByText('Đã lên lịch')).toBeInTheDocument();

    // Meeting link & action
    expect(screen.getByText('https://meet.google.com/abc-defg-hij')).toBeInTheDocument();
    const joinBtn = screen.getByRole('link', { name: /Vào phòng họp ngay/i });
    expect(joinBtn).toBeInTheDocument();
    expect(joinBtn).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');

    // Calendar button
    expect(screen.getByRole('link', { name: /Google Calendar/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Xác nhận tham gia/i })).toBeInTheDocument();
    expect(screen.queryByText(/Yêu cầu dời lịch/i)).not.toBeInTheDocument();
  });

  it('lets the Candidate confirm an upcoming interview and updates the confirmation state', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValueOnce(mockOnlineInterview as any);
    vi.mocked(candidateInterviewApi.confirmAttendance).mockResolvedValueOnce({
      interviewId: mockOnlineInterview.interviewId,
      applicationId: mockOnlineInterview.applicationId,
      attendanceStatus: 'CONFIRMED',
      respondedAt: relativeIso(0),
      alreadyConfirmed: false,
    });

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-online-1');

    const action = await screen.findByRole('button', { name: /Xác nhận tham gia/i });
    fireEvent.click(action);
    expect(await screen.findByText('Xác nhận tham gia phỏng vấn?')).toBeInTheDocument();

    const confirmationButtons = screen.getAllByRole('button', { name: 'Xác nhận tham gia' });
    fireEvent.click(confirmationButtons[confirmationButtons.length - 1]);

    await waitFor(() => {
      expect(candidateInterviewApi.confirmAttendance).toHaveBeenCalledWith('iv-online-1');
      expect(screen.getByText('Đã xác nhận tham gia')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Xác nhận tham gia/i })).not.toBeInTheDocument();
  });

  it('shows an existing confirmation without offering the action again', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValueOnce({
      ...mockOnlineInterview,
      candidateAttendanceStatus: 'CONFIRMED',
      candidateRespondedAt: relativeIso(-1),
    } as any);

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-online-1');

    expect(await screen.findByText('Đã xác nhận tham gia')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xác nhận tham gia/i })).not.toBeInTheDocument();
  });

  it('renders offline interview with address and google maps link', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValueOnce(mockOfflineInterview as any);

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-offline-2');

    await waitFor(() => {
      expect(screen.getByTestId('interview-detail-content')).toBeInTheDocument();
    });

    expect(screen.getByText(/Vòng 2/i)).toBeInTheDocument();
    expect(screen.getByText('Trực tiếp tại văn phòng')).toBeInTheDocument();
    expect(screen.getByText('Tầng 12, Tòa nhà Bitexco, Q.1, TP. Hồ Chí Minh')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Google Maps/i })).toBeInTheDocument();
  });

  it('does not render staff-only participants from an unsafe initial payload', async () => {
    vi.mocked(candidateInterviewApi.getInterviewDetail).mockResolvedValue({
      ...mockOnlineInterview,
      participants: [{ userId: 'staff-1', name: 'Nội bộ', role: 'Interviewer' }],
    } as any);

    renderWithProviders(<CandidateInterviewDetailPage />, '/candidate/interviews/iv-online-1');

    await waitFor(() => expect(screen.getByTestId('interview-detail-content')).toBeInTheDocument());
    expect(screen.queryByText('Nội bộ')).not.toBeInTheDocument();
  });
});
