import { useQuery } from '@tanstack/react-query';
import { candidateApplicationsApi } from '@/services/api/mf02Api';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types/roles';
import type { CandidateApplication } from '@/types/api/mf02';
import { candidateKeys } from './candidateKeys';

const isApplicationWithdrawn = (app?: CandidateApplication): boolean => {
  if (!app) return false;
  return app.displayGroup === 'WITHDRAWN' || app.status === 'WITHDRAWN';
};

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
          // If multiple applications exist for the same job, prioritize active over WITHDRAWN
          const existing = map.get(app.jobId);
          if (!existing) {
            map.set(app.jobId, app);
          } else if (isApplicationWithdrawn(existing) && !isApplicationWithdrawn(app)) {
            map.set(app.jobId, app);
          }
        }
      });
      return map;
    },
    enabled: isCandidate,
    staleTime: 30_000,
  });

  const getApplication = (jobId?: string) => (jobId ? query.data?.get(jobId) : undefined);

  return {
    appliedMap: query.data ?? new Map<string, CandidateApplication>(),
    // isApplied returns true only if the candidate has an active (non-withdrawn) application
    isApplied: (jobId?: string) => {
      const app = getApplication(jobId);
      return Boolean(app && !isApplicationWithdrawn(app));
    },
    // isWithdrawn returns true if the candidate's application was withdrawn
    isWithdrawn: (jobId?: string) => {
      const app = getApplication(jobId);
      return Boolean(app && isApplicationWithdrawn(app));
    },
    hasEverApplied: (jobId?: string) => Boolean(jobId && query.data?.has(jobId)),
    getApplication,
    isLoading: query.isLoading,
  };
};
