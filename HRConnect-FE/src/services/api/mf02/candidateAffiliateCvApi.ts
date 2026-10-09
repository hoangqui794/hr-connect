import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { PagedItems } from '@/types/api/hr';
import type { CandidateAffiliateCv, CandidateAffiliateCvAdoptionResult, CandidateAffiliateCvDetail, CandidateAffiliateCvReuseResult, CandidateAffiliateCvUsage } from '@/types/api/mf02';

type BackendPage<T> = {
  success: boolean;
  data: { items: T[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } };
};

const toPage = <T>(response: BackendPage<T>): PagedItems<T> => ({
  items: response.data.items,
  page: response.data.pagination.page,
  pageSize: response.data.pagination.pageSize,
  total: response.data.pagination.totalItems,
  totalPages: response.data.pagination.totalPages,
});

export const candidateAffiliateCvApi = {
  async list(page: number, pageSize: number): Promise<PagedItems<CandidateAffiliateCv>> {
    return toPage((await apiClient.get<BackendPage<CandidateAffiliateCv>>('/candidates/me/affiliate-cvs', { params: { page, pageSize } })).data);
  },
  async detail(cvId: string): Promise<CandidateAffiliateCvDetail> {
    return (await apiClient.get<ApiEnvelope<CandidateAffiliateCvDetail>>(`/candidates/me/affiliate-cvs/${cvId}`)).data.data;
  },
  async downloadUrl(cvId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    return (await apiClient.get<ApiEnvelope<{ downloadUrl: string; expiresAt: string }>>(`/candidates/me/affiliate-cvs/${cvId}/download-url`)).data.data;
  },
  async usages(cvId: string, page: number, pageSize: number): Promise<PagedItems<CandidateAffiliateCvUsage>> {
    const response = await apiClient.get<BackendPage<CandidateAffiliateCvUsage> & { data: { cvId: string } }>(`/candidates/me/affiliate-cvs/${cvId}/usages`, { params: { page, pageSize } });
    return toPage(response.data);
  },
  async updateReuse(cvId: string, allowed: boolean, concurrencyToken: string) {
    return (await apiClient.patch<{ success: boolean; message: string; data: CandidateAffiliateCvReuseResult }>(`/candidates/me/affiliate-cvs/${cvId}/reuse`, { allowed, concurrencyToken })).data;
  },
  async adopt(cvId: string, title?: string) {
    return (await apiClient.post<{ success: boolean; message: string; data: CandidateAffiliateCvAdoptionResult }>(`/candidates/me/affiliate-cvs/${cvId}/adopt`, title ? { title } : {})).data;
  },
};
