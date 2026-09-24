import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Job, JobStatus } from '@/types/job';
import { getAllJobs, saveJobToAllJobs } from '@/services/localStorageService';

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
      await delay(200);
      return getAllJobs();
    },
    staleTime: 5000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: async () => {
      await delay(150);
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
    mutationFn: async (newJob: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'applicationCount' | 'shortlistedCount'>) => {
      await delay(300);
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
      void queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

