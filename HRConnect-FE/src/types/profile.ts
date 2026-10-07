/**
 * @file profile.ts
 * @description Type definitions and DTO contracts for Profiles & Settings (Affiliate, Candidate, Client).
 * Derived strictly from swagger.json root specifications.
 */

// ─── 1. AFFILIATE RECRUITER (A-06) ──────────────────────────────────────────

export interface AffiliateProfileData {
  affiliateId: string;
  userId: string;
  email?: string | null;
  avatarUrl?: string | null;
  affiliateType?: string | null;
  displayName?: string | null;
  taxInformation?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AffiliateProfileResponse {
  success: boolean;
  message?: string | null;
  data?: AffiliateProfileData;
}

export interface UpdateAffiliateProfileCommand {
  displayName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  taxInformation?: string | null;
}

export interface UpdateAffiliateProfileData {
  affiliateId: string;
  userId: string;
  email?: string | null;
  avatarUrl?: string | null;
  affiliateType?: string | null;
  displayName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  taxInformation?: string | null;
  status?: string | null;
  verifiedAt?: string | null;
  updatedAt?: string;
}

export interface UpdateAffiliateProfileResponse {
  success: boolean;
  message?: string | null;
  data?: UpdateAffiliateProfileData;
}

export interface AffiliateBankAccountData {
  affiliateId: string;
  displayName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
  isConfigured: boolean;
  updatedAt?: string;
}

export interface AffiliateBankAccountResponse {
  success: boolean;
  message?: string | null;
  data?: AffiliateBankAccountData;
}

export interface UpdateAffiliateBankAccountCommand {
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
}

export interface UpdateAffiliateBankAccountData {
  affiliateId: string;
  displayName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
  updatedAt?: string;
}

export interface UpdateAffiliateBankAccountResponse {
  success: boolean;
  message?: string | null;
  data?: UpdateAffiliateBankAccountData;
}

export interface AffiliatePerformanceData {
  affiliateId: string;
  displayName?: string | null;
  affiliateType?: string | null;
  status?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  totalSubmissions: number;
  totalShortlisted: number;
  totalInterviews: number;
  totalPlacements: number;
  submissionToHireRate?: number | null;
  qualityRating?: number | null;
  ratingLabel?: string | null;
  calculationVersion?: string | null;
  calculatedAt?: string | null;
}

export interface AffiliatePerformanceResponse {
  success: boolean;
  message?: string | null;
  data?: AffiliatePerformanceData;
}

// ─── 2. CANDIDATE (A-05) ────────────────────────────────────────────────────

export interface CandidateSkillItemDto {
  skillId: string;
  skillName?: string | null;
  category?: string | null;
  proficiencyLevel?: string | null;
  yearsOfExperience?: number | null;
}

export interface CandidateCvItemDto {
  cvId: string;
  title?: string | null;
  creationMethod?: string | null;
  sourceFileUrl?: string | null;
  renderedFileUrl?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  isPrimary: boolean;
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
  profileVisibility?: 'PUBLIC' | 'PRIVATE' | string | null;
  status?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
}

export interface UpdateCandidateProfileData {
  candidateId: string;
  userId?: string | null;
  fullName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  currentAddress?: string | null;
  highestEducation?: string | null;
  yearsOfExperience?: number | null;
  summary?: string | null;
  profileVisibility?: string | null;
  updatedAt?: string;
}

export interface UpdateCandidateProfileResponse {
  success: boolean;
  message?: string | null;
  data?: UpdateCandidateProfileData;
}

export interface UpdateProfileVisibilityCommand {
  visibility: 'PUBLIC' | 'PRIVATE' | string;
}

export interface UpdateProfileVisibilityData {
  candidateId: string;
  userId?: string | null;
  profileVisibility?: string | null;
  updatedAt?: string;
}

export interface UpdateProfileVisibilityResponse {
  success: boolean;
  message?: string | null;
  data?: UpdateProfileVisibilityData;
}

// ─── 3. CLIENT COMPANY (A-04) ───────────────────────────────────────────────

export interface CompanyProfileData {
  companyId: string;
  companyName?: string | null;
  taxCode?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  address?: string | null;
  description?: string | null;
  verificationStatus?: string | null;
  verifiedAt?: string | null;
  roleInCompany?: string | null;
  isPrimaryContact: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyProfileResponse {
  success: boolean;
  message?: string | null;
  data?: CompanyProfileData;
}

export interface UpdateCompanyProfileCommand {
  companyName?: string | null;
  taxCode?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  address?: string | null;
  description?: string | null;
}

export interface UpdateCompanyProfileData {
  companyId: string;
  companyName?: string | null;
  taxCode?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  address?: string | null;
  description?: string | null;
  verificationStatus?: string | null;
  verifiedAt?: string | null;
  roleInCompany?: string | null;
  isPrimaryContact: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateCompanyProfileResponse {
  success: boolean;
  message?: string | null;
  data?: UpdateCompanyProfileData;
}
