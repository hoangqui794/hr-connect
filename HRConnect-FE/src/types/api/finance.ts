/** MF-05 finance and Admin business settings, mirroring HRConnect.Application Features/Finance and Features/Settings. */

export interface FinancePage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface BusinessSetting {
  key: string;
  group: string;
  label: string;
  description: string;
  type: 'INTEGER' | 'DECIMAL';
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  unit: string;
  source: string;
  isOverridden: boolean;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export type ServiceFeeStatus = 'PENDING' | 'DUE' | 'PAID' | 'OVERDUE' | 'CANCELLED';
/** PLACEMENT = HEADHUNT_COD placement; DEPOSIT / SETTLEMENT / CREDIT = CV_SOURCING job (CREDIT is owed to the Client). */
export type ServiceFeeKind = 'PLACEMENT' | 'DEPOSIT' | 'SETTLEMENT' | 'CREDIT';
export type CommissionStatus = 'PENDING' | 'IN_WARRANTY' | 'ON_HOLD' | 'EARNED' | 'PAYABLE' | 'PAID' | 'CANCELLED';
export type PayoutStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** What a Client pays online: a service fee (HH / SS) by its id, or a CV_APPLICATION posting fee by its job id. */
export type OnlinePaymentTargetType = 'SERVICE_FEE' | 'POSTING_FEE';

export type OnlinePaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'NEEDS_REVIEW';

export interface OnlinePaymentResult {
  onlinePaymentId: string;
  targetType: OnlinePaymentTargetType;
  targetId: string;
  amount: number;
  currencyCode: string;
  status: OnlinePaymentStatus;
  providerTransactionNo: string | null;
  responseCode: string | null;
  paidAt: string | null;
}

export interface ServiceFee {
  serviceFeeId: string;
  /** Null for CV_SOURCING fees. */
  placementId: string | null;
  kind?: ServiceFeeKind;
  jobId?: string | null;
  companyId: string;
  companyName?: string | null;
  jobTitle?: string | null;
  candidateName?: string | null;
  baseSalary: number;
  feeMultiplier: number;
  amount: number;
  currencyCode: string;
  dueDate: string;
  status: ServiceFeeStatus;
  reconciliationStatus?: 'PENDING' | 'CONFIRMED' | 'FLAGGED' | null;
  /** CV_SOURCING job terms, so a deposit / settlement can be explained as CVs × price per CV. */
  sourcingTarget?: number | null;
  sourcingPricePerCv?: number | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  createdAt: string;
}

export interface Commission {
  commissionId: string;
  /** HEADHUNT_COD placement; null for a CV_SOURCING commission (see sourcingDeliveryId). */
  placementId: string | null;
  sourcingDeliveryId?: string | null;
  attributionId: string;
  affiliateId: string;
  affiliateName?: string | null;
  jobTitle?: string | null;
  candidateName?: string | null;
  amount: number;
  baseAmount?: number | null;
  status: CommissionStatus;
  milestoneType?: string | null;
  warrantyEndDate?: string | null;
  warrantyStatus?: string | null;
  serviceFeeStatus?: ServiceFeeStatus | null;
  approvedAt?: string | null;
  createdAt: string;
  /** Only returned to users who record payouts (payout.manage). */
  affiliateBank?: AffiliateBank | null;
}

export interface AffiliateBank {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
}

/** GET/PUT /affiliates/profile/me/bank-account (the GET response is not wrapped in an envelope). */
export interface AffiliateBankAccount extends AffiliateBank {
  affiliateId?: string;
  displayName?: string | null;
  updatedAt?: string | null;
}

export interface Payout {
  payoutId: string;
  commissionId: string;
  amount: number;
  payoutDate?: string | null;
  method?: string | null;
  transactionReference?: string | null;
  status: PayoutStatus;
  attemptNo: number;
  createdAt: string;
}

export type WarrantyStatus = 'ACTIVE' | 'CLAIMED' | 'PASSED' | 'VOIDED';

export interface Warranty {
  warrantyId: string;
  placementId: string;
  companyName?: string | null;
  jobTitle?: string | null;
  candidateName?: string | null;
  position?: string | null;
  startDate: string;
  endDate?: string | null;
  status: WarrantyStatus;
  placementStatus: string;
  resultNote?: string | null;
  serviceFeeStatus?: ServiceFeeStatus | null;
  serviceFeeAmount?: number | null;
  commissionStatus?: CommissionStatus | null;
  commissionAmount?: number | null;
}

/** MF-05 replacement slot status */
export type ReplacementSlotStatus =
  | 'WAITING_PAYMENT'
  | 'OPEN'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED';

/** Full replacement slot details returned by GET /jobs/{jobId}/replacement-slots */
export interface ReplacementSlotDto {
  replacementSlotId: string;
  jobId: string;
  status: ReplacementSlotStatus;
  originalPlacementId: string;
  originalCandidateName: string | null;
  serviceFeeId: string;
  fillWindowDays: number;
  openedAt: string | null;
  expiresAt: string | null;
  filledByPlacementId: string | null;
  replacementCandidateName: string | null;
  closedAt: string | null;
  cancelReason: string | null;
  concurrencyToken: string;
  createdAt: string;
}

/** Short slot summary returned when resolving a resignation */
export interface ReplacementSummaryDto {
  replacementSlotId: string;
  jobId: string;
  status: ReplacementSlotStatus;
  expiresAt: string | null;
}

/** Body for POST /internal/replacement-slots/{replacementSlotId}/cancel */
export interface CancelReplacementSlotRequest {
  reason: string;
  concurrencyToken: string;
}

/** Response of POST /placements/{id}/resignation/resolve */
export interface WarrantyClaimResponse {
  placementId: string;
  warrantyStatus: WarrantyStatus;
  placementStatus: string;
  commissions: { commissionId: string; status: string }[];
  replacement?: ReplacementSummaryDto | null;
}

/** Placement summary item for linking warranty / replacement slots */
export interface PlacementListItem {
  placementId: string;
  applicationId: string;
  offerId: string;
  actualStartDate: string;
  position?: string | null;
  department?: string | null;
  status: string;
  candidate: {
    candidateId: string;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
  };
  job: {
    jobId: string;
    title: string;
    companyId: string;
    companyName: string;
  };
}

