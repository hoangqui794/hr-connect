import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CandidateJobMatchesSection, formatEmploymentType, formatMatchScore, getMatchScoreConfig } from './CandidateJobMatchesSection';
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
    dismissJobMatch: vi.fn(),
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
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <CandidateJobMatchesSection {...props} />
          </QueryClientProvider>
        </AntApp>
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
      expect(getMatchScoreConfig(70).label).toBe('Khá phù hợp');
      expect(getMatchScoreConfig(50).label).toBe('Có tiềm năng');
    });

    it('shows employment types in plain Vietnamese', () => {
      expect(formatEmploymentType('FULL_TIME')).toBe('Toàn thời gian');
      expect(formatEmploymentType('freelance')).toBe('Làm việc tự do');
      expect(formatEmploymentType(null)).toBeNull();
    });
  });

  describe('rendering matches', () => {
    it('renders list of job matches with highlighted score badges', async () => {
      getMatchesMock.mockResolvedValueOnce({
        items: [{
          candidateJobMatchId: 'match-1',
          jobId: 'job-101',
          jobTitle: 'Senior React Engineer',
          companyName: 'Công ty Công nghệ Alpha',
          location: 'Hà Nội',
          employmentType: 'FULL_TIME',
          matchScore: 83,
          generatedAt: '2026-10-19T10:00:00Z',
          expiresAt: '2026-10-26T10:00:00Z',
          matchingReasons: ['Kỹ năng React phù hợp'],
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
        }],
        meta: { hasPrimaryCv: true, lastGeneratedAt: '2026-10-19T10:00:00Z', scoringVersion: 'HYBRID_V1' },
      });

      renderSection();

      await waitFor(() => {
        expect(screen.getByText('Senior React Engineer')).toBeInTheDocument();
        expect(screen.getByText('Golang Backend Developer')).toBeInTheDocument();
      });

      expect(screen.getByText('Công ty Công nghệ Alpha')).toBeInTheDocument();
      expect(screen.getByText(/Rất phù hợp · 83%/)).toBeInTheDocument();
      expect(screen.getByText(/Khá phù hợp · 72%/)).toBeInTheDocument();
      expect(screen.getByText('Kỹ năng React phù hợp')).toBeInTheDocument();
      expect(screen.getByText('Toàn thời gian')).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole('button', { name: /Xem việc làm/i })[0]);
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/jobs/job-101');
    });
  });

  describe('empty state', () => {
    it('guides the Candidate to select a primary CV when one is missing', async () => {
      getMatchesMock.mockResolvedValueOnce({
        items: [],
        meta: { hasPrimaryCv: false, lastGeneratedAt: null, scoringVersion: 'HYBRID_V1' },
      });

      renderSection();

      await waitFor(() => {
        expect(
          screen.getByText('Chọn CV chính để nhận gợi ý')
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Hồ sơ không cần bật công khai/)
      ).toBeInTheDocument();

      // Action buttons
      const profileBtn = screen.getByRole('button', { name: /Cập nhật hồ sơ/i });
      const cvsBtn = screen.getByRole('button', { name: /Đến kho CV/i });

      expect(profileBtn).toBeInTheDocument();
      expect(cvsBtn).toBeInTheDocument();

      // Click profile button
      fireEvent.click(profileBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/profile');

      // Click CVs button
      fireEvent.click(cvsBtn);
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/cvs');
    });

    it('offers job discovery when the primary CV has no qualifying matches yet', async () => {
      getMatchesMock.mockResolvedValueOnce({
        items: [],
        meta: { hasPrimaryCv: true, lastGeneratedAt: null, scoringVersion: 'HYBRID_V1' },
      });

      renderSection();

      expect(await screen.findByText('Chúng tôi đang tìm cơ hội phù hợp cho bạn')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Xem tất cả việc làm/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/candidate/jobs?tab=all');
    });
  });
});
