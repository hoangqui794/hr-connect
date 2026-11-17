/**
 * @file JobDiscoveryPage.test.tsx
 * @description [FE-m03] Verify job discovery cards never hardcode '15.000.000 đ', never leak
 * client pricing (sourcingPricePerCv / feeMultiplier / salaryMax) as affiliate commission,
 * and never fire per-card commission-estimate API calls on list render.
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobDiscoveryPage } from './JobDiscoveryPage';
import { apiClient } from '@/services/apiClient';

vi.mock('@/services/apiClient', async () => ({
  ...(await vi.importActual<typeof import('@/services/apiClient')>('@/services/apiClient')),
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/features/portal/candidate/useCandidateAppliedJobs', () => ({
  useCandidateAppliedJobs: () => ({ isApplied: () => false }),
}));

vi.mock('@/components/common/BookmarkButton', () => ({
  BookmarkButton: () => null,
}));

vi.mock('@/components/common/CompanyLogo', () => ({
  CompanyLogo: () => null,
}));

vi.mock('./useIndustryOptions', () => ({
  useIndustryOptions: () => ({ options: [], isLoading: false }),
}));

const jobSearchResult = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock('./useJobQueries', async () => ({
  ...(await vi.importActual<typeof import('./useJobQueries')>('./useJobQueries')),
  useServiceTypes: () => ({ data: [], isLoading: false }),
  useJobSearch: () => ({
    data: { items: jobSearchResult.items, totalCount: jobSearchResult.items.length, page: 1, pageSize: 12 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
  usePublicJobSearch: () => ({
    data: { items: jobSearchResult.items, totalCount: jobSearchResult.items.length, page: 1, pageSize: 12 },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
  }),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const renderPage = (detailBasePath = '/affiliate/jobs') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <App>
        <MemoryRouter>
          <JobDiscoveryPage detailBasePath={detailBasePath} />
        </MemoryRouter>
      </App>
    </QueryClientProvider>
  );
};

describe('JobDiscoveryPage [FE-m03] commission display safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never renders hardcoded 15.000.000 đ or client fees/prices as affiliate commission', () => {
    jobSearchResult.items = [
      {
        jobId: 'job-cv-sourcing',
        title: 'Backend Engineer (CV Sourcing)',
        companyName: 'Acme Corp',
        serviceTypeCode: 'CV_SOURCING',
        sourcingPricePerCv: 500000,
        status: 'ACTIVE',
        postedAt: '2026-01-01T00:00:00Z',
      },
      {
        jobId: 'job-headhunt',
        title: 'Tech Lead (Headhunt)',
        companyName: 'Beta Corp',
        serviceTypeCode: 'HEADHUNT_COD',
        feeMultiplier: 1.5,
        salaryMin: 30000000,
        salaryMax: 40000000,
        status: 'ACTIVE',
        postedAt: '2026-01-02T00:00:00Z',
      },
      {
        jobId: 'job-fallback',
        title: 'Product Designer (No Salary)',
        companyName: 'Gamma Corp',
        serviceTypeCode: 'STANDARD',
        status: 'ACTIVE',
        postedAt: '2026-01-03T00:00:00Z',
      },
    ];

    renderPage('/affiliate/jobs');

    expect(screen.queryByText(/15\.000\.000/)).toBeNull();
    expect(screen.queryByText(/500\.000 đ \/ CV/)).toBeNull();
    expect(screen.queryByText(/60\.000\.000 đ/)).toBeNull();
    expect(screen.queryByText(/1 tháng lương/)).toBeNull();
    expect(screen.getAllByText('Theo thỏa thuận')).toHaveLength(3);
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('does not render commission block or client sourcing price on public/candidate job cards', () => {
    jobSearchResult.items = [
      {
        jobId: 'job-public-1',
        title: 'QA Engineer',
        companyName: 'Delta Corp',
        serviceTypeCode: 'CV_SOURCING',
        sourcingPricePerCv: 350000,
        status: 'ACTIVE',
        postedAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderPage('/jobs');

    expect(screen.queryByText('Hoa hồng dự kiến')).toBeNull();
    expect(screen.queryByText(/15\.000\.000/)).toBeNull();
    expect(screen.queryByText(/350\.000/)).toBeNull();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
});
