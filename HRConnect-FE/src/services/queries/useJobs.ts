/**
 * @file useJobs.ts
 * @description React Query hooks for Job Management and Review (MF-01).
 * Integrates real API endpoints with @tanstack/react-query cache invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobService } from '@/services/jobService';
import { serviceTypeService } from '@/services/serviceTypeService';
import type {
  CreateJobCommand,
  UpdateJobCommand,
  GetServiceTypesParams,
} from '@/types/mf01';
import { getAllJobs, saveJobToAllJobs } from '@/services/localStorageService';
import { Job, JobStatus } from '@/types/job';

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  mine: (status?: string) => [...jobKeys.all, 'mine', status || 'ALL'] as const,
  detail: (id: string) => [...jobKeys.all, 'detail', id] as const,
  reviewQueue: () => [...jobKeys.all, 'review-queue'] as const,
  serviceTypes: (params?: GetServiceTypesParams) => ['service-types', params] as const,
};

// ─── Query Hooks ─────────────────────────────────────────────────────────────

/**
 * Hook to fetch service types from GET /api/v1/service-types
 */
export function useServiceTypes(params?: GetServiceTypesParams) {
  return useQuery({
    queryKey: jobKeys.serviceTypes(params),
    queryFn: () => serviceTypeService.getServiceTypes(params),
    staleTime: 60000,
  });
}

/**
 * Hook for Client's job list: GET /api/v1/jobs/mine?status={status}
 */
export function useMyJobs(status?: string) {
  return useQuery({
    queryKey: jobKeys.mine(status),
    queryFn: () => jobService.getMyJobs(status),
    staleTime: 10000,
  });
}

/**
 * Hook for Job Detail: GET /api/v1/jobs/{jobId}
 */
export function useJobDetail(jobId: string) {
  return useQuery({
    queryKey: jobKeys.detail(jobId),
    queryFn: () => jobService.getJobDetail(jobId),
    enabled: !!jobId,
  });
}

/**
 * Hook for Internal HR review queue: GET /api/v1/internal/jobs/review
 */
export function useJobsForReview() {
  return useQuery({
    queryKey: jobKeys.reviewQueue(),
    queryFn: () => jobService.getJobsForReview(),
    staleTime: 5000,
  });
}

// ─── Mutation Hooks ──────────────────────────────────────────────────────────

/**
 * Hook for POST /api/v1/jobs (Lưu nháp)
 */
export function useCreateJobDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateJobCommand) => jobService.createJobDraft(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

/**
 * Hook for PUT /api/v1/jobs/{jobId} (Cập nhật Job)
 */
export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, command }: { jobId: string; command: UpdateJobCommand }) =>
      jobService.updateJob(jobId, command),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook for POST /api/v1/jobs/{jobId}/submit (Gửi duyệt)
 */
export function useSubmitJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => jobService.submitJob(jobId),
    onSuccess: (_, jobId) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

/**
 * Hook for POST /api/v1/jobs/{jobId}/pause (Tạm dừng)
 */
export function usePauseJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) =>
      jobService.pauseJob(jobId, reason),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook for POST /api/v1/jobs/{jobId}/resume (Tiếp tục)
 */
export function useResumeJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => jobService.resumeJob(jobId),
    onSuccess: (_, jobId) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

/**
 * Hook for POST /api/v1/jobs/{jobId}/close (Đóng Job)
 */
export function useCloseJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) =>
      jobService.closeJob(jobId, reason),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) });
    },
  });
}

/**
 * Hook for POST /api/v1/internal/jobs/{jobId}/approve (Internal HR Phê duyệt)
 */
export function useApproveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => jobService.approveJob(jobId),
    onSuccess: (_, jobId) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
      void queryClient.invalidateQueries({ queryKey: jobKeys.reviewQueue() });
    },
  });
}

/**
 * Hook for POST /api/v1/internal/jobs/{jobId}/reject (Internal HR Từ chối)
 */
export function useRejectJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) =>
      jobService.rejectJob(jobId, reason),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.jobId) });
      void queryClient.invalidateQueries({ queryKey: jobKeys.reviewQueue() });
    },
  });
}

// ─── Legacy / Backward-Compatible Hooks ─────────────────────────────────────

export function useJobs() {
  return useQuery({
    queryKey: jobKeys.lists(),
    queryFn: async () => {
      return getAllJobs();
    },
    staleTime: 5000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () => {
      const jobs = getAllJobs();
      const job = jobs.find((j) => j.id === id);
      if (!job) throw new Error(`Job ${id} not found`);
      return job;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      newJob: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'applicationCount' | 'shortlistedCount'>
    ) => {
      const job: Job = {
        ...newJob,
        id: `job-${Date.now()}`,
        status: newJob.status || JobStatus.PENDING,
        applicationCount: 0,
        shortlistedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveJobToAllJobs(job);
      return job;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}
