/**
 * @file services/api/sourcingApi.ts
 * @description API client for MF-03 CV_SOURCING delivery endpoints:
 *   - Deliver qualified shortlisted CVs to Client (Internal HR)
 *   - Accept or Reject delivered CVs within 7-day review window (Client)
 *   - Review rejections (Internal HR)
 *   - Replace rejected CVs with backups (Internal HR)
 *   - List deliveries and progress summary (Client and Internal HR)
 */

import { apiClient } from '../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type {
  DecideSourcingDeliveryRequest,
  DeliverCvsResponse,
  ReplaceSourcingDeliveryRequest,
  ReviewSourcingRejectionRequest,
  SourcingDeliveriesResponse,
  SourcingDeliveryDto,
} from '@/types/api/sourcing';

export const sourcingApi = {
  /**
   * GET /jobs/{jobId}/sourcing/deliveries
   * Returns list of delivered CVs and progress summary for a CV_SOURCING job.
   */
  async getDeliveries(jobId: string, status?: string): Promise<SourcingDeliveriesResponse> {
    const res = await apiClient.get<ApiEnvelope<SourcingDeliveriesResponse>>(
      `/jobs/${jobId}/sourcing/deliveries`,
      {
        params: status ? { status } : undefined,
      }
    );
    return res.data.data;
  },

  /**
   * POST /jobs/{jobId}/sourcing/deliveries
   * Internal HR hands shortlisted CVs to the Client.
   */
  async deliverCvs(jobId: string, applicationIds: string[]): Promise<DeliverCvsResponse> {
    const res = await apiClient.post<ApiEnvelope<DeliverCvsResponse>>(
      `/jobs/${jobId}/sourcing/deliveries`,
      { applicationIds }
    );
    return res.data.data;
  },

  /**
   * POST /jobs/{jobId}/sourcing/deliveries/{deliveryId}/decision
   * Client accepts or rejects a delivered CV within the review window (7 days).
   */
  async decideDelivery(
    jobId: string,
    deliveryId: string,
    data: DecideSourcingDeliveryRequest
  ): Promise<SourcingDeliveryDto> {
    const res = await apiClient.post<ApiEnvelope<SourcingDeliveryDto>>(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/decision`,
      data
    );
    return res.data.data;
  },

  /**
   * POST /jobs/{jobId}/sourcing/deliveries/{deliveryId}/review-rejection
   * Internal HR verifies a rejection with reason OTHER.
   */
  async reviewRejection(
    jobId: string,
    deliveryId: string,
    data: ReviewSourcingRejectionRequest
  ): Promise<SourcingDeliveryDto> {
    const res = await apiClient.post<ApiEnvelope<SourcingDeliveryDto>>(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/review-rejection`,
      data
    );
    return res.data.data;
  },

  /**
   * POST /jobs/{jobId}/sourcing/deliveries/{deliveryId}/replace
   * Internal HR swaps a validly rejected CV for another qualified backup CV.
   */
  async replaceDelivery(
    jobId: string,
    deliveryId: string,
    applicationId: string
  ): Promise<SourcingDeliveryDto> {
    const res = await apiClient.post<ApiEnvelope<SourcingDeliveryDto>>(
      `/jobs/${jobId}/sourcing/deliveries/${deliveryId}/replace`,
      { applicationId } as ReplaceSourcingDeliveryRequest
    );
    return res.data.data;
  },
};
