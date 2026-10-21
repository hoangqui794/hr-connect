import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientCandidatesPage, nextStepOf } from './ClientCandidatesPage';
import { screeningApi } from '@/services/api/hrApi';
import type { RecruitmentApplicationItem } from '@/types/api/hr';

vi.mock('@/services/api/hrApi', () => ({ screeningApi: { list: vi.fn() } }));
vi.mock('@/features/jobs-mf01/useJobQueries', () => ({
  useMyJobs: () => ({
    isLoading: false,
    data: [
      { jobId: 'j-hh', title: 'Backend .NET', status: 'ACTIVE', serviceTypeCode: 'HEADHUNT_COD', updatedAt: '2026-10-20' },
      { jobId: 'j-app', title: 'Tester', status: 'ACTIVE', serviceTypeCode: 'CV_APPLICATION', updatedAt: '2026-10-19' },
    ],
  }),
}));
vi.mock('@/features/recruitment/ApplicationWorkbench', () => ({ ApplicationWorkbench: () => null }));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }),
});

const row = (over: Partial<RecruitmentApplicationItem>): RecruitmentApplicationItem => ({
  applicationId: Math.random().toString(36), jobId: 'j-hh', jobTitle: 'Backend .NET', companyId: 'c', companyName: 'C',
  candidateId: 'cd', candidateName: 'Nguyễn Văn An', candidateEmail: null, candidatePhone: null, cvId: null, cvTitle: null,
  status: 'SHORTLISTED', currentStage: null, appliedAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
  aiMatchScore: 96, aiMatchTier: 'HIGH', aiStatus: 'COMPLETED', latestInterviewRound: null, serviceTypeCode: 'HEADHUNT_COD',
  ...over,
});

const renderPage = (url = '/client/candidates') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <App><ClientCandidatesPage /></App>
      </MemoryRouter>
    </QueryClientProvider>
  );

const listMock = vi.mocked(screeningApi.list);

describe('Client › Hồ sơ ứng viên', () => {
  beforeEach(() => {
    listMock.mockReset();
    listMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: p.status === 'SUBMITTED,SCREENING' ? 3 : 1, page: 1, pageSize: 1 } as never;
      return {
        items: [
          row({ candidateName: 'Ứng Viên e2e5' }),
          row({ candidateName: 'Demo Candidate 2', status: 'INTERVIEW_FAILED', aiMatchScore: null, aiMatchTier: null, aiStatus: 'FAILED' }),
        ],
        total: 2, page: 1, pageSize: 10,
      } as never;
    });
  });

  it('shows the AI score with its tier, a grey "Chưa có điểm" for failed scoring and the next step', async () => {
    renderPage();

    const good = (await screen.findByText('Ứng Viên e2e5')).closest('tr')!;
    expect(within(good).getByText('Rất phù hợp')).toBeInTheDocument();
    expect(within(good).getByRole('button', { name: 'Lên lịch phỏng vấn' })).toBeInTheDocument();

    const failed = screen.getByText('Demo Candidate 2').closest('tr')!;
    expect(within(failed).getByText('Chưa có điểm')).toBeInTheDocument();
    expect(within(failed).queryByText('Lỗi AI')).not.toBeInTheDocument();
  });

  it('a strip cell filters by every status it groups', async () => {
    renderPage();
    await screen.findByText('Ứng Viên e2e5');

    fireEvent.click(screen.getByRole('radio', { name: /Kết thúc/ }));

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 10, status: expect.stringContaining('REJECTED,BACKUP_NOT_SELECTED') }))
    );
  });

  it('marks the cells that need the Client', async () => {
    renderPage();

    const review = await screen.findByRole('radio', { name: /Cần xem/ });
    await waitFor(() => expect(within(review).getByText('3')).toBeInTheDocument());
    expect(within(review).getByLabelText('cần xử lý')).toBeInTheDocument();
  });

  it('filters by service from the URL and keeps old ?status= links working', async () => {
    renderPage('/client/candidates?service=CV_SOURCING&status=SHORTLISTED');
    await screen.findByText('Ứng Viên e2e5');

    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 10, serviceTypeCode: 'CV_SOURCING', status: 'SHORTLISTED' }));
    expect(screen.getByRole('radio', { name: /Đã chọn/ })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('nextStepOf', () => {
  it('asks a Sourcing Client to answer a delivered CV first', () => {
    expect(nextStepOf({ status: 'SHORTLISTED', serviceTypeCode: 'CV_SOURCING', sourcingDeliveryStatus: 'DELIVERED' })?.label).toBe('Phản hồi CV');
  });

  it('has nothing to do once the candidate started or the application closed', () => {
    expect(nextStepOf({ status: 'PLACED' })).toBeNull();
    expect(nextStepOf({ status: 'REJECTED' })).toBeNull();
  });
});
