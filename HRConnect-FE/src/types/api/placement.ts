/**
 * @file placement.ts
 * @description Type definitions for Placement Detail (MF-04 / MF-05 / FE-tasks-sang Section 7).
 */

export interface PlacementCandidateDto {
  candidateId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  summary?: string | null;
}

export interface PlacementJobDto {
  jobId: string;
  title: string;
  companyId: string;
  companyName: string;
}

export interface PlacementOfferDto {
  offerId: string;
  salary?: number | null;
  currencyCode?: string | null;
  startDate?: string | null;
  status: string;
  offerDocumentUrl?: string | null;
}

export interface PlacementProbationDto {
  probationId: string;
  startDate: string;
  endDate?: string | null;
  result?: string | null;
  notes?: string | null;
}

export interface PlacementWarrantyDto {
  warrantyId: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  resultNote?: string | null;
}

export interface PlacementFinancialDto {
  serviceFeeId?: string;
  serviceFeeAmount?: number | null;
  serviceFeeStatus?: string | null;
  commissionId?: string;
  commissionAmount?: number | null;
  commissionStatus?: string | null;
  affiliateName?: string | null;
}

export interface PlacementDetailDto {
  placementId: string;
  applicationId: string;
  offerId: string;
  actualStartDate: string;
  position?: string | null;
  department?: string | null;
  status: string;
  confirmedAt: string;
  confirmedBy?: string | null;
  confirmedByName?: string | null;
  confirmationNote?: string | null;
  candidate: PlacementCandidateDto;
  job: PlacementJobDto;
  offer: PlacementOfferDto;
  probation?: PlacementProbationDto | null;
  warranty?: PlacementWarrantyDto | null;
  financial?: PlacementFinancialDto | null;
  allowedActions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlacementDetailResponse {
  success?: boolean;
  data?: PlacementDetailDto;
}
