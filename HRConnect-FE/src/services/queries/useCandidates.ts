import { useQuery } from '@tanstack/react-query';
import { MOCK_CANDIDATES, MOCK_SCREENING_RESULTS, generateLargeCandidateSet, checkDuplicate } from '@/services/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const candidateKeys = {
  all: ['candidates'] as const,
  lists: () => [...candidateKeys.all, 'list'] as const,
  large: (count: number) => [...candidateKeys.all, 'large', count] as const,
  detail: (id: string) => [...candidateKeys.all, 'detail', id] as const,
  screening: (candidateId: string, jobId: string) => [...candidateKeys.all, 'screening', candidateId, jobId] as const,
  duplicate: (email: string, phone: string, jobId: string) => [...candidateKeys.all, 'duplicate', email, phone, jobId] as const,
};

export function useCandidates() {
  return useQuery({
    queryKey: candidateKeys.lists(),
    queryFn: async () => {
      await delay(500);
      return MOCK_CANDIDATES;
    },
    staleTime: 30000,
  });
}

export function useLargeCandidateSet(count = 50000) {
  return useQuery({
    queryKey: candidateKeys.large(count),
    queryFn: async () => {
      await delay(800);
      return [...MOCK_CANDIDATES, ...generateLargeCandidateSet(count - MOCK_CANDIDATES.length)];
    },
    staleTime: Infinity,
  });
}

export function useScreeningResult(candidateId: string, jobId: string) {
  return useQuery({
    queryKey: candidateKeys.screening(candidateId, jobId),
    queryFn: async () => {
      await delay(1200); // Simulate AI processing
      const result = MOCK_SCREENING_RESULTS.find(
        (r) => r.candidateId === candidateId && r.jobId === jobId
      );
      return result ?? null;
    },
    enabled: !!candidateId && !!jobId,
  });
}

export function useDuplicateCheck(email: string, phone: string, jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: candidateKeys.duplicate(email, phone, jobId),
    queryFn: async () => {
      await delay(500); // Simulate network check
      return checkDuplicate(email, phone, jobId);
    },
    enabled: enabled && !!email && !!phone && !!jobId,
    staleTime: 0,
    gcTime: 0,
  });
}
