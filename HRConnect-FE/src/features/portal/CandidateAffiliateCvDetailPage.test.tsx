import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateAffiliateCvDetailPage } from './CandidateAffiliateCvsPage';
import { candidateAffiliateCvApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

const openSigned = vi.fn();

vi.mock('./CandidatePages', () => ({
  candidateKeys: { cvs: ['candidate-cvs'] },
  useOpenSignedUrl: () => openSigned,
}));

vi.mock('@/services/api/mf02Api', () => ({
  candidateAffiliateCvApi: {
    detail: vi.fn(),
    usages: vi.fn(),
    downloadUrl: vi.fn(),
    updateReuse: vi.fn(),
    adopt: vi.fn(),
  },
}));

const detailMock = vi.mocked(candidateAffiliateCvApi.detail);
const usagesMock = vi.mocked(candidateAffiliateCvApi.usages);
const updateReuseMock = vi.mocked(candidateAffiliateCvApi.updateReuse);
const adoptMock = vi.mocked(candidateAffiliateCvApi.adopt);

const detail = {
  cvId: 'cv-1',
  title: 'CV Backend',
  fileName: 'backend.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 2048,
  documentStatus: 'ACTIVE',
  affiliateReuseStatus: 'ALLOWED',
  reuseConcurrencyToken: 'token-1',
  reuseChangedAt: '2026-10-08T00:00:00Z',
  affiliateUserId: 'affiliate-user',
  affiliateDisplayName: 'Affiliate Minh',
  submissionCount: 2,
  pendingConsentCount: 0,
  acceptedSubmissionCount: 1,
  declinedSubmissionCount: 1,
  expiredSubmissionCount: 0,
  lastSubmittedAt: '2026-10-08T00:00:00Z',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-08T00:00:00Z',
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp>
        <MemoryRouter initialEntries={['/candidate/affiliate-cvs/cv-1']}>
          <Routes>
            <Route path="/candidate/affiliate-cvs/:cvId" element={<CandidateAffiliateCvDetailPage />} />
            <Route path="/candidate/cvs" element={<div>Kho CV cá nhân</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('CandidateAffiliateCvDetailPage', () => {
  beforeEach(() => {
    openSigned.mockReset();
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'candidate-user',
        name: 'Candidate',
        email: 'candidate@example.com',
        role: UserRole.CANDIDATE,
        roles: [UserRole.CANDIDATE],
        permissions: ['cv.view_own', 'cv.affiliate_reuse.manage_own', 'cv.create'],
      },
    });
    detailMock.mockResolvedValue(detail);
    usagesMock.mockResolvedValue({
      items: [{
        submissionId: 'submission-1',
        jobId: 'job-1',
        jobTitle: 'Senior Backend Developer',
        companyId: 'company-1',
        companyName: 'HR Connect',
        affiliateUserId: 'affiliate-user',
        affiliateDisplayName: 'Affiliate Minh',
        submissionStatus: 'ACCEPTED',
        submittedAt: '2026-10-08T00:00:00Z',
        consentStatus: 'CONFIRMED',
        consentRequestedAt: '2026-10-08T00:00:00Z',
        consentExpiresAt: null,
        consentRespondedAt: '2026-10-08T01:00:00Z',
        applicationId: 'application-1',
        applicationStatus: 'SCREENING',
        applicationCurrentStage: 'SCREENING',
        aiStatus: 'COMPLETED',
        aiMatchScore: 87,
        aiMatchTier: 'A',
        aiCompletedAt: '2026-10-08T02:00:00Z',
      }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    updateReuseMock.mockResolvedValue({
      success: true,
      message: 'Đã thu hồi quyền dùng lại CV.',
      data: {
        cvId: 'cv-1',
        affiliateReuseStatus: 'REVOKED',
        reuseConcurrencyToken: 'token-2',
        reuseChangedAt: '2026-10-09T00:00:00Z',
      },
    });
    adoptMock.mockResolvedValue({
      success: true,
      message: 'Đã lưu CV vào kho cá nhân.',
      data: {
        sourceCvId: 'cv-1',
        cvId: 'personal-cv-1',
        title: 'CV Backend',
        fileName: 'backend.pdf',
        isPrimary: false,
        status: 'ACTIVE',
        alreadyAdopted: false,
        createdAt: '2026-10-09T00:00:00Z',
      },
    });
  });

  it('loads detail and usage history from the owned CV endpoints', async () => {
    renderPage();

    expect(await screen.findByText('CV Backend')).toBeInTheDocument();
    expect(screen.getByText('Senior Backend Developer')).toBeInTheDocument();
    expect(screen.getByText('AI: COMPLETED · 87')).toBeInTheDocument();
    expect(detailMock).toHaveBeenCalledWith('cv-1');
    expect(usagesMock).toHaveBeenCalledWith('cv-1', 1, 10);
  });

  it('opens a fresh signed URL only when Candidate asks to view the CV', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Xem CV/ }));

    expect(openSigned).toHaveBeenCalledTimes(1);
    const request = openSigned.mock.calls[0][0] as () => Promise<unknown>;
    await request();
    expect(candidateAffiliateCvApi.downloadUrl).toHaveBeenCalledWith('cv-1');
  });

  it('uses the current concurrency token when revoking reuse', async () => {
    detailMock
      .mockResolvedValueOnce(detail)
      .mockResolvedValue({
        ...detail,
        affiliateReuseStatus: 'REVOKED',
        reuseConcurrencyToken: 'token-2',
        reuseChangedAt: '2026-10-09T00:00:00Z',
      });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Thu hồi quyền dùng lại' }));
    await user.click(await screen.findByRole('button', { name: 'Thu hồi' }));

    await waitFor(() => expect(updateReuseMock).toHaveBeenCalledWith('cv-1', false, 'token-1'));
    expect(await screen.findByRole('button', { name: 'Cho phép dùng lại' })).toBeInTheDocument();
  });

  it('adopts the CV and moves Candidate to the personal vault', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Lưu vào kho CV cá nhân' }));

    await waitFor(() => expect(adoptMock).toHaveBeenCalledWith('cv-1', 'CV Backend'));
    expect(await screen.findByText('Kho CV cá nhân')).toBeInTheDocument();
  });
});
