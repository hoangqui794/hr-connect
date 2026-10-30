import { apiClient } from '../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type {
  AffiliateBankAccount,
  BusinessSetting,
  CancelReplacementSlotRequest,
  Commission,
  CommissionStatus,
  FinancePage,
  OnlinePaymentResult,
  OnlinePaymentTargetType,
  Payout,
  PlacementListItem,
  ReplacementSlotDto,
  ServiceFee,
  ServiceFeeKind,
  ServiceFeeStatus,
  Warranty,
  WarrantyClaimResponse,
  WarrantyStatus,
} from '@/types/api/finance';
import type { JobPostingPackage } from '@/types/api/jobs';


const clean = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all'));

export type PostingPackageUpdate = Pick<JobPostingPackage, 'name' | 'description' | 'price' | 'durationDays' | 'isActive'> & {
  maxApplications: number | null;
};

/** Admin › Cài đặt: AP (CV_APPLICATION) posting packages, including inactive ones (GET/PUT /admin/posting-packages). */
export const postingPackagesAdminApi = {
  async list(): Promise<JobPostingPackage[]> {
    return (await apiClient.get<ApiEnvelope<JobPostingPackage[]>>('/admin/posting-packages')).data.data;
  },
  async update(packageId: string, body: PostingPackageUpdate): Promise<JobPostingPackage> {
    return (await apiClient.put<ApiEnvelope<JobPostingPackage>>(`/admin/posting-packages/${packageId}`, body)).data.data;
  },
};

/** Admin-configurable business numbers (GET/PUT /admin/settings). */
export const businessSettingsApi = {
  async list(): Promise<BusinessSetting[]> {
    return (await apiClient.get<ApiEnvelope<BusinessSetting[]>>('/admin/settings')).data.data;
  },
  async update(key: string, value: number): Promise<BusinessSetting> {
    return (await apiClient.put<ApiEnvelope<BusinessSetting>>(`/admin/settings/${encodeURIComponent(key)}`, { value })).data.data;
  },
};

/** MF-05 (HEADHUNT_COD): service fees, commissions, payouts, warranty claims. The API scopes lists by role. */
/** Client pays a fee through VNPay (sandbox until production credentials are set on the backend). */
export const vnPayApi = {
  async enabled(): Promise<boolean> {
    return (await apiClient.get<ApiEnvelope<{ enabled: boolean }>>('/payments/vnpay/status')).data.data.enabled;
  },
  async createPayment(targetType: OnlinePaymentTargetType, targetId: string): Promise<{ onlinePaymentId: string; paymentUrl: string }> {
    return (await apiClient.post<ApiEnvelope<{ onlinePaymentId: string; paymentUrl: string }>>('/payments/vnpay', { targetType, targetId })).data.data;
  },
  /** Forwards VNPay's signed return query; the backend confirms the payment if the IPN has not yet. */
  async confirmReturn(search: string): Promise<OnlinePaymentResult> {
    return (await apiClient.get<ApiEnvelope<OnlinePaymentResult>>(`/payments/vnpay/return${search}`)).data.data;
  },
};

