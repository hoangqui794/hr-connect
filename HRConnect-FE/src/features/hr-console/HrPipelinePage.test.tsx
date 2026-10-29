import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrPipelinePage } from './HrPipelinePage';
import { pipelineApi } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({
  pipelineApi: { interviews: vi.fn(), offers: vi.fn(), placements: vi.fn() },
}));

const placement = {
  placementId: 'plc-1',
  applicationId: 'app-1',
  actualStartDate: '2026-10-20',
  position: 'Backend .NET',
  department: null,
  status: 'STARTED',
  confirmedAt: '2026-10-20T01:00:00Z',
  confirmedByName: null,
  candidate: { candidateId: 'cand-1', fullName: 'Ứng Viên e2e5', email: 'e2e5@mail.com', phoneNumber: null },
  job: { jobId: 'job-1', title: '[E2E-2010] Headhunt 55343', companyId: 'co-1', companyName: 'HR Connect Demo Company' },
};

const offer = {
  offerId: 'off-1',
  applicationId: 'app-1',
  jobTitle: '[E2E-2010] Headhunt 55343',
  companyName: 'HR Connect Demo Company',
  candidateName: 'Ứng Viên e2e5',
  candidateEmail: 'e2e5@mail.com',
  offerVersion: 1,
  salary: 28_000_000,
  currencyCode: 'VND',
  salaryBasis: 'GROSS',
  startDate: '2026-10-20',
  status: 'ACCEPTED',
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AntApp>
          <HrPipelinePage />
        </AntApp>
      </QueryClientProvider>
    </MemoryRouter>
  );

describe('HrPipelinePage', () => {
  beforeEach(() => {
    vi.mocked(pipelineApi.placements).mockResolvedValue({ items: [placement], total: 1 } as never);
    vi.mocked(pipelineApi.interviews).mockResolvedValue({ items: [], total: 0 } as never);
    // The offers request stays pending, so only placeholder data could be on screen.
    vi.mocked(pipelineApi.offers).mockImplementation(((params: { pageSize: number }) =>
      params.pageSize === 1 ? Promise.resolve({ items: [offer], total: 1 }) : new Promise(() => {})) as never);
  });

  // HR feedback 29/10: moving from "Đi làm" to "Offer" crashed the page with "s is not iterable",
  // because the placements rows were reused as placeholder data for the offers table.
  it('does not render the previous tab rows in another tab', async () => {
    renderAt('/hr/pipeline?tab=placements');
    expect(await screen.findByText('Ứng Viên e2e5')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Offer/ }));
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.queryByText('Ứng Viên e2e5')).toBeNull();
  });
});
