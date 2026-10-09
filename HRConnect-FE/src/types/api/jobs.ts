/**
 * @file types/api/jobs.ts
 * @description MF-01 API contracts, mirrored from the backend
 * (HRConnect.Application/Features/Jobs). Keep field names identical to the
 * camelCase JSON the API returns — the backend is the source of truth.
 */

export type JobStatus = 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type JobVisibility = 'PUBLIC' | 'PARTNER_ONLY' | 'INTERNAL_ONLY';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type JobRequirementType = 'MUST_HAVE' | 'SHOULD_HAVE';
export type ServiceTypeCode = 'CV_APPLICATION' | 'CV_SOURCING' | 'HEADHUNT_COD';

export type JobRejectReasonCode =
  | 'REJECTED_INCOMPLETE_DESCRIPTION'
  | 'REJECTED_INCOMPLETE_REQUIREMENTS'
  | 'REJECTED_OTHER';

export type JobCloseReasonCode = 'CLOSED_POSITION_FILLED' | 'CLOSED_BY_CLIENT' | 'CLOSED_OTHER';

/** JobRequirementDto */
export interface JobRequirement {
  requirementId: string;
  requirementType: JobRequirementType;
  category: string | null;
  content: string;
  weight: number | null;
}

/** JobSkillDto */
export interface JobSkill {
  skillId: string;
  skillName: string | null;
  isMandatory: boolean;
  weight: number | null;
}

/** JobStatusHistoryDto */
export interface JobStatusHistory {
  jobStatusHistoryId: string;
  oldStatus: JobStatus | null;
  newStatus: JobStatus;
  changedBy: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  changedAt: string;
}

/** JobDto — returned by detail, mine, review and inside action responses. */
export interface Job {
  jobId: string;
  companyId: string;
  companyName: string | null;
  serviceTypeId: string;
  serviceTypeCode: ServiceTypeCode | null;
  title: string;
  description: string | null;
  benefits: string | null;
  location: string | null;
  workingTime: string | null;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryNegotiable: boolean;
  salaryNote: string | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  currencyCode: string;
  quantity: number;
  status: JobStatus;
  visibility: JobVisibility;
  statusReason: string | null;
  postedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
  sourcingTarget?: number | null;
  sourcingPricePerCv?: number | null;
  feeMultiplier?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;
  requirements: JobRequirement[];
  skills: JobSkill[];
  statusHistories: JobStatusHistory[];
}

/** JobPageDto — GET /jobs */
export interface JobPage {
  items: Job[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** JobActionResponse — update/submit/pause/resume/close/approve/reject */
export interface JobActionResponse {
  success: boolean;
  message: string;
  data: Job;
}

/** CreateJobResponse — POST /jobs (201). Only the id matters to the UI. */
export interface CreateJobResponse {
  success: boolean;
  message: string;
  data: { jobId: string; title: string };
}

/** CreateJobRequirementRequest */
export interface JobRequirementInput {
  requirementType: JobRequirementType;
  category?: string | null;
  content: string;
  weight?: number | null;
}

/** Body shared by CreateJobCommand and UpdateJobCommand (Update adds concurrencyToken). */
export interface JobUpsertInput {
  serviceTypeId: string;
  title?: string | null;
  description?: string | null;
  benefits?: string | null;
  location?: string | null;
  workingTime?: string | null;
  employmentType?: EmploymentType | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable: boolean;
  salaryNote?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  currencyCode: string;
  quantity: number;
  visibility: JobVisibility;
  sourcingTarget?: number | null;
  sourcingPricePerCv?: number | null;
  feeMultiplier?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;
  requirements: JobRequirementInput[];
  /** Kept empty for Client: the skills catalog (GET /skills) is candidate-only today. */
  skills: { skillId: string; isMandatory: boolean; weight?: number | null }[];
}

/** GET /jobs query (page and pageSize are required by the API). */
export interface JobSearchParams {
  search?: string;
  location?: string;
  employmentType?: EmploymentType;
  serviceTypeId?: string;
  salaryMin?: number;
  salaryMax?: number;
  page: number;
  pageSize: number;
}

/** ServiceTypeDto — GET /service-types */
export interface ServiceType {
  id: string;
  code: ServiceTypeCode;
  name: string;
  description: string | null;
  isActive: boolean;
}
