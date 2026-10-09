import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateSubmissionConsentPage } from './CandidateSubmissionConsentPage';
import { candidateConsentApi } from '@/services/api/mf02Api';

vi.mock('@/services/api/mf02Api', () => ({
  candidateConsentApi: {
    review: vi.fn(),
    respond: vi.fn(),
  },
}));

const reviewMock = vi.mocked(candidateConsentApi.review);
const respondMock = vi.mocked(candidateConsentApi.respond);

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AntApp>
        <MemoryRouter initialEntries={['/candidate/submission-consents/submission-1']}>
          <Routes>
            <Route path="/candidate/submission-consents/:submissionId" element={<CandidateSubmissionConsentPage />} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('CandidateSubmissionConsentPage', () => {
  beforeEach(() => {
    reviewMock.mockResolvedValue({
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
    });
    respondMock.mockResolvedValue({
      success: true,
      message: 'Đã xác nhận hồ sơ.',
      submissionId: 'submission-1',
      submissionStatus: 'ACCEPTED',
      applicationId: 'application-1',
      aiStatus: 'PENDING',
      affiliateReuseStatus: 'ALLOWED',
      reuseConcurrencyToken: 'token-1',
    });
  });

  it('loads the owned consent without asking for a technical token', async () => {
    renderPage();
    expect(await screen.findByText('Backend Developer')).toBeInTheDocument();
    expect(screen.getByText('cv-an.pdf')).toBeInTheDocument();
    expect(screen.queryByText(/access token/i)).not.toBeInTheDocument();
    expect(reviewMock).toHaveBeenCalledWith('submission-1');
  });

  it('sends one confirmation with the reuse choice and locks actions while pending', async () => {
    let finish!: (value: Awaited<ReturnType<typeof candidateConsentApi.respond>>) => void;
    respondMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Backend Developer');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Đồng ý nộp hồ sơ' }));

    expect(respondMock).toHaveBeenCalledWith('submission-1', 'CONFIRM', true);
    expect(screen.getByRole('button', { name: /Đồng ý nộp hồ sơ/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeDisabled();

    finish({
      success: true,
      message: 'Đã xác nhận hồ sơ.',
      submissionId: 'submission-1',
      submissionStatus: 'ACCEPTED',
      applicationId: 'application-1',
      aiStatus: 'PENDING',
      affiliateReuseStatus: 'ALLOWED',
      reuseConcurrencyToken: 'token-1',
    });
    await waitFor(() => expect(respondMock).toHaveBeenCalledTimes(1));
  });
});
