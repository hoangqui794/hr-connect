/**
 * @file candidateInterview.ts
 * @description Type definitions for Candidate Interview Details (MF-04 / FE-tasks-sang Section 6).
 */

export type InterviewType = 'ONLINE' | 'OFFLINE' | string;

export type InterviewStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | string;

export interface InterviewParticipantDetailDto {
  userId: string;
  name?: string | null;
  role: string;
}

export interface InterviewStatusHistoryDetailDto {
  interviewStatusHistoryId: string;
  oldStatus?: string | null;
  newStatus: string;
  oldScheduledAt?: string | null;
  newScheduledAt?: string | null;
  changedBy?: string | null;
  changedByName?: string | null;
  reason?: string | null;
  changedAt: string;
}

export interface CandidateInterviewDetailDto {
  interviewId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  candidateId: string;
  candidateFullName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  interviewRound: number;
  interviewType?: InterviewType | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  meetingLink?: string | null;
  status: InterviewStatus;
  result?: string | null;
  feedback?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  recordedBy?: string | null;
  recordedByName?: string | null;
  recordedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  concurrencyToken?: string | null;
  participants: InterviewParticipantDetailDto[];
  statusHistories: InterviewStatusHistoryDetailDto[];
  notes?: string | null;
  isConfirmed?: boolean;
}

export interface CandidateInterviewDetailResponse {
  success: boolean;
  message?: string;
  data: CandidateInterviewDetailDto;
}

export interface CandidateConfirmAttendanceInput {
  interviewId: string;
  note?: string;
}

export interface CandidateRescheduleRequestInput {
  interviewId: string;
  reason: string;
  preferredTime?: string;
}
