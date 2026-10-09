import { apiClient } from '../../apiClient';
import type { ApiEnvelope, Paged } from '@/types/api/admin';
import type { AdminIdentityClaimListItem, AdminIdentityClaimListParams } from '@/types/api/mf02';
import { cleanParams } from './shared';

export const adminIdentityClaimApi = {
  /** GET /admin/candidate-identity-claims — requires candidate.identity.review. */
  async list(params: AdminIdentityClaimListParams): Promise<Paged<AdminIdentityClaimListItem>> {
    const response = await apiClient.get<ApiEnvelope<Paged<AdminIdentityClaimListItem>>>(
      '/admin/candidate-identity-claims',
      { params: cleanParams(params) }
    );
    return response.data.data;
  },
};
