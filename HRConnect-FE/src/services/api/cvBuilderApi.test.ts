import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../apiClient';
import {
  cvBuilderApi,
  validateStructuredCvContent,
} from './cvBuilderApi';
import type {
  CreateStructuredCvRequest,
  UpdateStructuredCvRequest,
  StructuredCvContent,
} from '@/types/api/cvBuilder';

describe('cvBuilderApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateStructuredCvContent', () => {
    const validContent: StructuredCvContent = {
      fullName: 'Nguyễn Văn A',
      headline: 'Frontend Engineer',
      email: 'a@example.com',
      phone: '0912345678',
      summary: 'Kỹ sư phần mềm 3 năm kinh nghiệm',
      experiences: [
        {
          title: 'Dev',
          company: 'FPT',
          startDate: '2022',
        },
      ],
      educations: [
        {
          school: 'ĐH Bách Khoa',
          degree: 'CNTT',
          startDate: '2018',
        },
      ],
      skills: ['React', 'TypeScript'],
      languages: ['Tiếng Anh'],
      certificates: ['AWS Certified'],
    };

    it('returns error if title is empty', () => {
      const result = validateStructuredCvContent(validContent, '   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Tiêu đề CV không được để trống');
    });

    it('returns error if fullName is missing or whitespace', () => {
      const result = validateStructuredCvContent({ ...validContent, fullName: '   ' }, 'CV Title');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Họ và tên là thông tin bắt buộc');
    });

    it('returns error if all content sections (summary, experiences, educations, skills) are empty', () => {
      const emptyContent: StructuredCvContent = {
        fullName: 'Nguyễn Văn A',
        experiences: [],
        educations: [],
        skills: [],
        languages: [],
        certificates: [],
      };
      const result = validateStructuredCvContent(emptyContent, 'CV Title');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Bắt buộc phải có ít nhất 1 trong các mục');
    });

    it('passes if at least summary is present', () => {
      const contentWithSummaryOnly: StructuredCvContent = {
        fullName: 'Nguyễn Văn A',
        summary: 'Có 5 năm kinh nghiệm lập trình',
        experiences: [],
        educations: [],
        skills: [],
        languages: [],
        certificates: [],
      };
      const result = validateStructuredCvContent(contentWithSummaryOnly, 'CV Title');
      expect(result.isValid).toBe(true);
    });

    it('passes if at least skills are present', () => {
      const contentWithSkillsOnly: StructuredCvContent = {
        fullName: 'Nguyễn Văn A',
        experiences: [],
        educations: [],
        skills: ['React', 'Node.js'],
        languages: [],
        certificates: [],
      };
      const result = validateStructuredCvContent(contentWithSkillsOnly, 'CV Title');
      expect(result.isValid).toBe(true);
    });
  });

  describe('API endpoints', () => {
    it('getTemplates calls GET /cv-templates and returns template array', async () => {
      const mockTemplates = [
        {
          cvTemplateId: 'tpl-1',
          code: 'MODERN_TECH',
          name: 'Modern Tech',
          templateConfig: { accentColor: '#2563eb', density: 'normal' },
        },
      ];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: mockTemplates },
      });

      const result = await cvBuilderApi.getTemplates();

      expect(apiClient.get).toHaveBeenCalledWith('/cv-templates');
      expect(result).toEqual(mockTemplates);
    });

    it('getTemplates parses the JSON template config returned by the backend', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: {
          success: true,
          data: [{
            cvTemplateId: 'tpl-modern',
            code: 'MODERN_BLUE',
            name: 'Hiện đại',
            templateConfig: '{"accentColor":"#1D4ED8","density":"normal","fontFamily":"INTER","layout":"modern"}',
          }],
        },
      });

      const [template] = await cvBuilderApi.getTemplates();

      expect(template.templateConfig).toEqual({
        accentColor: '#1D4ED8',
        density: 'normal',
        fontFamily: 'INTER',
        layout: 'modern',
      });
    });

    it('createStructuredCv calls POST /candidates/cv/structured and returns created CV', async () => {
      const payload: CreateStructuredCvRequest = {
        title: 'CV Fullstack 2026',
        cvTemplateId: 'tpl-1',
        isPrimary: true,
        structuredContent: {
          fullName: 'Nguyễn Văn A',
          summary: 'Kỹ sư phần mềm',
          experiences: [],
          educations: [],
          skills: ['React'],
          languages: [],
          certificates: [],
        },
      };

      const mockResponse = {
        cvId: 'cv-new-1',
        title: payload.title,
        cvTemplateId: payload.cvTemplateId,
        isPrimary: true,
        creationMethod: 'TEMPLATE_FORM',
        structuredContent: payload.structuredContent,
        pdfUrl: 'https://cdn.hrconnect.vn/cv-new-1.pdf',
      };

      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { success: true, data: mockResponse },
      });

      const result = await cvBuilderApi.createStructuredCv(payload);

      expect(apiClient.post).toHaveBeenCalledWith('/candidates/cv/structured', payload);
      expect(result).toEqual(mockResponse);
    });

    it('getStructuredCv calls GET /candidates/cv/structured/:cvId', async () => {
      const mockResponse = {
        cvId: 'cv-100',
        title: 'CV Backend',
        cvTemplateId: null,
        isPrimary: false,
        creationMethod: 'PLATFORM_BUILDER',
        structuredContent: {
          fullName: 'Trần Văn B',
          experiences: [],
          educations: [],
          skills: ['Java'],
          languages: [],
          certificates: [],
        },
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
        data: { success: true, data: mockResponse },
      });

      const result = await cvBuilderApi.getStructuredCv('cv-100');

      expect(apiClient.get).toHaveBeenCalledWith('/candidates/cv/structured/cv-100');
      expect(result).toEqual(mockResponse);
    });

    it('updateStructuredCv calls PUT /candidates/cv/structured/:cvId with payload', async () => {
      const updatePayload: UpdateStructuredCvRequest = {
        title: 'CV Backend Cập nhật',
        cvTemplateId: 'tpl-2',
        structuredContent: {
          fullName: 'Trần Văn B',
          headline: 'Lead Engineer',
          experiences: [],
          educations: [],
          skills: ['Go', 'Kubernetes'],
          languages: [],
          certificates: [],
        },
      };

      const mockResponse = {
        cvId: 'cv-100',
        title: updatePayload.title,
        cvTemplateId: 'tpl-2',
        isPrimary: false,
        creationMethod: 'TEMPLATE_FORM',
        structuredContent: updatePayload.structuredContent,
      };

      vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
        data: { success: true, data: mockResponse },
      });

      const result = await cvBuilderApi.updateStructuredCv('cv-100', updatePayload);

      expect(apiClient.put).toHaveBeenCalledWith('/candidates/cv/structured/cv-100', updatePayload);
      expect(result).toEqual(mockResponse);
    });
  });
});
