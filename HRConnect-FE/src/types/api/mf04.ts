/**
 * @file mf04.ts
 * @description API contract types for MF-04 Candidate Profile & Recruitment Lifecycle.
 */

export interface CandidateSkillItemDto {
  skillId?: string;
  skillName?: string | null;
  category?: string | null;
  proficiencyLevel?: string | null;
  yearsOfExperience?: number | null;
}

export interface CandidateCvItemDto {
  cvId?: string;
  title?: string | null;
  creationMethod?: string | null;
  sourceFileUrl?: string | null;
  renderedFileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  isPrimary?: boolean;
  updatedAt?: string;
}

export interface CandidateProfileData {
  candidateId: string;
  userId?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentAddress?: string | null;
  highestEducation?: string | null;
  yearsOfExperience?: number | null;
  summary?: string | null;
  profileVisibility?: string | null;
  status?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // 9 Career Fields
  currentJobTitle?: string | null;
  currentLevel?: string | null;
  targetRole?: string | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  expectedSalaryCurrency?: string | null;
  availableFrom?: string | null;
  preferredLocations?: string[] | null;
  preferredWorkModes?: string[] | null;

  skills?: CandidateSkillItemDto[] | null;
  primaryCv?: CandidateCvItemDto | null;
}

export interface CandidateProfileResponse {
  success: boolean;
  message?: string | null;
  data?: CandidateProfileData;
}

export interface UpdateCandidateProfileCommand {
  fullName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentAddress?: string | null;
  highestEducation?: string | null;
  yearsOfExperience?: number | null;
  summary?: string | null;

  // 9 Career Fields
  currentJobTitle?: string | null;
  currentLevel?: string | null;
  targetRole?: string | null;
  expectedSalaryMin?: number | null;
  expectedSalaryMax?: number | null;
  expectedSalaryCurrency?: string | null;
  availableFrom?: string | null;
  preferredLocations?: string[] | null;
  preferredWorkModes?: string[] | null;
}

export interface UpdateProfileVisibilityCommand {
  visibility: 'PUBLIC' | 'PRIVATE' | string;
}

// ─── Recruitment Application Detail ─────────────────────────────────────────

export interface CandidateSubmittedCvDto {
  cvId: string;
  title?: string | null;
  fileName?: string | null;
}

export interface CandidateInterviewSummaryDto {
  interviewId: string;
  interviewRound: number;
  interviewType?: string | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  meetingLink?: string | null;
  status: string;
  /** Present when the backend exposes Candidate attendance confirmation. */
  isConfirmed?: boolean;
  concurrencyToken: string;
}

export interface CandidateOfferSummaryDto {
  offerId: string;
  offerVersion: number;
  salary?: number | null;
  currencyCode: string;
  startDate?: string | null;
  expiryDate?: string | null;
  validUntil?: string | null;
  expiresAt?: string | null;
  status: string;
  offerDocumentUrl?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  declineReason?: string | null;
  concurrencyToken: string;
  canRespond: boolean;
}

export interface CandidatePlacementSummaryDto {
  placementId: string;
  actualStartDate: string;
  position?: string | null;
  department?: string | null;
  status: string;
}

export interface CandidateRecruitmentApplicationDetailDto {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  candidateId: string;
  status: string;
  currentStage?: string | null;
  statusReason?: string | null;
  appliedAt: string;
  updatedAt: string;
  plannedStartDate?: string | null;
  concurrencyToken: string;
  submittedCv?: CandidateSubmittedCvDto | null;
  interviews: CandidateInterviewSummaryDto[];
  offers: CandidateOfferSummaryDto[];
  placement?: CandidatePlacementSummaryDto | null;
  allowedActions: string[];
}

export interface ApplicationTimelineEventDto {
  eventType: string;
  title: string;
  description?: string | null;
  timestamp: string;
  actorUserId?: string | null;
  actorName?: string | null;
  status?: string | null;
  reasonCode?: string | null;
}

export interface ApplicationTimelineData {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  currentStatus: string;
  events: ApplicationTimelineEventDto[];
}

export interface ApplicationCvDownloadUrlData {
  applicationId: string;
  cvId: string;
  fileName: string;
  mimeType: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface WithdrawApplicationRequest {
  reason?: string;
  concurrencyToken?: string;
}

export interface RespondOfferRequest {
  response: 'ACCEPTED' | 'DECLINED';
  declineReason?: string;
  concurrencyToken?: string;
}
