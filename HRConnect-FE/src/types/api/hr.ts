/**
 * @file types/api/hr.ts
 * @description Types for the Internal HR workspace, mirrored from the backend DTOs:
 * RecruitmentApplication* (Features/Recruitment), InterviewItemDto, OfferItemDto,
 * PlacementListItemDto and InternalHrProfileData.
 */

export interface PagedItems<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ApplicationStatus =
  | 'SUBMITTED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'REJECTED'
  | 'INTERVIEW'
  | 'BACKUP'
  | 'BACKUP_NOT_SELECTED'
  | 'INTERVIEW_FAILED'
  | 'OFFER_PENDING'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'NOT_STARTED'
  | 'WITHDRAWN'
  | 'PLACED'
  | 'CLOSED';

/** GET /recruitment/applications item. */
export interface RecruitmentApplicationItem {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  cvId: string | null;
  cvTitle: string | null;
  status: ApplicationStatus | string;
  currentStage: string | null;
  appliedAt: string;
  aiMatchScore: number | null;
  aiMatchTier: string | null;
  aiStatus: string | null;
  latestInterviewRound: number | null;
}

export interface RecruitmentApplicationSearchParams {
  status?: string;
  candidateName?: string;
  jobId?: string;
  page: number;
  pageSize: number;
}

export interface RecruitmentAiMatch {
  matchScore: number | null;
  matchTier: string | null;
  /** The backend stores a JSON array encoded as a string. */
  candidateHighlight: string | null;
  status: string | null;
  parseConfidence: number | null;
  requiresManualReview: boolean | null;
  semanticScore: number | null;
  warnings: string[];
  missingRequirements: string[];
  matchingReasons: string[];
}

/** GET /recruitment/applications/{id} data. */
export interface RecruitmentApplicationDetail {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  candidateId: string;
  candidateFullName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  currentAddress: string | null;
  yearsOfExperience: number | null;
  highestEducation: string | null;
  status: ApplicationStatus | string;
  currentStage: string | null;
  statusReason: string | null;
  statusReasonCode: string | null;
  appliedAt: string;
  updatedAt: string;
  plannedStartDate: string | null;
  concurrencyToken: string;
  cv: { cvId: string; title: string | null; fileName: string | null; fileSizeBytes: number | null; createdAt: string } | null;
  aiMatch: RecruitmentAiMatch | null;
  interviews: ApplicationInterview[];
  offers: ApplicationOffer[];
  placement: ApplicationPlacement | null;
  allowedActions: string[];
  serviceTypeCode: string | null;
  /** ClientCompany or InternalHr — who contacts the candidate after screening (MF-03). */
  contactOwner: string;
  isContactMasked: boolean;
}

export interface ApplicationInterview {
  interviewId: string;
  interviewRound: number;
  interviewType: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  meetingLink: string | null;
  status: string;
  result: string | null;
  feedback: string | null;
  concurrencyToken: string;
}

export interface ApplicationOffer {
  offerId: string;
  offerVersion: number;
  salary: number | null;
  currencyCode: string;
  startDate: string | null;
  expiryDate: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
  concurrencyToken: string;
}

export interface ApplicationPlacement {
  placementId: string;
  actualStartDate: string;
  position: string | null;
  department: string | null;
  status: string;
  confirmedAt: string;
  confirmationNote: string | null;
}

export interface ApplicationTimelineEvent {
  eventType: string;
  title: string;
  description: string | null;
  timestamp: string;
  actorUserId: string | null;
  actorName: string | null;
  status: string | null;
  reasonCode: string | null;
}

export interface UpdateScreeningStatusInput {
  targetStatus: 'SHORTLISTED' | 'REJECTED' | 'BACKUP';
  reasonCode?: string;
  reason?: string;
  concurrencyToken: string;
}

/** GET /interviews item. */
export interface InterviewItem {
  interviewId: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  candidateName: string;
  candidateEmail: string | null;
  interviewRound: number;
  interviewType: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  location: string | null;
  meetingLink: string | null;
  status: string;
  result: string | null;
}

/** GET /offers item. */
export interface OfferItem {
  offerId: string;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  candidateName: string;
  candidateEmail: string | null;
  offerVersion: number;
  salary: number | null;
  currencyCode: string;
  startDate: string | null;
  expiryDate: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
}

/** GET /placements item (this endpoint returns the page without the success/data envelope). */
export interface PlacementItem {
  placementId: string;
  applicationId: string;
  actualStartDate: string;
  position: string | null;
  department: string | null;
  status: string;
  confirmedAt: string;
  confirmedByName: string | null;
  candidate: { candidateId: string; fullName: string; email: string; phoneNumber: string | null };
  job: { jobId: string; title: string; companyId: string; companyName: string };
}

export interface InternalHrProfile {
  hrProfileId: string;
  userId: string;
  email: string;
  displayName: string;
  phone: string | null;
  employeeCode: string | null;
  department: string | null;
  jobTitle: string | null;
  status: string;
  updatedAt: string;
}

export interface InternalHrProfileInput {
  displayName: string;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
}
