import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicSubmissionConsentPage } from './PublicSubmissionConsentPage';
import { candidateConsentApi } from '@/services/api/mf02Api';
import { AxiosError, AxiosHeaders } from 'axios';

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
    await user.click(screen.getByRole('button', { name: 'Đồng ý ứng tuyển' }));

    expect(respondMock).toHaveBeenCalledWith('secret-email-token', 'CONFIRM', false);
    expect(screen.getByRole('button', { name: 'Đồng ý ứng tuyển' })).toBeDisabled();
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

  // UI-03 (test 20/10): reopening an email link that can no longer be used shows a clear closed state.
  it('shows a closed state when the decision is rejected with 409', async () => {
    respondMock.mockRejectedValue(
      new AxiosError('Conflict', '409', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { success: false, message: 'Yêu cầu xác nhận đã được xử lý trước đó.', code: 'CONSENT_ALREADY_RESPONDED' },
      })
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Backend Developer');
    await user.click(screen.getByRole('button', { name: 'Đồng ý ứng tuyển' }));

    expect(await screen.findByText('Yêu cầu này không còn xử lý được')).toBeInTheDocument();
    expect(screen.getAllByText('Yêu cầu xác nhận đã được xử lý trước đó.').length).toBeGreaterThan(0);
  });

  it('shows who is referred, to which job, the CV and the deadline', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Bạn được giới thiệu ứng tuyển vào một vị trí' })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cv-an.pdf' })).toHaveAttribute('href', 'https://example.test/cv.pdf');
    expect(screen.getByText(/còn \d+ giờ/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Báo cho HR Connect' })).toHaveAttribute('href', '/contact');
  });

  it('does not link a CV whose address is not a web address', async () => {
    reviewMock.mockResolvedValue({ ...consent, cvDownloadUrl: 'javascript:alert(1)' });
    renderPage();

    expect(await screen.findByText('cv-an.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'cv-an.pdf' })).not.toBeInTheDocument();
  });

  it('sends the reuse permission with the agreement', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: /dùng lại CV/ }));
    await user.click(screen.getByRole('button', { name: 'Đồng ý ứng tuyển' }));

    expect(respondMock).toHaveBeenCalledWith('secret-email-token', 'CONFIRM', true);
  });

  it('asks before declining, then shows the result', async () => {
    respondMock.mockResolvedValue({
      success: true,
      message: 'Đã từ chối.',
      submissionId: 'submission-1',
      submissionStatus: 'CONSENT_REJECTED',
      applicationId: null,
      aiStatus: null,
      affiliateReuseStatus: 'NOT_GRANTED',
      reuseConcurrencyToken: null,
    } as never);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Từ chối' }));
    expect(respondMock).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole('tooltip')).getByRole('button', { name: 'Từ chối' }));

    expect(respondMock).toHaveBeenCalledWith('secret-email-token', 'DECLINE', false);
    expect(await screen.findByText('Đã từ chối hồ sơ')).toBeInTheDocument();
  });

  it('says the agreement counted when the submission is held for an identity check', async () => {
    respondMock.mockResolvedValue({
      success: true,
      message: 'Đã xác nhận.',
      submissionId: 'submission-1',
      submissionStatus: 'PENDING_IDENTITY_REVIEW',
      applicationId: null,
      aiStatus: 'NOT_QUEUED',
      affiliateReuseStatus: 'NOT_GRANTED',
      reuseConcurrencyToken: null,
    } as never);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Đồng ý ứng tuyển' }));

    expect(await screen.findByText('Đã đồng ý nộp hồ sơ')).toBeInTheDocument();
    expect(screen.getByText(/đang được đối chiếu danh tính/)).toBeInTheDocument();
    expect(screen.queryByText(/sẽ không được gửi/)).not.toBeInTheDocument();
  });

  it('offers to register after agreeing', async () => {
    reviewMock.mockResolvedValue({ ...consent, status: 'CONFIRMED' });
    renderPage();

    expect(await screen.findByRole('link', { name: 'Đăng ký tài khoản' })).toHaveAttribute('href', '/register');
  });

  it('reopening a link that was already confirmed shows the result, not the decision buttons', async () => {
    reviewMock.mockResolvedValue({ ...consent, status: 'CONFIRMED' });
    renderPage();

    expect(await screen.findByText('Đã đồng ý nộp hồ sơ')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Đồng ý ứng tuyển' })).not.toBeInTheDocument();
  });

  it('reopening an expired pending link shows that the request has ended', async () => {
    reviewMock.mockResolvedValue({ ...consent, expiresAt: '2000-01-01T00:00:00Z' });
    renderPage();

    expect(await screen.findByText('Yêu cầu xác nhận đã kết thúc')).toBeInTheDocument();
  });
});
