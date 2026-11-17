import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobsApi, serviceAgreementsApi } from '@/services/api/jobsApi';
import { JobReviewPage } from './JobReviewPage';

const mockPendingJobs = [
  {
    jobId: '3d0f8b11-fe82-4409-9585-e00df7cf41d8',
    title: 'Kế Toán Kho',
    companyName: 'Thủ Đức Company',
    companyId: 'comp-1',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'RECRUITMENT',
    currencyCode: 'VND',
    quantity: 1,
    status: 'PENDING_REVIEW',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T11:39:00Z',
    concurrencyToken: 'token-1',
    requirements: [],
    skills: [],
    statusHistories: [],
  },
  {
    jobId: 'job-2',
    title: 'AI Content Creator',
    companyName: 'Thủ Đức Company',
    companyId: 'comp-1',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'RECRUITMENT',
    currencyCode: 'VND',
    quantity: 1,
    status: 'PENDING_REVIEW',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T11:23:00Z',
    concurrencyToken: 'token-2',
    requirements: [],
    skills: [],
    statusHistories: [],
  },
];

const mockAgreementJobs = [
  {
    jobId: 'job-agreement-1',
    title: 'Senior Developer',
    companyName: 'Tech Corp',
    companyId: 'comp-3',
    serviceTypeId: 'srv-1',
    serviceTypeCode: 'HEADHUNT_COD',
    currencyCode: 'VND',
    quantity: 1,
    status: 'PENDING_AGREEMENT',
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T12:00:00Z',
    concurrencyToken: 'token-3',
    requirements: [],
    skills: [],
    statusHistories: [],
    hasSignedAgreement: true,
  },
];

const mockAllJobs = [...mockPendingJobs, ...mockAgreementJobs];

