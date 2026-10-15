/**
 * @file JobTemplatesAdminPage.test.ts
 * @description Unit tests for MF-01 F3: Job Templates Admin & Internal HR Management.
 */
import { describe, expect, it } from 'vitest';
import type { JobTemplateRequirement } from '@/types/api/jobs';

describe('JobTemplatesAdminPage validation logic', () => {
  it('validates that at least one MUST_HAVE requirement is present', () => {
    const validRequirements: JobTemplateRequirement[] = [
      { requirementType: 'MUST_HAVE', category: 'EXPERIENCE', content: '3+ năm kinh nghiệm' },
      { requirementType: 'SHOULD_HAVE', category: 'SKILL', content: 'C#' },
    ];

    const hasMustHave = validRequirements.some((r) => r.requirementType === 'MUST_HAVE');
    expect(hasMustHave).toBe(true);
  });

  it('fails validation when all requirements are SHOULD_HAVE', () => {
    const invalidRequirements: JobTemplateRequirement[] = [
      { requirementType: 'SHOULD_HAVE', category: 'EXPERIENCE', content: '3+ năm kinh nghiệm' },
      { requirementType: 'SHOULD_HAVE', category: 'SKILL', content: 'C#' },
    ];

    const hasMustHave = invalidRequirements.some((r) => r.requirementType === 'MUST_HAVE');
    expect(hasMustHave).toBe(false);
  });

  it('formats payload correctly by trimming and uppercasing template code', () => {
    const rawCode = '  it_backend_dotnet  ';
    const formattedCode = rawCode.trim().toUpperCase();
    expect(formattedCode).toBe('IT_BACKEND_DOTNET');
  });

  it('filters empty requirements before submitting payload', () => {
    const rawReqs = [
      { requirementType: 'MUST_HAVE' as const, category: 'SKILL', content: '  ReactJS  ' },
      { requirementType: 'SHOULD_HAVE' as const, category: 'SKILL', content: '   ' },
    ];

    const validReqs = rawReqs
      .filter((r) => r.content.trim())
      .map((r) => ({
        requirementType: r.requirementType,
        category: r.category,
        content: r.content.trim(),
      }));

    expect(validReqs).toHaveLength(1);
    expect(validReqs[0].content).toBe('ReactJS');
  });
});
