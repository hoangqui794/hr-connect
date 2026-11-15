/**
 * @file types/api/sourcing.ts
 * @description Types for MF-03 CV_SOURCING delivery, client review and replacement.
 * Follows backend contracts defined in SourcingDeliveryFeatures.cs and SourcingDeliveryEndpoints.cs.
 */

export type SourcingDeliveryStatus =
  | 'DELIVERED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'AUTO_ACCEPTED'
  | 'REPLACED';

export type SourcingRejectReasonCode =
  | 'DUPLICATE_ALREADY_OWNED'
  | 'FALSE_INFORMATION'
  | 'UNREACHABLE'
  | 'WRONG_JOB'
  | 'OTHER';

export type SourcingRejectionReviewStatus =
  | 'PENDING_HR_REVIEW'
  | 'UPHELD'
  | 'OVERTURNED';

export interface SourcingDeliveryDto {
  deliveryId: string;
  applicationId: string;
  candidateName: string | null;
  status: SourcingDeliveryStatus;
  deliveredAt: string;
  reviewDueAt: string;
  daysLeft: number | null;
  decidedAt: string | null;
  rejectReasonCode: string | null;
  rejectNote: string | null;
  replacedByDeliveryId: string | null;
  rejectionReviewStatus?: SourcingRejectionReviewStatus | string | null;
  rejectionReviewNote?: string | null;
  rejectionReviewedAt?: string | null;
  replacementCandidateName?: string | null;
  aiMatchScore?: number | null;
}

export interface SourcingSummaryDto {
  sourcingTarget: number | null;
  delivered: number;
  accepted: number;
  autoAccepted: number;
  rejected: number;
  pendingReview: number;
  counted: number;
  reviewDays?: number | null;
  pricePerCv?: number | null;
  countedAmount?: number | null;
  depositPaidAmount?: number | null;
  remainingToDeliver?: number | null;
  jobStatus?: string | null;
}

export interface SourcingDeliveriesResponse {
  summary: SourcingSummaryDto;
  items: SourcingDeliveryDto[];
}

export interface DeliverCvsRequest {
  applicationIds: string[];
}

export interface DeliverCvsResponse {
  delivered: SourcingDeliveryDto[];
  summary: SourcingSummaryDto;
}

export interface DecideSourcingDeliveryRequest {
  decision: 'ACCEPTED' | 'REJECTED';
  reasonCode?: string;
  note?: string;
}

export interface ReviewSourcingRejectionRequest {
  upheld: boolean;
  note?: string;
}

export interface ReplaceSourcingDeliveryRequest {
  applicationId: string;
}
