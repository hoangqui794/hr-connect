/**
 * @file useCandidateInterviewDetail.ts
 * @description React Query hook for fetching and managing Candidate Interview Detail.
 */

import { useQuery } from '@tanstack/react-query';
import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';
import type { CandidateInterviewDetailDto } from '@/types/api/candidateInterview';

export const candidateInterviewKeys = {
  all: ['candidate', 'interviews'] as const,
  detail: (interviewId: string) => ['candidate', 'interviews', interviewId] as const,
};

export const useCandidateInterviewDetail = (interviewId?: string) => {
  const query = useQuery<CandidateInterviewDetailDto, Error>({
    queryKey: candidateInterviewKeys.detail(interviewId || ''),
    queryFn: () => candidateInterviewApi.getInterviewDetail(interviewId!),
    enabled: Boolean(interviewId),
    staleTime: 30 * 1000,
  });

  return {
    interview: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
};

export default useCandidateInterviewDetail;
