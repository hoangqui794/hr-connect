import type { CvFontFamily, CvLayoutStyle, StructuredCvContent } from '@/types/api/cvBuilder';
import type { SectionVisibility } from '../CvSidebarTools';

const DRAFT_PREFIX = 'hrconnect.cv-builder.draft.v2';

export interface CvBuilderDraft {
  version: 2;
  savedAt: string;
  title: string;
  isPrimary: boolean;
  selectedTemplateId: string | null;
  accentColor: string;
  fontFamily: CvFontFamily;
  layout: CvLayoutStyle;
  density: 'compact' | 'normal' | 'spacious';
  showAvatar: boolean;
  sectionVisibility: SectionVisibility;
  content: StructuredCvContent;
}

export const cvBuilderDraftKey = (userId: string, cvId?: string): string =>
  `${DRAFT_PREFIX}:${userId}:${cvId || 'new'}`;

export const readCvBuilderDraft = (key: string): CvBuilderDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CvBuilderDraft;
    return parsed?.version === 2 && parsed.content ? parsed : null;
  } catch {
    return null;
  }
};

export const writeCvBuilderDraft = (key: string, draft: Omit<CvBuilderDraft, 'version' | 'savedAt'>): CvBuilderDraft => {
  const saved: CvBuilderDraft = { ...draft, version: 2, savedAt: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(saved));
  return saved;
};

export const removeCvBuilderDraft = (key: string): void => {
  if (typeof window !== 'undefined') localStorage.removeItem(key);
};
