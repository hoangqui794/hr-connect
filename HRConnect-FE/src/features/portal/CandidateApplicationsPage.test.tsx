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
});
