/**
 * @file mf01.ts
 * @description Type definitions and DTO contracts for Main Flow 1 (MF-01):
 * Create, Review, and Publish Jobs in HRConnect.
 * Conforms strictly to swagger.json root specifications.
 */

// ─── Enums & Literals ────────────────────────────────────────────────────────

export enum JobStatusEnum {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
}

export type JobVisibility = 'PUBLIC' | 'AFFILIATE_ONLY';
export type JobRequirementType = 'MUST_HAVE' | 'SHOULD_HAVE';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE';

// ─── Service Types Contracts ─────────────────────────────────────────────────

export interface ServiceTypeDto {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetServiceTypesData {
  items: ServiceTypeDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GetServiceTypesResponse {
  success: boolean;
  message?: string | null;
  data: GetServiceTypesData;
}

export interface GetServiceTypeDetailResponse {
  success: boolean;
  message?: string | null;
  data: ServiceTypeDto;
}

export interface GetServiceTypesParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc' | string;
}

// ─── Job Requirements Contract ───────────────────────────────────────────────

export interface CreateJobRequirementRequest {
  requirementType: JobRequirementType | string;
  category?: string | null;
  content: string;
  weight?: number;
}

// ─── Client Commands & Responses ────────────────────────────────────────────

export interface CreateJobCommand {
  serviceTypeId: string;
  title: string;
  description: string;
  location?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode?: string | null;
  quantity?: number;
  visibility?: JobVisibility | string | null;
  requirements?: CreateJobRequirementRequest[] | null;
}

export interface CreateJobData {
  jobId: string;
  companyId: string;
  serviceTypeId: string;
  title?: string | null;
  status?: string | null;
  visibility?: string | null;
  requirementCount: number;
  createdAt: string;
}

export interface CreateJobResponse {
  success: boolean;
  message?: string | null;
  data: CreateJobData;
}

export interface UpdateJobCommand {
  serviceTypeId: string;
  title: string;
  description: string;
  location?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode?: string | null;
  quantity?: number;
  visibility?: JobVisibility | string | null;
  requirements?: CreateJobRequirementRequest[] | null;
}

export interface PauseJobCommand {
  reason?: string | null;
}

export interface CloseJobCommand {
  reason?: string | null;
}

export interface RejectJobCommand {
  reason?: string | null;
}

// ─── Standardized Job Detail DTO ────────────────────────────────────────────
// Standardized from CreateJobCommand + CreateJobData + Company info for:
// - GET /api/v1/jobs/{jobId}
// - GET /api/v1/jobs/mine
// - GET /api/v1/internal/jobs/review

export interface JobDetailDto {
  id: string;
  jobId: string;
  companyId: string;
  companyName?: string;
  serviceTypeId: string;
  serviceTypeName?: string;
  serviceType?: ServiceTypeDto | null;
  title: string;
  description: string;
  location?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode?: string | null;
  quantity?: number;
  visibility?: JobVisibility | string | null;
  status: JobStatusEnum | string;
  requirements?: CreateJobRequirementRequest[] | null;
  requirementCount?: number;
  rejectionReason?: string | null;
  pauseReason?: string | null;
  closeReason?: string | null;
  applicationCount?: number;
  shortlistedCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface GetMyJobsResponse {
  success: boolean;
  message?: string | null;
  data: JobDetailDto[];
}

export interface GetJobDetailResponse {
  success: boolean;
  message?: string | null;
  data: JobDetailDto;
}

export interface GetJobsForReviewResponse {
  success: boolean;
  message?: string | null;
  data: JobDetailDto[];
}

export interface CommonActionResponse {
  success: boolean;
  message?: string | null;
}
