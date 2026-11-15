import type { OnlinePaymentTargetType } from '@/types/api/finance';
import type { ServiceTypeCode } from '@/types/api/jobs';
import type { Tone } from '@/features/admin-console/ui';

export type Bucket = 'UNPAID' | 'OVERDUE' | 'PAID' | 'OTHER';

export interface BreakdownLine {
  label: string;
  value: string;
}

export interface BillingRow {
  key: string;
  service: ServiceTypeCode;
  item: string;
  jobTitle: string;
  candidateName: string | null;
  /** Negative for a CREDIT returned to the Client. */
  amount: number;
  currencyCode: string;
  dueDate: string | null;
  statusLabel: string;
  tone: Tone;
  bucket: Bucket;
  paidAt: string | null;
  paymentReference: string | null;
  /** What to write on the bank transfer; shown by "Cách thanh toán". */
  transferNote: string | null;
  /** Unpaid and not held for reconciliation, so the Client can transfer now. */
  payable: boolean;
  /** What VNPay is asked to pay (service fee id, or job id for a posting fee). */
  payTarget: { type: OnlinePaymentTargetType; id: string };
  /** How the amount was worked out, shown in the payment dialog. */
  breakdown: BreakdownLine[];
  /** One line telling the Client why this row exists (refunds). */
  note?: string | null;
  /** Money HR Connect owes the Client, so the date is HR Connect's deadline. */
  owedToClient?: boolean;
  /** Accepted/counted CVs vs sourcing target for CV_SOURCING fees. */
  sourcingProgress?: { counted: number; target: number } | null;
  /** When the fee record was created, for traceability. */
  createdAt?: string | null;
  /** Related placement UUID for HEADHUNT_COD placement/refund fees. */
  placementId?: string | null;
  /** Reconciliation state holding payment open for HEADHUNT_COD placements. */
  reconciliationStatus?: 'PENDING' | 'CONFIRMED' | 'FLAGGED' | null;
  /** Whether the fee was cancelled (excluded from open refund KPIs). */
  cancelled?: boolean;
}
