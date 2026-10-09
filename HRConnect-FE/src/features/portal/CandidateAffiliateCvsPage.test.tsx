import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateAffiliateCvsPage } from './CandidateAffiliateCvsPage';
import { candidateAffiliateCvApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/mf02Api', () => ({
  candidateAffiliateCvApi: { list: vi.fn() },
}));

describe('CandidateAffiliateCvsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'candidate-user',
        name: 'Candidate',
        email: 'candidate@example.com',
        role: UserRole.CANDIDATE,
        roles: [UserRole.CANDIDATE],
        permissions: ['cv.view_own'],
      },
    });
    vi.mocked(candidateAffiliateCvApi.list).mockResolvedValue({
      items: [{
        cvId: 'cv-1',
        title: 'CV Backend',
        fileName: 'backend.pdf',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048,
        documentStatus: 'ACTIVE',
        affiliateReuseStatus: 'ALLOWED',
        reuseConcurrencyToken: 'token-1',
        affiliateUserId: 'affiliate-user',
        affiliateDisplayName: 'Affiliate Minh',
        submissionCount: 2,
        pendingConsentCount: 1,
        acceptedSubmissionCount: 1,
        lastSubmittedAt: '2026-10-08T00:00:00Z',
        createdAt: '2026-10-01T00:00:00Z',
      }],
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('shows owned affiliate CV metadata without requesting a download URL', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><CandidateAffiliateCvsPage /></MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('CV Backend')).toBeInTheDocument();
    expect(screen.getByText('Affiliate Minh')).toBeInTheDocument();
    expect(screen.getByText('Cho phép dùng lại')).toBeInTheDocument();
    expect(screen.getByText('1 yêu cầu đang chờ bạn xác nhận')).toBeInTheDocument();
    expect(candidateAffiliateCvApi.list).toHaveBeenCalledWith(1, 10);
  });
});
