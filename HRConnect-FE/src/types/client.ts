/**
 * @file client.ts
 * @description Enterprise TypeScript DTOs & Contracts for Client / Company Module (Spec A-04).
 * Ready for RESTful API Backend integration.
 */

export type JobServiceType = 'HEADHUNT_COD' | 'CV_SOURCING' | 'CV_APPLICATION';

export type JobStatus = 'DRAFT' | 'PENDING_REVIEW' | 'OPEN' | 'REJECTED' | 'CLOSED';

export type CandidatePipelineStatus =
  | 'NEW_SUBMISSION'
  | 'AI_SCREENED'
  | 'INTERVIEW_SCHEDULED'
  | 'OFFER_SENT'
  | 'HIRED'
  | 'REJECTED';

export type InterviewResult = 'PASS' | 'FAIL' | 'BACKUP';

export type WarrantyStatus = 'IN_PROBATION' | 'PASSED' | 'FAILED_WARRANTY_TRIGGERED';

export type AiScoreTier = 'EXCELLENT' | 'HIGH' | 'MODERATE' | 'LOW';

export interface JobDTO {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  serviceType: JobServiceType;
  status: JobStatus;
  salaryMin: number;
  salaryMax: number;
  currency: 'VND';
  mustHaveSkills: string[];
  shouldHaveSkills: string[];
  submissionCount: number;
  shortlistedCount: number;
  createdAt: string;
}

export interface InterviewScheduleRequest {
  scheduledAt: string;
  interviewType: 'ONLINE' | 'OFFLINE';
  meetingUrl?: string;
  location?: string;
  interviewer: string;
  goalResult?: InterviewResult;
  notes?: string;
}

export interface SendOfferRequest {
  salary: number;
  startDate: string;
  benefits?: string;
  probationWarranty: boolean; // default true for HEADHUNT_COD
  notes?: string;
}

export interface CandidateApplicationDTO {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  currentRole: string;
  currentCompany: string;
  companyName?: string;
  clientEmail?: string;
  clientId?: string;
  yoe: number;
  expectedSalary: number;
  status: CandidatePipelineStatus;
  aiMatchScore: number; // 0 - 100
  aiScoreTier: AiScoreTier;
  aiHighlights: string[];
  cvUrl: string;
  avatar?: string;
  email?: string;
  phone?: string;
  interviewDetails?: {
    scheduledAt: string;
    interviewType: 'ONLINE' | 'OFFLINE';
    meetingUrl?: string;
    location?: string;
    interviewer: string;
    result?: InterviewResult;
    notes?: string;
  };
  offerDetails?: {
    salary: number;
    startDate: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    notes?: string;
  };
}

export interface ProbationWarrantyDTO {
  id: string;
  applicationId: string;
  candidateName: string;
  candidateEmail?: string;
  jobTitle: string;
  companyName?: string;
  clientEmail?: string;
  clientId?: string;
  serviceType: 'HEADHUNT_COD';
  startDate: string; // YYYY-MM-DD
  probationDaysTotal: 60;
  passedDays: number;
  status: WarrantyStatus;
  warrantyEndDate: string; // YYYY-MM-DD
  avatar?: string;
  headhunterName?: string;
  resignationDate?: string;
  failReason?: string;
  note?: string;
  clientDecision?: 'PASSED' | 'FAILED';
  clientFeedbackDate?: string;
}
