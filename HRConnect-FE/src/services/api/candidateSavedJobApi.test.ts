import { describe, it, expect, vi, beforeEach } from 'vitest';
import { candidateSavedJobApi } from './candidateSavedJobApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('candidateSavedJobApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSavedJobs', () => {
    it('calls GET /candidates/me/saved-jobs with cleaned params and returns data', async () => {
      const mockResult = {
        items: [
          {
            savedJobId: 'saved-1',
            savedAt: '2026-10-15T00:00:00Z',
            job: {
              jobId: 'job-1',
              title: 'Frontend Engineer',
              companyId: 'comp-1',
              companyName: 'Acme Corp',
              location: 'Hà Nội',
              employmentType: 'FULL_TIME',
              salaryMin: 20000000,
              salaryMax: 35000000,
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
        pageSize: 10,
        totalCount: 1,
        totalPages: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockResult,
      } as any);

      const res = await candidateSavedJobApi.getSavedJobs({ page: 1, pageSize: 10 });

      expect(apiClient.get).toHaveBeenCalledWith('/candidates/me/saved-jobs', {
        params: { page: 1, pageSize: 10 },
      });
      expect(res).toEqual(mockResult);
    });

    it('unwraps response when backend wraps in { success, data }', async () => {
      const mockResult = {
        items: [],
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 0,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockResult },
      } as any);

      const res = await candidateSavedJobApi.getSavedJobs();

      expect(apiClient.get).toHaveBeenCalledWith('/candidates/me/saved-jobs', {
        params: {},
      });
      expect(res).toEqual(mockResult);
    });

    it('falls back to /candidate/saved-jobs if primary endpoint returns 404', async () => {
      const mockResult = {
        items: [],
        page: 1,
        pageSize: 10,
        totalCount: 0,
        totalPages: 0,
      };

      vi.mocked(apiClient.get)
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({ data: mockResult } as any);

      const res = await candidateSavedJobApi.getSavedJobs({ page: 2 });

      expect(apiClient.get).toHaveBeenNthCalledWith(1, '/candidates/me/saved-jobs', {
        params: { page: 2 },
      });
      expect(apiClient.get).toHaveBeenNthCalledWith(2, '/candidate/saved-jobs', {
        params: { page: 2 },
      });
      expect(res).toEqual(mockResult);
    });
  });

  describe('saveJob', () => {
    it('calls POST /candidates/me/saved-jobs/{jobId}', async () => {
      const mockResponse = {
        success: true,
        message: 'Đã lưu việc làm thành công.',
        savedJobId: 'saved-123',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: mockResponse,
      } as any);

      const res = await candidateSavedJobApi.saveJob('job-123');

      expect(apiClient.post).toHaveBeenCalledWith('/candidates/me/saved-jobs/job-123');
      expect(res).toEqual(mockResponse);
    });

    it('falls back to POST /candidate/saved-jobs/{jobId} on 404', async () => {
      const mockResponse = {
        success: true,
        message: 'Đã lưu việc làm thành công.',
      };

      vi.mocked(apiClient.post)
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await candidateSavedJobApi.saveJob('job-abc');

      expect(apiClient.post).toHaveBeenNthCalledWith(1, '/candidates/me/saved-jobs/job-abc');
      expect(apiClient.post).toHaveBeenNthCalledWith(2, '/candidate/saved-jobs/job-abc');
      expect(res).toEqual(mockResponse);
    });
  });

  describe('unsaveJob', () => {
    it('calls DELETE /candidates/me/saved-jobs/{jobId}', async () => {
      const mockResponse = {
        success: true,
        message: 'Đã hủy lưu việc làm thành công.',
      };

      vi.mocked(apiClient.delete).mockResolvedValueOnce({
        data: mockResponse,
      } as any);

      const res = await candidateSavedJobApi.unsaveJob('job-456');

      expect(apiClient.delete).toHaveBeenCalledWith('/candidates/me/saved-jobs/job-456');
      expect(res).toEqual(mockResponse);
    });

    it('falls back to DELETE /candidate/saved-jobs/{jobId} on 404', async () => {
      const mockResponse = {
        success: true,
        message: 'Đã hủy lưu việc làm thành công.',
      };

      vi.mocked(apiClient.delete)
        .mockRejectedValueOnce({ response: { status: 404 } })
        .mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await candidateSavedJobApi.unsaveJob('job-xyz');

      expect(apiClient.delete).toHaveBeenNthCalledWith(1, '/candidates/me/saved-jobs/job-xyz');
      expect(apiClient.delete).toHaveBeenNthCalledWith(2, '/candidate/saved-jobs/job-xyz');
      expect(res).toEqual(mockResponse);
    });
  });
});
