import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { message } from 'antd';
import { useSavedJobs, SAVED_JOBS_QUERY_KEY } from './useSavedJobs';
import { useAuthStore } from '@/stores/authStore';
import { candidateSavedJobApi } from '@/services/api/candidateSavedJobApi';
import { UserRole } from '@/types/roles';

vi.mock('@/services/api/candidateSavedJobApi', () => ({
  candidateSavedJobApi: {
    getSavedJobs: vi.fn(),
    saveJob: vi.fn(),
    unsaveJob: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
};

describe('useSavedJobs hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, 'info').mockImplementation((() => undefined) as any);
    vi.spyOn(message, 'success').mockImplementation((() => undefined) as any);
    vi.spyOn(message, 'error').mockImplementation((() => undefined) as any);
    useAuthStore.setState({
      user: null,
      role: undefined,
      isAuthenticated: false,
    });
  });

  it('returns empty savedJobIds when user is not logged in', () => {
    const { result } = renderHook(() => useSavedJobs(), { wrapper: createWrapper() });

    expect(result.current.savedJobIds).toEqual([]);
    expect(result.current.savedJobsCount).toBe(0);
    expect(result.current.isSaved('job-123')).toBe(false);
  });

  it('redirects to login when non-candidate attempts to save a job', async () => {
    const { result } = renderHook(() => useSavedJobs(), { wrapper: createWrapper() });

    let saved = true;
    await act(async () => {
      saved = await result.current.toggleSaveJob('job-123');
    });

    expect(saved).toBe(false);
    expect(candidateSavedJobApi.saveJob).not.toHaveBeenCalled();
  });

  it('loads saved jobs from API for authenticated candidate', async () => {
    useAuthStore.setState({
      user: { id: 'cand-1', name: 'Ứng viên Test', email: 'candidate@test.com' } as any,
      role: UserRole.CANDIDATE,
      isAuthenticated: true,
    });

    const mockSavedJobs = {
      items: [
        {
          savedJobId: 'saved-1',
          savedAt: '2026-10-15T00:00:00Z',
          job: {
            jobId: 'job-101',
            title: 'Senior React Developer',
            companyId: 'comp-1',
            companyName: 'FPT Software',
            location: 'Đà Nẵng',
            employmentType: 'FULL_TIME',
            salaryMin: 30000000,
            salaryMax: 50000000,
            currencyCode: 'VND',
            status: 'ACTIVE',
            minExperienceYears: 3,
            maxExperienceYears: 5,
            postedAt: '2026-10-12T00:00:00Z',
            isAcceptingApplications: true,
          },
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    };

    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValueOnce(mockSavedJobs as any);

    const { result } = renderHook(() => useSavedJobs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.savedJobIds).toContain('job-101');
    });

    expect(result.current.isSaved('job-101')).toBe(true);
    expect(result.current.isSaved('job-999')).toBe(false);
    expect(result.current.savedJobsCount).toBe(1);
    expect(result.current.savedJobs[0].title).toBe('Senior React Developer');
  });

  it('toggles save status optimistically and calls saveJob when saving a new job', async () => {
    useAuthStore.setState({
      user: { id: 'cand-1', name: 'Ứng viên Test', email: 'candidate@test.com' } as any,
      role: UserRole.CANDIDATE,
      isAuthenticated: true,
    });

    vi.mocked(candidateSavedJobApi.getSavedJobs).mockResolvedValue({
      items: [
        {
          savedJobId: 'new-saved-id',
          savedAt: '2026-10-15T00:00:00Z',
          job: {
            jobId: 'job-new-1',
            title: 'New Job',
            companyId: 'comp-1',
            companyName: 'Company 1',
            location: 'Hà Nội',
            employmentType: 'FULL_TIME',
            salaryMin: 20000000,
            salaryMax: 30000000,
            currencyCode: 'VND',
            status: 'ACTIVE',
            minExperienceYears: 1,
            maxExperienceYears: 2,
            postedAt: '2026-10-10T00:00:00Z',
            isAcceptingApplications: true,
          },
        },
      ],
      page: 1,
      pageSize: 100,
      totalCount: 1,
      totalPages: 1,
    } as any);

    vi.mocked(candidateSavedJobApi.saveJob).mockResolvedValueOnce({
      success: true,
      message: 'Đã lưu việc làm thành công.',
      savedJobId: 'new-saved-id',
    });

    const { result } = renderHook(() => useSavedJobs(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.toggleSaveJob('job-new-1');
    });

    expect(candidateSavedJobApi.saveJob).toHaveBeenCalledWith('job-new-1');
    expect(result.current.isSaved('job-new-1')).toBe(true);
  });

  it('toggles save status optimistically and calls unsaveJob when job is already saved', async () => {
    useAuthStore.setState({
      user: { id: 'cand-1', name: 'Ứng viên Test', email: 'candidate@test.com' } as any,
      role: UserRole.CANDIDATE,
      isAuthenticated: true,
    });

    vi.mocked(candidateSavedJobApi.getSavedJobs)
      .mockResolvedValueOnce({
        items: [
          {
            savedJobId: 'saved-1',
            savedAt: '2026-10-15T00:00:00Z',
            job: {
              jobId: 'job-existing',
              title: 'Fullstack Engineer',
              companyId: 'comp-2',
              companyName: 'VNG',
              location: 'Hồ Chí Minh',
              employmentType: 'FULL_TIME',
              salaryMin: 25000000,
              salaryMax: 45000000,
              currencyCode: 'VND',
              status: 'ACTIVE',
              minExperienceYears: 2,
              maxExperienceYears: 4,
              postedAt: '2026-10-10T00:00:00Z',
              isAcceptingApplications: true,
            },
          },
        ],
        page: 1,
        pageSize: 100,
        totalCount: 1,
        totalPages: 1,
      } as any)
      .mockResolvedValue({
        items: [],
        page: 1,
        pageSize: 100,
        totalCount: 0,
        totalPages: 0,
      } as any);

    vi.mocked(candidateSavedJobApi.unsaveJob).mockResolvedValueOnce({
      success: true,
      message: 'Đã hủy lưu việc làm thành công.',
    });

    const { result } = renderHook(() => useSavedJobs(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSaved('job-existing')).toBe(true);
    });

    await act(async () => {
      await result.current.toggleSaveJob('job-existing');
    });

    expect(candidateSavedJobApi.unsaveJob).toHaveBeenCalledWith('job-existing');
    expect(result.current.isSaved('job-existing')).toBe(false);
  });
});
