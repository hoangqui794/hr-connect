/**
 * @file services/api/companyDirectoryApi.ts
 * @description Public company directory. Only VERIFIED companies are returned; a company's jobs are the
 * ACTIVE ones a Candidate may view.
 */
import { apiClient } from '../apiClient';
import type { Job } from '@/types/api/jobs';

export interface DirectoryCompany {
  companyId: string;
  companyName: string;
  logoUrl?: string | null;
  industry?: { industryId: string; name: string } | null;
  companySize?: { companySizeId: string; label: string } | null;
  website?: string | null;
  address?: string | null;
  description?: string | null;
  isFeatured: boolean;
  activeJobCount: number;
}

export interface DirectoryCompanyPage {
  items: DirectoryCompany[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface DirectoryIndustry {
  industryId: string;
  code: string;
  nameEn: string;
  nameVi?: string | null;
  level: number;
  parentId?: string | null;
  children?: DirectoryIndustry[] | null;
}

export interface DirectoryCompanySize {
  companySizeId: string;
  code: string;
  label: string;
  minEmployees: number;
  maxEmployees?: number | null;
}

export interface DirectorySearchParams {
  search?: string;
  /** Level 1/2 industries also match their child industries (server side). */
  industryId?: string;
  companySizeId?: string;
  location?: string;
  page: number;
  pageSize: number;
}

type Envelope<T> = { success?: boolean; data: T };

export const companyDirectoryApi = {
  async search(params: DirectorySearchParams): Promise<DirectoryCompanyPage> {
    return (await apiClient.get<Envelope<DirectoryCompanyPage>>('/public/companies', { params })).data.data;
  },
  /** Active industries as a tree (level 1 → 2 → 3) for the company directory filter. */
  async industryTree(): Promise<DirectoryIndustry[]> {
    return (await apiClient.get<Envelope<DirectoryIndustry[]>>('/industries', { params: { tree: true } })).data.data ?? [];
  },
  async companySizes(): Promise<DirectoryCompanySize[]> {
    return (await apiClient.get<Envelope<DirectoryCompanySize[]>>('/company-sizes')).data.data ?? [];
  },
  async featured(): Promise<DirectoryCompany[]> {
    return (await apiClient.get<Envelope<DirectoryCompany[]>>('/public/companies/featured')).data.data ?? [];
  },
  async detail(companyId: string): Promise<{ company: DirectoryCompany; jobs: Job[] }> {
    return (await apiClient.get<Envelope<{ company: DirectoryCompany; jobs: Job[] }>>(`/public/companies/${companyId}`)).data.data;
  },
  async industries(): Promise<DirectoryIndustry[]> {
    return (await apiClient.get<Envelope<DirectoryIndustry[]>>('/industries', { params: { level: 1 } })).data.data ?? [];
  },
};
