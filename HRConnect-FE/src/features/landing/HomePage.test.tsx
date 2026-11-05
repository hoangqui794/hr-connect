import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';
import { companyDirectoryApi } from '@/services/api/companyDirectoryApi';
import { candidateApplicationsApi, candidateConsentApi, candidateCvApi } from '@/services/api/mf02Api';
import { mf04Api } from '@/services/api/mf04Api';
import { usePublicJobSearch } from '@/features/jobs-mf01/useJobQueries';
import { CandidateHome } from './CandidateHome';
import { HomePage } from './HomePage';

vi.mock('./components/Navbar', () => ({ Navbar: () => <nav /> }));
vi.mock('@/features/jobs-mf01/useJobQueries', () => ({ usePublicJobSearch: vi.fn() }));

const SAMPLE_TEXT = /FPT Software|VNG Corporation|MoMo|Vinamilk|Tiki|KMS Technology|1\.284|CV_TruongHoangQui|Shopee/;

const jobSearch = (items: unknown[] = [], totalCount = items.length) =>
  vi.mocked(usePublicJobSearch).mockReturnValue({ data: { items, totalCount }, isLoading: false, isError: false, refetch: vi.fn() } as never);

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp><MemoryRouter>{ui}</MemoryRouter></AntApp>
    </QueryClientProvider>
  );
};

const company = (companyId: string, companyName: string, activeJobCount: number) => ({ companyId, companyName, activeJobCount, isFeatured: true });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(companyDirectoryApi, 'featured').mockResolvedValue([]);
  jobSearch();
});

describe('HomePage for guests', () => {
  it('shows no invented jobs, companies or counts when the system has no data', async () => {
    wrap(<HomePage />);

    expect(await screen.findByText('Hiện chưa có việc làm đang mở.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Công ty đang tuyển nhiều' })).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Xem tất cả việc làm' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(SAMPLE_TEXT);
  });

  it('shows real jobs without padding them to nine', async () => {
    jobSearch([{ jobId: 'j1', title: 'Kế toán trưởng', companyName: 'Công ty A', location: 'Huế' }], 1);
    wrap(<HomePage />);

    expect(await screen.findByRole('link', { name: 'Kế toán trưởng' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Xem tất cả 1 việc làm' })).toBeInTheDocument();
  });

  it('lists real hiring companies, most jobs first, and skips those not hiring', async () => {
    vi.mocked(companyDirectoryApi.featured).mockResolvedValue([company('a', 'Công ty Ít', 2), company('b', 'Công ty Nhiều', 8), company('c', 'Công ty Không Tuyển', 0)] as never);
    wrap(<HomePage />);

    await screen.findByRole('heading', { name: 'Công ty đang tuyển nhiều' });
    expect(screen.getByRole('link', { name: 'Xem 8 việc làm' })).toBeInTheDocument();
    expect(screen.queryByText('Công ty Không Tuyển')).not.toBeInTheDocument();
  });
});

describe('CandidateHome', () => {
  beforeEach(() => {
    vi.spyOn(candidateJobMatchApi, 'getJobMatches').mockResolvedValue({ items: [] } as never);
    vi.spyOn(candidateApplicationsApi, 'list').mockResolvedValue({ items: [], total: 0 } as never);
    vi.spyOn(candidateConsentApi, 'list').mockResolvedValue({ items: [], total: 0 } as never);
    vi.spyOn(candidateCvApi, 'list').mockResolvedValue([]);
    vi.spyOn(mf04Api, 'getProfile').mockResolvedValue({ fullName: 'An', profileVisibility: 'PRIVATE', skills: [] } as never);
  });

  it('shows no fake interview, matches, applications or CV for a new candidate', async () => {
    wrap(<CandidateHome />);

    expect(await screen.findByText(/Chưa có gợi ý nào/)).toBeInTheDocument();
    expect(await screen.findByText(/Bạn chưa có đơn ứng tuyển nào/)).toBeInTheDocument();
    expect(screen.getByText(/Bạn chưa có CV chính/)).toBeInTheDocument();
    expect(screen.queryByText(/Phỏng vấn sắp tới/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(SAMPLE_TEXT);
  });

  it('shows the real applications even when there are fewer than three', async () => {
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({
      items: [{ applicationId: 'a1', jobTitle: 'Kỹ sư cầu đường', companyName: 'Công ty B', displayGroup: 'SUBMITTED' }],
      total: 1,
    } as never);
    wrap(<CandidateHome />);

    expect(await screen.findByRole('link', { name: /Kỹ sư cầu đường/ })).toHaveAttribute('href', '/candidate/applications/a1');
  });

  it('shows a real upcoming interview', async () => {
    vi.mocked(candidateApplicationsApi.list).mockResolvedValue({
      items: [{ applicationId: 'a1', jobTitle: 'Kỹ sư cầu đường', companyName: 'Công ty B', displayGroup: 'INTERVIEW' }],
      total: 1,
    } as never);
    vi.spyOn(mf04Api, 'getInterviews').mockResolvedValue([
      { interviewId: 'i1', scheduledAt: '2099-01-01T07:00:00Z', interviewType: 'ONLINE', status: 'SCHEDULED' },
    ] as never);
    wrap(<CandidateHome />);

    expect(await screen.findByRole('link', { name: 'Xem lịch phỏng vấn' })).toHaveAttribute('href', '/candidate/interviews/i1');
    expect(screen.getByText(/Kỹ sư cầu đường tại Công ty B/)).toBeInTheDocument();
  });

  it('asks only for what the profile is missing', async () => {
    vi.mocked(mf04Api.getProfile).mockResolvedValue({ fullName: 'An', skills: [{ skillName: 'C#' }], expectedSalaryMin: null, expectedSalaryMax: null } as never);
    wrap(<CandidateHome />);

    expect(await screen.findByRole('link', { name: 'Cập nhật mức lương mong muốn' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Thêm kỹ năng chính' })).not.toBeInTheDocument();
  });
});
