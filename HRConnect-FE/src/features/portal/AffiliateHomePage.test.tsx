import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AffiliateHomePage } from './AffiliatePages';
import { affiliateApi } from '@/services/api/mf02Api';
import { financeApi } from '@/services/api/financeApi';
import { jobsApi } from '@/services/api/jobsApi';
import type { Commission } from '@/types/api/finance';

vi.mock('@/services/api/mf02Api', () => ({
  affiliateApi: {
    profile: vi.fn(),
    performance: vi.fn(),
    submissions: vi.fn(),
  },
}));

vi.mock('@/services/api/financeApi', () => ({
  financeApi: {
    commissions: vi.fn(),
  },
}));

vi.mock('@/services/api/jobsApi', () => ({
  jobsApi: {
    search: vi.fn(),
  },
}));

vi.mock('./CommissionEstimateCard', () => ({
  CommissionEstimateCard: () => null,
  commissionEstimateApi: { get: vi.fn() },
  formatEstimate: () => '—',
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

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const makeCommission = (over: Partial<Commission>): Commission => ({
  commissionId: over.commissionId ?? Math.random().toString(36),
  placementId: 'p-1',
  attributionId: 'a-1',
  affiliateId: 'aff-1',
  jobId: 'job-1',
  jobTitle: 'Team Leader Telesales',
  candidateName: 'Nguyen Hanh Dung',
  amount: 3_000_000,
  status: 'CANCELLED',
  warrantyStatus: 'VOIDED',
  replacementSlotId: 'slot-1',
  replacementSlotStatus: 'OPEN',
  replacementExpiresAt: inDays(12),
  createdAt: '2026-10-20',
  ...over,
});

const renderDashboard = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <App>
          <AffiliateHomePage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('AffiliateHomePage › Replacement Slot Alert Banner', () => {
  beforeEach(() => {
    vi.mocked(affiliateApi.profile).mockResolvedValue({
      affiliateId: 'aff-1',
      userId: 'u-1',
      email: 'aff@example.com',
      displayName: 'Lê Nghi',
      status: 'ACTIVE',
      verifiedAt: '2026-10-01T00:00:00Z',
    } as any);
    vi.mocked(affiliateApi.performance).mockResolvedValue({
      totalSubmissions: 6,
      totalShortlisted: 6,
      totalInterviews: 4,
      totalPlacements: 1,
      submissionToHireRate: 0.17,
    } as any);
    vi.mocked(affiliateApi.submissions).mockResolvedValue({ items: [], totalCount: 0 } as any);
    vi.mocked(jobsApi.search).mockResolvedValue({ items: [], totalCount: 0 } as any);
  });

  it('shows the replacement attention banner for OPEN slots deduplicated by replacementSlotId', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue({
      items: [
        makeCommission({
          commissionId: 'c-1',
          replacementSlotId: 'slot-1',
          jobId: 'job-open-1',
          jobTitle: 'Team Leader Telesales',
          candidateName: 'Nguyen Hanh Dung',
          replacementSlotStatus: 'OPEN',
          replacementExpiresAt: inDays(12),
        }),
        // Duplicate commission pointing to the same slot should not duplicate the row
        makeCommission({
          commissionId: 'c-1-dup',
          replacementSlotId: 'slot-1',
          jobId: 'job-open-1',
          jobTitle: 'Team Leader Telesales',
          candidateName: 'Nguyen Hanh Dung',
          replacementSlotStatus: 'OPEN',
        }),
        makeCommission({
          commissionId: 'c-wait',
          replacementSlotId: 'slot-wait',
          jobId: 'job-wait',
          jobTitle: 'DevOps Engineer',
          candidateName: 'Chờ Phí',
          replacementSlotStatus: 'WAITING_PAYMENT',
        }),
      ],
      totalCount: 3,
      page: 1,
      pageSize: 100,
    });

    renderDashboard();

    const banner = await screen.findByRole('region', {
      name: /Cần giới thiệu ứng viên thay thế \(1 vị trí\)/,
    });
    expect(within(banner).getByText('Team Leader Telesales')).toBeInTheDocument();
    expect(within(banner).getByText('Nguyen Hanh Dung')).toBeInTheDocument();
    expect(within(banner).getByText(/Còn (11|12) ngày/)).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Giới thiệu thay thế' })).toBeEnabled();
    expect(within(banner).queryByText('DevOps Engineer')).not.toBeInTheDocument();
  });

  it('hides the replacement banner when there are no OPEN replacement slots', async () => {
    vi.mocked(financeApi.commissions).mockResolvedValue({
      items: [
        makeCommission({
          commissionId: 'c-filled',
          replacementSlotStatus: 'FILLED',
        }),
        makeCommission({
          commissionId: 'c-warranty',
          status: 'IN_WARRANTY',
          warrantyStatus: 'ACTIVE',
          replacementSlotId: null,
          replacementSlotStatus: null,
        }),
      ],
      totalCount: 2,
      page: 1,
      pageSize: 100,
    });

    renderDashboard();

    await screen.findByText('Lượt giới thiệu gần đây');
    expect(screen.queryByRole('region', { name: /Cần giới thiệu ứng viên thay thế/ })).not.toBeInTheDocument();
  });
});