describe('JobReviewPage tab switching with highlight query param', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    vi.spyOn(jobsApi, 'getReviewQueue').mockImplementation(async (status) => {
      if (status === 'PENDING_REVIEW') return mockPendingJobs as any;
      if (status === 'PENDING_AGREEMENT') return mockAgreementJobs as any;
      if (status === 'ALL') return mockAllJobs as any;
      return [];
    });

    vi.spyOn(jobsApi, 'getById').mockImplementation(async (id) => {
      const found = mockAllJobs.find((j) => j.jobId === id);
      return found as any;
    });

    vi.spyOn(serviceAgreementsApi, 'getCurrent').mockResolvedValue(null);
  });

  it('allows user to switch tab cleanly when arriving with a highlight param matching a pending review job', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=3d0f8b11-fe82-4409-9585-e00df7cf41d8']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Kế Toán Kho')).toBeInTheDocument();
    });

    // Switch tab to "Thỏa thuận dịch vụ"
    const agreementTab = screen.getByText('Thỏa thuận dịch vụ');
    fireEvent.click(agreementTab);

    // Verify it cleanly switches to the new tab
    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });
  });

  it('auto-redirects to the correct tab when highlight param belongs to another status, and still allows subsequent tab switches', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=job-agreement-1']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Should redirect to "Thỏa thuận dịch vụ" and show Senior Developer
    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });

    // Then user manually clicks "Chờ duyệt" tab
    const pendingTab = screen.getByText('Chờ duyệt');
    fireEvent.click(pendingTab);

    // Should successfully switch back to Chờ duyệt without being hijacked
    await waitFor(() => {
      expect(screen.getByText('Kế Toán Kho')).toBeInTheDocument();
    });
  });

  it('cleans up highlight param gracefully when job is not found in any queue', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=non-existent-guid']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Default to first job in list
    await waitFor(() => {
      expect(screen.getByText('Kế Toán Kho')).toBeInTheDocument();
    });

    // Clicking another tab must switch cleanly
    const agreementTab = screen.getByText('Thỏa thuận dịch vụ');
    fireEvent.click(agreementTab);

    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });
  });
  it('sends negotiated commercial terms and agreement reference from currentAgreement when HR confirms signed agreement', async () => {
    let capturedModalConfig: any = null;
    vi.spyOn(AntApp, 'useApp').mockReturnValue({
      message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn() } as any,
      modal: {
        confirm: vi.fn((config: any) => {
          capturedModalConfig = config;
          config.onOk();
        }),
      } as any,
      notification: {} as any,
    });

    vi.spyOn(serviceAgreementsApi, 'getCurrent').mockResolvedValue({
      serviceAgreementId: 'agr-1',
      jobId: 'job-agreement-1',
      companyId: 'comp-3',
      version: 1,
      serviceTypeCode: 'HEADHUNT_COD',
      status: 'SIGNED',
      concurrencyToken: 'agr-token-1',
      isCurrent: true,
      feeMultiplier: 1.5,
      warrantyDays: 30,
      paymentDueDays: 14,
      pricePerQualifiedCv: 250000,
      sourcingTarget: 10,
      reviewDays: 7,
      depositPercent: 30,
      agreementNote: 'Thoa thuan VIP',
      verificationCode: 'AGR-2026-XYZ',
      hasSignedDocument: true,
      hasUnsignedDocument: true,
      companyName: 'Tech Corp',
      createdByUserId: 'user-1',
      createdAt: '2026-11-01T10:00:00Z',
    } as any);

    const approveSpy = vi.spyOn(jobsApi, 'approve').mockResolvedValue({
      jobId: 'job-agreement-1',
      status: 'ACTIVE',
      message: 'Công khai tin tuyển dụng thành công.',
    } as any);

    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_AGREEMENT']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Senior Developer')).toBeInTheDocument();
    });

    const confirmBtn = await screen.findByRole('button', { name: /Công khai tin tuyển dụng/i }, { timeout: 8000 });
    fireEvent.click(confirmBtn);

    expect(capturedModalConfig).not.toBeNull();
    expect(capturedModalConfig.title).toBe('Xác nhận duyệt hợp đồng và công khai tin tuyển dụng?');

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'job-agreement-1',
        'token-3',
        expect.objectContaining({
          commercialTerms: expect.objectContaining({
            feeMultiplier: 1.5,
            warrantyDays: 30,
            paymentDueDays: 14,
            pricePerCv: 250000,
            sourcingTarget: 10,
            reviewDays: 7,
            depositPercent: 30,
          }),
          agreementReference: 'AGR-2026-XYZ',
          note: 'Thoa thuan VIP',
        })
      );
    });
  });

  it('includes depositPercent from CommercialTermsApprovalModal in createProposal payload for CV_SOURCING job', async () => {
    const sourcingJob = {
      jobId: 'job-sourcing-1',
      title: 'Backend .NET Sourcing',
      companyName: 'Sourcing Corp',
      companyId: 'comp-sourcing-1',
      serviceTypeId: 'srv-sourcing',
      serviceTypeCode: 'CV_SOURCING',
      currencyCode: 'VND',
      quantity: 2,
      status: 'PENDING_REVIEW',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
      concurrencyToken: 'token-sourcing-1',
      requirements: [],
      skills: [],
      statusHistories: [],
      commercialTerms: {
        sourcingTarget: 10,
        pricePerCv: 600000,
        depositPercent: 50,
        reviewDays: 7,
        paymentDueDays: 20,
      },
    };

    vi.spyOn(jobsApi, 'getReviewQueue').mockImplementation(async (status) => {
      if (status === 'PENDING_REVIEW') return [sourcingJob] as any;
      if (status === 'ALL') return [sourcingJob] as any;
      return [];
    });
    vi.spyOn(jobsApi, 'getById').mockResolvedValue(sourcingJob as any);
    vi.spyOn(jobsApi, 'getCommercialTermsDefaults').mockResolvedValue({
      jobId: 'job-sourcing-1',
      serviceTypeCode: 'CV_SOURCING',
      proposed: {
        sourcingTarget: 10,
        pricePerCv: 600000,
        depositPercent: 50,
        reviewDays: 7,
        paymentDueDays: 20,
      },
      adminDefaults: {
        sourcingTarget: 10,
        pricePerCv: 600000,
        depositPercent: 50,
        reviewDays: 7,
        paymentDueDays: 20,
      },
      prefill: {
        sourcingTarget: 10,
        pricePerCv: 600000,
        depositPercent: 35,
        reviewDays: 7,
        paymentDueDays: 20,
      },
      ranges: {
        sourcingTarget: { min: 1, max: 500 },
        pricePerCv: { min: 1000, max: 100000000 },
        depositPercent: { min: 0, max: 100 },
        reviewDays: { min: 1, max: 30 },
        paymentDueDays: { min: 1, max: 120 },
      },
    } as any);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const createProposalSpy = vi.spyOn(serviceAgreementsApi, 'createProposal').mockResolvedValue({
      serviceAgreementId: 'agr-sourcing-1',
      jobId: 'job-sourcing-1',
      companyId: 'comp-sourcing-1',
      version: 1,
      serviceTypeCode: 'CV_SOURCING',
      status: 'SENT_TO_CLIENT',
      concurrencyToken: 'agr-token-1',
      isCurrent: true,
      sourcingTarget: 10,
      pricePerQualifiedCv: 600000,
      depositPercent: 35,
      reviewDays: 7,
      paymentDueDays: 20,
      hasSignedDocument: false,
      hasUnsignedDocument: true,
      companyName: 'Sourcing Corp',
      createdByUserId: 'hr-1',
      createdAt: '2026-11-01T12:05:00Z',
    } as any);

    render(
      <AntApp>
        <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW']}>
          <QueryClientProvider client={queryClient}>
            <Routes>
              <Route path="/hr/jobs" element={<JobReviewPage />} />
            </Routes>
          </QueryClientProvider>
        </MemoryRouter>
      </AntApp>
    );

    await waitFor(() => {
      expect(screen.getByText('Backend .NET Sourcing')).toBeInTheDocument();
    });

    const openModalBtn = await screen.findByRole('button', { name: /Duyệt & Soạn thỏa thuận/i }, { timeout: 8000 });
    fireEvent.click(openModalBtn);

    const depositInput = await screen.findByLabelText(/Tỷ lệ cọc/i, {}, { timeout: 8000 });
    expect((depositInput as HTMLInputElement).value).toBe('35');

    const submitBtn = await screen.findByRole('button', { name: /Gửi hợp đồng cho Doanh nghiệp/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createProposalSpy).toHaveBeenCalledWith(
        'job-sourcing-1',
        expect.objectContaining({
          concurrencyToken: 'token-sourcing-1',
          sourcingTarget: 10,
          pricePerQualifiedCv: 600000,
          depositPercent: 35,
          reviewDays: 7,
          paymentDueDays: 20,
        })
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mf01-jobs'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['service-fees'] });
    });
  });

  it('shows API error and does not show success or invalidate queries when both confirmDeposit and approve fallback fail', async () => {
    const messageSuccessSpy = vi.fn();
    const messageErrorSpy = vi.fn();
    let onOkPromise: Promise<unknown> | undefined;

    vi.spyOn(AntApp, 'useApp').mockReturnValue({
      message: {
        success: messageSuccessSpy,
        error: messageErrorSpy,
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
      } as any,
      modal: {
        confirm: vi.fn((config: any) => {
          onOkPromise = config.onOk();
        }),
      } as any,
      notification: {} as any,
    });

    const pendingPaymentJob = {
      jobId: 'job-deposit-fail-1',
      title: 'DevOps Sourcing Deposit Fail',
      companyName: 'Ops Corp',
      companyId: 'comp-ops-1',
      serviceTypeId: 'srv-sourcing',
      serviceTypeCode: 'CV_SOURCING',
      currencyCode: 'VND',
      quantity: 1,
      status: 'PENDING_PAYMENT',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
      concurrencyToken: 'token-deposit-1',
      requirements: [],
      skills: [],
      statusHistories: [],
      hasSubmittedDeposit: true,
      commercialTerms: {
        sourcingTarget: 10,
        pricePerCv: 600000,
        depositPercent: 50,
        reviewDays: 7,
        paymentDueDays: 20,
      },
    };

    vi.spyOn(jobsApi, 'getReviewQueue').mockImplementation(async (status) => {
      if (status === 'PENDING_PAYMENT') return [pendingPaymentJob] as any;
      if (status === 'ALL') return [pendingPaymentJob] as any;
      return [];
    });
    vi.spyOn(jobsApi, 'getById').mockResolvedValue(pendingPaymentJob as any);

    const confirmDepositSpy = vi.spyOn(jobsApi, 'confirmDeposit').mockRejectedValue(
      Object.assign(new Error('Phiếu cọc chưa hợp lệ'), {
        isAxiosError: true,
        response: { status: 409, data: { message: 'Phiếu cọc chưa hợp lệ' } },
      })
    );
    const approveSpy = vi.spyOn(jobsApi, 'approve').mockRejectedValue(
      Object.assign(new Error('Không thể duyệt tin ở trạng thái hiện tại'), {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Không thể duyệt tin ở trạng thái hiện tại' } },
      })
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_PAYMENT']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('DevOps Sourcing Deposit Fail')).toBeInTheDocument();
    });

    const confirmDepositBtn = await screen.findByRole(
      'button',
      { name: /Xác nhận đã nhận cọc & Công khai tin/i },
      { timeout: 8000 }
    );
    fireEvent.click(confirmDepositBtn);

    await waitFor(() => {
      expect(confirmDepositSpy).toHaveBeenCalledWith('job-deposit-fail-1');
      expect(approveSpy).toHaveBeenCalledWith('job-deposit-fail-1', 'token-deposit-1');
    });

    await onOkPromise;

    expect(messageErrorSpy).toHaveBeenCalledWith('Không thể duyệt tin ở trạng thái hiện tại');
    expect(messageSuccessSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('invalidates mf01-jobs and service-fees queries when confirmDeposit succeeds', async () => {
    const messageSuccessSpy = vi.fn();
    let onOkPromise: Promise<unknown> | undefined;

    vi.spyOn(AntApp, 'useApp').mockReturnValue({
      message: {
        success: messageSuccessSpy,
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
      } as any,
      modal: {
        confirm: vi.fn((config: any) => {
          onOkPromise = config.onOk();
        }),
      } as any,
      notification: {} as any,
    });

    const pendingPaymentJob = {
      jobId: 'job-deposit-ok-1',
      title: 'DevOps Sourcing Deposit OK',
      companyName: 'Ops Corp',
      companyId: 'comp-ops-1',
      serviceTypeId: 'srv-sourcing',
      serviceTypeCode: 'CV_SOURCING',
      currencyCode: 'VND',
      quantity: 1,
      status: 'PENDING_PAYMENT',
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
      concurrencyToken: 'token-deposit-ok-1',
      requirements: [],
      skills: [],
      statusHistories: [],
      hasSubmittedDeposit: true,
      commercialTerms: {
        sourcingTarget: 10,
        pricePerCv: 600000,
        depositPercent: 50,
        reviewDays: 7,
        paymentDueDays: 20,
      },
    };

    vi.spyOn(jobsApi, 'getReviewQueue').mockImplementation(async (status) => {
      if (status === 'PENDING_PAYMENT') return [pendingPaymentJob] as any;
      if (status === 'ALL') return [pendingPaymentJob] as any;
      return [];
    });
    vi.spyOn(jobsApi, 'getById').mockResolvedValue(pendingPaymentJob as any);
    const confirmDepositSpy = vi.spyOn(jobsApi, 'confirmDeposit').mockResolvedValue({
      jobId: 'job-deposit-ok-1',
      status: 'ACTIVE',
      message: 'OK',
    } as any);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_PAYMENT']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('DevOps Sourcing Deposit OK')).toBeInTheDocument();
    });

    const confirmDepositBtn = await screen.findByRole(
      'button',
      { name: /Xác nhận đã nhận cọc & Công khai tin/i },
      { timeout: 8000 }
    );
    fireEvent.click(confirmDepositBtn);

    await waitFor(() => {
      expect(confirmDepositSpy).toHaveBeenCalledWith('job-deposit-ok-1');
    });

    await onOkPromise;

    expect(messageSuccessSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['mf01-jobs'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['service-fees'] });
  });

  it('shows "Duyệt tin tuyển dụng" on PENDING_REVIEW job that does not require commercial terms', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_REVIEW&highlight=3d0f8b11-fe82-4409-9585-e00df7cf41d8']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    const approveBtn = await screen.findByRole('button', { name: /Duyệt tin tuyển dụng/i }, { timeout: 8000 });
    expect(approveBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duyệt & Ký điều khoản/i })).toBeNull();
  });

  it('treats currentAgreement.status === SIGNED as signed in header and publish button even when hasSignedDocument is false', async () => {
    const otpSignedJob = {
      ...mockAgreementJobs[0],
      jobId: 'job-otp-signed-1',
      title: 'OTP Signed Tech Lead',
      hasSignedAgreement: false,
    };

    vi.spyOn(jobsApi, 'getReviewQueue').mockImplementation(async (status) => {
      if (status === 'PENDING_AGREEMENT') return [otpSignedJob] as any;
      if (status === 'ALL') return [otpSignedJob] as any;
      return [];
    });
    vi.spyOn(jobsApi, 'getById').mockResolvedValue(otpSignedJob as any);
    vi.spyOn(serviceAgreementsApi, 'getCurrent').mockResolvedValue({
      serviceAgreementId: 'agr-otp-1',
      jobId: 'job-otp-signed-1',
      companyId: 'comp-3',
      version: 2,
      serviceTypeCode: 'HEADHUNT_COD',
      status: 'SIGNED',
      concurrencyToken: 'agr-otp-token',
      isCurrent: true,
      feeMultiplier: 1.5,
      warrantyDays: 30,
      paymentDueDays: 14,
      verificationCode: 'AGR-OTP-01',
      hasSignedDocument: false,
      hasUnsignedDocument: true,
      companyName: 'Tech Corp',
      createdByUserId: 'user-1',
      createdAt: '2026-11-01T10:00:00Z',
      signedAt: '2026-11-02T09:30:00Z',
    } as any);

    render(
      <MemoryRouter initialEntries={['/hr/jobs?status=PENDING_AGREEMENT']}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/hr/jobs" element={<JobReviewPage />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Đã có bản ký kết', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/Doanh nghiệp đã hoàn tất ký hợp đồng \(v2\)/i)).toBeInTheDocument();
    const publishBtn = screen.getByRole('button', { name: /Công khai tin tuyển dụng/i });
    expect(publishBtn).not.toBeDisabled();
  });
});
