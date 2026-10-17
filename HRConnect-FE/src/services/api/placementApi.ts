/**
 * @file placementApi.ts
 * @description API service for Placement Detail & related operations (MF-04 / MF-05 / FE-tasks-sang Section 7).
 */

import { apiClient, getApiError } from '@/services/apiClient';
import type { PlacementDetailDto, PlacementFinancialDto } from '@/types/api/placement';

export const placementApi = {
  /**
   * GET /api/v1/placements/{placementId}
   * Lấy thông tin chi tiết một tiếp nhận việc (Placement Detail).
   */
  async getPlacementDetail(placementId: string): Promise<PlacementDetailDto> {
    try {
      const response = await apiClient.get<any>(`/placements/${placementId}`);
      const raw = response.data?.data ?? response.data;
      if (!raw || typeof raw !== 'object') {
        throw new Error('Dữ liệu tiếp nhận việc không hợp lệ');
      }

      // Format core placement detail
      const detail: PlacementDetailDto = {
        placementId: raw.placementId ?? placementId,
        applicationId: raw.applicationId ?? '',
        offerId: raw.offerId ?? '',
        actualStartDate: raw.actualStartDate ?? '',
        position: raw.position ?? null,
        department: raw.department ?? null,
        status: raw.status ?? 'STARTED',
        confirmedAt: raw.confirmedAt ?? '',
        confirmedBy: raw.confirmedBy ?? null,
        confirmedByName: raw.confirmedByName ?? null,
        confirmationNote: raw.confirmationNote ?? null,
        candidate: {
          candidateId: raw.candidate?.candidateId ?? '',
          fullName: raw.candidate?.fullName ?? 'Ứng viên',
          email: raw.candidate?.email ?? '',
          phone: raw.candidate?.phone ?? null,
          summary: raw.candidate?.summary ?? null,
        },
        job: {
          jobId: raw.job?.jobId ?? '',
          title: raw.job?.title ?? 'Vị trí tuyển dụng',
          companyId: raw.job?.companyId ?? '',
          companyName: raw.job?.companyName ?? 'Doanh nghiệp',
        },
        offer: {
          offerId: raw.offer?.offerId ?? raw.offerId ?? '',
          salary: raw.offer?.salary ?? null,
          currencyCode: raw.offer?.currencyCode ?? 'VND',
          startDate: raw.offer?.startDate ?? null,
          status: raw.offer?.status ?? 'ACCEPTED',
          offerDocumentUrl: raw.offer?.offerDocumentUrl ?? null,
        },
        probation: raw.probation
          ? {
              probationId: raw.probation.probationId ?? '',
              startDate: raw.probation.startDate ?? '',
              endDate: raw.probation.endDate ?? null,
              result: raw.probation.result ?? null,
              notes: raw.probation.notes ?? null,
            }
          : null,
        warranty: raw.warranty
          ? {
              warrantyId: raw.warranty.warrantyId ?? '',
              startDate: raw.warranty.startDate ?? '',
              endDate: raw.warranty.endDate ?? null,
              status: raw.warranty.status ?? 'ACTIVE',
              resultNote: raw.warranty.resultNote ?? null,
            }
          : null,
        allowedActions: Array.isArray(raw.allowedActions) ? raw.allowedActions : ['VIEW_PLACEMENT'],
        createdAt: raw.createdAt ?? '',
        updatedAt: raw.updatedAt ?? '',
        financial: raw.financial ?? null,
      };

      // Try to load linked warranty & financial info if not yet attached
      if (!detail.financial) {
        try {
          const wRes = await apiClient.get<any>('/warranties', {
            params: { page: 1, pageSize: 20 },
          });
          const wItems = wRes.data?.data?.items ?? wRes.data?.items ?? [];
          const matchedWarranty = wItems.find((w: any) => w.placementId === placementId);
          if (matchedWarranty) {
            const financial: PlacementFinancialDto = {
              serviceFeeAmount: matchedWarranty.serviceFeeAmount ?? null,
              serviceFeeStatus: matchedWarranty.serviceFeeStatus ?? null,
              commissionAmount: matchedWarranty.commissionAmount ?? null,
              commissionStatus: matchedWarranty.commissionStatus ?? null,
            };
            detail.financial = financial;

            if (!detail.warranty && matchedWarranty.warrantyId) {
              detail.warranty = {
                warrantyId: matchedWarranty.warrantyId,
                startDate: matchedWarranty.startDate,
                endDate: matchedWarranty.endDate ?? null,
                status: matchedWarranty.status ?? 'ACTIVE',
                resultNote: matchedWarranty.resultNote ?? null,
              };
            }
          }
        } catch {
          // Ignore secondary financial lookup failures
        }
      }

      return detail;
    } catch (err) {
      const norm = getApiError(err, 'Không thể tải chi tiết tiếp nhận việc');
      throw new Error(norm.message);
    }
  },

  /**
   * Báo ứng viên nghỉ việc trong thời gian bảo hành (Client).
   */
  async reportResignation(
    placementId: string,
    input: { lastWorkingDate: string; reason: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      await apiClient.post(`/placements/${placementId}/resignation`, input);
      return {
        success: true,
        message: 'Đã gửi báo nghỉ việc thành công. Internal HR sẽ xác minh.',
      };
    } catch (err) {
      const norm = getApiError(err, 'Không thể gửi báo nghỉ việc');
      throw new Error(norm.message);
    }
  },

  /**
   * Xác minh báo nghỉ việc (Internal HR).
   */
  async resolveResignation(
    placementId: string,
    input: { confirmed: boolean; note?: string }
  ): Promise<any> {
    try {
      const response = await apiClient.post(`/placements/${placementId}/resignation/resolve`, input);
      return response.data?.data ?? response.data;
    } catch (err) {
      const norm = getApiError(err, 'Không thể xử lý xác minh báo nghỉ việc');
      throw new Error(norm.message);
    }
  },
};

export default placementApi;
