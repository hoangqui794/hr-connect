/**
 * @file candidateSavedJobs.ts
 * @description DTOs and query types for Candidate Saved Jobs (MF-01 & FE-tasks-sang Mục 5).
 * Matches backend contracts in HRConnect.Application/Features/Candidates/SavedJobs.
 */

import type { EmploymentType, JobStatus, ServiceTypeCode } from './jobs';

export interface SavedJobCompanyDto {
  companyId: string;
  companyName: string;
  logoUrl?: string | null;
  isVerified?: boolean;
}

export interface JobListItemDto {
  jobId: string;
  title: string;
  companyId: string;
  companyName: string | null;
  serviceTypeId?: string;
  serviceTypeCode?: ServiceTypeCode | string | null;
  location: string | null;
  employmentType: EmploymentType | string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryNegotiable?: boolean;
  currencyCode: string;
  status: JobStatus | string;
  statusReason?: string | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  postedAt: string | null;
  applicationDeadline?: string | null;
  isAcceptingApplications?: boolean;
  company?: SavedJobCompanyDto | null;
  skills?: string[];
}

export interface SavedJobDto {
  savedJobId: string;
  savedAt: string;
  job: JobListItemDto;
  // Fallbacks if flat payload or alternative structure is returned
  jobId?: string;
  title?: string;
}

export interface SavedJobPageDto {
  items: SavedJobDto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface SaveJobResponse {
  success?: boolean;
  message: string;
  savedJobId?: string | null;
}

export interface SavedJobQueryParams {
  page?: number;
  pageSize?: number;
}
