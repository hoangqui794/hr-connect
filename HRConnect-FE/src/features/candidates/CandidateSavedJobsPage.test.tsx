import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CandidateSavedJobsPage } from './CandidateSavedJobsPage';
import { candidateSavedJobApi } from '@/services/api/candidateSavedJobApi';

vi.mock('@/services/api/candidateSavedJobApi', () => ({
  candidateSavedJobApi: {
    getSavedJobs: vi.fn(),
    saveJob: vi.fn(),
    unsaveJob: vi.fn(),
  },
}));

vi.mock('@/features/portal/candidate/useCandidateAppliedJobs', () => ({
  useCandidateAppliedJobs: () => ({
    isApplied: (id: string) => id === 'job-applied-1',
    getApplication: () => ({ applicationId: 'app-123' }),
  }),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

const mockSavedJobsResponse = {
  items: [
    {
      savedJobId: 'saved-1',
      savedAt: '2026-10-15T10:00:00Z',
      job: {
        jobId: 'job-active-1',
        title: 'Senior Frontend Engineer (React/TypeScript)',
        companyId: 'comp-1',
        companyName: 'FPT Software',
        location: 'Hà Nội',
        employmentType: 'FULL_TIME',
        salaryMin: 30000000,
        salaryMax: 50000000,
        currencyCode: 'VND',
        status: 'ACTIVE',
        minExperienceYears: 3,
        maxExperienceYears: 5,
        postedAt: '2026-10-10T00:00:00Z',
        applicationDeadline: '2026-11-30T23:59:59Z',
        isAcceptingApplications: true,
        skills: ['React', 'TypeScript', 'TailwindCSS'],
      },
    },
    {
      savedJobId: 'saved-2',
      savedAt: '2026-10-14T08:00:00Z',
      job: {
        jobId: 'job-expired-2',
        title: 'Backend Developer (.NET Core)',
        companyId: 'comp-2',
        companyName: 'VNG Corporation',
        location: 'Hồ Chí Minh',
        employmentType: 'HYBRID',
        salaryMin: 25000000,
        salaryMax: 40000000,
        currencyCode: 'VND',
        status: 'ACTIVE',
        minExperienceYears: 2,
        maxExperienceYears: 4,
        postedAt: '2026-09-01T00:00:00Z',
        applicationDeadline: '2026-10-01T00:00:00Z',
        isAcceptingApplications: false,
      },
    },
    {
      savedJobId: 'saved-3',
      savedAt: '2026-10-12T08:00:00Z',
      job: {
        jobId: 'job-applied-1',
        title: 'DevOps Engineer',
        companyId: 'comp-3',
        companyName: 'Tiki',
        location: 'Hồ Chí Minh',
        employmentType: 'FULL_TIME',
        salaryMin: 35000000,
        salaryMax: 60000000,
        currencyCode: 'VND',
        status: 'ACTIVE',
        minExperienceYears: 4,
        maxExperienceYears: null,
        postedAt: '2026-10-05T00:00:00Z',
        isAcceptingApplications: true,
      },
    },
  ],
  page: 1,
  pageSize: 10,
  totalCount: 3,
  totalPages: 1,
};

describe('CandidateSavedJobsPage component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    let resolvePromise: any;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockReturnValue(pendingPromise as any);

    renderWithProviders(<CandidateSavedJobsPage />);

    expect(screen.getByText('Việc làm đã lưu')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Quản lý và ứng tuyển nhanh các vị trí tuyển dụng bạn đã đánh dấu quan tâm từ Sàn việc làm.'
      )
    ).toBeInTheDocument();

    resolvePromise({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
  });

  it('renders error state with retry button when query fails', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockRejectedValueOnce(
      new Error('Lỗi máy chủ nội bộ (500)')
    );

    renderWithProviders(<CandidateSavedJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải danh sách việc làm đã lưu')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /Thử lại/i });
    expect(retryButton).toBeInTheDocument();

    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValueOnce(mockSavedJobsResponse as any);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Senior Frontend Engineer (React/TypeScript)')).toBeInTheDocument();
    });
  });

  it('renders empty state when there are no saved jobs', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 10,
      totalCount: 0,
      totalPages: 0,
    } as any);

    renderWithProviders(<CandidateSavedJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bạn chưa lưu việc làm nào')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Khám phá việc làm ngay/i })).toBeInTheDocument();
  });

  it('renders list of saved jobs with status badges, metadata, and quick action buttons', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValueOnce(mockSavedJobsResponse as any);

    renderWithProviders(<CandidateSavedJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Senior Frontend Engineer (React/TypeScript)')).toBeInTheDocument();
    });

    // Verify company names
    expect(screen.getByText('FPT Software')).toBeInTheDocument();
    expect(screen.getByText('VNG Corporation')).toBeInTheDocument();
    expect(screen.getByText('Tiki')).toBeInTheDocument();

    // Verify status badges
    expect(screen.getAllByText('Còn hạn nhận hồ sơ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Hết hạn nhận hồ sơ')).toBeInTheDocument();
    expect(screen.getByText('Đã ứng tuyển')).toBeInTheDocument();

    // Verify quick action buttons
    expect(screen.getByRole('button', { name: /Ứng tuyển ngay/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đã hết hạn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xem đơn/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Chi tiết/i })).toHaveLength(3);
  });

  it('calls unsaveJob when user confirms unsave', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs)
      .mockResolvedValueOnce(mockSavedJobsResponse as any)
      .mockResolvedValue({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 } as any);
    vi.mocked(candidateSavedJobApi.unsaveJob).mockResolvedValueOnce({
      success: true,
      message: 'Đã hủy lưu việc làm thành công.',
    });

    renderWithProviders(<CandidateSavedJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Senior Frontend Engineer (React/TypeScript)')).toBeInTheDocument();
    });

    const unsaveButtons = screen.getAllByLabelText('Bỏ lưu việc làm');
    expect(unsaveButtons.length).toBeGreaterThan(0);

    fireEvent.click(unsaveButtons[0]);

    // Ant Design Popconfirm displays "Bỏ lưu" confirm button
    const confirmButton = await screen.findByRole('button', { name: 'Bỏ lưu' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(candidateSavedJobApi.unsaveJob).toHaveBeenCalledWith('job-active-1');
    });
  });

  it('renders pagination when totalCount exceeds pageSize', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValueOnce({
      items: mockSavedJobsResponse.items,
      page: 1,
      pageSize: 10,
      totalCount: 25,
      totalPages: 3,
    } as any);

    renderWithProviders(<CandidateSavedJobsPage />);

    await waitFor(() => {
      expect(screen.getByText('Senior Frontend Engineer (React/TypeScript)')).toBeInTheDocument();
    });

    // Pagination numbers should be displayed (pages 1, 2, 3)
    expect(screen.getByTitle('2')).toBeInTheDocument();
    expect(screen.getByTitle('3')).toBeInTheDocument();
  });
});
