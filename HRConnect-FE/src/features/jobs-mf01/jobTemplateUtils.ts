/**
 * @file jobTemplateUtils.ts
 * @description Pure utility functions for MF-01 Job Template library (F1 & F2).
 * Separated from React components for fast, reliable testing and clean code reuse.
 */
import type { JobTemplate, JobTemplateRequirement } from '@/types/api/jobs';

export const mergeSkillsCaseInsensitive = (existing: string[] = [], incoming: string[] = []): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of [...existing, ...incoming]) {
    const clean = (s || '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }
  return result;
};

export const hasStep2Content = (values: {
  title?: string | null;
  description?: string | null;
  benefits?: string | null;
  skills?: string[] | null;
  requirements?: { content?: string | null; [key: string]: any }[] | null;
}): boolean => {
  if (values.title && values.title.trim().length > 0) return true;
  if (values.description && values.description.trim().length > 0) return true;
  if (values.benefits && values.benefits.trim().length > 0) return true;
  if (values.skills && values.skills.length > 0) return true;
  if (
    values.requirements &&
    values.requirements.some((r) => r && r.content && r.content.trim().length > 0)
  ) {
    return true;
  }
  return false;
};

export const extractTemplateSkills = (requirements: JobTemplateRequirement[] = []): string[] => {
  return requirements
    .filter((r) => (r.category || '').toUpperCase() === 'SKILL')
    .map((r) => r.content.trim())
    .filter(Boolean);
};

export const extractTemplateNonSkillRequirements = (
  requirements: JobTemplateRequirement[] = []
): { requirementType: 'MUST_HAVE' | 'SHOULD_HAVE'; content: string; category?: string }[] => {
  return requirements
    .filter((r) => (r.category || '').toUpperCase() !== 'SKILL')
    .map((r) => ({
      requirementType: r.requirementType,
      content: r.content,
      category: r.category ?? undefined,
    }));
};
