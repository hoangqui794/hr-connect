export enum PayoutStatus {
  ON_HOLD = 'ON_HOLD',
  PAYABLE = 'PAYABLE',
  PAID = 'PAID',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
}

export const PAYOUT_STATUS_CONFIG: Record<
  PayoutStatus,
  { label: string; color: string; antdStatus: 'default' | 'success' | 'processing' | 'warning' | 'error' }
> = {
  [PayoutStatus.ON_HOLD]: { label: 'Chờ duyệt', color: '#f59e0b', antdStatus: 'warning' },
  [PayoutStatus.PAYABLE]: { label: 'Đủ điều kiện nhận', color: '#10b981', antdStatus: 'success' },
  [PayoutStatus.PAID]: { label: 'Đã thanh toán', color: '#0284c7', antdStatus: 'processing' },
  [PayoutStatus.DISPUTED]: { label: 'Đang tranh chấp', color: '#ef4444', antdStatus: 'error' },
  [PayoutStatus.CANCELLED]: { label: 'Đã hủy', color: '#94a3b8', antdStatus: 'default' },
};

export interface TrustRating {
  affiliateId: string;
  score: number; // 0.0 - 5.0
  totalSubmissions: number;
  successfulPlacements: number;
  disputesRaised: number;
  disputesLost: number;
  onTimeSubmissionRate: number; // percentage
  lastUpdated: string;
}

export interface Commission {
  id: string;
  affiliateId: string;
  affiliateName: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  commissionRate: number; // percentage
  baseSalary: number; // candidate's accepted salary
  commissionAmount: number; // computed = baseSalary * rate
  currency: 'VND' | 'USD';
  status: PayoutStatus;
  hiredAt: string;
  probationStartDate: string;
  probationEndDate: string; // +60 days from hire
  probationDaysRemaining: number;
  probationProgress: number; // 0-100
  warrantyExpired: boolean;
  payoutRequestedAt?: string;
  paidAt?: string;
  bankDetails?: BankDetails;
  payoutEvidence?: OfflinePayoutEvidence;
  auditTrail?: AuditTrailEntry[];
}

export interface OfflinePayoutEvidence {
  bankReferenceCode: string; // Mã tham chiếu GD ngân hàng
  paidAmount: number;
  transferDate: string; // YYYY-MM-DD or ISO
  receiptImageUrl: string;
  receiptFileName?: string;
  receiptFileSize?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  recordedBy: string; // Admin identity
  recordedAt: string;
  adminNotes?: string;
}

export interface AuditTrailEntry {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  details: string;
  previousStatus?: PayoutStatus;
  newStatus?: PayoutStatus;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  swiftCode?: string;
  routingNumber?: string;
}

export interface LedgerSummary {
  pendingAmount: number;
  payableAmount: number;
  paidAmount: number;
  totalEarned: number;
  currency: 'VND' | 'USD';
  totalPlacements: number;
  activeProbations: number;
}

export interface PayoutRequest {
  commissionId: string;
  affiliateId: string;
  requestedAmount: number;
  bankDetails: BankDetails;
  notes?: string;
  requestedAt: string;
}

export interface DuplicateSubmission {
  originalSubmissionId: string;
  originalAffiliateId: string;
  originalAffiliateName: string;
  originalTimestamp: string;
  duplicateAffiliateId: string;
  duplicateAffiliateName: string;
  duplicateTimestamp: string;
  candidateEmail: string;
  candidatePhone: string;
  jobId: string;
  status: 'BLOCKED' | 'DISPUTE_PENDING' | 'DISPUTE_RESOLVED';
  resolution?: string;
}

// ─── SPEC DTOs (Spec Mục 4 & 5 - Affiliate Recruiter & OPR Hub) ────────────────

export type SubmissionStatus =
  | 'SUBMITTED'       // Đã nộp / Chờ HR duyệt
  | 'HR_SCREENING'    // HR sơ loại
  | 'INTERVIEW'       // Đã vào phỏng vấn
  | 'HIRED'           // Đã nhận việc / Nhận offer
  | 'PROBATION'       // Đang thử việc
  | 'REJECTED'        // Bị từ chối
  | 'DUPLICATE';      // Trùng lặp

export interface AffiliateSubmissionDTO {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName?: string;
  candidateName: string;
  email: string;
  phone: string;
  cvUrl: string;
  submittedAt: string; // ISO String timestamp lưu vết để bảo vệ attribution
  status: SubmissionStatus;
  isDuplicate: boolean;
  hasDispute: boolean;
  disputeReason?: string;
  disputeEvidence?: string;
  disputeStatus?: 'PENDING' | 'RESOLVED_ACCEPTED' | 'RESOLVED_REJECTED';
  duplicateWithAffiliate?: string;
  duplicateSubmittedAt?: string;
  currentStageNote?: string;
  salaryExpectation?: number;
  avatar?: string;
}

export type CommissionPayoutStatus = 'PENDING' | 'ELIGIBLE' | 'APPROVED' | 'PAYABLE' | 'PENDING_APPROVAL' | 'PAID';

export interface AffiliateCommissionDTO {
  id: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  commissionRate: number; // percentage (VD: 15)
  amount: number; // VNĐ (VD: 25000000)
  probationDaysPassed: number; // VD: 35
  totalDays: 60; // Chuẩn 60 ngày bảo hành
  status: CommissionPayoutStatus;
  uncUrl?: string; // Chứng từ ủy nhiệm chi ngân hàng
  uncNumber?: string; // Số lệnh UNC (VD: UNC-VCB-20260312-8821)
  paidAt?: string;
  bankName?: string;
  accountNumber?: string;
  beneficiaryName?: string;
  hiredDate?: string;
  warrantyEndDate?: string;
  avatar?: string;
}

