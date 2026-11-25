import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminIdentityClaimsPage } from './AdminIdentityClaimsPage';
import { adminIdentityClaimApi } from '@/services/api/mf02/adminIdentityClaimApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/mf02/adminIdentityClaimApi', () => ({
  adminIdentityClaimApi: {
    list: vi.fn(),
    listDuplicateCases: vi.fn(),
    getDuplicateCase: vi.fn(),
    previewMerge: vi.fn(),
    resolveDuplicateCase: vi.fn(),
  },
}));

const listMock = vi.mocked(adminIdentityClaimApi.list);
const listDuplicateCasesMock = vi.mocked(adminIdentityClaimApi.listDuplicateCases);
const getDuplicateCaseMock = vi.mocked(adminIdentityClaimApi.getDuplicateCase);
const previewMergeMock = vi.mocked(adminIdentityClaimApi.previewMerge);
const resolveDuplicateCaseMock = vi.mocked(adminIdentityClaimApi.resolveDuplicateCase);

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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/candidate-identity-claims']}>
        <Routes>
          <Route path="/admin/candidate-identity-claims" element={<AdminIdentityClaimsPage />} />
          <Route path="/admin/candidate-identity-claims/:claimId" element={<div>Trang chi tiết</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AdminIdentityClaimsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: true,
      role: UserRole.ADMIN,
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@hrconnectvn.online',
        role: UserRole.ADMIN,
        roles: [UserRole.ADMIN],
        permissions: ['candidate.identity.review'],
      },
    });
    listMock.mockResolvedValue({
      items: [{
        claimId: 'claim-1',
        requesterUserId: 'user-1',
        requesterCandidateId: 'candidate-1',
        targetCandidateId: 'candidate-2',
        maskedAssertedEmail: 'ol***@example.com',
        status: 'PENDING_ADMIN_REVIEW',
        reviewReason: null,
        requesterDisplayName: 'Nguyễn An',
        requesterPrimaryEmail: 'new@example.com',
        requesterCandidateName: 'Nguyễn An',
        targetCandidateName: 'Nguyễn An cũ',
        createdAt: '2026-10-09T09:00:00Z',
        verifiedAt: '2026-10-09T09:05:00Z',
        reviewedAt: null,
        reviewedBy: null,
      }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('loads pending claims by default and opens the selected claim', async () => {
    renderPage();
    expect(await screen.findByText('ol***@example.com')).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'PENDING_ADMIN_REVIEW', page: 1, pageSize: 20, sortBy: 'createdAt', sortDirection: 'desc',
    })));
    fireEvent.click(screen.getByText('ol***@example.com'));
    expect(await screen.findByText('Trang chi tiết')).toBeInTheDocument();
  });

  it('does not call the API without the review permission', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, permissions: [] } : null,
    }));
    renderPage();
    expect(screen.getByText('Bạn không có quyền đối chiếu yêu cầu khôi phục danh tính Candidate.')).toBeInTheDocument();
    await waitFor(() => expect(listMock).not.toHaveBeenCalled());
  });

  it('switches to duplicate cases tab, previews merge, and resolves a case', async () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user
        ? {
            ...state.user,
            permissions: [
              'candidate.identity.review',
              'candidate_duplicate.view',
              'candidate_duplicate.resolve',
            ],
          }
        : null,
    }));

    listDuplicateCasesMock.mockResolvedValue({
      items: [
        {
          duplicateCaseId: 'dup-1',
          status: 'OPEN',
          riskLevel: 'HIGH',
          candidateA: {
            candidateId: 'cand-a',
            fullName: 'Lý Văn Mẫn',
            maskedEmail: 'cn***@tanpony.com',
            maskedPhone: '***9221',
            hasAccount: false,
            status: 'ACTIVE',
            createdAt: '2026-11-25T04:31:00Z',
          },
          candidateB: {
            candidateId: 'cand-b',
            fullName: 'Lý Văn Mẫn',
            maskedEmail: 'r9***@gmeenramy.com',
            maskedPhone: '***0012',
            hasAccount: false,
            status: 'ACTIVE',
            createdAt: '2026-11-25T04:32:00Z',
          },
          jobId: 'job-1',
          jobTitle: 'Kế toán Tổng hợp',
          companyId: 'comp-1',
          companyName: 'HR Connect Demo Company',
          createdAt: '2026-11-25T04:32:10Z',
          updatedAt: '2026-11-25T04:32:10Z',
          concurrencyToken: '11111111-1111-1111-1111-111111111111',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });

    getDuplicateCaseMock.mockResolvedValue({
      duplicateCaseId: 'dup-1',
      status: 'OPEN',
      riskLevel: 'HIGH',
      resolution: null,
      resolutionReason: null,
      candidateA: {
        candidateId: 'cand-a',
        fullName: 'Lý Văn Mẫn',
        maskedEmail: 'cn***@tanpony.com',
        maskedPhone: '***9221',
        hasAccount: false,
        status: 'ACTIVE',
        createdAt: '2026-11-25T04:31:00Z',
      },
      candidateB: {
        candidateId: 'cand-b',
        fullName: 'Lý Văn Mẫn',
        maskedEmail: 'r9***@gmeenramy.com',
        maskedPhone: '***0012',
        hasAccount: false,
        status: 'ACTIVE',
        createdAt: '2026-11-25T04:32:00Z',
      },
      canonicalCandidateId: null,
      job: {
        jobId: 'job-1',
        title: 'Kế toán Tổng hợp',
        companyId: 'comp-1',
        companyName: 'HR Connect Demo Company',
      },
      signals: [
        {
          reasonCode: 'CV_CONTENT_SHA256_AND_NAME_MATCH',
          detectorVersion: 'v1',
          score: 0.98,
          evidence: 'sha256=abc123; keyVersion=v1',
          createdAt: '2026-11-25T04:32:10Z',
        },
      ],
      submissions: [],
      createdAt: '2026-11-25T04:32:10Z',
      updatedAt: '2026-11-25T04:32:10Z',
      concurrencyToken: '11111111-1111-1111-1111-111111111111',
    });

    previewMergeMock.mockResolvedValue({
      duplicateCaseId: 'dup-1',
      recommendedCanonicalCandidateId: 'cand-a',
      sourceCandidateId: 'cand-b',
      recommendationReason: 'Ưu tiên hồ sơ tạo sớm hơn.',
      canMerge: true,
      collisions: [],
      financeBlockers: [],
      concurrencyToken: '11111111-1111-1111-1111-111111111111',
    });

    resolveDuplicateCaseMock.mockResolvedValue({
      duplicateCaseId: 'dup-1',
      status: 'MERGED',
      resolution: 'MERGE',
      canonicalCandidateId: 'cand-a',
      sourceCandidateId: 'cand-b',
      pendingFinalizationSubmissionIds: [],
      finalizationResults: [],
      concurrencyToken: '22222222-2222-2222-2222-222222222222',
      idempotentReplay: false,
    });

    renderPage();
    fireEvent.click(await screen.findByText('Hồ sơ nghi trùng'));
    expect(await screen.findByText('Kế toán Tổng hợp')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Kế toán Tổng hợp'));
    expect(await screen.findByText('Trùng nội dung file CV (SHA-256) và Họ tên')).toBeInTheDocument();
    expect(await screen.findByText('Ưu tiên hồ sơ tạo sớm hơn.')).toBeInTheDocument();

    const reasonInput = screen.getByLabelText(/Lý do xử lý/i);
    fireEvent.change(reasonInput, {
      target: { value: 'Xác nhận trùng SHA-256 CV và họ tên, gộp về hồ sơ gốc.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Hợp nhất về hồ sơ gốc' }));

    await waitFor(() =>
      expect(resolveDuplicateCaseMock).toHaveBeenCalledWith('dup-1', {
        decision: 'MERGE',
        reason: 'Xác nhận trùng SHA-256 CV và họ tên, gộp về hồ sơ gốc.',
        concurrencyToken: '11111111-1111-1111-1111-111111111111',
        idempotencyKey: 'admin-duplicate-merge:dup-1:11111111-1111-1111-1111-111111111111',
      })
    );
  });
});
