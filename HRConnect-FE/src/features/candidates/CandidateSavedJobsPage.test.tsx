import React from 'react';
import { App as AntApp } from 'antd';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CandidateSavedJobsPage } from './CandidateSavedJobsPage';
import { candidateSavedJobApi } from '@/services/api/candidateSavedJobApi';
import { candidateApplicationsApi, candidateCvApi } from '@/services/api/mf02Api';

vi.mock('@/services/api/candidateSavedJobApi', () => ({
  candidateSavedJobApi: { getSavedJobs: vi.fn(), saveJob: vi.fn(), unsaveJob: vi.fn() },
}));

vi.mock('@/features/portal/candidate/useCandidateAppliedJobs', () => ({
  useCandidateAppliedJobs: () => ({
    isApplied: (id: string) => id === 'job-applied',
    getApplication: () => ({ applicationId: 'app-123' }),
  }),
}));

const renderPage = (ui: React.ReactElement = <CandidateSavedJobsPage />) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp><MemoryRouter>{ui}</MemoryRouter></AntApp>
    </QueryClientProvider>
  );
};

const days = (n: number) => new Date(Date.now() + n * 864e5).toISOString();
const saved = (jobId: string, title: string, extra: Record<string, unknown> = {}) => ({
  savedJobId: `saved-${jobId}`,
  savedAt: '2026-10-15T10:00:00Z',
  job: { jobId, title, companyId: 'c', companyName: 'FPT Software', location: 'Hà Nội', salaryMin: 30e6, salaryMax: 50e6, currencyCode: 'VND', status: 'ACTIVE', isAcceptingApplications: true, ...extra },
});
const page = (items: unknown[], totalCount = items.length) => ({ items, page: 1, pageSize: 100, totalCount, totalPages: 1 });

describe('CandidateSavedJobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(candidateApplicationsApi, 'list').mockResolvedValue({ items: [], page: 1, pageSize: 1, total: 0, totalPages: 0 });
    vi.spyOn(candidateCvApi, 'list').mockResolvedValue([]);
  });

  it('offers a retry when the list fails to load', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockRejectedValueOnce(new Error('Lỗi máy chủ'));
    renderPage();

    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValueOnce(page([saved('a', 'Tester')]) as never);
    fireEvent.click(retry);

    expect(await screen.findByRole('link', { name: 'Tester' })).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValue(page([]) as never);
    renderPage();

    expect(await screen.findByText('Bạn chưa lưu việc làm nào')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tìm việc làm' })).toHaveAttribute('href', '/jobs');
  });

  it('shows each job by its state: open, closing soon, closed and applied', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValue(page([
      saved('open', 'Việc mở', { applicationDeadline: days(30) }),
      saved('soon', 'Việc sắp hết', { applicationDeadline: days(2) }),
      saved('closed', 'Việc đóng', { status: 'CLOSED', isAcceptingApplications: false }),
      saved('job-applied', 'Việc đã nộp'),
    ]) as never);
    renderPage();

    expect(await screen.findByText('4 việc làm. Tin hết hạn vẫn được giữ để bạn xem lại.')).toBeInTheDocument();
    const row = (title: string) => within(screen.getByRole('link', { name: title }).closest('article')!);

    expect(row('Việc mở').getByRole('button', { name: /^Ứng tuyển/ })).toBeInTheDocument();
    expect(row('Việc sắp hết').getByText(/Còn \d ngày để nộp/)).toBeInTheDocument();
    expect(row('Việc đóng').getByText('Tin đã đóng, không nhận hồ sơ')).toBeInTheDocument();
    expect(row('Việc đóng').queryByRole('button', { name: /^Ứng tuyển/ })).not.toBeInTheDocument();
    expect(row('Việc đã nộp').getByRole('link', { name: 'Xem đơn' })).toHaveAttribute('href', '/candidate/applications/app-123');
  });

  it('opens the real apply dialog for an open job', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValue(page([saved('open', 'Việc mở')]) as never);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Ứng tuyển Việc mở' }));

    expect(await screen.findByRole('heading', { name: 'Ứng tuyển Việc mở' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nộp hồ sơ/i })).toBeInTheDocument();
  });

  it('asks before unsaving and then calls the API', async () => {
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValue(page([saved('open', 'Việc mở')]) as never);
    vi.mocked(candidateSavedJobApi.unsaveJob).mockResolvedValueOnce({ success: true, message: 'ok' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ lưu Việc mở' }));
    expect(candidateSavedJobApi.unsaveJob).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ lưu' }));

    await waitFor(() => expect(candidateSavedJobApi.unsaveJob).toHaveBeenCalledWith('open'));
  });

  it('pages through more than ten saved jobs', async () => {
    const many = Array.from({ length: 12 }, (_, i) => saved(`j${i}`, `Việc ${i}`));
    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValue(page(many) as never);
    renderPage();

    expect(await screen.findByRole('link', { name: 'Việc 0' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Việc 11' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle('2'));
    expect(await screen.findByRole('link', { name: 'Việc 11' })).toBeInTheDocument();
  });
});
