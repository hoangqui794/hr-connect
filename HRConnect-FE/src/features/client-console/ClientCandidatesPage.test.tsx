import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientCandidatesPage, nextStepOf } from './ClientCandidatesPage';
import { screeningApi } from '@/services/api/hrApi';
import type { RecruitmentApplicationItem } from '@/types/api/hr';

vi.mock('@/services/api/hrApi', () => ({ screeningApi: { list: vi.fn(), counts: vi.fn() } }));
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
const countsMock = vi.mocked(screeningApi.counts);

describe('Client › Hồ sơ ứng viên', () => {
  beforeEach(() => {
    listMock.mockReset();
    countsMock.mockReset();
    countsMock.mockResolvedValue({ SUBMITTED: 2, SCREENING: 1, SHORTLISTED: 1, REJECTED: 4 });
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

  it('shows the latest offer, else the latest interview, under the stage', async () => {
    listMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 1, page: 1, pageSize: 1 } as never;
      return {
        items: [
          row({ candidateName: 'Có Offer', status: 'OFFER_PENDING', latestOfferStatus: 'SENT', latestOfferSalary: 25000000,
            latestInterviewRound: 2, latestInterviewScheduledAt: '2026-11-10T09:00:00', latestInterviewResult: 'PASS' }),
          row({ candidateName: 'Có Phỏng Vấn', status: 'INTERVIEW', latestInterviewRound: 1,
            latestInterviewScheduledAt: '2026-11-14T14:30:00', latestInterviewStatus: 'SCHEDULED' }),
          row({ candidateName: 'Chưa Gì' }),
        ],
        total: 3, page: 1, pageSize: 10,
      } as never;
    });
    renderPage();

    const offer = (await screen.findByText('Có Offer')).closest('tr')!;
    expect(within(offer).getByText(/^Offer: Đã gửi · 25\.000\.000/)).toBeInTheDocument();
    const interview = screen.getByText('Có Phỏng Vấn').closest('tr')!;
    expect(within(interview).getByText('PV vòng 1 · 14/11 14:30 · Đã lên lịch')).toBeInTheDocument();
    const none = screen.getByText('Chưa Gì').closest('tr')!;
    expect(within(none).queryByText(/^(Offer:|PV vòng)/)).toBeNull();
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

  // C-07: one request grouped by status feeds every cell, instead of one list request per cell.
  it('counts every cell from one grouped request', async () => {
    renderPage('/client/candidates?service=CV_SOURCING');

    const all = await screen.findByRole('radio', { name: /Tất cả/ });
    await waitFor(() => expect(within(all).getByText('8')).toBeInTheDocument());
    expect(within(screen.getByRole('radio', { name: /Kết thúc/ })).getByText('4')).toBeInTheDocument();
    expect(countsMock).toHaveBeenCalledTimes(1);
    expect(countsMock).toHaveBeenCalledWith('status', expect.objectContaining({ serviceTypeCode: 'CV_SOURCING' }), expect.any(Array));
    expect(listMock).not.toHaveBeenCalledWith(expect.objectContaining({ pageSize: 1 }));
  });

  it('filters by service from the URL and keeps old ?status= links working', async () => {
    renderPage('/client/candidates?service=CV_SOURCING&status=SHORTLISTED');
    await screen.findByText('Ứng Viên e2e5');

    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 10, serviceTypeCode: 'CV_SOURCING', status: 'SHORTLISTED' }));
    expect(screen.getByRole('radio', { name: /Đã chọn/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows confidentiality notice instead of missing email when contact is masked, and shows planned start date on accepted offer', async () => {
    listMock.mockImplementation(async (p) => {
      if (p.pageSize === 1) return { items: [], total: 1, page: 1, pageSize: 1 } as never;
      return {
        items: [
          row({ applicationId: 'a-mask', candidateName: 'Ứng Viên Bảo Mật', candidateEmail: null, isContactMasked: true, status: 'OFFER_ACCEPTED', latestOfferStatus: 'ACCEPTED', latestOfferSalary: 30000000, plannedStartDate: '2026-12-01' }),
          row({ applicationId: 'a-open', candidateName: 'Ứng Viên Không Email', candidateEmail: null, isContactMasked: false, status: 'SHORTLISTED' }),
        ],
        total: 2, page: 1, pageSize: 10,
      } as never;
    });
    renderPage();

    const maskedRow = (await screen.findByText('Ứng Viên Bảo Mật')).closest('tr')!;
    expect(within(maskedRow).getByText('HR Connect bảo mật liên hệ')).toBeInTheDocument();
    expect(within(maskedRow).queryByText('Chưa có email')).toBeNull();
    expect(within(maskedRow).getByText(/Nhận việc 01\/12\/2026/)).toBeInTheDocument();

    const openRow = screen.getByText('Ứng Viên Không Email').closest('tr')!;
    expect(within(openRow).getByText('Chưa có email')).toBeInTheDocument();
  });
});

describe('nextStepOf', () => {
  it('asks a Sourcing Client to answer a delivered CV first, and shows nothing for rejected/replaced CV deliveries', () => {
    expect(nextStepOf({ status: 'SHORTLISTED', serviceTypeCode: 'CV_SOURCING', sourcingDeliveryStatus: 'DELIVERED' })?.label).toBe('Phản hồi CV');
    expect(nextStepOf({ status: 'SHORTLISTED', serviceTypeCode: 'CV_SOURCING', sourcingDeliveryStatus: 'ACCEPTED' })?.label).toBe('Lên lịch phỏng vấn');
    expect(nextStepOf({ status: 'SHORTLISTED', serviceTypeCode: 'CV_SOURCING', sourcingDeliveryStatus: 'REJECTED' })).toBeNull();
    expect(nextStepOf({ status: 'SHORTLISTED', serviceTypeCode: 'CV_SOURCING', sourcingDeliveryStatus: 'REPLACED' })).toBeNull();
    expect(nextStepOf({ status: 'WITHDRAWN', serviceTypeCode: 'CV_SOURCING', sourcingDeliveryStatus: 'DELIVERED' })).toBeNull();
  });

  it('distinguishes sent offers, interview states, and HR-only screening', () => {
    expect(nextStepOf({ status: 'OFFER_PENDING', latestOfferStatus: 'SENT' })).toEqual({ label: 'Chờ ứng viên', urgent: false });
    expect(nextStepOf({ status: 'OFFER_PENDING', latestOfferStatus: 'DRAFT' })).toEqual({ label: 'Gửi offer', urgent: true });

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(nextStepOf({ status: 'INTERVIEW', latestInterviewStatus: 'SCHEDULED', latestInterviewScheduledAt: future })).toEqual({ label: 'Chờ phỏng vấn', urgent: false });
    expect(nextStepOf({ status: 'INTERVIEW', latestInterviewStatus: 'SCHEDULED', latestInterviewScheduledAt: past })).toEqual({ label: 'Ghi kết quả phỏng vấn', urgent: true });
    expect(nextStepOf({ status: 'INTERVIEW', latestInterviewStatus: 'COMPLETED' })).toEqual({ label: 'Lên lịch phỏng vấn', urgent: true });
    expect(nextStepOf({ status: 'INTERVIEW', latestInterviewStatus: 'CANCELLED' })).toEqual({ label: 'Lên lịch phỏng vấn', urgent: true });

    // Even in HEADHUNT_COD (InternalHr contactOwner), Client schedules & evaluates interviews after HR screening.
    expect(nextStepOf({ status: 'SCREENING', contactOwner: 'InternalHr' })).toEqual({ label: 'Chờ HR Connect', urgent: false });
    expect(nextStepOf({ status: 'SHORTLISTED', contactOwner: 'InternalHr' })).toEqual({ label: 'Lên lịch phỏng vấn', urgent: true });
    expect(nextStepOf({ status: 'INTERVIEW', contactOwner: 'InternalHr', latestInterviewStatus: 'SCHEDULED', latestInterviewScheduledAt: future })).toEqual({ label: 'Chờ phỏng vấn', urgent: false });
  });

  it('has nothing to do once the candidate started or the application closed', () => {
    expect(nextStepOf({ status: 'PLACED' })).toBeNull();
    expect(nextStepOf({ status: 'REJECTED' })).toBeNull();
  });
});
