/**
 * @file useProfiles.ts
 * @description React Query hooks for Profiles & Settings (Affiliate, Candidate, Client).
 * Features automatic query invalidation and strict type safety conforming to swagger.json.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import type {
  UpdateAffiliateProfileCommand,
  UpdateAffiliateBankAccountCommand,
  UpdateCandidateProfileCommand,
  UpdateProfileVisibilityCommand,
  UpdateCompanyProfileCommand,
  AffiliateProfileData,
  AffiliateBankAccountData,
  AffiliatePerformanceData,
  CandidateProfileData,
  CompanyProfileData,
} from '@/types/profile';

export const profileKeys = {
  all: ['profile'] as const,
  affiliate: () => [...profileKeys.all, 'affiliate'] as const,
  affiliateBank: () => [...profileKeys.all, 'affiliate', 'bank'] as const,
  affiliatePerformance: () => [...profileKeys.all, 'affiliate', 'performance'] as const,
  candidate: () => [...profileKeys.all, 'candidate'] as const,
  company: () => [...profileKeys.all, 'company'] as const,
};

// ─── 1. AFFILIATE HOOKS ──────────────────────────────────────────────────────

/**
 * Hook query thông tin hồ sơ Affiliate Recruiter: GET /api/v1/affiliates/profile/me
 */
export function useAffiliateProfile() {
  return useQuery<AffiliateProfileData | undefined>({
    queryKey: profileKeys.affiliate(),
    queryFn: async () => {
      const res = await profileService.getAffiliateProfile();
      return res.data;
    },
    staleTime: 30000,
  });
}

/**
 * Mutation cập nhật hồ sơ Affiliate Recruiter: PUT /api/v1/affiliates/profile/me
 */
export function useUpdateAffiliateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateAffiliateProfileCommand) =>
      profileService.updateAffiliateProfile(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.affiliate() });
    },
  });
}

/**
 * Hook query tài khoản ngân hàng nhận hoa hồng: GET /api/v1/affiliates/profile/me/bank-account
 */
export function useAffiliateBankAccount() {
  return useQuery<AffiliateBankAccountData | undefined>({
    queryKey: profileKeys.affiliateBank(),
    queryFn: async () => {
      const res = await profileService.getAffiliateBankAccount();
      return res.data;
    },
    staleTime: 30000,
  });
}

/**
 * Mutation cập nhật tài khoản ngân hàng: PUT /api/v1/affiliates/profile/me/bank-account
 */
export function useUpdateAffiliateBankAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateAffiliateBankAccountCommand) =>
      profileService.updateAffiliateBankAccount(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.affiliateBank() });
    },
  });
}

/**
 * Hook query thống kê hiệu suất tuyển dụng Affiliate: GET /api/v1/affiliates/profile/me/performance
 */
export function useAffiliatePerformance() {
  return useQuery<AffiliatePerformanceData | undefined>({
    queryKey: profileKeys.affiliatePerformance(),
    queryFn: async () => {
      const res = await profileService.getAffiliatePerformance();
      return res.data;
    },
    staleTime: 30000,
  });
}

// ─── 2. CANDIDATE HOOKS ──────────────────────────────────────────────────────

/**
 * Hook query thông tin hồ sơ ứng viên: GET /api/v1/candidates/profile/me
 */
export function useCandidateProfile() {
  return useQuery<CandidateProfileData | undefined>({
    queryKey: profileKeys.candidate(),
    queryFn: async () => {
      const res = await profileService.getCandidateProfile();
      return res.data;
    },
    staleTime: 30000,
  });
}

/**
 * Mutation cập nhật thông tin hồ sơ ứng viên: PUT /api/v1/candidates/profile/me
 */
export function useUpdateCandidateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateCandidateProfileCommand) =>
      profileService.updateCandidateProfile(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.candidate() });
    },
  });
}

/**
 * Mutation cập nhật chế độ hiển thị hồ sơ: PATCH /api/v1/candidates/profile/me/visibility
 */
export function useUpdateCandidateVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateProfileVisibilityCommand) =>
      profileService.updateCandidateVisibility(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.candidate() });
    },
  });
}

// ─── 3. COMPANY HOOKS ────────────────────────────────────────────────────────

/**
 * Hook query thông tin hồ sơ doanh nghiệp: GET /api/v1/companies/profile/me
 */
export function useCompanyProfile() {
  return useQuery<CompanyProfileData | undefined>({
    queryKey: profileKeys.company(),
    queryFn: async () => {
      const res = await profileService.getCompanyProfile();
      return res.data;
    },
    staleTime: 30000,
  });
}

/**
 * Mutation cập nhật thông tin doanh nghiệp: PUT /api/v1/companies/profile/me
 */
export function useUpdateCompanyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: UpdateCompanyProfileCommand) =>
      profileService.updateCompanyProfile(command),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.company() });
    },
  });
}
