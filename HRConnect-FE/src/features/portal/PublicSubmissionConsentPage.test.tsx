import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicSubmissionConsentPage } from './PublicSubmissionConsentPage';
import { candidateConsentApi } from '@/services/api/mf02Api';

vi.mock('@/services/api/mf02Api', () => ({
  candidateConsentApi: {
    reviewPublic: vi.fn(),
    respondPublic: vi.fn(),
  },
}));

const reviewMock = vi.mocked(candidateConsentApi.reviewPublic);
const respondMock = vi.mocked(candidateConsentApi.respondPublic);

const consent = {
  submissionId: 'submission-1',
  status: 'PENDING',
  expiresAt: '2099-10-10T10:00:00Z',
  candidateName: 'Nguyễn Văn An',
  jobTitle: 'Backend Developer',
  companyName: 'HR Connect',
  cvFileName: 'cv-an.pdf',
  cvDownloadUrl: 'https://example.test/cv.pdf',
  cvUrlExpiresAt: '2099-10-10T09:05:00Z',
  affiliateReuseStatus: 'NOT_GRANTED',
  reuseConcurrencyToken: null,
};

const renderPage = (initialEntry = '/submission-consent#token=secret-email-token') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/submission-consent" element={<PublicSubmissionConsentPage />} />
            <Route path="/candidate/submission-consents/:submissionId" element={<div>Trang xác nhận Candidate đã đăng nhập</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('PublicSubmissionConsentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewMock.mockResolvedValue(consent);
    respondMock.mockResolvedValue({
      success: true,
      message: 'Đã xác nhận hồ sơ.',
      submissionId: 'submission-1',
      submissionStatus: 'ACCEPTED',
      applicationId: 'application-1',
      aiStatus: 'PENDING',
      affiliateReuseStatus: 'NOT_GRANTED',
      reuseConcurrencyToken: null,
    });
  });

  it('consumes the fragment token, removes it from the URL and never renders it', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderPage();
    expect(await screen.findByText('Backend Developer')).toBeInTheDocument();
    expect(reviewMock).toHaveBeenCalledWith('secret-email-token');
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      document.title,
      expect.not.stringContaining('secret-email-token')
    );
    expect(screen.queryByText('secret-email-token')).not.toBeInTheDocument();
    replaceState.mockRestore();
  });

  it('routes account-linked candidates to the authenticated consent page', async () => {
    renderPage('/submission-consent#submissionId=submission-1');

    expect(await screen.findByText('Trang xác nhận Candidate đã đăng nhập')).toBeInTheDocument();
    expect(reviewMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/liên kết xác nhận không hợp lệ/i)).not.toBeInTheDocument();
  });

  it('responds with the in-memory token and prevents duplicate decisions', async () => {
    let finish!: (value: Awaited<ReturnType<typeof candidateConsentApi.respondPublic>>) => void;
    respondMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Backend Developer');
    await user.click(screen.getByRole('button', { name: 'Đồng ý nộp hồ sơ' }));

    expect(respondMock).toHaveBeenCalledWith('secret-email-token', 'CONFIRM', false);
    expect(screen.getByRole('button', { name: /Đồng ý nộp hồ sơ/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeDisabled();

    finish({
      success: true,
      message: 'Đã xác nhận hồ sơ.',
      submissionId: 'submission-1',
      submissionStatus: 'ACCEPTED',
      applicationId: 'application-1',
      aiStatus: 'PENDING',
      affiliateReuseStatus: 'NOT_GRANTED',
      reuseConcurrencyToken: null,
    });
    await waitFor(() => expect(screen.getByText('Đã đồng ý nộp hồ sơ')).toBeInTheDocument());
  });
});
