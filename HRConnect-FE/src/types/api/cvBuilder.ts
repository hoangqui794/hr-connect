/**
 * @file cvBuilder.ts
 * @description Type definitions for Candidate Structured CV Builder and CV Templates (SF-06).
 */

export interface CvTemplateConfig {
  accentColor?: string;
  density?: 'normal' | 'compact' | string;
  sections?: string[];
  fontFamily?: string;
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

export interface StructuredCvProject {
  id?: string;
  name: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface StructuredCvActivity {
  id?: string;
  organization: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface StructuredCvAward {
  id?: string;
  title: string;
  year?: string;
  issuer?: string;
}

export interface StructuredCvReference {
  id?: string;
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
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
  // TopCV Extended Profile fields
  avatarUrl?: string;
  dob?: string;
  gender?: string;
  website?: string;
  shortTermGoal?: string;
  longTermGoal?: string;
  technicalSkills?: string[];
  softSkills?: string[];
  projects?: StructuredCvProject[];
  activities?: StructuredCvActivity[];
  awards?: StructuredCvAward[];
  references?: StructuredCvReference[];
  interests?: string[];
  additionalInfo?: string;
  // Layout customization state saved with CV
  selectedTemplateCode?: 'STANDARD' | 'MODERN_TWO_COL' | string;
  accentColor?: string;
  fontFamily?: string;
  fontSizeScale?: 'small' | 'normal' | 'large';
  density?: 'compact' | 'normal' | 'spacious';
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
