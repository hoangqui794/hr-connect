/**
 * @file types/api/jobs.ts
 * @description MF-01 API contracts, mirrored from the backend
 * (HRConnect.Application/Features/Jobs). Keep field names identical to the
 * camelCase JSON the API returns — the backend is the source of truth.
 */

export type JobStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PENDING_APPROVAL'
  | 'PENDING_AGREEMENT'
  | 'PENDING_PAYMENT'
  | 'REJECTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type JobRequirementType = 'MUST_HAVE' | 'SHOULD_HAVE';
export type ServiceTypeCode = 'CV_APPLICATION' | 'CV_SOURCING' | 'HEADHUNT_COD';

export type JobRejectReasonCode =
  | 'REJECTED_INCOMPLETE_DESCRIPTION'
  | 'REJECTED_INCOMPLETE_REQUIREMENTS'
  | 'REJECTED_TERMS_NOT_AGREED'
  | 'REJECTED_OTHER';

export type JobCloseReasonCode =
  | 'CLOSED_POSITION_FILLED'
  | 'CLOSED_BY_CLIENT'
  | 'CLOSED_EXPIRED'
  | 'CLOSED_QUOTA_REACHED'
  | 'CLOSED_OTHER';

/** JobRequirementDto */
export interface JobRequirement {
  requirementId: string;
  requirementType: JobRequirementType;
  category: string | null;
  content: string;
  weight: number | null;
}

/** JobSkillDto */
export interface JobSkill {
  skillId: string;
  skillName: string | null;
  isMandatory: boolean;
  weight: number | null;
}

/** JobStatusHistoryDto */
export interface JobStatusHistory {
  jobStatusHistoryId: string;
  oldStatus: JobStatus | null;
  newStatus: JobStatus;
  changedBy: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  changedAt: string;
}

/** Public, sanitized company profile returned by GET /jobs/{jobId}. */
export interface PublicJobCompany {
  companyId: string;
  companyName: string;
  logoUrl: string | null;
  industry: string | null;
  companySize: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  isVerified: boolean;
}

/** JobProposedTermsRequest / JobProposedTermsDto — fees the Client proposes (MF-01 A2). */
export interface ProposedTerms {
  feeMultiplier?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;
  /** CV_SOURCING price per CV. */
  pricePerCv?: number | null;
  note?: string | null;
}

/** JobCommercialTermsDto — terms Internal HR agreed at approval (MF-01 A5). */
export interface CommercialTerms {
  serviceTypeCode: ServiceTypeCode | null;
  feeMultiplier: number | null;
  warrantyDays: number | null;
  paymentDueDays: number | null;
  sourcingTarget: number | null;
  pricePerCv: number | null;
  depositPercent: number | null;
  reviewDays: number | null;
  agreedAt: string | null;
  agreedBy: string | null;
  agreementReference?: string | null;
  agreementNote?: string | null;
}

/** CommercialTermsApprovalRequest — numbers Internal HR finalizes (MF-01 A4.2). */
export interface CommercialTermsInput {
  feeMultiplier?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;
  sourcingTarget?: number | null;
  pricePerCv?: number | null;
  depositPercent?: number | null;
  reviewDays?: number | null;
}

export interface ApproveJobInput {
  commercialTerms?: CommercialTermsInput | null;
  /** Required by the API when the agreed numbers differ from the Client's proposal. */
  agreementReference?: string | null;
  note?: string | null;
  paymentReference?: string | null;
}

type TermValues = Partial<Record<keyof CommercialTermsInput, number | null>>;
type TermRange = { min: number; max: number };

/** GET /internal/jobs/{id}/commercial-terms/defaults → data (MF-01 A4.1). */
export interface CommercialTermsDefaults {
  serviceTypeCode: ServiceTypeCode;
  proposed?: TermValues & { note?: string | null };
  adminDefaults?: TermValues;
  prefill: TermValues | null;
  ranges?: Partial<Record<keyof CommercialTermsInput, TermRange>>;
  estimatedTotal?: number;
  estimatedDeposit?: number;
}

