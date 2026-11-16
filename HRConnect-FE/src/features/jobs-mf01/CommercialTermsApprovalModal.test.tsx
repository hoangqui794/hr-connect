import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommercialTermsApprovalModal } from './CommercialTermsApprovalModal';
import { useCommercialTermsDefaults } from './useJobQueries';
import type { Job, ServiceAgreementDto } from '@/types/api/jobs';

vi.mock('./useJobQueries', () => ({
  useCommercialTermsDefaults: vi.fn(),
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

const baseJob: Job = {
  jobId: 'job-ss-1',
  companyId: 'comp-1',
  companyName: 'Tech Corp',
  serviceTypeId: 'svc-1',
  serviceTypeCode: 'CV_SOURCING',
  title: 'Backend Developer',
  description: null,
  benefits: null,
  location: null,
  workingTime: null,
  employmentType: 'FULL_TIME',
  salaryMin: null,
  salaryMax: null,
  salaryNegotiable: false,
  salaryNote: null,
  minExperienceYears: null,
  maxExperienceYears: null,
  currencyCode: 'VND',
  quantity: 1,
  status: 'PENDING_REVIEW',
  statusReason: null,
  postedAt: null,
  closedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  concurrencyToken: 'tok-1',
  requirements: [],
  skills: [],
  statusHistories: [],
};

const makeAgreement = (depositPercent: number): ServiceAgreementDto => ({
  serviceAgreementId: 'agr-1',
  jobId: 'job-ss-1',
  companyId: 'comp-1',
  version: 1,
  serviceTypeCode: 'CV_SOURCING',
  status: 'CHANGE_REQUESTED',
  concurrencyToken: 'tok-agr',
  isCurrent: true,
  sourcingTarget: 10,
  pricePerQualifiedCv: 1_000_000,
  depositPercent,
  reviewDays: 5,
  paymentDueDays: 7,
  companyName: 'Tech Corp',
  verificationCode: 'HRC-001',
  hasUnsignedDocument: true,
  hasSignedDocument: false,
  createdByUserId: 'hr-1',
  createdAt: '2026-11-01T00:00:00Z',
});

describe('CommercialTermsApprovalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses depositPercent from currentAgreement and backend defaults instead of hardcoding 30%', async () => {
    vi.mocked(useCommercialTermsDefaults).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        serviceTypeCode: 'CV_SOURCING',
        proposed: { sourcingTarget: 10, pricePerCv: 1_000_000, depositPercent: 45, reviewDays: 5, paymentDueDays: 7 },
        adminDefaults: { sourcingTarget: 10, pricePerCv: 1_000_000, depositPercent: 25, reviewDays: 7, paymentDueDays: 7 },
        prefill: { sourcingTarget: 10, pricePerCv: 1_000_000, depositPercent: 45, reviewDays: 5, paymentDueDays: 7 },
        ranges: {},
      },
    } as never);

    render(
      <App>
        <CommercialTermsApprovalModal
          job={baseJob}
          open={true}
          loading={false}
          currentAgreement={makeAgreement(40)}
          isRevision={true}
          onCancel={vi.fn()}
          onApprove={vi.fn()}
        />
      </App>
    );

    expect(await screen.findByText('Tiền cọc cần thu (40%)')).toBeInTheDocument();
    expect(screen.getByText('4.000.000 đ')).toBeInTheDocument();
    expect(screen.queryByText(/30%/)).toBeNull();
  });

  it('does not render a fake file upload button and explains PDF auto-generation', async () => {
    vi.mocked(useCommercialTermsDefaults).mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        serviceTypeCode: 'CV_SOURCING',
        proposed: { sourcingTarget: 10, pricePerCv: 600_000, depositPercent: 50, reviewDays: 7, paymentDueDays: 20 },
        adminDefaults: { sourcingTarget: 10, pricePerCv: 600_000, depositPercent: 50, reviewDays: 7, paymentDueDays: 20 },
        prefill: { sourcingTarget: 10, pricePerCv: 600_000, depositPercent: 50, reviewDays: 7, paymentDueDays: 20 },
        ranges: {},
      },
    } as never);

    render(
      <App>
        <CommercialTermsApprovalModal
          job={baseJob}
          open={true}
          loading={false}
          onCancel={vi.fn()}
          onApprove={vi.fn()}
        />
      </App>
    );

    expect(await screen.findByText('Hợp đồng được tạo tự động từ điều khoản bên dưới')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tải lên file khác/i })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
