/**
 * @file domain.ts
 * @description Canonical domain type barrel for HR Connect platform.
 * All feature-level code should import shared domain types from this file.
 * Type sources live in individual type modules; this file re-exports them
 * and defines cross-cutting domain interfaces not owned by a single feature.
 */

// ─── Re-exports from feature type modules ────────────────────────────────────

export {
  ServiceType,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_DESCRIPTIONS,
  JobStatus,
} from './job';
export type { HardTag, SalaryRange, Job, JobWizardDraft } from './job';
export { DEFAULT_WIZARD_DRAFT } from './job';

export {
  CVMode,
  ScoreTier,
  SCORE_TIER_CONFIG,
  getScoreTier,
  ApplicationStatus,
  LanguageLevel,
} from './candidate';
export type {
  CandidateHighlightCard,
  CVSection,
  Candidate,
  ScreeningResult,
} from './candidate';

export {
  PayoutStatus,
  PAYOUT_STATUS_CONFIG,
} from './affiliate';
export type {
  TrustRating,
  Commission,
  BankDetails,
  LedgerSummary,
  PayoutRequest,
  DuplicateSubmission,
  OfflinePayoutEvidence,
  AuditTrailEntry,
} from './affiliate';

export {
  UserRole,
  ROLE_LABELS,
  ROLE_COLORS,
  DEMO_USERS,
} from './roles';
export type { UserProfile } from './roles';

// ─── ColorTier ───────────────────────────────────────────────────────────────
/**
 * ColorTier encodes the AI match tier into a visual signal system used
 * across scorecards, candidate cards, and pipeline views.
 *
 * RED   → Top Fit  (>=80% semantic score)
 * TEAL  → Strong   (70-79%)
 * GREEN → Moderate (60-69%)
 * GRAY  → Weak     (<60%)
 */
export enum ColorTier {
  RED = 'RED',
  TEAL = 'TEAL',
  GREEN = 'GREEN',
  GRAY = 'GRAY',
}

export const COLOR_TIER_CONFIG: Record<
  ColorTier,
  {
    label: string;
    hex: string;
    bg: string;
    border: string;
    antdColor: 'red' | 'cyan' | 'green' | 'default';
  }
> = {
  [ColorTier.RED]: {
    label: 'Phù hợp xuất sắc',
    hex: '#ef4444',
    bg: '#fef2f2',
    border: '#fecaca',
    antdColor: 'red',
  },
  [ColorTier.TEAL]: {
    label: 'Phù hợp cao',
    hex: '#0d9488',
    bg: '#f0fdfa',
    border: '#99f6e4',
    antdColor: 'cyan',
  },
  [ColorTier.GREEN]: {
    label: 'Phù hợp trung bình',
    hex: '#65a30d',
    bg: '#f7fee7',
    border: '#d9f99d',
    antdColor: 'green',
  },
  [ColorTier.GRAY]: {
    label: 'Chưa phù hợp',
    hex: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    antdColor: 'default',
  },
};

/** Maps a numeric AI score (0-100) to the ColorTier visual signal. */
export function scoreToColorTier(score: number): ColorTier {
  if (score >= 80) return ColorTier.RED;
  if (score >= 70) return ColorTier.TEAL;
  if (score >= 60) return ColorTier.GREEN;
  return ColorTier.GRAY;
}

// ─── JobRequisition ───────────────────────────────────────────────────────────
/**
 * JobRequisition is the fully-hydrated domain entity combining a posted Job
 * with its live pipeline counters. Used in dashboard views and the API contract.
 */
import type { ServiceType as ST } from './job';
import type { JobStatus as JS } from './job';
import type { SalaryRange as SR } from './job';

export interface JobRequisition {
  id: string;
  title: string;
  company: string;
  companyId: string;
  industryCode: string;
  industryLabel: string;
  serviceType: ST;
  status: JS;
  location: string;
  isRemote: boolean;
  salaryRange: SR;
  mustHaveTags: string[];
  shouldHaveTags: string[];
  objectives: string;
  kpis: string[];
  successCriteria: string;
  engagementTerms: {
    budget?: number;
    timelineDays: number;
    commissionRate: number;
    retainerFee?: number;
    warrantyDays: number;
  };
  headcount: number;
  filledCount: number;
  experienceYears: { min: number; max: number };
  description: string;
  requirements: string[];
  applicationCount: number;
  shortlistedCount: number;
  inScreeningCount: number;
  interviewCount: number;
  deadline?: string;
  clientContactId: string;
  internalHRId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

// ─── CandidateProfile ─────────────────────────────────────────────────────────
import type { CVMode as CM } from './candidate';
import type { CandidateHighlightCard as CHC } from './candidate';
import type { ApplicationStatus as AS } from './candidate';
import type { ScreeningResult as SCR } from './candidate';

/**
 * CandidateProfile is the view-model representation of a Candidate used in
 * client/HR pipeline views. Adds computed UI fields (colorTier, initials).
 */
export interface CandidateProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  linkedInUrl?: string;
  location: string;
  currentTitle: string;
  currentCompany: string;
  skills: string[];
  industries: string[];
  cvMode: CM;
  cvUrl?: string;
  highlightCard: CHC;
  aiScore: number;
  colorTier: ColorTier;
  applicationStatus: AS;
  submittedBy?: string;
  submittedAt?: string;
  firstSubmissionTimestamp?: string;
  referredJobId?: string;
  screeningResult?: SCR;
  createdAt: string;
  updatedAt: string;
}

// ─── AIHighlightCard ─────────────────────────────────────────────────────────
/**
 * AIHighlightCard is the structured output produced by the AI screening engine
 * for a candidate-job pair. Displayed in the Screening Dashboard and Candidate
 * Card flyout.
 */
export interface AIHighlightCard {
  candidateId: string;
  jobId: string;
  /** Semantic similarity score: 0-100 */
  semanticScore: number;
  colorTier: ColorTier;
  /** One-sentence AI-generated candidate headline */
  aiHeadline: string;
  /** Paragraph narrative explaining the match */
  aiNarrative: string;
  matchedMustHaveTags: string[];
  missingMustHaveTags: string[];
  matchedShouldHaveTags: string[];
  strengths: string[];
  concerns: string[];
  recommendation: 'SHORTLIST' | 'CONSIDER' | 'PASS';
  screenedAt: string;
}

// ─── CommissionLedgerItem ─────────────────────────────────────────────────────
import type { PayoutStatus as PS } from './affiliate';
import type { BankDetails as BD } from './affiliate';

/**
 * CommissionLedgerItem is the flat view-model row used in the Financial Ledger
 * table. It merges Commission, candidate, and job data for display.
 */
export interface CommissionLedgerItem {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  candidateId: string;
  candidateName: string;
  candidateTitle: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  commissionRate: number;
  baseSalary: number;
  commissionAmount: number;
  currency: 'VND' | 'USD';
  payoutStatus: PS;
  hiredAt: string;
  probationStartDate: string;
  probationEndDate: string;
  probationDaysRemaining: number;
  probationProgressPct: number;
  warrantyExpired: boolean;
  payoutRequestedAt?: string;
  paidAt?: string;
  bankDetails?: BD;
}

// ─── UserRoleDescriptor ────────────────────────────────────────────────────
import type { UserRole as UR } from './roles';

/**
 * UserRoleDescriptor provides UI-facing metadata for each actor.
 * Used in the Role Switcher and onboarding flows.
 */
export interface UserRoleDescriptor {
  role: UR;
  label: string;
  description: string;
  color: string;
  icon: string;
  portalName: string;
  capabilities: string[];
}
