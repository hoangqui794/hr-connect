import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MOCK_JOBS } from '@/services/mockData';
import { Job } from '@/types/job';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  detail: (id: string) => [...jobKeys.all, 'detail', id] as const,
};

export function useJobs() {
  return useQuery({
    queryKey: jobKeys.lists(),
    queryFn: async () => {
      await delay(600);
      return MOCK_JOBS;
    },
    staleTime: 30000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () => {
      await delay(300);
      const job = MOCK_JOBS.find((j) => j.id === id);
      if (!job) throw new Error(`Job ${id} not found`);
      return job;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newJob: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'applicationCount' | 'shortlistedCount'>) => {
      await delay(800);
      const job: Job = {
        ...newJob,
        id: `job-${Date.now()}`,
        applicationCount: 0,
        shortlistedCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      MOCK_JOBS.push(job);
      return job;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}
