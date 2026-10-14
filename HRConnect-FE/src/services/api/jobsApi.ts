/**
 * @file services/api/jobsApi.ts
 * @description MF-01 job endpoints. One function per backend route; no UI logic.
 * Note the backend's mixed shapes: list/detail/review return the DTO directly,
 * actions return { success, message, data }.
 */
import { apiClient } from '../apiClient';
import type {
  CreateJobResponse,
  Job,
  JobActionResponse,
  JobCloseReasonCode,
  JobPage,
  JobPostingEligibility,
  JobPostingFee,
  JobPostingPackage,
  JobRejectReasonCode,
  JobSearchParams,
  JobStatus,
  JobUpsertInput,
  ServiceType,
} from '@/types/api/jobs';

/** Drops empty values so optional query params are not sent as "". */
const cleanParams = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ) as Partial<T>;

export const jobsApi = {
  // ── Guest / public Candidate scope ──────────────────────────────────────────
  /** GET /public/jobs — ACTIVE/PUBLIC jobs visible to the Candidate role. */
  async searchPublic(params: JobSearchParams): Promise<JobPage> {
    const res = await apiClient.get<JobPage>('/public/jobs', { params: cleanParams(params) });
    return res.data;
  },

  // ── Client Company ──────────────────────────────────────────────────────────
  /** GET /jobs/mine — jobs of the caller's company. */
  async getMine(status?: JobStatus): Promise<Job[]> {
    const res = await apiClient.get<Job[]>('/jobs/mine', { params: cleanParams({ status }) });
    return res.data;
  },

  /** POST /jobs — creates a DRAFT. */
  async create(input: JobUpsertInput): Promise<CreateJobResponse> {
    const res = await apiClient.post<CreateJobResponse>('/jobs', input);
    return res.data;
  },

  /** PUT /jobs/{id} — only DRAFT or REJECTED jobs. */
  async update(jobId: string, input: JobUpsertInput, concurrencyToken: string): Promise<JobActionResponse> {
    const res = await apiClient.put<JobActionResponse>(`/jobs/${jobId}`, { ...input, concurrencyToken });
    return res.data;
  },

  /** POST /jobs/{id}/submit — token travels in the query string. Needs >= 1 MUST_HAVE requirement. */
  async submit(jobId: string, concurrencyToken: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/jobs/${jobId}/submit`, null, {
      params: { concurrencyToken },
    });
    return res.data;
  },

  /** POST /jobs/{id}/pause — ACTIVE → PAUSED. */
  async pause(jobId: string, concurrencyToken: string, reasonText?: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/jobs/${jobId}/pause`, { concurrencyToken, reasonText });
    return res.data;
  },

  /** POST /jobs/{id}/resume — PAUSED → ACTIVE; token in the query string. */
  async resume(jobId: string, concurrencyToken: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/jobs/${jobId}/resume`, null, {
      params: { concurrencyToken },
    });
    return res.data;
  },

  /** POST /jobs/{id}/close — ACTIVE/PAUSED → CLOSED. */
  async close(
    jobId: string,
    concurrencyToken: string,
    reasonCode: JobCloseReasonCode,
    reasonText: string
  ): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/jobs/${jobId}/close`, {
      concurrencyToken,
      reasonCode,
      reasonText,
    });
    return res.data;
  },

  // ── Everyone with job.view ──────────────────────────────────────────────────
  /** GET /jobs — discoverable jobs for the caller's role. Requires login. */
  async search(params: JobSearchParams): Promise<JobPage> {
    const res = await apiClient.get<JobPage>('/jobs', { params: cleanParams(params) });
    return res.data;
  },

  /** GET /jobs/{id} */
  async getById(jobId: string): Promise<Job> {
    const res = await apiClient.get<Job>(`/jobs/${jobId}`);
    return res.data;
  },

  // ── Posting Packages & Fees (MF-01 B1 & B2) ───────────────────────────────
  /** GET /jobs/posting-packages — available CV_APPLICATION packages. */
  async getPostingPackages(): Promise<JobPostingPackage[]> {
    const res = await apiClient.get<JobPostingPackage[]>('/jobs/posting-packages');
    return res.data;
  },

  /** GET /jobs/posting-eligibility — check if company can use FREE posting package. */
  async getPostingEligibility(): Promise<JobPostingEligibility> {
    const res = await apiClient.get<JobPostingEligibility>('/jobs/posting-eligibility');
    return res.data;
  },

  /** GET /jobs/{id}/posting-fee — fee details of the job. */
  async getPostingFee(jobId: string): Promise<JobPostingFee> {
    const res = await apiClient.get<JobPostingFee>(`/jobs/${jobId}/posting-fee`);
    return res.data;
  },

  /** POST /jobs/{id}/posting-fee/pay — record payment for posting fee. */
  async payPostingFee(jobId: string, paymentReference?: string): Promise<JobPostingFee> {
    const res = await apiClient.post<JobPostingFee>(`/jobs/${jobId}/posting-fee/pay`, { paymentReference });
    return res.data;
  },

  // ── Internal HR ─────────────────────────────────────────────────────────────
  /** GET /internal/jobs/review — job review list with optional status filter (PENDING_REVIEW, ACTIVE, REJECTED, ALL). */
  async getReviewQueue(status?: string): Promise<Job[]> {
    const res = await apiClient.get<Job[]>('/internal/jobs/review', {
      params: cleanParams({ status }),
    });
    return res.data;
  },

  /** POST /internal/jobs/{id}/approve — PENDING_REVIEW → ACTIVE; token and paymentReference in query string. */
  async approve(jobId: string, concurrencyToken: string, paymentReference?: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/internal/jobs/${jobId}/approve`, null, {
      params: cleanParams({ concurrencyToken, paymentReference }),
    });
    return res.data;
  },

  /** POST /internal/jobs/{id}/reject — PENDING_REVIEW → REJECTED. */
  async reject(
    jobId: string,
    concurrencyToken: string,
    reasonCode: JobRejectReasonCode,
    reasonText: string,
    reason?: string
  ): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/internal/jobs/${jobId}/reject`, {
      concurrencyToken,
      reason: reason || reasonText || reasonCode,
      reasonCode,
      reasonText,
    });
    return res.data;
  },
};

export const serviceTypesApi = {
  /** GET /service-types?isActive=true — wrapped as { success, data: { items } }. */
  async getActive(): Promise<ServiceType[]> {
    const res = await apiClient.get<{ data: { items: ServiceType[] } }>('/service-types', {
      params: { isActive: true, pageSize: 100 },
    });
    return res.data.data.items;
  },
};
