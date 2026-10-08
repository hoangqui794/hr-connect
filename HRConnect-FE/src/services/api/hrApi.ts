/**
 * @file services/api/hrApi.ts
 * @description Internal HR endpoints: MF-03 screening (recruitment applications), read-only
 * MF-04 progress (interviews, offers, placements) and the HR profile.
 * Job review stays in jobsApi (MF-01).
 */
import { apiClient } from '../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type {
  ApplicationTimelineEvent,
  InternalHrProfile,
  InternalHrProfileInput,
  InterviewItem,
  OfferItem,
  PagedItems,
  PlacementItem,
  RecruitmentApplicationDetail,
  RecruitmentApplicationItem,
  RecruitmentApplicationSearchParams,
  UpdateScreeningStatusInput,
} from '@/types/api/hr';

const cleanParams = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>;

export const screeningApi = {
  /** GET /recruitment/applications — scoped by the backend to what the caller may see. */
  async list(params: RecruitmentApplicationSearchParams): Promise<PagedItems<RecruitmentApplicationItem>> {
    const res = await apiClient.get<ApiEnvelope<PagedItems<RecruitmentApplicationItem>>>('/recruitment/applications', {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  async get(applicationId: string): Promise<RecruitmentApplicationDetail> {
    const res = await apiClient.get<ApiEnvelope<RecruitmentApplicationDetail>>(`/recruitment/applications/${applicationId}`);
    return res.data.data;
  },

  async timeline(applicationId: string): Promise<ApplicationTimelineEvent[]> {
    const res = await apiClient.get<ApiEnvelope<{ events: ApplicationTimelineEvent[] }>>(
      `/recruitment/applications/${applicationId}/timeline`
    );
    return res.data.data.events;
  },

  /** POST …/start-screening — idempotent; moves SUBMITTED to SCREENING when the caller is the screener. */
  async startScreening(jobId: string, applicationId: string) {
    const res = await apiClient.post<ApiEnvelope<{ currentStatus: string; changed: boolean }>>(
      `/jobs/${jobId}/applications/${applicationId}/start-screening`
    );
    return res.data.data;
  },

  /** PATCH …/status — REJECTED needs a reasonCode (OTHER also needs a note). */
  async updateStatus(jobId: string, applicationId: string, input: UpdateScreeningStatusInput) {
    const res = await apiClient.patch<ApiEnvelope<unknown> & { message?: string }>(
      `/jobs/${jobId}/applications/${applicationId}/status`,
      input
    );
    return res.data;
  },

  /** GET …/cv/download-url — 10-minute signed link; 403 while a HEADHUNT_COD CV is hidden from the Client. */
  async cvDownloadUrl(applicationId: string): Promise<{ downloadUrl: string; fileName: string; expiresAt: string }> {
    const res = await apiClient.get<ApiEnvelope<{ downloadUrl: string; fileName: string; expiresAt: string }>>(
      `/recruitment/applications/${applicationId}/cv/download-url`
    );
    return res.data.data;
  },

  /** POST /internal/applications/{id}/ai-scoring/retry */
  async retryAiScoring(applicationId: string) {
    const res = await apiClient.post<{ success: boolean; message?: string }>(
      `/internal/applications/${applicationId}/ai-scoring/retry`
    );
    return res.data;
  },
};

export const pipelineApi = {
  async interviews(params: { status?: string; page: number; pageSize: number }): Promise<PagedItems<InterviewItem>> {
    const res = await apiClient.get<ApiEnvelope<PagedItems<InterviewItem>>>('/interviews', { params: cleanParams(params) });
    return res.data.data;
  },
  async offers(params: { status?: string; page: number; pageSize: number }): Promise<PagedItems<OfferItem>> {
    const res = await apiClient.get<ApiEnvelope<PagedItems<OfferItem>>>('/offers', { params: cleanParams(params) });
    return res.data.data;
  },
  async placements(params: { status?: string; page: number; pageSize: number }): Promise<PagedItems<PlacementItem>> {
    const res = await apiClient.get<{ items: PlacementItem[]; page: number; pageSize: number; totalCount: number; totalPages: number }>(
      '/placements',
      { params: cleanParams(params) }
    );
    const { totalCount, ...rest } = res.data;
    return { ...rest, total: totalCount };
  },
};

export const hrProfileApi = {
  async get(): Promise<InternalHrProfile> {
    return (await apiClient.get<ApiEnvelope<InternalHrProfile>>('/internal/profile/me')).data.data;
  },
  async update(input: InternalHrProfileInput) {
    return (await apiClient.put<ApiEnvelope<InternalHrProfile> & { message?: string }>('/internal/profile/me', input)).data;
  },
};

/** Inputs of the Client's MF-04 actions (backend request DTOs). */
export interface ScheduleInterviewInput {
  scheduledAt: string;
  durationMinutes?: number;
  interviewRound?: number;
  interviewType?: string;
  location?: string;
  meetingLink?: string;
  applicationConcurrencyToken: string;
}
export interface OfferInput {
  salary?: number;
  currencyCode?: string;
  startDate?: string;
  expiryDate?: string;
  offerDocumentUrl?: string;
  concurrencyToken?: string;
}

const post = async <T = { message?: string }>(url: string, body?: unknown) => (await apiClient.post<T>(url, body)).data;
const put = async <T = { message?: string }>(url: string, body?: unknown) => (await apiClient.put<T>(url, body)).data;

/** Client company actions after screening (MF-03 backup, MF-04 interview, offer, start of work). */
export const clientActionsApi = {
  scheduleInterview: (applicationId: string, input: ScheduleInterviewInput) =>
    post(`/recruitment/applications/${applicationId}/interviews`, input),
  rescheduleInterview: (interviewId: string, input: { newScheduledAt: string; reason: string; durationMinutes?: number; location?: string; meetingLink?: string; concurrencyToken: string }) =>
    post(`/interviews/${interviewId}/reschedule`, input),
  cancelInterview: (interviewId: string, input: { reason: string; concurrencyToken: string }) =>
    post(`/interviews/${interviewId}/cancel`, input),
  recordResult: (interviewId: string, input: { result: 'PASS' | 'FAIL' | 'BACKUP'; feedback?: string; isFinalRound?: boolean; nextAction?: string; concurrencyToken: string }) =>
    post(`/interviews/${interviewId}/result`, input),
  recordNoShow: (interviewId: string, input: { reason: string; concurrencyToken: string }) =>
    post(`/interviews/${interviewId}/no-show`, input),
  decideBackup: (applicationId: string, input: { decision: 'SELECT' | 'REJECT' | 'KEEP_ON_HOLD'; reason?: string; concurrencyToken: string }) =>
    post(`/recruitment/applications/${applicationId}/backup-decision`, input),
  createOffer: (applicationId: string, input: OfferInput) => post(`/recruitment/applications/${applicationId}/offers`, input),
  updateOffer: (offerId: string, input: OfferInput) => put(`/offers/${offerId}`, input),
  sendOffer: (offerId: string, concurrencyToken: string) => post(`/offers/${offerId}/send`, { concurrencyToken }),
  withdrawOffer: (offerId: string, input: { reason: string; concurrencyToken: string }) => post(`/offers/${offerId}/withdraw`, input),
  setPlannedStart: (applicationId: string, input: { plannedStartDate: string; reason?: string; concurrencyToken: string }) =>
    put(`/recruitment/applications/${applicationId}/planned-start-date`, input),
  confirmStartWork: (applicationId: string, input: { offerId: string; actualStartDate: string; confirmationNote?: string; position?: string; department?: string; concurrencyToken: string }) =>
    post(`/recruitment/applications/${applicationId}/start-work`, input),
  markNotStarted: (applicationId: string, input: { reason: string; concurrencyToken: string }) =>
    post(`/recruitment/applications/${applicationId}/not-started`, input),
};

/** GET/PUT /companies/profile/me */
export interface CompanyProfile {
  companyId: string;
  companyName: string;
  taxCode: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  [key: string]: unknown;
}
export const companyProfileApi = {
  async get(): Promise<CompanyProfile> {
    return (await apiClient.get<ApiEnvelope<CompanyProfile>>('/companies/profile/me')).data.data;
  },
  async update(input: Partial<CompanyProfile>) {
    return (await apiClient.put<{ message?: string }>('/companies/profile/me', input)).data;
  },
};
