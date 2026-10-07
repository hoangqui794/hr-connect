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

  // ── Internal HR ─────────────────────────────────────────────────────────────
  /** GET /internal/jobs/review — PENDING_REVIEW queue. */
  async getReviewQueue(): Promise<Job[]> {
    const res = await apiClient.get<Job[]>('/internal/jobs/review');
    return res.data;
  },

  /** POST /internal/jobs/{id}/approve — PENDING_REVIEW → ACTIVE; token in the query string. */
  async approve(jobId: string, concurrencyToken: string): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/internal/jobs/${jobId}/approve`, null, {
      params: { concurrencyToken },
    });
    return res.data;
  },

  /** POST /internal/jobs/{id}/reject — PENDING_REVIEW → REJECTED. */
  async reject(
    jobId: string,
    concurrencyToken: string,
    reasonCode: JobRejectReasonCode,
    reasonText: string
  ): Promise<JobActionResponse> {
    const res = await apiClient.post<JobActionResponse>(`/internal/jobs/${jobId}/reject`, {
      concurrencyToken,
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
