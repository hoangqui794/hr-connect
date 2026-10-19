/**
 * @file reportApi.ts
 * @description API client for Admin Reports (Overview, Revenue, Top Affiliates, Top Companies).
 */

import { apiClient } from '@/services/apiClient';
import type {
  ReportOverviewData,
  ReportRevenueData,
  TopAffiliateItem,
  TopCompanyItem,
} from '@/types/api/report';

const cleanParams = <T extends object>(params?: T): Partial<T> | undefined => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as Partial<T>;
};

export const reportApi = {
  /**
   * GET /api/v1/reports/overview
   */
  async getOverview(params?: { from?: string; to?: string }): Promise<ReportOverviewData> {
    const response = await apiClient.get<{ success: boolean; data: ReportOverviewData }>(
      '/reports/overview',
      { params: cleanParams(params) }
    );
    return response.data.data;
  },

  /**
   * GET /api/v1/reports/revenue
   */
  async getRevenue(params?: {
    from?: string;
    to?: string;
    groupBy?: 'month' | 'quarter' | 'year';
  }): Promise<ReportRevenueData> {
    const response = await apiClient.get<{ success: boolean; data: ReportRevenueData }>(
      '/reports/revenue',
      { params: cleanParams(params) }
    );
    return response.data.data;
  },

  /**
   * GET /api/v1/reports/top-affiliates
   */
  async getTopAffiliates(params?: {
    from?: string;
    to?: string;
    sortBy?: 'placements' | 'conversion' | 'commission';
    limit?: number;
  }): Promise<TopAffiliateItem[]> {
    const response = await apiClient.get<{ success: boolean; data: { items: TopAffiliateItem[] } }>(
      '/reports/top-affiliates',
      { params: cleanParams(params) }
    );
    return response.data.data?.items ?? [];
  },

  /**
   * GET /api/v1/reports/top-companies
   */
  async getTopCompanies(params?: {
    from?: string;
    to?: string;
    sortBy?: 'placements' | 'revenue' | 'active_jobs';
    limit?: number;
  }): Promise<TopCompanyItem[]> {
    const response = await apiClient.get<{ success: boolean; data: { items: TopCompanyItem[] } }>(
      '/reports/top-companies',
      { params: cleanParams(params) }
    );
    return response.data.data?.items ?? [];
  },
};

export default reportApi;
