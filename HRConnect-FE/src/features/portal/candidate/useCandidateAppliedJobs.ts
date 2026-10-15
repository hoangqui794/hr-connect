import { useQuery } from '@tanstack/react-query';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { CandidateApplication } from '@/types/api/mf02';
import { candidateKeys } from '../CandidatePages';

export const useCandidateAppliedJobs = () => {
  const role = useAuthStore((s) => s.role);
  const isCandidate = role === UserRole.CANDIDATE;

  const query = useQuery({
    queryKey: [...candidateKeys.applications, 'applied-summary'],
    queryFn: async () => {
      const res = await candidateApplicationsApi.list({ page: 1, pageSize: 100 });
      const map = new Map<string, CandidateApplication>();
      (res.items ?? []).forEach((app) => {
        if (app.jobId) {
          map.set(app.jobId, app);
        }
      });
      return map;
    },
    enabled: isCandidate,
    staleTime: 30_000,
  });

  return {
    appliedMap: query.data ?? new Map<string, CandidateApplication>(),
    isApplied: (jobId?: string) => Boolean(jobId && query.data?.has(jobId)),
    getApplication: (jobId?: string) => (jobId ? query.data?.get(jobId) : undefined),
    isLoading: query.isLoading,
  };
};
