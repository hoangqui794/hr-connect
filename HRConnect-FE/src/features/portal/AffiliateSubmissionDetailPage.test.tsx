import { App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { affiliateApi } from '@/services/api/mf02Api';
import { AffiliateSubmissionDetailPage } from './AffiliatePages';

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
});
