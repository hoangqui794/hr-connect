/**
 * @file useJobQueries.ts
 * @description React Query hooks for MF-01. Every mutation invalidates the job caches
 * so lists and details re-read the backend (new status + new concurrencyToken).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi, serviceTypesApi } from '@/services/api/jobsApi';
import type {
  JobCloseReasonCode,
  JobRejectReasonCode,
  JobSearchParams,
  JobStatus,
  JobUpsertInput,
} from '@/types/api/jobs';

export const jobQueryKeys = {
  all: ['mf01-jobs'] as const,
  mine: (status?: JobStatus) => [...jobQueryKeys.all, 'mine', status ?? 'ALL'] as const,
  search: (params: JobSearchParams) => [...jobQueryKeys.all, 'search', params] as const,
  detail: (jobId: string) => [...jobQueryKeys.all, 'detail', jobId] as const,
  review: (status?: string) => [...jobQueryKeys.all, 'review', status ?? 'ALL'] as const,
  serviceTypes: ['mf01-service-types'] as const,
};

export const useMyJobs = (status?: JobStatus) =>
  useQuery({ queryKey: jobQueryKeys.mine(status), queryFn: () => jobsApi.getMine(status) });

export const useJobSearch = (params: JobSearchParams, enabled = true) =>
  useQuery({
    queryKey: jobQueryKeys.search(params),
    queryFn: () => jobsApi.search(params),
    enabled,
    placeholderData: (previous) => previous,
  });

export const useJobDetail = (jobId: string | undefined) =>
  useQuery({
    queryKey: jobQueryKeys.detail(jobId ?? ''),
    queryFn: () => jobsApi.getById(jobId as string),
    enabled: Boolean(jobId),
  });

export const useJobReviewQueue = (status?: string) =>
  useQuery({ queryKey: jobQueryKeys.review(status), queryFn: () => jobsApi.getReviewQueue(status) });

export const useServiceTypes = () =>
  useQuery({
    queryKey: jobQueryKeys.serviceTypes,
    queryFn: () => serviceTypesApi.getActive(),
    staleTime: 10 * 60 * 1000,
  });

/** All write operations, each refreshing every MF-01 cache on success. */
export const useJobMutations = () => {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: jobQueryKeys.all });

  return {
    create: useMutation({ mutationFn: (input: JobUpsertInput) => jobsApi.create(input), onSuccess: refresh }),
    update: useMutation({
      mutationFn: (v: { jobId: string; input: JobUpsertInput; token: string }) =>
        jobsApi.update(v.jobId, v.input, v.token),
      onSuccess: refresh,
    }),
    submit: useMutation({
      mutationFn: (v: { jobId: string; token: string }) => jobsApi.submit(v.jobId, v.token),
      onSuccess: refresh,
    }),
    pause: useMutation({
      mutationFn: (v: { jobId: string; token: string; reasonText?: string }) =>
        jobsApi.pause(v.jobId, v.token, v.reasonText),
      onSuccess: refresh,
    }),
    resume: useMutation({
      mutationFn: (v: { jobId: string; token: string }) => jobsApi.resume(v.jobId, v.token),
      onSuccess: refresh,
    }),
    close: useMutation({
      mutationFn: (v: { jobId: string; token: string; reasonCode: JobCloseReasonCode; reasonText: string }) =>
        jobsApi.close(v.jobId, v.token, v.reasonCode, v.reasonText),
      onSuccess: refresh,
    }),
    approve: useMutation({
      mutationFn: (v: { jobId: string; token: string }) => jobsApi.approve(v.jobId, v.token),
      onSuccess: refresh,
    }),
    reject: useMutation({
      mutationFn: (v: { jobId: string; token: string; reasonCode: JobRejectReasonCode; reasonText: string }) =>
        jobsApi.reject(v.jobId, v.token, v.reasonCode, v.reasonText),
      onSuccess: refresh,
    }),
  };
};
