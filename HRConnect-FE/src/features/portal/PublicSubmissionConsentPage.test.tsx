import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
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

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter><PublicSubmissionConsentPage /></MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('PublicSubmissionConsentPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/submission-consent#token=secret-email-token');
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
    renderPage();
    expect(await screen.findByText('Backend Developer')).toBeInTheDocument();
    expect(reviewMock).toHaveBeenCalledWith('secret-email-token');
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain('secret-email-token');
    expect(screen.queryByText('secret-email-token')).not.toBeInTheDocument();
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
