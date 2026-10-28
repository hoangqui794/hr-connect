/**
 * @file cvBuilder.ts
 * @description Type definitions for Candidate Structured CV Builder and CV Templates (SF-06).
 */

export type CvLayoutStyle =
  | 'ats'
  | 'classic'
  | 'modern'
  | 'compact'
  | 'executive'
  | 'elegant'
  | 'minimal';

export type CvFontFamily = 'BE_VIETNAM_PRO' | 'ROBOTO' | 'INTER';

export interface CvPresentationConfig {
  accentColor: string;
  density: 'normal' | 'compact' | 'spacious';
  fontFamily: CvFontFamily;
  layout: CvLayoutStyle;
  visibleSections: Array<'summary' | 'experiences' | 'educations' | 'skills' | 'languages' | 'certificates'>;
}

export interface CvTemplateConfig {
  accentColor?: string;
  density?: 'normal' | 'compact' | 'spacious' | string;
  sections?: string[];
  fontFamily?: CvFontFamily;
  layout?: CvLayoutStyle;
}

export interface CvTemplateDto {
  cvTemplateId: string;
  code: string;
  name: string;
  description?: string;
  templateConfig?: CvTemplateConfig;
}

export interface StructuredCvExperience {
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface StructuredCvEducation {
  school: string;
  degree: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface StructuredCvContent {
  fullName: string;
  headline?: string;
  email?: string;
  phone?: string;
  address?: string;
  summary?: string;
  experiences: StructuredCvExperience[];
  educations: StructuredCvEducation[];
  skills: string[];
  languages: string[];
  certificates: string[];
  presentation?: CvPresentationConfig;
  selectedTemplateCode?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSizeScale?: 'small' | 'normal' | 'large' | string;
  density?: 'compact' | 'normal' | 'spacious' | string;
}

export interface CreateStructuredCvRequest {
  title: string;
  cvTemplateId: string | null;
  isPrimary: boolean;
  structuredContent: StructuredCvContent;
}

export interface UpdateStructuredCvRequest {
  title: string;
  cvTemplateId?: string | null;
  structuredContent: StructuredCvContent;
}

export interface StructuredCvDetailDto {
  cvId: string;
  title: string;
  cvTemplateId: string | null;
  isPrimary: boolean;
  creationMethod: 'TEMPLATE_FORM' | 'PLATFORM_BUILDER' | 'UPLOAD' | string;
  structuredContent: StructuredCvContent;
  pdfUrl?: string | null;
  fileName?: string | null;
  updatedAt?: string;
}
