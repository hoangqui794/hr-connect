import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { affiliateApi } from '@/services/api/mf02Api';
import { AffiliateSubmissionDetailPage } from './AffiliatePages';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

describe('AffiliateSubmissionDetailPage', () => {
  beforeEach(() => {
    vi.spyOn(affiliateApi, 'submissionDetail').mockResolvedValue({
      submissionId: 'submission-1',
      candidateId: 'candidate-1',
      candidateName: 'Nguyễn Văn A',
      candidateEmail: 'candidate@example.com',
      candidatePhone: '0900000000',
      jobId: 'job-1',
      jobTitle: 'Backend Developer',
      companyName: 'HR Connect',
      cvId: 'cv-1',
      cvTitle: 'CV Backend',
      cvFileName: 'backend.pdf',
      status: 'PENDING_CONSENT',
      consentStatus: 'PENDING',
      consentRequestedAt: '2026-10-08T10:00:00Z',
      consentExpiresAt: '2026-10-10T10:00:00Z',
      consentRespondedAt: null,
      consentEmailSentAt: '2026-10-08T10:01:00Z',
      applicationId: null,
      attributionId: null,
      duplicateOfSubmissionId: null,
      reason: null,
      submittedAt: '2026-10-08T10:00:00Z',
      updatedAt: '2026-10-08T10:01:00Z',
    });
    vi.spyOn(affiliateApi, 'resendConsent').mockResolvedValue({
      success: true,
      message: 'Đã gửi lại yêu cầu xác nhận đến Candidate.',
      submissionId: 'submission-1',
      status: 'PENDING_CONSENT',
      expiresAt: '2026-10-10T11:00:00Z',
      emailSendCount: 2,
      emailDeliveryStatus: 'SENT',
    });
    useAuthStore.setState({
      role: UserRole.AFFILIATE,
      isAuthenticated: true,
      user: {
        id: 'affiliate-1',
        name: 'Affiliate One',
        email: 'affiliate@example.com',
        role: UserRole.AFFILIATE,
        roles: ['AFFILIATE_RECRUITER'],
        permissions: ['submission.view_own', 'submission.consent.resend_own'],
      },
    });
  });

  it('shows consent data without exposing private recruitment details', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/affiliate/submissions/submission-1']}>
        <QueryClientProvider client={queryClient}>
          <AntApp>
            <Routes>
              <Route path="/affiliate/submissions/:submissionId" element={<AffiliateSubmissionDetailPage />} />
            </Routes>
          </AntApp>
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Nguyễn Văn A' })).toBeInTheDocument();
    expect(screen.getByText('candidate@example.com')).toBeInTheDocument();
    expect(screen.getByText('Application, Attribution và MF03 chỉ được tạo sau khi Candidate đồng ý.')).toBeInTheDocument();
    expect(affiliateApi.submissionDetail).toHaveBeenCalledWith('submission-1');
  });

  it('resends once and disables repeat clicks in the current view', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/affiliate/submissions/submission-1']}>
        <QueryClientProvider client={queryClient}>
          <AntApp>
            <Routes>
              <Route path="/affiliate/submissions/:submissionId" element={<AffiliateSubmissionDetailPage />} />
            </Routes>
          </AntApp>
        </QueryClientProvider>
      </MemoryRouter>
    );

    const resendButton = await screen.findByRole('button', { name: /Gửi lại yêu cầu xác nhận/ });
    await user.click(resendButton);

    expect(await screen.findByText(/Hạn xác nhận mới:/)).toBeInTheDocument();
    expect(affiliateApi.resendConsent).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Đã gửi lại yêu cầu/ })).toBeDisabled();
  });
});
