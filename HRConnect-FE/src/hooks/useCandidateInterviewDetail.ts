/**
 * @file useCandidateInterviewDetail.ts
 * @description React Query hook for fetching and managing Candidate Interview Detail.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { candidateInterviewApi } from '@/services/api/candidateInterviewApi';
import type {
  CandidateInterviewDetailDto,
  CandidateConfirmAttendanceInput,
  CandidateRescheduleRequestInput,
} from '@/types/api/candidateInterview';

export const candidateInterviewKeys = {
  all: ['candidate', 'interviews'] as const,
  detail: (interviewId: string) => ['candidate', 'interviews', interviewId] as const,
  history: (interviewId: string) => ['candidate', 'interviews', interviewId, 'history'] as const,
};

export const useCandidateInterviewDetail = (interviewId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery<CandidateInterviewDetailDto, Error>({
    queryKey: candidateInterviewKeys.detail(interviewId || ''),
    queryFn: () => candidateInterviewApi.getInterviewDetail(interviewId!),
    enabled: Boolean(interviewId),
    staleTime: 30 * 1000,
  });

  const confirmAttendanceMutation = useMutation({
    mutationFn: (input: Omit<CandidateConfirmAttendanceInput, 'interviewId'>) => {
      if (!interviewId) throw new Error('Không có mã buổi phỏng vấn');
      return candidateInterviewApi.confirmAttendance({
        interviewId,
        ...input,
      });
    },
    onSuccess: (data) => {
      message.success(data.message || 'Đã xác nhận sẵn sàng tham gia phỏng vấn!');
      queryClient.invalidateQueries({ queryKey: candidateInterviewKeys.detail(interviewId!) });
    },
    onError: (err: any) => {
      message.error(err.message || 'Xác nhận tham gia thất bại, vui lòng thử lại.');
    },
  });

  const requestRescheduleMutation = useMutation({
    mutationFn: (input: Omit<CandidateRescheduleRequestInput, 'interviewId'>) => {
      if (!interviewId) throw new Error('Không có mã buổi phỏng vấn');
      return candidateInterviewApi.requestReschedule({
        interviewId,
        ...input,
      });
    },
    onSuccess: (data) => {
      message.success(data.message || 'Đã gửi yêu cầu dời lịch phỏng vấn thành công!');
      queryClient.invalidateQueries({ queryKey: candidateInterviewKeys.detail(interviewId!) });
    },
    onError: (err: any) => {
      message.error(err.message || 'Gửi yêu cầu dời lịch thất bại, vui lòng thử lại.');
    },
  });

  return {
    interview: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    confirmAttendance: confirmAttendanceMutation.mutateAsync,
    isConfirming: confirmAttendanceMutation.isPending,
    requestReschedule: requestRescheduleMutation.mutateAsync,
    isRequestingReschedule: requestRescheduleMutation.isPending,
  };
};

export default useCandidateInterviewDetail;
