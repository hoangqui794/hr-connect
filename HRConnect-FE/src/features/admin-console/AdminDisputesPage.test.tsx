import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
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
  resolvedBy: null,
  resolution: null,
  resolvedAt: null,
  concurrencyToken: '11111111-1111-1111-1111-111111111111',
};

const renderComponent = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App>
        <AdminDisputesPage />
      </App>
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
          concurrencyToken: '11111111-1111-1111-1111-111111111111',
          idempotencyKey: expect.any(String),
        })
      );
    });
    const sentPayload = vi.mocked(disputeApi.resolveDispute).mock.calls[0][1];
    expect(sentPayload.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('reuses the same idempotencyKey when retrying after a transient network error in the same open drawer', async () => {
    vi.mocked(disputeApi.getAdminDisputes).mockResolvedValue(mockDisputeList as any);
    vi.mocked(disputeApi.getAdminDisputeDetail).mockResolvedValue(mockDisputeDetail as any);
    vi.mocked(disputeApi.resolveDispute)
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        ...mockDisputeDetail,
        status: 'UPHELD',
        resolution: 'Chấp thuận sau khi thử lại',
        resolvedAt: '2026-10-19T12:00:00Z',
        concurrencyToken: '22222222-2222-2222-2222-222222222222',
      } as any);

    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: /chi tiết/i }));
    const resolutionInput = await screen.findByPlaceholderText(/nêu rõ lý do và căn cứ bằng chứng/i);
    fireEvent.change(resolutionInput, { target: { value: 'Chấp thuận sau khi thử lại' } });

    const submitBtn = screen.getByRole('button', { name: /xác nhận giải quyết khiếu nại/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(disputeApi.resolveDispute).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(disputeApi.resolveDispute).toHaveBeenCalledTimes(2);
    });

    const firstCallPayload = vi.mocked(disputeApi.resolveDispute).mock.calls[0][1];
    const secondCallPayload = vi.mocked(disputeApi.resolveDispute).mock.calls[1][1];
    expect(firstCallPayload.idempotencyKey).toBe(secondCallPayload.idempotencyKey);
  });

  it('on 409 STALE_DISPUTE_RESOLUTION shows reload notice, refetches detail, and preserves Admin input', async () => {
    const updatedDetail = {
      ...mockDisputeDetail,
      concurrencyToken: '22222222-2222-2222-2222-222222222222',
    };
    vi.mocked(disputeApi.getAdminDisputes).mockResolvedValue(mockDisputeList as any);
    vi.mocked(disputeApi.getAdminDisputeDetail)
      .mockResolvedValueOnce(mockDisputeDetail as any)
      .mockResolvedValue(updatedDetail as any);

    const staleError = Object.assign(new Error('Conflict'), {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'STALE_DISPUTE_RESOLUTION',
          message: 'Khiếu nại vừa được cập nhật. Vui lòng tải lại chi tiết mới nhất.',
        },
      },
    });
    vi.mocked(disputeApi.resolveDispute)
      .mockRejectedValueOnce(staleError)
      .mockResolvedValueOnce({
        ...updatedDetail,
        status: 'REJECTED',
        resolution: 'Giữ nguyên quyết định sau khi tải lại',
        resolvedAt: '2026-10-19T12:05:00Z',
      } as any);

    renderComponent();

    fireEvent.click(await screen.findByRole('button', { name: /chi tiết/i }));
    const resolutionInput = (await screen.findByPlaceholderText(
      /nêu rõ lý do và căn cứ bằng chứng/i
    )) as HTMLTextAreaElement;

    fireEvent.click(screen.getByLabelText(/từ chối khiếu nại/i));
    fireEvent.change(resolutionInput, {
      target: { value: 'Giữ nguyên quyết định sau khi tải lại' },
    });

    const submitBtn = screen.getByRole('button', { name: /xác nhận giải quyết khiếu nại/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText('Khiếu nại vừa được cập nhật, đang tải lại')
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(disputeApi.getAdminDisputeDetail).toHaveBeenCalledTimes(2);
    });

    // Admin's typed resolution and selected decision must not be lost after reload
    expect(resolutionInput.value).toBe('Giữ nguyên quyết định sau khi tải lại');

    // Submitting again sends the refreshed concurrencyToken and same idempotencyKey
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(disputeApi.resolveDispute).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(disputeApi.resolveDispute).mock.calls[1][1]).toEqual({
      decision: 'REJECTED',
      resolution: 'Giữ nguyên quyết định sau khi tải lại',
      concurrencyToken: '22222222-2222-2222-2222-222222222222',
      idempotencyKey: vi.mocked(disputeApi.resolveDispute).mock.calls[0][1].idempotencyKey,
    });
  });
});
