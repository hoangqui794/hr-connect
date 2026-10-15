/**
 * @file services/api/jobsApi.ts
 * @description MF-01 job endpoints. One function per backend route; no UI logic.
 * Note the backend's mixed shapes: list/detail/review return the DTO directly,
 * actions return { success, message, data }.
 */
import { apiClient } from '../apiClient';
import type {
  ApproveJobInput,
  CommercialTermsDefaults,
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
  JobTemplate,
  JobTemplatePage,
  JobTemplateUpsertInput,
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

  /** GET /jobs/{id}/posting-fee — the job's fee record; null until approval creates it. */
  async getPostingFee(jobId: string): Promise<JobPostingFee | null> {
    const res = await apiClient.get<JobPostingFee | null>(`/jobs/${jobId}/posting-fee`);
    return res.data ?? null;
  },

  /** POST /jobs/{id}/posting-fee/pay — record payment for posting fee. */
  async payPostingFee(jobId: string, paymentReference?: string): Promise<JobPostingFee> {
    const res = await apiClient.post<JobPostingFee>(`/jobs/${jobId}/posting-fee/pay`, { paymentReference });
    return res.data;
  },

  // ── Job Templates (MF-01 F1 & F2) ──────────────────────────────────────────
  /** GET /job-templates — search active templates for job creation. */
  async searchTemplates(params: {
    keyword?: string;
    industry?: string;
    page?: number;
    pageSize?: number;
  }): Promise<JobTemplatePage> {
    const res = await apiClient.get<{ success: boolean; data: JobTemplatePage }>('/job-templates', {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  /** GET /job-templates/{id} — full template content for preview or prefilling. */
  async getTemplate(id: string): Promise<JobTemplate> {
    const res = await apiClient.get<{ success: boolean; data: JobTemplate }>(`/job-templates/${id}`);
    return res.data.data;
  },

  // ── MF-01 F3: Internal HR & Admin Job Template Management ───────────────────
  /** GET /internal/job-templates — list templates including inactive ones with filters. */
  async getInternalTemplates(params: {
    keyword?: string;
    industry?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<JobTemplatePage> {
    const res = await apiClient.get<{ success: boolean; data: JobTemplatePage }>('/internal/job-templates', {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  /** GET /internal/job-templates/{id} — full template detail with concurrencyToken for editing. */
  async getInternalTemplate(id: string): Promise<JobTemplate> {
    const res = await apiClient.get<{ success: boolean; data: JobTemplate }>(`/internal/job-templates/${id}`);
    return res.data.data;
  },

  /** POST /internal/job-templates — create a new job template. */
  async createInternalTemplate(data: JobTemplateUpsertInput): Promise<JobTemplate> {
    const res = await apiClient.post<{ success: boolean; data: JobTemplate }>('/internal/job-templates', data);
    return res.data.data;
  },

  /** PUT /internal/job-templates/{id} — update template with concurrency token. */
  async updateInternalTemplate(
    id: string,
    payload: { concurrencyToken: string; template: JobTemplateUpsertInput }
  ): Promise<JobTemplate> {
    const res = await apiClient.put<{ success: boolean; data: JobTemplate }>(
      `/internal/job-templates/${id}`,
      payload
    );
    return res.data.data;
  },

  /** POST /internal/job-templates/{id}/activate or /deactivate — toggle active status. */
  async toggleTemplateActive(id: string, activate: boolean): Promise<{ success: boolean }> {
    const action = activate ? 'activate' : 'deactivate';
    const res = await apiClient.post<{ success: boolean }>(`/internal/job-templates/${id}/${action}`);
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

  /** GET /internal/jobs/{id}/commercial-terms/defaults — Client proposal, admin defaults, prefill and ranges. */
  async getCommercialTermsDefaults(jobId: string): Promise<CommercialTermsDefaults> {
    const res = await apiClient.get<{ success: boolean; data: CommercialTermsDefaults }>(
      `/internal/jobs/${jobId}/commercial-terms/defaults`
    );
    return res.data.data;
  },

  /**
   * POST /internal/jobs/{id}/approve — PENDING_REVIEW → ACTIVE / PENDING_PAYMENT.
   * Body carries the agreed commercial terms; omitted numbers fall back to the Client proposal, then defaults.
   */
  async approve(jobId: string, concurrencyToken: string, input: ApproveJobInput = {}): Promise<JobActionResponse> {
    const { paymentReference, ...body } = input;
    const res = await apiClient.post<JobActionResponse>(
      `/internal/jobs/${jobId}/approve`,
      { concurrencyToken, ...body },
      { params: cleanParams({ concurrencyToken, paymentReference }) }
    );
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
