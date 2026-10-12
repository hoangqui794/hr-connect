/** Candidate-owned CV contracts. */
export interface CandidateCv {
  cvId: string;
  title: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  isPrimary: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  submissionUsageCount: number;
  applicationUsageCount: number;
  isReferenced: boolean;
  deleteBehavior: 'HARD_DELETE' | 'ARCHIVE_HISTORY' | string;
}

