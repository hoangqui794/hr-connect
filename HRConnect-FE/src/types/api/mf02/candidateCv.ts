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
  creationMethod?: 'UPLOAD' | 'TEMPLATE_FORM' | 'PLATFORM_BUILDER' | string | null;
  cvTemplateId?: string | null;
  id?: string;
  name?: string | null;
  isOnlineCv?: boolean;
  fileUrl?: string | null;
  previewUrl?: string | null;
}

