import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientCompanyPage } from './ClientMorePages';
import { companyProfileApi, type CompanyProfile } from '@/services/api/hrApi';

vi.mock('@/services/api/hrApi', () => ({
  companyProfileApi: {
    get: vi.fn(),
    update: vi.fn(),
    uploadLogo: vi.fn(),
    deleteLogo: vi.fn(),
  },
}));

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AntApp>
          <ClientCompanyPage />
        </AntApp>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const baseProfile: CompanyProfile = {
  companyId: 'comp-1',
  companyName: 'HR Connect Partner Co.',
  taxCode: '0312345678',
  industry: 'Công nghệ thông tin',
  companySize: '50-100',
  website: 'https://partner.vn',
  address: 'Quận 1, TP.HCM',
  description: 'Đối tác tuyển dụng',
  logoUrl: null,
  roleInCompany: 'OWNER',
  verificationStatus: 'PENDING',
};

describe('ClientCompanyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays VERIFIED status with verifiedAt and timestamps', async () => {
    vi.mocked(companyProfileApi.get).mockResolvedValue({
      ...baseProfile,
      verificationStatus: 'VERIFIED',
      verificationRequestedAt: '2026-11-01T08:00:00Z',
      verificationReviewedAt: '2026-11-02T09:00:00Z',
      verifiedAt: '2026-11-02T09:00:00Z',
      createdAt: '2026-10-30T07:00:00Z',
    });

    renderPage();

    expect(await screen.findByText('✓ Doanh nghiệp đã xác thực')).toBeInTheDocument();
    expect(screen.getByText('Đã xác thực')).toBeInTheDocument();
    expect(screen.getByText('01/11/2026')).toBeInTheDocument();
    expect(screen.getAllByText('02/11/2026').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('Hồ sơ xác thực doanh nghiệp bị từ chối')).toBeNull();
  });

  it('displays REJECTED alert with verificationRejectedReason and review timestamps', async () => {
    vi.mocked(companyProfileApi.get).mockResolvedValue({
      ...baseProfile,
      verificationStatus: 'REJECTED',
      verificationRejectedReason: 'Mã số thuế chưa khớp với giấy phép kinh doanh',
      verificationRequestedAt: '2026-11-03T08:00:00Z',
      verificationReviewedAt: '2026-11-04T10:30:00Z',
    });

    renderPage();

    expect(await screen.findByText('✕ Hồ sơ xác thực bị từ chối')).toBeInTheDocument();
    expect(screen.getByText('Bị từ chối xác thực')).toBeInTheDocument();
    expect(screen.getByText('Hồ sơ xác thực doanh nghiệp bị từ chối')).toBeInTheDocument();
    expect(screen.getByText(/Mã số thuế chưa khớp với giấy phép kinh doanh/)).toBeInTheDocument();
    expect(screen.getByText('03/11/2026')).toBeInTheDocument();
    expect(screen.getByText('04/11/2026')).toBeInTheDocument();
  });

  it('displays UNDER_REVIEW status without invalid dates when timestamps are omitted', async () => {
    vi.mocked(companyProfileApi.get).mockResolvedValue({
      ...baseProfile,
      verificationStatus: 'UNDER_REVIEW',
      verificationRejectedReason: null,
      verificationRequestedAt: null,
      verificationReviewedAt: null,
      verifiedAt: null,
    });

    renderPage();

    expect(await screen.findByText('Đang xét duyệt xác thực')).toBeInTheDocument();
    expect(screen.getByText('Đang xét duyệt')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).toBeNull();
  });
});
