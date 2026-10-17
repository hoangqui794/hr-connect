/**
 * @file usePlacementDetail.ts
 * @description React Query hook for fetching and managing Placement Detail.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { placementApi } from '@/services/api/placementApi';
import type { PlacementDetailDto } from '@/types/api/placement';

export const placementKeys = {
  all: ['placements'] as const,
  detail: (placementId: string) => ['placements', placementId] as const,
};

export const usePlacementDetail = (placementId?: string) => {
  const queryClient = useQueryClient();

  const query = useQuery<PlacementDetailDto, Error>({
    queryKey: placementKeys.detail(placementId || ''),
    queryFn: () => placementApi.getPlacementDetail(placementId!),
    enabled: Boolean(placementId),
    staleTime: 30 * 1000,
  });

  const reportResignationMutation = useMutation({
    mutationFn: (input: { lastWorkingDate: string; reason: string }) => {
      if (!placementId) throw new Error('Không có mã tiếp nhận việc');
      return placementApi.reportResignation(placementId, input);
    },
    onSuccess: (data) => {
      message.success(data.message || 'Đã gửi báo nghỉ việc thành công.');
      queryClient.invalidateQueries({ queryKey: placementKeys.detail(placementId!) });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('mf05-') });
    },
    onError: (err: any) => {
      message.error(err.message || 'Không thể gửi báo nghỉ việc.');
    },
  });

  const resolveResignationMutation = useMutation({
    mutationFn: (input: { confirmed: boolean; note?: string }) => {
      if (!placementId) throw new Error('Không có mã tiếp nhận việc');
      return placementApi.resolveResignation(placementId, input);
    },
    onSuccess: () => {
      message.success('Đã xử lý xác minh báo nghỉ việc thành công.');
      queryClient.invalidateQueries({ queryKey: placementKeys.detail(placementId!) });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('mf05-') });
    },
    onError: (err: any) => {
      message.error(err.message || 'Không thể xử lý xác minh báo nghỉ.');
    },
  });

  return {
    placement: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    reportResignation: reportResignationMutation.mutateAsync,
    isReportingResignation: reportResignationMutation.isPending,
    resolveResignation: resolveResignationMutation.mutateAsync,
    isResolvingResignation: resolveResignationMutation.isPending,
  };
};

export default usePlacementDetail;
