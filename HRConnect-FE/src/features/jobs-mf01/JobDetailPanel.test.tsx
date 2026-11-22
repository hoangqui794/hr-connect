import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Job, PublicJobCompany } from '@/types/api/jobs';
import { JobCompanyCard, JobDetailPanel } from './JobDetailPanel';

vi.mock('@/features/sourcing/SourcingDeliveriesView', () => ({
  SourcingDeliveriesView: ({ role, jobId }: { role: string; jobId: string }) => (
    <div data-testid="sourcing-deliveries-view">{`${role}:${jobId}`}</div>
  ),
}));

vi.mock('@/features/portal/candidate/useCandidateAppliedJobs', () => ({
  useCandidateAppliedJobs: () => ({ isApplied: () => false, isWithdrawn: () => false, getApplication: () => undefined }),
}));

vi.mock('./useJobQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useJobQueries')>()),
  useJobFeeInfo: () => ({ amount: 0, currencyCode: 'VND', packageName: null }),
  useCurrentServiceAgreement: () => ({ data: null }),
  useJobTemplate: () => ({ data: null }),
  usePostingPackages: () => ({ data: [], isLoading: false }),
  usePostingFee: () => ({ data: null, isLoading: false }),
}));

const company: PublicJobCompany = {
  companyId: '30000000-0000-0000-0000-000000000001',
  companyName: 'HR Connect Demo Company',
  logoUrl: null,
  industry: 'Công nghệ thông tin',
  companySize: '51-200 nhân sự',
  website: 'https://hrconnect.example.com/',
  address: 'Thành phố Hồ Chí Minh',
  description: 'Môi trường làm việc minh bạch, thân thiện và chú trọng phát triển con người.',
  isVerified: true,
};

describe('JobCompanyCard', () => {
  it('shows the sanitized public company profile with a safe website link and company profile links', () => {
    render(
      <MemoryRouter>
        <JobCompanyCard company={company} />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: 'Thông tin doanh nghiệp' })).toBeInTheDocument();
    expect(screen.getByText(company.companyName)).toBeInTheDocument();
    expect(screen.getByText('Đã xác minh')).toBeInTheDocument();
    expect(screen.getByText(company.industry!)).toBeInTheDocument();
    expect(screen.getByText(company.companySize!)).toBeInTheDocument();
    expect(screen.getByText(company.address!)).toBeInTheDocument();
    expect(screen.getByText(company.description!)).toBeInTheDocument();

    const website = screen.getByRole('link', { name: /website công ty/i });
    expect(website).toHaveAttribute('href', company.website);
    expect(website).toHaveAttribute('target', '_blank');
    expect(website).toHaveAttribute('rel', expect.stringContaining('noopener'));

    // Check link to company profile page
    const companyPageBtn = screen.getByRole('link', { name: /xem trang công ty/i });
    expect(companyPageBtn).toHaveAttribute('href', '/companies/' + company.companyId);

    const aboutCompanyLink = screen.getByRole('link', { name: /về doanh nghiệp tuyển dụng/i });
    expect(aboutCompanyLink).toHaveAttribute('href', '/companies/' + company.companyId);
  });

  it('uses a friendly fallback and hides unsafe website values', () => {
    render(
      <MemoryRouter>
        <JobCompanyCard
          company={{
            ...company,
            companyId: '',
            industry: null,
            companySize: null,
            address: null,
            description: null,
            website: 'javascript:alert(1)',
            isVerified: false,
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Doanh nghiệp chưa cập nhật phần giới thiệu.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /website công ty/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Đã xác minh')).not.toBeInTheDocument();
  });
});

describe('JobDetailPanel sourcing deliveries (MF-03 UC-45)', () => {
  const sourcingJob = {
    jobId: 'job-ss-1',
    title: 'Sales Executive B2B',
    companyId: 'comp-1',
    companyName: 'Lotus Commerce',
    serviceTypeId: 'srv-ss',
    serviceTypeCode: 'CV_SOURCING',
    currencyCode: 'VND',
    quantity: 1,
    sourcingTarget: 2,
    sourcingCounted: 1,
    status: 'ACTIVE',
    createdAt: '2026-11-22T08:00:00Z',
    updatedAt: '2026-11-22T08:00:00Z',
    concurrencyToken: 'token-1',
    requirements: [],
    skills: [],
    statusHistories: [],
  } as unknown as Job;

  const renderPanel = (job: Job, isInternalReview: boolean) =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <JobDetailPanel job={job} isInternalReview={isInternalReview} isApplicantView={false} />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('lets Internal HR open the delivered CVs of a CV Sourcing job', async () => {
    renderPanel(sourcingJob, true);

    expect(screen.queryByTestId('sourcing-deliveries-view')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hồ sơ được tìm kiếm/i }));

    expect(await screen.findByTestId('sourcing-deliveries-view')).toHaveTextContent('hr:job-ss-1');
  });

  it('does not show the button outside the Internal HR review view', () => {
    renderPanel(sourcingJob, false);

    expect(screen.queryByRole('button', { name: /hồ sơ được tìm kiếm/i })).not.toBeInTheDocument();
  });

  it('does not show the button for other services or before the job is published', () => {
    const { unmount } = renderPanel({ ...sourcingJob, serviceTypeCode: 'HEADHUNT_COD' } as Job, true);
    expect(screen.queryByRole('button', { name: /hồ sơ được tìm kiếm/i })).not.toBeInTheDocument();
    unmount();

    renderPanel({ ...sourcingJob, status: 'PENDING_REVIEW', sourcingCounted: 0 } as Job, true);
    expect(screen.queryByRole('button', { name: /hồ sơ được tìm kiếm/i })).not.toBeInTheDocument();
  });
});
