import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MOCK_COMMISSIONS, MOCK_LEDGER_SUMMARY } from '@/services/mockData';
import { PayoutRequest, PayoutStatus, LedgerSummary } from '@/types/affiliate';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const financialKeys = {
  all: ['financials'] as const,
  commissions: () => [...financialKeys.all, 'commissions'] as const,
  summary: () => [...financialKeys.all, 'summary'] as const,
};

export function useCommissions(affiliateId?: string) {
  return useQuery({
    queryKey: [...financialKeys.commissions(), affiliateId],
    queryFn: async () => {
      await delay(300);
      if (affiliateId) {
        return MOCK_COMMISSIONS.filter((c) => c.affiliateId === affiliateId);
      }
      return MOCK_COMMISSIONS;
    },
    staleTime: 15000,
  });
}

export function useLedgerSummary(affiliateId?: string) {
  return useQuery({
    queryKey: [...financialKeys.summary(), affiliateId],
    queryFn: async (): Promise<LedgerSummary> => {
      await delay(200);
      if (affiliateId && affiliateId !== 'aff-001') {
        return {
          totalEarned: 0,
          pendingAmount: 0,
          payableAmount: 0,
          paidAmount: 0,
          totalPlacements: 0,
          activeProbations: 0,
          currency: 'VND',
        };
      }
      return MOCK_LEDGER_SUMMARY;
    },
    staleTime: 30000,
  });
}

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: PayoutRequest) => {
      await delay(1000);
      const commission = MOCK_COMMISSIONS.find((c) => c.id === request.commissionId);
      if (commission) {
        commission.status = PayoutStatus.PAID;
        commission.paidAt = new Date().toISOString();
        commission.payoutRequestedAt = request.requestedAt;
        commission.bankDetails = request.bankDetails;
        MOCK_LEDGER_SUMMARY.payableAmount = Math.max(0, MOCK_LEDGER_SUMMARY.payableAmount - commission.commissionAmount);
        MOCK_LEDGER_SUMMARY.paidAmount += commission.commissionAmount;
      }
      return { success: true, commissionId: request.commissionId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financialKeys.all });
    },
  });
}

export interface RecordOfflinePayoutParams {
  commissionId: string;
  paidAmount: number;
  bankReferenceCode: string;
  transferDate: string;
  receiptImageUrl: string;
  receiptFileName?: string;
  receiptFileSize?: string;
  adminNotes?: string;
  recordedBy?: string;
}

export function useRecordOfflinePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: RecordOfflinePayoutParams) => {
      await delay(600);
      const commission = MOCK_COMMISSIONS.find((c) => c.id === params.commissionId);
      if (commission) {
        const prevStatus = commission.status;
        commission.status = PayoutStatus.PAID;
        commission.paidAt = params.transferDate || new Date().toISOString();
        commission.payoutEvidence = {
          bankReferenceCode: params.bankReferenceCode,
          paidAmount: params.paidAmount,
          transferDate: params.transferDate,
          receiptImageUrl: params.receiptImageUrl,
          receiptFileName: params.receiptFileName || 'UNC_ChuyenKhoan_Ngoai.pdf',
          receiptFileSize: params.receiptFileSize || '380 KB',
          bankName: commission.bankDetails?.bankName || 'Vietcombank',
          accountNumber: commission.bankDetails?.accountNumber || '0071001234567',
          accountHolder: commission.bankDetails?.accountHolder || commission.affiliateName.toUpperCase(),
          recordedBy: params.recordedBy || 'Alex Nguyen (Platform Admin)',
          recordedAt: new Date().toISOString(),
          adminNotes: params.adminNotes,
        };

        const newAuditEntry = {
          id: `aud-${Date.now().toString().slice(-6)}`,
          action: 'OFFLINE_PAYOUT_RECORDED',
          actorName: params.recordedBy || 'Alex Nguyen (Platform Admin)',
          actorRole: 'ADMIN',
          timestamp: new Date().toISOString(),
          details: `Kế toán ghi nhận đã chuyển khoản ngoài: $${params.paidAmount.toLocaleString()} USD. Mã tham chiếu: ${params.bankReferenceCode}. Đính kèm chứng từ ủy nhiệm chi.`,
          previousStatus: prevStatus,
          newStatus: PayoutStatus.PAID,
        };

        commission.auditTrail = [...(commission.auditTrail || []), newAuditEntry];

        MOCK_LEDGER_SUMMARY.payableAmount = Math.max(0, MOCK_LEDGER_SUMMARY.payableAmount - commission.commissionAmount);
        MOCK_LEDGER_SUMMARY.paidAmount += commission.commissionAmount;
      }
      return { success: true, commissionId: params.commissionId };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financialKeys.all });
    },
  });
}
