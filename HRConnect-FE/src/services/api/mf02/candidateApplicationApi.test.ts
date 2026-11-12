import { describe, it, expect, vi, beforeEach } from 'vitest';
import { candidateApplicationsApi, applyApi } from './candidateApplicationApi';
import { apiClient } from '../../apiClient';

vi.mock('../../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('candidateApplicationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('candidateApplicationsApi.list', () => {
    it('calls GET /candidates/applications with cleaned params and returns paged items', async () => {
      const mockData = {
        items: [
          {
            applicationId: 'app-1',
            jobId: 'job-1',
            jobTitle: 'Frontend Engineer',
            companyName: 'HR Connect',
            cvId: 'cv-1',
            cvTitle: 'CV 2026',
            displayGroup: 'SUBMITTED',
            displayLabel: 'Đã nộp',
            aiStatus: null,
            submissionSource: 'CANDIDATE',
            appliedAt: '2026-10-10T10:00:00Z',
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockData },
      } as any);

      const res = await candidateApplicationsApi.list({ page: 1, pageSize: 10 });
      expect(apiClient.get).toHaveBeenCalledWith('/candidates/applications', {
        params: { page: 1, pageSize: 10 },
      });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].applicationId).toBe('app-1');
    });
  });

  describe('candidateApplicationsApi.detail', () => {
    it('calls GET /candidates/applications/:id and returns application detail', async () => {
      const mockDetail = {
        applicationId: 'app-1',
        candidateId: 'cand-1',
        jobId: 'job-1',
        jobTitle: 'Frontend Engineer',
        companyId: 'comp-1',
        companyName: 'HR Connect',
        cvId: 'cv-1',
        cvTitle: 'CV 2026',
        cvFileName: 'cv.pdf',
        displayGroup: 'INTERVIEW',
        displayLabel: 'Đang phỏng vấn',
        appliedAt: '2026-10-10T10:00:00Z',
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockDetail,
      } as any);

      const res = await candidateApplicationsApi.detail('app-1');
      expect(apiClient.get).toHaveBeenCalledWith('/candidates/applications/app-1');
      expect(res.applicationId).toBe('app-1');
    });
  });

  describe('applyApi.apply', () => {
    it('calls POST /jobs/:jobId/apply with cvId source', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Ứng tuyển thành công',
          data: { applicationId: 'app-1', jobId: 'job-1', status: 'SUBMITTED' },
        },
      } as any);

      const res = await applyApi.apply('job-1', { cvId: 'cv-1' });
      expect(apiClient.post).toHaveBeenCalledWith('/jobs/job-1/apply', expect.any(FormData));
      expect(res.success).toBe(true);
    });

    it('calls POST /jobs/:jobId/apply with file source', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Ứng tuyển thành công',
          data: { applicationId: 'app-2', jobId: 'job-1', status: 'SUBMITTED' },
        },
      } as any);

      const file = new File(['dummy'], 'resume.pdf', { type: 'application/pdf' });
      const res = await applyApi.apply('job-1', { file });
      expect(apiClient.post).toHaveBeenCalledWith('/jobs/job-1/apply', expect.any(FormData));
      expect(res.data.applicationId).toBe('app-2');
    });
  });

  describe('applyApi.reapply', () => {
    it('calls dedicated reapply endpoint when previousApplicationId is supplied', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Nộp lại thành công',
          data: { applicationId: 'app-reapplied', jobId: 'job-1', status: 'SUBMITTED' },
        },
      } as any);

      const res = await applyApi.reapply('job-1', { cvId: 'cv-2' }, 'app-prev');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/candidates/applications/app-prev/reapply',
        expect.any(FormData)
      );
      expect(res.data.applicationId).toBe('app-reapplied');
    });

    it('falls back to standard apply endpoint when dedicated reapply endpoint returns 404', async () => {
      // 1st call fails with 404
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: { status: 404 },
      });
      // 2nd call to /jobs/:jobId/apply succeeds
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Ứng tuyển thành công qua fallback',
          data: { applicationId: 'app-fallback', jobId: 'job-1', status: 'SUBMITTED' },
        },
      } as any);

      const res = await applyApi.reapply('job-1', { cvId: 'cv-2' }, 'app-prev');
      expect(apiClient.post).toHaveBeenNthCalledWith(
        1,
        '/candidates/applications/app-prev/reapply',
        expect.any(FormData)
      );
      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        '/jobs/job-1/apply',
        expect.any(FormData)
      );
      expect(res.data.applicationId).toBe('app-fallback');
    });

    it('returns graceful fallback when dedicated reapply returns 400 duplicate error', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: {
          status: 400,
          data: { message: 'Bạn đã ứng tuyển công việc này rồi' },
        },
      });

      const res = await applyApi.reapply('job-1', { cvId: 'cv-2' }, 'app-prev');
      expect(res.success).toBe(true);
      expect(res.data.applicationId).toBe('app-prev');
      expect(res.data.status).toBe('SUBMITTED');
    });

    it('calls standard apply when previousApplicationId is omitted', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Nộp lại thành công',
          data: { applicationId: 'app-standard', jobId: 'job-1', status: 'SUBMITTED' },
        },
      } as any);

      const res = await applyApi.reapply('job-1', { cvId: 'cv-2' });
      expect(apiClient.post).toHaveBeenCalledWith('/jobs/job-1/apply', expect.any(FormData));
      expect(res.data.applicationId).toBe('app-standard');
    });

    it('returns graceful fallback when standard apply returns 409 already applied error', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: {
          status: 409,
          data: { message: 'Candidate already applied' },
        },
      });

      const res = await applyApi.reapply('job-1', { cvId: 'cv-2' });
      expect(res.success).toBe(true);
      expect(res.data.jobId).toBe('job-1');
      expect(res.data.status).toBe('SUBMITTED');
    });

    it('throws unexpected network error', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      await expect(applyApi.reapply('job-1', { cvId: 'cv-2' })).rejects.toThrow('Network error');
    });
  });
});

