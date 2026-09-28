export enum CVMode {
  PLATFORM_BUILDER = 'PLATFORM_BUILDER',
  TEMPLATE_BASED = 'TEMPLATE_BASED',
  FILE_UPLOAD = 'FILE_UPLOAD',
}

export enum ScoreTier {
  TOP_FIT = 'TOP_FIT',     // >= 80%
  STRONG = 'STRONG',        // 70-79%
  MODERATE = 'MODERATE',    // 60-69%
  WEAK = 'WEAK',            // < 60%
}

export const SCORE_TIER_CONFIG: Record<
  ScoreTier,
  { label: string; color: string; bgColor: string; min: number; max: number }
> = {
  [ScoreTier.TOP_FIT]: {
    label: 'Phù hợp xuất sắc',
    color: '#ef4444',
    bgColor: '#fef2f2',
    min: 80,
    max: 100,
  },
  [ScoreTier.STRONG]: {
    label: 'Phù hợp cao',
    color: '#0d9488',
    bgColor: '#f0fdfa',
    min: 70,
    max: 79,
  },
  [ScoreTier.MODERATE]: {
    label: 'Phù hợp trung bình',
    color: '#65a30d',
    bgColor: '#f7fee7',
    min: 60,
    max: 69,
  },
  [ScoreTier.WEAK]: {
    label: 'Chưa phù hợp',
    color: '#64748b',
    bgColor: '#f8fafc',
    min: 0,
    max: 59,
  },
};

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return ScoreTier.TOP_FIT;
  if (score >= 70) return ScoreTier.STRONG;
  if (score >= 60) return ScoreTier.MODERATE;
  return ScoreTier.WEAK;
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  SCREENING = 'SCREENING',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEWED = 'INTERVIEWED',
  OFFER_SENT = 'OFFER_SENT',
  OFFER_ACCEPTED = 'OFFER_ACCEPTED',
  OFFER_DECLINED = 'OFFER_DECLINED',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum LanguageLevel {
  NATIVE = 'NATIVE',
  C2 = 'C2',
  C1 = 'C1',
  B2 = 'B2',
  B1 = 'B1',
  A2 = 'A2',
  A1 = 'A1',
}

export interface CandidateHighlightCard {
  currentSalary: number;
  expectedSalary: number;
  currency: 'VND' | 'USD';
  yearsOfExperience: number;
  primaryLanguage: string;
  languageLevel: LanguageLevel;
  availabilityDate: string; // ISO date string
  noticePeriod: number; // days
  headline: string;
}

export interface CVSection {
  id: string;
  type: 'summary' | 'experience' | 'education' | 'skills' | 'certifications' | 'projects';
  title: string;
  content: string;
  order: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedInUrl?: string;
  location: string;
  avatar?: string;
  currentTitle: string;
  currentCompany: string;
  cvMode: CVMode;
  cvUrl?: string;
  cvSections?: CVSection[];
  highlightCard: CandidateHighlightCard;
  skills: string[];
  industries: string[];
  applicationStatus?: ApplicationStatus;
  aiScore?: number;
  scoreTier?: ScoreTier;
  submittedBy?: string; // affiliateId
  submittedAt?: string;
  firstSubmissionTimestamp?: string;
  referredJobId?: string;
  auditRejectReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningResult {
  candidateId: string;
  jobId: string;
  semanticScore: number;
  scoreTier: ScoreTier;
  matchedSkills: string[];
  missingSkills: string[];
  aiSummary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  screenedAt: string;
  screenedBy: 'AI' | string;
}
