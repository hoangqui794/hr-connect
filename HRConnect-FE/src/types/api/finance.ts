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

export type ServiceFeeStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type CommissionStatus = 'PENDING' | 'EARNED' | 'PAYABLE' | 'PAID' | 'ON_HOLD' | 'CANCELLED';
export type PayoutStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ServiceFee {
  serviceFeeId: string;
  placementId: string;
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
  paidAt?: string | null;
  paymentReference?: string | null;
  createdAt: string;
}

export interface Commission {
  commissionId: string;
  placementId: string;
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
