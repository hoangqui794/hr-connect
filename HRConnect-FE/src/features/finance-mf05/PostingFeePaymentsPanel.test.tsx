import { App } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostingFeePaymentsPanel, POSTING_FEE_QUERY_KEY } from './PostingFeePaymentsPanel';
import { jobsApi } from '@/services/api/jobsApi';

vi.mock('@/services/api/jobsApi', () => ({
  jobsApi: {
    getReviewQueue: vi.fn(),
    getPostingFee: vi.fn(),
    payPostingFee: vi.fn(),
  },
}));

describe('PostingFeePaymentsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jobsApi.getReviewQueue).mockResolvedValue([
      {
        jobId: 'job-post-1',
        title: 'Frontend Architect',
        companyName: 'ABC Tech',
        serviceTypeCode: 'CV_APPLICATION',
        postingPackageName: 'Gói Nổi bật',
        updatedAt: '2026-11-10T08:00:00Z',
      },
    ] as never);
    vi.mocked(jobsApi.getPostingFee).mockResolvedValue({
      postingFeeId: 'pf-1',
      amount: 1_500_000,
      currencyCode: 'VND',
    } as never);
    vi.mocked(jobsApi.payPostingFee).mockResolvedValue({} as never);
  });

  it('invalidates posting fees, mf01-jobs, mf05-count, and client-billing after recording payment', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <App>
          <PostingFeePaymentsPanel enabled />
        </App>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận đã thu' }));
    expect(await screen.findByText('Ghi nhận Client đã thanh toán phí đăng tin')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('VD: VCB-20261019-001'), {
      target: { value: 'VCB-20261116-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => {
      expect(jobsApi.payPostingFee).toHaveBeenCalledWith('job-post-1', 'VCB-20261116-001');
    });

    await waitFor(() => {
      for (const queryKey of [
        [POSTING_FEE_QUERY_KEY],
        ['mf01-jobs'],
        ['mf05-count'],
        ['client-billing'],
        ['client-overview'],
        ['hr-overview'],
      ]) {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
      }
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['jobs'] });
  });
});
