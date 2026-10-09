import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateIdentityPage } from './CandidateIdentityPage';
import { candidateIdentityApi } from '@/services/api/mf02/candidateIdentityApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/mf02/candidateIdentityApi', () => ({
  candidateIdentityApi: {
    listEmailIdentities: vi.fn(),
    start: vi.fn(),
    resend: vi.fn(),
    verify: vi.fn(),
  },
}));

const listMock = vi.mocked(candidateIdentityApi.listEmailIdentities);
const startMock = vi.mocked(candidateIdentityApi.start);
const resendMock = vi.mocked(candidateIdentityApi.resend);
const verifyMock = vi.mocked(candidateIdentityApi.verify);
const syncCurrentUser = vi.fn().mockResolvedValue(null);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp>
        <MemoryRouter><CandidateIdentityPage /></MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('CandidateIdentityPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.CANDIDATE,
      syncCurrentUser,
      user: {
        id: 'candidate-user',
        name: 'Candidate',
        email: 'new@example.com',
        role: UserRole.CANDIDATE,
        roles: [UserRole.CANDIDATE],
        permissions: ['candidate.identity.manage_own'],
      },
    });
    listMock.mockResolvedValue([{
      emailIdentityId: 'email-1',
      email: 'new@example.com',
      kind: 'PRIMARY',
      status: 'VERIFIED',
      verificationSource: 'REGISTRATION',
      verifiedAt: '2026-10-09T00:00:00Z',
      revokedAt: null,
      createdAt: '2026-10-09T00:00:00Z',
      concurrencyToken: 'email-token',
      canRevoke: false,
      canMakePrimary: false,
    }]);
  });

  it('lists verified emails and starts a masked OTP claim', async () => {
    startMock.mockResolvedValue({
      success: true,
      message: 'Đã gửi mã xác minh.',
      data: {
        claimId: 'claim-1',
        maskedDestination: 'ol***@example.com',
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        resendAfter: new Date(Date.now() + 60_000).toISOString(),
        concurrencyToken: 'token-1',
      },
    });
    renderPage();
    expect(await screen.findByText('new@example.com')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email cũ'), { target: { value: 'old@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã xác minh' }));

    await waitFor(() => expect(startMock).toHaveBeenCalledWith('old@example.com'));
    expect(await screen.findByText(/ol\*\*\*@example\.com/)).toBeInTheDocument();
    expect(screen.queryByText('old@example.com')).not.toBeInTheDocument();
  });

  it('uses the newest concurrency token after resend and shows admin review status', async () => {
    sessionStorage.setItem('hrconnect:candidate-identity-claim', JSON.stringify({
      claimId: 'claim-1',
      maskedDestination: 'ol***@example.com',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      resendAfter: new Date(Date.now() - 1_000).toISOString(),
      concurrencyToken: 'token-1',
    }));
    resendMock.mockResolvedValue({
      success: true,
      message: 'Đã gửi lại mã.',
      claimId: 'claim-1',
      maskedDestination: 'ol***@example.com',
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      resendAfter: new Date(Date.now() - 1_000).toISOString(),
      resendCount: 1,
      emailDeliveryStatus: 'SENT',
      concurrencyToken: 'token-2',
    });
    verifyMock.mockResolvedValue({
      success: true,
      message: 'Email đã xác minh và đang chờ Admin xem xét.',
      claimId: 'claim-1',
      status: 'PENDING_ADMIN_REVIEW',
      candidateId: 'candidate-user',
      concurrencyToken: 'token-3',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi lại mã' }));
    await waitFor(() => expect(resendMock).toHaveBeenCalledWith('claim-1', 'token-1'));
    fireEvent.change(screen.getByLabelText('Mã OTP'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác minh và liên kết/ }));

    await waitFor(() => expect(verifyMock).toHaveBeenCalledWith('claim-1', '123456', 'token-2'));
    expect(await screen.findByText('Đang chờ Admin đối chiếu')).toBeInTheDocument();
    expect(sessionStorage.getItem('hrconnect:candidate-identity-claim')).toBeNull();
  });
});
