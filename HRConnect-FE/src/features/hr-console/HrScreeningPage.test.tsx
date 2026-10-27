import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrScreeningPage } from './HrScreeningPage';
import { screeningApi } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({
  HR_SCREENED_SERVICE_TYPES: 'HEADHUNT_COD,CV_SOURCING',
  screeningApi: { list: vi.fn() },
}));

vi.mock('@/features/recruitment/ApplicationWorkbench', () => ({
  ApplicationWorkbench: () => null,
}));

const headhunt = {
  applicationId: 'app-1',
  jobId: 'job-1',
  jobTitle: 'Backend Developer',
  companyName: 'ABC Technology',
  candidateName: 'Nguyễn Văn An',
  candidateEmail: 'an@mail.com',
  status: 'SUBMITTED',
  appliedAt: '2026-10-27T01:00:00Z',
  aiMatchScore: 80,
  aiMatchTier: 'HIGH',
  aiStatus: 'COMPLETED',
  latestInterviewRound: null,
  serviceTypeCode: 'HEADHUNT_COD',
};

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AntApp>
          <HrScreeningPage />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('HrScreeningPage', () => {
  beforeEach(() => {
    vi.mocked(screeningApi.list).mockReset();
    vi.mocked(screeningApi.list).mockResolvedValue({ items: [headhunt], total: 1, page: 1, pageSize: 10 } as never);
  });

  // 27/10: CV_APPLICATION is screened by the Client, so it must never reach the Internal HR queue.
  it('asks the backend only for Headhunt and Sourcing applications', async () => {
    renderPage();

    expect(await screen.findByText('Nguyễn Văn An')).toBeTruthy();
    await waitFor(() => expect(screeningApi.list).toHaveBeenCalled());
    const calls = vi.mocked(screeningApi.list).mock.calls.map(([params]) => params);
    for (const params of calls) {
      expect(['HEADHUNT_COD,CV_SOURCING', 'CV_SOURCING']).toContain(params.serviceTypeCode);
    }
    expect(calls.some((params) => params.serviceTypeCode === 'HEADHUNT_COD,CV_SOURCING' && params.pageSize === 10)).toBe(true);
  });
});
