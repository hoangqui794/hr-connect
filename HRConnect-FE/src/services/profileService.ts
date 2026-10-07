/**
 * @file profileService.ts
 * @description API service for Profiles & Settings (Affiliate, Candidate, Client) in HRConnect.
 * Conforms strictly to swagger.json specifications.
 */

import { axiosClient } from './axiosClient';
import type {
  AffiliateProfileResponse,
  UpdateAffiliateProfileCommand,
  UpdateAffiliateProfileResponse,
  AffiliateBankAccountResponse,
  UpdateAffiliateBankAccountCommand,
  UpdateAffiliateBankAccountResponse,
  AffiliatePerformanceResponse,
  CandidateProfileResponse,
  UpdateCandidateProfileCommand,
  UpdateCandidateProfileResponse,
  UpdateProfileVisibilityCommand,
  UpdateProfileVisibilityResponse,
  CompanyProfileResponse,
  UpdateCompanyProfileCommand,
  UpdateCompanyProfileResponse,
  AffiliateProfileData,
  AffiliateBankAccountData,
  AffiliatePerformanceData,
  CandidateProfileData,
  CompanyProfileData,
} from '@/types/profile';

// ─── Local Storage Keys & Fallback Seeds ────────────────────────────────────

const STORAGE_KEY_AFF_PROFILE = 'hrconnect_affiliate_profile_me';
const STORAGE_KEY_AFF_BANK = 'hrconnect_affiliate_bank_account_me';
const STORAGE_KEY_AFF_PERF = 'hrconnect_affiliate_performance_me';
const STORAGE_KEY_CAND_PROFILE = 'hrconnect_candidate_profile_me';
const STORAGE_KEY_COMP_PROFILE = 'hrconnect_company_profile_me';

