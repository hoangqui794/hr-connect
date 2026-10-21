import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { AdminDisputesPage } from './AdminDisputesPage';
import { disputeApi } from '@/services/api/disputeApi';

vi.mock('@/services/api/disputeApi');

const mockDisputeList = {
  items: [
    {
      disputeId: 'dsp-01',
      disputeType: 'DUPLICATE_SUBMISSION',
      status: 'OPEN',
      jobTitle: 'Backend Developer',
      candidateName: 'Lê Hoàng Nam',
      raisedBy: 'aff-01',
      raisedByAffiliateName: 'Affiliate Pro',
      createdAt: '2026-10-18T10:00:00Z',
      resolvedAt: null,
      concurrencyToken: 'token-1',
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
};

const mockDisputeDetail = {
  disputeId: 'dsp-01',
  disputeType: 'DUPLICATE_SUBMISSION',
  status: 'OPEN',
  description: 'Tôi đã tiếp cận ứng viên trước',
  evidence: 'Đính kèm email trao đổi',
  raisedBy: 'aff-01',
  raisedByAffiliateName: 'Affiliate Pro',
  createdAt: '2026-10-18T10:00:00Z',
  jobId: 'job-01',
  jobTitle: 'Backend Developer',
  candidateId: 'cand-01',
  candidateName: 'Lê Hoàng Nam',
  candidateNormalizedEmail: 'nam.le@example.com',
  candidateNormalizedPhone: '0912345678',
  submissions: [
    {
      submissionId: 'sub-01',
      submittedBy: 'aff-01',
      affiliateName: 'Affiliate Pro',
      source: 'AFFILIATE',
      status: 'BLOCKED_DUPLICATE',
      submittedAt: '2026-10-18T10:00:00Z',
      consentStatus: 'ACCEPTED',
      consentRespondedAt: '2026-10-18T10:05:00Z',
      isDisputed: true,
    },
  ],
  currentAttribution: {
    attributionId: 'attr-01',
    affiliateUserId: 'aff-other',
    affiliateName: 'Affiliate Other',
    winningSubmissionId: 'sub-other',
    attributionRule: 'FIRST_TOUCH',
    establishedAt: '2026-10-17T09:00:00Z',
    commissionStatuses: ['PENDING'],
    placementConfirmedAt: null,
  },
  candidateDuplicateCaseId: null,
  resolvedBy: null,
  resolution: null,
  resolvedAt: null,
  concurrencyToken: 'token-1',
};

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App>
          <AdminDisputesPage />
        </App>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AdminDisputesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders disputes list with candidate, job, and affiliate', async () => {
    vi.mocked(disputeApi.getAdminDisputes).mockResolvedValue(mockDisputeList as any);

    renderComponent();

    expect(await screen.findByText('Lê Hoàng Nam')).toBeInTheDocument();
    expect(screen.getByText('Backend Developer')).toBeInTheDocument();
    expect(screen.getByText('Affiliate Pro')).toBeInTheDocument();
    expect(screen.getAllByText('Trùng ứng viên').length).toBeGreaterThan(0);
  });

  it('opens detail drawer and submits resolution UPHELD', async () => {
    vi.mocked(disputeApi.getAdminDisputes).mockResolvedValue(mockDisputeList as any);
    vi.mocked(disputeApi.getAdminDisputeDetail).mockResolvedValue(mockDisputeDetail as any);
    vi.mocked(disputeApi.resolveDispute).mockResolvedValueOnce({
      ...mockDisputeDetail,
      status: 'UPHELD',
      resolution: 'Chấp thuận khiếu nại',
      resolvedAt: '2026-10-19T12:00:00Z',
    } as any);

    renderComponent();

    const detailBtn = await screen.findByRole('button', { name: /chi tiết/i });
    fireEvent.click(detailBtn);

    expect(await screen.findByText('Tôi đã tiếp cận ứng viên trước')).toBeInTheDocument();
    expect(screen.getByText('Đính kèm email trao đổi')).toBeInTheDocument();

    const resolutionInput = screen.getByPlaceholderText(/nêu rõ lý do và căn cứ bằng chứng/i);
    fireEvent.change(resolutionInput, { target: { value: 'Chấp thuận khiếu nại của CTV Pro' } });

    const submitBtn = screen.getByRole('button', { name: /xác nhận giải quyết khiếu nại/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(disputeApi.resolveDispute).toHaveBeenCalledWith(
        'dsp-01',
        expect.objectContaining({
          decision: 'UPHELD',
          resolution: 'Chấp thuận khiếu nại của CTV Pro',
          concurrencyToken: 'token-1',
          idempotencyKey: expect.any(String),
        })
      );
    });
  });
});
