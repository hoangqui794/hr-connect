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
