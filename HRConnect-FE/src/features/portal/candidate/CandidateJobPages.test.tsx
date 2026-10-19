import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateJobsPage } from './CandidateJobPages';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';

vi.mock('@/services/api/candidateJobMatchApi', () => ({
  candidateJobMatchApi: {
    getJobMatches: vi.fn(),
  },
}));

vi.mock('@/features/jobs-mf01/JobDiscoveryPage', () => ({
  JobDiscoveryPage: () => <div data-testid="job-discovery-content">Khung tìm kiếm tất cả việc làm</div>,
}));

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

describe('CandidateJobsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    vi.mocked(candidateJobMatchApi.getJobMatches).mockResolvedValue([
      {
        candidateJobMatchId: 'm-1',
        jobId: 'j-1',
        jobTitle: 'Senior Fullstack Developer',
        companyName: 'Công ty Cổ phần VNG',
        location: 'TP. Hồ Chí Minh',
        matchScore: 88,
        generatedAt: '2026-10-19T10:00:00Z',
        expiresAt: '2026-10-26T10:00:00Z',
      },
    ]);
  });

  const renderPage = (initialEntry = '/candidate/jobs') =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/candidate/jobs" element={<CandidateJobsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders tabs for Việc phù hợp and Tất cả việc làm', async () => {
    renderPage();

    expect(screen.getByText('Tìm việc làm & Cơ hội nghề nghiệp')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Việc phù hợp với bạn/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tất cả việc làm/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Senior Fullstack Developer')).toBeInTheDocument();
      expect(screen.getByText('Phù hợp 88%')).toBeInTheDocument();
    });
  });

  it('switches to Tất cả việc làm tab when clicked', async () => {
    renderPage('/candidate/jobs?tab=all');

    await waitFor(() => {
      expect(screen.getByTestId('job-discovery-content')).toBeInTheDocument();
    });
  });
});
