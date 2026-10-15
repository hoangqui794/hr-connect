import { describe, expect, it } from 'vitest';
import {
  extractTemplateNonSkillRequirements,
  extractTemplateSkills,
  hasStep2Content,
  mergeSkillsCaseInsensitive,
} from './jobTemplateUtils';
import type { JobTemplate } from '@/types/api/jobs';

describe('JobTemplatePicker helpers', () => {
  describe('mergeSkillsCaseInsensitive', () => {
    it('merges existing skills and template skills without case-sensitive duplicates', () => {
      const existing = ['React', 'TypeScript'];
      const incoming = ['react', 'Docker', 'TYPESCRIPT', 'NodeJS'];

      const result = mergeSkillsCaseInsensitive(existing, incoming);
      expect(result).toEqual(['React', 'TypeScript', 'Docker', 'NodeJS']);
    });

    it('filters out empty or whitespace-only tags', () => {
      const existing = ['  ', ''];
      const incoming = ['  VueJS  ', ''];

      const result = mergeSkillsCaseInsensitive(existing, incoming);
      expect(result).toEqual(['VueJS']);
    });

    it('handles empty inputs gracefully', () => {
      expect(mergeSkillsCaseInsensitive([], [])).toEqual([]);
      expect(mergeSkillsCaseInsensitive(undefined as any, undefined as any)).toEqual([]);
    });
  });

  describe('hasStep2Content', () => {
    it('returns false for completely empty values', () => {
      expect(hasStep2Content({})).toBe(false);
      expect(
        hasStep2Content({
          title: '',
          description: '',
          benefits: '',
          skills: [],
          requirements: [{ requirementType: 'MUST_HAVE', content: '' }],
        })
      ).toBe(false);
    });

    it('returns true if title is provided', () => {
      expect(hasStep2Content({ title: 'Frontend Dev' })).toBe(true);
    });

    it('returns true if description is provided', () => {
      expect(hasStep2Content({ description: 'Mô tả công việc' })).toBe(true);
    });

    it('returns true if skills are provided', () => {
      expect(hasStep2Content({ skills: ['React'] })).toBe(true);
    });

    it('returns true if non-empty requirements exist', () => {
      expect(
        hasStep2Content({
          requirements: [{ requirementType: 'MUST_HAVE', content: '3 năm kinh nghiệm' }],
        })
      ).toBe(true);
    });
  });

  describe('Template mapping logic', () => {
    const mockTemplate: JobTemplate = {
      templateId: 'tpl-100',
      code: 'IT_REACT_MID',
      name: 'Lập trình viên React',
      industry: 'IT',
      level: 'MIDDLE',
      keywords: 'react, ts',
      summary: 'Mô tả tóm tắt',
      title: 'Kỹ sư React Frontend',
      description: 'Phát triển ứng dụng React',
      benefits: 'Bảo hiểm, thưởng dự án',
      employmentType: 'FULL_TIME',
      minExperienceYears: 2,
      maxExperienceYears: 4,
      requirements: [
        { requirementType: 'MUST_HAVE', category: 'EXPERIENCE', content: '2 năm React' },
        { requirementType: 'SHOULD_HAVE', category: 'EDUCATION', content: 'Tốt nghiệp ĐH' },
        { requirementType: 'SHOULD_HAVE', category: 'SKILL', content: 'React' },
        { requirementType: 'SHOULD_HAVE', category: 'SKILL', content: 'Redux' },
      ],
      isActive: true,
      usageCount: 5,
      updatedAt: '2026-10-15T00:00:00Z',
      concurrencyToken: null,
    };

    it('separates skill requirements and maps non-skill requirements properly', () => {
      const nonSkillRequirements = mockTemplate.requirements
        .filter((r) => (r.category || '').toUpperCase() !== 'SKILL')
        .map((r) => ({
          requirementType: r.requirementType,
          content: r.content,
          category: r.category ?? undefined,
        }));

      expect(nonSkillRequirements).toEqual([
        { requirementType: 'MUST_HAVE', content: '2 năm React', category: 'EXPERIENCE' },
        { requirementType: 'SHOULD_HAVE', content: 'Tốt nghiệp ĐH', category: 'EDUCATION' },
      ]);

      const templateSkills = mockTemplate.requirements
        .filter((r) => (r.category || '').toUpperCase() === 'SKILL')
        .map((r) => r.content.trim())
        .filter(Boolean);

      expect(templateSkills).toEqual(['React', 'Redux']);

      const currentSkills = ['react', 'TypeScript'];
      const mergedSkills = mergeSkillsCaseInsensitive(currentSkills, templateSkills);
      expect(mergedSkills).toEqual(['react', 'TypeScript', 'Redux']);
    });
  });
});
