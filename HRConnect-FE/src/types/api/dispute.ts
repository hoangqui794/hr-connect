/**
 * @file dispute.ts
 * @description Type definitions for SF-04 Duplicate & Attribution Disputes.
 */

export type DisputeType = 'DUPLICATE_SUBMISSION' | 'ATTRIBUTION';
export type DisputeStatus = 'OPEN' | 'UPHELD' | 'REJECTED';

export interface MyDisputeDto {
  disputeId: string;
  disputeType: DisputeType | string;
  status: DisputeStatus | string;
  submissionId: string | null;
  jobTitle: string | null;
  candidateName: string | null;
  description: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminDisputeListItemDto {
  disputeId: string;
  disputeType: DisputeType | string;
  status: DisputeStatus | string;
  jobTitle: string | null;
  candidateName: string | null;
  raisedBy: string;
  raisedByAffiliateName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  concurrencyToken: string;
}

export interface DisputeSubmissionDto {
  submissionId: string;
  submittedBy: string;
  affiliateName: string | null;
  source: string;
  status: string;
  submittedAt: string;
  consentStatus: string | null;
  consentRespondedAt: string | null;
  isDisputed: boolean;
}

export interface DisputeAttributionDto {
  attributionId: string;
  affiliateUserId: string;
  affiliateName: string | null;
  winningSubmissionId: string;
  attributionRule: string;
  establishedAt: string;
  commissionStatuses: string[];
  placementConfirmedAt: string | null;
}

export interface AdminDisputeDetailDto {
  disputeId: string;
  disputeType: DisputeType | string;
  status: DisputeStatus | string;
  description: string;
  evidence: string;
  raisedBy: string;
  raisedByAffiliateName: string | null;
  createdAt: string;
  jobId: string | null;
  jobTitle: string | null;
  candidateId: string | null;
  candidateName: string | null;
  candidateNormalizedEmail: string | null;
  candidateNormalizedPhone: string | null;
  submissions: DisputeSubmissionDto[];
  currentAttribution: DisputeAttributionDto | null;
  candidateDuplicateCaseId: string | null;
  resolvedBy: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  concurrencyToken: string;
}

export interface DisputePageDto {
  items: AdminDisputeListItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CreateDisputeRequest {
  disputeType: DisputeType | string;
  submissionId: string;
  description: string;
  evidenceNote?: string;
}

export interface ResolveDisputeRequest {
  decision: 'UPHELD' | 'REJECTED';
  resolution: string;
  concurrencyToken: string;
  idempotencyKey: string;
}