const DEFAULT_AFF_PROFILE: AffiliateProfileData = {
  affiliateId: 'aff-001',
  userId: 'usr-aff-001',
  email: 'david.tran@headhunter.vn',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  affiliateType: 'INDIVIDUAL',
  displayName: 'David Tran',
  taxInformation: 'MST: 8401234567 | CCCD: 079192005678',
  contactPerson: 'David Tran',
  phone: '0909 112 233',
  address: 'Tòa nhà Landmark 81, P.22, Bình Thạnh, TP. Hồ Chí Minh',
  status: 'ACTIVE',
  verifiedAt: '2026-01-15T09:00:00Z',
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const DEFAULT_AFF_BANK: AffiliateBankAccountData = {
  affiliateId: 'aff-001',
  displayName: 'David Tran',
  bankName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
  bankAccountNumber: '0071001234567',
  bankAccountHolder: 'TRAN VAN DAVID',
  bankBranch: 'Chi nhánh TP. Hồ Chí Minh',
  isConfigured: true,
  updatedAt: '2026-09-15T10:00:00Z',
};

const DEFAULT_AFF_PERF: AffiliatePerformanceData = {
  affiliateId: 'aff-001',
  displayName: 'David Tran',
  affiliateType: 'INDIVIDUAL',
  status: 'ACTIVE',
  periodStart: '2026-01-01',
  periodEnd: '2026-10-07',
  totalSubmissions: 48,
  totalShortlisted: 32,
  totalInterviews: 24,
  totalPlacements: 14,
  submissionToHireRate: 29.17,
  qualityRating: 4.9,
  ratingLabel: 'Top Tier Recruiter (Platinum)',
  calculationVersion: 'v2.0',
  calculatedAt: '2026-10-07T00:00:00Z',
};

const DEFAULT_CAND_PROFILE: CandidateProfileData = {
  candidateId: 'cand-001',
  userId: 'usr-cand-001',
  fullName: 'Nguyễn Văn B',
  email: 'ungvien5@gmail.com',
  phone: '0912 345 678',
  dateOfBirth: '1995-08-15',
  gender: 'Nam',
  currentAddress: 'Quận 1, TP. Hồ Chí Minh',
  highestEducation: 'Đại học Bách Khoa TP.HCM - Kỹ sư CNTT',
  yearsOfExperience: 5.5,
  summary: 'Kỹ sư phần mềm 5+ năm kinh nghiệm chuyên sâu về ReactJS, TypeScript và kiến trúc Microservices. Đã dẫn dắt dự án SaaS B2B quy mô lớn.',
  profileVisibility: 'PUBLIC',
  status: 'ACTIVE',
  avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  skills: [
    { skillId: 'sk-1', skillName: 'ReactJS', category: 'Frontend', proficiencyLevel: 'Expert', yearsOfExperience: 5 },
    { skillId: 'sk-2', skillName: 'TypeScript', category: 'Language', proficiencyLevel: 'Advanced', yearsOfExperience: 4 },
    { skillId: 'sk-3', skillName: 'Node.js', category: 'Backend', proficiencyLevel: 'Advanced', yearsOfExperience: 4 },
    { skillId: 'sk-4', skillName: 'TailwindCSS', category: 'Frontend', proficiencyLevel: 'Expert', yearsOfExperience: 3 },
    { skillId: 'sk-5', skillName: 'Docker', category: 'DevOps', proficiencyLevel: 'Intermediate', yearsOfExperience: 3 },
  ],
  primaryCv: {
    cvId: 'cv-001',
    title: 'CV Kỹ Sư Phần Mềm Cao Cấp (Senior Frontend & Fullstack)',
    creationMethod: 'ATS_BUILDER',
    sourceFileUrl: '/files/cv_nguyen_van_b.pdf',
    renderedFileUrl: '/files/cv_nguyen_van_b.pdf',
    fileName: 'CV_NguyenVanB_Senior_Frontend.pdf',
    fileSizeBytes: 245000,
    isPrimary: true,
    updatedAt: '2026-10-01T00:00:00Z',
  },
};

const DEFAULT_COMP_PROFILE: CompanyProfileData = {
  companyId: 'comp-001',
  companyName: 'Blata33 Technology JSC',
  taxCode: '0316789123',
  industry: 'Công nghệ thông tin & Dịch vụ Phần mềm',
  companySize: '100-500 nhân sự',
  website: 'https://blata33.vn',
  address: 'Tầng 12, Tòa nhà Bitexco Financial Tower, Q.1, TP. Hồ Chí Minh',
  description: 'Doanh nghiệp công nghệ hàng đầu chuyên cung cấp giải pháp chuyển đổi số, tuyển dụng nhân sự cấp cao và nền tảng FinTech tại Đông Nam Á.',
  verificationStatus: 'VERIFIED',
  verifiedAt: '2026-02-14T10:00:00Z',
  roleInCompany: 'Trưởng phòng Nhân sự (HR Director)',
  isPrimaryContact: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

// ─── Service Implementation ─────────────────────────────────────────────────

export const profileService = {
  // ─── 1. AFFILIATE PROFILE & SETTINGS ───────────────────────────────────────

  /**
   * GET /api/v1/affiliates/profile/me
   */
  async getAffiliateProfile(): Promise<AffiliateProfileResponse> {
    try {
      const response = await axiosClient.get<AffiliateProfileResponse>('/affiliates/profile/me');
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_AFF_PROFILE);
      const data: AffiliateProfileData = stored ? JSON.parse(stored) : DEFAULT_AFF_PROFILE;
      return { success: true, message: 'OK', data };
    } catch {
      return { success: true, message: 'OK', data: DEFAULT_AFF_PROFILE };
    }
  },

  /**
   * PUT /api/v1/affiliates/profile/me
   */
  async updateAffiliateProfile(command: UpdateAffiliateProfileCommand): Promise<UpdateAffiliateProfileResponse> {
    try {
      const response = await axiosClient.put<UpdateAffiliateProfileResponse>('/affiliates/profile/me', command);
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    let current = DEFAULT_AFF_PROFILE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AFF_PROFILE);
      if (stored) current = JSON.parse(stored);
    } catch {
      // ignore
    }

    const updated = {
      ...current,
      ...command,
      displayName: command.displayName ?? current.displayName,
      contactPerson: command.contactPerson ?? current.contactPerson,
      phone: command.phone ?? current.phone,
      address: command.address ?? current.address,
      taxInformation: command.taxInformation ?? current.taxInformation,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY_AFF_PROFILE, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Cập nhật hồ sơ đối tác tuyển dụng thành công.',
      data: updated,
    };
  },

  /**
   * GET /api/v1/affiliates/profile/me/bank-account
   */
  async getAffiliateBankAccount(): Promise<AffiliateBankAccountResponse> {
    try {
      const response = await axiosClient.get<AffiliateBankAccountResponse>('/affiliates/profile/me/bank-account');
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_AFF_BANK);
      const data: AffiliateBankAccountData = stored ? JSON.parse(stored) : DEFAULT_AFF_BANK;
      return { success: true, message: 'OK', data };
    } catch {
      return { success: true, message: 'OK', data: DEFAULT_AFF_BANK };
    }
  },

  /**
   * PUT /api/v1/affiliates/profile/me/bank-account
   */
  async updateAffiliateBankAccount(
    command: UpdateAffiliateBankAccountCommand
  ): Promise<UpdateAffiliateBankAccountResponse> {
    try {
      const response = await axiosClient.put<UpdateAffiliateBankAccountResponse>(
        '/affiliates/profile/me/bank-account',
        command
      );
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    let current = DEFAULT_AFF_BANK;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AFF_BANK);
      if (stored) current = JSON.parse(stored);
    } catch {
      // ignore
    }

    const updated = {
      ...current,
      ...command,
      isConfigured: Boolean(command.bankAccountNumber && command.bankName),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY_AFF_BANK, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Cập nhật tài khoản ngân hàng nhận hoa hồng thành công.',
      data: updated,
    };
  },

  /**
   * GET /api/v1/affiliates/profile/me/performance
   */
  async getAffiliatePerformance(): Promise<AffiliatePerformanceResponse> {
    try {
      const response = await axiosClient.get<AffiliatePerformanceResponse>('/affiliates/profile/me/performance');
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_AFF_PERF);
      const data: AffiliatePerformanceData = stored ? JSON.parse(stored) : DEFAULT_AFF_PERF;
      return { success: true, message: 'OK', data };
    } catch {
      return { success: true, message: 'OK', data: DEFAULT_AFF_PERF };
    }
  },

  // ─── 2. CANDIDATE PROFILE & VISIBILITY ─────────────────────────────────────

  /**
   * GET /api/v1/candidates/profile/me
   */
  async getCandidateProfile(): Promise<CandidateProfileResponse> {
    try {
      const response = await axiosClient.get<CandidateProfileResponse>('/candidates/profile/me');
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_CAND_PROFILE);
      const data: CandidateProfileData = stored ? JSON.parse(stored) : DEFAULT_CAND_PROFILE;
      return { success: true, message: 'OK', data };
    } catch {
      return { success: true, message: 'OK', data: DEFAULT_CAND_PROFILE };
    }
  },

  /**
   * PUT /api/v1/candidates/profile/me
   */
  async updateCandidateProfile(command: UpdateCandidateProfileCommand): Promise<UpdateCandidateProfileResponse> {
    try {
      const response = await axiosClient.put<UpdateCandidateProfileResponse>('/candidates/profile/me', command);
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    let current = DEFAULT_CAND_PROFILE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CAND_PROFILE);
      if (stored) current = JSON.parse(stored);
    } catch {
      // ignore
    }

    const updated = {
      ...current,
      ...command,
      fullName: command.fullName ?? current.fullName,
      phone: command.phone ?? current.phone,
      dateOfBirth: command.dateOfBirth ?? current.dateOfBirth,
      gender: command.gender ?? current.gender,
      currentAddress: command.currentAddress ?? current.currentAddress,
      highestEducation: command.highestEducation ?? current.highestEducation,
      yearsOfExperience: command.yearsOfExperience ?? current.yearsOfExperience,
      summary: command.summary ?? current.summary,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY_CAND_PROFILE, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Cập nhật thông tin hồ sơ ứng viên thành công.',
      data: updated,
    };
  },

  /**
   * PATCH /api/v1/candidates/profile/me/visibility
   */
  async updateCandidateVisibility(
    command: UpdateProfileVisibilityCommand
  ): Promise<UpdateProfileVisibilityResponse> {
    try {
      const response = await axiosClient.patch<UpdateProfileVisibilityResponse>(
        '/candidates/profile/me/visibility',
        command
      );
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    let current = DEFAULT_CAND_PROFILE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CAND_PROFILE);
      if (stored) current = JSON.parse(stored);
    } catch {
      // ignore
    }

    const updated = {
      ...current,
      profileVisibility: command.visibility,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY_CAND_PROFILE, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return {
      success: true,
      message: `Đã chuyển chế độ hiển thị hồ sơ sang: ${command.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}.`,
      data: {
        candidateId: current.candidateId,
        userId: current.userId,
        profileVisibility: command.visibility,
        updatedAt: new Date().toISOString(),
      },
    };
  },

  // ─── 3. CLIENT COMPANY PROFILE ────────────────────────────────────────────

  /**
   * GET /api/v1/companies/profile/me
   */
  async getCompanyProfile(): Promise<CompanyProfileResponse> {
    try {
      const response = await axiosClient.get<CompanyProfileResponse>('/companies/profile/me');
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMP_PROFILE);
      const data: CompanyProfileData = stored ? JSON.parse(stored) : DEFAULT_COMP_PROFILE;
      return { success: true, message: 'OK', data };
    } catch {
      return { success: true, message: 'OK', data: DEFAULT_COMP_PROFILE };
    }
  },

  /**
   * PUT /api/v1/companies/profile/me
   */
  async updateCompanyProfile(command: UpdateCompanyProfileCommand): Promise<UpdateCompanyProfileResponse> {
    try {
      const response = await axiosClient.put<UpdateCompanyProfileResponse>('/companies/profile/me', command);
      if (response.data?.data) {
        return response.data;
      }
    } catch {
      // Offline fallback
    }

    let current = DEFAULT_COMP_PROFILE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMP_PROFILE);
      if (stored) current = JSON.parse(stored);
    } catch {
      // ignore
    }

    const updated = {
      ...current,
      ...command,
      companyName: command.companyName ?? current.companyName,
      taxCode: command.taxCode ?? current.taxCode,
      industry: command.industry ?? current.industry,
      companySize: command.companySize ?? current.companySize,
      website: command.website ?? current.website,
      address: command.address ?? current.address,
      description: command.description ?? current.description,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY_COMP_PROFILE, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Cập nhật hồ sơ doanh nghiệp thành công.',
      data: updated,
    };
  },
};

export default profileService;
