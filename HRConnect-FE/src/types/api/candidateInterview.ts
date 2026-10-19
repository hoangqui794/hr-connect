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

/**
 * Candidate-safe history. The API deliberately withholds the staff member and
 * internal reason that caused a change to an interview.
 */
export interface CandidateInterviewStatusHistoryDto {
  interviewStatusHistoryId: string;
  oldStatus?: string | null;
  newStatus: string;
  oldScheduledAt?: string | null;
  newScheduledAt?: string | null;
  changedAt: string;
}

export interface CandidateInterviewDetailDto {
  interviewId: string;
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  interviewRound: number;
  interviewType?: InterviewType | null;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  location?: string | null;
  meetingLink?: string | null;
  status: InterviewStatus;
  createdAt: string;
  updatedAt: string;
  statusHistories: CandidateInterviewStatusHistoryDto[];
}

export interface CandidateInterviewDetailResponse {
  success: boolean;
  message?: string;
  data: CandidateInterviewDetailDto;
}
