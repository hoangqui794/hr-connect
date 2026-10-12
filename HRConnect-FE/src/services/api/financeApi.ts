import { apiClient } from '../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type {
  BusinessSetting,
  Commission,
  CommissionStatus,
  FinancePage,
  Payout,
  ServiceFee,
  ServiceFeeStatus,
  Warranty,
  WarrantyStatus,
} from '@/types/api/finance';

const clean = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all'));

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
export const financeApi = {
  async serviceFees(params: { status?: ServiceFeeStatus | 'all'; page: number; pageSize: number }): Promise<FinancePage<ServiceFee>> {
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
  async resolveResignation(placementId: string, input: { confirmed: boolean; note?: string }) {
    return (await apiClient.post<ApiEnvelope<unknown>>(`/placements/${placementId}/resignation/resolve`, input)).data;
  },
};
