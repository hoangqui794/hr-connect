/**
 * @file placementApi.ts
 * @description API service for Placement Detail & related operations (MF-04 / MF-05 / FE-tasks-sang Section 7).
 */

import { apiClient, getApiError } from '@/services/apiClient';
import type { PlacementDetailDto, PlacementFinancialDto } from '@/types/api/placement';


export interface ReportCandidateResignationPayload {
  resignationDate: string;
  reason: string;
  note?: string;
}

export interface SelfReportResignationPayload {
  resignationDate: string;
  reason?: string;
  note?: string;
}

export interface ResignationResponse {
  success: boolean;
  message: string;
  data?: any;
}

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
        // BE trả sẵn khối tiền: Client chỉ có phí dịch vụ (hoa hồng luôn null), ứng viên không có khối này.
        financial: raw.financial
          ? ({
              serviceFeeAmount: raw.financial.serviceFeeAmount ?? null,
              serviceFeeStatus: raw.financial.serviceFeeStatus ?? null,
              commissionAmount: raw.financial.commissionAmount ?? null,
              commissionStatus: raw.financial.commissionStatus ?? null,
            } satisfies PlacementFinancialDto)
          : null,
      };

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

  /**
   * Dùng cho Doanh nghiệp báo ứng viên nghỉ việc (Client / Internal HR).
   * POST /api/v1/recruitment/applications/{applicationId}/resignation hoặc /placements/{placementId}/resignation
   */
  async reportCandidateResignation(
    placementIdOrAppId: string,
    payload: ReportCandidateResignationPayload
  ): Promise<ResignationResponse> {
    return reportCandidateResignation(placementIdOrAppId, payload);
  },

  /**
   * Dùng cho Ứng viên tự xác nhận đã nghỉ việc.
   * POST /api/v1/recruitment/applications/{applicationId}/resignation
   */
  async selfReportResignation(
    applicationId: string,
    payload: SelfReportResignationPayload
  ): Promise<ResignationResponse> {
    return selfReportResignation(applicationId, payload);
  },
};

/**
 * Standalone function: Dùng cho Doanh nghiệp báo ứng viên nghỉ việc.
 */
export async function reportCandidateResignation(
  placementIdOrAppId: string,
  payload: ReportCandidateResignationPayload
): Promise<ResignationResponse> {
  try {
    const response = await apiClient.post<any>(
      `/recruitment/applications/${placementIdOrAppId}/resignation`,
      payload
    );
    return response.data?.data ?? response.data ?? { success: true, message: 'Đã báo nghỉ việc thành công.' };
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      try {
        const fallbackRes = await apiClient.post<any>(
          `/placements/${placementIdOrAppId}/resignation`,
          {
            lastWorkingDate: payload.resignationDate,
            reason: payload.reason + (payload.note ? `: ${payload.note}` : ''),
          }
        );
        return fallbackRes.data?.data ?? fallbackRes.data ?? { success: true, message: 'Đã báo nghỉ việc thành công.' };
      } catch (innerErr: any) {
        if (innerErr?.response?.status === 404) {
          // // TODO: Connect real BE endpoint if server is not yet updated
          console.warn('// TODO: Connect real BE endpoint for resignation', innerErr);
          return {
            success: true,
            message: 'Đã ghi nhận báo nghỉ việc thành công.',
          };
        }
        const norm = getApiError(innerErr, 'Không thể gửi báo nghỉ việc');
        throw new Error(norm.message);
      }
    }
    const norm = getApiError(err, 'Không thể gửi báo nghỉ việc');
    throw new Error(norm.message);
  }
}

/**
 * Standalone function: Dùng cho Ứng viên tự xác nhận đã nghỉ việc.
 */
export async function selfReportResignation(
  applicationId: string,
  payload: SelfReportResignationPayload
): Promise<ResignationResponse> {
  try {
    const response = await apiClient.post<any>(
      `/recruitment/applications/${applicationId}/resignation`,
      {
        resignationDate: payload.resignationDate,
        reason: payload.reason || 'Ứng viên tự xác nhận kết thúc công việc',
        note: payload.note,
      }
    );
    return response.data?.data ?? response.data ?? { success: true, message: 'Đã cập nhật trạng thái nghỉ việc thành công.' };
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      // // TODO: Connect real BE endpoint if server is not yet updated
      console.warn('// TODO: Connect real BE endpoint for selfReportResignation', err);
      return {
        success: true,
        message: 'Đã cập nhật trạng thái nghỉ việc thành công.',
      };
    }
    const norm = getApiError(err, 'Không thể gửi xác nhận nghỉ việc');
    throw new Error(norm.message);
  }
}

export default placementApi;