/** JobDto — returned by detail, mine, review and inside action responses. */
export interface Job {
  jobId: string;
  companyId: string;
  companyName: string | null;
  /** Present on Job detail; list endpoints only guarantee companyId/companyName. */
  company?: PublicJobCompany | null;
  serviceTypeId: string;
  serviceTypeCode: ServiceTypeCode | null;
  title: string;
  description: string | null;
  benefits: string | null;
  location: string | null;
  workingTime: string | null;
  employmentType: EmploymentType | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryNegotiable: boolean;
  salaryNote: string | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  currencyCode: string;
  quantity: number;
  status: JobStatus;
  statusReason: string | null;
  postedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
  sourcingTarget?: number | null;
  sourcingPricePerCv?: number | null;
  feeMultiplier?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;
  postingPackageId?: string | null;
  postingPackageCode?: 'FREE' | 'STANDARD' | null;
  postingPackageName?: string | null;
  postingFeeStatus?: 'PENDING' | 'PAID' | 'CANCELLED' | null;
  expiresAt?: string | null;
  maxApplications?: number | null;
  requirements: JobRequirement[];
  skills: JobSkill[];
  statusHistories: JobStatusHistory[];
  applicationDeadline?: string | null;
  isAcceptingApplications?: boolean;
  proposedTerms?: ProposedTerms | null;
  commercialTerms?: CommercialTerms | null;
  templateId?: string | null;
}

export interface JobPostingEligibility {
  canUseFreePackage: boolean;
  reason?: string | null;
  activeJobsCount: number;
  freeActiveLimit: number;
  lastPostedAt?: string | null;
  nextFreeAvailableDate?: string | null;
}

export interface JobPostingPackage {
  packageId: string;
  code: 'FREE' | 'STANDARD';
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  maxApplications?: number | null;
  isActive: boolean;
}

