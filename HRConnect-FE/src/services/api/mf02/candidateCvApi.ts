import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { CandidateCv } from '@/types/api/mf02';
import { createMultipartBody } from './shared';

export const candidateCvApi = {
  async list(): Promise<CandidateCv[]> {
    return (await apiClient.get<ApiEnvelope<CandidateCv[]>>('/candidates/cv')).data.data;
  },
  async upload(file: File, title?: string, isPrimary?: boolean) {
    const body = createMultipartBody({ file, title, isPrimary: isPrimary ? 'true' : undefined });
    return (await apiClient.post<ApiEnvelope<unknown> & { message?: string }>('/candidates/cv', body)).data;
  },
  async setPrimary(cvId: string) {
    return (await apiClient.patch<{ message?: string }>(`/candidates/cv/${cvId}/primary`)).data;
  },
  async updateTitle(cvId: string, title: string) {
    return (await apiClient.patch<{ success: boolean; message: string }>(`/candidates/cv/${cvId}`, { title })).data;
  },
  async remove(cvId: string) {
    return (await apiClient.delete<{ message?: string }>(`/candidates/cv/${cvId}`)).data;
  },
  async downloadUrl(cvId: string): Promise<{ downloadUrl: string }> {
    return (await apiClient.get<ApiEnvelope<{ downloadUrl: string }>>(`/candidates/cv/${cvId}/download-url`)).data.data;
  },
};
