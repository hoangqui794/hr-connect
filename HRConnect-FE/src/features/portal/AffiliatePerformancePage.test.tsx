import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { AffiliatePerformancePage } from './AffiliatePerformancePage';
import { affiliateApi } from '@/services/api/mf02/affiliateApi';

vi.mock('@/services/api/mf02/affiliateApi', () => ({
  affiliateApi: {
    performance: vi.fn(),
  },
}));

const mockPerformance = {
  affiliateId: 'aff-01',
  displayName: 'Hoàng Minh',
  affiliateType: 'INDIVIDUAL',
  status: 'ACTIVE',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  totalSubmissions: 15,
  totalShortlisted: 8,
  totalInterviews: 5,
  totalPlacements: 2,
  submissionToHireRate: 0.133,
  qualityRating: 85,
  ratingLabel: 'Tốt',
  calculatedAt: '2026-10-19T08:00:00Z',
  history: [
    {
      affiliatePerformanceId: 'perf-h-1',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      totalSubmissions: 10,
      totalShortlisted: 4,
      totalInterviews: 3,
      totalPlacements: 1,
      submissionToHireRate: 0.1,
      qualityRating: 80,
      ratingLabel: 'Tốt',
      calculationVersion: '1.0',
      calculatedAt: '2026-10-01T00:00:00Z',
    },
  ],
};

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App>
          <AffiliatePerformancePage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AffiliatePerformancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders performance statistics, quality rating, and period history', async () => {
    vi.mocked(affiliateApi.performance).mockResolvedValueOnce(mockPerformance as any);

    renderComponent();

    expect(await screen.findByRole('heading', { name: 'Kết quả giới thiệu' })).toBeInTheDocument();
    expect((await screen.findAllByText('Tốt')).length).toBeGreaterThan(0);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('13%')).toBeInTheDocument();
    expect(screen.getByText('Lượt giới thiệu')).toBeInTheDocument();
    expect(screen.getByText('Tuyển dụng thành công')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026 – 30/09/2026')).toBeInTheDocument();
  });
});