export interface JobPostingFee {
  postingFeeId: string;
  jobId: string;
  packageId: string;
  packageCode: string | null;
  packageName: string | null;
  amount: number;
  currencyCode: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  paidAt: string | null;
  paymentReference: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** JobPageDto — GET /jobs */
export interface JobPage {
  items: Job[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** JobActionResponse — update/submit/pause/resume/close/approve/reject */
export interface JobActionResponse {
  success: boolean;
  message: string;
  data: Job;
}

/** CreateJobResponse — POST /jobs (201). Only the id matters to the UI. */
export interface CreateJobResponse {
  success: boolean;
  message: string;
  data: { jobId: string; title: string };
}

/** CreateJobRequirementRequest */
export interface JobRequirementInput {
  requirementType: JobRequirementType;
  category?: string | null;
  content: string;
  weight?: number | null;
}

/** Body shared by CreateJobCommand and UpdateJobCommand (Update adds concurrencyToken). */
export interface JobUpsertInput {
  serviceTypeId: string;
  title?: string | null;
  description?: string | null;
  benefits?: string | null;
  location?: string | null;
  workingTime?: string | null;
  employmentType?: EmploymentType | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable: boolean;
  salaryNote?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  currencyCode: string;
  quantity: number;
  /** CV_SOURCING: number of CVs the Client wants. */
  sourcingTarget?: number | null;
  postingPackageId?: string | null;
  requirements: JobRequirementInput[];
  /** Kept empty for Client: the skills catalog (GET /skills) is candidate-only today. */
  skills: { skillId: string; isMandatory: boolean; weight?: number | null }[];
  applicationDeadline?: string | null;
  proposedTerms?: ProposedTerms | null;
  templateId?: string | null;
}

/** GET /jobs query (page and pageSize are required by the API). */
export interface JobSearchParams {
  search?: string;
  location?: string;
  employmentType?: EmploymentType;
  serviceTypeId?: string;
  salaryMin?: number;
  salaryMax?: number;
  page: number;
  pageSize: number;
}

/** ServiceTypeDto — GET /service-types */
export interface ServiceType {
  id: string;
  code: ServiceTypeCode;
  name: string;
  description: string | null;
  isActive: boolean;
}

// ── Job Templates (MF-01 F1, F2 & F3) ───────────────────────────────────────
export type JobTemplateIndustry = 'IT' | 'MARKETING' | 'SALES' | 'ACCOUNTING' | 'HR' | 'ADMIN';
export type JobTemplateLevel = 'INTERN' | 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'LEAD';

export interface JobTemplateRequirement {
  requirementType: JobRequirementType;
  /** EXPERIENCE | SKILL | EDUCATION | OTHER; SKILL = kỹ năng, hiện ở ô "Kỹ năng chính". */
  category: string | null;
  content: string;
}

/** GET /job-templates và /internal/job-templates → data.items[] */
export interface JobTemplateSummary {
  templateId: string;
  code: string;
  name: string;
  /** Mã ngành; backend có thể thêm ngành mới nên vẫn để kiểu string. */
  industry: JobTemplateIndustry | string;
  level: JobTemplateLevel | null;
  summary: string | null;
  requirementCount: number;
  usageCount: number;
  isActive: boolean;
  updatedAt: string;
}

export interface JobTemplatePage {
  items: JobTemplateSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** GET /job-templates/{id} và /internal/job-templates/{id} → data */
export interface JobTemplate {
  templateId: string;
  code: string;
  name: string;
  industry: JobTemplateIndustry | string;
  level: JobTemplateLevel | null;
  keywords: string | null;
  summary: string | null;
  title: string;
  description: string;
  benefits: string | null;
  employmentType: EmploymentType | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  requirements: JobTemplateRequirement[];
  isActive: boolean;
  usageCount: number;
  updatedAt: string;
  /** null ở API của Client; có giá trị ở /internal/job-templates/{id} và sau khi tạo/sửa. */
  concurrencyToken: string | null;
}

/** Body POST /internal/job-templates và trường `template` của PUT. */
export interface JobTemplateUpsertInput {
  code: string;
  name: string;
  industry: string;
  level?: JobTemplateLevel | null;
  keywords?: string | null;
  summary?: string | null;
  title: string;
  description: string;
  benefits?: string | null;
  employmentType?: EmploymentType | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  requirements: JobTemplateRequirement[];
}

export type ServiceAgreementStatus =
  | 'DRAFT'
  | 'SENT_TO_CLIENT'
  | 'CHANGE_REQUESTED'
  | 'ACCEPTED'
  | 'AWAITING_SIGNATURE'
  | 'SIGNED'
  | 'VOID'
  | 'LEGACY_CONFIRMED';

export interface ServiceAgreementDto {
  serviceAgreementId: string;
  jobId: string;
  companyId: string;
  version: number;
  serviceTypeCode: string;
  status: ServiceAgreementStatus;
  concurrencyToken: string;
  isCurrent: boolean;

  feeMultiplier?: number | null;
  warrantyDays?: number | null;
  paymentDueDays?: number | null;
  pricePerQualifiedCv?: number | null;
  sourcingTarget?: number | null;
  reviewDays?: number | null;
  agreementNote?: string | null;
  changeRequestReason?: string | null;

  companyName: string;
  companyTaxCode?: string | null;
  companyAddress?: string | null;

  signerUserId?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  signerRole?: string | null;
  consentTextVersion?: string | null;
  consentAcceptedAt?: string | null;

  verificationCode: string;
  hasUnsignedDocument: boolean;
  hasSignedDocument: boolean;
  documentSha256Hash?: string | null;

  createdByUserId: string;
  createdAt: string;
  sentToClientAt?: string | null;
  respondedAt?: string | null;
  signedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
}

export interface CreateServiceAgreementProposalInput {
  concurrencyToken?: string;
  feeMultiplier?: number;
  warrantyDays?: number;
  paymentDueDays?: number;
  pricePerQualifiedCv?: number;
  sourcingTarget?: number;
  reviewDays?: number;
  agreementReference?: string;
  agreementNote?: string;
}

export interface RespondServiceAgreementInput {
  concurrencyToken: string;
  action: 'ACCEPT' | 'REQUEST_CHANGES';
  changeRequestReason?: string;
}

export interface CreateSignatureChallengeResponse {
  challengeId: string;
  serviceAgreementId: string;
  signerEmail: string;
  expiresAt: string;
  message: string;
  concurrencyToken?: string;
  devOtp?: string;
}

export interface SignServiceAgreementInput {
  concurrencyToken: string;
  otp: string;
  consentAccepted: boolean;
  consentTextVersion?: string;
}

export interface AgreementDocumentDownloadResponse {
  downloadUrl: string;
  expiresAt: string;
}


