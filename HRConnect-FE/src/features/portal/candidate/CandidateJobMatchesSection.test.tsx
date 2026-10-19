import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateJobMatchesSection, formatMatchScore, getMatchScoreConfig } from './CandidateJobMatchesSection';
import { candidateJobMatchApi } from '@/services/api/candidateJobMatchApi';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/api/candidateJobMatchApi', () => ({
  candidateJobMatchApi: {
    getJobMatches: vi.fn(),
  },
}));

const getMatchesMock = vi.mocked(candidateJobMatchApi.getJobMatches);

describe('CandidateJobMatchesSection', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  const renderSection = (props = {}) =>
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <CandidateJobMatchesSection {...props} />
        </QueryClientProvider>
      </MemoryRouter>
    );

  describe('helper functions', () => {
    it('formats score correctly for float and integer', () => {
      expect(formatMatchScore(0.83)).toBe(83);
      expect(formatMatchScore(83)).toBe(83);
      expect(formatMatchScore(1)).toBe(100);
      expect(formatMatchScore(0)).toBe(0);
    });

    it('returns score config based on threshold', () => {
      expect(getMatchScoreConfig(85).label).toBe('Rất phù hợp');
      expect(getMatchScoreConfig(70).label).toBe('Phù hợp tốt');
      expect(getMatchScoreConfig(50).label).toBe('Tiềm năng');
    });
  });

  describe('rendering matches', () => {
    it('renders list of job matches with highlighted score badges', async () => {
      getMatchesMock.mockResolvedValueOnce([
        {
          candidateJobMatchId: 'match-1',
          jobId: 'job-101',
          jobTitle: 'Senior React Engineer',
          companyName: 'Công ty Công nghệ Alpha',
          location: 'Hà Nội',
          matchScore: 83,
          generatedAt: '2026-10-19T10:00:00Z',
          expiresAt: '2026-10-26T10:00:00Z',
        },
        {
          candidateJobMatchId: 'match-2',
          jobId: 'job-102',
          jobTitle: 'Golang Backend Developer',
          companyName: 'Tập đoàn Beta',
          location: 'TP. Hồ Chí Minh',
          matchScore: 72,
          generatedAt: '2026-10-19T10:00:00Z',
          expiresAt: '2026-10-26T10:00:00Z',
        },
      ]);

      renderSection();

      await waitFor(() => {
        expect(screen.getByText('Senior React Engineer')).toBeInTheDocument();
        expect(screen.getByText('Golang Backend Developer')).toBeInTheDocument();
      });

      expect(screen.getByText('Công ty Công nghệ Alpha')).toBeInTheDocument();
      expect(screen.getByText('Phù hợp 83%')).toBeInTheDocument();
      expect(screen.getByText('Phù hợp 72%')).toBeInTheDocument();

      // Click on card navigates to job detail
      fireEvent.click(screen.getByText('Senior React Engineer'));
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/jobs/job-101');
    });
  });

  describe('empty state', () => {
    it('displays custom empty state with profile and CV direct actions when list is empty', async () => {
      getMatchesMock.mockResolvedValueOnce([]);

      renderSection();

      await waitFor(() => {
        expect(
          screen.getByText('Chưa có việc làm phù hợp được gợi ý')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Bật hồ sơ công khai và đặt CV chính/)
      ).toBeInTheDocument();

      // Action buttons
      const profileBtn = screen.getByRole('button', { name: /Hồ sơ cá nhân/i });
      const cvsBtn = screen.getByRole('button', { name: /Kho CV & Đặt CV chính/i });

      expect(profileBtn).toBeInTheDocument();
      expect(cvsBtn).toBeInTheDocument();

      // Click profile button
      fireEvent.click(profileBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/profile');

      // Click CVs button
      fireEvent.click(cvsBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/cvs');
    });
  });
});