export const financeApi = {
  /** kind: PLACEMENT (HEADHUNT_COD), DEPOSIT, SETTLEMENT or CREDIT (CV_SOURCING); omit for every kind. */
  async serviceFees(params: {
    status?: ServiceFeeStatus | 'all';
    kind?: ServiceFeeKind;
    page: number;
    pageSize: number;
  }): Promise<FinancePage<ServiceFee>> {
    return (await apiClient.get<ApiEnvelope<FinancePage<ServiceFee>>>('/service-fees', { params: clean(params) })).data.data;
  },
  async recordFeePayment(serviceFeeId: string, input: { paidAt: string; paymentReference: string }) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/admin/service-fees/${serviceFeeId}/record-payment`, input)).data;
  },
  async commissions(params: { status?: CommissionStatus | 'all'; page: number; pageSize: number }): Promise<FinancePage<Commission>> {
    return (await apiClient.get<ApiEnvelope<FinancePage<Commission>>>('/commissions', { params: clean(params) })).data.data;
  },
  async approveCommission(commissionId: string) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/admin/commissions/${commissionId}/approve`)).data;
  },
  async cancelCommission(commissionId: string, reason: string) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/admin/commissions/${commissionId}/cancel`, { reason })).data;
  },
  async adjustCommission(commissionId: string, newAmount: number, reason: string) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/admin/commissions/${commissionId}/adjust`, { newAmount, reason })).data;
  },
  async recordPayout(
    commissionId: string,
    input: { succeeded: boolean; payoutDate: string; method?: string; transactionReference?: string; evidenceUrl?: string }
  ) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/admin/commissions/${commissionId}/payouts`, input)).data;
  },
  async payouts(params: { page: number; pageSize: number }): Promise<FinancePage<Payout>> {
    return (await apiClient.get<ApiEnvelope<FinancePage<Payout>>>('/payouts', { params: clean(params) })).data.data;
  },
  async warranties(params: { status?: WarrantyStatus | 'all'; page: number; pageSize: number }): Promise<FinancePage<Warranty>> {
    return (await apiClient.get<ApiEnvelope<FinancePage<Warranty>>>('/warranties', { params: clean(params) })).data.data;
  },
  async reportResignation(placementId: string, input: { lastWorkingDate: string; reason: string }) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/placements/${placementId}/resignation`, input)).data;
  },
  async resolveResignation(placementId: string, input: { confirmed: boolean; note?: string }): Promise<WarrantyClaimResponse> {
    const res = await apiClient.post<ApiEnvelope<WarrantyClaimResponse>>(`/placements/${placementId}/resignation/resolve`, input);
    return res.data.data ?? (res.data as unknown as WarrantyClaimResponse);
  },
  /** MF-05 replacement slots of one job */
  async getReplacementSlots(jobId: string): Promise<ReplacementSlotDto[]> {
    const res = await apiClient.get<ApiEnvelope<ReplacementSlotDto[]>>(`/jobs/${jobId}/replacement-slots`);
    if (Array.isArray(res.data?.data)) return res.data.data;
    if (Array.isArray(res.data)) return res.data as unknown as ReplacementSlotDto[];
    return [];
  },

  /** Internal HR cancels a WAITING_PAYMENT or OPEN slot */
  async cancelReplacementSlot(
    replacementSlotId: string,
    input: CancelReplacementSlotRequest
  ): Promise<ReplacementSlotDto> {
    const res = await apiClient.post<ApiEnvelope<ReplacementSlotDto>>(
      `/internal/replacement-slots/${replacementSlotId}/cancel`,
      input
    );
    return res.data.data ?? (res.data as unknown as ReplacementSlotDto);
  },
  /** Placements list (Client scoped to own company, HR/Admin scoped system-wide) */
  async getPlacements(params?: {
    companyId?: string;
    jobId?: string;
    candidateId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: PlacementListItem[]; totalCount: number }> {
    const res = await apiClient.get<{ items: PlacementListItem[]; totalCount: number }>('/placements', {
      params: clean(params ?? {}),
    });
    return res.data?.items ? res.data : ((res.data as any)?.data ?? { items: [], totalCount: 0 });
  },
  /** Get single Placement Detail (GET /placements/{placementId}) */
  async getPlacementDetail(placementId: string) {
    const { placementApi } = await import('./placementApi');
    return placementApi.getPlacementDetail(placementId);
  },
};


/** The affiliate's own payout account (needed before MF-05 payouts can be made). */
export const affiliateBankApi = {
  async get(): Promise<AffiliateBankAccount | null> {
    try {
      return (await apiClient.get<AffiliateBankAccount>('/affiliates/profile/me/bank-account')).data;
    } catch (error) {
      // 404 means no account has been saved yet.
      if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
      throw error;
    }
  },
  async update(input: { bankName: string; bankAccountNumber: string; bankAccountHolder: string; bankBranch?: string }) {
    return (await apiClient.put<{ success: boolean; message?: string }>('/affiliates/profile/me/bank-account', input)).data;
  },
};
