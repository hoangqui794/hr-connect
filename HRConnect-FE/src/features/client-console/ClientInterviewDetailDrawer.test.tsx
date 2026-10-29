import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { ClientInterviewDetailDrawer } from './ClientInterviewDetailDrawer';
import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';
import { clientActionsApi, interviewHistoryApi } from '@/services/api/hrApi';

vi.mock('@/services/api/candidateInterviewApi');
vi.mock('@/services/api/hrApi', async () => {
  const actual = await vi.importActual<any>('@/services/api/hrApi');
  return {
    ...actual,
    clientActionsApi: {
      updateInterview: vi.fn(),
      rescheduleInterview: vi.fn(),
      recordResult: vi.fn(),
      cancelInterview: vi.fn(),
    },
    interviewHistoryApi: {
      get: vi.fn(),
    },
  };
});

const relativeIso = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

const mockInterviewDetail = {
  interviewId: 'iv-test-100',
  applicationId: 'app-test-200',
  jobId: 'job-1',
  jobTitle: 'Senior Fullstack Engineer',
  companyId: 'comp-1',
  companyName: 'Tech Innovators',
  candidateName: 'Nguyễn Văn An',
  candidateFullName: 'Nguyễn Văn An',
  candidateEmail: 'an.nguyen@example.com',
  candidatePhone: '0901234567',
  interviewRound: 1,
  interviewType: 'ONLINE',
  scheduledAt: relativeIso(10),
  durationMinutes: 60,
  location: null,
  meetingLink: 'https://meet.google.com/abc-xyz-123',
  status: 'SCHEDULED',
  concurrencyToken: 'token-abc',
  createdByName: 'HR Lead',
  createdAt: relativeIso(-7),
  updatedAt: relativeIso(-7),
  statusHistories: [],
};

const mockHistory = [
  {
    historyId: 'h-1',
    interviewId: 'iv-test-100',
    oldStatus: null,
    newStatus: 'SCHEDULED',
    oldScheduledAt: null,
    newScheduledAt: '2026-11-01T09:00:00Z',
    reason: 'Khởi tạo lịch',
    changedBy: 'user-1',
    changedByName: 'HR Lead',
    changedAt: '2026-10-15T08:00:00Z',
  },
];

const renderComponent = (props: React.ComponentProps<typeof ClientInterviewDetailDrawer>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <ClientInterviewDetailDrawer {...props} />
      </App>
    </QueryClientProvider>
  );
};

describe('ClientInterviewDetailDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders interview details correctly when open', async () => {
    vi.mocked(candidateInterviewApi.getClientInterviewDetail).mockResolvedValueOnce(mockInterviewDetail as any);

    renderComponent({
      interviewId: 'iv-test-100',
      onClose: vi.fn(),
    });

    expect(await screen.findByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByText('Senior Fullstack Engineer · Tech Innovators')).toBeInTheDocument();
    expect(screen.getByText('https://meet.google.com/abc-xyz-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sửa thông tin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dời lịch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ghi kết quả/i })).toBeInTheDocument();
    expect(screen.getByText('Chưa xác nhận')).toBeInTheDocument();
    expect(screen.getByText(/chưa xác nhận không đồng nghĩa ứng viên từ chối/i)).toBeInTheDocument();
  });

  it('shows when the Candidate confirmed attendance', async () => {
    vi.mocked(candidateInterviewApi.getClientInterviewDetail).mockResolvedValueOnce({
      ...mockInterviewDetail,
      candidateAttendanceStatus: 'CONFIRMED',
      candidateRespondedAt: relativeIso(-1),
    } as any);

    renderComponent({ interviewId: 'iv-test-100', onClose: vi.fn() });

    expect(await screen.findByText('Đã xác nhận tham gia')).toBeInTheDocument();
    expect(screen.getByText(/Phản hồi lúc:/i)).toBeInTheDocument();
  });

  it('switches to history tab and fetches interview history', async () => {
    vi.mocked(candidateInterviewApi.getClientInterviewDetail).mockResolvedValueOnce(mockInterviewDetail as any);
    vi.mocked(interviewHistoryApi.get).mockResolvedValueOnce(mockHistory as any);

    renderComponent({
      interviewId: 'iv-test-100',
      onClose: vi.fn(),
    });

    await screen.findByText('Nguyễn Văn An');

    const historyTab = screen.getByRole('tab', { name: /lịch sử thay đổi/i });
    fireEvent.click(historyTab);

    expect(await screen.findByText('Khởi tạo lịch')).toBeInTheDocument();
    expect(screen.getByText(/Thực hiện bởi: HR Lead/)).toBeInTheDocument();
    expect(interviewHistoryApi.get).toHaveBeenCalledWith('iv-test-100');
  });

  it('submits updateInterview via PUT endpoint when editing info', async () => {
    vi.mocked(candidateInterviewApi.getClientInterviewDetail).mockResolvedValue(mockInterviewDetail as any);
    vi.mocked(clientActionsApi.updateInterview).mockResolvedValueOnce({ message: 'Thành công' } as any);

    renderComponent({
      interviewId: 'iv-test-100',
      onClose: vi.fn(),
    });

    await screen.findByText('Nguyễn Văn An');

    const editBtn = screen.getByRole('button', { name: /sửa thông tin/i });
    fireEvent.click(editBtn);

    expect(await screen.findByText('Chỉnh sửa thông tin phỏng vấn')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /lưu thay đổi/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(clientActionsApi.updateInterview).toHaveBeenCalledWith(
        'iv-test-100',
        expect.objectContaining({
          durationMinutes: 60,
          interviewType: 'ONLINE',
          meetingLink: 'https://meet.google.com/abc-xyz-123',
          concurrencyToken: 'token-abc',
        })
      );
    });
  });

  it('requires interview feedback before submitting a result', async () => {
    vi.mocked(candidateInterviewApi.getClientInterviewDetail).mockResolvedValue(mockInterviewDetail as any);

    renderComponent({
      interviewId: 'iv-test-100',
      onClose: vi.fn(),
    });

    await screen.findByText('Nguyễn Văn An');
    fireEvent.click(screen.getByRole('button', { name: /ghi kết quả/i }));
    fireEvent.click(await screen.findByRole('button', { name: /lưu kết quả/i }));

    expect(await screen.findByText('Nhập nhận xét phỏng vấn.')).toBeInTheDocument();
    expect(clientActionsApi.recordResult).not.toHaveBeenCalled();
  });
});
