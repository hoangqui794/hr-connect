import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminIdentityClaimsPage } from './AdminIdentityClaimsPage';
import { adminIdentityClaimApi } from '@/services/api/mf02/adminIdentityClaimApi';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/mf02/adminIdentityClaimApi', () => ({
  adminIdentityClaimApi: { list: vi.fn() },
}));

const listMock = vi.mocked(adminIdentityClaimApi.list);

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
});
