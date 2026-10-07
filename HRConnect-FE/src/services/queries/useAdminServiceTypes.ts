/**
 * @file useAdminServiceTypes.ts
 * @description React Query hooks for Admin Service Types CRUD.
 * Uses query key ['admin', 'service-types'] with automatic cache invalidation on mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminServiceTypeService } from '@/services/adminServiceTypeService';
import type {
  GetServiceTypesParams,
  CreateServiceTypeCommand,
  UpdateServiceTypeCommand,
} from '@/types/admin';

export const adminServiceTypeKeys = {
  all: ['admin', 'service-types'] as const,
  list: (params?: GetServiceTypesParams) => [...adminServiceTypeKeys.all, 'list', params] as const,
  detail: (id: string) => [...adminServiceTypeKeys.all, 'detail', id] as const,
};

/**
 * Hook query danh sách loại dịch vụ: GET /api/v1/service-types
 */
export function useAdminServiceTypes(params?: GetServiceTypesParams) {
  return useQuery({
    queryKey: adminServiceTypeKeys.list(params),
    queryFn: () => adminServiceTypeService.getServiceTypes(params),
    staleTime: 30000,
  });
}

/**
 * Hook query chi tiết loại dịch vụ: GET /api/v1/service-types/{id}
 */
export function useAdminServiceTypeDetail(id: string) {
  return useQuery({
    queryKey: adminServiceTypeKeys.detail(id),
    queryFn: () => adminServiceTypeService.getServiceTypeDetail(id),
    enabled: Boolean(id),
    staleTime: 60000,
  });
}

/**
 * Mutation tạo mới loại dịch vụ: POST /api/v1/admin/service-types
 */
export function useCreateServiceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateServiceTypeCommand) => adminServiceTypeService.createServiceType(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminServiceTypeKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
  });
}

/**
 * Mutation cập nhật loại dịch vụ: PUT /api/v1/admin/service-types/{id}
 */
export function useUpdateServiceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, command }: { id: string; command: UpdateServiceTypeCommand }) =>
      adminServiceTypeService.updateServiceType(id, command),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: adminServiceTypeKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['service-types'] });
      void queryClient.invalidateQueries({ queryKey: adminServiceTypeKeys.detail(variables.id) });
    },
  });
}

/**
 * Mutation xóa / vô hiệu hóa loại dịch vụ: DELETE /api/v1/admin/service-types/{id}
 */
export function useDeleteServiceType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminServiceTypeService.deleteServiceType(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminServiceTypeKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['service-types'] });
    },
  });
}
