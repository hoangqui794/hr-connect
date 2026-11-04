import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateApplicationsPage } from './CandidateApplicationsPage';
import { candidateApplicationsApi, candidateConsentApi } from '@/services/api/mf02Api';
import type { CandidateApplicationDisplayGroup } from '@/types/api/mf02';

vi.mock('@/services/api/mf02Api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api/mf02Api')>('@/services/api/mf02Api');
  return {
    ...actual,
    candidateApplicationsApi: { list: vi.fn(), detail: vi.fn() },
    candidateConsentApi: { ...actual.candidateConsentApi, list: vi.fn(), review: vi.fn(), respond: vi.fn() },
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

const application = (id: string, displayGroup: CandidateApplicationDisplayGroup, displayLabel: string, jobTitle = `Job ${id}`) => ({
  applicationId: id, jobId: `job-${id}`, jobTitle, companyName: 'HR Connect', cvId: 'cv-1', cvTitle: 'CV',
  displayGroup, displayLabel, aiStatus: 'COMPLETED', submissionSource: 'CANDIDATE' as const, appliedAt: '2026-10-17T13:20:00Z',
});

const consent = {
  submissionId: 'submission-1', consentStatus: 'PENDING' as const, submissionStatus: 'PENDING_CONSENT',
  jobId: 'job-1', jobTitle: 'Backend Developer', companyId: 'company-1', companyName: 'HR Connect',
  cvId: 'cv-1', cvTitle: 'CV Backend', cvFileName: 'cv.pdf', affiliateUserId: 'affiliate-1',
  affiliateDisplayName: 'Nguyễn Recruiter', requestedAt: '2026-10-12T01:00:00Z',
  expiresAt: '2026-10-13T01:00:00Z', respondedAt: null, isActionable: true, remainingSeconds: 111_600,
};

const listApplications = (items: ReturnType<typeof application>[]) =>
  vi.mocked(candidateApplicationsApi.list).mockResolvedValue({ items, page: 1, pageSize: 100, total: items.length, totalPages: 1 });

describe('CandidateApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listApplications([]);
    vi.mocked(candidateConsentApi.list).mockResolvedValue({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 });
  });

  it('counts applications per tab and shows only the chosen tab', async () => {
    listApplications([
      application('a', 'SUBMITTED', 'Đã nộp'),
      application('b', 'IN_REVIEW', 'Đang xem xét'),
      application('c', 'INTERVIEW', 'Phỏng vấn'),
      application('d', 'NOT_SELECTED', 'Chưa phù hợp'),
    ]);
    renderPage();

    fireEvent.click(await screen.findByRole('tab', { name: 'Đang xử lý (2)' }));
    expect(screen.getByRole('tab', { name: 'Tất cả (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Đã kết thúc (1)' })).toBeInTheDocument();
    expect(screen.getByText('Job a')).toBeInTheDocument();
    expect(screen.queryByText('Job c')).not.toBeInTheDocument();
  });

  it('opens the tab of a status group passed by an older link', async () => {
    listApplications([application('c', 'INTERVIEW', 'Phỏng vấn'), application('a', 'SUBMITTED', 'Đã nộp')]);
    renderPage('/candidate/applications?status=INTERVIEW');

    expect(await screen.findByText('Job c')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Phỏng vấn (1)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Job a')).not.toBeInTheDocument();
  });

  it('asks the backend for the chosen source', async () => {
    renderPage();
    fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Nguồn' }));
    fireEvent.click(await screen.findByText('Affiliate giới thiệu'));

    await waitFor(() => expect(candidateApplicationsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ submissionSource: 'AFFILIATE' })));
  });

  it('shows the outcome of a rejected application and links to similar jobs', async () => {
    listApplications([application('r', 'NOT_SELECTED', 'Chưa phù hợp', 'Java Developer')]);
    renderPage();

    expect(await screen.findByText('Chưa phù hợp')).toBeInTheDocument();
    expect(screen.getByText('Quy trình tuyển dụng cho đơn này đã kết thúc.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem việc tương tự' })).toHaveAttribute('href', '/jobs?keyword=Java%20Developer');
  });

  it('keeps the earlier CV reuse choice when the candidate agrees from the list', async () => {
    vi.mocked(candidateConsentApi.list).mockResolvedValue({ items: [consent], page: 1, pageSize: 5, total: 1, totalPages: 1 });
    vi.mocked(candidateConsentApi.review).mockResolvedValue({ affiliateReuseStatus: 'ALLOWED' } as never);
    vi.mocked(candidateConsentApi.respond).mockResolvedValue({ message: 'Đã ghi nhận' } as never);
    renderPage();

    const section = await screen.findByRole('region', { name: '1 lời giới thiệu đang chờ bạn xác nhận' });
    expect(within(section).getByText(/Hết hạn xác nhận sau 31 giờ/)).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'Đồng ý' }));

    await waitFor(() => expect(candidateConsentApi.respond).toHaveBeenCalledWith('submission-1', 'CONFIRM', true));
  });

  it('asks before declining a referral', async () => {
    vi.mocked(candidateConsentApi.list).mockResolvedValue({ items: [consent], page: 1, pageSize: 5, total: 1, totalPages: 1 });
    vi.mocked(candidateConsentApi.respond).mockResolvedValue({ message: 'Đã ghi nhận' } as never);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Từ chối' }));
    expect(candidateConsentApi.respond).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Từ chối' })).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Từ chối' })[1]);

    await waitFor(() => expect(candidateConsentApi.respond).toHaveBeenCalledWith('submission-1', 'DECLINE', false));
  });
});
