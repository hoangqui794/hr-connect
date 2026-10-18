import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateApplicationsPage } from './CandidatePages';
import { candidateApplicationsApi, candidateConsentApi } from '@/services/api/mf02Api';

vi.mock('@/services/api/mf02Api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/mf02Api')>('@/services/api/mf02Api');
  return {
    ...actual,
    candidateApplicationsApi: { list: vi.fn(), detail: vi.fn() },
    candidateConsentApi: { ...actual.candidateConsentApi, list: vi.fn() },
  };
});

const renderPage = (route = '/candidate/applications') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp><MemoryRouter initialEntries={[route]}><CandidateApplicationsPage /></MemoryRouter></AntApp>
    </QueryClientProvider>
  );
};

describe('CandidateApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 });
    vi.mocked(candidateConsentApi.list).mockResolvedValue({
      items: [{
        submissionId: 'submission-1', consentStatus: 'PENDING', submissionStatus: 'PENDING_CONSENT',
        jobId: 'job-1', jobTitle: 'Backend Developer', companyId: 'company-1', companyName: 'HR Connect',
        cvId: 'cv-1', cvTitle: 'CV Backend', cvFileName: 'cv.pdf', affiliateUserId: 'affiliate-1',
        affiliateDisplayName: 'Nguyễn Recruiter', requestedAt: '2026-10-12T01:00:00Z',
        expiresAt: '2026-10-13T01:00:00Z', respondedAt: null, isActionable: true, remainingSeconds: 86400,
      }],
      page: 1, pageSize: 5, total: 1, totalPages: 1,
    });
  });

  it('shows pending Affiliate consent before the application history', async () => {
    renderPage();
    expect(await screen.findByText('Đang chờ bạn xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Backend Developer')).toBeInTheDocument();
    expect(candidateConsentApi.list).toHaveBeenCalledWith({ status: 'PENDING', page: 1, pageSize: 5 });
  });

  it('passes search and source filters to the backend', async () => {
    renderPage();
    fireEvent.change(await screen.findByLabelText('Tìm theo công việc hoặc doanh nghiệp'), { target: { value: 'Backend' } });
    fireEvent.keyDown(screen.getByLabelText('Tìm theo công việc hoặc doanh nghiệp'), { key: 'Enter', code: 'Enter' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Lọc theo nguồn ứng tuyển' }));
    fireEvent.click(await screen.findByText('Affiliate giới thiệu'));

    await waitFor(() => expect(candidateApplicationsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({
      search: 'Backend',
      submissionSource: 'AFFILIATE',
    })));
  }, 10_000);

  it('shows the public rejection status prominently and sends the public filter group', async () => {
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({
      items: [{
        applicationId: 'application-rejected', jobId: 'job-rejected', jobTitle: 'Junior Java Backend Developer',
        companyName: 'HR Connect Demo Company', cvId: 'cv-1', cvTitle: 'CV_Test 1',
        displayGroup: 'NOT_SELECTED', displayLabel: 'Chưa phù hợp', aiStatus: 'COMPLETED',
        submissionSource: 'CANDIDATE', appliedAt: '2026-10-17T13:20:00Z',
      }],
      page: 1, pageSize: 10, total: 1, totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText('Chưa phù hợp')).toBeInTheDocument();
    expect(screen.getByText('Quy trình tuyển dụng cho đơn này đã kết thúc.').closest('.candidate-application-outcome'))
      .toHaveClass('candidate-application-outcome--not-selected');

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }));
    const notSelectedLabels = await screen.findAllByText('Chưa phù hợp');
    fireEvent.click(notSelectedLabels[notSelectedLabels.length - 1]);

    await waitFor(() => expect(candidateApplicationsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'NOT_SELECTED',
    })));
  });

  it('shows shortlisted applications as selected for interview and supports its filter', async () => {
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({
      items: [{
        applicationId: 'application-selected', jobId: 'job-selected', jobTitle: 'Junior .NET Developer',
        companyName: 'HR Connect Demo Company', cvId: 'cv-1', cvTitle: 'CV_Test 1',
        displayGroup: 'SELECTED', displayLabel: 'Được chọn phỏng vấn', aiStatus: 'COMPLETED',
        submissionSource: 'CANDIDATE', appliedAt: '2026-10-17T13:20:00Z',
      }],
      page: 1, pageSize: 10, total: 1, totalPages: 1,
    });

    renderPage();

    expect(await screen.findByText('Được chọn phỏng vấn')).toBeInTheDocument();
    expect(screen.getByLabelText('Tiến độ: Được chọn phỏng vấn')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }));
    const selectedLabels = await screen.findAllByText('Được chọn phỏng vấn');
    fireEvent.click(selectedLabels[selectedLabels.length - 1]);

    await waitFor(() => expect(candidateApplicationsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'SELECTED',
    })));
  });

  it('keeps every application status in a dedicated row below the company name', async () => {
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({
      items: [{
        applicationId: 'application-offer', jobId: 'job-offer', jobTitle: 'Junior .NET Developer',
        companyName: 'HR Connect Demo Company', cvId: 'cv-1', cvTitle: 'CV_Test 1',
        displayGroup: 'OFFER', displayLabel: 'Đang chuẩn bị offer', aiStatus: 'COMPLETED',
        submissionSource: 'CANDIDATE', appliedAt: '2026-10-17T13:20:00Z',
      }],
      page: 1, pageSize: 10, total: 1, totalPages: 1,
    });

    renderPage();

    const status = await screen.findByText('Đang chuẩn bị offer');
    expect(status.parentElement).toHaveClass('candidate-application-card__status-row');
    expect(status.closest('.candidate-application-card__heading')).toHaveTextContent('HR Connect Demo Company');
  });
});
