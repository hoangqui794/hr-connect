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

  it('shows hired applications in the "Đang làm việc" tab separate from ended ones', async () => {
    listApplications([
      application('h1', 'HIRED', 'Đang làm việc', 'Booking KOL/KOC'),
      application('e1', 'WITHDRAWN', 'Đã rút', 'Frontend Developer'),
    ]);
    renderPage();

    expect(await screen.findByRole('tab', { name: 'Đang làm việc (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Đã kết thúc (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Đang làm việc (1)' }));
    expect(screen.getByText('Booking KOL/KOC')).toBeInTheDocument();
    expect(screen.getAllByText('Đang làm việc').length).toBeGreaterThan(0);
    expect(screen.queryByText('Frontend Developer')).not.toBeInTheDocument();
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

  it('renders aligned search filter bar and clears filters on reset button click', async () => {
    listApplications([
      application('1', 'SUBMITTED', 'Đã nộp', 'Frontend Engineer'),
      application('2', 'INTERVIEW', 'Phỏng vấn', 'Backend Engineer'),
    ]);
    renderPage('/candidate/applications?search=Frontend');

    expect(await screen.findByText('Tìm đơn ứng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Công việc hoặc doanh nghiệp')).toBeInTheDocument();
    expect(screen.getByText('Trạng thái hiện tại')).toBeInTheDocument();
    expect(screen.getByText('Nguồn ứng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Ngày ứng tuyển')).toBeInTheDocument();

    const resetButton = screen.getByRole('button', { name: /Xóa bộ lọc/i });
    expect(resetButton).toBeInTheDocument();
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Xóa bộ lọc/i })).not.toBeInTheDocument();
    });
  });

  it('filters applications list by job title search input', async () => {
    listApplications([
      application('fe', 'SUBMITTED', 'Đã nộp', 'Frontend Developer React'),
      application('be', 'SUBMITTED', 'Đã nộp', 'Backend Golang Specialist'),
    ]);
    renderPage();

    expect(await screen.findByText('Frontend Developer React')).toBeInTheDocument();
    expect(screen.getByText('Backend Golang Specialist')).toBeInTheDocument();

    const searchInput = screen.getByRole('textbox', { name: 'Tìm theo công việc hoặc doanh nghiệp' });
    fireEvent.change(searchInput, { target: { value: 'Golang' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Backend Golang Specialist')).toBeInTheDocument();
      expect(screen.queryByText('Frontend Developer React')).not.toBeInTheDocument();
    });
  });
});
