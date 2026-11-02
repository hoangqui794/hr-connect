import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminIdentityClaimDetailPage } from './AdminIdentityClaimDetailPage';
import { adminIdentityClaimApi } from '@/services/api/mf02/adminIdentityClaimApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/mf02/adminIdentityClaimApi', () => ({
  adminIdentityClaimApi: { get: vi.fn(), approve: vi.fn(), reject: vi.fn(), previewMerge: vi.fn(), mergeDuplicateCase: vi.fn() },
}));

const getMock = vi.mocked(adminIdentityClaimApi.get);
const approveMock = vi.mocked(adminIdentityClaimApi.approve);
const rejectMock = vi.mocked(adminIdentityClaimApi.reject);
const previewMergeMock = vi.mocked(adminIdentityClaimApi.previewMerge);
const mergeDuplicateCaseMock = vi.mocked(adminIdentityClaimApi.mergeDuplicateCase);

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

const detail = {
  claimId: 'claim-1', requesterUserId: 'user-1', requesterDisplayName: 'Nguyễn An',
  requesterPrimaryEmail: 'new@example.com', requesterUserStatus: 'ACTIVE', assertedEmail: 'old@example.com',
  status: 'PENDING_ADMIN_REVIEW', reviewReason: null, expiresAt: '2026-10-10T00:00:00Z', attemptCount: 1,
  resendCount: 0, lastSentAt: '2026-10-09T09:00:00Z', verifiedAt: '2026-10-09T09:05:00Z', completedAt: null,
  reviewedBy: null, reviewedAt: null, createdAt: '2026-10-09T09:00:00Z', updatedAt: '2026-10-09T09:05:00Z',
  concurrencyToken: 'token-1', duplicateCaseId: 'case-1',
  requesterCandidate: {
    candidateId: 'candidate-1', userId: 'user-1', fullName: 'Nguyễn An', email: 'new@example.com', phone: '0901000001',
    status: 'ACTIVE', mergedIntoCandidateId: null, cvCount: 0, submissionCount: 0, applicationCount: 0, matchCount: 0,
    skillCount: 2, highestEducation: 'Đại học', yearsOfExperience: 3, currentJobTitle: 'Backend Developer',
    summary: 'Hồ sơ hiện tại', dateOfBirth: '2000-01-01', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    primaryCvTitle: null, primaryCvFileName: null, hasBusinessData: false,
  },
  targetCandidate: {
    candidateId: 'candidate-2', userId: null, fullName: 'Nguyễn An cũ', email: 'old@example.com', phone: '0901000001',
    status: 'ACTIVE', mergedIntoCandidateId: null, cvCount: 2, submissionCount: 2, applicationCount: 1, matchCount: 1,
    skillCount: 3, highestEducation: 'Đại học', yearsOfExperience: 3, currentJobTitle: 'Backend Developer',
    summary: 'Hồ sơ cũ', dateOfBirth: '2000-01-01', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    primaryCvTitle: 'CV chính', primaryCvFileName: 'cv.pdf', hasBusinessData: true,
  },
  currentEmailOwner: {
    emailIdentityId: 'identity-1', userId: 'user-1', primaryEmail: 'new@example.com', displayName: 'Nguyễn An',
    kind: 'ALIAS', status: 'VERIFIED',
  },
  evidence: {
    emailOwnershipVerified: true, sameFullName: false, samePhone: true, sameDateOfBirth: true,
    exactCvMatch: false, similarCvText: false, supportingSignalCount: 3, conflictingSignalCount: 1,
  },
};

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AntApp>
        <MemoryRouter initialEntries={['/admin/candidate-identity-claims/claim-1']}>
          <Routes>
            <Route path="/admin/candidate-identity-claims/:claimId" element={<AdminIdentityClaimDetailPage />} />
            <Route path="/admin/candidate-identity-claims" element={<div>Danh sách</div>} />
          </Routes>
        </MemoryRouter>
      </AntApp>
    </QueryClientProvider>
  );
};

describe('AdminIdentityClaimDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1', name: 'Admin', email: 'admin@hrconnectvn.online', role: UserRole.ADMIN,
        roles: [UserRole.ADMIN], permissions: ['candidate.identity.review'],
      },
    });
    getMock.mockResolvedValue(detail);
    previewMergeMock.mockResolvedValue({
      duplicateCaseId: 'case-1', recommendedCanonicalCandidateId: 'candidate-1', sourceCandidateId: 'candidate-2',
      recommendationReason: 'ACCOUNT_OWNER', canMerge: true, collisions: [], financeBlockers: [], concurrencyToken: 'case-token-1',
    });
  });

  it('shows both candidate records and approves with the current concurrency token', async () => {
    approveMock.mockResolvedValue({
      success: true, message: 'Đã phê duyệt.', claimId: 'claim-1', status: 'COMPLETED',
      canonicalCandidateId: 'candidate-2', concurrencyToken: 'token-2',
    });
    renderPage();
    expect(await screen.findByText('Hồ sơ Candidate cũ theo email')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Phê duyệt/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Phê duyệt' }));
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith('claim-1', 'token-1', undefined));
  });

  it('requires a reason before rejecting', async () => {
    rejectMock.mockResolvedValue({ success: true, message: 'Đã từ chối.', claimId: 'claim-1', status: 'REJECTED', concurrencyToken: 'token-2' });
    renderPage();
    expect((await screen.findAllByText('old@example.com')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Từ chối/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
    expect(await screen.findByText('Nhập lý do từ chối.', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it('blocks automatic approval when both candidates have business data', async () => {
    getMock.mockResolvedValue({
      ...detail,
      requesterCandidate: { ...detail.requesterCandidate, cvCount: 1, hasBusinessData: true },
    });
    renderPage();
    expect(await screen.findByText('Không thể tự động hợp nhất hai hồ sơ đã có dữ liệu nghiệp vụ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phê duyệt/ })).toBeDisabled();
  });

  it('previews, safely merges, then completes the identity claim', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, permissions: ['candidate.identity.review', 'candidate_duplicate.resolve'] } : null,
    }));
    getMock.mockResolvedValue({
      ...detail,
      requesterCandidate: { ...detail.requesterCandidate, cvCount: 1, hasBusinessData: true },
    });
    mergeDuplicateCaseMock.mockResolvedValue({});
    approveMock.mockResolvedValue({
      success: true, message: 'Đã hợp nhất.', claimId: 'claim-1', status: 'COMPLETED',
      canonicalCandidateId: 'candidate-1', concurrencyToken: 'token-2',
    });

    renderPage();
    const mergeButton = await screen.findByRole('button', { name: /Hợp nhất an toàn/ });
    await waitFor(() => expect(mergeButton).toBeEnabled());
    fireEvent.click(mergeButton);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Đã đối chiếu email, số điện thoại và hồ sơ.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hợp nhất an toàn' }));

    await waitFor(() => expect(mergeDuplicateCaseMock).toHaveBeenCalled());
    expect(approveMock).toHaveBeenCalledWith('claim-1', 'token-1', 'Đã đối chiếu email, số điện thoại và hồ sơ.');
  });

  it('reloads the detail after a stale concurrency conflict', async () => {
    approveMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { message: 'Yêu cầu đã được cập nhật.', errorCode: 'STALE_IDENTITY_CLAIM' },
        headers: {},
      },
    });
    renderPage();
    await screen.findByText('Hồ sơ Candidate hiện tại');
    fireEvent.click(screen.getByRole('button', { name: /Phê duyệt/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Phê duyệt' }));
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
  });
});
