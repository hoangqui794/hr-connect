/**
 * @file candidateKeys.ts
 * @description Centralized React Query keys for Candidate portal queries and invalidations.
 * Extracted to prevent circular dependencies between CandidatePages and its subcomponents.
 */
export const candidateKeys = {
  cvs: ['candidate-cvs'] as const,
  applications: ['candidate-applications'] as const,
  applicationDetail: (applicationId: string) => ['candidate-applications', applicationId] as const,
  applicationTimeline: (applicationId: string) => ['candidate-application-timeline', applicationId] as const,
  submissionConsents: (status: string) => ['candidate-submission-consents', status] as const,
};
