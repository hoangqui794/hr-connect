import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { AdminReportsPage } from './AdminReportsPage';
import { reportApi } from '@/services/api/reportApi';

vi.mock('@/services/api/reportApi');

const mockOverview = {
  jobs: { byStatus: { PUBLISHED: 12 }, byServiceType: { HEADHUNT_COD: 8 } },
  applications: { submitted: 45, shortlisted: 18, interview: 10, placed: 4 },
  placements: { started: 4, warrantyPassed: 2, warrantyVoided: 0 },
  companies: { verified: 15, pending: 2 },
  affiliates: { active: 30, pending: 5 },
};

const mockRevenue = {
  currency: 'VND',
  totals: {
    HEADHUNT_COD: { billed: 60000000, collected: 50000000 },
    CV_SOURCING: { billed: 15000000, collected: 15000000 },
    CV_APPLICATION: { billed: 5000000, collected: 5000000 },
  },
  series: [],
  commission: { earned: 18000000, paid: 12000000 },
};

const mockTopAffiliates = [
  {
    affiliateId: 'aff-01',
    fullName: 'Trần Văn Tuyển',
    totalSubmissions: 20,
    totalPlacements: 3,
    submissionToHireRate: 0.15,
    qualityRating: 88,
    ratingLabel: 'Xuất sắc',
    commissionEarned: 15000000,
  },
];

const mockTopCompanies = [
  {
    companyId: 'comp-01',
    companyName: 'Công ty Cổ phần VinaTech',
    industry: 'Công nghệ thông tin',
    activeJobs: 5,
    placements: 4,
    revenueCollected: 40000000,
  },
];

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <AdminReportsPage />
      </App>
    </QueryClientProvider>
  );
};

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview KPIs, revenue breakdown, and top affiliates ranking', async () => {
    vi.mocked(reportApi.getOverview).mockResolvedValueOnce(mockOverview as any);
    vi.mocked(reportApi.getRevenue).mockResolvedValueOnce(mockRevenue as any);
    vi.mocked(reportApi.getTopAffiliates).mockResolvedValueOnce(mockTopAffiliates as any);
    vi.mocked(reportApi.getTopCompanies).mockResolvedValueOnce(mockTopCompanies as any);

    renderComponent();

    expect(await screen.findByText('Báo cáo toàn diện hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Hồ sơ ứng tuyển')).toBeInTheDocument();
    expect(screen.getByText('Doanh thu theo gói dịch vụ')).toBeInTheDocument();
    expect(await screen.findByText('Headhunt COD')).toBeInTheDocument();
    expect(screen.getByText('CV Sourcing')).toBeInTheDocument();
    expect(await screen.findByText('Trần Văn Tuyển')).toBeInTheDocument();
    expect(screen.getByText('Xuất sắc')).toBeInTheDocument();
  });
});
