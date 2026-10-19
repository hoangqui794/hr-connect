/**
 * @file cvBuilderApi.ts
 * @description API client and business validations for Candidate Structured CV Builder and CV Templates (SF-06).
 */

import { apiClient } from '../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type {
  CvTemplateDto,
  CreateStructuredCvRequest,
  UpdateStructuredCvRequest,
  StructuredCvDetailDto,
  StructuredCvContent,
} from '@/types/api/cvBuilder';

/**
 * Validates structured CV content according to business rules:
 * - fullName is required.
 * - At least one of summary, experiences, educations, or skills must be provided.
 */
export const validateStructuredCvContent = (
  content: StructuredCvContent,
  title?: string
): { isValid: boolean; error?: string } => {
  if (title !== undefined && !title.trim()) {
    return { isValid: false, error: 'Tiêu đề CV không được để trống.' };
  }

  if (!content.fullName || !content.fullName.trim()) {
    return { isValid: false, error: 'Họ và tên là thông tin bắt buộc.' };
  }

  const hasSummary = Boolean(content.summary && content.summary.trim());
  const hasExperiences =
    Array.isArray(content.experiences) &&
    content.experiences.some((exp) => exp.title?.trim() || exp.company?.trim());
  const hasEducations =
    Array.isArray(content.educations) &&
    content.educations.some((edu) => edu.school?.trim() || edu.degree?.trim());
  const hasSkills = Array.isArray(content.skills) && content.skills.length > 0;

  if (!hasSummary && !hasExperiences && !hasEducations && !hasSkills) {
    return {
      isValid: false,
      error:
        'Bắt buộc phải có ít nhất 1 trong các mục: Mục tiêu nghề nghiệp, Kinh nghiệm làm việc, Học vấn, hoặc Kỹ năng.',
    };
  }

  return { isValid: true };
};

export const cvBuilderApi = {
  /**
   * GET /api/v1/cv-templates
   * Retrieves available CV layout templates.
   */
  async getTemplates(): Promise<CvTemplateDto[]> {
    const res = await apiClient.get<ApiEnvelope<CvTemplateDto[]> | CvTemplateDto[]>('/cv-templates');
    if (Array.isArray(res.data)) {
      return res.data;
    }
    if (res.data && 'data' in res.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }
    return [];
  },

  /**
   * POST /api/v1/candidates/cv/structured
   * Creates a new CV from a template or platform builder.
   */
  async createStructuredCv(payload: CreateStructuredCvRequest): Promise<StructuredCvDetailDto> {
    const res = await apiClient.post<ApiEnvelope<StructuredCvDetailDto> | StructuredCvDetailDto>(
      '/candidates/cv/structured',
      payload
    );
    if (res.data && 'data' in res.data && res.data.data) {
      return res.data.data;
    }
    return res.data as StructuredCvDetailDto;
  },

  /**
   * GET /api/v1/candidates/cv/structured/{cvId}
   * Retrieves structured CV data to populate the edit form.
   */
  async getStructuredCv(cvId: string): Promise<StructuredCvDetailDto> {
    const res = await apiClient.get<ApiEnvelope<StructuredCvDetailDto> | StructuredCvDetailDto>(
      `/candidates/cv/structured/${encodeURIComponent(cvId)}`
    );
    if (res.data && 'data' in res.data && res.data.data) {
      return res.data.data;
    }
    return res.data as StructuredCvDetailDto;
  },

  /**
   * PUT /api/v1/candidates/cv/structured/{cvId}
   * Updates existing structured CV content.
   */
  async updateStructuredCv(
    cvId: string,
    payload: UpdateStructuredCvRequest
  ): Promise<StructuredCvDetailDto> {
    const res = await apiClient.put<ApiEnvelope<StructuredCvDetailDto> | StructuredCvDetailDto>(
      `/candidates/cv/structured/${encodeURIComponent(cvId)}`,
      payload
    );
    if (res.data && 'data' in res.data && res.data.data) {
      return res.data.data;
    }
    return res.data as StructuredCvDetailDto;
  },
};

export default cvBuilderApi;
